"""
Custom Prometheus metrics for Intelligence service
"""
from prometheus_client import Counter, Histogram, Gauge
import time
from functools import wraps
from typing import Callable


# Chat message metrics
chat_messages_total = Counter(
    'intelligence_chat_messages_total',
    'Total number of chat messages processed',
    ['status']  # success, error, quota_exceeded
)

# Token usage metrics
chat_tokens_total = Counter(
    'intelligence_chat_tokens_total',
    'Total number of tokens processed',
    ['direction']  # input, output
)

# Ollama latency metrics
ollama_latency_seconds = Histogram(
    'intelligence_ollama_latency_seconds',
    'Ollama model inference latency in seconds',
    ['model'],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0)
)

# Memory context size metrics
memory_context_size = Gauge(
    'intelligence_memory_context_size',
    'Size of memory context retrieved for chat',
    ['tier']  # stm, itm, ltm
)

# Session metrics
active_sessions = Gauge(
    'intelligence_active_sessions',
    'Number of currently active chat sessions'
)

# Streaming metrics
streaming_requests_total = Counter(
    'intelligence_streaming_requests_total',
    'Total number of streaming chat requests',
    ['status']
)


def track_message_processing(status: str):
    """Track chat message processing."""
    chat_messages_total.labels(status=status).inc()


def track_tokens(input_tokens: int, output_tokens: int):
    """Track token usage."""
    chat_tokens_total.labels(direction='input').inc(input_tokens)
    chat_tokens_total.labels(direction='output').inc(output_tokens)


def track_memory_context(memory_count: dict):
    """
    Track memory context size by tier.
    
    Args:
        memory_count: Dict with keys 'stm', 'itm', 'ltm' and their counts
    """
    for tier, count in memory_count.items():
        memory_context_size.labels(tier=tier).set(count)


def track_ollama_latency(model: str):
    """
    Decorator to track Ollama inference latency.
    
    Usage:
        @track_ollama_latency('mistral')
        async def generate_response(...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                ollama_latency_seconds.labels(model=model).observe(duration)
        return wrapper
    return decorator


def increment_active_sessions():
    """Increment active sessions count."""
    active_sessions.inc()


def decrement_active_sessions():
    """Decrement active sessions count."""
    active_sessions.dec()


def track_streaming_request(status: str):
    """Track streaming request."""
    streaming_requests_total.labels(status=status).inc()
