import { GripVertical } from "lucide-react";
import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="rounded-2xl border border-transparent bg-white px-3 py-3 shadow-[0_18px_32px_rgba(3,33,71,0.16)]">
    <div className="flex items-start gap-2">
      <div className="mt-0.5 shrink-0 text-[var(--gray-text)] opacity-60">
        <GripVertical size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]">
          {card.title}
        </h4>
        <p className="mt-1 text-xs leading-5 text-[var(--gray-text)]">
          {card.details}
        </p>
      </div>
    </div>
  </article>
);
