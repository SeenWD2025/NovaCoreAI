"""Prometheus metrics for Memory Service."""
from prometheus_client import Counter, Histogram, Gauge

# Memory storage operations
memory_storage_total = Counter(
    'memory_storage_total',
    'Total number of memories stored',
    ['tier', 'user_id']
)

memory_retrieval_total = Counter(
    'memory_retrieval_total',
    'Total number of memory retrievals',
    ['tier', 'user_id']
)

memory_search_total = Counter(
    'memory_search_total',
    'Total number of memory searches',
    ['user_id']
)

memory_promotion_total = Counter(
    'memory_promotion_total',
    'Total number of memory tier promotions',
    ['from_tier', 'to_tier']
)

# Performance metrics
vector_search_latency_seconds = Histogram(
    'vector_search_latency_seconds',
    'Latency of vector similarity searches',
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

embedding_generation_latency_seconds = Histogram(
    'embedding_generation_latency_seconds',
    'Latency of embedding generation',
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0]
)

# Memory tier distribution
memory_tier_distribution = Gauge(
    'memory_tier_distribution',
    'Number of memories in each tier',
    ['tier']
)

# Redis metrics
redis_stm_size = Gauge(
    'redis_stm_size',
    'Number of items in Redis STM'
)

redis_itm_size = Gauge(
    'redis_itm_size',
    'Number of items in Redis ITM'
)
