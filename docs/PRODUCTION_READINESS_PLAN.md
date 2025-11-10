# NovaCoreAI - Production Readiness Implementation Plan
## Focused Execution Roadmap to MVP Launch

**Document Version:** 2.0  
**Date:** November 10, 2025  
**Prepared By:** Nova Planner-Orchestrator  
**Status:** Active Implementation Plan  
**Priority:** Production-Critical Tasks Only

---

## 🎯 Executive Summary

### Current State Assessment
- **Overall Completion:** ~92% complete toward production MVP
- **Architecture:** Production-ready foundation ✅
- **Security:** Core implementations complete, email verification pending
- **Testing:** Infrastructure ready, execution & coverage gaps remain
- **Observability:** Metrics instrumented, structured logging needed
- **Timeline to Production:** 14-21 days with focused execution

### Critical Path to Production
This plan focuses **exclusively** on the remaining work required for a production-ready MVP. All "nice-to-have" features have been deferred to post-launch.

### Success Criteria
- ✅ All P0 (Critical) items complete
- ✅ Integration tests passing for critical flows
- ✅ Test coverage ≥70% for core services
- ✅ Observability fully operational
- ✅ Email verification implemented
- ✅ Alpha-ready deployment (10 users)

---

## 📊 What's Already Complete

### ✅ Service-to-Service Authentication (95%)
- Implementation: COMPLETE
- Integration tests: PENDING

### ✅ Usage Ledger Integration (95%)
- Backend: COMPLETE
- Frontend quota display: COMPLETE
- Integration tests: PENDING

### ✅ Stripe Webhook Verification (95%)
- Implementation: COMPLETE
- Manual Stripe CLI testing: PENDING

### ✅ Security Hardening (80%)
- Login throttling: COMPLETE
- Security headers: COMPLETE (Gateway needs HSTS)
- Input validation: COMPLETE
- Email verification: DESIGN COMPLETE, implementation pending

### ✅ Testing Infrastructure (75%)
- Pytest & Jest setup: COMPLETE
- Memory service tests: 110 tests, 1,837 lines
- Policy service tests: COMPLETE
- Remaining: Gateway, Workers, Integration tests

### ✅ Observability Foundation (70%)
- Prometheus & Grafana: CONFIGURED
- Basic metrics: INSTRUMENTED
- Dashboards: 4 created
- Remaining: Structured logging, correlation IDs

---

## 🚨 PHASE 1: Email Verification & Critical Testing (Days 1-4)
**Priority:** P0 - PRODUCTION BLOCKER  
**Effort:** 4 days  
**Goal:** Complete email verification flow and critical integration tests

### Why This Phase Matters
Email verification is the **last P0 security requirement**. Integration tests are **critical** to ensure all the implemented features actually work together in production.

---

### TASK 1.1: Email Verification Backend
**Assignee:** Full-Stack Specialist  
**Effort:** 6-8 hours  
**Dependencies:** None

#### Agent Prompt:
```
TASK: Implement Email Verification System for NovaCoreAI Auth-Billing Service

CONTEXT:
You are implementing the last P0 security requirement for production. The design is already complete in TASK_DELEGATION_PLAN.md (lines 385-413). Service authentication, usage tracking, and Stripe webhooks are already implemented.

REQUIREMENTS:
1. Update auth.service.ts to generate verification tokens
   - Generate 32-byte random token using crypto.randomBytes()
   - Store in new database column: email_verification_token
   - Add email_verified boolean column (default: false)
   - Set token expiration (24 hours)

2. Implement verification methods:
   - generateVerificationToken(userId): string
   - verifyEmail(token): Promise<User>
   - resendVerificationEmail(userId): Promise<void>

3. Send verification email on registration:
   - Use email service (recommend SendGrid or AWS SES)
   - Email template with verification link: https://app.novacoreai.com/verify-email?token=XXX
   - Handle email delivery failures gracefully

4. Create verification endpoints:
   - GET /auth/verify-email?token=xxx
   - POST /auth/resend-verification

5. Database migrations:
   - Add email_verification_token column (nullable string)
   - Add email_verified column (boolean, default false)
   - Add token_expires_at column (timestamp)

SECURITY REQUIREMENTS:
- Tokens must be single-use (delete after verification)
- Tokens expire after 24 hours
- Rate limit verification attempts (5 per 15 minutes per IP)
- Rate limit resend requests (3 per hour per user)

FILES TO MODIFY:
- services/auth-billing/src/auth/auth.service.ts
- services/auth-billing/src/auth/auth.controller.ts
- Create: services/auth-billing/src/email/email.service.ts
- Create migration: services/auth-billing/migrations/add-email-verification.sql

TESTING:
- Write unit tests for token generation and verification
- Test token expiration
- Test rate limiting
- Test duplicate verification attempts

ACCEPTANCE CRITERIA:
- Verification emails sent on registration
- Email verification link works
- Token expires after 24 hours
- Resend verification works
- Rate limiting prevents abuse
- Tests pass

ESTIMATED TIME: 6-8 hours
```

**Dependencies Resolved:** None  
**Parallel Work:** Can proceed independently

---

### TASK 1.2: Email Verification Frontend
**Assignee:** UI/UX Specialist  
**Effort:** 3-4 hours  
**Dependencies:** TASK 1.1 (can start after endpoints defined)

#### Agent Prompt:
```
TASK: Build Email Verification UI Components for NovaCoreAI Frontend

CONTEXT:
The backend email verification API is complete. You need to create the frontend components that provide a smooth verification experience for users.

REQUIREMENTS:
1. Create verification page component:
   - Route: /verify-email
   - Read token from URL query parameter
   - Call GET /auth/verify-email?token=xxx
   - Show loading state during verification
   - Show success message + redirect to dashboard
   - Show error message for invalid/expired tokens
   - Provide "Resend verification" button on error

2. Add verification reminder banner:
   - Display on dashboard if email not verified
   - Dismissible but reappears on reload
   - Clear, friendly message: "Please verify your email to access all features"
   - "Resend verification email" button
   - Hide permanently after verification

3. Add verification status to user profile:
   - Display email verification badge
   - Show verification date if verified

4. Handle verification in auth flow:
   - Check email_verified status on login
   - Store in user context
   - Show appropriate UI based on status

FILES TO CREATE/MODIFY:
- src/pages/VerifyEmail.tsx (new)
- src/components/VerificationBanner.tsx (new)
- src/hooks/useEmailVerification.ts (new)
- src/pages/Dashboard.tsx (add banner)
- src/contexts/AuthContext.tsx (add email_verified field)

DESIGN GUIDELINES:
- Use existing design system components
- Match existing Noble Growth aesthetic
- Accessible (ARIA labels, keyboard navigation)
- Mobile-responsive
- Clear error messages with actionable next steps

TESTING:
- Test successful verification flow
- Test expired token handling
- Test network error handling
- Test resend functionality
- Test banner display and dismissal

ACCEPTANCE CRITERIA:
- Verification page works end-to-end
- Banner shows for unverified users
- Banner hides after verification
- Resend button works
- Mobile-friendly
- Accessible

ESTIMATED TIME: 3-4 hours
```

**Dependencies:** TASK 1.1 must define endpoints first  
**Parallel Work:** Can start implementation once API contract defined

---

### TASK 1.3: Integration Tests - Critical Flows
**Assignee:** Full-Stack Specialist  
**Effort:** 12-16 hours (2 days)  
**Dependencies:** None (tests existing code)

#### Agent Prompt:
```
TASK: Write Integration Tests for NovaCoreAI Critical User Flows

CONTEXT:
All P0 features are implemented but lack integration tests. These tests are CRITICAL for production confidence. They verify that all services work together correctly and that our implemented features actually work end-to-end.

CRITICAL FLOWS TO TEST:

1. SERVICE AUTHENTICATION FLOW (HIGH PRIORITY)
   - Gateway receives request with valid JWT
   - Gateway generates service token
   - Gateway calls Intelligence service with X-Service-Token
   - Intelligence validates service token
   - Request succeeds
   - Test invalid service token returns 403
   - Test expired service token returns 403

2. USAGE TRACKING & QUOTA ENFORCEMENT FLOW (HIGH PRIORITY)
   - User sends chat message
   - Intelligence checks quota before processing
   - Intelligence counts tokens (input + output)
   - Intelligence records usage to usage_ledger
   - Intelligence returns 429 when quota exceeded
   - Verify daily quota reset at midnight UTC

3. STRIPE WEBHOOK FLOW (HIGH PRIORITY)
   - Stripe sends webhook with valid signature
   - Auth-Billing verifies signature
   - Auth-Billing updates user subscription tier
   - User tier change reflected in database
   - Quota limits updated for new tier
   - Test invalid signature returns 400

4. COMPLETE USER JOURNEY (MEDIUM PRIORITY)
   - Register new user
   - Login with credentials
   - Send chat message
   - Verify message stored
   - Verify memory created
   - Verify usage recorded
   - Verify quota checked

5. MEMORY PROMOTION FLOW (MEDIUM PRIORITY)
   - Create short-term memory (STM)
   - Trigger distillation worker
   - Verify promotion to intermediate-term (ITM)
   - Verify promotion to long-term (LTM)

IMPLEMENTATION DETAILS:
- Use docker-compose.test.yml environment
- Use pytest for Python integration tests
- Use supertest for Node.js integration tests
- Create test fixtures for common scenarios
- Clean up test data after each test
- Mock external services (Ollama, Stripe)

FILES TO CREATE:
- tests/integration/test_service_auth.py (Priority 1)
- tests/integration/test_usage_quota.py (Priority 1)
- tests/integration/test_stripe_webhooks.py (Priority 1)
- tests/integration/test_user_journey.py (Priority 2)
- tests/integration/test_memory_promotion.py (Priority 2)
- tests/integration/conftest.py (shared fixtures)

TEST STRUCTURE:
```python
# Example: test_service_auth.py
import pytest
import httpx

@pytest.mark.integration
async def test_service_token_validation_success():
    """Test that valid service tokens are accepted"""
    # Arrange: Get service token from auth service
    # Act: Call intelligence service with token
    # Assert: Request succeeds with 200
    
@pytest.mark.integration
async def test_service_token_validation_failure():
    """Test that invalid service tokens are rejected"""
    # Arrange: Create invalid token
    # Act: Call intelligence service with bad token
    # Assert: Returns 403 Forbidden
```

ENVIRONMENT SETUP:
- Start all services with docker-compose.test.yml
- Wait for services to be healthy
- Run migrations
- Seed test data
- Execute tests
- Cleanup

ACCEPTANCE CRITERIA:
- All critical flows covered (service auth, quota, webhooks)
- Tests run in isolated environment
- Tests are reliable (no flaky tests)
- Tests clean up after themselves
- Tests run in CI/CD
- Coverage report generated
- All tests pass

ESTIMATED TIME: 12-16 hours (2 days)
PRIORITY: HIGH - Required for production confidence
```

**Dependencies:** None (tests existing implementations)  
**Parallel Work:** Can proceed immediately while email verification is developed

---

### TASK 1.4: Gateway Service Tests
**Assignee:** Full-Stack Specialist  
**Effort:** 8 hours (1 day)  
**Dependencies:** None

#### Agent Prompt:
```
TASK: Write Comprehensive Tests for NovaCoreAI Gateway Service

CONTEXT:
The Gateway is the entry point for all requests. It handles JWT validation, rate limiting, and service routing. Testing is CRITICAL because failures cascade to all services. Testing infrastructure (Jest + supertest) is already configured.

TEST COVERAGE REQUIRED:

1. JWT VALIDATION MIDDLEWARE (HIGH PRIORITY)
   - Valid JWT passes through
   - Invalid JWT returns 401
   - Expired JWT returns 401
   - Missing JWT returns 401
   - JWT with invalid signature returns 401
   - User context extracted from JWT

2. SERVICE TOKEN MIDDLEWARE (HIGH PRIORITY)
   - Service token generated for downstream calls
   - Service token included in X-Service-Token header
   - Token generation failures handled gracefully

3. RATE LIMITING (HIGH PRIORITY)
   - Rate limits enforced per user
   - Correct limits applied per tier (free/basic/pro)
   - 429 returned when limit exceeded
   - Rate limit resets after time window
   - Burst allowance works

4. SERVICE ROUTING (MEDIUM PRIORITY)
   - Requests routed to correct service
   - Health checks work
   - 404 for unknown routes
   - Timeout handling
   - Error responses formatted correctly

5. WEBSOCKET CONNECTIONS (MEDIUM PRIORITY)
   - WebSocket upgrade works
   - JWT validation on WebSocket connect
   - Message routing works
   - Connection cleanup on disconnect

FILES TO CREATE:
- services/gateway/src/__tests__/middleware/jwt-auth.test.ts
- services/gateway/src/__tests__/middleware/service-auth.test.ts
- services/gateway/src/__tests__/middleware/rate-limit.test.ts
- services/gateway/src/__tests__/routes.test.ts
- services/gateway/src/__tests__/websocket.test.ts
- services/gateway/src/__tests__/helpers/test-utils.ts

TEST STRUCTURE:
```typescript
// Example: jwt-auth.test.ts
import request from 'supertest';
import app from '../../index';
import { generateTestJWT } from './helpers/test-utils';

describe('JWT Authentication Middleware', () => {
  describe('Valid JWT', () => {
    it('should allow requests with valid JWT', async () => {
      const token = generateTestJWT({ userId: '123' });
      const response = await request(app)
        .get('/api/intelligence/health')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
    });
  });
  
  describe('Invalid JWT', () => {
    it('should reject requests with expired JWT', async () => {
      const token = generateExpiredJWT();
      const response = await request(app)
        .get('/api/intelligence/health')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token expired');
    });
  });
});
```

TESTING SETUP:
- Use Jest + supertest (already configured)
- Mock downstream services
- Use test JWT secrets
- Create test helper utilities
- Setup/teardown for each test

TARGET COVERAGE: 70%+ for critical paths

ACCEPTANCE CRITERIA:
- 70%+ code coverage achieved
- All critical middleware tested
- All error cases covered
- Tests run in CI/CD
- No flaky tests
- Tests complete in <30 seconds

ESTIMATED TIME: 8 hours (1 day)
PRIORITY: HIGH - Gateway is critical infrastructure
```

**Dependencies:** None  
**Parallel Work:** Can proceed immediately

---

## 🔍 PHASE 2: Observability Completion (Days 5-7)
**Priority:** P1 - REQUIRED FOR PRODUCTION OPERATIONS  
**Effort:** 3 days  
**Goal:** Complete structured logging and ensure all observability is production-ready

### Why This Phase Matters
You **cannot** run production without proper logging and observability. When things break at 3 AM, you need correlation IDs and structured logs to debug quickly.

---

### TASK 2.1: Structured Logging Implementation
**Assignee:** Full-Stack Specialist  
**Effort:** 8 hours (1 day)  
**Dependencies:** None

#### Agent Prompt:
```
TASK: Implement Structured Logging Across All NovaCoreAI Services

CONTEXT:
Currently logs are unstructured console.log() statements. For production operations, we need JSON-structured logs with correlation IDs to trace requests across services. This is CRITICAL for debugging production issues.

REQUIREMENTS:

1. PYTHON SERVICES (Intelligence, Memory, Policy, Workers)
   - Replace print/logging with structlog
   - Configure JSON output format
   - Include in every log entry:
     * timestamp (ISO 8601)
     * level (DEBUG/INFO/WARNING/ERROR)
     * service_name
     * correlation_id (from X-Correlation-ID header)
     * user_id (if authenticated)
     * message
     * additional context
   
2. NODE.JS SERVICES (Gateway, Auth-Billing)
   - Replace console.log with winston
   - Configure JSON output format
   - Include same fields as Python services
   
3. CORRELATION ID MIDDLEWARE
   - Generate X-Correlation-ID if not present (UUIDv4)
   - Pass through all service calls
   - Include in response headers
   - Add to logging context

IMPLEMENTATION DETAILS:

Python (structlog):
```python
# shared/python/logging_config.py
import structlog
import uuid
from contextvars import ContextVar

correlation_id: ContextVar[str] = ContextVar('correlation_id', default=None)

def configure_logging(service_name: str):
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )
    structlog.contextvars.bind_contextvars(service_name=service_name)

def set_correlation_id(corr_id: str = None):
    if not corr_id:
        corr_id = str(uuid.uuid4())
    correlation_id.set(corr_id)
    structlog.contextvars.bind_contextvars(correlation_id=corr_id)
    return corr_id
```

Node.js (winston):
```typescript
// shared/nodejs/logging.ts
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export const logger = winston.createLogger({
  format: winston.format.json(),
  defaultMeta: { service_name: 'gateway' },
  transports: [new winston.transports.Console()]
});

export function correlationMiddleware(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  req.logger = logger.child({ correlation_id: req.correlationId });
  next();
}
```

4. UPDATE ALL LOG STATEMENTS
   - Replace print() with log.info()
   - Replace console.log() with logger.info()
   - Add context to log statements
   - Use appropriate log levels

FILES TO CREATE:
- shared/python/logging_config.py
- shared/nodejs/logging.ts

FILES TO MODIFY:
- services/intelligence/app/main.py (configure logging)
- services/memory/app/main.py
- services/noble-spirit/app/main.py
- services/gateway/src/index.ts (add middleware)
- services/auth-billing/src/main.ts
- ALL route handlers (add contextual logging)

ACCEPTANCE CRITERIA:
- All services output JSON logs
- Correlation IDs tracked across services
- User IDs included when available
- Log levels appropriate (INFO for operations, ERROR for failures)
- Logs searchable by correlation_id
- Documentation for log format

ESTIMATED TIME: 8 hours (1 day)
PRIORITY: HIGH - Required for production operations
```

**Dependencies:** None  
**Parallel Work:** Can proceed while tests are being written

---

### TASK 2.2: Metrics Instrumentation Completion
**Assignee:** Full-Stack Specialist  
**Effort:** 8 hours (1 day)  
**Dependencies:** None

#### Agent Prompt:
```
TASK: Complete Prometheus Metrics Instrumentation for NovaCoreAI Services

CONTEXT:
Basic Prometheus instrumentation exists but custom business metrics are incomplete. For production, we need comprehensive metrics to understand system behavior and business performance.

SERVICES ALREADY INSTRUMENTED (Basic):
- Intelligence: Has /metrics endpoint, needs custom metrics
- Gateway: Needs implementation
- Auth-Billing: Needs implementation

REQUIRED METRICS BY SERVICE:

1. INTELLIGENCE SERVICE (Python)
   Custom metrics needed:
   - chat_messages_total (counter, labels: user_tier, model)
   - chat_tokens_total (counter, labels: direction=input/output, user_tier)
   - chat_latency_seconds (histogram)
   - ollama_latency_seconds (histogram)
   - memory_context_size_bytes (gauge)
   - quota_exceeded_total (counter, labels: resource_type)

2. MEMORY SERVICE (Python)
   Custom metrics needed:
   - memory_storage_total (counter, labels: tier=STM/ITM/LTM)
   - memory_search_total (counter)
   - memory_search_latency_seconds (histogram)
   - vector_embedding_latency_seconds (histogram)
   - memory_tier_distribution (gauge, labels: tier)

3. GATEWAY SERVICE (Node.js)
   Custom metrics needed:
   - gateway_requests_total (counter, labels: route, method, status)
   - gateway_latency_seconds (histogram, labels: route)
   - rate_limit_exceeded_total (counter, labels: user_tier)
   - websocket_connections_active (gauge)
   - service_token_generation_total (counter)

4. AUTH-BILLING SERVICE (Node.js)
   Custom metrics needed:
   - auth_login_total (counter, labels: success=true/false)
   - auth_registration_total (counter)
   - auth_token_refresh_total (counter)
   - subscription_changes_total (counter, labels: from_tier, to_tier)
   - stripe_webhook_total (counter, labels: event_type, success)

IMPLEMENTATION:

Python (prometheus-fastapi-instrumentator):
```python
from prometheus_client import Counter, Histogram, Gauge

# Define custom metrics
chat_messages = Counter(
    'chat_messages_total',
    'Total chat messages processed',
    ['user_tier', 'model']
)

chat_tokens = Counter(
    'chat_tokens_total', 
    'Total tokens processed',
    ['direction', 'user_tier']
)

# Use in handlers
@router.post("/chat")
async def chat_endpoint(message: str, user: User):
    chat_messages.labels(
        user_tier=user.tier,
        model='llama3.2'
    ).inc()
    
    tokens_used = process_message(message)
    chat_tokens.labels(
        direction='input',
        user_tier=user.tier
    ).inc(tokens_used)
```

Node.js (prom-client):
```typescript
import * as promClient from 'prom-client';

// Define metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'gateway_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['route', 'method', 'status']
});

// Use in middleware
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestsTotal.labels(
      req.route?.path || 'unknown',
      req.method,
      res.statusCode.toString()
    ).inc();
  });
  next();
});
```

FILES TO MODIFY:
- services/intelligence/app/routers/chat.py
- services/memory/app/routers/memory.py
- services/gateway/src/index.ts
- services/gateway/src/middleware/metrics.ts (create)
- services/auth-billing/src/auth/auth.controller.ts
- services/auth-billing/src/billing/billing.controller.ts

VERIFICATION:
- Visit /metrics endpoint for each service
- Verify custom metrics appear
- Verify labels are correct
- Verify metrics update on operations
- Check Prometheus scraping succeeds

ACCEPTANCE CRITERIA:
- All custom metrics implemented
- Metrics exported at /metrics endpoints
- Prometheus scraping all services
- Grafana dashboards showing metrics
- Documentation for metric definitions

ESTIMATED TIME: 8 hours (1 day)
PRIORITY: HIGH - Required for production monitoring
```

**Dependencies:** None  
**Parallel Work:** Can proceed in parallel with logging

---

### TASK 2.3: Observability Validation & Documentation
**Assignee:** DevOps Specialist  
**Effort:** 4 hours  
**Dependencies:** TASK 2.1, TASK 2.2

#### Agent Prompt:
```
TASK: Validate Observability Stack and Create Production Runbooks

CONTEXT:
Structured logging and metrics are implemented. You need to validate everything works end-to-end and create runbooks for production operations.

VALIDATION TASKS:

1. PROMETHEUS VALIDATION
   - Verify all services being scraped
   - Check for scrape errors
   - Validate custom metrics appearing
   - Test metric queries in Prometheus UI
   - Verify alert rules are loaded

2. GRAFANA VALIDATION
   - Verify all 4 dashboards functional
   - Test all panels showing data
   - Verify data source connections
   - Test dashboard variables
   - Export dashboard JSON for version control

3. LOGGING VALIDATION
   - Generate test requests with correlation IDs
   - Search logs by correlation ID
   - Verify JSON format correct
   - Test log aggregation (if using Loki/ELK)
   - Verify log retention policies

4. ALERTING VALIDATION
   - Trigger test alert (stop a service)
   - Verify alert fires in Prometheus
   - Verify notification delivered (Slack/email)
   - Test alert recovery
   - Document alert response procedures

RUNBOOK CREATION:

Create these runbooks in docs/runbooks/:

1. ALERT_RESPONSE.md
   - How to respond to each alert
   - Investigation steps
   - Common causes
   - Resolution procedures
   - Escalation paths

2. LOG_INVESTIGATION.md
   - How to search logs by correlation ID
   - How to trace requests across services
   - Common log patterns for issues
   - Example queries

3. METRICS_INVESTIGATION.md
   - Key metrics to check for issues
   - Normal vs. abnormal patterns
   - How to use Grafana dashboards
   - Example queries

4. SERVICE_HEALTH_CHECK.md
   - How to check if all services healthy
   - Common health check failures
   - How to restart services
   - How to check dependencies (DB, Redis)

FILES TO CREATE:
- docs/runbooks/ALERT_RESPONSE.md
- docs/runbooks/LOG_INVESTIGATION.md
- docs/runbooks/METRICS_INVESTIGATION.md
- docs/runbooks/SERVICE_HEALTH_CHECK.md
- observability/grafana/dashboards/*.json (export)

ACCEPTANCE CRITERIA:
- All services scraped by Prometheus
- All metrics visible in Grafana
- Logs searchable by correlation ID
- Test alert successfully triggered
- 4 runbooks created and reviewed
- Dashboard JSONs version controlled

ESTIMATED TIME: 4 hours
PRIORITY: HIGH - Required for production operations
```

**Dependencies:** Must complete after TASK 2.1 and TASK 2.2  
**Parallel Work:** No

---

## 🧪 PHASE 3: Test Execution & Coverage (Days 8-10)
**Priority:** P1 - QUALITY ASSURANCE  
**Effort:** 3 days  
**Goal:** Execute all tests, achieve 70%+ coverage, fix failures

### Why This Phase Matters
Tests are written but haven't been executed. We need to ensure they pass and achieve target coverage before production deployment.

---

### TASK 3.1: Test Execution & Coverage Analysis
**Assignee:** Full-Stack Specialist  
**Effort:** 8 hours (1 day)  
**Dependencies:** TASK 1.3, TASK 1.4 (all tests written)

#### Agent Prompt:
```
TASK: Execute All Test Suites and Generate Coverage Reports for NovaCoreAI

CONTEXT:
All test suites are written but need to be executed and validated. Some tests may fail due to environment issues or bugs. Your job is to get all tests passing and generate coverage reports.

TEST EXECUTION PLAN:

1. SETUP TEST ENVIRONMENT
   ```bash
   # Start test databases
   docker-compose -f docker-compose.test.yml up -d postgres redis
   
   # Wait for services to be ready
   ./scripts/wait-for-services.sh
   
   # Run migrations
   cd services/auth-billing && npm run migrate
   cd services/intelligence && alembic upgrade head
   cd services/memory && alembic upgrade head
   ```

2. EXECUTE PYTHON TESTS
   ```bash
   # Memory service
   cd services/memory
   pytest tests/ -v --cov=app --cov-report=html --cov-report=term
   
   # Policy service  
   cd services/noble-spirit
   pytest tests/ -v --cov=app --cov-report=html --cov-report=term
   
   # Intelligence service
   cd services/intelligence
   pytest tests/ -v --cov=app --cov-report=html --cov-report=term
   ```

3. EXECUTE NODE.JS TESTS
   ```bash
   # Gateway
   cd services/gateway
   npm test -- --coverage
   
   # Auth-Billing
   cd services/auth-billing
   npm test -- --coverage
   ```

4. EXECUTE INTEGRATION TESTS
   ```bash
   # Start all services
   docker-compose -f docker-compose.test.yml up -d
   
   # Wait for health
   ./scripts/wait-for-services.sh
   
   # Run integration tests
   cd tests/integration
   pytest -v --cov
   ```

5. ANALYZE COVERAGE
   - Generate coverage reports for each service
   - Identify gaps below 70% threshold
   - Prioritize gaps in critical code paths
   - Document areas needing more tests

6. FIX FAILING TESTS
   - Investigate each failure
   - Fix environment issues
   - Fix actual bugs
   - Update tests if requirements changed
   - Re-run until all pass

EXPECTED ISSUES & SOLUTIONS:
- Database connection issues → Check docker-compose.test.yml
- Missing environment variables → Check .env.test files
- Timeout issues → Increase test timeouts
- Mock failures → Update mocks to match implementation
- Race conditions → Add proper async/await handling

DELIVERABLES:
1. All test suites passing (100% pass rate)
2. Coverage reports generated:
   - services/memory/htmlcov/
   - services/noble-spirit/htmlcov/
   - services/intelligence/htmlcov/
   - services/gateway/coverage/
   - services/auth-billing/coverage/
3. Coverage summary document:
   - Overall coverage %
   - Per-service coverage %
   - Critical gaps identified
   - Plan to address gaps below 70%

ACCEPTANCE CRITERIA:
- All tests pass (0 failures)
- Coverage reports generated
- Coverage ≥70% for Memory, Policy services
- Coverage ≥60% for other services (acceptable for MVP)
- Critical code paths covered
- Coverage reports committed to repo
- CI/CD updated to run tests

ESTIMATED TIME: 8 hours (1 day)
PRIORITY: HIGH - Required before deployment
```

**Dependencies:** All test code must be written first  
**Parallel Work:** No (sequential execution required)

---

### TASK 3.2: Worker Tests Implementation
**Assignee:** Full-Stack Specialist  
**Effort:** 8 hours (1 day)  
**Dependencies:** None

#### Agent Prompt:
```
TASK: Write Tests for Reflection and Distillation Workers

CONTEXT:
The workers handle critical background tasks (reflection, memory distillation). They need tests to ensure reliability. These are lower priority than integration tests but required for production confidence.

WORKER TEST REQUIREMENTS:

1. REFLECTION WORKER (Celery task)
   Test files to create:
   - services/reflection-worker/tests/test_reflection_tasks.py
   - services/reflection-worker/tests/conftest.py
   
   Tests needed:
   - Test reflection task execution
   - Test reflection content generation (mock Ollama)
   - Test reflection storage to memory service
   - Test error handling (service unavailable)
   - Test retry logic (3 retries with backoff)
   - Test task timeout handling
   - Test service token authentication

2. DISTILLATION WORKER (Celery task)
   Test files to create:
   - services/distillation-worker/tests/test_distillation_tasks.py
   - services/distillation-worker/tests/conftest.py
   
   Tests needed:
   - Test nightly distillation task
   - Test memory aggregation logic
   - Test tier promotion (STM → ITM → LTM)
   - Test memory scoring/ranking
   - Test batch processing
   - Test error handling
   - Test partial failure handling

IMPLEMENTATION APPROACH:

```python
# Example: test_reflection_tasks.py
import pytest
from unittest.mock import Mock, patch
from worker.tasks import generate_reflection

@pytest.fixture
def mock_ollama():
    """Mock Ollama service"""
    with patch('worker.services.ollama.generate') as mock:
        mock.return_value = {"response": "Test reflection content"}
        yield mock

@pytest.fixture
def mock_memory_service():
    """Mock memory service"""
    with patch('worker.services.memory.store_memory') as mock:
        mock.return_value = {"id": "mem_123"}
        yield mock

@pytest.mark.asyncio
async def test_reflection_task_success(mock_ollama, mock_memory_service):
    """Test successful reflection generation and storage"""
    # Arrange
    user_id = "user_123"
    conversation_context = "Test conversation"
    
    # Act
    result = await generate_reflection(user_id, conversation_context)
    
    # Assert
    assert result["status"] == "success"
    mock_ollama.assert_called_once()
    mock_memory_service.assert_called_once()

@pytest.mark.asyncio  
async def test_reflection_task_ollama_failure(mock_ollama, mock_memory_service):
    """Test handling of Ollama service failure with retry"""
    # Arrange
    mock_ollama.side_effect = ConnectionError("Service unavailable")
    
    # Act & Assert
    with pytest.raises(Exception):
        await generate_reflection("user_123", "Test")
    
    # Should retry 3 times
    assert mock_ollama.call_count == 3
```

TEST COVERAGE TARGETS:
- Reflection worker: 70%+
- Distillation worker: 70%+
- Focus on critical paths and error handling

CELERY TESTING SETUP:
- Use CELERY_TASK_ALWAYS_EAGER = True for synchronous testing
- Mock external service calls (Ollama, Memory, Intelligence)
- Test with actual Celery worker (integration test)

FILES TO CREATE:
- services/reflection-worker/tests/test_reflection_tasks.py
- services/reflection-worker/tests/conftest.py
- services/distillation-worker/tests/test_distillation_tasks.py
- services/distillation-worker/tests/conftest.py
- services/reflection-worker/pytest.ini
- services/distillation-worker/pytest.ini

ACCEPTANCE CRITERIA:
- All worker tests pass
- Coverage ≥70% for both workers
- Error handling tested
- Retry logic verified
- Service authentication tested
- Tests run in CI/CD

ESTIMATED TIME: 8 hours (1 day)
PRIORITY: MEDIUM - Required before production
```

**Dependencies:** None  
**Parallel Work:** Can proceed while integration tests are being executed

---

### TASK 3.3: CI/CD Test Automation
**Assignee:** DevOps Specialist  
**Effort:** 4 hours  
**Dependencies:** TASK 3.1 (tests must pass locally first)

#### Agent Prompt:
```
TASK: Configure GitHub Actions to Run All Tests on Every PR

CONTEXT:
All tests are written and passing locally. Now we need to automate test execution in CI/CD to prevent regressions. Tests must pass before any PR can merge.

GITHUB ACTIONS WORKFLOW REQUIREMENTS:

Create: .github/workflows/test.yml

Workflow should:
1. Trigger on: push to main/develop, pull requests
2. Run on: ubuntu-latest
3. Set up test environment:
   - Start PostgreSQL container
   - Start Redis container
   - Install Node.js 18+
   - Install Python 3.11+
4. Run tests for each service:
   - Gateway (Node.js)
   - Auth-Billing (Node.js)
   - Intelligence (Python)
   - Memory (Python)
   - Policy (Python)
   - Integration tests
5. Generate coverage reports
6. Upload coverage to Codecov
7. Block merge if tests fail
8. Block merge if coverage drops below threshold

WORKFLOW STRUCTURE:

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test-nodejs:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: novacore_test
      redis:
        image: redis:7
        
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Test Gateway
        working-directory: services/gateway
        run: |
          npm ci
          npm test -- --coverage
      
      - name: Test Auth-Billing
        working-directory: services/auth-billing
        run: |
          npm ci
          npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        
  test-python:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
      redis:
        image: redis:7
        
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Test Intelligence
        working-directory: services/intelligence
        run: |
          pip install -r requirements.txt
          pytest tests/ -v --cov --cov-report=xml
      
      - name: Test Memory
        working-directory: services/memory
        run: |
          pip install -r requirements.txt
          pytest tests/ -v --cov --cov-report=xml
          
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        
  integration-tests:
    runs-on: ubuntu-latest
    needs: [test-nodejs, test-python]
    
    steps:
      - uses: actions/checkout@v3
      - name: Start services
        run: docker-compose -f docker-compose.test.yml up -d
      
      - name: Run integration tests
        working-directory: tests/integration
        run: pytest -v
```

BRANCH PROTECTION RULES:
Configure in GitHub Settings → Branches → main:
- Require status checks to pass before merging
- Require "test-nodejs" to pass
- Require "test-python" to pass  
- Require "integration-tests" to pass
- Require branches to be up to date

COVERAGE REPORTING:
- Sign up for Codecov account
- Add CODECOV_TOKEN to GitHub Secrets
- Configure Codecov to comment on PRs
- Set coverage threshold (70% target)

FILES TO CREATE:
- .github/workflows/test.yml
- .github/workflows/coverage.yml (optional)
- codecov.yml (coverage configuration)

ACCEPTANCE CRITERIA:
- Tests run automatically on every PR
- All test jobs complete successfully
- Coverage reports uploaded
- PRs blocked if tests fail
- Coverage visible in PR comments
- Badge added to README showing test status

ESTIMATED TIME: 4 hours
PRIORITY: HIGH - Required to prevent regressions
```

**Dependencies:** Tests must pass locally first  
**Parallel Work:** Can be prepared while tests are being executed locally

---

## 🚢 PHASE 4: Production Deployment Preparation (Days 11-14)
**Priority:** P1 - DEPLOYMENT READINESS  
**Effort:** 4 days  
**Goal:** Prepare infrastructure, deploy to staging, validate everything works

### Why This Phase Matters
Everything is tested and working locally. Now we need to deploy to a real environment and validate under production-like conditions.

---

### TASK 4.1: Staging Environment Deployment
**Assignee:** DevOps Specialist  
**Effort:** 12 hours (1.5 days)  
**Dependencies:** All tests passing

#### Agent Prompt:
```
TASK: Deploy NovaCoreAI to Staging Environment on DigitalOcean

CONTEXT:
All services are tested and ready for deployment. You need to provision staging infrastructure, deploy all services, and validate everything works in a production-like environment.

INFRASTRUCTURE REQUIREMENTS:

1. DIGITALOCEAN DROPLET
   - Size: 4 vCPU, 8GB RAM (for staging)
   - Operating System: Ubuntu 22.04 LTS
   - Region: Choose based on target users (NYC1, SFO3, etc.)
   - Add SSH key for secure access
   - Enable backups

2. MANAGED POSTGRESQL (Staging)
   - Plan: Basic ($15/month is fine for staging)
   - Version: PostgreSQL 15
   - Connection pooling: Enabled
   - Automatic backups: Daily

3. MANAGED REDIS (Staging)
   - Plan: Basic ($15/month is fine for staging)
   - Version: Redis 7
   - Eviction policy: allkeys-lru

4. DOMAIN & SSL
   - Subdomain: staging.novacoreai.com
   - SSL Certificate: Let's Encrypt (certbot)
   - Auto-renewal: Enabled

DEPLOYMENT STEPS:

1. PROVISION INFRASTRUCTURE
   ```bash
   # If using Terraform (recommended)
   cd infrastructure/terraform/staging
   terraform init
   terraform plan
   terraform apply
   
   # Record outputs:
   # - Droplet IP address
   # - PostgreSQL connection string
   # - Redis connection string
   ```

2. SERVER SETUP
   ```bash
   # SSH into droplet
   ssh root@<droplet-ip>
   
   # Install Docker & Docker Compose
   apt update
   apt install -y docker.io docker-compose-plugin
   systemctl enable docker
   
   # Install additional tools
   apt install -y git nginx certbot python3-certbot-nginx
   
   # Clone repository
   cd /opt
   git clone https://github.com/yourusername/NovaCoreAI.git
   cd NovaCoreAI
   git checkout main
   ```

3. CONFIGURE ENVIRONMENT
   ```bash
   # Create production .env file
   cp env.example .env.staging
   
   # Configure with staging values:
   # - DATABASE_URL (from managed PostgreSQL)
   # - REDIS_URL (from managed Redis)
   # - JWT_SECRET (generate: openssl rand -base64 32)
   # - SERVICE_JWT_SECRET (generate: openssl rand -base64 32)
   # - STRIPE_SECRET_KEY (test mode)
   # - STRIPE_WEBHOOK_SECRET (from Stripe dashboard)
   # - OLLAMA_BASE_URL (configure Ollama endpoint)
   ```

4. DATABASE SETUP
   ```bash
   # Run migrations
   docker-compose -f docker-compose.prod.yml run auth-billing npm run migrate
   
   # Seed initial data (if needed)
   docker-compose -f docker-compose.prod.yml run auth-billing npm run seed
   ```

5. DEPLOY SERVICES
   ```bash
   # Pull/build images
   docker-compose -f docker-compose.prod.yml build
   
   # Start services
   docker-compose -f docker-compose.prod.yml up -d
   
   # Verify all services running
   docker-compose -f docker-compose.prod.yml ps
   ```

6. CONFIGURE NGINX REVERSE PROXY
   ```nginx
   # /etc/nginx/sites-available/staging.novacoreai.com
   server {
       listen 80;
       server_name staging.novacoreai.com;
       
       location / {
           proxy_pass http://localhost:3000;  # Gateway
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

7. SETUP SSL
   ```bash
   # Generate SSL certificate
   certbot --nginx -d staging.novacoreai.com
   
   # Test auto-renewal
   certbot renew --dry-run
   ```

8. CONFIGURE MONITORING
   ```bash
   # Access Grafana
   # Open: https://staging.novacoreai.com:3001
   # Login with admin credentials
   # Verify all dashboards loading
   # Verify metrics being collected
   ```

VALIDATION CHECKLIST:
- [ ] All services responding to health checks
- [ ] Gateway routing requests correctly
- [ ] Authentication working (register, login, JWT)
- [ ] Chat endpoint working
- [ ] Memory storage working
- [ ] Quota enforcement working
- [ ] Stripe webhooks reachable
- [ ] SSL certificate valid
- [ ] Monitoring dashboards showing data
- [ ] Logs being collected
- [ ] No errors in service logs

ROLLBACK PLAN:
- Keep previous deployment available
- Document rollback commands
- Test rollback procedure

FILES TO CREATE/MODIFY:
- infrastructure/terraform/staging/ (if using Terraform)
- .env.staging
- docker-compose.prod.yml (if needed)
- docs/DEPLOYMENT_STAGING.md (deployment runbook)

ACCEPTANCE CRITERIA:
- Staging environment fully operational
- All services healthy
- Accessible via staging.novacoreai.com
- SSL certificate valid
- Monitoring active
- Documentation complete

ESTIMATED TIME: 12 hours (1.5 days)
PRIORITY: HIGH - Required before production
```

**Dependencies:** All tests must pass  
**Parallel Work:** No (sequential deployment)

---

### TASK 4.2: End-to-End Validation on Staging
**Assignee:** Full-Stack Specialist & UI/UX Specialist  
**Effort:** 8 hours (1 day)  
**Dependencies:** TASK 4.1 (staging deployed)

#### Agent Prompt:
```
TASK: Perform Comprehensive End-to-End Validation on Staging Environment

CONTEXT:
Staging is deployed. You need to manually test all critical user flows to ensure everything works correctly in a real environment before production deployment.

VALIDATION FLOWS:

1. USER REGISTRATION & EMAIL VERIFICATION (P0)
   - Navigate to staging.novacoreai.com
   - Click "Sign Up"
   - Register with real email address
   - Verify email sent
   - Click verification link
   - Verify email marked as verified
   - Check database: email_verified = true
   
   Expected: ✅ User registered and verified

2. LOGIN & AUTHENTICATION (P0)
   - Attempt login with incorrect password (5 times)
   - Verify rate limiting triggers
   - Wait 15 minutes
   - Login with correct credentials
   - Verify JWT token received
   - Verify redirected to dashboard
   - Verify quota display shows correct limits
   
   Expected: ✅ Login throttling works, authentication succeeds

3. CHAT FUNCTIONALITY (P0)
   - Send chat message via UI
   - Verify streaming response works
   - Verify message saved
   - Check backend logs for correlation ID
   - Check usage_ledger for recorded tokens
   - Check quota updated
   
   Expected: ✅ Chat works, usage tracked

4. QUOTA ENFORCEMENT (P0)
   - Note current quota
   - Send messages until quota exhausted
   - Verify 429 error returned
   - Verify friendly error message shown
   - Verify "Upgrade" option presented
   
   Expected: ✅ Quota enforced correctly

5. MEMORY STORAGE (P1)
   - Send several chat messages
   - Navigate to Memory Browser
   - Verify memories appear
   - Search for specific memory
   - Verify search results correct
   
   Expected: ✅ Memories stored and searchable

6. STRIPE SUBSCRIPTION FLOW (P0)
   - Navigate to Billing page
   - Click "Upgrade to Pro"
   - Complete Stripe checkout (use test card: 4242 4242 4242 4242)
   - Verify redirect back to app
   - Verify tier updated to "pro"
   - Verify quota limits increased
   - Check Stripe webhook logs
   
   Expected: ✅ Subscription works, webhook processed

7. SERVICE AUTHENTICATION (P0)
   - Check Gateway logs for X-Service-Token header
   - Verify service tokens being generated
   - Attempt to call Intelligence directly without service token
   - Verify 403 returned
   
   Expected: ✅ Service auth enforced

8. MONITORING & OBSERVABILITY (P1)
   - Open Grafana dashboards
   - Verify metrics updating in real-time
   - Trigger an error (send invalid request)
   - Verify error appears in logs
   - Search logs by correlation ID
   - Trace request through services
   
   Expected: ✅ Monitoring functional

9. MOBILE RESPONSIVENESS (P1)
   - Test on iOS device (iPhone)
   - Test on Android device
   - Verify chat interface works
   - Verify navigation works
   - Verify touch targets large enough
   
   Expected: ✅ Mobile-friendly

10. PERFORMANCE (P1)
    - Test chat response time (<3 seconds p95)
    - Test page load times (<2 seconds)
    - Test with 10 concurrent users (use k6 or similar)
    - Verify no timeouts
    - Check resource usage (CPU, memory)
    
    Expected: ✅ Performance acceptable

ISSUE TRACKING:
For each issue found:
1. Document in GitHub Issues
2. Assign severity (P0/P1/P2)
3. Assign to appropriate specialist
4. Track resolution
5. Re-test after fix

ACCEPTANCE CRITERIA:
- All P0 flows work correctly
- No critical bugs found
- Performance acceptable
- Mobile experience good
- Monitoring functional
- All issues documented
- Sign-off from each specialist

ESTIMATED TIME: 8 hours (1 day)
PRIORITY: HIGH - Required before production
```

**Dependencies:** Staging must be deployed  
**Parallel Work:** Team collaboration required

---

### TASK 4.3: Production Deployment & Alpha Launch
**Assignee:** DevOps Specialist  
**Effort:** 8 hours (1 day)  
**Dependencies:** Staging validated, all P0 issues fixed

#### Agent Prompt:
```
TASK: Deploy NovaCoreAI to Production and Launch Alpha Program

CONTEXT:
Staging is validated and all critical issues are fixed. You're ready to deploy to production and invite alpha users. This is the final step before launch.

PRODUCTION INFRASTRUCTURE:

1. PRODUCTION DROPLET (Larger than staging)
   - Size: 8 vCPU, 16GB RAM
   - Operating System: Ubuntu 22.04 LTS
   - Region: Same as staging for simplicity
   - Backups: ENABLED

2. MANAGED POSTGRESQL (Production)
   - Plan: Professional ($45/month - HA mode)
   - High availability: Enabled
   - Automated backups: Daily
   - Point-in-time recovery: Enabled

3. MANAGED REDIS (Production)
   - Plan: Professional ($35/month - HA mode)
   - High availability: Enabled
   - Persistence: AOF enabled

4. DOMAIN & SSL
   - Domain: app.novacoreai.com
   - SSL: Let's Encrypt with auto-renewal
   - DNS: Point A record to production IP

DEPLOYMENT PROCESS:

1. PROVISION PRODUCTION INFRASTRUCTURE
   ```bash
   cd infrastructure/terraform/production
   terraform init
   terraform plan
   terraform apply
   
   # Document all credentials securely
   ```

2. CONFIGURE PRODUCTION ENVIRONMENT
   ```bash
   # SSH into production
   ssh root@<production-ip>
   
   # Setup exactly like staging
   # BUT use production secrets (not staging)
   
   # Generate NEW production secrets:
   JWT_SECRET=$(openssl rand -base64 32)
   SERVICE_JWT_SECRET=$(openssl rand -base64 32)
   
   # Use LIVE Stripe keys (not test mode)
   STRIPE_SECRET_KEY=sk_live_xxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

3. DEPLOY SERVICES
   ```bash
   cd /opt/NovaCoreAI
   git pull origin main
   
   # Build production images
   docker-compose -f docker-compose.prod.yml build --no-cache
   
   # Run migrations
   docker-compose -f docker-compose.prod.yml run auth-billing npm run migrate
   
   # Start services
   docker-compose -f docker-compose.prod.yml up -d
   
   # Verify health
   docker-compose -f docker-compose.prod.yml ps
   curl https://app.novacoreai.com/health
   ```

4. CONFIGURE MONITORING ALERTS
   ```bash
   # Update Prometheus alert manager
   # Configure Slack webhook for production alerts
   # Test alert delivery
   
   # Setup external uptime monitoring
   # - UptimeRobot or Pingdom
   # - Monitor: app.novacoreai.com/health
   # - Alert if down for >2 minutes
   ```

5. CONFIGURE STRIPE PRODUCTION WEBHOOKS
   - Log into Stripe dashboard (LIVE mode)
   - Add webhook endpoint: https://app.novacoreai.com/billing/webhook
   - Select events: customer.subscription.*, invoice.*
   - Copy webhook secret to environment
   - Test webhook delivery with Stripe CLI

6. SMOKE TESTING (Critical)
   ```bash
   # Test each critical endpoint
   curl https://app.novacoreai.com/health
   curl https://app.novacoreai.com/api/intelligence/health
   curl https://app.novacoreai.com/api/memory/health
   
   # Test authentication
   # Register test account
   # Login
   # Send chat message
   # Verify everything works
   ```

7. ALPHA USER INVITATION
   - Create alpha user list (10 users)
   - Send invitation emails with:
     * Registration link
     * Alpha program details
     * How to provide feedback
     * Known limitations
     * Support contact
   - Track who registers
   - Monitor their usage
   - Collect feedback

8. MONITORING & ON-CALL SETUP
   - Designate on-call engineer
   - Configure alert routing
   - Document escalation procedures
   - Create incident response plan
   - Schedule check-ins (2x daily for first week)

ROLLBACK PLAN:
Keep staging environment running as fallback:
```bash
# If critical issue found in production:
# 1. Point DNS back to staging
# 2. Investigate issue
# 3. Deploy fix to staging first
# 4. Re-validate
# 5. Deploy to production
```

POST-DEPLOYMENT CHECKLIST:
- [ ] All services healthy
- [ ] Monitoring active and alerting
- [ ] External uptime monitoring configured
- [ ] Stripe webhooks receiving events
- [ ] SSL certificate valid (A+ rating)
- [ ] Database backups running
- [ ] 10 alpha users invited
- [ ] Feedback mechanism working
- [ ] On-call rotation scheduled
- [ ] Incident response plan documented

DOCUMENTATION TO CREATE:
- docs/DEPLOYMENT_PRODUCTION.md
- docs/ROLLBACK_PROCEDURES.md
- docs/INCIDENT_RESPONSE.md
- docs/ON_CALL_RUNBOOK.md

ACCEPTANCE CRITERIA:
- Production deployed successfully
- All smoke tests pass
- Alpha users invited
- Monitoring active
- Team ready for on-call
- Documentation complete

ESTIMATED TIME: 8 hours (1 day)
PRIORITY: CRITICAL - Launch day
```

**Dependencies:** Staging validated, all issues fixed  
**Parallel Work:** No (final deployment)

---

## 📋 PHASE SUMMARY & DEPENDENCIES

### Execution Timeline (14 Days Total)

```
Week 1: Days 1-7
├── Days 1-2: Email Verification (Backend + Frontend)
├── Days 2-4: Integration Tests (Critical Flows)
├── Days 3-4: Gateway Tests
├── Days 5-6: Structured Logging
├── Days 6-7: Metrics Completion
└── Day 7: Observability Validation

Week 2: Days 8-14
├── Day 8: Test Execution & Coverage
├── Day 9: Worker Tests
├── Day 10: CI/CD Automation
├── Days 11-12: Staging Deployment
├── Day 13: E2E Validation on Staging
└── Day 14: Production Deployment & Alpha Launch
```

### Parallel Work Opportunities

**Can Work In Parallel:**
- Email verification (backend + frontend can overlap)
- Integration tests + Gateway tests (different engineers)
- Structured logging + Metrics instrumentation
- Worker tests + Test execution

**Must Be Sequential:**
- All tests → CI/CD setup
- All tests passing → Staging deployment
- Staging validation → Production deployment

### Critical Path
```
Email Verification → Integration Tests → Test Execution → 
Staging Deploy → Validation → Production Deploy → Alpha Launch
```

**Shortest Path to Production:** 14 days (with parallel work)  
**Realistic Timeline:** 14-21 days (accounting for issues)

---

## 🎯 Success Metrics

### Technical Metrics
- ✅ Test coverage ≥70% for core services
- ✅ All P0 integration tests passing
- ✅ Email verification working end-to-end
- ✅ Structured logging operational
- ✅ All metrics instrumented
- ✅ CI/CD running tests on every PR
- ✅ Staging environment stable

### Business Metrics
- ✅ 10 alpha users successfully onboarded
- ✅ Users can register, verify email, and use chat
- ✅ Stripe subscriptions working
- ✅ Quota enforcement preventing abuse
- ✅ Zero critical bugs in production
- ✅ Monitoring catching any issues

### Team Readiness
- ✅ On-call rotation established
- ✅ Runbooks created for common issues
- ✅ Incident response procedures documented
- ✅ Team trained on production environment
- ✅ Rollback procedures tested

---

## 📞 Communication & Coordination

### Daily Standups (15 minutes)
- What I completed yesterday
- What I'm working on today
- Any blockers
- Help needed from other specialists

### Phase Review (End of each phase)
- Review completed tasks
- Verify acceptance criteria met
- Identify any issues or technical debt
- Plan next phase
- Update stakeholders

### Launch Day Coordination
- All hands on deck
- Continuous monitoring
- Rapid response to any issues
- Stakeholder updates every 4 hours

---

## 🚀 Post-Launch Plan (Days 15-30)

### Week 3: Monitoring & Feedback (Days 15-21)
**Goal:** Ensure stability, collect alpha feedback

**Activities:**
- 2x daily check-ins on system health
- Monitor alpha user activity
- Collect feedback via in-app form
- Fix any critical bugs immediately
- Track metrics: uptime, latency, errors
- Adjust quotas if needed

**Deliverables:**
- Alpha feedback report
- Bug fix releases
- Performance optimization (if needed)
- Preliminary user satisfaction score

### Week 4: Beta Preparation (Days 22-30)
**Goal:** Prepare for larger user base

**Activities:**
- Address all alpha feedback
- Performance optimization based on real usage
- Scale infrastructure if needed
- Prepare beta user communications
- Update documentation
- Plan beta launch strategy

**Deliverables:**
- Beta-ready platform
- 50-100 beta invitations prepared
- Scaling plan documented
- Support processes established

---

## 📚 Key Documents Reference

### For Implementation
- **TASK_DELEGATION_PLAN.md** - Original comprehensive plan
- **TECHNICAL_ACTION_PLAN.md** - Code examples and patterns
- **ARCHITECTURAL_IMPROVEMENTS.md** - Best practices
- **TESTING_PROGRESS.md** - Current test status

### For Operations
- **DEPLOYMENT.md** - Deployment procedures
- **OBSERVABILITY_GUIDE.md** - Monitoring and logging
- **API_REFERENCE.md** - API documentation
- **SECRETS_MANAGEMENT.md** - Secret handling

### For Security
- **CYBERSECURITY_COMPLETION_REPORT.md** - Security implementations
- **SERVICE_AUTHENTICATION.md** - Service-to-service auth

---

## ✅ Final Checklist Before Launch

### Code Quality
- [ ] All P0 features implemented
- [ ] Test coverage ≥70% for core services
- [ ] All integration tests passing
- [ ] CI/CD running tests automatically
- [ ] No critical security vulnerabilities
- [ ] Code reviewed and approved

### Security
- [ ] Email verification working
- [ ] Service-to-service auth enforced
- [ ] Rate limiting active
- [ ] Security headers configured
- [ ] SSL certificates valid
- [ ] Secrets properly managed

### Observability
- [ ] Structured logging operational
- [ ] All metrics instrumented
- [ ] Grafana dashboards functional
- [ ] Alerts configured and tested
- [ ] Correlation IDs working
- [ ] Logs searchable

### Operations
- [ ] Staging environment validated
- [ ] Production environment deployed
- [ ] Database backups configured
- [ ] Monitoring active
- [ ] On-call rotation scheduled
- [ ] Runbooks created
- [ ] Incident response plan ready

### Business
- [ ] Alpha users invited (10)
- [ ] Stripe integration working
- [ ] Quota enforcement working
- [ ] Support process established
- [ ] Feedback mechanism working

---

## 🎉 You've Got This!

This plan is laser-focused on what **MUST** be done for production. Everything else is deferred to post-launch. 

**Remember:**
1. **P0 items are non-negotiable** - Email verification, testing, observability
2. **Parallel work maximizes speed** - Multiple engineers, multiple tasks
3. **Staging catches issues** - Don't skip staging validation
4. **Alpha is learning** - Expect issues, collect feedback, iterate
5. **Monitoring is critical** - You can't fix what you can't see

**You're 92% done. Let's finish strong and ship this! 🚀**

---

**Document Status:** Active Implementation Plan  
**Last Updated:** November 10, 2025  
**Next Review:** Daily during implementation  
**Maintained By:** Project Lead & All Specialists

**Questions?** Reach out immediately. Speed matters, but so does quality.

---

**READY TO EXECUTE** ✅
