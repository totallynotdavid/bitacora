import { ChevronDown, Clock, ListChecks, Tag, Trash2, User, X } from "lucide-react";
import { useRef, useState } from "react";
import { dayHeading } from "../shared/dates";
import { LABEL_STYLES, LIST_TITLES, type Card } from "../shared/model";
import type { Fields } from "./boardState";
import { Checklist } from "./Checklist";
import { CardPopover, type CardActions, type PopoverKind } from "./CardPopover";
import { Completion } from "./CardView";
import { useModal } from "./Dialog";
import { Description } from "./Description";
import styles from "./CardBack.module.css";
import type { Container } from "./groups";
import { useUi } from "./ui";
import { useAutosize } from "./useAutosize";
import { useEscape } from "./useEscape";

/** The card's title: a borderless textarea. Enter or blur saves, Escape restores the old text. */
function Title({ card, onSave }: { card: Card; onSave: (title: string) => void }) {
  const [text, setText] = useState(card.title);
  const [focused, setFocused] = useState(false);
  const field = useAutosize();
  const restored = useRef(false);

  useEscape(() => {
    restored.current = true;
    setText(card.title);
    field.current?.blur();
  }, focused);

  // The title can change from outside, for example from quick edit.
  const [seen, setSeen] = useState(card.title);
  if (seen !== card.title) {
    setSeen(card.title);
    setText(card.title);
  }

  return (
    <textarea
      ref={field}
      className={styles.title}
      rows={1}
      maxLength={200}
      value={text}
      aria-label="Título de la tarjeta"
      onFocus={() => setFocused(true)}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onBlur={() => {
        setFocused(false);
        if (restored.current) {
          restored.current = false;
          return;
        }
        const next = text.trim();
        if (next && next !== card.title) onSave(next);
        else setText(card.title);
      }}
    />
  );
}

const BUTTONS: { kind: PopoverKind; label: string; icon: typeof Tag }[] = [
  { kind: "label", label: "Etiqueta", icon: Tag },
  { kind: "requester", label: "Solicitante", icon: User },
  { kind: "date", label: "Fecha", icon: Clock },
];

export function CardBack(props: {
  card: Card;
  today: string;
  requesters: string[];
  actions: CardActions & { remove: () => void; toggleDone: () => void };
  onClose: () => void;
}) {
  const { card, actions } = props;
  const { labels } = useUi();
  const chosen = labels.find((known) => known.id === card.labelId);
  const modal = useModal();
  const [popover, setPopover] = useState<{ kind: PopoverKind; anchor: HTMLElement } | null>(null);
  const [checklistShown, setChecklistShown] = useState(false);

  const toggle = (kind: PopoverKind) => (event: { currentTarget: HTMLElement }) => {
    const anchor = event.currentTarget;
    setPopover((open) => (open?.kind === kind ? null : { kind, anchor }));
  };

  const edit = (fields: Fields) => actions.edit(fields);
  const move = (to: Container) => actions.move(to);

  return (
    <dialog {...modal.props} className={styles.dialog} aria-label="Tarjeta" onClose={props.onClose}>
      <header className={styles.bar}>
        <button type="button" className={styles.list} onClick={toggle("move")}>
          {LIST_TITLES[card.list]}
          <ChevronDown size={16} aria-hidden />
        </button>
        <div className={styles.barActions}>
          <button
            type="button"
            className={styles.icon}
            aria-label="Eliminar"
            onClick={() => {
              actions.remove();
              modal.close();
            }}
          >
            <Trash2 size={16} aria-hidden />
          </button>
          <button type="button" className={styles.icon} aria-label="Cerrar" onClick={modal.close}>
            <X size={16} aria-hidden />
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <Completion done={card.list === "hecho"} size="back" onToggle={actions.toggleDone} />
          <Title card={card} onSave={(title) => edit({ title })} />
        </div>

        <div className={styles.buttons}>
          {BUTTONS.map(({ kind, label, icon: Icon }) => (
            <button key={kind} type="button" className={styles.outlined} onClick={toggle(kind)}>
              <Icon size={16} aria-hidden /> {label}
            </button>
          ))}
          <button type="button" className={styles.outlined} onClick={() => setChecklistShown(true)}>
            <ListChecks size={16} aria-hidden /> Checklist
          </button>
        </div>

        <div className={styles.fields}>
          {chosen && (
            <div>
              <span className={styles.label}>Etiqueta</span>
              <button
                type="button"
                className={styles.labelChip}
                style={{
                  background: LABEL_STYLES[chosen.color].background,
                  color: LABEL_STYLES[chosen.color].text,
                }}
                onClick={toggle("label")}
              >
                {chosen.name}
              </button>
            </div>
          )}
          {card.requester && (
            <div>
              <span className={styles.label}>Solicitante</span>
              <button type="button" className={styles.chip} onClick={toggle("requester")}>
                {card.requester}
              </button>
            </div>
          )}
          {card.doneDate && (
            <div>
              <span className={styles.label}>Fecha de término</span>
              <button type="button" className={styles.chip} onClick={toggle("date")}>
                {dayHeading(card.doneDate, props.today)}
              </button>
            </div>
          )}
        </div>

        <Description value={card.description} onSave={(description) => edit({ description })} />
        {(card.checklist.length > 0 || checklistShown) && (
          <Checklist
            startOpen={card.checklist.length === 0}
            items={card.checklist}
            onSave={(checklist) => edit({ checklist })}
          />
        )}
      </div>

      {popover && (
        <CardPopover
          kind={popover.kind}
          anchor={popover.anchor}
          card={card}
          today={props.today}
          requesters={props.requesters}
          actions={{ edit, move }}
          onClose={() => setPopover(null)}
        />
      )}
    </dialog>
  );
}
