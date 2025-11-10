"""Prometheus metrics for Intelligence Service."""
from prometheus_client import Counter, Histogram, Gauge

# Chat operations
chat_messages_total = Counter(
    'chat_messages_total',
    'Total number of chat messages processed',
    ['user_id', 'session_type']  # session_type: 'standard' or 'streaming'
)

chat_tokens_total = Counter(
    'chat_tokens_total',
    'Total number of tokens processed',
    ['type']  # type: 'input' or 'output'
)

# Ollama performance
ollama_latency_seconds = Histogram(
    'ollama_latency_seconds',
    'Latency of Ollama inference requests',
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
)

ollama_request_total = Counter(
    'ollama_request_total',
    'Total number of Ollama requests',
    ['status']  # status: 'success' or 'error'
)

# Memory context metrics
memory_context_size = Gauge(
    'memory_context_size',
    'Number of memory items in current context',
    ['session_id']
)

memory_context_tokens = Histogram(
    'memory_context_tokens',
    'Number of tokens used for memory context',
    buckets=[0, 100, 500, 1000, 2000, 4000, 8000]
)

# Session metrics
active_sessions = Gauge(
    'active_sessions',
    'Number of active chat sessions'
)

session_duration_seconds = Histogram(
    'session_duration_seconds',
    'Duration of chat sessions',
    buckets=[60, 300, 600, 1800, 3600, 7200]  # 1min to 2hrs
)
