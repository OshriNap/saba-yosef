from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.database import get_session
from app.models import WeeklyCollection

router = APIRouter(prefix="/api/news", tags=["news"])

@router.get("/{collection_id}")
def get_news(collection_id: int, session: Session = Depends(get_session)):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection.news_items
