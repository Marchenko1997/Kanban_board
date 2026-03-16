"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, Loader2 } from "lucide-react";

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
    <aside data-testid="ai-sidebar" className="flex w-full flex-col rounded-2xl border border-[var(--stroke)] bg-white/95 shadow-sm backdrop-blur">
      <header className="flex items-center gap-3 border-b border-[var(--stroke)] px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--secondary-purple)]">
          <Bot size={16} className="text-white" />
        </div>
        <div>
          <h2 className="font-display text-sm font-semibold text-[var(--navy-dark)]">
            AI Assistant
          </h2>
          <p className="text-[11px] text-[var(--gray-text)]">
            Create, edit, or move cards.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 280px)", minHeight: "200px" }}>
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-xs text-[var(--gray-text)]">
              Ask the assistant to update your board.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[88%] rounded-xl rounded-br-sm bg-[var(--primary-blue)] px-3 py-2 text-xs leading-5 text-white"
                    : "mr-auto max-w-[88%] rounded-xl rounded-bl-sm border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-xs leading-5 text-[var(--navy-dark)]"
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
        <p className="px-4 pb-2 text-xs font-medium text-[var(--error-red)]" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="border-t border-[var(--stroke)] p-3">
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask the AI..."
            rows={2}
            className="min-w-0 flex-1 resize-none rounded-xl border border-[var(--stroke)] px-3 py-2 text-xs text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
          />
          <button
            type="submit"
            disabled={!draft.trim() || isLoading}
            className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl bg-[var(--secondary-purple)] text-white transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Send message"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </form>
    </aside>
  );
};

