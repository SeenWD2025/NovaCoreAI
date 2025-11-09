# Reflection Worker

**Technology:** Python + Celery  
**Queue:** Redis  
**Dependencies:** Memory Service, Noble-Spirit Policy Service

## Status
✅ **Phase 7 Complete**

## Overview

The Reflection Worker processes AI interactions asynchronously to generate self-assessments and validate alignment with constitutional principles.

## Features

- ✅ Asynchronous reflection processing using Celery
- ✅ Integration with Noble-Spirit Policy for alignment validation
- ✅ Self-assessment generation (3 key questions)
- ✅ Alignment score calculation
- ✅ Reflection storage in Memory Service
- ✅ Batch processing support
- ✅ Automatic retry with exponential backoff

## Reflection Process

### 1. Task Trigger

Intelligence Core enqueues a reflection task after each AI response:

```python
from app.tasks import reflect_on_interaction

reflect_on_interaction.delay(
    user_id="550e8400-e29b-41d4-a716-446655440000",
    session_id="660e8400-e29b-41d4-a716-446655440001",
    input_text="How do I implement authentication?",
    output_text="Use JWT tokens with bcrypt..."
)
```

### 2. Alignment Validation

Worker calls Noble-Spirit Policy Service to validate alignment:
- Checks input and output against constitutional principles
- Calculates principle-specific scores
- Identifies concerns and recommendations

### 3. Self-Assessment Generation

Worker generates answers to 3 reflection questions:

1. **What did I attempt?** - Summarizes the interaction
2. **Was I aligned?** - Reports alignment score and principle scores
3. **How could I improve?** - Lists recommendations and concerns

### 4. Storage

Worker stores the reflection as a special memory type in the Memory Service:
- Type: "reflection"
- Tier: LTM (permanent)
- Tags: reflection, self-assessment, alignment
- Confidence score: alignment score

## Tasks

### `reflect_on_interaction`

Main reflection task that processes a single interaction.

**Parameters:**
- `user_id`: User ID
- `session_id`: Session ID
- `input_text`: User's input
- `output_text`: AI's response
- `context`: Optional additional context

**Returns:**
- Success status
- Alignment score
- Reflection ID

### `batch_reflect`

Batch processing task for multiple interactions.

**Parameters:**
- `sessions`: List of session data

**Returns:**
- Batch results with task IDs

### `health_check`

Health check task to verify worker is operational.

## Setup Instructions

### Prerequisites

- Python 3.11+
- Redis 7+ (for Celery broker)
- Memory Service running
- Noble-Spirit Policy Service running

### Local Development

1. Install dependencies:
```bash
cd services/reflection-worker
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export REDIS_URL="redis://localhost:6379"
export MEMORY_SERVICE_URL="http://localhost:8001"
export POLICY_SERVICE_URL="http://localhost:4000"
```

3. Run the worker:
```bash
python worker.py
```

### Docker

```bash
docker compose up reflection-worker
```

## Configuration

Environment variables (see `.env.example`):

- `REDIS_URL` - Redis connection string
- `CELERY_BROKER_URL` - Celery broker URL (default: redis DB 2)
- `CELERY_RESULT_BACKEND` - Celery result backend (default: redis DB 3)
- `MEMORY_SERVICE_URL` - Memory service endpoint
- `POLICY_SERVICE_URL` - Policy service endpoint
- `INTELLIGENCE_SERVICE_URL` - Intelligence service endpoint

## Integration

### Intelligence Core Integration

Add to Intelligence Core after generating responses:

```python
from celery import Celery

celery = Celery(broker="redis://localhost:6379/2")

# After generating response
celery.send_task(
    "reflect_on_interaction",
    args=[user_id, session_id, input_text, output_text]
)
```

### Monitoring Tasks

Check task status:

```python
from app.tasks import reflect_on_interaction

result = reflect_on_interaction.delay(...)
print(f"Task ID: {result.id}")
print(f"Status: {result.state}")
print(f"Result: {result.get(timeout=10)}")
```

## Testing

Test the health check task:

```bash
# Start Python shell
python

# Import and run health check
from app.tasks import health_check
result = health_check.delay()
print(result.get())
```

## Dependencies

- **celery**: Task queue framework
- **redis**: Broker and result backend
- **httpx**: HTTP client for service calls
- **pydantic**: Configuration management
- **psycopg2-binary**: PostgreSQL driver

## Next Steps (Phase 8)

- Memory Distillation using reflection data
- Nightly batch processing of reflections
- Knowledge compression and promotion