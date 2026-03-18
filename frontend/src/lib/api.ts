import type { BoardData, BoardFull, BoardMeta } from "@/lib/kanban";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

const parseError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { detail?: string };
    if (payload.detail) {
      return payload.detail;
    }
  } catch {
    // Best-effort parse only.
  }
  return `Request failed with status ${response.status}.`;
};

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type AuthResult = {
  token: string;
  username: string;
};

export const register = async (
  username: string,
  password: string
): Promise<AuthResult> => {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as AuthResult;
};

export const login = async (
  username: string,
  password: string
): Promise<AuthResult> => {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as AuthResult;
};

// ---------------------------------------------------------------------------
// Board management (authenticated)
// ---------------------------------------------------------------------------

export const listBoards = async (token: string): Promise<BoardMeta[]> => {
  const response = await fetch(`${API_BASE}/api/boards`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BoardMeta[];
};

export const createBoardApi = async (
  token: string,
  name: string
): Promise<BoardFull> => {
  const response = await fetch(`${API_BASE}/api/boards`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BoardFull;
};

export const getBoardApi = async (
  token: string,
  boardId: number
): Promise<BoardFull> => {
  const response = await fetch(`${API_BASE}/api/boards/${boardId}`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BoardFull;
};

export const saveBoardApi = async (
  token: string,
  boardId: number,
  board: BoardData
): Promise<BoardFull> => {
  const response = await fetch(`${API_BASE}/api/boards/${boardId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BoardFull;
};

export const renameBoardApi = async (
  token: string,
  boardId: number,
  name: string
): Promise<BoardMeta> => {
  const response = await fetch(`${API_BASE}/api/boards/${boardId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BoardMeta;
};

export const deleteBoardApi = async (
  token: string,
  boardId: number
): Promise<void> => {
  const response = await fetch(`${API_BASE}/api/boards/${boardId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
};

export type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type AiChatResult = {
  assistant_message: string;
  board_updated: boolean;
  board: BoardData;
};

export const sendAiChatBoard = async (
  token: string,
  boardId: number,
  message: string,
  history: ChatHistoryItem[]
): Promise<AiChatResult> => {
  const response = await fetch(`${API_BASE}/api/boards/${boardId}/ai-chat`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as AiChatResult;
};

// ---------------------------------------------------------------------------
// Legacy (unauthenticated) API — kept for backward compatibility
// ---------------------------------------------------------------------------

const boardPath = (username: string) =>
  `${API_BASE}/api/users/${encodeURIComponent(username)}/board`;

const chatPath = (username: string) =>
  `${API_BASE}/api/users/${encodeURIComponent(username)}/ai-chat`;

export const fetchBoard = async (username: string): Promise<BoardData> => {
  const response = await fetch(boardPath(username), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BoardData;
};

export const saveBoard = async (
  username: string,
  board: BoardData
): Promise<BoardData> => {
  const response = await fetch(boardPath(username), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as BoardData;
};

export const sendAiChat = async (
  username: string,
  message: string,
  history: ChatHistoryItem[]
): Promise<AiChatResult> => {
  const response = await fetch(chatPath(username), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as AiChatResult;
};
