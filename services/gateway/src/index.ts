import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { createServer, request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { generateServiceToken, serviceAuthMiddleware } from './middleware/service-auth';
import { metricsMiddleware } from './middleware/metrics-middleware';
import { correlationIdMiddleware } from './middleware/correlation-id';
import { register, websocketConnectionsActive, websocketConnectionsTotal, websocketMessagesTotal, rateLimitExceededTotal, authValidationTotal } from './metrics';
import { logger } from './logger';

config();

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

if (!process.env.SERVICE_JWT_SECRET) {
  console.error('FATAL: SERVICE_JWT_SECRET environment variable is required');
  process.exit(1);
}
const SERVICE_JWT_SECRET = process.env.SERVICE_JWT_SECRET;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];

// Generate service token for Gateway (cache it and regenerate when needed)
let gatewayServiceToken = '';
try {
  if (SERVICE_JWT_SECRET) {
    gatewayServiceToken = generateServiceToken('gateway');
    console.log('Gateway service token generated successfully');
  } else {
    console.warn('WARNING: SERVICE_JWT_SECRET not set. Service-to-service auth disabled.');
  }
} catch (error) {
  console.error('Failed to generate gateway service token:', error);
}

// Service URLs
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const INTELLIGENCE_SERVICE_URL = process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:8000';
const MEMORY_SERVICE_URL = process.env.MEMORY_SERVICE_URL || 'http://localhost:8001';
const POLICY_SERVICE_URL = process.env.POLICY_SERVICE_URL || 'http://localhost:4000';
const NGS_SERVICE_URL = process.env.NGS_SERVICE_URL || 'http://localhost:9000';
const NOTES_SERVICE_URL = process.env.NOTES_SERVICE_URL || 'http://localhost:8085';
const STUDY_SERVICE_URL = process.env.STUDY_SERVICE_URL || 'http://localhost:8090';
const QUIZ_SERVICE_URL = process.env.QUIZ_SERVICE_URL || 'http://localhost:8091';

type ServiceStatus = 'online' | 'offline' | 'degraded';

interface ServiceHealthResult {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  detailStatus?: string;
  error?: string;
}

interface JsonRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

const ensureTrailingSlash = (value: string) => (value.endsWith('/') ? value : `${value}/`);

const jsonGet = <T = unknown>(targetUrl: string, options: JsonRequestOptions = {}) =>
  new Promise<{ statusCode?: number; data?: T; raw?: string }>((resolve, reject) => {
    try {
      const url = new URL(targetUrl);
      const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = requestFn(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port,
          path: `${url.pathname}${url.search}`,
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...options.headers,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => {
            if (Buffer.isBuffer(chunk)) {
              chunks.push(chunk);
            } else if (typeof chunk === 'string') {
              chunks.push(Buffer.from(chunk));
            } else {
              chunks.push(Buffer.from(chunk));
            }
          });
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            if (!raw) {
              resolve({ statusCode: res.statusCode });
              return;
            }
            try {
              resolve({ statusCode: res.statusCode, data: JSON.parse(raw) as T, raw });
            } catch {
              resolve({ statusCode: res.statusCode, raw });
            }
          });
        }
      );

      const timeoutMs = options.timeoutMs ?? 4000;
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('Request timed out'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    } catch (error) {
      reject(error);
    }
  });

const checkServiceHealth = async (name: string, baseUrl: string): Promise<ServiceHealthResult> => {
  const startedAt = Date.now();
  try {
    const healthUrl = new URL('health', ensureTrailingSlash(baseUrl)).toString();
    const { statusCode, data } = await jsonGet<{ status?: string }>(healthUrl, { timeoutMs: 3000 });
    const latencyMs = Date.now() - startedAt;
    if (statusCode && statusCode >= 200 && statusCode < 300) {
      const normalized = typeof data?.status === 'string' ? data.status.toLowerCase() : undefined;
      const isHealthy = normalized === undefined || normalized === 'healthy';
      return {
        name,
        status: isHealthy ? 'online' : 'degraded',
        latencyMs,
        detailStatus: normalized,
      };
    }
    return {
      name,
      status: 'offline',
      latencyMs,
      error: statusCode ? `Unexpected status ${statusCode}` : 'Health check returned no status code',
    };
  } catch (error) {
    return {
      name,
      status: 'offline',
      error: error instanceof Error ? error.message : 'Health check failed',
    };
  }
};

const userTierCache = new Map<string, { tier: string; expiresAt: number }>();
const USER_TIER_CACHE_TTL_MS = 60_000;
const MAX_USER_TIER_CACHE_ENTRIES = 1000;

const getCachedTier = (userId: string) => {
  const cached = userTierCache.get(userId);
  if (!cached) {
    return undefined;
  }
  if (cached.expiresAt < Date.now()) {
    userTierCache.delete(userId);
    return undefined;
  }
  return cached.tier;
};

const setCachedTier = (userId: string, tier: string) => {
  if (userTierCache.size >= MAX_USER_TIER_CACHE_ENTRIES) {
    const oldestKey = userTierCache.keys().next().value;
    if (oldestKey) {
      userTierCache.delete(oldestKey);
    }
  }
  userTierCache.set(userId, {
    tier,
    expiresAt: Date.now() + USER_TIER_CACHE_TTL_MS,
  });
};

const fetchUserTier = async (authorizationHeader: string): Promise<string | undefined> => {
  try {
    const meUrl = new URL('auth/me', ensureTrailingSlash(AUTH_SERVICE_URL)).toString();
    const { statusCode, data } = await jsonGet<{ subscription_tier?: string; user?: { subscription_tier?: string } }>(
      meUrl,
      {
        headers: {
          Authorization: authorizationHeader,
        },
        timeoutMs: 4000,
      }
    );

    if (statusCode !== 200 || !data) {
      if (statusCode && statusCode >= 500) {
        logger.warn({
          message: 'Auth service tier lookup failed',
          statusCode,
        });
      }
      return undefined;
    }

    if (typeof data.subscription_tier === 'string') {
      return data.subscription_tier;
    }

    if (data.user && typeof data.user.subscription_tier === 'string') {
      return data.user.subscription_tier;
    }
  } catch (error) {
    logger.warn({
      message: 'Failed to resolve user tier from auth service',
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }

  return undefined;
};

const ensureUserTier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.userId) {
    next();
    return;
  }

  if (req.user.subscription_tier) {
    setCachedTier(req.user.userId, req.user.subscription_tier);
    next();
    return;
  }

  const cachedTier = getCachedTier(req.user.userId);
  if (cachedTier) {
    req.user.subscription_tier = cachedTier;
    next();
    return;
  }

  const authorizationHeaderRaw = req.headers['authorization'];
  const authorizationHeader = Array.isArray(authorizationHeaderRaw)
    ? authorizationHeaderRaw[0]
    : authorizationHeaderRaw;

  if (!authorizationHeader) {
    next();
    return;
  }

  try {
    const tier = await fetchUserTier(authorizationHeader);
    if (tier) {
      req.user.subscription_tier = tier;
      setCachedTier(req.user.userId, tier);
    }
  } catch (error) {
    logger.warn({
      message: 'User tier lookup unexpectedly failed',
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }

  next();
};

const forwardJsonBody = (proxyReq: any, req: Request) => {
  if (!req.body || !Object.keys(req.body).length) {
    return;
  }

  const bodyData = JSON.stringify(req.body);
  proxyReq.setHeader('Content-Type', 'application/json');
  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
};

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Correlation ID middleware (must be early in the chain)
app.use(correlationIdMiddleware);

// Metrics middleware (must be early to track all requests)
app.use(metricsMiddleware);

// Security headers using helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Request size limits (security)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting with metrics tracking
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  handler: (req, res) => {
    // Track rate limit violations
    rateLimitExceededTotal.labels({ route: req.path }).inc();
    logger.warn({
      message: 'Rate limit exceeded',
      ip: req.ip,
      path: req.path,
      correlationId: (req as any).correlationId
    });
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.'
    });
  }
});

app.use('/api/', limiter);

// JWT validation middleware
interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    subscription_tier?: string;
  };
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    authValidationTotal.labels({ result: 'failure' }).inc();
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      authValidationTotal.labels({ result: 'failure' }).inc();
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    authValidationTotal.labels({ result: 'success' }).inc();
    req.user = {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      ...(decoded.subscription_tier && { subscription_tier: decoded.subscription_tier }),
    };
    next();
  });
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (!err && decoded) {
      req.user = {
        userId: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        ...(decoded.subscription_tier && { subscription_tier: decoded.subscription_tier }),
      };
    }
    next();
  });
};

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Health check (needs JSON parser)
app.get('/health', express.json(), (req, res) => {
  res.json({
    status: 'healthy',
    service: 'noble-gateway',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Status endpoint (needs JSON parser)
const SERVICE_HEALTH_TARGETS = [
  { name: 'auth', baseUrl: AUTH_SERVICE_URL },
  { name: 'intelligence', baseUrl: INTELLIGENCE_SERVICE_URL },
  { name: 'memory', baseUrl: MEMORY_SERVICE_URL },
  { name: 'ngs', baseUrl: NGS_SERVICE_URL },
  { name: 'policy', baseUrl: POLICY_SERVICE_URL },
];

app.get('/api/status', express.json(), async (req, res) => {
  const startedAt = Date.now();

  try {
    const results = await Promise.all(
      SERVICE_HEALTH_TARGETS.map((target) => checkServiceHealth(target.name, target.baseUrl))
    );

    const services: Record<string, ServiceStatus> = { gateway: 'online' };
    const details: Record<string, { status: ServiceStatus; latencyMs?: number; detailStatus?: string; error?: string }> = {
      gateway: { status: 'online' },
    };

    for (const result of results) {
      services[result.name] = result.status;
      details[result.name] = {
        status: result.status,
        ...(typeof result.latencyMs === 'number' ? { latencyMs: result.latencyMs } : {}),
        ...(result.detailStatus ? { detailStatus: result.detailStatus } : {}),
        ...(result.error ? { error: result.error } : {}),
      };
    }

    const overallStatus: ServiceStatus = results.some((item) => item.status === 'offline')
      ? 'offline'
      : results.some((item) => item.status === 'degraded')
      ? 'degraded'
      : 'online';

    res.json({
      message: 'Noble NovaCoreAI API Gateway',
      architecture: 'microservices',
      phase: 3,
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      status: overallStatus,
      services,
      details,
    });
  } catch (error) {
    logger.error({
      message: 'Failed to compute aggregated service status',
      error: error instanceof Error ? error.message : 'unknown error',
    });
    res.status(500).json({
      message: 'Noble NovaCoreAI API Gateway',
      architecture: 'microservices',
      phase: 3,
      checkedAt: new Date().toISOString(),
      status: 'offline',
      services: { gateway: 'online' },
      details: {
        gateway: { status: 'online' },
      },
    });
  }
});

// Auth service proxy (no auth required for login/register)
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/auth': '/auth',
    },
    onProxyReq: (proxyReq, req) => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        forwardJsonBody(proxyReq, req as Request);
      }
    },
    onError: (err, req, res: any) => {
      console.error('Auth service proxy error:', err.message);
      res.status(503).json({
        error: 'Auth service unavailable',
        message: err.message,
      });
    },
  })
);

// Notes API proxy (requires authentication)
app.use(
  '/api/notes',
  authenticateToken,
  createProxyMiddleware({
    target: NOTES_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/notes': '/notes',
    },
    onProxyReq: (proxyReq, req: AuthRequest) => {
      if (gatewayServiceToken) {
        proxyReq.setHeader('X-Service-Token', gatewayServiceToken);
      }
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.userId);
        proxyReq.setHeader('X-User-Email', req.user.email);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        forwardJsonBody(proxyReq, req as Request);
      }
    },
    onError: (err, req, res: any) => {
      console.error('Notes service proxy error:', err.message);
      res.status(503).json({
        error: 'Notes service unavailable',
        message: err.message,
      });
    },
  })
);

// Billing service proxy (requires authentication)
app.use(
  '/api/billing',
  authenticateToken,
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/billing': '/billing',
    },
    onProxyReq: (proxyReq, req: AuthRequest) => {
      // Add service-to-service authentication token
      if (gatewayServiceToken) {
        proxyReq.setHeader('X-Service-Token', gatewayServiceToken);
      }
      // Forward user info to billing service
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.userId);
        proxyReq.setHeader('X-User-Email', req.user.email);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        forwardJsonBody(proxyReq, req as Request);
      }
    },
    onError: (err, req, res: any) => {
      console.error('Billing service proxy error:', err.message);
      res.status(503).json({
        error: 'Billing service unavailable',
        message: err.message,
      });
    },
  })
);

// Usage service proxy (requires authentication)
app.use(
  '/api/usage',
  authenticateToken,
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/usage': '/usage',
    },
    onProxyReq: (proxyReq, req: AuthRequest) => {
      // Add service-to-service authentication token
      if (gatewayServiceToken) {
        proxyReq.setHeader('X-Service-Token', gatewayServiceToken);
      }
      // Forward user context
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.userId);
        proxyReq.setHeader('X-User-Email', req.user.email);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        forwardJsonBody(proxyReq, req as Request);
      }
    },
    onError: (err, req, res: any) => {
      console.error('Usage service proxy error:', err.message);
      res.status(503).json({
        error: 'Usage service unavailable',
        message: err.message,
      });
    },
  })
);

// Intelligence service proxy (requires authentication)
app.use(
  '/api/chat',
  authenticateToken,
  createProxyMiddleware({
    target: INTELLIGENCE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/chat': '/chat',
    },
    onProxyReq: (proxyReq, req: AuthRequest) => {
      // Add service-to-service authentication token
      if (gatewayServiceToken) {
        proxyReq.setHeader('X-Service-Token', gatewayServiceToken);
      }
      // Forward user context
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.userId);
        proxyReq.setHeader('X-User-Email', req.user.email);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        forwardJsonBody(proxyReq, req as Request);
      }
    },
    onError: (err, req, res: any) => {
      console.error('Intelligence service proxy error:', err.message);
      res.status(503).json({
        error: 'Intelligence service unavailable',
        message: err.message,
      });
    },
  })
);

// Memory service proxy (requires authentication)
app.use(
  '/api/memory',
  authenticateToken,
  ensureUserTier,
  createProxyMiddleware({
    target: MEMORY_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/memory': '/memory',
    },
    onProxyReq: (proxyReq, req: AuthRequest) => {
      // Add service-to-service authentication token
      if (gatewayServiceToken) {
        proxyReq.setHeader('X-Service-Token', gatewayServiceToken);
      }
      // Forward user context
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.userId);
        proxyReq.setHeader('X-User-Email', req.user.email);
        proxyReq.setHeader('X-User-Role', req.user.role);
        if (req.user.subscription_tier) {
          proxyReq.setHeader('X-User-Tier', req.user.subscription_tier);
        }
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        forwardJsonBody(proxyReq, req as Request);
      }
    },
    onError: (err, req, res: any) => {
      console.error('Memory service proxy error:', err.message);
      res.status(503).json({
        error: 'Memory service unavailable',
        message: err.message,
      });
    },
  })
);

// NGS Curriculum service proxy (requires authentication)
app.use(
  '/api/ngs',
  authenticateToken,
  createProxyMiddleware({
    target: NGS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/ngs': '/ngs',
    },
    onProxyReq: (proxyReq, req: AuthRequest) => {
      // Add service-to-service authentication token
      if (gatewayServiceToken) {
        proxyReq.setHeader('X-Service-Token', gatewayServiceToken);
      }
      // Forward user context
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.userId);
        proxyReq.setHeader('X-User-Email', req.user.email);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        forwardJsonBody(proxyReq, req as Request);
      }
    },
    onError: (err, req, res: any) => {
      console.error('NGS service proxy error:', err.message);
      res.status(503).json({
        error: 'NGS service unavailable',
        message: err.message,
      });
    },
  })
);

// MCP Server proxy (requires authentication)
const MCP_SERVICE_URL = process.env.MCP_SERVICE_URL || 'http://localhost:7000';
app.use(
  '/api/mcp',
  authenticateToken,
  createProxyMiddleware({
    target: MCP_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/mcp': '/mcp',
    },
    onProxyReq: (proxyReq, req: AuthRequest) => {
      // Add service-to-service authentication token
      if (gatewayServiceToken) {
        proxyReq.setHeader('X-Service-Token', gatewayServiceToken);
      }
      // Forward user context
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.userId);
        proxyReq.setHeader('X-User-Email', req.user.email);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        forwardJsonBody(proxyReq, req as Request);
      }
    },
    onError: (err, req, res: any) => {
      console.error('MCP service proxy error:', err.message);
      res.status(503).json({
        error: 'MCP service unavailable',
        message: err.message,
      });
    },
  })
);

// Study Engine proxy (requires authentication)
app.use(
  '/api/study',
  authenticateToken,
  createProxyMiddleware({
    target: STUDY_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/study': '/api',
    },
    onProxyReq: (proxyReq, req: AuthRequest) => {
      if (gatewayServiceToken) {
        proxyReq.setHeader('X-Service-Token', gatewayServiceToken);
      }
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.userId);
        proxyReq.setHeader('X-User-Email', req.user.email);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        forwardJsonBody(proxyReq, req as Request);
      }
    },
    onError: (err, req, res: any) => {
      console.error('Study service proxy error:', err.message);
      res.status(503).json({
        error: 'Study service unavailable',
        message: err.message,
      });
    },
  })
);

// Quiz Engine proxy (requires authentication)
app.use(
  '/api/quiz',
  authenticateToken,
  createProxyMiddleware({
    target: QUIZ_SERVICE_URL,
    changeOrigin: true,
    onProxyReq: (proxyReq, req: AuthRequest) => {
      if (gatewayServiceToken) {
        proxyReq.setHeader('X-Service-Token', gatewayServiceToken);
      }
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.userId);
        proxyReq.setHeader('X-User-Email', req.user.email);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        forwardJsonBody(proxyReq, req as Request);
      }
    },
    onError: (err, req, res: any) => {
      console.error('Quiz service proxy error:', err.message);
      res.status(503).json({
        error: 'Quiz service unavailable',
        message: err.message,
      });
    },
  })
);

// Internal Intelligence proxy (service-to-service)
app.use(
  '/internal/intelligence',
  serviceAuthMiddleware,
  createProxyMiddleware({
    target: INTELLIGENCE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/internal/intelligence': '/quiz',
    },
    onProxyReq: (proxyReq, req: Request) => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        forwardJsonBody(proxyReq, req);
      }
    },
    onError: (err, req, res: any) => {
      console.error('Intelligence internal proxy error:', err.message);
      res.status(503).json({
        error: 'Intelligence service unavailable',
        message: err.message,
      });
    },
  })
);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Create HTTP server
const server = createServer(app);

// WebSocket server setup
const wss = new WebSocketServer({ server, path: '/ws/chat' });

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  email?: string;
  role?: string;
  isAlive?: boolean;
}

wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
  logger.info('WebSocket connection attempt');

  // Extract token from query string or headers
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token') || req.headers['sec-websocket-protocol'];

  if (!token) {
    websocketConnectionsTotal.labels({ status: 'rejected' }).inc();
    logger.warn('WebSocket rejected: No token provided');
    ws.close(1008, 'Authentication required');
    return;
  }

  // Verify JWT token
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    ws.userId = decoded.sub;
    ws.email = decoded.email;
    ws.role = decoded.role;
    ws.isAlive = true;

    // Track successful connection
    websocketConnectionsTotal.labels({ status: 'success' }).inc();
    websocketConnectionsActive.inc();

    logger.info({
      message: 'WebSocket authenticated',
      email: ws.email,
      userId: ws.userId
    });

    ws.send(
      JSON.stringify({
        type: 'welcome',
        message: 'Connected to Noble NovaCoreAI',
        userId: ws.userId,
        email: ws.email,
        timestamp: new Date().toISOString(),
      })
    );
    websocketMessagesTotal.labels({ direction: 'outbound' }).inc();

    ws.on('message', (message) => {
      try {
        websocketMessagesTotal.labels({ direction: 'inbound' }).inc();
        const data = JSON.parse(message.toString());
        logger.debug({
          message: 'WebSocket message received',
          from: ws.email,
          type: data.type
        });

        // Echo for now - Phase 4 will route to Intelligence Core
        ws.send(
          JSON.stringify({
            type: 'message',
            userId: ws.userId,
            data: data,
            timestamp: new Date().toISOString(),
            note: 'Phase 4 - Intelligence Core integration coming soon',
          })
        );
        websocketMessagesTotal.labels({ direction: 'outbound' }).inc();
      } catch (err) {
        logger.error({
          message: 'WebSocket message error',
          error: err
        });
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'Invalid message format',
          })
        );
        websocketMessagesTotal.labels({ direction: 'outbound' }).inc();
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      websocketConnectionsActive.dec();
      logger.info({
        message: 'WebSocket disconnected',
        email: ws.email
      });
    });

    ws.on('error', (err) => {
      logger.error({
        message: 'WebSocket error',
        email: ws.email,
        error: err.message
      });
    });
  } catch (err) {
    websocketConnectionsTotal.labels({ status: 'rejected' }).inc();
    logger.warn('WebSocket rejected: Invalid token');
    ws.close(1008, 'Invalid token');
  }
});

// WebSocket heartbeat to detect broken connections
const wsInterval = setInterval(() => {
  wss.clients.forEach((ws: AuthenticatedWebSocket) => {
    if (ws.isAlive === false) {
      logger.info({
        message: 'Terminating inactive WebSocket',
        email: ws.email
      });
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Every 30 seconds

wss.on('close', () => {
  clearInterval(wsInterval);
});

// Start server
server.listen(PORT, () => {
  logger.info('🚀 Noble Gateway (Phase 3 - Complete)');
  logger.info(`📡 HTTP API: http://0.0.0.0:${PORT}`);
  logger.info(`🔌 WebSocket: ws://0.0.0.0:${PORT}/ws/chat`);
  logger.info(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  logger.info(`📊 Metrics: http://0.0.0.0:${PORT}/metrics`);
  logger.info(`🔐 JWT authentication: enabled`);
  logger.info(`📊 Rate limiting: enabled`);
  logger.info(`🔗 Correlation IDs: enabled`);
  logger.info('');
  logger.info('Service Routes:');
  logger.info(`  - /api/auth/* → ${AUTH_SERVICE_URL}`);
  logger.info(`  - /api/billing/* → ${AUTH_SERVICE_URL}`);
  logger.info(`  - /api/chat/* → ${INTELLIGENCE_SERVICE_URL}`);
  logger.info(`  - /api/memory/* → ${MEMORY_SERVICE_URL}`);
  logger.info(`  - /api/ngs/* → ${NGS_SERVICE_URL}`);
  logger.info(`  - /api/notes/* → ${NOTES_SERVICE_URL}`);
  logger.info(`  - /api/study/* → ${STUDY_SERVICE_URL}`);
  logger.info(`  - /api/quiz/* → ${QUIZ_SERVICE_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
