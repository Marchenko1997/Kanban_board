"""Tests for the authenticated multi-board endpoints."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "pm-test.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def _login(client: TestClient, username: str = "user", password: str = "password") -> str:
    """Return a Bearer token for the given credentials."""
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# List boards
# ---------------------------------------------------------------------------

def test_list_boards_returns_seeded_board(client: TestClient) -> None:
    token = _login(client)
    response = client.get("/api/boards", headers=_auth(token))
    assert response.status_code == 200
    boards = response.json()
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"
    assert "id" in boards[0]
    assert "updated_at" in boards[0]


def test_list_boards_requires_auth(client: TestClient) -> None:
    response = client.get("/api/boards")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Create board
# ---------------------------------------------------------------------------

def test_create_board(client: TestClient) -> None:
    token = _login(client)
    response = client.post(
        "/api/boards", headers=_auth(token), json={"name": "Sprint 1"}
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["name"] == "Sprint 1"
    assert "id" in payload
    assert isinstance(payload["board"]["columns"], list)


def test_new_board_starts_empty(client: TestClient) -> None:
    token = _login(client)
    response = client.post(
        "/api/boards", headers=_auth(token), json={"name": "Empty Project"}
    )
    assert response.status_code == 201
    payload = response.json()
    board_id = payload["id"]
    board = payload["board"]

    assert board["cards"] == {}, "New board should have no cards"
    assert len(board["columns"]) == 5, "New board should have exactly five columns"
    for column in board["columns"]:
        assert column["cardIds"] == [], f"Column {column['title']!r} should have no cards"

    column_titles = [col["title"] for col in board["columns"]]
    assert column_titles == ["Backlog", "Discovery", "In Progress", "Review", "Done"]

    # Verify the data is stored under this board's ID, not copied from another board
    get_resp = client.get(f"/api/boards/{board_id}", headers=_auth(token))
    assert get_resp.status_code == 200
    fetched = get_resp.json()["board"]
    assert fetched["cards"] == {}
    assert [col["title"] for col in fetched["columns"]] == [
        "Backlog", "Discovery", "In Progress", "Review", "Done"
    ]


def test_create_board_empty_name_returns_422(client: TestClient) -> None:
    token = _login(client)
    response = client.post("/api/boards", headers=_auth(token), json={"name": ""})
    assert response.status_code == 422


def test_create_multiple_boards(client: TestClient) -> None:
    token = _login(client)
    client.post("/api/boards", headers=_auth(token), json={"name": "Board A"})
    client.post("/api/boards", headers=_auth(token), json={"name": "Board B"})
    boards = client.get("/api/boards", headers=_auth(token)).json()
    names = {b["name"] for b in boards}
    assert "Board A" in names
    assert "Board B" in names
    assert len(boards) == 3  # seeded + 2 new


# ---------------------------------------------------------------------------
# Get board
# ---------------------------------------------------------------------------

def test_get_board_by_id(client: TestClient) -> None:
    token = _login(client)
    boards = client.get("/api/boards", headers=_auth(token)).json()
    board_id = boards[0]["id"]

    response = client.get(f"/api/boards/{board_id}", headers=_auth(token))
    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == board_id
    assert payload["board"]["columns"]


def test_get_board_not_found(client: TestClient) -> None:
    token = _login(client)
    response = client.get("/api/boards/99999", headers=_auth(token))
    assert response.status_code == 404


def test_get_board_other_user_returns_404(client: TestClient) -> None:
    # Register a second user and try to access user's board
    client.post(
        "/api/auth/register", json={"username": "eve", "password": "password1"}
    )
    token_eve = _login(client, "eve", "password1")
    token_user = _login(client)

    # Get user's board id
    boards = client.get("/api/boards", headers=_auth(token_user)).json()
    user_board_id = boards[0]["id"]

    # eve should not see user's board
    response = client.get(f"/api/boards/{user_board_id}", headers=_auth(token_eve))
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Save board
# ---------------------------------------------------------------------------

def test_save_board_persists_data(client: TestClient) -> None:
    token = _login(client)
    boards = client.get("/api/boards", headers=_auth(token)).json()
    board_id = boards[0]["id"]

    board = client.get(f"/api/boards/{board_id}", headers=_auth(token)).json()["board"]
    board["columns"][0]["title"] = "Revised Backlog"

    save_resp = client.put(
        f"/api/boards/{board_id}", headers=_auth(token), json=board
    )
    assert save_resp.status_code == 200
    assert save_resp.json()["board"]["columns"][0]["title"] == "Revised Backlog"

    get_resp = client.get(f"/api/boards/{board_id}", headers=_auth(token))
    assert get_resp.json()["board"]["columns"][0]["title"] == "Revised Backlog"


def test_save_board_orphaned_card_returns_422(client: TestClient) -> None:
    token = _login(client)
    boards = client.get("/api/boards", headers=_auth(token)).json()
    board_id = boards[0]["id"]

    bad_board = {
        "columns": [{"id": "col-1", "title": "X", "cardIds": ["ghost-card"]}],
        "cards": {},
    }
    response = client.put(
        f"/api/boards/{board_id}", headers=_auth(token), json=bad_board
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Rename board
# ---------------------------------------------------------------------------

def test_rename_board(client: TestClient) -> None:
    token = _login(client)
    boards = client.get("/api/boards", headers=_auth(token)).json()
    board_id = boards[0]["id"]

    response = client.patch(
        f"/api/boards/{board_id}", headers=_auth(token), json={"name": "Renamed Board"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed Board"

    get_resp = client.get(f"/api/boards/{board_id}", headers=_auth(token))
    assert get_resp.json()["name"] == "Renamed Board"


def test_rename_board_not_found(client: TestClient) -> None:
    token = _login(client)
    response = client.patch(
        "/api/boards/99999", headers=_auth(token), json={"name": "Ghost"}
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Delete board
# ---------------------------------------------------------------------------

def test_delete_board(client: TestClient) -> None:
    token = _login(client)
    create_resp = client.post(
        "/api/boards", headers=_auth(token), json={"name": "Temp Board"}
    )
    board_id = create_resp.json()["id"]

    delete_resp = client.delete(f"/api/boards/{board_id}", headers=_auth(token))
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/api/boards/{board_id}", headers=_auth(token))
    assert get_resp.status_code == 404


def test_delete_board_not_found(client: TestClient) -> None:
    token = _login(client)
    response = client.delete("/api/boards/99999", headers=_auth(token))
    assert response.status_code == 404


def test_delete_board_other_user_returns_404(client: TestClient) -> None:
    client.post(
        "/api/auth/register", json={"username": "mallory", "password": "password1"}
    )
    token_mallory = _login(client, "mallory", "password1")
    token_user = _login(client)

    boards = client.get("/api/boards", headers=_auth(token_user)).json()
    user_board_id = boards[0]["id"]

    # mallory cannot delete user's board
    response = client.delete(f"/api/boards/{user_board_id}", headers=_auth(token_mallory))
    assert response.status_code == 404

    # Board still exists for its owner
    check = client.get(f"/api/boards/{user_board_id}", headers=_auth(token_user))
    assert check.status_code == 200


# ---------------------------------------------------------------------------
# Board isolation between users
# ---------------------------------------------------------------------------

def test_each_new_user_gets_default_board(client: TestClient) -> None:
    client.post(
        "/api/auth/register", json={"username": "frank", "password": "password1"}
    )
    token = _login(client, "frank", "password1")
    boards = client.get("/api/boards", headers=_auth(token)).json()
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"
