"""Pydantic models representing the structured note context."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class NoteComponent(BaseModel):
    """Discrete component inside a note section."""

    component_id: str = Field(..., alias="id")
    type: str
    text: Optional[str] = None
    html: Optional[str] = None
    bullet_points: Optional[List[str]] = Field(None, alias="bulletPoints")
    code_language: Optional[str] = Field(None, alias="language")
    code: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class NoteSection(BaseModel):
    """Logical section inside a note."""

    section_id: str = Field(..., alias="id")
    heading: Optional[str] = Field(None, alias="title")
    summary: Optional[str] = None
    importance: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    components: List[NoteComponent] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class NoteContext(BaseModel):
    """Aggregated information about a note used for quiz generation."""

    note_id: str = Field(..., alias="id")
    user_id: Optional[str] = Field(None, alias="userId")
    app_id: Optional[str] = Field(None, alias="appId")
    session_id: Optional[str] = Field(None, alias="sessionId")
    title: str
    summary: Optional[str] = None
    topics: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    difficulty: Optional[str] = None
    sections: List[NoteSection] = Field(default_factory=list)
    raw_text: Optional[str] = Field(None, alias="rawText")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True

    @classmethod
    def from_notes_api(cls, note: Dict[str, Any], context_markdown: Optional[str] = None) -> "NoteContext":
        note_id = note.get("noteId") or note.get("id")
        metadata_raw = note.get("metadata") or {}
        metadata = metadata_raw if isinstance(metadata_raw, dict) else {}
        tags = note.get("tags") or []

        topics: List[str] = []
        extra = metadata.get("extra") if isinstance(metadata, dict) else {}
        if isinstance(extra, dict):
            maybe_topics = extra.get("topics")
            if isinstance(maybe_topics, list):
                topics = [str(topic) for topic in maybe_topics]

        sections: List[NoteSection] = []
        components = note.get("components") or []
        for index, component in enumerate(components, start=1):
            component_id = component.get("componentId") or component.get("id") or f"component-{index}"
            comp_metadata_raw = component.get("metadata") or {}
            comp_metadata = comp_metadata_raw if isinstance(comp_metadata_raw, dict) else {}
            heading = comp_metadata.get("heading") or component.get("componentType") or "Section"
            summary = comp_metadata.get("summary") or component.get("content")
            keywords = comp_metadata.get("keywords") if isinstance(comp_metadata.get("keywords"), list) else []

            note_component = NoteComponent(
                id=component_id,
                type=str(component.get("componentType") or "unknown"),
                text=component.get("content"),
                metadata=comp_metadata,
            )

            section = NoteSection(
                id=component_id,
                heading=str(heading),
                summary=str(summary) if summary is not None else None,
                importance=comp_metadata.get("importance"),
                keywords=[str(keyword) for keyword in keywords],
                components=[note_component],
            )
            sections.append(section)

        return cls(
            id=note_id or "unknown-note",
            user_id=note.get("userId"),
            app_id=note.get("appId"),
            session_id=note.get("sessionId"),
            title=str(note.get("title") or "Untitled Note"),
            summary=metadata.get("summary"),
            topics=topics,
            tags=[str(tag) for tag in tags],
            difficulty=metadata.get("difficulty"),
            sections=sections,
            rawText=context_markdown,
            metadata=metadata,
        )
