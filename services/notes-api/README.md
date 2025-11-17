# Nova Notes API

FastAPI microservice responsible for storing, retrieving, and managing structured learner notes. The service persists notes in PostgreSQL and exposes endpoints that orchestrate downstream quiz generation workflows.

## Features

- CRUD operations for structured notes with retention metadata and soft-delete semantics
- PostgreSQL-backed persistence via SQLAlchemy session management
- Structured logging via `structlog` and Prometheus metrics endpoint
- Correlation ID middleware for distributed tracing alignment
- Context string builder endpoint that assembles Markdown for LLM grounding workflows

## Getting Started

1. Create and activate a Python virtual environment.
2. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

3. Configure environment variables (see `app/config.py` for options). Override `NOTES_DATABASE_URL` if you are not using the default `postgres` service defined in Docker Compose.

4. Launch the service:

   ```powershell
   uvicorn main:app --host 0.0.0.0 --port 8085 --reload
   ```

5. Visit `http://localhost:8085/docs` for interactive API documentation.

### Key Endpoints

- `POST /notes/` create structured notes with component arrays.
- `GET /notes/{noteId}` fetch a single note (excludes soft-deleted records).
- `GET /notes/by-user/{userId}` list notes for a learner with optional `appId` scoping.
- `GET /notes/{noteId}/context` produce Markdown context derived from stored components.
- `DELETE /notes/{noteId}` performs an auditable soft delete by toggling `isDeleted` metadata.

## Health & Observability

- `GET /health` reports PostgreSQL connectivity and repository status.
- `GET /metrics` exposes Prometheus metrics when instrumentation is enabled.

## Testing

Run unit tests with:

```powershell
pytest
```

The test suite expects a PostgreSQL instance; provide a disposable database (e.g., via Docker) to keep tests isolated.
