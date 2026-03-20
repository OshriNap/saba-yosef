from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models import UserProfile

router = APIRouter(prefix="/api/settings", tags=["settings"])

class ProfileUpdate(BaseModel):
    mefarshim_category: str
    selected_mefarshim: list[str]

@router.get("/profile")
def get_profile(session: Session = Depends(get_session)):
    profile = session.exec(select(UserProfile)).first()
    if not profile:
        profile = UserProfile(mefarshim_category="pshat", selected_mefarshim=["Rashi", "Ramban", "Ibn Ezra"])
        session.add(profile)
        session.commit()
        session.refresh(profile)
    return profile

@router.put("/profile")
def update_profile(data: ProfileUpdate, session: Session = Depends(get_session)):
    profile = session.exec(select(UserProfile)).first()
    if not profile:
        profile = UserProfile()
    profile.mefarshim_category = data.mefarshim_category
    profile.selected_mefarshim = data.selected_mefarshim
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile
