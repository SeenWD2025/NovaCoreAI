"""Client for interacting with the Nova Notes API."""
from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from ..models.note_context import NoteContext
from ..utils.errors import NotesServiceError


class NotesApiClient:
    """Fetch structured note context from the Notes API."""

    def __init__(self, base_url: str, timeout_seconds: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    async def _request(self, method: str, path: str) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            try:
                response = await client.request(method, url)
            except httpx.HTTPError as exc:  # pragma: no cover - network error path
                raise NotesServiceError(599, str(exc)) from exc
        if response.status_code >= 400:
            raise NotesServiceError(response.status_code, response.text)
        try:
            return response.json()
        except ValueError as exc:  # pragma: no cover - invalid JSON path
            raise NotesServiceError(response.status_code, "Invalid JSON from Notes API") from exc

    async def fetch_note(self, note_id: str) -> Dict[str, Any]:
        return await self._request("GET", f"/notes/{note_id}")

    async def fetch_note_context(self, note_id: str) -> Optional[str]:
        data = await self._request("GET", f"/notes/{note_id}/context")
        return data.get("contextMarkdown")

    async def get_note_context(self, note_id: str) -> NoteContext:
        note = await self.fetch_note(note_id)
        markdown = await self.fetch_note_context(note_id)
        return NoteContext.from_notes_api(note, markdown)


__all__ = ["NotesApiClient"]
