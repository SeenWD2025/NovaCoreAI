"""Basic health endpoint tests for the Notes API."""
from typing import Generator
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_notes_service
from main import app


class StubNotesService:
    """Minimal stub satisfying health dependency for tests."""

    def __init__(self) -> None:
        self.healthy = AsyncMock(return_value=True)


@pytest.fixture(autouse=True)
def reset_dependency_overrides() -> Generator[None, None, None]:
    """Ensure dependency overrides are cleared between tests."""

    app.dependency_overrides = {}
    yield
    app.dependency_overrides = {}


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Return a TestClient configured with stubbed dependencies."""

    app.dependency_overrides[get_notes_service] = lambda: StubNotesService()
    with TestClient(app) as test_client:
        yield test_client


def test_health_endpoint_reports_healthy(client: TestClient) -> None:
    """Health endpoint returns healthy when dependencies succeed."""

    with patch("main.healthcheck", return_value=True):
        response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["components"]["database"] is True
    assert payload["components"]["repository"] is True


def test_health_endpoint_reports_degraded_when_database_fails(client: TestClient) -> None:
    """Health endpoint returns degraded when the database is unavailable."""

    with patch("main.healthcheck", return_value=False):
        response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "degraded"
    assert payload["components"]["database"] is False
