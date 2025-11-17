"""Tests for adaptive prompt adjustments driven by reflection analytics."""
from __future__ import annotations

from app.models.note_context import NoteComponent, NoteContext, NoteSection
from app.models.quiz import QuizGenerationRequest
from app.services.prompt_adjustments import (
    build_guidance_message,
    get_prompt_adjustment_state,
)
from app.services.prompt_builder import build_quiz_prompt
from app.tasks.prompt_adjustment_scheduler import _derive_guidance


def _make_request() -> QuizGenerationRequest:
    note = NoteContext(
        id="note-1",
        title="Sample Note",
        sections=[
            NoteSection(
                id="section-1",
                title="Intro",
                summary="Basics",
                components=[
                    NoteComponent(
                        id="component-1",
                        type="text",
                        text="Artificial Intelligence is a field of study.",
                    )
                ],
            )
        ],
    )
    return QuizGenerationRequest(noteContext=note)


def test_build_guidance_message_includes_context() -> None:
    message = build_guidance_message(quiz_id="quiz-42", average=3.1, window_days=7)
    assert "quiz artifact quiz-42" in message
    assert "3.10" in message


def test_derive_guidance_returns_payload_when_below_threshold() -> None:
    metrics = [
        {
            "aggregationDate": "2025-11-10",
            "quizId": "quiz-42",
            "averageRecommendationRating": 3.0,
            "recommendationRatingSum": 9,
            "recommendationRatingCount": 3,
        }
    ]
    result = _derive_guidance(metrics, window_days=7, threshold=3.4)
    assert result is not None
    guidance, metadata = result
    assert "dipped" in guidance
    assert metadata["quizId"] == "quiz-42"


def test_prompt_builder_appends_guidance() -> None:
    state = get_prompt_adjustment_state()
    state.apply(guidance="Provide detailed rationales.")
    request = _make_request()
    prompt = build_quiz_prompt(
        note=request.note_context,
        request=request,
        temperature=0.4,
        default_question_count=5,
    )
    assert "Adaptive guidance" in prompt
    assert "detailed rationales" in prompt
    state.clear()
