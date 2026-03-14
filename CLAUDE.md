# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Kanban board project management MVP with AI chat integration. Users sign in (hardcoded: `user` / `password`), view and edit their board, and use an AI sidebar to create/move/edit cards via natural language. Runs as a Docker container.

## Commands

### Docker (primary way to run)
```bash
docker-compose up --build    # Build and start on port 8080
docker-compose down          # Stop
```

Scripts in `scripts/` wrap these for Mac/Linux/Windows.

### Backend (Python / FastAPI)
```bash
cd backend
uv sync                                          # Install dependencies
uv run uvicorn app.main:app --reload             # Dev server on :8000
uv run pytest                                    # Run all tests
uv run pytest tests/test_foo.py::test_bar        # Run single test
```

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev                  # Dev server on :3000
npm run build                # Static export to out/
npm run lint                 # ESLint
npm run test:unit            # Vitest unit tests
npm run test:e2e             # Playwright E2E tests
npm run test:all             # All tests
```

## Architecture

**FastAPI backend** serves both the REST API (`/api/*`) and the statically-exported Next.js frontend (at `/`). Everything ships in a single Docker container.

### Data flow
1. Login is client-side only (no backend call).
2. On login, frontend calls `GET /api/users/{username}/board` — creates user+board if new.
3. Every board edit calls `PUT /api/users/{username}/board` with full board JSON.
4. AI chat: `POST /api/users/{username}/ai-chat` → backend calls OpenRouter → returns structured board diff → frontend auto-applies.

### Backend (`backend/app/`)
- `main.py` — FastAPI routes + lifespan (DB init, static file mount)
- `db.py` — SQLite layer; board stored as JSON text in `boards.board_json`
- `ai_client.py` — OpenRouter API call using `openai/gpt-oss-120b` with structured output
- `schemas.py` — Pydantic models: `Card`, `Column`, `BoardData`, AI response types
- Database file: `data/pm.db` (created at runtime, git-ignored)

### Frontend (`frontend/src/`)
- `app/page.tsx` — top-level orchestration: auth state, board load/save, AI chat handler
- `components/KanbanBoard.tsx` — controlled component; handles DnD, rename, add, delete
- `components/AiSidebar.tsx` — chat UI; emits submit to page-level handler
- `lib/api.ts` — all backend calls centralized here
- `lib/kanban.ts` — `BoardData`/`Column`/`Card` types, seed data, pure `moveCard` logic

### Key types (`lib/kanban.ts`)
```ts
BoardData { columns: Column[]; cards: Record<string, Card> }
Column    { id, title, cardIds: string[] }
Card      { id, title, details }
```

## Coding Standards

- No over-engineering. No extra features. No unnecessary defensive programming.
- No emojis — ever.
- Keep API calls centralized in `src/lib/api.ts`.
- Unit tests colocated with source (`src/**/*.test.ts(x)`); E2E in `tests/`.
- When hitting issues, identify root cause with evidence before fixing.

## Color Tokens

Defined as CSS variables in `frontend/src/app/globals.css`:
- `--accent-yellow: #ecad0a` — highlights
- `--primary-blue: #209dd7` — links, key sections
- `--secondary-purple: #753991` — submit buttons
- `--navy-dark: #032147` — main headings
- `--gray-text: #888888` — supporting text

## Environment

- `.env` at project root must contain `OPENROUTER_API_KEY=sk-or-...`
- SQLite DB is auto-created at `backend/data/pm.db` on first run
