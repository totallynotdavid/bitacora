import { go, useLocation } from "./useLocation";

/** The open card lives in the URL as `/c/<id>`, so the back button closes it. */
export function useCardRoute() {
  const url = useLocation();
  const id = /^\/c\/([^/]+)$/.exec(url.pathname)?.[1] ?? null;

  return {
    id: id && decodeURIComponent(id),
    open: (cardId: string) => go(`/c/${encodeURIComponent(cardId)}${url.search}`, true),
    close() {
      // A card opened from the board has the board one step back. A loaded `/c/<id>` does not.
      if (history.state?.app) history.back();
      else go(`/${url.search}`);
    },
  };
}
