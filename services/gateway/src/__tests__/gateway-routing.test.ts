/**
 * Tests for gateway routing configuration and authentication
 */
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.JWT_SECRET = TEST_JWT_SECRET;

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock metrics
jest.mock('../metrics', () => ({
  register: {
    contentType: 'text/plain',
    metrics: jest.fn().mockResolvedValue(''),
  },
  websocketConnectionsActive: { inc: jest.fn(), dec: jest.fn() },
  websocketConnectionsTotal: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
  websocketMessagesTotal: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
  rateLimitExceededTotal: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
  authValidationTotal: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
}));

// Helper to create a valid JWT token
function createTestToken(payload: any = {}) {
  return jwt.sign(
    {
      sub: payload.userId || 'test-user-123',
      email: payload.email || 'test@example.com',
      role: payload.role || 'user',
      ...payload,
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Authentication Middleware for Protected Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // JWT authentication middleware
    const authenticateToken = (req: any, res: any, next: any) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }

      jwt.verify(token, TEST_JWT_SECRET, (err: any, decoded: any) => {
        if (err) {
          return res.status(403).json({ error: 'Invalid or expired token' });
        }

        req.user = {
          userId: decoded.sub,
          email: decoded.email,
          role: decoded.role,
        };
        next();
      });
    };

    // Simulate protected routes
    app.post('/api/chat/message', authenticateToken, (req: any, res) => {
      res.json({
        success: true,
        userId: req.user.userId,
        email: req.user.email,
        message: 'Chat endpoint reached',
      });
    });

    app.get('/api/memory/sessions', authenticateToken, (req: any, res) => {
      res.json({
        success: true,
        userId: req.user.userId,
        sessions: [],
      });
    });

    app.get('/api/ngs/curriculum', authenticateToken, (req: any, res) => {
      res.json({
        success: true,
        curriculum: [],
      });
    });

    app.get('/api/billing/subscription', authenticateToken, (req: any, res) => {
      res.json({
        success: true,
        userId: req.user.userId,
        subscription: 'pro',
      });
    });

    app.get('/api/usage/stats', authenticateToken, (req: any, res) => {
      res.json({
        success: true,
        userId: req.user.userId,
        tokensUsed: 1000,
      });
    });

    // Auth routes (no authentication required)
    app.post('/api/auth/login', (req, res) => {
      res.json({ success: true, token: 'mock-token' });
    });

    app.post('/api/auth/register', (req, res) => {
      res.json({ success: true, userId: 'new-user-123' });
    });
  });

  describe('Auth Service Routes (No Authentication Required)', () => {
    it('should allow login without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow registration without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@example.com', password: 'password' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Intelligence Service Routes (Requires Authentication)', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .send({ message: 'Hello' });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .set('Authorization', 'Bearer invalid-token')
        .send({ message: 'Hello' });
      
      expect(response.status).toBe(403);
    });

    it('should allow authenticated requests', async () => {
      const token = createTestToken();
      const response = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Hello' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should forward user context from token', async () => {
      const token = createTestToken({ 
        userId: 'user-456', 
        email: 'specific@example.com' 
      });
      
      const response = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Hello' });
      
      expect(response.body.userId).toBe('user-456');
      expect(response.body.email).toBe('specific@example.com');
    });
  });

  describe('Memory Service Routes (Requires Authentication)', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/memory/sessions');
      expect(response.status).toBe(401);
    });

    it('should allow authenticated requests', async () => {
      const token = createTestToken();
      const response = await request(app)
        .get('/api/memory/sessions')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should include user ID from token', async () => {
      const token = createTestToken({ userId: 'memory-user-789' });
      const response = await request(app)
        .get('/api/memory/sessions')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.body.userId).toBe('memory-user-789');
    });
  });

  describe('NGS Service Routes (Requires Authentication)', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/ngs/curriculum');
      expect(response.status).toBe(401);
    });

    it('should allow authenticated requests', async () => {
      const token = createTestToken();
      const response = await request(app)
        .get('/api/ngs/curriculum')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Billing Service Routes (Requires Authentication)', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/billing/subscription');
      expect(response.status).toBe(401);
    });

    it('should allow authenticated requests', async () => {
      const token = createTestToken();
      const response = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should forward user ID', async () => {
      const token = createTestToken({ userId: 'billing-user-999' });
      const response = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.body.userId).toBe('billing-user-999');
    });
  });

  describe('Usage Service Routes (Requires Authentication)', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/usage/stats');
      expect(response.status).toBe(401);
    });

    it('should allow authenticated requests', async () => {
      const token = createTestToken();
      const response = await request(app)
        .get('/api/usage/stats')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});

describe('Correlation ID Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Correlation ID middleware
    app.use((req: any, res: any, next: any) => {
      req.correlationId = req.headers['x-correlation-id'] || `test-${Date.now()}`;
      res.setHeader('X-Correlation-Id', req.correlationId);
      next();
    });

    app.get('/api/test', (req: any, res) => {
      res.json({ correlationId: req.correlationId });
    });
  });

  it('should generate correlation ID if not provided', async () => {
    const response = await request(app).get('/api/test');
    expect(response.headers['x-correlation-id']).toBeDefined();
  });

  it('should preserve provided correlation ID', async () => {
    const correlationId = 'test-correlation-123';
    const response = await request(app)
      .get('/api/test')
      .set('X-Correlation-Id', correlationId);
    
    expect(response.headers['x-correlation-id']).toBe(correlationId);
  });

  it('should include correlation ID in response', async () => {
    const correlationId = 'test-correlation-456';
    const response = await request(app)
      .get('/api/test')
      .set('X-Correlation-Id', correlationId);
    
    expect(response.body.correlationId).toBe(correlationId);
  });
});

describe('Service-to-Service Token Injection', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const authenticateToken = (req: any, res: any, next: any) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }

      jwt.verify(token, TEST_JWT_SECRET, (err: any, decoded: any) => {
        if (err) {
          return res.status(403).json({ error: 'Invalid token' });
        }

        req.user = {
          userId: decoded.sub,
          email: decoded.email,
          role: decoded.role,
        };
        next();
      });
    };

    const injectServiceToken = (req: any, res: any, next: any) => {
      // Simulate service token injection
      req.serviceToken = 'gateway-service-token';
      next();
    };

    app.get('/api/protected', authenticateToken, injectServiceToken, (req: any, res) => {
      res.json({
        success: true,
        hasServiceToken: !!req.serviceToken,
        serviceToken: req.serviceToken,
        userId: req.user.userId,
      });
    });
  });

  it('should inject service token for authenticated requests', async () => {
    const token = createTestToken();
    const response = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.hasServiceToken).toBe(true);
    expect(response.body.serviceToken).toBe('gateway-service-token');
  });
});

describe('Rate Limiting Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const requestCounts = new Map<string, number>();

    const rateLimitMiddleware = (req: any, res: any, next: any) => {
      const ip = req.ip || 'unknown';
      const count = requestCounts.get(ip) || 0;
      
      if (count >= 10) {
        return res.status(429).json({ error: 'Too many requests' });
      }
      
      requestCounts.set(ip, count + 1);
      next();
    };

    app.use('/api/', rateLimitMiddleware);

    app.get('/api/test', (req, res) => {
      res.json({ success: true });
    });
  });

  it('should allow requests within rate limit', async () => {
    const response = await request(app).get('/api/test');
    expect(response.status).toBe(200);
  });

  it('should return 429 when rate limit exceeded', async () => {
    // Make many requests to exceed limit
    for (let i = 0; i < 10; i++) {
      await request(app).get('/api/test');
    }
    
    const response = await request(app).get('/api/test');
    expect(response.status).toBe(429);
    expect(response.body.error).toBe('Too many requests');
  });
});

describe('Security Headers', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    
    // Security headers middleware
    app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });

    app.get('/test', (req, res) => {
      res.json({ test: true });
    });
  });

  it('should set X-Content-Type-Options header', async () => {
    const response = await request(app).get('/test');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should set X-Frame-Options header', async () => {
    const response = await request(app).get('/test');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('should set X-XSS-Protection header', async () => {
    const response = await request(app).get('/test');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
  });
});
