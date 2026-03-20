from pathlib import Path
from sqlmodel import SQLModel, Session, create_engine

DB_PATH = Path(__file__).parent.parent / "data" / "dvar_tora.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
