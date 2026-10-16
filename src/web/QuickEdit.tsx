import { ArrowRight, Clock, CreditCard, Tag, Trash2, User } from "lucide-react";
import { useState } from "react";
import type { Card } from "../shared/model";
import { CardFace } from "./CardView";
import { CardPopover, type CardActions, type PopoverKind } from "./CardPopover";
import styles from "./QuickEdit.module.css";
import { useAutosize } from "./useAutosize";
import { useEscape } from "./useEscape";

const MENU_WIDTH = 176;

const BUTTONS: { kind: PopoverKind; label: string; icon: typeof Tag }[] = [
  { kind: "category", label: "Categoría", icon: Tag },
  { kind: "requester", label: "Solicitante", icon: User },
  { kind: "date", label: "Fecha", icon: Clock },
  { kind: "move", label: "Mover", icon: ArrowRight },
];

/**
 * Edits a card's title where it sits on the board, with the rest of the board
 * dimmed and the card's actions in a column beside it.
 */
export function QuickEdit(props: {
  card: Card;
  /** Where the card is on the screen. */
  rect: DOMRect;
  today: string;
  requesters: string[];
  actions: CardActions;
  onOpenCard: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { card, rect, actions } = props;
  const [title, setTitle] = useState(card.title);
  const [popover, setPopover] = useState<{ kind: PopoverKind; anchor: HTMLElement } | null>(null);
  const field = useAutosize();
  useEscape(props.onClose);

  function save() {
    const next = title.trim();
    if (next && next !== card.title) actions.edit({ title: next });
    props.onClose();
  }

  const menuLeft = rect.right + 8 + MENU_WIDTH <= innerWidth ? rect.right + 8 : rect.left - 8 - MENU_WIDTH;

  const toggle = (kind: PopoverKind, anchor: HTMLElement) =>
    setPopover((open) => (open?.kind === kind ? null : { kind, anchor }));

  return (
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) save();
      }}
    >
      <div className={styles.card} style={{ left: rect.left, top: rect.top, width: rect.width }}>
        <CardFace
          card={card}
          title={
            <textarea
              ref={field}
              className={styles.field}
              rows={1}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              value={title}
              aria-label="Título de la tarjeta"
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  save();
                }
              }}
            />
          }
        />
        <button type="button" className={styles.save} onClick={save}>
          Guardar
        </button>
      </div>

      <div className={styles.menu} style={{ left: menuLeft, top: rect.top, width: MENU_WIDTH }}>
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            save();
            props.onOpenCard();
          }}
        >
          <CreditCard size={16} aria-hidden /> Abrir tarjeta
        </button>
        {BUTTONS.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            className={styles.action}
            onClick={(event) => toggle(kind, event.currentTarget)}
          >
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
        <button type="button" className={styles.action} onClick={props.onDelete}>
          <Trash2 size={16} aria-hidden /> Eliminar
        </button>
      </div>

      {popover && (
        <CardPopover
          kind={popover.kind}
          anchor={popover.anchor}
          card={card}
          today={props.today}
          requesters={props.requesters}
          actions={{
            edit: actions.edit,
            move: (to) => {
              actions.move(to);
              props.onClose();
            },
          }}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}
