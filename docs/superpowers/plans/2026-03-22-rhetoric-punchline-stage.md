# Rhetoric & Punchline Stage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rhetoric strategy + punchline stage between Dashboard and Style so users define what to say (punchline) and how to say it (rhetorical strategies) before generating the drasha.

**Architecture:** New `RhetoricStrategy` SQLModel with CRUD API, SSE streaming endpoints for punchline/beats generation via Claude CLI (Sonnet), new React component with strategy picker + punchline cards, wired into the existing wizard flow.

**Tech Stack:** FastAPI, SQLModel/SQLite, Claude CLI (Sonnet), React/TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-22-rhetoric-punchline-stage-design.md`

---

### Task 1: Add RhetoricStrategy model and seed function

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/database.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add RhetoricStrategy model to models.py**

Append to `backend/app/models.py`:

```python
class RhetoricStrategy(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = ""
    name: str
    description: str
    structure_template: str
    example: str = ""
    is_custom: bool = False
    display_order: int = 0
```

- [ ] **Step 2: Add seed function to database.py**

Append to `backend/app/database.py`:

```python
from app.models import RhetoricStrategy

def seed_rhetoric_strategies():
    """Insert pre-seeded strategies if not already present. Idempotent by key."""
    presets = [
        RhetoricStrategy(
            key="news_to_torah",
            name="מהחדשות לתורה",
            description="מה שמעסיק את כולם השבוע מקבל פרספקטיבה תורנית",
            structure_template="פתח עם האירוע, חבר לפרשה, תן תובנה",
            display_order=0,
        ),
        RhetoricStrategy(
            key="bigger_picture",
            name="התמונה הגדולה",
            description="עזור לאנשים לראות את ההקשר הרחב שהם לא רואים",
            structure_template="הצג את הפרט, הרחב לכלל, חשוף את התבנית",
            display_order=1,
        ),
        RhetoricStrategy(
            key="counter_consensus",
            name="נגד הזרם",
            description="אמור משהו שאנשים לא מצפים לשמוע, תגר על הקונצנזוס",
            structure_template="הצג את הדעה המקובלת, ערער, הצע חלופה",
            display_order=2,
        ),
        RhetoricStrategy(
            key="provocative_reframe",
            name="מסגור מחדש פרובוקטיבי",
            description="פתח עם טענה מפתיעה שנראית שגויה, ובסוף כולם מסכימים",
            structure_template="פתח פרובוקטיבית, בנה דרך מקורות, חשוף שהטענה נכונה מזווית אחרת",
            display_order=3,
        ),
    ]
    with Session(engine) as session:
        for preset in presets:
            from sqlmodel import select
            existing = session.exec(
                select(RhetoricStrategy).where(RhetoricStrategy.key == preset.key)
            ).first()
            if not existing:
                session.add(preset)
        session.commit()
```

- [ ] **Step 3: Call seed on startup in main.py**

In `backend/app/main.py`, update the import and startup:

```python
from app.database import init_db, seed_rhetoric_strategies
```

```python
@app.on_event("startup")
def on_startup():
    init_db()
    seed_rhetoric_strategies()
```

- [ ] **Step 4: Verify**

Run: `cd /home/oshrin/projects/dvar-tora/backend && .venv/bin/python -c "from app.database import seed_rhetoric_strategies; seed_rhetoric_strategies(); print('OK')"`

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/app/database.py backend/app/main.py
git commit -m "feat: add RhetoricStrategy model with pre-seeded strategies

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add punchline and beats prompts to prompts.py

**Files:**
- Modify: `backend/app/ai/prompts.py`
- Modify: `backend/app/ai/claude_cli.py` (imports only)

- [ ] **Step 1: Add prompts to prompts.py**

Append to `backend/app/ai/prompts.py`:

```python
PUNCHLINE_PROMPT = """# יצירת פאנצ'ליין לדרשה

## חדשות שנבחרו
{news_section}

## נושאי פרשה שנבחרו
{themes_section}

## רצף אסטרטגיות רטוריות שנבחר
{rhetoric_section}

## הנחיות
אתה מומחה לדרשות. המשתמש בחר נושאים מהחדשות ומהפרשה, ואסטרטגיות רטוריות לדרשה.

צור 3-5 פאנצ'ליינים — כל פאנצ'ליין הוא 1-2 משפטים שמסכמים את המסר המרכזי שהקהל צריך לקחת מהדרשה.
כל פאנצ'ליין צריך:
- להיות בעברית
- לעבוד עם הרצף הרטורי שנבחר
- לחבר בין החדשות לפרשה
- להיות חד, מפתיע, או מעורר מחשבה

החזר JSON בפורמט:
{{"punchlines": ["פאנצ'ליין ראשון...", "פאנצ'ליין שני...", "..."]}}
"""

BEATS_PROMPT = """# יצירת ביטים לדרשה

## פאנצ'ליין
{punchline}

## חדשות שנבחרו
{news_section}

## נושאי פרשה שנבחרו
{themes_section}

## רצף אסטרטגיות רטוריות
{rhetoric_section}

## הנחיות
הפאנצ'ליין הוא המסר הסופי של הדרשה. לכל אסטרטגיה ברצף, כתוב משפט אחד שמתאר את ה"רגע" או הנקודה שהאסטרטגיה הזו תיצור בדרך לפאנצ'ליין.

כתוב בעברית.

החזר JSON בפורמט:
{{"beats": [{{"strategy_name": "שם האסטרטגיה", "beat": "משפט אחד..."}}]}}
"""
```

- [ ] **Step 2: Add imports in claude_cli.py**

Update the import block in `backend/app/ai/claude_cli.py`:

```python
from app.ai.prompts import (
    SYSTEM_PROMPT,
    NEWS_FILTER_PROMPT,
    SUGGESTION_PROMPT_TEMPLATE,
    FOCUSED_SUGGESTION_PROMPT_TEMPLATE,
    EXPAND_PROMPT_TEMPLATE,
    CHAT_PROMPT_TEMPLATE,
    THEMES_PROMPT_TEMPLATE,
    MEFARSHIM_RESEARCH_PROMPT,
    MEFARSHIM_SUMMARIZE_NEW_PROMPT,
    PUNCHLINE_PROMPT,
    BEATS_PROMPT,
)
```

- [ ] **Step 3: Verify**

Run: `cd /home/oshrin/projects/dvar-tora/backend && .venv/bin/python -c "from app.ai.claude_cli import ClaudeCLI; print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add backend/app/ai/prompts.py backend/app/ai/claude_cli.py
git commit -m "feat: add punchline and beats prompt templates

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add generate_punchlines and generate_beats methods to ClaudeCLI

**Files:**
- Modify: `backend/app/ai/claude_cli.py` (add methods at end of class)

- [ ] **Step 1: Add both methods**

Add to the `ClaudeCLI` class in `backend/app/ai/claude_cli.py`:

```python
    async def generate_punchlines(
        self,
        news_items: list[dict],
        themes: list[dict],
        rhetoric_sequence: list[dict],
    ) -> list[str]:
        """Generate 3-5 punchline suggestions using Sonnet."""
        news_section = "\n".join(
            f"- {item.get('title', '')}: {item.get('summary', '')}" for item in news_items
        ) or "לא נבחרו חדשות"
        themes_section = "\n".join(
            f"- {t.get('title', '')}: {t.get('description', '')}" for t in themes
        ) or "לא נבחרו נושאי פרשה"
        rhetoric_section = "\n".join(
            f"{i+1}. **{s.get('name', '')}**: {s.get('description', '')} — מבנה: {s.get('structure_template', '')}"
            for i, s in enumerate(rhetoric_sequence)
        ) or "לא נבחרו אסטרטגיות"

        prompt = PUNCHLINE_PROMPT.format(
            news_section=news_section,
            themes_section=themes_section,
            rhetoric_section=rhetoric_section,
        )
        raw = await self._run_claude(prompt)  # Sonnet (default)
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            data = json.loads(raw[start:end])
            return data.get("punchlines", [])
        except (ValueError, json.JSONDecodeError):
            return [raw[:200]]

    async def generate_beats(
        self,
        punchline: str,
        news_items: list[dict],
        themes: list[dict],
        rhetoric_sequence: list[dict],
    ) -> list[dict]:
        """Generate a beat per strategy step using Sonnet."""
        news_section = "\n".join(
            f"- {item.get('title', '')}: {item.get('summary', '')}" for item in news_items
        ) or "לא נבחרו חדשות"
        themes_section = "\n".join(
            f"- {t.get('title', '')}: {t.get('description', '')}" for t in themes
        ) or "לא נבחרו נושאי פרשה"
        rhetoric_section = "\n".join(
            f"{i+1}. **{s.get('name', '')}**: {s.get('description', '')} — מבנה: {s.get('structure_template', '')}"
            for i, s in enumerate(rhetoric_sequence)
        ) or "לא נבחרו אסטרטגיות"

        prompt = BEATS_PROMPT.format(
            punchline=punchline,
            news_section=news_section,
            themes_section=themes_section,
            rhetoric_section=rhetoric_section,
        )
        raw = await self._run_claude(prompt)  # Sonnet (default)
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            data = json.loads(raw[start:end])
            return data.get("beats", [])
        except (ValueError, json.JSONDecodeError):
            return []
```

- [ ] **Step 2: Verify**

Run: `cd /home/oshrin/projects/dvar-tora/backend && .venv/bin/python -c "from app.ai.claude_cli import ClaudeCLI; c = ClaudeCLI(); print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/ai/claude_cli.py
git commit -m "feat: add generate_punchlines and generate_beats methods

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Create rhetoric API router with CRUD + SSE streaming endpoints

**Files:**
- Create: `backend/app/api/rhetoric.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the rhetoric router**

Create `backend/app/api/rhetoric.py`:

```python
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models import RhetoricStrategy, WeeklyCollection
from app.ai.claude_cli import ClaudeCLI

router = APIRouter(prefix="/api/rhetoric", tags=["rhetoric"])
claude = ClaudeCLI()


class RhetoricStrategyCreate(BaseModel):
    name: str
    description: str
    structure_template: str
    example: str = ""


class RhetoricStrategyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    structure_template: str | None = None
    example: str | None = None


class RhetoricSequenceItem(BaseModel):
    name: str = ""
    description: str = ""
    structure_template: str = ""


class PunchlineRequest(BaseModel):
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []
    rhetoric_sequence: list[RhetoricSequenceItem] = []


class BeatsRequest(BaseModel):
    punchline: str
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []
    rhetoric_sequence: list[RhetoricSequenceItem] = []


@router.get("/")
def list_strategies(session: Session = Depends(get_session)):
    stmt = select(RhetoricStrategy).order_by(RhetoricStrategy.display_order)
    return session.exec(stmt).all()


@router.post("/", status_code=201)
def create_strategy(data: RhetoricStrategyCreate, session: Session = Depends(get_session)):
    # Get max display_order for new custom strategy
    stmt = select(RhetoricStrategy).order_by(RhetoricStrategy.display_order.desc())
    last = session.exec(stmt).first()
    order = (last.display_order + 1) if last else 0

    strategy = RhetoricStrategy(
        name=data.name,
        description=data.description,
        structure_template=data.structure_template,
        example=data.example,
        is_custom=True,
        display_order=order,
    )
    session.add(strategy)
    session.commit()
    session.refresh(strategy)
    return strategy


@router.put("/{strategy_id}")
def update_strategy(strategy_id: int, data: RhetoricStrategyUpdate, session: Session = Depends(get_session)):
    strategy = session.get(RhetoricStrategy, strategy_id)
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    if not strategy.is_custom:
        raise HTTPException(status_code=403, detail="לא ניתן לערוך אסטרטגיה מובנית")
    if data.name is not None:
        strategy.name = data.name
    if data.description is not None:
        strategy.description = data.description
    if data.structure_template is not None:
        strategy.structure_template = data.structure_template
    if data.example is not None:
        strategy.example = data.example
    session.add(strategy)
    session.commit()
    session.refresh(strategy)
    return strategy


@router.delete("/{strategy_id}")
def delete_strategy(strategy_id: int, session: Session = Depends(get_session)):
    strategy = session.get(RhetoricStrategy, strategy_id)
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    if not strategy.is_custom:
        raise HTTPException(status_code=403, detail="לא ניתן למחוק אסטרטגיה מובנית")
    session.delete(strategy)
    session.commit()
    return {"ok": True}


def _resolve_news_themes(collection: WeeklyCollection, req):
    """Resolve news/theme indices to full items."""
    all_news = collection.news_items or []
    all_themes = collection.parasha_themes or []
    focused_news = [all_news[i] for i in req.selected_news if i < len(all_news)]
    focused_news.extend([{"title": t, "summary": t} for t in req.custom_news])
    focused_themes = [all_themes[i] for i in req.selected_themes if i < len(all_themes)]
    focused_themes.extend([{"title": t, "description": t} for t in req.custom_themes])
    return focused_news, focused_themes


@router.post("/{collection_id}/punchlines")
async def stream_punchlines(
    collection_id: int,
    req: PunchlineRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    focused_news, focused_themes = _resolve_news_themes(collection, req)
    rhetoric_seq = [s.model_dump() for s in req.rhetoric_sequence]

    async def generate():
        import asyncio
        task = asyncio.create_task(
            claude.generate_punchlines(
                news_items=focused_news,
                themes=focused_themes,
                rhetoric_sequence=rhetoric_seq,
            )
        )
        while not task.done():
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            await asyncio.sleep(3)
        punchlines = task.result()
        yield f"data: {json.dumps({'type': 'done', 'punchlines': punchlines}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/{collection_id}/beats")
async def stream_beats(
    collection_id: int,
    req: BeatsRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    focused_news, focused_themes = _resolve_news_themes(collection, req)
    rhetoric_seq = [s.model_dump() for s in req.rhetoric_sequence]

    async def generate():
        import asyncio
        task = asyncio.create_task(
            claude.generate_beats(
                punchline=req.punchline,
                news_items=focused_news,
                themes=focused_themes,
                rhetoric_sequence=rhetoric_seq,
            )
        )
        while not task.done():
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            await asyncio.sleep(3)
        beats = task.result()
        yield f"data: {json.dumps({'type': 'done', 'beats': beats}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, update import:

```python
from app.api import parasha, news, dvar_tora, pdf, settings, mefarshim, rhetoric
```

Add at end:

```python
app.include_router(rhetoric.router)
```

- [ ] **Step 3: Verify**

Run: `cd /home/oshrin/projects/dvar-tora/backend && .venv/bin/python -c "from app.api.rhetoric import router; print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/rhetoric.py backend/app/main.py
git commit -m "feat: add rhetoric CRUD and SSE streaming endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Add frontend types and API methods

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add types to types.ts**

Append to `frontend/src/lib/types.ts`:

```typescript
export interface RhetoricStrategy {
  id: number
  key: string
  name: string
  description: string
  structure_template: string
  example: string
  is_custom: boolean
  display_order: number
}

export interface DrashaBeat {
  strategy_name: string
  beat: string
}
```

- [ ] **Step 2: Add API methods to api.ts**

Add the import for new types at the top of `frontend/src/lib/api.ts`:

```typescript
import type { WeeklyCollection, DvarToraSuggestion, DvarTora, MefarshimResult, RhetoricStrategy, DrashaBeat } from './types'
```

Add these methods to the `api` object:

```typescript
  getRhetoricStrategies: () =>
    fetchJSON<RhetoricStrategy[]>('/rhetoric/'),

  createRhetoricStrategy: (data: { name: string; description: string; structure_template: string; example?: string }) =>
    fetchJSON<RhetoricStrategy>('/rhetoric/', { method: 'POST', body: JSON.stringify(data) }),

  updateRhetoricStrategy: (id: number, data: Partial<RhetoricStrategy>) =>
    fetchJSON<RhetoricStrategy>(`/rhetoric/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteRhetoricStrategy: (id: number) =>
    fetchJSON<{ ok: boolean }>(`/rhetoric/${id}`, { method: 'DELETE' }),

  streamPunchlines: async (
    collectionId: number,
    request: {
      selected_news: number[]
      selected_themes: number[]
      custom_news: string[]
      custom_themes: string[]
      rhetoric_sequence: { name: string; description: string; structure_template: string }[]
    },
    onDone: (punchlines: string[]) => void,
    onHeartbeat?: () => void,
  ) => {
    const resp = await fetch(`${BASE}/rhetoric/${collectionId}/punchlines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = JSON.parse(line.slice(6))
        if (data.type === 'heartbeat') onHeartbeat?.()
        else if (data.type === 'done') onDone(data.punchlines)
      }
    }
  },

  streamBeats: async (
    collectionId: number,
    request: {
      punchline: string
      selected_news: number[]
      selected_themes: number[]
      custom_news: string[]
      custom_themes: string[]
      rhetoric_sequence: { name: string; description: string; structure_template: string }[]
    },
    onDone: (beats: DrashaBeat[]) => void,
    onHeartbeat?: () => void,
  ) => {
    const resp = await fetch(`${BASE}/rhetoric/${collectionId}/beats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = JSON.parse(line.slice(6))
        if (data.type === 'heartbeat') onHeartbeat?.()
        else if (data.type === 'done') onDone(data.beats)
      }
    }
  },
```

- [ ] **Step 3: Verify TypeScript**

Run: `cd /home/oshrin/projects/dvar-tora/frontend && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: add RhetoricStrategy types and streaming API methods

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Create RhetoricPunchline stage component

**Files:**
- Create: `frontend/src/components/RhetoricPunchline.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/RhetoricPunchline.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { WeeklyCollection, RhetoricStrategy, DrashaBeat } from '../lib/types'

interface RhetoricPunchlineProps {
  collection: WeeklyCollection
  selection: {
    selectedNews: number[]
    selectedThemes: number[]
    customNews: string[]
    customThemes: string[]
  }
  onComplete: (rhetoric: RhetoricStrategy[], punchline: string, beats: DrashaBeat[]) => void
  onBack: () => void
}

export function RhetoricPunchline({ collection, selection, onComplete, onBack }: RhetoricPunchlineProps) {
  const [strategies, setStrategies] = useState<RhetoricStrategy[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [punchlines, setPunchlines] = useState<string[]>([])
  const [selectedPunchline, setSelectedPunchline] = useState('')
  const [customPunchline, setCustomPunchline] = useState('')
  const [beats, setBeats] = useState<DrashaBeat[]>([])
  const [loadingPunchlines, setLoadingPunchlines] = useState(false)
  const [loadingBeats, setLoadingBeats] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStrategy, setNewStrategy] = useState({ name: '', description: '', structure_template: '' })
  const [expandedExample, setExpandedExample] = useState<number | null>(null)

  useEffect(() => {
    api.getRhetoricStrategies().then(setStrategies)
  }, [])

  const selectedStrategies = selectedIds.map(id => strategies.find(s => s.id === id)!).filter(Boolean)

  const toggleStrategy = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const moveStrategy = (id: number, direction: 'up' | 'down') => {
    setSelectedIds(prev => {
      const idx = prev.indexOf(id)
      if (idx < 0) return prev
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
      return copy
    })
  }

  const handleAddStrategy = async () => {
    if (!newStrategy.name) return
    const created = await api.createRhetoricStrategy(newStrategy)
    setStrategies(prev => [...prev, created])
    setNewStrategy({ name: '', description: '', structure_template: '' })
    setShowAddForm(false)
  }

  const handleGeneratePunchlines = async () => {
    setLoadingPunchlines(true)
    setPunchlines([])
    await api.streamPunchlines(
      collection.id,
      {
        selected_news: selection.selectedNews,
        selected_themes: selection.selectedThemes,
        custom_news: selection.customNews,
        custom_themes: selection.customThemes,
        rhetoric_sequence: selectedStrategies.map(s => ({
          name: s.name,
          description: s.description,
          structure_template: s.structure_template,
        })),
      },
      (result) => {
        setPunchlines(result)
        setLoadingPunchlines(false)
      },
      () => { /* heartbeat */ },
    )
  }

  const handleGenerateBeats = async () => {
    const punch = selectedPunchline || customPunchline
    if (!punch) return
    setLoadingBeats(true)
    setBeats([])
    await api.streamBeats(
      collection.id,
      {
        punchline: punch,
        selected_news: selection.selectedNews,
        selected_themes: selection.selectedThemes,
        custom_news: selection.customNews,
        custom_themes: selection.customThemes,
        rhetoric_sequence: selectedStrategies.map(s => ({
          name: s.name,
          description: s.description,
          structure_template: s.structure_template,
        })),
      },
      (result) => {
        setBeats(result)
        setLoadingBeats(false)
      },
      () => { /* heartbeat */ },
    )
  }

  const activePunchline = customPunchline || selectedPunchline

  const handleContinue = () => {
    onComplete(selectedStrategies, activePunchline, beats)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={onBack} className="text-blue-600 mb-4 hover:underline">&rarr; חזרה</button>
      <h2 className="text-3xl font-serif font-bold mb-2">רטוריקה ופאנצ'ליין &mdash; {collection.parasha_name}</h2>
      <p className="text-gray-500 mb-6">בחר אסטרטגיות רטוריות וסדר אותן, ואז הגדר את הפאנצ'ליין</p>

      {/* Section 1: Strategy Picker */}
      <h3 className="text-lg font-bold mb-3">אסטרטגיות רטוריות</h3>
      <div className="grid gap-3 mb-4">
        {strategies.map(s => (
          <div
            key={s.id}
            onClick={() => toggleStrategy(s.id)}
            className={`border rounded-lg p-4 cursor-pointer transition ${
              selectedIds.includes(s.id) ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold">{s.name}</h4>
                  {s.is_custom && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">מותאם אישית</span>}
                </div>
                <p className="text-gray-600 text-sm mt-1">{s.description}</p>
                <p className="text-gray-400 text-xs mt-1">מבנה: {s.structure_template}</p>
                {s.example && (
                  <div className="mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedExample(expandedExample === s.id ? null : s.id) }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {expandedExample === s.id ? 'הסתר דוגמה' : 'הצג דוגמה'}
                    </button>
                    {expandedExample === s.id && (
                      <p className="mt-1 text-sm text-gray-700 bg-amber-50 p-2 rounded">{s.example}</p>
                    )}
                  </div>
                )}
              </div>
              {selectedIds.includes(s.id) && (
                <div className="flex flex-col gap-1 mr-3" onClick={e => e.stopPropagation()}>
                  <button onClick={() => moveStrategy(s.id, 'up')} className="text-gray-400 hover:text-gray-700 text-sm">&uarr;</button>
                  <span className="text-xs text-blue-600 font-bold text-center">{selectedIds.indexOf(s.id) + 1}</span>
                  <button onClick={() => moveStrategy(s.id, 'down')} className="text-gray-400 hover:text-gray-700 text-sm">&darr;</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="text-blue-600 text-sm hover:underline mb-4"
      >
        + הוסף אסטרטגיה
      </button>

      {showAddForm && (
        <div className="border rounded-lg p-4 mb-6 bg-gray-50">
          <input
            value={newStrategy.name}
            onChange={e => setNewStrategy(prev => ({ ...prev, name: e.target.value }))}
            placeholder="שם האסטרטגיה"
            className="w-full border rounded p-2 mb-2"
          />
          <input
            value={newStrategy.description}
            onChange={e => setNewStrategy(prev => ({ ...prev, description: e.target.value }))}
            placeholder="תיאור (1-2 משפטים)"
            className="w-full border rounded p-2 mb-2"
          />
          <input
            value={newStrategy.structure_template}
            onChange={e => setNewStrategy(prev => ({ ...prev, structure_template: e.target.value }))}
            placeholder="תבנית מבנה (למשל: פתח עם..., בנה דרך..., סיים ב...)"
            className="w-full border rounded p-2 mb-2"
          />
          <div className="flex gap-2">
            <button onClick={handleAddStrategy} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">שמור</button>
            <button onClick={() => setShowAddForm(false)} className="text-gray-500 px-4 py-2">ביטול</button>
          </div>
        </div>
      )}

      {/* Section 2: Punchline */}
      {selectedIds.length > 0 && (
        <>
          <h3 className="text-lg font-bold mb-3 mt-8">פאנצ'ליין</h3>
          <p className="text-gray-500 text-sm mb-3">המסר המרכזי שהקהל ייקח מהדרשה</p>

          <div className="flex gap-3 mb-4">
            <button
              onClick={handleGeneratePunchlines}
              disabled={loadingPunchlines}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loadingPunchlines ? 'Claude חושב...' : 'צור פאנצ\'ליין'}
            </button>
          </div>

          {loadingPunchlines && (
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-amber-700 font-medium">Claude חושב על פאנצ'ליינים...</span>
            </div>
          )}

          {punchlines.length > 0 && (
            <div className="grid gap-3 mb-4">
              {punchlines.map((p, i) => (
                <div
                  key={i}
                  onClick={() => { setSelectedPunchline(p); setCustomPunchline('') }}
                  className={`border rounded-lg p-4 cursor-pointer transition ${
                    selectedPunchline === p && !customPunchline
                      ? 'bg-green-50 border-green-400'
                      : 'bg-white border-gray-200 hover:border-green-300'
                  }`}
                >
                  <p className="text-gray-800">{p}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mb-6">
            <input
              value={customPunchline}
              onChange={e => { setCustomPunchline(e.target.value); setSelectedPunchline('') }}
              placeholder="או כתוב פאנצ'ליין משלך..."
              className="w-full border rounded-lg p-3 text-gray-800"
            />
          </div>

          {/* Optional Beats */}
          {activePunchline && (
            <>
              <h3 className="text-lg font-bold mb-3">ביטים (אופציונלי)</h3>
              <p className="text-gray-500 text-sm mb-3">נקודת ציון לכל שלב ברצף הרטורי</p>

              <button
                onClick={handleGenerateBeats}
                disabled={loadingBeats}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 mb-4"
              >
                {loadingBeats ? 'Claude חושב...' : 'צור ביטים'}
              </button>

              {loadingBeats && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-amber-700 font-medium">Claude חושב על ביטים...</span>
                </div>
              )}

              {beats.length > 0 && (
                <div className="grid gap-3 mb-6">
                  {beats.map((b, i) => (
                    <div key={i} className="border rounded-lg p-4 bg-white">
                      <div className="text-sm text-blue-600 font-medium mb-1">{b.strategy_name}</div>
                      <input
                        value={b.beat}
                        onChange={e => {
                          const newBeats = [...beats]
                          newBeats[i] = { ...b, beat: e.target.value }
                          setBeats(newBeats)
                        }}
                        className="w-full border-b border-gray-200 p-1 text-gray-800 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Continue */}
          {activePunchline && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleContinue}
                className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-green-700 transition"
              >
                המשך
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/RhetoricPunchline.tsx
git commit -m "feat: create RhetoricPunchline stage component

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Wire RhetoricPunchline into App.tsx wizard flow

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update App.tsx**

1. Add import:
```typescript
import { RhetoricPunchline } from './components/RhetoricPunchline'
```

2. Add to type imports:
```typescript
import type { WeeklyCollection, DvarTora, MefarshimResult, RhetoricStrategy, DrashaBeat } from './lib/types'
```

3. Change View type:
```typescript
type View = 'dashboard' | 'rhetoric' | 'style' | 'mefarshim' | 'suggestions' | 'editor'
```

4. Update `UserSelection` to include rhetoric fields:
```typescript
export interface UserSelection {
  selectedNews: number[]
  selectedThemes: number[]
  customNews: string[]
  customThemes: string[]
  style?: StylePrefs
  rhetoricSequence?: RhetoricStrategy[]
  punchline?: string
  beats?: DrashaBeat[]
}
```

5. Change Dashboard's `onProceed` to go to `'rhetoric'` instead of `'style'`:
```typescript
setView('rhetoric')  // was: setView('style')
```

6. Add rhetoric view block between dashboard and style:
```typescript
{view === 'rhetoric' && collection && selection && (
  <RhetoricPunchline
    collection={collection}
    selection={selection}
    onComplete={(rhetoric, punchline, beats) => {
      setSelection(prev => prev ? { ...prev, rhetoricSequence: rhetoric, punchline, beats } : null)
      setView('style')
    }}
    onBack={() => setView('dashboard')}
  />
)}
```

7. Update style's `onBack` to go to `'rhetoric'`:
```typescript
onBack={() => setView('rhetoric')}  // was: setView('dashboard')
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /home/oshrin/projects/dvar-tora/frontend && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire RhetoricPunchline stage into wizard flow

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Pass rhetoric data to downstream stages

**Files:**
- Modify: `backend/app/api/dvar_tora.py` (SelectionContext)
- Modify: `backend/app/ai/claude_cli.py` (_build_focused_prompt)
- Modify: `frontend/src/lib/api.ts` (streamSuggestionsFocused)
- Modify: `frontend/src/components/SuggestionCards.tsx` (handleGenerate)

- [ ] **Step 1: Add rhetoric fields to SelectionContext**

In `backend/app/api/dvar_tora.py`, update `SelectionContext`:

```python
class SelectionContext(BaseModel):
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []
    style: StylePreferences | None = None
    mefarshim_summaries: list[MefarshimSummary] = []
    rhetoric_sequence: list[dict] = []
    punchline: str = ""
    beats: list[dict] = []
```

- [ ] **Step 2: Update _build_focused_prompt to append rhetoric section**

In `backend/app/ai/claude_cli.py`, update the `_build_focused_prompt` method signature to accept new params:

```python
def _build_focused_prompt(
    self,
    parasha_name: str,
    parasha_text: str,
    news_items: list[dict],
    themes: list[dict],
    connections: list[dict],
    mefarshim_texts: dict[str, list[dict]],
    style: dict | None = None,
    rhetoric_sequence: list[dict] | None = None,
    punchline: str = "",
    beats: list[dict] | None = None,
) -> str:
```

At the end of the method, before `return`, append a rhetoric section to the formatted prompt:

```python
        result = FOCUSED_SUGGESTION_PROMPT_TEMPLATE.format(
            parasha_name=parasha_name,
            parasha_text=parasha_text[:2000],
            news_section=news_section,
            themes_section=themes_section,
            connections_section=connections_section,
            mefarshim_section=mefarshim_section,
            style_section=style_section,
        )
        # Append rhetoric context if provided
        if rhetoric_sequence or punchline:
            rhetoric_parts = []
            if punchline:
                rhetoric_parts.append(f"## פאנצ'ליין (המסר המרכזי)\n{punchline}")
            if rhetoric_sequence:
                seq = "\n".join(
                    f"{i+1}. **{s.get('name', '')}**: {s.get('structure_template', '')}"
                    for i, s in enumerate(rhetoric_sequence)
                )
                rhetoric_parts.append(f"## רצף רטורי\n{seq}")
            if beats:
                beats_text = "\n".join(
                    f"- {b.get('strategy_name', '')}: {b.get('beat', '')}" for b in beats
                )
                rhetoric_parts.append(f"## ביטים\n{beats_text}")
            rhetoric_parts.append("## הנחיה נוספת\nהתאם את ההצעות לפאנצ'ליין ולרצף הרטורי שלמעלה. כל הצעה צריכה לבנות את הדרשה לכיוון הפאנצ'ליין.")
            result += "\n\n" + "\n\n".join(rhetoric_parts)
        return result
```

- [ ] **Step 3: Pass rhetoric fields through in stream_from_selection**

In `backend/app/api/dvar_tora.py`, update both `generate_from_selection` and `stream_from_selection` to pass the new fields. In each, add to the `claude.stream_suggestions_focused()` / `claude.generate_suggestions_focused()` call:

```python
rhetoric_sequence=ctx.rhetoric_sequence if ctx.rhetoric_sequence else None,
punchline=ctx.punchline,
beats=ctx.beats if ctx.beats else None,
```

Also update `stream_suggestions_focused` and `generate_suggestions_focused` method signatures in `claude_cli.py` to accept and forward these params.

- [ ] **Step 4: Update frontend to send rhetoric data**

In `frontend/src/lib/api.ts`, add rhetoric fields to the `streamSuggestionsFocused` selection type and body:

```typescript
// Add to selection type:
rhetoricSequence?: { name: string; description: string; structure_template: string }[]
punchline?: string
beats?: { strategy_name: string; beat: string }[]
```

```typescript
// Add to body JSON:
rhetoric_sequence: selection.rhetoricSequence || [],
punchline: selection.punchline || '',
beats: selection.beats || [],
```

In `frontend/src/components/SuggestionCards.tsx`, update `handleGenerate` to pass rhetoric data from `selection`:

```typescript
rhetoricSequence: selection.rhetoricSequence?.map(s => ({
  name: s.name,
  description: s.description,
  structure_template: s.structure_template,
})),
punchline: selection.punchline,
beats: selection.beats,
```

- [ ] **Step 5: Verify**

Run: `cd /home/oshrin/projects/dvar-tora/frontend && npx tsc --noEmit 2>&1 | head -5`
Run: `cd /home/oshrin/projects/dvar-tora/backend && .venv/bin/python -c "from app.api.dvar_tora import SelectionContext; print('OK')"`

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/dvar_tora.py backend/app/ai/claude_cli.py frontend/src/lib/api.ts frontend/src/components/SuggestionCards.tsx
git commit -m "feat: pass rhetoric data through to suggestion generation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Restart services and manual test

- [ ] **Step 1: Restart both services**

```bash
systemctl --user restart dvar-tora-backend dvar-tora-frontend
```

- [ ] **Step 2: Verify services running**

```bash
systemctl --user status dvar-tora-backend dvar-tora-frontend --no-pager | head -20
```

- [ ] **Step 3: Verify strategies are seeded**

```bash
curl -s http://localhost:8085/api/rhetoric/ | python3 -m json.tool | head -20
```

Expected: 4 pre-seeded strategies with Hebrew names.

- [ ] **Step 4: Manual test flow**

Open `http://code-agents-server.local/dvar-tora/` in browser:
1. Dashboard: select news + themes → click continue
2. **NEW — Rhetoric & Punchline**: select strategies, reorder, click "צור פאנצ'ליין", pick one, optionally generate beats → click "המשך"
3. Style: pick preferences → continue
4. Mefarshim Research → continue
5. Suggestions: verify suggestions reference the punchline/rhetoric
