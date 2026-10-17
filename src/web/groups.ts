import type { Card, ListId } from "../shared/model";

/** The unit a card is ordered in: one of the first three lists, or one day of Hecho. */
export type Container = { list: ListId; doneDate: string | null };

export function containerOf(card: Container): Container {
  return { list: card.list, doneDate: card.doneDate };
}

export function containerId(c: Container): string {
  return c.list === "hecho" ? `hecho:${c.doneDate}` : c.list;
}

/** A day group is also dropped on through its header, whose id adds this suffix. */
export const HEADER_SUFFIX = ":header";

export function parseContainerId(raw: string): Container | null {
  const id = raw.endsWith(HEADER_SUFFIX) ? raw.slice(0, -HEADER_SUFFIX.length) : raw;
  if (id === "pendiente" || id === "esta_semana" || id === "en_curso") return { list: id, doneDate: null };
  if (id.startsWith("hecho:")) return { list: "hecho", doneDate: id.slice(6) };
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

/** The container with the date its list does not use cleared, as the server stores it. */
function normalized(target: Container): Container {
  return { list: target.list, doneDate: target.list === "hecho" ? target.doneDate : null };
}

/**
 * Puts a card into a container just before `beforeId`, or at the end when that
 * card is not in the container. The container's positions become 1..n.
 */
export function placeCard(cards: Card[], id: string, target: Container, beforeId: string | null): Card[] {
  const moving = cards.find((card) => card.id === id);
  if (!moving) return cards;
  const rest = cards.filter((card) => card.id !== id);
  const peers = inContainer(rest, target);
  const at = beforeId === null ? -1 : peers.findIndex((card) => card.id === beforeId);
  peers.splice(at < 0 ? peers.length : at, 0, { ...moving, ...normalized(target) });
  const renumbered = new Map(peers.map((card, i) => [card.id, { ...card, position: i + 1 }]));
  return [...rest.filter((card) => !renumbered.has(card.id)), ...renumbered.values()];
}
