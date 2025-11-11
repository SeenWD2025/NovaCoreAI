/**
 * Tests for metrics middleware
 */
import express from 'express';
import request from 'supertest';

// Mock metrics
jest.mock('../metrics', () => ({
  gatewayRequestsTotal: {
    labels: jest.fn().mockReturnValue({
      inc: jest.fn(),
    }),
  },
  gatewayLatencySeconds: {
    labels: jest.fn().mockReturnValue({
      observe: jest.fn(),
    }),
  },
}));

import { metricsMiddleware } from '../middleware/metrics-middleware';

describe('Metrics Middleware Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(metricsMiddleware);
    
    app.get('/test', (req, res) => {
      res.json({ success: true });
    });
    
    app.post('/api/data', (req, res) => {
      res.status(201).json({ created: true });
    });
  });

  it('should not interfere with request processing', async () => {
    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should handle GET requests', async () => {
    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
  });

  it('should handle POST requests', async () => {
    const response = await request(app).post('/api/data');
    expect(response.status).toBe(201);
  });

  it('should handle 404 responses', async () => {
    const response = await request(app).get('/notfound');
    expect(response.status).toBe(404);
  });

  it('should handle multiple concurrent requests', async () => {
    const requests = Array(5).fill(null).map(() => request(app).get('/test'));
    const responses = await Promise.all(requests);
    
    responses.forEach((response) => {
      expect(response.status).toBe(200);
    });
  });
});

describe('Metrics Middleware Basic Functionality', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(metricsMiddleware);
    
    app.get('/status', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });
    
    app.get('/error', (req, res) => {
      res.status(500).json({ error: 'Internal error' });
    });
  });

  it('should work with 2xx responses', async () => {
    const response = await request(app).get('/status');
    expect(response.status).toBe(200);
  });

  it('should work with 5xx responses', async () => {
    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
  });

  it('should not block responses', async () => {
    const start = Date.now();
    await request(app).get('/status');
    const duration = Date.now() - start;
    
    // Should respond quickly (metrics shouldn't add significant delay)
    expect(duration).toBeLessThan(1000);
  });
});
