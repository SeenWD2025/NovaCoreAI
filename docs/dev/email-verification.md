# Email Verification System

## Overview

The NovaCoreAI platform includes a secure email verification system to ensure users have access to their registered email address. This is a critical P0 security requirement for production.

## Features

### Core Functionality
- **Secure Token Generation**: Uses `crypto.randomBytes(32)` to generate cryptographically secure 64-character hex tokens
- **Token Expiration**: Verification tokens expire after 24 hours
- **Single-Use Tokens**: Tokens are deleted immediately after successful verification
- **Rate Limiting**: Multiple layers of rate limiting to prevent abuse

### Security Measures

#### IP-Based Rate Limiting (Verification Endpoint)
- **Limit**: 5 attempts per 15 minutes per IP address
- **Endpoint**: `GET /auth/verify-email?token=xxx`
- **Purpose**: Prevents brute-force token guessing attacks

#### User-Based Rate Limiting (Resend Endpoint)
- **Limit**: 3 requests per hour per user
- **Endpoint**: `POST /auth/resend-verification`
- **Purpose**: Prevents spam and email bombing

## API Endpoints

### 1. Register User (Auto-sends Verification Email)

\`\`\`http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
\`\`\`

### 2. Verify Email

\`\`\`http
GET /auth/verify-email?token=abc123...
\`\`\`

### 3. Resend Verification Email

\`\`\`http
POST /auth/resend-verification
Authorization: Bearer <access-token>
\`\`\`

## Testing

Run comprehensive unit tests:

\`\`\`bash
cd services/auth-billing
npm test -- auth.service.spec.ts
npm test -- rate-limit.guard.spec.ts
\`\`\`

## Security Considerations

- ✅ Tokens are cryptographically random (256 bits of entropy)
- ✅ Tokens expire after 24 hours
- ✅ Tokens are single-use (deleted after verification)
- ✅ Rate limiting prevents brute-force attacks
- ✅ IP-based rate limiting prevents token guessing
- ✅ User-based rate limiting prevents email spam
