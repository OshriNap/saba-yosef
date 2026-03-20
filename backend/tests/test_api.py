import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, StaticPool
from app.main import app
from app.database import get_session
from app.models import WeeklyCollection, DvarToraSuggestion, DvarTora

@pytest.fixture
def engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine

@pytest.fixture
def session(engine):
    with Session(engine) as s:
        yield s

@pytest.fixture
def client(engine):
    def override():
        with Session(engine) as s:
            yield s
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
