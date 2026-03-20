import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
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

@router.get("/suggestions/{collection_id}/stream")
async def stream_suggestions(collection_id: int, session: Session = Depends(get_session)):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    async def generate():
        full_text = ""
        async for chunk in claude.stream_suggestions(
            parasha_name=collection.parasha_name,
            parasha_text=collection.parasha_text,
            news_items=collection.news_items,
            mefarshim_texts=collection.mefarshim_texts,
        ):
            full_text += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"

        # Parse final result and save suggestions
        try:
            start = full_text.index("{")
            end = full_text.rindex("}") + 1
            data = json.loads(full_text[start:end])
            suggestions = data.get("suggestions", [])
        except (ValueError, json.JSONDecodeError):
            suggestions = [{"title": "שגיאה בפענוח", "thesis": full_text[:200], "outline": "", "sources": [], "linked_news": []}]

        saved = []
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
            saved.append(suggestion)
        session.commit()
        for s in saved:
            session.refresh(s)

        result = [{"id": s.id, "collection_id": s.collection_id, "title": s.title, "thesis": s.thesis, "outline": s.outline, "sources": s.sources, "linked_news_themes": s.linked_news_themes} for s in saved]
        yield f"data: {json.dumps({'type': 'done', 'suggestions': result})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@router.get("/expand/{suggestion_id}/stream")
async def stream_expand(suggestion_id: int, session: Session = Depends(get_session)):
    suggestion = session.get(DvarToraSuggestion, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    collection = session.get(WeeklyCollection, suggestion.collection_id)

    async def generate():
        full_text = ""
        async for chunk in claude.stream_expand(
            title=suggestion.title,
            thesis=suggestion.thesis,
            outline=suggestion.outline,
            sources=suggestion.sources,
            parasha_text=collection.parasha_text,
        ):
            full_text += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"

        dvar = DvarTora(
            collection_id=collection.id,
            suggestion_id=suggestion_id,
            title=suggestion.title,
            content=full_text,
            sources=suggestion.sources,
        )
        session.add(dvar)
        session.commit()
        session.refresh(dvar)

        yield f"data: {json.dumps({'type': 'done', 'dvar_tora': {'id': dvar.id, 'collection_id': dvar.collection_id, 'suggestion_id': dvar.suggestion_id, 'title': dvar.title, 'content': dvar.content, 'status': dvar.status, 'sources': dvar.sources}})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@router.post("/expand/{suggestion_id}")
async def expand_suggestion(suggestion_id: int, session: Session = Depends(get_session)):
    suggestion = session.get(DvarToraSuggestion, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    collection = session.get(WeeklyCollection, suggestion.collection_id)
    text = await claude.expand_suggestion(
        title=suggestion.title,
        thesis=suggestion.thesis,
        outline=suggestion.outline,
        sources=suggestion.sources,
        parasha_text=collection.parasha_text,
        session_id=None,
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
