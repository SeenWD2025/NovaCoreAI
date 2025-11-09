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
   export LLM_MODEL="mistral:7b-instruct-q4"
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
- `LLM_MODEL` - Model name (default: mistral:7b-instruct-q4)
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
