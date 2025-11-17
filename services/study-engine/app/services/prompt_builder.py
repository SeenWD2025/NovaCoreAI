"""Utilities for constructing quiz generation prompts."""
from __future__ import annotations

import textwrap

from ..models.quiz import QuizGenerationRequest
from ..models.note_context import NoteContext
from .prompt_adjustments import get_prompt_adjustment_state


PROMPT_HEADER = "You are Nova Study Engine, generating quizzes for learners."
PROMPT_SCHEMA = """The user will receive the quiz as JSON. Always respond with strictly valid JSON matching this schema:
{
  "quiz_id": "string",
  "questions": [
    {
      "id": "string",
      "type": "multiple_choice|true_false|short_answer|fill_in_the_blank",
      "prompt": "string",
      "options": [{"label": "string", "text": "string", "is_correct": boolean}],
      "answer": "string (for non-multiple-choice include answer)",
      "answer_explanation": "string"
    }
  ],
  "reflection": {
    "prompt": "string",
    "guidance": "string"
  }
}
Do not wrap the JSON in markdown fences."""


def build_quiz_prompt(
    note: NoteContext,
    request: QuizGenerationRequest,
    temperature: float,
    default_question_count: int,
) -> str:
    """Render a structured prompt for quiz generation providers."""

    question_count = request.question_count or default_question_count
    question_types = ", ".join(t.value for t in (request.question_types or [])) or "any"

    sections_rendered = []
    for section in note.sections:
        text_parts = [
            f"Section: {section.heading or 'Untitled'}",
        ]
        if section.summary:
            text_parts.append(f"Summary: {section.summary}")
        if section.keywords:
            text_parts.append("Keywords: " + ", ".join(section.keywords))

        component_lines = []
        for component in section.components:
            if component.text:
                component_lines.append(component.text)
            if component.bullet_points:
                component_lines.extend(f"- {bullet}" for bullet in component.bullet_points)
            if component.code:
                component_lines.append(textwrap.indent(component.code, "    "))
        if component_lines:
            text_parts.append("Details:\n" + "\n".join(component_lines))
        sections_rendered.append("\n".join(part for part in text_parts if part))

    context_block = "\n\n".join(sections_rendered)
    topics = ", ".join(note.topics)
    tags = ", ".join(note.tags)

    note_summary = note.summary or "n/a"
    metadata_summary = "".join(f"{key}: {value}\n" for key, value in note.metadata.items()) if note.metadata else ""

    adjustment_guidance = get_prompt_adjustment_state().render_guidance()

    prompt_body = f"""
{PROMPT_HEADER}
{PROMPT_SCHEMA}

Note title: {note.title}
Difficulty: {note.difficulty or 'unspecified'}
Topics: {topics or 'n/a'}
Tags: {tags or 'n/a'}
Summary: {note_summary}

Requested question count: {question_count}
Allowed question types: {question_types}
Reflection required: {request.include_reflection}
Temperature: {temperature}

Metadata:
{metadata_summary or 'None provided'}

Note content:
{context_block or note.raw_text or 'No additional content provided.'}
"""
    prompt_text = textwrap.dedent(prompt_body).strip()

    if adjustment_guidance:
        prompt_text = (
            f"{prompt_text}\n\nAdaptive guidance (learner feedback): {adjustment_guidance.strip()}"
        )
    return prompt_text


__all__ = ["build_quiz_prompt"]
