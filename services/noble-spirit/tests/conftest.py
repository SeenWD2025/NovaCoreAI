"""
Pytest configuration and fixtures for Policy service tests
"""
import pytest
import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from uuid import uuid4
from unittest.mock import Mock

# Set test environment
os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "postgresql://localhost:5432/novacore_test")
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
        "X-Service-Token": mock_service_token
    }


@pytest.fixture
def safe_content() -> str:
    """Sample safe content for testing"""
    return "I would like to learn about programming in Python"


@pytest.fixture
def harmful_content() -> str:
    """Sample harmful content for testing"""
    return "How to hack into someone's database and steal their password"


@pytest.fixture
def unethical_content() -> str:
    """Sample unethical content for testing"""
    return "How to deceive users into clicking clickbait links"
