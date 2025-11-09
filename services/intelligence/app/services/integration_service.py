"""Integration service for Memory and Reflection services."""
import httpx
import logging
from typing import Dict, Any, Optional, List
from uuid import UUID
from celery import Celery

from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Celery for reflection tasks
celery_app = None
if settings.enable_reflection:
    try:
        celery_app = Celery(broker=settings.celery_broker_url)
        logger.info("Celery initialized for reflection tasks")
    except Exception as e:
        logger.error(f"Failed to initialize Celery: {e}")
        celery_app = None


class IntegrationService:
    """Service for integrating with Memory and Reflection services."""
    
    @staticmethod
    async def get_memory_context(
        user_id: UUID,
        session_id: Optional[UUID] = None,
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Retrieve memory context from Memory Service.
        
        Args:
            user_id: User ID
            session_id: Optional session ID for STM
            limit: Max items per tier
            
        Returns:
            Dictionary with stm, itm, and ltm context
        """
        try:
            params = {"limit": limit}
            if session_id:
                params["session_id"] = str(session_id)
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{settings.memory_service_url}/memory/context",
                    params=params,
                    headers={"X-User-Id": str(user_id)}
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(f"Memory service returned {response.status_code}")
                    return {"stm": [], "itm": [], "ltm": []}
                    
        except Exception as e:
            logger.error(f"Failed to get memory context: {e}")
            return {"stm": [], "itm": [], "ltm": []}
    
    @staticmethod
    def build_context_prompt(memory_context: Dict[str, Any]) -> str:
        """
        Build a context prompt from memory data.
        
        Args:
            memory_context: Dictionary with stm, itm, ltm
            
        Returns:
            Formatted context string
        """
        context_parts = []
        
        # Add LTM context (high-confidence permanent knowledge)
        ltm = memory_context.get("ltm", [])
        if ltm:
            context_parts.append("# Relevant Knowledge:")
            for memory in ltm[:3]:  # Top 3 LTM
                if isinstance(memory, dict):
                    context_parts.append(f"- {memory.get('input', '')[:150]}")
        
        # Add ITM context (frequently accessed recent memories)
        itm = memory_context.get("itm", [])
        if itm:
            context_parts.append("\n# Recent Patterns:")
            for memory in itm[:2]:  # Top 2 ITM
                if isinstance(memory, dict):
                    context_parts.append(f"- {memory.get('input', '')[:150]}")
        
        # Add STM context (conversation history)
        stm = memory_context.get("stm", [])
        if stm:
            context_parts.append("\n# Recent Conversation:")
            for interaction in stm[-3:]:  # Last 3 STM
                if isinstance(interaction, dict):
                    inp = interaction.get("input", "")
                    out = interaction.get("output", "")
                    if inp:
                        context_parts.append(f"User: {inp[:100]}")
                    if out:
                        context_parts.append(f"Assistant: {out[:100]}")
        
        if context_parts:
            return "\n".join(context_parts) + "\n\n"
        return ""
    
    @staticmethod
    async def store_stm_interaction(
        user_id: UUID,
        session_id: UUID,
        input_text: str,
        output_text: str,
        tokens: Optional[int] = None
    ) -> bool:
        """
        Store interaction in Short-Term Memory.
        
        Args:
            user_id: User ID
            session_id: Session ID
            input_text: User input
            output_text: AI response
            tokens: Token count
            
        Returns:
            True if stored successfully
        """
        try:
            from datetime import datetime
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    f"{settings.memory_service_url}/memory/stm/store",
                    params={"session_id": str(session_id)},
                    headers={"X-User-Id": str(user_id)},
                    json={
                        "input": input_text,
                        "output": output_text,
                        "timestamp": datetime.utcnow().isoformat(),
                        "tokens": tokens
                    }
                )
                
                return response.status_code == 200
                
        except Exception as e:
            logger.error(f"Failed to store STM interaction: {e}")
            return False
    
    @staticmethod
    def trigger_reflection(
        user_id: UUID,
        session_id: UUID,
        input_text: str,
        output_text: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Trigger asynchronous reflection task.
        
        Args:
            user_id: User ID
            session_id: Session ID
            input_text: User input
            output_text: AI response
            context: Optional additional context
            
        Returns:
            True if task was queued
        """
        if not settings.enable_reflection or not celery_app:
            logger.debug("Reflection disabled or Celery not available")
            return False
        
        try:
            # Enqueue reflection task
            celery_app.send_task(
                "reflect_on_interaction",
                args=[
                    str(user_id),
                    str(session_id),
                    input_text,
                    output_text,
                    context
                ]
            )
            logger.info(f"Reflection task queued for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to trigger reflection: {e}")
            return False


# Global instance
integration_service = IntegrationService()
