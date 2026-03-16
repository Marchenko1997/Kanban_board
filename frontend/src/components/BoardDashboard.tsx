"use client";

import { type FormEvent, useState } from "react";
import { LayoutDashboard, Plus, Trash2, ArrowRight } from "lucide-react";
import type { BoardMeta } from "@/lib/kanban";

type BoardDashboardProps = {
  username: string;
  boards: BoardMeta[];
  onOpenBoard: (board: BoardMeta) => void;
  onCreateBoard: (name: string) => Promise<void>;
  onDeleteBoard: (boardId: number) => Promise<void>;
  onLogout: () => void;
  isCreating: boolean;
};

export const BoardDashboard = ({
  username,
  boards,
  onOpenBoard,
  onCreateBoard,
  onDeleteBoard,
  onLogout,
  isCreating,
}: BoardDashboardProps) => {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await onCreateBoard(name);
    setNewName("");
    setShowCreate(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--surface)]">
      <div className="pointer-events-none absolute left-0 top-0 h-[320px] w-[320px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.15)_0%,_rgba(32,157,215,0.03)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[380px] w-[380px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.12)_0%,_rgba(117,57,145,0.03)_55%,_transparent_75%)]" />

      <div className="relative mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-blue)]">
              <LayoutDashboard size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-[var(--navy-dark)]">
                My Boards
              </h1>
              <p className="text-xs text-[var(--gray-text)]">
                Signed in as{" "}
                <span className="font-medium text-[var(--navy-dark)]">
                  {username}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg px-3 py-2 text-sm text-[var(--gray-text)] transition hover:bg-white hover:text-[var(--secondary-purple)]"
          >
            Sign out
          </button>
        </header>

        <div className="space-y-3">
          {boards.map((board) => (
            <div
              key={board.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--stroke)] bg-white px-5 py-4 shadow-sm transition hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => onOpenBoard(board)}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                <span className="font-medium text-[var(--navy-dark)]">
                  {board.name}
                </span>
                <span className="text-xs text-[var(--gray-text)]">
                  {new Date(board.updated_at).toLocaleDateString()}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenBoard(board)}
                  className="rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--primary-blue)]"
                  aria-label={`Open ${board.name}`}
                >
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteBoard(board.id)}
                  className="rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--error-red)]"
                  aria-label={`Delete ${board.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {boards.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--gray-text)]">
              No boards yet. Create one below.
            </p>
          )}
        </div>

        <div className="mt-6">
          {showCreate ? (
            <form
              onSubmit={(e) => void handleCreate(e)}
              className="rounded-2xl border border-[var(--stroke)] bg-white p-5 shadow-sm"
            >
              <label className="block text-sm font-medium text-[var(--navy-dark)]">
                Board name
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sprint 3, Marketing, Personal"
                  className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
                  maxLength={100}
                />
              </label>
              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={isCreating || !newName.trim()}
                  className="rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setNewName("");
                  }}
                  className="rounded-full px-5 py-2 text-sm text-[var(--gray-text)] transition hover:bg-[var(--surface)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--stroke)] bg-white px-5 py-4 text-sm font-medium text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
            >
              <Plus size={16} />
              New board
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
