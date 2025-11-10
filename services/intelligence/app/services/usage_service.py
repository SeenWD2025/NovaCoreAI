"""
Usage Service for tracking and enforcing quota limits.
Handles usage_ledger table operations for billing and quota management.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID

logger = logging.getLogger(__name__)


class UsageService:
    """Service for managing usage tracking and quota enforcement."""
    
    @staticmethod
    def record_usage(
        db: Session,
        user_id: UUID,
        resource_type: str,
        amount: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Record usage in the usage_ledger table.
        
        Args:
            db: Database session
            user_id: User UUID
            resource_type: Type of resource (e.g., 'llm_tokens', 'messages')
            amount: Amount to record
            metadata: Optional metadata dict
            
        Returns:
            True if successful, False otherwise
        """
        try:
            query = text("""
                INSERT INTO usage_ledger (user_id, resource_type, amount, metadata, timestamp)
                VALUES (:user_id, :resource_type, :amount, :metadata, :timestamp)
            """)
            
            db.execute(
                query,
                {
                    "user_id": str(user_id),
                    "resource_type": resource_type,
                    "amount": amount,
                    "metadata": metadata,
                    "timestamp": datetime.utcnow()
                }
            )
            db.commit()
            
            logger.info(f"Recorded usage: user={user_id}, type={resource_type}, amount={amount}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to record usage: {e}")
            db.rollback()
            return False
    
    @staticmethod
    def get_today_usage(
        db: Session,
        user_id: UUID,
        resource_type: str
    ) -> int:
        """
        Get total usage for today (UTC) for a specific resource type.
        
        Args:
            db: Database session
            user_id: User UUID
            resource_type: Type of resource
            
        Returns:
            Total usage amount for today
        """
        try:
            # Get start of today in UTC
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            
            query = text("""
                SELECT COALESCE(SUM(amount), 0) as total
                FROM usage_ledger
                WHERE user_id = :user_id
                  AND resource_type = :resource_type
                  AND timestamp >= :today_start
            """)
            
            result = db.execute(
                query,
                {
                    "user_id": str(user_id),
                    "resource_type": resource_type,
                    "today_start": today_start
                }
            ).fetchone()
            
            return int(result[0]) if result else 0
            
        except Exception as e:
            logger.error(f"Failed to get today's usage: {e}")
            return 0
    
    @staticmethod
    def check_quota(
        db: Session,
        user_id: UUID,
        tier: str,
        resource_type: str,
        requested_amount: int
    ) -> tuple[bool, str]:
        """
        Check if user has enough quota remaining for the requested amount.
        
        Args:
            db: Database session
            user_id: User UUID
            tier: Subscription tier ('free_trial', 'basic', 'pro')
            resource_type: Type of resource
            requested_amount: Amount being requested
            
        Returns:
            Tuple of (has_quota: bool, message: str)
        """
        # Define tier limits
        TIER_LIMITS = {
            'free_trial': {
                'llm_tokens': 1000,
                'messages': 100
            },
            'basic': {
                'llm_tokens': 50000,
                'messages': 5000
            },
            'pro': {
                'llm_tokens': -1,  # Unlimited
                'messages': -1     # Unlimited
            }
        }
        
        # Get limit for this tier and resource type
        limit = TIER_LIMITS.get(tier, {}).get(resource_type, 0)
        
        # Pro tier has unlimited quota
        if limit == -1:
            return True, "Unlimited quota"
        
        # Get current usage
        current_usage = UsageService.get_today_usage(db, user_id, resource_type)
        
        # Check if requested amount would exceed limit
        if current_usage + requested_amount > limit:
            return False, f"Daily quota exceeded. Used {current_usage}/{limit} {resource_type}"
        
        remaining = limit - current_usage
        return True, f"Quota available: {remaining}/{limit} {resource_type}"
    
    @staticmethod
    def get_usage_stats(
        db: Session,
        user_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get usage statistics for the past N days.
        
        Args:
            db: Database session
            user_id: User UUID
            days: Number of days to look back
            
        Returns:
            Dictionary with usage stats by resource type
        """
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            query = text("""
                SELECT 
                    resource_type,
                    DATE(timestamp) as usage_date,
                    SUM(amount) as daily_total
                FROM usage_ledger
                WHERE user_id = :user_id
                  AND timestamp >= :start_date
                GROUP BY resource_type, DATE(timestamp)
                ORDER BY usage_date DESC, resource_type
            """)
            
            result = db.execute(
                query,
                {
                    "user_id": str(user_id),
                    "start_date": start_date
                }
            ).fetchall()
            
            # Organize results by resource type
            stats = {}
            for row in result:
                resource_type = row[0]
                usage_date = row[1]
                daily_total = row[2]
                
                if resource_type not in stats:
                    stats[resource_type] = []
                
                stats[resource_type].append({
                    "date": usage_date.isoformat(),
                    "amount": daily_total
                })
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get usage stats: {e}")
            return {}


# Create a singleton instance
usage_service = UsageService()
