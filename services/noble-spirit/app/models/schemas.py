"""Pydantic models for Noble-Spirit Policy service."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ValidationResult(str, Enum):
    """Validation result enumeration."""
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"


class PolicyAction(str, Enum):
    """Policy action enumeration."""
    VALIDATION_PASSED = "validation_passed"
    VALIDATION_FAILED = "validation_failed"
    OVERRIDE_ATTEMPTED = "override_attempted"
    POLICY_CREATED = "policy_created"
    POLICY_UPDATED = "policy_updated"


# Request Models

class ValidateContentRequest(BaseModel):
    """Request to validate content against policies."""
    content: str
    context: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None


class ValidateAlignmentRequest(BaseModel):
    """Request to validate alignment with constitutional principles."""
    input_context: str
    output_response: str
    self_assessment: Optional[str] = None
    user_id: Optional[str] = None


class CreatePolicyRequest(BaseModel):
    """Request to create a new policy."""
    policy_name: str
    policy_content: Dict[str, Any]
    description: Optional[str] = None


# Response Models

class ValidationResponse(BaseModel):
    """Response for content validation."""
    result: ValidationResult
    score: float = Field(ge=0, le=1)
    passed: bool
    violations: List[str] = []
    warnings: List[str] = []
    principles_checked: List[str] = []
    timestamp: datetime


class AlignmentResponse(BaseModel):
    """Response for alignment validation."""
    aligned: bool
    alignment_score: float = Field(ge=0, le=1)
    principle_scores: Dict[str, float]
    recommendations: List[str] = []
    concerns: List[str] = []
    timestamp: datetime


class PolicyResponse(BaseModel):
    """Policy object response."""
    id: str
    version: int
    policy_name: str
    policy_content: Dict[str, Any]
    is_active: bool
    signature: Optional[str]
    created_at: datetime


class PolicyAuditResponse(BaseModel):
    """Policy audit log entry."""
    id: str
    policy_id: Optional[str]
    user_id: Optional[str]
    action: str
    context: Dict[str, Any]
    created_at: datetime


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    database: bool
    active_policies: int
    policy_version: int
    timestamp: datetime
