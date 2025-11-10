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

---

## Automated Testing Infrastructure

### Test Databases

NovaCoreAI uses isolated test databases to run automated tests without affecting development data.

#### Starting Test Databases

```bash
# Start test PostgreSQL and Redis
docker-compose -f docker-compose.test.yml up -d

# Verify test databases are running
docker ps | grep test

# Check test database health
docker exec -it noble-postgres-test psql -U noble_test -d noble_novacore_test -c "SELECT version();"
docker exec -it noble-redis-test redis-cli ping
```

#### Running Unit Tests

**Python Services (Intelligence, Memory, Noble-Spirit):**

```bash
# Install test dependencies
cd services/intelligence
pip install pytest pytest-cov pytest-asyncio

# Set test environment variables
export DATABASE_URL="postgresql://noble_test:test_password@localhost:5433/noble_novacore_test"
export REDIS_URL="redis://localhost:6380"
export SERVICE_JWT_SECRET="test-secret"

# Run tests with coverage
pytest tests/ -v --cov=app --cov-report=term --cov-report=html

# View HTML coverage report
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
```

**Node.js Services (Gateway, Auth-Billing):**

```bash
# Install test dependencies
cd services/gateway
npm install

# Set test environment variables
export DATABASE_URL="postgresql://noble_test:test_password@localhost:5433/noble_novacore_test"
export REDIS_URL="redis://localhost:6380"
export SERVICE_JWT_SECRET="test-secret"

# Run tests with coverage
npm test -- --coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

#### CI/CD Automated Tests

Tests run automatically on every pull request:

1. **Test databases** are spun up as GitHub Actions services
2. **Database schemas** are initialized automatically
3. **Unit tests** run for each service with code coverage
4. **Coverage reports** are uploaded to Codecov
5. **PR is blocked** if tests fail or coverage drops

### Load Testing

Load testing simulates multiple concurrent users to identify performance bottlenecks.

#### Prerequisites

```bash
# Install locust
pip install locust
```

#### Running Load Tests

```bash
# Start all services first
docker-compose up -d

# Wait for services to be ready
sleep 30

# Run load test script
python scripts/load_test.py
```

#### Load Test Web UI

Locust provides a web interface for monitoring:

```bash
# Start locust with web UI
locust -f scripts/load_test.py --host http://localhost:5000

# Open browser
# Navigate to http://localhost:8089

# Configure test:
# - Number of users: 50
# - Spawn rate: 10 users/second
# - Click "Start swarming"
```

#### Load Test Scenarios

The load test script (`scripts/load_test.py`) simulates:

1. **User Registration** (startup)
2. **User Login** (startup)
3. **Chat Messages** (10x weight - most frequent)
4. **Memory Retrieval** (3x weight)
5. **Memory Search** (2x weight)
6. **NGS Progress Check** (2x weight)
7. **Usage Quota Check** (1x weight)
8. **Health Check** (1x weight)

#### Performance Targets

Based on TASK_DELEGATION_PLAN.md requirements:

- **Latency:** p95 < 2 seconds for all endpoints
- **Throughput:** Support 50 concurrent users
- **Token Processing:** Handle 1000 messages benchmark
- **Error Rate:** < 1%
- **Uptime:** ≥ 99.9%

#### Analyzing Results

After running load tests, check:

```bash
# View Grafana dashboards
# Service Health: http://localhost:3000/d/novacore-service-health
# Business Metrics: http://localhost:3000/d/novacore-business

# Check Prometheus metrics
curl http://localhost:9090/api/v1/query?query=rate(http_requests_total[5m])

# View service logs
docker-compose logs --tail=100 gateway
docker-compose logs --tail=100 intelligence
```

### Code Coverage Goals

Target: **≥70% code coverage** for all services

```bash
# Generate coverage report for all Python services
for service in intelligence memory noble-spirit; do
  echo "Testing $service..."
  cd services/$service
  pytest tests/ --cov=app --cov-report=term
  cd ../..
done

# Generate coverage report for all Node services
for service in gateway auth-billing; do
  echo "Testing $service..."
  cd services/$service
  npm test -- --coverage
  cd ../..
done
```

### Integration Tests

End-to-end integration tests verify complete user journeys:

```bash
# Run integration tests
pytest tests/integration/test_full_flow.py -v

# Test scenarios:
# 1. Register → Login → Chat → Memory stored
# 2. Quota enforcement across services
# 3. Memory promotion after distillation
# 4. Reflection task execution
# 5. Subscription tier changes
```

### Continuous Monitoring

During testing, monitor key metrics:

**Prometheus Metrics:**
- Request rate: `rate(http_requests_total[5m])`
- Latency: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
- Error rate: `rate(http_requests_total{status=~"5.."}[5m])`
- Token usage: `rate(chat_tokens_total[5m])`

**Grafana Dashboards:**
- Service Health: Real-time service status and performance
- Business Metrics: User activity and usage patterns
- AI/ML Metrics: LLM performance and memory system health

### Troubleshooting Tests

**Tests fail with database connection error:**
```bash
# Check if test databases are running
docker-compose -f docker-compose.test.yml ps

# Restart test databases
docker-compose -f docker-compose.test.yml restart
```

**Tests fail with "service not found" error:**
```bash
# Ensure SERVICE_JWT_SECRET is set
export SERVICE_JWT_SECRET="test-secret"

# Or use .env.test file
cp env.example .env.test
# Edit .env.test and set test values
```

**Load tests show high latency:**
```bash
# Check if Ollama is running (for Intelligence service)
curl http://localhost:11434/api/tags

# Check service logs for errors
docker-compose logs intelligence

# Monitor resource usage
docker stats
```

### Best Practices

1. **Run tests before committing:** `pytest tests/ && npm test`
2. **Check coverage:** Aim for ≥70% coverage
3. **Test in isolation:** Use test databases, not development data
4. **Clean up after tests:** Test databases reset automatically
5. **Monitor CI/CD:** Fix failures immediately
6. **Load test regularly:** Before releases and after major changes
7. **Document test cases:** Update tests when adding features

---

## References

- [TASK_DELEGATION_PLAN.md](./TASK_DELEGATION_PLAN.md) - Testing requirements
- [CI/CD Pipeline](./.github/workflows/ci-cd.yml) - Automated test workflow
- [Pytest Documentation](https://docs.pytest.org/)
- [Jest Documentation](https://jestjs.io/)
- [Locust Documentation](https://docs.locust.io/)

---

**Last Updated:** November 9, 2025
**Maintained By:** DevOps Architect & Full-Stack Specialist
