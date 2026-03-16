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

    def missing_card_references(self) -> set[str]:
        """Return any cardIds in columns that have no matching entry in cards."""
        referenced = {cid for col in self.columns for cid in col.cardIds}
        return referenced - self.cards.keys()


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


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    username: str
    created_at: str


class TokenResponse(BaseModel):
    token: str
    username: str


# ---------------------------------------------------------------------------
# Board management schemas
# ---------------------------------------------------------------------------

class BoardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class BoardRename(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class BoardMeta(BaseModel):
    id: int
    name: str
    updated_at: str


class BoardFull(BaseModel):
    id: int
    name: str
    board: BoardData
    updated_at: str
