import { AlignLeft } from "lucide-react";
import { useState } from "react";
import styles from "./Description.module.css";
import { useAutosize } from "./useAutosize";
import { useEscape } from "./useEscape";

const PLACEHOLDER = "Añade una descripción más detallada…";

export function Description(props: { value: string; onSave: (description: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.value);
  const field = useAutosize();
  useEscape(() => setEditing(false), editing);

  const save = () => {
    if (draft !== props.value) props.onSave(draft);
    setEditing(false);
  };

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h3 className={styles.heading}>
          <AlignLeft size={16} aria-hidden /> Descripción
        </h3>
        {props.value && !editing && (
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setDraft(props.value);
              setEditing(true);
            }}
          >
            Editar
          </button>
        )}
      </header>
      {editing ? (
        <div>
          <textarea
            ref={field}
            className={styles.field}
            autoFocus
            rows={4}
            maxLength={10_000}
            value={draft}
            aria-label="Descripción"
            placeholder={PLACEHOLDER}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                save();
              }
            }}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={save}>
              Guardar
            </button>
            <button type="button" className={styles.button} onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={props.value ? styles.text : styles.empty}
          onClick={() => {
            setDraft(props.value);
            setEditing(true);
          }}
        >
          {props.value || PLACEHOLDER}
        </button>
      )}
    </section>
  );
}
