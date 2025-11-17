"""Models representing quiz sessions and API payloads."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from .quiz_artifact import QuizArtifact


class QuizSessionStatus(str, Enum):
    """Lifecycle status for a quiz session."""

    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class QuizSessionRecord(BaseModel):
    """Database representation of a quiz session."""

    session_id: str = Field(..., alias="sessionId")
    quiz_id: str = Field(..., alias="quizId")
    app_id: str = Field(..., alias="appId")
    user_id: str = Field(..., alias="userId")
    note_id: Optional[str] = Field(None, alias="noteId")
    status: QuizSessionStatus = Field(default=QuizSessionStatus.IN_PROGRESS, alias="status")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    is_deleted: bool = Field(False, alias="isDeleted")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    quiz_snapshot: QuizArtifact = Field(..., alias="quizSnapshot")
    answers: List[Dict[str, Any]] = Field(default_factory=list)
    results: Optional[Dict[str, Any]] = Field(None, alias="results")

    model_config = ConfigDict(populate_by_name=True)


class QuizSessionCreateRequest(BaseModel):
    """Payload used to create a new quiz session."""

    quiz_id: str = Field(
        ...,
        alias="quizId",
        validation_alias=AliasChoices("quizId", "quiz_id"),
        serialization_alias="quizId",
    )
    user_id: str = Field(
        ...,
        alias="userId",
        validation_alias=AliasChoices("userId", "user_id"),
        serialization_alias="userId",
    )
    app_id: str = Field(
        ...,
        alias="appId",
        validation_alias=AliasChoices("appId", "app_id"),
        serialization_alias="appId",
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)


class SessionQuestionType(str, Enum):
    """Enumerates the question types exposed via the API."""

    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    TRUE_FALSE = "TRUE_FALSE"
    SHORT_ANSWER = "SHORT_ANSWER"
    WRITTEN_RESPONSE = "WRITTEN_RESPONSE"


class SessionQuestionOption(BaseModel):
    """Option returned to the quiz taker."""

    option_id: str = Field(..., alias="optionId")
    text: str

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class SessionQuestion(BaseModel):
    """Question payload exposed to quiz takers."""

    question_id: str = Field(..., alias="questionId")
    prompt: str
    type: SessionQuestionType
    options: Optional[List[SessionQuestionOption]] = None
    difficulty: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    source_component_id: Optional[str] = Field(
        None,
        alias="sourceComponentId",
        serialization_alias="sourceComponentId",
    )
    points: Optional[float] = None

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class SessionReflection(BaseModel):
    """Reflection prompt returned with the session."""

    prompt: str
    guidance: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class QuizSessionView(BaseModel):
    """API representation of a quiz session."""

    session_id: str = Field(..., alias="sessionId")
    quiz_id: str = Field(..., alias="quizId")
    app_id: str = Field(..., alias="appId")
    user_id: str = Field(..., alias="userId")
    note_id: Optional[str] = Field(None, alias="noteId")
    status: QuizSessionStatus
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    questions: List[SessionQuestion]
    reflection: Optional[SessionReflection] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class QuizSessionResponse(BaseModel):
    """Envelope used for session API responses."""

    session: QuizSessionView

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)