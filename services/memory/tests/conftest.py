"""
Pytest configuration and fixtures for Memory service tests
"""
import pytest
import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from uuid import uuid4
from unittest.mock import Mock, patch
import redis

# Set test environment
os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "postgresql://localhost:5432/novacore_test")
os.environ["REDIS_URL"] = os.getenv("TEST_REDIS_URL", "redis://localhost:6379/1")
os.environ["SERVICE_JWT_SECRET"] = "test-secret-key"

from app.database import Base, get_db
from app.main import app


@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine"""
    database_url = os.getenv("TEST_DATABASE_URL", "postgresql://localhost:5432/novacore_test")
    engine = create_engine(database_url)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    yield engine
    
    # Drop all tables after tests
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    """Create a new database session for each test"""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(scope="function")
def client(db_session) -> TestClient:
    """Create FastAPI test client with database session override"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_id() -> str:
    """Generate a test user ID"""
    return str(uuid4())


@pytest.fixture
def test_session_id() -> str:
    """Generate a test session ID"""
    return str(uuid4())


@pytest.fixture
def mock_service_token() -> str:
    """Generate a mock service token for testing"""
    import jwt
    from datetime import datetime, timedelta
    
    secret = os.getenv("SERVICE_JWT_SECRET", "test-secret")
    payload = {
        "serviceName": "test-service",
        "type": "service",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def auth_headers(test_user_id: str, mock_service_token: str) -> dict:
    """Generate authentication headers for API tests"""
    return {
        "X-User-Id": test_user_id,
        "X-Service-Token": mock_service_token,
        "X-User-Tier": "free_trial"
    }


@pytest.fixture
def mock_redis_client():
    """Mock Redis client for testing"""
    mock = Mock()
    mock.get.return_value = None
    mock.setex.return_value = True
    mock.delete.return_value = True
    mock.keys.return_value = []
    mock.ttl.return_value = 3600
    return mock


@pytest.fixture
def mock_embedding_service():
    """Mock embedding service for testing"""
    with patch('app.services.embedding_service.embedding_service') as mock:
        # Return a fixed 384-dimensional embedding
        mock.generate_embedding.return_value = [0.1] * 384
        mock.health_check.return_value = {
            "model_loaded": True,
            "model_name": "test-model"
        }
        yield mock


@pytest.fixture
def sample_memory_data():
    """Sample memory data for testing"""
    return {
        "type": "conversation",
        "input_context": "What is the capital of France?",
        "output_response": "The capital of France is Paris.",
        "outcome": "success",
        "emotional_weight": 0.8,
        "confidence_score": 0.95,
        "tags": ["geography", "capitals"],
        "tier": "stm"
    }
