# Database Schema Proposal (Part 5)

## Goals

- Use SQLite locally.
- Support multiple users at schema level.
- Keep one board per user for MVP.
- Persist full Kanban board as JSON for simplicity.

## Proposed Tables

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  board_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Notes

- `users.username` is unique so each user is addressable.
- `boards.user_id` is `UNIQUE`, enforcing one board per user in MVP.
- `board_json` stores the full board payload as JSON text.
- `updated_at` is bumped on write in backend update route logic.

## Board JSON Shape

`boards.board_json` stores a payload matching frontend `BoardData`:

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"] }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Example card",
      "details": "Example details"
    }
  }
}
```

## Initialization Strategy

- On backend startup (or first DB access):
  - Create DB file if missing.
  - Run `CREATE TABLE IF NOT EXISTS` statements.
  - Ensure demo user row exists for username `user`.
  - Ensure that user has one board row; if not, insert default board JSON.

This keeps startup idempotent and simple.

## Why This Design

- Minimal schema for MVP while remaining multi-user ready.
- JSON storage avoids premature normalization and keeps frontend/backend shape aligned.
- One-to-one (`users` -> `boards`) prevents accidental multiple boards per user.

