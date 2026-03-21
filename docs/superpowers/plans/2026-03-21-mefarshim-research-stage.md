# Mefarshim Research Stage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mefarshim research stage between Style and Suggestions that uses Claude Haiku to fetch, filter, and summarize commentaries relevant to the user's selected news+themes.

**Architecture:** New backend SSE endpoint calls Claude Haiku to summarize DB mefarshim and suggest additional Sefaria references. Frontend adds a new wizard stage with category multi-select picker and streaming result cards with checkboxes.

**Tech Stack:** FastAPI (SSE streaming), Claude CLI (haiku model), Sefaria API, React/TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-21-mefarshim-research-stage-design.md`

---

### Task 1: Add model param to `_build_cmd` and mefarshim research prompt

**Files:**
- Modify: `backend/app/ai/claude_cli.py:19-24`
- Modify: `backend/app/ai/prompts.py` (add at end)

- [ ] **Step 1: Add `model` parameter to `_build_cmd`**

In `backend/app/ai/claude_cli.py`, change `_build_cmd`:

```python
def _build_cmd(self, prompt: str, session_id: str | None = None, model: str | None = None) -> list[str]:
    cmd = [CLAUDE_BIN, "--print", "-p", prompt]
    if session_id:
        cmd = [CLAUDE_BIN, "--print", "--session-id", session_id, "-p", prompt]
    if model:
        cmd.extend(["--model", model])
    return cmd
```

- [ ] **Step 2: Add `MEFARSHIM_RESEARCH_PROMPT` to prompts.py**

Append to `backend/app/ai/prompts.py`:

```python
MEFARSHIM_RESEARCH_PROMPT = """# מחקר מפרשים — פרשת {parasha_name}

## הנושאים שהמשתמש בחר מהחדשות
{news_section}

## הנושאים שהמשתמש בחר מהפרשה
{themes_section}

## מפרשים קיימים מהמאגר
{mefarshim_section}

## הנחיות
אתה חוקר מפרשים. המשתמש בחר נושאים מהחדשות ומהפרשה, ויש לך מפרשים מהמאגר.

### שלב 1: סיכום מפרשים קיימים
לכל פירוש מהמאגר, כתוב סיכום של 2-3 משפטים שמסביר איך הפירוש מתחבר לנושאי החדשות והפרשה שנבחרו.
אם פירוש לא רלוונטי כלל לנושאים שנבחרו, דלג עליו.

### שלב 2: הצעת מקורות נוספים
הצע עד 5 מקורות נוספים (מפרש + מראה מקום מדויק בפורמט Sefaria) שיהיו רלוונטיים לנושאים שנבחרו אך לא נמצאים במאגר.
השתמש רק בשמות מפרשים שקיימים ב-Sefaria.

החזר JSON בפורמט:
{{"summaries": [{{"mefaresh": "...", "ref": "...", "summary": "..."}}], "additional_refs": [{{"mefaresh": "Ramban", "ref": "Genesis 1:1"}}]}}
"""

MEFARSHIM_SUMMARIZE_NEW_PROMPT = """# סיכום מפרשים חדשים

## הנושאים שהמשתמש בחר מהחדשות
{news_section}

## הנושאים שהמשתמש בחר מהפרשה
{themes_section}

## טקסטים חדשים שנמצאו
{new_texts_section}

## הנחיות
לכל טקסט חדש, כתוב סיכום של 2-3 משפטים שמסביר איך הפירוש מתחבר לנושאי החדשות והפרשה שנבחרו.

החזר JSON בפורמט:
{{"summaries": [{{"mefaresh": "...", "ref": "...", "summary": "..."}}]}}
"""
```

- [ ] **Step 3: Add import of new prompts in claude_cli.py**

Add to the imports in `backend/app/ai/claude_cli.py`:

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
)
```

- [ ] **Step 4: Verify backend starts**

Run: `cd /home/oshrin/projects/dvar-tora/backend && .venv/bin/python -c "from app.ai.claude_cli import ClaudeCLI; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/claude_cli.py backend/app/ai/prompts.py
git commit -m "feat: add model param to _build_cmd and mefarshim research prompts"
```

---

### Task 2: Add `stream_mefarshim_research` method to ClaudeCLI

**Files:**
- Modify: `backend/app/ai/claude_cli.py` (add method at end of class)

- [ ] **Step 1: Add the method**

Add to the `ClaudeCLI` class in `backend/app/ai/claude_cli.py`:

```python
async def stream_mefarshim_research(
    self,
    parasha_name: str,
    news_items: list[dict],
    themes: list[dict],
    mefarshim_texts: dict[str, list[dict]],
) -> AsyncGenerator[dict, None]:
    """Two-phase mefarshim research: summarize DB texts, then fetch+summarize new ones."""
    from app.collectors.parasha_collector import ParashaCollector

    # Build prompt sections
    news_section = "\n".join(
        f"- {item.get('title', '')}: {item.get('summary', '')}" for item in news_items
    ) or "לא נבחרו חדשות"
    themes_section = "\n".join(
        f"- {t.get('title', '')}: {t.get('description', '')}" for t in themes
    ) or "לא נבחרו נושאי פרשה"
    mefarshim_section = ""
    original_texts = {}  # mefaresh+ref -> original text
    for mefaresh, texts in mefarshim_texts.items():
        mefarshim_section += f"\n### {mefaresh}\n"
        for t in texts[:5]:
            ref = t.get("ref", "")
            text = t.get("text", "")[:200]
            mefarshim_section += f"- {ref}: {text}\n"
            original_texts[f"{mefaresh}||{ref}"] = t.get("text", "")

    # Phase 1: Summarize existing mefarshim
    prompt = MEFARSHIM_RESEARCH_PROMPT.format(
        parasha_name=parasha_name,
        news_section=news_section,
        themes_section=themes_section,
        mefarshim_section=mefarshim_section or "אין מפרשים במאגר לקטגוריות שנבחרו",
    )
    raw = await self._run_claude(prompt, model="haiku")
    try:
        start = raw.index("{")
        end = raw.rindex("}") + 1
        data = json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        data = {"summaries": [], "additional_refs": []}

    # Yield phase 1 results
    for s in data.get("summaries", []):
        key = f"{s.get('mefaresh', '')}||{s.get('ref', '')}"
        yield {
            "type": "mefaresh",
            "mefaresh": s.get("mefaresh", ""),
            "ref": s.get("ref", ""),
            "summary": s.get("summary", ""),
            "original_text": original_texts.get(key, ""),
            "source": "db",
        }

    # Phase 2: Fetch additional references
    additional_refs = data.get("additional_refs", [])[:5]
    if additional_refs:
        yield {"type": "phase", "phase": "fetching_additional", "count": len(additional_refs)}

        collector = ParashaCollector()
        try:
            import asyncio

            async def fetch_ref(ref_info: dict) -> list[dict]:
                """Fetch a single commentary ref. Claude provides mefaresh + parasha-level ref,
                so we build '{mefaresh} on {ref}' which is the Sefaria convention."""
                mefaresh = ref_info["mefaresh"]
                ref = ref_info["ref"]
                return await collector.get_commentary(ref, mefaresh)

            tasks = [fetch_ref(ref) for ref in additional_refs]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            new_texts = []
            for ref_info, result in zip(additional_refs, results):
                if isinstance(result, Exception) or not result:
                    continue
                for t in result[:3]:
                    new_texts.append(t)

            if new_texts:
                # Summarize new texts
                new_texts_section = ""
                for t in new_texts:
                    new_texts_section += f"- {t.get('mefaresh', '')} ({t.get('ref', '')}): {t.get('text', '')[:200]}\n"

                prompt2 = MEFARSHIM_SUMMARIZE_NEW_PROMPT.format(
                    news_section=news_section,
                    themes_section=themes_section,
                    new_texts_section=new_texts_section,
                )
                raw2 = await self._run_claude(prompt2, model="haiku")
                try:
                    start2 = raw2.index("{")
                    end2 = raw2.rindex("}") + 1
                    data2 = json.loads(raw2[start2:end2])
                except (ValueError, json.JSONDecodeError):
                    data2 = {"summaries": []}

                # Build lookup for original texts
                new_originals = {}
                for t in new_texts:
                    key = f"{t.get('mefaresh', '')}||{t.get('ref', '')}"
                    new_originals[key] = t.get("text", "")

                for s in data2.get("summaries", []):
                    key = f"{s.get('mefaresh', '')}||{s.get('ref', '')}"
                    yield {
                        "type": "mefaresh",
                        "mefaresh": s.get("mefaresh", ""),
                        "ref": s.get("ref", ""),
                        "summary": s.get("summary", ""),
                        "original_text": new_originals.get(key, ""),
                        "source": "new",
                    }
        finally:
            await collector.close()

    yield {"type": "done"}
```

- [ ] **Step 2: Add `model` param to `_run_claude`**

Update `_run_claude` in the same file:

```python
async def _run_claude(self, prompt: str, session_id: str | None = None, model: str | None = None) -> str:
    cmd = self._build_cmd(prompt, session_id, model=model)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"Claude CLI failed: {stderr.decode()}")
    return stdout.decode()
```

- [ ] **Step 3: Verify import works**

Run: `cd /home/oshrin/projects/dvar-tora/backend && .venv/bin/python -c "from app.ai.claude_cli import ClaudeCLI; c = ClaudeCLI(); print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/ai/claude_cli.py
git commit -m "feat: add stream_mefarshim_research method to ClaudeCLI"
```

---

### Task 3: Create mefarshim API router and register it

**Files:**
- Create: `backend/app/api/mefarshim.py`
- Modify: `backend/app/main.py:5,27`

- [ ] **Step 1: Create the mefarshim router**

Create `backend/app/api/mefarshim.py`:

```python
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session
from pydantic import BaseModel
from app.database import get_session
from app.models import WeeklyCollection
from app.ai.claude_cli import ClaudeCLI
from app.collectors.parasha_collector import MEFARSHIM_MAP

router = APIRouter(prefix="/api/mefarshim", tags=["mefarshim"])
claude = ClaudeCLI()


class MefarshimResearchRequest(BaseModel):
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []
    categories: list[str] = []


@router.post("/{collection_id}/research")
async def research_mefarshim(
    collection_id: int,
    req: MefarshimResearchRequest,
    session: Session = Depends(get_session),
):
    collection = session.get(WeeklyCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Filter news and themes to user's selection
    all_news = collection.news_items or []
    all_themes = collection.parasha_themes or []

    focused_news = [all_news[i] for i in req.selected_news if i < len(all_news)]
    focused_news.extend([{"title": t, "summary": t} for t in req.custom_news])

    focused_themes = [all_themes[i] for i in req.selected_themes if i < len(all_themes)]
    focused_themes.extend([{"title": t, "description": t} for t in req.custom_themes])

    # Filter mefarshim_texts by selected categories
    filtered_mefarshim = {}
    mefarshim_texts = collection.mefarshim_texts or {}
    selected_names = set()
    for cat in req.categories:
        if cat == "mixed":
            selected_names.update(name for names in MEFARSHIM_MAP.values() for name in names)
        elif cat in MEFARSHIM_MAP:
            selected_names.update(MEFARSHIM_MAP[cat])

    for mefaresh, texts in mefarshim_texts.items():
        if mefaresh in selected_names:
            filtered_mefarshim[mefaresh] = texts

    async def generate():
        async for event in claude.stream_mefarshim_research(
            parasha_name=collection.parasha_name,
            news_items=focused_news,
            themes=focused_themes,
            mefarshim_texts=filtered_mefarshim,
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

- [ ] **Step 2: Register the router in main.py**

In `backend/app/main.py`, add the import:

```python
from app.api import parasha, news, dvar_tora, pdf, settings, mefarshim
```

And add at the end with the other routers:

```python
app.include_router(mefarshim.router)
```

- [ ] **Step 3: Verify backend starts**

Run: `cd /home/oshrin/projects/dvar-tora/backend && .venv/bin/uvicorn app.main:app --port 9999 &; sleep 3; curl -s http://localhost:9999/docs | grep -o 'mefarshim' | head -1; kill %1`
Expected: `mefarshim`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/mefarshim.py backend/app/main.py
git commit -m "feat: add mefarshim research SSE endpoint"
```

---

### Task 4: Add frontend types and API method

**Files:**
- Modify: `frontend/src/lib/types.ts` (add at end)
- Modify: `frontend/src/lib/api.ts` (add method)

- [ ] **Step 1: Add `MefarshimResult` type to types.ts**

Append to `frontend/src/lib/types.ts`:

```typescript
export interface MefarshimResult {
  mefaresh: string
  ref: string
  summary: string
  original_text: string
  source: 'db' | 'new'
  selected: boolean
}
```

Note: `MefarshimCategory` already exists in types.ts.

- [ ] **Step 2: Add `streamMefarshimResearch` to api.ts**

Add to the `api` object in `frontend/src/lib/api.ts`:

```typescript
streamMefarshimResearch: async (
  collectionId: number,
  request: {
    selected_news: number[]
    selected_themes: number[]
    custom_news: string[]
    custom_themes: string[]
    categories: string[]
  },
  onResult: (result: MefarshimResult) => void,
  onPhase: (phase: string, count: number) => void,
  onDone: () => void,
) => {
  const resp = await fetch(`${BASE}/mefarshim/${collectionId}/research`, {
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
      if (data.type === 'mefaresh') onResult({ ...data, selected: true })
      else if (data.type === 'phase') onPhase(data.phase, data.count)
      else if (data.type === 'done') onDone()
    }
  }
},
```

Also add the import at top of `api.ts`:

```typescript
import type { WeeklyCollection, DvarToraSuggestion, DvarTora, MefarshimResult } from './types'
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/oshrin/projects/dvar-tora/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: add MefarshimResult type and streaming API method"
```

---

### Task 5: Modify MefarshimPicker for multi-select

**Files:**
- Modify: `frontend/src/components/MefarshimPicker.tsx`

- [ ] **Step 1: Update to multi-select**

Replace the entire content of `frontend/src/components/MefarshimPicker.tsx`:

```typescript
import type { MefarshimCategory } from '../lib/types'

const CATEGORIES: { value: MefarshimCategory; label: string; description: string }[] = [
  { value: 'pshat', label: 'פשט', description: 'רש״י, רמב״ן, אבן עזרא, כלי יקר, מלבי״ם, העמק דבר' },
  { value: 'hasidic', label: 'חסידות', description: 'שפת אמת, מי השילוח, קדושת לוי, נועם אלימלך, תולדות' },
  { value: 'mussar', label: 'מוסר', description: 'עקידת יצחק, של״ה, אלשיך, רבינו בחיי' },
  { value: 'midrash', label: 'מדרש', description: 'תנחומא, ויקרא רבה, ספרא, ילקוט שמעוני, זוהר' },
  { value: 'bikoret', label: 'ביקורת המקרא', description: 'שד״ל, דוד צבי הופמן, רג׳יו' },
]

export function MefarshimPicker({ selected, onChange }: {
  selected: MefarshimCategory[]
  onChange: (categories: MefarshimCategory[]) => void
}) {
  const toggle = (value: MefarshimCategory) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold mb-3">קטגוריות מפרשים</h3>
      <div className="flex gap-3 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => toggle(cat.value)}
            className={`px-4 py-2 rounded-lg border transition ${
              selected.includes(cat.value)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            <div className="font-bold">{cat.label}</div>
            <div className="text-xs mt-1 opacity-80">{cat.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

Note: Removed `'mixed'` from the picker categories — it's not useful for multi-select since the user picks the actual categories they want.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/oshrin/projects/dvar-tora/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: Errors in SuggestionCards.tsx (expected — it still uses old single-select API). Will be fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MefarshimPicker.tsx
git commit -m "feat: convert MefarshimPicker to multi-select"
```

---

### Task 6: Create MefarshimResearch stage component

**Files:**
- Create: `frontend/src/components/MefarshimResearch.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/MefarshimResearch.tsx`:

```typescript
import { useState } from 'react'
import { MefarshimPicker } from './MefarshimPicker'
import { api } from '../lib/api'
import type { WeeklyCollection, MefarshimCategory, MefarshimResult } from '../lib/types'

interface MefarshimResearchProps {
  collection: WeeklyCollection
  selection: {
    selectedNews: number[]
    selectedThemes: number[]
    customNews: string[]
    customThemes: string[]
  }
  onComplete: (mefarshim: MefarshimResult[]) => void
  onBack: () => void
}

export function MefarshimResearch({ collection, selection, onComplete, onBack }: MefarshimResearchProps) {
  const [categories, setCategories] = useState<MefarshimCategory[]>(['pshat'])
  const [results, setResults] = useState<MefarshimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const handleSearch = async () => {
    setLoading(true)
    setResults([])
    setPhase(null)
    await api.streamMefarshimResearch(
      collection.id,
      {
        selected_news: selection.selectedNews,
        selected_themes: selection.selectedThemes,
        custom_news: selection.customNews,
        custom_themes: selection.customThemes,
        categories,
      },
      (result) => {
        setResults(prev => [...prev, result])
      },
      (_phase, _count) => {
        setPhase(`מחפש ${_count} מפרשים נוספים...`)
      },
      () => {
        setLoading(false)
        setPhase(null)
      },
    )
  }

  const toggleSelected = (idx: number) => {
    setResults(prev => prev.map((r, i) =>
      i === idx ? { ...r, selected: !r.selected } : r
    ))
  }

  const handleContinue = () => {
    onComplete(results.filter(r => r.selected))
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={onBack} className="text-blue-600 mb-4 hover:underline">
        &rarr; חזרה
      </button>
      <h2 className="text-3xl font-serif font-bold mb-2">
        מחקר מפרשים &mdash; {collection.parasha_name}
      </h2>
      <p className="text-gray-500 mb-6">
        בחר קטגוריות מפרשים וקלוד ימצא את הפירושים הרלוונטיים לנושאים שבחרת
      </p>

      <MefarshimPicker selected={categories} onChange={setCategories} />

      {results.length === 0 && !loading && (
        <div className="text-center py-10">
          <button
            onClick={handleSearch}
            disabled={categories.length === 0}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            חפש מפרשים
          </button>
        </div>
      )}

      {loading && results.length === 0 && (
        <div className="mt-6 text-center py-10">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-amber-700 font-medium">
              מחפש ומסכם מפרשים...
            </span>
          </div>
        </div>
      )}

      {phase && (
        <div className="mt-4 flex items-center gap-2 justify-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-blue-700 font-medium">{phase}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid gap-4 mt-6">
          {results.map((r, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-5 bg-white shadow-sm transition ${
                r.selected ? 'border-blue-300' : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={() => toggleSelected(idx)}
                  className="mt-1.5 w-4 h-4 accent-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-lg">{r.mefaresh}</h4>
                    <span className="text-gray-400 text-sm">{r.ref}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.source === 'db'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {r.source === 'db' ? 'מהמאגר' : 'חדש'}
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{r.summary}</p>
                  {r.original_text && (
                    <div className="mt-2">
                      <button
                        onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {expandedIdx === idx ? 'הסתר מקור' : 'הצג מקור'}
                      </button>
                      {expandedIdx === idx && (
                        <div className="mt-2 p-3 bg-amber-50 rounded text-sm text-gray-800 leading-relaxed max-h-40 overflow-y-auto">
                          {r.original_text}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && !loading && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-gray-500 text-sm">
            {results.filter(r => r.selected).length} מתוך {results.length} מפרשים נבחרו
          </span>
          <div className="flex gap-3">
            <button
              onClick={handleSearch}
              className="text-blue-600 hover:underline"
            >
              חפש מחדש
            </button>
            <button
              onClick={handleContinue}
              disabled={results.filter(r => r.selected).length === 0}
              className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              המשך להצעות
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/MefarshimResearch.tsx
git commit -m "feat: create MefarshimResearch stage component"
```

---

### Task 7: Wire up App.tsx and update SuggestionCards

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/SuggestionCards.tsx`

- [ ] **Step 1: Update App.tsx — add mefarshim stage**

In `frontend/src/App.tsx`:

1. Add imports:
```typescript
import { MefarshimResearch } from './components/MefarshimResearch'
import type { WeeklyCollection, DvarTora, MefarshimResult } from './lib/types'
```

2. Change the `View` type:
```typescript
type View = 'dashboard' | 'style' | 'mefarshim' | 'suggestions' | 'editor'
```

3. Add state:
```typescript
const [mefarshimResults, setMefarshimResults] = useState<MefarshimResult[]>([])
```

4. Change the style view's `onConfirm` to go to `'mefarshim'` instead of `'suggestions'`:
```typescript
{view === 'style' && collection && selection && (
  <StylePicker
    onConfirm={(style) => {
      setSelection(prev => prev ? { ...prev, style } : null)
      setView('mefarshim')
    }}
    onBack={() => setView('dashboard')}
  />
)}
```

5. Add the mefarshim view between style and suggestions:
```typescript
{view === 'mefarshim' && collection && selection && (
  <MefarshimResearch
    collection={collection}
    selection={selection}
    onComplete={(mefarshim) => {
      setMefarshimResults(mefarshim)
      setView('suggestions')
    }}
    onBack={() => setView('style')}
  />
)}
```

6. Update suggestions view to pass mefarshim and change onBack:
```typescript
{view === 'suggestions' && collection && selection && (
  <SuggestionCards
    collection={collection}
    selection={selection}
    selectedMefarshim={mefarshimResults}
    onSelect={(dvar) => { setDvarTora(dvar); setView('editor') }}
    onBack={() => setView('mefarshim')}
  />
)}
```

- [ ] **Step 2: Update SuggestionCards.tsx — remove MefarshimPicker, accept mefarshim prop**

In `frontend/src/components/SuggestionCards.tsx`:

1. Remove import of MefarshimPicker:
```typescript
// Remove: import { MefarshimPicker } from './MefarshimPicker'
```

2. Remove `MefarshimCategory` from type import:
```typescript
import type { WeeklyCollection, DvarTora, DvarToraSuggestion } from '../lib/types'
```

3. Add `selectedMefarshim` prop:
```typescript
import type { MefarshimResult } from '../lib/types'

export function SuggestionCards({ collection, selection, selectedMefarshim, onSelect, onBack }: {
  collection: WeeklyCollection
  selection: UserSelection
  selectedMefarshim: MefarshimResult[]
  onSelect: (dvar: DvarTora) => void
  onBack: () => void
}) {
```

4. Remove the `category` state and `MefarshimPicker` JSX:
```typescript
// Remove: const [category, setCategory] = useState<MefarshimCategory>('pshat')
// Remove: <MefarshimPicker selected={category} onChange={setCategory} />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/oshrin/projects/dvar-tora/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/SuggestionCards.tsx
git commit -m "feat: wire mefarshim research stage into wizard flow"
```

---

### Task 8: Pass mefarshim summaries to suggestion generation

**Files:**
- Modify: `frontend/src/components/SuggestionCards.tsx` (handleGenerate)
- Modify: `frontend/src/lib/api.ts` (streamSuggestionsFocused)
- Modify: `backend/app/api/dvar_tora.py` (SelectionContext, stream_from_selection)

- [ ] **Step 1: Add `mefarshim_summaries` to `SelectionContext` in backend**

In `backend/app/api/dvar_tora.py`, update the `SelectionContext` model:

```python
class MefarshimSummary(BaseModel):
    mefaresh: str = ""
    ref: str = ""
    summary: str = ""

class SelectionContext(BaseModel):
    selected_news: list[int] = []
    selected_themes: list[int] = []
    custom_news: list[str] = []
    custom_themes: list[str] = []
    style: StylePreferences | None = None
    mefarshim_summaries: list[MefarshimSummary] = []
```

- [ ] **Step 2: Use mefarshim_summaries in both selection endpoints**

In `backend/app/api/dvar_tora.py`, add this helper function before the endpoint functions:

```python
def _build_focused_mefarshim(ctx: SelectionContext, collection: WeeklyCollection) -> dict:
    """Use pre-researched mefarshim summaries if available, otherwise fall back to collection."""
    if ctx.mefarshim_summaries:
        focused = {}
        for s in ctx.mefarshim_summaries:
            if s.mefaresh not in focused:
                focused[s.mefaresh] = []
            focused[s.mefaresh].append({"ref": s.ref, "text": s.summary})
        return focused
    return collection.mefarshim_texts
```

Then in **both** `generate_from_selection` and `stream_from_selection`, replace `mefarshim_texts=collection.mefarshim_texts` with:

```python
mefarshim_texts=_build_focused_mefarshim(ctx, collection),
```

Specifically:
- In `generate_from_selection` (~line 87): `mefarshim_texts=_build_focused_mefarshim(ctx, collection),`
- In `stream_from_selection` async `generate()` (~line 198): `mefarshim_texts=_build_focused_mefarshim(ctx, collection),`

- [ ] **Step 3: Update frontend `streamSuggestionsFocused` to send mefarshim and style**

In `frontend/src/lib/api.ts`, update the `streamSuggestionsFocused` method's body to include mefarshim_summaries and style:

```typescript
streamSuggestionsFocused: async (
  collectionId: number,
  selection: {
    selectedNews: number[]
    selectedThemes: number[]
    customNews: string[]
    customThemes: string[]
    style?: { tone: string; audience: string; length: string; approach: string }
    mefarshimSummaries?: { mefaresh: string; ref: string; summary: string }[]
  },
  onChunk: (text: string) => void,
  onDone: (suggestions: DvarToraSuggestion[]) => void,
  onHeartbeat?: () => void,
) => {
  const resp = await fetch(`${BASE}/dvar-tora/suggestions/${collectionId}/stream-from-selection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selected_news: selection.selectedNews,
      selected_themes: selection.selectedThemes,
      custom_news: selection.customNews,
      custom_themes: selection.customThemes,
      style: selection.style || null,
      mefarshim_summaries: (selection.mefarshimSummaries || []).map(m => ({
        mefaresh: m.mefaresh,
        ref: m.ref,
        summary: m.summary,
      })),
    }),
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
      if (data.type === 'chunk') onChunk(data.text)
      else if (data.type === 'heartbeat') onHeartbeat?.()
      else if (data.type === 'done') onDone(data.suggestions)
    }
  }
},
```

- [ ] **Step 4: Update SuggestionCards `handleGenerate` to pass mefarshim**

In `frontend/src/components/SuggestionCards.tsx`, update the `handleGenerate` function:

```typescript
const handleGenerate = () => {
  setLoading(true)
  setThinking(true)
  setStreamText('')
  setSuggestions([])
  api.streamSuggestionsFocused(
    collection.id,
    {
      selectedNews: selection.selectedNews,
      selectedThemes: selection.selectedThemes,
      customNews: selection.customNews,
      customThemes: selection.customThemes,
      style: selection.style,
      mefarshimSummaries: selectedMefarshim.map(m => ({
        mefaresh: m.mefaresh,
        ref: m.ref,
        summary: m.summary,
      })),
    },
    // ... rest stays the same
```

- [ ] **Step 5: Verify TypeScript compiles and backend starts**

Run: `cd /home/oshrin/projects/dvar-tora/frontend && npx tsc --noEmit 2>&1 | head -5`
Run: `cd /home/oshrin/projects/dvar-tora/backend && .venv/bin/python -c "from app.api.dvar_tora import SelectionContext; print('OK')"`
Expected: No errors, `OK`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SuggestionCards.tsx frontend/src/lib/api.ts backend/app/api/dvar_tora.py
git commit -m "feat: pass mefarshim summaries through to suggestion generation"
```

---

### Task 9: End-to-end manual test and restart service

- [ ] **Step 1: Restart both services**

```bash
systemctl --user restart dvar-tora-backend dvar-tora-frontend
```

- [ ] **Step 2: Verify services are running**

```bash
systemctl --user status dvar-tora-backend dvar-tora-frontend --no-pager | head -20
```

- [ ] **Step 3: Manual test flow**

Open `http://code-agents-server.local/dvar-tora/` in browser.
1. Dashboard: select news + themes → click continue
2. Style: pick tone/audience/length/approach → click continue
3. **NEW — Mefarshim Research**: select categories → click "חפש מפרשים" → see cards streaming → deselect irrelevant ones → click "המשך להצעות"
4. Suggestions: click "צור הצעות דבר תורה" → verify suggestions appear

- [ ] **Step 4: Commit any fixes needed**
