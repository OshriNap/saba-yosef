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
