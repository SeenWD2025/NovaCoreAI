# Noble NovaCoreAI - Technical Action Plan
## Prioritized Implementation Roadmap

**Document Version:** 1.0  
**Date:** November 9, 2025  
**Prepared By:** DevOps Architect - Noble Growth Collective  
**Status:** Active Development Roadmap

---

## 🎯 Overview

This document provides a detailed, actionable plan for completing the remaining 15% of NovaCoreAI development and achieving production readiness within 60 days. Each action item includes effort estimates, priority levels, dependencies, and acceptance criteria.

---

## 📊 Priority Matrix

### P0 - Critical Blockers (Must Complete Before Production)
- Service-to-service authentication
- Usage ledger integration
- Stripe webhook verification
- Basic security hardening

### P1 - High Priority (Required for MVP Quality)
- Automated testing infrastructure
- Observability integration
- Load testing and optimization
- Documentation completion

### P2 - Medium Priority (Enhanced MVP)
- Email verification
- Password reset flow
- Advanced monitoring
- Performance optimizations

### P3 - Low Priority (Post-MVP)
- Additional features
- UI enhancements
- Analytics dashboard
- Multi-language support

---

## 🚨 P0 Critical Blockers

### 1. Service-to-Service Authentication

**Priority:** P0 - CRITICAL  
**Effort:** 2-3 days  
**Assignee:** Backend Engineer  
**Deadline:** Week 1

**Current Issue:**
Services trust network-level isolation without cryptographic verification. Any compromised service can impersonate users by setting X-User-Id headers.

**Implementation Plan:**

#### Step 1: Generate Service Tokens (4 hours)

**File:** `services/auth-billing/src/auth/service-auth.service.ts`

```typescript
export class ServiceAuthService {
  private readonly serviceSecret = process.env.SERVICE_JWT_SECRET;
  
  generateServiceToken(serviceName: string): string {
    return jwt.sign(
      { 
        type: 'service',
        service: serviceName,
        permissions: this.getServicePermissions(serviceName)
      },
      this.serviceSecret,
      { expiresIn: '24h' }
    );
  }
  
  verifyServiceToken(token: string): ServicePayload {
    return jwt.verify(token, this.serviceSecret);
  }
}
```

#### Step 2: Gateway Middleware (4 hours)

**File:** `services/gateway/src/middleware/service-auth.ts`

```typescript
export const serviceAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const serviceToken = req.headers['x-service-token'];
  
  if (!serviceToken) {
    return res.status(403).json({ error: 'Service token required' });
  }
  
  try {
    const payload = verifyServiceToken(serviceToken);
    req.serviceContext = payload;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid service token' });
  }
};
```

#### Step 3: Python Service Verification (6 hours)

**File:** `shared/python/service_auth.py`

```python
import jwt
import httpx
from functools import wraps
from fastapi import HTTPException, Header

SERVICE_JWT_SECRET = os.getenv("SERVICE_JWT_SECRET")

def verify_service_token(x_service_token: str = Header(...)):
    """Verify service-to-service token."""
    try:
        payload = jwt.decode(
            x_service_token,
            SERVICE_JWT_SECRET,
            algorithms=["HS256"]
        )
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="Invalid service token")

# Apply to all service endpoints
@router.post("/memory/store", dependencies=[Depends(verify_service_token)])
async def store_memory(...):
    pass
```

#### Step 4: Update All Service Calls (4 hours)

**Affected Files:**
- `services/intelligence/app/services/integration_service.py`
- `services/reflection-worker/app/tasks.py`
- `services/distillation-worker/app/distiller.py`

```python
# Add service token to all inter-service requests
headers = {
    "X-User-Id": user_id,
    "X-Service-Token": get_service_token()  # New
}

response = httpx.post(
    f"{MEMORY_SERVICE_URL}/memory/store",
    headers=headers,
    json=payload
)
```

**Acceptance Criteria:**
- [ ] All services validate X-Service-Token header
- [ ] Service tokens expire after 24 hours
- [ ] Unauthorized calls return 403
- [ ] Integration tests pass for cross-service calls
- [ ] Service token renewal logic implemented

**Testing:**
```bash
# Test unauthorized access
curl -X POST http://localhost:8001/memory/store \
  -H "X-User-Id: test-user" \
  # Missing X-Service-Token should return 403

# Test authorized access
curl -X POST http://localhost:8001/memory/store \
  -H "X-User-Id: test-user" \
  -H "X-Service-Token: <valid-token>" \
  # Should succeed
```

---

### 2. Usage Ledger Integration

**Priority:** P0 - CRITICAL  
**Effort:** 1 day  
**Assignee:** Backend Engineer  
**Deadline:** Week 1

**Current Issue:**
Token counting is implemented but not persisted to the `usage_ledger` table, making quota enforcement unreliable across service restarts.

**Implementation Plan:**

#### Step 1: Create Usage Service (3 hours)

**File:** `services/intelligence/app/services/usage_service.py`

```python
from sqlalchemy.orm import Session
from datetime import datetime, date
from app.database import get_db
import uuid

class UsageService:
    async def record_usage(
        self,
        db: Session,
        user_id: str,
        resource_type: str,
        amount: int,
        metadata: dict = None
    ) -> bool:
        """Record usage in the ledger."""
        try:
            query = """
                INSERT INTO usage_ledger (id, user_id, resource_type, amount, metadata, timestamp)
                VALUES (:id, :user_id, :resource_type, :amount, :metadata, :timestamp)
            """
            
            db.execute(query, {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "resource_type": resource_type,
                "amount": amount,
                "metadata": metadata or {},
                "timestamp": datetime.utcnow()
            })
            
            db.commit()
            return True
            
        except Exception as e:
            logger.error(f"Failed to record usage: {e}")
            db.rollback()
            return False
    
    async def get_today_usage(
        self,
        db: Session,
        user_id: str,
        resource_type: str
    ) -> int:
        """Get total usage for today."""
        query = """
            SELECT COALESCE(SUM(amount), 0) as total
            FROM usage_ledger
            WHERE user_id = :user_id
            AND resource_type = :resource_type
            AND DATE(timestamp) = CURRENT_DATE
        """
        
        result = db.execute(query, {
            "user_id": user_id,
            "resource_type": resource_type
        }).fetchone()
        
        return result['total'] if result else 0
    
    async def check_quota(
        self,
        db: Session,
        user_id: str,
        tier: str,
        resource_type: str,
        requested_amount: int
    ) -> tuple[bool, str]:
        """Check if user has quota available."""
        # Get tier limits
        limits = {
            "free_trial": {"tokens": 1000, "messages": 50},
            "basic": {"tokens": 50000, "messages": 1000},
            "pro": {"tokens": -1, "messages": -1}  # -1 = unlimited
        }
        
        limit = limits.get(tier, {}).get(resource_type, 0)
        
        if limit == -1:  # Unlimited
            return True, "Unlimited usage"
        
        current = await self.get_today_usage(db, user_id, resource_type)
        
        if current + requested_amount > limit:
            return False, f"Daily {resource_type} quota exceeded ({current}/{limit})"
        
        return True, f"Usage: {current + requested_amount}/{limit}"

usage_service = UsageService()
```

#### Step 2: Integrate into Chat Router (2 hours)

**File:** `services/intelligence/app/routers/chat.py`

```python
from app.services.usage_service import usage_service

@router.post("/chat/message")
async def send_message(
    request: ChatRequest,
    user_id: str = Depends(get_user_id),
    x_user_tier: str = Header("free_trial"),
    db: Session = Depends(get_db)
):
    # Check quota BEFORE processing
    has_quota, msg = await usage_service.check_quota(
        db, user_id, x_user_tier, "messages", 1
    )
    
    if not has_quota:
        raise HTTPException(status_code=429, detail=msg)
    
    # Process message...
    response = await ollama_service.generate(...)
    
    # Count tokens
    input_tokens = count_tokens(request.message)
    output_tokens = count_tokens(response.text)
    total_tokens = input_tokens + output_tokens
    
    # Record usage
    await usage_service.record_usage(
        db, user_id, "tokens", total_tokens,
        metadata={
            "session_id": request.session_id,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens
        }
    )
    
    await usage_service.record_usage(
        db, user_id, "messages", 1,
        metadata={"session_id": request.session_id}
    )
    
    return response
```

#### Step 3: Add Usage Endpoints (2 hours)

**File:** `services/auth-billing/src/usage/usage.controller.ts`

```typescript
@Get('quota')
async getQuotaStatus(@Req() req) {
  const userId = req.user.userId;
  const tier = req.user.subscription_tier;
  
  const [tokenUsage, messageUsage] = await Promise.all([
    this.usageService.getTodayUsage(userId, 'tokens'),
    this.usageService.getTodayUsage(userId, 'messages')
  ]);
  
  const limits = this.usageService.getTierLimits(tier);
  
  return {
    tier,
    tokens: {
      used: tokenUsage,
      limit: limits.tokens,
      remaining: limits.tokens === -1 ? -1 : limits.tokens - tokenUsage
    },
    messages: {
      used: messageUsage,
      limit: limits.messages,
      remaining: limits.messages === -1 ? -1 : limits.messages - messageUsage
    }
  };
}
```

**Acceptance Criteria:**
- [ ] Token usage persisted to usage_ledger after every chat
- [ ] Message count persisted to usage_ledger
- [ ] Quota checks enforce tier limits
- [ ] Usage resets daily at midnight UTC
- [ ] API endpoint returns current usage and remaining quota
- [ ] 429 errors returned when quota exceeded
- [ ] Integration tests verify quota enforcement

**Testing:**
```bash
# Test quota enforcement
for i in {1..60}; do
  curl -X POST http://localhost:8000/chat/message \
    -H "Authorization: Bearer <token>" \
    -H "X-User-Tier: free_trial" \
    -d '{"message": "test"}'
done
# Should fail after 50 messages (free_trial limit)

# Test quota status endpoint
curl http://localhost:3001/usage/quota \
  -H "Authorization: Bearer <token>"
# Should return current usage stats
```

---

### 3. Stripe Webhook Verification

**Priority:** P0 - HIGH  
**Effort:** 4 hours  
**Assignee:** Backend Engineer  
**Deadline:** Week 1

**Current Issue:**
Webhook handler exists but doesn't verify Stripe signatures, allowing potential fraud.

**Implementation Plan:**

#### Step 1: Implement Signature Verification (2 hours)

**File:** `services/auth-billing/src/billing/stripe.service.ts`

```typescript
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }
  
  async handleWebhook(body: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;
    
    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        this.webhookSecret
      );
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }
    
    // Handle event
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
    }
  }
  
  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    
    // Update user subscription
    await this.db.query(
      `UPDATE subscriptions 
       SET status = $1, current_period_start = $2, current_period_end = $3
       WHERE stripe_customer_id = $4`,
      [subscription.status, 
       new Date(subscription.current_period_start * 1000),
       new Date(subscription.current_period_end * 1000),
       customerId]
    );
    
    // Update user tier
    const tier = this.getTierFromPriceId(subscription.items.data[0].price.id);
    await this.db.query(
      `UPDATE users SET subscription_tier = $1
       WHERE id = (SELECT user_id FROM subscriptions WHERE stripe_customer_id = $2)`,
      [tier, customerId]
    );
  }
  
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    
    // Downgrade to free_trial
    await this.db.query(
      `UPDATE users SET subscription_tier = 'free_trial'
       WHERE id = (SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1)`,
      [customerId]
    );
    
    await this.db.query(
      `UPDATE subscriptions SET status = 'canceled'
       WHERE stripe_customer_id = $1`,
      [customerId]
    );
  }
  
  private getTierFromPriceId(priceId: string): string {
    if (priceId === process.env.STRIPE_BASIC_PRICE_ID) return 'basic';
    if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro';
    return 'free_trial';
  }
}
```

#### Step 2: Update Webhook Controller (1 hour)

**File:** `services/auth-billing/src/billing/billing.controller.ts`

```typescript
@Post('webhook')
@Header('Content-Type', 'application/json')
async handleStripeWebhook(
  @Req() req: RawBodyRequest<Request>,
  @Res() res: Response
) {
  const signature = req.headers['stripe-signature'] as string;
  
  if (!signature) {
    throw new BadRequestException('Missing stripe-signature header');
  }
  
  try {
    // Pass raw body (Buffer) and signature
    await this.stripeService.handleWebhook(req.rawBody, signature);
    
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
}
```

#### Step 3: Configure Raw Body Parser (30 minutes)

**File:** `services/auth-billing/src/main.ts`

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Stripe webhook needs raw body
  app.use(
    '/billing/webhook',
    express.raw({ type: 'application/json' })
  );
  
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3001);
}
```

#### Step 4: Test Webhooks (30 minutes)

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3001/billing/webhook

# Trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.deleted
```

**Acceptance Criteria:**
- [ ] Webhook signature verification passes for valid events
- [ ] Invalid signatures return 400 errors
- [ ] Subscription creation updates user tier
- [ ] Payment success logs correctly
- [ ] Subscription deletion downgrades user
- [ ] All webhook events logged to database
- [ ] Tested with Stripe CLI

---

### 4. Security Hardening

**Priority:** P0 - HIGH  
**Effort:** 1 day  
**Assignee:** DevOps Engineer  
**Deadline:** Week 1

**Implementation Plan:**

#### 1. Email Verification (4 hours)

**File:** `services/auth-billing/src/auth/auth.service.ts`

```typescript
async register(registerDto: RegisterDto) {
  // ... existing registration code ...
  
  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  await this.db.query(
    `UPDATE users SET email_verification_token = $1, email_verified = false
     WHERE id = $2`,
    [verificationToken, user.id]
  );
  
  // Send verification email
  await this.emailService.sendVerificationEmail(
    user.email,
    `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
  );
  
  return { ...result, requiresEmailVerification: true };
}

async verifyEmail(token: string) {
  const result = await this.db.query(
    `UPDATE users SET email_verified = true, email_verification_token = NULL
     WHERE email_verification_token = $1
     RETURNING id, email`,
    [token]
  );
  
  if (result.rows.length === 0) {
    throw new BadRequestException('Invalid or expired verification token');
  }
  
  return { verified: true };
}
```

#### 2. Login Throttling (2 hours)

**File:** `services/auth-billing/src/auth/auth.service.ts`

```typescript
private async checkLoginAttempts(email: string): Promise<void> {
  const key = `login_attempts:${email}`;
  const attempts = await this.redis.get(key);
  
  if (attempts && parseInt(attempts) >= 5) {
    const ttl = await this.redis.ttl(key);
    throw new UnauthorizedException(
      `Too many login attempts. Try again in ${ttl} seconds.`
    );
  }
}

private async recordFailedLogin(email: string): Promise<void> {
  const key = `login_attempts:${email}`;
  await this.redis.incr(key);
  await this.redis.expire(key, 900); // 15 minutes
}

private async clearLoginAttempts(email: string): Promise<void> {
  const key = `login_attempts:${email}`;
  await this.redis.del(key);
}

async login(loginDto: LoginDto) {
  await this.checkLoginAttempts(loginDto.email);
  
  // ... existing login code ...
  
  if (!isPasswordValid) {
    await this.recordFailedLogin(loginDto.email);
    throw new UnauthorizedException('Invalid credentials');
  }
  
  await this.clearLoginAttempts(loginDto.email);
  
  // ... return tokens ...
}
```

#### 3. Security Headers (1 hour)

**File:** `services/gateway/src/index.ts`

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

#### 4. Request Validation (1 hour)

Add payload size limits and validation:

```typescript
// In gateway
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add message length validation in Intelligence service
@router.post("/chat/message")
async def send_message(request: ChatRequest, ...):
    if len(request.message) > 10000:
        raise HTTPException(
            status_code=400,
            detail="Message too long (max 10,000 characters)"
        )
```

**Acceptance Criteria:**
- [ ] Email verification flow works end-to-end
- [ ] Login attempts limited to 5 per 15 minutes
- [ ] Security headers applied to all responses
- [ ] Request size limits enforced
- [ ] Message length validation active

---

## 📋 P1 High Priority

### 5. Automated Testing Infrastructure

**Priority:** P1 - HIGH  
**Effort:** 1 week  
**Assignee:** QA Engineer / Backend Engineer  
**Deadline:** Week 3-4

**Implementation Plan:**

#### Python Services Testing (3 days)

**File Structure:**
```
services/intelligence/tests/
├── __init__.py
├── conftest.py
├── test_chat.py
├── test_ollama_service.py
├── test_session_service.py
└── test_integration_service.py
```

**File:** `services/intelligence/tests/conftest.py`

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db

# Test database
SQLALCHEMY_DATABASE_URL = "postgresql://test:test@localhost:5432/test_novacore"

@pytest.fixture(scope="function")
def db():
    """Create test database session."""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    TestingSessionLocal = sessionmaker(bind=engine)
    
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db):
    """Create test client with database override."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers():
    """Provide authentication headers for tests."""
    return {
        "X-User-Id": "test-user-id",
        "X-User-Tier": "pro"
    }
```

**File:** `services/intelligence/tests/test_chat.py`

```python
import pytest
from unittest.mock import patch, MagicMock

def test_send_message_success(client, auth_headers):
    """Test successful message sending."""
    with patch('app.services.ollama_service.ollama_service.generate') as mock_generate:
        mock_generate.return_value = MagicMock(
            text="Hello! How can I help?",
            tokens=10
        )
        
        response = client.post(
            "/chat/message",
            headers=auth_headers,
            json={
                "message": "Hello",
                "session_id": "test-session"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert data["response"] == "Hello! How can I help?"

def test_send_message_quota_exceeded(client, auth_headers):
    """Test quota enforcement."""
    auth_headers["X-User-Tier"] = "free_trial"
    
    # Simulate usage at limit
    with patch('app.services.usage_service.usage_service.check_quota') as mock_quota:
        mock_quota.return_value = (False, "Daily quota exceeded")
        
        response = client.post(
            "/chat/message",
            headers=auth_headers,
            json={"message": "Test", "session_id": "test"}
        )
        
        assert response.status_code == 429
        assert "quota exceeded" in response.json()["detail"].lower()

def test_send_message_missing_auth(client):
    """Test that authentication is required."""
    response = client.post(
        "/chat/message",
        json={"message": "Test", "session_id": "test"}
    )
    
    assert response.status_code == 401

def test_memory_integration(client, auth_headers):
    """Test memory service integration."""
    with patch('app.services.integration_service.IntegrationService.get_memory_context') as mock_memory:
        mock_memory.return_value = ["Previous conversation context"]
        
        with patch('app.services.ollama_service.ollama_service.generate') as mock_generate:
            mock_generate.return_value = MagicMock(text="Response", tokens=5)
            
            response = client.post(
                "/chat/message",
                headers=auth_headers,
                json={
                    "message": "Continue conversation",
                    "session_id": "test-session",
                    "use_memory": True
                }
            )
            
            assert response.status_code == 200
            mock_memory.assert_called_once()

@pytest.mark.asyncio
async def test_reflection_triggered(client, auth_headers):
    """Test that reflection tasks are triggered."""
    with patch('app.services.integration_service.IntegrationService.trigger_reflection') as mock_reflection:
        with patch('app.services.ollama_service.ollama_service.generate') as mock_generate:
            mock_generate.return_value = MagicMock(text="Response", tokens=5)
            
            response = client.post(
                "/chat/message",
                headers=auth_headers,
                json={"message": "Test", "session_id": "test"}
            )
            
            assert response.status_code == 200
            # Reflection should be triggered after response
            mock_reflection.assert_called_once()
```

**Run tests:**
```bash
cd services/intelligence
pip install pytest pytest-asyncio pytest-cov
pytest tests/ -v --cov=app --cov-report=html
```

#### Node Services Testing (2 days)

**File:** `services/gateway/src/__tests__/auth.test.ts`

```typescript
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index';

describe('Authentication Middleware', () => {
  const validToken = jwt.sign(
    { sub: 'user-123', email: 'test@example.com', role: 'student' },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
  
  test('should reject requests without token', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(401);
    
    expect(response.body).toHaveProperty('error');
  });
  
  test('should accept valid JWT token', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
  });
  
  test('should reject expired token', async () => {
    const expiredToken = jwt.sign(
      { sub: 'user-123', email: 'test@example.com' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '-1h' }
    );
    
    const response = await request(app)
      .get('/api/health')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(403);
  });
});

describe('Rate Limiting', () => {
  test('should enforce rate limits', async () => {
    // Make 101 requests (limit is 100)
    const requests = Array(101).fill(null).map(() =>
      request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${validToken}`)
    );
    
    const responses = await Promise.all(requests);
    const tooManyRequests = responses.filter(r => r.status === 429);
    
    expect(tooManyRequests.length).toBeGreaterThan(0);
  });
});
```

**Run tests:**
```bash
cd services/gateway
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
npm test
```

#### Integration Tests (2 days)

**File:** `tests/integration/test_full_flow.py`

```python
import pytest
import httpx
import asyncio

BASE_URL = "http://localhost:5000"

@pytest.mark.integration
async def test_full_user_journey():
    """Test complete user flow: register → login → chat → check memory."""
    
    # Step 1: Register
    async with httpx.AsyncClient() as client:
        register_response = await client.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": f"test-{int(time.time())}@example.com",
                "password": "TestPass123!"
            }
        )
        assert register_response.status_code == 201
        tokens = register_response.json()
        access_token = tokens["accessToken"]
    
    # Step 2: Send chat message
    async with httpx.AsyncClient() as client:
        chat_response = await client.post(
            f"{BASE_URL}/chat/message",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "message": "What is constitutional AI?",
                "session_id": "test-session"
            }
        )
        assert chat_response.status_code == 200
        chat_data = chat_response.json()
        assert "response" in chat_data
    
    # Step 3: Wait for reflection (async task)
    await asyncio.sleep(5)
    
    # Step 4: Check memory was stored
    async with httpx.AsyncClient() as client:
        memory_response = await client.get(
            f"{BASE_URL}/memory/list",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert memory_response.status_code == 200
        memories = memory_response.json()["memories"]
        assert len(memories) >= 1
        assert any("constitutional" in m["input_context"].lower() for m in memories)
    
    # Step 5: Check usage was recorded
    async with httpx.AsyncClient() as client:
        usage_response = await client.get(
            f"{BASE_URL}/usage/quota",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert usage_response.status_code == 200
        quota = usage_response.json()
        assert quota["messages"]["used"] >= 1
        assert quota["tokens"]["used"] > 0

@pytest.mark.integration
async def test_quota_enforcement():
    """Test that quota limits are enforced."""
    # Create free_trial user
    # Send messages until quota exceeded
    # Verify 429 error returned
    pass

@pytest.mark.integration
async def test_memory_promotion():
    """Test ITM to LTM promotion after distillation."""
    # Store ITM memories
    # Trigger distillation manually
    # Verify memories promoted to LTM
    pass
```

**Acceptance Criteria:**
- [ ] Unit tests cover 70%+ of core logic
- [ ] Integration tests verify critical flows
- [ ] All tests pass in CI/CD
- [ ] Test coverage report generated
- [ ] Mocking strategy for external services
- [ ] Database fixtures for test data

---

## 📊 Testing Checklist

### Unit Tests
- [ ] Auth service (register, login, refresh)
- [ ] Chat endpoints (message, stream, history)
- [ ] Memory service (store, retrieve, search, promote)
- [ ] Policy service (validate, align)
- [ ] Usage service (record, check quota)
- [ ] Token counter utility
- [ ] Ollama service mocking

### Integration Tests
- [ ] Full user journey (register → chat → memory)
- [ ] Memory context retrieval in chat
- [ ] Reflection task execution
- [ ] Distillation worker logic
- [ ] Quota enforcement across services
- [ ] Subscription tier changes

### E2E Tests
- [ ] Frontend login flow
- [ ] Chat interface with streaming
- [ ] Memory browser
- [ ] NGS learning portal
- [ ] Settings and profile pages

### Load Tests
- [ ] 50 concurrent users
- [ ] 1000 messages benchmark
- [ ] Memory search performance
- [ ] Database connection pool limits
- [ ] Redis memory usage

---

## 📈 Observability Integration

**Priority:** P1 - HIGH  
**Effort:** 2-3 days  
**Deadline:** Week 5-6

[Detailed implementation for observability with Prometheus, Grafana, structured logging, and metrics collection]

---

## ⏱️ Timeline Summary

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | P0 Critical Blockers | Service auth, usage ledger, webhooks, security |
| 2 | Testing Foundation | Pytest, jest, integration tests |
| 3-4 | Test Coverage | 70%+ coverage, load tests |
| 5-6 | Observability | Prometheus, Grafana, logging |
| 7 | Staging Deploy | Deploy, test, fix issues |
| 8 | Alpha Launch | 10 users, monitoring, feedback |
| 9-10 | Beta Prep | Refinements, optimizations |

---

**Document Status:** Active Development Roadmap  
**Next Update:** Weekly progress reviews  
**Contact:** DevOps Architect - NGC

---

**END OF TECHNICAL ACTION PLAN**
