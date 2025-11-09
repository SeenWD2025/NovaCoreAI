# Noble-Spirit Policy Service

**Technology:** Python + FastAPI (simplified from Elixir)  
**Port:** 4000  
**Database:** PostgreSQL (policies, policy_audit_log)

## Status
✅ **Phase 6 Complete**

## Overview

The Noble-Spirit Policy Service provides constitutional AI validation and ethical filtering for the Noble NovaCoreAI platform.

## Features

- ✅ Content validation against constitutional policies
- ✅ Alignment scoring with ethical principles
- ✅ Pattern-based harmful content detection
- ✅ Immutable policy management with cryptographic signatures
- ✅ Audit logging for all validation events
- ✅ RESTful API for policy operations

## Constitutional Principles

The service validates content against these core principles:
1. **Truth** - Honesty and accuracy
2. **Wisdom** - Thoughtful and beneficial responses
3. **Alignment** - Consistency with human values
4. **Transparency** - Clear and understandable
5. **Accountability** - Taking responsibility
6. **Fairness** - Unbiased and equitable
7. **Respect** - Dignified treatment of all
8. **Beneficence** - Promoting wellbeing

## API Endpoints

### Validation

- `POST /policy/validate` - Validate content against policies
- `POST /policy/validate-alignment` - Check alignment with principles

### Policy Management

- `POST /policy/create` - Create new policy (admin only)
- `GET /policy/active` - Get all active policies
- `GET /policy/principles` - Get constitutional principles

### System

- `GET /` - Service information
- `GET /health` - Health check

## Setup Instructions

### Prerequisites

- Python 3.11+
- PostgreSQL 15+

### Local Development

1. Install dependencies:
```bash
cd services/noble-spirit
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export DATABASE_URL="postgresql://noble:changeme@localhost:5432/noble_novacore"
export PORT=4000
```

3. Run the service:
```bash
python main.py
```

### Docker

```bash
docker compose up noble-spirit
```

## Usage Examples

### Validate Content

```bash
curl -X POST http://localhost:4000/policy/validate \
  -H "Content-Type: application/json" \
  -d '{
    "content": "How can I help users learn about AI safety?",
    "context": "educational",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Validate Alignment

```bash
curl -X POST http://localhost:4000/policy/validate-alignment \
  -H "Content-Type: application/json" \
  -d '{
    "input_context": "How do I improve my code?",
    "output_response": "I recommend using best practices...",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

## Integration

The Noble-Spirit Policy Service integrates with:

- **Phase 7 (Reflection Engine)**: Validates reflections for alignment
- **Phase 8 (Memory Distillation)**: Ensures distilled knowledge is constitutional
- **Memory Service**: Flags memories that violate policies

## Validation Logic

### Content Validation

1. Check against harmful content patterns (violence, illegal activities, etc.)
2. Check against unethical patterns (deception, discrimination, etc.)
3. Calculate validation score (0.0 - 1.0)
4. Return result: PASSED, WARNING, or FAILED

### Alignment Validation

1. Validate input context
2. Validate output response
3. Calculate principle-specific scores
4. Generate recommendations and concerns
5. Determine overall alignment (threshold: 0.7)

## Security

- Policies are immutable (cryptographic signatures)
- All validation events are audit logged
- Pattern matching prevents harmful content
- Constitutional principles enforce ethical behavior

## Dependencies

- **fastapi**: Web framework
- **uvicorn**: ASGI server
- **pydantic**: Data validation
- **sqlalchemy**: Database ORM
- **psycopg2-binary**: PostgreSQL driver

## Next Steps (Phase 7-8)

- Phase 7: Reflection Engine integration
- Phase 8: Memory Distillation with policy validation
