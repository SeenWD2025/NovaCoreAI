"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, Field
from typing import Optional, List, Union, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


class ChatMessage(BaseModel):
    """Chat message request."""
    message: str = Field(..., min_length=1, max_length=4000, description="User message")
    session_id: Optional[UUID] = Field(None, description="Session ID to continue conversation")
    use_memory: bool = Field(True, description="Whether to use memory context")
    stream: bool = Field(True, description="Whether to stream the response")


class ChatResponse(BaseModel):
    """Chat message response."""
    response: str
    session_id: UUID
    tokens_used: int
    latency_ms: int


class StreamChunk(BaseModel):
    """Streaming response chunk."""
    content: str
    done: bool = False
    session_id: Optional[UUID] = None
    tokens_used: Optional[int] = None


class SessionInfo(BaseModel):
    """Session information."""
    model_config = {"protected_namespaces": ()}
    
    id: UUID
    user_id: UUID
    status: str
    model_name: str
    created_at: datetime
    ended_at: Optional[datetime] = None


class SessionListResponse(BaseModel):
    """List of user sessions."""
    sessions: List[SessionInfo]
    total: int


class PromptInfo(BaseModel):
    """Prompt/interaction information."""
    id: UUID
    session_id: UUID
    user_id: UUID
    input_text: str
    output_text: Optional[str]
    tokens_used: Optional[int]
    latency_ms: Optional[int]
    created_at: datetime


class SessionHistoryResponse(BaseModel):
    """Session history response."""
    session_id: UUID
    prompts: List[PromptInfo]
    total: int


class LLMProviderStatus(BaseModel):
    """Represents runtime health information for an LLM provider."""

    name: str
    healthy: bool
    enabled: bool
    supports_streaming: bool
    model: str
    last_error: Optional[str] = None
    cooling_down: bool = False


class HealthResponse(BaseModel):
    """Health check response."""
    model_config = {"protected_namespaces": ()}
    
    status: str
    service: str
    database: bool
    ollama: bool
    model_loaded: bool
    gpu_available: bool
    providers: List[LLMProviderStatus] = Field(default_factory=list, description="LLM provider health snapshots")



class DifficultyLevel(str, Enum):
    """Difficulty levels for lessons."""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class QuestionType(str, Enum):
    """Question types for assessments."""
    MCQ = "mcq"
    SHORT_ANSWER = "short_answer"
    TRUE_FALSE = "true_false"


class LessonMetadata(BaseModel):
    """Lesson metadata."""
    title: str = Field(..., description="Lesson title")
    outcomes: List[str] = Field(..., min_length=1, description="Learning outcomes")
    difficulty: DifficultyLevel = Field(..., description="Difficulty level")
    prerequisites: List[str] = Field(default_factory=list, description="Prerequisites")
    estimated_minutes: int = Field(..., ge=1, description="Estimated time in minutes")


class Concept(BaseModel):
    """A key concept to teach."""
    name: str = Field(..., description="Concept name")
    explanation: str = Field(..., description="Detailed explanation")
    example: str = Field(..., description="Concrete example")
    analogy: Optional[str] = Field(None, description="Optional analogy")


class TeachSection(BaseModel):
    """Teaching section with concepts and steps."""
    overview: str = Field(..., description="High-level overview")
    concepts: List[Concept] = Field(..., min_length=1, description="Key concepts")
    steps: List[str] = Field(..., min_length=1, description="Step-by-step instructions")
    visuals: List[str] = Field(default_factory=list, description="Visual aid descriptions")


class GuidedPracticeTask(BaseModel):
    """A guided practice task."""
    task: str = Field(..., description="Practice task description")
    hint: str = Field(..., description="Hint to help learner")
    solution: str = Field(..., description="Complete solution with explanation")


class AssessmentCheck(BaseModel):
    """An assessment check for understanding."""
    type: QuestionType = Field(..., description="Question type")
    question: str = Field(..., description="Question text")
    choices: Optional[List[str]] = Field(None, description="Answer choices for MCQ")
    answer: Union[int, str, bool] = Field(..., description="Correct answer")
    explanation: str = Field(..., description="Explanation of correct answer")


class Assessment(BaseModel):
    """Assessment section."""
    checks: List[AssessmentCheck] = Field(..., min_length=1, description="Checks for understanding")
    rubric: Optional[str] = Field(None, description="Assessment rubric")


class GlossaryTerm(BaseModel):
    """A glossary term definition."""
    term: str
    definition: str


class LessonArtifacts(BaseModel):
    """Generated artifacts for integration."""
    quiz_items: List[Dict[str, Any]] = Field(default_factory=list, description="Quiz items")
    notes_outline: List[Dict[str, Any]] = Field(default_factory=list, description="Notes outline")
    code_snippets: List[Dict[str, Any]] = Field(default_factory=list, description="Code snippets")
    glossary: List[GlossaryTerm] = Field(default_factory=list, description="Glossary terms")


class StructuredLesson(BaseModel):
    """Complete structured lesson with all sections."""
    metadata: LessonMetadata
    teach: TeachSection
    guided_practice: List[GuidedPracticeTask] = Field(..., min_length=1)
    assessment: Assessment
    summary: str = Field(..., description="Lesson summary and key takeaways")
    artifacts: LessonArtifacts = Field(default_factory=LessonArtifacts)


class LearnerProfile(BaseModel):
    """Learner profile for personalization."""
    xp: int = Field(default=0, description="Total XP")
    current_level: int = Field(default=1, ge=1, le=24, description="Current level")
    weak_topics: List[str] = Field(default_factory=list, description="Topics needing reinforcement")
    prior_lessons: List[str] = Field(default_factory=list, description="Completed lesson IDs")
    preferences: Dict[str, Any] = Field(default_factory=dict, description="Learning preferences")


class GenerationConstraints(BaseModel):
    """Constraints for lesson generation."""
    target_minutes: int = Field(default=30, ge=5, le=120, description="Target lesson duration")
    prereqs: List[str] = Field(default_factory=list, description="Required prerequisites")
    require_ethics_guardrails: bool = Field(default=True, description="Apply ethics guardrails")


class GenerateLessonRequest(BaseModel):
    """Request to generate a lesson."""
    lesson_summary: str = Field(..., min_length=10, description="Short lesson summary")
    level_number: int = Field(..., ge=1, le=24, description="Level number (1-24)")
    learner_profile: LearnerProfile = Field(default_factory=LearnerProfile)
    constraints: GenerationConstraints = Field(default_factory=GenerationConstraints)


class GenerateLessonResponse(BaseModel):
    """Response from lesson generation."""
    structured_lesson: StructuredLesson
    content_markdown: str = Field(..., description="Compiled markdown content")
    tokens_used: int = Field(..., ge=0, description="Tokens consumed")
    provider: str = Field(..., description="LLM provider used")
    latency_ms: int = Field(..., ge=0, description="Generation latency")
    version: int = Field(default=1, description="Content version")


class EducatorChatMessage(BaseModel):
    """Chat message for educator/tutor."""
    message: str = Field(..., min_length=1, max_length=4000, description="User message")
    lesson_id: UUID = Field(..., description="Lesson ID for context")
    session_id: Optional[UUID] = Field(None, description="Session ID to continue conversation")


class EducatorChatResponse(BaseModel):
    """Response from educator chat."""
    response: str
    session_id: UUID
    lesson_id: UUID
    tokens_used: int
    latency_ms: int
