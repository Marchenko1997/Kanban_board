# Code Review

Reviewed: 2026-03-14
Scope: Full repository — backend, frontend, tests, Docker config

---

## Summary

The codebase is clean, well-structured, and appropriate for an MVP. Separation of concerns is good throughout. The main issues fall into three areas: a couple of real correctness bugs in the backend, some frontend robustness gaps, and test coverage holes. Security findings are noted with context — several are intentional MVP trade-offs per `AGENTS.md`.

---

## High Priority

### 1. `assert` in production request handler
**File:** `backend/app/main.py:79`

```python
assert ai_result.board_update is not None
```

Python `assert` is stripped when the interpreter runs with `-O` (optimise flag). If this code path is reached with `board_update = None`, it would cause an `AttributeError` instead of a clean 500. Replace with an explicit guard:

```python
if ai_result.board_update is None:
    raise HTTPException(status_code=500, detail="AI returned a board update flag but no board.")
```

---

### 2. Raw OpenRouter response body exposed in error messages
**File:** `backend/app/ai_client.py:51-53`

```python
raise OpenRouterError(
    f"OpenRouter returned {response.status_code}: {response.text}"
)
```

`response.text` is included verbatim in the exception, which FastAPI then forwards to the HTTP client as a `502` detail string. OpenRouter error payloads can contain account-identifying information and model billing details. Limit this to status code and a sanitised summary:

```python
raise OpenRouterError(f"OpenRouter returned HTTP {response.status_code}.")
```

Keep the full `response.text` in a server-side log instead.

---

### 3. Non-atomic TOCTOU in `update_user_board`
**File:** `backend/app/db.py:94-112`

The function first checks that the user exists (SELECT), then updates the board (UPDATE) in two separate statements within the same connection. Under concurrent requests this is fine (SQLite serialises writes), but the two-step pattern means a user deletion between the SELECT and UPDATE would return `rowcount = 0` — which is handled correctly — but the intent is subtle. More importantly the function silently returns `False` when the board row doesn't exist but the user does (i.e. a board was never seeded). Consider merging into a single `UPDATE … WHERE user_id = (SELECT id FROM users WHERE username = ?)` to make the operation truly atomic and remove the ambiguity.

---

## Medium Priority

### 4. Every board change triggers an immediate backend save
**File:** `frontend/src/app/page.tsx:67-102`

The `persistBoard` effect fires on every `board` state change with no debouncing. Dragging a card triggers a series of rapid state updates, each of which queues a PUT request. The `isCanceled` flag prevents stale responses from clobbering state, but it does not prevent the requests from being sent. Add a debounce (300–500 ms) before dispatching the save.

---

### 5. `skipNextPersist` ref is fragile
**File:** `frontend/src/app/page.tsx:34, 60, 116, 137, 154`

`skipNextPersist` is set to `true` in multiple places (after load, after logout, after AI update, after login) to suppress a spurious save. The implicit contract between the load effect and the persist effect is hard to follow and easy to break when the code changes. Consider an explicit `"loaded"` / `"local"` discriminant on board state, or track the last-saved board separately and only persist when the value actually differs.

---

### 6. Board referential integrity not validated
**File:** `backend/app/schemas.py` / `backend/app/main.py:42-47`

Pydantic validates that `columns` is a list and `cards` is a dict, but it does not verify that every `cardId` in every column's `cardIds` array actually exists in `cards`, nor that every card in `cards` is referenced by exactly one column. An AI response or a buggy client could submit a board where columns reference non-existent cards, or cards are orphaned. Add a `model_validator` to `BoardData`:

```python
@model_validator(mode="after")
def check_referential_integrity(self) -> "BoardData":
    all_card_ids = set(self.cards.keys())
    referenced = {cid for col in self.columns for cid in col.card_ids}
    if referenced - all_card_ids:
        raise ValueError("Columns reference card IDs that do not exist.")
    return self
```

---

### 7. Weak ID generation for cards and columns
**File:** `frontend/src/lib/kanban.ts:164-168`

```typescript
const randomPart = Math.random().toString(36).slice(2, 8);
```

`Math.random()` is not cryptographically random. In a single-user local MVP the collision probability is negligible, but this will matter if the app is ever multi-tenant or the board grows large. Replace with `crypto.randomUUID()` (available in all modern browsers and Node 19+) or at minimum `crypto.getRandomValues()`.

---

### 8. Missing E2E test coverage for AI chat
**File:** `frontend/tests/kanban.spec.ts`

The Playwright suite covers auth, board load, card add, card drag, and logout — but not the AI sidebar. An E2E test that sends a chat message and verifies the assistant reply appears in the sidebar would cover the most complex integration path (frontend → backend → OpenRouter). Even with a mocked backend this would be valuable.

---

### 9. Error response color not using a CSS variable
**File:** `frontend/src/app/page.tsx:225`

```tsx
className="text-sm font-medium text-[#b33a3a]"
```

Every other colour in the app uses a CSS variable from `globals.css`. `#b33a3a` is hardcoded only here. Define `--error-red: #b33a3a` in `globals.css` and reference it as `text-[var(--error-red)]` for consistency.

---

## Low Priority

### 10. No CORS middleware
**File:** `backend/app/main.py`

Not an issue in the current Docker deployment (frontend and API share the same origin at `:8080`), but if the frontend is ever served from a different host (dev tunnels, CDN, etc.) requests will be blocked without CORS headers. Adding `CORSMiddleware` with a restrictive default costs nothing now and prevents a confusing outage later.

---

### 11. `Math.random()` in ID generation used in tests too
**File:** `frontend/src/lib/kanban.test.ts`

Tests call `createId()` directly. If `createId()` is changed to use `crypto.randomUUID()`, the jsdom test environment will need the Web Crypto API to be available (it is in jsdom 20+ and the project uses jsdom 27, so this is fine — just noting the dependency).

---

### 12. `FakeAiClient` in backend tests uses bare `list` annotation
**File:** `backend/tests/test_ai_api.py` (the fake client class)

The `history` parameter is typed as `list` rather than `list[ChatHistoryItem]`. This means type checkers won't catch if the wrong data is passed in tests, weakening their value as a contract check. Change to `list[ChatHistoryItem]`.

---

### 13. `str(exc)` forwarded directly to HTTP 502 detail
**File:** `backend/app/main.py:54, 75`

```python
raise HTTPException(status_code=502, detail=str(exc)) from exc
```

Once finding #2 is addressed (sanitising `OpenRouterError` messages), this pattern is safe. Left as a reminder that the 502 detail string is visible to API clients — keep `OpenRouterError` messages free of internal details.

---

## Design Notes (MVP trade-offs, not action items)

The following are intentional decisions per `AGENTS.md`. Listed for visibility only — no action required unless scope changes.

- **Hardcoded credentials / client-side auth:** By design (`user` / `password`). The database schema already supports multi-user; replacing the auth mechanism is the natural next step after MVP.
- **Single board per user:** Enforced by `UNIQUE` on `boards.user_id`. Works for MVP; relaxing it requires only a schema change.
- **No pagination:** The board is loaded and saved as a single JSON blob. Acceptable at current scale; would need rethinking for very large boards.
- **SQLite as sole persistence:** Appropriate for local Docker MVP. The `PM_DB_PATH` env var and abstract `db.py` layer make it straightforward to swap the storage backend later.

---

## Test Coverage Summary

| Area | Unit | E2E |
|------|------|-----|
| Auth flow | Yes | Yes |
| Board load / save | Yes | Yes |
| Card drag / drop | Partial | Yes |
| Column rename | Yes | No |
| Card add / remove | Yes | Yes |
| AI chat — happy path | Yes (mocked) | No |
| AI chat — error path | Yes (mocked) | No |
| DB init / seed | Yes | — |
| Board referential integrity | No | No |
| Network timeout / failure | No | No |

---

## Action Summary

| # | Severity | File | Action |
|---|----------|------|--------|
| 1 | High | `backend/app/main.py:79` | Replace `assert` with explicit guard |
| 2 | High | `backend/app/ai_client.py:51-53` | Strip `response.text` from error message |
| 3 | Medium | `backend/app/db.py:94-112` | Merge into single atomic UPDATE query |
| 4 | Medium | `frontend/src/app/page.tsx:79-97` | Debounce board saves |
| 5 | Medium | `frontend/src/app/page.tsx` | Simplify `skipNextPersist` pattern |
| 6 | Medium | `backend/app/schemas.py` | Add `BoardData` referential integrity validator |
| 7 | Medium | `frontend/src/lib/kanban.ts:164-168` | Replace `Math.random()` with `crypto.randomUUID()` |
| 8 | Medium | `frontend/tests/kanban.spec.ts` | Add E2E test for AI chat sidebar |
| 9 | Low | `frontend/src/app/page.tsx:225` | Move `#b33a3a` to CSS variable |
| 10 | Low | `backend/app/main.py` | Add `CORSMiddleware` |
| 11 | Low | `backend/tests/` | Fix `list` → `list[ChatHistoryItem]` in fake client |
| 12 | Low | `backend/app/main.py:54,75` | Keep 502 detail strings free of internal info (dependent on #2) |
