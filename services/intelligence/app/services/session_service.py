"""Session management service."""
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID, uuid4
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class SessionService:
    """Service for managing chat sessions and prompts."""
    
    @staticmethod
    def create_session(db: Session, user_id: UUID, model_name: str) -> UUID:
        """Create a new chat session."""
        session_id = uuid4()
        query = text("""
            INSERT INTO sessions (id, user_id, status, model_name, created_at)
            VALUES (:id, :user_id, :status, :model_name, NOW())
            RETURNING id
        """)
        result = db.execute(
            query,
            {
                "id": str(session_id),
                "user_id": str(user_id),
                "status": "active",
                "model_name": model_name
            }
        )
        db.commit()
        return session_id
    
    @staticmethod
    def get_session(db: Session, session_id: UUID) -> Optional[Dict[str, Any]]:
        """Get session by ID."""
        query = text("""
            SELECT id, user_id, status, model_name, created_at, ended_at
            FROM sessions
            WHERE id = :session_id
        """)
        result = db.execute(query, {"session_id": str(session_id)})
        row = result.fetchone()
        
        if row:
            return {
                "id": row[0],
                "user_id": row[1],
                "status": row[2],
                "model_name": row[3],
                "created_at": row[4],
                "ended_at": row[5]
            }
        return None
    
    @staticmethod
    def get_user_sessions(db: Session, user_id: UUID, limit: int = 50) -> List[Dict[str, Any]]:
        """Get all sessions for a user."""
        query = text("""
            SELECT id, user_id, status, model_name, created_at, ended_at
            FROM sessions
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT :limit
        """)
        result = db.execute(query, {"user_id": str(user_id), "limit": limit})
        
        sessions = []
        for row in result:
            sessions.append({
                "id": row[0],
                "user_id": row[1],
                "status": row[2],
                "model_name": row[3],
                "created_at": row[4],
                "ended_at": row[5]
            })
        return sessions
    
    @staticmethod
    def end_session(db: Session, session_id: UUID) -> bool:
        """Mark a session as completed."""
        query = text("""
            UPDATE sessions
            SET status = 'completed', ended_at = NOW()
            WHERE id = :session_id
        """)
        db.execute(query, {"session_id": str(session_id)})
        db.commit()
        return True
    
    @staticmethod
    def store_prompt(
        db: Session,
        session_id: UUID,
        user_id: UUID,
        input_text: str,
        output_text: str,
        tokens_used: int,
        latency_ms: int
    ) -> UUID:
        """Store a prompt/response pair."""
        prompt_id = uuid4()
        query = text("""
            INSERT INTO prompts (id, session_id, user_id, input_text, output_text, tokens_used, latency_ms, created_at)
            VALUES (:id, :session_id, :user_id, :input_text, :output_text, :tokens_used, :latency_ms, NOW())
            RETURNING id
        """)
        result = db.execute(
            query,
            {
                "id": str(prompt_id),
                "session_id": str(session_id),
                "user_id": str(user_id),
                "input_text": input_text,
                "output_text": output_text,
                "tokens_used": tokens_used,
                "latency_ms": latency_ms
            }
        )
        db.commit()
        return prompt_id
    
    @staticmethod
    def get_session_history(db: Session, session_id: UUID, limit: int = 100) -> List[Dict[str, Any]]:
        """Get conversation history for a session."""
        query = text("""
            SELECT id, session_id, user_id, input_text, output_text, tokens_used, latency_ms, created_at
            FROM prompts
            WHERE session_id = :session_id
            ORDER BY created_at ASC
            LIMIT :limit
        """)
        result = db.execute(query, {"session_id": str(session_id), "limit": limit})
        
        prompts = []
        for row in result:
            prompts.append({
                "id": row[0],
                "session_id": row[1],
                "user_id": row[2],
                "input_text": row[3],
                "output_text": row[4],
                "tokens_used": row[5],
                "latency_ms": row[6],
                "created_at": row[7]
            })
        return prompts
    
    @staticmethod
    def get_user_token_usage_today(db: Session, user_id: UUID) -> int:
        """
        Get total tokens used by user today from usage_ledger.
        Falls back to prompts table if ledger is empty.
        """
        # Try usage_ledger first (more accurate)
        query = text("""
            SELECT COALESCE(SUM(amount), 0) as total
            FROM usage_ledger
            WHERE user_id = :user_id
            AND resource_type = 'llm_tokens'
            AND timestamp >= CURRENT_DATE
        """)
        result = db.execute(query, {"user_id": str(user_id)})
        row = result.fetchone()
        total = row[0] if row else 0
        
        # Fallback to prompts table if no ledger entries
        if total == 0:
            query = text("""
                SELECT COALESCE(SUM(tokens_used), 0) as total
                FROM prompts
                WHERE user_id = :user_id
                AND created_at >= CURRENT_DATE
            """)
            result = db.execute(query, {"user_id": str(user_id)})
            row = result.fetchone()
            total = row[0] if row else 0
        
        return total
    
    @staticmethod
    def record_usage_ledger(
        db: Session,
        user_id: UUID,
        resource_type: str,
        amount: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> UUID:
        """
        Record usage in the usage_ledger table for billing and quota tracking.
        
        Args:
            db: Database session
            user_id: User ID
            resource_type: Type of resource (e.g., 'llm_tokens', 'memory_storage')
            amount: Amount consumed
            metadata: Optional metadata about the usage
            
        Returns:
            Usage ledger entry ID
        """
        import json
        
        ledger_id = uuid4()
        query = text("""
            INSERT INTO usage_ledger (id, user_id, resource_type, amount, metadata, timestamp)
            VALUES (:id, :user_id, :resource_type, :amount, :metadata::jsonb, NOW())
            RETURNING id
        """)
        
        result = db.execute(
            query,
            {
                "id": str(ledger_id),
                "user_id": str(user_id),
                "resource_type": resource_type,
                "amount": amount,
                "metadata": json.dumps(metadata) if metadata else None
            }
        )
        db.commit()
        
        logger.info(f"Recorded usage: {resource_type}={amount} for user {user_id}")
        
        return ledger_id
