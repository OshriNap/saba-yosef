# Drasha Flow Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collaborative flow builder that lets the user define drasha structure section-by-section with Claude, as an alternative to the current quick suggestions path.

**Architecture:** New `FlowBuilder` component inserted as optional stage between rhetoric and style. Three new streaming endpoints for flow generation/refinement. Hybrid persistence — frontend state with optional DB save. Existing quick path unchanged.

**Tech Stack:** React + TypeScript + Tailwind (frontend), FastAPI + SQLModel + Claude CLI (backend)

**Spec:** `docs/superpowers/specs/2026-03-30-drasha-flow-builder-design.md`

---

## File Structure

### New Files
- `backend/app/api/flow.py` — Flow router: generate-flow, refine-section, refine-flow, save, load endpoints
- `frontend/src/components/FlowBuilder.tsx` — Main flow builder UI component

### Modified Files
- `backend/app/models.py` — Add `DrashaFlow` DB model
- `backend/app/main.py` — Register flow router
- `backend/app/ai/prompts.py` — Add 3 new prompt templates
- `backend/app/ai/claude_cli.py` — Add 3 new methods
- `frontend/src/lib/types.ts` — Add `FlowSection`, `DrashaFlow` types
- `frontend/src/lib/api.ts` — Add flow API methods
- `frontend/src/App.tsx` — Add flow-builder view, fork after rhetoric
- `frontend/src/components/RhetoricPunchline.tsx` — Fork buttons (build flow vs skip)

---

### Task 1: Backend Data Model

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Add DrashaFlow model**

Add to the end of `backend/app/models.py`:

```python
class DrashaFlow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    collection_id: int
    punchline: str = ""
    sections: list = Field(default=[], sa_column=Column(JSON))
    total_minutes: int = 0
    created_at: str = ""
    updated_at: str = ""
```

- [ ] **Step 2: Register the model**

Add `DrashaFlow` to the imports used by `init_db()`. Since `init_db()` in `backend/app/database.py` calls `SQLModel.metadata.create_all(engine)`, the model just needs to be imported before that runs. Add the import in `backend/app/main.py`:

```python
from app.models import DrashaFlow  # noqa: F401 — ensure table is created
```

Add this line right after the existing imports from `app.models` in `main.py`.

- [ ] **Step 3: Restart backend and verify table creation**

Run:
```bash
kill $(lsof -t -i :8086) 2>/dev/null; sleep 1
cd /home/oshrin/projects/dvar-tora/backend && nohup .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8086 > /tmp/dvar-tora-backend.log 2>&1 &
sleep 2 && .venv/bin/python3 -c "
from app.database import engine
from sqlmodel import text, Session
with Session(engine) as s:
    result = s.exec(text(\"SELECT name FROM sqlite_master WHERE type='table' AND name='drashaflow'\"))
    print('Table exists:', bool(result.first()))
"
```

Expected: `Table exists: True`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models.py backend/app/main.py
git commit -m "feat: add DrashaFlow model for drasha flow builder"
```

---

### Task 2: Prompt Templates

**Files:**
- Modify: `backend/app/ai/prompts.py`

- [ ] **Step 1: Add FLOW_GENERATE_PROMPT**

Add at the end of `backend/app/ai/prompts.py`:

```python
FLOW_GENERATE_PROMPT = """# בניית מהלך דרשה

## פאנצ'ליין
{punchline}

## חדשות שנבחרו
{news_section}

## נושאי פרשה שנבחרו
{themes_section}

## קשרים שזוהו
{connections_section}

## רצף אסטרטגיות רטוריות
{rhetoric_section}

## הנחיות
אתה מומחה לבניית דרשות. המשתמש בחר את החומרים למעלה ורוצה לבנות מהלך דרשה שמוביל לפאנצ'ליין.

בנה מהלך של 4-6 שלבים. לכל שלב תן:
- title: כותרת קצרה שמתארת את השלב
- description: 2-3 משפטים שמסבירים מה קורה בשלב הזה ואיך הוא משרת את המהלך הכולל
- rhetoricalMove: אחד מ: "hook" (לתפוס תשומת לב), "build" (לבנות את הרעיון), "surprise" (להפתיע/להפוך פרספקטיבה), "deepen" (העמקה תורנית), "resolve" (לקשור חוטים), "land" (נחיתה על הפאנצ'ליין)
- assignedNews: מספרי אינדקס של חדשות רלוונטיות לשלב (מתוך הרשימה למעלה, 0-based)
- assignedThemes: מספרי אינדקס של נושאי פרשה רלוונטיים (0-based)
- mefareshSlot: רמז חופשי לאיזה מפרש/ציטוט יתאים כאן (למשל "רש"י על פסוק X" או "מדרש על Y")
- transitionTo: משפט אחד שמתאר איך עוברים מהשלב הזה לבא אחריו (ריק בשלב האחרון)
- estimatedMinutes: הערכת זמן בדקות (סה"כ צריך להיות 6-10 דקות)

וודא שהמהלך:
1. מתחיל ב-hook שתופס את הקהל
2. בונה מתח או סקרנות לקראת הפאנצ'ליין
3. כולל לפחות שלב אחד של העמקה תורנית (deepen)
4. נוחת על הפאנצ'ליין בשלב האחרון
5. המעברים בין השלבים זורמים בצורה טבעית

כתוב בעברית.

החזר JSON בפורמט:
{{"sections": [{{"title": "...", "description": "...", "rhetoricalMove": "hook|build|surprise|deepen|resolve|land", "assignedNews": [0], "assignedThemes": [1], "mefareshSlot": "...", "transitionTo": "...", "estimatedMinutes": 2}}]}}
"""
```

- [ ] **Step 2: Add FLOW_REFINE_SECTION_PROMPT**

```python
FLOW_REFINE_SECTION_PROMPT = """# שכלול שלב בדרשה

## פאנצ'ליין
{punchline}

## המהלך המלא (להקשר)
{flow_summary}

## השלב לשכלול
{section_json}

## השלב שלפני
{prev_section}

## השלב שאחרי
{next_section}

## הנחיית המשתמש
{instruction}

## הנחיות
שכלל את השלב המבוקש בהתאם להנחיית המשתמש. שמור על קוהרנטיות עם השלבים שמסביב — במיוחד את המעברים.

החזר את השלב המשופר כ-JSON בפורמט:
{{"title": "...", "description": "...", "rhetoricalMove": "...", "assignedNews": [...], "assignedThemes": [...], "mefareshSlot": "...", "transitionTo": "...", "estimatedMinutes": ...}}
"""
```

- [ ] **Step 3: Add FLOW_REFINE_GLOBAL_PROMPT**

```python
FLOW_REFINE_GLOBAL_PROMPT = """# שכלול מהלך דרשה

## פאנצ'ליין
{punchline}

## חדשות זמינות
{news_section}

## נושאי פרשה זמינים
{themes_section}

## המהלך הנוכחי
{flow_json}

## הנחיית המשתמש (אופציונלי)
{instruction}

## הנחיות
בדוק את המהלך ושפר אותו:
1. האם המעברים בין השלבים זורמים?
2. האם יש שלבים מיותרים או חסרים?
3. האם הקצב נכון (לא ארוך מדי בהתחלה, לא קצר מדי בסוף)?
4. האם כל שלב משרת את המהלך לפאנצ'ליין?
5. האם חסרים מהלכים רטוריים חשובים?

החזר את המהלך המשופר כ-JSON + הסבר קצר:
{{"sections": [...], "changes": "תיאור קצר של מה השתנה ולמה"}}
"""
```

- [ ] **Step 4: Add the import in prompts.py**

No additional import needed — these are module-level strings.

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/prompts.py
git commit -m "feat: add flow builder prompt templates"
```

---

### Task 3: Claude CLI Methods

**Files:**
- Modify: `backend/app/ai/claude_cli.py`

- [ ] **Step 1: Add import for new prompts**

In `backend/app/ai/claude_cli.py`, update the import block (lines 4-15) to include the new prompts:

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
    FLOW_GENERATE_PROMPT,
    FLOW_REFINE_SECTION_PROMPT,
    FLOW_REFINE_GLOBAL_PROMPT,
)
```

- [ ] **Step 2: Add _parse_json helper**

Add this private method to `ClaudeCLI` class, before the `generate_punchlines` method:

```python
    def _parse_json(self, raw: str) -> dict:
        """Extract and parse JSON from Claude's response, handling markdown fences."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)
        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        return json.loads(cleaned[start:end])
```

- [ ] **Step 3: Add generate_flow method**

Add after the `generate_beats` method:

```python
    async def generate_flow(
        self,
        punchline: str,
        news_items: list[dict],
        themes: list[dict],
        connections: list[dict],
        rhetoric_sequence: list[dict],
    ) -> dict:
        """Generate a 4-6 section drasha flow."""
        news_section = "\n".join(
            f"{i}. {item.get('title', '')}: {item.get('summary', '')}" for i, item in enumerate(news_items)
        ) or "לא נבחרו חדשות"
        themes_section = "\n".join(
            f"{i}. {t.get('title', '')}: {t.get('description', '')}" for i, t in enumerate(themes)
        ) or "לא נבחרו נושאי פרשה"
        connections_section = "\n".join(
            f"- חדשה {c.get('news_index', '')} ↔ נושא {c.get('theme_index', '')}: {c.get('reason', '')}"
            for c in connections
        ) or "לא זוהו קשרים"
        rhetoric_section = "\n".join(
            f"{i+1}. **{s.get('name', '')}**: {s.get('description', '')} — מבנה: {s.get('structure_template', '')}"
            for i, s in enumerate(rhetoric_sequence)
        ) or "לא נבחרו אסטרטגיות"

        prompt = FLOW_GENERATE_PROMPT.format(
            punchline=punchline,
            news_section=news_section,
            themes_section=themes_section,
            connections_section=connections_section,
            rhetoric_section=rhetoric_section,
        )
        raw = await self._run_claude(prompt)
        try:
            data = self._parse_json(raw)
            return data
        except (ValueError, json.JSONDecodeError):
            return {"sections": []}
```

- [ ] **Step 4: Add refine_section method**

```python
    async def refine_section(
        self,
        punchline: str,
        flow_sections: list[dict],
        section_index: int,
        instruction: str,
    ) -> dict:
        """Refine a single section of the flow."""
        flow_summary = "\n".join(
            f"{i+1}. [{s.get('rhetoricalMove', '')}] {s.get('title', '')}"
            for i, s in enumerate(flow_sections)
        )
        section_json = json.dumps(flow_sections[section_index], ensure_ascii=False, indent=2)
        prev_section = json.dumps(flow_sections[section_index - 1], ensure_ascii=False, indent=2) if section_index > 0 else "אין — זה השלב הראשון"
        next_section = json.dumps(flow_sections[section_index + 1], ensure_ascii=False, indent=2) if section_index < len(flow_sections) - 1 else "אין — זה השלב האחרון"

        prompt = FLOW_REFINE_SECTION_PROMPT.format(
            punchline=punchline,
            flow_summary=flow_summary,
            section_json=section_json,
            prev_section=prev_section,
            next_section=next_section,
            instruction=instruction,
        )
        raw = await self._run_claude(prompt)
        try:
            return self._parse_json(raw)
        except (ValueError, json.JSONDecodeError):
            return flow_sections[section_index]
```

- [ ] **Step 5: Add refine_flow method**

```python
    async def refine_flow(
        self,
        punchline: str,
        news_items: list[dict],
        themes: list[dict],
        flow_sections: list[dict],
        instruction: str = "",
    ) -> dict:
        """Refine the entire flow for coherence."""
        news_section = "\n".join(
            f"{i}. {item.get('title', '')}: {item.get('summary', '')}" for i, item in enumerate(news_items)
        ) or "לא נבחרו חדשות"
        themes_section = "\n".join(
            f"{i}. {t.get('title', '')}: {t.get('description', '')}" for i, t in enumerate(themes)
        ) or "לא נבחרו נושאי פרשה"
        flow_json = json.dumps(flow_sections, ensure_ascii=False, indent=2)

        prompt = FLOW_REFINE_GLOBAL_PROMPT.format(
            punchline=punchline,
            news_section=news_section,
            themes_section=themes_section,
            flow_json=flow_json,
            instruction=instruction or "שפר את המהלך הכללי",
        )
        raw = await self._run_claude(prompt)
        try:
            return self._parse_json(raw)
        except (ValueError, json.JSONDecodeError):
            return {"sections": flow_sections, "changes": ""}
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/ai/claude_cli.py
git commit -m "feat: add Claude CLI methods for flow generation and refinement"
```

---

### Task 4: Flow API Endpoints

**Files:**
- Create: `backend/app/api/flow.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create flow.py router**

Create `backend/app/api/flow.py`:

```python
import json
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models import WeeklyCollection, DrashaFlow
from app.ai.claude_cli import ClaudeCLI

router = APIRouter(prefix="/api/flow", tags=["flow"])
claude = ClaudeCLI()


class RhetoricSequenceItem(BaseModel):
    name: str = ""
    description: str = ""
    structure_template: str = ""


class GenerateFlowRequest(BaseModel):
    punchline: str
    rhetoric_sequence: list[RhetoricSequenceItem] = []
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []


class RefineSectionRequest(BaseModel):
    punchline: str
    sections: list[dict]
    section_index: int
    instruction: str


class RefineFlowRequest(BaseModel):
    punchline: str
    sections: list[dict]
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []
    instruction: str = ""


class SaveFlowRequest(BaseModel):
    punchline: str
    sections: list[dict]
    total_minutes: int = 0


def _resolve_news_themes(collection: WeeklyCollection, req):
    all_news = collection.news_items or []
    all_themes = collection.parasha_themes or []
    focused_news = [all_news[i] for i in req.selected_news if i < len(all_news)]
    focused_news.extend([{"title": t, "summary": t} for t in req.custom_news])
    focused_themes = [all_themes[i] for i in req.selected_themes if i < len(all_themes)]
    focused_themes.extend([{"title": t, "description": t} for t in req.custom_themes])
    return focused_news, focused_themes


@router.post("/{collection_id}/generate")
async def generate_flow(
    collection_id: int,
    req: GenerateFlowRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    focused_news, focused_themes = _resolve_news_themes(collection, req)
    connections = [
        c for c in (collection.connections or [])
        if c.get("news_index") in req.selected_news or c.get("theme_index") in req.selected_themes
    ]
    rhetoric_seq = [s.model_dump() for s in req.rhetoric_sequence]

    async def generate():
        task = asyncio.create_task(
            claude.generate_flow(
                punchline=req.punchline,
                news_items=focused_news,
                themes=focused_themes,
                connections=connections,
                rhetoric_sequence=rhetoric_seq,
            )
        )
        while not task.done():
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            await asyncio.sleep(3)
        try:
            result = task.result()
            sections = result.get("sections", [])
        except Exception as e:
            sections = []
        total = sum(s.get("estimatedMinutes", 0) for s in sections)
        yield f"data: {json.dumps({'type': 'done', 'sections': sections, 'totalMinutes': total}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/{collection_id}/refine-section")
async def refine_section(
    collection_id: int,
    req: RefineSectionRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if req.section_index < 0 or req.section_index >= len(req.sections):
        raise HTTPException(status_code=400, detail="Invalid section index")

    async def generate():
        task = asyncio.create_task(
            claude.refine_section(
                punchline=req.punchline,
                flow_sections=req.sections,
                section_index=req.section_index,
                instruction=req.instruction,
            )
        )
        while not task.done():
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            await asyncio.sleep(3)
        try:
            section = task.result()
        except Exception as e:
            section = req.sections[req.section_index]
        yield f"data: {json.dumps({'type': 'done', 'section': section}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/{collection_id}/refine-flow")
async def refine_flow(
    collection_id: int,
    req: RefineFlowRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    focused_news, focused_themes = _resolve_news_themes(collection, req)

    async def generate():
        task = asyncio.create_task(
            claude.refine_flow(
                punchline=req.punchline,
                news_items=focused_news,
                themes=focused_themes,
                flow_sections=req.sections,
                instruction=req.instruction,
            )
        )
        while not task.done():
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            await asyncio.sleep(3)
        try:
            result = task.result()
            sections = result.get("sections", req.sections)
            changes = result.get("changes", "")
        except Exception as e:
            sections = req.sections
            changes = f"שגיאה: {str(e)[:200]}"
        total = sum(s.get("estimatedMinutes", 0) for s in sections)
        yield f"data: {json.dumps({'type': 'done', 'sections': sections, 'totalMinutes': total, 'changes': changes}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/{collection_id}/save")
def save_flow(
    collection_id: int,
    req: SaveFlowRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    existing = session.exec(
        select(DrashaFlow).where(DrashaFlow.collection_id == collection_id)
    ).first()

    now = datetime.now().isoformat()
    if existing:
        existing.punchline = req.punchline
        existing.sections = req.sections
        existing.total_minutes = req.total_minutes
        existing.updated_at = now
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    else:
        flow = DrashaFlow(
            collection_id=collection_id,
            punchline=req.punchline,
            sections=req.sections,
            total_minutes=req.total_minutes,
            created_at=now,
            updated_at=now,
        )
        session.add(flow)
        session.commit()
        session.refresh(flow)
        return flow


@router.get("/{collection_id}")
def load_flow(collection_id: int, session: Session = Depends(get_session)):
    flow = session.exec(
        select(DrashaFlow).where(DrashaFlow.collection_id == collection_id)
    ).first()
    if not flow:
        raise HTTPException(status_code=404, detail="No saved flow")
    return flow
```

- [ ] **Step 2: Register flow router in main.py**

In `backend/app/main.py`, add the import and registration:

```python
from app.api import parasha, news, dvar_tora, pdf, settings, mefarshim, rhetoric, flow
```

And at the end of the router registrations:

```python
app.include_router(flow.router)
```

- [ ] **Step 3: Restart backend and verify endpoints**

```bash
kill $(lsof -t -i :8086) 2>/dev/null; sleep 1
cd /home/oshrin/projects/dvar-tora/backend && nohup .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8086 > /tmp/dvar-tora-backend.log 2>&1 &
sleep 2 && curl -s http://localhost:8086/openapi.json | python3 -c "import sys,json; d=json.load(sys.stdin); [print(p) for p in sorted(d['paths'].keys()) if 'flow' in p]"
```

Expected output:
```
/api/flow/{collection_id}
/api/flow/{collection_id}/generate
/api/flow/{collection_id}/refine-flow
/api/flow/{collection_id}/refine-section
/api/flow/{collection_id}/save
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/flow.py backend/app/main.py
git commit -m "feat: add flow API endpoints for generate, refine, save/load"
```

---

### Task 5: Frontend Types

**Files:**
- Modify: `frontend/src/lib/types.ts`

- [ ] **Step 1: Add FlowSection and DrashaFlow types**

Add at the end of `frontend/src/lib/types.ts`:

```typescript
export type RhetoricalMove = 'hook' | 'build' | 'surprise' | 'deepen' | 'resolve' | 'land'

export interface FlowSection {
  id: string
  title: string
  description: string
  rhetoricalMove: RhetoricalMove
  assignedNews: number[]
  assignedThemes: number[]
  mefareshSlot: string
  transitionTo: string
  estimatedMinutes: number
}

export interface DrashaFlow {
  id?: number
  collectionId: number
  punchline: string
  sections: FlowSection[]
  totalMinutes: number
  createdAt?: string
  updatedAt?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat: add FlowSection and DrashaFlow frontend types"
```

---

### Task 6: Frontend API Methods

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add flow API methods**

Add the following methods inside the `api` object in `frontend/src/lib/api.ts`, before the closing `}`:

```typescript
  streamGenerateFlow: async (
    collectionId: number,
    request: {
      punchline: string
      rhetoric_sequence: { name: string; description: string; structure_template: string }[]
      selected_news: number[]
      selected_themes: number[]
      custom_news: string[]
      custom_themes: string[]
    },
    onDone: (sections: FlowSection[], totalMinutes: number) => void,
    onHeartbeat?: () => void,
  ) => {
    const resp = await fetch(`${BASE}/flow/${collectionId}/generate`, {
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
        else if (data.type === 'done') onDone(data.sections, data.totalMinutes)
      }
    }
  },

  streamRefineSection: async (
    collectionId: number,
    request: {
      punchline: string
      sections: FlowSection[]
      section_index: number
      instruction: string
    },
    onDone: (section: FlowSection) => void,
    onHeartbeat?: () => void,
  ) => {
    const resp = await fetch(`${BASE}/flow/${collectionId}/refine-section`, {
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
        else if (data.type === 'done') onDone(data.section)
      }
    }
  },

  streamRefineFlow: async (
    collectionId: number,
    request: {
      punchline: string
      sections: FlowSection[]
      selected_news: number[]
      selected_themes: number[]
      custom_news: string[]
      custom_themes: string[]
      instruction?: string
    },
    onDone: (sections: FlowSection[], totalMinutes: number, changes: string) => void,
    onHeartbeat?: () => void,
  ) => {
    const resp = await fetch(`${BASE}/flow/${collectionId}/refine-flow`, {
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
        else if (data.type === 'done') onDone(data.sections, data.totalMinutes, data.changes)
      }
    }
  },

  saveFlow: (collectionId: number, data: { punchline: string; sections: FlowSection[]; total_minutes: number }) =>
    fetchJSON<DrashaFlow>(`/flow/${collectionId}/save`, { method: 'POST', body: JSON.stringify(data) }),

  loadFlow: (collectionId: number) =>
    fetchJSON<DrashaFlow>(`/flow/${collectionId}`),
```

- [ ] **Step 2: Add FlowSection and DrashaFlow to the import**

Update the import at the top of `api.ts`:

```typescript
import type { WeeklyCollection, DvarToraSuggestion, DvarTora, MefarshimResult, RhetoricStrategy, DrashaBeat, FlowSection, DrashaFlow } from './types'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add flow builder API methods"
```

---

### Task 7: FlowBuilder Component

**Files:**
- Create: `frontend/src/components/FlowBuilder.tsx`

- [ ] **Step 1: Create the FlowBuilder component**

Create `frontend/src/components/FlowBuilder.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { WeeklyCollection, FlowSection, RhetoricalMove } from '../lib/types'
import type { UserSelection } from '../App'

const MOVE_COLORS: Record<RhetoricalMove, { bg: string; text: string; border: string }> = {
  hook:     { bg: 'bg-amber-50',   text: 'text-amber-800',  border: 'border-amber-400' },
  build:    { bg: 'bg-blue-50',    text: 'text-blue-800',   border: 'border-blue-400' },
  surprise: { bg: 'bg-pink-50',    text: 'text-pink-800',   border: 'border-pink-400' },
  deepen:   { bg: 'bg-violet-50',  text: 'text-violet-800', border: 'border-violet-400' },
  resolve:  { bg: 'bg-slate-50',   text: 'text-slate-800',  border: 'border-slate-400' },
  land:     { bg: 'bg-green-50',   text: 'text-green-800',  border: 'border-green-400' },
}

const MOVE_LABELS: Record<RhetoricalMove, string> = {
  hook: 'hook', build: 'build', surprise: 'surprise',
  deepen: 'deepen', resolve: 'resolve', land: 'land',
}

interface FlowBuilderProps {
  collection: WeeklyCollection
  selection: UserSelection
  onComplete: (sections: FlowSection[]) => void
  onBack: () => void
}

export function FlowBuilder({ collection, selection, onComplete, onBack }: FlowBuilderProps) {
  const [sections, setSections] = useState<FlowSection[]>([])
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refiningIndex, setRefiningIndex] = useState<number | null>(null)
  const [refiningGlobal, setRefiningGlobal] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [changes, setChanges] = useState('')
  const [refineInstruction, setRefineInstruction] = useState('')
  const [sectionInstruction, setSectionInstruction] = useState('')

  // Try to load saved flow on mount
  useEffect(() => {
    api.loadFlow(collection.id).then(flow => {
      if (flow.sections?.length) {
        setSections(flow.sections)
        setTotalMinutes(flow.total_minutes)
      }
    }).catch(() => { /* no saved flow */ })
  }, [collection.id])

  const handleGenerate = async () => {
    setLoading(true)
    setSections([])
    setChanges('')
    await api.streamGenerateFlow(
      collection.id,
      {
        punchline: selection.punchline || '',
        rhetoric_sequence: (selection.rhetoricSequence || []).map(s => ({
          name: s.name, description: s.description, structure_template: s.structure_template,
        })),
        selected_news: selection.selectedNews,
        selected_themes: selection.selectedThemes,
        custom_news: selection.customNews,
        custom_themes: selection.customThemes,
      },
      (newSections, total) => {
        // Add client-side IDs
        const withIds = newSections.map((s, i) => ({ ...s, id: s.id || crypto.randomUUID() }))
        setSections(withIds)
        setTotalMinutes(total)
        setExpandedIndex(0)
        setLoading(false)
      },
      () => { /* heartbeat */ },
    )
  }

  const handleRefineSection = async (index: number) => {
    const instruction = sectionInstruction || 'שפר את השלב הזה'
    setRefiningIndex(index)
    await api.streamRefineSection(
      collection.id,
      {
        punchline: selection.punchline || '',
        sections,
        section_index: index,
        instruction,
      },
      (refined) => {
        setSections(prev => {
          const copy = [...prev]
          copy[index] = { ...refined, id: prev[index].id }
          return copy
        })
        setRefiningIndex(null)
        setSectionInstruction('')
      },
      () => { /* heartbeat */ },
    )
  }

  const handleRefineGlobal = async () => {
    setRefiningGlobal(true)
    setChanges('')
    await api.streamRefineFlow(
      collection.id,
      {
        punchline: selection.punchline || '',
        sections,
        selected_news: selection.selectedNews,
        selected_themes: selection.selectedThemes,
        custom_news: selection.customNews,
        custom_themes: selection.customThemes,
        instruction: refineInstruction,
      },
      (newSections, total, changeNote) => {
        const withIds = newSections.map((s, i) => ({
          ...s,
          id: s.id || sections[i]?.id || crypto.randomUUID(),
        }))
        setSections(withIds)
        setTotalMinutes(total)
        setChanges(changeNote)
        setRefiningGlobal(false)
        setRefineInstruction('')
      },
      () => { /* heartbeat */ },
    )
  }

  const handleSave = async () => {
    await api.saveFlow(collection.id, {
      punchline: selection.punchline || '',
      sections,
      total_minutes: totalMinutes,
    })
  }

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1
    if (newIdx < 0 || newIdx >= sections.length) return
    setSections(prev => {
      const copy = [...prev]
      ;[copy[index], copy[newIdx]] = [copy[newIdx], copy[index]]
      return copy
    })
    setExpandedIndex(newIdx)
  }

  const deleteSection = (index: number) => {
    setSections(prev => prev.filter((_, i) => i !== index))
    setExpandedIndex(null)
  }

  const addSection = () => {
    const newSection: FlowSection = {
      id: crypto.randomUUID(),
      title: 'שלב חדש',
      description: '',
      rhetoricalMove: 'build',
      assignedNews: [],
      assignedThemes: [],
      mefareshSlot: '',
      transitionTo: '',
      estimatedMinutes: 1,
    }
    setSections(prev => [...prev, newSection])
    setExpandedIndex(sections.length)
  }

  const updateSection = (index: number, updates: Partial<FlowSection>) => {
    setSections(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], ...updates }
      return copy
    })
  }

  const punchline = selection.punchline || ''

  return (
    <div className="max-w-4xl mx-auto p-6" dir="rtl">
      <button onClick={onBack} className="text-blue-600 mb-4 hover:underline">→ חזרה</button>

      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-3xl font-serif font-bold">מהלך הדרשה — {collection.parasha_name}</h2>
          <p className="text-gray-500 text-sm mt-1">פאנצ׳ליין: {punchline}</p>
        </div>
        <div className="flex gap-2">
          {sections.length > 0 && (
            <>
              <button
                onClick={handleRefineGlobal}
                disabled={refiningGlobal}
                className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm hover:bg-blue-200 transition disabled:opacity-50"
              >
                {refiningGlobal ? 'משכלל...' : '🔄 שכלל מהלך'}
              </button>
              <button onClick={addSection} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">
                + הוסף שלב
              </button>
              <button onClick={handleSave} className="bg-gray-100 text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">
                💾 שמור
              </button>
            </>
          )}
        </div>
      </div>

      {/* Global refine instruction */}
      {sections.length > 0 && !refiningGlobal && (
        <div className="mb-4">
          <input
            value={refineInstruction}
            onChange={e => setRefineInstruction(e.target.value)}
            placeholder="הנחיה לשכלול כללי (אופציונלי)..."
            className="w-full border rounded-lg p-2 text-sm text-gray-700"
            onKeyDown={e => e.key === 'Enter' && handleRefineGlobal()}
          />
        </div>
      )}

      {/* Changes note */}
      {changes && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
          🔄 {changes}
        </div>
      )}

      {/* Timeline strip */}
      {sections.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap text-xs">
          {sections.map((s, i) => {
            const colors = MOVE_COLORS[s.rhetoricalMove] || MOVE_COLORS.build
            return (
              <div key={s.id} className="flex items-center gap-2">
                <span className={`${colors.bg} ${colors.text} px-3 py-1 rounded-full font-medium`}>
                  {MOVE_LABELS[s.rhetoricalMove]}
                </span>
                {i < sections.length - 1 && <span className="text-gray-300">→</span>}
              </div>
            )
          })}
          <span className="text-gray-500 mr-4">≈ {totalMinutes} דקות</span>
        </div>
      )}

      {/* Empty state — generate */}
      {sections.length === 0 && !loading && (
        <div className="text-center py-16">
          <button
            onClick={handleGenerate}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition"
          >
            Claude יבנה מהלך ראשוני
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 py-16 justify-center">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-amber-700 font-medium">Claude בונה מהלך... (זה לוקח דקה-שתיים)</span>
        </div>
      )}

      {/* Section cards */}
      <div className="space-y-3">
        {sections.map((section, index) => {
          const colors = MOVE_COLORS[section.rhetoricalMove] || MOVE_COLORS.build
          const isExpanded = expandedIndex === index
          const isRefining = refiningIndex === index

          return (
            <div
              key={section.id}
              className={`bg-white border-2 rounded-xl relative transition ${
                isExpanded ? colors.border : 'border-gray-200'
              } ${isRefining ? 'opacity-60' : ''}`}
            >
              {/* Move badge */}
              <div className={`absolute -top-2.5 right-4 ${colors.bg} ${colors.text} px-3 py-0.5 rounded-full text-xs font-semibold`}>
                {MOVE_LABELS[section.rhetoricalMove]} · {section.estimatedMinutes} דק׳
              </div>

              {/* Collapsed view */}
              {!isExpanded && (
                <div
                  className="p-4 pt-5 cursor-pointer flex justify-between items-center"
                  onClick={() => setExpandedIndex(index)}
                >
                  <div>
                    <span className="font-semibold">{index + 1}. {section.title}</span>
                    <span className="text-gray-500 text-sm mr-3">
                      {section.assignedNews.length > 0 && `📰 ×${section.assignedNews.length} `}
                      {section.assignedThemes.length > 0 && `📖 ×${section.assignedThemes.length} `}
                      {section.mefareshSlot && '🔮 '}
                    </span>
                  </div>
                  <span className="text-gray-400 text-sm">לחץ לפתוח ←</span>
                </div>
              )}

              {/* Expanded view */}
              {isExpanded && (
                <div className="p-4 pt-5">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-3">
                      {/* Title */}
                      <input
                        value={section.title}
                        onChange={e => updateSection(index, { title: e.target.value })}
                        className="w-full text-lg font-bold border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none pb-1"
                      />

                      {/* Description */}
                      <textarea
                        value={section.description}
                        onChange={e => updateSection(index, { description: e.target.value })}
                        rows={3}
                        className="w-full text-gray-700 text-sm border rounded-lg p-2 focus:outline-none focus:border-blue-400"
                      />

                      {/* Rhetorical move */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">מהלך רטורי:</span>
                        <select
                          value={section.rhetoricalMove}
                          onChange={e => updateSection(index, { rhetoricalMove: e.target.value as RhetoricalMove })}
                          className="text-sm border rounded px-2 py-1"
                        >
                          <option value="hook">hook — תפיסת תשומת לב</option>
                          <option value="build">build — בניית רעיון</option>
                          <option value="surprise">surprise — הפתעה</option>
                          <option value="deepen">deepen — העמקה תורנית</option>
                          <option value="resolve">resolve — קשירת חוטים</option>
                          <option value="land">land — נחיתה</option>
                        </select>
                      </div>

                      {/* Assigned material */}
                      <div className="flex gap-2 flex-wrap">
                        {section.assignedNews.map(ni => {
                          const news = (collection.news_items || [])[ni]
                          return news ? (
                            <span key={`n${ni}`} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                              📰 {news.title?.slice(0, 40)}...
                            </span>
                          ) : null
                        })}
                        {section.assignedThemes.map(ti => {
                          const theme = (collection.parasha_themes || [])[ti]
                          return theme ? (
                            <span key={`t${ti}`} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                              📖 {theme.title}
                            </span>
                          ) : null
                        })}
                      </div>

                      {/* Mefaresh slot */}
                      <div>
                        <span className="text-xs text-gray-500">מפרש/ציטוט:</span>
                        <input
                          value={section.mefareshSlot}
                          onChange={e => updateSection(index, { mefareshSlot: e.target.value })}
                          className="w-full text-sm text-violet-700 border-b border-transparent hover:border-gray-300 focus:border-violet-400 focus:outline-none italic"
                          placeholder="למשל: רש״י על פסוק X..."
                        />
                      </div>

                      {/* Transition */}
                      {index < sections.length - 1 && (
                        <div className="border-t border-dashed border-gray-200 pt-2">
                          <span className="text-xs text-gray-500">מעבר לשלב הבא:</span>
                          <input
                            value={section.transitionTo}
                            onChange={e => updateSection(index, { transitionTo: e.target.value })}
                            className="w-full text-sm text-gray-500 border-b border-transparent hover:border-gray-300 focus:border-gray-400 focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Time */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">זמן משוער:</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={section.estimatedMinutes}
                          onChange={e => {
                            const mins = parseInt(e.target.value) || 1
                            updateSection(index, { estimatedMinutes: mins })
                            setTotalMinutes(sections.reduce((sum, s, i) => sum + (i === index ? mins : s.estimatedMinutes), 0))
                          }}
                          className="w-16 text-sm border rounded px-2 py-1"
                        />
                        <span className="text-xs text-gray-400">דקות</span>
                      </div>

                      {/* Section refine */}
                      <div className="flex gap-2 items-center mt-2">
                        <input
                          value={sectionInstruction}
                          onChange={e => setSectionInstruction(e.target.value)}
                          placeholder="הנחיה לשכלול שלב זה..."
                          className="flex-1 text-sm border rounded-lg px-3 py-1.5"
                          onKeyDown={e => e.key === 'Enter' && handleRefineSection(index)}
                        />
                        <button
                          onClick={() => handleRefineSection(index)}
                          disabled={isRefining}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
                        >
                          {isRefining ? 'משכלל...' : '✨ שכלל'}
                        </button>
                      </div>
                    </div>

                    {/* Side actions */}
                    <div className="flex flex-col gap-1 mr-4 text-sm">
                      <button onClick={() => moveSection(index, 'up')} className="text-gray-400 hover:text-gray-700" disabled={index === 0}>⬆</button>
                      <button onClick={() => moveSection(index, 'down')} className="text-gray-400 hover:text-gray-700" disabled={index === sections.length - 1}>⬇</button>
                      <button onClick={() => deleteSection(index)} className="text-red-400 hover:text-red-600 mt-2">✕</button>
                      <button onClick={() => setExpandedIndex(null)} className="text-gray-400 hover:text-gray-700 mt-2">▲</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom actions */}
      {sections.length > 0 && !loading && (
        <div className="flex justify-between items-center mt-8 border-t pt-4">
          <button onClick={handleGenerate} className="text-blue-600 hover:underline text-sm">
            נקה וצור מהלך חדש
          </button>
          <button
            onClick={() => onComplete(sections)}
            className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-green-700 transition"
          >
            המשך עם המהלך הזה
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the component compiles**

```bash
cd /home/oshrin/projects/dvar-tora/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing ones unrelated to FlowBuilder).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FlowBuilder.tsx
git commit -m "feat: add FlowBuilder component with section editing and Claude refinement"
```

---

### Task 8: Wire Flow Builder into App

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/RhetoricPunchline.tsx`

- [ ] **Step 1: Update App.tsx — add view and lazy import**

In `frontend/src/App.tsx`, update the `View` type (line 6):

```typescript
type View = 'dashboard' | 'rhetoric' | 'flow-builder' | 'style' | 'mefarshim' | 'suggestions' | 'editor'
```

Add the lazy import for FlowBuilder after the other lazy imports (after line 12):

```typescript
const FlowBuilder = lazy(async () => {
  const module = await import('./components/FlowBuilder')
  return { default: module.FlowBuilder }
})
```

Add `FlowSection` to the import from types (line 3):

```typescript
import type { WeeklyCollection, DvarTora, MefarshimResult, RhetoricStrategy, DrashaBeat, FlowSection } from './lib/types'
```

Add flow sections state (after line 58, the `const [showSettings, setShowSettings]` line):

```typescript
const [flowSections, setFlowSections] = useState<FlowSection[]>([])
```

- [ ] **Step 2: Update App.tsx — add flow-builder view in renderCurrentView**

In `renderCurrentView()`, update the rhetoric `onComplete` callback to accept an optional `useFlowBuilder` flag. Replace the rhetoric block (lines 78-90):

```typescript
    if (view === 'rhetoric' && collection && selection) {
      return (
        <RhetoricPunchline
          collection={collection}
          selection={selection}
          onComplete={(rhetoric, punchline, beats) => {
            setSelection(prev => prev ? { ...prev, rhetoricSequence: rhetoric, punchline, beats } : null)
            goToView('style')
          }}
          onBuildFlow={(rhetoric, punchline) => {
            setSelection(prev => prev ? { ...prev, rhetoricSequence: rhetoric, punchline } : null)
            goToView('flow-builder')
          }}
          onBack={() => goToView('dashboard')}
        />
      )
    }
```

Add the flow-builder view block right after the rhetoric block:

```typescript
    if (view === 'flow-builder' && collection && selection) {
      return (
        <FlowBuilder
          collection={collection}
          selection={selection}
          onComplete={(sections) => {
            setFlowSections(sections)
            goToView('style')
          }}
          onBack={() => goToView('rhetoric')}
        />
      )
    }
```

- [ ] **Step 3: Update RhetoricPunchline to add fork buttons**

In `frontend/src/components/RhetoricPunchline.tsx`, update the props interface (lines 5-15) to add `onBuildFlow`:

```typescript
interface RhetoricPunchlineProps {
  collection: WeeklyCollection
  selection: {
    selectedNews: number[]
    selectedThemes: number[]
    customNews: string[]
    customThemes: string[]
  }
  onComplete: (rhetoric: RhetoricStrategy[], punchline: string, beats: DrashaBeat[]) => void
  onBuildFlow: (rhetoric: RhetoricStrategy[], punchline: string) => void
  onBack: () => void
}
```

Update the component destructuring (line 17):

```typescript
export function RhetoricPunchline({ collection, selection, onComplete, onBuildFlow, onBack }: RhetoricPunchlineProps) {
```

Replace the single continue button at the bottom (lines 296-306) with a fork:

```typescript
          {/* Continue — fork */}
          {activePunchline && (
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => onBuildFlow(selectedStrategies, activePunchline)}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition"
              >
                בנה את המהלך
              </button>
              <button
                onClick={handleContinue}
                className="bg-gray-200 text-gray-700 px-8 py-3 rounded-lg text-lg hover:bg-gray-300 transition"
              >
                דלג להצעות →
              </button>
            </div>
          )}
```

- [ ] **Step 4: Verify the app compiles**

```bash
cd /home/oshrin/projects/dvar-tora/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/RhetoricPunchline.tsx
git commit -m "feat: wire flow builder into app with fork after rhetoric stage"
```

---

### Task 9: End-to-End Verification

- [ ] **Step 1: Restart backend**

```bash
kill $(lsof -t -i :8086) 2>/dev/null; sleep 1
cd /home/oshrin/projects/dvar-tora/backend && nohup .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8086 > /tmp/dvar-tora-backend.log 2>&1 &
```

- [ ] **Step 2: Verify backend endpoints exist**

```bash
sleep 2 && curl -s http://localhost:8086/openapi.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
flow_paths = [p for p in d['paths'] if 'flow' in p]
print('Flow endpoints:', flow_paths)
assert len(flow_paths) == 5, f'Expected 5, got {len(flow_paths)}'
print('OK')
"
```

Expected: `Flow endpoints: [5 paths]` and `OK`

- [ ] **Step 3: Verify frontend compiles and Vite serves**

```bash
cd /home/oshrin/projects/dvar-tora/frontend && npx tsc --noEmit 2>&1 | head -5
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/dvar-tora/
```

Expected: no type errors, HTTP 200.

- [ ] **Step 4: Manual smoke test**

Open `http://code-agents-server.local/dvar-tora` in browser:
1. Click through to rhetoric stage (select news, themes, proceed)
2. Select rhetoric strategies, generate punchline, select one
3. Verify two buttons appear: "בנה את המהלך" and "דלג להצעות →"
4. Click "בנה את המהלך" — verify flow builder loads
5. Click "Claude יבנה מהלך ראשוני" — verify flow generates
6. Expand a section, edit fields — verify inline editing works
7. Click "✨ שכלל" on a section — verify section refinement
8. Click "🔄 שכלל מהלך" — verify global refinement
9. Click "💾 שמור" — verify save works
10. Click "המשך עם המהלך הזה" — verify proceeds to style stage

- [ ] **Step 5: Commit (if any fixes were needed)**

```bash
git add -A && git commit -m "fix: end-to-end flow builder fixes"
```
