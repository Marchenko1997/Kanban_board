# Project Plan

This plan executes Parts 1-10 in order, keeps scope MVP-small, and uses existing frontend test conventions where present.

## Part 1: Plan

### Checklist
- [x] Review root constraints in `AGENTS.md` and current frontend code.
- [x] Expand this file with concrete implementation checklists, test plans, and success criteria per part.
- [x] Create `frontend/AGENTS.md` documenting existing frontend architecture and conventions.

### Tests
- [x] Manual review that all 10 parts contain implementation steps, tests, and success criteria.

### Success criteria
- [x] `docs/PLAN.md` is actionable and detailed.
- [x] `frontend/AGENTS.md` exists and reflects current code.

## Part 2: Scaffolding

### Checklist
- [x] Create backend app scaffold in `backend/` using FastAPI.
- [x] Add dependency management with `uv` for backend packages.
- [x] Add Dockerfile and supporting config to run backend + static content locally.
- [x] Add startup and shutdown scripts in `scripts/` for Windows, macOS, and Linux.
- [x] Serve a minimal static "hello world" page from `/`.
- [x] Add one minimal API endpoint (for example `/api/health`) returning JSON.

### Tests
- [x] Build container image successfully.
- [x] Start app via scripts and verify `/` returns static page.
- [x] Verify API endpoint returns expected HTTP status and JSON payload.

### Success criteria
- [x] Project runs locally via Docker with one command path.
- [x] Backend and static serving both work in container.
- [x] Scripts in `scripts/` can start and stop the app on each OS.

## Part 3: Add Frontend

### Checklist
- [x] Wire Docker/backend serving so built Next.js static output is served at `/`.
- [x] Keep current Kanban demo behavior and design intact.
- [x] Ensure backend still serves API routes alongside static frontend.
- [x] Update docs with exact build/run commands used in this architecture.

### Tests
- [x] Frontend unit tests pass with existing stack (`vitest` + Testing Library).
- [x] Frontend e2e tests pass with existing stack (`playwright`).
- [x] Manual check that `/` renders Kanban board from built static output.

### Success criteria
- [x] Demo Kanban is visible at `/` through backend/Docker path.
- [x] No frontend regressions vs current demo behavior.
- [x] CI/local test commands for frontend remain simple.

## Part 4: Fake User Sign In

### Checklist
- [x] Add login screen shown before board access.
- [x] Validate hardcoded credentials only: username `user`, password `password`.
- [x] Add logout action to clear authenticated state.
- [x] Prevent unauthenticated access to Kanban UI.
- [x] Keep UX simple and local-only for MVP.

### Tests
- [x] Unit tests for auth state handling (login success/failure, logout).
- [x] E2E test: unauthenticated user sees login, valid login reaches board, logout returns to login.
- [x] E2E test: invalid credentials show clear error and keep user unauthenticated.

### Success criteria
- [x] Only authenticated users can see board UI.
- [x] Login/logout flow is stable and deterministic.
- [x] Existing Kanban interactions still work after login.

## Part 5: Database Modeling

### Checklist
- [x] Propose SQLite schema supporting multiple users and one board per user for MVP.
- [x] Represent board state as JSON payload tied to user record.
- [x] Define migration/initialization strategy when DB file does not exist.
- [x] Document schema and rationale in `docs/`.
- [x] Confirm schema direction with user before route implementation.

### Tests
- [x] Add backend tests for schema initialization and basic CRUD serialization roundtrip.
- [x] Validate DB file is auto-created on first run.

### Success criteria
- [x] Schema is minimal, clear, and matches MVP constraints.
- [x] Documentation explains tables, keys, and JSON shape.
- [x] User confirms schema before full backend API work.

## Part 6: Backend API

### Checklist
- [x] Implement API routes to fetch and update the authenticated user's board.
- [x] Ensure DB initialization occurs automatically if DB file is missing.
- [x] Add request/response models with simple validation.
- [x] Add error handling for missing user/board and invalid payloads.

### Tests
- [x] Backend unit/integration tests using `pytest` (if no backend stack exists yet).
- [x] API tests for successful read/update flows.
- [x] API tests for invalid payloads and expected error responses.

### Success criteria
- [x] Backend can persist and return board state by user.
- [x] Tests verify normal and failure paths.
- [x] API contract is stable enough for frontend integration.

## Part 7: Frontend + Backend Integration

### Checklist
- [x] Replace frontend in-memory board source with backend API calls.
- [x] Load board on app start after authentication.
- [x] Persist card/column edits and moves through backend updates.
- [x] Handle loading and save error states with clear UI feedback.

### Tests
- [x] Frontend unit tests for API client and state transitions.
- [x] Integration/e2e tests for persistence across reloads.
- [x] Backend API tests still pass after integration changes.

### Success criteria
- [x] Board changes persist across refresh and restart (with same DB file).
- [x] Drag/drop, rename, add, and delete remain functional.
- [x] No regression in auth or navigation flow.

## Part 8: AI Connectivity

### Checklist
- [x] Add backend service wrapper for OpenRouter calls.
- [x] Read `OPENROUTER_API_KEY` from root `.env` through backend config.
- [x] Use model `openai/gpt-oss-120b`.
- [x] Add minimal connectivity endpoint or internal test call for `"2+2"`.

### Tests
- [x] Backend test for request construction and response parsing (mocked).
- [x] Optional live connectivity check (when API key is present) confirming valid response.

### Success criteria
- [x] Backend can successfully call OpenRouter with configured model.
- [x] Errors are surfaced cleanly when key/config is missing.
- [x] Connectivity is proven by test and/or controlled live check.

## Part 9: Structured AI Board Updates

### Checklist
- [x] Define structured response schema containing `assistant_message` and optional board update payload.
- [x] Send board JSON, user message, and conversation history to AI each turn.
- [x] Validate AI output against schema before applying updates.
- [x] Apply valid board updates atomically and persist them.

### Tests
- [x] Unit tests for schema validation and rejection of malformed AI output.
- [x] Backend integration tests for message-only responses.
- [x] Backend integration tests for message + board update responses.

### Success criteria
- [x] AI responses are deterministic at API contract level.
- [x] Invalid structured output never corrupts board state.
- [x] Valid AI updates are persisted and returned consistently.

## Part 10: AI Chat Sidebar UI

### Checklist
- [x] Add sidebar chat UI to the Kanban page.
- [x] Implement chat history rendering and user input flow.
- [x] Call backend AI endpoint and render assistant responses.
- [x] When AI returns board updates, refresh board state automatically.
- [x] Ensure responsive layout works on desktop and mobile widths.

### Tests
- [x] Frontend unit tests for chat state and rendering.
- [x] E2E test: send chat message and receive assistant reply.
- [x] E2E test: AI-triggered board update appears in board UI without manual reload.

### Success criteria
- [x] Chat is usable and integrated without breaking Kanban workflows.
- [x] AI updates reflect in UI in near real-time after response.
- [x] End-to-end MVP goals from root requirements are satisfied.
