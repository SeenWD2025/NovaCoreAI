# Advanced Security Features for NovaCoreAI

**Version:** 1.0  
**Date:** November 10, 2025  
**Prepared By:** Cloud and Cybersecurity Specialist (Security Sentinel)  
**Status:** Design Specification  
**Priority:** P3 - Low (Post-MVP)

---

## Executive Summary

This document outlines advanced security features for NovaCoreAI to enhance security posture beyond MVP requirements. These features are designed for implementation in months 3-6, after core functionality is stable and the user base is growing.

### Features Covered

1. Two-Factor Authentication (2FA)
2. Security Audit Logging
3. Anomaly Detection
4. Penetration Testing Program

---

## 1. Two-Factor Authentication (2FA)

### Overview

Two-factor authentication adds an additional layer of security beyond passwords, requiring users to provide a second form of verification (something they have) in addition to their password (something they know).

### Implementation Strategy

**Method:** Time-based One-Time Password (TOTP) using RFC 6238

**Supported Authenticator Apps:**
- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password
- LastPass Authenticator

---

### Technical Specification

#### Database Schema

```sql
-- Add to users table
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255);  -- Encrypted
ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT[];  -- Encrypted array

-- Create 2FA audit log table
CREATE TABLE two_factor_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,  -- enabled, disabled, verified, failed, backup_used
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_2fa_audit_user ON two_factor_audit(user_id, timestamp DESC);
CREATE INDEX idx_2fa_audit_action ON two_factor_audit(action, timestamp DESC);
```

---

#### 2FA Setup Flow

**Step 1: User Initiates 2FA Setup**
```typescript
// Endpoint: POST /auth/2fa/setup
async function initiate2FASetup(userId: string) {
  // Generate secret (32-byte base32)
  const secret = speakeasy.generateSecret({
    name: 'NovaCoreAI',
    issuer: 'NovaCoreAI',
    length: 32
  });
  
  // Generate QR code for easy scanning
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
  
  // Store encrypted secret (NOT yet enabled)
  await db.query(
    'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
    [encrypt(secret.base32), userId]
  );
  
  return {
    secret: secret.base32,  // Show once, user must save
    qrCode: qrCodeUrl,
    backupCodes: []  // Generated after verification
  };
}
```

**Step 2: User Verifies 2FA Setup**
```typescript
// Endpoint: POST /auth/2fa/verify-setup
async function verify2FASetup(userId: string, token: string) {
  const user = await getUser(userId);
  const secret = decrypt(user.two_factor_secret);
  
  // Verify TOTP token
  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1  // Allow 30-second window
  });
  
  if (!verified) {
    throw new Error('Invalid verification code');
  }
  
  // Generate backup codes (10 single-use codes)
  const backupCodes = generateBackupCodes(10);
  
  // Enable 2FA and store backup codes
  await db.query(
    `UPDATE users 
     SET two_factor_enabled = TRUE,
         two_factor_backup_codes = $1
     WHERE id = $2`,
    [backupCodes.map(encrypt), userId]
  );
  
  // Audit log
  await log2FAEvent(userId, 'enabled');
  
  return {
    backupCodes: backupCodes,  // Show once, user must save
    message: '2FA successfully enabled'
  };
}
```

**Step 3: Login with 2FA**
```typescript
// Endpoint: POST /auth/login-2fa
async function loginWith2FA(email: string, password: string, token: string) {
  // Step 1: Verify password
  const user = await verifyPassword(email, password);
  
  if (!user.two_factor_enabled) {
    // Standard login flow
    return generateTokens(user);
  }
  
  // Step 2: Verify TOTP token
  const secret = decrypt(user.two_factor_secret);
  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1
  });
  
  if (!verified) {
    // Check if it's a backup code
    const backupUsed = await verifyBackupCode(user.id, token);
    if (!backupUsed) {
      await log2FAEvent(user.id, 'failed');
      throw new UnauthorizedException('Invalid 2FA code');
    }
  }
  
  await log2FAEvent(user.id, 'verified');
  
  return generateTokens(user);
}
```

---

#### Backup Codes

**Generation:**
```typescript
function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}
```

**Usage:**
- One-time use only
- User should save securely (print or password manager)
- Used when authenticator app unavailable
- Generate new codes after 50% used

---

#### Recovery Process

**Lost Authenticator App:**
1. User clicks "I lost my authenticator app"
2. System prompts for backup code
3. User enters backup code
4. System verifies and marks code as used
5. User can disable 2FA or set up new device

**Lost Backup Codes:**
1. User contacts support (email verification required)
2. Support verifies identity (additional questions)
3. Support temporarily disables 2FA (48-hour window)
4. User logs in and re-enables 2FA
5. Incident logged for audit

---

### User Experience

**Setup Flow:**
```
[Enable 2FA Button] → [Show QR Code] → [Scan with App] → 
[Enter Verification Code] → [Display Backup Codes] → [✅ Enabled]
```

**Login Flow (2FA Enabled):**
```
[Enter Email/Password] → [Enter 2FA Code] → [✅ Logged In]
                              ↓
                    [Use Backup Code Instead]
```

**Account Settings:**
- View 2FA status (Enabled/Disabled)
- Disable 2FA (requires current code)
- Generate new backup codes
- View 2FA device list (future: multi-device)

---

### Security Considerations

**Rate Limiting:**
- 5 failed 2FA attempts = 15-minute lockout
- Backup code attempts counted separately
- Lockout resets on successful verification

**Token Replay Prevention:**
- Each TOTP token valid for 30 seconds
- Window of 1 period (±30s) for clock drift
- Previously used tokens cached (Redis, 60s TTL)

**Recovery Security:**
- Support recovery requires:
  - Email verification (link sent to registered email)
  - Security questions (future enhancement)
  - Account activity verification
- All recovery actions logged and reviewed

---

### Implementation Timeline

**Phase 1: Core Implementation (1 week)**
- Database schema changes
- Backend API endpoints
- TOTP library integration
- Basic testing

**Phase 2: Frontend UI (1 week)**
- 2FA setup wizard
- Login flow with 2FA
- Account settings page
- QR code display and scanning instructions

**Phase 3: Recovery & Polish (3 days)**
- Backup code system
- Recovery procedures
- Support tooling
- Comprehensive testing

**Total Time:** 2.5 weeks (1 full-stack developer)

---

## 2. Security Audit Logging

### Overview

Comprehensive logging of all security-relevant events for compliance, forensics, and threat detection.

---

### Log Categories

#### Authentication Events
```json
{
  "category": "authentication",
  "event": "login_success|login_failure|logout|token_refresh|password_change",
  "user_id": "uuid",
  "email": "user@example.com",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "geo_location": {
    "country": "US",
    "city": "New York",
    "lat": 40.7128,
    "lon": -74.0060
  },
  "timestamp": "2025-11-10T10:00:00Z",
  "metadata": {
    "mfa_used": true,
    "device_fingerprint": "abc123"
  }
}
```

#### Authorization Events
```json
{
  "category": "authorization",
  "event": "permission_denied|role_changed|access_granted",
  "user_id": "uuid",
  "resource": "/api/admin/users",
  "action": "read|write|delete",
  "result": "allowed|denied",
  "reason": "insufficient_permissions",
  "timestamp": "2025-11-10T10:00:00Z"
}
```

#### Data Access Events
```json
{
  "category": "data_access",
  "event": "user_data_accessed|user_data_modified|user_data_deleted",
  "actor_id": "uuid",
  "actor_type": "user|service|admin",
  "subject_id": "uuid",  // User whose data was accessed
  "data_type": "profile|messages|memories",
  "action": "read|update|delete",
  "timestamp": "2025-11-10T10:00:00Z"
}
```

#### Security Events
```json
{
  "category": "security",
  "event": "rate_limit_exceeded|suspicious_activity|bruteforce_attempt|sql_injection_attempt",
  "user_id": "uuid",
  "ip_address": "192.168.1.1",
  "severity": "low|medium|high|critical",
  "details": "Description of security event",
  "automated_response": "ip_blocked|account_locked|alert_sent",
  "timestamp": "2025-11-10T10:00:00Z"
}
```

---

### Implementation

**Storage: PostgreSQL + Elasticsearch**

**PostgreSQL:** Hot storage (30 days)
```sql
CREATE TABLE security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  event VARCHAR(100) NOT NULL,
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  geo_location JSONB,
  severity VARCHAR(20),
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_audit_user ON security_audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_event ON security_audit_log(event, timestamp DESC);
CREATE INDEX idx_audit_ip ON security_audit_log(ip_address, timestamp DESC);
CREATE INDEX idx_audit_severity ON security_audit_log(severity, timestamp DESC);

-- Partition by month for performance
CREATE TABLE security_audit_log_2025_11 PARTITION OF security_audit_log
FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

**Elasticsearch:** Cold storage + Search (1 year+)
- Automatic archival after 30 days
- Full-text search capability
- Complex query support
- Visualization with Kibana

---

### Audit Dashboard

**Key Metrics:**
- Failed login attempts (by user, by IP)
- Successful logins (by time, by location)
- Permission denials (by user, by resource)
- Security events (by severity, by type)
- Unusual activity patterns

**Kibana Visualizations:**
1. Login heatmap (time x geography)
2. Failed authentication trends
3. Top suspicious IPs
4. Permission denial breakdown
5. Security event timeline

---

### Compliance Reports

**Monthly Security Report:**
- Total authentication events
- Failed login rate
- Account lockouts
- 2FA adoption rate
- Security incidents
- Permission changes
- Data access patterns

**Audit Trail for Compliance:**
- Who accessed what data when
- All permission changes with approvers
- Security configuration changes
- Incident response actions

---

## 3. Anomaly Detection

### Overview

Automated detection of unusual patterns that may indicate security threats, compromised accounts, or system abuse.

---

### Detection Categories

#### 1. Authentication Anomalies

**Impossible Travel:**
```python
# User logs in from New York, then Tokyo 2 hours later
def detect_impossible_travel(user_id: str, new_login: LoginEvent):
    last_login = get_last_login(user_id)
    
    distance_km = calculate_distance(
        last_login.geo_location,
        new_login.geo_location
    )
    
    time_diff_hours = (new_login.timestamp - last_login.timestamp).hours
    
    # Human travel speed ~900 km/h (airplane)
    max_possible_distance = time_diff_hours * 900
    
    if distance_km > max_possible_distance:
        alert_security_team({
            'type': 'impossible_travel',
            'user_id': user_id,
            'distance_km': distance_km,
            'time_hours': time_diff_hours,
            'severity': 'high'
        })
        
        # Require 2FA or email verification
        return {'require_additional_auth': True}
```

**Unusual Time:**
```python
# User typically logs in 9 AM - 6 PM ET, now logging in at 3 AM
def detect_unusual_time(user_id: str, login_time: datetime):
    user_pattern = get_user_login_pattern(user_id)
    
    if not in_typical_hours(login_time, user_pattern):
        alert_user({
            'type': 'unusual_login_time',
            'message': 'Login detected at unusual time. Was this you?',
            'action_required': 'verify_email'
        })
```

**New Device:**
```python
# User logs in from unrecognized device
def detect_new_device(user_id: str, device_fingerprint: str):
    known_devices = get_user_devices(user_id)
    
    if device_fingerprint not in known_devices:
        send_email({
            'to': user.email,
            'subject': 'New device login detected',
            'body': f'Login from {device_info}. If this wasn\'t you, secure your account immediately.'
        })
        
        # Add device to known devices after confirmation
        add_device(user_id, device_fingerprint)
```

---

#### 2. Usage Anomalies

**Unusual API Usage:**
```python
# User suddenly makes 1000 API calls (normal: 50/day)
def detect_usage_spike(user_id: str):
    current_usage = get_today_usage(user_id)
    avg_usage = get_avg_daily_usage(user_id, days=30)
    
    if current_usage > avg_usage * 10:  # 10x spike
        alert_security_team({
            'type': 'usage_spike',
            'user_id': user_id,
            'current': current_usage,
            'average': avg_usage,
            'severity': 'medium'
        })
        
        # Optionally soft-limit to prevent abuse
        if current_usage > avg_usage * 20:
            enable_rate_limiting(user_id, strict=True)
```

**Unusual Data Access:**
```python
# User accesses 500 other users' data (potential data scraping)
def detect_data_scraping(user_id: str):
    accessed_users = get_accessed_users_today(user_id)
    
    if len(accessed_users) > 100:  # Threshold for suspicion
        flag_account({
            'user_id': user_id,
            'reason': 'potential_data_scraping',
            'accessed_count': len(accessed_users),
            'action': 'manual_review_required'
        })
        
        # Temporarily restrict access
        restrict_account(user_id, duration='24h')
```

---

#### 3. System Anomalies

**SQL Injection Attempts:**
```python
# Detect SQL injection patterns in user input
def detect_sql_injection(input_text: str, user_id: str):
    sql_patterns = [
        r"('|(\")|(%27)|(\'')|(\\'))+.*((union)|(select)|(insert)|(update)|(delete)|(drop))",
        r"(union.*select|select.*from|insert.*into)",
        r"(\bor\b.*\b=\b|\band\b.*\b=\b)",
        r"(;|\-\-|\/\*|\*\/|xp_|sp_|exec)"
    ]
    
    for pattern in sql_patterns:
        if re.search(pattern, input_text, re.IGNORECASE):
            log_security_event({
                'type': 'sql_injection_attempt',
                'user_id': user_id,
                'input': input_text[:200],  # First 200 chars
                'pattern': pattern,
                'severity': 'high',
                'automated_action': 'blocked'
            })
            
            raise SecurityException('Invalid input detected')
```

**XSS Attempts:**
```python
# Detect XSS patterns after sanitization fails
def detect_xss_attempt(input_text: str, user_id: str):
    xss_patterns = [
        r"<script.*?>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",  # Event handlers
        r"<iframe",
        r"<object",
        r"<embed"
    ]
    
    for pattern in xss_patterns:
        if re.search(pattern, input_text, re.IGNORECASE):
            log_security_event({
                'type': 'xss_attempt',
                'user_id': user_id,
                'severity': 'high'
            })
            
            # Input already sanitized, but log the attempt
            return True
    
    return False
```

---

### Machine Learning Anomaly Detection (Future)

**User Behavior Baseline:**
- Average tokens per message
- Typical message frequency
- Common topics/keywords
- Login patterns (time, location, device)

**Anomaly Scoring:**
```python
class AnomalyDetector:
    def calculate_anomaly_score(self, user_id: str, event: dict) -> float:
        """
        Returns anomaly score 0.0 (normal) to 1.0 (highly anomalous)
        """
        baseline = self.get_user_baseline(user_id)
        
        scores = []
        scores.append(self.score_time_deviation(event, baseline))
        scores.append(self.score_location_deviation(event, baseline))
        scores.append(self.score_usage_deviation(event, baseline))
        scores.append(self.score_pattern_deviation(event, baseline))
        
        # Weighted average
        weights = [0.3, 0.3, 0.2, 0.2]
        anomaly_score = sum(s * w for s, w in zip(scores, weights))
        
        if anomaly_score > 0.7:
            self.alert_high_anomaly(user_id, event, anomaly_score)
        
        return anomaly_score
```

---

### Alert Thresholds

| Anomaly Type | Threshold | Action |
|--------------|-----------|--------|
| Impossible travel | Always | Require additional auth |
| New device | Always | Email notification |
| Unusual time | Score > 0.6 | Email notification |
| Usage spike (10x) | Always | Alert security team |
| Usage spike (20x) | Always | Enable rate limiting |
| SQL injection | Always | Block + Alert |
| XSS attempt | Always | Block + Log |
| Data scraping | >100 users/day | Account review |
| Failed logins | 5 attempts | Account lockout |

---

## 4. Penetration Testing Program

### Overview

Regular security testing to identify vulnerabilities before attackers do.

---

### Testing Frequency

**Automated Scanning:** Weekly
- OWASP ZAP automated scans
- Dependency vulnerability scanning (npm audit, pip-audit)
- Container security scanning (Trivy)

**Manual Testing:** Quarterly
- Penetration testing by security team
- Focus areas rotate each quarter

**Third-Party Audit:** Annually
- Professional penetration testing firm
- Comprehensive assessment
- Required for SOC 2 compliance

---

### Scope of Testing

**In Scope:**
- All API endpoints
- Authentication and authorization
- Session management
- Input validation
- File uploads (when implemented)
- Payment processing integration
- Admin interfaces
- Service-to-service communication

**Out of Scope:**
- Third-party services (Stripe, SendGrid)
- Infrastructure provider (DigitalOcean)
- Client-side only issues (unless server impact)

---

### Testing Methodology

**Phase 1: Reconnaissance**
- Identify all entry points
- Map application architecture
- Enumerate endpoints and parameters
- Technology fingerprinting

**Phase 2: Vulnerability Identification**
- Automated scanning (OWASP ZAP, Burp Suite)
- Manual testing of critical functions
- Authentication bypass attempts
- Authorization escalation attempts
- Input validation testing
- Session management review

**Phase 3: Exploitation**
- Attempt to exploit discovered vulnerabilities
- Assess real-world impact
- Document proof-of-concept
- Evaluate data exposure risk

**Phase 4: Reporting**
- Vulnerability classification (CVSS scoring)
- Remediation recommendations
- Timeline for fixes
- Re-testing schedule

---

### Vulnerability Classification

**Critical (CVSS 9.0-10.0):**
- Complete system compromise
- Full database access
- Authentication bypass
- Remote code execution
- Fix: Immediate (24 hours)

**High (CVSS 7.0-8.9):**
- Privilege escalation
- SQL injection
- Significant data exposure
- Fix: 1 week

**Medium (CVSS 4.0-6.9):**
- Cross-site scripting (XSS)
- Information disclosure
- Denial of service
- Fix: 2-4 weeks

**Low (CVSS 0.1-3.9):**
- Minor information leakage
- Non-critical misconfigurations
- Fix: Next sprint

---

### Bug Bounty Program (Future)

**When to Launch:** After 1 year of operation with stable user base

**Scope:**
- Public-facing web application
- API endpoints
- Authentication/authorization
- Payment processing

**Rewards:**
- Critical: $500 - $2,000
- High: $250 - $500
- Medium: $100 - $250
- Low: $50 - $100

**Platform:** HackerOne or Bugcrowd

---

## Implementation Roadmap

### Month 1: Security Audit Logging
- Week 1: Database schema and basic logging
- Week 2: Elasticsearch integration
- Week 3: Kibana dashboards
- Week 4: Compliance reports

### Month 2: Two-Factor Authentication
- Week 1: Backend API and TOTP implementation
- Week 2: Frontend UI and setup flow
- Week 3: Recovery procedures and backup codes
- Week 4: Testing and documentation

### Month 3: Anomaly Detection
- Week 1: Authentication anomaly detection
- Week 2: Usage anomaly detection
- Week 3: Alerting and automated responses
- Week 4: Dashboard and monitoring

### Month 4: Penetration Testing
- Week 1: Automated scanning setup
- Week 2: First manual penetration test
- Week 3: Remediation of findings
- Week 4: Re-testing and documentation

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| 2FA adoption rate | >30% within 6 months | User settings data |
| Audit log coverage | 100% of security events | Log completeness check |
| Anomaly detection accuracy | >90% true positive rate | Manual review validation |
| Penetration test findings | <5 medium+ per quarter | Test reports |
| Mean time to remediation | <7 days for high severity | Ticket tracking |
| Security incidents | <1 per quarter | Incident log |

---

## Conclusion

These advanced security features provide defense-in-depth protection and position NovaCoreAI for enterprise adoption and compliance certifications. Implementation should proceed after MVP stability is achieved and can be phased based on business priorities and resource availability.

---

**Document Status:** Complete Design Specification  
**Implementation Priority:** P3 (Post-MVP)  
**Estimated Total Effort:** 3-4 months (1 full-stack developer + security oversight)  
**Next Review:** Post-MVP launch  
**Maintained By:** Cloud and Cybersecurity Specialist

---

**END OF ADVANCED SECURITY FEATURES SPECIFICATION**
