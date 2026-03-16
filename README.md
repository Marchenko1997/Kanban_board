# Kanban Studio

A project management application with a Kanban board UI and an AI assistant that can create, move, and edit cards via natural language. Users can register accounts, create multiple boards, and manage work across all of them from a single dashboard.

---

## Features

- **User accounts** — register and log in with a username and password; sessions are maintained via JWT tokens stored in the browser
- **Multiple boards per user** — create, rename, and delete boards from a dashboard; each board is fully independent
- **Kanban board** — drag cards between columns, rename columns inline, add and delete cards
- **AI sidebar** — describe what you want in plain language and the AI restructures the board automatically (requires an OpenRouter API key)
- **Sync indicator** — real-time cloud/offline/saving status as edits are persisted to the backend
- **Demo account** — a seeded `user` / `password` account is always available for quick access

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLite, uvicorn |
| Frontend | Next.js 16 (static export), React 19, Tailwind CSS 4 |
| Drag and drop | dnd-kit |
| AI | OpenRouter API (`openai/gpt-oss-120b`) |
| Auth | HS256 JWT — stdlib only (`hmac`, `hashlib`) |
| Container | Docker (single image, multi-stage build) |

---

## Project structure

```
kanban_ai/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, all routes
│   │   ├── db.py            # SQLite layer (users, boards)
│   │   ├── auth.py          # JWT creation/verification, password hashing
│   │   ├── schemas.py       # Pydantic models for requests and responses
│   │   ├── ai_client.py     # OpenRouter API client
│   │   └── board_seed.py    # DEFAULT_BOARD (demo) and EMPTY_BOARD (new boards)
│   ├── tests/
│   │   ├── test_auth_api.py        # Register, login, /me endpoint tests
│   │   ├── test_multi_board_api.py # Board CRUD tests (authenticated)
│   │   ├── test_board_api.py       # Legacy board endpoint tests
│   │   ├── test_ai_api.py          # AI chat endpoint tests
│   │   └── test_ai_client.py       # AI client unit tests
│   ├── static/              # Populated at build time with Next.js export
│   └── pyproject.toml
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx         # Root component — auth, dashboard, board view
│       │   ├── layout.tsx       # Fonts and metadata
│       │   └── globals.css      # Design tokens (CSS variables)
│       ├── components/
│       │   ├── BoardDashboard.tsx   # Board list, create, delete
│       │   ├── KanbanBoard.tsx      # DnD container, header, column grid
│       │   ├── KanbanColumn.tsx     # Droppable column with card list
│       │   ├── KanbanCard.tsx       # Draggable card
│       │   ├── KanbanCardPreview.tsx # Drag overlay
│       │   ├── NewCardForm.tsx      # Inline card creation form
│       │   └── AiSidebar.tsx        # AI chat UI
│       └── lib/
│           ├── api.ts      # All fetch calls to the backend (centralised)
│           └── kanban.ts   # Types, moveCard logic, seed data
│
├── data/                    # SQLite database (git-ignored, created at runtime)
├── .env                     # OPENROUTER_API_KEY (required for AI features)
├── docker-compose.yml
└── Dockerfile
```

---

## Prerequisites

- **Docker** (for the containerised setup) — or —
- **Python 3.12+** and **Node.js 22+** (for running locally)
- An [OpenRouter](https://openrouter.ai) API key for AI features

---

## Running with Docker (recommended)

1. Create a `.env` file at the project root:

   ```
   OPENROUTER_API_KEY=sk-or-...
   ```

2. Build and start:

   ```bash
   docker-compose up --build
   ```

3. Open [http://localhost:8080](http://localhost:8080).

To stop: `docker-compose down`

The SQLite database is stored in `./data/pm.db` on the host via a volume mount, so data persists across container restarts.

To change the host port set `PM_PORT` before starting:

```bash
PM_PORT=9000 docker-compose up --build
```

---

## Running locally (without Docker)

### Backend

```bash
cd backend

# Install dependencies (requires uv — https://docs.astral.sh/uv/)
uv sync

# Copy the static frontend placeholder so FastAPI can start without a build
# (the full UI is served from here in production; skip if you run the frontend separately)

# Start the dev server on port 8000
uv run uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000/api`.

### Frontend

```bash
cd frontend

npm install

# Point the frontend at the local backend
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local

npm run dev   # Starts on http://localhost:3000
```

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Yes (AI features) | — | OpenRouter API key |
| `PM_DB_PATH` | No | `backend/data/pm.db` | Path to the SQLite database |
| `JWT_SECRET_KEY` | No | `dev-secret-key-change-in-production` | Secret used to sign JWT tokens — set this in production |
| `PM_PORT` | No | `8080` | Host port exposed by docker-compose |
| `NEXT_PUBLIC_API_BASE_URL` | No | `` (same origin) | Backend base URL for the frontend |

---

## Authentication

Registration and login are handled by the backend. Passwords are hashed with PBKDF2-HMAC-SHA256 (100,000 iterations, random 16-byte salt). Successful login returns a signed HS256 JWT that the frontend stores in `localStorage` under the key `pm-auth-v2`.

All board management endpoints require a `Bearer <token>` header. The token expires after 7 days.

**Demo account** (seeded automatically on first run):

| Username | Password |
|---|---|
| `user` | `password` |

---

## How boards work

Each user starts with one board ("My Board") created on registration. From the dashboard users can:

- **Open** a board to enter the Kanban view
- **Create** a new board (starts with five empty columns: Backlog, Discovery, In Progress, Review, Done)
- **Rename** a board (inline, via the PATCH endpoint)
- **Delete** a board (immediate, single click)

Each board's data is stored as a JSON blob in SQLite, scoped to its `board_id`. Boards are fully isolated — editing or deleting one board has no effect on any other.

Inside a board, edits are debounced (400 ms) and saved automatically to the backend. The header shows the current sync state (Synced / Saving / Offline).

---

## AI assistant

The AI sidebar (visible on `lg` screens and wider) accepts natural language instructions such as:

- "Move all review cards to done"
- "Add a card called 'Write release notes' to Backlog"
- "Rename the In Progress column to Active"

The backend sends the full board state and conversation history to OpenRouter and parses the structured response. If the model returns a board update, it is validated and persisted before being sent back to the frontend, which applies it immediately.

AI features require `OPENROUTER_API_KEY` to be set. If the AI service is unavailable the board remains unchanged and the sidebar shows an error message.

---

## API reference

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | `{username, password}` | Create account; returns `{token, username}` |
| `POST` | `/api/auth/login` | `{username, password}` | Sign in; returns `{token, username}` |
| `GET` | `/api/auth/me` | — | Returns current user info (requires auth) |

### Boards (all require `Authorization: Bearer <token>`)

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/api/boards` | — | List all boards for the current user |
| `POST` | `/api/boards` | `{name}` | Create a new empty board |
| `GET` | `/api/boards/{id}` | — | Get a board with its full data |
| `PUT` | `/api/boards/{id}` | `BoardData` | Save board data |
| `PATCH` | `/api/boards/{id}` | `{name}` | Rename a board |
| `DELETE` | `/api/boards/{id}` | — | Delete a board |
| `POST` | `/api/boards/{id}/ai-chat` | `{message, history}` | Send an AI message for this board |

---

## Running the tests

### Backend (42 tests)

```bash
cd backend
uv run pytest           # all tests
uv run pytest tests/test_auth_api.py        # auth tests only
uv run pytest tests/test_multi_board_api.py # board management tests only
uv run pytest -v        # verbose output
```

### Frontend (24 tests)

```bash
cd frontend
npm run test:unit        # Vitest unit tests (all)
npm run test:unit:watch  # watch mode
npm run test:e2e         # Playwright end-to-end tests
npm run test:all         # unit + e2e
```

### Test coverage areas

| Suite | What is tested |
|---|---|
| `test_auth_api.py` | Register, login, duplicate usernames, invalid credentials, token validation |
| `test_multi_board_api.py` | Board CRUD, auth enforcement, cross-user isolation, empty initial state |
| `test_board_api.py` | Legacy board endpoints, validation, 404 handling |
| `test_ai_api.py` | AI chat endpoint, board updates, error propagation |
| `test_ai_client.py` | OpenRouter request/response parsing |
| `page.test.tsx` | Login, register, logout, error states |
| `BoardDashboard.test.tsx` | Board list rendering, create form, delete on first click |
| `KanbanBoard.test.tsx` | Column rendering, rename, card add/delete |
| `AiSidebar.test.tsx` | Empty state, message submission |
| `api.test.ts` | Fetch and save board via legacy API client |
| `kanban.test.ts` | `moveCard` logic (same-column, cross-column, column drop) |
