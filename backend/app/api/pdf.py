from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlmodel import Session
from app.database import get_session
from app.models import DvarTora, WeeklyCollection
from app.pdf.generator import generate_daf_mekorot

router = APIRouter(prefix="/api/pdf", tags=["pdf"])

@router.get("/{dvar_id}")
def get_pdf(dvar_id: int, layout: str = "expanded", session: Session = Depends(get_session)):
    dvar = session.get(DvarTora, dvar_id)
    if not dvar:
        raise HTTPException(status_code=404, detail="Dvar Torah not found")
    collection = session.get(WeeklyCollection, dvar.collection_id)
    pdf_bytes = generate_daf_mekorot(
        title=dvar.title,
        parasha_name=collection.parasha_name,
        hebrew_date=collection.hebrew_date,
        gregorian_date=collection.gregorian_date,
        content=dvar.content,
        sources=dvar.sources,
        layout=layout,
    )
    return Response(content=pdf_bytes, media_type="application/pdf")
