# Phase 11: MCP Server Integration Guide

**Date:** November 9, 2025  
**Author:** GitHub Copilot Agent  
**Version:** 1.0

---

## Overview

This guide provides step-by-step instructions for integrating and testing the MCP Server and VSCode extension with the Noble NovaCoreAI platform.

## Prerequisites

### System Requirements
- Docker and Docker Compose
- Rust 1.75+ (for MCP server development)
- Node.js 18+ (for VSCode extension)
- VSCode 1.85+ (for extension testing)
- PostgreSQL 15+ with pgvector
- Redis 7+

### Running Services
Before testing the MCP server, ensure these services are running:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Auth & Billing (port 3001)
- Intelligence Core (port 8000)
- Memory Service (port 8001)
- API Gateway (port 5000)

---

## Part 1: MCP Server Setup

### 1.1 Build from Source

```bash
cd /home/runner/work/NovaCoreAI/NovaCoreAI/services/mcp-server

# Development build
cargo build

# Release build (optimized)
cargo build --release
```

### 1.2 Configuration

Create a `.env` file or set environment variables:

```bash
PORT=7000
MEMORY_SERVICE_URL=http://localhost:8001
INTELLIGENCE_SERVICE_URL=http://localhost:8000
JWT_SECRET=your-secret-key
RUST_LOG=info
```

### 1.3 Run Standalone

```bash
# Development mode
cargo run

# Or run release binary
./target/release/mcp-server
```

### 1.4 Docker Build

```bash
# Build image
docker build -t noble-mcp-server .

# Run container
docker run -p 7000:7000 \
  -e MEMORY_SERVICE_URL=http://memory:8001 \
  -e INTELLIGENCE_SERVICE_URL=http://intelligence:8000 \
  -e RUST_LOG=info \
  noble-mcp-server
```

### 1.5 Docker Compose

```bash
# Start all services including MCP server
docker-compose up -d

# Or start just MCP server
docker-compose up mcp-server

# Check logs
docker-compose logs -f mcp-server
```

---

## Part 2: Testing MCP Server Endpoints

### 2.1 Health Check

```bash
curl http://localhost:7000/mcp/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "memory_service": true,
  "intelligence_service": true
}
```

### 2.2 Context Fetch

First, get a JWT token by logging in:

```bash
# Login to get token
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.accessToken')

echo "Token: $TOKEN"
```

Then fetch context:

```bash
curl -X POST http://localhost:5000/api/mcp/context/fetch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "file_path": "/path/to/file.rs",
    "file_content": "fn main() { println!(\"Hello\"); }",
    "language": "rust",
    "limit": 5
  }'
```

**Expected Response:**
```json
{
  "memories": [
    {
      "id": "uuid",
      "content": "Input: ...\nOutput: ...",
      "tier": "ltm",
      "confidence_score": 0.95,
      "created_at": "2025-11-09T20:00:00Z"
    }
  ],
  "context_summary": "Found X relevant memory items"
}
```

### 2.3 Log Memory

```bash
curl -X POST http://localhost:5000/api/mcp/memory/log \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "file_path": "/path/to/file.rs",
    "action": "edit",
    "content": "fn main() { println!(\"Hello, World!\"); }",
    "outcome": "success"
  }'
```

**Expected Response:**
```json
{
  "memory_id": "uuid",
  "stored": true,
  "message": "Memory uuid stored successfully"
}
```

### 2.4 Submit Task

```bash
curl -X POST http://localhost:5000/api/mcp/task/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "task_description": "Explain what this function does",
    "file_context": "fn add(a: i32, b: i32) -> i32 { a + b }"
  }'
```

**Expected Response:**
```json
{
  "session_id": "uuid",
  "response": "This function adds two integers...",
  "tokens_used": 150
}
```

---

## Part 3: VSCode Extension Setup

### 3.1 Install Dependencies

```bash
cd /home/runner/work/NovaCoreAI/NovaCoreAI/vscode-extension

# Install packages
npm install

# Compile TypeScript
npm run compile
```

### 3.2 Development Testing

1. Open the `vscode-extension` folder in VSCode
2. Press `F5` to launch the Extension Development Host
3. A new VSCode window opens with the extension loaded

### 3.3 Configure Extension

In the Extension Development Host, configure settings:

1. Open Settings (Ctrl+,)
2. Search for "novacore"
3. Set configuration:

```json
{
  "novacore.apiUrl": "http://localhost:5000",
  "novacore.autoFetchContext": true,
  "novacore.autoLogChanges": true
}
```

### 3.4 Authenticate

1. Open Command Palette (Ctrl+Shift+P)
2. Run "NovaCoreAI: Authenticate"
3. Choose "Login" or "Register"
4. Enter credentials:
   - Email: test@example.com
   - Password: password123

### 3.5 Test Features

**A. Context Fetching:**
1. Open any code file
2. Context automatically fetches (if enabled)
3. Check sidebar for "NovaCoreAI" icon
4. View "File Context" panel

**B. Manual Context Fetch:**
1. Open Command Palette (Ctrl+Shift+P)
2. Run "NovaCoreAI: Fetch Context for Current File"
3. Check notification for success

**C. Task Submission:**
1. Open Command Palette (Ctrl+Shift+P)
2. Run "NovaCoreAI: Submit Task"
3. Enter task: "Explain this code"
4. View response in new document

**D. Memory Logging:**
1. Edit a file
2. Save (Ctrl+S)
3. Memory is logged automatically
4. Check MCP server logs for confirmation

**E. Status Bar:**
1. Check bottom-right for NovaCoreAI icon
2. Click to authenticate if not logged in
3. Shows checkmark when connected

---

## Part 4: Integration Testing

### 4.1 End-to-End Flow

**Test Scenario: Complete User Journey**

1. **Start Services:**
   ```bash
   docker-compose up -d
   ```

2. **Verify All Services Running:**
   ```bash
   curl http://localhost:5000/health  # Gateway
   curl http://localhost:3001/health  # Auth
   curl http://localhost:8000/health  # Intelligence
   curl http://localhost:8001/health  # Memory
   curl http://localhost:7000/mcp/health  # MCP
   ```

3. **Register User:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "testuser@example.com",
       "password": "securepass123"
     }'
   ```

4. **Login:**
   ```bash
   TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "testuser@example.com",
       "password": "securepass123"
     }' | jq -r '.accessToken')
   ```

5. **Test Context Fetch:**
   ```bash
   curl -X POST http://localhost:5000/api/mcp/context/fetch \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "file_path": "/test.rs",
       "file_content": "println!(\"test\");",
       "limit": 5
     }'
   ```

6. **Test Memory Log:**
   ```bash
   curl -X POST http://localhost:5000/api/mcp/memory/log \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "file_path": "/test.rs",
       "action": "save",
       "content": "println!(\"test\");",
       "outcome": "success"
     }'
   ```

7. **Test Task Submit:**
   ```bash
   curl -X POST http://localhost:5000/api/mcp/task/submit \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "task_description": "Explain Rust syntax",
       "file_context": "fn main() {}"
     }'
   ```

### 4.2 VSCode Extension Integration

1. Launch VSCode Extension Development Host
2. Authenticate with testuser@example.com
3. Open a Rust file
4. Observe automatic context fetch
5. Submit a task via Command Palette
6. Save file and verify memory logging
7. Check sidebar views update

---

## Part 5: Troubleshooting

### Common Issues

#### 5.1 MCP Server Won't Start

**Symptom:** Server crashes on startup

**Possible Causes:**
- Memory or Intelligence service not running
- Port 7000 already in use
- Invalid environment variables

**Solutions:**
```bash
# Check if services are running
docker-compose ps

# Check port availability
lsof -i :7000

# Check logs
docker-compose logs mcp-server

# Restart services
docker-compose restart mcp-server
```

#### 5.2 Authentication Failed

**Symptom:** 401 Unauthorized errors

**Possible Causes:**
- Invalid credentials
- Expired token
- Gateway not routing correctly

**Solutions:**
```bash
# Verify gateway is running
curl http://localhost:5000/health

# Try registering new user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"new@test.com","password":"pass123"}'

# Get fresh token
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"new@test.com","password":"pass123"}' \
  | jq -r '.accessToken')
```

#### 5.3 Context Fetch Returns Empty

**Symptom:** No memories returned from context fetch

**Possible Causes:**
- No memories stored yet
- Memory service not running
- Search query doesn't match any memories

**Solutions:**
```bash
# Store a test memory first
curl -X POST http://localhost:5000/api/mcp/memory/log \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/test.rs",
    "action": "edit",
    "content": "test content",
    "outcome": "success"
  }'

# Then try fetching
curl -X POST http://localhost:5000/api/mcp/context/fetch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/test.rs",
    "file_content": "test",
    "limit": 5
  }'
```

#### 5.4 VSCode Extension Not Loading

**Symptom:** Extension commands not available

**Possible Causes:**
- TypeScript compilation errors
- Extension not installed correctly
- VSCode version too old

**Solutions:**
```bash
# Recompile
cd vscode-extension
npm run compile

# Check for errors
npm run lint

# Verify VSCode version
code --version

# Reinstall extension
# Press F5 in extension folder to reload
```

#### 5.5 Memory Not Being Logged

**Symptom:** File saves don't create memories

**Possible Causes:**
- Not authenticated
- autoLogChanges disabled
- MCP server not reachable

**Solutions:**
1. Check authentication status in status bar
2. Verify settings: `novacore.autoLogChanges` = true
3. Check MCP server logs: `docker-compose logs mcp-server`
4. Verify API URL in settings: `novacore.apiUrl`

---

## Part 6: Monitoring & Logs

### 6.1 MCP Server Logs

**Docker Compose:**
```bash
# Follow logs
docker-compose logs -f mcp-server

# Last 100 lines
docker-compose logs --tail=100 mcp-server
```

**Standalone:**
```bash
# Logs go to stdout
RUST_LOG=debug ./target/release/mcp-server
```

**Log Levels:**
- `error`: Critical errors only
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debugging
- `trace`: Very verbose

### 6.2 VSCode Extension Logs

1. Open Developer Tools in Extension Host
   - Help > Toggle Developer Tools
2. Check Console for logs
3. Look for "Noble NovaCoreAI" messages

### 6.3 Gateway Logs

```bash
docker-compose logs -f gateway | grep mcp
```

---

## Part 7: Performance Testing

### 7.1 Load Testing

Use `hey` or `ab` to test MCP server performance:

```bash
# Install hey
go install github.com/rakyll/hey@latest

# Test health endpoint
hey -n 1000 -c 10 http://localhost:7000/mcp/health

# Test context fetch (with auth)
hey -n 100 -c 5 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -m POST \
  -d '{"file_path":"/test.rs","limit":5}' \
  http://localhost:5000/api/mcp/context/fetch
```

### 7.2 Expected Performance

**MCP Server:**
- Health check: <5ms
- Context fetch: <100ms (depends on memory service)
- Memory log: <50ms
- Task submit: <1s (depends on LLM)

**VSCode Extension:**
- Activation: <500ms
- Context fetch: <200ms
- Memory log: <100ms
- Task submit: <2s

---

## Part 8: Security Considerations

### 8.1 MCP Server Security

**Current Implementation:**
- Header-based authentication (X-User-Id)
- Trusts API Gateway for JWT validation
- Internal service communication

**Production Recommendations:**
- Implement JWT validation in MCP server
- Add rate limiting per user
- Enable HTTPS/TLS
- Add request signing for service-to-service
- Implement API key rotation

### 8.2 VSCode Extension Security

**Current Implementation:**
- Credentials stored in VSCode secrets API
- HTTPS recommended for API calls
- Token auto-refresh (future)

**Production Recommendations:**
- Implement OAuth device code flow
- Add token encryption
- Certificate pinning
- Audit logging of sensitive operations

---

## Part 9: Production Deployment

### 9.1 MCP Server Deployment

**Docker Deployment:**
```bash
# Build production image
docker build -t noble-mcp-server:1.0.0 .

# Tag for registry
docker tag noble-mcp-server:1.0.0 registry.example.com/noble-mcp-server:1.0.0

# Push to registry
docker push registry.example.com/noble-mcp-server:1.0.0
```

**Environment Variables (Production):**
```bash
PORT=7000
MEMORY_SERVICE_URL=https://memory.novacore.ai
INTELLIGENCE_SERVICE_URL=https://intelligence.novacore.ai
JWT_SECRET=${SECURE_SECRET_FROM_VAULT}
RUST_LOG=info
```

### 9.2 VSCode Extension Deployment

**Package Extension:**
```bash
cd vscode-extension

# Install vsce
npm install -g @vscode/vsce

# Package
vsce package

# Creates: noble-novacore-vscode-0.1.0.vsix
```

**Publish to Marketplace:**
```bash
# Get publisher token from marketplace

# Login
vsce login noble-novacore

# Publish
vsce publish
```

**Manual Installation:**
```bash
code --install-extension noble-novacore-vscode-0.1.0.vsix
```

---

## Part 10: Next Steps

### Immediate Tasks
1. ✅ MCP Server implemented
2. ✅ VSCode Extension implemented
3. ⏳ End-to-end testing
4. ⏳ Performance optimization
5. ⏳ Security hardening

### Future Enhancements
1. OAuth device code flow
2. WebSocket support
3. Inline code suggestions
4. Multi-file context
5. Team collaboration

---

## Appendix A: API Reference

### MCP Server Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/mcp/health` | GET | No | Health check |
| `/mcp/context/fetch` | POST | Yes | Fetch file context |
| `/mcp/memory/log` | POST | Yes | Log memory |
| `/mcp/task/submit` | POST | Yes | Submit AI task |

### VSCode Extension Commands

| Command | Description |
|---------|-------------|
| `novacore.authenticate` | Login/Register |
| `novacore.logout` | Logout |
| `novacore.fetchContext` | Fetch context |
| `novacore.submitTask` | Submit task |
| `novacore.showMemories` | Show memories |

---

## Appendix B: Configuration Reference

### MCP Server Environment Variables

```bash
# Required
PORT=7000
MEMORY_SERVICE_URL=http://memory:8001
INTELLIGENCE_SERVICE_URL=http://intelligence:8000

# Optional
JWT_SECRET=your-secret-key
RUST_LOG=info
DATABASE_URL=postgresql://...  # Not used yet
```

### VSCode Extension Settings

```json
{
  "novacore.apiUrl": "http://localhost:5000",
  "novacore.autoFetchContext": true,
  "novacore.autoLogChanges": true
}
```

---

**Document Version:** 1.0  
**Last Updated:** November 9, 2025  
**Status:** Complete  
**Next Review:** Phase 12 Integration
