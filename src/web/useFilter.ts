import type { Card } from "../shared/model";
import { go, useLocation } from "./useLocation";

/** `label` is a label id, `NO_LABEL` for cards without one, or empty for any. */
export type Filter = { q: string; label: string; requester: string };

export const NO_LABEL = "none";

const PARAMS = { q: "q", label: "etiqueta", requester: "solicitante" } as const;

export function useFilter() {
  const url = useLocation();
  const filter: Filter = {
    q: url.searchParams.get(PARAMS.q) ?? "",
    label: url.searchParams.get(PARAMS.label) ?? "",
    requester: url.searchParams.get(PARAMS.requester) ?? "",
  };

  function set(next: Filter) {
    const params = new URLSearchParams(url.search);
    for (const key of Object.keys(PARAMS) as (keyof Filter)[]) {
      if (next[key]) params.set(PARAMS[key], next[key]);
      else params.delete(PARAMS[key]);
    }
    const query = params.toString();
    go(url.pathname + (query ? `?${query}` : ""));
  }

  return {
    filter,
    active: Boolean(filter.q || filter.label || filter.requester),
    set,
    clear: () => set({ q: "", label: "", requester: "" }),
  };
}

export function matches(card: Card, filter: Filter): boolean {
  const text = filter.q.trim().toLowerCase();
  if (text && !`${card.title}\n${card.description}`.toLowerCase().includes(text)) return false;
  if (filter.label === NO_LABEL ? card.labelId !== null : filter.label && card.labelId !== filter.label)
    return false;
  if (filter.requester && card.requester !== filter.requester) return false;
  return true;
}
