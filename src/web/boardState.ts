import type { Card } from "../shared/model";
import type { UpdateCard } from "../shared/schemas";
import { inContainer, placeCard, type Container } from "./groups";

/** The card fields a plain edit can change. Placement changes go through a move. */
export type Fields = Pick<UpdateCard, "title" | "description" | "category" | "requester" | "checklist">;

/** One change the user made, shown at once and written in the background. */
export type Op =
  | { kind: "create"; card: Card }
  | { kind: "edit"; id: string; fields: Fields }
  | { kind: "move"; id: string; to: Container; beforeId: string | null }
  | { kind: "remove"; id: string };

/** `held` waits for an undo, `queued` waits its turn, `sending` is on the wire. */
export type Pending = { key: number; op: Op; phase: "held" | "queued" | "sending" };

function endOf(cards: Card[], card: Card): number {
  const last = inContainer(cards, card).at(-1);
  return last ? last.position + 1 : 1;
}

/** The cards after one change. A removal hides the card instead, see `hiddenIds`. */
export function applyOp(cards: Card[], op: Op): Card[] {
  switch (op.kind) {
    case "create":
      // A card read from the server while its create was on the wire is already there.
      if (cards.some((card) => card.id === op.card.id)) return cards;
      return [...cards, { ...op.card, position: endOf(cards, op.card) }];
    case "edit":
      return cards.map((card) => (card.id === op.id ? { ...card, ...op.fields } : card));
    case "move":
      return placeCard(cards, op.id, op.to, op.beforeId);
    case "remove":
      return cards;
  }
}

/** What the screen shows: the server's cards with every pending change on top. */
export function project(base: Card[], pending: Pending[]): { all: Card[]; visible: Card[] } {
  const all = pending.reduce((cards, { op }) => applyOp(cards, op), base);
  const hidden = new Set(pending.flatMap(({ op }) => (op.kind === "remove" ? [op.id] : [])));
  return { all, visible: all.filter((card) => !hidden.has(card.id)) };
}

/**
 * The index a move has on the server, which holds `base` once every earlier
 * write has settled: the slot before `beforeId`, or the end of the group.
 */
export function serverIndex(base: Card[], op: Extract<Op, { kind: "move" }>): number {
  const peers = inContainer(
    base.filter((card) => card.id !== op.id),
    op.to,
  );
  const at = op.beforeId === null ? -1 : peers.findIndex((card) => card.id === op.beforeId);
  return at < 0 ? peers.length : at;
}

/** The server's cards after a change succeeded: the change, then the server's own answer for the card. */
export function settled(base: Card[], op: Op, answer: Card | undefined): Card[] {
  if (op.kind === "remove") return base.filter((card) => card.id !== op.id);
  const next = applyOp(base, op);
  return answer ? next.map((card) => (card.id === answer.id ? answer : card)) : next;
}
