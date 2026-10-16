import type { Card, Category } from "../shared/model";
import { go, useLocation } from "./useLocation";

export type Filter = { q: string; category: Category | ""; requester: string };

const PARAMS = { q: "q", category: "categoria", requester: "solicitante" } as const;

export function useFilter() {
  const url = useLocation();
  const filter: Filter = {
    q: url.searchParams.get(PARAMS.q) ?? "",
    category: (url.searchParams.get(PARAMS.category) ?? "") as Category | "",
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
    active: Boolean(filter.q || filter.category || filter.requester),
    set,
    clear: () => set({ q: "", category: "", requester: "" }),
  };
}

export function matches(card: Card, filter: Filter): boolean {
  const text = filter.q.trim().toLowerCase();
  if (text && !`${card.title}\n${card.description}`.toLowerCase().includes(text)) return false;
  if (filter.category && card.category !== filter.category) return false;
  if (filter.requester && card.requester !== filter.requester) return false;
  return true;
}
