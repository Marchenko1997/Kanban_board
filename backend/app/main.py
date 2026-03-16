from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles

from app.ai_client import OpenRouterClient, OpenRouterError
from app.auth import create_token, decode_token, hash_password, verify_password
from app.db import (
    create_board,
    create_user,
    delete_board,
    get_board_for_user,
    get_user_board,
    get_user_by_username,
    initialize_database,
    list_user_boards,
    rename_board,
    update_board_data,
    update_user_board,
)
from app.schemas import (
    AiChatRequest,
    AiChatResponse,
    AiPingResponse,
    BoardCreate,
    BoardData,
    BoardFull,
    BoardMeta,
    BoardRename,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

_bearer = HTTPBearer(auto_error=False)


def get_ai_client() -> OpenRouterClient:
    return OpenRouterClient()


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    username = decode_token(credentials.credentials)
    if username is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return username


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialize_database()
        yield

    app = FastAPI(
        title="Project Management",
        version="2.0.0",
        lifespan=lifespan,
    )

    # -----------------------------------------------------------------------
    # Health
    # -----------------------------------------------------------------------

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "pm-backend"}

    # -----------------------------------------------------------------------
    # Auth
    # -----------------------------------------------------------------------

    @app.post("/api/auth/register", response_model=TokenResponse, status_code=201)
    def register(body: UserCreate) -> TokenResponse:
        if get_user_by_username(body.username) is not None:
            raise HTTPException(status_code=409, detail="Username already taken.")
        password_hash = hash_password(body.password)
        create_user(body.username, password_hash)
        return TokenResponse(token=create_token(body.username), username=body.username)

    @app.post("/api/auth/login", response_model=TokenResponse)
    def login(body: UserLogin) -> TokenResponse:
        user = get_user_by_username(body.username)
        if user is None or not verify_password(body.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password.")
        return TokenResponse(token=create_token(body.username), username=body.username)

    @app.get("/api/auth/me", response_model=UserResponse)
    def me(current_user: str = Depends(get_current_user)) -> UserResponse:
        user = get_user_by_username(current_user)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found.")
        return UserResponse(username=user["username"], created_at=user["created_at"])

    # -----------------------------------------------------------------------
    # Board management (authenticated)
    # -----------------------------------------------------------------------

    @app.get("/api/boards", response_model=list[BoardMeta])
    def list_boards(
        current_user: str = Depends(get_current_user),
    ) -> list[BoardMeta]:
        return [BoardMeta(**b) for b in list_user_boards(current_user)]

    @app.post("/api/boards", response_model=BoardFull, status_code=201)
    def create_new_board(
        body: BoardCreate,
        current_user: str = Depends(get_current_user),
    ) -> BoardFull:
        row = create_board(current_user, body.name)
        return BoardFull(
            id=row["id"],
            name=row["name"],
            board=BoardData.model_validate_json(row["board_json"]),
            updated_at=row["updated_at"],
        )

    @app.get("/api/boards/{board_id}", response_model=BoardFull)
    def get_board(
        board_id: int,
        current_user: str = Depends(get_current_user),
    ) -> BoardFull:
        row = get_board_for_user(board_id, current_user)
        if row is None:
            raise HTTPException(status_code=404, detail="Board not found.")
        return BoardFull(
            id=row["id"],
            name=row["name"],
            board=BoardData.model_validate_json(row["board_json"]),
            updated_at=row["updated_at"],
        )

    @app.put("/api/boards/{board_id}", response_model=BoardFull)
    def save_board(
        board_id: int,
        board: BoardData,
        current_user: str = Depends(get_current_user),
    ) -> BoardFull:
        missing = board.missing_card_references()
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Columns reference card IDs not in cards: {sorted(missing)}",
            )
        updated = update_board_data(board_id, current_user, board)
        if not updated:
            raise HTTPException(status_code=404, detail="Board not found.")
        row = get_board_for_user(board_id, current_user)
        return BoardFull(
            id=row["id"],
            name=row["name"],
            board=board,
            updated_at=row["updated_at"],
        )

    @app.patch("/api/boards/{board_id}", response_model=BoardMeta)
    def update_board_name(
        board_id: int,
        body: BoardRename,
        current_user: str = Depends(get_current_user),
    ) -> BoardMeta:
        updated = rename_board(board_id, current_user, body.name)
        if not updated:
            raise HTTPException(status_code=404, detail="Board not found.")
        row = get_board_for_user(board_id, current_user)
        return BoardMeta(id=row["id"], name=row["name"], updated_at=row["updated_at"])

    @app.delete("/api/boards/{board_id}", status_code=204)
    def remove_board(
        board_id: int,
        current_user: str = Depends(get_current_user),
    ) -> None:
        if not delete_board(board_id, current_user):
            raise HTTPException(status_code=404, detail="Board not found.")

    @app.post("/api/boards/{board_id}/ai-chat", response_model=AiChatResponse)
    def board_ai_chat(
        board_id: int,
        request: AiChatRequest,
        current_user: str = Depends(get_current_user),
        ai_client: OpenRouterClient = Depends(get_ai_client),
    ) -> AiChatResponse:
        row = get_board_for_user(board_id, current_user)
        if row is None:
            raise HTTPException(status_code=404, detail="Board not found.")
        board = BoardData.model_validate_json(row["board_json"])

        try:
            ai_result = ai_client.generate_structured_board_response(
                board=board,
                message=request.message,
                history=request.history,
            )
        except OpenRouterError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        board_updated = False
        if ai_result.board_update is not None:
            proposed = ai_result.board_update
            if not proposed.missing_card_references():
                if not update_board_data(board_id, current_user, proposed):
                    raise HTTPException(status_code=404, detail="Board not found.")
                board = proposed
                board_updated = True

        return AiChatResponse(
            assistant_message=ai_result.assistant_message,
            board_updated=board_updated,
            board=board,
        )

    # -----------------------------------------------------------------------
    # Legacy endpoints (unauthenticated, kept for backward compatibility)
    # -----------------------------------------------------------------------

    @app.get("/api/users/{username}/board", response_model=BoardData)
    def legacy_get_board(username: str) -> BoardData:
        board = get_user_board(username)
        if board is None:
            raise HTTPException(status_code=404, detail="User board not found.")
        return board

    @app.put("/api/users/{username}/board", response_model=BoardData)
    def legacy_save_board(username: str, board: BoardData) -> BoardData:
        missing = board.missing_card_references()
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Columns reference card IDs not in cards: {sorted(missing)}",
            )
        if not update_user_board(username, board):
            raise HTTPException(status_code=404, detail="User board not found.")
        return board

    @app.post("/api/ai/ping", response_model=AiPingResponse)
    def ai_ping(
        ai_client: OpenRouterClient = Depends(get_ai_client),
    ) -> AiPingResponse:
        try:
            reply = ai_client.ping()
        except OpenRouterError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return AiPingResponse(reply=reply)

    @app.post("/api/users/{username}/ai-chat", response_model=AiChatResponse)
    def legacy_ai_chat(
        username: str,
        request: AiChatRequest,
        ai_client: OpenRouterClient = Depends(get_ai_client),
    ) -> AiChatResponse:
        board = get_user_board(username)
        if board is None:
            raise HTTPException(status_code=404, detail="User board not found.")

        try:
            ai_result = ai_client.generate_structured_board_response(
                board=board,
                message=request.message,
                history=request.history,
            )
        except OpenRouterError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        board_updated = False
        if ai_result.board_update is not None:
            proposed = ai_result.board_update
            if not proposed.missing_card_references():
                if not update_user_board(username, proposed):
                    raise HTTPException(status_code=404, detail="User board not found.")
                board = proposed
                board_updated = True

        return AiChatResponse(
            assistant_message=ai_result.assistant_message,
            board_updated=board_updated,
            board=board,
        )

    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

    return app


app = create_app()
