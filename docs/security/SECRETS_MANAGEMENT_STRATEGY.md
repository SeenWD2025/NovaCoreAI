# Secrets Management Strategy for NovaCoreAI

**Version:** 1.0  
**Date:** November 10, 2025  
**Prepared By:** Cloud and Cybersecurity Specialist (Security Sentinel)  
**Status:** Production-Ready Strategy  
**Priority:** P2 - Medium

---

## Executive Summary

This document outlines a comprehensive secrets management strategy for NovaCoreAI, covering secret types, storage solutions, rotation policies, access control, and operational procedures. The strategy balances security, operational efficiency, and cost-effectiveness.

### Current State vs. Target State

**Current State:**
- Secrets stored in `.env` files
- Manual secret rotation
- No centralized secret management
- Limited audit trail
- Environment-specific secret management

**Target State:**
- Centralized secret management solution
- Automated secret rotation (90-day cycle)
- Complete audit trail for all secret access
- Role-based access control (RBAC)
- Zero-trust architecture for secret access

---

## Table of Contents

1. [Secret Inventory](#secret-inventory)
2. [Secrets Management Solutions](#secrets-management-solutions)
3. [Recommended Solution](#recommended-solution)
4. [Secret Lifecycle Management](#secret-lifecycle-management)
5. [Access Control Policy](#access-control-policy)
6. [Secret Rotation Policy](#secret-rotation-policy)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Operational Procedures](#operational-procedures)
9. [Compliance and Audit](#compliance-and-audit)
10. [Disaster Recovery](#disaster-recovery)

---

## Secret Inventory

### Application Secrets (Tier 1 - Critical)

| Secret Name | Purpose | Rotation Frequency | Impact if Compromised |
|-------------|---------|-------------------|----------------------|
| `JWT_SECRET` | User session tokens | 90 days | HIGH - Account takeover |
| `SERVICE_JWT_SECRET` | Service-to-service auth | 90 days | CRITICAL - Full system compromise |
| `DATABASE_URL` | PostgreSQL connection | 90 days | CRITICAL - Data breach |
| `STRIPE_SECRET_KEY` | Payment processing | Never (Stripe managed) | CRITICAL - Financial fraud |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | 180 days | HIGH - Payment fraud |

### Infrastructure Secrets (Tier 2 - High)

| Secret Name | Purpose | Rotation Frequency | Impact if Compromised |
|-------------|---------|-------------------|----------------------|
| `REDIS_URL` | Cache/session storage | 90 days | HIGH - Session hijacking |
| `POSTGRES_PASSWORD` | Database admin | 90 days | CRITICAL - Data breach |
| `POSTGRES_USER` | Database user | Manual | MEDIUM - Limited access |
| `SSH_PRIVATE_KEY` | Server access | 180 days | HIGH - Infrastructure access |
| `DIGITALOCEAN_TOKEN` | Cloud provider API | 180 days | CRITICAL - Infrastructure control |

### API Keys and Integration Secrets (Tier 3 - Medium)

| Secret Name | Purpose | Rotation Frequency | Impact if Compromised |
|-------------|---------|-------------------|----------------------|
| `SENDGRID_API_KEY` | Email delivery | 180 days | MEDIUM - Email abuse |
| `OLLAMA_API_KEY` | AI model access | 180 days | MEDIUM - Resource abuse |
| `GITHUB_TOKEN` | CI/CD operations | 180 days | MEDIUM - Code access |
| `SENTRY_DSN` | Error tracking | Manual | LOW - Information disclosure |

### Encryption Keys (Tier 1 - Critical)

| Secret Name | Purpose | Rotation Frequency | Impact if Compromised |
|-------------|---------|-------------------|----------------------|
| `ENCRYPTION_KEY` | Data-at-rest encryption | 365 days | CRITICAL - Data exposure |
| `BACKUP_ENCRYPTION_KEY` | Backup encryption | 365 days | CRITICAL - Backup exposure |

**Total Secrets:** 19 classified secrets requiring management

---

## Secrets Management Solutions

### Option 1: HashiCorp Vault (Self-Hosted)

**Description:** Industry-leading open-source secrets management platform with enterprise features.

**Pros:**
- ✅ **Industry Standard:** Proven in enterprise environments
- ✅ **Feature-Rich:** Dynamic secrets, secret versioning, audit logging
- ✅ **Flexible:** Supports multiple authentication methods
- ✅ **Open Source:** Free tier with optional enterprise support
- ✅ **Integration:** Excellent ecosystem support
- ✅ **Encryption:** Built-in encryption at rest and in transit

**Cons:**
- ❌ **Complexity:** Requires dedicated infrastructure and expertise
- ❌ **Operational Overhead:** Requires monitoring, backup, and maintenance
- ❌ **High Availability:** Needs clustering for production
- ❌ **Learning Curve:** Steep initial setup and configuration

**Cost Estimate:**
- Software: Free (OSS) or $150/host/month (Enterprise)
- Infrastructure: $50-100/month (2 small VMs for HA)
- Operational: 4-8 hours/month maintenance
- **Total:** ~$150-250/month + operational time

**Best For:** Organizations with 10+ services, compliance requirements, or existing Vault expertise

---

### Option 2: DigitalOcean App Platform Secrets

**Description:** Native secrets management integrated with DigitalOcean's platform.

**Pros:**
- ✅ **Integrated:** Native to DigitalOcean infrastructure
- ✅ **Simple:** Easy setup and configuration
- ✅ **Cost-Effective:** Included with App Platform
- ✅ **Low Maintenance:** Fully managed
- ✅ **Quick Setup:** Minutes, not hours

**Cons:**
- ❌ **Limited Features:** Basic secret storage only
- ❌ **No Rotation:** Manual rotation required
- ❌ **Vendor Lock-in:** DigitalOcean specific
- ❌ **Limited Audit:** Basic logging only
- ❌ **No Dynamic Secrets:** Static secrets only

**Cost Estimate:**
- Software: Included with App Platform
- Infrastructure: $0 (included)
- **Total:** $0/month

**Best For:** Small deployments, MVP/alpha stage, budget-conscious projects

---

### Option 3: AWS Secrets Manager

**Description:** Fully managed secrets management service from AWS.

**Pros:**
- ✅ **Fully Managed:** No infrastructure to maintain
- ✅ **Automatic Rotation:** Built-in rotation for RDS, Redshift, DocumentDB
- ✅ **Integration:** Excellent AWS service integration
- ✅ **Audit Trail:** CloudTrail integration for compliance
- ✅ **High Availability:** Multi-AZ by default
- ✅ **Fine-Grained Access:** IAM-based access control

**Cons:**
- ❌ **AWS Only:** Requires AWS infrastructure
- ❌ **Cost:** $0.40/secret/month + $0.05/10,000 API calls
- ❌ **Complexity:** AWS knowledge required
- ❌ **Migration:** Would require cloud provider change

**Cost Estimate:**
- 20 secrets × $0.40 = $8/month
- API calls: ~$5/month (estimated)
- **Total:** ~$13/month

**Best For:** AWS-based infrastructure or hybrid cloud deployments

---

### Option 4: Environment Variables with .env Files (Current)

**Description:** Store secrets in `.env` files, one per environment.

**Pros:**
- ✅ **Simple:** Easy to understand and use
- ✅ **No Cost:** Free
- ✅ **Quick:** Immediate implementation
- ✅ **Portable:** Works everywhere

**Cons:**
- ❌ **Insecure:** Risk of accidental commit to version control
- ❌ **No Versioning:** Difficult to track changes
- ❌ **No Audit Trail:** No record of secret access
- ❌ **Manual Rotation:** Complex coordination required
- ❌ **No Encryption:** Secrets stored in plain text on disk
- ❌ **Access Control:** File-system level only

**Cost Estimate:**
- **Total:** $0/month

**Best For:** Development environments only, NOT production

---

## Recommended Solution

### Phase 1: Alpha/Beta (Immediate - 3 months)

**Solution:** DigitalOcean App Platform Secrets + Enhanced .env Management

**Rationale:**
- Cost-effective for early stage
- Quick to implement (hours, not days)
- No operational overhead
- Sufficient for controlled user base
- Easy migration path to advanced solution

**Implementation:**
1. Migrate from local `.env` files to DigitalOcean secrets
2. Use DigitalOcean secret encryption at rest
3. Implement manual 90-day rotation calendar
4. Document all secrets in secure inventory
5. Use separate secrets for staging and production

**Cost:** $0/month (included)  
**Implementation Time:** 4 hours  
**Maintenance:** 2 hours/month (manual rotation)

---

### Phase 2: Production Scale (3-6 months)

**Solution:** HashiCorp Vault (Self-Hosted)

**Rationale:**
- Production-grade security
- Audit compliance requirements
- Automatic secret rotation
- Dynamic secret generation
- Scales with business growth

**Implementation:**
1. Set up Vault cluster (2-node HA)
2. Migrate secrets from DigitalOcean to Vault
3. Implement automatic rotation for database credentials
4. Configure service authentication (AppRole)
5. Set up audit logging and monitoring
6. Train team on Vault operations

**Cost:** ~$200/month (infrastructure + operational time)  
**Implementation Time:** 2-3 days  
**Maintenance:** 4-6 hours/month

---

### Phase 3: Enterprise (6+ months)

**Solution:** HashiCorp Vault Enterprise or AWS Secrets Manager

**Rationale:**
- Multi-region disaster recovery
- Advanced compliance features (SOC 2, GDPR)
- Performance replication
- Disaster recovery automation
- Enterprise support

**Cost:** $300-500/month (depending on scale)

---

## Secret Lifecycle Management

### Secret States

```
[Created] → [Active] → [Rotation Pending] → [Deprecated] → [Revoked] → [Deleted]
     ↓          ↓              ↓                  ↓             ↓
  [Audit]   [Audit]        [Alert]            [Alert]      [Archive]
```

### 1. Secret Creation

**Process:**
1. **Request:** Engineer submits secret creation request
2. **Review:** Security team reviews necessity and scope
3. **Generate:** Use cryptographically secure random generation
4. **Store:** Save to secrets management system
5. **Document:** Add to secret inventory with metadata
6. **Grant Access:** Configure RBAC for authorized services/users
7. **Audit:** Log creation event with timestamp and creator

**Requirements:**
- Minimum length: 32 characters (256 bits)
- Character set: Alphanumeric + special characters
- Randomness: Use `crypto.randomBytes()` or equivalent
- No patterns: Avoid predictable sequences

**Tools:**
```bash
# Generate secure secret
openssl rand -base64 32

# Generate UUID-based secret
uuidgen

# Generate hex secret
openssl rand -hex 32
```

---

### 2. Secret Storage

**Storage Requirements:**

**Encryption at Rest:**
- Algorithm: AES-256-GCM
- Key management: Master key wrapped by platform KMS
- Metadata: Encrypted alongside secret value

**Encryption in Transit:**
- Protocol: TLS 1.3
- Certificate: Valid, non-self-signed
- Cipher suites: Strong ciphers only (no CBC)

**Backup:**
- Frequency: Daily automated backups
- Encryption: Separate encryption key from primary
- Retention: 30 days backup retention
- Testing: Monthly restoration drills

---

### 3. Secret Access

**Access Patterns:**

**Service Authentication:**
```typescript
// Services authenticate using AppRole (Vault) or Service Principal
const secret = await vault.read('secret/data/database/connection', {
  role: 'intelligence-service',
  token: serviceToken
});
```

**Human Access (Break-Glass):**
```bash
# Emergency access with strong authentication
vault login -method=ldap username=admin
vault kv get secret/database/connection

# All access logged with:
# - User identity
# - Timestamp
# - Secret path
# - Action (read/write/delete)
```

**Access Control Matrix:**

| Role | Database Secrets | API Keys | JWT Secrets | Stripe Keys |
|------|-----------------|----------|-------------|-------------|
| Intelligence Service | Read | Read | Read | None |
| Auth Service | Read | Read | Read/Write | Read/Write |
| Gateway | None | Read | Read | None |
| Admin (Human) | Read/Write | Read/Write | Read/Write | Read/Write |
| Developer | None | Read (staging) | None | None |
| CI/CD Pipeline | None | Read | None | None |

---

### 4. Secret Rotation

**Rotation Strategies:**

**Strategy 1: Dual-Write (Zero-Downtime)**
```
1. Generate new secret (new_secret)
2. Configure services to accept both old_secret and new_secret
3. Deploy configuration to all services
4. Update secret in secrets manager to new_secret
5. Wait for grace period (24 hours)
6. Remove old_secret from configuration
7. Deploy cleanup to all services
8. Archive old_secret
```

**Strategy 2: Blue-Green Deployment**
```
1. Generate new secret
2. Deploy "green" environment with new secret
3. Test green environment
4. Switch traffic to green
5. Decommission "blue" environment
6. Archive old secret
```

**Rotation Schedule:**

| Secret Type | Frequency | Automation | Grace Period |
|-------------|-----------|------------|--------------|
| JWT secrets | 90 days | Manual (documented) | 24 hours |
| Service tokens | 90 days | Automatic (via renewal) | None |
| Database passwords | 90 days | Automatic | 24 hours |
| API keys | 180 days | Manual | 48 hours |
| Encryption keys | 365 days | Manual | 7 days |
| Webhook secrets | 180 days | Manual | 48 hours |

---

### 5. Secret Revocation

**Immediate Revocation Triggers:**
- Suspected compromise or breach
- Employee offboarding
- Service decommissioning
- Security incident

**Revocation Process:**
1. **Immediate:** Revoke secret in secrets manager
2. **Immediate:** Generate new secret
3. **Emergency Deploy:** Push new secret to all services
4. **Verify:** Confirm old secret no longer works
5. **Investigate:** Root cause analysis of revocation
6. **Report:** Document incident and resolution
7. **Archive:** Move old secret to audit archive

**Revocation SLA:**
- **Critical Secrets:** <15 minutes
- **High Secrets:** <1 hour  
- **Medium Secrets:** <4 hours

---

### 6. Secret Deletion

**Deletion Policy:**
- Secrets NEVER permanently deleted immediately
- Soft delete with 90-day retention for audit
- After 90 days, archive to encrypted cold storage
- After 7 years, permanent deletion (compliance requirement)

**Deletion Process:**
```
[Active] → [Soft Delete] → [Archive] → [Permanent Delete]
           (90 days)        (7 years)     (audit approved)
```

---

## Access Control Policy

### Principle of Least Privilege

**Services:**
- Each service has dedicated identity
- Minimal secret access (need-to-know only)
- No cross-environment access (staging can't access production)

**Humans:**
- Multi-factor authentication required
- Time-limited access tokens (8-hour max)
- Approval required for production secret access
- All access audited and reviewed monthly

### Role-Based Access Control (RBAC)

**Role: Service (Application)**
```yaml
permissions:
  - read: secret/app/{service-name}/*
  - read: secret/shared/{tier}/*
  deny:
  - write: *
  - delete: *
  - admin: *
```

**Role: Developer**
```yaml
permissions:
  - read: secret/staging/*
  - read: secret/development/*
deny:
  - access: secret/production/*
  - write: secret/staging/stripe/*
  - delete: *
```

**Role: DevOps Engineer**
```yaml
permissions:
  - read: secret/production/*
  - write: secret/production/* (with approval)
  - rotate: secret/production/* (with approval)
deny:
  - delete: secret/production/*
  - access: secret/production/stripe/* (requires Security approval)
```

**Role: Security Admin**
```yaml
permissions:
  - full: secret/*
  - audit: *
  - admin: vault-config
```

### Break-Glass Procedures

**When to Use:**
- Production outage requiring emergency secret access
- Security incident requiring immediate rotation
- Disaster recovery scenario

**Process:**
1. **Declare Emergency:** Page on-call security team
2. **Approve:** Two-person approval required
3. **Access:** Time-limited (1 hour) elevated access granted
4. **Action:** Perform emergency action with logging
5. **Report:** Incident report within 2 hours
6. **Review:** Post-mortem within 24 hours
7. **Revoke:** Automatic revocation after time limit

---

## Secret Rotation Policy

### Automated Rotation

**Database Credentials:**
```python
# Vault dynamic database secrets (automatic)
# TTL: 24 hours, automatically renewed

vault.database.generate_credentials(
    name='postgres-intelligence',
    ttl='24h'
)

# Service automatically renews before expiration
# Old credentials automatically revoked after grace period
```

**JWT Secrets (Semi-Automated):**
```typescript
// Quarterly rotation procedure
async function rotateJWTSecret() {
  // 1. Generate new secret
  const newSecret = crypto.randomBytes(64).toString('hex');
  
  // 2. Store in vault with versioning
  await vault.write('secret/jwt', {
    secret: newSecret,
    version: currentVersion + 1,
    created: new Date().toISOString()
  });
  
  // 3. Deploy to all services (dual-write)
  await deploySecretUpdate({
    old: currentSecret,
    new: newSecret,
    gracePeriod: '24h'
  });
  
  // 4. Monitor for 24 hours
  await monitorForErrors('24h');
  
  // 5. Remove old secret
  await removeOldSecret(currentSecret);
}
```

### Manual Rotation Procedures

**Stripe Webhook Secret:**
1. Generate new secret in Stripe Dashboard
2. Update secret in secrets manager
3. Deploy updated secret to auth-billing service
4. Test webhook delivery with Stripe CLI
5. Monitor webhook events for 48 hours
6. Remove old secret from Stripe Dashboard

**API Keys (SendGrid, etc.):**
1. Generate new API key in provider dashboard
2. Update secret in secrets manager
3. Deploy to affected services
4. Test integration functionality
5. Monitor for errors for 48 hours
6. Revoke old API key in provider dashboard

---

## Implementation Roadmap

### Phase 1: Immediate (Week 1)

**Objectives:**
- Secure current secrets
- Establish basic inventory
- Implement staging/production separation

**Tasks:**
- [ ] Audit all current secrets across services
- [ ] Create secret inventory spreadsheet
- [ ] Migrate to DigitalOcean App Platform secrets
- [ ] Separate staging and production secrets
- [ ] Remove all `.env` files from git history (if any)
- [ ] Add `.env` to `.gitignore` (confirm present)
- [ ] Document current secret access patterns

**Deliverables:**
- Secret inventory document
- Migrated secrets to DigitalOcean
- Separation of environment secrets

**Time:** 6-8 hours  
**Owner:** DevOps + Security

---

### Phase 2: Enhanced Security (Month 1)

**Objectives:**
- Implement manual rotation process
- Establish audit procedures
- Document access controls

**Tasks:**
- [ ] Create secret rotation calendar
- [ ] Document rotation procedures for each secret type
- [ ] Implement access logging (who accessed what when)
- [ ] Set up alerts for secret access
- [ ] Create runbook for secret rotation
- [ ] Train team on secret management procedures

**Deliverables:**
- Rotation calendar
- Access logging
- Rotation runbooks
- Team training complete

**Time:** 8-12 hours  
**Owner:** Security + DevOps

---

### Phase 3: Vault Implementation (Month 2-3)

**Objectives:**
- Deploy HashiCorp Vault
- Migrate secrets from DigitalOcean
- Implement automated rotation

**Tasks:**
- [ ] Provision Vault infrastructure (2-node HA)
- [ ] Configure Vault authentication (AppRole for services)
- [ ] Migrate secrets from DigitalOcean to Vault
- [ ] Update services to use Vault SDK/API
- [ ] Configure audit logging
- [ ] Set up Vault monitoring and alerting
- [ ] Implement automatic rotation for database secrets
- [ ] Test disaster recovery procedures

**Deliverables:**
- Production Vault cluster
- All secrets migrated
- Automated rotation for database credentials
- Monitoring and alerting active

**Time:** 24-32 hours  
**Owner:** DevOps (primary), Security (support)

---

### Phase 4: Optimization (Month 4+)

**Objectives:**
- Optimize rotation processes
- Implement dynamic secrets where possible
- Advanced audit and compliance

**Tasks:**
- [ ] Implement dynamic database secrets (short TTL)
- [ ] Automate JWT secret rotation
- [ ] Configure secret versioning
- [ ] Implement secret performance metrics
- [ ] Create compliance reports (access audit)
- [ ] Optimize secret caching strategy
- [ ] Document lessons learned

**Deliverables:**
- Fully automated rotation
- Dynamic secrets implemented
- Compliance reporting
- Optimized performance

**Time:** 16-24 hours  
**Owner:** DevOps + Security

---

## Operational Procedures

### Adding a New Secret

1. **Request:** Submit secret request with justification
2. **Review:** Security team reviews (1 business day)
3. **Approve:** Security approves or requests clarification
4. **Generate:** Use secure random generation
5. **Store:** Add to secrets manager with metadata
6. **Configure:** Grant access to authorized services
7. **Document:** Update secret inventory
8. **Deploy:** Services can now access secret
9. **Verify:** Confirm secret access works

**Template:**
```yaml
secret_request:
  name: "NEW_SECRET_NAME"
  purpose: "Brief description of use case"
  scope: "Which services need access"
  tier: "Critical|High|Medium|Low"
  rotation_frequency: "90 days"
  requested_by: "engineer@novacore.ai"
  approved_by: ""
  created_date: ""
```

---

### Rotating an Existing Secret

1. **Schedule:** Check rotation calendar for due secrets
2. **Plan:** Review rotation procedure for secret type
3. **Notify:** Alert team of planned rotation (24h notice)
4. **Generate:** Create new secret value
5. **Store:** Update secrets manager (keep old version)
6. **Deploy:** Roll out new secret with dual-write support
7. **Monitor:** Watch for errors (grace period)
8. **Cleanup:** Remove old secret after grace period
9. **Document:** Update rotation log

---

### Responding to Secret Compromise

**Severity Levels:**

**CRITICAL (Tier 1 Secrets):**
- Response Time: <15 minutes
- Actions:
  1. Immediately revoke compromised secret
  2. Generate and deploy new secret (emergency process)
  3. Page security team and management
  4. Begin incident investigation
  5. Check audit logs for unauthorized access
  6. Assess data breach impact
  7. File incident report
  8. Notify affected parties if required (GDPR)

**HIGH (Tier 2 Secrets):**
- Response Time: <1 hour
- Actions:
  1. Revoke compromised secret
  2. Generate and deploy new secret
  3. Notify security team
  4. Investigate compromise source
  5. Review access logs
  6. File incident report

**MEDIUM (Tier 3 Secrets):**
- Response Time: <4 hours
- Actions:
  1. Revoke and rotate secret
  2. Notify relevant team
  3. Document incident

---

### Monthly Audit Procedure

**Tasks:**
1. Review all secret access logs
2. Identify unusual access patterns
3. Verify rotation schedule compliance
4. Check for secrets nearing expiration
5. Review access control changes
6. Update secret inventory
7. Generate compliance report

**Deliverable:** Monthly security report

---

## Compliance and Audit

### Audit Logging Requirements

**What to Log:**
- Secret creation (who, when, what)
- Secret access (service/user, timestamp, path)
- Secret updates (version, changes)
- Secret rotation (old → new transition)
- Secret revocation (reason, triggered by)
- Access denied (failed auth attempts)
- Configuration changes (policy updates)

**Log Format:**
```json
{
  "timestamp": "2025-11-10T10:30:00Z",
  "event_type": "secret_access",
  "actor": {
    "type": "service|human",
    "identity": "intelligence-service",
    "ip": "10.0.1.15"
  },
  "secret": {
    "path": "secret/database/connection",
    "version": 3
  },
  "action": "read",
  "result": "success|failure",
  "metadata": {
    "request_id": "req-abc123"
  }
}
```

**Retention:**
- Active logs: 90 days in hot storage
- Archive: 7 years in cold storage (compliance)

---

### Compliance Requirements

**GDPR:**
- Right to access: Audit logs show who accessed what data
- Right to erasure: Secret deletion procedures
- Data minimization: Only store necessary secrets
- Security of processing: Encryption and access control

**SOC 2:**
- Logical access controls (RBAC)
- Audit logging and monitoring
- Change management (secret rotation)
- Incident response procedures

**PCI DSS (if applicable):**
- Encryption of cardholder data (handled by Stripe)
- Access control (RBAC)
- Regular security testing (rotation testing)
- Audit trail maintenance

---

## Disaster Recovery

### Backup Strategy

**Frequency:**
- Daily automated backups
- Retention: 30 days
- Encryption: AES-256 with separate key
- Storage: DigitalOcean Spaces (offsite)

**Backup Contents:**
- All secret values and metadata
- Access policies and roles
- Audit logs
- Configuration

**Restoration:**
- Recovery Time Objective (RTO): 4 hours
- Recovery Point Objective (RPO): 24 hours
- Tested monthly

---

### Disaster Scenarios

**Scenario 1: Secrets Manager Failure**
```
1. Declare incident
2. Spin up backup Vault instance
3. Restore from latest backup
4. Verify secret access
5. Update DNS/endpoints
6. Resume normal operations
Estimated Time: 2-4 hours
```

**Scenario 2: Secret Compromise at Scale**
```
1. Revoke all compromised secrets
2. Generate new secrets for all services
3. Emergency deployment (all services)
4. Verify system functionality
5. Investigate compromise source
6. Implement additional controls
Estimated Time: 4-8 hours
```

**Scenario 3: Complete Infrastructure Loss**
```
1. Restore Vault from offsite backup
2. Provision new infrastructure
3. Restore all services
4. Update secret values if needed
5. Verify system functionality
6. Resume operations
Estimated Time: 8-24 hours
```

---

## Summary and Recommendations

### Key Recommendations

1. **Short-term (Immediate):**
   - ✅ Migrate from `.env` files to DigitalOcean App Platform Secrets
   - ✅ Create comprehensive secret inventory
   - ✅ Implement staging/production separation
   - ✅ Document rotation procedures

2. **Medium-term (3-6 months):**
   - ⚠️ Deploy HashiCorp Vault for production
   - ⚠️ Implement automated secret rotation
   - ⚠️ Configure audit logging and monitoring
   - ⚠️ Train team on Vault operations

3. **Long-term (6+ months):**
   - ⚠️ Implement dynamic secrets
   - ⚠️ Automate all rotation processes
   - ⚠️ Achieve full compliance (SOC 2, GDPR)
   - ⚠️ Implement advanced anomaly detection

### Success Metrics

| Metric | Current | Target (6 months) |
|--------|---------|-------------------|
| Secrets in version control | 0 (goal) | 0 |
| Manual rotation time | N/A | <30 min/secret |
| Secret compromise response time | N/A | <15 min (critical) |
| Audit log coverage | 0% | 100% |
| Automated rotation | 0% | 80%+ |
| Secret access latency | N/A | <100ms |

---

## Appendices

### Appendix A: Secret Naming Convention

Format: `{ENVIRONMENT}_{SERVICE}_{PURPOSE}_{TYPE}`

Examples:
- `PROD_AUTH_DATABASE_PASSWORD`
- `STAGING_GATEWAY_JWT_SECRET`
- `PROD_STRIPE_WEBHOOK_SECRET`

### Appendix B: Vault Configuration Example

```hcl
# vault-config.hcl
storage "raft" {
  path = "/opt/vault/data"
  node_id = "vault-1"
}

listener "tcp" {
  address = "0.0.0.0:8200"
  tls_cert_file = "/opt/vault/tls/cert.pem"
  tls_key_file = "/opt/vault/tls/key.pem"
}

seal "gcpckms" {
  project = "novacore-prod"
  region = "us-east1"
  key_ring = "vault-seal"
  crypto_key = "vault-seal-key"
}

api_addr = "https://vault.novacore.ai:8200"
cluster_addr = "https://vault-1.internal:8201"
ui = true
```

### Appendix C: Rotation Checklist Template

```markdown
# Secret Rotation Checklist

**Secret:** _______________________
**Rotation Date:** _______________
**Performed By:** _______________

- [ ] Review rotation procedure
- [ ] Notify team (24h advance notice)
- [ ] Generate new secret value
- [ ] Update secrets manager
- [ ] Deploy to staging environment
- [ ] Test staging functionality
- [ ] Deploy to production (dual-write)
- [ ] Monitor for errors (grace period)
- [ ] Remove old secret
- [ ] Verify old secret no longer works
- [ ] Update documentation
- [ ] Log rotation event
```

---

**Document Status:** Complete and Ready for Implementation  
**Next Review:** January 10, 2026 (Quarterly)  
**Maintained By:** Cloud and Cybersecurity Specialist  
**Version History:** 1.0 (Initial Release)

---

**END OF SECRETS MANAGEMENT STRATEGY**
