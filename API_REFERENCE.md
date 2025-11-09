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

## NGS Curriculum Endpoints

### Get User Progress

**GET** `/ngs/progress`

Get current user's curriculum progress with level information.

**Headers:** `Authorization: Bearer token`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "current_level": 3,
  "total_xp": 275,
  "agent_creation_unlocked": false,
  "current_level_info": {
    "level_number": 3,
    "title": "Reflector",
    "description": "Mirror mechanics — AI as reflection of Operator intent.",
    "xp_required": 250
  },
  "next_level_info": {
    "level_number": 4,
    "title": "Calibrator",
    "xp_required": 450
  },
  "xp_to_next_level": 175,
  "progress_percent": 12.5
}
```

### Get All Curriculum Levels

**GET** `/ngs/levels`

Get all 24 curriculum levels.

**Response:** `200 OK`
```json
{
  "levels": [
    {
      "id": 1,
      "level_number": 1,
      "title": "Awakeners",
      "description": "Awakening to signal and self...",
      "xp_required": 0
    }
  ],
  "count": 24
}
```

### Get Specific Level

**GET** `/ngs/levels/:level`

Get details for a specific curriculum level.

**Response:** `200 OK`

### Get Lessons for Level

**GET** `/ngs/levels/:level/lessons`

Get all lessons for a specific curriculum level, including completion status.

**Headers:** `Authorization: Bearer token`

**Response:** `200 OK`
```json
{
  "level": 1,
  "lessons": [
    {
      "id": "uuid",
      "level_id": 1,
      "title": "Awakening to Signal and Self",
      "description": "Understanding awareness, signal differentiation...",
      "lesson_order": 1,
      "lesson_type": "tutorial",
      "core_lesson": "Awareness of signal & self; understanding Noble Core Principles",
      "human_practice": "Observe your thoughts for one full day without reacting...",
      "reflection_prompt": "What signals are truly yours, and which are echoes?",
      "agent_unlock": "Enable basic memory recall + reflection logging",
      "xp_reward": 50,
      "estimated_minutes": 45,
      "is_required": true,
      "completed": false
    }
  ],
  "count": 1
}
```

### Get Lesson Details

**GET** `/ngs/lessons/:id`

Get detailed information about a specific lesson.

**Headers:** `Authorization: Bearer token`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "level_id": 1,
  "title": "Awakening to Signal and Self",
  "content_markdown": "# Lesson Content\n\n...",
  "core_lesson": "Awareness of signal & self...",
  "human_practice": "Observe your thoughts...",
  "reflection_prompt": "What signals are truly yours?",
  "agent_unlock": "Enable basic memory recall",
  "xp_reward": 50,
  "estimated_minutes": 45,
  "completed": false,
  "completed_at": null
}
```

### Complete Lesson

**POST** `/ngs/lessons/:id/complete`

Mark a lesson as completed and submit reflection.

**Headers:** `Authorization: Bearer token`

**Request Body:**
```json
{
  "score": 85,
  "time_spent_seconds": 2700,
  "reflection_text": "I realized that many of my thoughts...",
  "metadata": {
    "questions_answered": 5
  }
}
```

**Response:** `201 Created`
```json
{
  "completion": {
    "id": "uuid",
    "user_id": "uuid",
    "lesson_id": "uuid",
    "score": 85,
    "time_spent_seconds": 2700,
    "reflection_text": "I realized...",
    "completed_at": "2024-01-01T00:00:00Z"
  },
  "message": "Lesson completed successfully"
}
```

### Get User Reflections

**GET** `/ngs/reflections?limit=20`

Get user's reflection history.

**Headers:** `Authorization: Bearer token`

**Query Parameters:**
- `limit` (optional, default: 20, max: 100): Number of reflections to return

**Response:** `200 OK`
```json
{
  "reflections": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "lesson_id": "uuid",
      "level_number": 1,
      "reflection_prompt": "What signals are truly yours?",
      "reflection_text": "After observing my thoughts...",
      "quality_score": 0.85,
      "xp_awarded": 25,
      "is_public": false,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

### Submit Reflection

**POST** `/ngs/reflections`

Submit a practice reflection and earn XP based on quality.

**Headers:** `Authorization: Bearer token`

**Request Body:**
```json
{
  "lesson_id": "uuid",
  "level_number": 1,
  "reflection_prompt": "What signals are truly yours?",
  "reflection_text": "After observing my thoughts today, I noticed...",
  "is_public": false
}
```

**Response:** `201 Created`
```json
{
  "reflection": {
    "id": "uuid",
    "user_id": "uuid",
    "reflection_prompt": "What signals are truly yours?",
    "reflection_text": "After observing...",
    "quality_score": 0.85,
    "xp_awarded": 25,
    "is_public": false,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "message": "Reflection submitted successfully"
}
```

### Award XP

**POST** `/ngs/award-xp`

Award XP to user for various actions.

**Headers:** `Authorization: Bearer token`

**Request Body:**
```json
{
  "source": "creative_solution",
  "amount": 75,
  "metadata": {
    "task_id": "uuid"
  }
}
```

**Response:** `200 OK`
```json
{
  "progress": {
    "current_level": 3,
    "total_xp": 350,
    "xp_awarded": 75
  }
}
```

### Get Achievements

**GET** `/ngs/achievements`

Get all achievements unlocked by the user.

**Headers:** `Authorization: Bearer token`

**Response:** `200 OK`
```json
{
  "achievements": [
    {
      "id": "uuid",
      "achievement_type": "level_up",
      "achievement_data": {
        "from_level": 2,
        "to_level": 3
      },
      "unlocked_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

### Get Leaderboard

**GET** `/ngs/leaderboard?limit=10`

Get top users by total XP.

**Query Parameters:**
- `limit` (optional, default: 10): Number of top users to return

**Response:** `200 OK`
```json
{
  "leaderboard": [
    {
      "user_id": "uuid",
      "current_level": 12,
      "total_xp": 5234,
      "rank": 1
    }
  ],
  "count": 1
}
```

### Get Challenges by Level

**GET** `/ngs/levels/:level/challenges`

Get all active challenges for a specific level.

**Response:** `200 OK`
```json
{
  "level": 1,
  "challenges": [
    {
      "id": "uuid",
      "level_id": 1,
      "title": "Signal Detection Practice",
      "description": "Write code to filter signals from noise",
      "challenge_type": "coding",
      "difficulty": "medium",
      "starter_code": "function filterSignals(data) {\n  // Your code here\n}",
      "xp_reward": 100,
      "time_limit_minutes": 30,
      "is_active": true
    }
  ],
  "count": 1
}
```

### Get Challenge Details

**GET** `/ngs/challenges/:id`

Get detailed information about a specific challenge.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "level_id": 1,
  "title": "Signal Detection Practice",
  "description": "Write a function to filter signals from noise...",
  "challenge_type": "coding",
  "difficulty": "medium",
  "starter_code": "function filterSignals(data) {...}",
  "test_cases": [...],
  "solution_template": "...",
  "xp_reward": 100,
  "time_limit_minutes": 30
}
```

### Submit Challenge Solution

**POST** `/ngs/challenges/:id/submit`

Submit a solution for a coding challenge.

**Headers:** `Authorization: Bearer token`

**Request Body:**
```json
{
  "submission_code": "function filterSignals(data) { return data.filter(x => x.signal); }"
}
```

**Response:** `201 Created`
```json
{
  "submission": {
    "id": "uuid",
    "user_id": "uuid",
    "challenge_id": "uuid",
    "passed": true,
    "score": 100,
    "feedback": "Excellent work! Your solution passed all test cases.",
    "test_results": {
      "total_tests": 5,
      "passed_tests": 5,
      "failed_tests": 0
    },
    "submitted_at": "2024-01-01T00:00:00Z"
  },
  "message": "Challenge submission processed"
}
```

### Get User Challenge Submissions

**GET** `/ngs/challenges/submissions?limit=20`

Get user's challenge submission history.

**Headers:** `Authorization: Bearer token`

**Query Parameters:**
- `limit` (optional, default: 20, max: 100)

**Response:** `200 OK`
```json
{
  "submissions": [
    {
      "id": "uuid",
      "challenge_id": "uuid",
      "passed": true,
      "score": 95,
      "submitted_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
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
