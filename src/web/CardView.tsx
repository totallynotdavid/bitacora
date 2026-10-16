import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, Check, ListChecks } from "lucide-react";
import type { CSSProperties } from "react";
import { CATEGORY_COLORS, type Card } from "../shared/model";
import styles from "./CardView.module.css";

export function CardFace({ card }: { card: Card }) {
  const checked = card.checklist.filter((item) => item.done).length;
  const hasBadges = card.requester || card.checklist.length > 0 || card.description;

  return (
    <div className={styles.face} style={{ "--stripe": CATEGORY_COLORS[card.category] } as CSSProperties}>
      <span className={styles.stripe} title={card.category} />
      <div className={styles.title}>
        {card.list === "hecho" && (
          <Check className={styles.check} size={16} strokeWidth={3} aria-label="Hecho" />
        )}
        {card.title}
      </div>
      {hasBadges && (
        <div className={styles.badges}>
          {card.requester && <span className={styles.chip}>{card.requester}</span>}
          {card.description && <AlignLeft size={14} aria-label="Tiene descripción" />}
          {card.checklist.length > 0 && (
            <span className={styles.badge} data-complete={checked === card.checklist.length}>
              <ListChecks size={14} aria-hidden />
              {checked}/{card.checklist.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function SortableCard({ card, onOpen }: { card: Card; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={styles.sortable}
      data-dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !isDragging) onOpen(card.id);
        else listeners?.onKeyDown?.(event);
      }}
    >
      <CardFace card={card} />
    </div>
  );
}
