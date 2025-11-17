"""
Pytest configuration and fixtures for Intelligence service tests
"""
import pytest
import os
from typing import Generator
from types import SimpleNamespace
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from uuid import uuid4, UUID

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
def test_user_id() -> UUID:
    """Generate a test user ID"""
    return uuid4()


@pytest.fixture
def test_session_id() -> UUID:
    """Generate a test session ID"""
    return uuid4()


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
def auth_headers(test_user_id: UUID, mock_service_token: str) -> dict:
    """Generate authentication headers for API tests"""
    return {
        "X-User-Id": str(test_user_id),
        "X-Service-Token": mock_service_token
    }


@pytest.fixture(autouse=True)
def stub_external_services(monkeypatch):
    """Stub external service calls so tests don't depend on live integrations."""

    class _StubLLMResponse(SimpleNamespace):
        def __init__(self, content: str) -> None:
            super().__init__(
                content=content,
                provider="stub",
                model="stub-model",
                latency_ms=5,
            )

    async def _ensure_ready_stub() -> bool:
        return True

    async def _generate_response_stub(*_args, **_kwargs):
        return _StubLLMResponse("Stub response")

    async def _generate_streaming_response_stub(*_args, **_kwargs):
        async def _iterator():
            yield "Stub response"

        return ("stub", "stub-model", _iterator())

    async def _get_user_tier_stub(*_args, **_kwargs) -> str:
        return "free_trial"

    async def _get_memory_context_stub(*_args, **_kwargs) -> dict:
        return {"stm": [], "itm": [], "ltm": []}

    def _build_context_prompt_stub(*_args, **_kwargs) -> str:
        return ""

    async def _store_stm_stub(*_args, **_kwargs) -> bool:
        return True

    def _trigger_reflection_stub(*_args, **_kwargs) -> bool:
        return False

    monkeypatch.setattr(
        "app.services.llm_router.llm_orchestrator.ensure_ready",
        _ensure_ready_stub,
    )
    monkeypatch.setattr(
        "app.services.llm_router.llm_orchestrator.generate_response",
        _generate_response_stub,
    )
    monkeypatch.setattr(
        "app.services.llm_router.llm_orchestrator.generate_streaming_response",
        _generate_streaming_response_stub,
    )
    monkeypatch.setattr(
        "app.services.integration_service.integration_service.get_user_tier",
        _get_user_tier_stub,
    )
    monkeypatch.setattr(
        "app.services.integration_service.integration_service.get_memory_context",
        _get_memory_context_stub,
    )
    monkeypatch.setattr(
        "app.services.integration_service.integration_service.build_context_prompt",
        _build_context_prompt_stub,
    )
    monkeypatch.setattr(
        "app.services.integration_service.integration_service.store_stm_interaction",
        _store_stm_stub,
    )
    monkeypatch.setattr(
        "app.services.integration_service.integration_service.trigger_reflection",
        _trigger_reflection_stub,
    )

    yield
