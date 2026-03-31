# Drasha Flow Builder — Design Spec

**Date:** 2026-03-30
**Status:** Approved

## Summary

A collaborative flow builder that lets the user define the structure of their drasha section-by-section before generating the full text. Claude proposes an initial flow from collected material, then the user reshapes it through drag-to-reorder, section editing, and AI-assisted refinement — both per-section and globally. The flow replaces the "suggestions" stage for users who want detailed control, while the quick path (current behavior) remains available.

## Stage Placement

After the rhetoric stage (strategies + punchline), the user sees a fork:

- **"בנה את המהלך"** → Flow Builder (detailed path)
- **"דלג להצעות"** → Style → Mefarshim → Suggestions (current quick path)

**Detailed path:** Rhetoric → **Flow Builder** → Style → Mefarshim → Generate Drasha → Editor

No suggestions stage in the detailed path — the flow IS the drasha spec. Claude generates one drasha from it, straight to the editor. Style and Mefarshim stay after the flow builder: the flow defines structure, style/mefarshim enrich content. Flow sections can reference mefaresh slots ("bring a mefaresh here") without needing specific quotes yet.

## Data Model

### FlowSection

| Field | Type | Description |
|-------|------|-------------|
| id | string (uuid) | Stable ID for drag/reorder tracking |
| title | string | Section title, e.g. "פתיחה — החדשות שמעסיקות" |
| description | string | What this section does, 2-3 sentences |
| rhetoricalMove | string | One of: "hook", "build", "surprise", "deepen", "resolve", "land" |
| assignedNews | number[] | Indices into collection.news_items |
| assignedThemes | number[] | Indices into collection.parasha_themes |
| mefareshSlot | string | Free text hint, e.g. "bring Ramban on sacrifice here" |
| transitionTo | string | How this section flows into the next |
| estimatedMinutes | number | Rough timing for this section |

### DrashaFlow

| Field | Type | Description |
|-------|------|-------------|
| id | number (optional) | Null until saved to DB |
| collectionId | number | FK to WeeklyCollection |
| punchline | string | The punchline this flow builds toward |
| sections | FlowSection[] | Ordered list of sections |
| totalMinutes | number | Sum of section estimates |
| createdAt | string (optional) | Set on save |
| updatedAt | string (optional) | Set on save |

### Rhetorical Moves

Six possible moves per section — the rhetorical function of each section (distinct from the overall rhetoric strategy):

- **hook** — Grab attention, usually with current events or a provocative question
- **build** — Develop the idea, connect news to Torah concepts
- **surprise** — Flip perspective, challenge assumptions
- **deepen** — Torah depth, mefarshim quotes, textual analysis
- **resolve** — Tie threads together, show coherence
- **land** — Deliver the punchline, call to action

## UI Design

### Layout

- **Top bar:** Punchline displayed, global "refine flow" button, "add section" button, "save" button (optional persist)
- **Timeline strip:** Color-coded rhetorical move badges with total time estimate
- **Section cards:** Expand/collapse accordion. Expanded view shows all FlowSection fields with inline editing
- **Section actions:** Reorder (up/down arrows), refine with Claude (sparkle icon), delete
- **Bottom:** "Generate drasha from flow" button, back button

### Section Card (Expanded)

Shows: title (editable), description (editable textarea), rhetorical move (dropdown), assigned news (chips, clickable to add/remove), assigned themes (chips), mefaresh slot (editable text), transition (editable text), time estimate (number input). All fields are directly editable in the card.

### Section Card (Collapsed)

Shows: order number, title, rhetorical move badge, material count summary (e.g. "news x1, mefaresh x1"), "click to expand" hint.

### Interaction Model: Collaborative Ping-Pong

1. User enters flow builder → Claude generates initial flow from all collected material (punchline, strategies, news, themes, connections)
2. User rearranges, edits, adds/removes sections
3. User can:
   - **Section-level refine:** Click sparkle on a section → Claude rewrites that section (with context of surrounding sections for coherent transitions)
   - **Global refine:** Click "refine flow" → Claude re-evaluates the whole flow for coherence, pacing, transitions, and punchline arc
4. Repeat until satisfied
5. "Generate drasha from flow" → proceeds to Style → Mefarshim → generates full drasha text

## Backend API

### New Endpoints

**Flow generation (streaming):**

`POST /api/rhetoric/{collection_id}/generate-flow`

Request body:
```json
{
  "punchline": "string",
  "rhetoric_sequence": [{"name": "...", "description": "...", "structure_template": "..."}],
  "selected_news": [0, 2, 5],
  "selected_themes": [1, 3],
  "custom_news": ["..."],
  "custom_themes": ["..."]
}
```

Response: SSE stream — heartbeat events while thinking, then `{"type": "done", "flow": DrashaFlow}`.

**Section refine (streaming):**

`POST /api/rhetoric/{collection_id}/refine-section`

Request body:
```json
{
  "flow": DrashaFlow,
  "section_id": "uuid",
  "instruction": "find a better mefaresh for this point"
}
```

Response: SSE stream — heartbeat, then `{"type": "done", "section": FlowSection}`.

**Global refine (streaming):**

`POST /api/rhetoric/{collection_id}/refine-flow`

Request body:
```json
{
  "flow": DrashaFlow,
  "instruction": "optional user note"
}
```

Response: SSE stream — heartbeat, then `{"type": "done", "flow": DrashaFlow, "changes": "brief note on what changed"}`.

**Persistence:**

`POST /api/flow/{collection_id}` — Save flow to DB. Body: `DrashaFlow`. Returns saved flow with id.

`GET /api/flow/{collection_id}` — Load saved flow. Returns `DrashaFlow` or 404.

### DB Model

```python
class DrashaFlow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    collection_id: int = Field(foreign_key="weeklycollection.id")
    punchline: str
    sections: list = Field(default=[], sa_column=Column(JSON))
    total_minutes: int = 0
    created_at: str = ""
    updated_at: str = ""
```

## Prompt Design

### FLOW_GENERATE_PROMPT

Given punchline, rhetoric strategies, selected news, themes, and connections — produce a 4-6 section flow. Each section includes all FlowSection fields. Claude builds a coherent arc that lands on the punchline. Returns JSON matching the DrashaFlow structure.

### FLOW_REFINE_SECTION_PROMPT

Given the full flow context + target section + user instruction — rewrite just that section. Claude sees surrounding sections to maintain coherent transitions. Returns JSON matching the FlowSection structure.

### FLOW_REFINE_GLOBAL_PROMPT

Given the full flow after user edits — check for broken transitions, redundant sections, pacing issues, missing rhetorical moves, and whether the arc still lands on the punchline. Returns the improved DrashaFlow with a brief note on what changed.

### Modified Drasha Generation

The existing `stream-from-selection` endpoint accepts an optional `flow` parameter. When present, instead of generating suggestion cards, it generates one drasha that follows the flow structure section-by-section. Each FlowSection becomes a section in the output text.

## File Changes

### New Files

- `frontend/src/components/FlowBuilder.tsx` — Main flow builder component
- `backend/app/api/flow.py` — New router (5 endpoints)

### Modified Files

- `frontend/src/App.tsx` — Add `'flow-builder'` view, `DrashaFlow` state, fork after rhetoric
- `frontend/src/lib/types.ts` — Add `FlowSection`, `DrashaFlow` types
- `frontend/src/lib/api.ts` — Add flow API methods
- `frontend/src/components/RhetoricPunchline.tsx` — Fork UI (build flow vs. skip to suggestions)
- `backend/app/main.py` — Register flow router
- `backend/app/models.py` — Add `DrashaFlow` model
- `backend/app/ai/prompts.py` — Add 3 new prompt templates
- `backend/app/ai/claude_cli.py` — Add 3 new methods (generate_flow, refine_section, refine_flow)
- `backend/app/api/dvar_tora.py` — Update `stream-from-selection` to accept flow parameter
