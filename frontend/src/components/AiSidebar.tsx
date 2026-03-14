"use client";

import { FormEvent, useState } from "react";

export type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

type AiSidebarProps = {
  messages: AiMessage[];
  isLoading: boolean;
  errorMessage: string;
  onSend: (message: string) => Promise<void> | void;
};

export const AiSidebar = ({
  messages,
  isLoading,
  errorMessage,
  onSend,
}: AiSidebarProps) => {
  const [draft, setDraft] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isLoading) {
      return;
    }

    setDraft("");
    await onSend(message);
  };

  return (
    <aside data-testid="ai-sidebar" className="w-full rounded-3xl border border-[var(--stroke)] bg-white/95 p-5 shadow-[var(--shadow)] backdrop-blur">
      <header className="border-b border-[var(--stroke)] pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--gray-text)]">
          AI Sidebar
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--navy-dark)]">
          Assistant
        </h2>
        <p className="mt-2 text-sm text-[var(--gray-text)]">
          Ask to create, edit, or move cards.
        </p>
      </header>

      <div className="mt-4 h-[320px] overflow-y-auto rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--gray-text)]">
            No messages yet. Ask the assistant to update your board.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[88%] rounded-2xl bg-[var(--primary-blue)] px-3 py-2 text-sm text-white"
                    : "mr-auto max-w-[88%] rounded-2xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)]"
                }
                data-testid={`chat-${message.role}`}
              >
                {message.content}
              </article>
            ))}
          </div>
        )}
      </div>

      {errorMessage ? (
        <p className="mt-3 text-sm font-medium text-[var(--error-red)]" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Example: Move card-1 to Review and rename it."
          rows={3}
          className="w-full resize-none rounded-2xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || isLoading}
          className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Thinking..." : "Send to AI"}
        </button>
      </form>
    </aside>
  );
};

