"""
Pytest configuration and fixtures for Reflection Worker tests.
"""
import pytest
from unittest.mock import Mock, patch
import os


@pytest.fixture
def mock_env():
    """Mock environment variables for testing."""
    env_vars = {
        'REDIS_URL': 'redis://localhost:6379',
        'CELERY_BROKER_URL': 'redis://localhost:6379/2',
        'CELERY_RESULT_BACKEND': 'redis://localhost:6379/3',
        'MEMORY_SERVICE_URL': 'http://localhost:8001',
        'POLICY_SERVICE_URL': 'http://localhost:4000',
        'INTELLIGENCE_SERVICE_URL': 'http://localhost:8000',
        'SERVICE_JWT_SECRET': 'test-secret',
    }
    
    with patch.dict(os.environ, env_vars):
        yield env_vars


@pytest.fixture
def sample_interaction():
    """Sample interaction data for testing."""
    return {
        'user_id': '550e8400-e29b-41d4-a716-446655440000',
        'session_id': '660e8400-e29b-41d4-a716-446655440001',
        'input_text': 'How do I implement authentication in my web app?',
        'output_text': 'To implement authentication, you should use JWT tokens with bcrypt for password hashing.',
        'context': {'model': 'mistral:instruct', 'tokens': 150}
    }


@pytest.fixture
def mock_policy_response():
    """Mock response from Policy Service."""
    return {
        'aligned': True,
        'alignment_score': 0.85,
        'principle_scores': {
            'helpfulness': 0.9,
            'harmlessness': 0.8,
            'honesty': 0.85
        },
        'concerns': [],
        'recommendations': ['Consider mentioning rate limiting for security']
    }


@pytest.fixture
def mock_memory_response():
    """Mock response from Memory Service."""
    return {
        'id': '770e8400-e29b-41d4-a716-446655440002',
        'type': 'reflection',
        'tier': 'ltm',
        'confidence_score': 0.85,
        'created_at': '2025-11-17T23:00:00Z'
    }
