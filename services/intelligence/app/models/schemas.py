"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


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
