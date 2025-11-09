"""Pydantic models for Memory service."""
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class MemoryTier(str, Enum):
    """Memory tier enumeration."""
    STM = "stm"
    ITM = "itm"
    LTM = "ltm"


class MemoryType(str, Enum):
    """Memory type enumeration."""
    LESSON = "lesson"
    TASK = "task"
    CONVERSATION = "conversation"
    ERROR = "error"
    REFLECTION = "reflection"
    ACHIEVEMENT = "achievement"


class Outcome(str, Enum):
    """Outcome enumeration."""
    SUCCESS = "success"
    FAILURE = "failure"
    NEUTRAL = "neutral"


# Request Models

class StoreMemoryRequest(BaseModel):
    """Request to store a new memory."""
    session_id: Optional[str] = None
    type: MemoryType
    input_context: str
    output_response: Optional[str] = None
    outcome: Outcome = Outcome.NEUTRAL
    emotional_weight: Optional[float] = Field(None, ge=-1, le=1)
    confidence_score: Optional[float] = Field(None, ge=0, le=1)
    tags: Optional[List[str]] = []
    tier: MemoryTier = MemoryTier.STM
    
    @validator("emotional_weight")
    def validate_emotional_weight(cls, v):
        if v is not None and (v < -1 or v > 1):
            raise ValueError("emotional_weight must be between -1 and 1")
        return v
    
    @validator("confidence_score")
    def validate_confidence_score(cls, v):
        if v is not None and (v < 0 or v > 1):
            raise ValueError("confidence_score must be between 0 and 1")
        return v


class SearchMemoriesRequest(BaseModel):
    """Request to search memories."""
    query: str
    limit: int = Field(10, ge=1, le=100)
    tier: Optional[MemoryTier] = None
    memory_type: Optional[MemoryType] = None
    min_confidence: Optional[float] = Field(None, ge=0, le=1)


class UpdateMemoryRequest(BaseModel):
    """Request to update a memory."""
    outcome: Optional[Outcome] = None
    emotional_weight: Optional[float] = Field(None, ge=-1, le=1)
    confidence_score: Optional[float] = Field(None, ge=0, le=1)
    tags: Optional[List[str]] = None
    tier: Optional[MemoryTier] = None


class PromoteMemoryRequest(BaseModel):
    """Request to promote a memory to a higher tier."""
    target_tier: MemoryTier


# Response Models

class MemoryResponse(BaseModel):
    """Memory object response."""
    id: str
    user_id: str
    session_id: Optional[str]
    type: str
    input_context: str
    output_response: Optional[str]
    outcome: str
    emotional_weight: Optional[float]
    confidence_score: Optional[float]
    constitution_valid: bool
    tags: List[str]
    tier: str
    access_count: int
    last_accessed_at: Optional[datetime]
    created_at: datetime
    expires_at: Optional[datetime]
    similarity_score: Optional[float] = None  # For search results


class MemoriesListResponse(BaseModel):
    """Response for listing memories."""
    memories: List[MemoryResponse]
    total: int
    tier: Optional[str] = None


class SearchResultsResponse(BaseModel):
    """Response for search queries."""
    results: List[MemoryResponse]
    total: int
    query: str


class MemoryStatsResponse(BaseModel):
    """Memory statistics response."""
    user_id: str
    stm_count: int
    itm_count: int
    ltm_count: int
    total_memories: int
    storage_used_mb: float
    storage_limit_mb: float
    tier_breakdown: Dict[str, int]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    database: bool
    redis_stm: bool
    redis_itm: bool
    embedding_model: str
    timestamp: datetime


# STM/ITM Specific Models

class STMInteraction(BaseModel):
    """Short-Term Memory interaction."""
    input: str
    output: Optional[str]
    timestamp: datetime
    tokens: Optional[int] = None


class ITMReference(BaseModel):
    """Intermediate-Term Memory reference."""
    memory_id: str
    access_count: int
    type: str
    summary: Optional[str] = None


class UsageStatsResponse(BaseModel):
    """Detailed usage statistics response."""
    user_id: str
    storage: Dict[str, Any]
    memory_counts: Dict[str, int]
    tier_stats: Dict[str, Any]
    timestamp: str


class QuotaCheckResponse(BaseModel):
    """Quota check response."""
    has_quota: bool
    message: str
    current_usage: str
    limit: str
    percentage_used: float
