"""Pydantic models describing note resources."""
from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, ConfigDict


class NoteMetadata(BaseModel):
    """Arbitrary metadata captured alongside the structured note."""

    source: Optional[str] = Field(default=None, alias="source", description="Origin system of the note")
    course_id: Optional[str] = Field(default=None, alias="courseId", description="Course association")
    curriculum_path: Optional[str] = Field(default=None, alias="curriculumPath", description="Curriculum hierarchy reference")
    extra: Dict[str, str] = Field(default_factory=dict, alias="extra", description="Additional metadata")

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class NoteComponent(BaseModel):
    """Structured note component aligned with UI builder blocks."""

    component_id: str = Field(..., alias="componentId", min_length=1)
    component_type: Literal["HEADER", "SUBJECT", "DEFINITION", "EXAMPLE", "EXPLANATION"] = Field(
        ...,
        alias="componentType",
        description="Component type defined in the specification",
    )
    content: str = Field(..., alias="content", min_length=1, max_length=4000)
    sequence: int = Field(default=0, alias="sequence", ge=0, description="Ordering of components")
    metadata: Dict[str, str] = Field(default_factory=dict, alias="metadata")

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class NoteBase(BaseModel):
    """Shared fields for notes."""

    user_id: str = Field(..., alias="userId", min_length=1, description="Learner identifier")
    app_id: str = Field(..., alias="appId", min_length=1, description="Application identifier for multi-tenant storage")
    session_id: str = Field(..., alias="sessionId", min_length=1, description="Session or cohort reference")
    title: str = Field(..., alias="title", min_length=1, max_length=250, description="Title of the note")
    components: List[NoteComponent] = Field(default_factory=list, alias="components", description="Structured note components")
    tags: List[str] = Field(default_factory=list, alias="tags", description="Free-form tags")
    retention_policy_days: int = Field(default=365, alias="retentionPolicyDays", ge=1, le=1825)
    quiz_generation_requested: bool = Field(default=False, alias="quizGenerationRequested", description="Flag to trigger quiz pipeline")
    metadata: NoteMetadata = Field(default_factory=NoteMetadata, alias="metadata")
    is_deleted: bool = Field(default=False, alias="isDeleted")
    deleted_at: Optional[datetime] = Field(default=None, alias="deletedAt")

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class NoteCreate(NoteBase):
    """Payload used when creating a note."""

    pass


class NoteUpdate(BaseModel):
    """Fields that may be modified after creation."""

    title: Optional[str] = Field(default=None, alias="title", max_length=250)
    components: Optional[List[NoteComponent]] = Field(default=None, alias="components")
    tags: Optional[List[str]] = Field(default=None, alias="tags")
    retention_policy_days: Optional[int] = Field(default=None, alias="retentionPolicyDays", ge=1, le=1825)
    quiz_generation_requested: Optional[bool] = Field(default=None, alias="quizGenerationRequested")
    metadata: Optional[NoteMetadata] = Field(default=None, alias="metadata")
    is_deleted: Optional[bool] = Field(default=None, alias="isDeleted")
    deleted_at: Optional[datetime] = Field(default=None, alias="deletedAt")

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class NoteInDB(NoteBase):
    """Internal representation including audit timestamps."""

    id: str = Field(..., alias="noteId")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class NoteResponse(NoteInDB):
    """Response model returned to API consumers."""

    pass
