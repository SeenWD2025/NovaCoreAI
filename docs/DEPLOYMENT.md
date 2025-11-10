# Noble NovaCoreAI - Deployment Guide

## Overview

This guide covers deploying Noble NovaCoreAI in development and production environments.

## Architecture

Noble NovaCoreAI is a microservices architecture with 10 services:

- **API Gateway** (Node.js) - Port 5000
- **Auth & Billing** (NestJS) - Port 3001
- **Intelligence Core** (Python/FastAPI) - Port 8000
- **Cognitive Memory** (Python/FastAPI) - Port 8001
- **Noble-Spirit Policy** (Python/FastAPI) - Port 4000
- **Reflection Worker** (Python/Celery) - Background
- **Distillation Worker** (Python/Scheduler) - Background
- **NGS Curriculum** (Go) - Port 9000
- **Frontend** (React) - Port 5173
- **PostgreSQL** (pgvector) - Port 5432
- **Redis** - Port 6379

## Prerequisites

### Development
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- Go 1.21+ (optional)
- Ollama with Mistral 7B model

### Production
- Ubuntu 22.04 LTS or similar
- Docker & Docker Compose
- GPU (recommended for LLM)
- 8GB+ RAM minimum
- 50GB+ storage

## Quick Start (Development)

### 1. Clone Repository

```bash
git clone https://github.com/SeenWD2025/NovaCoreAI.git
cd NovaCoreAI
```

### 2. Configure Environment

```bash
cp env.example .env
```

Edit `.env` and configure:

```bash
# Database
POSTGRES_USER=noble
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=noble_novacore

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_here_min_32_chars

# Service-to-Service Authentication (P0 Security Feature)
# Generate with: openssl rand -base64 32
SERVICE_JWT_SECRET=your_service_jwt_secret_change_in_production
SERVICE_TOKEN_EXPIRES_IN=24h

# LLM Configuration
OLLAMA_URL=http://ollama:11434
LLM_MODEL=mistral:instruct
GPU_ENABLED=false

# Stripe (optional for development)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

**Important Security Note:** The `SERVICE_JWT_SECRET` is critical for inter-service communication security. See [SERVICE_AUTHENTICATION.md](./SERVICE_AUTHENTICATION.md) for detailed configuration.

### 3. Install Ollama & Model

```bash
# Install Ollama (macOS/Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull Mistral 7B model
docker compose exec ollama ollama pull mistral:instruct

# Verify it's running
docker compose exec ollama ollama list
```

### 4. Start Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
curl http://localhost:5000/health
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:4000/health
```

### 5. Initialize Database

The database schema is automatically initialized on first startup via the init script at `shared/schemas/01_init.sql`.

To manually verify:

```bash
docker exec -it noble-postgres psql -U noble -d noble_novacore -c "\dt"
```

You should see tables: users, subscriptions, sessions, prompts, memories, reflections, etc.

### 6. Test the System

```bash
# Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'

# Save the access_token from response

# Send a chat message
curl -X POST http://localhost:5000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "message": "Hello! Tell me about the Reclaimer Ethos.",
    "use_memory": true
  }'
```

## Production Deployment

### Option 1: DigitalOcean Droplets

**Recommended Setup:**
- App Server: 8GB RAM, 4 vCPU ($48/month)
- GPU Server: 16GB RAM + GPU ($200/month)
- Managed PostgreSQL: $15/month
- Managed Redis: $15/month

Total: ~$288/month

### Option 2: AWS/GCP

Use similar configuration with:
- ECS/EKS for containers
- RDS for PostgreSQL
- ElastiCache for Redis
- EC2 with GPU for LLM

### SSL/TLS Setup

Use Let's Encrypt with Nginx reverse proxy:

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Environment Variables for Production

```bash
# Security
NODE_ENV=production
JWT_SECRET=<strong-random-secret-64-chars>
JWT_REFRESH_SECRET=<strong-random-secret-64-chars>

# Database (use managed service)
DATABASE_URL=postgresql://user:password@managed-db-host:5432/noble_novacore

# Redis (use managed service)
REDIS_URL=redis://managed-redis-host:6379

# LLM (GPU server)
OLLAMA_URL=http://gpu-server-internal-ip:11434
GPU_ENABLED=true

# Stripe (production keys)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_BASIC_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
```

### Monitoring

1. **Health Checks**
   - Setup uptime monitoring for all service health endpoints
   - Configure Docker health checks in docker-compose

2. **Logging**
   - Use centralized logging (ELK stack or CloudWatch)
   - Configure log rotation

3. **Metrics**
   - Add Prometheus exporters
   - Setup Grafana dashboards

### Backup Strategy

1. **Database Backups**
   ```bash
   # Daily PostgreSQL backup
   pg_dump -h localhost -U noble noble_novacore > backup_$(date +%Y%m%d).sql
   ```

2. **Redis Persistence**
   - Enable AOF (Append Only File) in redis.conf
   - Regular snapshots

3. **Application State**
   - Docker volumes for persistent data
   - Regular volume backups

## Scaling Considerations

### Horizontal Scaling

Services that can scale horizontally:
- API Gateway (load balancer)
- Intelligence Core (multiple instances)
- Memory Service (read replicas)
- Reflection Worker (Celery workers)

### Vertical Scaling

Services that benefit from vertical scaling:
- LLM Inference (GPU, VRAM)
- PostgreSQL (RAM, CPU)
- Redis (RAM)

### Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_memories_user_tier ON memories(user_id, tier);
CREATE INDEX CONCURRENTLY idx_usage_ledger_user_date ON usage_ledger(user_id, timestamp);

-- Enable pgvector index
CREATE INDEX ON memories USING ivfflat (vector_embedding vector_cosine_ops);
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs service-name

# Common issues:
# 1. Port conflicts - check if port is in use
netstat -tlnp | grep PORT

# 2. Database not ready - wait for postgres to be healthy
docker-compose ps

# 3. Missing dependencies
docker-compose build --no-cache service-name
```

### Memory Service Issues

```bash
# Check Redis connectivity
docker exec -it noble-redis redis-cli ping

# Check embedding model
docker exec -it noble-memory python -c "from sentence_transformers import SentenceTransformer; print(SentenceTransformer('all-MiniLM-L6-v2'))"
```

### Ollama Connection Issues

```bash
# Test Ollama from container
docker compose exec intelligence curl http://ollama:11434/api/tags

# Verify model is loaded
docker compose exec ollama ollama list
```

### Database Connection Issues

```bash
# Test database connection
docker exec -it noble-postgres psql -U noble -d noble_novacore -c "SELECT 1"

# Check connections
docker exec -it noble-postgres psql -U noble -d noble_novacore -c "SELECT count(*) FROM pg_stat_activity"
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (64+ chars)
- [ ] Enable SSL/TLS
- [ ] Configure CORS appropriately
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] Audit logging enabled

## Maintenance

### Regular Tasks

- **Daily**: Check service health, review logs
- **Weekly**: Review usage metrics, check disk space
- **Monthly**: Database maintenance, security updates, backup verification

### Database Maintenance

```sql
-- Vacuum and analyze
VACUUM ANALYZE memories;
VACUUM ANALYZE reflections;

-- Check database size
SELECT pg_size_pretty(pg_database_size('noble_novacore'));

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/SeenWD2025/NovaCoreAI/issues
- Documentation: See README.md and replit.md

## License

MIT License - See LICENSE file for details
