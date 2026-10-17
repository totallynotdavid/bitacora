import { Check, ChevronDown, CircleUser, Keyboard, LogOut, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./UserMenu.module.css";
import { readTheme, saveTheme, THEME_TITLES, THEMES, type Theme } from "./theme";
import { useEscape } from "./useEscape";

/** Arrow keys move focus through the menu items. */
function onKeyDown(event: React.KeyboardEvent) {
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role^='menuitem']")];
  const at = items.indexOf(document.activeElement as HTMLElement);
  items[(at + step + items.length) % items.length]?.focus();
}

export function UserMenu(props: { name: string | null; onSettings: () => void; onShortcuts: () => void }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  useEscape(() => {
    close();
    trigger.current?.focus();
  }, open);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>("[role^='menuitem']")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const choose = (action: () => void) => () => {
    close();
    action();
  };

  return (
    <div ref={root} className={styles.root}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <CircleUser size={16} aria-hidden />
        <span className={styles.name}>{props.name ?? "Cuenta"}</span>
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <div
          className={styles.menu}
          role="menu"
          aria-label="Cuenta"
          data-elevation="overlay"
          onKeyDown={onKeyDown}
        >
          <button type="button" role="menuitem" className={styles.item} onClick={choose(props.onSettings)}>
            <Settings size={16} aria-hidden /> Ajustes
          </button>
          <div role="group" aria-labelledby="theme-heading">
            <p id="theme-heading" className={styles.heading}>
              Tema
            </p>
            {THEMES.map((option) => (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={theme === option}
                className={styles.item}
                onClick={() => {
                  saveTheme(option);
                  setTheme(option);
                }}
              >
                {theme === option ? <Check size={16} aria-hidden /> : <span className={styles.blank} />}
                {THEME_TITLES[option]}
              </button>
            ))}
          </div>
          <button type="button" role="menuitem" className={styles.item} onClick={choose(props.onShortcuts)}>
            <Keyboard size={16} aria-hidden /> Atajos de teclado
          </button>
          <form method="post" action="/logout" className={styles.logout}>
            <button type="submit" role="menuitem" className={styles.item}>
              <LogOut size={16} aria-hidden /> Salir
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
