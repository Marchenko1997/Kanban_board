from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app.ai_client import OpenRouterClient, OpenRouterError
from app.db import get_user_board, initialize_database, update_user_board
from app.schemas import AiChatRequest, AiChatResponse, AiPingResponse, BoardData

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


def get_ai_client() -> OpenRouterClient:
    return OpenRouterClient()


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialize_database()
        yield

    app = FastAPI(
        title="Project Management MVP",
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "pm-backend"}

    @app.get("/api/users/{username}/board", response_model=BoardData)
    def get_board(username: str) -> BoardData:
        board = get_user_board(username)
        if board is None:
            raise HTTPException(status_code=404, detail="User board not found.")
        return board

    @app.put("/api/users/{username}/board", response_model=BoardData)
    def save_board(username: str, board: BoardData) -> BoardData:
        updated = update_user_board(username, board)
        if not updated:
            raise HTTPException(status_code=404, detail="User board not found.")
        return board

    @app.post("/api/ai/ping", response_model=AiPingResponse)
    def ai_ping(ai_client: OpenRouterClient = Depends(get_ai_client)) -> AiPingResponse:
        try:
            reply = ai_client.ping()
        except OpenRouterError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        return AiPingResponse(reply=reply)

    @app.post("/api/users/{username}/ai-chat", response_model=AiChatResponse)
    def ai_chat(
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

        board_updated = ai_result.board_update is not None
        if board_updated:
            assert ai_result.board_update is not None
            updated = update_user_board(username, ai_result.board_update)
            if not updated:
                raise HTTPException(status_code=404, detail="User board not found.")
            board = ai_result.board_update

        return AiChatResponse(
            assistant_message=ai_result.assistant_message,
            board_updated=board_updated,
            board=board,
        )

    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

    return app


app = create_app()
