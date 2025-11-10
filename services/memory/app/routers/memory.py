"""Memory API router."""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models.schemas import (
    StoreMemoryRequest,
    SearchMemoriesRequest,
    UpdateMemoryRequest,
    PromoteMemoryRequest,
    MemoryResponse,
    MemoriesListResponse,
    SearchResultsResponse,
    MemoryStatsResponse,
    MemoryTier,
    STMInteraction,
    UsageStatsResponse,
    QuotaCheckResponse
)
from app.services.memory_service import memory_service
from app.services.usage_service import usage_service
from app.redis_client import redis_client
from app.config import settings
from app.utils.storage_calculator import storage_calculator
from app.utils.service_auth import verify_service_token_dependency, ServiceTokenPayload
from app.metrics import (
    memory_storage_total,
    memory_retrieval_total,
    memory_search_total,
    vector_search_latency_seconds,
)
import logging
import time

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/memory", tags=["memory"])


def get_user_id(x_user_id: Optional[str] = Header(None)) -> str:
    """Extract and validate user ID from headers."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID header required")
    return x_user_id


# Long-Term Memory (LTM) Endpoints

@router.post("/store", response_model=MemoryResponse)
async def store_memory(
    request: StoreMemoryRequest,
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db),
    service: ServiceTokenPayload = Depends(verify_service_token_dependency),
    x_user_tier: Optional[str] = Header("free_trial")
):
    """
    Store a new memory.
    
    Creates a memory in the specified tier (STM, ITM, or LTM).
    Generates vector embeddings for semantic search.
    Enforces storage quotas based on subscription tier.
    """
    try:
        # Calculate storage size for this memory
        storage_size = storage_calculator.calculate_memory_size(
            input_context=request.input_context,
            output_response=request.output_response,
            tags=request.tags,
            metadata=None,
            embedding_dimension=384
        )
        
        # Check storage quota (skip for STM as it expires quickly)
        if request.tier in [MemoryTier.ITM, MemoryTier.LTM]:
            has_quota, quota_msg = usage_service.check_storage_quota(
                db, user_id, storage_size, x_user_tier
            )
            
            if not has_quota:
                logger.warning(f"Storage quota exceeded for user {user_id}: {quota_msg}")
                raise HTTPException(status_code=429, detail=quota_msg)
            
            if "Warning" in quota_msg:
                logger.info(f"Storage quota warning for user {user_id}: {quota_msg}")
        
        memory = memory_service.store_memory(db, user_id, request)
        
        if not memory:
            raise HTTPException(status_code=500, detail="Failed to store memory")
        
        # If ITM, also store reference in Redis
        if request.tier == MemoryTier.ITM:
            redis_client.store_itm(user_id, memory.id, 1)
        
        # Track metric
        memory_storage_total.labels(tier=request.tier.value, user_id=user_id).inc()
        
        logger.info(f"Stored memory {memory.id} for user {user_id} in tier {request.tier}")
        
        return memory
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error storing memory: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/retrieve/{memory_id}", response_model=MemoryResponse)
async def get_memory(
    memory_id: str,
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db),
    service: ServiceTokenPayload = Depends(verify_service_token_dependency)
):
    """
    Retrieve a specific memory by ID.
    
    Increments access count and updates last_accessed_at timestamp.
    """
    try:
        memory = memory_service.get_memory(db, user_id, memory_id)
        
        if not memory:
            raise HTTPException(status_code=404, detail="Memory not found")
        
        # If ITM, increment access count in Redis
        if memory.tier == "itm":
            redis_client.increment_itm_access(user_id, memory_id)
        
        # Track metric
        memory_retrieval_total.labels(tier=memory.tier, user_id=user_id).inc()
        
        return memory
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving memory: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/list", response_model=MemoriesListResponse)
async def list_memories(
    tier: Optional[MemoryTier] = None,
    limit: int = 50,
    offset: int = 0,
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """
    List memories for the current user.
    
    Can be filtered by tier and paginated with limit/offset.
    """
    try:
        memories = memory_service.list_memories(db, user_id, tier, limit, offset)
        
        # Get total count
        stats = memory_service.get_memory_stats(db, user_id)
        total = stats.get("total_memories", 0)
        
        return MemoriesListResponse(
            memories=memories,
            total=total,
            tier=tier.value if tier else None
        )
        
    except Exception as e:
        logger.error(f"Error listing memories: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/search", response_model=SearchResultsResponse)
async def search_memories(
    request: SearchMemoriesRequest,
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db),
    service: ServiceTokenPayload = Depends(verify_service_token_dependency)
):
    """
    Semantic search for memories using vector similarity.
    
    Uses pgvector to find memories similar to the query text.
    Results are ranked by cosine similarity.
    """
    try:
        # Track search latency
        start_time = time.time()
        
        memories = memory_service.search_memories(
            db,
            user_id,
            request.query,
            request.limit,
            request.tier,
            request.min_confidence
        )
        
        # Record latency
        latency = time.time() - start_time
        vector_search_latency_seconds.observe(latency)
        
        # Track metric
        memory_search_total.labels(user_id=user_id).inc()
        
        return SearchResultsResponse(
            results=memories,
            total=len(memories),
            query=request.query
        )
        
    except Exception as e:
        logger.error(f"Error searching memories: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.patch("/update/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: str,
    request: UpdateMemoryRequest,
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """
    Update an existing memory.
    
    Can update outcome, emotional_weight, confidence_score, tags, and tier.
    """
    try:
        # Build updates dictionary
        updates = {}
        if request.outcome is not None:
            updates["outcome"] = request.outcome
        if request.emotional_weight is not None:
            updates["emotional_weight"] = request.emotional_weight
        if request.confidence_score is not None:
            updates["confidence_score"] = request.confidence_score
        if request.tags is not None:
            updates["tags"] = request.tags
        if request.tier is not None:
            updates["tier"] = request.tier
        
        memory = memory_service.update_memory(db, user_id, memory_id, updates)
        
        if not memory:
            raise HTTPException(status_code=404, detail="Memory not found")
        
        return memory
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating memory: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/delete/{memory_id}")
async def delete_memory(
    memory_id: str,
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """
    Delete a memory (soft delete).
    
    Sets expires_at to current time, effectively removing it from queries.
    """
    try:
        success = memory_service.delete_memory(db, user_id, memory_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Memory not found")
        
        # Remove from ITM if present
        redis_client.remove_from_itm(user_id, memory_id)
        
        return {"success": True, "message": "Memory deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting memory: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/promote/{memory_id}", response_model=MemoryResponse)
async def promote_memory(
    memory_id: str,
    request: PromoteMemoryRequest,
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """
    Promote a memory to a higher tier.
    
    STM → ITM → LTM
    Updates expiry times accordingly.
    """
    try:
        memory = memory_service.promote_memory(db, user_id, memory_id, request.target_tier)
        
        if not memory:
            raise HTTPException(status_code=404, detail="Memory not found")
        
        # Handle Redis updates
        if request.target_tier == MemoryTier.ITM:
            redis_client.store_itm(user_id, memory_id, memory.access_count)
        elif request.target_tier == MemoryTier.LTM:
            redis_client.remove_from_itm(user_id, memory_id)
        
        logger.info(f"Promoted memory {memory_id} to {request.target_tier}")
        
        return memory
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error promoting memory: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/stats", response_model=MemoryStatsResponse)
async def get_memory_stats(
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """
    Get memory usage statistics for the current user.
    
    Returns counts by tier, storage usage, and limits.
    """
    try:
        stats = memory_service.get_memory_stats(db, user_id)
        
        # Get storage limit based on subscription (placeholder - will come from auth service)
        storage_limit_mb = settings.basic_tier_memory_gb * 1024  # Convert GB to MB
        
        return MemoryStatsResponse(
            user_id=user_id,
            stm_count=stats.get("stm_count", 0),
            itm_count=stats.get("itm_count", 0),
            ltm_count=stats.get("ltm_count", 0),
            total_memories=stats.get("total_memories", 0),
            storage_used_mb=stats.get("storage_used_mb", 0.0),
            storage_limit_mb=storage_limit_mb,
            tier_breakdown=stats.get("tier_breakdown", {})
        )
        
    except Exception as e:
        logger.error(f"Error getting memory stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Short-Term Memory (STM) Endpoints

@router.post("/stm/store")
async def store_stm(
    session_id: str,
    interaction: STMInteraction,
    user_id: str = Depends(get_user_id)
):
    """
    Store an interaction in Short-Term Memory (Redis).
    
    Used for active conversation context with 1-hour TTL.
    """
    try:
        interaction_dict = {
            "input": interaction.input,
            "output": interaction.output,
            "tokens": interaction.tokens
        }
        
        success = redis_client.store_stm(session_id, interaction_dict)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to store STM")
        
        return {"success": True, "session_id": session_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error storing STM: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/stm/retrieve/{session_id}")
async def get_stm(
    session_id: str,
    limit: Optional[int] = None,
    user_id: str = Depends(get_user_id)
):
    """
    Retrieve Short-Term Memory for a session.
    
    Returns recent interactions from Redis.
    """
    try:
        interactions = redis_client.get_stm(session_id, limit)
        
        return {
            "session_id": session_id,
            "interactions": interactions,
            "count": len(interactions)
        }
        
    except Exception as e:
        logger.error(f"Error retrieving STM: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/stm/clear/{session_id}")
async def clear_stm(
    session_id: str,
    user_id: str = Depends(get_user_id)
):
    """Clear Short-Term Memory for a session."""
    try:
        success = redis_client.clear_stm(session_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to clear STM")
        
        return {"success": True, "message": "STM cleared"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing STM: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Intermediate-Term Memory (ITM) Endpoints

@router.get("/itm/retrieve")
async def get_itm(
    limit: Optional[int] = None,
    user_id: str = Depends(get_user_id)
):
    """
    Retrieve Intermediate-Term Memory references.
    
    Returns memory IDs sorted by access count from Redis.
    """
    try:
        references = redis_client.get_itm(user_id, limit)
        
        return {
            "user_id": user_id,
            "references": references,
            "count": len(references)
        }
        
    except Exception as e:
        logger.error(f"Error retrieving ITM: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Context Retrieval (for Intelligence Core)

@router.get("/context")
async def get_context(
    session_id: Optional[str] = None,
    limit: int = 10,
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """
    Get relevant context for a session.
    
    Combines STM (if session_id provided), ITM, and relevant LTM.
    Used by Intelligence Core to build prompts with memory context.
    """
    try:
        context = {
            "stm": [],
            "itm": [],
            "ltm": []
        }
        
        # Get STM if session provided
        if session_id:
            context["stm"] = redis_client.get_stm(session_id, limit=5)
        
        # Get ITM references
        itm_refs = redis_client.get_itm(user_id, limit=5)
        
        # Fetch full memories for ITM references
        for ref in itm_refs:
            memory = memory_service.get_memory(db, user_id, ref["memory_id"])
            if memory:
                context["itm"].append({
                    "id": memory.id,
                    "type": memory.type,
                    "input": memory.input_context[:200],  # Truncate for context
                    "outcome": memory.outcome,
                    "access_count": memory.access_count
                })
        
        # Get recent high-confidence LTM
        ltm_memories = memory_service.list_memories(
            db, user_id, MemoryTier.LTM, limit=5
        )
        
        for memory in ltm_memories:
            if memory.confidence_score and memory.confidence_score > 0.7:
                context["ltm"].append({
                    "id": memory.id,
                    "type": memory.type,
                    "input": memory.input_context[:200],
                    "confidence": memory.confidence_score
                })
        
        return context
    
    except Exception as e:
        logger.error(f"Error getting context: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Usage Tracking Endpoints

@router.get("/usage", response_model=UsageStatsResponse)
async def get_usage_stats(
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    """
    Get detailed usage statistics for the current user.
    
    Includes storage usage, memory counts by tier, and tier-specific stats.
    """
    try:
        # Get storage usage from ledger
        storage_usage = usage_service.get_user_storage_usage(db, user_id)
        
        # Get tier-specific statistics
        tier_stats = usage_service.get_storage_stats_by_tier(db, user_id)
        
        return UsageStatsResponse(
            user_id=user_id,
            storage={
                "total_bytes": storage_usage["total_bytes"],
                "total_human_readable": storage_usage["total_human_readable"]
            },
            memory_counts=storage_usage["memory_count"],
            tier_stats=tier_stats,
            timestamp=storage_usage["timestamp"]
        )
        
    except Exception as e:
        logger.error(f"Error getting usage stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/usage/quota-check", response_model=QuotaCheckResponse)
async def check_storage_quota(
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db),
    x_user_tier: Optional[str] = Header("free_trial")
):
    """
    Check current storage quota status.
    
    Returns quota availability and usage percentage.
    """
    try:
        # Get current usage
        storage_usage = usage_service.get_user_storage_usage(db, user_id)
        current_bytes = storage_usage["total_bytes"]
        
        # Get tier limit
        limit_bytes = storage_calculator.get_tier_storage_limit(x_user_tier)
        
        # Calculate percentage
        if limit_bytes == -1:
            percentage = 0.0
            limit_str = "Unlimited"
        else:
            percentage = (current_bytes / limit_bytes) * 100 if limit_bytes > 0 else 0
            limit_str = storage_calculator.bytes_to_human_readable(limit_bytes)
        
        has_quota = limit_bytes == -1 or current_bytes < limit_bytes
        
        if not has_quota:
            message = "Storage quota exceeded. Please upgrade your plan."
        elif percentage >= 80:
            message = f"Warning: {percentage:.1f}% of storage quota used"
        else:
            message = "Storage quota available"
        
        return QuotaCheckResponse(
            has_quota=has_quota,
            message=message,
            current_usage=storage_calculator.bytes_to_human_readable(current_bytes),
            limit=limit_str,
            percentage_used=round(percentage, 2)
        )
        
    except Exception as e:
        logger.error(f"Error checking quota: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
        
    except Exception as e:
        logger.error(f"Error retrieving context: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
