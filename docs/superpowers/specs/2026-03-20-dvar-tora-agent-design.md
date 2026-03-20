# Dvar Torah Agent — Design Spec

## Overview

A weekly Dvar Torah preparation agent for personal use. Every Thursday, it automatically collects Israeli news and the upcoming Parasha with mefarshim, then helps the user craft a Dvar Torah that connects current events to Torah themes — all in Hebrew. The final output is a printable Daf Mekorot (source sheet).

## Architecture: Split Backend + Frontend

- **Backend:** Python 3.12+ / FastAPI / SQLite
- **Frontend:** React 18 / TypeScript / Vite / Tiptap editor / Tailwind CSS
- **AI Engine:** Claude CLI via subprocess (no API key)
- **PDF:** WeasyPrint (HTML/CSS to PDF)
- **Scheduling:** System cron

## System Phases

### Phase 1 — Data Collection (Cron, Thursday 08:00)

Automated weekly prep:

1. **Israeli news** — RSS feeds (Ynet, Walla, Haaretz, Kan), Google News Israel API, and scraping trending topics. Extracts headlines, summaries, and themes in Hebrew.
2. **Weekly Parasha** — Hebcal API determines the upcoming Shabbat portion.
3. **Parasha text & mefarshim** — Sefaria API for Torah text and commentaries, based on user profile preferences. Additional sources (HebrewBooks, TheTorah.com) for content not in Sefaria.
4. **Storage** — structured data saved to SQLite.
5. **Notification** — desktop notification (`notify-send`), later Telegram.

### Phase 2 — AI Analysis & Suggestions (User-triggered)

When the user opens the web UI or triggers via Claude Code:

1. Claude CLI receives collected data + mefarshim preferences.
2. Identifies thematic connections between news topics and the Parasha.
3. Generates 5 Dvar Torah suggestions — each with title, thesis, key sources, and brief outline.
4. User picks one or asks for more.

### Phase 3 — Writing & Editing (Interactive)

1. Claude expands chosen suggestion into a full Dvar Torah in Hebrew.
2. User refines in the web editor — chat sidebar for AI assistance, direct text editing.
3. Generate Daf Mekorot PDF when done.

## Backend Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI entry
│   ├── api/
│   │   ├── parasha.py             # Parasha data endpoints
│   │   ├── news.py                # News data endpoints
│   │   ├── dvar_tora.py           # Suggestions, editing, chat
│   │   └── pdf.py                 # PDF generation endpoint
│   ├── collectors/
│   │   ├── news_collector.py      # RSS, APIs, scraping
│   │   ├── parasha_collector.py   # Hebcal + Sefaria
│   │   └── mefarshim_collector.py # Sefaria + other sources
│   ├── ai/
│   │   └── claude_cli.py          # Claude CLI wrapper
│   ├── pdf/
│   │   └── generator.py           # PDF/Daf Mekorot generation
│   ├── models.py                  # SQLite models (SQLModel)
│   └── config.py                  # User profile & preferences
├── cron/
│   └── weekly_prep.py             # Thursday cron job
└── data/
    └── dvar_tora.db               # SQLite database
```

### Data Models

- **WeeklyCollection** — parasha name, date, news items, raw mefarshim texts, status
- **DvarToraSuggestion** — title, thesis, sources, outline, linked news themes
- **DvarTora** — final edited text, status (draft/final), linked sources
- **UserProfile** — mefarshim preferences, default style

### Claude CLI Wrapper

- Non-interactive: `claude --print -p "prompt"` for suggestions
- Session-based: `claude --session-id {week_id} -p "request"` for editing chat
- Prompts built from templates with injected Hebrew content
- System prompt: write in Hebrew, cite sources accurately, connect current events to Torah

## Frontend Structure

```
frontend/
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── WeeklyDashboard.tsx     # Landing page — week status
│   │   ├── NewsSummary.tsx         # Trending Israeli topics
│   │   ├── SuggestionCards.tsx     # 5 suggestions to pick from
│   │   ├── Editor/
│   │   │   ├── DvarToraEditor.tsx  # Tiptap rich text editor
│   │   │   ├── ChatSidebar.tsx     # AI chat sidebar
│   │   │   └── SourcePanel.tsx     # Mefarshim references
│   │   ├── MefarshimPicker.tsx    # Commentary style picker
│   │   ├── PdfPreview.tsx         # Preview & download
│   │   └── Settings.tsx           # Profile & preferences
│   ├── hooks/
│   │   ├── useChat.ts             # WebSocket chat with AI
│   │   └── useParasha.ts          # Parasha data fetching
│   └── lib/
│       ├── api.ts                 # Backend API client
│       └── types.ts               # Shared types
```

### User Flow

1. **Dashboard** — Parasha name, data status, top news themes
2. **Review News** — 5-10 trending topics, dismiss irrelevant ones
3. **Pick Mefarshim** — defaults from profile, override per session
4. **Browse Suggestions** — 5 cards with title, thesis, news connection, sources
5. **Editor** — split view: RTL text editor (left), chat sidebar (right), source panel (bottom)
6. **Generate PDF** — preview, adjust layout, download/print

### RTL

- Entire app `dir="rtl"`, Hebrew-first
- Tiptap configured for RTL paragraphs
- Tailwind RTL plugin

## Mefarshim System

### Categories

**Pshat (פשט):** Rashi, Ramban, Ibn Ezra, Sforno, Rashbam, Or HaChaim
- Source: Sefaria API

**Hasidic (חסידות):** Sefat Emet, Netivot Shalom, Mei HaShiloach, Kedushat Levi, Tanya, Noam Elimelech
- Source: Sefaria (partial), HebrewBooks

**Bikoret HaMikra (ביקורת המקרא):** Academic commentaries, documentary hypothesis, archaeological context
- Source: TheTorah.com, academic repositories, curated PDFs

**Mixed:** User picks individual mefarshim across categories

### Flow

1. Profile stores preferred mefarshim names + source mappings
2. Collector pulls relevant sections per Parasha from Sefaria first, falls back to other sources
3. Claude receives actual Hebrew texts for accurate quoting
4. Every suggestion includes exact source references (sefer, perek, section)

## PDF / Daf Mekorot

### Layout

Traditional source sheet style:

- **Header:** Parasha name, date (Hebrew & Gregorian), Dvar Torah title
- **Main column:** Dvar Torah text in a clear Hebrew font (Noto Serif Hebrew)
- **Source boxes:** Bordered boxes with mefaresh name, reference, Hebrew text. Numbered to match citations
- **Footer:** Optional attribution

### Technical

- WeasyPrint: HTML/CSS to PDF via Jinja2 templates
- RTL-first CSS with Hebrew typography
- Print-optimized: A4, double-sided margins, section page breaks
- Layout options: compact (single page handout) vs. expanded (multi-page)
- Optional: include/exclude specific sources, QR code to Sefaria

## Claude Code Integration

### Slash Command `/dvar-tora`

- Checks this week's status via backend API
- Triggers collection if not done
- Opens web UI in browser + shows terminal summary
- Can run suggestion flow in CLI mode

### Cron

```
0 8 * * 4   # Every Thursday at 08:00
```

Runs `weekly_prep.py` → collects data → stores in SQLite → sends notification.

## Future: Telegram Bot

- Thursday notification: "הנתונים לפרשת השבוע מוכנים"
- Quick commands: show suggestions
- Links to web UI for editing
- Send final PDF

## Constraints & Decisions

- **Language:** All output and UI in Hebrew
- **Single user:** No auth, no multi-tenancy
- **No API key:** Claude CLI only, via subprocess
- **Storage:** SQLite — simple, no external DB
- **Mefarshim preferences:** Default profile + per-session override
