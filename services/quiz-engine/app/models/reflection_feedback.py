"""Models for capturing quiz reflection feedback."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ReflectionFeedbackCreateRequest(BaseModel):
    """Payload submitted when learners rate a quiz session."""

    session_id: Optional[str] = Field(
        None,
        alias="sessionId",
        validation_alias=AliasChoices("sessionId", "session_id"),
        serialization_alias="sessionId",
    )
    quiz_id: str = Field(
        ...,
        alias="quizId",
        validation_alias=AliasChoices("quizId", "quiz_id"),
        serialization_alias="quizId",
    )
    app_id: str = Field(
        ...,
        alias="appId",
        validation_alias=AliasChoices("appId", "app_id"),
        serialization_alias="appId",
    )
    user_id: str = Field(
        ...,
        alias="userId",
        validation_alias=AliasChoices("userId", "user_id"),
        serialization_alias="userId",
    )
    note_id: Optional[str] = Field(None, alias="noteId", serialization_alias="noteId")
    quiz_rating: int = Field(
        ...,
        alias="quizRating",
        validation_alias=AliasChoices("quizRating", "quiz_rating"),
        serialization_alias="quizRating",
        ge=1,
        le=5,
    )
    recommendation_rating: int = Field(
        ...,
        alias="recommendationRating",
        validation_alias=AliasChoices("recommendationRating", "recommendation_rating"),
        serialization_alias="recommendationRating",
        ge=1,
        le=5,
    )
    notes: Optional[str] = Field(None, alias="notes", serialization_alias="notes", max_length=2000)
    submitted_at: Optional[datetime] = Field(
        None,
        alias="submittedAt",
        validation_alias=AliasChoices("submittedAt", "submitted_at"),
        serialization_alias="submittedAt",
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)


class ReflectionFeedbackRecord(BaseModel):
    """Database representation of saved feedback."""

    feedback_id: str = Field(..., alias="feedbackId")
    session_id: str = Field(..., alias="sessionId")
    quiz_id: str = Field(..., alias="quizId")
    app_id: str = Field(..., alias="appId")
    user_id: str = Field(..., alias="userId")
    note_id: Optional[str] = Field(None, alias="noteId")
    quiz_rating: int = Field(..., alias="quizRating", ge=1, le=5)
    recommendation_rating: int = Field(..., alias="recommendationRating", ge=1, le=5)
    notes: Optional[str] = Field(None, alias="notes")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    submitted_at: datetime = Field(..., alias="submittedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    is_deleted: bool = Field(False, alias="isDeleted")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class ReflectionFeedbackResponse(BaseModel):
    """Envelope for feedback API responses."""

    feedback: ReflectionFeedbackRecord

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
