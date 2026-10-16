import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Popover.module.css";
import { useEscape } from "./useEscape";

const WIDTH = 304;
const MARGIN = 8;

/** A small panel under `anchor`. Escape, the close button or a click elsewhere closes it. */
export function Popover(props: {
  title: string;
  anchor: HTMLElement;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  useEscape(props.onClose);

  useLayoutEffect(() => {
    const anchor = props.anchor.getBoundingClientRect();
    const height = ref.current?.offsetHeight ?? 0;
    const left = Math.min(Math.max(MARGIN, anchor.left), innerWidth - WIDTH - MARGIN);
    const below = anchor.bottom + 4;
    const top = below + height > innerHeight - MARGIN ? Math.max(MARGIN, anchor.top - height - 4) : below;
    setPlace({ left, top });
  }, [props.anchor]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !props.anchor.contains(target)) props.onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });

  return (
    <div
      ref={ref}
      className={styles.popover}
      role="dialog"
      aria-label={props.title}
      style={{ left: place?.left, top: place?.top, visibility: place ? "visible" : "hidden" }}
    >
      <header className={styles.header}>
        <h3 className={styles.title}>{props.title}</h3>
        <button type="button" className={styles.close} aria-label="Cerrar" onClick={props.onClose}>
          <X size={16} />
        </button>
      </header>
      {props.children}
    </div>
  );
}
