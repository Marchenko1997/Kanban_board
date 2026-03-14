import json
from typing import Any

from app.ai_client import OpenRouterClient
from app.board_seed import DEFAULT_BOARD
from app.schemas import BoardData, ChatHistoryItem


def test_ping_builds_request_and_parses_response() -> None:
    captured_payload: dict[str, Any] = {}
    client = OpenRouterClient(api_key="test-key")

    def fake_post(payload: dict[str, Any]) -> dict[str, Any]:
        captured_payload.update(payload)
        return {"choices": [{"message": {"content": "4"}}]}

    client._post_chat_completion = fake_post  # type: ignore[method-assign]

    reply = client.ping()

    assert reply == "4"
    assert captured_payload["model"] == "openai/gpt-oss-120b"
    assert captured_payload["messages"][0]["content"].startswith("What is 2+2")


def test_structured_response_parses_and_validates() -> None:
    captured_payload: dict[str, Any] = {}
    client = OpenRouterClient(api_key="test-key")

    structured_json = {
        "assistant_message": "Moved card-1 to Review.",
        "board_update": DEFAULT_BOARD,
    }

    def fake_post(payload: dict[str, Any]) -> dict[str, Any]:
        captured_payload.update(payload)
        return {"choices": [{"message": {"content": json.dumps(structured_json)}}]}

    client._post_chat_completion = fake_post  # type: ignore[method-assign]

    board = BoardData.model_validate(DEFAULT_BOARD)
    result = client.generate_structured_board_response(
        board=board,
        message="Move card-1 to Review",
        history=[ChatHistoryItem(role="user", content="Move that card")],
    )

    assert result.assistant_message == "Moved card-1 to Review."
    assert result.board_update is not None
    assert result.board_update.columns[0].id == "col-backlog"
    assert captured_payload["response_format"]["type"] == "json_schema"
    assert captured_payload["messages"][0]["role"] == "system"
