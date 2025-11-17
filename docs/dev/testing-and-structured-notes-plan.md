# Testing & Structured Notes Implementation Plan

## 1. Purpose & Scope
- Deliver Nova.Notes.API, Nova.Study.Engine, and Nova.Quiz.Engine capabilities outlined in the Structured Study Aid specification.
- Establish a comprehensive automated testing strategy that spans unit, contract, integration, and end-to-end coverage for notes, quiz generation, and grading flows.
- Align frontend (NoteBuilder, QuizTaker) and backend services with PostgreSQL-backed storage, grounded LLM interactions, and session management requirements.

## 2. Current State Assessment
- Codebase already uses FastAPI (Python) for the Intelligence service and Express/NestJS for Node services; testing harnesses include Pytest and Jest/Vitest.
- Test infrastructure exists via `docker-compose.test.yml`, Prometheus/Grafana telemetry, and GitHub Actions CI but lacks scenarios for the structured notes/quiz pipeline.
- Frontend scaffolding (React + Tailwind) does not yet implement the structured notes or quiz-taking UI described in the spec.
- No PostgreSQL schema for notes/quizzes or Gemini quiz-generation logic currently live in the repository.

## 3. Deliverables
1. **Nova.Notes.API** service
   - CRUD endpoints for structured note components persisted in PostgreSQL table `structured_notes` (namespaced by `app_id`, `user_id`, and `note_id`).
   - Context-string builder that converts component arrays into Markdown for downstream LLM grounding.
   - Pydantic (or TypeScript) schemas with validation for component types: `HEADER`, `SUBJECT`, `DEFINITION`, `EXAMPLE`, `EXPLANATION`.
2. **Nova.Study.Engine** enhancements
   - Gemini API client targeting `gemini-2.5-flash-preview-09-2025` with strict system prompt and JSON schema enforcement.
   - Quiz generation workflow capped at 50 questions using provided schema, including `sourceComponentId` tracking.
3. **Nova.Quiz.Engine** service
   - Implemented with Python/FastAPI to mirror existing AI-facing services (`intelligence`, `memory`) for shared structlog instrumentation, asyncio performance, and reuse of Prometheus/Correlation-ID middleware.
   - Session lifecycle (create quiz session, accept answers, grade objective questions, orchestrate written-response evaluation via Study Engine).
   - Feedback generator that produces study recommendations and note-improvement suggestions per component, persisted for longitudinal review until the user deletes them.
4. **Frontend integrations**
   - NoteBuilder UI with component management, PostgreSQL persistence, and export-to-PDF flow.
   - QuizTaker UI supporting MCQ, T/F, input, and written response types plus results view.
5. **Testing suite expansion**
   - Automated tests across services and frontend covering data flow, API contracts, quiz lifecycle, and Gemini-grounded responses (via mock harness).
   - Load and resilience tests validating concurrency and failure handling.
6. **Documentation & runbooks**
   - Updated developer and ops docs for environment setup, secrets, and troubleshooting.
7. **Data retention compliance**
   - Every persistent artifact (notes, quizzes, sessions, recommendations) stamped with `userId`, `createdAt`, `isDeleted`, and `deletedAt` to enforce the perpetual-retention-until-user-deletion policy with auditable soft-delete.
8. **Reflection feedback loop**
   - Capture AI performance ratings in PostgreSQL table `reflection_feedback` (scoped by `app_id`, `user_id`, `quiz_id`) with `quiz_rating`, `recommendation_rating`, optional `notes`, and metadata fields.
   - Aggregate anonymized ratings into PostgreSQL materialized view or table `ai_performance_metrics_daily` storing only totals/averages for platform-level analysis.
   - Route alerting to the Nova.Study.Engine team: rolling-average degradations raise P2 incidents, while aggregation job failures raise P1 incidents.
   - Require manual, date-range backfill scripts (idempotent) to be run only after human confirmation when recovery from P1 aggregation failures is needed.
   - Enforce RBAC: only L3+ Nova.Study.Engine engineers and the SRE lead, operating via least-privileged service accounts, may execute the manual backfill workflow.
   - Log every backfill or scheduled run to an immutable audit sink (timestamp start/end, executor_user_id, mode, date_range_processed, status) and include integrity checks before committing data.
   - Export audit logs immediately to Google BigQuery for long-term, immutable retention and compliance-grade analytics.
   - Monitor BigQuery ingestion with a 5-minute SLA and perform a daily reconciliation (owned by SRE/DevOps) to confirm the audit trail is complete; alert on ingestion gaps and notify Nova.Study.Engine leadership when discrepancies appear.
   - Auto-notify Customer Success and Product Management when P2 alerts fire so downstream teams can manage communications and roadmap impact.

## 4. Implementation Phases
### Phase A – Foundations (Week 1)
- Finalize PostgreSQL schema definitions, connection management, and secret distribution plan.
- Define shared schemas: create `shared/schemas/notes.ts` & `shared/schemas/quiz.ts` (TypeScript) plus mirrored Pydantic models for Python services.
- Scaffold Nova.Notes.API (FastAPI) with basic CRUD + health endpoints; integrate structlog, Prometheus metrics, and service auth middleware.
- Write Pytest unit tests for schema validation, context-string formatter, and PostgreSQL repository layer (leveraging transaction-scoped fixtures or an ephemeral test database).

### Phase B – Study Engine Integration (Weeks 2-3)
- Implement Gemini client wrapper with retry/backoff, schema validation, and error normalization.
- Build quiz generation pipeline: load note components, craft system prompt, invoke Gemini with JSON schema, persist quiz artifact to session store.
- Add provider-specific contract tests using HTTPX mocked responses; include golden JSON fixtures for valid quizzes and failure cases (missing context, schema violations).
- Extend observability: counters for quiz generation attempts, success/failure, latency; logs capturing `sourceComponentId` usage.

### Phase C – Quiz Engine & Feedback Loop (Weeks 3-4)
- Create Nova.Quiz.Engine (FastAPI) with endpoints: `POST /sessions`, `POST /sessions/{id}/submit`, `GET /sessions/{id}/results`; FastAPI keeps parity with the existing LLM microservices and their asyncio performance profile.
- Implement objective grading logic (MC, T/F, input) and asynchronous written grading via Study Engine (queue or direct call with timeout fallback).
- Persist study recommendations and note-improvement suggestions with `userId`, `createdAt`, `isDeleted`, `deletedAt` metadata so learners can revisit them later and UI can surface soft-deleted records correctly.
- Cover with Pytest/Jest service tests for grading, plus integration tests simulating full session flow against an ephemeral PostgreSQL database and mocked Gemini.
- Implement reflection feedback capture endpoint/workflow storing `quizRating`, `recommendationRating`, and optional `notes` per quiz session while guaranteeing cascade delete when users remove their accounts.
- Add background or scheduled aggregation that reads only metadata (userId, quizId, timestamp, rating) to drive anonymized BI dashboards, writing daily rollups to `ai_performance_metrics_daily` (PostgreSQL) and exporting summarized views for BI consumers.
- ✅ Nightly scheduler now runs this aggregation and emits structured alerts when rolling metrics degrade; configuration documented in `docs/dev/quiz-engine-api-guide.md`.
- Build a manual backfill entry point that accepts start/end date ranges, runs idempotently, and is gated behind Nova.Study.Engine approval following any P1 incident.
- Wire PagerDuty-triggered P2 incidents to broadcast Slack/email notifications to Customer Success and Product Management alongside Nova.Study.Engine.
- Require four-eyes approval (two authorized engineers) before executing manual backfill scripts after a P1 incident.
   - Escalate to the Nova.Study.Engine engineering manager and on-call SRE lead if a second approver is not available within 30 minutes of the request.

### Phase D – Frontend Delivery (Weeks 4-5)
- Extend React app with NoteBuilder: component CRUD, drag-and-drop ordering, validation, PostgreSQL-backed persistence via Notes API, and export-to-PDF modal (printable HTML template).
- Implement QuizTaker: question renderer per type, progress navigation, submission handler, results dashboard summarizing scores and AI feedback.
- Write Vitest + React Testing Library tests for critical UI interactions and state management; add Cypress component/e2e tests if available.

### Phase E – End-to-End Assurance & Hardening (Week 6)
- Compose integration tests chaining services: create notes → generate quiz → submit answers → receive feedback. Use repo’s test docker-compose plus PostgreSQL test container.
- Run load tests (`scripts/load_test.py`) adapted to hit quiz endpoints; verify p95 < 2s and <1% error rate while monitoring PostgreSQL throughput.
- Review security posture: service-to-service JWT, database roles/row-level policies, rate limiting, logging redaction.
- Execute retention compliance checks ensuring delete flows flip `isDeleted`, populate `deletedAt`, and cascade removal of study recommendations when users request erasure.
- Update docs (`docs/TESTING.md`, `docs/OBSERVABILITY_GUIDE.md`, new runbooks) and ensure GitHub Actions executes new test suites.
- Validate BI aggregation jobs respect privacy constraints (anonymized rollups, no raw recommendation text in analytics stores), ensure weekly review cadence executes, and verify prompt refinement triggers when low ratings accumulate.
- Exercise the aggregation failure playbook (detect isolate, diagnose fix, backfill metrics, restore cadence) during dry runs to ensure Nova.Study.Engine and SRE/DevOps can respond within incident SLAs.
- Verify manual backfill tooling supports date-range, idempotent replays and includes operator confirmation steps before execution.
- Confirm RBAC enforcement for backfill scripts (managed service accounts, access only for L3+ Nova.Study.Engine engineers and SRE lead) and capture immutable audit events with integrity check logs.
- Ensure validation failures during backfill immediately halt execution, emit P1 PagerDuty alerts, and require human confirmation before a rerun.
- Validate post-incident communications: ensure Nova.Study.Engine posts RCA/prompt adjustment summary within 24 hours of closing P2 alerts.
- Verify BigQuery ingestion SLA monitoring (5-minute alerting) and daily reconciliation job to detect missing audit entries.
- Test four-eyes approval workflow for manual backfills, ensuring dual confirmations are logged before execution.
- Confirm reconciliation reports are delivered automatically each morning to the shared #ai-observability Slack channel and archived in Confluence for compliance audits.

## 5. Testing Strategy
- **Unit Tests**: Pytest for FastAPI services, Vitest/Jest for frontend, covering schemas, business rules, and utilities.
- **Contract Tests**: JSON schema validation for quiz payloads, API snapshots with `schemathesis` or `pytest` schema assertions.
- **Integration Tests**: Multi-service flows using emulators/mocks; ensure deterministic Gemini responses via fixtures.
- **E2E Tests**: Cypress or Playwright suites from user perspective (note creation → quiz completion).
- **Performance Tests**: Locust/`load_test.py` scenarios with concurrent quiz sessions; monitor Prometheus metrics.
- **CI Enhancements**: Provision PostgreSQL test service in GitHub Actions, collect coverage reports (target ≥70% per service, 60% UI), enforce testing gates before merge.
- **Compliance Tests**: Automated assertions verifying required metadata fields (`userId`, `createdAt`, `isDeleted`, `deletedAt`) exist on stored artifacts and soft-delete flows are honored end-to-end.
- **Analytics Tests**: Ensure aggregation outputs strip identifying information, only index `userId`, `quizId`, timestamps, and rating scores, confirm rows in `ai_performance_metrics_daily` carry no PII, and assert DELETE USER flows purge recommendation history and reflection feedback.
- **Runbook Tests**: Simulate P1 aggregation failures to confirm manual backfill procedure requires human approval, respects date filters, and keeps metrics consistent after reprocessing.
- **RBAC & Audit Tests**: Verify only authorized identities can invoke backfill scripts, audit logs capture start/end, executor, mode, date ranges, and statuses, and integrity checks surface anomalies prior to commits.
- **Audit Export Tests**: Confirm logs land in Google BigQuery promptly and remain immutable for compliance and investigative queries.
- **Stakeholder Communication Tests**: Trigger synthetic P2 alerts to confirm Customer Success and Product Management receive notifications and that 24-hour RCA updates are posted.
- **Validation Failure Tests**: Force integrity-check failures to ensure runs stop, P1 alerts fire, logs capture the failure context, and reruns wait for human approval.
- **Ingestion SLA Tests**: Simulate delayed log exports to validate 5-minute alerting and daily reconciliation reporting.
- **Approval Workflow Tests**: Ensure manual backfill execution requires two distinct engineer approvals and records both identities in the audit log.
- **Reconciliation Report Tests**: Validate the daily automation publishes BigQuery completeness reports and raises alerts when discrepancies exceed the allowable window.

## 6. Tooling & Infrastructure
- PostgreSQL 15 container for local/dev testing; production access via managed cluster credentials stored in secret manager.
- Shared config via `.env` / `env.test`; update `docker-compose.yml` & `docker-compose.test.yml` to include notes/study/quiz services and PostgreSQL service.
- Use `pytest-httpx` / `responses` for Gemini mocks; augment with transaction-scoped PostgreSQL fixtures for repository integration tests; `pact` style tooling optional for cross-service contracts.
- Extend Prometheus scrape configs for new services; add Grafana dashboards (context builder latency, quiz generation throughput, grading queue depth).
- Retention utilities to batch-flag `isDeleted` and propagate `deletedAt` timestamps during account erasure using SQL queries keyed by `user_id`.
- Database indexing limited to metadata columns (`user_id`, `quiz_id`, `timestamp`, `score`/`rating`) with exclusion of recommendation text from indexes and analytics exports.
- Prompt refinement pipeline referencing aggregated reflection feedback to tune Gemini system instructions when low ratings are detected.
- ✅ Study Engine scheduler now consumes daily reflection analytics and appends adaptive guidance to prompts when thresholds are breached.
- Weekly aggregation cycle evaluating 7-day rolling averages with automated alerts whenever ratings drop below thresholds (e.g., 3.5 stars) to trigger prompt review.
- Incident routing: P2 alerts page Nova.Study.Engine when rolling averages drop below 3.5 stars; P1 alerts fire if nightly aggregation fails to publish daily metrics and must pause subsequent runs.
- Aggregation failure playbook codified: 1) Detect & isolate (SRE/DevOps) 2) Diagnose & fix (Nova.Study.Engine) 3) Backfill metrics (Nova.Study.Engine) 4) Restore cadence (SRE/DevOps).
- PagerDuty (existing platform) integrated with Alertmanager for P1/P2 notifications covering reflection metrics and aggregation job status.
- Stakeholder comms policy: P2 alerts automatically notify Customer Success and Product Management; Nova.Study.Engine to deliver RCA/prompt adjustment summary within 24 hours of resolution.
- Validation failure policy: any integrity-check failure halts processing, emits a PagerDuty P1, and blocks subsequent runs until manually cleared.
- BigQuery monitoring: 5-minute ingestion SLA with alerting plus daily reconciliation to ensure completeness.
- Four-eyes principle enforced for manual backfill approvals post-P1 incidents.
- Reconciliation reporting automated via Cloud Scheduler/Function owned by SRE/DevOps, with gap alerts escalated to Nova.Study.Engine leadership.
- Approval escalation policy: if dual sign-off is not secured within 30 minutes, the Nova.Study.Engine engineering manager or on-call SRE lead must designate an alternate approver.

## 7. Risks & Mitigation
| Risk | Impact | Mitigation |
| --- | --- | --- |
| PostgreSQL latency / connection saturation | Slow quiz generation | Tune connection pooling, add query observability, monitor database metrics |
| Gemini schema drift or quota | Broken quiz generation | Pin API version, add schema validator, fallback messaging, track usage |
| Race conditions in session grading | Incorrect results | Use transactional writes, idempotent grading endpoints, explicit status fields |
| Frontend/offline desync with API | Data loss | Implement optimistic updates with rollback, debounce saves, validation guards, surface sync indicators |
| Test flakiness due to external services | CI instability | Default to emulators/mocks, run live smoke tests separately |
| Privacy breaches through analytics | Regulatory risk | Enforce anonymized aggregation, avoid indexing recommendation text, regularly audit BI pipelines |

## 8. Definition of Done
- All three services deployed locally via Docker Compose with health checks passing and Prometheus metrics exposed.
- Automated test suites cover critical flows and run green in CI with coverage thresholds met.
- Frontend NoteBuilder and QuizTaker UIs functionally complete and integrated with backend APIs.
- Documentation updated across `/docs/dev/`, `/docs/TESTING.md`, and relevant runbooks; onboarding instructions provided.
- Security review completed: secrets stored securely, rate limiting in place, audit logs generated for note access and quiz grading events.
- Retention policy satisfied: persisted artifacts record `userId`, `createdAt`, `isDeleted`, `deletedAt`, and deletion requests remove or suppress learner data end-to-end.
- Account deletion workflow cascades to notes, quiz sessions, recommendations, and reflection feedback tables in PostgreSQL.
- Reflection feedback aggregation informs dynamic prompt refinement, with automated alerts based on weekly 7-day rolling averages and updated prompts when thresholds are breached.
- Aggregation failure runbook executed and versioned so that P1 incidents reliably follow detect→diagnose→backfill→restore workflow across Nova.Study.Engine and SRE/DevOps teams.
- Manual backfill tooling validated to be idempotent, date-range scoped, and invoked only after human confirmation.
- RBAC and immutable audit logging in place for every backfill execution, including validation checkpoints prior to data writes.
- Post-P2 RCA communication delivered within 24 hours to designated channels.
- BigQuery export verified for long-term audit trail persistence.
- Validation-failure escalation path tested: automatic halt, P1 alert, human verification before restart.
- BigQuery ingestion SLA and daily reconciliation checks validated.
- Dual-approval process confirmed for manual backfill restarts.
- Automated reconciliation reporting and escalation workflows validated through tabletop exercises.

## 9. Governance Summary
- Daily BigQuery reconciliation is automated and owned by SRE/DevOps, with reports delivered to #ai-observability and archived for compliance.
- Manual backfill reruns require dual approval; if a second approver is unavailable within 30 minutes, the Nova.Study.Engine engineering manager or on-call SRE lead must appoint an alternate approver and document the decision in the audit log.