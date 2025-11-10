# Secrets Management Guide

**Document Version:** 1.0  
**Date:** November 9, 2025  
**Prepared By:** DevOps Architect - Noble Growth Collective

## Overview

This document defines the strategy for managing secrets, credentials, and sensitive configuration in NovaCoreAI across all environments.

## Security Requirements

### Compliance Standards

- **OWASP Top 10**: Protection against A07:2021 – Identification and Authentication Failures
- **SOC 2 Type II**: Secret access controls and audit logging
- **GDPR**: Encryption of sensitive data at rest and in transit
- **NIST**: Follow cryptographic standards for key generation

## Secrets Inventory

### Critical Secrets (Rotation Required)

| Secret Name | Purpose | Rotation Frequency | Length | Algorithm |
|-------------|---------|-------------------|--------|-----------|
| `SERVICE_JWT_SECRET` | Service-to-service auth | Quarterly | 256-bit | HS256 |
| `JWT_SECRET` | User authentication | Quarterly | 256-bit | HS256 |
| `JWT_REFRESH_SECRET` | Refresh tokens | Quarterly | 256-bit | HS256 |
| `POSTGRES_PASSWORD` | Database access | Semi-annually | 32+ chars | N/A |
| `STRIPE_SECRET_KEY` | Payment processing | On compromise | N/A | N/A |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | On compromise | N/A | N/A |

### Environment-Specific Secrets

| Secret Name | Purpose | Environments | Rotation |
|-------------|---------|--------------|----------|
| `GRAFANA_ADMIN_PASSWORD` | Monitoring access | All | Quarterly |
| `REDIS_PASSWORD` | Cache access | Staging, Production | Quarterly |
| `DO_TOKEN` | Infrastructure API | Production | Annually |
| `SSH_PRIVATE_KEY` | Deployment access | CI/CD | Annually |

## Secret Generation

### Recommended Commands

```bash
# Generate 256-bit secrets (32 bytes base64-encoded)
openssl rand -base64 32

# Generate 512-bit secrets (64 bytes base64-encoded)
openssl rand -base64 64

# Generate UUID (for IDs, not secrets)
uuidgen

# Generate complex password (alphanumeric + symbols)
openssl rand -base64 24 | tr -d "=+/" | cut -c1-32
```

### Generation Best Practices

1. **Never reuse secrets** across environments
2. **Use cryptographically secure random generators** (not pseudo-random)
3. **Minimum 256-bit entropy** for JWT secrets
4. **Document generation date** and next rotation date
5. **Test secret in staging** before production deployment

## Storage Solutions

### Development Environment

**Method:** Local `.env` file (gitignored)

```bash
# Create .env from template
cp env.example .env

# Edit with secure values
nano .env

# Verify .gitignore includes .env
grep "^\.env$" .gitignore
```

**Security Level:** Low (acceptable for local development only)

### Staging/Production Environment

**Method:** Environment variables managed by infrastructure

#### Option 1: Docker Secrets (Swarm Mode)

```bash
# Create secret
echo "my-secret-value" | docker secret create service_jwt_secret -

# Use in compose file
services:
  gateway:
    secrets:
      - service_jwt_secret
    environment:
      SERVICE_JWT_SECRET_FILE: /run/secrets/service_jwt_secret

secrets:
  service_jwt_secret:
    external: true
```

**Security Level:** Medium-High

#### Option 2: HashiCorp Vault (Recommended for Production)

```bash
# Enable KV v2 secrets engine
vault secrets enable -version=2 kv

# Store secret
vault kv put kv/novacore/production/jwt \
  service_secret="generated-secret-here" \
  user_secret="generated-secret-here"

# Retrieve secret
vault kv get -field=service_secret kv/novacore/production/jwt
```

**Security Level:** High

#### Option 3: DigitalOcean App Platform Secrets

```bash
# Using doctl CLI
doctl apps create-deployment <app-id> \
  --env SERVICE_JWT_SECRET=<value>

# Or via Web UI: App → Settings → Environment Variables
```

**Security Level:** Medium-High

## Access Control

### Principle of Least Privilege

**Development:**
- Developers: Access to dev secrets only
- QA: Access to staging secrets only

**Production:**
- DevOps Team: Full access to production secrets
- Security Team: Read-only audit access
- Developers: No direct access (deployment via CI/CD)

### Access Audit Log

Maintain log of secret access:

```
Date: 2025-11-09
User: devops@nobleai.com
Action: Rotated SERVICE_JWT_SECRET
Environment: Production
Reason: Quarterly rotation schedule
```

## Rotation Procedures

### Quarterly Rotation (JWT Secrets)

1. **Pre-rotation checklist:**
   - [ ] Schedule maintenance window
   - [ ] Notify team 48 hours in advance
   - [ ] Backup current secrets
   - [ ] Test rotation in staging first

2. **Generate new secrets:**
   ```bash
   # Generate three new secrets
   NEW_SERVICE_JWT=$(openssl rand -base64 32)
   NEW_JWT=$(openssl rand -base64 32)
   NEW_REFRESH_JWT=$(openssl rand -base64 32)
   
   # Store securely (don't echo to terminal in production)
   echo "$NEW_SERVICE_JWT" > /tmp/service_jwt.txt
   echo "$NEW_JWT" > /tmp/jwt.txt
   echo "$NEW_REFRESH_JWT" > /tmp/refresh_jwt.txt
   ```

3. **Update configuration:**
   ```bash
   # Update .env or secrets manager
   SERVICE_JWT_SECRET=$NEW_SERVICE_JWT
   JWT_SECRET=$NEW_JWT
   JWT_REFRESH_SECRET=$NEW_REFRESH_JWT
   ```

4. **Rolling restart:**
   ```bash
   # Restart services one by one (zero downtime)
   docker-compose up -d --no-deps --force-recreate auth-billing
   sleep 30
   docker-compose up -d --no-deps --force-recreate gateway
   sleep 30
   docker-compose up -d --no-deps --force-recreate intelligence
   sleep 30
   docker-compose up -d --no-deps --force-recreate memory
   sleep 30
   docker-compose up -d --no-deps --force-recreate noble-spirit
   sleep 30
   docker-compose up -d --no-deps --force-recreate ngs-curriculum
   sleep 30
   docker-compose up -d --no-deps --force-recreate reflection-worker
   docker-compose up -d --no-deps --force-recreate distillation-worker
   docker-compose up -d --no-deps --force-recreate mcp-server
   ```

5. **Verification:**
   ```bash
   # Test service authentication
   curl -f https://api.novacore.ai/health || echo "Health check failed"
   
   # Test user authentication
   curl -X POST https://api.novacore.ai/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123"}'
   
   # Monitor logs for auth errors
   docker-compose logs --tail=100 | grep -i "auth\|token"
   ```

6. **Post-rotation:**
   - [ ] Document rotation in change log
   - [ ] Update next rotation date (3 months)
   - [ ] Securely delete old secrets
   - [ ] Monitor for 24 hours

### Emergency Rotation (Compromise)

If a secret is compromised:

1. **Immediate actions:**
   ```bash
   # Rotate secret immediately (no maintenance window)
   NEW_SECRET=$(openssl rand -base64 32)
   
   # Force restart all services
   docker-compose restart
   
   # Invalidate all existing tokens (if applicable)
   redis-cli FLUSHALL
   ```

2. **Incident response:**
   - Document how compromise occurred
   - Review access logs
   - Notify security team
   - Update security procedures

3. **Follow-up:**
   - Conduct security audit
   - Review access controls
   - Implement additional monitoring

## CI/CD Integration

### GitHub Actions Secrets

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to server
        env:
          SERVICE_JWT_SECRET: ${{ secrets.SERVICE_JWT_SECRET }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          JWT_REFRESH_SECRET: ${{ secrets.JWT_REFRESH_SECRET }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
        run: |
          # Deployment script with secrets
          ./scripts/deploy.sh
```

### Secrets in GitHub

1. Navigate to: Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret individually
4. Restrict access to production secrets

## Monitoring & Alerting

### Secret Expiration Monitoring

Create alerts for secret rotation schedules:

```yaml
# Prometheus alert
groups:
  - name: secrets
    rules:
      - alert: SecretRotationDue
        expr: (time() - secret_last_rotated_timestamp) > 7776000  # 90 days
        labels:
          severity: warning
        annotations:
          summary: "Secret rotation due for {{ $labels.secret_name }}"
```

### Failed Authentication Monitoring

Monitor for authentication failures that might indicate compromised secrets:

```yaml
- alert: HighAuthenticationFailureRate
  expr: rate(auth_failures_total[5m]) > 10
  labels:
    severity: critical
  annotations:
    summary: "High rate of authentication failures"
```

## Troubleshooting

### Common Issues

#### "Invalid JWT signature" Errors

**Cause:** Mismatch between SERVICE_JWT_SECRET across services

**Solution:**
```bash
# Verify secret is consistent
docker exec noble-gateway printenv SERVICE_JWT_SECRET
docker exec noble-auth printenv SERVICE_JWT_SECRET
docker exec noble-intelligence printenv SERVICE_JWT_SECRET

# If different, update and restart
```

#### "Secret not found" in CI/CD

**Cause:** Secret not added to GitHub repository secrets

**Solution:**
1. Go to repository settings → Secrets
2. Add missing secret
3. Re-run workflow

#### Service fails to start after rotation

**Cause:** Invalid secret format or missing secret

**Solution:**
```bash
# Check service logs
docker-compose logs service-name

# Verify secret is set
docker exec service-name printenv | grep SECRET

# Rollback if necessary
docker-compose down
# Restore old secrets
docker-compose up -d
```

## Security Best Practices

### DO

✅ **Use different secrets** for each environment  
✅ **Rotate secrets regularly** (quarterly minimum)  
✅ **Use strong entropy** (256-bit minimum)  
✅ **Audit secret access** (maintain logs)  
✅ **Test rotations** in staging first  
✅ **Encrypt secrets at rest** (Vault, encrypted storage)  
✅ **Use HTTPS/TLS** for secret transmission  
✅ **Implement least privilege** access controls  
✅ **Document rotation procedures**  
✅ **Monitor for compromises**

### DON'T

❌ **Never commit secrets** to version control  
❌ **Never log secrets** in plain text  
❌ **Never share secrets** via email/chat  
❌ **Never reuse secrets** across environments  
❌ **Never use weak secrets** (< 128-bit)  
❌ **Never skip staging tests** before production  
❌ **Never share production secrets** with developers  
❌ **Never ignore rotation schedules**  
❌ **Never use same secret** for different purposes  
❌ **Never leave secrets** in command history

## Emergency Contacts

**Security Issues:**
- Email: security@nobleai.com
- Slack: #security-incidents
- On-call: (555) 123-4567

**DevOps Team:**
- Email: devops@nobleai.com
- Slack: #novacore-deploys
- On-call: (555) 123-4568

## References

- [SERVICE_AUTHENTICATION.md](./SERVICE_AUTHENTICATION.md) - Service auth implementation
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment procedures
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [NIST Cryptographic Standards](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines)

---

**Document Status:** Active  
**Last Updated:** November 9, 2025  
**Next Review:** December 9, 2025  
**Maintained By:** DevOps Architect & Cloud Security Specialist
