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
