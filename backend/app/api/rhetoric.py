import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models import RhetoricStrategy, WeeklyCollection
from app.ai.claude_cli import ClaudeCLI

router = APIRouter(prefix="/api/rhetoric", tags=["rhetoric"])
claude = ClaudeCLI()


class RhetoricStrategyCreate(BaseModel):
    name: str
    description: str
    structure_template: str
    example: str = ""


class RhetoricStrategyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    structure_template: str | None = None
    example: str | None = None


class RhetoricSequenceItem(BaseModel):
    name: str = ""
    description: str = ""
    structure_template: str = ""


class PunchlineRequest(BaseModel):
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []
    rhetoric_sequence: list[RhetoricSequenceItem] = []


class BeatsRequest(BaseModel):
    punchline: str
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []
    rhetoric_sequence: list[RhetoricSequenceItem] = []


@router.get("/")
def list_strategies(session: Session = Depends(get_session)):
    stmt = select(RhetoricStrategy).order_by(RhetoricStrategy.display_order)
    return session.exec(stmt).all()


@router.post("/", status_code=201)
def create_strategy(data: RhetoricStrategyCreate, session: Session = Depends(get_session)):
    stmt = select(RhetoricStrategy).order_by(RhetoricStrategy.display_order.desc())
    last = session.exec(stmt).first()
    order = (last.display_order + 1) if last else 0

    strategy = RhetoricStrategy(
        name=data.name,
        description=data.description,
        structure_template=data.structure_template,
        example=data.example,
        is_custom=True,
        display_order=order,
    )
    session.add(strategy)
    session.commit()
    session.refresh(strategy)
    return strategy


@router.put("/{strategy_id}")
def update_strategy(strategy_id: int, data: RhetoricStrategyUpdate, session: Session = Depends(get_session)):
    strategy = session.get(RhetoricStrategy, strategy_id)
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    if not strategy.is_custom:
        raise HTTPException(status_code=403, detail="לא ניתן לערוך אסטרטגיה מובנית")
    if data.name is not None:
        strategy.name = data.name
    if data.description is not None:
        strategy.description = data.description
    if data.structure_template is not None:
        strategy.structure_template = data.structure_template
    if data.example is not None:
        strategy.example = data.example
    session.add(strategy)
    session.commit()
    session.refresh(strategy)
    return strategy


@router.delete("/{strategy_id}")
def delete_strategy(strategy_id: int, session: Session = Depends(get_session)):
    strategy = session.get(RhetoricStrategy, strategy_id)
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    if not strategy.is_custom:
        raise HTTPException(status_code=403, detail="לא ניתן למחוק אסטרטגיה מובנית")
    session.delete(strategy)
    session.commit()
    return {"ok": True}


def _resolve_news_themes(collection: WeeklyCollection, req):
    """Resolve news/theme indices to full items."""
    all_news = collection.news_items or []
    all_themes = collection.parasha_themes or []
    focused_news = [all_news[i] for i in req.selected_news if i < len(all_news)]
    focused_news.extend([{"title": t, "summary": t} for t in req.custom_news])
    focused_themes = [all_themes[i] for i in req.selected_themes if i < len(all_themes)]
    focused_themes.extend([{"title": t, "description": t} for t in req.custom_themes])
    return focused_news, focused_themes


@router.post("/{collection_id}/punchlines")
async def stream_punchlines(
    collection_id: int,
    req: PunchlineRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    focused_news, focused_themes = _resolve_news_themes(collection, req)
    rhetoric_seq = [s.model_dump() for s in req.rhetoric_sequence]

    async def generate():
        import asyncio
        task = asyncio.create_task(
            claude.generate_punchlines(
                news_items=focused_news,
                themes=focused_themes,
                rhetoric_sequence=rhetoric_seq,
            )
        )
        while not task.done():
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            await asyncio.sleep(3)
        punchlines = task.result()
        yield f"data: {json.dumps({'type': 'done', 'punchlines': punchlines}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/{collection_id}/beats")
async def stream_beats(
    collection_id: int,
    req: BeatsRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    focused_news, focused_themes = _resolve_news_themes(collection, req)
    rhetoric_seq = [s.model_dump() for s in req.rhetoric_sequence]

    async def generate():
        import asyncio
        task = asyncio.create_task(
            claude.generate_beats(
                punchline=req.punchline,
                news_items=focused_news,
                themes=focused_themes,
                rhetoric_sequence=rhetoric_seq,
            )
        )
        while not task.done():
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            await asyncio.sleep(3)
        beats = task.result()
        yield f"data: {json.dumps({'type': 'done', 'beats': beats}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
