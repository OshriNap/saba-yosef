import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.ai.claude_cli import ClaudeCLI

@pytest.mark.asyncio
async def test_generate_suggestions_calls_claude():
    cli = ClaudeCLI()
    mock_response = json.dumps({
        "suggestions": [
            {"title": "הצעה א", "thesis": "תזה", "outline": "...", "sources": [], "linked_news": []}
        ]
    })

    mock_proc = AsyncMock()
    mock_proc.communicate.return_value = (mock_response.encode(), b"")
    mock_proc.returncode = 0

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        result = await cli.generate_suggestions(
            parasha_name="בשלח",
            parasha_text="...",
            news_items=[{"title": "חדשות", "summary": "תקציר"}],
            mefarshim_texts={"rashi": [{"text": "פירוש"}]},
        )
        assert len(result) >= 1
        assert "title" in result[0]

def test_build_suggestion_prompt():
    cli = ClaudeCLI()
    prompt = cli._build_suggestion_prompt(
        parasha_name="בשלח",
        parasha_text="טקסט הפרשה",
        news_items=[{"title": "כותרת", "summary": "תקציר"}],
        mefarshim_texts={"rashi": [{"ref": "Exodus 14:1", "text": "פירוש"}]},
    )
    assert "בשלח" in prompt
    assert "כותרת" in prompt
    assert "rashi" in prompt
