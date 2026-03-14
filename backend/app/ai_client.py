import json
import os
from typing import Any

import httpx

from app.schemas import BoardData, ChatHistoryItem, StructuredAiOutput

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-120b"


class OpenRouterError(RuntimeError):
    pass


class OpenRouterClient:
    def __init__(
        self,
        api_key: str | None = None,
        model: str = DEFAULT_MODEL,
        api_url: str = OPENROUTER_API_URL,
    ) -> None:
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.model = model
        self.api_url = api_url

    def _require_api_key(self) -> str:
        if not self.api_key:
            raise OpenRouterError("OPENROUTER_API_KEY is not configured.")
        return self.api_key

    def _post_chat_completion(self, payload: dict[str, Any]) -> dict[str, Any]:
        api_key = self._require_api_key()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=45.0) as client:
                response = client.post(
                    self.api_url,
                    headers=headers,
                    json=payload,
                )
        except httpx.HTTPError as exc:
            raise OpenRouterError(f"OpenRouter request failed: {exc}") from exc

        if response.status_code >= 400:
            raise OpenRouterError(
                f"OpenRouter returned {response.status_code}: {response.text}"
            )

        return response.json()

    @staticmethod
    def _extract_text_content(response_payload: dict[str, Any]) -> str:
        try:
            content = response_payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise OpenRouterError("Unexpected OpenRouter response format.") from exc

        if isinstance(content, str):
            return content

        if isinstance(content, list):
            text_chunks = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    text = item.get("text")
                    if isinstance(text, str):
                        text_chunks.append(text)
            if text_chunks:
                return "".join(text_chunks)

        raise OpenRouterError("OpenRouter response content did not include text.")

    @staticmethod
    def _strip_markdown_fence(text: str) -> str:
        stripped = text.strip()
        if stripped.startswith("```json"):
            stripped = stripped[len("```json") :].strip()
        elif stripped.startswith("```"):
            stripped = stripped[len("```") :].strip()

        if stripped.endswith("```"):
            stripped = stripped[:-3].strip()

        return stripped

    def ping(self) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": "What is 2+2? Reply with only the number.",
                }
            ],
            "temperature": 0,
        }
        response_payload = self._post_chat_completion(payload)
        return self._extract_text_content(response_payload).strip()

    def generate_structured_board_response(
        self,
        board: BoardData,
        message: str,
        history: list[ChatHistoryItem],
    ) -> StructuredAiOutput:
        history_lines = [
            f"{item.role}: {item.content.replace(chr(10), ' ').strip()}" for item in history
        ]

        prompt = (
            "You are assisting with a kanban board.\n"
            "Return valid JSON only.\n"
            "If the board should not change, set board_update to null.\n"
            "Board JSON:\n"
            f"{board.model_dump_json(indent=2)}\n\n"
            "Conversation history:\n"
            f"{json.dumps(history_lines, indent=2)}\n\n"
            f"User message:\n{message}"
        )

        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "kanban_assistant_response",
                "strict": True,
                "schema": StructuredAiOutput.model_json_schema(),
            },
        }

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Respond using the provided JSON schema. "
                        "Do not include markdown."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "response_format": response_format,
            "temperature": 0.2,
        }

        response_payload = self._post_chat_completion(payload)
        raw_content = self._extract_text_content(response_payload)
        cleaned_content = self._strip_markdown_fence(raw_content)

        try:
            structured_data = json.loads(cleaned_content)
        except json.JSONDecodeError as exc:
            raise OpenRouterError("AI response was not valid JSON.") from exc

        try:
            return StructuredAiOutput.model_validate(structured_data)
        except Exception as exc:
            raise OpenRouterError("AI response did not match schema.") from exc

