import { useEffect, useRef } from "react";

type Handler = { current: () => void };

const layers: Handler[] = [];

function onKeyDown(event: KeyboardEvent) {
  const top = layers.at(-1);
  if (event.key !== "Escape" || event.defaultPrevented || !top) return;
  // Without this the browser would also close a native dialog that is open below.
  event.preventDefault();
  top.current();
}

/**
 * Registers a layer (popover, dialog, composer) that Escape closes. Only the
 * layer opened last answers, so Escape peels them off from the top.
 */
export function useEscape(close: () => void, active = true) {
  const handler = useRef(close);
  useEffect(() => {
    handler.current = close;
  });

  useEffect(() => {
    if (!active) return;
    if (layers.length === 0) addEventListener("keydown", onKeyDown);
    layers.push(handler);
    return () => {
      layers.splice(layers.indexOf(handler), 1);
      if (layers.length === 0) removeEventListener("keydown", onKeyDown);
    };
  }, [active]);
}
