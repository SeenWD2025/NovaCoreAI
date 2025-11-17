"""Utility to transform structured note components into Markdown."""
from typing import Iterable, List

from app.models.note import NoteComponent


def _sort_components(components: Iterable[NoteComponent]) -> List[NoteComponent]:
    """Order components by sequence then identifier for deterministic output."""

    return sorted(
        components,
        key=lambda component: (component.sequence, component.component_id),
    )


def build_markdown_from_components(components: Iterable[NoteComponent]) -> str:
    """Create a Markdown string suitable for LLM grounding from note components."""

    ordered_components = _sort_components(components)
    lines: List[str] = []

    for component in ordered_components:
        content = component.content.strip()
        if not content:
            continue

        if component.component_type == "HEADER":
            lines.append(f"# {content}")
        elif component.component_type == "SUBJECT":
            lines.append(f"## {content}")
        elif component.component_type == "DEFINITION":
            lines.append(f"**Definition:** {content}")
        elif component.component_type == "EXAMPLE":
            lines.append(f"> Example: {content}")
        elif component.component_type == "EXPLANATION":
            lines.append(content)
        else:  # Defensive fallback for unexpected component types
            lines.append(content)

    return "\n\n".join(lines).strip()
