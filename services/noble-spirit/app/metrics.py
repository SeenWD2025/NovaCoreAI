"""Prometheus metrics for Policy Service."""
from prometheus_client import Counter, Histogram

# Policy validation operations
policy_validation_total = Counter(
    'policy_validation_total',
    'Total number of policy validations',
    ['result', 'user_id']  # result: 'valid' or 'invalid'
)

policy_alignment_check_total = Counter(
    'policy_alignment_check_total',
    'Total number of alignment checks',
    ['user_id']
)

# Alignment score distribution
alignment_score_histogram = Histogram(
    'alignment_score',
    'Distribution of alignment scores',
    buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

# Policy violations
policy_violation_total = Counter(
    'policy_violation_total',
    'Total number of policy violations detected',
    ['violation_type']
)

# Audit events
audit_event_total = Counter(
    'audit_event_total',
    'Total number of audit events logged',
    ['event_type']
)
