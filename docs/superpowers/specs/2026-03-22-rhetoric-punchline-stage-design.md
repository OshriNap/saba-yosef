# Rhetoric & Punchline Stage — Design (Part 1)

## Context

The Dvar Torah agent has a multi-stage wizard. The user's drasha creation process works backwards from the end: first define **what** the audience should take away (the punchline), and **how** to deliver it (rhetorical strategies), then find sources and structure that serve the narrative.

This spec adds a **Rhetoric & Punchline** stage early in the flow. A future Part 2 will add a narrative workspace that absorbs mefarshim research and suggestions into an iterative building process.

## Flow Position

Dashboard (pick news+themes) → **Rhetoric & Punchline** → Style → Mefarshim Research → Suggestions → Editor

## Stage UX

A single screen with two sections:

### Section 1: Rhetorical Strategies (ordered sequence)

Cards from a rhetoric database. Each card shows:
- **Name** (Hebrew) — e.g., "מסגור מחדש פרובוקטיבי"
- **Description** — 1-2 sentences explaining the approach
- **Structure template** — how the drasha flows when using this strategy
- **Example** (expandable, optional) — a short example of this strategy in a real drasha

User interaction:
- **Multi-select** — click to toggle selection
- **Orderable** — selected strategies can be reordered with up/down arrows to define the drasha arc
- **Add custom** — "הוסף אסטרטגיה" button opens a form (name, description, structure template) to add a new strategy to the database. Custom strategies persist for future use.
- Multiple strategies concatenated in sequence create the drasha flow and tension

### Pre-seeded Strategies

| Key | Name | Description | Structure Template |
|-----|------|-------------|-------------------|
| `news_to_torah` | מהחדשות לתורה | מה שמעסיק את כולם השבוע מקבל פרספקטיבה תורנית | פתח עם האירוע, חבר לפרשה, תן תובנה |
| `bigger_picture` | התמונה הגדולה | עזור לאנשים לראות את ההקשר הרחב שהם לא רואים | הצג את הפרט, הרחב לכלל, חשוף את התבנית |
| `counter_consensus` | נגד הזרם | אמור משהו שאנשים לא מצפים לשמוע, תגר על הקונצנזוס | הצג את הדעה המקובלת, ערער, הצע חלופה |
| `provocative_reframe` | מסגור מחדש פרובוקטיבי | פתח עם טענה מפתיעה שנראית שגויה, ובסוף כולם מסכימים | פתח פרובוקטיבית, בנה דרך מקורות, חשוף שהטענה נכונה מזווית אחרת |

More can be added by the user at any time.

### Section 2: Punchline

Appears once at least one strategy is selected.

- **Claude generates 3-5 punchline suggestions** (Sonnet, via CLI) based on:
  - The selected news items and parasha themes from the dashboard
  - The chosen rhetorical sequence and structure templates
- Each punchline is a card showing 1-2 sentences — the main audience takeaway
- User can **pick one**, **edit it**, or **write their own** from scratch in a text input
- **"צור פאנצ'ליין" button** triggers the generation

### Optional Beats

Once a punchline is set, Claude suggests a one-sentence beat for each strategy step in the sequence — a mini-moment that serves the arc toward the punchline. User can:
- Edit any beat
- Leave blank to let Claude fill in during suggestion generation
- These are lightweight — one sentence per step, not a full outline

### Navigation

- "חזרה" goes back to Dashboard
- "המשך" proceeds to Style, carrying rhetoric sequence + punchline + beats forward

## Backend

### New Model: `RhetoricStrategy`

In `backend/app/models.py`:

```python
class RhetoricStrategy(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = ""          # Stable identifier for pre-seeded (e.g., "news_to_torah"), empty for custom
    name: str              # Hebrew name, e.g., "מסגור מחדש פרובוקטיבי"
    description: str       # 1-2 sentences
    structure_template: str # How the drasha flows with this strategy
    example: str = ""      # Optional example — shown in UI as expandable section
    is_custom: bool = False # Pre-seeded vs user-added
    display_order: int = 0  # For ordering in the UI
```

### New Router: `backend/app/api/rhetoric.py`

#### `GET /api/rhetoric/`
Returns all strategies ordered by `display_order`.

#### `POST /api/rhetoric/`
Creates a custom strategy. Sets `is_custom=True`.

Request body:
```json
{
  "name": "...",
  "description": "...",
  "structure_template": "...",
  "example": ""
}
```

#### `PUT /api/rhetoric/{id}`
Updates a strategy (custom only — return 403 with `{"detail": "לא ניתן לערוך אסטרטגיה מובנית"}` if `is_custom=False`).

#### `DELETE /api/rhetoric/{id}`
Deletes a strategy (custom only — return 403 with `{"detail": "לא ניתן למחוק אסטרטגיה מובנית"}` if `is_custom=False`).

#### `POST /api/rhetoric/{collection_id}/punchlines`
Claude (Sonnet) generates 3-5 punchline suggestions. Uses SSE streaming (same pattern as mefarshim research) to provide heartbeat/loading feedback during the 10-30s Claude CLI call.

Request body:
```json
{
  "selected_news": [0, 2],
  "selected_themes": [1, 3],
  "custom_news": ["..."],
  "custom_themes": ["..."],
  "rhetoric_sequence": [
    {"name": "...", "description": "...", "structure_template": "..."}
  ]
}
```

SSE Response:
```
data: {"type": "heartbeat"}
data: {"type": "done", "punchlines": ["משפט פאנצ'ליין ראשון...", "..."]}
```

The frontend shows a loading indicator while heartbeats arrive, then displays punchline cards on `done`.

#### `POST /api/rhetoric/{collection_id}/beats`
Claude (Sonnet) generates a beat per strategy step. Also SSE streaming.

Request body:
```json
{
  "punchline": "...",
  "selected_news": [0, 2],
  "selected_themes": [1, 3],
  "custom_news": ["..."],
  "custom_themes": ["..."],
  "rhetoric_sequence": [...]
}
```

SSE Response:
```
data: {"type": "heartbeat"}
data: {"type": "done", "beats": [{"strategy_name": "מהחדשות לתורה", "beat": "..."}]}
```

### Seeding Pre-built Strategies

Add a `seed_rhetoric_strategies()` function in `backend/app/database.py`. Runs on app startup after `init_db()`. Checks for existing strategies by `key` field — only inserts pre-seeded strategies whose `key` is not already in the DB. This is idempotent: re-running won't duplicate or re-insert strategies the user deleted (since deleted rows lose their key). Pre-seeded strategies get explicit `display_order` values (0, 1, 2, 3).

### Claude CLI: New Methods

In `backend/app/ai/claude_cli.py`:

#### `generate_punchlines()`
Uses Sonnet (default model, no `--model` flag). Takes news items, themes, and rhetoric sequence. Returns list of punchline strings.

#### `generate_beats()`
Uses Sonnet. Takes punchline, rhetoric sequence, news, themes. Returns list of beats.

### New Prompts

In `backend/app/ai/prompts.py`:

#### `PUNCHLINE_PROMPT`
Given: selected news, themes, rhetoric sequence with structure templates.
Ask Claude to:
- Generate 3-5 punchlines in Hebrew
- Each punchline is 1-2 sentences — the main audience takeaway
- Punchlines should work with the chosen rhetorical sequence
- Return JSON: `{"punchlines": ["...", "..."]}`

#### `BEATS_PROMPT`
Given: punchline, rhetoric sequence, news, themes.
Ask Claude to:
- For each strategy in the sequence, suggest a one-sentence beat
- Each beat should serve the arc toward the punchline
- Return JSON: `{"beats": [{"strategy_name": "...", "beat": "..."}]}`

## Frontend

### New Types in `types.ts`

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

### Extended `UserSelection` in `App.tsx`

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

### New API Methods in `api.ts`

```typescript
getRhetoricStrategies: () => fetchJSON<RhetoricStrategy[]>('/rhetoric/')
createRhetoricStrategy: (data) => fetchJSON<RhetoricStrategy>('/rhetoric/', { method: 'POST', body: ... })
updateRhetoricStrategy: (id, data) => fetchJSON<RhetoricStrategy>(`/rhetoric/${id}`, { method: 'PUT', body: ... })
deleteRhetoricStrategy: (id) => fetchJSON<void>(`/rhetoric/${id}`, { method: 'DELETE' })
streamPunchlines: (collectionId, data, onDone, onHeartbeat) => // SSE streaming, same fetch+reader pattern as streamMefarshimResearch
streamBeats: (collectionId, data, onDone, onHeartbeat) => // SSE streaming
```

### New Component: `RhetoricPunchline.tsx`

Props:
```typescript
interface RhetoricPunchlineProps {
  collection: WeeklyCollection
  selection: { selectedNews: number[]; selectedThemes: number[]; customNews: string[]; customThemes: string[] }
  onComplete: (rhetoric: RhetoricStrategy[], punchline: string, beats: DrashaBeat[]) => void
  onBack: () => void
}
```

### App.tsx Changes

- Add `'rhetoric'` to `View` type (between `'dashboard'` and `'style'`)
- Dashboard's `onProceed` navigates to `'rhetoric'` instead of `'style'`
- Rhetoric stage's `onComplete` stores rhetoric data in `UserSelection` and navigates to `'style'`
- `UserSelection` carries `rhetoricSequence`, `punchline`, `beats` forward through all stages

### Data Flow to Downstream Stages

The rhetoric sequence, punchline, and beats are passed to:
- **Mefarshim Research** — add punchline context to the research prompt so Claude finds mefarshim relevant to the takeaway
- **Suggestions** — the suggestion prompt includes the full rhetorical arc, punchline, and beats, so generated suggestions follow the defined structure

Changes to existing code for downstream integration:
- `_build_focused_prompt()` in `claude_cli.py` — add optional `rhetoric_sequence`, `punchline`, and `beats` parameters. Build a rhetoric section string from these and append it to the prompt text (do NOT add a new `{rhetoric_section}` placeholder to the template — instead append the section after formatting, to avoid breaking existing calls).
- `stream_mefarshim_research()` in `claude_cli.py` — add optional `punchline` parameter. Include the punchline in the research prompt so Claude finds mefarshim relevant to the takeaway.
- `SelectionContext` in `dvar_tora.py` — add `rhetoric_sequence: list[dict] = []`, `punchline: str = ""`, `beats: list[dict] = []` fields. These pass through to `_build_focused_prompt()`.
- `stream_from_selection` and `generate_from_selection` endpoints — pass the new fields through.

## Model Usage

| Task | Model | Reason |
|------|-------|--------|
| Generate punchlines | Sonnet (default) | Needs creativity and narrative sense |
| Generate beats | Sonnet (default) | Needs narrative arc understanding |
| Mefarshim summarization | Haiku (`--model haiku`) | Mechanical filtering/summarizing |
| Suggestion generation | Sonnet (default) | Needs quality writing |

All calls go through Claude CLI (`claude --print -p "..."`).

## File Changes Summary

| File | Change |
|------|--------|
| `backend/app/models.py` | Add `RhetoricStrategy` model |
| `backend/app/api/rhetoric.py` | **New** — CRUD + punchline/beats generation |
| `backend/app/main.py` | Register rhetoric router |
| `backend/app/database.py` | Add seed function for pre-built strategies |
| `backend/app/ai/claude_cli.py` | Add `generate_punchlines()`, `generate_beats()` |
| `backend/app/ai/prompts.py` | Add `PUNCHLINE_PROMPT`, `BEATS_PROMPT` |
| `backend/app/api/dvar_tora.py` | Add rhetoric fields to `SelectionContext`, pass through to prompts |
| `frontend/src/lib/types.ts` | Add `RhetoricStrategy`, `DrashaBeat`, extend `UserSelection` |
| `frontend/src/lib/api.ts` | Add rhetoric API methods |
| `frontend/src/components/RhetoricPunchline.tsx` | **New** — full stage component |
| `frontend/src/App.tsx` | Add rhetoric view, update flow routing |

## Future: Part 2 — Narrative Workspace

This stage is designed to feed into a future narrative workspace (Part 2) that will:
- Replace the separate mefarshim research + suggestions stages
- Provide an iterative workspace with a storyboard view + chat panel
- Allow user to find sources (mefarshim, news, science, philosophy, counterfactuals) iteratively
- Let user bring their own mekorot and sources the system doesn't have
- Support dragging material into beats/steps of the rhetorical sequence
- Use Sonnet for creative/narrative chat, Haiku for mechanical summarization

The `RhetoricStrategy` model, `UserSelection` extensions, and punchline/beats data structures are designed to support Part 2 without changes.
