import { X } from "lucide-react";
import styles from "./Toasts.module.css";
import type { Toast } from "./useBoard";

export function Toasts(props: { toasts: Toast[]; onClose: (id: number) => void }) {
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {props.toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.action!.run();
                props.onClose(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className={styles.close}
            aria-label="Cerrar aviso"
            onClick={() => props.onClose(toast.id)}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
