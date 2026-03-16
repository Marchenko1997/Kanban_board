"use client";

import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LogOut, Cloud, CloudOff, Loader2, ArrowLeft } from "lucide-react";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, moveCard, type BoardData } from "@/lib/kanban";

type KanbanBoardProps = {
  board: BoardData;
  boardName?: string;
  onBoardChange: Dispatch<SetStateAction<BoardData>>;
  onLogout?: () => void;
  onBack?: () => void;
  syncState?: "idle" | "saving" | "error";
};

export const KanbanBoard = ({
  board,
  boardName,
  onBoardChange,
  onLogout,
  onBack,
  syncState = "idle",
}: KanbanBoardProps) => {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    onBoardChange((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    onBoardChange((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    onBoardChange((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    onBoardChange((prev) => {
      return {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[320px] w-[320px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.15)_0%,_rgba(32,157,215,0.03)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[380px] w-[380px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.12)_0%,_rgba(117,57,145,0.03)_55%,_transparent_75%)]" />

      <main className="relative flex min-h-screen w-full flex-col gap-6 px-4 pb-8 pt-6">
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--stroke)] bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-4">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--primary-blue)]"
                aria-label="Back to boards"
              >
                <ArrowLeft size={16} />
              </button>
            ) : null}
            <div>
              <h1 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
                {boardName ?? "Kanban Studio"}
              </h1>
              <p className="text-xs text-[var(--gray-text)]">
                Drag cards, rename columns, stay focused.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4">
              {board.columns.map((column) => (
                <span
                  key={column.id}
                  className="hidden items-center gap-1.5 text-[11px] font-medium text-[var(--gray-text)] xl:inline-flex"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-yellow)]" />
                  {column.title}
                </span>
              ))}
            </div>
            <div className="h-5 w-px bg-[var(--stroke)]" />
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--gray-text)]">
              {syncState === "saving" ? (
                <><Loader2 size={12} className="animate-spin" /> Saving</>
              ) : syncState === "error" ? (
                <><CloudOff size={12} className="text-[var(--error-red)]" /> Offline</>
              ) : (
                <><Cloud size={12} className="text-[var(--primary-blue)]" /> Synced</>
              )}
            </span>
            {onLogout ? (
              <>
                <div className="h-5 w-px bg-[var(--stroke)]" />
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--secondary-purple)]"
                  aria-label="Log out"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : null}
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid flex-1 gap-3 lg:grid-cols-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[240px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
