"""
Configuration for integration tests
"""
import pytest
import asyncio


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def base_url():
    """Base URL for the API Gateway"""
    return "http://localhost:5000"


@pytest.fixture
def test_user_data():
    """Generate test user data"""
    from uuid import uuid4
    return {
        "email": f"test-{uuid4()}@example.com",
        "password": "TestPass123!",
        "name": "Test User"
    }


@pytest.fixture
def session_id():
    """Generate a unique session ID"""
    from uuid import uuid4
    return str(uuid4())
