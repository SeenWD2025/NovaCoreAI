# Webhook Security Specification

**Document Version:** 1.0  
**Date:** November 9, 2025  
**Prepared By:** Cloud and Cybersecurity Specialist  
**Status:** Active Security Specification

---

## Executive Summary

This document specifies security requirements and best practices for webhook implementations in NovaCoreAI, with primary focus on Stripe payment webhooks. Properly secured webhooks prevent financial fraud, data tampering, and unauthorized system modifications.

### Security Context

**Current Vulnerability:** Webhook handler exists but doesn't verify Stripe signatures, allowing potential fraudulent subscription updates.

**CVSS Score:** 7.0 (HIGH)  
**Risk:** Financial fraud, unauthorized tier changes, data manipulation

---

## 1. Webhook Security Fundamentals

### 1.1 Threat Model

**Threats Addressed:**
1. **Payload Tampering:** Attacker modifies webhook payload to change subscription tiers or amounts
2. **Replay Attacks:** Attacker replays old webhook events to trigger duplicate processing
3. **Impersonation:** Attacker sends fake webhooks pretending to be Stripe
4. **Man-in-the-Middle:** Attacker intercepts and modifies webhooks in transit
5. **Denial of Service:** Attacker floods webhook endpoint with invalid requests

**Attack Scenarios:**
- Attacker upgrades their account to premium tier without payment
- Attacker downgrades competitor accounts
- Attacker triggers refunds or cancellations
- Attacker gains free access by manipulating trial periods

### 1.2 Defense Strategy

**Security Layers:**
1. **Signature Verification:** Cryptographic proof webhook is from Stripe
2. **HTTPS/TLS:** Encrypted transport prevents eavesdropping
3. **Idempotency:** Duplicate events handled gracefully
4. **Rate Limiting:** Protection against DoS attacks
5. **Audit Logging:** Complete trail of all webhook events
6. **Timestamp Validation:** Reject old/replayed events

---

## 2. Stripe Webhook Signature Verification

### 2.1 How Stripe Signatures Work

Stripe uses HMAC-SHA256 to sign webhook payloads:

```
Signature = HMAC-SHA256(
  key: STRIPE_WEBHOOK_SECRET,
  message: timestamp + "." + raw_payload
)
```

**Signature Header Format:**
```
stripe-signature: t=1492774577,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

Components:
- `t` = Unix timestamp when Stripe sent the event
- `v1` = HMAC-SHA256 signature
- Multiple signatures may be present (v1, v2, etc.) during key rotation

### 2.2 Verification Process

**Step-by-Step Verification:**

1. **Extract Signature Header:**
   ```typescript
   const signature = req.headers['stripe-signature'];
   if (!signature) {
     throw new Error('Missing stripe-signature header');
   }
   ```

2. **Parse Signature Components:**
   ```typescript
   const parts = signature.split(',');
   let timestamp: string | undefined;
   let signatures: string[] = [];
   
   for (const part of parts) {
     const [key, value] = part.split('=');
     if (key === 't') timestamp = value;
     if (key.startsWith('v')) signatures.push(value);
   }
   ```

3. **Construct Signed Payload:**
   ```typescript
   const signedPayload = `${timestamp}.${rawBody}`;
   ```

4. **Compute Expected Signature:**
   ```typescript
   import * as crypto from 'crypto';
   
   const expectedSignature = crypto
     .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
     .update(signedPayload)
     .digest('hex');
   ```

5. **Compare Signatures (Constant-Time):**
   ```typescript
   const isValid = signatures.some(sig => 
     crypto.timingSafeEqual(
       Buffer.from(sig),
       Buffer.from(expectedSignature)
     )
   );
   ```

6. **Validate Timestamp:**
   ```typescript
   const timestampAge = Date.now() / 1000 - parseInt(timestamp);
   if (timestampAge > 300) { // 5 minutes
     throw new Error('Webhook timestamp too old');
   }
   ```

### 2.3 Implementation Reference

**Complete Verification Function:**

```typescript
import * as crypto from 'crypto';
import { Injectable, BadRequestException } from '@nestjs/common';
import * as Stripe from 'stripe';

@Injectable()
export class StripeWebhookService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!this.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }
  }

  /**
   * Verify and parse Stripe webhook event
   * @param rawBody - Raw request body (Buffer)
   * @param signature - stripe-signature header value
   * @returns Verified Stripe event object
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string): Stripe.Event {
    try {
      // Stripe SDK handles all verification steps
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret
      );
      
      return event;
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }
  }

  /**
   * Manual signature verification (alternative implementation)
   * Use if Stripe SDK not available
   */
  verifySignatureManually(rawBody: string, signature: string): boolean {
    // Parse signature header
    const parts = signature.split(',');
    let timestamp: string | undefined;
    const signatures: string[] = [];
    
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't') timestamp = value;
      if (key.startsWith('v')) signatures.push(value);
    }
    
    if (!timestamp || signatures.length === 0) {
      throw new BadRequestException('Invalid signature format');
    }
    
    // Check timestamp freshness (5 minute tolerance)
    const timestampAge = Date.now() / 1000 - parseInt(timestamp);
    if (timestampAge > 300) {
      throw new BadRequestException('Webhook timestamp too old');
    }
    
    // Compute expected signature
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    
    // Constant-time comparison
    const isValid = signatures.some(sig => {
      try {
        return crypto.timingSafeEqual(
          Buffer.from(sig, 'hex'),
          Buffer.from(expectedSignature, 'hex')
        );
      } catch {
        return false;
      }
    });
    
    if (!isValid) {
      throw new BadRequestException('Signature verification failed');
    }
    
    return true;
  }
}
```

### 2.4 Raw Body Requirement

**Critical:** Signature verification requires the **raw, unparsed request body**.

**Why:** JSON parsing can change whitespace, field order, or encoding, invalidating the signature.

**Implementation:**

```typescript
// In main.ts or app configuration
import * as express from 'express';

app.use(
  '/billing/webhook',
  express.raw({ type: 'application/json' })
);

// All other routes can use JSON parser
app.use(express.json());
```

**Controller Implementation:**

```typescript
@Post('webhook')
async handleWebhook(
  @Req() req: Request,
  @Headers('stripe-signature') signature: string
) {
  const rawBody = req.body; // Buffer when using express.raw()
  
  // Verify signature
  const event = this.stripeWebhookService.verifyWebhookSignature(
    rawBody,
    signature
  );
  
  // Process verified event
  await this.processWebhookEvent(event);
  
  return { received: true };
}
```

---

## 3. Replay Attack Prevention

### 3.1 Timestamp Validation

**Maximum Age:** 5 minutes (300 seconds)

**Rationale:**
- Protects against replay attacks
- Accounts for clock skew between servers
- Balances security with reliability

**Implementation:**
```typescript
const MAX_TIMESTAMP_AGE = 300; // 5 minutes

function validateTimestamp(timestamp: number): void {
  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;
  
  if (age > MAX_TIMESTAMP_AGE) {
    throw new BadRequestException(
      `Webhook timestamp too old: ${age} seconds (max ${MAX_TIMESTAMP_AGE})`
    );
  }
  
  if (age < -60) { // Allow 1 minute future for clock skew
    throw new BadRequestException(
      'Webhook timestamp is in the future'
    );
  }
}
```

### 3.2 Event Idempotency

**Strategy:** Track processed event IDs to prevent duplicate processing

**Implementation:**

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class WebhookIdempotencyService {
  private readonly TTL = 7 * 24 * 60 * 60; // 7 days
  
  constructor(private readonly redis: RedisService) {}
  
  /**
   * Check if event has been processed
   * @returns true if event is new, false if already processed
   */
  async isNewEvent(eventId: string): Promise<boolean> {
    const key = `webhook:processed:${eventId}`;
    const exists = await this.redis.exists(key);
    
    if (exists) {
      console.log(`Duplicate webhook event detected: ${eventId}`);
      return false;
    }
    
    // Mark event as processed
    await this.redis.setex(key, this.TTL, Date.now().toString());
    return true;
  }
  
  /**
   * Mark event as successfully processed
   */
  async markProcessed(eventId: string, metadata?: any): Promise<void> {
    const key = `webhook:processed:${eventId}`;
    await this.redis.setex(
      key,
      this.TTL,
      JSON.stringify({ processedAt: Date.now(), ...metadata })
    );
  }
}
```

**Usage in Webhook Handler:**

```typescript
async processWebhookEvent(event: Stripe.Event): Promise<void> {
  // Check if event already processed
  const isNew = await this.idempotencyService.isNewEvent(event.id);
  if (!isNew) {
    console.log(`Skipping duplicate event: ${event.id}`);
    return; // Return success to prevent retries
  }
  
  try {
    // Process event
    await this.handleEventByType(event);
    
    // Mark as successfully processed
    await this.idempotencyService.markProcessed(event.id, {
      type: event.type,
      success: true
    });
  } catch (error) {
    console.error(`Failed to process webhook event ${event.id}:`, error);
    // Don't mark as processed so Stripe will retry
    throw error;
  }
}
```

### 3.3 Database-Based Idempotency (Alternative)

For long-term tracking, use database instead of Redis:

```typescript
// Database schema
interface WebhookEvent {
  id: string; // Stripe event ID
  type: string;
  processedAt: Date;
  success: boolean;
  retryCount: number;
  metadata: any;
}

async isEventProcessed(eventId: string): Promise<boolean> {
  const existingEvent = await db.webhookEvents.findOne({
    where: { id: eventId }
  });
  
  return existingEvent !== null && existingEvent.success;
}

async recordWebhookEvent(event: Stripe.Event, success: boolean): Promise<void> {
  await db.webhookEvents.upsert({
    id: event.id,
    type: event.type,
    processedAt: new Date(),
    success: success,
    retryCount: event.request?.idempotency_key ? 1 : 0,
    metadata: { livemode: event.livemode }
  });
}
```

---

## 4. Event Handler Security

### 4.1 Supported Event Types

**Subscription Events:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`

**Payment Events:**
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

**Customer Events:**
- `customer.created`
- `customer.updated`
- `customer.deleted`

### 4.2 Event Handler Implementation

```typescript
@Injectable()
export class WebhookEventHandler {
  async handleEvent(event: Stripe.Event): Promise<void> {
    console.log(`Processing webhook event: ${event.type} (${event.id})`);
    
    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
        // Don't throw error for unknown events
    }
  }
  
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    // Security: Validate subscription belongs to an existing customer
    const customer = await this.findCustomerByStripeId(subscription.customer as string);
    if (!customer) {
      throw new Error(`Customer not found: ${subscription.customer}`);
    }
    
    // Update user tier
    const tier = this.mapStripePriceToTier(subscription.items.data[0].price.id);
    await this.updateUserTier(customer.userId, tier);
    
    // Log subscription creation
    await this.auditLog.log({
      action: 'subscription_created',
      userId: customer.userId,
      subscriptionId: subscription.id,
      tier: tier,
      amount: subscription.items.data[0].price.unit_amount,
    });
  }
  
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    // Security: Verify subscription belongs to customer
    const customer = await this.findCustomerByStripeId(subscription.customer as string);
    if (!customer) {
      console.warn(`Customer not found for cancelled subscription: ${subscription.customer}`);
      return;
    }
    
    // Downgrade to free tier
    await this.updateUserTier(customer.userId, 'free_trial');
    
    // Log subscription cancellation
    await this.auditLog.log({
      action: 'subscription_cancelled',
      userId: customer.userId,
      subscriptionId: subscription.id,
      reason: subscription.cancellation_details?.reason,
    });
  }
}
```

### 4.3 Security Validations

**Before Processing Events:**

1. **Verify Customer Exists:**
   ```typescript
   const customer = await db.customers.findOne({
     where: { stripeCustomerId: subscription.customer }
   });
   if (!customer) {
     throw new Error('Customer not found');
   }
   ```

2. **Verify Subscription State:**
   ```typescript
   // Don't process cancelled subscriptions
   if (subscription.status === 'canceled') {
     console.log('Skipping cancelled subscription');
     return;
   }
   ```

3. **Verify Price ID Mapping:**
   ```typescript
   const tier = this.priceToTierMap[subscription.items.data[0].price.id];
   if (!tier) {
     throw new Error(`Unknown price ID: ${subscription.items.data[0].price.id}`);
   }
   ```

4. **Verify Amount Matches Expected:**
   ```typescript
   const expectedAmount = this.tierPricing[tier];
   if (subscription.items.data[0].price.unit_amount !== expectedAmount) {
     console.warn(`Price mismatch: expected ${expectedAmount}, got ${subscription.items.data[0].price.unit_amount}`);
     // Still process but alert monitoring
     await this.alerting.sendAlert('price_mismatch', { subscription });
   }
   ```

---

## 5. Secret Management

### 5.1 Webhook Secret Storage

**DO:**
- ✅ Store in environment variables
- ✅ Use secrets manager (AWS Secrets Manager, HashiCorp Vault, DigitalOcean Secrets)
- ✅ Rotate secrets periodically (every 90 days)
- ✅ Use different secrets for production/staging/development

**DON'T:**
- ❌ Commit secrets to version control
- ❌ Store in database
- ❌ Log secrets in application logs
- ❌ Include in error messages
- ❌ Share secrets via email/Slack

### 5.2 Secret Retrieval

**Environment Variable:**
```typescript
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (!STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET not configured');
}
```

**Secrets Manager (AWS):**
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getWebhookSecret(): Promise<string> {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: 'stripe/webhook-secret' })
  );
  return response.SecretString;
}
```

### 5.3 Secret Rotation

**Rotation Process:**

1. **Generate New Secret in Stripe:**
   - Go to Stripe Dashboard → Webhooks → Click on endpoint
   - Click "Roll secret"
   - Copy new secret

2. **Update Secrets Manager:**
   ```bash
   # Update in production secrets manager
   aws secretsmanager update-secret \
     --secret-id stripe/webhook-secret \
     --secret-string "whsec_new_secret_here"
   ```

3. **Deploy with Blue-Green:**
   - Deploy new version with updated secret
   - Keep old version running during transition
   - Verify new version receiving webhooks successfully
   - Decommission old version

4. **Verify Rotation:**
   - Test webhook delivery with Stripe CLI
   - Monitor error rates
   - Check audit logs for failed verifications

**Rotation Schedule:**
- **Scheduled:** Every 90 days
- **Emergency:** Immediately upon suspected compromise

---

## 6. Monitoring and Alerting

### 6.1 Metrics to Track

**Webhook Receipt:**
- `webhook_received_total` (counter by event type)
- `webhook_verification_failures_total` (counter by reason)
- `webhook_processing_duration_seconds` (histogram)
- `webhook_processing_errors_total` (counter by event type)

**Idempotency:**
- `webhook_duplicate_events_total` (counter)
- `webhook_processed_events_total` (counter by event type)

**Business Metrics:**
- `subscriptions_created_total` (counter)
- `subscriptions_cancelled_total` (counter)
- `payments_succeeded_total` (counter)
- `payments_failed_total` (counter)

### 6.2 Alert Conditions

**Critical Alerts:**
- Webhook verification failure rate >5% for 5 minutes
- No webhooks received for >1 hour (may indicate Stripe issue)
- STRIPE_WEBHOOK_SECRET not configured
- >10 duplicate events in 10 minutes (potential replay attack)

**Warning Alerts:**
- Webhook processing taking >5 seconds (performance issue)
- Payment failure rate >20%
- Unusual spike in subscription cancellations

### 6.3 Audit Logging

**Log All Webhook Events:**

```typescript
interface WebhookAuditLog {
  timestamp: Date;
  eventId: string;
  eventType: string;
  signatureValid: boolean;
  processed: boolean;
  error?: string;
  customerId?: string;
  subscriptionId?: string;
  processingDuration: number;
}

async function logWebhookEvent(log: WebhookAuditLog): Promise<void> {
  await db.webhookAuditLogs.create(log);
  
  // Also log to monitoring system
  console.log(JSON.stringify({
    level: 'INFO',
    event: 'webhook_processed',
    ...log
  }));
}
```

**Retention Policy:**
- Keep webhook audit logs for 90 days
- Archive to cold storage for 1 year
- Delete after 1 year (or per compliance requirements)

---

## 7. Rate Limiting and DoS Protection

### 7.1 Rate Limiting Strategy

**Limits:**
- 100 requests per minute per IP
- 1000 requests per hour per endpoint
- Stricter limits during suspected attack

**Implementation:**

```typescript
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('billing')
@UseGuards(ThrottlerGuard)
export class BillingController {
  @Post('webhook')
  @Throttle(100, 60) // 100 requests per 60 seconds
  async handleWebhook(/* ... */) {
    // Handler implementation
  }
}
```

### 7.2 Invalid Signature Throttling

**Strategy:** Aggressively rate-limit IPs sending invalid signatures

```typescript
async function handleInvalidSignature(req: Request): Promise<void> {
  const ip = req.ip;
  const key = `webhook:invalid_sig:${ip}`;
  
  // Increment counter
  const count = await redis.incr(key);
  await redis.expire(key, 300); // 5 minutes
  
  // Block after 5 invalid signatures
  if (count > 5) {
    // Add to temporary blocklist
    await redis.setex(`webhook:blocked:${ip}`, 3600, '1'); // 1 hour
    
    // Alert security team
    await alerting.sendAlert('webhook_attack', {
      ip,
      invalidSignatures: count,
      timestamp: new Date()
    });
  }
}
```

### 7.3 IP Allowlisting (Optional)

For enhanced security, allowlist Stripe's webhook IPs:

```typescript
const STRIPE_WEBHOOK_IPS = [
  '3.18.12.63',
  '3.130.192.231',
  '13.235.14.237',
  // ... complete list from Stripe documentation
];

function isStripeIP(ip: string): boolean {
  return STRIPE_WEBHOOK_IPS.includes(ip);
}

async function validateWebhookSource(req: Request): Promise<void> {
  if (!isStripeIP(req.ip)) {
    throw new ForbiddenException('Webhook source not recognized');
  }
}
```

**Note:** IP allowlisting is optional and should be combined with signature verification, not replace it.

---

## 8. Testing Webhook Security

### 8.1 Local Testing with Stripe CLI

**Installation:**
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/vX.X.X/stripe_X.X.X_linux_x86_64.tar.gz
tar -xvf stripe_X.X.X_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

**Forward Webhooks to Localhost:**
```bash
stripe listen --forward-to localhost:3001/billing/webhook
```

**Trigger Test Events:**
```bash
# Subscription created
stripe trigger customer.subscription.created

# Payment succeeded
stripe trigger invoice.payment_succeeded

# Custom event
stripe trigger customer.subscription.updated
```

### 8.2 Unit Tests

```typescript
describe('Webhook Signature Verification', () => {
  it('should accept webhook with valid signature', () => {
    const payload = { type: 'customer.subscription.created', data: {} };
    const signature = generateTestSignature(payload);
    
    expect(() => {
      service.verifyWebhookSignature(payload, signature);
    }).not.toThrow();
  });

  it('should reject webhook with invalid signature', () => {
    const payload = { type: 'customer.subscription.created', data: {} };
    const invalidSignature = 't=123,v1=invalid';
    
    expect(() => {
      service.verifyWebhookSignature(payload, invalidSignature);
    }).toThrow('Signature verification failed');
  });

  it('should reject webhook with expired timestamp', () => {
    const payload = { type: 'customer.subscription.created', data: {} };
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const signature = generateTestSignature(payload, oldTimestamp);
    
    expect(() => {
      service.verifyWebhookSignature(payload, signature);
    }).toThrow('timestamp too old');
  });
});
```

### 8.3 Integration Tests

```typescript
describe('Webhook Integration', () => {
  it('should process subscription created event', async () => {
    const event = {
      id: 'evt_test_123',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          items: { data: [{ price: { id: 'price_pro', unit_amount: 2900 } }] }
        }
      }
    };
    
    await service.handleEvent(event);
    
    const user = await db.users.findOne({ where: { stripeCustomerId: 'cus_123' } });
    expect(user.tier).toBe('pro');
  });
});
```

---

## 9. Incident Response

### 9.1 Webhook Security Incident

**If suspicious webhook activity detected:**

1. **Immediate Actions (0-15 minutes):**
   - Block suspicious IPs temporarily
   - Increase monitoring and logging verbosity
   - Verify STRIPE_WEBHOOK_SECRET is correct
   - Check Stripe Dashboard for any configuration changes

2. **Investigation (15-60 minutes):**
   - Review audit logs for unauthorized changes
   - Check database for fraudulent subscription modifications
   - Identify attack vector
   - Assess scope of compromise

3. **Remediation (1-4 hours):**
   - Rotate STRIPE_WEBHOOK_SECRET immediately
   - Revert unauthorized subscription changes
   - Implement additional rate limiting if needed
   - Update IP allowlist if applicable

4. **Post-Incident (1-7 days):**
   - Conduct root cause analysis
   - Update security procedures
   - Implement additional monitoring
   - Train team on incident response

### 9.2 Payment Discrepancy

**If webhook data doesn't match Stripe Dashboard:**

1. **Verify:**
   - Check Stripe Dashboard for actual subscription/payment status
   - Compare webhook event data with API retrieval
   - Check for manual changes in Stripe Dashboard

2. **Reconcile:**
   - Update database to match Stripe's authoritative data
   - Log discrepancy for investigation
   - Alert finance team if revenue impact

3. **Prevent:**
   - Implement periodic reconciliation job
   - Compare database state with Stripe API daily
   - Alert on discrepancies

---

## 10. Compliance and Best Practices

### 10.1 PCI DSS Compliance

**Requirements for Webhooks:**
- ✅ Use TLS 1.2 or higher for all webhook traffic
- ✅ Verify signatures to ensure data integrity
- ✅ Log all webhook activity for audit trail
- ✅ Restrict webhook endpoint access
- ✅ Implement strong authentication (signature verification)
- ✅ Monitor for suspicious activity

**What NOT to Store:**
- ❌ Full credit card numbers
- ❌ CVV/CVC codes
- ❌ PIN numbers
- ❌ Magnetic stripe data

### 10.2 GDPR Compliance

**Data Processing:**
- Webhook events may contain personal data (email, name)
- Process data only for legitimate business purposes
- Implement data retention policies
- Provide data deletion upon user request

**Audit Requirements:**
- Maintain logs of all subscription changes
- Log access to customer payment information
- Retain logs for required period (varies by jurisdiction)

### 10.3 Industry Best Practices

**Webhook Design:**
1. ✅ Always verify signatures
2. ✅ Implement idempotency
3. ✅ Return 200 OK quickly (under 5 seconds)
4. ✅ Process webhooks asynchronously if needed
5. ✅ Implement retry logic for transient failures
6. ✅ Log all webhook events
7. ✅ Monitor webhook health
8. ✅ Test webhook handling regularly

**Anti-Patterns to Avoid:**
1. ❌ Trusting webhook data without verification
2. ❌ Performing long-running operations synchronously
3. ❌ Not handling duplicate events
4. ❌ Exposing detailed error messages
5. ❌ Not monitoring webhook failures
6. ❌ Hardcoding webhook secrets
7. ❌ Not having rollback procedures

---

## 11. Checklist for Production Deployment

### 11.1 Pre-Deployment

- [ ] STRIPE_WEBHOOK_SECRET configured in all environments
- [ ] Webhook endpoint uses HTTPS with valid SSL certificate
- [ ] Signature verification implemented and tested
- [ ] Idempotency mechanism in place
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Monitoring and alerts set up
- [ ] Error handling implemented
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Load testing completed
- [ ] Security review completed
- [ ] Documentation updated

### 11.2 Deployment

- [ ] Webhook endpoint URL registered in Stripe Dashboard
- [ ] Webhook secret copied from Stripe to environment
- [ ] Test webhook sent successfully
- [ ] Monitoring shows webhooks being received
- [ ] No errors in logs
- [ ] Subscription creation tested end-to-end
- [ ] Payment success event tested
- [ ] Cancellation event tested

### 11.3 Post-Deployment

- [ ] Monitor webhook receipt rates
- [ ] Verify no signature verification failures
- [ ] Check idempotency is working (no duplicate processing)
- [ ] Confirm subscription updates reflected in database
- [ ] Review audit logs for anomalies
- [ ] Verify alerts are working
- [ ] Document any issues and resolutions

---

## 12. References

### 12.1 Stripe Documentation

- [Stripe Webhook Documentation](https://stripe.com/docs/webhooks)
- [Webhook Signature Verification](https://stripe.com/docs/webhooks/signatures)
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

### 12.2 Security Standards

- [OWASP Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html)
- [PCI DSS Requirements](https://www.pcisecuritystandards.org/)
- [NIST Cryptographic Standards](https://csrc.nist.gov/publications/fips)

### 12.3 Related Documentation

- [SERVICE_AUTHENTICATION.md](./SERVICE_AUTHENTICATION.md) - Service-to-service auth
- [INPUT_VALIDATION.md](./INPUT_VALIDATION.md) - Input validation standards
- [SECURITY_HEADERS.md](./SECURITY_HEADERS.md) - HTTP security headers

---

**Document Status:** ACTIVE - Ready for Implementation  
**Last Updated:** November 9, 2025  
**Next Review:** December 9, 2025

**For Questions:** Contact Cloud and Cybersecurity Specialist

---

**END OF WEBHOOK SECURITY SPECIFICATION**
