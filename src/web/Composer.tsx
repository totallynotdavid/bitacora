import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./Composer.module.css";
import { useUi } from "./ui";
import { useEscape } from "./useEscape";

/**
 * "Añade una tarjeta" at the foot of a group, which turns into a textarea.
 * Enter adds the card and leaves the textarea open and empty. Unsent text is
 * kept while the page stays loaded, so the composer is always mounted.
 */
export function Composer({ container }: { container: string }) {
  const ui = useUi();
  const open = ui.composer === container;
  const [text, setText] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const close = () => ui.setComposer(null);
  useEscape(close, open);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!form.current?.contains(event.target as Node)) ui.setComposer(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, ui]);

  if (!open) {
    return (
      <button type="button" className={styles.button} onClick={() => ui.setComposer(container)}>
        <Plus size={16} aria-hidden />
        Añade una tarjeta
      </button>
    );
  }

  const submit = () => {
    const title = text.trim();
    if (!title) return;
    ui.addCard(container, title);
    setText("");
  };

  return (
    <form
      ref={form}
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
        value={text}
        placeholder="Escribe un título para esta tarjeta…"
        aria-label="Título de la tarjeta"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className={styles.actions}>
        <button type="submit" className={styles.submit}>
          Añadir tarjeta
        </button>
        <button type="button" className={styles.cancel} onClick={close} aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
    </form>
  );
}
