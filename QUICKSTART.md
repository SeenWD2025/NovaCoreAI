# Noble NovaCoreAI - Quick Start Guide

This guide will help you get the Noble NovaCoreAI platform up and running quickly.

## Prerequisites

- Docker and Docker Compose
- At least 8GB RAM available
- 20GB free disk space
- (Optional) Ollama installed locally for LLM inference

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/SeenWD2025/NovaCoreAI.git
cd NovaCoreAI

# Copy environment template
cp env.example .env

# Edit .env if needed (defaults work for local development)
```

### 2. Start the Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 3. Verify Services

Services will be available at:

- **API Gateway**: http://localhost:5000
- **Auth & Billing**: http://localhost:3001
- **Intelligence Core**: http://localhost:8000
- **Memory Service**: http://localhost:8001
- **Policy Service**: http://localhost:4000
- **NGS Curriculum**: http://localhost:9000
- **Frontend**: http://localhost:5173
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

Health checks:
```bash
# Check API Gateway
curl http://localhost:5000/health

# Check Intelligence Core
curl http://localhost:8000/health

# Check Memory Service
curl http://localhost:8001/health

# Check Policy Service
curl http://localhost:4000/health
```

### 4. Test the System

#### Register a User

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "name": "Test User"
  }'
```

#### Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

Save the `access_token` from the response.

#### Send a Chat Message

```bash
# Replace YOUR_TOKEN with the access token from login
curl -X POST http://localhost:8000/chat/message \
  -H "Content-Type: application/json" \
  -H "X-User-Id: YOUR_USER_ID" \
  -d '{
    "message": "Hello, Noble NovaCoreAI!",
    "use_memory": true
  }'
```

## Validation

Run the validation script to verify all implementations:

```bash
python3 validate_implementations.py
```

Expected output:
```
✅ ALL IMPLEMENTATIONS VERIFIED!
Total Checks: 16
Passed: 16
Failed: 0
```

## Service Architecture

### Core Services

1. **API Gateway** (Node.js)
   - Routes requests to appropriate services
   - WebSocket support for streaming
   - JWT validation

2. **Auth & Billing** (NestJS)
   - User authentication
   - Subscription management
   - Stripe integration

3. **Intelligence Core** (Python + FastAPI)
   - LLM orchestration (Ollama)
   - Chat session management
   - Token usage tracking

4. **Memory Service** (Python + FastAPI)
   - Three-tier memory (STM/ITM/LTM)
   - Vector embeddings
   - Semantic search

5. **Policy Service** (Python + FastAPI)
   - Constitutional AI validation
   - Alignment scoring
   - Ethical filtering

6. **Reflection Worker** (Python + Celery)
   - Background reflection processing
   - Self-assessment generation
   - Policy validation

7. **Distillation Worker** (Python)
   - Nightly memory consolidation
   - Knowledge distillation
   - Memory promotion

8. **NGS Curriculum** (Go)
   - 24-level progression system
   - XP tracking
   - Achievement system

9. **Frontend** (React + Vite)
   - User interface
   - Chat interface
   - NGS portal

### Data Stores

- **PostgreSQL** - Primary database with pgvector extension
- **Redis** - STM/ITM storage, Celery broker

## Development Workflow

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f intelligence

# Last 100 lines
docker-compose logs --tail=100 memory
```

### Rebuilding Services

```bash
# Rebuild specific service
docker-compose up -d --build intelligence

# Rebuild all services
docker-compose up -d --build
```

### Accessing Database

```bash
# PostgreSQL
docker-compose exec postgres psql -U noble -d noble_novacore

# Redis
docker-compose exec redis redis-cli
```

### Running Commands in Services

```bash
# Python service
docker-compose exec intelligence python

# Node service
docker-compose exec gateway npm run <command>
```

## Configuration

### Environment Variables

Key environment variables in `.env`:

```bash
# Database
DATABASE_URL=postgresql://noble:changeme@postgres:5432/noble_novacore

# Redis
REDIS_URL=redis://redis:6379

# LLM
LLM_MODEL=mistral:7b-instruct-q4
OLLAMA_URL=http://host.docker.internal:11434

# Limits
FREE_TIER_TOKENS_DAY=1000
BASIC_TIER_TOKENS_DAY=50000
PRO_TIER_TOKENS_DAY=-1  # unlimited
```

### Subscription Tiers

1. **Free Trial** (7 days)
   - 1GB memory
   - 1,000 tokens/day
   - Levels 1-3

2. **Basic** ($9/month)
   - 10GB memory
   - 50,000 tokens/day
   - All 24 levels

3. **Pro** ($29/month)
   - Unlimited memory
   - Unlimited tokens
   - Priority support

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs SERVICE_NAME

# Restart service
docker-compose restart SERVICE_NAME

# Check dependencies
docker-compose ps
```

### Database Connection Errors

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Reset database (WARNING: destroys data)
docker-compose down -v
docker-compose up -d
```

### Redis Connection Errors

```bash
# Verify Redis is running
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Test connection
docker-compose exec redis redis-cli ping
```

### Memory Service Not Finding Model

The memory service uses sentence-transformers which downloads models on first run:

```bash
# Check memory service logs
docker-compose logs memory

# Model will be downloaded to /app/.cache inside container
# First run may take 2-3 minutes
```

### LLM Not Responding

Make sure Ollama is running and the model is pulled:

```bash
# On host machine
ollama pull mistral:7b-instruct-q4

# Check Ollama is accessible
curl http://localhost:11434/api/tags
```

## Testing

### Manual Testing Endpoints

See the Postman collection or use curl commands above.

### Integration Testing

```bash
# Run validation script
python3 validate_implementations.py

# Run Python tests (when added)
docker-compose exec intelligence pytest

# Run Node tests (when added)
docker-compose exec gateway npm test
```

## Next Steps

1. **Explore the API**
   - Try different chat messages
   - Search memories
   - Check reflection status

2. **Monitor the System**
   - Watch logs for integration
   - Verify memory storage
   - Check distillation runs

3. **Development**
   - Add tests
   - Enhance features
   - Optimize performance

4. **Production Deployment**
   - Set up monitoring
   - Configure SSL/TLS
   - Secure environment variables
   - Set up backups

## Resources

- **Documentation**: See `IMPLEMENTATION_COMPLETION_REPORT.md`
- **Architecture**: See `replit.md`
- **Gap Analysis**: See `GAP_ANALYSIS_PHASE_1-8.md`
- **Issues**: https://github.com/SeenWD2025/NovaCoreAI/issues

## Support

For questions or issues:
1. Check logs: `docker-compose logs -f`
2. Verify services: `docker-compose ps`
3. Run validation: `python3 validate_implementations.py`
4. Review documentation

---

**Last Updated:** November 9, 2025  
**Version:** 1.0 (Phases 1-8 Complete)
