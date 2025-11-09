# Cognitive Memory Service

**Technology:** Python + FastAPI  
**Port:** 8001  
**Database:** Redis (STM/ITM) + PostgreSQL (LTM) with pgvector

## Status
✅ **Phase 5 Complete**

## Overview

The Cognitive Memory Service implements a three-tier memory system for persistent context:

- **STM (Short-Term Memory)**: 1-hour TTL, stored in Redis, used for active conversations
- **ITM (Intermediate-Term Memory)**: 7-day TTL, stored in Redis, sorted by access count
- **LTM (Long-Term Memory)**: Permanent storage in PostgreSQL with vector embeddings

## Features

- ✅ Three-tier memory architecture (STM/ITM/LTM)
- ✅ Semantic search using sentence transformers and pgvector
- ✅ Memory CRUD operations
- ✅ Tier promotion logic (STM → ITM → LTM)
- ✅ Access count tracking
- ✅ Vector embeddings (384-dimensional)
- ✅ Context retrieval for LLM prompts
- ✅ Memory usage statistics
- ✅ Redis-backed fast access for STM/ITM
- ✅ PostgreSQL persistence for LTM

## Architecture

```
Memory Service (Port 8001)
│
├── Redis (STM/ITM)
│   ├── DB 0: Short-Term Memory (session-based)
│   └── DB 1: Intermediate-Term Memory (user-based, sorted sets)
│
├── PostgreSQL (LTM)
│   ├── memories table (with pgvector)
│   ├── reflections table (Phase 7)
│   └── distilled_knowledge table (Phase 8)
│
├── Sentence Transformers
│   └── all-MiniLM-L6-v2 (384-dim embeddings)
│
└── FastAPI
    └── Memory Router (CRUD + Search endpoints)
```

## API Endpoints

### Memory Management

- `POST /memory/store` - Store new memory
- `GET /memory/retrieve/{id}` - Get memory by ID
- `GET /memory/list` - List memories (with pagination & tier filter)
- `POST /memory/search` - Semantic search
- `PATCH /memory/update/{id}` - Update memory
- `DELETE /memory/delete/{id}` - Delete memory (soft delete)
- `POST /memory/promote/{id}` - Promote to higher tier
- `GET /memory/stats` - Get usage statistics

### Short-Term Memory (STM)

- `POST /memory/stm/store` - Store STM interaction
- `GET /memory/stm/retrieve/{session_id}` - Get STM for session
- `DELETE /memory/stm/clear/{session_id}` - Clear STM

### Intermediate-Term Memory (ITM)

- `GET /memory/itm/retrieve` - Get ITM references

### Context Retrieval

- `GET /memory/context` - Get combined context for LLM prompts

### System

- `GET /` - Service information
- `GET /health` - Health check

## Setup Instructions

### Prerequisites

- Python 3.11+
- PostgreSQL 15+ with pgvector extension
- Redis 7+

### Local Development

1. Install dependencies:
```bash
cd services/memory
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export DATABASE_URL="postgresql://noble:changeme@localhost:5432/noble_novacore"
export REDIS_URL="redis://localhost:6379"
export PORT=8001
```

3. Run the service:
```bash
python main.py
```

### Docker

```bash
docker compose up memory
```

## Configuration

Environment variables (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `REDIS_STM_DB` - Redis DB for STM (default: 0)
- `REDIS_ITM_DB` - Redis DB for ITM (default: 1)
- `STM_TTL_SECONDS` - STM time-to-live (default: 3600)
- `ITM_TTL_SECONDS` - ITM time-to-live (default: 604800)
- `LTM_PROMOTION_THRESHOLD` - Access count for ITM→LTM (default: 3)
- `EMBEDDING_MODEL` - Sentence transformer model (default: all-MiniLM-L6-v2)

## Usage Examples

### Store a Memory

```bash
curl -X POST http://localhost:8001/memory/store \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{
    "type": "conversation",
    "input_context": "How do I implement authentication?",
    "output_response": "Use JWT tokens with bcrypt for password hashing...",
    "outcome": "success",
    "confidence_score": 0.9,
    "tier": "ltm",
    "tags": ["authentication", "security"]
  }'
```

### Semantic Search

```bash
curl -X POST http://localhost:8001/memory/search \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{
    "query": "authentication best practices",
    "limit": 5,
    "tier": "ltm"
  }'
```

### Get Context for LLM

```bash
curl http://localhost:8001/memory/context?session_id=session-123 \
  -H "X-User-Id: user-123"
```

## Memory Tier Promotion

Memories can be promoted through tiers:

1. **STM → ITM**: Manually via API or automatically based on access patterns
2. **ITM → LTM**: When access_count >= threshold (default: 3)
3. **Direct to LTM**: Important memories can be stored directly in LTM

Promotion updates expiry times:
- STM: 1 hour TTL
- ITM: 7 days TTL
- LTM: No expiry (permanent)

## Integration with Intelligence Core

The Intelligence Core service calls `/memory/context` to retrieve relevant memories when generating responses:

```python
# Intelligence Core pseudo-code
context = requests.get(
    f"{MEMORY_SERVICE_URL}/memory/context",
    params={"session_id": session_id},
    headers={"X-User-Id": user_id}
)

# Context includes:
# - STM: Recent conversation (last 5 interactions)
# - ITM: Frequently accessed memories
# - LTM: High-confidence permanent knowledge

prompt = build_prompt(user_message, context)
response = llm.generate(prompt)
```

## Testing

```bash
# Health check
curl http://localhost:8001/health

# Store test memory
curl -X POST http://localhost:8001/memory/store \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test-user" \
  -d '{"type":"conversation","input_context":"test","tier":"stm"}'

# List memories
curl http://localhost:8001/memory/list \
  -H "X-User-Id: test-user"
```

## Dependencies

- **fastapi**: Web framework
- **uvicorn**: ASGI server
- **pydantic**: Data validation
- **sqlalchemy**: Database ORM
- **psycopg2-binary**: PostgreSQL driver
- **redis**: Redis client
- **sentence-transformers**: Embedding generation
- **numpy**: Vector operations

## Next Steps (Phase 6-8)

- Phase 6: Noble-Spirit Policy integration for constitutional validation
- Phase 7: Reflection Engine for self-assessment
- Phase 8: Memory Distillation for knowledge compression
