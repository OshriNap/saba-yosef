# Connection Dashboard Redesign

## Overview

Replace the current WeeklyDashboard + NewsSummary with an interactive two-column connection map. Right column shows Israeli news items, left column shows parasha themes extracted by Claude. SVG bezier curves connect related items with varying thickness based on connection strength. Users click items on either side to select, then generate Dvar Torah suggestions based on their selection.

## Data Changes

### New fields on WeeklyCollection model

- `parasha_themes: list[dict]` — 5-8 themes, each `{"title": "...", "description": "..."}`
- `connections: list[dict]` — each `{"news_index": int, "theme_index": int, "strength": 1-5, "reason": "..."}`

### Thursday Cron Addition

After collecting news + parasha + mefarshim, an additional Claude CLI call:
- **Input:** parasha text + mefarshim excerpts + news headlines/summaries
- **Output:** JSON with `themes` and `connections` arrays
- New prompt template `THEMES_PROMPT_TEMPLATE` in `prompts.py`
- Stored in WeeklyCollection

## Frontend: ConnectionDashboard Component

Replaces `WeeklyDashboard` and `NewsSummary`.

### Layout
- RTL, full width, two columns with SVG canvas between them
- Right column: news items (blue accent, clickable, multi-select)
- Left column: parasha themes (purple accent, clickable, multi-select)
- Middle: SVG with bezier curves, thickness = strength (1-5)

### Interaction
- Click news item → connected themes glow gold, lines animate, unconnected items dim
- Click theme → same in reverse
- Multi-select on both sides to narrow focus
- Selection counter at bottom: "נבחרו X חדשות ← Y נושאי פרשה"
- "צור דבר תורה על הנבחרים" button, active when ≥1 selected on each side

### Data passed to suggestions
- Selected news items + selected themes + their connection reasons → sent to Claude for Dvar Torah generation

## Files Changed

- Modify: `backend/app/models.py` — add `parasha_themes`, `connections` fields
- Modify: `backend/app/ai/prompts.py` — add `THEMES_PROMPT_TEMPLATE`
- Modify: `backend/app/ai/claude_cli.py` — add `generate_themes_and_connections()`
- Modify: `backend/cron/weekly_prep.py` — call theme generation after data collection
- Create: `frontend/src/components/ConnectionDashboard.tsx` — new main dashboard
- Modify: `frontend/src/App.tsx` — replace WeeklyDashboard with ConnectionDashboard
- Modify: `frontend/src/lib/types.ts` — add Theme, Connection types
