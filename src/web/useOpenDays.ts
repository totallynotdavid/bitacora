import { useState } from "react";

const KEY = "bitacora.hecho-open";

function read(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

/** Open or closed state of each day in Hecho. Today starts open, earlier days closed. */
export function useOpenDays(today: string) {
  const [stored, setStored] = useState(read);

  const isOpen = (date: string) => stored[date] ?? date === today;

  function toggle(date: string) {
    const next = { ...stored, [date]: !isOpen(date) };
    localStorage.setItem(KEY, JSON.stringify(next));
    setStored(next);
  }

  return { isOpen, toggle };
}
