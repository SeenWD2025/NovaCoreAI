"""Educator endpoints for lesson generation and tutoring."""
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional
import time
import logging
import json

from app.database import get_db
from app.models.schemas import (
    GenerateLessonRequest, GenerateLessonResponse,
    EducatorChatMessage, EducatorChatResponse,
    SessionInfo, StructuredLesson
)
from app.services.llm_router import llm_orchestrator, ProviderExhaustedError
from app.services.session_service import SessionService
from app.services.integration_service import integration_service
from app.services.usage_service import usage_service
from app.utils.token_counter import token_counter
from app.utils.service_auth import verify_service_token_dependency, ServiceTokenPayload
from app.utils.sanitize import sanitize_message
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/educator", tags=["educator"])

# Security constants
MAX_MESSAGE_LENGTH = 10000


def get_user_id(x_user_id: Optional[str] = Header(None)) -> UUID:
    """Extract user ID from header."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID header missing")
    try:
        return UUID(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")


def build_lesson_generation_prompt(request: GenerateLessonRequest) -> tuple[str, str]:
    """Build system and user prompts for lesson generation."""
    
    system_prompt = """You are a master educator and AI tutor specializing in the Noble Growth School curriculum. Your role is to create comprehensive, engaging lessons that teach before assigning tasks.

Core Principles:
- Build conceptual clarity through clear explanations and concrete examples
- Use progressive scaffolding from simple to complex
- Include analogies to aid understanding
- Provide guided practice with hints before assessment
- Ensure all content is ethical, safe, and accessible
- Optimize for learner engagement and retention

Output Format:
You MUST respond with valid JSON matching the StructuredLesson schema. Include all required sections: metadata, teach, guided_practice, assessment, summary, and artifacts."""

    learner_context = f"""
Learner Profile:
- Current Level: {request.learner_profile.current_level} of 24
- Total XP: {request.learner_profile.xp}
- Weak Topics: {', '.join(request.learner_profile.weak_topics) if request.learner_profile.weak_topics else 'None identified'}
- Prior Lessons: {len(request.learner_profile.prior_lessons)} completed
"""

    constraints_text = f"""
Constraints:
- Target Duration: {request.constraints.target_minutes} minutes
- Prerequisites: {', '.join(request.constraints.prereqs) if request.constraints.prereqs else 'None'}
- Ethics Guardrails: {'Required' if request.constraints.require_ethics_guardrails else 'Optional'}
"""

    user_prompt = f"""Generate a comprehensive lesson for Level {request.level_number} of the Noble Growth School curriculum.

Lesson Summary: {request.lesson_summary}

{learner_context}
{constraints_text}

Create a structured lesson with:
1. Clear learning outcomes and difficulty assessment
2. Teaching section with overview, key concepts (with examples and analogies), and step-by-step instructions
3. At least 2-3 guided practice tasks with hints and solutions
4. Assessment checks (MCQ or short answer) with explanations
5. Summary of key takeaways
6. Artifacts for integration (quiz items, notes outline, glossary)

Respond ONLY with valid JSON matching the StructuredLesson schema. No additional text."""

    return system_prompt, user_prompt


def compile_lesson_to_markdown(lesson: StructuredLesson) -> str:
    """Compile structured lesson to markdown format."""
    
    md_parts = []
    
    md_parts.append(f"# {lesson.metadata.title}\n")
    md_parts.append(f"**Difficulty:** {lesson.metadata.difficulty.value.title()}\n")
    md_parts.append(f"**Estimated Time:** {lesson.metadata.estimated_minutes} minutes\n")
    
    md_parts.append("\n## Learning Outcomes\n")
    for outcome in lesson.metadata.outcomes:
        md_parts.append(f"- {outcome}\n")
    
    if lesson.metadata.prerequisites:
        md_parts.append("\n## Prerequisites\n")
        for prereq in lesson.metadata.prerequisites:
            md_parts.append(f"- {prereq}\n")
    
    md_parts.append("\n## Overview\n")
    md_parts.append(f"{lesson.teach.overview}\n")
    
    md_parts.append("\n## Key Concepts\n")
    for concept in lesson.teach.concepts:
        md_parts.append(f"\n### {concept.name}\n")
        md_parts.append(f"{concept.explanation}\n")
        md_parts.append(f"\n**Example:** {concept.example}\n")
        if concept.analogy:
            md_parts.append(f"\n**Analogy:** {concept.analogy}\n")
    
    md_parts.append("\n## Step-by-Step Instructions\n")
    for i, step in enumerate(lesson.teach.steps, 1):
        md_parts.append(f"{i}. {step}\n")
    
    md_parts.append("\n## Guided Practice\n")
    for i, task in enumerate(lesson.guided_practice, 1):
        md_parts.append(f"\n### Practice Task {i}\n")
        md_parts.append(f"{task.task}\n")
        md_parts.append(f"\n<details>\n<summary>Hint</summary>\n{task.hint}\n</details>\n")
        md_parts.append(f"\n<details>\n<summary>Solution</summary>\n{task.solution}\n</details>\n")
    
    md_parts.append("\n## Check Your Understanding\n")
    for i, check in enumerate(lesson.assessment.checks, 1):
        md_parts.append(f"\n**Question {i}:** {check.question}\n")
        if check.type.value == "mcq" and check.choices:
            for j, choice in enumerate(check.choices):
                md_parts.append(f"{chr(65+j)}. {choice}\n")
        md_parts.append(f"\n<details>\n<summary>Answer & Explanation</summary>\n{check.explanation}\n</details>\n")
    
    md_parts.append("\n## Summary\n")
    md_parts.append(f"{lesson.summary}\n")
    
    if lesson.artifacts.glossary:
        md_parts.append("\n## Glossary\n")
        for term in lesson.artifacts.glossary:
            md_parts.append(f"**{term.term}:** {term.definition}\n")
    
    return "".join(md_parts)


@router.post("/generate", response_model=GenerateLessonResponse)
async def generate_lesson(
    request: GenerateLessonRequest,
    user_id: UUID = Depends(get_user_id),
    db: Session = Depends(get_db),
    service: ServiceTokenPayload = Depends(verify_service_token_dependency)
):
    """Generate a structured lesson using AI."""
    start_time = time.time()
    
    if not await llm_orchestrator.ensure_ready():
        raise HTTPException(status_code=503, detail="LLM service not ready")
    
    # Get user's subscription tier
    user_tier = await integration_service.get_user_tier(user_id)
    
    system_prompt, user_prompt = build_lesson_generation_prompt(request)
    
    estimated_tokens = token_counter.count_tokens(system_prompt + user_prompt) + 2000
    
    has_quota, quota_msg = usage_service.check_quota(
        db, user_id, user_tier, "llm_tokens", estimated_tokens
    )
    if not has_quota:
        raise HTTPException(status_code=429, detail=quota_msg)
    
    try:
        provider_result = await llm_orchestrator.generate_response(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=4000,
        )
        response_text = provider_result.content
        provider_name = provider_result.provider
        provider_latency_ms = provider_result.latency_ms
        
        if not response_text.strip():
            raise HTTPException(status_code=500, detail="LLM returned empty response")
        
    except ProviderExhaustedError as exc:
        logger.error(f"All LLM providers exhausted: {exc}")
        raise HTTPException(status_code=503, detail="LLM providers unavailable")
    
    try:
        json_text = response_text.strip()
        if json_text.startswith("```json"):
            json_text = json_text.split("```json")[1].split("```")[0].strip()
        elif json_text.startswith("```"):
            json_text = json_text.split("```")[1].split("```")[0].strip()
        
        lesson_data = json.loads(json_text)
        structured_lesson = StructuredLesson(**lesson_data)
        
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Failed to parse lesson JSON: {e}\nResponse: {response_text[:500]}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse lesson structure: {str(e)}"
        )
    
    content_markdown = compile_lesson_to_markdown(structured_lesson)
    
    tokens_used = token_counter.count_tokens(system_prompt + user_prompt + response_text)
    latency_ms = int((time.time() - start_time) * 1000)
    
    usage_service.record_usage(
        db, user_id, "llm_tokens", tokens_used,
        metadata={
            "lesson_generation": True,
            "level": request.level_number,
            "provider": provider_name,
            "latency_ms": latency_ms,
        }
    )
    
    logger.info(
        f"Lesson generated for level {request.level_number}",
        extra={
            "user_id": str(user_id),
            "tokens_used": tokens_used,
            "latency_ms": latency_ms,
            "provider": provider_name,
        }
    )
    
    return GenerateLessonResponse(
        structured_lesson=structured_lesson,
        content_markdown=content_markdown,
        tokens_used=tokens_used,
        provider=provider_name,
        latency_ms=latency_ms,
        version=1
    )


@router.post("/chat/message", response_model=EducatorChatResponse)
async def educator_chat(
    message: EducatorChatMessage,
    user_id: UUID = Depends(get_user_id),
    db: Session = Depends(get_db),
    service: ServiceTokenPayload = Depends(verify_service_token_dependency)
):
    """Chat with educator/tutor about a specific lesson."""
    start_time = time.time()
    
    if not message.message or not message.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    try:
        sanitized_message = sanitize_message(message.message, MAX_MESSAGE_LENGTH)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    message.message = sanitized_message
    
    if not await llm_orchestrator.ensure_ready():
        raise HTTPException(status_code=503, detail="LLM service not ready")
    
    # Get or create session
    if message.session_id:
        session = SessionService.get_session(db, message.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        session_id = message.session_id
    else:
        session_id = SessionService.create_session(db, user_id, settings.llm_model)
    
    context = f"You are tutoring a student on Lesson {message.lesson_id}. "
    context += "Provide clear explanations, helpful hints, and check their understanding. "
    context += "Be encouraging and supportive.\n\n"
    
    memory_context = await integration_service.get_memory_context(
        user_id=user_id,
        session_id=session_id,
        limit=5
    )
    context += integration_service.build_context_prompt(memory_context)
    
    # Prepare prompt
    full_prompt = f"{context}Student: {message.message}\nTutor:"
    
    estimated_tokens = token_counter.count_tokens(full_prompt) + 500
    
    user_tier = await integration_service.get_user_tier(user_id)
    has_quota, quota_msg = usage_service.check_quota(
        db, user_id, user_tier, "llm_tokens", estimated_tokens
    )
    if not has_quota:
        raise HTTPException(status_code=429, detail=quota_msg)
    
    # Generate response
    system_prompt = "You are a patient, knowledgeable tutor helping students learn. Provide clear explanations, encourage critical thinking, and adapt to the student's level."
    
    try:
        provider_result = await llm_orchestrator.generate_response(
            prompt=full_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=1000,
        )
        response_text = provider_result.content
        provider_name = provider_result.provider
        
        if not response_text.strip():
            raise HTTPException(status_code=500, detail="LLM returned empty response")
        
    except ProviderExhaustedError as exc:
        logger.error(f"All LLM providers exhausted: {exc}")
        raise HTTPException(status_code=503, detail="LLM providers unavailable")
    
    tokens_used = token_counter.count_tokens(full_prompt + response_text)
    latency_ms = int((time.time() - start_time) * 1000)
    
    SessionService.store_prompt(
        db, session_id, user_id, message.message, response_text, tokens_used, latency_ms
    )
    
    usage_service.record_usage(
        db, user_id, "llm_tokens", tokens_used,
        metadata={
            "educator_chat": True,
            "lesson_id": str(message.lesson_id),
            "session_id": str(session_id),
            "provider": provider_name,
        }
    )
    
    await integration_service.store_stm_interaction(
        user_id=user_id,
        session_id=session_id,
        input_text=message.message,
        output_text=response_text,
        tokens=tokens_used
    )
    
    logger.info(
        f"Educator chat message processed",
        extra={
            "user_id": str(user_id),
            "lesson_id": str(message.lesson_id),
            "session_id": str(session_id),
            "tokens_used": tokens_used,
        }
    )
    
    return EducatorChatResponse(
        response=response_text,
        session_id=session_id,
        lesson_id=message.lesson_id,
        tokens_used=tokens_used,
        latency_ms=latency_ms
    )
