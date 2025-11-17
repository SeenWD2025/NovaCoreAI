"""Quiz generation models shared across service layers."""
from enum import Enum
from typing import Any, List, Optional

from pydantic import AliasChoices, BaseModel, Field, model_validator, ConfigDict


class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    FILL_IN_THE_BLANK = "fill_in_the_blank"


class QuizQuestionOption(BaseModel):
    label: str
    text: str
    is_correct: bool = Field(
        False,
        alias="isCorrect",
        validation_alias=AliasChoices("isCorrect", "is_correct"),
        serialization_alias="isCorrect",
    )


class QuizQuestion(BaseModel):
    question_id: str = Field(..., alias="id")
    prompt: str
    type: QuestionType
    options: Optional[List[QuizQuestionOption]] = None
    answer_explanation: Optional[str] = Field(
        None,
        alias="answerExplanation",
        validation_alias=AliasChoices("answerExplanation", "answer_explanation"),
        serialization_alias="answerExplanation",
    )
    answer: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class QuizGenerationInput(BaseModel):
    note_id: Optional[str] = Field(
        None,
        alias="noteId",
        validation_alias=AliasChoices("noteId", "note_id"),
        serialization_alias="noteId",
    )
    note_context: Optional["NoteContext"] = Field(
        None,
        alias="noteContext",
        validation_alias=AliasChoices("noteContext", "note_context"),
        serialization_alias="noteContext",
    )
    question_count: Optional[int] = Field(
        None,
        ge=1,
        le=200,
        alias="questionCount",
        validation_alias=AliasChoices("questionCount", "question_count"),
        serialization_alias="questionCount",
    )
    question_types: Optional[List[QuestionType]] = Field(
        default=None,
        alias="questionTypes",
        validation_alias=AliasChoices("questionTypes", "question_types"),
        serialization_alias="questionTypes",
    )
    include_reflection: bool = Field(
        True,
        alias="includeReflection",
        validation_alias=AliasChoices("includeReflection", "include_reflection"),
        serialization_alias="includeReflection",
    )

    class Config:
        populate_by_name = True

    @model_validator(mode="after")
    def _validate_note_reference(self):
        if not self.note_context and not self.note_id:
            raise ValueError("Either noteContext or noteId must be provided")
        return self


class QuizGenerationRequest(BaseModel):
    note_context: "NoteContext" = Field(
        ...,
        alias="noteContext",
        validation_alias=AliasChoices("noteContext", "note_context"),
        serialization_alias="noteContext",
    )
    question_count: Optional[int] = Field(
        None,
        ge=1,
        le=200,
        alias="questionCount",
        validation_alias=AliasChoices("questionCount", "question_count"),
        serialization_alias="questionCount",
    )
    question_types: Optional[List[QuestionType]] = Field(
        default=None,
        alias="questionTypes",
        validation_alias=AliasChoices("questionTypes", "question_types"),
        serialization_alias="questionTypes",
    )
    include_reflection: bool = Field(
        True,
        alias="includeReflection",
        validation_alias=AliasChoices("includeReflection", "include_reflection"),
        serialization_alias="includeReflection",
    )

    class Config:
        populate_by_name = True


class QuizReflectionPrompt(BaseModel):
    prompt: str
    guidance: Optional[str] = Field(None, alias="guidance")

    class Config:
        populate_by_name = True


class QuizResult(BaseModel):
    quiz_id: str = Field(
        ...,
        alias="quizId",
        validation_alias=AliasChoices("quizId", "quiz_id"),
        serialization_alias="quizId",
    )
    questions: List[QuizQuestion]
    reflection: Optional[QuizReflectionPrompt] = None
    provider: str = "unknown"

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class QuizGenerationResponse(BaseModel):
    quiz: QuizResult

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


# Forward reference resolution
from .note_context import NoteContext  # noqa: E402  pylint: disable=wrong-import-position

QuizGenerationInput.model_rebuild()
QuizGenerationRequest.model_rebuild()
