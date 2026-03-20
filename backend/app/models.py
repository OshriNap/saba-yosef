from typing import Optional
from sqlmodel import SQLModel, Field, JSON, Column

class UserProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    mefarshim_category: str = "pshat"  # pshat, hasidic, bikoret, mixed
    selected_mefarshim: list[str] = Field(default=[], sa_column=Column(JSON))

class WeeklyCollection(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    parasha_name: str
    parasha_ref: str
    hebrew_date: str
    gregorian_date: str
    status: str = "pending"  # pending, collecting, collected, error
    news_items: list[dict] = Field(default=[], sa_column=Column(JSON))
    mefarshim_texts: dict = Field(default={}, sa_column=Column(JSON))
    parasha_text: str = ""

class DvarToraSuggestion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    collection_id: int = Field(foreign_key="weeklycollection.id")
    title: str
    thesis: str
    outline: str
    sources: list[dict] = Field(default=[], sa_column=Column(JSON))
    linked_news_themes: list[str] = Field(default=[], sa_column=Column(JSON))

class DvarTora(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    collection_id: int = Field(foreign_key="weeklycollection.id")
    suggestion_id: Optional[int] = Field(default=None, foreign_key="dvartorasuggestion.id")
    title: str
    content: str = ""
    status: str = "draft"  # draft, final
    sources: list[dict] = Field(default=[], sa_column=Column(JSON))
