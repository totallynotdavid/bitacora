import { useSyncExternalStore } from "react";

const CHANGE = "bitacora:location";

function subscribe(listener: () => void) {
  addEventListener("popstate", listener);
  addEventListener(CHANGE, listener);
  return () => {
    removeEventListener("popstate", listener);
    removeEventListener(CHANGE, listener);
  };
}

const snapshot = () => location.pathname + location.search;

export function useLocation(): URL {
  const href = useSyncExternalStore(subscribe, snapshot);
  return new URL(href, location.origin);
}

/** Changes the URL without a page load. `push` adds a history entry, otherwise the current one is replaced. */
export function go(url: string, push = false) {
  history[push ? "pushState" : "replaceState"](push ? { app: true } : history.state, "", url);
  dispatchEvent(new Event(CHANGE));
}
