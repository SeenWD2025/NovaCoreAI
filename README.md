# Noble NovaCoreAI

A constitutional AI platform with persistent memory, ethical reflection, and gamified learning.

## 🎯 Mission

Noble NovaCoreAI is not another chatbot. It's an AI platform designed for human liberation through automation, aligned with the "Reclaimer Ethos" - prioritizing truth, wisdom, and alignment over raw intelligence and efficiency.

## 🏗️ Architecture

Service-oriented microservices architecture with:

- **API Gateway** (Node.js) - Routing, WebSocket hub
- **Auth & Billing** (NestJS) - User auth, Stripe subscriptions
- **Intelligence Core** (Python/FastAPI) - LLM orchestration (Mistral 7B)
- **Cognitive Memory** (Python/FastAPI) - STM/ITM/LTM persistence
- **Noble-Spirit Policy** (Elixir/Phoenix) - Constitutional validation
- **NGS Curriculum** (Go/Fiber) - 24-level gamified learning
- **MCP Server** (Rust) - VSCode integration
- **Frontend** (React/TypeScript/Vite) - User interface

## 📖 Full Documentation

See [replit.md](./replit.md) for comprehensive architectural reference.

## 🚀 Quick Start (Development)

### Prerequisites

- Node.js 18+
- Python 3.11+
- Go 1.21+
- Rust 1.75+
- Elixir 1.15+
- PostgreSQL 15+ (with pgvector)
- Redis 7+
- Docker & Docker Compose

### Setup

1. Clone the repository
2. Copy environment file:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies for Gateway:
   ```bash
   cd services/gateway
   npm install
   ```
4. Start the Gateway:
   ```bash
   npm run dev
   ```

## 📦 Project Structure

```
noble-novacore-ai/
├── services/           # Microservices
│   ├── gateway/       # API Gateway (Node.js)
│   ├── auth-billing/  # Auth & Billing (NestJS)
│   ├── intelligence/  # Intelligence Core (Python)
│   ├── memory/        # Cognitive Memory (Python)
│   ├── noble-spirit/  # Policy Service (Elixir)
│   ├── ngs-curriculum/# Curriculum (Go)
│   ├── mcp-server/    # VSCode MCP (Rust)
│   └── frontend/      # UI (React)
├── shared/            # Shared schemas & types
├── infrastructure/    # Docker, Terraform
├── docs/              # Documentation
└── replit.md          # Architecture reference
```

## 🎓 Noble Growth School (NGS)

24-level gamified curriculum teaching:
- AI literacy and responsible usage
- Development fundamentals
- Ethical AI interaction
- Agent creation and management

**Agent creation unlocks at Level 12**

## 💰 Subscription Tiers

- **Free Trial** (7 days): Levels 1-3, 1GB memory, 1K tokens/day
- **Basic** ($9/mo): All 24 levels, 10GB memory, 50K tokens/day
- **Pro** ($29/mo): Unlimited memory/tokens, priority GPU, VSCode MCP

## 🔧 Technology Stack

| Component | Technology |
|-----------|-----------|
| Gateway | Node.js + Express |
| Auth | NestJS + Stripe |
| Intelligence | Python + FastAPI + Ollama |
| Memory | Python + FastAPI + Redis + pgvector |
| Policy | Elixir + Phoenix |
| Curriculum | Go + Fiber |
| MCP | Rust |
| Frontend | React + TypeScript + Vite |
| Database | PostgreSQL 15 + pgvector |
| Cache | Redis 7 |

## 📝 Development Status

**Phase 1: Foundation** ✅ IN PROGRESS
- Project structure created
- API Gateway implemented
- Documentation established

## 🤝 Contributing

This project is in active development. See replit.md for architecture details and development phases.

## 📄 License

MIT

## 🔗 Links

- [Architecture Documentation](./replit.md)
- [API Documentation](./docs/api/)
- [Deployment Guide](./docs/deployment/)
