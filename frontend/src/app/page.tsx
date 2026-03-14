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
import { KanbanBoard } from "@/components/KanbanBoard";
import { fetchBoard, saveBoard, sendAiChat } from "@/lib/api";
import { initialData, type BoardData } from "@/lib/kanban";

const AUTH_STORAGE_KEY = "pm-authenticated";
const DEMO_USERNAME = "user";
const DEMO_PASSWORD = "password";

type AuthState = "loading" | "authenticated" | "unauthenticated";
type SyncState = "idle" | "saving" | "error";

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [board, setBoard] = useState<BoardData | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [backendMessage, setBackendMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<AiMessage[]>([]);
  const [chatError, setChatError] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const serverBoardRef = useRef<BoardData | null>(null);

  useEffect(() => {
    const isAuthenticated = window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
    setAuthState(isAuthenticated ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    if (authState !== "authenticated" || board) {
      return;
    }

    const loadBoard = async () => {
      setSyncState("saving");
      try {
        const loadedBoard = await fetchBoard(DEMO_USERNAME);
        serverBoardRef.current = loadedBoard;
        setBoard(loadedBoard);
        setBackendMessage("");
      } catch {
        // Keep the frontend usable in environments where backend API is unavailable.
        serverBoardRef.current = initialData;
        setBoard(initialData);
        setBackendMessage(
          "Backend is unavailable. Using local demo data for this session."
        );
      } finally {
        setSyncState("idle");
      }
    };

    void loadBoard();
  }, [authState, board]);

  useEffect(() => {
    if (authState !== "authenticated" || !board) {
      return;
    }

    if (board === serverBoardRef.current) {
      return;
    }

    let canceled = false;

    const timer = setTimeout(() => {
      const persistBoard = async () => {
        setSyncState("saving");
        try {
          await saveBoard(DEMO_USERNAME, board);
          if (!canceled) {
            setSyncState("idle");
            setBackendMessage("");
          }
        } catch {
          if (!canceled) {
            setSyncState("error");
            setBackendMessage(
              "Unable to save changes to backend. Changes remain local until backend is reachable."
            );
          }
        }
      };

      void persistBoard();
    }, 400);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [authState, board]);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
      setAuthState("authenticated");
      setBoard(null);
      serverBoardRef.current = null;
      setSyncState("idle");
      setBackendMessage("");
      setChatMessages([]);
      setChatError("");
      setIsAiLoading(false);
      setErrorMessage("");
      setPassword("");
      return;
    }

    setErrorMessage("Invalid username or password.");
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthState("unauthenticated");
    setUsername("");
    setPassword("");
    setErrorMessage("");
    setBoard(null);
    serverBoardRef.current = null;
    setSyncState("idle");
    setBackendMessage("");
    setChatMessages([]);
    setChatError("");
    setIsAiLoading(false);
  };

  const handleAiSend = async (message: string) => {
    const history = [...chatMessages];
    setChatError("");
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setIsAiLoading(true);

    try {
      const result = await sendAiChat(DEMO_USERNAME, message, history);
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
          content: "I could not complete that request because the AI service is unavailable.",
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleBoardChange: Dispatch<SetStateAction<BoardData>> = (nextBoard) => {
    setBoard((previousBoard) => {
      const safeBoard = previousBoard ?? initialData;
      if (typeof nextBoard === "function") {
        return nextBoard(safeBoard);
      }
      return nextBoard;
    });
  };

  if (authState === "loading") {
    return null;
  }

  if (authState === "unauthenticated") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[460px] items-center px-6">
        <section className="w-full rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            Project Management MVP
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            Sign in
          </h1>
          <p className="mt-3 text-sm text-[var(--gray-text)]">
            Use the demo credentials to access your board.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin} data-testid="login-form">
            <label className="block text-sm font-medium text-[var(--navy-dark)]">
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 outline-none transition focus:border-[var(--primary-blue)]"
                autoComplete="current-password"
                required
              />
            </label>

            {errorMessage ? (
              <p
                className="text-sm font-medium text-[var(--error-red)]"
                role="alert"
                data-testid="login-error"
              >
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:brightness-110"
            >
              Sign in
            </button>
          </form>
        </section>
      </main>
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
    <div className="mx-auto w-full max-w-[1880px] px-3 pb-8 pt-4 lg:flex lg:items-start lg:gap-6">
      <div className="min-w-0 flex-1">
        {backendMessage ? (
          <div className="mx-auto mt-4 w-full max-w-[1500px] rounded-xl border border-[var(--stroke)] bg-white px-4 py-3 text-sm text-[var(--gray-text)]">
            {backendMessage}
          </div>
        ) : null}
        <KanbanBoard
          board={board}
          onBoardChange={handleBoardChange}
          onLogout={handleLogout}
          syncState={syncState}
        />
      </div>
      <div className="mt-6 lg:sticky lg:top-6 lg:mt-10 lg:w-[360px] lg:shrink-0">
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
