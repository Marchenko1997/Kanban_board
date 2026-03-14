from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.ai_client import OpenRouterError
from app.main import create_app, get_ai_client
from app.schemas import BoardData, ChatHistoryItem, StructuredAiOutput


class FakeAiClient:
    def __init__(
        self,
        ping_reply: str = "4",
        structured_result: StructuredAiOutput | None = None,
        error: OpenRouterError | None = None,
    ) -> None:
        self.ping_reply = ping_reply
        self.structured_result = structured_result
        self.error = error

    def ping(self) -> str:
        if self.error:
            raise self.error
        return self.ping_reply

    def generate_structured_board_response(
        self,
        board: BoardData,
        message: str,
        history: list[ChatHistoryItem],
    ) -> StructuredAiOutput:
        if self.error:
            raise self.error
        if self.structured_result:
            return self.structured_result
        return StructuredAiOutput(
            assistant_message=f"Echo: {message}",
            board_update=None,
        )


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "pm-test.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))
    app = create_app()
    app.dependency_overrides[get_ai_client] = lambda: FakeAiClient()
    with TestClient(app) as test_client:
        yield test_client


def test_ai_ping_returns_reply(client: TestClient) -> None:
    response = client.post("/api/ai/ping")
    assert response.status_code == 200
    assert response.json()["reply"] == "4"


def test_ai_ping_surfaces_backend_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "pm-test.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))
    app = create_app()
    app.dependency_overrides[get_ai_client] = lambda: FakeAiClient(
        error=OpenRouterError("Connectivity failed.")
    )
    with TestClient(app) as client:
        response = client.post("/api/ai/ping")
    assert response.status_code == 502
    assert "Connectivity failed." in response.json()["detail"]


def test_ai_chat_message_only_keeps_board_unchanged(client: TestClient) -> None:
    before = client.get("/api/users/user/board").json()

    response = client.post(
        "/api/users/user/ai-chat",
        json={"message": "Summarize this board", "history": []},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["assistant_message"].startswith("Echo:")
    assert payload["board_updated"] is False
    assert payload["board"] == before


def test_ai_chat_board_update_is_persisted(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "pm-test.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))
    app = create_app()
    with TestClient(app) as client:
        current_board = client.get("/api/users/user/board").json()
        current_board["columns"][0]["title"] = "AI Updated"
        structured_update = StructuredAiOutput(
            assistant_message="Updated backlog title.",
            board_update=BoardData.model_validate(current_board),
        )
        app.dependency_overrides[get_ai_client] = lambda: FakeAiClient(
            structured_result=structured_update
        )

        response = client.post(
            "/api/users/user/ai-chat",
            json={
                "message": "Rename backlog to AI Updated",
                "history": [{"role": "user", "content": "Please rename"}],
            },
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["board_updated"] is True
        assert payload["board"]["columns"][0]["title"] == "AI Updated"

        persisted = client.get("/api/users/user/board").json()
        assert persisted["columns"][0]["title"] == "AI Updated"


def test_ai_chat_returns_502_on_ai_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "pm-test.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))
    app = create_app()
    app.dependency_overrides[get_ai_client] = lambda: FakeAiClient(
        error=OpenRouterError("Invalid AI response.")
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/users/user/ai-chat",
            json={"message": "Help", "history": []},
        )

    assert response.status_code == 502
    assert "Invalid AI response." in response.json()["detail"]

