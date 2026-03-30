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
    jewish_events: list[dict] = Field(default=[], sa_column=Column(JSON))
    parasha_themes: list[dict] = Field(default=[], sa_column=Column(JSON))
    connections: list[dict] = Field(default=[], sa_column=Column(JSON))

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

class RhetoricStrategy(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = ""
    name: str
    description: str
    structure_template: str
    example: str = ""
    is_custom: bool = False
    display_order: int = 0

class DrashaFlow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    collection_id: int
    punchline: str = ""
    sections: list = Field(default=[], sa_column=Column(JSON))
    total_minutes: int = 0
    created_at: str = ""
    updated_at: str = ""
