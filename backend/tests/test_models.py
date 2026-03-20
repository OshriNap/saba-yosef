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
