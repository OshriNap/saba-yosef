import httpx
import feedparser
from bs4 import BeautifulSoup

RSS_FEEDS = {
    "ynet": "https://www.ynet.co.il/Integration/StoryRss2.xml",
    "walla": "https://rss.walla.co.il/feed/1",
    "haaretz": "https://www.haaretz.co.il/cmlink/1.1617539",
    "kan": "https://www.kan.org.il/lobby/kan-news/0/rss",
    "google_news_il": "https://news.google.com/rss?hl=iw&gl=IL&ceid=IL:he",
}

class NewsCollector:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30, follow_redirects=True)

    async def _fetch_feed(self, url: str) -> str:
        resp = await self.client.get(url)
        resp.raise_for_status()
        return resp.text

    def _parse_rss(self, xml_text: str) -> list[dict]:
        feed = feedparser.parse(xml_text)
        items = []
        for entry in feed.entries:
            summary = entry.get("summary", "")
            if summary:
                summary = BeautifulSoup(summary, "html.parser").get_text()
            items.append({
                "title": entry.get("title", ""),
                "summary": summary,
                "link": entry.get("link", ""),
                "published": entry.get("published", ""),
            })
        return items

    def _deduplicate(self, items: list[dict]) -> list[dict]:
        seen_titles = set()
        unique = []
        for item in items:
            normalized = item["title"].strip()
            if normalized not in seen_titles:
                seen_titles.add(normalized)
                unique.append(item)
        return unique

    async def collect(self) -> list[dict]:
        all_items = []
        for source, url in RSS_FEEDS.items():
            try:
                xml = await self._fetch_feed(url)
                items = self._parse_rss(xml)
                for item in items:
                    item["source"] = source
                all_items.extend(items)
            except Exception:
                continue
        return self._deduplicate(all_items)[:20]

    async def close(self):
        await self.client.aclose()
