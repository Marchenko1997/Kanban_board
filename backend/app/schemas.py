from typing import Literal

from pydantic import BaseModel, Field


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class AiChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[ChatHistoryItem] = Field(default_factory=list)


class StructuredAiOutput(BaseModel):
    assistant_message: str = Field(min_length=1)
    board_update: BoardData | None = None


class AiChatResponse(BaseModel):
    assistant_message: str
    board_updated: bool
    board: BoardData


class AiPingResponse(BaseModel):
    reply: str
