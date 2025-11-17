"""Tests for Markdown context generation from note components."""
from app.models.note import NoteComponent
from app.utils.context_builder import build_markdown_from_components


def test_build_markdown_from_components_formats_sections() -> None:
    """Context builder outputs structured Markdown in component order."""

    components = [
        NoteComponent(component_id="c2", component_type="SUBJECT", content="Photosynthesis", sequence=1),
        NoteComponent(component_id="c1", component_type="HEADER", content="Biology Module", sequence=0),
        NoteComponent(component_id="c3", component_type="DEFINITION", content="Process converting light to energy", sequence=2),
        NoteComponent(component_id="c4", component_type="EXAMPLE", content="Plants converting sunlight", sequence=3),
        NoteComponent(component_id="c5", component_type="EXPLANATION", content="Chlorophyll absorbs sunlight", sequence=4),
    ]

    markdown = build_markdown_from_components(components)

    expected = (
        "# Biology Module\n\n"
        "## Photosynthesis\n\n"
        "**Definition:** Process converting light to energy\n\n"
        "> Example: Plants converting sunlight\n\n"
        "Chlorophyll absorbs sunlight"
    )
    assert markdown == expected


def test_build_markdown_ignores_blank_components() -> None:
    """Empty component content is skipped in the output."""

    components = [
        NoteComponent(component_id="c1", component_type="HEADER", content="Astronomy", sequence=0),
        NoteComponent(component_id="c2", component_type="EXPLANATION", content="   ", sequence=1),
        NoteComponent(component_id="c3", component_type="EXPLANATION", content="Stars produce light", sequence=2),
    ]

    markdown = build_markdown_from_components(components)

    expected = "# Astronomy\n\nStars produce light"
    assert markdown == expected
