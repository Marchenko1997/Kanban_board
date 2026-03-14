# Frontend App Notes

This document describes the current frontend implementation in `frontend/`.

## Scope

- Next.js app (App Router) rendering login, Kanban board, and AI chat sidebar.
- Dummy auth gate (`user` / `password`) is handled client-side.
- Board state is loaded and saved through backend API routes.
- AI chat requests are sent to backend and can optionally update board state.

## Stack

- Framework: Next.js 16 + React 19 + TypeScript
- Styling: Tailwind CSS v4 + CSS variables in `src/app/globals.css`
- Drag and drop: `@dnd-kit/core`, `@dnd-kit/sortable`
- Tests:
  - Unit/component: Vitest + Testing Library (`src/**/*.test.ts(x)`)
  - E2E: Playwright (`tests/*.spec.ts`)

## Entry Points

- `src/app/page.tsx`: auth flow, board loading/saving orchestration, AI chat flow.
- `src/components/KanbanBoard.tsx`: board interactions (rename/add/delete/drag-drop).
- `src/components/AiSidebar.tsx`: sidebar chat UI and message input.
- `src/lib/api.ts`: frontend API client (`board` + `ai-chat` endpoints).
- `src/lib/kanban.ts`: board types, seed data, and pure move logic (`moveCard`).

## Current Data Model

- `BoardData`:
  - `columns: Column[]`
  - `cards: Record<string, Card>`
- `Column` contains ordered `cardIds`.
- `Card` contains `id`, `title`, and `details`.
- Initial demo data is stored in `initialData` in `src/lib/kanban.ts`.

## UI Structure

- `KanbanBoard`:
  - Is controlled by props (`board`, `onBoardChange`).
  - Handles DnD start/end events and uses `moveCard` for reorder/move behavior.
  - Handles column rename, card add, and card delete updates.
- `KanbanColumn`:
  - Droppable area and sortable context.
  - Inline editable column title input.
  - Renders cards and new-card form.
- `KanbanCard`:
  - Sortable draggable card item with remove action.
- `NewCardForm`:
  - Local open/close state and simple required title validation.
- `AiSidebar`:
  - Renders chat history and message composer.
  - Emits submit events to page-level async handler.

## Styling + Theme

- Color tokens follow root project palette:
  - `--accent-yellow: #ecad0a`
  - `--primary-blue: #209dd7`
  - `--secondary-purple: #753991`
  - `--navy-dark: #032147`
  - `--gray-text: #888888`
- Typography uses Google fonts loaded in `src/app/layout.tsx`:
  - Display: Space Grotesk
  - Body: Manrope

## Test Conventions

- Unit tests are colocated with source files where practical:
  - `src/app/page.test.tsx`
  - `src/lib/api.test.ts`
  - `src/lib/kanban.test.ts`
  - `src/components/AiSidebar.test.tsx`
  - `src/components/KanbanBoard.test.tsx`
- E2E tests live in `tests/` and run against local dev server.
- Existing npm scripts:
  - `npm run test:unit`
  - `npm run test:e2e`
  - `npm run test:all`

## Current Runtime Behavior

- Before login, user sees sign-in form only.
- After login, page loads board from backend API (`/api/users/user/board`).
- Board edits are persisted with `PUT /api/users/user/board`.
- AI chat sidebar sends requests to `POST /api/users/user/ai-chat`.
- If backend is unavailable in local frontend-only dev, UI falls back to local seed data.

## Guidance For Next Steps

- Preserve existing test stack and conventions unless there is a strong reason to change.
- Keep component boundaries simple; avoid unnecessary abstraction layers.
- Keep API calls centralized in `src/lib/api.ts`.
- Maintain backward-compatible UX for login, Kanban interaction, and AI sidebar messaging.
