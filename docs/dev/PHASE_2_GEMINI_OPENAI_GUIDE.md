# Phase 2 Feature Guide: Cloud LLM Fallback (Gemini & OpenAI)

## 1. Purpose & Scope
- Ensure the chat workflow remains available when on-device Ollama resources are constrained.
- Introduce managed LLM providers (Google Gemini, OpenAI) without regressing existing intelligence capabilities.
- Maintain the current service-oriented architecture, Docker-based deployment, and security posture.

Deliverables for Phase 2:
- Configurable Gemini and OpenAI client integrations inside the Intelligence Core service.
- Fallback orchestration that prioritizes local models when healthy, then gracefully routes to cloud providers.
- Updated gateway and frontend handling so responses remain transparent to end users.
- Documentation, observability hooks, and testing coverage for the multi-provider flow.

## 2. Current State Assessment
- `services/intelligence`: FastAPI app using `OllamaService` (`ollama_service.py`) for LLM inference.
- LLM selection is static (`settings.llm_model`, `settings.ollama_url`). `ensure_ready()` gates requests.
- Gateway (`services/gateway`) proxies chat API traffic to Intelligence, forwarding service auth headers.
- Frontend (`services/frontend`) expects the chat API to return consistent `ChatResponse` payloads.
- Observability: Prometheus metrics + structured logs; no tracing of provider decisions yet.

Pain Points:
- On-device Mistral can time out or stall, blocking responses.
- No abstraction for alternative providers; fallback currently emits placeholder message.
- Secrets management for third-party APIs not defined.

## 3. Design Principles
1. **Non-disruptive integration**: Existing local Ollama path remains the primary provider when available.
2. **Strategy pattern**: Introduce a provider interface so additional LLMs can plug in cleanly.
3. **Config driven**: Enable/disable providers and define priorities via environment variables / `.env`.
4. **Graceful degradation**: If all providers fail, preserve todays fallback messaging and logging.
5. **Telemetry-first**: Capture provider selection, latency, and error metrics for informed tuning.

## 4. Architectural Additions
### 4.1 Provider Abstraction Layer
- Create `app/services/providers/base.py` defining an async interface (`generate`, `stream`, `ensure_ready`).
- Refactor current `OllamaService` to implement this interface (`LocalOllamaProvider`).
- Add new providers:
  - `GeminiProvider` (REST via Google Generative Language API).
  - `OpenAIProvider` (REST via OpenAI Chat Completions).
- Providers manage their own health checks, quotas, and request payload shaping.

### 4.2 Orchestrator
- New `ProviderOrchestrator` responsible for:
  - Loading provider priority list from config (e.g. `LLM_PROVIDER_PRIORITY=ollama,gemini,openai`).
  - Maintaining health states / cooldowns.
  - Routing `generate_response` and `generate_streaming_response` calls.
- Lives in `app/services/llm_router.py` and replaces direct `ollama_service` usage in `chat.py`.

### 4.3 Configuration & Secrets
- Extend `app/config.py` with optional blocks:
  - `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_API_URL`.
  - `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` (allow Azure compatibility).
  - `LLM_PROVIDER_PRIORITY`, `LLM_PROVIDER_TIMEOUTS`, `LLM_FALLBACK_MODE`.
- Update `.env` / `env.example`, `docker-compose*.yml`, `infrastructure/terraform` placeholders.
- Store secrets via existing secret management approach (document expected vault or env injection).

### 4.4 Gateway Considerations
- Gateway should remain agnostic; ensure service-to-service contract unchanged.
- Optionally surface provider info in response headers for debugging (guarded by env flag).

### 4.5 Observability
- Metrics: expose counters/gauges for provider usage, failures, latency via Prometheus (`app/utils/metrics.py`).
- Logging: enrich structured logs with `provider`, `fallback_reason`, `api_latency_ms`.
- Alerts: document Prometheus alert ideas (e.g., sustained provider failures).

## 5. Implementation Plan
### Step 0: Prerequisites
- Confirm Google & OpenAI credentials and quota.
- Align with security team on secret storage (e.g., Docker secrets, Azure Key Vault, etc.).

### Step 1: Provider Framework
- Create base provider interface and refactor `OllamaService` accordingly.
- Implement `ProviderOrchestrator` with priority selection and health tracking.
- Replace direct `ollama_service` imports in `chat.py` with orchestrator.
- Introduce unit tests for provider selection logic (mock providers).

### Step 2: Gemini Integration
- Add HTTP client wrapper with retry/backoff (respect rate limits).
- Map NovaCore prompts to Gemini request schema (system prompt => `systemInstruction`).
- Handle streaming via SSE or fallback to non-streaming if unsupported locally.
- Cover error handling (quota exceeded, auth failure, 5xx) and update orchestrator.

### Step 3: OpenAI Integration
- Implement client using official REST API (Chat Completions).
- Support both streaming and non-streaming modes; align tokens with existing metrics.
- Respect organization/project IDs if provided.

### Step 4: Configuration + Docker Updates
- Update `.env`, `env.example`, and service Dockerfiles to include new env vars.
- Modify `docker-compose.yml` to pass secrets (placeholder values, encourage `.env` injection).
- Document production secret injection (e.g., AWS SSM, Azure KeyVault) in `docs/SECRETS_MANAGEMENT.md`.

### Step 5: Telemetry & Logging
- Extend metrics to track provider success/fail counts and latencies.
- Ensure logs include provider name and fallback path for each chat request.
- Validate Grafana dashboards capture the new metrics.

### Step 6: Testing Strategy
- Unit tests: provider orchestrator, timing logic, error escalation.
- Integration tests (under `tests/intelligence`):
  - Mock Gemini/OpenAI endpoints via `responses` or `pytest-httpx`.
  - Simulate Ollama down to verify fallback selection.
- Contract tests: ensure gateway and frontend still receive the same schema.
- Manual verification: scripts in `scripts/test_ngs_integration.sh` or new dedicated script.

### Step 7: Documentation & Rollout
- Update `docs/ARCHITECTURAL_IMPROVEMENTS.md` with provider orchestration overview.
- Add runbook entry in `docs/OBSERVABILITY_IMPLEMENTATION.md` for incident handling.
- Provide developer onboarding notes in `docs/QUICKSTART.md` about API keys.
- Communicate phased rollout: enable for local dev first, then stage, then prod.

## 6. Risk & Mitigation
| Risk | Mitigation |
| --- | --- |
| Secrets leakage | Use secret stores, do not commit keys; add CI lint for placeholders |
| Increased latency | Collect metrics; allow per-provider timeouts and concurrency limits |
| Cost overruns | Add usage logging, optional daily quota caps per user/provider |
| API schema drift | Pin client versions, monitor provider changelogs |
| Legal/compliance | Review data handling policies for Google/OpenAI; add toggles to disable cloud usage |

## 7. Phase 2 Exit Criteria
- All providers configurable via env, with sane defaults (local first).
- Automated fallback works in staged environments (demonstrated via logs/tests).
- Test suite covers fallback logic (>80% coverage for orchestrator module).
- Documentation updated and shared with team.
- Runbook outlines troubleshooting steps and rollback plan (disable providers via env).

## 8. Appendix
- **Configuration Example** (`.env`):
  ```ini
  LLM_PROVIDER_PRIORITY=ollama,gemini,openai
  GEMINI_API_KEY=replace-me
  GEMINI_MODEL=models/gemini-2.5-flash-preview-09-2025
  GEMINI_API_URL=https://generativelanguage.googleapis.com
  OPENAI_API_KEY=replace-me
  OPENAI_MODEL=gpt-4.1
  OPENAI_BASE_URL=https://api.openai.com/v1
  LLM_PROVIDER_TIMEOUTS=ollama:20,gemini:15,openai:15
  ```
- **Provider Health Strategy**:
  - Mark provider unhealthy after N consecutive failures; retry after cooldown (`LLM_PROVIDER_COOLDOWN_SEC`).
  - Record health status in memory for selection decisions.
- **Future Considerations**:
  - Add Anthropic Claude as another provider.
  - Introduce adaptive routing based on prompt classification (e.g., long-form vs. short-form).
  - Support per-user/provider preferences stored in the memory service.
