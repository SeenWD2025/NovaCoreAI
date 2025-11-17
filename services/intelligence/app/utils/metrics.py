"""
Custom Prometheus metrics for Intelligence service
"""
from prometheus_client import Counter, Histogram, Gauge


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

# LLM provider latency metrics
llm_provider_latency_seconds = Histogram(
    'intelligence_llm_provider_latency_seconds',
    'LLM provider inference latency in seconds',
    ['provider', 'model'],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0)
)

# Provider success/failure counters
llm_provider_success_total = Counter(
    'intelligence_llm_provider_success_total',
    'Total successful LLM provider responses',
    ['provider']
)

llm_provider_failure_total = Counter(
    'intelligence_llm_provider_failure_total',
    'Total failed LLM provider attempts',
    ['provider', 'reason']
)

# Provider health gauge (1 healthy, 0 unhealthy)
llm_provider_health = Gauge(
    'intelligence_llm_provider_health',
    'LLM provider health status',
    ['provider']
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


def observe_provider_latency(provider: str, model: str, duration_seconds: float):
    """Record latency for a specific provider/model combination."""
    llm_provider_latency_seconds.labels(provider=provider, model=model).observe(duration_seconds)


def record_provider_success(provider: str):
    """Increment success counter for provider."""
    llm_provider_success_total.labels(provider=provider).inc()
    llm_provider_health.labels(provider=provider).set(1)


def record_provider_failure(provider: str, reason: str):
    """Increment failure counter and set health to degraded."""
    llm_provider_failure_total.labels(provider=provider, reason=reason).inc()
    llm_provider_health.labels(provider=provider).set(0)


def increment_active_sessions():
    """Increment active sessions count."""
    active_sessions.inc()


def decrement_active_sessions():
    """Decrement active sessions count."""
    active_sessions.dec()


def track_streaming_request(status: str):
    """Track streaming request."""
    streaming_requests_total.labels(status=status).inc()
