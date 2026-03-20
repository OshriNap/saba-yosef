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
