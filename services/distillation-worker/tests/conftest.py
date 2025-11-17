"""
Pytest configuration and fixtures for Distillation Worker tests.
"""
import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timedelta
import os


@pytest.fixture
def mock_env():
    """Mock environment variables for testing."""
    env_vars = {
        'DATABASE_URL': 'postgresql://test:test@localhost:5432/test_db',
        'MEMORY_SERVICE_URL': 'http://localhost:8001',
        'POLICY_SERVICE_URL': 'http://localhost:4000',
        'LTM_PROMOTION_THRESHOLD': '3',
        'SERVICE_JWT_SECRET': 'test-secret',
    }
    
    with patch.dict(os.environ, env_vars):
        yield env_vars


@pytest.fixture
def sample_reflections():
    """Sample reflection data for testing."""
    base_time = datetime.utcnow() - timedelta(hours=12)
    
    return [
        {
            'id': 'reflection-1',
            'user_id': 'user-123',
            'type': 'reflection',
            'tier': 'ltm',
            'tags': ['authentication', 'security'],
            'emotional_weight': 0.5,
            'confidence_score': 0.8,
            'outcome': 'success',
            'created_at': base_time
        },
        {
            'id': 'reflection-2',
            'user_id': 'user-123',
            'type': 'reflection',
            'tier': 'ltm',
            'tags': ['authentication', 'jwt'],
            'emotional_weight': 0.3,
            'confidence_score': 0.85,
            'outcome': 'success',
            'created_at': base_time + timedelta(hours=2)
        },
        {
            'id': 'reflection-3',
            'user_id': 'user-123',
            'type': 'reflection',
            'tier': 'ltm',
            'tags': ['database', 'sql'],
            'emotional_weight': -0.2,
            'confidence_score': 0.6,
            'outcome': 'failure',
            'created_at': base_time + timedelta(hours=4)
        }
    ]


@pytest.fixture
def sample_itm_memories():
    """Sample ITM memories for promotion testing."""
    return [
        {
            'id': 'memory-1',
            'user_id': 'user-123',
            'tier': 'itm',
            'type': 'conversation',
            'access_count': 5,
            'confidence_score': 0.8,
            'constitution_valid': True
        },
        {
            'id': 'memory-2',
            'user_id': 'user-123',
            'tier': 'itm',
            'type': 'conversation',
            'access_count': 2,
            'confidence_score': 0.7,
            'constitution_valid': True
        }
    ]
