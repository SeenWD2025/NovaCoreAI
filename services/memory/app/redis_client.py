"""Redis client for STM and ITM management."""
import redis
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client for managing Short-Term and Intermediate-Term Memory."""
    
    def __init__(self):
        """Initialize Redis connections for STM and ITM."""
        try:
            # STM connection (DB 0)
            self.stm_client = redis.from_url(
                settings.redis_url,
                db=settings.redis_stm_db,
                decode_responses=True
            )
            
            # ITM connection (DB 1)
            self.itm_client = redis.from_url(
                settings.redis_url,
                db=settings.redis_itm_db,
                decode_responses=True
            )
            
            # Test connections
            self.stm_client.ping()
            self.itm_client.ping()
            logger.info("Redis connections established for STM and ITM")
            
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            raise
    
    def test_connection(self) -> Dict[str, bool]:
        """Test Redis connectivity."""
        try:
            stm_ok = self.stm_client.ping()
            itm_ok = self.itm_client.ping()
            return {"stm": stm_ok, "itm": itm_ok}
        except Exception as e:
            logger.error(f"Redis test failed: {e}")
            return {"stm": False, "itm": False}
    
    # Short-Term Memory (STM) Operations
    
    def store_stm(self, session_id: str, interaction: Dict[str, Any]) -> bool:
        """Store an interaction in Short-Term Memory with 1-hour TTL."""
        try:
            key = f"stm:{session_id}"
            
            # Get existing interactions
            existing = self.stm_client.get(key)
            interactions = json.loads(existing) if existing else []
            
            # Add new interaction with timestamp
            interaction["timestamp"] = datetime.utcnow().isoformat()
            interactions.append(interaction)
            
            # Keep only last N interactions
            if len(interactions) > settings.stm_max_size:
                interactions = interactions[-settings.stm_max_size:]
            
            # Store with TTL
            self.stm_client.setex(
                key,
                settings.stm_ttl_seconds,
                json.dumps(interactions)
            )
            
            return True
        except Exception as e:
            logger.error(f"Failed to store STM: {e}")
            return False
    
    def get_stm(self, session_id: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve Short-Term Memory for a session."""
        try:
            key = f"stm:{session_id}"
            data = self.stm_client.get(key)
            
            if not data:
                return []
            
            interactions = json.loads(data)
            
            # Return last N if limit specified
            if limit:
                return interactions[-limit:]
            
            return interactions
        except Exception as e:
            logger.error(f"Failed to retrieve STM: {e}")
            return []
    
    def clear_stm(self, session_id: str) -> bool:
        """Clear Short-Term Memory for a session."""
        try:
            key = f"stm:{session_id}"
            self.stm_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Failed to clear STM: {e}")
            return False
    
    # Intermediate-Term Memory (ITM) Operations
    
    def store_itm(self, user_id: str, memory_id: str, access_count: int = 1) -> bool:
        """Store a memory reference in ITM with access count as score."""
        try:
            key = f"itm:{user_id}"
            
            # Add to sorted set with access count as score
            self.itm_client.zadd(key, {memory_id: access_count})
            
            # Set expiry (sliding window)
            self.itm_client.expire(key, settings.itm_ttl_seconds)
            
            # Keep only top N memories
            count = self.itm_client.zcard(key)
            if count > settings.itm_max_size:
                # Remove lowest scored items
                to_remove = count - settings.itm_max_size
                self.itm_client.zpopmin(key, to_remove)
            
            return True
        except Exception as e:
            logger.error(f"Failed to store ITM: {e}")
            return False
    
    def get_itm(self, user_id: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve Intermediate-Term Memory for a user (sorted by access count)."""
        try:
            key = f"itm:{user_id}"
            
            # Get all memory IDs with scores (descending order)
            limit = limit or settings.itm_max_size
            items = self.itm_client.zrevrange(key, 0, limit - 1, withscores=True)
            
            # Format as list of dicts
            return [
                {"memory_id": memory_id, "access_count": int(score)}
                for memory_id, score in items
            ]
        except Exception as e:
            logger.error(f"Failed to retrieve ITM: {e}")
            return []
    
    def increment_itm_access(self, user_id: str, memory_id: str) -> bool:
        """Increment access count for an ITM memory."""
        try:
            key = f"itm:{user_id}"
            self.itm_client.zincrby(key, 1, memory_id)
            
            # Refresh TTL
            self.itm_client.expire(key, settings.itm_ttl_seconds)
            
            return True
        except Exception as e:
            logger.error(f"Failed to increment ITM access: {e}")
            return False
    
    def remove_from_itm(self, user_id: str, memory_id: str) -> bool:
        """Remove a memory from ITM (e.g., when promoted to LTM)."""
        try:
            key = f"itm:{user_id}"
            self.itm_client.zrem(key, memory_id)
            return True
        except Exception as e:
            logger.error(f"Failed to remove from ITM: {e}")
            return False
    
    def clear_itm(self, user_id: str) -> bool:
        """Clear all ITM for a user."""
        try:
            key = f"itm:{user_id}"
            self.itm_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Failed to clear ITM: {e}")
            return False
    
    # Health Check
    
    def health_check(self) -> Dict[str, Any]:
        """Check Redis health and return stats."""
        try:
            stm_ok = self.stm_client.ping()
            itm_ok = self.itm_client.ping()
            
            # Get some stats
            stm_keys = len(self.stm_client.keys("stm:*"))
            itm_keys = len(self.itm_client.keys("itm:*"))
            
            return {
                "stm_healthy": stm_ok,
                "itm_healthy": itm_ok,
                "stm_sessions": stm_keys,
                "itm_users": itm_keys
            }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "stm_healthy": False,
                "itm_healthy": False,
                "error": str(e)
            }


# Global instance
redis_client = RedisClient()
