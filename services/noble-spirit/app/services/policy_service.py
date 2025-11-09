"""Policy validation service for constitutional AI."""
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
import uuid
import hashlib
import re
import logging

from app.models.schemas import (
    ValidationResult,
    ValidationResponse,
    AlignmentResponse,
    PolicyResponse,
    PolicyAction
)
from app.config import settings

logger = logging.getLogger(__name__)


class PolicyService:
    """Service for policy validation and management."""
    
    # Harmful content patterns (basic)
    HARMFUL_PATTERNS = [
        r'\b(kill|murder|harm|attack)\s+(people|someone|users)\b',
        r'\b(steal|hack|break\s+into)\b.*\b(data|information|account)\b',
        r'\b(create|make|build)\s+(virus|malware|exploit)\b',
        r'\b(illegal|unlawful)\s+(activity|action)\b',
    ]
    
    # Unethical patterns
    UNETHICAL_PATTERNS = [
        r'\b(lie|deceive|manipulate)\s+(users?|people)\b',
        r'\b(discriminate|bias)\s+against\b',
        r'\b(exploit|take\s+advantage)\s+of\b',
    ]
    
    def validate_content(
        self,
        content: str,
        context: Optional[str] = None
    ) -> ValidationResponse:
        """
        Validate content against constitutional policies.
        
        Args:
            content: Content to validate
            context: Optional context for validation
            
        Returns:
            Validation response with score and violations
        """
        try:
            violations = []
            warnings = []
            principles_checked = settings.principles.copy()
            
            # Check for harmful content
            for pattern in self.HARMFUL_PATTERNS:
                if re.search(pattern, content.lower()):
                    violations.append(f"Content matches harmful pattern: {pattern[:30]}...")
            
            # Check for unethical content
            for pattern in self.UNETHICAL_PATTERNS:
                if re.search(pattern, content.lower()):
                    warnings.append(f"Content may contain unethical elements: {pattern[:30]}...")
            
            # Calculate validation score
            total_checks = len(self.HARMFUL_PATTERNS) + len(self.UNETHICAL_PATTERNS)
            violation_weight = 1.0 / total_checks if total_checks > 0 else 0
            score = 1.0 - (len(violations) * violation_weight * 2) - (len(warnings) * violation_weight)
            score = max(0.0, min(1.0, score))
            
            # Determine result
            if len(violations) > 0:
                result = ValidationResult.FAILED
                passed = False
            elif len(warnings) > 0:
                result = ValidationResult.WARNING
                passed = True  # Warnings don't block, but flag for review
            else:
                result = ValidationResult.PASSED
                passed = True
            
            return ValidationResponse(
                result=result,
                score=score,
                passed=passed,
                violations=violations,
                warnings=warnings,
                principles_checked=principles_checked,
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Content validation failed: {e}")
            return ValidationResponse(
                result=ValidationResult.FAILED,
                score=0.0,
                passed=False,
                violations=[f"Validation error: {str(e)}"],
                warnings=[],
                principles_checked=[],
                timestamp=datetime.utcnow()
            )
    
    def validate_alignment(
        self,
        input_context: str,
        output_response: str,
        self_assessment: Optional[str] = None
    ) -> AlignmentResponse:
        """
        Validate alignment with constitutional principles.
        
        Args:
            input_context: User input
            output_response: AI response
            self_assessment: Optional self-assessment text
            
        Returns:
            Alignment response with scores per principle
        """
        try:
            # Validate both input and output
            input_validation = self.validate_content(input_context)
            output_validation = self.validate_content(output_response)
            
            # Calculate principle scores
            principle_scores = {}
            for principle in settings.principles:
                # Simple heuristic: average of input and output scores
                principle_scores[principle] = (input_validation.score + output_validation.score) / 2
            
            # Calculate overall alignment score
            alignment_score = sum(principle_scores.values()) / len(principle_scores)
            
            # Generate recommendations
            recommendations = []
            concerns = []
            
            if alignment_score < 0.7:
                concerns.append("Low alignment score - review response for ethical concerns")
            
            if input_validation.violations:
                concerns.extend([f"Input: {v}" for v in input_validation.violations])
            
            if output_validation.violations:
                concerns.extend([f"Output: {v}" for v in output_validation.violations])
            
            if input_validation.warnings:
                recommendations.append("Consider rephrasing input to avoid potential issues")
            
            if output_validation.warnings:
                recommendations.append("Review output for unethical elements")
            
            # Check self-assessment if provided
            if self_assessment:
                assessment_validation = self.validate_content(self_assessment)
                if assessment_validation.passed:
                    recommendations.append("Self-assessment shows good reflection")
                else:
                    concerns.append("Self-assessment may need improvement")
            
            aligned = alignment_score >= 0.7 and len(concerns) == 0
            
            return AlignmentResponse(
                aligned=aligned,
                alignment_score=alignment_score,
                principle_scores=principle_scores,
                recommendations=recommendations,
                concerns=concerns,
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Alignment validation failed: {e}")
            return AlignmentResponse(
                aligned=False,
                alignment_score=0.0,
                principle_scores={},
                recommendations=[],
                concerns=[f"Validation error: {str(e)}"],
                timestamp=datetime.utcnow()
            )
    
    def create_policy(
        self,
        db: Session,
        policy_name: str,
        policy_content: Dict[str, Any],
        description: Optional[str] = None
    ) -> Optional[PolicyResponse]:
        """
        Create a new policy.
        
        Args:
            db: Database session
            policy_name: Policy name
            policy_content: Policy rules/content
            description: Optional description
            
        Returns:
            Created policy or None on failure
        """
        try:
            import json
            
            policy_id = str(uuid.uuid4())
            
            # Generate cryptographic signature
            content_str = json.dumps(policy_content, sort_keys=True)
            signature = hashlib.sha256(content_str.encode()).hexdigest()
            
            # Insert policy
            query = text("""
                INSERT INTO policies (
                    id, version, policy_name, policy_content, is_active, signature, created_at
                ) VALUES (
                    :id, :version, :policy_name, :policy_content::jsonb, :is_active, :signature, :created_at
                )
            """)
            
            db.execute(query, {
                "id": policy_id,
                "version": settings.policy_version,
                "policy_name": policy_name,
                "policy_content": json.dumps(policy_content),
                "is_active": True,
                "signature": signature,
                "created_at": datetime.utcnow()
            })
            
            db.commit()
            
            return PolicyResponse(
                id=policy_id,
                version=settings.policy_version,
                policy_name=policy_name,
                policy_content=policy_content,
                is_active=True,
                signature=signature,
                created_at=datetime.utcnow()
            )
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create policy: {e}")
            return None
    
    def log_audit(
        self,
        db: Session,
        action: PolicyAction,
        context: Dict[str, Any],
        policy_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Log a policy audit event.
        
        Args:
            db: Database session
            action: Policy action
            context: Action context
            policy_id: Optional policy ID
            user_id: Optional user ID
            
        Returns:
            True if logged successfully, False otherwise
        """
        try:
            import json
            
            audit_id = str(uuid.uuid4())
            
            query = text("""
                INSERT INTO policy_audit_log (
                    id, policy_id, user_id, action, context, created_at
                ) VALUES (
                    :id, :policy_id, :user_id, :action, :context::jsonb, :created_at
                )
            """)
            
            db.execute(query, {
                "id": audit_id,
                "policy_id": policy_id,
                "user_id": user_id,
                "action": action.value,
                "context": json.dumps(context),
                "created_at": datetime.utcnow()
            })
            
            db.commit()
            
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to log audit: {e}")
            return False
    
    def get_active_policies(
        self,
        db: Session
    ) -> List[PolicyResponse]:
        """
        Get all active policies.
        
        Args:
            db: Database session
            
        Returns:
            List of active policies
        """
        try:
            query = text("""
                SELECT id, version, policy_name, policy_content, is_active, signature, created_at
                FROM policies
                WHERE is_active = true
                ORDER BY created_at DESC
            """)
            
            results = db.execute(query).fetchall()
            
            import json
            policies = []
            for row in results:
                policies.append(PolicyResponse(
                    id=str(row[0]),
                    version=row[1],
                    policy_name=row[2],
                    policy_content=json.loads(row[3]) if isinstance(row[3], str) else row[3],
                    is_active=row[4],
                    signature=row[5],
                    created_at=row[6]
                ))
            
            return policies
            
        except Exception as e:
            logger.error(f"Failed to get active policies: {e}")
            return []


# Global instance
policy_service = PolicyService()
