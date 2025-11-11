/**
 * Tests for health, status, and metrics endpoints
 */
import express from 'express';
import request from 'supertest';
import { register } from '../metrics';

// Mock metrics module
jest.mock('../metrics', () => ({
  register: {
    contentType: 'text/plain; version=0.0.4',
    metrics: jest.fn().mockResolvedValue('# HELP test_metric\n# TYPE test_metric counter\ntest_metric 42\n'),
  },
  websocketConnectionsActive: { inc: jest.fn(), dec: jest.fn() },
  websocketConnectionsTotal: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
  websocketMessagesTotal: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
  rateLimitExceededTotal: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
  authValidationTotal: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
}));

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Health Check Endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'noble-gateway',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    });
  });

  it('should return 200 status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  it('should return JSON content type', async () => {
    const response = await request(app).get('/health');
    expect(response.type).toBe('application/json');
  });

  it('should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.body.status).toBe('healthy');
  });

  it('should include service name', async () => {
    const response = await request(app).get('/health');
    expect(response.body.service).toBe('noble-gateway');
  });

  it('should include timestamp', async () => {
    const response = await request(app).get('/health');
    expect(response.body.timestamp).toBeDefined();
    expect(new Date(response.body.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should include version', async () => {
    const response = await request(app).get('/health');
    expect(response.body.version).toBeDefined();
    expect(response.body.version).toBe('1.0.0');
  });

  it('should handle multiple concurrent requests', async () => {
    const requests = Array(10).fill(null).map(() => request(app).get('/health'));
    const responses = await Promise.all(requests);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });
});

describe('Status Endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Status endpoint
    app.get('/api/status', (req, res) => {
      res.json({
        message: 'Noble NovaCoreAI API Gateway',
        architecture: 'microservices',
        phase: 3,
        services: {
          gateway: 'online',
          auth: 'online',
          intelligence: 'stub',
          memory: 'stub',
          ngs: 'stub',
          policy: 'not-started',
        },
      });
    });
  });

  it('should return 200 status', async () => {
    const response = await request(app).get('/api/status');
    expect(response.status).toBe(200);
  });

  it('should return JSON content type', async () => {
    const response = await request(app).get('/api/status');
    expect(response.type).toBe('application/json');
  });

  it('should include gateway message', async () => {
    const response = await request(app).get('/api/status');
    expect(response.body.message).toBe('Noble NovaCoreAI API Gateway');
  });

  it('should indicate microservices architecture', async () => {
    const response = await request(app).get('/api/status');
    expect(response.body.architecture).toBe('microservices');
  });

  it('should show current phase', async () => {
    const response = await request(app).get('/api/status');
    expect(response.body.phase).toBe(3);
  });

  it('should list all services with status', async () => {
    const response = await request(app).get('/api/status');
    expect(response.body.services).toBeDefined();
    expect(response.body.services.gateway).toBe('online');
    expect(response.body.services.auth).toBe('online');
    expect(response.body.services.intelligence).toBe('stub');
    expect(response.body.services.memory).toBe('stub');
    expect(response.body.services.ngs).toBe('stub');
    expect(response.body.services.policy).toBe('not-started');
  });

  it('should handle GET requests only', async () => {
    const postResponse = await request(app).post('/api/status');
    expect(postResponse.status).toBe(404);
  });
});

describe('Metrics Endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();

    // Metrics endpoint
    app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (err: any) {
        res.status(500).send(err.message || 'Error retrieving metrics');
      }
    });
  });

  it('should return 200 status', async () => {
    const response = await request(app).get('/metrics');
    expect(response.status).toBe(200);
  });

  it('should return Prometheus content type', async () => {
    const response = await request(app).get('/metrics');
    expect(response.headers['content-type']).toContain('text/plain');
  });

  it('should return metrics data', async () => {
    const response = await request(app).get('/metrics');
    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
  });

  it('should include metric header', async () => {
    const response = await request(app).get('/metrics');
    expect(response.text).toContain('# HELP');
    expect(response.text).toContain('# TYPE');
  });

  it('should handle metrics retrieval errors', async () => {
    const mockError = new Error('Metrics error');
    (register.metrics as jest.Mock).mockRejectedValueOnce(mockError);

    const response = await request(app).get('/metrics');
    expect(response.status).toBe(500);
    expect(response.text).toContain('Metrics error');
  });

  it('should call register.metrics', async () => {
    (register.metrics as jest.Mock).mockResolvedValueOnce('# HELP test\ntest 1\n');
    const response = await request(app).get('/metrics');
    expect(register.metrics).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});

describe('Request Size Limits', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    // Apply size limits
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ limit: '10mb', extended: true }));

    app.post('/api/test', (req, res) => {
      res.json({ received: true, size: JSON.stringify(req.body).length });
    });
  });

  it('should accept requests within size limit', async () => {
    const smallPayload = { data: 'a'.repeat(1000) }; // 1KB
    const response = await request(app)
      .post('/api/test')
      .send(smallPayload);
    
    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });

  it('should accept requests near size limit', async () => {
    const largePayload = { data: 'a'.repeat(5 * 1024 * 1024) }; // ~5MB
    const response = await request(app)
      .post('/api/test')
      .send(largePayload);
    
    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });

  it('should reject requests exceeding size limit', async () => {
    const tooLargePayload = { data: 'a'.repeat(11 * 1024 * 1024) }; // 11MB
    const response = await request(app)
      .post('/api/test')
      .send(tooLargePayload);
    
    expect(response.status).toBe(413);
  });

  it('should handle empty body', async () => {
    const response = await request(app)
      .post('/api/test')
      .send({});
    
    expect(response.status).toBe(200);
  });

  it('should handle nested JSON objects', async () => {
    const nestedPayload = {
      level1: {
        level2: {
          level3: {
            data: 'test'.repeat(1000)
          }
        }
      }
    };
    
    const response = await request(app)
      .post('/api/test')
      .send(nestedPayload);
    
    expect(response.status).toBe(200);
  });
});

describe('404 Handler', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
      });
    });
  });

  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/unknown/route');
    expect(response.status).toBe(404);
  });

  it('should return JSON error message', async () => {
    const response = await request(app).get('/unknown/route');
    expect(response.body.error).toBe('Not found');
  });

  it('should include requested path', async () => {
    const response = await request(app).get('/unknown/route');
    expect(response.body.path).toBe('/unknown/route');
  });

  it('should handle 404 for POST requests', async () => {
    const response = await request(app).post('/unknown/route');
    expect(response.status).toBe(404);
  });

  it('should handle 404 for PUT requests', async () => {
    const response = await request(app).put('/unknown/route');
    expect(response.status).toBe(404);
  });

  it('should handle 404 for DELETE requests', async () => {
    const response = await request(app).delete('/unknown/route');
    expect(response.status).toBe(404);
  });
});

describe('Error Handling Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Route that throws error
    app.get('/error', (req, res, next) => {
      next(new Error('Test error'));
    });

    // Error handling middleware
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      });
    });
  });

  it('should catch and handle errors', async () => {
    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
  });

  it('should return JSON error response', async () => {
    const response = await request(app).get('/error');
    expect(response.body.error).toBe('Internal server error');
  });

  it('should include error message in development mode', async () => {
    process.env.NODE_ENV = 'development';
    const response = await request(app).get('/error');
    expect(response.body.message).toBe('Test error');
  });

  it('should hide error details in production mode', async () => {
    process.env.NODE_ENV = 'production';
    const response = await request(app).get('/error');
    expect(response.body.message).toBe('Something went wrong');
  });
});
