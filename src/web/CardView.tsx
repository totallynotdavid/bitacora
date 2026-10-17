import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, Check, ListChecks, Pencil } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { labelStyle, type Card } from "../shared/model";
import styles from "./CardView.module.css";
import { useUi } from "./ui";
import { useStripeNames } from "./useStripeNames";

/**
 * The card's completion control: a circle that shows on hover, or the green
 * check of a card in Hecho. Without `onToggle` it is only a picture.
 */
export function Completion({
  done,
  size,
  onToggle,
}: {
  done: boolean;
  size: "card" | "back";
  onToggle?: () => void;
}) {
  const icon = done ? <Check size={size === "card" ? 16 : 24} strokeWidth={3} aria-hidden /> : null;
  if (!onToggle) {
    return done ? (
      <span className={styles.complete} data-done data-size={size}>
        {icon}
      </span>
    ) : null;
  }
  return (
    <button
      type="button"
      className={styles.complete}
      data-done={done}
      data-size={size}
      aria-label={done ? "Mover a En curso" : "Marcar como hecha"}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {icon}
    </button>
  );
}

/**
 * The card as it looks on the board. `title` replaces the title text, for quick
 * edit. `onToggleDone` adds the completion circle.
 */
export function CardFace({
  card,
  title,
  lifted,
  onToggleDone,
}: {
  card: Card;
  title?: ReactNode;
  lifted?: boolean;
  onToggleDone?: () => void;
}) {
  const stripeNames = useStripeNames();
  const { labels } = useUi();
  const label = labels.find((known) => known.id === card.labelId);
  const checked = card.checklist.filter((item) => item.done).length;
  const hasDescription = card.description.trim() !== "";
  const hasBadges = card.requester || card.checklist.length > 0 || hasDescription;
  const done = card.list === "hecho";

  return (
    <div
      className={styles.face}
      data-lifted={lifted}
      data-elevation={lifted ? "overlay" : "raised"}
      style={
        label
          ? ({
              "--stripe": labelStyle(label.color).background,
              "--stripe-text": labelStyle(label.color).color,
            } as CSSProperties)
          : undefined
      }
    >
      {label && (
        <button
          type="button"
          className={stripeNames.expanded ? styles.pill : styles.stripe}
          data-label={label.id}
          title={label.name}
          aria-label={`Etiqueta ${label.name}. Alternar nombre de las etiquetas`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            stripeNames.toggle();
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {stripeNames.expanded ? label.name : null}
        </button>
      )}
      <div className={styles.titleRow} data-done={done}>
        <Completion done={done} size="card" onToggle={onToggleDone} />
        <div className={styles.title}>{title ?? card.title}</div>
      </div>
      {hasBadges && (
        <div className={styles.badges}>
          {card.requester && <span className={styles.chip}>{card.requester}</span>}
          {hasDescription && <AlignLeft size={16} aria-label="Tiene descripción" />}
          {card.checklist.length > 0 && (
            <span className={styles.badge} data-complete={checked === card.checklist.length}>
              <ListChecks size={16} aria-hidden />
              {checked}/{card.checklist.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function SortableCard({ card }: { card: Card }) {
  const ui = useUi();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={styles.sortable}
      data-card-id={card.id}
      data-dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      role="group"
      aria-label={card.title}
      {...listeners}
      onClick={() => ui.openCard(card.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !isDragging && event.target === event.currentTarget) {
          // The card back focuses its close button. The key press must not reach it.
          event.preventDefault();
          ui.openCard(card.id);
        } else listeners?.onKeyDown?.(event);
      }}
    >
      <CardFace card={card} onToggleDone={() => ui.toggleDone(card.id)} />
      <button
        type="button"
        className={styles.edit}
        aria-label="Editar tarjeta"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          ui.quickEdit(card.id);
        }}
      >
        <Pencil size={16} aria-hidden />
      </button>
    </div>
  );
}
