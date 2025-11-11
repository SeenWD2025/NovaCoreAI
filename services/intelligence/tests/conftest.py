"""
Pytest configuration and fixtures for Intelligence service tests
"""
import pytest
import os
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from uuid import uuid4

# Set test environment
os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "postgresql://localhost:5432/novacore_test")
os.environ["REDIS_URL"] = os.getenv("TEST_REDIS_URL", "redis://localhost:6379/1")

from app.database import get_db

# Import app from root main.py
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from main import app


@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine"""
    database_url = os.getenv("TEST_DATABASE_URL", "postgresql://localhost:5432/novacore_test")
    engine = create_engine(database_url)
    
    # Create usage_ledger table for tests if it doesn't exist
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usage_ledger (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                resource_type VARCHAR(50) NOT NULL,
                amount INTEGER NOT NULL,
                metadata JSONB,
                timestamp TIMESTAMP NOT NULL DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_date 
            ON usage_ledger(user_id, DATE(timestamp));
        """))
        conn.commit()
    
    yield engine
    
    # Clean up tables after tests
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS usage_ledger CASCADE;"))
        conn.commit()
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
        "X-Service-Token": mock_service_token
    }
