# Nova Quiz Engine API Guide

_Last updated: 2025-11-16_

This guide documents the quiz session lifecycle, payloads, and response semantics for the Nova Quiz Engine (`services/quiz-engine`). Use it when integrating the QuizTaker frontend, Study Engine workflows, or external clients.

---

## Service Base URL

- Local development: `http://localhost:8091/api/quiz`
- Docker Compose service name: `quiz-engine`
- Production/Staging: see environment-specific `QUIZ_BASE_URL`

All endpoints operate over HTTPS in shared environments and expect JSON bodies. Authentication and authorization are enforced upstream (API Gateway or service mesh) via signed service tokens.

---

## Session Lifecycle & Status Transitions

1. **Create Session** (`POST /sessions`)
   - Persists a new quiz session using a stored quiz artifact snapshot.
   - Initializes state to `IN_PROGRESS`.
2. **Submit Answers** (`POST /sessions/{sessionId}/submit`)
   - Grades supported objective question types (multiple choice, true/false, short answer).
   - Marks written response questions as `pendingReview` and transitions the session to `AWAITING_REVIEW` if any remain.
   - Otherwise, totals scores and moves the session to `COMPLETED`.
3. **Retrieve Results** (`GET /sessions/{sessionId}/results`)
   - Returns the persisted `results` document (see schema below) after submission.

Status changes:

| Previous Status     | Trigger                                              | Next Status        |
|---------------------|------------------------------------------------------|--------------------|
| `IN_PROGRESS`       | Submission with no pending written responses         | `COMPLETED`        |
| `IN_PROGRESS`       | Submission containing written responses              | `AWAITING_REVIEW`  |
| `AWAITING_REVIEW`   | Manual review workflow (future) completes grading    | `COMPLETED`        |

Submitted answers can only be accepted while the session status is `IN_PROGRESS` or `AWAITING_REVIEW`. Attempting to regrade a `COMPLETED` or `CANCELLED` session raises `409 Conflict`.

---

## Endpoints

### POST `/sessions`

Creates a quiz session from an existing quiz artifact.

**Request body**
```json
{
  "quizId": "quiz-123",
  "userId": "user-42",
  "appId": "nova-app",
  "metadata": {
    "entryPoint": "study-plan"
  }
}
```

**Successful response** `201 Created`
```json
{
  "session": {
    "sessionId": "2f0d8c1f-2735-4d1f-b55a-90fc5d68e2c8",
    "quizId": "quiz-123",
    "appId": "nova-app",
    "userId": "user-42",
    "status": "in_progress",
    "createdAt": "2025-11-16T20:05:30.804Z",
    "updatedAt": "2025-11-16T20:05:30.804Z",
    "questions": [
      {
        "questionId": "q1",
        "prompt": "What is AI?",
        "type": "MULTIPLE_CHOICE",
        "options": [
          {"optionId": "A", "text": "Artificial Intelligence"},
          {"optionId": "B", "text": "Augmented Intuition"}
        ],
        "difficulty": "INTRODUCTORY",
        "points": 2.0,
        "tags": ["ai", "basics"],
        "sourceComponentId": "comp-1"
      }
    ],
    "reflection": {
      "prompt": "Reflect on AI",
      "guidance": "Think about real-world uses."
    },
    "metadata": {
      "artifact": {
        "topics": ["ai"]
      },
      "session": {
        "entryPoint": "study-plan"
      }
    }
  }
}
```

**Error codes**
- `403` Quiz artifact does not belong to requesting app/user.
- `404` Quiz artifact unavailable.
- `502` Persistence failure.

### POST `/sessions/{sessionId}/submit`

Grades a quiz submission.

**Request body**
```json
{
  "sessionId": "2f0d8c1f-2735-4d1f-b55a-90fc5d68e2c8",
  "quizId": "quiz-123",
  "userId": "user-42",
  "appId": "nova-app",
  "submittedAt": "2025-11-16T20:10:12.911Z",
  "answers": [
    {
      "type": "MULTIPLE_CHOICE",
      "questionId": "q1",
      "selectedOptionIds": ["A"]
    },
    {
      "type": "TRUE_FALSE",
      "questionId": "q2",
      "answer": true
    },
    {
      "type": "WRITTEN_RESPONSE",
      "questionId": "q3",
      "answer": "AI ethics require transparency."
    }
  ],
  "metadata": {
    "device": "web",
    "attempt": 1
  }
}
```

**Successful response** `200 OK`
```json
{
  "results": {
    "sessionId": "2f0d8c1f-2735-4d1f-b55a-90fc5d68e2c8",
    "quizId": "quiz-123",
    "userId": "user-42",
    "appId": "nova-app",
    "noteId": "note-7",
    "totalScore": 3.0,
    "maxScore": 4.0,
    "questionResults": [
      {
        "questionId": "q1",
        "score": 2.0,
        "maxScore": 2.0,
        "correct": true,
        "pendingReview": false,
        "feedback": "Nice work!",
        "submittedAnswer": ["A"],
        "sourceComponentId": "comp-1",
        "metadata": {
          "expectedAnswer": null,
          "questionType": "MULTIPLE_CHOICE"
        }
      },
      {
        "questionId": "q3",
        "score": 0.0,
        "maxScore": 1.0,
        "correct": false,
        "pendingReview": true,
        "feedback": "Written response queued for evaluation.",
        "submittedAnswer": "AI ethics require transparency.",
        "sourceComponentId": null,
        "metadata": {
          "expectedAnswer": null,
          "questionType": "WRITTEN_RESPONSE"
        }
      }
    ],
    "recommendations": [
      {
        "recommendationId": "6d2ebc2c-19d4-40b6-a86d-ad39f1840ab6",
        "sessionId": "2f0d8c1f-2735-4d1f-b55a-90fc5d68e2c8",
        "quizId": "quiz-123",
        "userId": "user-42",
        "appId": "nova-app",
        "noteId": "note-7",
        "questionId": "q2",
        "sourceComponentId": "comp-2",
        "text": "Review component comp-2 to reinforce this concept.",
        "createdAt": "2025-11-16T20:10:12.911Z",
        "isDeleted": false,
        "deletedAt": null
      }
    ],
    "noteImprovementSuggestions": [],
    "completedAt": "2025-11-16T20:10:13.501Z",
    "submittedAt": "2025-11-16T20:10:12.911Z",
    "requiresReview": true,
    "pendingWrittenCount": 1,
    "metadata": {
      "objective": {
        "correct": 1,
        "total": 2
      },
      "submission": {
        "device": "web",
        "attempt": 1
      }
    }
  }
}
```

**Error codes**
- `400` Invalid payload (unknown question, missing answer fields, mismatched IDs).
- `403` Submission from wrong app/user.
- `404` Session not found.
- `409` Session already completed.
- `502` Persistence failure while storing answers/results.

### GET `/sessions/{sessionId}/results`

Fetches the latest results snapshot.

Query parameters:
- `appId` (required)
- `userId` (required)

**Successful response**
```json
{
  "results": {
    "sessionId": "2f0d8c1f-2735-4d1f-b55a-90fc5d68e2c8",
    "quizId": "quiz-123",
    "userId": "user-42",
    "appId": "nova-app",
    "totalScore": 3.0,
    "maxScore": 4.0,
    "questionResults": [...],
    "recommendations": [...],
    "noteImprovementSuggestions": [...],
    "completedAt": "2025-11-16T20:10:13.501Z",
    "submittedAt": "2025-11-16T20:10:12.911Z",
    "requiresReview": false,
    "pendingWrittenCount": 0,
    "metadata": {
      "objective": {
        "correct": 2,
        "total": 2
      },
      "submission": {
        "attempt": 1
      }
    }
  }
}
```

**Error codes**
- `400` Results not yet available (`QuizSubmissionValidationError`).
- `403` Access denied.
- `404` Session not found.

### POST `/sessions/{sessionId}/feedback`

Captures a learner's reflection on the quiz experience. Clients may call this endpoint multiple times; the payload is upserted so the most recent ratings win while metadata is merged.

**Request body**
```json
{
  "quizId": "quiz-123",
  "userId": "user-42",
  "appId": "nova-app",
  "quizRating": 4,
  "recommendationRating": 5,
  "notes": "Actionable study tips.",
  "metadata": {
    "uiVersion": "1.12.0"
  }
}
```

**Successful response** `200 OK`
```json
{
  "feedback": {
    "feedbackId": "f1a35a57-82b4-4f0a-9969-19a62b7f43d7",
    "sessionId": "2f0d8c1f-2735-4d1f-b55a-90fc5d68e2c8",
    "quizId": "quiz-123",
    "userId": "user-42",
    "appId": "nova-app",
    "noteId": "note-7",
    "quizRating": 4,
    "recommendationRating": 5,
    "notes": "Actionable study tips.",
    "metadata": {
      "uiVersion": "1.12.0"
    },
    "submittedAt": "2025-11-16T21:18:44.214Z",
    "createdAt": "2025-11-16T21:18:44.214Z",
    "updatedAt": "2025-11-16T21:19:02.908Z",
    "isDeleted": false,
    "deletedAt": null
  }
}
```

**Error codes**
- `400` Validation failure (mismatched IDs, feedback before results available).
- `403` Feedback submitted by non-owner.
- `404` Session not found.
- `502` Persistence failure while storing feedback.

---

## Analytics Endpoints

Daily reflections metrics can be recomputed on demand and retrieved for analytics consumers (Study Engine prompt refinement, ops dashboards, etc.).

### POST `/analytics/reflection/daily/recompute`

Rebuilds daily aggregates for the provided date range and optional filters. Returns the stored metrics after recomputation.

**Request body**
```json
{
  "startDate": "2025-11-15",
  "endDate": "2025-11-16",
  "appId": "nova-app",
  "quizId": "quiz-123"
}
```

**Successful response** `202 Accepted`
```json
{
  "metrics": [
    {
      "aggregationDate": "2025-11-15",
      "appId": "nova-app",
      "quizId": "quiz-123",
      "totalFeedback": 4,
      "quizRatingSum": 16,
      "recommendationRatingSum": 14,
      "averageQuizRating": 4.0,
      "averageRecommendationRating": 3.5,
      "quizRatingCount": 4,
      "recommendationRatingCount": 4,
      "createdAt": "2025-11-16T21:28:01.244Z",
      "updatedAt": "2025-11-16T21:28:01.244Z"
    }
  ]
}
```

### GET `/analytics/reflection/daily`

Returns the stored metrics without recomputing. Supports the same query parameters as the recompute payload (`startDate`, `endDate`, `appId`, `quizId`).

**Example** `GET /analytics/reflection/daily?startDate=2025-11-15&appId=nova-app`

**Successful response** `200 OK`
```json
{
  "metrics": [
    {
      "aggregationDate": "2025-11-15",
      "appId": "nova-app",
      "quizId": "quiz-123",
      "totalFeedback": 4,
      "quizRatingSum": 16,
      "recommendationRatingSum": 14,
      "averageQuizRating": 4.0,
      "averageRecommendationRating": 3.5,
      "quizRatingCount": 4,
      "recommendationRatingCount": 4,
      "createdAt": "2025-11-16T21:28:01.244Z",
      "updatedAt": "2025-11-16T21:28:01.244Z"
    }
  ]
}
```

---

## Automation & Alerts

- A nightly background job (`QUIZ_REFLECTION_SCHEDULER_*` settings) invokes the recompute workflow for the previous day and logs warnings when the 7-day weighted recommendation average drops below the configured threshold (`QUIZ_REFLECTION_ALERT_THRESHOLD`).
- Alerts surface through structured logs (`quiz_engine.alerts`) with context fields (`windowDays`, `weightedRecommendationAverage`, `lowestDay`, `lowestQuizId`). Tail these logs in observability tooling to trigger downstream notifications.
- Adjust the run cadence by setting `QUIZ_REFLECTION_SCHEDULER_HOUR`/`MINUTE`; disable entirely with `QUIZ_REFLECTION_SCHEDULER_ENABLED=false` when running in ephemeral test environments.

---

## Data Persistence

`QuizSessionRecord` stores the raw quiz snapshot, masked answers, and the `results` document. The `results` column is a JSONB payload mirroring `QuizSessionResults` (see `app/models/quiz_session.py`).

Key fields to audit downstream:

| Field                           | Description                                        |
|---------------------------------|----------------------------------------------------|
| `results.totalScore`            | Aggregate learner score across graded questions.   |
| `results.questionResults[]`     | Per-question breakdown with scores and feedback.   |
| `results.recommendations[]`     | Study actions generated for incorrect objective answers. |
| `results.noteImprovementSuggestions[]` | Suggestions tied to note components.         |
| `results.requiresReview`        | Flag indicating written responses pending review.  |
| `results.metadata.objective`    | Summary counts for objective grading accuracy.     |

Recommendation records currently remain embedded within the session JSON; future work will persist them in a dedicated table for longitudinal tracking.

---

## Testing Notes

- Unit tests: `tests/test_session_management.py`
- Router integration tests: `tests/test_sessions_router.py`
- Database-backed integration tests: `tests/test_sessions_db_integration.py`
- Run suite via Docker Compose: `docker compose run --rm quiz-engine pytest -q`

Use these tests as references for crafting submission payloads and validating expected status transitions.

---

## Operational Checks

To confirm graded payloads are persisting correctly, run the following Postgres query (swap the `WHERE` clause to target a specific session when needed):

```sql
SELECT
  session_id,
  status,
  results->>'totalScore'        AS total_score,
  results->>'requiresReview'    AS requires_review,
  jsonb_array_length(results->'recommendations')           AS recommendation_count,
  jsonb_array_length(results->'noteImprovementSuggestions') AS note_suggestion_count
FROM quiz_sessions
ORDER BY updated_at DESC
LIMIT 5;
```

This surfaces the most recent sessions, highlights whether written responses are pending review, and verifies that recommendation arrays are stored alongside the primary results document.

To audit learner feedback trends, analysts can pull the latest ratings with:

```sql
SELECT
  session_id,
  quiz_id,
  quiz_rating,
  recommendation_rating,
  metadata ->> 'uiVersion' AS ui_version,
  submitted_at,
  updated_at
FROM quiz_reflection_feedback
ORDER BY updated_at DESC
LIMIT 10;
```

This helps confirm the upsert behavior (single row per session) and surfaces contextual metadata your frontend sends along with each rating.

Aggregated metrics live in `ai_performance_metrics_daily`. To inspect the most recent rollups:

```sql
SELECT
  aggregation_date,
  app_id,
  quiz_id,
  total_feedback,
  average_quiz_rating,
  average_recommendation_rating
FROM ai_performance_metrics_daily
ORDER BY aggregation_date DESC, app_id, quiz_id
LIMIT 10;
```

---

## Planned Extensions

- External study recommendations table with soft-delete metadata.
- Written response grading workflow integrated with Study Engine.
- Webhook/event emission for analytics ingestion when results finalize.
- Daily reflection-feedback rollups feeding the Study Engine prompt refinement pipeline.
- Alerting hooks when rolling 7-day averages drop below target thresholds.

Track progress in `docs/dev/testing-and-structured-notes-plan.md` (Phase C deliverables).
