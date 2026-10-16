import { Plus, X } from "lucide-react";
import { useState } from "react";
import styles from "./QuickAdd.module.css";

export function QuickAdd(props: { withHorizon: boolean; onAdd: (title: string, later: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [later, setLater] = useState(false);

  if (!open) {
    return (
      <button type="button" className={styles.button} onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden />
        Añadir una tarjeta
      </button>
    );
  }

  const close = () => {
    setOpen(false);
    setTitle("");
  };

  const submit = () => {
    const text = title.trim();
    if (!text) return;
    props.onAdd(text, later);
    setTitle("");
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        className={styles.input}
        autoFocus
        rows={3}
        value={title}
        placeholder="Escribe un título para esta tarjeta…"
        aria-label="Título de la tarjeta"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
          if (event.key === "Escape") close();
        }}
      />
      {props.withHorizon && (
        <div className={styles.horizon} role="radiogroup" aria-label="Grupo">
          <label>
            <input type="radio" checked={!later} onChange={() => setLater(false)} /> Esta semana
          </label>
          <label>
            <input type="radio" checked={later} onChange={() => setLater(true)} /> Después
          </label>
        </div>
      )}
      <div className={styles.actions}>
        <button type="submit" className={styles.submit}>
          Añadir tarjeta
        </button>
        <button type="button" className={styles.cancel} onClick={close} aria-label="Cancelar">
          <X size={18} />
        </button>
      </div>
    </form>
  );
}
