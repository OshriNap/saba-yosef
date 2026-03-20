import pytest
from unittest.mock import patch, AsyncMock
from app.collectors.news_collector import NewsCollector

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<item>
<title>כותרת חדשות ראשונה</title>
<description>תקציר הכתבה הראשונה</description>
<link>https://example.com/1</link>
<pubDate>Thu, 19 Mar 2026 10:00:00 +0200</pubDate>
</item>
<item>
<title>כותרת חדשות שנייה</title>
<description>תקציר הכתבה השנייה</description>
<link>https://example.com/2</link>
<pubDate>Thu, 19 Mar 2026 09:00:00 +0200</pubDate>
</item>
</channel>
</rss>"""

@pytest.mark.asyncio
async def test_parse_rss_feed():
    collector = NewsCollector()
    items = collector._parse_rss(SAMPLE_RSS)
    assert len(items) == 2
    assert items[0]["title"] == "כותרת חדשות ראשונה"
    assert "תקציר" in items[0]["summary"]

@pytest.mark.asyncio
async def test_collect_news_returns_items():
    collector = NewsCollector()
    with patch.object(collector, "_fetch_feed", return_value=SAMPLE_RSS):
        items = await collector.collect()
        assert len(items) >= 1
        assert all("title" in item for item in items)

@pytest.mark.asyncio
async def test_deduplicate_news():
    collector = NewsCollector()
    items = [
        {"title": "כותרת זהה", "summary": "תקציר א", "source": "ynet"},
        {"title": "כותרת זהה", "summary": "תקציר ב", "source": "walla"},
        {"title": "כותרת אחרת", "summary": "תקציר ג", "source": "haaretz"},
    ]
    deduped = collector._deduplicate(items)
    assert len(deduped) == 2
