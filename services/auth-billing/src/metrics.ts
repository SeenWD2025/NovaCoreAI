/**
 * Prometheus metrics for Auth-Billing Service
 */
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register });

// Authentication metrics
export const authLoginTotal = new Counter({
  name: 'auth_login_total',
  help: 'Total number of login attempts',
  labelNames: ['result'], // 'success' or 'failure'
  registers: [register]
});

export const authRegistrationTotal = new Counter({
  name: 'auth_registration_total',
  help: 'Total number of user registrations',
  labelNames: ['status'], // 'success' or 'failure'
  registers: [register]
});

export const authTokenValidationTotal = new Counter({
  name: 'auth_token_validation_total',
  help: 'Total number of token validations',
  labelNames: ['result'], // 'valid' or 'invalid'
  registers: [register]
});

export const authPasswordResetTotal = new Counter({
  name: 'auth_password_reset_total',
  help: 'Total number of password reset requests',
  labelNames: ['status'], // 'requested', 'completed', 'failed'
  registers: [register]
});

// Billing metrics
export const subscriptionChangesTotal = new Counter({
  name: 'subscription_changes_total',
  help: 'Total number of subscription changes',
  labelNames: ['from_tier', 'to_tier'],
  registers: [register]
});

export const subscriptionActiveGauge = new Gauge({
  name: 'subscription_active',
  help: 'Number of active subscriptions by tier',
  labelNames: ['tier'], // 'free_trial', 'basic', 'pro'
  registers: [register]
});

export const stripeWebhookTotal = new Counter({
  name: 'stripe_webhook_total',
  help: 'Total number of Stripe webhooks received',
  labelNames: ['event_type', 'status'], // status: 'success' or 'error'
  registers: [register]
});

export const paymentTotal = new Counter({
  name: 'payment_total',
  help: 'Total number of payment transactions',
  labelNames: ['status', 'tier'], // status: 'success', 'failed', 'pending'
  registers: [register]
});

export const paymentAmountTotal = new Counter({
  name: 'payment_amount_total',
  help: 'Total payment amount in cents',
  labelNames: ['tier', 'currency'],
  registers: [register]
});

// Usage metrics
export const usageTokensTotal = new Counter({
  name: 'usage_tokens_total',
  help: 'Total tokens consumed',
  labelNames: ['user_tier'],
  registers: [register]
});

export const usageStorageBytes = new Gauge({
  name: 'usage_storage_bytes',
  help: 'Total storage used in bytes',
  labelNames: ['user_tier'],
  registers: [register]
});

export const usageQuotaExceeded = new Counter({
  name: 'usage_quota_exceeded_total',
  help: 'Total number of quota exceeded events',
  labelNames: ['resource_type', 'user_tier'], // resource_type: 'tokens', 'storage', 'api_calls'
  registers: [register]
});

// Email metrics
export const emailSentTotal = new Counter({
  name: 'email_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['type', 'status'], // type: 'verification', 'password_reset', etc.
  registers: [register]
});

// Session metrics
export const activeSessionsGauge = new Gauge({
  name: 'active_sessions',
  help: 'Number of active user sessions',
  registers: [register]
});

export const sessionDurationHistogram = new Histogram({
  name: 'session_duration_seconds',
  help: 'User session duration in seconds',
  buckets: [60, 300, 600, 1800, 3600, 7200, 14400], // 1min to 4hrs
  registers: [register]
});
