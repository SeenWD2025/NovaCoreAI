# Authentication Security Specification

**Document Version:** 1.0  
**Date:** November 9, 2025  
**Prepared By:** Cloud and Cybersecurity Specialist  
**Status:** Active Security Specification

---

## Executive Summary

This document specifies comprehensive authentication security measures for NovaCoreAI, including email verification, login throttling, password security, and session management. These controls prevent unauthorized access, brute force attacks, and account compromise.

---

## 1. Email Verification System

### 1.1 Overview

**Purpose:** Verify user email addresses to prevent:
- Fake account creation
- Email spoofing
- Account takeover via email
- Spam and abuse

**Verification Flow:**
1. User registers with email and password
2. System generates unique verification token
3. Verification email sent to user's email address
4. User clicks link with token
5. System validates token and marks email as verified
6. User gains full access to features

### 1.2 Token Generation

**Security Requirements:**
- **Entropy:** 32 bytes (256 bits) minimum
- **Randomness:** Cryptographically secure PRNG
- **Uniqueness:** Each token must be unique
- **Format:** URL-safe Base64 encoding

**Implementation (Node.js/TypeScript):**

```typescript
import * as crypto from 'crypto';

/**
 * Generate cryptographically secure verification token
 * @returns Base64-encoded 32-byte random token
 */
function generateVerificationToken(): string {
  const token = crypto.randomBytes(32).toString('base64url');
  return token;
}

// Example output: "XYZ123abc-DEF456ghi_789JKLmno"
```

**Implementation (Python):**

```python
import secrets
import base64

def generate_verification_token() -> str:
    """
    Generate cryptographically secure verification token
    Returns Base64-encoded 32-byte random token
    """
    token_bytes = secrets.token_bytes(32)
    token = base64.urlsafe_b64encode(token_bytes).decode('utf-8')
    return token.rstrip('=')  # Remove padding for cleaner URLs
```

### 1.3 Token Storage

**Database Schema:**

```sql
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    CONSTRAINT check_not_expired CHECK (expires_at > created_at)
);

CREATE INDEX idx_verification_token ON email_verification_tokens(token);
CREATE INDEX idx_verification_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_verification_expires_at ON email_verification_tokens(expires_at);
```

**Token Properties:**
- **Expiration:** 24 hours from generation
- **Single-Use:** Token deleted or marked as used after verification
- **User Association:** Tied to specific user ID

**Implementation:**

```typescript
interface VerificationToken {
  id: string;
  userId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

async function createVerificationToken(userId: string): Promise<VerificationToken> {
  const token = generateVerificationToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 hours
  
  const verificationToken = await db.emailVerificationTokens.create({
    userId,
    token,
    createdAt: now,
    expiresAt,
    usedAt: null
  });
  
  return verificationToken;
}
```

### 1.4 Verification Email

**Email Template Security:**

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Verify Your Email - NovaCoreAI</title>
</head>
<body>
    <h1>Welcome to NovaCoreAI!</h1>
    <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
    
    <p>
        <a href="{{verificationUrl}}" style="background-color: #4CAF50; color: white; padding: 14px 25px; text-align: center; text-decoration: none; display: inline-block;">
            Verify Email Address
        </a>
    </p>
    
    <p>Or copy and paste this URL into your browser:</p>
    <p>{{verificationUrl}}</p>
    
    <p><strong>This link will expire in 24 hours.</strong></p>
    
    <p>If you did not create an account, please ignore this email.</p>
    
    <hr>
    <p style="color: #666; font-size: 12px;">
        This is an automated email. Please do not reply.
    </p>
</body>
</html>
```

**URL Construction:**

```typescript
function buildVerificationUrl(token: string): string {
  const baseUrl = process.env.FRONTEND_URL || 'https://novacore.ai';
  return `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
}
```

**Email Sending (using SendGrid):**

```typescript
import * as sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendVerificationEmail(
  email: string, 
  token: string
): Promise<void> {
  const verificationUrl = buildVerificationUrl(token);
  
  const msg = {
    to: email,
    from: 'noreply@novacore.ai',
    subject: 'Verify Your Email - NovaCoreAI',
    text: `Welcome to NovaCoreAI! Please verify your email by visiting: ${verificationUrl}`,
    html: renderEmailTemplate({ verificationUrl }),
  };
  
  try {
    await sgMail.send(msg);
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send verification email:`, error);
    throw new Error('Failed to send verification email');
  }
}
```

### 1.5 Verification Process

**Endpoint:** `GET /auth/verify-email?token=<token>`

**Implementation:**

```typescript
@Get('verify-email')
async verifyEmail(@Query('token') token: string): Promise<{ success: boolean; message: string }> {
  if (!token) {
    throw new BadRequestException('Verification token is required');
  }
  
  // Find token in database
  const verificationToken = await db.emailVerificationTokens.findOne({
    where: { token },
    include: ['user']
  });
  
  if (!verificationToken) {
    throw new BadRequestException('Invalid verification token');
  }
  
  // Check if already used
  if (verificationToken.usedAt) {
    throw new BadRequestException('Verification token has already been used');
  }
  
  // Check if expired
  if (new Date() > verificationToken.expiresAt) {
    throw new BadRequestException('Verification token has expired');
  }
  
  // Mark email as verified
  await db.users.update(
    { emailVerified: true },
    { where: { id: verificationToken.userId } }
  );
  
  // Mark token as used
  await db.emailVerificationTokens.update(
    { usedAt: new Date() },
    { where: { id: verificationToken.id } }
  );
  
  // Log successful verification
  await auditLog.log({
    action: 'email_verified',
    userId: verificationToken.userId,
    timestamp: new Date()
  });
  
  return {
    success: true,
    message: 'Email successfully verified'
  };
}
```

### 1.6 Resend Verification Email

**Endpoint:** `POST /auth/resend-verification`

**Rate Limiting:** Maximum 3 requests per hour per user

**Implementation:**

```typescript
@Post('resend-verification')
@UseGuards(JwtAuthGuard, ThrottleGuard)
@Throttle(3, 3600) // 3 requests per hour
async resendVerificationEmail(@CurrentUser() user: User): Promise<{ message: string }> {
  // Check if already verified
  if (user.emailVerified) {
    throw new BadRequestException('Email is already verified');
  }
  
  // Invalidate old tokens
  await db.emailVerificationTokens.update(
    { usedAt: new Date() },
    { where: { userId: user.id, usedAt: null } }
  );
  
  // Create new token
  const verificationToken = await createVerificationToken(user.id);
  
  // Send new email
  await sendVerificationEmail(user.email, verificationToken.token);
  
  return {
    message: 'Verification email has been resent'
  };
}
```

### 1.7 Access Control Based on Verification

**Middleware to Require Verified Email:**

```typescript
function requireVerifiedEmail() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!user.emailVerified) {
      return res.status(403).json({ 
        error: 'Email verification required',
        message: 'Please verify your email address to access this feature'
      });
    }
    
    next();
  };
}

// Apply to protected routes
app.post('/api/intelligence/chat', 
  authenticate(), 
  requireVerifiedEmail(), 
  chatHandler
);
```

### 1.8 Security Considerations

**Threat:** Token Enumeration
**Mitigation:** Use long, random tokens (32 bytes = 10^77 possibilities)

**Threat:** Token Leakage via Referer Header
**Mitigation:** Use POST request with token in body instead of GET with token in URL (optional enhancement)

**Threat:** Email Hijacking
**Mitigation:** 
- Send verification emails over TLS
- Use SPF, DKIM, and DMARC for email authentication
- Include warning about suspicious emails

**Threat:** Timing Attack on Token Verification
**Mitigation:** Use constant-time comparison for token strings

```typescript
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

---

## 2. Login Throttling

### 2.1 Overview

**Purpose:** Prevent brute force attacks on user accounts

**Strategy:**
- Track failed login attempts per email address
- Temporarily block login after threshold exceeded
- Reset counter on successful login
- Exponential backoff for repeated failures

### 2.2 Throttling Rules

**Thresholds:**
- **5 failed attempts:** 15-minute lockout
- **10 failed attempts:** 1-hour lockout
- **20 failed attempts:** 24-hour lockout

**Storage:** Redis (fast, TTL support)

**Key Format:** `login_attempts:{email}:{date}`

### 2.3 Implementation

**Redis Schema:**

```typescript
interface LoginAttemptRecord {
  email: string;
  failureCount: number;
  firstFailureAt: Date;
  lastFailureAt: Date;
  blockedUntil: Date | null;
}
```

**Track Failed Login:**

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class LoginThrottlingService {
  constructor(private readonly redis: RedisService) {}
  
  /**
   * Record failed login attempt
   * @returns Seconds until user can retry, or 0 if not blocked
   */
  async recordFailedAttempt(email: string): Promise<number> {
    const key = `login_attempts:${email.toLowerCase()}`;
    const now = Date.now();
    
    // Get current attempt count
    const record = await this.redis.get(key);
    let attemptData: LoginAttemptRecord;
    
    if (record) {
      attemptData = JSON.parse(record);
      attemptData.failureCount++;
      attemptData.lastFailureAt = new Date(now);
    } else {
      attemptData = {
        email: email.toLowerCase(),
        failureCount: 1,
        firstFailureAt: new Date(now),
        lastFailureAt: new Date(now),
        blockedUntil: null
      };
    }
    
    // Calculate lockout duration
    let lockoutSeconds = 0;
    if (attemptData.failureCount >= 20) {
      lockoutSeconds = 24 * 60 * 60; // 24 hours
    } else if (attemptData.failureCount >= 10) {
      lockoutSeconds = 60 * 60; // 1 hour
    } else if (attemptData.failureCount >= 5) {
      lockoutSeconds = 15 * 60; // 15 minutes
    }
    
    if (lockoutSeconds > 0) {
      attemptData.blockedUntil = new Date(now + lockoutSeconds * 1000);
    }
    
    // Store with TTL
    await this.redis.setex(
      key,
      Math.max(lockoutSeconds, 3600), // At least 1 hour retention
      JSON.stringify(attemptData)
    );
    
    return lockoutSeconds;
  }
  
  /**
   * Check if login is allowed
   * @returns Seconds until unblocked, or 0 if allowed
   */
  async checkLoginAllowed(email: string): Promise<number> {
    const key = `login_attempts:${email.toLowerCase()}`;
    const record = await this.redis.get(key);
    
    if (!record) {
      return 0; // No failed attempts, login allowed
    }
    
    const attemptData: LoginAttemptRecord = JSON.parse(record);
    
    if (!attemptData.blockedUntil) {
      return 0; // Not blocked
    }
    
    const now = Date.now();
    const blockedUntilTime = new Date(attemptData.blockedUntil).getTime();
    
    if (now >= blockedUntilTime) {
      // Block expired, clear record
      await this.redis.del(key);
      return 0;
    }
    
    // Calculate remaining block time
    return Math.ceil((blockedUntilTime - now) / 1000);
  }
  
  /**
   * Clear failed attempts on successful login
   */
  async clearFailedAttempts(email: string): Promise<void> {
    const key = `login_attempts:${email.toLowerCase()}`;
    await this.redis.del(key);
  }
  
  /**
   * Get remaining attempts before lockout
   */
  async getRemainingAttempts(email: string): Promise<number> {
    const key = `login_attempts:${email.toLowerCase()}`;
    const record = await this.redis.get(key);
    
    if (!record) {
      return 5; // Full attempts available
    }
    
    const attemptData: LoginAttemptRecord = JSON.parse(record);
    return Math.max(0, 5 - attemptData.failureCount);
  }
}
```

**Login Endpoint with Throttling:**

```typescript
@Post('login')
async login(
  @Body() loginDto: LoginDto,
  @Ip() ip: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const { email, password } = loginDto;
  
  // Check if login is blocked
  const blockedSeconds = await this.throttling.checkLoginAllowed(email);
  if (blockedSeconds > 0) {
    const minutes = Math.ceil(blockedSeconds / 60);
    throw new TooManyRequestsException(
      `Too many failed login attempts. Please try again in ${minutes} minutes.`,
      { retryAfter: blockedSeconds }
    );
  }
  
  // Attempt authentication
  const user = await this.authService.validateUser(email, password);
  
  if (!user) {
    // Record failed attempt
    const lockoutSeconds = await this.throttling.recordFailedAttempt(email);
    
    // Log failed attempt
    await this.auditLog.log({
      action: 'login_failed',
      email,
      ip,
      timestamp: new Date()
    });
    
    if (lockoutSeconds > 0) {
      const minutes = Math.ceil(lockoutSeconds / 60);
      throw new UnauthorizedException(
        `Invalid credentials. Account temporarily locked due to multiple failed attempts. Try again in ${minutes} minutes.`
      );
    }
    
    const remaining = await this.throttling.getRemainingAttempts(email);
    throw new UnauthorizedException(
      `Invalid credentials. ${remaining} attempts remaining before account lockout.`
    );
  }
  
  // Successful login - clear failed attempts
  await this.throttling.clearFailedAttempts(email);
  
  // Generate tokens
  const tokens = await this.authService.generateTokens(user);
  
  // Log successful login
  await this.auditLog.log({
    action: 'login_success',
    userId: user.id,
    email,
    ip,
    timestamp: new Date()
  });
  
  return tokens;
}
```

### 2.4 Response Headers

**Include Retry-After Header:**

```typescript
@Catch(TooManyRequestsException)
export class ThrottleExceptionFilter implements ExceptionFilter {
  catch(exception: TooManyRequestsException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;
    
    response
      .status(status)
      .header('Retry-After', exceptionResponse.retryAfter || 900) // Default 15 minutes
      .json({
        statusCode: status,
        message: exception.message,
        retryAfter: exceptionResponse.retryAfter
      });
  }
}
```

### 2.5 Optional: CAPTCHA Integration

**After 3 Failed Attempts:** Show CAPTCHA

**Implementation with Google reCAPTCHA:**

```typescript
async function verifyCaptcha(token: string): Promise<boolean> {
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${process.env.RECAPTCHA_SECRET}&response=${token}`
  });
  
  const data = await response.json();
  return data.success && data.score > 0.5; // reCAPTCHA v3 score threshold
}

@Post('login')
async login(@Body() loginDto: LoginDto): Promise<any> {
  const { email, password, captchaToken } = loginDto;
  
  // Check if CAPTCHA required
  const record = await this.throttling.getAttemptRecord(email);
  if (record && record.failureCount >= 3) {
    if (!captchaToken) {
      throw new BadRequestException('CAPTCHA verification required');
    }
    
    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid) {
      throw new BadRequestException('CAPTCHA verification failed');
    }
  }
  
  // Continue with login...
}
```

---

## 3. Password Security

### 3.1 Password Requirements

**Minimum Requirements:**
- Minimum length: 8 characters
- Maximum length: 128 characters
- At least one lowercase letter (a-z)
- At least one uppercase letter (A-Z)
- At least one digit (0-9)
- At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

**Recommended:**
- Minimum length: 12 characters
- Mix of character types
- Avoid common passwords
- Avoid personal information (name, birthdate)

### 3.2 Password Validation

```typescript
interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }
  
  // Character requirements
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Common password check
  if (isCommonPassword(password)) {
    errors.push('Password is too common. Please choose a more unique password.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Check against common password list
function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password', 'password123', '123456', '123456789', 'qwerty',
    'abc123', 'monkey', '1234567', 'letmein', 'trustno1',
    'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
    'ashley', 'bailey', 'passw0rd', 'shadow', '123123'
    // Load full list from file in production
  ];
  
  return commonPasswords.includes(password.toLowerCase());
}
```

### 3.3 Password Hashing

**Algorithm:** bcrypt with cost factor 12

**Why bcrypt:**
- Designed for password hashing
- Adaptive (cost factor can be increased)
- Includes salt automatically
- Resistant to rainbow table attacks
- Computationally expensive (slows brute force)

**Implementation:**

```typescript
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // Cost factor

/**
 * Hash password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  return hash;
}

/**
 * Verify password against hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const isValid = await bcrypt.compare(password, hash);
  return isValid;
}
```

**Registration with Password Hashing:**

```typescript
@Post('register')
async register(@Body() registerDto: RegisterDto): Promise<{ user: User }> {
  const { email, password, name } = registerDto;
  
  // Validate password strength
  const validation = validatePassword(password);
  if (!validation.isValid) {
    throw new BadRequestException({
      message: 'Password does not meet security requirements',
      errors: validation.errors
    });
  }
  
  // Check if user exists
  const existingUser = await db.users.findOne({ where: { email } });
  if (existingUser) {
    throw new ConflictException('User with this email already exists');
  }
  
  // Hash password
  const passwordHash = await hashPassword(password);
  
  // Create user
  const user = await db.users.create({
    email,
    passwordHash,
    name,
    emailVerified: false
  });
  
  // Create verification token
  const verificationToken = await createVerificationToken(user.id);
  
  // Send verification email
  await sendVerificationEmail(email, verificationToken.token);
  
  return { user: sanitizeUser(user) };
}
```

### 3.4 Password Change

**Requirements:**
- User must be authenticated
- Must provide current password
- New password must meet strength requirements
- New password must be different from old password

```typescript
@Post('change-password')
@UseGuards(JwtAuthGuard)
async changePassword(
  @CurrentUser() user: User,
  @Body() changePasswordDto: ChangePasswordDto
): Promise<{ message: string }> {
  const { currentPassword, newPassword } = changePasswordDto;
  
  // Verify current password
  const isValidPassword = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new UnauthorizedException('Current password is incorrect');
  }
  
  // Validate new password
  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    throw new BadRequestException({
      message: 'New password does not meet security requirements',
      errors: validation.errors
    });
  }
  
  // Ensure new password is different
  if (currentPassword === newPassword) {
    throw new BadRequestException('New password must be different from current password');
  }
  
  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);
  
  // Update password
  await db.users.update(
    { passwordHash: newPasswordHash },
    { where: { id: user.id } }
  );
  
  // Invalidate all refresh tokens (force re-login)
  await db.refreshTokens.destroy({ where: { userId: user.id } });
  
  // Log password change
  await auditLog.log({
    action: 'password_changed',
    userId: user.id,
    timestamp: new Date()
  });
  
  // Send notification email
  await sendPasswordChangedNotification(user.email);
  
  return { message: 'Password successfully changed' };
}
```

---

## 4. Session Management

### 4.1 JWT Token Strategy

**Token Types:**
- **Access Token:** Short-lived (15 minutes), used for API authentication
- **Refresh Token:** Long-lived (7 days), used to obtain new access tokens

**Why Two Tokens:**
- Limits exposure of long-lived credentials
- Allows token revocation without affecting all sessions
- Balances security with user experience

### 4.2 Access Token

**Claims:**

```json
{
  "sub": "user-id-123",
  "email": "user@example.com",
  "tier": "pro",
  "iat": 1699564800,
  "exp": 1699565700,
  "jti": "unique-token-id"
}
```

**Generation:**

```typescript
function generateAccessToken(user: User): string {
  const payload = {
    sub: user.id,
    email: user.email,
    tier: user.tier,
    emailVerified: user.emailVerified
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
    algorithm: 'HS256',
    jwtid: crypto.randomBytes(16).toString('hex')
  });
}
```

### 4.3 Refresh Token

**Storage:** Database with user association

**Schema:**

```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    device_info TEXT NULL
);

CREATE INDEX idx_refresh_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_user_id ON refresh_tokens(user_id);
```

**Generation:**

```typescript
async function generateRefreshToken(user: User, deviceInfo?: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await db.refreshTokens.create({
    userId: user.id,
    token,
    expiresAt,
    deviceInfo
  });
  
  return token;
}
```

**Token Refresh Endpoint:**

```typescript
@Post('refresh')
async refreshAccessToken(
  @Body('refreshToken') refreshToken: string
): Promise<{ accessToken: string }> {
  // Find refresh token
  const tokenRecord = await db.refreshTokens.findOne({
    where: { token: refreshToken },
    include: ['user']
  });
  
  if (!tokenRecord) {
    throw new UnauthorizedException('Invalid refresh token');
  }
  
  // Check if revoked
  if (tokenRecord.revokedAt) {
    throw new UnauthorizedException('Refresh token has been revoked');
  }
  
  // Check if expired
  if (new Date() > tokenRecord.expiresAt) {
    throw new UnauthorizedException('Refresh token has expired');
  }
  
  // Update last used
  await db.refreshTokens.update(
    { lastUsedAt: new Date() },
    { where: { id: tokenRecord.id } }
  );
  
  // Generate new access token
  const accessToken = generateAccessToken(tokenRecord.user);
  
  return { accessToken };
}
```

### 4.4 Logout

**Revoke Refresh Token:**

```typescript
@Post('logout')
@UseGuards(JwtAuthGuard)
async logout(
  @CurrentUser() user: User,
  @Body('refreshToken') refreshToken: string
): Promise<{ message: string }> {
  // Revoke specific refresh token
  await db.refreshTokens.update(
    { revokedAt: new Date() },
    { where: { token: refreshToken, userId: user.id } }
  );
  
  return { message: 'Successfully logged out' };
}
```

**Logout All Devices:**

```typescript
@Post('logout-all')
@UseGuards(JwtAuthGuard)
async logoutAll(@CurrentUser() user: User): Promise<{ message: string }> {
  // Revoke all refresh tokens
  await db.refreshTokens.update(
    { revokedAt: new Date() },
    { where: { userId: user.id, revokedAt: null } }
  );
  
  return { message: 'Logged out from all devices' };
}
```

---

## 5. Security Monitoring

### 5.1 Audit Logging

**Events to Log:**
- User registration
- Email verification success/failure
- Login success/failure
- Password change
- Token refresh
- Logout
- Failed authentication attempts
- Account lockouts

**Log Format:**

```json
{
  "timestamp": "2025-11-09T23:55:00Z",
  "level": "INFO",
  "event": "login_success",
  "userId": "user-123",
  "email": "user@example.com",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "correlationId": "req-abc123"
}
```

### 5.2 Metrics

- `auth_registrations_total` (counter)
- `auth_logins_total` (counter by success/failure)
- `auth_login_failures_total` (counter by reason)
- `auth_account_lockouts_total` (counter)
- `auth_password_changes_total` (counter)
- `auth_token_refreshes_total` (counter)
- `auth_email_verifications_total` (counter)

### 5.3 Alerts

**Critical:**
- Spike in failed logins (>100 per minute)
- Unusual login pattern (multiple countries simultaneously)
- Mass account lockouts

**Warning:**
- Failed login rate >5% for 10 minutes
- Email verification delivery failures
- Password change without recent login

---

## 6. Compliance

### 6.1 GDPR

- User consent for email communications
- Right to access authentication logs
- Right to delete account and all data
- Data portability for user data

### 6.2 Password Security Standards

- NIST SP 800-63B compliance
- OWASP password guidelines
- PCI DSS requirements (if handling payments)

---

**Document Status:** ACTIVE - Ready for Implementation  
**Last Updated:** November 9, 2025  
**Next Review:** December 9, 2025

---

**END OF AUTHENTICATION SECURITY SPECIFICATION**
