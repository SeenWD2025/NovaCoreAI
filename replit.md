# Noble NovaCoreAI - Architectural Reference

## Project Overview

**Noble NovaCoreAI** is a constitutional AI platform with persistent memory, ethical reflection, and a gamified learning curriculum. Built as a multi-user SaaS with subscription monetization.

### Core Differentiators
- **Extended Persistent Memory**: STM (1hr), ITM (7 days), LTM (permanent) with ethical filtering
- **Constitutional AI**: Reflection engine with Noble-Spirit policy validation
- **Noble Growth School (NGS)**: 24-level gamified curriculum for AI literacy
- **VSCode Integration**: MCP server for seamless development workflow
- **Multi-user Platform**: Subscription tiers with usage-based limits

---

## System Architecture

### Service-Oriented Architecture (Microservices)

| Service | Technology | Port | Database | Purpose |
|---------|-----------|------|----------|---------|
| **API Gateway** | Node.js + TypeScript + Express | 5000 | None | Routing, WebSocket hub, auth validation |
| **Auth & Billing** | NestJS + TypeScript | 3001 | PostgreSQL | User auth, subscriptions, Stripe integration |
| **Intelligence Core** | Python + FastAPI | 8000 | PostgreSQL | LLM orchestration, Mistral 7B inference, session mgmt |
| **Cognitive Memory** | Python + FastAPI | 8001 | Redis + PostgreSQL | Memory CRUD, STM/ITM/LTM, semantic search |
| **Noble-Spirit Policy** | Elixir + Phoenix | 4000 | PostgreSQL | Constitutional validation, ethical filtering |
| **NGS Curriculum** | Go + Fiber | 9000 | PostgreSQL | 24-level progression, XP, achievements |
| **MCP Server** | Rust | 7000 | None | VSCode integration, context persistence |
| **Reflection Worker** | Python + Celery | N/A | Redis | Background reflection processing |
| **Frontend** | React + TypeScript + Vite | 5000 | None | User interface, chat, NGS portal |

### Technology Stack Rationale

- **Node.js (Gateway)**: Fast I/O, excellent WebSocket support
- **NestJS (Auth)**: Enterprise patterns, built-in validation, Stripe integration
- **Python (Intelligence/Memory)**: ML ecosystem, FastAPI async performance
- **Elixir (Policy)**: Immutability guarantees, fault tolerance, pattern matching for rules
- **Go (Curriculum)**: Fast computation for XP calculations, excellent concurrency
- **Rust (MCP)**: Type safety, performance for VSCode extension protocol
- **React (Frontend)**: Rich ecosystem, TypeScript support, Vite for fast dev

---

## Database Architecture

### Central Shared Database (PostgreSQL)

All services connect to shared PostgreSQL for cross-cutting concerns:

```sql
-- User Management (owned by Auth & Billing)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'student', -- student, subscriber, admin
  subscription_tier VARCHAR(50) DEFAULT 'free_trial',
  trial_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscription Management
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  status VARCHAR(50), -- active, canceled, past_due, trialing
  tier VARCHAR(50), -- free, basic, pro
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage Tracking
CREATE TABLE usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(100), -- memory_storage, llm_tokens, agent_minutes
  amount INTEGER NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- NGS Curriculum Reference Data
CREATE TABLE curriculum_levels (
  id INTEGER PRIMARY KEY,
  level_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  unlock_requirements JSONB,
  xp_required INTEGER NOT NULL
);
```

### Service-Owned Schemas

#### Cognitive Memory Service

```sql
-- Main memory storage
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID,
  type VARCHAR(50), -- lesson, task, conversation, error, reflection
  input_context TEXT,
  output_response TEXT,
  outcome VARCHAR(50), -- success, failure, neutral
  emotional_weight FLOAT CHECK (emotional_weight BETWEEN -1 AND 1),
  confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
  constitution_valid BOOLEAN DEFAULT true,
  tags TEXT[],
  vector_embedding VECTOR(384), -- pgvector extension required
  tier VARCHAR(20), -- stm, itm, ltm
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP -- NULL for LTM, set for STM/ITM
);

CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_session_id ON memories(session_id);
CREATE INDEX idx_memories_tier ON memories(tier);
CREATE INDEX idx_memories_expires_at ON memories(expires_at) WHERE expires_at IS NOT NULL;

-- Reflection storage (hidden from users)
CREATE TABLE reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  self_assessment TEXT NOT NULL,
  alignment_score FLOAT CHECK (alignment_score BETWEEN 0 AND 1),
  improvement_notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Distilled knowledge (compressed wisdom)
CREATE TABLE distilled_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_reflections UUID[],
  topic VARCHAR(255),
  principle TEXT NOT NULL,
  embedding VECTOR(384),
  confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Redis Structure

```
# Short-Term Memory (1-hour TTL)
stm:{session_id} -> JSON string (list of recent interactions)

# Intermediate-Term Memory (7-day TTL)
itm:{user_id} -> Sorted Set (score = access_count)

# Celery Job Queue
celery:reflection:tasks -> List

# Rate Limiting
ratelimit:{user_id}:{endpoint} -> String (counter)
```

#### Intelligence Core Service

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, completed, abandoned
  model_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  input_text TEXT NOT NULL,
  output_text TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### NGS Curriculum Service

```sql
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  current_level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  agent_creation_unlocked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source VARCHAR(100), -- lesson_completion, reflection_quality, quiz_score
  xp_awarded INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_type VARCHAR(100),
  achievement_data JSONB,
  unlocked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_xp_events_user_id ON xp_events(user_id);
```

#### Noble-Spirit Policy Service

```sql
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  policy_name VARCHAR(255) NOT NULL,
  policy_content JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  signature VARCHAR(255), -- cryptographic signature for immutability
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE policy_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES policies(id),
  user_id UUID,
  action VARCHAR(100), -- validation_passed, validation_failed, override_attempted
  context JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Memory System Architecture

### Three-Tier Memory Model

#### 1. Short-Term Memory (STM)
- **Storage**: Redis with 1-hour TTL
- **Purpose**: Active conversation context
- **Capacity**: Last 10-20 interactions per session
- **Promotion**: Never promoted (expires or gets distilled)

#### 2. Intermediate-Term Memory (ITM)
- **Storage**: Redis with 7-day sliding TTL
- **Purpose**: Recent patterns, preferences, working knowledge
- **Capacity**: ~100 memories per user (sorted by access count)
- **Promotion**: Moves to LTM if `access_count > 3` or manually pinned

#### 3. Long-Term Memory (LTM)
- **Storage**: PostgreSQL with pgvector
- **Purpose**: Permanent validated knowledge
- **Capacity**: Unlimited (subscription tier dependent)
- **Characteristics**: 
  - `constitution_valid = true` (ethically filtered)
  - High `confidence_score`
  - `expires_at IS NULL`

### Memory Distillation Logic

**Nightly Batch Process:**
1. Fetch all reflections from last 24 hours
2. Group by topic/tags
3. Calculate aggregate scores:
   - `emotional_weight`: Average across group
   - `confidence_score`: Weighted by outcome success rate
   - `constitution_valid`: AND operation (all must pass)
4. If criteria met, compress into `distilled_knowledge`
5. Promote ITM → LTM if `access_count >= 3`
6. Archive contradicted memories (replaced, not deleted)

**Promotion Criteria:**
- Emotional weight: `|emotional_weight| > 0.3` (significant impact)
- Confidence: `confidence_score > 0.7`
- Constitutional: `constitution_valid = true`
- Effectiveness: `outcome = 'success'` OR high access count

---

## API Specifications

### API Gateway (Port 3000)

**Authentication Endpoints:**
```
POST   /api/auth/register          # User registration
POST   /api/auth/login             # Login (returns JWT + refresh token)
POST   /api/auth/refresh           # Refresh access token
POST   /api/auth/logout            # Invalidate tokens
GET    /api/auth/me                # Get current user
```

**Chat Endpoints:**
```
WS     /ws/chat                    # WebSocket for streaming chat
POST   /api/chat/message           # Send message (REST alternative)
GET    /api/chat/sessions          # List user sessions
GET    /api/chat/history/:session  # Get session history
```

**Memory Endpoints:**
```
GET    /api/memory/retrieve        # Get memories for context
POST   /api/memory/search          # Semantic search
GET    /api/memory/stats           # Usage statistics
```

**NGS Curriculum Endpoints:**
```
GET    /api/ngs/progress           # User's curriculum progress
POST   /api/ngs/complete-lesson    # Mark lesson complete
GET    /api/ngs/achievements       # User achievements
GET    /api/ngs/leaderboard        # Top learners (gamification)
```

**Billing Endpoints:**
```
POST   /api/billing/create-checkout    # Start Stripe checkout
POST   /api/billing/webhooks           # Stripe webhook handler
GET    /api/billing/portal             # Customer portal link
GET    /api/billing/usage              # Current usage stats
```

### Inter-Service Communication

**Intelligence Core → Cognitive Memory:**
```
POST   /internal/memory/store      # Store new memory
GET    /internal/memory/context    # Get context for prompt
```

**Intelligence Core → Reflection Worker (via Celery):**
```python
# Task queue
reflect_on_interaction.delay(
    user_id, 
    session_id, 
    input_text, 
    output_text
)
```

**Reflection Worker → Noble-Spirit Policy:**
```
POST   /internal/policy/validate   # Validate alignment
GET    /internal/policy/rules      # Fetch active policies
```

---

## Reflection Engine Architecture

### Reflection Lifecycle

**Trigger:** After every LLM response
**Process:**
1. Intelligence Core enqueues reflection task (Celery)
2. Reflection Worker retrieves task
3. Worker calls Noble-Spirit for policy validation
4. Worker generates self-assessment (3 questions):
   - What did I attempt?
   - Was I aligned with my principles?
   - How could I improve next time?
5. Worker calculates alignment_score
6. Worker stores reflection in Cognitive Memory
7. Worker queues for nightly distillation

**Storage:** Reflections are HIDDEN from users (backend only)

**User Visibility:** Users see:
- Retrieved memories that informed the response
- NOT the raw reflections

---

## Noble Growth School (NGS) Curriculum

### 24-Level Progression System

**Level Ranges:**
- **Levels 1-6**: Foundation
  - Self-awareness, basic logic, ethical foundations, communication
- **Levels 7-12**: Intermediate
  - Advanced reasoning, emotional intelligence, creativity, collaboration
- **Levels 13-18**: Advanced
  - Systems thinking, leadership, innovation, philosophical depth
- **Levels 19-24**: Mastery
  - Wisdom integration, mentorship, visionary planning, transcendent purpose

**Agent Creation Unlock:** Level 12

**XP Sources & Values:**
- Lesson completion: 50 XP
- Quiz perfect score: 100 XP
- High-quality reflection: 25 XP
- Helping others: 10 XP
- Creative solution: 75 XP

**Level Requirements:**
```javascript
const levelThresholds = [
  0,     // Level 1
  100,   // Level 2
  250,   // Level 3
  450,   // Level 4
  700,   // Level 5
  1000,  // Level 6
  // ... progressive scaling
];
```

---

## Subscription Tiers & Monetization

### Pricing Tiers

| Tier | Price | Memory Quota | Token Limit | Features |
|------|-------|--------------|-------------|----------|
| **Free Trial** | $0 (7 days) | 1GB | 1,000/day | Levels 1-3 |
| **Basic** | $9/month | 10GB | 50,000/day | All 24 levels |
| **Pro** | $29/month | Unlimited | Unlimited | Priority GPU, VSCode MCP |

### Usage Tracking

**Metered Resources:**
- LLM tokens consumed
- Memory storage (GB)
- Agent runtime minutes

**Enforcement Points:**
- API Gateway: Check tier before routing
- Intelligence Core: Count tokens, reject if over limit
- Cognitive Memory: Enforce storage quotas

---

## VSCode MCP Integration

### MCP Server Endpoints (Rust)

```
POST   /mcp/context/fetch          # Get relevant memories for file
POST   /mcp/memory/log             # Store code interaction
POST   /mcp/task/submit            # Submit task to Intelligence Core
GET    /mcp/health                 # Health check
```

### VSCode Extension Flow

1. User opens file in VSCode
2. Extension authenticates via OAuth Device Code
3. Extension calls `/mcp/context/fetch` with file path
4. MCP Server → Cognitive Memory (semantic search)
5. Context displayed in sidebar
6. User edits → Extension logs to memory via `/mcp/memory/log`
7. Context persists across sessions

---

## Deployment Architecture

### Development (Docker Compose)

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg15
    ports: ['5432:5432']
    
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    
  gateway:
    build: ./services/gateway
    ports: ['3000:3000']
    
  auth-billing:
    build: ./services/auth-billing
    ports: ['3001:3001']
    
  intelligence:
    build: ./services/intelligence
    ports: ['8000:8000']
    
  memory:
    build: ./services/memory
    ports: ['8001:8001']
    
  frontend:
    build: ./services/frontend
    ports: ['5000:5000']
```

### Production (DigitalOcean)

**Droplet A (App Server):**
- Size: 8GB RAM, 4vCPU ($48/month)
- Services: Gateway, Auth, Memory, NGS, Frontend
- OS: Ubuntu 22.04 LTS

**Droplet B (GPU Server):**
- Size: GPU + 16GB RAM ($200/month)
- Services: Intelligence Core (vLLM), Reflection Worker
- OS: Ubuntu 22.04 LTS + CUDA drivers

**Managed Services:**
- PostgreSQL: DigitalOcean Managed Database ($15/month)
- Redis: DigitalOcean Managed Redis ($15/month)
- Block Storage: 100GB for models ($10/month)

**Total Monthly Cost:** ~$288/month
**Breakeven:** ~15 Pro subscribers or ~32 Basic subscribers

---

## Development Phases

### Phase 1: Foundation ✅ COMPLETE
- Project structure setup
- Docker Compose configuration
- Shared PostgreSQL schema
- Redis configuration
- Environment management

### Phase 2: Auth & Billing ✅ COMPLETE
- NestJS service setup with TypeScript
- JWT + refresh token authentication
- User registration/login with bcrypt password hashing
- RBAC (Role-Based Access Control) with student/subscriber/admin roles
- Stripe subscription integration (Basic $9/mo, Pro $29/mo)
- Stripe webhook handling (checkout, subscription events)
- Customer portal generation
- Usage tracking API
- 7-day free trial for new users
- Database integration with connection pooling

### Phase 3: API Gateway ✅ COMPLETE
- Node.js/TypeScript setup
- Express routing with proper middleware order
- WebSocket support with JWT authentication
- JWT validation middleware for protected routes
- Service proxying to all microservices (auth, billing, chat, memory, NGS)
- Rate limiting (100 req/15min per IP)
- Error handling and logging
- Health checks and status endpoints

### Phase 4: Intelligence Core ✅ COMPLETE
- FastAPI setup with async/await architecture
- Ollama integration with health checking
- Mistral 7B model loading with CPU/GPU auto-detection
- Session management with PostgreSQL persistence
- Streaming responses via Server-Sent Events (SSE)
- Token counting and usage tracking
- Rate limiting by subscription tier
- Comprehensive error handling and logging
- User authentication via request headers
- Database connection pooling

### Phase 5: Cognitive Memory
- FastAPI memory service
- Redis STM/ITM implementation
- PostgreSQL LTM with pgvector
- Semantic search
- Memory CRUD operations

### Phase 6: Noble-Spirit Policy
- Elixir/Phoenix setup
- Policy rule engine
- Constitutional validation
- Audit logging
- Immutability guarantees

### Phase 7: Reflection Engine
- Celery worker setup
- Reflection task processing
- Noble-Spirit integration
- Self-assessment generation
- Memory storage

### Phase 8: Memory Distillation
- Nightly batch job
- Emotional scoring
- Confidence calculation
- ITM→LTM promotion
- Contradiction resolution

### Phase 9: NGS Curriculum
- Go/Fiber service setup
- 24-level system
- XP event tracking
- Achievement system
- Agent unlock gating

### Phase 10: Frontend
- React/TypeScript/Vite setup
- Chat interface
- NGS portal
- Memory visualization
- Subscription management

### Phase 11: MCP Server
- Rust MCP server
- VSCode extension
- OAuth device code
- Context persistence

### Phase 12: Usage Tracking
- Usage ledger
- Quota enforcement
- Token metering
- Billing portal

### Phase 13: Observability
- Prometheus metrics
- Grafana dashboards
- Health checks
- Error tracking

### Phase 14: Production Deployment
- Terraform configs
- DO droplet setup
- vLLM configuration
- CI/CD pipeline
- SSL/TLS setup

### Phase 15: Testing & Optimization
- Integration tests
- Load testing
- Performance optimization
- Security audit
- UAT

---

## Key Design Decisions

### Why Multiple Languages?

- **Node.js (Gateway)**: Best WebSocket performance, large ecosystem
- **NestJS (Auth)**: Enterprise patterns, Stripe SDK quality
- **Python (AI/Memory)**: ML libraries, FastAPI async, scikit-learn
- **Elixir (Policy)**: Immutability guarantees, pattern matching for rules
- **Go (Curriculum)**: Fast XP calculations, concurrency for leaderboards
- **Rust (MCP)**: Type safety, VSCode protocol performance

### Why Service-Owned Databases?

- **Loose coupling**: Services can evolve independently
- **Clear boundaries**: Each service owns its domain
- **Scalability**: Services scale independently
- **Resilience**: Failure isolation

### Why Extended TTL for Memory?

- **Standard chat**: 30-minute context window
- **NovaCoreAI**: 1-hour STM, 7-day ITM, permanent LTM
- **Competitive advantage**: Deep context persistence
- **User value**: "The AI that never forgets"

---

## Project Structure

```
noble-novacore-ai/
├── services/
│   ├── gateway/              # Node.js API Gateway
│   ├── auth-billing/         # NestJS Auth & Billing
│   ├── intelligence/         # Python Intelligence Core
│   ├── memory/               # Python Cognitive Memory
│   ├── noble-spirit/         # Elixir Policy Service
│   ├── ngs-curriculum/       # Go Curriculum Service
│   ├── mcp-server/           # Rust MCP Server
│   └── frontend/             # React Frontend
├── shared/
│   ├── schemas/              # Shared database schemas
│   ├── types/                # TypeScript type definitions
│   └── proto/                # gRPC proto files (if used)
├── infrastructure/
│   ├── docker/               # Docker Compose configs
│   ├── terraform/            # Infrastructure as Code
│   └── k8s/                  # Kubernetes manifests (future)
├── docs/
│   ├── api/                  # API documentation
│   ├── architecture/         # Architecture diagrams
│   └── deployment/           # Deployment guides
├── docker-compose.yml        # Development environment
├── docker-compose.prod.yml   # Production config
├── .env.example              # Environment template
└── README.md                 # Quick start guide
```

---

## Future Feature Roadmap

### Post-MVP Enhancements

1. **AI Agency System** (Phase 16)
   - Multi-agent collaboration
   - Role-based teams
   - Inter-agent communication

2. **Agent Hangout** (Phase 17)
   - Agent-to-agent learning sessions
   - Moderator agent
   - Knowledge cross-pollination

3. **Advanced Analytics** (Phase 18)
   - User behavior insights
   - Memory pattern analysis
   - Curriculum effectiveness metrics

4. **White-Label Platform** (Phase 19)
   - Multi-tenancy support
   - Custom branding
   - Reseller program

---

## Critical Success Factors

### For MVP Launch

✅ **Must Have:**
- Multi-user auth with subscription tiers
- Persistent memory with 1hr/7day/permanent tiers
- Constitutional reflection engine
- NGS curriculum (at least levels 1-12)
- Stripe integration with free trial
- Functional chat interface

🎯 **Nice to Have:**
- MCP VSCode integration
- Full 24-level curriculum
- Advanced observability
- Production-grade security audit

### Revenue Targets

- **Month 1**: 10 paid users ($90-290)
- **Month 3**: 50 paid users ($450-1,450)
- **Month 6**: 200 paid users ($1,800-5,800)
- **Breakeven**: 15 Pro or 32 Basic subscribers

---

**Last Updated:** November 9, 2025  
**Architecture Version:** 1.0  
**Status:** Phases 1-4 Complete ✅ (Foundation, Auth & Billing, API Gateway, Intelligence Core | Next: Phase 5 - Cognitive Memory)
