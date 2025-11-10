# Security Testing Plan

**Document Version:** 1.0  
**Date:** November 9, 2025  
**Prepared By:** Cloud and Cybersecurity Specialist  
**Status:** Active Testing Specification

---

## Executive Summary

This document outlines comprehensive security testing requirements for NovaCoreAI. All security features must pass these tests before deployment to production.

---

## 1. Service-to-Service Authentication Tests

### 1.1 Token Generation Tests

**Test Suite:** `test_service_token_generation`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| STG-001 | Generate token with valid service name | Valid JWT returned with all required claims | P0 |
| STG-002 | Generate token without SERVICE_JWT_SECRET | Error raised, operation fails | P0 |
| STG-003 | Generate token with empty service name | Error raised, validation fails | P0 |
| STG-004 | Generated token includes correct expiration (+24h) | Token expires exactly 24 hours after issuance | P0 |
| STG-005 | Generated token includes unique jti | Each token has unique JWT ID | P0 |
| STG-006 | Generated token includes correct scopes | Scope array matches service permissions | P0 |
| STG-007 | Token uses HS256 algorithm | Header contains "alg": "HS256" | P0 |
| STG-008 | Token includes correct issuer | iss claim is "auth-billing" | P0 |
| STG-009 | Token includes correct audience | aud claim is "novacore-services" | P0 |

**Implementation Reference:**
```python
def test_generate_valid_service_token():
    """Test that service token generation produces valid JWT."""
    token = generate_service_token("intelligence", ["read:memory", "write:memory"])
    
    # Decode token without verification to check structure
    header = jwt.get_unverified_header(token)
    payload = jwt.decode(token, options={"verify_signature": False})
    
    # Assert header
    assert header["alg"] == "HS256"
    assert header["typ"] == "JWT"
    
    # Assert payload
    assert payload["iss"] == "auth-billing"
    assert payload["sub"] == "intelligence"
    assert payload["aud"] == "novacore-services"
    assert "iat" in payload
    assert "exp" in payload
    assert payload["exp"] - payload["iat"] == 86400  # 24 hours
    assert "jti" in payload
    assert len(payload["jti"]) == 36  # UUID format
    assert payload["scope"] == ["read:memory", "write:memory"]
    assert "service_tier" in payload
```

### 1.2 Token Verification Tests

**Test Suite:** `test_service_token_verification`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| STV-001 | Verify valid, non-expired token | Token accepted, payload returned | P0 |
| STV-002 | Verify expired token | 401 Unauthorized error raised | P0 |
| STV-003 | Verify token with invalid signature | 403 Forbidden error raised | P0 |
| STV-004 | Verify token with modified payload | 403 Forbidden error raised | P0 |
| STV-005 | Verify token without signature | 403 Forbidden error raised | P0 |
| STV-006 | Verify token with wrong audience | 403 Forbidden error raised | P0 |
| STV-007 | Verify revoked token (in blacklist) | 403 Forbidden error raised | P0 |
| STV-008 | Verify token without SERVICE_JWT_SECRET | Error raised, verification fails | P0 |
| STV-009 | Verify token with missing required claims | 403 Forbidden error raised | P0 |
| STV-010 | Verify token with future iat (not yet valid) | 403 Forbidden error raised | P1 |

**Implementation Reference:**
```python
def test_reject_expired_token():
    """Test that expired tokens are rejected."""
    # Generate token with expiration in the past
    payload = {
        "iss": "auth-billing",
        "sub": "intelligence",
        "aud": "novacore-services",
        "iat": int(time.time()) - 86400,  # 24 hours ago
        "exp": int(time.time()) - 3600,   # 1 hour ago
        "jti": str(uuid.uuid4()),
        "scope": ["read:memory"],
        "service_tier": "core"
    }
    
    expired_token = jwt.encode(payload, SECRET, algorithm="HS256")
    
    with pytest.raises(HTTPException) as exc_info:
        verify_service_token(expired_token)
    
    assert exc_info.value.status_code == 401
    assert "expired" in str(exc_info.value.detail).lower()

def test_reject_invalid_signature():
    """Test that tokens with invalid signatures are rejected."""
    token = generate_service_token("intelligence", ["read:memory"])
    
    # Tamper with the token by modifying last character
    tampered_token = token[:-1] + ('a' if token[-1] != 'a' else 'b')
    
    with pytest.raises(HTTPException) as exc_info:
        verify_service_token(tampered_token)
    
    assert exc_info.value.status_code == 403
    assert "invalid" in str(exc_info.value.detail).lower()

def test_reject_revoked_token():
    """Test that revoked tokens are rejected."""
    token = generate_service_token("intelligence", ["read:memory"])
    payload = jwt.decode(token, SECRET, algorithms=["HS256"])
    jti = payload["jti"]
    
    # Revoke token
    redis_client.setex(f"revoked_token:{jti}", 86400, "1")
    
    with pytest.raises(HTTPException) as exc_info:
        verify_service_token(token)
    
    assert exc_info.value.status_code == 403
    assert "revoked" in str(exc_info.value.detail).lower()
```

### 1.3 Permission Validation Tests

**Test Suite:** `test_service_permissions`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| SPV-001 | Access resource with matching scope | Access granted | P0 |
| SPV-002 | Access resource without matching scope | 403 Forbidden error | P0 |
| SPV-003 | Write operation with only read scope | 403 Forbidden error | P0 |
| SPV-004 | Admin operation with standard scope | 403 Forbidden error | P0 |
| SPV-005 | Cross-service call with valid permissions | Access granted | P0 |
| SPV-006 | Worker accessing user data | 403 Forbidden error | P0 |
| SPV-007 | Service generating token for another service | 403 Forbidden error | P0 |

**Implementation Reference:**
```python
def test_access_denied_without_required_scope():
    """Test that operations are denied without required scope."""
    # Token with only read scope
    token = generate_service_token("intelligence", ["read:memory"])
    
    # Attempt write operation
    headers = {"X-Service-Token": f"Bearer {token}"}
    response = client.post("/memory/create", json={"content": "test"}, headers=headers)
    
    assert response.status_code == 403
    assert "insufficient permissions" in response.json()["detail"].lower()

def test_worker_cannot_access_user_data():
    """Test that worker services cannot access user authentication data."""
    token = generate_service_token("reflection-worker", ["read:memory", "write:memory"])
    
    headers = {"X-Service-Token": f"Bearer {token}"}
    response = client.get("/users/123", headers=headers)
    
    assert response.status_code == 403
```

### 1.4 Integration Tests

**Test Suite:** `test_service_auth_integration`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| SAI-001 | End-to-end service call with valid token | Request succeeds | P0 |
| SAI-002 | Service call without token | 401 Unauthorized | P0 |
| SAI-003 | Service call with wrong service token | 403 Forbidden | P0 |
| SAI-004 | Token renewal before expiration | New token issued | P0 |
| SAI-005 | Multiple services communicating simultaneously | All succeed | P0 |
| SAI-006 | Service token works across all endpoints | Consistent behavior | P1 |

---

## 2. Stripe Webhook Security Tests

### 2.1 Signature Verification Tests

**Test Suite:** `test_stripe_webhook_verification`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| SWV-001 | Webhook with valid Stripe signature | Request accepted, processed | P0 |
| SWV-002 | Webhook with invalid signature | 400 Bad Request | P0 |
| SWV-003 | Webhook with missing signature header | 400 Bad Request | P0 |
| SWV-004 | Webhook with expired timestamp | 400 Bad Request | P0 |
| SWV-005 | Webhook with tampered payload | 400 Bad Request | P0 |
| SWV-006 | Webhook without STRIPE_WEBHOOK_SECRET | Error raised, processing fails | P0 |

**Implementation Reference:**
```typescript
describe('Stripe Webhook Security', () => {
  it('should accept webhook with valid signature', async () => {
    const payload = { type: 'customer.subscription.created', data: {...} };
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: JSON.stringify(payload),
      secret: STRIPE_WEBHOOK_SECRET,
    });
    
    const response = await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', signature)
      .send(payload);
    
    expect(response.status).toBe(200);
  });

  it('should reject webhook with invalid signature', async () => {
    const payload = { type: 'customer.subscription.created', data: {...} };
    const invalidSignature = 't=123,v1=invalid';
    
    const response = await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', invalidSignature)
      .send(payload);
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('signature');
  });

  it('should reject webhook with tampered payload', async () => {
    const payload = { type: 'customer.subscription.created', data: {...} };
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: JSON.stringify(payload),
      secret: STRIPE_WEBHOOK_SECRET,
    });
    
    // Tamper with payload
    payload.data.amount = 999999;
    
    const response = await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', signature)
      .send(payload);
    
    expect(response.status).toBe(400);
  });
});
```

### 2.2 Replay Attack Tests

**Test Suite:** `test_webhook_replay_protection`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| WRP-001 | Replay same webhook event twice | Second request rejected or idempotent | P0 |
| WRP-002 | Process webhook with duplicate event ID | Idempotent processing | P0 |
| WRP-003 | Old webhook event (>5 minutes) | Rejected as too old | P1 |

**Implementation Reference:**
```typescript
describe('Webhook Replay Protection', () => {
  it('should handle duplicate webhook events idempotently', async () => {
    const eventId = 'evt_test_12345';
    const payload = { id: eventId, type: 'customer.subscription.created', data: {...} };
    
    // First webhook
    const response1 = await sendValidWebhook(payload);
    expect(response1.status).toBe(200);
    
    // Duplicate webhook
    const response2 = await sendValidWebhook(payload);
    expect(response2.status).toBe(200); // Still 200, but no duplicate processing
    
    // Verify subscription only created once
    const subscriptions = await db.subscriptions.findAll({ where: { eventId } });
    expect(subscriptions.length).toBe(1);
  });
});
```

### 2.3 Event Handler Tests

**Test Suite:** `test_webhook_event_handlers`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| WEH-001 | subscription.created event | User tier updated to new tier | P0 |
| WEH-002 | subscription.updated event | User tier updated appropriately | P0 |
| WEH-003 | subscription.deleted event | User downgraded to free_trial | P0 |
| WEH-004 | invoice.payment_succeeded event | Payment recorded, subscription confirmed | P0 |
| WEH-005 | invoice.payment_failed event | Payment failure logged, user notified | P0 |
| WEH-006 | Unknown event type | Logged but doesn't cause error | P1 |

---

## 3. Email Verification Security Tests

### 3.1 Token Generation Tests

**Test Suite:** `test_email_verification_tokens`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| EVT-001 | Generate verification token | 32-byte random token created | P0 |
| EVT-002 | Token uniqueness | Each token is unique (no collisions) | P0 |
| EVT-003 | Token stored with expiration | Token expires after 24 hours | P0 |
| EVT-004 | Token cryptographic quality | Token passes randomness tests | P0 |

**Implementation Reference:**
```typescript
describe('Email Verification Tokens', () => {
  it('should generate 32-byte random token', () => {
    const token = generateVerificationToken();
    
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThanOrEqual(32); // Base64 encoded
    expect(/^[A-Za-z0-9+/=]+$/.test(token)).toBe(true);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set();
    for (let i = 0; i < 1000; i++) {
      tokens.add(generateVerificationToken());
    }
    expect(tokens.size).toBe(1000); // No collisions
  });

  it('should create token with 24-hour expiration', async () => {
    const user = await createUser({ email: 'test@example.com' });
    const token = await createVerificationToken(user.id);
    
    const dbToken = await db.verificationTokens.findOne({ where: { token } });
    expect(dbToken.expiresAt).toBeCloseTo(
      Date.now() + 24 * 60 * 60 * 1000,
      -1000 // within 1 second
    );
  });
});
```

### 3.2 Verification Process Tests

**Test Suite:** `test_email_verification_process`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| EVP-001 | Verify email with valid token | Email marked as verified | P0 |
| EVP-002 | Verify with invalid token | 400 Bad Request error | P0 |
| EVP-003 | Verify with expired token | 400 Bad Request error | P0 |
| EVP-004 | Verify with already-used token | 400 Bad Request error | P0 |
| EVP-005 | Verify same email twice | Second attempt rejected | P0 |
| EVP-006 | Resend verification email | New token generated, old token invalidated | P1 |

### 3.3 Rate Limiting Tests

**Test Suite:** `test_verification_rate_limiting`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| VRL-001 | Send 5 verification requests rapidly | First 3 accepted, rest rate-limited | P0 |
| VRL-002 | Verification attempts after rate limit | 429 Too Many Requests | P0 |
| VRL-003 | Rate limit resets after time period | Requests accepted after cooldown | P0 |

---

## 4. Login Throttling Tests

### 4.1 Failed Login Tracking Tests

**Test Suite:** `test_login_throttling`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| LTH-001 | 5 failed login attempts | 6th attempt blocked with 429 | P0 |
| LTH-002 | Failed attempts tracked per email | Different emails have separate counters | P0 |
| LTH-003 | Successful login resets counter | Failed count reset to 0 | P0 |
| LTH-004 | Block expires after 15 minutes | Can attempt login after cooldown | P0 |
| LTH-005 | Concurrent failed attempts | All tracked correctly | P0 |
| LTH-006 | Response includes retry-after header | Header indicates when to retry | P1 |

**Implementation Reference:**
```typescript
describe('Login Throttling', () => {
  it('should block after 5 failed login attempts', async () => {
    const email = 'test@example.com';
    
    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post('/auth/login')
        .send({ email, password: 'wrong' });
      expect(response.status).toBe(401);
    }
    
    // 6th attempt should be blocked
    const response = await request(app)
      .post('/auth/login')
      .send({ email, password: 'wrong' });
    
    expect(response.status).toBe(429);
    expect(response.body.error).toContain('too many attempts');
    expect(response.headers['retry-after']).toBeDefined();
  });

  it('should reset counter on successful login', async () => {
    const email = 'test@example.com';
    const correctPassword = 'correct123';
    
    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      await request(app)
        .post('/auth/login')
        .send({ email, password: 'wrong' });
    }
    
    // Successful login
    const response = await request(app)
      .post('/auth/login')
      .send({ email, password: correctPassword });
    expect(response.status).toBe(200);
    
    // Should be able to attempt again (counter reset)
    const failResponse = await request(app)
      .post('/auth/login')
      .send({ email, password: 'wrong' });
    expect(failResponse.status).toBe(401); // Not 429
  });
});
```

---

## 5. Security Headers Tests

### 5.1 Header Presence Tests

**Test Suite:** `test_security_headers`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| SHD-001 | Response includes Content-Security-Policy | CSP header present with strict policy | P0 |
| SHD-002 | Response includes X-Frame-Options | Header set to "DENY" | P0 |
| SHD-003 | Response includes X-Content-Type-Options | Header set to "nosniff" | P0 |
| SHD-004 | Response includes Strict-Transport-Security | HSTS header with max-age ≥31536000 | P0 |
| SHD-005 | Response includes X-XSS-Protection | Header set to "1; mode=block" | P0 |
| SHD-006 | Response includes Referrer-Policy | Header set appropriately | P1 |

**Implementation Reference:**
```typescript
describe('Security Headers', () => {
  it('should include all required security headers', async () => {
    const response = await request(app).get('/');
    
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toContain('max-age=');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['referrer-policy']).toBeDefined();
  });

  it('should have strict Content-Security-Policy', async () => {
    const response = await request(app).get('/');
    const csp = response.headers['content-security-policy'];
    
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
```

---

## 6. Input Validation Tests

### 6.1 Message Length Validation Tests

**Test Suite:** `test_input_validation`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| IVL-001 | Message within limit (10,000 chars) | Accepted and processed | P0 |
| IVL-002 | Message exceeding limit (10,001 chars) | 400 Bad Request error | P0 |
| IVL-003 | Empty message | 400 Bad Request error | P0 |
| IVL-004 | Message with only whitespace | 400 Bad Request error | P1 |

### 6.2 XSS Prevention Tests

**Test Suite:** `test_xss_prevention`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| XSS-001 | Message with `<script>` tag | HTML stripped, plain text stored | P0 |
| XSS-002 | Message with event handlers | Event handlers removed | P0 |
| XSS-003 | Message with javascript: URL | URL sanitized or removed | P0 |
| XSS-004 | Message with data: URL | URL sanitized or removed | P0 |
| XSS-005 | Legitimate plain text with symbols | Text preserved exactly | P0 |

**Implementation Reference:**
```python
def test_xss_script_tag_stripped():
    """Test that script tags are stripped from messages."""
    malicious_input = 'Hello <script>alert("XSS")</script> world'
    sanitized = sanitize_user_input(malicious_input)
    
    assert '<script>' not in sanitized
    assert 'alert' not in sanitized
    assert 'Hello' in sanitized
    assert 'world' in sanitized

def test_legitimate_text_preserved():
    """Test that legitimate text is preserved."""
    legitimate_input = 'This is a normal message with punctuation! And numbers: 123.'
    sanitized = sanitize_user_input(legitimate_input)
    
    assert sanitized == legitimate_input
```

### 6.3 Request Size Limit Tests

**Test Suite:** `test_request_size_limits`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| RSL-001 | Request under 10MB | Accepted | P0 |
| RSL-002 | Request exceeding 10MB | 413 Payload Too Large | P0 |
| RSL-003 | Extremely large request (100MB+) | Connection terminated, no processing | P0 |

---

## 7. Password Security Tests

### 7.1 Password Strength Tests

**Test Suite:** `test_password_strength`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| PWD-001 | Password < 8 characters | Rejected with clear error | P0 |
| PWD-002 | Password with only lowercase | Rejected (requires complexity) | P1 |
| PWD-003 | Password with mixed case and numbers | Accepted | P0 |
| PWD-004 | Common password (e.g., "password123") | Rejected using common password list | P1 |
| PWD-005 | Strong password with special chars | Accepted | P0 |

### 7.2 Password Hashing Tests

**Test Suite:** `test_password_hashing`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| PSH-001 | Password hashed with bcrypt | Hash starts with $2b$ | P0 |
| PSH-002 | Same password generates different hashes | Hashes differ (due to salt) | P0 |
| PSH-003 | Hash verification works correctly | Correct password verifies, wrong doesn't | P0 |
| PSH-004 | Hash cost factor ≥ 12 | Adequate computational cost | P0 |

---

## 8. Session Management Tests

### 8.1 JWT Session Token Tests

**Test Suite:** `test_session_tokens`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| SST-001 | User login generates JWT | Valid JWT returned | P0 |
| SST-002 | JWT contains correct user claims | user_id, email present | P0 |
| SST-003 | JWT expires after configured time | Token becomes invalid after expiration | P0 |
| SST-004 | Refresh token generates new JWT | New JWT with extended expiration | P0 |
| SST-005 | Logout invalidates refresh token | Token cannot be used after logout | P0 |

### 8.2 Session Hijacking Prevention Tests

**Test Suite:** `test_session_security`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| SSH-001 | Token includes fingerprint/binding | Token tied to client characteristics | P1 |
| SSH-002 | Token cannot be used from different IP (optional) | Optionally enforce IP binding | P2 |
| SSH-003 | Multiple concurrent sessions allowed | Users can have multiple devices | P1 |

---

## 9. API Rate Limiting Tests

### 9.1 Rate Limit Enforcement Tests

**Test Suite:** `test_rate_limiting`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| RLE-001 | Requests within limit | All accepted | P0 |
| RLE-002 | Requests exceeding limit | 429 Too Many Requests | P0 |
| RLE-003 | Rate limit includes retry-after header | Header indicates cooldown period | P0 |
| RLE-004 | Rate limit resets after window | Requests accepted after reset | P0 |
| RLE-005 | Different endpoints have different limits | Limits enforced independently | P1 |

---

## 10. CORS Security Tests

### 10.1 CORS Configuration Tests

**Test Suite:** `test_cors_security`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| CRS-001 | Allowed origin can make requests | CORS headers permit request | P0 |
| CRS-002 | Disallowed origin blocked | CORS error, no response data | P0 |
| CRS-003 | Credentials included only for allowed origins | credentials: true only for trusted | P0 |
| CRS-004 | Wildcard (*) not used in production | Specific origins configured | P0 |

---

## 11. SQL Injection Prevention Tests

### 11.1 Parameterized Query Tests

**Test Suite:** `test_sql_injection_prevention`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| SQL-001 | Input with SQL syntax in search | Treated as literal string, not executed | P0 |
| SQL-002 | Input with ' OR '1'='1 | Not interpreted as SQL | P0 |
| SQL-003 | Input with ; DROP TABLE | Not executed, treated as data | P0 |
| SQL-004 | All database operations use parameterized queries | No string concatenation for SQL | P0 |

**Implementation Reference:**
```python
def test_sql_injection_in_search():
    """Test that SQL injection attempts are neutralized."""
    malicious_query = "test' OR '1'='1"
    
    # Should return 0 results, not all results
    results = search_memories(user_id=123, query=malicious_query)
    
    # Verify it searched for the literal string, not executed SQL
    assert len(results) == 0 or all('test' in r.content.lower() for r in results)
```

---

## 12. Error Handling Security Tests

### 12.1 Information Disclosure Tests

**Test Suite:** `test_error_handling_security`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| ERR-001 | Server error doesn't expose stack trace | Generic error message returned | P0 |
| ERR-002 | Database error doesn't expose schema | No table/column names in response | P0 |
| ERR-003 | Authentication error doesn't reveal user existence | Generic "invalid credentials" message | P0 |
| ERR-004 | Detailed errors logged server-side | Full details in server logs only | P0 |

---

## 13. Dependency Security Tests

### 13.1 Vulnerability Scanning Tests

**Test Suite:** `test_dependency_security`

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|----------------|----------|
| DEP-001 | Run npm audit (Node.js services) | No high/critical vulnerabilities | P0 |
| DEP-002 | Run pip-audit (Python services) | No high/critical vulnerabilities | P0 |
| DEP-003 | Check for outdated dependencies | Document upgrade plan for outdated packages | P1 |
| DEP-004 | Verify lockfiles committed | package-lock.json, requirements.txt present | P0 |

---

## 14. Security Test Execution Plan

### 14.1 Test Execution Schedule

**Phase 1: Unit Tests (Daily)**
- Run all security unit tests in CI/CD pipeline
- Block PR merge if security tests fail
- Coverage requirement: 100% for security-critical code

**Phase 2: Integration Tests (Per PR)**
- Run integration tests before merging to develop
- Test service-to-service authentication
- Test webhook verification

**Phase 3: Security Audit (Weekly)**
- Manual security review of new code
- Dependency vulnerability scanning
- Review security logs for anomalies

**Phase 4: Penetration Testing (Monthly)**
- Automated OWASP ZAP scans
- Manual penetration testing
- Third-party security audit (quarterly)

### 14.2 Test Environment Setup

**Requirements:**
- Separate test database (isolated from production)
- Test Redis instance
- Mock Stripe webhook endpoints
- Test environment variables

**Configuration:**
```bash
# Test environment
TEST_SERVICE_JWT_SECRET=test_secret_32_chars_minimum
TEST_STRIPE_WEBHOOK_SECRET=whsec_test_secret
TEST_REDIS_URL=redis://localhost:6379/1
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/novacore_test
```

### 14.3 Continuous Security Testing

**GitHub Actions Workflow:**
```yaml
name: Security Tests

on: [push, pull_request]

jobs:
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Security Unit Tests
        run: |
          pytest tests/security/ -v --cov=services --cov-report=term-missing
          npm test -- --testPathPattern=security
      
      - name: Dependency Security Scan
        run: |
          npm audit --audit-level=high
          pip-audit --strict
      
      - name: SAST Scan
        run: |
          bandit -r services/ -ll
          semgrep --config=auto
      
      - name: Secret Detection
        uses: trufflesecurity/trufflehog@main
```

---

## 15. Test Coverage Requirements

### 15.1 Minimum Coverage Thresholds

**Security-Critical Code:** 100% coverage required
- Authentication and authorization
- Token generation and verification
- Input validation and sanitization
- Password hashing

**High-Risk Code:** 90% coverage required
- Payment processing
- User data handling
- Service-to-service communication

**Standard Code:** 70% coverage required
- Business logic
- Data transformations
- UI components

### 15.2 Coverage Reporting

**Tools:**
- Python: pytest-cov
- Node.js: Jest coverage
- Report format: HTML, lcov, JSON

**CI Integration:**
- Coverage reports uploaded to Codecov
- PR comments show coverage changes
- Block merge if coverage decreases

---

## 16. Acceptance Criteria

### 16.1 P0 Tests (Must Pass)

All P0 tests must pass before production deployment:
- ✅ All service authentication tests passing
- ✅ All Stripe webhook security tests passing
- ✅ All login throttling tests passing
- ✅ All security headers tests passing
- ✅ All input validation tests passing
- ✅ All XSS prevention tests passing
- ✅ No high/critical security vulnerabilities in dependencies

### 16.2 P1 Tests (Should Pass)

P1 tests should pass before alpha launch:
- ✅ All email verification tests passing
- ✅ All rate limiting tests passing
- ✅ All password strength tests passing
- ✅ Coverage thresholds met

### 16.3 P2 Tests (Nice to Have)

P2 tests for enhanced security posture:
- ⚪ Session binding tests
- ⚪ Advanced threat detection
- ⚪ Behavioral analysis

---

## 17. Documentation and Reporting

### 17.1 Test Documentation

Each test must include:
- Clear description of what is being tested
- Expected behavior
- Actual behavior observed
- Security implications if test fails

### 17.2 Security Test Reports

**Weekly Report Template:**
```markdown
# Security Testing Report - Week [X]

## Test Execution Summary
- Tests Run: [count]
- Tests Passed: [count]
- Tests Failed: [count]
- Coverage: [percentage]

## New Vulnerabilities Discovered
1. [Vulnerability description, severity, status]

## Remediation Status
1. [Issue] - [Status] - [Owner] - [Due Date]

## Recommendations
- [Action items for next week]
```

---

## 18. Conclusion

This security testing plan ensures comprehensive coverage of all security features in NovaCoreAI. All tests must be automated and integrated into the CI/CD pipeline to provide continuous security validation.

**Key Principles:**
1. **Defense in Depth:** Multiple layers of security testing
2. **Shift Left:** Test security early and often
3. **Automation:** Automated tests catch regressions
4. **Continuous Improvement:** Regular security reviews and updates

---

**Document Status:** ACTIVE - Ready for Implementation  
**Last Updated:** November 9, 2025  
**Next Review:** December 9, 2025

**For Questions:** Contact Cloud and Cybersecurity Specialist

---

**END OF SECURITY TESTING PLAN**
