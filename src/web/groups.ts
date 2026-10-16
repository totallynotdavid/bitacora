import type { Card, ListId } from "../shared/model";

/** The unit a card is ordered in: a Pendiente group, En curso, or one day of Hecho. */
export type Container = { list: ListId; later: boolean; doneDate: string | null };

export function containerOf(card: Container): Container {
  return { list: card.list, later: card.later, doneDate: card.doneDate };
}

export function containerId(c: Container): string {
  if (c.list === "hecho") return `hecho:${c.doneDate}`;
  if (c.list === "pendiente") return c.later ? "pendiente:later" : "pendiente:week";
  return "en_curso";
}

/** A collapsed day group is dropped on through its header, whose id adds this suffix. */
export const HEADER_SUFFIX = ":header";

export function parseContainerId(raw: string): Container | null {
  const id = raw.endsWith(HEADER_SUFFIX) ? raw.slice(0, -HEADER_SUFFIX.length) : raw;
  if (id === "en_curso") return { list: "en_curso", later: false, doneDate: null };
  if (id === "pendiente:week") return { list: "pendiente", later: false, doneDate: null };
  if (id === "pendiente:later") return { list: "pendiente", later: true, doneDate: null };
  if (id.startsWith("hecho:")) return { list: "hecho", later: false, doneDate: id.slice(6) };
  return null;
}

export function inContainer(cards: Card[], container: Container): Card[] {
  const id = containerId(container);
  return cards.filter((card) => containerId(card) === id).toSorted((a, b) => a.position - b.position);
}

export function doneDays(cards: Card[]): string[] {
  const days = new Set(cards.flatMap((card) => (card.doneDate ? [card.doneDate] : [])));
  return [...days].toSorted().toReversed();
}
