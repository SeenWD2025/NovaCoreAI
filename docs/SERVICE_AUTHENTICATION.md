# Service-to-Service Authentication Guide

**Document Version:** 1.0  
**Date:** November 9, 2025  
**Prepared By:** DevOps Architect - Noble Growth Collective

## Overview

This document describes the service-to-service authentication mechanism implemented in NovaCoreAI to prevent unauthorized inter-service communication and ensure cryptographic verification of service identities.

## Security Context

**Problem:** Services previously trusted network-level isolation without cryptographic verification. Any compromised service could impersonate users by setting X-User-Id headers.

**Risk Level:** HIGH SEVERITY (CVSS 7.5)

**Solution:** JWT-based service authentication with cryptographic token verification.

## Architecture

### Components

1. **Service JWT Tokens**: Cryptographically signed tokens that identify services
2. **Token Generation**: Auth-Billing service generates tokens for authorized services
3. **Token Verification**: Gateway and services verify tokens on every request
4. **Token Rotation**: Automatic 24-hour expiration with renewal mechanism

### Token Flow

```
┌─────────────┐                    ┌──────────────┐
│   Service   │  1. Request Token  │ Auth-Billing │
│     A       │───────────────────>│   Service    │
└─────────────┘                    └──────────────┘
      │                                    │
      │         2. Return JWT Token        │
      │<───────────────────────────────────┘
      │
      │                            ┌─────────────┐
      │  3. Request + X-Service-   │   Gateway   │
      │     Token Header           │             │
      │───────────────────────────>│             │
      │                            └─────────────┘
      │                                    │
      │                            4. Verify Token
      │                                    │
      │                            ┌─────────────┐
      │  5. Forward Request        │  Service B  │
      │───────────────────────────>│             │
      └────────────────────────────┴─────────────┘
```

## Configuration

### Environment Variables

Add the following environment variable to all services:

```bash
# Service-to-Service Authentication
# Generate with: openssl rand -base64 32
SERVICE_JWT_SECRET=your-service-jwt-secret-change-in-production
SERVICE_TOKEN_EXPIRES_IN=24h
```

### Secret Generation

Generate a strong 256-bit secret for production:

```bash
openssl rand -base64 32
```

**Important:** Use a different secret for each environment (development, staging, production).

### Docker Compose Configuration

The `SERVICE_JWT_SECRET` environment variable is already configured in:
- `docker-compose.yml` (development)
- `docker-compose.prod.yml` (production)

All services have access to this secret for token generation and verification.

## Token Format

### Token Payload

```json
{
  "sub": "service-name",
  "iss": "novacore-auth",
  "aud": "novacore-services",
  "iat": 1699564800,
  "exp": 1699651200,
  "permissions": [
    "memory:read",
    "memory:write",
    "policy:validate"
  ]
}
```

### Token Claims

- **sub** (Subject): The name of the service (e.g., "intelligence", "gateway")
- **iss** (Issuer): Always "novacore-auth"
- **aud** (Audience): Always "novacore-services"
- **iat** (Issued At): Unix timestamp when token was generated
- **exp** (Expiration): Unix timestamp when token expires (24 hours from iat)
- **permissions**: Array of permission strings for this service

## Service Permission Matrix

| Service           | Allowed Endpoints                    | Permissions                           |
|-------------------|--------------------------------------|---------------------------------------|
| Gateway           | All endpoints                        | All permissions (proxy role)          |
| Intelligence      | memory:*, policy:validate            | memory:read, memory:write, policy:*   |
| Memory            | -                                    | None (data service)                   |
| Noble-Spirit      | -                                    | None (policy service)                 |
| Reflection Worker | memory:*, policy:*                   | memory:read, memory:write, policy:*   |
| Distillation      | memory:*, policy:*                   | memory:read, memory:write, policy:*   |
| NGS Curriculum    | memory:read                          | memory:read                           |
| MCP Server        | intelligence:*, memory:read          | intelligence:*, memory:read           |

## Implementation Guidelines

### For Python Services

Services will use a shared module for token verification:

```python
# shared/python/service_auth.py
from fastapi import Depends, HTTPException, Header
import jwt
import os

SERVICE_JWT_SECRET = os.getenv("SERVICE_JWT_SECRET")

def verify_service_token(x_service_token: str = Header(...)):
    """Dependency injection for service token verification"""
    try:
        payload = jwt.decode(
            x_service_token,
            SERVICE_JWT_SECRET,
            algorithms=["HS256"],
            audience="novacore-services",
            issuer="novacore-auth"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=403, detail="Service token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="Invalid service token")

# Usage in endpoints
@app.post("/api/memory/store")
async def store_memory(
    data: MemoryData,
    service_auth: dict = Depends(verify_service_token)
):
    # service_auth contains the decoded token payload
    service_name = service_auth.get("sub")
    # ... implementation
```

### For Node.js Services

Services will use a middleware for token verification:

```typescript
// services/gateway/src/middleware/service-auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const SERVICE_JWT_SECRET = process.env.SERVICE_JWT_SECRET!;

export function verifyServiceToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-service-token'] as string;
  
  if (!token) {
    return res.status(403).json({ error: 'Service token required' });
  }
  
  try {
    const payload = jwt.verify(token, SERVICE_JWT_SECRET, {
      audience: 'novacore-services',
      issuer: 'novacore-auth'
    });
    
    req.serviceAuth = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(403).json({ error: 'Service token expired' });
    }
    return res.status(403).json({ error: 'Invalid service token' });
  }
}

// Usage in routes
router.post('/api/memory/store', verifyServiceToken, async (req, res) => {
  const serviceName = req.serviceAuth.sub;
  // ... implementation
});
```

### For Go Services

Services will use a middleware for token verification:

```go
// middleware/service_auth.go
package middleware

import (
    "fmt"
    "net/http"
    "os"
    "strings"
    
    "github.com/golang-jwt/jwt/v5"
)

func VerifyServiceToken(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        tokenString := r.Header.Get("X-Service-Token")
        if tokenString == "" {
            http.Error(w, "Service token required", http.StatusForbidden)
            return
        }
        
        secret := []byte(os.Getenv("SERVICE_JWT_SECRET"))
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, fmt.Errorf("unexpected signing method")
            }
            return secret, nil
        })
        
        if err != nil || !token.Valid {
            http.Error(w, "Invalid service token", http.StatusForbidden)
            return
        }
        
        next(w, r)
    }
}
```

## Token Renewal

Services should request new tokens before expiration to prevent service disruptions.

### Auto-Renewal Endpoint

**Endpoint:** `POST /auth/service/refresh`

**Request:**
```json
{
  "service_name": "intelligence",
  "current_token": "eyJhbGc..."
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "expires_in": 86400
}
```

### Renewal Strategy

1. **Proactive Renewal**: Renew tokens when 80% of TTL has elapsed (19.2 hours for 24h tokens)
2. **Retry Logic**: Implement exponential backoff if renewal fails
3. **Fallback**: Cache current token until renewal succeeds
4. **Monitoring**: Alert if renewal fails repeatedly

## Security Best Practices

### Secret Management

1. **Never commit secrets** to version control
2. **Use environment variables** for configuration
3. **Rotate secrets regularly** (quarterly minimum)
4. **Use different secrets** for each environment
5. **Restrict access** to production secrets

### Token Security

1. **Short expiration times** (24 hours maximum)
2. **Verify issuer and audience** on every validation
3. **Use HTTPS** for all inter-service communication in production
4. **Log validation failures** for security monitoring
5. **Never log token values** in plain text

### Monitoring

1. **Track failed verifications** - May indicate attack or misconfiguration
2. **Monitor token renewal rates** - Should be predictable
3. **Alert on repeated failures** - Could indicate compromised service
4. **Audit service permissions** - Ensure least privilege principle

## Troubleshooting

### Common Issues

#### "Service token required" Error

**Cause:** Missing `X-Service-Token` header

**Solution:** Ensure calling service includes the header in requests:
```javascript
headers: {
  'X-Service-Token': serviceToken
}
```

#### "Service token expired" Error

**Cause:** Token older than 24 hours

**Solution:** Implement auto-renewal or request a new token

#### "Invalid service token" Error

**Causes:**
1. Wrong `SERVICE_JWT_SECRET` between services
2. Token tampered with
3. Token signed with wrong algorithm

**Solution:** 
1. Verify `SERVICE_JWT_SECRET` matches across all services
2. Check token generation code
3. Ensure HS256 algorithm is used

### Debugging Steps

1. **Check environment variables:**
   ```bash
   docker exec noble-gateway printenv | grep SERVICE_JWT_SECRET
   ```

2. **Verify token structure:**
   ```bash
   # Decode token (DO NOT do in production with real tokens)
   echo "TOKEN" | cut -d'.' -f2 | base64 -d | jq
   ```

3. **Check service logs:**
   ```bash
   docker logs noble-gateway --tail 100 | grep "service.*token"
   ```

4. **Test token generation:**
   ```bash
   curl -X POST http://localhost:3001/auth/service/token \
     -H "Content-Type: application/json" \
     -d '{"service_name": "test"}'
   ```

## Secret Rotation Procedure

When rotating `SERVICE_JWT_SECRET`:

1. **Generate new secret:**
   ```bash
   openssl rand -base64 32
   ```

2. **Update environment variables** on all servers

3. **Rolling restart** of services:
   ```bash
   # Restart one service at a time
   docker-compose restart auth-billing
   docker-compose restart gateway
   docker-compose restart intelligence
   docker-compose restart memory
   docker-compose restart noble-spirit
   docker-compose restart ngs-curriculum
   docker-compose restart reflection-worker
   docker-compose restart distillation-worker
   docker-compose restart mcp-server
   ```

4. **Verify all services** are communicating correctly

5. **Monitor logs** for any authentication errors

6. **Document rotation** in change log with date

## Compliance & Auditing

### Audit Log Requirements

All service authentication events should be logged:

```json
{
  "timestamp": "2025-11-09T12:34:56Z",
  "event": "service_auth_success|service_auth_failure",
  "service": "intelligence",
  "target": "memory",
  "endpoint": "/api/memory/store",
  "ip_address": "172.18.0.5"
}
```

### Compliance Considerations

- **GDPR**: Service tokens do not contain PII
- **SOC 2**: Implement audit logging for all authentication events
- **HIPAA**: Use TLS for all inter-service communication
- **PCI DSS**: Rotate secrets every 90 days

## References

- [TASK_DELEGATION_PLAN.md](./TASK_DELEGATION_PLAN.md) - Task Group 1
- [TECHNICAL_ACTION_PLAN.md](./TECHNICAL_ACTION_PLAN.md) - Service Auth Implementation
- [JWT RFC 7519](https://tools.ietf.org/html/rfc7519)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

---

**Document Status:** Active  
**Last Updated:** November 9, 2025  
**Next Review:** December 9, 2025  
**Maintained By:** DevOps Architect & Cloud Security Specialist
