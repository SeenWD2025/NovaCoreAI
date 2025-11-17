"""Tests for the Intelligence quiz generation endpoint."""
from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.services.providers.base import ProviderResult


@pytest.fixture
def patched_llm(monkeypatch):
    async def _fake_generate_response(*args: Any, **kwargs: Any) -> ProviderResult:
        return ProviderResult(
            provider="gemini",
            model="models/gemini-2.5-flash-preview-09-2025",
            content='{"quizId": "demo", "questions": [], "provider": "gemini"}',
            latency_ms=123,
        )

    monkeypatch.setattr(
        "app.services.llm_router.llm_orchestrator.generate_response",
        _fake_generate_response,
    )
    yield


def test_generate_quiz_success(client: TestClient, auth_headers: dict, patched_llm) -> None:
    response = client.post(
        "/quiz/generate",
        json={"prompt": "Return valid JSON quiz"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert "quiz" in body
    assert body["quiz"]["quizId"] == "demo"
    assert body["quiz"]["provider"] == "gemini"


def test_generate_quiz_requires_prompt(client: TestClient, auth_headers: dict) -> None:
    response = client.post("/quiz/generate", json={}, headers=auth_headers)
    assert response.status_code == 400
