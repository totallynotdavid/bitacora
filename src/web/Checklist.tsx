import { Eye, EyeOff, ListChecks, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import type { ChecklistItem } from "../shared/model";
import styles from "./Checklist.module.css";
import { useEscape } from "./useEscape";

/** One item's text. A click turns it into a field. Enter or blur saves, Escape restores. */
function ItemText({ text, done, onSave }: { text: string; done: boolean; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const restored = useRef(false);
  useEscape(() => {
    restored.current = true;
    setEditing(false);
  }, editing);

  if (!editing) {
    return (
      <button
        type="button"
        className={styles.text}
        data-done={done}
        onClick={() => {
          setDraft(text);
          setEditing(true);
        }}
      >
        {text}
      </button>
    );
  }

  return (
    <input
      className={styles.edit}
      autoFocus
      maxLength={200}
      value={draft}
      aria-label="Texto del elemento"
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => (restored.current = false)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      onBlur={() => {
        if (!restored.current && draft.trim() && draft.trim() !== text) onSave(draft.trim());
        setEditing(false);
      }}
    />
  );
}

/** The "Añadir un elemento" composer. It stays open after Enter, ready for the next item. */
function ItemComposer({ onAdd, startOpen }: { onAdd: (text: string) => void; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [draft, setDraft] = useState("");
  useEscape(() => setOpen(false), open);

  if (!open) {
    return (
      <button type="button" className={styles.add} onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden /> Añadir un elemento
      </button>
    );
  }

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft("");
  };

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        className={styles.field}
        autoFocus
        rows={2}
        maxLength={200}
        value={draft}
        aria-label="Nuevo elemento"
        placeholder="Añadir un elemento"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className={styles.actions}>
        <button type="submit" className={styles.primary}>
          Añadir
        </button>
        <button type="button" className={styles.cancel} aria-label="Cerrar" onClick={() => setOpen(false)}>
          <X size={18} />
        </button>
      </div>
    </form>
  );
}

export function Checklist(props: {
  items: ChecklistItem[];
  /** Opens the item composer at once, for a checklist the user just asked for. */
  startOpen: boolean;
  onSave: (items: ChecklistItem[]) => void;
}) {
  const { items } = props;
  const [hideDone, setHideDone] = useState(false);
  const done = items.filter((item) => item.done).length;
  const percent = items.length === 0 ? 0 : Math.round((done / items.length) * 100);

  const change = (index: number, patch: Partial<ChecklistItem>) =>
    props.onSave(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h3 className={styles.heading}>
          <ListChecks size={16} aria-hidden /> Checklist
        </h3>
        {done > 0 && (
          <button type="button" className={styles.toggle} onClick={() => setHideDone(!hideDone)}>
            {hideDone ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
            {hideDone ? "Mostrar marcados" : "Ocultar marcados"}
          </button>
        )}
      </header>

      <div className={styles.progress}>
        <span className={styles.percent}>{percent}%</span>
        <div
          className={styles.bar}
          role="progressbar"
          aria-label="Progreso del checklist"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          data-complete={items.length > 0 && percent === 100}
        >
          <div className={styles.fill} style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ul className={styles.items}>
        {items.map((item, index) =>
          hideDone && item.done ? null : (
            <li key={index} className={styles.item}>
              <input
                type="checkbox"
                className={styles.check}
                checked={item.done}
                aria-label={`Marcar: ${item.text}`}
                onChange={(event) => change(index, { done: event.target.checked })}
              />
              <ItemText text={item.text} done={item.done} onSave={(text) => change(index, { text })} />
              <button
                type="button"
                className={styles.remove}
                aria-label={`Eliminar elemento: ${item.text}`}
                onClick={() => props.onSave(items.filter((_, i) => i !== index))}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ),
        )}
      </ul>

      <ItemComposer
        startOpen={props.startOpen}
        onAdd={(text) => props.onSave([...items, { text, done: false }])}
      />
    </section>
  );
}
