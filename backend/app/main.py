from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import parasha, news, dvar_tora, pdf, settings
from app.database import init_db

app = FastAPI(title="Saba Yosef — Dvar Torah Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/health")
def health():
    return {"status": "ok"}

app.include_router(parasha.router)
app.include_router(news.router)
app.include_router(dvar_tora.router)
app.include_router(pdf.router)
app.include_router(settings.router)
