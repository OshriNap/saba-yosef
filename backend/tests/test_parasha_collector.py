import pytest
from unittest.mock import AsyncMock, patch
from app.collectors.parasha_collector import ParashaCollector

@pytest.mark.asyncio
async def test_get_weekly_parasha():
    mock_hebcal_response = {
        "items": [
            {
                "title": "Parashat Beshalach",
                "category": "parashat",
                "date": "2026-02-14",
                "hebrew": "פרשת בשלח",
                "leyning": {"torah": "Exodus 13:17-17:16"},
            }
        ]
    }
    collector = ParashaCollector()
    with patch.object(collector, "_fetch_hebcal", return_value=mock_hebcal_response):
        result = await collector.get_weekly_parasha()
        assert result["name"] == "פרשת בשלח"
        assert result["ref"] == "Exodus 13:17-17:16"

@pytest.mark.asyncio
async def test_get_parasha_text():
    mock_sefaria_response = {
        "he": ["בראשית ברא אלהים"],
        "ref": "Genesis 1:1",
    }
    collector = ParashaCollector()
    with patch.object(collector, "_fetch_sefaria", return_value=mock_sefaria_response):
        result = await collector.get_parasha_text("Genesis 1:1-1:5")
        assert len(result) > 0

@pytest.mark.asyncio
async def test_get_commentary():
    mock_sefaria_response = {
        "he": ["פירוש רש״י על הפסוק"],
        "ref": "Rashi on Genesis 1:1",
    }
    collector = ParashaCollector()
    with patch.object(collector, "_fetch_sefaria", return_value=mock_sefaria_response):
        result = await collector.get_commentary("Genesis 1:1-1:5", "Rashi")
        assert len(result) > 0
