import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./Dialog.module.css";
import { useEscape } from "./useEscape";

/**
 * A modal on the native `<dialog>`, which traps focus. Escape closes it through
 * `useEscape`, so a popover or composer opened above it closes first.
 */
export function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const close = () => ref.current?.close();
  useEscape(close);

  return {
    ref,
    close,
    props: {
      ref,
      // Escape goes through useEscape. A cancel that gets here closes nothing.
      onCancel: (event: { preventDefault(): void }) => event.preventDefault(),
      onClick: (event: { target: unknown }) => {
        if (event.target === ref.current) ref.current?.close();
      },
    },
  };
}

export function Dialog(props: { title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const modal = useModal();
  const titleId = useId();

  return (
    <dialog
      {...modal.props}
      className={styles.dialog}
      data-elevation="modal"
      data-wide={props.wide}
      aria-labelledby={titleId}
      onClose={props.onClose}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {props.title}
          </h2>
          <button type="button" className={styles.close} aria-label="Cerrar" onClick={modal.close}>
            <X size={16} aria-hidden />
          </button>
        </header>
        {props.children}
      </div>
    </dialog>
  );
}
