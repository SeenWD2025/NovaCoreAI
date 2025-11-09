# Noble NovaCoreAI - Testing Guide

This guide provides instructions for testing the implemented phases of the Noble NovaCoreAI platform.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local testing)
- curl and jq (for API testing)

## Starting the Services

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
docker compose up --build

# Or start specific services
docker compose up postgres redis auth-billing gateway
```

### Option 2: Local Development

1. Start infrastructure services:
```bash
docker compose up postgres redis
```

2. Start auth-billing service:
```bash
cd services/auth-billing
npm install
export DATABASE_URL="postgresql://noble:changeme@localhost:5432/noble_novacore"
export JWT_SECRET="your-secret-key-change-in-production"
export JWT_REFRESH_SECRET="your-refresh-secret-change-in-production"
export PORT=3001
npm run dev
```

3. Start gateway service:
```bash
cd services/gateway
npm install
export AUTH_SERVICE_URL="http://localhost:3001"
export JWT_SECRET="your-secret-key-change-in-production"
export PORT=5000
npm run dev
```

## Phase 1: Foundation Testing

### Test Database Schema

```bash
# Connect to PostgreSQL
docker exec -it noble-postgres psql -U noble -d noble_novacore

# List tables
\dt

# Check users table structure
\d users

# Check if pgvector extension is enabled
\dx

# Exit
\q
```

Expected output: All tables from shared/schemas/01_init.sql should be created, including users, subscriptions, memories, sessions, etc.

### Test Redis

```bash
# Connect to Redis
docker exec -it noble-redis redis-cli

# Ping
PING

# Exit
exit
```

Expected output: PONG

## Phase 2: Auth & Billing Testing

### Health Check

```bash
curl http://localhost:3001/health | jq .
```

Expected output:
```json
{
  "status": "healthy",
  "service": "auth-billing",
  "version": "1.0.0",
  "timestamp": "2025-11-09T..."
}
```

### User Registration

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123"}' | jq .
```

Expected output:
```json
{
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "role": "student",
    "subscription_tier": "free_trial",
    "trial_ends_at": "..."
  },
  "accessToken": "jwt-token",
  "refreshToken": "jwt-refresh-token"
}
```

### User Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123"}' | jq .
```

Expected output: Same structure as registration

### Get Current User (Authenticated)

```bash
# Save token from login
TOKEN="your-jwt-token-here"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/auth/me | jq .
```

Expected output:
```json
{
  "id": "uuid",
  "email": "test@example.com",
  "role": "student",
  "subscription_tier": "free_trial",
  "trial_ends_at": "...",
  "ngs_progress": {
    "current_level": 1,
    "total_xp": 0
  },
  "created_at": "..."
}
```

### Token Refresh

```bash
# Save refresh token from login
REFRESH_TOKEN="your-refresh-token-here"

curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"'$REFRESH_TOKEN'"}' | jq .
```

Expected output: New access token

## Phase 3: API Gateway Testing

### Gateway Health Check

```bash
curl http://localhost:5000/health | jq .
```

Expected output:
```json
{
  "status": "healthy",
  "service": "noble-gateway",
  "timestamp": "...",
  "version": "1.0.0"
}
```

### Gateway Status

```bash
curl http://localhost:5000/api/status | jq .
```

Expected output:
```json
{
  "message": "Noble NovaCoreAI API Gateway",
  "architecture": "microservices",
  "phase": 3,
  "services": {
    "gateway": "online",
    "auth": "online",
    "intelligence": "stub",
    "memory": "stub",
    "ngs": "stub",
    "policy": "not-started"
  }
}
```

### Registration through Gateway

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"gateway@example.com","password":"TestPassword123"}' | jq .
```

Expected output: User object with JWT tokens (same as direct auth service)

### Login through Gateway

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"gateway@example.com","password":"TestPassword123"}' | jq . > /tmp/login.json

# Extract token
TOKEN=$(jq -r '.accessToken' /tmp/login.json)
echo "Token: $TOKEN"
```

### Authenticated Request through Gateway

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/auth/me | jq .
```

Expected output: User profile with NGS progress

### Test JWT Validation

```bash
# Test without token (should fail)
curl http://localhost:5000/api/billing/usage | jq .

# Expected: 401 Unauthorized

# Test with invalid token (should fail)
curl -H "Authorization: Bearer invalid-token" \
  http://localhost:5000/api/billing/usage | jq .

# Expected: 403 Forbidden (Invalid token)

# Test with valid token (should succeed - even if service is stub)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/billing/usage | jq .
```

### WebSocket Testing

You can test WebSocket using a Node.js script or wscat:

```bash
# Install wscat
npm install -g wscat

# Connect with token
wscat -c "ws://localhost:5000/ws/chat?token=$TOKEN"

# Send a message
> {"type":"test","message":"Hello"}

# Expected response: Welcome message and echo
```

### Rate Limiting Test

```bash
# Send 101 requests quickly (should hit rate limit)
for i in {1..101}; do
  curl -s http://localhost:5000/api/status > /dev/null
  echo "Request $i"
done

# The 101st request should return:
# {"error": "Too many requests from this IP, please try again later."}
```

## Database Verification

### Check User Created

```bash
docker exec -it noble-postgres psql -U noble -d noble_novacore

SELECT id, email, role, subscription_tier, trial_ends_at 
FROM users 
WHERE email = 'gateway@example.com';

# Should show the created user
```

### Check User Progress Created

```bash
SELECT * FROM user_progress WHERE user_id = (
  SELECT id FROM users WHERE email = 'gateway@example.com'
);

# Should show level 1 with 0 XP
```

### Check Subscription Record

```bash
SELECT * FROM subscriptions WHERE user_id = (
  SELECT id FROM users WHERE email = 'gateway@example.com'
);

# May be empty initially (created on first checkout)
```

## Common Issues and Solutions

### Issue: "Database connection refused"

**Solution**: Make sure PostgreSQL container is running:
```bash
docker compose up postgres
# Wait for "database system is ready to accept connections"
```

### Issue: "Port already in use"

**Solution**: Stop conflicting services:
```bash
# Find process using port 5000
lsof -i :5000
# Kill it
kill -9 <PID>
```

### Issue: "Cannot find module" errors

**Solution**: Install dependencies:
```bash
cd services/auth-billing
npm install

cd ../gateway
npm install
```

### Issue: "Invalid token" errors

**Solution**: Make sure JWT_SECRET matches between gateway and auth service:
```bash
# Both should use the same secret
export JWT_SECRET="your-secret-key-change-in-production"
```

### Issue: Request hanging on gateway proxy

**Solution**: Ensure target service is running and accessible:
```bash
# Test auth service directly
curl http://localhost:3001/health

# Check gateway logs for proxy errors
```

## Next Steps

With Phases 1-3 complete and tested, the next phase is:

**Phase 4: Intelligence Core**
- FastAPI setup
- Ollama integration
- Mistral 7B model
- Session management
- Streaming responses

See replit.md for full architecture details and development roadmap.

## Automated Testing

To run automated tests (when available):

```bash
# Auth & Billing tests
cd services/auth-billing
npm test

# Gateway tests
cd services/gateway
npm test
```

## Performance Testing

Basic load test using Apache Bench:

```bash
# Test gateway throughput
ab -n 1000 -c 10 http://localhost:5000/health

# Test auth throughput
ab -n 100 -c 5 -p register.json -T application/json \
  http://localhost:5000/api/auth/register
```

## Security Checklist

- [x] Passwords are hashed with bcrypt
- [x] JWT tokens have appropriate expiry (15min access, 7d refresh)
- [x] Rate limiting is enabled on gateway
- [x] CORS is configured
- [x] Environment variables are used for secrets
- [x] SQL injection protection via parameterized queries
- [x] Input validation on all endpoints

## Support

For issues or questions, please refer to:
- [Architecture Documentation](./replit.md)
- [README](./README.md)
- Project issues on GitHub
