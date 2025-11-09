"""Usage tracking service for memory storage."""
import logging
from typing import Dict, Any, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import json

from app.utils.storage_calculator import storage_calculator

logger = logging.getLogger(__name__)


class UsageService:
    """Service for tracking and enforcing memory storage usage."""
    
    @staticmethod
    def get_user_storage_usage(db: Session, user_id: str) -> Dict[str, Any]:
        """
        Get current storage usage for a user.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Dictionary with usage statistics
        """
        try:
            # Get total from usage_ledger
            query = text("""
                SELECT COALESCE(SUM(amount), 0) as total_bytes
                FROM usage_ledger
                WHERE user_id = :user_id
                AND resource_type = 'memory_storage'
            """)
            
            result = db.execute(query, {"user_id": user_id})
            row = result.fetchone()
            total_bytes = row[0] if row else 0
            
            # Get memory count by tier
            tier_query = text("""
                SELECT tier, COUNT(*) as count
                FROM memories
                WHERE user_id = :user_id
                AND (expires_at IS NULL OR expires_at > NOW())
                GROUP BY tier
            """)
            
            tier_result = db.execute(tier_query, {"user_id": user_id})
            tier_counts = {row[0]: row[1] for row in tier_result}
            
            return {
                "user_id": user_id,
                "total_bytes": int(total_bytes),
                "total_human_readable": storage_calculator.bytes_to_human_readable(int(total_bytes)),
                "memory_count": {
                    "stm": tier_counts.get("stm", 0),
                    "itm": tier_counts.get("itm", 0),
                    "ltm": tier_counts.get("ltm", 0),
                    "total": sum(tier_counts.values())
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting storage usage: {e}")
            return {
                "user_id": user_id,
                "total_bytes": 0,
                "total_human_readable": "0 B",
                "memory_count": {"stm": 0, "itm": 0, "ltm": 0, "total": 0},
                "error": str(e)
            }
    
    @staticmethod
    def record_storage_usage(
        db: Session,
        user_id: str,
        memory_id: str,
        size_bytes: int,
        operation: str = "create",
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Record storage usage in the usage ledger.
        
        Args:
            db: Database session
            user_id: User ID
            memory_id: Memory ID
            size_bytes: Storage size in bytes
            operation: Operation type (create, update, delete)
            metadata: Additional metadata
            
        Returns:
            Ledger entry ID
        """
        try:
            ledger_id = str(uuid.uuid4())
            
            # For delete operations, record negative amount
            if operation == "delete":
                size_bytes = -abs(size_bytes)
            
            usage_metadata = {
                "memory_id": memory_id,
                "operation": operation,
                **(metadata or {})
            }
            
            query = text("""
                INSERT INTO usage_ledger (
                    id, user_id, resource_type, amount, metadata, timestamp
                )
                VALUES (
                    :id, :user_id, 'memory_storage', :amount, :metadata::jsonb, NOW()
                )
                RETURNING id
            """)
            
            result = db.execute(query, {
                "id": ledger_id,
                "user_id": user_id,
                "amount": size_bytes,
                "metadata": json.dumps(usage_metadata)
            })
            
            db.commit()
            
            logger.info(
                f"Recorded {operation} storage usage: {size_bytes} bytes "
                f"for user {user_id}, memory {memory_id}"
            )
            
            return ledger_id
            
        except Exception as e:
            logger.error(f"Error recording storage usage: {e}")
            db.rollback()
            raise
    
    @staticmethod
    def check_storage_quota(
        db: Session,
        user_id: str,
        additional_bytes: int,
        tier: str
    ) -> tuple[bool, str]:
        """
        Check if user has enough storage quota.
        
        Args:
            db: Database session
            user_id: User ID
            additional_bytes: Additional storage needed
            tier: Subscription tier
            
        Returns:
            Tuple of (has_quota, message)
        """
        try:
            # Get current usage
            usage = UsageService.get_user_storage_usage(db, user_id)
            current_bytes = usage.get("total_bytes", 0)
            
            # Check quota
            has_quota, message = storage_calculator.check_quota_available(
                current_bytes,
                additional_bytes,
                tier
            )
            
            return has_quota, message
            
        except Exception as e:
            logger.error(f"Error checking storage quota: {e}")
            # Fail open in case of errors to avoid blocking operations
            return True, f"Warning: Could not verify quota - {str(e)}"
    
    @staticmethod
    def get_storage_stats_by_tier(db: Session, user_id: str) -> Dict[str, Any]:
        """
        Get detailed storage statistics by tier.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Dictionary with tier-specific statistics
        """
        try:
            query = text("""
                SELECT 
                    tier,
                    COUNT(*) as memory_count,
                    AVG(LENGTH(input_context) + COALESCE(LENGTH(output_response), 0)) as avg_text_size,
                    SUM(LENGTH(input_context) + COALESCE(LENGTH(output_response), 0)) as total_text_size
                FROM memories
                WHERE user_id = :user_id
                AND (expires_at IS NULL OR expires_at > NOW())
                GROUP BY tier
            """)
            
            result = db.execute(query, {"user_id": user_id})
            
            stats = {}
            for row in result:
                tier = row[0]
                stats[tier] = {
                    "memory_count": row[1],
                    "avg_text_size": int(row[2] or 0),
                    "total_text_size": int(row[3] or 0),
                    "total_text_human": storage_calculator.bytes_to_human_readable(int(row[3] or 0))
                }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting tier statistics: {e}")
            return {}


# Singleton instance
usage_service = UsageService()
