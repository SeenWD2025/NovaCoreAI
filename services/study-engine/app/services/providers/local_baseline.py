"""Simple deterministic quiz provider used as a fallback when LLMs fail."""
from __future__ import annotations

import hashlib
from typing import List

from ...models.quiz import (
    QuestionType,
    QuizGenerationRequest,
    QuizQuestion,
    QuizQuestionOption,
    QuizReflectionPrompt,
    QuizResult,
)


class LocalBaselineProvider:
    """Rule-based quiz generator that derives questions from note content."""

    name = "baseline"

    async def generate_quiz(self, request: QuizGenerationRequest) -> QuizResult:
        note = request.note_context
        base_seed = hashlib.sha1(note.title.encode("utf-8")).hexdigest()[:8]
        questions: List[QuizQuestion] = []

        summary = note.summary or ""
        topics = note.topics or []
        sections = note.sections[: request.question_count or 3]

        for index, section in enumerate(sections, start=1):
            prompt = section.summary or section.heading or summary or note.title
            option_seed = hashlib.sha1(f"{base_seed}-{index}".encode("utf-8")).hexdigest()
            options = [
                QuizQuestionOption(label="A", text=prompt, is_correct=True),
                QuizQuestionOption(label="B", text=f"{prompt} (incorrect)", is_correct=False),
            ]
            questions.append(
                QuizQuestion(
                    id=f"local-{index}",
                    prompt=f"What is a key idea from {section.heading or 'this section'}?",
                    type=QuestionType.MULTIPLE_CHOICE,
                    options=options,
                    answer="A",
                    answer_explanation=f"Derived from section summary hash {option_seed[:6]}",
                    metadata={"source_section": section.section_id},
                )
            )

        if not questions:
            questions.append(
                QuizQuestion(
                    id="local-1",
                    prompt=f"Summarize the core concept of '{note.title}'.",
                    type=QuestionType.SHORT_ANSWER,
                    answer=summary or "",
                    metadata={"topics": topics},
                )
            )

        reflection = None
        if request.include_reflection:
            reflection = QuizReflectionPrompt(
                prompt="What part of this material feels hardest for you right now?",
                guidance="Mention at least one concrete example from the note."
            )

        quiz_id = f"baseline-{base_seed}"
        return QuizResult(quiz_id=quiz_id, questions=questions, reflection=reflection, provider=self.name)


__all__ = ["LocalBaselineProvider"]
