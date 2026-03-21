import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session
from pydantic import BaseModel
from app.database import get_session
from app.models import WeeklyCollection
from app.ai.claude_cli import ClaudeCLI
from app.collectors.parasha_collector import MEFARSHIM_MAP

router = APIRouter(prefix="/api/mefarshim", tags=["mefarshim"])
claude = ClaudeCLI()


class MefarshimResearchRequest(BaseModel):
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []
    categories: list[str] = []


@router.post("/{collection_id}/research")
async def research_mefarshim(
    collection_id: int,
    req: MefarshimResearchRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Filter news and themes to user's selection
    all_news = collection.news_items or []
    all_themes = collection.parasha_themes or []

    focused_news = [all_news[i] for i in req.selected_news if i < len(all_news)]
    focused_news.extend([{"title": t, "summary": t} for t in req.custom_news])

    focused_themes = [all_themes[i] for i in req.selected_themes if i < len(all_themes)]
    focused_themes.extend([{"title": t, "description": t} for t in req.custom_themes])

    # Filter mefarshim_texts by selected categories
    filtered_mefarshim = {}
    mefarshim_texts = collection.mefarshim_texts or {}
    selected_names = set()
    for cat in req.categories:
        if cat == "mixed":
            selected_names.update(name for names in MEFARSHIM_MAP.values() for name in names)
        elif cat in MEFARSHIM_MAP:
            selected_names.update(MEFARSHIM_MAP[cat])

    for mefaresh, texts in mefarshim_texts.items():
        if mefaresh in selected_names:
            filtered_mefarshim[mefaresh] = texts

    async def generate():
        async for event in claude.stream_mefarshim_research(
            parasha_name=collection.parasha_name,
            news_items=focused_news,
            themes=focused_themes,
            mefarshim_texts=filtered_mefarshim,
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
