# Development Environment Setup

This guide will help you set up your local development environment for NovaCoreAI.

## Prerequisites

### Required
- **Docker** (20.10+) and **Docker Compose** (2.0+)
  - [Install Docker](https://docs.docker.com/get-docker/)
  - [Install Docker Compose](https://docs.docker.com/compose/install/)

### Optional (for local service development)
- **Node.js** (20.x) - for TypeScript services (Gateway, Auth-Billing, Frontend)
- **Python** (3.11+) - for Python services (Intelligence, Memory, etc.)
- **Go** (1.21+) - for NGS Curriculum service
- **Rust** (1.70+) - for MCP Server

## Quick Start

### Automated Setup (Recommended)

Run the automated setup script:

```bash
./scripts/setup-dev-env.sh
```

This script will:
1. Check system requirements
2. Create `.env` file from `.env.example`
3. Optionally install service dependencies
4. Optionally build Docker images

### Manual Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/SeenWD2025/NovaCoreAI.git
   cd NovaCoreAI
   ```

2. **Create environment configuration**
   ```bash
   cp .env.example .env
   ```

3. **Update critical environment variables in `.env`**
   ```bash
   # Generate secrets
   openssl rand -base64 32  # Use for JWT_SECRET
   openssl rand -base64 32  # Use for JWT_REFRESH_SECRET
   openssl rand -base64 32  # Use for SERVICE_JWT_SECRET
   
   # Update .env file
   JWT_SECRET=<generated-secret-1>
   JWT_REFRESH_SECRET=<generated-secret-2>
   SERVICE_JWT_SECRET=<generated-secret-3>
   POSTGRES_PASSWORD=<strong-password>
   ```

4. **Start all services**
   ```bash
   docker compose up -d
   ```

5. **Wait for services to be healthy**
   ```bash
   docker compose ps
   # All services should show "healthy" or "running"
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - API Gateway: http://localhost:5000
   - Grafana: http://localhost:3000 (admin/admin)
   - Prometheus: http://localhost:9090

## Service-Specific Development

### TypeScript Services (Gateway, Auth-Billing, Frontend)

```bash
cd services/gateway  # or auth-billing, frontend

# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Python Services (Intelligence, Memory, etc.)

```bash
cd services/intelligence  # or memory, noble-spirit, etc.

# Install dependencies
pip install -r requirements.txt

# Run linting
make lint

# Run type checking
make typecheck

# Run tests
make test

# Start service
python main.py
```

### Go Service (NGS Curriculum)

```bash
cd services/ngs-curriculum

# Install dependencies
go mod download

# Run service
go run main.go

# Run tests
go test ./...

# Build binary
go build -o ngs-curriculum
```

### Rust Service (MCP Server)

```bash
cd services/mcp-server

# Build and run
cargo run

# Run tests
cargo test

# Build release
cargo build --release
```

## Common Development Tasks

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f gateway

# Last 100 lines
docker compose logs --tail=100 intelligence
```

### Restart a service
```bash
docker compose restart gateway
```

### Rebuild a service
```bash
docker compose build gateway
docker compose up -d gateway
```

### Stop all services
```bash
docker compose down
```

### Clean up (remove volumes)
```bash
docker compose down -v
```

### Access database
```bash
docker compose exec postgres psql -U noble -d noble_novacore
```

### Access Redis
```bash
docker compose exec redis redis-cli
```

## Troubleshooting

### Services won't start
- Check Docker is running: `docker ps`
- Check logs: `docker compose logs`
- Verify `.env` file exists and has valid values
- Try rebuilding: `docker compose build --no-cache`

### Permission errors in containers
- Ensure non-root user is configured in Dockerfiles (should be by default)
- Check file ownership: `ls -la services/*/`

### Port conflicts
- Check if ports are already in use: `lsof -i :5000` (macOS/Linux)
- Update port mappings in `docker-compose.yml` if needed

### Database connection errors
- Verify PostgreSQL is healthy: `docker compose ps postgres`
- Check DATABASE_URL in `.env` matches docker-compose.yml
- Wait for database to be ready (can take 30-60 seconds on first start)

### Ollama model download slow
- First startup downloads Mistral model (~4GB)
- Can take 10-30 minutes depending on connection
- Check progress: `docker compose logs -f ollama`

## Development Workflow

1. **Make code changes** in your editor
2. **For Docker services**: Rebuild and restart
   ```bash
   docker compose build <service>
   docker compose up -d <service>
   ```
3. **For local development**: Service will hot-reload automatically
4. **Run tests** before committing
5. **Check linting** before committing
6. **Create PR** when ready

## IDE Setup

### VS Code
Recommended extensions:
- ESLint
- Prettier
- Python
- Go
- rust-analyzer
- Docker
- Remote - Containers

### IntelliJ IDEA / PyCharm
- Enable Docker plugin
- Configure Python interpreter to use venv
- Configure Node.js interpreter
- Enable ESLint and Prettier

## Additional Resources

- [Architecture Overview](../architecture/OVERVIEW.md)
- [API Documentation](../api/README.md)
- [Testing Guide](./TESTING.md)
- [Deployment Guide](../deployment/README.md)
