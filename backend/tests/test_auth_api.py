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


def test_register_new_user(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"username": "alice", "password": "securepass"},
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["username"] == "alice"
    assert "token" in payload
    assert len(payload["token"]) > 20


def test_register_duplicate_username_returns_409(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "bob", "password": "pass1234"})
    response = client.post(
        "/api/auth/register",
        json={"username": "bob", "password": "different1"},
    )
    assert response.status_code == 409
    assert "already taken" in response.json()["detail"]


def test_register_short_username_returns_422(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register", json={"username": "ab", "password": "pass1234"}
    )
    assert response.status_code == 422


def test_register_short_password_returns_422(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register", json={"username": "carol", "password": "short"}
    )
    assert response.status_code == 422


def test_register_invalid_username_chars_returns_422(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"username": "bad user!", "password": "pass1234"},
    )
    assert response.status_code == 422


def test_login_seeded_user(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["username"] == "user"
    assert "token" in payload


def test_login_wrong_password_returns_401(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"username": "user", "password": "wrongpass"}
    )
    assert response.status_code == 401


def test_login_unknown_user_returns_401(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"username": "nobody", "password": "pass1234"}
    )
    assert response.status_code == 401


def test_me_with_valid_token(client: TestClient) -> None:
    login = client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )
    token = login.json()["token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["username"] == "user"


def test_me_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_with_invalid_token_returns_401(client: TestClient) -> None:
    response = client.get(
        "/api/auth/me", headers={"Authorization": "Bearer not.a.valid.token"}
    )
    assert response.status_code == 401


def test_registered_user_can_login(client: TestClient) -> None:
    client.post(
        "/api/auth/register", json={"username": "dave", "password": "mypassword1"}
    )
    response = client.post(
        "/api/auth/login", json={"username": "dave", "password": "mypassword1"}
    )
    assert response.status_code == 200
    assert response.json()["username"] == "dave"
