import json
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models import WeeklyCollection, DrashaFlow, DvarTora
from app.ai.claude_cli import ClaudeCLI

router = APIRouter(prefix="/api/flow", tags=["flow"])
claude = ClaudeCLI()


class RhetoricSequenceItem(BaseModel):
    name: str = ""
    description: str = ""
    structure_template: str = ""


class GenerateFlowRequest(BaseModel):
    punchline: str
    rhetoric_sequence: list[RhetoricSequenceItem] = []
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []


class RefineSectionRequest(BaseModel):
    punchline: str
    sections: list[dict]
    section_index: int
    instruction: str


class RefineFlowRequest(BaseModel):
    punchline: str
    sections: list[dict]
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []
    instruction: str = ""


class SaveFlowRequest(BaseModel):
    punchline: str
    sections: list[dict]
    total_minutes: int = 0


class StylePrefs(BaseModel):
    tone: str = ""
    audience: str = ""
    length: str = ""
    approach: str = ""


class GenerateDrashaRequest(BaseModel):
    punchline: str
    sections: list[dict]
    mefarshim_by_section: dict[str, list[dict]] = {}
    style: StylePrefs | None = None


def _resolve_news_themes(collection: WeeklyCollection, req):
    all_news = collection.news_items or []
    all_themes = collection.parasha_themes or []
    focused_news = [all_news[i] for i in req.selected_news if i < len(all_news)]
    focused_news.extend([{"title": t, "summary": t} for t in req.custom_news])
    focused_themes = [all_themes[i] for i in req.selected_themes if i < len(all_themes)]
    focused_themes.extend([{"title": t, "description": t} for t in req.custom_themes])
    return focused_news, focused_themes


@router.post("/{collection_id}/generate")
async def generate_flow(
    collection_id: int,
    req: GenerateFlowRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    focused_news, focused_themes = _resolve_news_themes(collection, req)
    connections = [
        c for c in (collection.connections or [])
        if c.get("news_index") in req.selected_news or c.get("theme_index") in req.selected_themes
    ]
    rhetoric_seq = [s.model_dump() for s in req.rhetoric_sequence]

    async def generate():
        task = asyncio.create_task(
            claude.generate_flow(
                punchline=req.punchline,
                news_items=focused_news,
                themes=focused_themes,
                connections=connections,
                rhetoric_sequence=rhetoric_seq,
            )
        )
        while not task.done():
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            await asyncio.sleep(3)
        try:
            result = task.result()
            sections = result.get("sections", [])
        except Exception as e:
            sections = []
        total = sum(s.get("estimatedMinutes", 0) for s in sections)
        yield f"data: {json.dumps({'type': 'done', 'sections': sections, 'totalMinutes': total}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/{collection_id}/refine-section")
async def refine_section(
    collection_id: int,
    req: RefineSectionRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if req.section_index < 0 or req.section_index >= len(req.sections):
        raise HTTPException(status_code=400, detail="Invalid section index")

    async def generate():
        task = asyncio.create_task(
            claude.refine_section(
                punchline=req.punchline,
                flow_sections=req.sections,
                section_index=req.section_index,
                instruction=req.instruction,
            )
        )
        while not task.done():
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            await asyncio.sleep(3)
        try:
            section = task.result()
        except Exception as e:
            section = req.sections[req.section_index]
        yield f"data: {json.dumps({'type': 'done', 'section': section}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/{collection_id}/refine-flow")
async def refine_flow(
    collection_id: int,
    req: RefineFlowRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    focused_news, focused_themes = _resolve_news_themes(collection, req)

    async def generate():
        task = asyncio.create_task(
            claude.refine_flow(
                punchline=req.punchline,
                news_items=focused_news,
                themes=focused_themes,
                flow_sections=req.sections,
                instruction=req.instruction,
            )
        )
        while not task.done():
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            await asyncio.sleep(3)
        try:
            result = task.result()
            sections = result.get("sections", req.sections)
            changes = result.get("changes", "")
        except Exception as e:
            sections = req.sections
            changes = f"שגיאה: {str(e)[:200]}"
        total = sum(s.get("estimatedMinutes", 0) for s in sections)
        yield f"data: {json.dumps({'type': 'done', 'sections': sections, 'totalMinutes': total, 'changes': changes}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/{collection_id}/generate-drasha")
async def generate_drasha_from_flow(
    collection_id: int,
    req: GenerateDrashaRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    async def generate():
        full_text = ""
        async for chunk in claude.stream_generate_from_flow(
            parasha_name=collection.parasha_name,
            parasha_text=collection.parasha_text,
            punchline=req.punchline,
            flow_sections=req.sections,
            mefarshim_by_section=req.mefarshim_by_section,
            style=req.style.model_dump() if req.style else None,
        ):
            if chunk == "":
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            else:
                full_text += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"

        # Save the generated drasha
        dvar = DvarTora(
            collection_id=collection_id,
            title=f"דרשה — {collection.parasha_name}",
            content=full_text,
            sources=[],
        )
        session.add(dvar)
        session.commit()
        session.refresh(dvar)

        yield f"data: {json.dumps({'type': 'done', 'dvar_tora': {'id': dvar.id, 'collection_id': dvar.collection_id, 'title': dvar.title, 'content': dvar.content, 'status': dvar.status, 'sources': dvar.sources}}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/{collection_id}/save")
def save_flow(
    collection_id: int,
    req: SaveFlowRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    existing = session.exec(
        select(DrashaFlow).where(DrashaFlow.collection_id == collection_id)
    ).first()

    now = datetime.now().isoformat()
    if existing:
        existing.punchline = req.punchline
        existing.sections = req.sections
        existing.total_minutes = req.total_minutes
        existing.updated_at = now
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    else:
        flow = DrashaFlow(
            collection_id=collection_id,
            punchline=req.punchline,
            sections=req.sections,
            total_minutes=req.total_minutes,
            created_at=now,
            updated_at=now,
        )
        session.add(flow)
        session.commit()
        session.refresh(flow)
        return flow


@router.get("/{collection_id}")
def load_flow(collection_id: int, session: Session = Depends(get_session)):
    flow = session.exec(
        select(DrashaFlow).where(DrashaFlow.collection_id == collection_id)
    ).first()
    if not flow:
        raise HTTPException(status_code=404, detail="No saved flow")
    return flow
