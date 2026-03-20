# Dvar Torah Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a weekly Dvar Torah agent that collects Israeli news + Parasha + mefarshim, generates suggestions via Claude CLI, provides a rich Hebrew editor, and outputs a printable Daf Mekorot PDF.

**Architecture:** Python/FastAPI backend handles data collection, Claude CLI orchestration, and PDF generation. React/TypeScript frontend provides RTL Hebrew UI with Tiptap editor and chat sidebar. SQLite for persistence.

**Tech Stack:** Python 3.12+, FastAPI, SQLModel, SQLite, WeasyPrint, React 18, TypeScript, Vite, Tiptap, Tailwind CSS, Claude CLI

**Spec:** `docs/superpowers/specs/2026-03-20-dvar-tora-agent-design.md`

---

## Task 1: Backend Project Setup

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/collectors/__init__.py`
- Create: `backend/app/ai/__init__.py`
- Create: `backend/app/pdf/__init__.py`
- Create: `backend/cron/__init__.py`

- [ ] **Step 1: Create pyproject.toml with dependencies**

```toml
[project]
name = "dvar-tora-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "sqlmodel>=0.0.22",
    "httpx>=0.27",
    "feedparser>=6.0",
    "beautifulsoup4>=4.12",
    "weasyprint>=62",
    "jinja2>=3.1",
    "python-dateutil>=2.9",
]

[project.optional-dependencies]
dev = ["pytest>=8", "pytest-asyncio>=0.24", "pytest-httpx>=0.34"]

[build-system]
requires = ["setuptools>=75"]
build-backend = "setuptools.backends._legacy:_Backend"
```

- [ ] **Step 2: Create FastAPI app entry point**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Dvar Torah Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 3: Create all `__init__.py` files for packages**

Empty `__init__.py` in: `app/`, `app/api/`, `app/collectors/`, `app/ai/`, `app/pdf/`, `cron/`

- [ ] **Step 4: Install and verify**

```bash
cd backend && pip install -e ".[dev]"
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
curl http://localhost:8000/api/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend with FastAPI"
```

---

## Task 2: Database Models

**Files:**
- Create: `backend/app/models.py`
- Create: `backend/app/database.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write test for models**

```python
# backend/tests/test_models.py
from sqlmodel import Session, SQLModel, create_engine
from app.models import UserProfile, WeeklyCollection, DvarToraSuggestion, DvarTora

def test_create_user_profile():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        profile = UserProfile(
            mefarshim_category="pshat",
            selected_mefarshim=["rashi", "ramban", "ibn_ezra"],
        )
        session.add(profile)
        session.commit()
        session.refresh(profile)
        assert profile.id is not None
        assert profile.mefarshim_category == "pshat"

def test_create_weekly_collection():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        collection = WeeklyCollection(
            parasha_name="בשלח",
            parasha_ref="Exodus 13:17-17:16",
            hebrew_date="כ״ב שבט תשפ״ו",
            gregorian_date="2026-02-14",
            status="collected",
            news_items=[{"title": "test", "summary": "test"}],
            mefarshim_texts={"rashi": [{"ref": "Exodus 14:1", "text": "..."}]},
            parasha_text="...",
        )
        session.add(collection)
        session.commit()
        session.refresh(collection)
        assert collection.id is not None
        assert collection.parasha_name == "בשלח"

def test_create_dvar_tora_suggestion():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        collection = WeeklyCollection(
            parasha_name="בשלח",
            parasha_ref="Exodus 13:17-17:16",
            hebrew_date="כ״ב שבט",
            gregorian_date="2026-02-14",
            status="collected",
            news_items=[],
            mefarshim_texts={},
            parasha_text="...",
        )
        session.add(collection)
        session.commit()
        session.refresh(collection)
        suggestion = DvarToraSuggestion(
            collection_id=collection.id,
            title="בין חדשות לבשורות",
            thesis="קריעת ים סוף כמטאפורה",
            outline="...",
            sources=[{"mefaresh": "rashi", "ref": "Exodus 14:15"}],
            linked_news_themes=["politics"],
        )
        session.add(suggestion)
        session.commit()
        assert suggestion.id is not None

def test_create_dvar_tora():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        collection = WeeklyCollection(
            parasha_name="בשלח",
            parasha_ref="Exodus 13:17-17:16",
            hebrew_date="כ״ב שבט",
            gregorian_date="2026-02-14",
            status="collected",
            news_items=[],
            mefarshim_texts={},
            parasha_text="...",
        )
        session.add(collection)
        session.commit()
        session.refresh(collection)
        dvar = DvarTora(
            collection_id=collection.id,
            title="בין חדשות לבשורות",
            content="<p>גוף דבר התורה</p>",
            status="draft",
            sources=[{"mefaresh": "rashi", "ref": "Exodus 14:15", "text": "..."}],
        )
        session.add(dvar)
        session.commit()
        assert dvar.status == "draft"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_models.py -v
# Expected: FAIL — ModuleNotFoundError: No module named 'app.models'
```

- [ ] **Step 3: Implement models**

```python
# backend/app/models.py
from datetime import date
from typing import Optional
from sqlmodel import SQLModel, Field, JSON, Column

class UserProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    mefarshim_category: str = "pshat"  # pshat, hasidic, bikoret, mixed
    selected_mefarshim: list[str] = Field(default=[], sa_column=Column(JSON))

class WeeklyCollection(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    parasha_name: str
    parasha_ref: str
    hebrew_date: str
    gregorian_date: str
    status: str = "pending"  # pending, collecting, collected, error
    news_items: list[dict] = Field(default=[], sa_column=Column(JSON))
    mefarshim_texts: dict = Field(default={}, sa_column=Column(JSON))
    parasha_text: str = ""

class DvarToraSuggestion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    collection_id: int = Field(foreign_key="weeklycollection.id")
    title: str
    thesis: str
    outline: str
    sources: list[dict] = Field(default=[], sa_column=Column(JSON))
    linked_news_themes: list[str] = Field(default=[], sa_column=Column(JSON))

class DvarTora(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    collection_id: int = Field(foreign_key="weeklycollection.id")
    suggestion_id: Optional[int] = Field(default=None, foreign_key="dvartorasuggestion.id")
    title: str
    content: str = ""
    status: str = "draft"  # draft, final
    sources: list[dict] = Field(default=[], sa_column=Column(JSON))
```

- [ ] **Step 4: Create database module**

```python
# backend/app/database.py
from pathlib import Path
from sqlmodel import SQLModel, Session, create_engine

DB_PATH = Path(__file__).parent.parent / "data" / "dvar_tora.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_models.py -v
# Expected: 4 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py backend/app/database.py backend/tests/
git commit -m "feat: add database models for weekly collections, suggestions, and dvar tora"
```

---

## Task 3: Parasha Collector (Hebcal + Sefaria)

**Files:**
- Create: `backend/app/collectors/parasha_collector.py`
- Create: `backend/tests/test_parasha_collector.py`

- [ ] **Step 1: Write tests**

```python
# backend/tests/test_parasha_collector.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_parasha_collector.py -v
# Expected: FAIL
```

- [ ] **Step 3: Implement ParashaCollector**

```python
# backend/app/collectors/parasha_collector.py
import httpx
from datetime import date, timedelta

HEBCAL_BASE = "https://www.hebcal.com/shabbat"
SEFARIA_BASE = "https://www.sefaria.org/api"

MEFARSHIM_MAP = {
    "pshat": ["Rashi", "Ramban", "Ibn Ezra", "Sforno", "Rashbam", "Or HaChaim"],
    "hasidic": ["Sefat Emet", "Netivot Shalom", "Mei HaShiloach", "Kedushat Levi", "Noam Elimelech"],
    "bikoret": [],
}

class ParashaCollector:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30)

    async def _fetch_hebcal(self, params: dict) -> dict:
        resp = await self.client.get(HEBCAL_BASE, params=params)
        resp.raise_for_status()
        return resp.json()

    async def _fetch_sefaria(self, ref: str, params: dict | None = None) -> dict:
        url = f"{SEFARIA_BASE}/texts/{ref}"
        resp = await self.client.get(url, params=params or {})
        resp.raise_for_status()
        return resp.json()

    async def get_weekly_parasha(self) -> dict:
        """Get this week's Parasha from Hebcal."""
        next_saturday = date.today() + timedelta(days=(5 - date.today().weekday()) % 7 + 1)
        params = {
            "cfg": "json",
            "geonameid": "293397",  # Tel Aviv
            "M": "on",
        }
        data = await self._fetch_hebcal(params)
        for item in data.get("items", []):
            if item.get("category") == "parashat":
                return {
                    "name": item.get("hebrew", item["title"]),
                    "name_en": item["title"],
                    "ref": item.get("leyning", {}).get("torah", ""),
                    "date": item.get("date", ""),
                    "hebrew_date": item.get("hdate", ""),
                }
        raise ValueError("No parasha found for this week")

    async def get_parasha_text(self, ref: str) -> list[dict]:
        """Get Torah text for a Parasha reference from Sefaria."""
        data = await self._fetch_sefaria(ref, {"context": "0", "pad": "0"})
        he_texts = data.get("he", [])
        if isinstance(he_texts, str):
            he_texts = [he_texts]
        # Flatten nested lists
        flat = []
        def _flatten(lst, depth=0):
            for item in lst:
                if isinstance(item, list):
                    _flatten(item, depth + 1)
                else:
                    flat.append(item)
        _flatten(he_texts)
        return [{"ref": data.get("ref", ref), "text": t} for t in flat if t]

    async def get_commentary(self, parasha_ref: str, mefaresh: str) -> list[dict]:
        """Get commentary on a Parasha from a specific mefaresh via Sefaria."""
        commentary_ref = f"{mefaresh} on {parasha_ref}"
        try:
            data = await self._fetch_sefaria(commentary_ref, {"context": "0", "pad": "0"})
        except httpx.HTTPStatusError:
            return []
        he_texts = data.get("he", [])
        if isinstance(he_texts, str):
            he_texts = [he_texts]
        flat = []
        def _flatten(lst):
            for item in lst:
                if isinstance(item, list):
                    _flatten(item)
                else:
                    flat.append(item)
        _flatten(he_texts)
        return [{"mefaresh": mefaresh, "ref": data.get("ref", commentary_ref), "text": t} for t in flat if t]

    async def collect_mefarshim(self, parasha_ref: str, mefarshim_list: list[str]) -> dict[str, list[dict]]:
        """Collect commentaries from multiple mefarshim."""
        result = {}
        for mefaresh in mefarshim_list:
            result[mefaresh] = await self.get_commentary(parasha_ref, mefaresh)
        return result

    async def close(self):
        await self.client.aclose()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_parasha_collector.py -v
# Expected: 3 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/collectors/parasha_collector.py backend/tests/test_parasha_collector.py
git commit -m "feat: add Parasha collector with Hebcal and Sefaria integration"
```

---

## Task 4: News Collector

**Files:**
- Create: `backend/app/collectors/news_collector.py`
- Create: `backend/tests/test_news_collector.py`

- [ ] **Step 1: Write tests**

```python
# backend/tests/test_news_collector.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_news_collector.py -v
# Expected: FAIL
```

- [ ] **Step 3: Implement NewsCollector**

```python
# backend/app/collectors/news_collector.py
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
        """Collect news from all RSS feeds, deduplicate, return top items."""
        all_items = []
        for source, url in RSS_FEEDS.items():
            try:
                xml = await self._fetch_feed(url)
                items = self._parse_rss(xml)
                for item in items:
                    item["source"] = source
                all_items.extend(items)
            except Exception:
                continue  # Skip failing feeds
        return self._deduplicate(all_items)[:20]

    async def close(self):
        await self.client.aclose()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_news_collector.py -v
# Expected: 3 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/collectors/news_collector.py backend/tests/test_news_collector.py
git commit -m "feat: add news collector with RSS feeds and deduplication"
```

---

## Task 5: Claude CLI Wrapper

**Files:**
- Create: `backend/app/ai/claude_cli.py`
- Create: `backend/app/ai/prompts.py`
- Create: `backend/tests/test_claude_cli.py`

- [ ] **Step 1: Write tests**

```python
# backend/tests/test_claude_cli.py
import json
import pytest
from unittest.mock import patch, MagicMock
from app.ai.claude_cli import ClaudeCLI

@pytest.mark.asyncio
async def test_generate_suggestions_calls_claude():
    cli = ClaudeCLI()
    mock_result = MagicMock()
    mock_result.stdout = json.dumps({
        "suggestions": [
            {"title": "הצעה א", "thesis": "תזה", "outline": "...", "sources": [], "linked_news": []}
        ]
    })
    mock_result.returncode = 0
    with patch("asyncio.create_subprocess_exec", return_value=MagicMock(
        communicate=MagicMock(return_value=(mock_result.stdout.encode(), b"")),
        returncode=0,
    )):
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_claude_cli.py -v
# Expected: FAIL
```

- [ ] **Step 3: Create prompt templates**

```python
# backend/app/ai/prompts.py
SYSTEM_PROMPT = """אתה עוזר בהכנת דבר תורה לשבת. אתה כותב בעברית בלבד.
תפקידך לחבר בין אקטואליה ישראלית לבין פרשת השבוע, תוך שימוש במפרשים.
ציין מקורות מדויקים (שם הספר, פרק, פסוק/סעיף).
"""

SUGGESTION_PROMPT_TEMPLATE = """# פרשת {parasha_name}

## טקסט הפרשה
{parasha_text}

## חדשות השבוע בישראל
{news_section}

## מפרשים
{mefarshim_section}

## הנחיות
צור 5 הצעות לדבר תורה שמחבר בין החדשות לפרשה דרך המפרשים.
לכל הצעה תן:
- כותרת (קצרה וקולעת)
- תזה (משפט אחד שמסכם את הרעיון המרכזי)
- מתאר (3-4 משפטים שמסבירים את הקשר)
- מקורות (רשימת מפרשים ופסוקים רלוונטיים)
- נושאי חדשות מקושרים

החזר את התוצאה כ-JSON בפורמט:
{{"suggestions": [{{"title": "...", "thesis": "...", "outline": "...", "sources": [{{"mefaresh": "...", "ref": "..."}}], "linked_news": ["..."]}}]}}
"""

EXPAND_PROMPT_TEMPLATE = """# הרחב דבר תורה

## ההצעה שנבחרה
כותרת: {title}
תזה: {thesis}
מתאר: {outline}

## מקורות
{sources_section}

## טקסט הפרשה
{parasha_text}

## הנחיות
כתוב דבר תורה מלא בעברית על בסיס ההצעה.
- פתח עם הקשר אקטואלי
- חבר לפרשה
- הבא ציטוטים מהמפרשים
- סיים עם מסר או תובנה
- אורך: 500-800 מילים
"""

CHAT_PROMPT_TEMPLATE = """# עריכת דבר תורה

## הטקסט הנוכחי
{current_text}

## בקשת המשתמש
{user_request}

## הנחיות
עדכן את דבר התורה לפי בקשת המשתמש. החזר את הטקסט המעודכן בלבד.
"""
```

- [ ] **Step 4: Implement ClaudeCLI**

```python
# backend/app/ai/claude_cli.py
import asyncio
import json
from app.ai.prompts import (
    SYSTEM_PROMPT,
    SUGGESTION_PROMPT_TEMPLATE,
    EXPAND_PROMPT_TEMPLATE,
    CHAT_PROMPT_TEMPLATE,
)

class ClaudeCLI:
    async def _run_claude(self, prompt: str, session_id: str | None = None) -> str:
        cmd = ["claude", "--print", "-p", prompt]
        if session_id:
            cmd = ["claude", "--print", "--session-id", session_id, "-p", prompt]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"Claude CLI failed: {stderr.decode()}")
        return stdout.decode()

    def _build_suggestion_prompt(
        self,
        parasha_name: str,
        parasha_text: str,
        news_items: list[dict],
        mefarshim_texts: dict[str, list[dict]],
    ) -> str:
        news_section = "\n".join(
            f"- {item['title']}: {item.get('summary', '')}" for item in news_items
        )
        mefarshim_section = ""
        for mefaresh, texts in mefarshim_texts.items():
            mefarshim_section += f"\n### {mefaresh}\n"
            for t in texts[:10]:  # Limit to avoid huge prompts
                mefarshim_section += f"- {t.get('ref', '')}: {t.get('text', '')[:200]}\n"
        return SUGGESTION_PROMPT_TEMPLATE.format(
            parasha_name=parasha_name,
            parasha_text=parasha_text[:2000],
            news_section=news_section,
            mefarshim_section=mefarshim_section,
        )

    async def generate_suggestions(
        self,
        parasha_name: str,
        parasha_text: str,
        news_items: list[dict],
        mefarshim_texts: dict[str, list[dict]],
    ) -> list[dict]:
        prompt = self._build_suggestion_prompt(
            parasha_name, parasha_text, news_items, mefarshim_texts
        )
        raw = await self._run_claude(prompt)
        # Try to extract JSON from response
        try:
            # Find JSON block in response
            start = raw.index("{")
            end = raw.rindex("}") + 1
            data = json.loads(raw[start:end])
            return data.get("suggestions", [])
        except (ValueError, json.JSONDecodeError):
            return [{"title": "שגיאה בפענוח", "thesis": raw[:200], "outline": "", "sources": [], "linked_news": []}]

    async def expand_suggestion(
        self,
        title: str,
        thesis: str,
        outline: str,
        sources: list[dict],
        parasha_text: str,
        session_id: str,
    ) -> str:
        sources_section = "\n".join(
            f"- {s.get('mefaresh', '')}: {s.get('ref', '')}" for s in sources
        )
        prompt = EXPAND_PROMPT_TEMPLATE.format(
            title=title,
            thesis=thesis,
            outline=outline,
            sources_section=sources_section,
            parasha_text=parasha_text[:2000],
        )
        return await self._run_claude(prompt, session_id=session_id)

    async def chat_edit(
        self,
        current_text: str,
        user_request: str,
        session_id: str,
    ) -> str:
        prompt = CHAT_PROMPT_TEMPLATE.format(
            current_text=current_text,
            user_request=user_request,
        )
        return await self._run_claude(prompt, session_id=session_id)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_claude_cli.py -v
# Expected: 2 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/ai/
git commit -m "feat: add Claude CLI wrapper with Hebrew prompt templates"
```

---

## Task 6: Backend API Endpoints

**Files:**
- Create: `backend/app/api/parasha.py`
- Create: `backend/app/api/news.py`
- Create: `backend/app/api/dvar_tora.py`
- Create: `backend/app/api/pdf.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Write tests for API endpoints**

```python
# backend/tests/test_api.py
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from app.main import app
from app.database import get_session
from app.models import WeeklyCollection, DvarToraSuggestion, DvarTora

@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s

@pytest.fixture
def client(session):
    def override():
        yield session
    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()

@pytest.fixture
def sample_collection(session):
    c = WeeklyCollection(
        parasha_name="בשלח",
        parasha_ref="Exodus 13:17-17:16",
        hebrew_date="כ״ב שבט",
        gregorian_date="2026-02-14",
        status="collected",
        news_items=[{"title": "חדשות", "summary": "תקציר"}],
        mefarshim_texts={"rashi": [{"ref": "Ex 14:1", "text": "פירוש"}]},
        parasha_text="טקסט",
    )
    session.add(c)
    session.commit()
    session.refresh(c)
    return c

def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200

def test_get_current_week_no_data(client):
    resp = client.get("/api/parasha/current")
    assert resp.status_code == 404

def test_get_current_week_with_data(client, sample_collection):
    resp = client.get("/api/parasha/current")
    assert resp.status_code == 200
    assert resp.json()["parasha_name"] == "בשלח"

def test_get_suggestions(client, sample_collection, session):
    s = DvarToraSuggestion(
        collection_id=sample_collection.id,
        title="הצעה",
        thesis="תזה",
        outline="מתאר",
        sources=[],
        linked_news_themes=[],
    )
    session.add(s)
    session.commit()
    resp = client.get(f"/api/dvar-tora/suggestions/{sample_collection.id}")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

def test_create_dvar_tora(client, sample_collection):
    resp = client.post("/api/dvar-tora/", json={
        "collection_id": sample_collection.id,
        "title": "דבר תורה",
        "content": "<p>תוכן</p>",
    })
    assert resp.status_code == 201

def test_update_dvar_tora(client, sample_collection, session):
    dvar = DvarTora(
        collection_id=sample_collection.id,
        title="דבר תורה",
        content="<p>תוכן</p>",
        status="draft",
        sources=[],
    )
    session.add(dvar)
    session.commit()
    session.refresh(dvar)
    resp = client.patch(f"/api/dvar-tora/{dvar.id}", json={"content": "<p>תוכן מעודכן</p>"})
    assert resp.status_code == 200
    assert "מעודכן" in resp.json()["content"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_api.py -v
# Expected: FAIL
```

- [ ] **Step 3: Implement API routers**

```python
# backend/app/api/parasha.py
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database import get_session
from app.models import WeeklyCollection

router = APIRouter(prefix="/api/parasha", tags=["parasha"])

@router.get("/current")
def get_current_week(session: Session = Depends(get_session)):
    stmt = select(WeeklyCollection).order_by(WeeklyCollection.id.desc())
    collection = session.exec(stmt).first()
    if not collection:
        raise HTTPException(status_code=404, detail="No collection found")
    return collection
```

```python
# backend/app/api/news.py
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database import get_session
from app.models import WeeklyCollection

router = APIRouter(prefix="/api/news", tags=["news"])

@router.get("/{collection_id}")
def get_news(collection_id: int, session: Session = Depends(get_session)):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection.news_items
```

```python
# backend/app/api/dvar_tora.py
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models import DvarToraSuggestion, DvarTora, WeeklyCollection
from app.ai.claude_cli import ClaudeCLI

router = APIRouter(prefix="/api/dvar-tora", tags=["dvar-tora"])
claude = ClaudeCLI()

@router.get("/suggestions/{collection_id}")
def get_suggestions(collection_id: int, session: Session = Depends(get_session)):
    stmt = select(DvarToraSuggestion).where(DvarToraSuggestion.collection_id == collection_id)
    return session.exec(stmt).all()

@router.post("/suggestions/{collection_id}/generate")
async def generate_suggestions(collection_id: int, session: Session = Depends(get_session)):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    suggestions = await claude.generate_suggestions(
        parasha_name=collection.parasha_name,
        parasha_text=collection.parasha_text,
        news_items=collection.news_items,
        mefarshim_texts=collection.mefarshim_texts,
    )
    result = []
    for s in suggestions:
        suggestion = DvarToraSuggestion(
            collection_id=collection_id,
            title=s.get("title", ""),
            thesis=s.get("thesis", ""),
            outline=s.get("outline", ""),
            sources=s.get("sources", []),
            linked_news_themes=s.get("linked_news", []),
        )
        session.add(suggestion)
        result.append(suggestion)
    session.commit()
    for s in result:
        session.refresh(s)
    return result

class DvarToraCreate(BaseModel):
    collection_id: int
    suggestion_id: int | None = None
    title: str
    content: str = ""

class DvarToraUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    status: str | None = None
    sources: list[dict] | None = None

@router.post("/", status_code=201)
def create_dvar_tora(data: DvarToraCreate, session: Session = Depends(get_session)):
    dvar = DvarTora(
        collection_id=data.collection_id,
        suggestion_id=data.suggestion_id,
        title=data.title,
        content=data.content,
        sources=[],
    )
    session.add(dvar)
    session.commit()
    session.refresh(dvar)
    return dvar

@router.patch("/{dvar_id}")
def update_dvar_tora(dvar_id: int, data: DvarToraUpdate, session: Session = Depends(get_session)):
    dvar = session.get(DvarTora, dvar_id)
    if not dvar:
        raise HTTPException(status_code=404, detail="Dvar Torah not found")
    if data.title is not None:
        dvar.title = data.title
    if data.content is not None:
        dvar.content = data.content
    if data.status is not None:
        dvar.status = data.status
    if data.sources is not None:
        dvar.sources = data.sources
    session.add(dvar)
    session.commit()
    session.refresh(dvar)
    return dvar

@router.get("/{dvar_id}")
def get_dvar_tora(dvar_id: int, session: Session = Depends(get_session)):
    dvar = session.get(DvarTora, dvar_id)
    if not dvar:
        raise HTTPException(status_code=404, detail="Dvar Torah not found")
    return dvar

class ChatRequest(BaseModel):
    current_text: str
    user_request: str
    session_id: str

@router.post("/chat")
async def chat_edit(data: ChatRequest):
    result = await claude.chat_edit(
        current_text=data.current_text,
        user_request=data.user_request,
        session_id=data.session_id,
    )
    return {"updated_text": result}

@router.post("/expand/{suggestion_id}")
async def expand_suggestion(suggestion_id: int, session: Session = Depends(get_session)):
    suggestion = session.get(DvarToraSuggestion, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    collection = session.get(WeeklyCollection, suggestion.collection_id)
    session_id = f"week-{collection.id}"
    text = await claude.expand_suggestion(
        title=suggestion.title,
        thesis=suggestion.thesis,
        outline=suggestion.outline,
        sources=suggestion.sources,
        parasha_text=collection.parasha_text,
        session_id=session_id,
    )
    dvar = DvarTora(
        collection_id=collection.id,
        suggestion_id=suggestion_id,
        title=suggestion.title,
        content=text,
        sources=suggestion.sources,
    )
    session.add(dvar)
    session.commit()
    session.refresh(dvar)
    return dvar
```

```python
# backend/app/api/pdf.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlmodel import Session
from app.database import get_session
from app.models import DvarTora, WeeklyCollection
from app.pdf.generator import generate_daf_mekorot

router = APIRouter(prefix="/api/pdf", tags=["pdf"])

@router.get("/{dvar_id}")
def get_pdf(dvar_id: int, layout: str = "expanded", session: Session = Depends(get_session)):
    dvar = session.get(DvarTora, dvar_id)
    if not dvar:
        raise HTTPException(status_code=404, detail="Dvar Torah not found")
    collection = session.get(WeeklyCollection, dvar.collection_id)
    pdf_bytes = generate_daf_mekorot(
        title=dvar.title,
        parasha_name=collection.parasha_name,
        hebrew_date=collection.hebrew_date,
        gregorian_date=collection.gregorian_date,
        content=dvar.content,
        sources=dvar.sources,
        layout=layout,
    )
    return Response(content=pdf_bytes, media_type="application/pdf")
```

- [ ] **Step 4: Register routers in main.py**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import parasha, news, dvar_tora, pdf
from app.database import init_db

app = FastAPI(title="Dvar Torah Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/health")
def health():
    return {"status": "ok"}

app.include_router(parasha.router)
app.include_router(news.router)
app.include_router(dvar_tora.router)
app.include_router(pdf.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_api.py -v
# Expected: 6 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/ backend/app/main.py backend/tests/test_api.py
git commit -m "feat: add REST API endpoints for parasha, news, dvar tora, and PDF"
```

---

## Task 7: PDF Generator

**Files:**
- Create: `backend/app/pdf/generator.py`
- Create: `backend/app/pdf/templates/daf_mekorot.html`
- Create: `backend/tests/test_pdf.py`

- [ ] **Step 1: Write tests**

```python
# backend/tests/test_pdf.py
from app.pdf.generator import generate_daf_mekorot

def test_generate_pdf_returns_bytes():
    result = generate_daf_mekorot(
        title="בין חדשות לבשורות",
        parasha_name="פרשת בשלח",
        hebrew_date="כ״ב שבט תשפ״ו",
        gregorian_date="2026-02-14",
        content="<p>גוף דבר התורה כאן</p>",
        sources=[
            {"mefaresh": "רש״י", "ref": "שמות י״ד:ט״ו", "text": "טקסט הפירוש"},
            {"mefaresh": "רמב״ן", "ref": "שמות י״ד:ט״ז", "text": "טקסט הפירוש"},
        ],
        layout="expanded",
    )
    assert isinstance(result, bytes)
    assert result[:5] == b"%PDF-"

def test_generate_pdf_compact_layout():
    result = generate_daf_mekorot(
        title="כותרת",
        parasha_name="פרשת בראשית",
        hebrew_date="א׳ תשרי",
        gregorian_date="2026-10-01",
        content="<p>תוכן</p>",
        sources=[],
        layout="compact",
    )
    assert isinstance(result, bytes)
    assert result[:5] == b"%PDF-"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_pdf.py -v
# Expected: FAIL
```

- [ ] **Step 3: Create HTML template**

```html
<!-- backend/app/pdf/templates/daf_mekorot.html -->
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Hebrew:wght@400;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page {
    size: A4;
    margin: 2cm;
    @bottom-center { content: counter(page); font-size: 10pt; }
  }

  body {
    font-family: 'Noto Serif Hebrew', 'David', serif;
    font-size: 12pt;
    line-height: 1.8;
    direction: rtl;
    color: #1a1a1a;
  }

  .header {
    text-align: center;
    border-bottom: 2px solid #333;
    padding-bottom: 12pt;
    margin-bottom: 18pt;
  }

  .header h1 {
    font-size: 20pt;
    margin-bottom: 4pt;
  }

  .header .parasha {
    font-size: 14pt;
    color: #555;
  }

  .header .date {
    font-size: 10pt;
    color: #777;
  }

  .content {
    margin-bottom: 24pt;
    text-align: justify;
  }

  .content p { margin-bottom: 10pt; }

  .sources-title {
    font-size: 14pt;
    font-weight: bold;
    border-bottom: 1px solid #999;
    padding-bottom: 6pt;
    margin-bottom: 12pt;
  }

  .sources-grid {
    display: grid;
    grid-template-columns: {% if layout == 'compact' %}1fr 1fr{% else %}1fr{% endif %};
    gap: 12pt;
  }

  .source-box {
    border: 1px solid #999;
    border-radius: 4pt;
    padding: 10pt;
    break-inside: avoid;
  }

  .source-box .mefaresh {
    font-weight: bold;
    font-size: 11pt;
    margin-bottom: 4pt;
  }

  .source-box .ref {
    font-size: 9pt;
    color: #666;
    margin-bottom: 6pt;
  }

  .source-box .text {
    font-size: 11pt;
    line-height: 1.6;
  }

  .footer {
    margin-top: 24pt;
    text-align: center;
    font-size: 9pt;
    color: #999;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>{{ title }}</h1>
    <div class="parasha">{{ parasha_name }}</div>
    <div class="date">{{ hebrew_date }} | {{ gregorian_date }}</div>
  </div>

  <div class="content">
    {{ content | safe }}
  </div>

  {% if sources %}
  <div class="sources-title">מקורות</div>
  <div class="sources-grid">
    {% for source in sources %}
    <div class="source-box">
      <div class="mefaresh">{{ source.mefaresh }}</div>
      <div class="ref">{{ source.ref }}</div>
      <div class="text">{{ source.text }}</div>
    </div>
    {% endfor %}
  </div>
  {% endif %}

  <div class="footer">דף מקורות — הופק באמצעות דבר תורה Agent</div>
</body>
</html>
```

- [ ] **Step 4: Implement generator**

```python
# backend/app/pdf/generator.py
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

TEMPLATE_DIR = Path(__file__).parent / "templates"

env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))

def generate_daf_mekorot(
    title: str,
    parasha_name: str,
    hebrew_date: str,
    gregorian_date: str,
    content: str,
    sources: list[dict],
    layout: str = "expanded",
) -> bytes:
    template = env.get_template("daf_mekorot.html")
    html_str = template.render(
        title=title,
        parasha_name=parasha_name,
        hebrew_date=hebrew_date,
        gregorian_date=gregorian_date,
        content=content,
        sources=sources,
        layout=layout,
    )
    return HTML(string=html_str).write_pdf()
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_pdf.py -v
# Expected: 2 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/pdf/ backend/tests/test_pdf.py
git commit -m "feat: add PDF generator for Daf Mekorot with Hebrew RTL layout"
```

---

## Task 8: Weekly Prep Cron Script

**Files:**
- Create: `backend/cron/weekly_prep.py`
- Create: `backend/tests/test_weekly_prep.py`

- [ ] **Step 1: Write test**

```python
# backend/tests/test_weekly_prep.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from sqlmodel import SQLModel, Session, create_engine
from cron.weekly_prep import run_weekly_prep

@pytest.mark.asyncio
async def test_weekly_prep_creates_collection():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)

    mock_parasha = {
        "name": "פרשת בשלח",
        "name_en": "Parashat Beshalach",
        "ref": "Exodus 13:17-17:16",
        "date": "2026-02-14",
        "hebrew_date": "כ״ב שבט",
    }
    mock_news = [{"title": "חדשות", "summary": "תקציר", "source": "ynet"}]
    mock_text = [{"ref": "Exodus 13:17", "text": "ויהי"}]
    mock_mefarshim = {"Rashi": [{"ref": "Rashi on Exodus 13:17", "text": "פירוש"}]}

    with patch("cron.weekly_prep.ParashaCollector") as MockPC, \
         patch("cron.weekly_prep.NewsCollector") as MockNC, \
         patch("cron.weekly_prep.get_engine", return_value=engine):
        pc = MockPC.return_value
        pc.get_weekly_parasha = AsyncMock(return_value=mock_parasha)
        pc.get_parasha_text = AsyncMock(return_value=mock_text)
        pc.collect_mefarshim = AsyncMock(return_value=mock_mefarshim)
        pc.close = AsyncMock()
        nc = MockNC.return_value
        nc.collect = AsyncMock(return_value=mock_news)
        nc.close = AsyncMock()

        await run_weekly_prep()

    with Session(engine) as session:
        from app.models import WeeklyCollection
        from sqlmodel import select
        c = session.exec(select(WeeklyCollection)).first()
        assert c is not None
        assert c.parasha_name == "פרשת בשלח"
        assert c.status == "collected"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_weekly_prep.py -v
# Expected: FAIL
```

- [ ] **Step 3: Implement weekly_prep.py**

```python
# backend/cron/weekly_prep.py
import asyncio
import subprocess
from sqlmodel import Session, SQLModel, create_engine, select
from app.models import WeeklyCollection, UserProfile
from app.collectors.parasha_collector import ParashaCollector, MEFARSHIM_MAP
from app.collectors.news_collector import NewsCollector
from app.database import DB_PATH

def get_engine():
    return create_engine(f"sqlite:///{DB_PATH}")

async def run_weekly_prep():
    engine = get_engine()
    SQLModel.metadata.create_all(engine)

    pc = ParashaCollector()
    nc = NewsCollector()

    try:
        # Get user preferences
        with Session(engine) as session:
            profile = session.exec(select(UserProfile)).first()
            if profile:
                mefarshim_list = profile.selected_mefarshim
            else:
                mefarshim_list = MEFARSHIM_MAP["pshat"]

        # Collect parasha info
        parasha = await pc.get_weekly_parasha()

        # Check if already collected this week
        with Session(engine) as session:
            existing = session.exec(
                select(WeeklyCollection).where(
                    WeeklyCollection.gregorian_date == parasha["date"]
                )
            ).first()
            if existing:
                print(f"Already collected for {parasha['name']}")
                return

        # Collect data
        parasha_text = await pc.get_parasha_text(parasha["ref"])
        mefarshim = await pc.collect_mefarshim(parasha["ref"], mefarshim_list)
        news = await nc.collect()

        # Store
        with Session(engine) as session:
            collection = WeeklyCollection(
                parasha_name=parasha["name"],
                parasha_ref=parasha["ref"],
                hebrew_date=parasha.get("hebrew_date", ""),
                gregorian_date=parasha["date"],
                status="collected",
                news_items=news,
                mefarshim_texts=mefarshim,
                parasha_text="\n".join(t["text"] for t in parasha_text),
            )
            session.add(collection)
            session.commit()

        # Send notification
        try:
            subprocess.run(
                ["notify-send", "דבר תורה", f"הנתונים לפרשת {parasha['name']} מוכנים"],
                check=False,
            )
        except FileNotFoundError:
            print(f"Data ready for {parasha['name']}")

    finally:
        await pc.close()
        await nc.close()

if __name__ == "__main__":
    asyncio.run(run_weekly_prep())
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_weekly_prep.py -v
# Expected: 1 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/cron/ backend/tests/test_weekly_prep.py
git commit -m "feat: add weekly prep cron script for Thursday data collection"
```

---

## Task 9: Frontend Project Setup

**Files:**
- Create: `frontend/` (scaffolded via Vite)
- Modify: `frontend/index.html` — add RTL
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: Scaffold React + TypeScript + Vite project**

```bash
cd /home/oshrin/projects/dvar-tora
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

- [ ] **Step 2: Install dependencies**

```bash
cd /home/oshrin/projects/dvar-tora/frontend
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-text-align @tiptap/extension-placeholder tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure Tailwind**

Add to `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

Replace `frontend/src/index.css` with:
```css
@import "tailwindcss";

@theme {
  --font-sans: 'Noto Sans Hebrew', sans-serif;
  --font-serif: 'Noto Serif Hebrew', serif;
}
```

- [ ] **Step 4: Set RTL in index.html**

Update `<html lang="en">` to `<html lang="he" dir="rtl">` in `frontend/index.html`.

Add Google Fonts link in `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;500;600;700&family=Noto+Serif+Hebrew:wght@400;700&display=swap" rel="stylesheet">
```

- [ ] **Step 5: Create shared types**

```typescript
// frontend/src/lib/types.ts
export interface NewsItem {
  title: string
  summary: string
  link?: string
  source?: string
  published?: string
}

export interface MefareshText {
  mefaresh: string
  ref: string
  text: string
}

export interface WeeklyCollection {
  id: number
  parasha_name: string
  parasha_ref: string
  hebrew_date: string
  gregorian_date: string
  status: string
  news_items: NewsItem[]
  mefarshim_texts: Record<string, MefareshText[]>
  parasha_text: string
}

export interface DvarToraSuggestion {
  id: number
  collection_id: number
  title: string
  thesis: string
  outline: string
  sources: { mefaresh: string; ref: string }[]
  linked_news_themes: string[]
}

export interface DvarTora {
  id: number
  collection_id: number
  suggestion_id?: number
  title: string
  content: string
  status: string
  sources: MefareshText[]
}

export type MefarshimCategory = 'pshat' | 'hasidic' | 'bikoret' | 'mixed'
```

- [ ] **Step 6: Create API client**

```typescript
// frontend/src/lib/api.ts
import type { WeeklyCollection, DvarToraSuggestion, DvarTora } from './types'

const BASE = '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

export const api = {
  getCurrentWeek: () => fetchJSON<WeeklyCollection>('/parasha/current'),

  getNews: (collectionId: number) => fetchJSON<WeeklyCollection['news_items']>(`/news/${collectionId}`),

  getSuggestions: (collectionId: number) =>
    fetchJSON<DvarToraSuggestion[]>(`/dvar-tora/suggestions/${collectionId}`),

  generateSuggestions: (collectionId: number) =>
    fetchJSON<DvarToraSuggestion[]>(`/dvar-tora/suggestions/${collectionId}/generate`, { method: 'POST' }),

  expandSuggestion: (suggestionId: number) =>
    fetchJSON<DvarTora>(`/dvar-tora/expand/${suggestionId}`, { method: 'POST' }),

  createDvarTora: (data: { collection_id: number; title: string; content?: string }) =>
    fetchJSON<DvarTora>('/dvar-tora/', { method: 'POST', body: JSON.stringify(data) }),

  updateDvarTora: (id: number, data: Partial<DvarTora>) =>
    fetchJSON<DvarTora>(`/dvar-tora/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getDvarTora: (id: number) => fetchJSON<DvarTora>(`/dvar-tora/${id}`),

  chatEdit: (data: { current_text: string; user_request: string; session_id: string }) =>
    fetchJSON<{ updated_text: string }>('/dvar-tora/chat', { method: 'POST', body: JSON.stringify(data) }),

  getPdfUrl: (dvarId: number, layout: string = 'expanded') =>
    `${BASE}/pdf/${dvarId}?layout=${layout}`,
}
```

- [ ] **Step 7: Verify frontend builds**

```bash
cd /home/oshrin/projects/dvar-tora/frontend && npm run build
# Expected: build succeeds
```

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with React, TypeScript, Vite, Tailwind, RTL"
```

---

## Task 10: Frontend — Dashboard & News Summary

**Files:**
- Create: `frontend/src/components/WeeklyDashboard.tsx`
- Create: `frontend/src/components/NewsSummary.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Implement WeeklyDashboard**

```tsx
// frontend/src/components/WeeklyDashboard.tsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { WeeklyCollection } from '../lib/types'
import { NewsSummary } from './NewsSummary'

export function WeeklyDashboard({ onProceed }: { onProceed: (collection: WeeklyCollection) => void }) {
  const [collection, setCollection] = useState<WeeklyCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getCurrentWeek()
      .then(setCollection)
      .catch(() => setError('לא נמצאו נתונים לשבוע זה'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-lg">טוען...</div>
  if (error) return <div className="text-center py-20 text-red-600">{error}</div>
  if (!collection) return null

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-serif font-bold mb-2">{collection.parasha_name}</h1>
        <p className="text-gray-500">{collection.hebrew_date} | {collection.gregorian_date}</p>
        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm ${
          collection.status === 'collected' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {collection.status === 'collected' ? 'הנתונים מוכנים' : 'בתהליך איסוף'}
        </span>
      </header>

      <NewsSummary items={collection.news_items} />

      <div className="text-center mt-10">
        <button
          onClick={() => onProceed(collection)}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition"
          disabled={collection.status !== 'collected'}
        >
          המשך להצעות דבר תורה
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement NewsSummary**

```tsx
// frontend/src/components/NewsSummary.tsx
import type { NewsItem } from '../lib/types'

export function NewsSummary({ items }: { items: NewsItem[] }) {
  return (
    <section>
      <h2 className="text-2xl font-serif font-bold mb-4">חדשות השבוע</h2>
      <div className="grid gap-3">
        {items.slice(0, 10).map((item, i) => (
          <div key={i} className="border rounded-lg p-4 hover:bg-gray-50 transition">
            <h3 className="font-bold text-lg">{item.title}</h3>
            {item.summary && <p className="text-gray-600 mt-1">{item.summary}</p>}
            <div className="flex gap-3 mt-2 text-sm text-gray-400">
              {item.source && <span>{item.source}</span>}
              {item.published && <span>{item.published}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Update App.tsx with routing**

```tsx
// frontend/src/App.tsx
import { useState } from 'react'
import { WeeklyDashboard } from './components/WeeklyDashboard'
import { SuggestionCards } from './components/SuggestionCards'
import { DvarToraEditor } from './components/Editor/DvarToraEditor'
import type { WeeklyCollection, DvarTora } from './lib/types'

type View = 'dashboard' | 'suggestions' | 'editor'

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [collection, setCollection] = useState<WeeklyCollection | null>(null)
  const [dvarTora, setDvarTora] = useState<DvarTora | null>(null)

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {view === 'dashboard' && (
        <WeeklyDashboard onProceed={(c) => { setCollection(c); setView('suggestions') }} />
      )}
      {view === 'suggestions' && collection && (
        <SuggestionCards
          collection={collection}
          onSelect={(dvar) => { setDvarTora(dvar); setView('editor') }}
          onBack={() => setView('dashboard')}
        />
      )}
      {view === 'editor' && dvarTora && collection && (
        <DvarToraEditor
          dvarTora={dvarTora}
          collection={collection}
          onBack={() => setView('suggestions')}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create stub components for SuggestionCards and DvarToraEditor**

```tsx
// frontend/src/components/SuggestionCards.tsx
import type { WeeklyCollection, DvarTora } from '../lib/types'

export function SuggestionCards({ collection, onSelect, onBack }: {
  collection: WeeklyCollection
  onSelect: (dvar: DvarTora) => void
  onBack: () => void
}) {
  return <div>Suggestions placeholder — implemented in Task 11</div>
}
```

```tsx
// frontend/src/components/Editor/DvarToraEditor.tsx
import type { DvarTora, WeeklyCollection } from '../../lib/types'

export function DvarToraEditor({ dvarTora, collection, onBack }: {
  dvarTora: DvarTora
  collection: WeeklyCollection
  onBack: () => void
}) {
  return <div>Editor placeholder — implemented in Task 12</div>
}
```

- [ ] **Step 5: Verify it builds**

```bash
cd /home/oshrin/projects/dvar-tora/frontend && npm run build
# Expected: build succeeds
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: add dashboard and news summary components"
```

---

## Task 11: Frontend — Suggestion Cards & Mefarshim Picker

**Files:**
- Modify: `frontend/src/components/SuggestionCards.tsx`
- Create: `frontend/src/components/MefarshimPicker.tsx`

- [ ] **Step 1: Implement MefarshimPicker**

```tsx
// frontend/src/components/MefarshimPicker.tsx
import type { MefarshimCategory } from '../lib/types'

const CATEGORIES: { value: MefarshimCategory; label: string; description: string }[] = [
  { value: 'pshat', label: 'פשט', description: 'רש״י, רמב״ן, אבן עזרא, ספורנו' },
  { value: 'hasidic', label: 'חסידות', description: 'שפת אמת, נתיבות שלום, מי השילוח' },
  { value: 'bikoret', label: 'ביקורת המקרא', description: 'פרשנות אקדמית וביקורתית' },
  { value: 'mixed', label: 'מעורב', description: 'בחירה חופשית של מפרשים' },
]

export function MefarshimPicker({ selected, onChange }: {
  selected: MefarshimCategory
  onChange: (category: MefarshimCategory) => void
}) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold mb-3">סגנון מפרשים</h3>
      <div className="flex gap-3 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onChange(cat.value)}
            className={`px-4 py-2 rounded-lg border transition ${
              selected === cat.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            <div className="font-bold">{cat.label}</div>
            <div className="text-xs mt-1 opacity-80">{cat.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement SuggestionCards**

```tsx
// frontend/src/components/SuggestionCards.tsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { MefarshimPicker } from './MefarshimPicker'
import type { WeeklyCollection, DvarTora, DvarToraSuggestion, MefarshimCategory } from '../lib/types'

export function SuggestionCards({ collection, onSelect, onBack }: {
  collection: WeeklyCollection
  onSelect: (dvar: DvarTora) => void
  onBack: () => void
}) {
  const [suggestions, setSuggestions] = useState<DvarToraSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [expanding, setExpanding] = useState<number | null>(null)
  const [category, setCategory] = useState<MefarshimCategory>('pshat')

  useEffect(() => {
    api.getSuggestions(collection.id).then((s) => {
      if (s.length > 0) setSuggestions(s)
    })
  }, [collection.id])

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const result = await api.generateSuggestions(collection.id)
      setSuggestions(result)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (suggestion: DvarToraSuggestion) => {
    setExpanding(suggestion.id)
    try {
      const dvar = await api.expandSuggestion(suggestion.id)
      onSelect(dvar)
    } finally {
      setExpanding(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={onBack} className="text-blue-600 mb-4 hover:underline">→ חזרה</button>
      <h2 className="text-3xl font-serif font-bold mb-6">הצעות לדבר תורה — {collection.parasha_name}</h2>

      <MefarshimPicker selected={category} onChange={setCategory} />

      {suggestions.length === 0 && (
        <div className="text-center py-10">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'מייצר הצעות...' : 'צור הצעות דבר תורה'}
          </button>
        </div>
      )}

      <div className="grid gap-4 mt-6">
        {suggestions.map((s) => (
          <div key={s.id} className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition">
            <h3 className="text-xl font-bold mb-2">{s.title}</h3>
            <p className="text-gray-700 font-medium mb-2">{s.thesis}</p>
            <p className="text-gray-500 text-sm mb-3">{s.outline}</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {s.linked_news_themes.map((theme, i) => (
                <span key={i} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{theme}</span>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap mb-4">
              {s.sources.map((src, i) => (
                <span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">{src.mefaresh} — {src.ref}</span>
              ))}
            </div>
            <button
              onClick={() => handleSelect(s)}
              disabled={expanding === s.id}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {expanding === s.id ? 'מרחיב...' : 'בחר ופתח'}
            </button>
          </div>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="text-center mt-6">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="text-blue-600 hover:underline"
          >
            {loading ? 'מייצר...' : 'צור הצעות נוספות'}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify it builds**

```bash
cd /home/oshrin/projects/dvar-tora/frontend && npm run build
# Expected: build succeeds
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SuggestionCards.tsx frontend/src/components/MefarshimPicker.tsx
git commit -m "feat: add suggestion cards and mefarshim picker components"
```

---

## Task 12: Frontend — Editor with Chat Sidebar

**Files:**
- Modify: `frontend/src/components/Editor/DvarToraEditor.tsx`
- Create: `frontend/src/components/Editor/ChatSidebar.tsx`
- Create: `frontend/src/components/Editor/SourcePanel.tsx`

- [ ] **Step 1: Implement ChatSidebar**

```tsx
// frontend/src/components/Editor/ChatSidebar.tsx
import { useState } from 'react'
import { api } from '../../lib/api'

export function ChatSidebar({ sessionId, currentText, onUpdate }: {
  sessionId: string
  currentText: string
  onUpdate: (newText: string) => void
}) {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const result = await api.chatEdit({
        current_text: currentText,
        user_request: userMsg,
        session_id: sessionId,
      })
      setMessages((prev) => [...prev, { role: 'assistant', text: 'הטקסט עודכן' }])
      onUpdate(result.updated_text)
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'שגיאה בעדכון' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full border-r border-gray-200">
      <h3 className="text-lg font-bold p-4 border-b">עוזר AI</h3>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`p-3 rounded-lg ${
            msg.role === 'user' ? 'bg-blue-100 mr-4' : 'bg-gray-100 ml-4'
          }`}>
            {msg.text}
          </div>
        ))}
        {loading && <div className="text-gray-400 text-center">חושב...</div>}
      </div>
      <div className="p-4 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="בקש שינוי, הוספת מקור..."
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          שלח
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement SourcePanel**

```tsx
// frontend/src/components/Editor/SourcePanel.tsx
import type { MefareshText } from '../../lib/types'

export function SourcePanel({ sources }: { sources: MefareshText[] }) {
  if (sources.length === 0) return null

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4">
      <h3 className="text-lg font-bold mb-3">מקורות</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sources.map((source, i) => (
          <div key={i} className="border rounded-lg p-3 bg-white">
            <div className="font-bold text-sm">{source.mefaresh}</div>
            <div className="text-xs text-gray-500 mb-1">{source.ref}</div>
            <div className="text-sm leading-relaxed">{source.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement DvarToraEditor with Tiptap**

```tsx
// frontend/src/components/Editor/DvarToraEditor.tsx
import { useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { api } from '../../lib/api'
import { ChatSidebar } from './ChatSidebar'
import { SourcePanel } from './SourcePanel'
import type { DvarTora, WeeklyCollection } from '../../lib/types'

export function DvarToraEditor({ dvarTora: initial, collection, onBack }: {
  dvarTora: DvarTora
  collection: WeeklyCollection
  onBack: () => void
}) {
  const [dvarTora, setDvarTora] = useState(initial)
  const [saving, setSaving] = useState(false)
  const sessionId = `week-${collection.id}`

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'right' }),
    ],
    content: dvarTora.content,
    editorProps: {
      attributes: { class: 'prose prose-lg max-w-none p-6 min-h-[400px] focus:outline-none font-serif', dir: 'rtl' },
    },
    onUpdate: ({ editor }) => {
      setDvarTora((prev) => ({ ...prev, content: editor.getHTML() }))
    },
  })

  const handleChatUpdate = useCallback((newText: string) => {
    if (editor) {
      editor.commands.setContent(newText)
      setDvarTora((prev) => ({ ...prev, content: newText }))
    }
  }, [editor])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateDvarTora(dvarTora.id, {
        content: dvarTora.content,
        title: dvarTora.title,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleFinalize = async () => {
    await api.updateDvarTora(dvarTora.id, { status: 'final' })
    setDvarTora((prev) => ({ ...prev, status: 'final' }))
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <button onClick={onBack} className="text-blue-600 hover:underline">→ חזרה</button>
        <input
          value={dvarTora.title}
          onChange={(e) => setDvarTora((prev) => ({ ...prev, title: e.target.value }))}
          className="text-2xl font-serif font-bold text-center border-none focus:outline-none"
        />
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="bg-gray-200 px-4 py-2 rounded-lg text-sm">
            {saving ? 'שומר...' : 'שמור'}
          </button>
          <button onClick={handleFinalize} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">
            סיום
          </button>
          <a
            href={api.getPdfUrl(dvarTora.id)}
            target="_blank"
            rel="noreferrer"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            PDF
          </a>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-y-auto bg-white">
          <EditorContent editor={editor} />
        </div>

        {/* Chat sidebar */}
        <div className="w-80 bg-gray-50">
          <ChatSidebar
            sessionId={sessionId}
            currentText={dvarTora.content}
            onUpdate={handleChatUpdate}
          />
        </div>
      </div>

      {/* Source panel */}
      <SourcePanel sources={dvarTora.sources} />
    </div>
  )
}
```

- [ ] **Step 4: Verify it builds**

```bash
cd /home/oshrin/projects/dvar-tora/frontend && npm run build
# Expected: build succeeds
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Editor/
git commit -m "feat: add Tiptap editor with chat sidebar and source panel"
```

---

## Task 13: Frontend — Settings & PDF Preview

**Files:**
- Create: `frontend/src/components/Settings.tsx`
- Create: `frontend/src/components/PdfPreview.tsx`

- [ ] **Step 1: Implement Settings**

```tsx
// frontend/src/components/Settings.tsx
import { useState } from 'react'
import type { MefarshimCategory } from '../lib/types'

const MEFARSHIM_OPTIONS: Record<string, string[]> = {
  pshat: ['Rashi', 'Ramban', 'Ibn Ezra', 'Sforno', 'Rashbam', 'Or HaChaim'],
  hasidic: ['Sefat Emet', 'Netivot Shalom', 'Mei HaShiloach', 'Kedushat Levi', 'Noam Elimelech'],
  bikoret: [],
}

export function Settings({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<MefarshimCategory>('pshat')
  const [selected, setSelected] = useState<string[]>(MEFARSHIM_OPTIONS.pshat)

  const handleCategoryChange = (cat: MefarshimCategory) => {
    setCategory(cat)
    setSelected(MEFARSHIM_OPTIONS[cat] || [])
  }

  const toggleMefaresh = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    )
  }

  const handleSave = () => {
    localStorage.setItem('dvar-tora-settings', JSON.stringify({ category, selected }))
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">הגדרות</h2>

        <div className="mb-6">
          <label className="block font-bold mb-2">קטגוריית מפרשים ברירת מחדל</label>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value as MefarshimCategory)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="pshat">פשט</option>
            <option value="hasidic">חסידות</option>
            <option value="bikoret">ביקורת המקרא</option>
            <option value="mixed">מעורב</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block font-bold mb-2">מפרשים נבחרים</label>
          <div className="space-y-2">
            {Object.values(MEFARSHIM_OPTIONS).flat().map((name) => (
              <label key={name} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(name)}
                  onChange={() => toggleMefaresh(name)}
                />
                {name}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">ביטול</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">שמור</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement PdfPreview**

```tsx
// frontend/src/components/PdfPreview.tsx
import { useState } from 'react'
import { api } from '../lib/api'

export function PdfPreview({ dvarId, onClose }: { dvarId: number; onClose: () => void }) {
  const [layout, setLayout] = useState<'expanded' | 'compact'>('expanded')

  const pdfUrl = api.getPdfUrl(dvarId, layout)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[90vw] h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">תצוגה מקדימה — דף מקורות</h2>
          <div className="flex gap-3 items-center">
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as 'expanded' | 'compact')}
              className="border rounded px-3 py-1"
            >
              <option value="expanded">מורחב</option>
              <option value="compact">מצומצם (דו-צדדי)</option>
            </select>
            <a
              href={pdfUrl}
              download
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              הורד PDF
            </a>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
          </div>
        </div>
        <iframe src={pdfUrl} className="flex-1 w-full" title="PDF Preview" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify it builds**

```bash
cd /home/oshrin/projects/dvar-tora/frontend && npm run build
# Expected: build succeeds
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Settings.tsx frontend/src/components/PdfPreview.tsx
git commit -m "feat: add settings and PDF preview components"
```

---

## Task 14: Integration — Wire Everything Together

**Files:**
- Modify: `frontend/src/App.tsx` — add settings button
- Create: `backend/app/config.py` — user config management
- Create: `backend/app/api/settings.py` — settings endpoint

- [ ] **Step 1: Add settings API endpoint**

```python
# backend/app/api/settings.py
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models import UserProfile

router = APIRouter(prefix="/api/settings", tags=["settings"])

class ProfileUpdate(BaseModel):
    mefarshim_category: str
    selected_mefarshim: list[str]

@router.get("/profile")
def get_profile(session: Session = Depends(get_session)):
    profile = session.exec(select(UserProfile)).first()
    if not profile:
        profile = UserProfile(mefarshim_category="pshat", selected_mefarshim=["Rashi", "Ramban", "Ibn Ezra"])
        session.add(profile)
        session.commit()
        session.refresh(profile)
    return profile

@router.put("/profile")
def update_profile(data: ProfileUpdate, session: Session = Depends(get_session)):
    profile = session.exec(select(UserProfile)).first()
    if not profile:
        profile = UserProfile()
    profile.mefarshim_category = data.mefarshim_category
    profile.selected_mefarshim = data.selected_mefarshim
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile
```

- [ ] **Step 2: Register settings router in main.py**

Add to `backend/app/main.py`:
```python
from app.api import parasha, news, dvar_tora, pdf, settings
# ...
app.include_router(settings.router)
```

- [ ] **Step 3: Add settings button to App.tsx**

Update `App.tsx` to include a settings gear icon in the top-right corner that opens the Settings modal. Also add a state for `showSettings`.

- [ ] **Step 4: Verify full stack runs**

```bash
# Terminal 1: Backend
cd /home/oshrin/projects/dvar-tora/backend && uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd /home/oshrin/projects/dvar-tora/frontend && npm run dev
```

Open `http://localhost:5173` and verify the dashboard loads.

- [ ] **Step 5: Run all backend tests**

```bash
cd /home/oshrin/projects/dvar-tora/backend && python -m pytest tests/ -v
# Expected: all tests pass
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/settings.py backend/app/main.py frontend/src/App.tsx
git commit -m "feat: wire settings API and integrate frontend components"
```

---

## Task 15: Cron Setup & Final Polish

**Files:**
- Create: `scripts/install-cron.sh`
- Create: `scripts/run-server.sh`

- [ ] **Step 1: Create server run script**

```bash
#!/bin/bash
# scripts/run-server.sh
cd "$(dirname "$0")/.."
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 &
cd ../frontend && npm run dev &
wait
```

- [ ] **Step 2: Create cron install script**

```bash
#!/bin/bash
# scripts/install-cron.sh
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CRON_CMD="0 8 * * 4 cd $PROJECT_DIR/backend && python -m cron.weekly_prep >> $PROJECT_DIR/logs/cron.log 2>&1"
mkdir -p "$PROJECT_DIR/logs"
(crontab -l 2>/dev/null | grep -v "weekly_prep"; echo "$CRON_CMD") | crontab -
echo "Cron job installed: Thursday 08:00"
```

- [ ] **Step 3: Make scripts executable**

```bash
chmod +x scripts/run-server.sh scripts/install-cron.sh
```

- [ ] **Step 4: Create .gitignore**

```
# .gitignore
__pycache__/
*.pyc
*.egg-info/
backend/data/
logs/
node_modules/
frontend/dist/
.env
```

- [ ] **Step 5: Commit**

```bash
git add scripts/ .gitignore
git commit -m "feat: add server scripts, cron installer, and gitignore"
```

---

## Task 16: End-to-End Smoke Test

- [ ] **Step 1: Start the backend**

```bash
cd /home/oshrin/projects/dvar-tora/backend && uvicorn app.main:app --port 8000 &
```

- [ ] **Step 2: Run the weekly prep manually**

```bash
cd /home/oshrin/projects/dvar-tora/backend && python -m cron.weekly_prep
```

Verify: data collected and stored in SQLite.

- [ ] **Step 3: Check API returns data**

```bash
curl http://localhost:8000/api/parasha/current
# Expected: JSON with parasha data
curl http://localhost:8000/api/health
# Expected: {"status":"ok"}
```

- [ ] **Step 4: Start frontend and verify UI**

```bash
cd /home/oshrin/projects/dvar-tora/frontend && npm run dev &
```

Open `http://localhost:5173`, verify dashboard shows parasha and news.

- [ ] **Step 5: Run all tests**

```bash
cd /home/oshrin/projects/dvar-tora/backend && python -m pytest tests/ -v
# Expected: all tests pass
```

- [ ] **Step 6: Final commit**

```bash
git add -A && git commit -m "chore: end-to-end smoke test verified"
```
