# MCP Server for VSCode

**Technology:** Rust (Actix-web)  
**Port:** 7000  
**Database:** None (proxies to Memory Service & Intelligence Core)

## Overview

The MCP (Model Context Protocol) Server is a Rust-based microservice that enables VSCode integration for Noble NovaCoreAI. It provides context-aware AI assistance by fetching relevant memories and submitting tasks to the Intelligence Core.

## Responsibilities

- **Context Fetching**: Retrieve relevant memories for active files
- **Memory Logging**: Store code interactions and edits
- **Task Submission**: Forward tasks to Intelligence Core with context
- **Health Monitoring**: Service health checks
- **Authentication**: User identification via headers

## API Endpoints

### GET /mcp/health
Health check endpoint that verifies connectivity to downstream services.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "memory_service": true,
  "intelligence_service": true
}
```

### POST /mcp/context/fetch
Fetch relevant context from memory for a file.

**Request:**
```json
{
  "file_path": "/path/to/file.rs",
  "file_content": "optional content",
  "language": "rust",
  "limit": 5
}
```

**Response:**
```json
{
  "memories": [
    {
      "id": "uuid",
      "content": "Input/Output context",
      "tier": "ltm",
      "confidence_score": 0.95,
      "created_at": "2025-11-09T20:00:00Z"
    }
  ],
  "context_summary": "Found 5 relevant memory items"
}
```

### POST /mcp/memory/log
Log a code interaction to memory.

**Request:**
```json
{
  "file_path": "/path/to/file.rs",
  "action": "edit",
  "content": "code content",
  "outcome": "success",
  "metadata": {}
}
```

**Response:**
```json
{
  "memory_id": "uuid",
  "stored": true,
  "message": "Memory stored successfully"
}
```

### POST /mcp/task/submit
Submit a task to the Intelligence Core.

**Request:**
```json
{
  "task_description": "Explain this function",
  "file_context": "optional file content",
  "session_id": "optional-uuid"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "response": "AI response",
  "tokens_used": 150
}
```

## Authentication

The MCP server expects the user ID in the `X-User-Id` header:
```
X-User-Id: user-uuid
```

For production, Bearer token authentication is also supported:
```
Authorization: Bearer <jwt-token>
```

## Environment Variables

```bash
PORT=7000                                    # Server port
MEMORY_SERVICE_URL=http://memory:8001       # Memory service URL
INTELLIGENCE_SERVICE_URL=http://intelligence:8000  # Intelligence service URL
JWT_SECRET=your-secret-key                  # JWT validation secret
RUST_LOG=info                               # Logging level
```

## Development Setup

### Prerequisites
- Rust 1.75+ and Cargo
- Running Memory Service (port 8001)
- Running Intelligence Core (port 8000)

### Build
```bash
cargo build
```

### Run
```bash
cargo run
```

### Test
```bash
cargo test
```

### Build Release
```bash
cargo build --release
```

## Docker

### Build Image
```bash
docker build -t mcp-server .
```

### Run Container
```bash
docker run -p 7000:7000 \
  -e MEMORY_SERVICE_URL=http://memory:8001 \
  -e INTELLIGENCE_SERVICE_URL=http://intelligence:8000 \
  mcp-server
```

## Integration with VSCode Extension

The MCP server is designed to work with the Noble NovaCoreAI VSCode extension (see `vscode-extension/` directory). The extension:

1. Authenticates users via OAuth device code flow
2. Calls `/mcp/context/fetch` when files are opened
3. Calls `/mcp/memory/log` when code is edited/saved
4. Calls `/mcp/task/submit` for AI assistance requests

## Architecture

```
┌─────────────────┐
│ VSCode Extension│
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────┐
│   MCP Server    │
│   (Port 7000)   │
└────┬───────┬────┘
     │       │
     ▼       ▼
┌─────────┐ ┌──────────────┐
│ Memory  │ │ Intelligence │
│ Service │ │    Core      │
└─────────┘ └──────────────┘
```

## Technology Stack

- **Framework**: Actix-web 4.9
- **Async Runtime**: Tokio 1.41
- **HTTP Client**: Reqwest 0.12
- **Serialization**: Serde + Serde JSON
- **Logging**: env_logger + log
- **Error Handling**: anyhow + thiserror

## Status

✅ **Implemented** (Phase 11)

## Next Steps

1. Implement VSCode extension (TypeScript)
2. Add OAuth device code flow
3. Implement WebSocket support for streaming
4. Add caching layer for frequently accessed contexts
5. Implement rate limiting per user
6. Add metrics and observability
