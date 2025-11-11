"""Chat endpoints for Intelligence Core."""
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional
import time
import logging
import json

from app.database import get_db
from app.models.schemas import (
    ChatMessage, ChatResponse, SessionListResponse, 
    SessionHistoryResponse, SessionInfo, PromptInfo
)
from app.services.ollama_service import ollama_service
from app.services.session_service import SessionService
from app.services.integration_service import integration_service
from app.services.usage_service import usage_service
from app.utils.token_counter import token_counter
from app.utils.service_auth import verify_service_token_dependency, ServiceTokenPayload
from app.utils.sanitize import sanitize_message
from app.utils.metrics import (
    track_message_processing, track_tokens, track_memory_context, 
    increment_active_sessions, decrement_active_sessions
)
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

# Security constants
MAX_MESSAGE_LENGTH = 10000  # Maximum message length in characters


def get_user_id(x_user_id: Optional[str] = Header(None)) -> UUID:
    """Extract user ID from header."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID header missing")
    try:
        return UUID(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")


def check_token_limit(db: Session, user_id: UUID, required_tokens: int, tier: str):
    """Check if user has remaining tokens for the day."""
    # Get tier limits
    tier_limits = {
        "free_trial": settings.free_tier_tokens_day,
        "basic": settings.basic_tier_tokens_day,
        "pro": settings.pro_tier_tokens_day
    }
    
    limit = tier_limits.get(tier, settings.free_tier_tokens_day)
    
    # Pro tier has unlimited tokens
    if limit == -1:
        return True
    
    # Check current usage
    used_today = SessionService.get_user_token_usage_today(db, user_id)
    
    if used_today + required_tokens > limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily token limit exceeded. Used: {used_today}/{limit}"
        )
    
    return True


@router.post("/message", response_model=ChatResponse)
async def send_message(
    message: ChatMessage,
    user_id: UUID = Depends(get_user_id),
    db: Session = Depends(get_db),
    service: ServiceTokenPayload = Depends(verify_service_token_dependency)
):
    """Send a message and get a response (non-streaming)."""
    start_time = time.time()
    
    # Validate message content
    if not message.message or not message.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Sanitize message to prevent XSS attacks and validate length
    try:
        sanitized_message = sanitize_message(message.message, MAX_MESSAGE_LENGTH)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Update message with sanitized version
    message.message = sanitized_message
    
    # Check if Ollama is ready
    if not ollama_service.is_ready:
        raise HTTPException(status_code=503, detail="LLM service not ready")
    
    # Get or create session
    if message.session_id:
        session = SessionService.get_session(db, message.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        session_id = message.session_id
    else:
        session_id = SessionService.create_session(db, user_id, settings.llm_model)
    
    # Build context from memory service if requested
    context = ""
    if message.use_memory:
        # Get memory context from Memory Service (STM + ITM + LTM)
        memory_context = await integration_service.get_memory_context(
            user_id=user_id,
            session_id=session_id if message.session_id else None,
            limit=5
        )
        
        # Build context prompt from memory
        context = integration_service.build_context_prompt(memory_context)
        
        # Fallback to local history if memory service unavailable
        if not context and message.session_id:
            history = SessionService.get_session_history(db, message.session_id, limit=5)
            for prompt in history[-5:]:  # Last 5 exchanges
                context += f"User: {prompt['input_text']}\nAssistant: {prompt['output_text']}\n\n"
    
    # Prepare prompt
    full_prompt = f"{context}User: {message.message}\nAssistant:"
    
    # Estimate tokens for rate limiting
    estimated_tokens = token_counter.count_tokens(full_prompt) + 500  # +500 for response
    
    # Get user's subscription tier
    user_tier = await integration_service.get_user_tier(user_id)
    
    # Check quota BEFORE processing message
    has_quota, quota_msg = usage_service.check_quota(
        db, user_id, user_tier, "llm_tokens", estimated_tokens
    )
    if not has_quota:
        raise HTTPException(status_code=429, detail=quota_msg)
    
    # Also check message quota
    has_message_quota, message_quota_msg = usage_service.check_quota(
        db, user_id, user_tier, "messages", 1
    )
    if not has_message_quota:
        raise HTTPException(status_code=429, detail=message_quota_msg)
    
    # Generate response
    system_prompt = "You are Noble NovaCoreAI, an ethical AI assistant focused on truth, wisdom, and human flourishing. Provide thoughtful, helpful responses aligned with the Reclaimer Ethos."
    response_text = await ollama_service.generate_response(
        prompt=full_prompt,
        system_prompt=system_prompt,
        temperature=0.7,
        max_tokens=2000
    )
    
    # Calculate actual tokens used
    tokens_used = token_counter.count_tokens(full_prompt + response_text)
    latency_ms = int((time.time() - start_time) * 1000)
    
    # Store the interaction
    SessionService.store_prompt(
        db, session_id, user_id, message.message, response_text, tokens_used, latency_ms
    )
    
    # Record usage in ledger for billing/quota tracking
    usage_service.record_usage(
        db, user_id, "llm_tokens", tokens_used,
        metadata={
            "session_id": str(session_id),
            "model": settings.llm_model,
            "latency_ms": latency_ms
        }
    )
    
    # Record message count for quota enforcement
    usage_service.record_usage(
        db, user_id, "messages", 1,
        metadata={
            "session_id": str(session_id),
            "message_length": len(message.message)
        }
    )
    
    # Store in STM (Short-Term Memory) for fast context retrieval
    await integration_service.store_stm_interaction(
        user_id=user_id,
        session_id=session_id,
        input_text=message.message,
        output_text=response_text,
        tokens=tokens_used
    )
    
    # Trigger reflection worker asynchronously
    integration_service.trigger_reflection(
        user_id=user_id,
        session_id=session_id,
        input_text=message.message,
        output_text=response_text,
        context={"tokens_used": tokens_used, "latency_ms": latency_ms}
    )
    
    logger.info(f"Message processed. Session: {session_id}, Tokens: {tokens_used}, Latency: {latency_ms}ms")
    
    return ChatResponse(
        response=response_text,
        session_id=session_id,
        tokens_used=tokens_used,
        latency_ms=latency_ms
    )


@router.post("/stream")
async def stream_message(
    message: ChatMessage,
    user_id: UUID = Depends(get_user_id),
    db: Session = Depends(get_db),
    service: ServiceTokenPayload = Depends(verify_service_token_dependency)
):
    """Send a message and stream the response."""
    start_time = time.time()
    
    # Validate message content
    if not message.message or not message.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Sanitize message to prevent XSS attacks and validate length
    try:
        sanitized_message = sanitize_message(message.message, MAX_MESSAGE_LENGTH)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Update message with sanitized version
    message.message = sanitized_message
    
    # Check if Ollama is ready
    if not ollama_service.is_ready:
        raise HTTPException(status_code=503, detail="LLM service not ready")
    
    # Get or create session
    if message.session_id:
        session = SessionService.get_session(db, message.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        session_id = message.session_id
    else:
        session_id = SessionService.create_session(db, user_id, settings.llm_model)
    
    # Build context from memory service if requested
    context = ""
    if message.use_memory:
        # Get memory context from Memory Service
        memory_context = await integration_service.get_memory_context(
            user_id=user_id,
            session_id=session_id if message.session_id else None,
            limit=5
        )
        
        # Build context prompt from memory
        context = integration_service.build_context_prompt(memory_context)
        
        # Fallback to local history if memory service unavailable
        if not context and message.session_id:
            history = SessionService.get_session_history(db, message.session_id, limit=5)
            for prompt in history[-5:]:
                context += f"User: {prompt['input_text']}\nAssistant: {prompt['output_text']}\n\n"
    
    # Prepare prompt
    full_prompt = f"{context}User: {message.message}\nAssistant:"
    
    # Estimate tokens for rate limiting
    estimated_tokens = token_counter.count_tokens(full_prompt) + 500
    
    # Get user's subscription tier
    user_tier = await integration_service.get_user_tier(user_id)
    
    # Check quota BEFORE processing message
    has_quota, quota_msg = usage_service.check_quota(
        db, user_id, user_tier, "llm_tokens", estimated_tokens
    )
    if not has_quota:
        raise HTTPException(status_code=429, detail=quota_msg)
    
    # Also check message quota
    has_message_quota, message_quota_msg = usage_service.check_quota(
        db, user_id, user_tier, "messages", 1
    )
    if not has_message_quota:
        raise HTTPException(status_code=429, detail=message_quota_msg)
    
    async def generate():
        """Generate streaming response."""
        accumulated_response = ""
        system_prompt = "You are Noble NovaCoreAI, an ethical AI assistant focused on truth, wisdom, and human flourishing. Provide thoughtful, helpful responses aligned with the Reclaimer Ethos."
        
        try:
            async for chunk in ollama_service.generate_streaming_response(
                prompt=full_prompt,
                system_prompt=system_prompt,
                temperature=0.7,
                max_tokens=2000
            ):
                if chunk:
                    accumulated_response += chunk
                    # Send chunk as SSE
                    data = json.dumps({"content": chunk, "done": False})
                    yield f"data: {data}\n\n"
            
            # Calculate metrics
            tokens_used = token_counter.count_tokens(full_prompt + accumulated_response)
            latency_ms = int((time.time() - start_time) * 1000)
            
            # Store the interaction
            SessionService.store_prompt(
                db, session_id, user_id, message.message, 
                accumulated_response, tokens_used, latency_ms
            )
            
            # Record usage in ledger for billing/quota tracking
            try:
                usage_service.record_usage(
                    db, user_id, "llm_tokens", tokens_used,
                    metadata={
                        "session_id": str(session_id),
                        "model": settings.llm_model,
                        "latency_ms": latency_ms,
                        "streaming": True
                    }
                )
                
                # Record message count for quota enforcement
                usage_service.record_usage(
                    db, user_id, "messages", 1,
                    metadata={
                        "session_id": str(session_id),
                        "message_length": len(message.message)
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to record usage: {e}")
            
            # Store in STM for fast context retrieval (don't await in generator)
            try:
                await integration_service.store_stm_interaction(
                    user_id=user_id,
                    session_id=session_id,
                    input_text=message.message,
                    output_text=accumulated_response,
                    tokens=tokens_used
                )
            except Exception as e:
                logger.warning(f"Failed to store STM: {e}")
            
            # Trigger reflection worker asynchronously
            try:
                integration_service.trigger_reflection(
                    user_id=user_id,
                    session_id=session_id,
                    input_text=message.message,
                    output_text=accumulated_response,
                    context={"tokens_used": tokens_used, "latency_ms": latency_ms}
                )
            except Exception as e:
                logger.warning(f"Failed to trigger reflection: {e}")
            
            # Send final chunk with metadata
            data = json.dumps({
                "content": "",
                "done": True,
                "session_id": str(session_id),
                "tokens_used": tokens_used,
                "latency_ms": latency_ms
            })
            yield f"data: {data}\n\n"
            
            logger.info(f"Stream completed. Session: {session_id}, Tokens: {tokens_used}")
            
        except Exception as e:
            logger.error(f"Streaming error: {e}", exc_info=True)
            error_data = json.dumps({"error": "An error occurred while processing your request", "done": True})
            yield f"data: {error_data}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(
    user_id: UUID = Depends(get_user_id),
    db: Session = Depends(get_db),
    service: ServiceTokenPayload = Depends(verify_service_token_dependency)
):
    """Get all sessions for the current user."""
    sessions_data = SessionService.get_user_sessions(db, user_id, limit=50)
    
    sessions = [
        SessionInfo(
            id=s["id"],
            user_id=s["user_id"],
            status=s["status"],
            model_name=s["model_name"],
            created_at=s["created_at"],
            ended_at=s["ended_at"]
        )
        for s in sessions_data
    ]
    
    return SessionListResponse(sessions=sessions, total=len(sessions))


@router.get("/history/{session_id}", response_model=SessionHistoryResponse)
async def get_history(
    session_id: UUID,
    user_id: UUID = Depends(get_user_id),
    db: Session = Depends(get_db),
    service: ServiceTokenPayload = Depends(verify_service_token_dependency)
):
    """Get conversation history for a session."""
    # Verify session belongs to user
    session = SessionService.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if str(session["user_id"]) != str(user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    prompts_data = SessionService.get_session_history(db, session_id, limit=100)
    
    prompts = [
        PromptInfo(
            id=p["id"],
            session_id=p["session_id"],
            user_id=p["user_id"],
            input_text=p["input_text"],
            output_text=p["output_text"],
            tokens_used=p["tokens_used"],
            latency_ms=p["latency_ms"],
            created_at=p["created_at"]
        )
        for p in prompts_data
    ]
    
    return SessionHistoryResponse(
        session_id=session_id,
        prompts=prompts,
        total=len(prompts)
    )


@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: UUID,
    user_id: UUID = Depends(get_user_id),
    db: Session = Depends(get_db),
    service: ServiceTokenPayload = Depends(verify_service_token_dependency)
):
    """End a chat session."""
    # Verify session belongs to user
    session = SessionService.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if str(session["user_id"]) != str(user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    SessionService.end_session(db, session_id)
    
    return {"message": "Session ended", "session_id": str(session_id)}
