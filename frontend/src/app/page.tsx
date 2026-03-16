"use client";

import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { AiSidebar, type AiMessage } from "@/components/AiSidebar";
import { BoardDashboard } from "@/components/BoardDashboard";
import { KanbanBoard } from "@/components/KanbanBoard";
import {
  login,
  register,
  listBoards,
  createBoardApi,
  getBoardApi,
  saveBoardApi,
  deleteBoardApi,
  sendAiChatBoard,
} from "@/lib/api";
import { initialData, type BoardData, type BoardMeta } from "@/lib/kanban";

const AUTH_STORAGE_KEY = "pm-auth-v2";

type StoredAuth = { token: string; username: string };
type AuthState = "loading" | "authenticated" | "unauthenticated";
type View = "dashboard" | "board";
type SyncState = "idle" | "saving" | "error";

function getStoredAuth(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

function setStoredAuth(auth: StoredAuth) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

function clearStoredAuth() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export default function Home() {
  // Auth
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [formMode, setFormMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard
  const [view, setView] = useState<View>("dashboard");
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);

  // Board view
  const [selectedBoard, setSelectedBoard] = useState<BoardMeta | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [backendMessage, setBackendMessage] = useState("");
  const serverBoardRef = useRef<BoardData | null>(null);

  // AI
  const [chatMessages, setChatMessages] = useState<AiMessage[]>([]);
  const [chatError, setChatError] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Boot: check stored auth
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      setAuth(stored);
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Load boards when authenticated and on dashboard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (authState !== "authenticated" || !auth || view !== "dashboard") return;

    const load = async () => {
      setBoardsLoading(true);
      try {
        const loaded = await listBoards(auth.token);
        setBoards(loaded);
      } catch {
        setBoards([]);
      } finally {
        setBoardsLoading(false);
      }
    };
    void load();
  }, [authState, auth, view]);

  // ---------------------------------------------------------------------------
  // Debounced board save
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!auth || !selectedBoard || !board) return;
    if (board === serverBoardRef.current) return;

    let canceled = false;
    const timer = setTimeout(() => {
      const persist = async () => {
        setSyncState("saving");
        try {
          await saveBoardApi(auth.token, selectedBoard.id, board);
          if (!canceled) {
            setSyncState("idle");
            setBackendMessage("");
          }
        } catch {
          if (!canceled) {
            setSyncState("error");
            setBackendMessage(
              "Unable to save changes. Changes remain local until reconnected."
            );
          }
        }
      };
      void persist();
    }, 400);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [auth, selectedBoard, board]);

  // ---------------------------------------------------------------------------
  // Auth handlers
  // ---------------------------------------------------------------------------
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const result = await login(username, password);
      setStoredAuth(result);
      setAuth(result);
      setAuthState("authenticated");
      setView("dashboard");
      setPassword("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    setAuthLoading(true);
    try {
      const result = await register(username, password);
      setStoredAuth(result);
      setAuth(result);
      setAuthState("authenticated");
      setView("dashboard");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuth(null);
    setAuthState("unauthenticated");
    setFormMode("login");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setAuthError("");
    setBoards([]);
    setView("dashboard");
    setSelectedBoard(null);
    setBoard(null);
    serverBoardRef.current = null;
    setChatMessages([]);
    setChatError("");
    setIsAiLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Board handlers
  // ---------------------------------------------------------------------------
  const handleOpenBoard = async (meta: BoardMeta) => {
    if (!auth) return;
    setSyncState("idle");
    setBackendMessage("");
    setBoard(null);
    setSelectedBoard(meta);
    setChatMessages([]);
    setChatError("");
    setView("board");

    try {
      const full = await getBoardApi(auth.token, meta.id);
      serverBoardRef.current = full.board;
      setBoard(full.board);
    } catch {
      serverBoardRef.current = initialData;
      setBoard(initialData);
      setBackendMessage("Could not load board. Using local data.");
    }
  };

  const handleBackToDashboard = () => {
    setView("dashboard");
    setSelectedBoard(null);
    setBoard(null);
    serverBoardRef.current = null;
    setSyncState("idle");
    setBackendMessage("");
    setChatMessages([]);
    setChatError("");
  };

  const handleCreateBoard = async (name: string) => {
    if (!auth) return;
    setIsCreatingBoard(true);
    try {
      const full = await createBoardApi(auth.token, name);
      setBoards((prev) => [
        { id: full.id, name: full.name, updated_at: full.updated_at },
        ...prev,
      ]);
    } finally {
      setIsCreatingBoard(false);
    }
  };

  const handleDeleteBoard = async (boardId: number) => {
    if (!auth) return;
    await deleteBoardApi(auth.token, boardId);
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
  };

  const handleBoardChange: Dispatch<SetStateAction<BoardData>> = (nextBoard) => {
    setBoard((prev) => {
      const safe = prev ?? initialData;
      return typeof nextBoard === "function" ? nextBoard(safe) : nextBoard;
    });
  };

  // ---------------------------------------------------------------------------
  // AI handler
  // ---------------------------------------------------------------------------
  const handleAiSend = async (message: string) => {
    if (!auth || !selectedBoard) return;
    const history = [...chatMessages];
    setChatError("");
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setIsAiLoading(true);

    try {
      const result = await sendAiChatBoard(
        auth.token,
        selectedBoard.id,
        message,
        history
      );
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.assistant_message },
      ]);
      if (result.board_updated) {
        serverBoardRef.current = result.board;
        setBoard(result.board);
      }
    } catch {
      setChatError("AI is unavailable right now. Please try again.");
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I could not complete that request because the AI service is unavailable.",
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (authState === "loading") {
    return null;
  }

  if (authState === "unauthenticated") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[460px] items-center px-6">
        <section className="w-full rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            Project Management
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            {formMode === "login" ? "Sign in" : "Create account"}
          </h1>
          <p className="mt-3 text-sm text-[var(--gray-text)]">
            {formMode === "login"
              ? "Welcome back. Sign in to your account."
              : "Choose a username and password to get started."}
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) =>
              void (formMode === "login" ? handleLogin(e) : handleRegister(e))
            }
            data-testid="login-form"
          >
            <label className="block text-sm font-medium text-[var(--navy-dark)]">
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 outline-none transition focus:border-[var(--primary-blue)]"
                autoComplete="username"
                required
              />
            </label>

            <label className="block text-sm font-medium text-[var(--navy-dark)]">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 outline-none transition focus:border-[var(--primary-blue)]"
                autoComplete={
                  formMode === "login" ? "current-password" : "new-password"
                }
                required
              />
            </label>

            {formMode === "register" && (
              <label className="block text-sm font-medium text-[var(--navy-dark)]">
                Confirm password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 outline-none transition focus:border-[var(--primary-blue)]"
                  autoComplete="new-password"
                  required
                />
              </label>
            )}

            {authError ? (
              <p
                className="text-sm font-medium text-[var(--error-red)]"
                role="alert"
                data-testid="login-error"
              >
                {authError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {authLoading
                ? "Please wait..."
                : formMode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--gray-text)]">
            {formMode === "login" ? (
              <>
                No account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setFormMode("register");
                    setAuthError("");
                  }}
                  className="font-medium text-[var(--primary-blue)] hover:underline"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setFormMode("login");
                    setAuthError("");
                  }}
                  className="font-medium text-[var(--primary-blue)] hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          {formMode === "login" && (
            <p className="mt-4 text-center text-xs text-[var(--gray-text)]">
              Demo account: <strong>user</strong> / <strong>password</strong>
            </p>
          )}
        </section>
      </main>
    );
  }

  if (view === "dashboard") {
    return (
      <BoardDashboard
        username={auth!.username}
        boards={boards}
        onOpenBoard={(meta) => void handleOpenBoard(meta)}
        onCreateBoard={handleCreateBoard}
        onDeleteBoard={handleDeleteBoard}
        onLogout={handleLogout}
        isCreating={isCreatingBoard}
      />
    );
  }

  if (!board) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[460px] items-center px-6">
        <section className="w-full rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <h1 className="font-display text-2xl font-semibold text-[var(--navy-dark)]">
            Loading board
          </h1>
          <p className="mt-3 text-sm text-[var(--gray-text)]">
            Fetching your latest board state.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="min-w-0 flex-1 overflow-y-auto">
        {backendMessage ? (
          <div className="mx-4 mt-4 rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-xs text-[var(--gray-text)]">
            {backendMessage}
          </div>
        ) : null}
        <KanbanBoard
          board={board}
          boardName={selectedBoard?.name}
          onBoardChange={handleBoardChange}
          onLogout={handleLogout}
          onBack={handleBackToDashboard}
          syncState={syncState}
        />
      </div>
      <div className="hidden w-[320px] shrink-0 border-l border-[var(--stroke)] bg-[var(--surface)] p-3 lg:flex lg:flex-col">
        <AiSidebar
          messages={chatMessages}
          isLoading={isAiLoading}
          errorMessage={chatError}
          onSend={handleAiSend}
        />
      </div>
    </div>
  );
}
