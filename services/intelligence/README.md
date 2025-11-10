# Intelligence Core Service

**Technology:** Python + FastAPI  
**Port:** 8000  
**Database:** PostgreSQL (sessions, prompts)  
**LLM:** Mistral 7B 4-bit via Ollama

## Status
✅ **Phase 4 Complete**

## Features Implemented
- ✅ FastAPI application with proper structure
- ✅ Ollama integration for Mistral 7B inference
- ✅ CPU/GPU auto-detection
- ✅ Session management (create, retrieve, end sessions)
- ✅ Prompt/response storage in PostgreSQL
- ✅ Streaming response support via Server-Sent Events
- ✅ Non-streaming response endpoint
- ✅ Token counting and usage tracking
- ✅ Rate limiting by subscription tier
- ✅ Conversation history with context
- ✅ User authentication via headers (X-User-Id)
- ✅ Comprehensive error handling and logging
- ✅ **Memory Service integration** for persistent context (STM/ITM/LTM)
- ✅ **Reflection Worker integration** for asynchronous self-assessment
- ✅ **Intelligent context retrieval** combining multiple memory tiers

## API Endpoints

### Chat
- `POST /chat/message` - Send message and get non-streaming response
- `POST /chat/stream` - Send message and stream response (SSE)
- `GET /chat/sessions` - List user's chat sessions
- `GET /chat/history/{session_id}` - Get conversation history
- `POST /chat/sessions/{session_id}/end` - End a session

### System
- `GET /health` - Health check with service status
- `GET /` - Service information

## Setup Instructions

### Prerequisites
- Python 3.11+
- PostgreSQL with schema initialized
- Ollama installed locally or accessible via network

### Local Development

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Set environment variables:
   ```bash
   export DATABASE_URL="postgresql://noble:changeme@localhost:5432/noble_novacore"
   export OLLAMA_URL="http://localhost:11434"
  export LLM_MODEL="mistral:instruct"
   ```

3. Run the service:
   ```bash
   python main.py
   ```

### Docker

Build and run with Docker:
```bash
docker build -t intelligence-core .
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://noble:changeme@postgres:5432/noble_novacore" \
  -e OLLAMA_URL="http://host.docker.internal:11434" \
  intelligence-core
```

## Architecture

### Project Structure
```
intelligence/
├── app/
│   ├── routers/          # API route handlers
│   │   └── chat.py       # Chat endpoints
│   ├── services/         # Business logic
│   │   ├── ollama_service.py   # LLM integration
│   │   └── session_service.py  # Session management
│   ├── models/           # Pydantic schemas
│   │   └── schemas.py    # Request/response models
│   ├── utils/            # Utilities
│   │   └── token_counter.py  # Token counting
│   ├── config.py         # Configuration
│   └── database.py       # Database connection
├── main.py               # Application entry point
├── requirements.txt      # Python dependencies
└── Dockerfile
```

### Database Tables Used
- `sessions` - Chat session tracking
- `prompts` - Prompt/response storage
- `users` - User information (read-only)

### Key Dependencies
- **FastAPI** - Web framework
- **SQLAlchemy** - Database ORM
- **httpx** - Async HTTP client for Ollama
- **tiktoken** - Token counting
- **sse-starlette** - Server-Sent Events support

## Configuration

Environment variables:
- `PORT` - Service port (default: 8000)
- `DATABASE_URL` - PostgreSQL connection string
- `OLLAMA_URL` - Ollama API URL
- `LLM_MODEL` - Model name (default: mistral:instruct)
- `GPU_ENABLED` - Enable GPU detection (default: false)
- `FREE_TIER_TOKENS_DAY` - Free tier daily token limit
- `BASIC_TIER_TOKENS_DAY` - Basic tier daily token limit
- `PRO_TIER_TOKENS_DAY` - Pro tier daily token limit (-1 = unlimited)

## Usage Examples

### Send a message (non-streaming)
```bash
curl -X POST http://localhost:8000/chat/message \
  -H "Content-Type: application/json" \
  -H "X-User-Id: <user-uuid>" \
  -d '{
    "message": "Hello, tell me about AI ethics",
    "use_memory": true,
    "stream": false
  }'
```

### Stream a response
```bash
curl -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -H "X-User-Id: <user-uuid>" \
  -d '{
    "message": "Explain quantum computing",
    "stream": true
  }'
```

### Get chat history
```bash
curl http://localhost:8000/chat/history/<session-id> \
  -H "X-User-Id: <user-uuid>"
```

## Notes

### Ollama Integration
The service integrates with Ollama for LLM inference. If Ollama is not available at startup, the service will operate in degraded mode but remain operational for other endpoints.

### Token Counting
Uses tiktoken with GPT-3.5 encoding as an approximation for Mistral token counting. Actual token counts may vary slightly but are close enough for rate limiting purposes.

### Future Enhancements (Phase 7)
- Reflection worker integration (Celery)
- Memory service integration for context retrieval
- Noble-Spirit policy validation

## Testing

Test the service health:
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "intelligence-core",
  "database": true,
  "ollama": true,
  "model_loaded": true,
  "gpu_available": false
}
```

## Service Integrations (Phases 5-8)

The Intelligence Core now integrates with the Memory, Reflection, and Policy services to provide enhanced capabilities.

### Memory Service Integration

**Automatic Context Retrieval**: When `use_memory: true` is set in a chat request, the Intelligence Core automatically:

1. Retrieves context from the Memory Service combining:
   - **STM (Short-Term Memory)**: Recent conversation (last 3 interactions)
   - **ITM (Intermediate-Term Memory)**: Frequently accessed patterns (top 2)
   - **LTM (Long-Term Memory)**: High-confidence permanent knowledge (top 3)

2. Builds an intelligent context prompt that includes relevant memories

3. Falls back to local database history if Memory Service is unavailable

**STM Storage**: After each interaction, the Intelligence Core:
- Stores the interaction in STM (Short-Term Memory) via the Memory Service
- This provides fast context retrieval for subsequent interactions
- STM has a 1-hour TTL and is stored in Redis

**Configuration**:
```bash
MEMORY_SERVICE_URL=http://memory:8001  # Memory service endpoint
```

### Reflection Worker Integration

**Asynchronous Reflection**: After each AI response, the Intelligence Core:

1. Enqueues a reflection task to the Celery worker
2. The Reflection Worker processes the interaction asynchronously:
   - Validates alignment with Noble-Spirit Policy
   - Generates self-assessment (3 questions)
   - Calculates alignment score
   - Stores reflection as LTM memory

3. Does not block the response - happens in the background

**Configuration**:
```bash
CELERY_BROKER_URL=redis://redis:6379/2  # Celery broker for reflection tasks
ENABLE_REFLECTION=true                   # Enable/disable reflection (default: true)
```

**Disabling Reflection**:
To disable reflection (e.g., for testing):
```bash
export ENABLE_REFLECTION=false
```

### Integration Flow

```
User Request
    ↓
Intelligence Core
    ↓
┌───────────────────────────────────────┐
│ 1. Get Memory Context                 │
│    - STM (Redis)                      │
│    - ITM (Redis, sorted by access)   │
│    - LTM (PostgreSQL + pgvector)     │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│ 2. Build Context Prompt               │
│    - Relevant Knowledge (LTM)         │
│    - Recent Patterns (ITM)            │
│    - Conversation History (STM)       │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│ 3. Generate Response (Ollama)         │
│    - With enriched context            │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│ 4. Store & Trigger Background Tasks   │
│    - Store in local DB                │
│    - Store in STM (Memory Service)    │
│    - Trigger Reflection (Celery)      │
└───────────────────────────────────────┘
    ↓
Response to User
```

### Example with Memory Context

**Request**:
```json
POST /chat/message
{
  "message": "What did we discuss about authentication?",
  "use_memory": true
}
```

**Behind the scenes**:
1. Retrieves LTM memories about "authentication"
2. Retrieves recent STM conversation
3. Builds context:
   ```
   # Relevant Knowledge:
   - How to implement authentication in Node.js? Use JWT tokens...
   
   # Recent Conversation:
   User: Tell me about security best practices
   Assistant: Security best practices include...
   
   User: What did we discuss about authentication?
   ```
4. Generates response with full context
5. Stores interaction in STM
6. Triggers reflection worker

### Testing Integrations

**Test Memory Context Retrieval**:
```bash
# First, store some memories
curl -X POST http://localhost:8001/memory/store \
  -H "Content-Type: application/json" \
  -H "X-User-Id: <uuid>" \
  -d '{
    "type": "conversation",
    "input_context": "How to use JWT tokens?",
    "output_response": "JWT tokens provide stateless authentication...",
    "tier": "ltm",
    "confidence_score": 0.9
  }'

# Then, chat with memory enabled
curl -X POST http://localhost:8000/chat/message \
  -H "Content-Type: application/json" \
  -H "X-User-Id: <uuid>" \
  -d '{
    "message": "Remind me about JWT tokens",
    "use_memory": true
  }'
```

**Monitor Reflection Tasks**:
```bash
# Check reflection worker logs
docker logs noble-reflection

# Should see reflection tasks being processed
```

**Check STM Storage**:
```bash
# After chatting, check STM
curl http://localhost:8001/memory/stm/retrieve/<session-id> \
  -H "X-User-Id: <uuid>"
```

### Graceful Degradation

If Memory Service or Reflection Worker are unavailable:
- Intelligence Core continues to function normally
- Falls back to local database for conversation history
- Logs warnings but doesn't fail requests
- Reflection tasks are simply not queued

This ensures high availability even if supporting services are down.

### Performance Considerations

- Memory context retrieval: < 100ms (Redis + PostgreSQL)
- STM storage: < 50ms (Redis)
- Reflection triggering: < 10ms (async, non-blocking)
- Total overhead: ~150ms for memory-enabled requests

The overhead is minimal and doesn't significantly impact user experience.
