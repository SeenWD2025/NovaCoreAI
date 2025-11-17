"""Models representing quiz sessions and API payloads."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Any, Dict, List, Optional, Union, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from .quiz_artifact import QuizArtifact


class QuizSessionStatus(str, Enum):
    """Lifecycle status for a quiz session."""

    IN_PROGRESS = "in_progress"
    AWAITING_REVIEW = "awaiting_review"
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
    results: Optional["QuizSessionResults"] = Field(None, alias="results")

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


class _SubmissionAnswerBase(BaseModel):
    question_id: str = Field(
        ...,
        alias="questionId",
        validation_alias=AliasChoices("questionId", "question_id"),
        serialization_alias="questionId",
    )


class MultipleChoiceSubmissionAnswer(_SubmissionAnswerBase):
    type: Literal["MULTIPLE_CHOICE"] = Field("MULTIPLE_CHOICE", alias="type")
    selected_option_ids: List[str] = Field(
        default_factory=list,
        alias="selectedOptionIds",
        validation_alias=AliasChoices("selectedOptionIds", "selected_option_ids"),
        serialization_alias="selectedOptionIds",
    )


class TrueFalseSubmissionAnswer(_SubmissionAnswerBase):
    type: Literal["TRUE_FALSE"] = Field("TRUE_FALSE", alias="type")
    answer: bool


class ShortAnswerSubmissionAnswer(_SubmissionAnswerBase):
    type: Literal["SHORT_ANSWER"] = Field("SHORT_ANSWER", alias="type")
    answer: str


class WrittenResponseSubmissionAnswer(_SubmissionAnswerBase):
    type: Literal["WRITTEN_RESPONSE"] = Field("WRITTEN_RESPONSE", alias="type")
    answer: str


QuizSubmissionAnswer = Annotated[
    Union[
        MultipleChoiceSubmissionAnswer,
        TrueFalseSubmissionAnswer,
        ShortAnswerSubmissionAnswer,
        WrittenResponseSubmissionAnswer,
    ],
    Field(discriminator="type"),
]


class QuizSubmissionRequest(BaseModel):
    """Payload containing quiz answers submitted by a learner."""

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
    answers: List[QuizSubmissionAnswer]
    submitted_at: Optional[datetime] = Field(
        None,
        alias="submittedAt",
        validation_alias=AliasChoices("submittedAt", "submitted_at"),
        serialization_alias="submittedAt",
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)


class QuestionResult(BaseModel):
    """Result for an individual question after grading."""

    question_id: str = Field(..., alias="questionId")
    score: float = Field(..., alias="score")
    max_score: float = Field(..., alias="maxScore")
    correct: bool = Field(..., alias="correct")
    pending_review: bool = Field(False, alias="pendingReview")
    feedback: Optional[str] = Field(None, alias="feedback")
    submitted_answer: Optional[Any] = Field(None, alias="submittedAnswer")
    source_component_id: Optional[str] = Field(None, alias="sourceComponentId")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class Recommendation(BaseModel):
    """Recommendation or note improvement suggestion derived from grading."""

    recommendation_id: str = Field(..., alias="recommendationId")
    session_id: str = Field(..., alias="sessionId")
    quiz_id: str = Field(..., alias="quizId")
    user_id: str = Field(..., alias="userId")
    app_id: str = Field(..., alias="appId")
    note_id: Optional[str] = Field(None, alias="noteId")
    question_id: Optional[str] = Field(None, alias="questionId")
    source_component_id: Optional[str] = Field(None, alias="sourceComponentId")
    text: str = Field(..., alias="text")
    created_at: datetime = Field(..., alias="createdAt")
    is_deleted: bool = Field(False, alias="isDeleted")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class QuizSessionResults(BaseModel):
    """Aggregated results for a completed quiz session."""

    session_id: str = Field(..., alias="sessionId")
    quiz_id: str = Field(..., alias="quizId")
    user_id: str = Field(..., alias="userId")
    app_id: str = Field(..., alias="appId")
    note_id: Optional[str] = Field(None, alias="noteId")
    total_score: float = Field(..., alias="totalScore")
    max_score: float = Field(..., alias="maxScore")
    question_results: List[QuestionResult] = Field(default_factory=list, alias="questionResults")
    recommendations: List[Recommendation] = Field(default_factory=list, alias="recommendations")
    note_improvement_suggestions: List[Recommendation] = Field(
        default_factory=list,
        alias="noteImprovementSuggestions",
    )
    completed_at: datetime = Field(..., alias="completedAt")
    submitted_at: datetime = Field(..., alias="submittedAt")
    requires_review: bool = Field(False, alias="requiresReview")
    pending_written_count: int = Field(0, alias="pendingWrittenCount")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class QuizResultsResponse(BaseModel):
    """Response returned after quiz submission."""

    results: QuizSessionResults

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


# Resolve forward references for nested models
QuizSessionRecord.model_rebuild()
QuizSubmissionRequest.model_rebuild()
QuizSessionResults.model_rebuild()