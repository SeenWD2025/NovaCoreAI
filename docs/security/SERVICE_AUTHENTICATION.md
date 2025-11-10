# Service-to-Service Authentication Specification

**Document Version:** 1.0  
**Date:** November 9, 2025  
**Prepared By:** Cloud and Cybersecurity Specialist  
**Status:** Active Security Specification

---

## Executive Summary

This document specifies the service-to-service (S2S) authentication mechanism for NovaCoreAI. All inter-service communication must be authenticated using JWT tokens to prevent unauthorized access and service impersonation attacks.

### Security Context

**Current Vulnerability:** Services trust network-level isolation without cryptographic verification. Any compromised service can impersonate users by setting X-User-Id headers.

**CVSS Score:** 7.5 (HIGH)  
**Risk:** Horizontal privilege escalation, data breach, service impersonation

---

## 1. JWT Token Specification

### 1.1 Token Structure

Service authentication tokens are JWT (JSON Web Tokens) with the following structure:

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "iss": "auth-billing",           // Issuer: Always the auth-billing service
    "sub": "intelligence",            // Subject: The service this token is for
    "aud": "novacore-services",       // Audience: All NovaCoreAI services
    "iat": 1699564800,                // Issued at (Unix timestamp)
    "exp": 1699651200,                // Expiration (Unix timestamp, +24 hours)
    "jti": "unique-token-id",         // JWT ID: Unique identifier for this token
    "scope": ["read:memory", "write:memory", "read:policy"],  // Permissions
    "service_tier": "core"            // Service tier: core, worker, admin
  }
}
```

### 1.2 Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `iss` | string | Yes | Token issuer (always "auth-billing") |
| `sub` | string | Yes | Service name receiving the token |
| `aud` | string | Yes | Target audience (always "novacore-services") |
| `iat` | number | Yes | Token issued timestamp (Unix epoch) |
| `exp` | number | Yes | Token expiration timestamp (Unix epoch) |
| `jti` | string | Yes | Unique token identifier (UUID v4) |
| `scope` | array | Yes | Array of permission strings |
| `service_tier` | string | Yes | Service tier classification |

### 1.3 Signature Algorithm

- **Algorithm:** HMAC-SHA256 (HS256)
- **Key Size:** 256 bits minimum (32 bytes)
- **Key Source:** Environment variable `SERVICE_JWT_SECRET`
- **Key Format:** Base64-encoded string

**Rationale:** HS256 chosen for simplicity in shared-secret scenarios. All services share the same secret, reducing key distribution complexity while maintaining strong cryptographic security.

**Alternative:** For enhanced security in multi-tenant or zero-trust environments, consider RS256 (RSA asymmetric signatures) where the auth-billing service holds the private key and other services only need the public key.

---

## 2. Key Management Strategy

### 2.1 Shared Secret Approach

**Implementation:** Single shared secret (`SERVICE_JWT_SECRET`) distributed to all services.

**Advantages:**
- Simple implementation
- No public key infrastructure (PKI) required
- Fast token verification
- Suitable for trusted internal network

**Security Requirements:**
1. Generate secret using cryptographically secure random number generator
2. Minimum 256-bit (32-byte) entropy
3. Store in secure environment variables, never in code
4. Rotate every 90 days or upon suspected compromise
5. Never log or expose in error messages

### 2.2 Secret Generation

```bash
# Generate a secure 256-bit secret
openssl rand -base64 32
```

Example output: `Xz8K3mP9vQwR7sT2uY6jL4nF1hG8cB5eW0xA9dV3kM=`

### 2.3 Secret Distribution

**Production:**
- Store in DigitalOcean secrets manager or HashiCorp Vault
- Inject as environment variable at container startup
- Never commit to version control

**Development:**
- Store in `.env` file (git-ignored)
- Use separate secret from production
- Document in `env.example` with placeholder

### 2.4 Secret Rotation Policy

**Scheduled Rotation:** Every 90 days

**Emergency Rotation:** Immediately upon:
- Suspected secret compromise
- Employee departure with access
- Security incident
- Failed security audit

**Rotation Process:**
1. Generate new secret
2. Update secret in secrets manager
3. Deploy to all services with blue-green deployment
4. Verify all services using new secret
5. Revoke old secret after 24-hour grace period
6. Document rotation in security log

---

## 3. Token Lifecycle Management

### 3.1 Token Expiration

**Validity Period:** 24 hours from issuance

**Rationale:**
- Balances security (short-lived) with performance (reduces token renewal frequency)
- Automatic expiration limits damage window if token is compromised
- Forces periodic re-authentication and permission re-verification

### 3.2 Token Renewal

**Strategy:** Automatic renewal before expiration

**Process:**
1. Service detects token expiring within 1 hour
2. Calls `POST /auth/service/refresh` endpoint
3. Receives new token with fresh 24-hour validity
4. Replaces old token in memory
5. Old token remains valid until expiration

**Endpoint:** `POST /auth/service/refresh`

**Request:**
```json
{
  "service_name": "intelligence",
  "current_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2025-11-10T23:55:00Z"
}
```

### 3.3 Token Revocation

**Mechanism:** JWT IDs (`jti`) blacklist stored in Redis

**Use Cases:**
- Emergency revocation of compromised token
- Service decommissioning
- Permission changes requiring immediate effect

**Implementation:**
```python
# Add token to blacklist
redis.setex(f"revoked_token:{jti}", 86400, "1")

# Check if token is revoked
if redis.exists(f"revoked_token:{jti}"):
    raise TokenRevokedException()
```

**TTL:** Match token expiration (24 hours) to avoid memory bloat

---

## 4. Service Permission Matrix

### 4.1 Service Roles

| Service | Tier | Description |
|---------|------|-------------|
| **auth-billing** | admin | Authentication authority, can generate tokens |
| **gateway** | core | Entry point, routes requests, enforces auth |
| **intelligence** | core | Chat/AI processing, requires broad access |
| **memory** | core | Memory storage and retrieval |
| **noble-spirit** | core | Policy validation and alignment checking |
| **ngs-curriculum** | core | Curriculum and progression management |
| **reflection-worker** | worker | Async reflection processing |
| **distillation-worker** | worker | Async memory distillation |

### 4.2 Permission Scopes

Format: `<action>:<resource>[:<modifier>]`

**Actions:**
- `read` - Retrieve data (GET requests)
- `write` - Create/update data (POST/PUT/PATCH requests)
- `delete` - Remove data (DELETE requests)
- `admin` - Administrative operations

**Resources:**
- `memory` - Memory service operations
- `policy` - Policy service operations
- `intelligence` - AI chat operations
- `curriculum` - NGS curriculum operations
- `user` - User data operations
- `billing` - Billing operations

**Examples:**
- `read:memory` - Can retrieve memories
- `write:memory` - Can create/update memories
- `delete:memory:own` - Can delete only own memories
- `admin:user` - Can perform admin operations on users

### 4.3 Service-to-Service Permission Matrix

| Calling Service | Target Service | Allowed Scopes |
|----------------|----------------|----------------|
| **gateway** | intelligence | `read:intelligence`, `write:intelligence` |
| **gateway** | memory | `read:memory`, `write:memory` |
| **gateway** | policy | `read:policy` |
| **gateway** | curriculum | `read:curriculum`, `write:curriculum` |
| **gateway** | billing | `read:billing`, `write:billing` |
| **intelligence** | memory | `read:memory`, `write:memory` |
| **intelligence** | policy | `read:policy` |
| **intelligence** | curriculum | `read:curriculum` |
| **memory** | policy | `read:policy` (for validation) |
| **reflection-worker** | intelligence | `write:intelligence:reflection` |
| **reflection-worker** | memory | `read:memory`, `write:memory` |
| **distillation-worker** | memory | `read:memory`, `write:memory`, `delete:memory:expired` |
| **distillation-worker** | intelligence | `read:intelligence` |

### 4.4 Denied Operations

The following operations are **explicitly forbidden** via service tokens:

1. **Workers cannot access user authentication:**
   - No `read:user` or `write:user` for workers
   - Prevents worker compromise from accessing user credentials

2. **No service can generate new service tokens except auth-billing:**
   - Only `auth-billing` can issue service tokens
   - Prevents token forgery attacks

3. **No service can modify billing except through proper endpoints:**
   - Prevents fraudulent subscription changes
   - Billing modifications require user session tokens

4. **Cross-environment access forbidden:**
   - Production tokens invalid in staging/development
   - Environment identifier in `aud` claim

---

## 5. Token Generation Process

### 5.1 Service Token Generation (Auth-Billing Service)

**Location:** `services/auth-billing/src/auth/service-auth.service.ts`

**Method:** `generateServiceToken(serviceName: string, scopes: string[])`

**Implementation Reference:**
```typescript
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

generateServiceToken(serviceName: string, scopes: string[]): string {
  const payload = {
    iss: 'auth-billing',
    sub: serviceName,
    aud: 'novacore-services',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // +24 hours
    jti: uuidv4(),
    scope: scopes,
    service_tier: this.getServiceTier(serviceName)
  };

  const secret = process.env.SERVICE_JWT_SECRET;
  if (!secret) {
    throw new Error('SERVICE_JWT_SECRET not configured');
  }

  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}
```

### 5.2 Token Verification Process

**Common Implementation (All Services):**

**Python Services (FastAPI):**
```python
import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer

security = HTTPBearer()

def verify_service_token(token: str = Security(security)) -> dict:
    """Verify service JWT token and return decoded payload."""
    try:
        secret = os.getenv('SERVICE_JWT_SECRET')
        if not secret:
            raise ValueError('SERVICE_JWT_SECRET not configured')
        
        # Verify and decode token
        payload = jwt.decode(
            token.credentials,
            secret,
            algorithms=['HS256'],
            audience='novacore-services'
        )
        
        # Check if token is revoked
        jti = payload.get('jti')
        if redis_client.exists(f'revoked_token:{jti}'):
            raise HTTPException(403, 'Token has been revoked')
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, 'Service token has expired')
    except jwt.InvalidTokenError as e:
        raise HTTPException(403, f'Invalid service token: {str(e)}')
```

**Node.js Services (NestJS/Express):**
```typescript
import * as jwt from 'jsonwebtoken';

verifyServiceToken(token: string): ServiceTokenPayload {
  try {
    const secret = process.env.SERVICE_JWT_SECRET;
    if (!secret) {
      throw new Error('SERVICE_JWT_SECRET not configured');
    }

    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      audience: 'novacore-services'
    }) as ServiceTokenPayload;

    // Check revocation
    const isRevoked = await redis.exists(`revoked_token:${payload.jti}`);
    if (isRevoked) {
      throw new Error('Token has been revoked');
    }

    return payload;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedException('Service token has expired');
    }
    throw new ForbiddenException('Invalid service token');
  }
}
```

### 5.3 Request Header Format

**Header Name:** `X-Service-Token`

**Format:** `Bearer <token>`

**Example:**
```
X-Service-Token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhdXRoLWJpbGxpbmciLCJzdWIiOiJpbnRlbGxpZ2VuY2UiLCJhdWQiOiJub3ZhY29yZS1zZXJ2aWNlcyIsImlhdCI6MTY5OTU2NDgwMCwiZXhwIjoxNjk5NjUxMjAwLCJqdGkiOiI1NWUxYmE3YS1hMzJiLTRkZjYtOGE0NC1lNWYwYjE1YzgxYjIiLCJzY29wZSI6WyJyZWFkOm1lbW9yeSIsIndyaXRlOm1lbW9yeSJdLCJzZXJ2aWNlX3RpZXIiOiJjb3JlIn0.XYZ...
```

---

## 6. Security Best Practices

### 6.1 Token Storage

**DO:**
- ✅ Store tokens in memory only
- ✅ Clear tokens on service restart
- ✅ Encrypt tokens if persisted (not recommended)
- ✅ Use secure environment variables for secrets

**DON'T:**
- ❌ Store tokens in databases
- ❌ Log tokens in application logs
- ❌ Include tokens in error messages
- ❌ Transmit tokens over unencrypted connections

### 6.2 Token Validation

**DO:**
- ✅ Validate signature on every request
- ✅ Check expiration timestamp
- ✅ Verify audience claim
- ✅ Check token revocation status
- ✅ Validate permission scopes before allowing operation

**DON'T:**
- ❌ Trust tokens without signature verification
- ❌ Accept expired tokens
- ❌ Skip scope validation
- ❌ Cache validation results longer than 1 minute

### 6.3 Error Handling

**DO:**
- ✅ Return generic "Forbidden" or "Unauthorized" errors
- ✅ Log detailed errors server-side for debugging
- ✅ Include correlation IDs for tracing
- ✅ Monitor authentication failure rates

**DON'T:**
- ❌ Expose token validation details in responses
- ❌ Reveal which validation step failed
- ❌ Include token contents in error messages
- ❌ Provide timing-based attack vectors

### 6.4 Performance Considerations

**Optimization Strategies:**
1. **Cache decoded tokens:** Cache for up to 60 seconds (max)
2. **Async validation:** Don't block request processing
3. **Connection pooling:** Reuse Redis connections for revocation checks
4. **Bulk verification:** Batch verify multiple tokens when possible

**Avoid:**
- Synchronous Redis calls in hot paths
- Repeated decoding of the same token
- Excessive logging of token operations

---

## 7. Monitoring and Alerting

### 7.1 Metrics to Track

**Token Generation:**
- `service_tokens_generated_total` (counter by service)
- `service_tokens_renewed_total` (counter by service)
- `service_token_generation_errors_total` (counter)

**Token Verification:**
- `service_auth_requests_total` (counter by service, status)
- `service_auth_failures_total` (counter by reason)
- `service_token_expired_total` (counter)
- `service_token_invalid_total` (counter)
- `service_token_revoked_total` (counter)

**Performance:**
- `service_token_verification_duration_seconds` (histogram)
- `service_token_generation_duration_seconds` (histogram)

### 7.2 Alert Conditions

**Critical Alerts:**
- Token verification failure rate >5% for 5 minutes
- More than 10 token revocations in 1 hour
- SERVICE_JWT_SECRET not configured on any service
- Token generation failures >10 in 1 minute

**Warning Alerts:**
- Token verification failure rate >1% for 10 minutes
- Token expiration rate increases by >50% (may indicate time sync issues)
- Token renewal failures >5 in 5 minutes

### 7.3 Audit Logging

**Log All:**
- Token generation (service name, scopes, timestamp)
- Token revocation (jti, reason, timestamp)
- Authentication failures (service, reason, timestamp)
- Permission denials (service, requested scope, timestamp)

**Log Format (JSON):**
```json
{
  "timestamp": "2025-11-09T23:55:00Z",
  "level": "WARN",
  "event": "service_auth_failure",
  "service": "intelligence",
  "reason": "token_expired",
  "token_jti": "55e1ba7a-a32b-4df6-8a44-e5f0b15c81b2",
  "correlation_id": "req-123456"
}
```

---

## 8. Incident Response

### 8.1 Token Compromise Response

**If a service token is compromised:**

1. **Immediate Actions (0-15 minutes):**
   - Revoke compromised token via jti blacklist
   - Rotate SERVICE_JWT_SECRET immediately
   - Generate new tokens for all services
   - Monitor for unauthorized access attempts

2. **Investigation (15-60 minutes):**
   - Identify scope of compromise (how many tokens affected)
   - Review audit logs for unauthorized actions
   - Determine attack vector
   - Assess data exposure

3. **Remediation (1-24 hours):**
   - Deploy updated services with new secrets
   - Verify all services using new tokens
   - Document incident in security log
   - Notify stakeholders if data was accessed

4. **Post-Incident (1-7 days):**
   - Conduct root cause analysis
   - Update security procedures to prevent recurrence
   - Security training for team
   - Review and strengthen access controls

### 8.2 High Authentication Failure Rate

**If authentication failures spike:**

1. **Triage:**
   - Check if SERVICE_JWT_SECRET mismatch between services
   - Verify system clock synchronization (JWT exp/iat validation)
   - Review recent deployments or configuration changes

2. **Resolution:**
   - Synchronize secrets across all services if mismatch detected
   - Restart services with corrected configuration
   - Increase token renewal grace period if needed

3. **Prevention:**
   - Implement secret sync verification in CI/CD
   - Add health checks for service authentication
   - Document secret update procedures

---

## 9. Testing Requirements

### 9.1 Unit Tests

**Test Coverage Required:**

1. **Token Generation:**
   - ✅ Generates valid JWT with correct claims
   - ✅ Includes all required fields (iss, sub, aud, iat, exp, jti, scope)
   - ✅ Sets expiration to +24 hours
   - ✅ Uses correct service tier
   - ✅ Throws error if SERVICE_JWT_SECRET not configured

2. **Token Verification:**
   - ✅ Accepts valid, non-expired token
   - ✅ Rejects expired token
   - ✅ Rejects token with invalid signature
   - ✅ Rejects token with wrong audience
   - ✅ Rejects revoked token (via jti blacklist)
   - ✅ Rejects token with missing required claims

3. **Permission Validation:**
   - ✅ Allows operation when scope matches
   - ✅ Denies operation when scope missing
   - ✅ Correctly parses scope array
   - ✅ Handles wildcard scopes if implemented

### 9.2 Integration Tests

**Test Scenarios:**

1. **Service-to-Service Communication:**
   - ✅ Service A can call Service B with valid token
   - ✅ Service A cannot call Service B without token
   - ✅ Service A cannot call Service B with invalid token
   - ✅ Service A cannot perform operation outside its scopes

2. **Token Renewal:**
   - ✅ Service can renew token before expiration
   - ✅ Old token remains valid until expiration
   - ✅ Renewed token has fresh 24-hour validity

3. **Token Revocation:**
   - ✅ Revoked token is immediately rejected
   - ✅ Revocation persists across service restarts
   - ✅ Revocation record expires after token expiration

### 9.3 Security Tests

**Penetration Testing:**

1. **Token Tampering:**
   - ❌ Modified payload rejected
   - ❌ Modified signature rejected
   - ❌ Replay of old token after revocation rejected

2. **Privilege Escalation:**
   - ❌ Service cannot escalate its own permissions
   - ❌ Service cannot generate tokens for other services
   - ❌ Service cannot access resources outside its scopes

3. **Timing Attacks:**
   - ❌ Token verification timing doesn't leak information
   - ❌ Constant-time comparison used for secrets

---

## 10. Migration and Rollout Plan

### 10.1 Phase 1: Preparation (Day 1)

- [ ] Generate SERVICE_JWT_SECRET for all environments
- [ ] Update all service environment configurations
- [ ] Deploy token generation capability to auth-billing service
- [ ] Create token verification shared modules

### 10.2 Phase 2: Soft Launch (Day 2)

- [ ] Deploy token verification to all services (log-only mode)
- [ ] Services accept requests with or without tokens
- [ ] Log authentication results for monitoring
- [ ] Verify no performance impact

### 10.3 Phase 3: Token Distribution (Day 3)

- [ ] Start issuing tokens to all services
- [ ] Services begin including tokens in outbound requests
- [ ] Monitor token usage and renewal
- [ ] Address any integration issues

### 10.4 Phase 4: Enforcement (Day 4-5)

- [ ] Enable token requirement enforcement
- [ ] Reject requests without valid tokens
- [ ] Monitor for service disruptions
- [ ] Have rollback plan ready

### 10.5 Phase 5: Validation (Day 6-7)

- [ ] Run full integration test suite
- [ ] Verify all service-to-service calls authenticated
- [ ] Conduct security audit
- [ ] Document any exceptions or issues

---

## 11. References

### 11.1 Standards and Specifications

- [RFC 7519: JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)
- [RFC 7515: JSON Web Signature (JWS)](https://tools.ietf.org/html/rfc7515)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)

### 11.2 Related Documentation

- [SECURITY_HEADERS.md](./SECURITY_HEADERS.md) - HTTP security headers
- [INPUT_VALIDATION.md](./INPUT_VALIDATION.md) - Input validation standards
- [WEBHOOK_SECURITY.md](./WEBHOOK_SECURITY.md) - Webhook security guidelines

### 11.3 Implementation Files

- `services/auth-billing/src/auth/service-auth.service.ts` - Token generation
- `shared/python/service_auth.py` - Python verification module
- `services/gateway/src/middleware/service-auth.ts` - Gateway middleware

---

## 12. Approval and Sign-off

**Document Prepared By:** Cloud and Cybersecurity Specialist  
**Date:** November 9, 2025

**Review Required By:**
- [ ] Full-Stack Specialist (Implementation feasibility)
- [ ] DevOps Specialist (Deployment strategy)
- [ ] Project Lead (Business requirements)

**Security Approval:** ✅ Approved by Cloud and Cybersecurity Specialist

---

**Document Status:** ACTIVE - Ready for Implementation  
**Last Updated:** November 9, 2025  
**Next Review:** December 9, 2025 (30-day review cycle)

**For Questions:** Contact Cloud and Cybersecurity Specialist or post in `#novacore-dev`

---

**END OF SERVICE AUTHENTICATION SPECIFICATION**
