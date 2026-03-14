import type { BoardData } from "@/lib/kanban";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

const boardPath = (username: string) =>
  `${API_BASE}/api/users/${encodeURIComponent(username)}/board`;

const chatPath = (username: string) =>
  `${API_BASE}/api/users/${encodeURIComponent(username)}/ai-chat`;

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
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(board),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as BoardData;
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

export const sendAiChat = async (
  username: string,
  message: string,
  history: ChatHistoryItem[]
): Promise<AiChatResult> => {
  const response = await fetch(chatPath(username), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as AiChatResult;
};

