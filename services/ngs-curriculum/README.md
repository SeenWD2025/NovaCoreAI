# Noble Growth School (NGS) Curriculum Service

**Technology:** Go + Fiber  
**Port:** 9000  
**Database:** PostgreSQL (user_progress, xp_events, achievements, curriculum_levels)

## Status
✅ **Phase 9 Complete** - Production Ready

## Features

### 24-Level Gamified Curriculum
- Progressive XP thresholds from Level 1 (0 XP) to Level 24 (32,600+ XP)
- Agent creation unlocks at Level 12 (5,000 XP)
- Dynamic level-up system with automatic progression tracking

- Auto-seeded curriculum levels + baseline lessons (idempotent on startup)

### XP Event System
- **Lesson Completion**: 50 XP
- **Perfect Quiz**: 100 XP
- **Good Quiz (80%+)**: 75 XP
- **Pass Quiz (60%+)**: 50 XP
- **High-Quality Reflection**: 25 XP
- **Medium Reflection**: 15 XP
- **Helping Others**: 10 XP
- **Creative Solution**: 75 XP
- **Challenge Solved**: 100 XP
- Tracks auto-generated CS, Data Science, Ethical AI, and ML/AI Engineering lessons per level (Beginner→Expert)

- **Daily Streak**: 20 XP

### Achievement System
- Level-up achievements
- Agent creation unlock achievement
- Automatic achievement tracking
- Achievement history with timestamps

### Leaderboard
- Global XP-based rankings
- Top users by total experience
- Real-time rank calculation

## API Endpoints

### Progress Management
- `GET /ngs/progress` - Get user progress with level info
- `POST /ngs/award-xp` - Award XP for an event
- `POST /ngs/complete-lesson` - Complete lesson and award XP

### Achievements
- `GET /ngs/achievements` - Get user achievements

### Leaderboard
- `GET /ngs/leaderboard?limit=10` - Get top users

### Curriculum Levels
- `GET /ngs/levels` - Get all 24 curriculum levels
- `GET /ngs/levels/:level` - Get specific level details

### Lessons (NEW)
- `GET /ngs/levels/:level/lessons` - Get all lessons for a level
- `GET /ngs/lessons/:id` - Get specific lesson content
- `POST /ngs/lessons/:id/complete` - Complete a lesson with reflection

### Reflections (NEW)
- `GET /ngs/reflections?limit=20` - Get user reflection history
- `POST /ngs/reflections` - Submit a practice reflection

### Health
- `GET /health` - Health check
- `GET /` - Service information

## Request/Response Examples

### Get Progress
```bash
curl -H "X-User-Id: <uuid>" http://localhost:9000/ngs/progress
```

Response:
```json
{
  "id": "...",
  "user_id": "...",
  "current_level": 3,
  "total_xp": 275,
  "agent_creation_unlocked": false,
  "current_level_info": {
    "level_number": 3,
    "title": "Ethical Principles",
    "xp_required": 250
  },
  "next_level_info": {
    "level_number": 4,
    "title": "Communication Skills",
    "xp_required": 450
  },
  "xp_to_next_level": 175,
  "progress_percent": 12.5
}
```

### Award XP
```bash
curl -X POST http://localhost:9000/ngs/award-xp \
  -H "Content-Type: application/json" \
  -H "X-User-Id: <uuid>" \
  -d '{
    "source": "lesson_completion",
    "metadata": {
      "lesson_id": "intro-to-ai"
    }
  }'
```

### Complete Lesson (Legacy endpoint - still supported)
```bash
curl -X POST http://localhost:9000/ngs/complete-lesson \
  -H "Content-Type: application/json" \
  -H "X-User-Id: <uuid>" \
  -d '{
    "lesson_id": "<lesson-uuid>",
    "score": 95,
    "metadata": {
      "time_spent": 1200
    }
  }'
```

### Get Lessons for a Level
```bash
curl -H "X-User-Id: <uuid>" http://localhost:9000/ngs/levels/1/lessons
```

Response:
```json
{
  "level": 1,
  "lessons": [
    {
      "id": "...",
      "level_id": 1,
      "title": "Awakening to Signal and Self",
      "core_lesson": "Awareness of signal & self; understanding Noble Core Principles",
      "human_practice": "Observe your thoughts for one full day without reacting...",
      "reflection_prompt": "What signals are truly yours, and which are echoes?",
      "agent_unlock": "Enable basic memory recall + reflection logging",
      "xp_reward": 50,
      "estimated_minutes": 45,
      "completed": false
    }
  ],
  "count": 1
}
```

### Get Specific Lesson
```bash
curl -H "X-User-Id: <uuid>" http://localhost:9000/ngs/lessons/<lesson-id>
```

### Complete a Lesson with Reflection
```bash
curl -X POST http://localhost:9000/ngs/lessons/<lesson-id>/complete \
  -H "Content-Type: application/json" \
  -H "X-User-Id: <uuid>" \
  -d '{
    "score": 85,
    "time_spent_seconds": 2700,
    "reflection_text": "I realized that many of my thoughts are reactions rather than genuine signals...",
    "metadata": {
      "questions_answered": 5
    }
  }'
```

### Submit a Reflection
```bash
curl -X POST http://localhost:9000/ngs/reflections \
  -H "Content-Type: application/json" \
  -H "X-User-Id: <uuid>" \
  -d '{
    "lesson_id": "<lesson-uuid>",
    "reflection_prompt": "What signals are truly yours?",
    "reflection_text": "After observing my thoughts today, I noticed...",
    "is_public": false
  }'
```

### Get User Reflections
```bash
curl -H "X-User-Id: <uuid>" http://localhost:9000/ngs/reflections?limit=10
```

## Setup Instructions

### Prerequisites
- Go 1.21+
- PostgreSQL 15+ with required tables
- Environment variables configured

### Environment Variables
```env
PORT=9000
DATABASE_URL=postgresql://user:password@localhost:5432/noble_novacore
AGENT_UNLOCK_LEVEL=12  # Optional, defaults to 12
```

### Local Development
```bash
# Install dependencies
go mod download

# Run the service
go run main.go

# Build binary
go build -o ngs-curriculum main.go
```

### Docker
```bash
# Build
docker build -t ngs-curriculum .

# Run
docker run -p 9000:9000 \
  -e DATABASE_URL="postgresql://..." \
  ngs-curriculum
```

## Database Schema

The service uses the following tables:

### user_progress
- Tracks current level, total XP, and agent unlock status
- One row per user

### xp_events
- Records all XP-earning events
- Includes source, amount, and metadata

### achievements
- Stores unlocked achievements
- Includes achievement type and data

### curriculum_levels
- Defines the 24 curriculum levels
- Includes title, description, and XP requirements

## Architecture

### Project Structure
```
ngs-curriculum/
├── internal/
│   ├── config/           # Configuration loading
│   ├── database/         # Database connection
│   ├── models/           # Data models and DTOs
│   ├── services/         # Business logic
│   └── handlers/         # HTTP handlers
├── main.go              # Application entry point
├── go.mod               # Go dependencies
├── Dockerfile           # Container build
└── README.md           # This file
```

### Service Layer
- `ProgressService`: Core business logic for XP, levels, and achievements
- Transaction-based XP awarding for consistency
- Automatic level-up detection and achievement recording

### Handler Layer
- RESTful API endpoints
- User ID extraction from headers
- Input validation and error handling

## Integration with Other Services

### API Gateway
The Gateway proxies requests to this service at:
- `POST /api/ngs/*` → `http://ngs-curriculum:9000/ngs/*`

### Intelligence Core
Can award XP for:
- High-quality responses (reflection_high)
- Creative solutions (creative_solution)

### Memory Service
Can award XP for:
- Memory creation events
- Knowledge distillation

## Testing

```bash
# Check health
curl http://localhost:9000/health

# Get service info
curl http://localhost:9000/

# Test with sample user
export TEST_USER_ID="550e8400-e29b-41d4-a716-446655440000"

# Get progress (auto-creates if not exists)
curl -H "X-User-Id: $TEST_USER_ID" http://localhost:9000/ngs/progress

# Award XP
curl -X POST http://localhost:9000/ngs/award-xp \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $TEST_USER_ID" \
  -d '{"source": "lesson_completion"}'

# Check leaderboard
curl http://localhost:9000/ngs/leaderboard
```

## Monitoring

The service logs:
- User progress creation
- Level-up events
- Achievement unlocks
- Error conditions

Monitor logs for:
- `Created initial progress for user`
- Database connection status
- HTTP request logs with status codes

## Future Enhancements

### Phase 10+ Features
- Lesson content management
- Quiz system with question bank
- Interactive playground/sandbox
- VSCode/Replit-style IDE integration
- Code challenge validation
- Peer review system
- Mentor matching
- Course completion certificates

## Production Considerations

- **Database Indexes**: Ensure indexes on `user_id` fields exist
- **Connection Pooling**: Configured with 25 max open, 5 max idle connections
- **Graceful Shutdown**: Handles SIGTERM for clean shutdown
- **CORS**: Configured for cross-origin requests
- **Error Recovery**: Panic recovery middleware enabled
- **Logging**: Request/response logging for observability

## License
MIT
