# Mefarshim Research Stage

## Context

The Dvar Torah agent has a multi-stage wizard: Dashboard (select news+themes) → Style → Suggestions → Editor. This spec adds a **Mefarshim Research** stage between Style and Suggestions.

This stage is also preparation for a future "drasha planning" step — the mefarshim summaries will serve as building blocks for talking points and flow definition before generating the full drasha.

## Flow Position

Dashboard → Style → **Mefarshim Research** → Suggestions → Editor

## Stage UX

A single screen with three sections:

### 1. Category Picker (top)

Multi-select buttons for mefarshim categories (sourced from `MEFARSHIM_MAP` in `parasha_collector.py`):
- פשט — pshat (Rashi, Ramban, Ibn Ezra, Sforno, + 18 more)
- חסידות — hasidic (Sefat Emet, Mei HaShiloach, Kedushat Levi, + 14 more)
- מוסר — mussar (Akeidat Yitzchak, Shenei Luchot HaBerit, Alshekh, + 4 more)
- מדרש — midrash (Midrash Tanchuma, Yalkut Shimoni, Zohar, + 6 more)
- ביקורת המקרא — bikoret (Shadal, David Zvi Hoffmann, Reggio)

Moved from the current SuggestionCards stage. The existing `MefarshimPicker` component is single-select — it needs to be modified to support multi-select (change props to `selected: MefarshimCategory[]` and `onChange: (categories: MefarshimCategory[]) => void`).

### 2. Action Button

"חפש מפרשים" — triggers the streaming research flow.

### 3. Results Area

Cards appear as Claude streams results. Each card contains:
- **Commentator name** + reference (e.g., "רש״י על בראשית א:א")
- **Summary** (2-3 sentences) — how this commentary connects to the user's selected news items and parasha themes
- **Expandable section** — original Hebrew text
- **Checkbox** (selected by default) — user can deselect irrelevant ones
- **Source badge** — "מהמאגר" (from DB) or "חדש" (freshly fetched from Sefaria)

"המשך" button at the bottom proceeds to Suggestions with selected mefarshim.

## Backend

### New Router: `backend/app/api/mefarshim.py`

#### `POST /api/mefarshim/{collection_id}/research`

**Request body** (`MefarshimResearchRequest`):
```json
{
  "selected_news": [0, 2],
  "selected_themes": [1, 3],
  "custom_news": ["..."],
  "custom_themes": ["..."],
  "categories": ["pshat", "hasidic"]
}
```

**Processing flow:**
1. Load `WeeklyCollection` from DB
2. Filter `collection.mefarshim_texts` by requested categories — these are the "DB" mefarshim
3. Call Claude Haiku with a research prompt containing:
   - The selected news items and themes
   - The existing mefarshim texts from DB
   - Instructions to: summarize each commentary's relevance, and suggest additional specific references to fetch
4. For each additional reference Claude suggests, fetch from Sefaria API via `ParashaCollector.fetch_single_reference()`
5. Call Claude Haiku again to summarize the newly fetched commentaries
6. Stream all results as SSE

**Response (SSE stream) — two phases:**

Phase 1: DB mefarshim summaries stream in as Claude processes them:
```
data: {"type": "mefaresh", "mefaresh": "רש\"י", "ref": "בראשית א:א", "summary": "...", "original_text": "...", "source": "db"}
data: {"type": "mefaresh", "mefaresh": "רמב\"ן", "ref": "...", "summary": "...", "original_text": "...", "source": "db"}
```

Phase 2: Additional references fetched from Sefaria and summarized:
```
data: {"type": "phase", "phase": "fetching_additional", "count": 3}
data: {"type": "mefaresh", "mefaresh": "שפת אמת", "ref": "...", "summary": "...", "original_text": "...", "source": "new"}
data: {"type": "done"}
```

The frontend shows a "מחפש מפרשים נוספים..." indicator between phases.

### Claude CLI: `stream_mefarshim_research()`

New method in `claude_cli.py`. Uses Claude Haiku. The existing `_build_cmd()` method needs a `model` parameter added (e.g., `_build_cmd(prompt, session_id=None, model=None)`) that appends `--model haiku` to the command when specified.

**Prompt structure** (`MEFARSHIM_RESEARCH_PROMPT` in `prompts.py`):

Given:
- Parasha name and selected text sections
- Selected news items (titles + summaries)
- Selected themes (titles + descriptions)
- Existing mefarshim texts from the selected categories

Ask Claude to:
1. For each existing commentary, write a 2-3 sentence summary of how it connects to the selected news+themes
2. Identify up to 5 additional specific references (mefaresh + exact ref) that would be relevant but are not in the existing collection
3. Return structured JSON

**Output format:**
```json
{
  "summaries": [
    {
      "mefaresh": "רש\"י",
      "ref": "בראשית א:א",
      "summary": "רש\"י מדגיש את... דבר זה מתחבר לחדשות על..."
    }
  ],
  "additional_refs": [
    {"mefaresh": "Ramban", "ref": "Genesis 1:1"}
  ]
}
```

### Parasha Collector: On-demand fetching

The existing `get_commentary(parasha_ref, mefaresh)` fetches all commentary by a mefaresh on a parasha ref. For additional references Claude suggests, we reuse this method with the specific ref Claude provides. If Sefaria returns nothing (reference doesn't exist or was hallucinated), silently skip it — no error shown to user. Fetch up to 5 additional references in parallel via `asyncio.gather` to avoid sequential latency.

## Frontend

### New Component: `MefarshimResearch.tsx`

Props:
```typescript
interface MefarshimResearchProps {
  collection: WeeklyCollection
  selection: { selectedNews: number[]; selectedThemes: number[]; customNews: string[]; customThemes: string[] }
  onComplete: (mefarshim: MefarshimResult[]) => void
  onBack: () => void
}
```

### Type Additions in `types.ts`

```typescript
interface MefarshimResult {
  mefaresh: string
  ref: string
  summary: string
  original_text: string
  source: 'db' | 'new'
  selected: boolean  // client-side toggle
}

type MefarshimCategory = 'pshat' | 'hasidic' | 'mussar' | 'midrash' | 'bikoret' | 'mixed'
```

### API Addition in `api.ts`

```typescript
streamMefarshimResearch: (
  collectionId: number,
  request: MefarshimResearchRequest,
  onResult: (result: MefarshimResult) => void,
  onDone: () => void
) => Promise<void>
```

### App.tsx Changes

- Add `'mefarshim'` to view states (between `'style'` and `'suggestions'`)
- Add `mefarshimResults: MefarshimResult[]` to state
- Pass selected (checked) mefarshim forward to SuggestionCards

### SuggestionCards.tsx Changes

- Remove embedded MefarshimPicker
- Receive `selectedMefarshim: MefarshimResult[]` as prop
- Pass mefarshim summaries to `api.streamSuggestionsFocused()` so the suggestion prompt uses them

### Suggestions Integration

The `SelectionContext` Pydantic model (backend) and `streamSuggestionsFocused` (frontend) need a new `mefarshim_summaries` field — an array of `{mefaresh, ref, summary}` objects. The suggestion prompt will use these pre-filtered summaries instead of the raw `collection.mefarshim_texts` dump. The frontend `streamSuggestionsFocused` call must also pass the `style` field which is currently defined in `SelectionContext` but not sent by the frontend.

## File Changes Summary

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add mefarshim view state and stage routing |
| `frontend/src/components/MefarshimResearch.tsx` | **New** — full stage component |
| `frontend/src/components/MefarshimPicker.tsx` | Modify to support multi-select (selected[] + onChange([])) |
| `frontend/src/components/SuggestionCards.tsx` | Remove MefarshimPicker, accept mefarshim as prop |
| `frontend/src/lib/types.ts` | Add MefarshimResult, MefarshimCategory |
| `frontend/src/lib/api.ts` | Add streamMefarshimResearch() |
| `backend/app/api/mefarshim.py` | **New** — research endpoint router |
| `backend/app/main.py` | Register mefarshim router |
| `backend/app/ai/claude_cli.py` | Add stream_mefarshim_research() |
| `backend/app/ai/prompts.py` | Add MEFARSHIM_RESEARCH_PROMPT |
| `backend/app/collectors/parasha_collector.py` | Reuse existing `get_commentary()` for on-demand fetches |
| `backend/app/ai/claude_cli.py` | Also add `model` param to `_build_cmd()` |

## Future: Drasha Planning Stage

This stage is designed to feed into a future "drasha planning" step. The MefarshimResult objects (with summaries and original texts) will serve as source material for:
- Defining talking points
- Structuring the drasha flow
- Selecting which commentaries to cite

The MefarshimResult type and data flow are designed to support this without changes.
