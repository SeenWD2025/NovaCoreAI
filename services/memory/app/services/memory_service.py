"""Memory service for CRUD operations and tier management."""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.orm import Session
import uuid
import logging

from app.models.schemas import (
    StoreMemoryRequest,
    MemoryResponse,
    MemoryTier,
    MemoryType,
    Outcome
)
from app.config import settings
from app.services.embedding_service import embedding_service
from app.utils.storage_calculator import storage_calculator
from app.services.usage_service import usage_service

logger = logging.getLogger(__name__)


class MemoryService:
    """Service for managing memory CRUD operations."""
    
    def store_memory(
        self,
        db: Session,
        user_id: str,
        request: StoreMemoryRequest
    ) -> Optional[MemoryResponse]:
        """
        Store a new memory in the appropriate tier.
        
        Args:
            db: Database session
            user_id: User ID
            request: Memory data
            
        Returns:
            Created memory or None on failure
        """
        try:
            memory_id = str(uuid.uuid4())
            
            # Calculate storage size before storing
            storage_size = storage_calculator.calculate_memory_size(
                input_context=request.input_context,
                output_response=request.output_response,
                tags=request.tags,
                metadata=None,
                embedding_dimension=384
            )
            
            logger.info(f"Memory storage size calculated: {storage_size} bytes ({storage_calculator.bytes_to_human_readable(storage_size)})")
            
            # Generate embedding for semantic search
            combined_text = f"{request.input_context} {request.output_response or ''}"
            embedding = embedding_service.generate_embedding(combined_text)
            
            if not embedding:
                logger.warning("Failed to generate embedding, storing without vector")
            
            # Calculate expiry based on tier
            expires_at = None
            if request.tier == MemoryTier.STM:
                expires_at = datetime.utcnow() + timedelta(seconds=settings.stm_ttl_seconds)
            elif request.tier == MemoryTier.ITM:
                expires_at = datetime.utcnow() + timedelta(seconds=settings.itm_ttl_seconds)
            # LTM has no expiry (expires_at = None)
            
            # Prepare embedding for PostgreSQL
            embedding_str = None
            if embedding:
                embedding_str = f"[{','.join(map(str, embedding))}]"
            
            # Insert memory - handle NULL embedding gracefully
            if embedding_str:
                query = text("""
                    INSERT INTO memories (
                        id, user_id, session_id, type, input_context, output_response,
                        outcome, emotional_weight, confidence_score, constitution_valid,
                        tags, vector_embedding, tier, access_count, last_accessed_at,
                        created_at, expires_at
                    ) VALUES (
                        :id, :user_id, :session_id, :type, :input_context, :output_response,
                        :outcome, :emotional_weight, :confidence_score, :constitution_valid,
                        :tags, :vector_embedding::vector, :tier, :access_count, :last_accessed_at,
                        :created_at, :expires_at
                    )
                """)
            else:
                # Insert without vector_embedding when embedding is not available
                query = text("""
                    INSERT INTO memories (
                        id, user_id, session_id, type, input_context, output_response,
                        outcome, emotional_weight, confidence_score, constitution_valid,
                        tags, tier, access_count, last_accessed_at,
                        created_at, expires_at
                    ) VALUES (
                        :id, :user_id, :session_id, :type, :input_context, :output_response,
                        :outcome, :emotional_weight, :confidence_score, :constitution_valid,
                        :tags, :tier, :access_count, :last_accessed_at,
                        :created_at, :expires_at
                    )
                """)
            
            db.execute(query, {
                "id": memory_id,
                "user_id": user_id,
                "session_id": request.session_id,
                "type": request.type.value,
                "input_context": request.input_context,
                "output_response": request.output_response,
                "outcome": request.outcome.value,
                "emotional_weight": request.emotional_weight,
                "confidence_score": request.confidence_score,
                "constitution_valid": True,  # Will be validated by Noble-Spirit in Phase 6
                "tags": request.tags or [],
                "vector_embedding": embedding_str,
                "tier": request.tier.value,
                "access_count": 0,
                "last_accessed_at": None,
                "created_at": datetime.utcnow(),
                "expires_at": expires_at
            })
            
            db.commit()
            
            # Record storage usage in ledger
            try:
                usage_service.record_storage_usage(
                    db=db,
                    user_id=user_id,
                    memory_id=memory_id,
                    size_bytes=storage_size,
                    operation="create",
                    metadata={
                        "tier": request.tier.value,
                        "type": request.type.value,
                        "session_id": request.session_id
                    }
                )
                logger.info(f"Recorded storage usage for memory {memory_id}")
            except Exception as usage_err:
                logger.error(f"Failed to record storage usage: {usage_err}")
                # Don't fail the memory creation if usage tracking fails
            
            # Retrieve and return the created memory
            return self.get_memory(db, user_id, memory_id)
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to store memory: {e}")
            return None
    
    def get_memory(
        self,
        db: Session,
        user_id: str,
        memory_id: str
    ) -> Optional[MemoryResponse]:
        """
        Retrieve a specific memory by ID.
        
        Args:
            db: Database session
            user_id: User ID (for authorization)
            memory_id: Memory ID
            
        Returns:
            Memory object or None if not found
        """
        try:
            query = text("""
                SELECT
                    id, user_id, session_id, type, input_context, output_response,
                    outcome, emotional_weight, confidence_score, constitution_valid,
                    tags, tier, access_count, last_accessed_at, created_at, expires_at
                FROM memories
                WHERE id = :memory_id AND user_id = :user_id
                AND (expires_at IS NULL OR expires_at > NOW())
            """)
            
            result = db.execute(query, {"memory_id": memory_id, "user_id": user_id}).fetchone()
            
            if not result:
                return None
            
            # Update access count
            self._increment_access(db, memory_id)
            
            return self._row_to_memory_response(result)
            
        except Exception as e:
            logger.error(f"Failed to get memory: {e}")
            return None
    
    def list_memories(
        self,
        db: Session,
        user_id: str,
        tier: Optional[MemoryTier] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[MemoryResponse]:
        """
        List memories for a user.
        
        Args:
            db: Database session
            user_id: User ID
            tier: Optional tier filter
            limit: Max results
            offset: Pagination offset
            
        Returns:
            List of memories
        """
        try:
            # Build query with optional tier filter
            where_clause = "WHERE user_id = :user_id AND (expires_at IS NULL OR expires_at > NOW())"
            params = {"user_id": user_id, "limit": limit, "offset": offset}
            
            if tier:
                where_clause += " AND tier = :tier"
                params["tier"] = tier.value
            
            query = text(f"""
                SELECT
                    id, user_id, session_id, type, input_context, output_response,
                    outcome, emotional_weight, confidence_score, constitution_valid,
                    tags, tier, access_count, last_accessed_at, created_at, expires_at
                FROM memories
                {where_clause}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """)
            
            results = db.execute(query, params).fetchall()
            
            return [self._row_to_memory_response(row) for row in results]
            
        except Exception as e:
            logger.error(f"Failed to list memories: {e}")
            return []
    
    def search_memories(
        self,
        db: Session,
        user_id: str,
        query_text: str,
        limit: int = 10,
        tier: Optional[MemoryTier] = None,
        min_confidence: Optional[float] = None
    ) -> List[MemoryResponse]:
        """
        Semantic search for memories using vector similarity.
        
        Args:
            db: Database session
            user_id: User ID
            query_text: Search query
            limit: Max results
            tier: Optional tier filter
            min_confidence: Minimum confidence score filter
            
        Returns:
            List of memories ranked by similarity
        """
        try:
            # Generate embedding for query
            query_embedding = embedding_service.generate_embedding(query_text)
            
            if not query_embedding:
                logger.warning("Failed to generate query embedding, returning empty results")
                return []
            
            # Prepare embedding for PostgreSQL
            embedding_str = f"[{','.join(map(str, query_embedding))}]"
            
            # Build query with optional filters
            where_clause = "WHERE user_id = :user_id AND (expires_at IS NULL OR expires_at > NOW())"
            params = {
                "user_id": user_id,
                "query_embedding": embedding_str,
                "limit": limit
            }
            
            if tier:
                where_clause += " AND tier = :tier"
                params["tier"] = tier.value
            
            if min_confidence is not None:
                where_clause += " AND confidence_score >= :min_confidence"
                params["min_confidence"] = min_confidence
            
            # Use pgvector cosine distance operator (<=>)
            query = text(f"""
                SELECT
                    id, user_id, session_id, type, input_context, output_response,
                    outcome, emotional_weight, confidence_score, constitution_valid,
                    tags, tier, access_count, last_accessed_at, created_at, expires_at,
                    1 - (vector_embedding <=> :query_embedding::vector) as similarity
                FROM memories
                {where_clause}
                AND vector_embedding IS NOT NULL
                ORDER BY vector_embedding <=> :query_embedding::vector
                LIMIT :limit
            """)
            
            results = db.execute(query, params).fetchall()
            
            memories = []
            for row in results:
                memory = self._row_to_memory_response(row)
                # Add similarity score
                memory.similarity_score = float(row[-1]) if len(row) > 16 else None
                memories.append(memory)
            
            return memories
            
        except Exception as e:
            logger.error(f"Failed to search memories: {e}")
            return []
    
    def update_memory(
        self,
        db: Session,
        user_id: str,
        memory_id: str,
        updates: Dict[str, Any]
    ) -> Optional[MemoryResponse]:
        """
        Update a memory.
        
        Args:
            db: Database session
            user_id: User ID
            memory_id: Memory ID
            updates: Dictionary of fields to update
            
        Returns:
            Updated memory or None on failure
        """
        try:
            # Build update query dynamically
            set_clauses = []
            params = {"memory_id": memory_id, "user_id": user_id}
            
            for key, value in updates.items():
                if value is not None:
                    set_clauses.append(f"{key} = :{key}")
                    params[key] = value.value if hasattr(value, 'value') else value
            
            if not set_clauses:
                logger.warning("No updates provided")
                return self.get_memory(db, user_id, memory_id)
            
            query = text(f"""
                UPDATE memories
                SET {', '.join(set_clauses)}, updated_at = NOW()
                WHERE id = :memory_id AND user_id = :user_id
            """)
            
            db.execute(query, params)
            db.commit()
            
            return self.get_memory(db, user_id, memory_id)
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update memory: {e}")
            return None
    
    def delete_memory(
        self,
        db: Session,
        user_id: str,
        memory_id: str
    ) -> bool:
        """
        Delete a memory (soft delete by setting expires_at).
        
        Args:
            db: Database session
            user_id: User ID
            memory_id: Memory ID
            
        Returns:
            True if deleted, False otherwise
        """
        try:
            query = text("""
                UPDATE memories
                SET expires_at = NOW()
                WHERE id = :memory_id AND user_id = :user_id
            """)
            
            result = db.execute(query, {"memory_id": memory_id, "user_id": user_id})
            db.commit()
            
            return result.rowcount > 0
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete memory: {e}")
            return False
    
    def promote_memory(
        self,
        db: Session,
        user_id: str,
        memory_id: str,
        target_tier: MemoryTier
    ) -> Optional[MemoryResponse]:
        """
        Promote a memory to a higher tier.
        
        Args:
            db: Database session
            user_id: User ID
            memory_id: Memory ID
            target_tier: Target tier (ITM or LTM)
            
        Returns:
            Updated memory or None on failure
        """
        try:
            # Calculate new expiry
            expires_at = None
            if target_tier == MemoryTier.ITM:
                expires_at = datetime.utcnow() + timedelta(seconds=settings.itm_ttl_seconds)
            # LTM has no expiry
            
            query = text("""
                UPDATE memories
                SET tier = :tier, expires_at = :expires_at, updated_at = NOW()
                WHERE id = :memory_id AND user_id = :user_id
            """)
            
            db.execute(query, {
                "tier": target_tier.value,
                "expires_at": expires_at,
                "memory_id": memory_id,
                "user_id": user_id
            })
            db.commit()
            
            return self.get_memory(db, user_id, memory_id)
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to promote memory: {e}")
            return None
    
    def get_memory_stats(
        self,
        db: Session,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Get memory statistics for a user.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Dictionary with memory statistics
        """
        try:
            # Get counts by tier
            query = text("""
                SELECT
                    tier,
                    COUNT(*) as count,
                    SUM(LENGTH(input_context) + COALESCE(LENGTH(output_response), 0)) as bytes
                FROM memories
                WHERE user_id = :user_id
                AND (expires_at IS NULL OR expires_at > NOW())
                GROUP BY tier
            """)
            
            results = db.execute(query, {"user_id": user_id}).fetchall()
            
            # Build stats
            stats = {
                "stm_count": 0,
                "itm_count": 0,
                "ltm_count": 0,
                "total_memories": 0,
                "storage_used_mb": 0.0,
                "tier_breakdown": {}
            }
            
            for row in results:
                tier = row[0]
                count = row[1]
                size_bytes = row[2] or 0
                
                stats["tier_breakdown"][tier] = count
                stats["total_memories"] += count
                stats["storage_used_mb"] += size_bytes / (1024 * 1024)
                
                if tier == "stm":
                    stats["stm_count"] = count
                elif tier == "itm":
                    stats["itm_count"] = count
                elif tier == "ltm":
                    stats["ltm_count"] = count
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get memory stats: {e}")
            return {}
    
    def _increment_access(self, db: Session, memory_id: str):
        """Increment access count for a memory."""
        try:
            query = text("""
                UPDATE memories
                SET access_count = access_count + 1,
                    last_accessed_at = NOW()
                WHERE id = :memory_id
            """)
            db.execute(query, {"memory_id": memory_id})
            db.commit()
        except Exception as e:
            logger.error(f"Failed to increment access count: {e}")
            db.rollback()
    
    def _row_to_memory_response(self, row) -> MemoryResponse:
        """Convert database row to MemoryResponse."""
        return MemoryResponse(
            id=str(row[0]),
            user_id=str(row[1]),
            session_id=str(row[2]) if row[2] else None,
            type=row[3],
            input_context=row[4],
            output_response=row[5],
            outcome=row[6],
            emotional_weight=row[7],
            confidence_score=row[8],
            constitution_valid=row[9],
            tags=row[10] or [],
            tier=row[11],
            access_count=row[12],
            last_accessed_at=row[13],
            created_at=row[14],
            expires_at=row[15]
        )


# Global instance
memory_service = MemoryService()
