# Memory Distillation Worker

**Technology:** Python + Schedule  
**Schedule:** Daily at 2 AM UTC  
**Dependencies:** Memory Service (PostgreSQL)

## Status
✅ **Phase 8 Complete**

## Overview

The Memory Distillation Worker processes reflections and memories in batches to:
- Distill knowledge from multiple reflections
- Promote frequently accessed memories from ITM to LTM
- Clean up expired memories
- Resolve contradictions

## Features

- ✅ Nightly batch processing of reflections
- ✅ Emotional weight aggregation
- ✅ Confidence score calculation
- ✅ ITM→LTM promotion based on access count
- ✅ Distilled knowledge creation
- ✅ Expired memory cleanup
- ✅ Topic-based grouping
- ✅ Automatic scheduling

## Distillation Process

### 1. Fetch Recent Reflections

Retrieves all reflections from the last 24 hours.

### 2. Group by Topic

Groups reflections by common tags/topics for analysis.

### 3. Calculate Aggregate Scores

For each topic group:
- **Average emotional weight**: Mean of all emotional_weight values
- **Average confidence**: Mean of all confidence_score values
- **Success rate**: Ratio of successful outcomes

### 4. Apply Promotion Criteria

Distilled knowledge is created when:
- **Significant emotion**: |avg_emotional_weight| > 0.3
- **High confidence**: avg_confidence > 0.7
- **Good success rate**: success_rate >= 0.5
- **Sufficient data**: At least 2 reflections

### 5. Create Distilled Knowledge

Generates a principle summarizing key insights:
- Extracts improvements from self-assessments
- Links to source reflection IDs
- Stores in `distilled_knowledge` table
- Preserves confidence score

### 6. Promote ITM to LTM

Promotes memories from Intermediate-Term to Long-Term when:
- Access count >= threshold (default: 3)
- Constitution valid = true
- Not expired

### 7. Clean Up

Marks expired STM and ITM memories as expired.

## Database Tables

### `distilled_knowledge`

```sql
CREATE TABLE distilled_knowledge (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  source_reflections UUID[],
  topic VARCHAR(255),
  principle TEXT NOT NULL,
  embedding VECTOR(384),
  confidence FLOAT,
  created_at TIMESTAMP
);
```

Stores compressed wisdom extracted from multiple reflections.

## Configuration

Environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `MEMORY_SERVICE_URL` - Memory service endpoint (for future features)
- `POLICY_SERVICE_URL` - Policy service endpoint (for future features)
- `LTM_PROMOTION_THRESHOLD` - Access count threshold for promotion (default: 3)

## Schedule

The worker runs on a daily schedule:
- **Default**: 2:00 AM UTC
- Configurable via `SCHEDULE_HOUR` environment variable

The worker also runs an initial distillation on startup.

## Setup Instructions

### Prerequisites

- Python 3.11+
- PostgreSQL 15+ with schema initialized

### Local Development

1. Install dependencies:
```bash
cd services/distillation-worker
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export DATABASE_URL="postgresql://noble:changeme@localhost:5432/noble_novacore"
```

3. Run the worker:
```bash
python -m app.scheduler
```

### Docker

```bash
docker compose up distillation-worker
```

## Manual Trigger

To manually trigger distillation (for testing):

```python
from app.scheduler import run_distillation_job
run_distillation_job()
```

## Monitoring

Check logs for distillation results:

```bash
docker logs noble-distillation
```

Example output:
```
Starting scheduled distillation job at 2025-11-09 02:00:00
Fetched 45 recent reflections
Grouped reflections into 8 topics
Created distilled knowledge for topic 'authentication' from 6 reflections
Promoted 12 memories from ITM to LTM
Cleaned up 8 expired memories
Distillation job completed
Summary: {
  "reflections_processed": 45,
  "knowledge_distilled": 3,
  "memories_promoted": 12,
  "memories_expired": 8,
  "status": "success"
}
```

## Integration

### With Reflection Engine

Reflections stored by the Reflection Worker are processed by this worker:
1. Reflection Worker stores reflections as memories
2. Distillation Worker fetches and groups them
3. Creates distilled knowledge entries
4. Used for future learning and improvement

### With Memory Service

- Reads reflections from PostgreSQL
- Updates memory tiers (ITM → LTM)
- Marks expired memories
- Creates distilled knowledge entries

## Dependencies

- **schedule**: Job scheduling
- **sqlalchemy**: Database ORM
- **psycopg2-binary**: PostgreSQL driver
- **pydantic**: Configuration management
- **httpx**: HTTP client (for future service calls)

## Future Enhancements

- Contradiction resolution (compare conflicting knowledge)
- More sophisticated NLP for principle extraction
- Integration with LLM for better summarization
- Real-time distillation triggers
- Advanced topic modeling