# NGS Intelligent Lessons: Generation, Chat Tutoring, and Metrics Plan

Date: 2025-11-19
Status: Proposal (ready to implement)
Owners: Curriculum Service + Intelligence Core + Frontend

## 1) Objective
Deliver fully-fleshed, teach-before-assign lessons using the Intelligence Core. Each lesson is dynamically generated from a summary + generator prompt, with a per-lesson chat tutor, personalized guidance, and success metrics. Integrate outputs with Notes/Study/Quiz modules.

## 2) High-level Architecture
- NGS Curriculum (Go) orchestrates lesson generation and persists results.
- Intelligence Core (Python) generates structured lesson content and powers tutoring chat.
- Memory Service supplies STM/ITM/LTM context for personalization; Reflection Worker logs reflections; Quiz/Notes engines consume generated artifacts.

```
[Frontend Lesson View]
   ↕ REST/WebSocket
[API Gateway]
   ↕
[NGS Curriculum]
   ├─ POST /ngs/lessons/:id/generate → [Intelligence Core]
   ├─ GET  /ngs/lessons/:id/content   (cache from DB)
   ├─ Metrics write → user_progress/xp_events/lesson_metrics
   └─ Links: Notes API, Quiz Engine, Study Engine
```

## 3) Content Generation Flow
1. Trigger: User opens lesson (or presses "Generate Lesson").
2. NGS composes payload:
   - lesson_summary (from DB seed) + level metadata
   - learner profile (level, XP, prior completions, weak topics)
   - generic generator prompt (template below)
   - constraints (time, difficulty, prerequisites)
3. Intelligence returns StructuredLesson JSON with sections:
   - metadata: title, difficulty, prerequisites, outcomes
   - teach: overview, key concepts (with analogies), step-by-step instruction, examples, visuals_placeholders
   - guided_practice: scaffolded tasks with hints + solutions
   - assessment: checks-for-understanding (MCQ/short answer), rubrics
   - summary: recap + further reading
   - artifacts: quiz_items[], notes_outline[], code_snippets[], glossaries[]
4. NGS stores:
   - lessons.content_markdown (compiled MD from JSON)
   - lessons.metadata (raw StructuredLesson JSON) with version
   - optional: lesson_artifacts table (quiz_items, notes_outline) for cross-service consumption
5. Cache policy: re-generate allowed with version bump; last-good stored.

### Generic Generation Prompt (template)
System:
- You are a master educator and AI tutor. Teach before assigning. Build conceptual clarity, then guided practice, then assessment. Optimize for clarity, examples, and progressive scaffolding.

User message (JSON):
- lesson_summary: <short summary>
- level_number: <1..24> (Beginner→Expert)
- learner_profile: { xp, current_level, weak_topics[], prior_lessons[], preferences }
- constraints: { target_minutes, prereqs[], require_ethics_guardrails: true }
- output_schema: StructuredLesson (see above)

Assistant rules:
- No skipped steps; include concrete examples and hints.
- Use safe, ethical, and accessible language.
- Return valid JSON (StructuredLesson) followed by a compiled Markdown lesson.

## 4) Tutoring Chat Flow (Per-lesson)
- Create/Reuse chat session bound to lesson_id.
- Context injection on each message:
  - lesson content (last generated version)
  - learner profile + progress
  - recent chat turns (STM), frequent patterns (ITM), stable knowledge (LTM)
- Capabilities: explain, re-teach, generate examples, review answers, give hints.
- Streaming responses; "Ask Tutor" chat pane alongside content.

API:
- POST /ngs/lessons/:id/generate            → calls Intelligence /educator/generate
- GET  /ngs/lessons/:id/content             → returns compiled MD + metadata
- POST /ngs/lessons/:id/chat/message        → proxy to Intelligence chat with injected context
- GET  /ngs/lessons/:id/chat/history        → recent exchanges + tutor tips

## 5) Metrics & Success Signals
Capture and surface per-lesson:
- attempts_count, time_spent_seconds, messages_with_tutor, hints_requested
- reflections_count, memories_generated (via Memory Service), quiz_score_best/avg
- tips_for_improvement (tutor-synthesized)

Storage (minimal-change option):
- xp_events: append structured metadata for attempts/time/hints
- lesson_completions: extend completion_data JSON with metrics snapshot
- user_reflections: count per lesson

Optional new table (if desired): lesson_metrics(id, user_id, lesson_id, session_id, metrics JSONB, created_at)

Frontend display:
- Metrics panel with progress bars and deltas since last attempt
- "Tutor Tips" section (persisted from chat syntheses)

## 6) Integration with Notes / Study / Quiz (Lightweight)
- Notes API: POST notes from artifacts.notes_outline and key concept blocks; allow user edit/save.
- Study Engine: Create study plan entries from outcomes + weak_topics; link to spaced review.
- Quiz Engine: Upsert artifacts.quiz_items; present formative checks and end-of-lesson quiz.
Buttons:
- "Add to Notes" → notes-api
- "Create Study Plan" → study-engine
- "Generate Quiz" → quiz-engine

## 7) Frontend UX Outline
- Lesson Viewer: left content, right tutor chat; sticky TOC.
- Quick Actions: "Explain again", "Give example", "Check my answer", "Hint", "Summarize".
- Metrics widget: attempts, time, messages, score, reflections; CTA to reflect.
- Regenerate Lesson (with options: difficulty, time budget) → versioning.

## 8) Security & Ethics
- All prompts include ethics guardrails and safety policies.
- PII minimization in learner_profile.
- Rate limits for generation and chat.
- Logged prompts/responses with redaction (Policy Service can review).

## 9) Phased Rollout
- Phase A (MVP): generation endpoint, store MD + minimal metrics, tutor chat basic.
- Phase B: artifacts → Notes/Quiz, metrics dashboard, weak-topic adaptation.
- Phase C: study-engine integration, spaced review, advanced analytics.

## 10) Minimal Backend Changes (NGS)
- Add endpoints: /lessons/:id/generate, /lessons/:id/content, /lessons/:id/chat/*
- Add intelligence client (HTTP) + config: INTELLIGENCE_URL
- Update lesson_service to persist StructuredLesson JSON + compiled MD
- Emit xp_events with metrics metadata; update completion_data with attempts/time

## 11) Intelligence Core Additions
- /educator/generate (accepts summary + template, returns StructuredLesson + MD)
- /educator/chat (session-bound tutoring; uses Memory + Reflection workers)
- Prompt templates and evaluation hooks (check completeness and scaffolding)

## 12) Data Contracts
StructuredLesson JSON (partial):
```
{
  "metadata": {"title": "...", "outcomes": ["..."], "difficulty": "...", "prerequisites": ["..."]},
  "teach": {"overview": "...", "concepts": [{"name": "...", "expl": "...", "example": "..."}], "steps": ["..."], "visuals": ["..."]},
  "guided_practice": [{"task": "...", "hint": "...", "solution": "..."}],
  "assessment": {"checks": [{"type": "mcq", "q": "...", "choices": ["..."], "answer": 2, "explain": "..."}], "rubric": "..."},
  "summary": "...",
  "artifacts": {"quiz_items": [...], "notes_outline": [...], "code_snippets": [...], "glossary": [...]}
}
```

## 13) Observability
- Log generation latency, token usage, error rates.
- Add counters: lessons_generated_total, tutor_messages_total, hints_given_total.
- Trace across NGS ⇄ Intelligence ⇄ Memory (correlate session_id).

## 14) Acceptance Criteria (MVP)
- Given a lesson with a summary, POST /ngs/lessons/:id/generate stores MD + JSON and returns it.
- Tutor chat can explain, hint, and check answers with lesson context.
- Metrics show attempts, time, and messages; reflected in progress.
- Buttons send artifacts to Notes/Quiz successfully.

## 15) Risks & Mitigations
- Hallucination → schema validator + unit checks for required sections.
- Token costs → cache per user-version; chunk lessons; stream tutor responses.
- Latency → async generation with placeholder and notification on ready.

## 16) Next Steps
- Approve this plan; create tickets for NGS, Intelligence, Frontend.
- Implement MVP (Phase A) behind feature flags.
- Dogfood with levels 1–3; iterate prompts and UI.
