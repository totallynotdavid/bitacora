import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./Dialog.module.css";

/** A modal on the native `<dialog>`: it traps focus and closes on Escape. */
export function Dialog(props: { title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      data-wide={props.wide}
      aria-labelledby={titleId}
      onClose={props.onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {props.title}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Cerrar"
            onClick={() => ref.current?.close()}
          >
            <X size={18} />
          </button>
        </header>
        {props.children}
      </div>
    </dialog>
  );
}
