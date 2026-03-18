import json
import os
import sqlite3
from pathlib import Path

from app.board_seed import DEFAULT_BOARD, EMPTY_BOARD
from app.schemas import BoardData

DB_PATH_ENV = "PM_DB_PATH"
DEFAULT_USERNAME = "user"

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "pm.db"

CREATE_USERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
"""

CREATE_BOARDS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Board',
  board_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
"""


def get_db_path() -> Path:
    db_path = os.getenv(DB_PATH_ENV)
    return Path(db_path) if db_path else DEFAULT_DB_PATH


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    resolved_path = db_path or get_db_path()
    connection = sqlite3.connect(resolved_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _migrate_schema(connection: sqlite3.Connection) -> None:
    """Apply schema migrations for databases created before this version."""
    user_cols = {row["name"] for row in connection.execute("PRAGMA table_info(users)")}
    if "password_hash" not in user_cols:
        connection.execute(
            "ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''"
        )

    board_cols = {row["name"] for row in connection.execute("PRAGMA table_info(boards)")}
    if "name" not in board_cols:
        # Recreate boards table: old schema had UNIQUE on user_id (one board per user).
        # New schema removes that constraint to allow multiple boards.
        connection.execute("ALTER TABLE boards RENAME TO boards_old")
        connection.execute(CREATE_BOARDS_TABLE_SQL)
        connection.execute(
            """
            INSERT INTO boards (id, user_id, name, board_json, updated_at)
            SELECT id, user_id, 'My Board', board_json, updated_at
            FROM boards_old
            """
        )
        connection.execute("DROP TABLE boards_old")


def initialize_database() -> None:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with connect(db_path) as connection:
        connection.execute(CREATE_USERS_TABLE_SQL)
        connection.execute(CREATE_BOARDS_TABLE_SQL)
        _migrate_schema(connection)

        user_row = connection.execute(
            "SELECT id FROM users WHERE username = ?",
            (DEFAULT_USERNAME,),
        ).fetchone()

        if user_row is None:
            from app.auth import hash_password

            default_hash = hash_password("password")
            cursor = connection.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (DEFAULT_USERNAME, default_hash),
            )
            user_row = connection.execute(
                "SELECT id FROM users WHERE username = ?",
                (DEFAULT_USERNAME,),
            ).fetchone()

        if user_row is None:
            raise RuntimeError("Unable to seed default user.")

        existing = connection.execute(
            "SELECT COUNT(*) as cnt FROM boards WHERE user_id = ?",
            (user_row["id"],),
        ).fetchone()
        if existing["cnt"] == 0:
            connection.execute(
                "INSERT INTO boards (user_id, name, board_json) VALUES (?, ?, ?)",
                (user_row["id"], "My Board", json.dumps(DEFAULT_BOARD)),
            )


def get_user_by_username(
    username: str, db_path: Path | None = None
) -> sqlite3.Row | None:
    with connect(db_path) as connection:
        return connection.execute(
            "SELECT id, username, password_hash, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()


def create_user(
    username: str, password_hash: str, db_path: Path | None = None
) -> int:
    """Create a new user with a default board. Returns the new user id."""
    with connect(db_path) as connection:
        cursor = connection.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash),
        )
        user_id = cursor.lastrowid
        connection.execute(
            "INSERT INTO boards (user_id, name, board_json) VALUES (?, ?, ?)",
            (user_id, "My Board", json.dumps(EMPTY_BOARD)),
        )
        return user_id


def list_user_boards(username: str, db_path: Path | None = None) -> list[dict]:
    with connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT b.id, b.name, b.updated_at
            FROM boards b
            JOIN users u ON u.id = b.user_id
            WHERE u.username = ?
            ORDER BY b.updated_at DESC
            """,
            (username,),
        ).fetchall()
    return [dict(row) for row in rows]


def create_board(
    username: str, name: str, db_path: Path | None = None
) -> dict:
    with connect(db_path) as connection:
        user_row = connection.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if user_row is None:
            raise ValueError(f"User {username!r} not found.")
        cursor = connection.execute(
            "INSERT INTO boards (user_id, name, board_json) VALUES (?, ?, ?)",
            (user_row["id"], name, json.dumps(EMPTY_BOARD)),
        )
        board_id = cursor.lastrowid
        row = connection.execute(
            "SELECT id, name, board_json, updated_at FROM boards WHERE id = ?",
            (board_id,),
        ).fetchone()
        return dict(row)


def get_board_for_user(
    board_id: int, username: str, db_path: Path | None = None
) -> dict | None:
    with connect(db_path) as connection:
        row = connection.execute(
            """
            SELECT b.id, b.name, b.board_json, b.updated_at
            FROM boards b
            JOIN users u ON u.id = b.user_id
            WHERE b.id = ? AND u.username = ?
            """,
            (board_id, username),
        ).fetchone()
    return dict(row) if row else None


def update_board_data(
    board_id: int, username: str, board: BoardData, db_path: Path | None = None
) -> dict | None:
    with connect(db_path) as connection:
        row = connection.execute(
            """
            UPDATE boards
            SET board_json = ?, updated_at = datetime('now')
            WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)
            RETURNING id, name, updated_at
            """,
            (board.model_dump_json(), board_id, username),
        ).fetchone()
        return dict(row) if row else None


def rename_board(
    board_id: int, username: str, name: str, db_path: Path | None = None
) -> dict | None:
    with connect(db_path) as connection:
        row = connection.execute(
            """
            UPDATE boards
            SET name = ?, updated_at = datetime('now')
            WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)
            RETURNING id, name, updated_at
            """,
            (name, board_id, username),
        ).fetchone()
        return dict(row) if row else None


def delete_board(
    board_id: int, username: str, db_path: Path | None = None
) -> bool:
    with connect(db_path) as connection:
        result = connection.execute(
            """
            DELETE FROM boards
            WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)
            """,
            (board_id, username),
        )
        return result.rowcount > 0


# ---------------------------------------------------------------------------
# Legacy helpers kept for backward-compatible endpoints
# ---------------------------------------------------------------------------

def get_user_board(username: str, db_path: Path | None = None) -> BoardData | None:
    boards = list_user_boards(username, db_path)
    if not boards:
        return None
    row = get_board_for_user(boards[0]["id"], username, db_path)
    if row is None:
        return None
    return BoardData.model_validate_json(row["board_json"])


def update_user_board(
    username: str, board: BoardData, db_path: Path | None = None
) -> dict | None:
    boards = list_user_boards(username, db_path)
    if not boards:
        return None
    return update_board_data(boards[0]["id"], username, board, db_path)
