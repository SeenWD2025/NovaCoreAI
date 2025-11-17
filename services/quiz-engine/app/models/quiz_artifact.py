"""Pydantic models representing stored quiz artifacts."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import AliasChoices, BaseModel, Field


class ArtifactQuestionOption(BaseModel):
    """Option definition stored with a generated quiz."""

    label: str
    text: str
    is_correct: bool = Field(
        False,
        alias="isCorrect",
        validation_alias=AliasChoices("isCorrect", "is_correct"),
        serialization_alias="isCorrect",
    )

    class Config:
        populate_by_name = True


class ArtifactQuestion(BaseModel):
    """Question payload persisted by the Study Engine."""

    question_id: str = Field(..., alias="id")
    prompt: str
    type: str
    options: Optional[List[ArtifactQuestionOption]] = None
    answer: Optional[str] = None
    answer_explanation: Optional[str] = Field(
        None,
        alias="answerExplanation",
        validation_alias=AliasChoices("answerExplanation", "answer_explanation"),
        serialization_alias="answerExplanation",
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class ArtifactReflection(BaseModel):
    """Reflection prompt accompanying a quiz."""

    prompt: str
    guidance: Optional[str] = Field(None, alias="guidance")

    class Config:
        populate_by_name = True


class QuizArtifact(BaseModel):
    """Complete quiz artifact persisted by the Study Engine."""

    quiz_id: str = Field(..., alias="quizId")
    provider: Optional[str] = None
    note_id: Optional[str] = Field(None, alias="noteId")
    app_id: Optional[str] = Field(None, alias="appId")
    user_id: Optional[str] = Field(None, alias="userId")
    session_id: Optional[str] = Field(None, alias="sessionId")
    question_count: Optional[int] = Field(None, alias="questionCount")
    requested_question_count: Optional[int] = Field(None, alias="requestedQuestionCount")
    requested_question_types: Optional[List[str]] = Field(None, alias="requestedQuestionTypes")
    question_types: Optional[List[str]] = Field(None, alias="questionTypes")
    include_reflection: Optional[bool] = Field(None, alias="includeReflection")
    questions: List[ArtifactQuestion] = Field(default_factory=list)
    reflection: Optional[ArtifactReflection] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True