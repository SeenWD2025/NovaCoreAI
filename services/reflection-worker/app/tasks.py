"""Celery tasks for reflection processing."""
import httpx
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import uuid
import os

from app.celery_app import celery_app
from app.config import settings
from app.utils.service_auth import generate_service_token

logger = logging.getLogger(__name__)

# Generate service token for reflection worker
SERVICE_TOKEN = None
try:
    if os.getenv("SERVICE_JWT_SECRET"):
        SERVICE_TOKEN = generate_service_token("reflection-worker")
        logger.info("Reflection worker service token generated")
    else:
        logger.warning("SERVICE_JWT_SECRET not set. Service-to-service auth disabled.")
except Exception as e:
    logger.error(f"Failed to generate service token: {e}")


@celery_app.task(name="reflect_on_interaction", bind=True, max_retries=3)
def reflect_on_interaction(
    self,
    user_id: str,
    session_id: str,
    input_text: str,
    output_text: str,
    context: Optional[Dict[str, Any]] = None
):
    """
    Perform reflection on an interaction between user and AI.
    
    This task:
    1. Validates alignment with Noble-Spirit Policy
    2. Generates self-assessment based on 3 key questions
    3. Calculates alignment score
    4. Stores reflection in Memory Service
    
    Args:
        user_id: User ID
        session_id: Session ID
        input_text: User's input
        output_text: AI's response
        context: Optional additional context
    """
    try:
        logger.info(f"Starting reflection for session {session_id}, user {user_id}")
        
        # Step 1: Validate alignment with Noble-Spirit Policy
        alignment = validate_alignment_with_policy(input_text, output_text)
        
        if not alignment:
            logger.error("Failed to validate alignment with policy")
            return {"success": False, "error": "Policy validation failed"}
        
        # Step 2: Generate self-assessment
        self_assessment = generate_self_assessment(input_text, output_text, alignment)
        
        # Step 3: Calculate alignment score
        alignment_score = alignment.get("alignment_score", 0.0)
        
        # Step 4: Determine if aligned
        aligned = alignment.get("aligned", False)
        
        # Step 5: Extract improvement notes
        improvement_notes = "\n".join(alignment.get("recommendations", []))
        if alignment.get("concerns"):
            improvement_notes += "\nConcerns: " + "\n".join(alignment.get("concerns", []))
        
        # Step 6: Store reflection in Memory Service
        reflection_stored = store_reflection(
            user_id=user_id,
            session_id=session_id,
            self_assessment=self_assessment,
            alignment_score=alignment_score,
            improvement_notes=improvement_notes,
            metadata={
                "aligned": aligned,
                "principle_scores": alignment.get("principle_scores", {}),
                "input_length": len(input_text),
                "output_length": len(output_text),
                "context": context or {}
            }
        )
        
        if not reflection_stored:
            logger.error("Failed to store reflection")
            return {"success": False, "error": "Failed to store reflection"}
        
        logger.info(f"Reflection completed for session {session_id}")
        
        return {
            "success": True,
            "session_id": session_id,
            "user_id": user_id,
            "alignment_score": alignment_score,
            "aligned": aligned,
            "reflection_id": reflection_stored.get("id")
        }
        
    except Exception as e:
        logger.error(f"Reflection task failed: {e}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=2 ** self.request.retries)


def validate_alignment_with_policy(
    input_text: str,
    output_text: str
) -> Optional[Dict[str, Any]]:
    """
    Validate alignment with Noble-Spirit Policy.
    
    Args:
        input_text: User input
        output_text: AI response
        
    Returns:
        Alignment validation result or None on failure
    """
    try:
        headers = {}
        if SERVICE_TOKEN:
            headers["X-Service-Token"] = SERVICE_TOKEN
            
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{settings.policy_service_url}/policy/validate-alignment",
                json={
                    "input_context": input_text,
                    "output_response": output_text
                },
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Policy validation failed: {response.status_code}")
                return None
                
    except Exception as e:
        logger.error(f"Failed to validate with policy service: {e}")
        return None


def generate_self_assessment(
    input_text: str,
    output_text: str,
    alignment: Dict[str, Any]
) -> str:
    """
    Generate self-assessment based on 3 key reflection questions.
    
    Args:
        input_text: User input
        output_text: AI response
        alignment: Alignment validation result
        
    Returns:
        Self-assessment text
    """
    questions = settings.reflection_questions
    
    # Build self-assessment
    assessment_parts = []
    
    # Question 1: What did I attempt?
    assessment_parts.append(f"Q1: {questions[0]}")
    assessment_parts.append(f"A1: I attempted to respond to: '{input_text[:100]}...' by providing: '{output_text[:100]}...'")
    assessment_parts.append("")
    
    # Question 2: Was I aligned?
    assessment_parts.append(f"Q2: {questions[1]}")
    aligned = alignment.get("aligned", False)
    alignment_score = alignment.get("alignment_score", 0.0)
    assessment_parts.append(
        f"A2: {'Yes' if aligned else 'No'}, with an alignment score of {alignment_score:.2f}. "
        f"Principle scores: {alignment.get('principle_scores', {})}"
    )
    assessment_parts.append("")
    
    # Question 3: How could I improve?
    assessment_parts.append(f"Q3: {questions[2]}")
    recommendations = alignment.get("recommendations", [])
    concerns = alignment.get("concerns", [])
    
    if recommendations:
        assessment_parts.append(f"A3: Recommendations: {'; '.join(recommendations)}")
    if concerns:
        assessment_parts.append(f"    Concerns: {'; '.join(concerns)}")
    if not recommendations and not concerns:
        assessment_parts.append("A3: No specific improvements identified. Continue current approach.")
    
    return "\n".join(assessment_parts)


def store_reflection(
    user_id: str,
    session_id: str,
    self_assessment: str,
    alignment_score: float,
    improvement_notes: str,
    metadata: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Store reflection in Memory Service as a special memory type.
    
    Args:
        user_id: User ID
        session_id: Session ID
        self_assessment: Self-assessment text
        alignment_score: Alignment score
        improvement_notes: Improvement suggestions
        metadata: Additional metadata
        
    Returns:
        Stored memory object or None on failure
    """
    try:
        # Store as a memory with type "reflection"
        headers = {"X-User-Id": user_id}
        if SERVICE_TOKEN:
            headers["X-Service-Token"] = SERVICE_TOKEN
            
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{settings.memory_service_url}/memory/store",
                headers=headers,
                json={
                    "session_id": session_id,
                    "type": "reflection",
                    "input_context": "Reflection on interaction",
                    "output_response": self_assessment,
                    "outcome": "success" if alignment_score >= 0.7 else "neutral",
                    "confidence_score": alignment_score,
                    "tags": ["reflection", "self-assessment", "alignment"],
                    "tier": "ltm"  # Reflections go directly to LTM
                }
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to store reflection: {response.status_code}")
                return None
                
    except Exception as e:
        logger.error(f"Failed to store reflection in memory service: {e}")
        return None


@celery_app.task(name="batch_reflect", bind=True)
def batch_reflect(self, sessions: list):
    """
    Batch reflection processing for multiple sessions.
    
    Args:
        sessions: List of session data dictionaries
    """
    results = []
    
    for session_data in sessions:
        try:
            result = reflect_on_interaction.delay(
                user_id=session_data["user_id"],
                session_id=session_data["session_id"],
                input_text=session_data["input_text"],
                output_text=session_data["output_text"],
                context=session_data.get("context")
            )
            results.append({"session_id": session_data["session_id"], "task_id": result.id})
        except Exception as e:
            logger.error(f"Failed to queue reflection for session {session_data.get('session_id')}: {e}")
            results.append({"session_id": session_data.get("session_id"), "error": str(e)})
    
    return {"batch_size": len(sessions), "results": results}


@celery_app.task(name="health_check")
def health_check():
    """Health check task to verify worker is running."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "worker": "reflection-worker"
    }
