from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client_with_db(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[TestClient, Path]:
    db_path = tmp_path / "pm-test.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client, db_path


def test_database_is_created_and_seeded(
    client_with_db: tuple[TestClient, Path],
) -> None:
    client, db_path = client_with_db
    response = client.get("/api/users/user/board")
    assert response.status_code == 200
    assert db_path.exists()

    payload = response.json()
    assert payload["columns"]
    assert payload["cards"]


def test_put_board_persists_state(client_with_db: tuple[TestClient, Path]) -> None:
    client, _ = client_with_db
    current_board = client.get("/api/users/user/board").json()
    current_board["columns"][0]["title"] = "Updated Backlog"

    put_response = client.put("/api/users/user/board", json=current_board)
    assert put_response.status_code == 200

    get_response = client.get("/api/users/user/board")
    assert get_response.status_code == 200
    assert get_response.json()["columns"][0]["title"] == "Updated Backlog"


def test_get_unknown_user_returns_404(client_with_db: tuple[TestClient, Path]) -> None:
    client, _ = client_with_db
    response = client.get("/api/users/missing-user/board")
    assert response.status_code == 404


def test_put_unknown_user_returns_404(client_with_db: tuple[TestClient, Path]) -> None:
    client, _ = client_with_db
    payload = client.get("/api/users/user/board").json()
    response = client.put("/api/users/missing-user/board", json=payload)
    assert response.status_code == 404


def test_invalid_payload_returns_422(client_with_db: tuple[TestClient, Path]) -> None:
    client, _ = client_with_db
    payload = {"columns": "invalid", "cards": {}}
    response = client.put("/api/users/user/board", json=payload)
    assert response.status_code == 422
