# Noble NovaCoreAI - API Reference

## Base URL

Development: `http://localhost:5000/api`
Production: `https://your-domain.com/api`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Rate Limits

Rate limits by subscription tier:

| Tier | Tokens/Day | Memory Storage | Requests/Min |
|------|------------|----------------|--------------|
| Free Trial | 1,000 | 1 GB | 10 |
| Basic | 50,000 | 10 GB | 50 |
| Pro | Unlimited | Unlimited | 100 |

---

## Authentication Endpoints

### Register User

**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "student",
    "subscription_tier": "free_trial"
  },
  "access_token": "jwt_token",
  "refresh_token": "refresh_token",
  "expires_in": 900
}
```

### Login

**POST** `/auth/login`

Authenticate and get access tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "jwt_token",
  "refresh_token": "refresh_token",
  "expires_in": 900,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "subscription_tier": "basic"
  }
}
```

### Refresh Token

**POST** `/auth/refresh`

Get a new access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "new_jwt_token",
  "expires_in": 900
}
```

### Get Current User

**GET** `/auth/me`

Get current user profile.

**Headers:** `Authorization: Bearer token`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "student",
  "subscription_tier": "basic",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

## Chat Endpoints

### Send Message (Non-Streaming)

**POST** `/chat/message`

Send a message and get a complete response.

**Headers:** `Authorization: Bearer token`

**Request Body:**
```json
{
  "message": "What is the Reclaimer Ethos?",
  "session_id": "uuid (optional)",
  "use_memory": true
}
```

**Response:** `200 OK`
```json
{
  "response": "The Reclaimer Ethos is...",
  "session_id": "uuid",
  "tokens_used": 245,
  "latency_ms": 1234
}
```

**Error Responses:**
- `400` - Invalid message (empty or too long)
- `401` - Unauthorized
- `429` - Rate limit exceeded
- `503` - LLM service unavailable

### Send Message (Streaming)

**POST** `/chat/stream`

Send a message and stream the response via Server-Sent Events.

**Headers:** 
- `Authorization: Bearer token`
- `Accept: text/event-stream`

**Request Body:**
```json
{
  "message": "Tell me about AI ethics",
  "session_id": "uuid (optional)",
  "use_memory": true
}
```

**Response:** `200 OK` (SSE Stream)
```
data: {"content": "AI ", "done": false}
data: {"content": "ethics ", "done": false}
...
data: {"content": "", "done": true, "session_id": "uuid", "tokens_used": 156, "latency_ms": 2000}
```

### List Sessions

**GET** `/chat/sessions`

Get all chat sessions for the current user.

**Headers:** `Authorization: Bearer token`

**Response:** `200 OK`
```json
{
  "sessions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "status": "active",
      "model_name": "mistral:7b-instruct-q4",
      "created_at": "2024-01-01T00:00:00Z",
      "ended_at": null
    }
  ],
  "total": 1
}
```

### Get Session History

**GET** `/chat/history/{session_id}`

Get conversation history for a specific session.

**Headers:** `Authorization: Bearer token`

**Response:** `200 OK`
```json
{
  "session_id": "uuid",
  "prompts": [
    {
      "id": "uuid",
      "session_id": "uuid",
      "user_id": "uuid",
      "input_text": "Hello",
      "output_text": "Hi! How can I help you?",
      "tokens_used": 23,
      "latency_ms": 456,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

**Error Responses:**
- `403` - Access denied (session belongs to another user)
- `404` - Session not found

### End Session

**POST** `/chat/sessions/{session_id}/end`

Mark a session as completed.

**Headers:** `Authorization: Bearer token`

**Response:** `200 OK`
```json
{
  "success": true,
  "session_id": "uuid"
}
```

---

## Memory Endpoints

### Store Memory

**POST** `/memory/store`

Store a new memory in any tier.

**Headers:** `Authorization: Bearer token`

**Request Body:**
```json
{
  "session_id": "uuid",
  "type": "conversation",
  "input_context": "User asked about X",
  "output_response": "AI responded with Y",
  "outcome": "success",
  "emotional_weight": 0.5,
  "confidence_score": 0.85,
  "tags": ["learning", "concepts"],
  "tier": "stm"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "type": "conversation",
  "tier": "stm",
  "created_at": "2024-01-01T00:00:00Z",
  "expires_at": "2024-01-01T01:00:00Z"
}
```

### Search Memories

**POST** `/memory/search`

Semantic search for memories using vector similarity.

**Headers:** `Authorization: Bearer token`

**Request Body:**
```json
{
  "query": "What did I learn about ethics?",
  "limit": 10,
  "tier": "ltm",
  "min_confidence": 0.7
}
```

**Response:** `200 OK`
```json
{
  "results": [
    {
      "id": "uuid",
      "type": "lesson",
      "input_context": "Ethics lesson...",
      "confidence_score": 0.92,
      "similarity_score": 0.87,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1,
  "query": "What did I learn about ethics?"
}
```

### List Memories

**GET** `/memory/list`

List memories with optional tier filter.

**Headers:** `Authorization: Bearer token`

**Query Parameters:**
- `tier` (optional): stm, itm, or ltm
- `limit` (default: 50): Max results
- `offset` (default: 0): Pagination offset

**Response:** `200 OK`
```json
{
  "memories": [...],
  "total": 42,
  "tier": "ltm"
}
```

### Get Memory Stats

**GET** `/memory/stats`

Get memory usage statistics.

**Headers:** `Authorization: Bearer token`

**Response:** `200 OK`
```json
{
  "user_id": "uuid",
  "stm_count": 5,
  "itm_count": 23,
  "ltm_count": 145,
  "total_memories": 173,
  "storage_used_mb": 23.4,
  "storage_limit_mb": 10240,
  "tier_breakdown": {
    "stm": 5,
    "itm": 23,
    "ltm": 145
  }
}
```

### Store STM Interaction

**POST** `/memory/stm/store`

Store interaction in Short-Term Memory (Redis).

**Headers:** `Authorization: Bearer token`

**Query Parameters:**
- `session_id`: Session UUID

**Request Body:**
```json
{
  "input": "User message",
  "output": "AI response",
  "timestamp": "2024-01-01T00:00:00Z",
  "tokens": 45
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "session_id": "uuid"
}
```

### Get Memory Context

**GET** `/memory/context`

Get combined context from STM, ITM, and LTM for prompt augmentation.

**Headers:** `Authorization: Bearer token`

**Query Parameters:**
- `session_id` (optional): Include STM from this session
- `limit` (default: 10): Max items per tier

**Response:** `200 OK`
```json
{
  "stm": [
    {"input": "...", "output": "...", "timestamp": "..."}
  ],
  "itm": [
    {"id": "uuid", "type": "conversation", "input": "...", "access_count": 5}
  ],
  "ltm": [
    {"id": "uuid", "type": "lesson", "input": "...", "confidence": 0.9}
  ]
}
```

---

## Policy Endpoints

### Validate Content

**POST** `/policy/validate`

Validate content against constitutional policies.

**Request Body:**
```json
{
  "content": "Text to validate",
  "context": "Optional context",
  "user_id": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "result": "passed",
  "score": 0.95,
  "passed": true,
  "violations": [],
  "warnings": [],
  "principles_checked": ["truth", "wisdom", "alignment", "..."],
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Validate Alignment

**POST** `/policy/validate-alignment`

Validate alignment with constitutional principles (used by reflection engine).

**Request Body:**
```json
{
  "input_context": "User input",
  "output_response": "AI response",
  "self_assessment": "Optional reflection",
  "user_id": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "aligned": true,
  "alignment_score": 0.87,
  "principle_scores": {
    "truth": 0.9,
    "wisdom": 0.85,
    "alignment": 0.88,
    "transparency": 0.92,
    "accountability": 0.84,
    "fairness": 0.86,
    "respect": 0.91,
    "beneficence": 0.83
  },
  "recommendations": [],
  "concerns": [],
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Get Constitutional Principles

**GET** `/policy/principles`

Get list of constitutional principles used for validation.

**Response:** `200 OK`
```json
{
  "principles": [
    "truth",
    "wisdom",
    "alignment",
    "transparency",
    "accountability",
    "fairness",
    "respect",
    "beneficence"
  ],
  "count": 8,
  "version": 1
}
```

---

## Billing Endpoints

### Create Checkout Session

**POST** `/billing/create-checkout`

Create Stripe checkout session for subscription.

**Headers:** `Authorization: Bearer token`

**Request Body:**
```json
{
  "tier": "basic"
}
```

**Response:** `200 OK`
```json
{
  "sessionId": "stripe_session_id",
  "url": "https://checkout.stripe.com/..."
}
```

### Get Billing Portal

**GET** `/billing/portal`

Get Stripe customer portal URL.

**Headers:** `Authorization: Bearer token`

**Response:** `200 OK`
```json
{
  "url": "https://billing.stripe.com/..."
}
```

### Get Usage Stats

**GET** `/billing/usage`

Get current billing period usage.

**Headers:** `Authorization: Bearer token`

**Response:** `200 OK`
```json
{
  "period_start": "2024-01-01T00:00:00Z",
  "period_end": "2024-02-01T00:00:00Z",
  "tokens_used": 12345,
  "tokens_limit": 50000,
  "memory_used_gb": 2.3,
  "memory_limit_gb": 10
}
```

---

## Health Check Endpoints

### Gateway Health

**GET** `/health`

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Service-Specific Health

Individual services also expose health endpoints:

- Intelligence: `http://localhost:8000/health`
- Memory: `http://localhost:8001/health`
- Policy: `http://localhost:4000/health`

---

## Error Responses

All endpoints follow consistent error format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

### Common Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## Websocket

### Chat WebSocket

**URL:** `ws://localhost:5000/ws/chat`

Send and receive messages in real-time.

**Client → Server:**
```json
{
  "type": "message",
  "content": "Hello",
  "session_id": "uuid",
  "use_memory": true
}
```

**Server → Client:**
```json
{
  "type": "chunk",
  "content": "Hello! ",
  "done": false
}
```

**Completion:**
```json
{
  "type": "complete",
  "session_id": "uuid",
  "tokens_used": 45,
  "latency_ms": 1234
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Login
const { data } = await api.post('/auth/login', {
  email: 'user@example.com',
  password: 'password'
});

// Set token
api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;

// Send message
const response = await api.post('/chat/message', {
  message: 'Hello!',
  use_memory: true
});

console.log(response.data.response);
```

### Python

```python
import requests

BASE_URL = "http://localhost:5000/api"

# Login
response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "user@example.com",
    "password": "password"
})
token = response.json()["access_token"]

# Send message
headers = {"Authorization": f"Bearer {token}"}
response = requests.post(
    f"{BASE_URL}/chat/message",
    headers=headers,
    json={"message": "Hello!", "use_memory": True}
)

print(response.json()["response"])
```

### cURL

```bash
# Login
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.access_token')

# Send message
curl -X POST http://localhost:5000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"Hello!","use_memory":true}'
```

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `limit` - Items per page (default: 50, max: 100)
- `offset` - Number of items to skip (default: 0)

**Example:**
```
GET /memory/list?limit=20&offset=40
```

---

## Versioning

Current API version: `v1` (implicit)

Future versions will be prefixed: `/api/v2/...`

---

For more details, see the [GitHub repository](https://github.com/SeenWD2025/NovaCoreAI).
