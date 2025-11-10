/**
 * Prometheus metrics for Gateway Service
 */
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register });

// Gateway request metrics
export const gatewayRequestsTotal = new Counter({
  name: 'gateway_requests_total',
  help: 'Total number of gateway requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Gateway latency metrics
export const gatewayLatencySeconds = new Histogram({
  name: 'gateway_latency_seconds',
  help: 'Gateway request latency in seconds',
  labelNames: ['route', 'method'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// Rate limit metrics
export const rateLimitExceededTotal = new Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total number of rate limit violations',
  labelNames: ['route'],
  registers: [register]
});

// WebSocket connection metrics
export const websocketConnectionsActive = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register]
});

export const websocketConnectionsTotal = new Counter({
  name: 'websocket_connections_total',
  help: 'Total number of WebSocket connection attempts',
  labelNames: ['status'], // 'success' or 'rejected'
  registers: [register]
});

export const websocketMessagesTotal = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['direction'], // 'inbound' or 'outbound'
  registers: [register]
});

// Proxy metrics
export const proxyRequestsTotal = new Counter({
  name: 'proxy_requests_total',
  help: 'Total number of proxied requests',
  labelNames: ['service', 'status'], // service: 'auth', 'intelligence', etc.
  registers: [register]
});

export const proxyErrorsTotal = new Counter({
  name: 'proxy_errors_total',
  help: 'Total number of proxy errors',
  labelNames: ['service'],
  registers: [register]
});

// Authentication metrics
export const authValidationTotal = new Counter({
  name: 'auth_validation_total',
  help: 'Total number of JWT validations',
  labelNames: ['result'], // 'success' or 'failure'
  registers: [register]
});
