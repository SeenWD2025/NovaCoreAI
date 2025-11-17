#!/bin/bash
set -e

echo "=========================================="
echo "NovaCoreAI Development Environment Setup"
echo "=========================================="
echo ""

echo "Checking system requirements..."

if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "ERROR: Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✓ Docker and Docker Compose are installed"
echo ""

if ! command -v go &> /dev/null; then
    echo "⚠ Go is not installed (optional for NGS Curriculum service development)"
    echo "  To install: https://go.dev/doc/install"
else
    echo "✓ Go $(go version | awk '{print $3}') is installed"
fi

if ! command -v cargo &> /dev/null; then
    echo "⚠ Rust is not installed (optional for MCP Server development)"
    echo "  To install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
else
    echo "✓ Rust $(rustc --version | awk '{print $2}') is installed"
fi

if ! command -v node &> /dev/null; then
    echo "⚠ Node.js is not installed (optional for TypeScript service development)"
    echo "  To install: https://nodejs.org/"
else
    echo "✓ Node.js $(node --version) is installed"
fi

if ! command -v python3 &> /dev/null; then
    echo "⚠ Python 3 is not installed (optional for Python service development)"
    echo "  To install: https://www.python.org/downloads/"
else
    echo "✓ Python $(python3 --version | awk '{print $2}') is installed"
fi

echo ""
echo "=========================================="
echo "Setting up environment configuration..."
echo "=========================================="
echo ""

if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "✓ .env file created"
    echo ""
    echo "⚠ IMPORTANT: Edit .env and update the following:"
    echo "  - JWT_SECRET (generate with: openssl rand -base64 32)"
    echo "  - JWT_REFRESH_SECRET (generate with: openssl rand -base64 32)"
    echo "  - SERVICE_JWT_SECRET (generate with: openssl rand -base64 32)"
    echo "  - POSTGRES_PASSWORD (use a strong password)"
    echo "  - Stripe keys (if using billing features)"
    echo "  - SMTP credentials (if using email features)"
    echo "  - LLM API keys (Gemini, OpenAI if using cloud providers)"
else
    echo "✓ .env file already exists"
fi

echo ""
echo "=========================================="
echo "Installing dependencies (optional)..."
echo "=========================================="
echo ""

read -p "Install Node.js dependencies for TypeScript services? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Installing Gateway dependencies..."
    cd services/gateway && npm ci && cd ../..
    
    echo "Installing Auth-Billing dependencies..."
    cd services/auth-billing && npm ci && cd ../..
    
    echo "Installing Frontend dependencies..."
    cd services/frontend && npm ci && cd ../..
    
    echo "✓ Node.js dependencies installed"
else
    echo "Skipped Node.js dependencies installation"
fi

echo ""
read -p "Install Python dependencies for Python services? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    for service in intelligence memory noble-spirit notes-api study-engine quiz-engine reflection-worker distillation-worker; do
        echo "Installing $service dependencies..."
        cd "services/$service" && pip install -r requirements.txt && cd ../..
    done
    echo "✓ Python dependencies installed"
else
    echo "Skipped Python dependencies installation"
fi

echo ""
echo "=========================================="
echo "Building Docker images..."
echo "=========================================="
echo ""

read -p "Build all Docker images? This may take 10-15 minutes. (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose build
    echo "✓ Docker images built"
else
    echo "Skipped Docker image building"
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Review and update .env file with your configuration"
echo "  2. Start services: docker compose up -d"
echo "  3. Wait for services to be healthy: docker compose ps"
echo "  4. Access the application:"
echo "     - Frontend: http://localhost:5173"
echo "     - API Gateway: http://localhost:5000"
echo "     - Grafana: http://localhost:3000 (admin/admin)"
echo "     - Prometheus: http://localhost:9090"
echo ""
echo "For development:"
echo "  - Run individual services locally (see service README files)"
echo "  - Use 'docker compose logs -f <service>' to view logs"
echo "  - Use 'docker compose restart <service>' to restart a service"
echo ""
echo "Documentation: docs/dev/"
echo ""
