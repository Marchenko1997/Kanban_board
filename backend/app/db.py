import json
import os
import sqlite3
from pathlib import Path

from app.board_seed import DEFAULT_BOARD
from app.schemas import BoardData

DB_PATH_ENV = "PM_DB_PATH"
DEFAULT_USERNAME = "user"

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "pm.db"

CREATE_USERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
"""

CREATE_BOARDS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
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


def initialize_database() -> None:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with connect(db_path) as connection:
        connection.execute(CREATE_USERS_TABLE_SQL)
        connection.execute(CREATE_BOARDS_TABLE_SQL)
        connection.execute(
            "INSERT INTO users (username) VALUES (?) ON CONFLICT(username) DO NOTHING",
            (DEFAULT_USERNAME,),
        )

        user_row = connection.execute(
            "SELECT id FROM users WHERE username = ?",
            (DEFAULT_USERNAME,),
        ).fetchone()
        if user_row is None:
            raise RuntimeError("Unable to seed default user.")

        connection.execute(
            """
            INSERT INTO boards (user_id, board_json)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO NOTHING
            """,
            (user_row["id"], json.dumps(DEFAULT_BOARD)),
        )


def get_user_board(username: str) -> BoardData | None:
    with connect() as connection:
        row = connection.execute(
            """
            SELECT b.board_json
            FROM boards b
            JOIN users u ON u.id = b.user_id
            WHERE u.username = ?
            """,
            (username,),
        ).fetchone()

    if row is None:
        return None

    return BoardData.model_validate_json(row["board_json"])


def update_user_board(username: str, board: BoardData) -> bool:
    with connect() as connection:
        row = connection.execute(
            "SELECT id FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row is None:
            return False

        updated = connection.execute(
            """
            UPDATE boards
            SET board_json = ?, updated_at = datetime('now')
            WHERE user_id = ?
            """,
            (board.model_dump_json(), row["id"]),
        )

        return updated.rowcount > 0

