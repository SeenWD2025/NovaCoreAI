"""Policy API router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models.schemas import (
    ValidateContentRequest,
    ValidateAlignmentRequest,
    CreatePolicyRequest,
    ValidationResponse,
    AlignmentResponse,
    PolicyResponse,
    PolicyAction
)
from app.services.policy_service import policy_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/policy", tags=["policy"])


@router.post("/validate", response_model=ValidationResponse)
async def validate_content(
    request: ValidateContentRequest,
    db: Session = Depends(get_db)
):
    """
    Validate content against constitutional policies.
    
    Checks for harmful, unethical, or misaligned content.
    Returns validation result with score and any violations.
    """
    try:
        result = policy_service.validate_content(
            request.content,
            request.context
        )
        
        # Log audit
        policy_service.log_audit(
            db,
            PolicyAction.VALIDATION_PASSED if result.passed else PolicyAction.VALIDATION_FAILED,
            {
                "content_length": len(request.content),
                "score": result.score,
                "violations_count": len(result.violations)
            },
            user_id=request.user_id
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(status_code=500, detail="Validation failed")


@router.post("/validate-alignment", response_model=AlignmentResponse)
async def validate_alignment(
    request: ValidateAlignmentRequest,
    db: Session = Depends(get_db)
):
    """
    Validate alignment with constitutional principles.
    
    Used by reflection engine to assess AI responses.
    Returns alignment score and principle-specific scores.
    """
    try:
        result = policy_service.validate_alignment(
            request.input_context,
            request.output_response,
            request.self_assessment
        )
        
        # Log audit
        policy_service.log_audit(
            db,
            PolicyAction.VALIDATION_PASSED if result.aligned else PolicyAction.VALIDATION_FAILED,
            {
                "alignment_score": result.alignment_score,
                "concerns_count": len(result.concerns)
            },
            user_id=request.user_id
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Alignment validation failed: {e}")
        raise HTTPException(status_code=500, detail="Alignment validation failed")


@router.post("/create", response_model=PolicyResponse)
async def create_policy(
    request: CreatePolicyRequest,
    db: Session = Depends(get_db)
):
    """
    Create a new policy.
    
    Policies are immutable once created (via cryptographic signature).
    Only admins should be able to create policies.
    """
    try:
        policy = policy_service.create_policy(
            db,
            request.policy_name,
            request.policy_content,
            request.description
        )
        
        if not policy:
            raise HTTPException(status_code=500, detail="Failed to create policy")
        
        # Log audit
        policy_service.log_audit(
            db,
            PolicyAction.POLICY_CREATED,
            {
                "policy_name": request.policy_name,
                "policy_id": policy.id
            },
            policy_id=policy.id
        )
        
        return policy
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Policy creation failed: {e}")
        raise HTTPException(status_code=500, detail="Policy creation failed")


@router.get("/active", response_model=list[PolicyResponse])
async def get_active_policies(db: Session = Depends(get_db)):
    """
    Get all active policies.
    
    Returns list of active policies with their rules and signatures.
    """
    try:
        policies = policy_service.get_active_policies(db)
        return policies
        
    except Exception as e:
        logger.error(f"Failed to get policies: {e}")
        raise HTTPException(status_code=500, detail="Failed to get policies")


@router.get("/principles")
async def get_principles():
    """
    Get constitutional principles.
    
    Returns the list of core principles used for validation.
    """
    from app.config import settings
    return {
        "principles": settings.principles,
        "count": len(settings.principles),
        "version": settings.policy_version
    }
