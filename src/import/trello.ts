import { z } from "zod";
import { limaDate } from "../shared/dates";
import type { Card, ListId } from "../shared/model";

const exportSchema = z.object({
  cards: z.array(
    z.object({
      name: z.string(),
      list: z.string(),
      pos: z.number(),
      desc: z.string().default(""),
      labels: z.array(z.object({ name: z.string().default("") })).default([]),
      checklists: z
        .array(
          z.object({
            name: z.string().default(""),
            items: z.array(z.object({ name: z.string(), done: z.boolean() })),
          }),
        )
        .default([]),
      lastActivity: z.string().optional(),
      history: z.array(z.object({ to: z.string().optional(), at: z.string() })).default([]),
    }),
  ),
});

type TrelloCard = z.infer<typeof exportSchema>["cards"][number];

type Target = { list: ListId; later: boolean; rank: number };

/** Trabajando and Hoy share En curso. Esta semana and Pendiente differ only by `later`. */
const TARGETS: Record<string, Target> = {
  Trabajando: { list: "en_curso", later: false, rank: 0 },
  Hoy: { list: "en_curso", later: false, rank: 1 },
  "Esta semana": { list: "pendiente", later: false, rank: 0 },
  Pendiente: { list: "pendiente", later: true, rank: 0 },
  Completado: { list: "hecho", later: false, rank: 0 },
};

const DONE_LIST = "Completado";

/** Lima date of the last move into Completado. A card created there counts from its creation. */
function doneDateOf(card: TrelloCard): string {
  const moves = card.history.filter((entry) => entry.to === DONE_LIST).map((entry) => entry.at);
  const at = moves.toSorted().at(-1) ?? card.lastActivity;
  if (!at) throw new Error(`Card "${card.name}" is in ${DONE_LIST} but has no date to take`);
  return limaDate(new Date(at));
}

function checklistOf(card: TrelloCard): Card["checklist"] {
  const named = card.checklists.length > 1;
  return card.checklists.flatMap((checklist) =>
    checklist.items.map((item) => ({
      text: named && checklist.name ? `${checklist.name}: ${item.name}` : item.name,
      done: item.done,
    })),
  );
}

async function idOf(card: TrelloCard, index: number): Promise<string> {
  const bytes = new TextEncoder().encode(`${index}:${JSON.stringify(card)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `trello-${hex.slice(0, 16)}`;
}

export type ImportedCard = Omit<Card, "position">;

/** Keeps each group's Trello order and derives stable ids from the export. */
export async function mapTrelloExport(input: unknown): Promise<ImportedCard[]> {
  const { cards } = exportSchema.parse(input);

  const mapped = await Promise.all(
    cards.map(async (card, index) => {
      const target = TARGETS[card.list];
      if (!target) throw new Error(`Card "${card.name}" is in the unknown list "${card.list}"`);
      const entry: ImportedCard = {
        id: await idOf(card, index),
        title: card.name.trim() || "(sin título)",
        description: card.desc,
        category: "Otros",
        requester: card.labels.map((label) => label.name.trim()).find(Boolean) ?? null,
        checklist: checklistOf(card),
        list: target.list,
        later: target.later,
        doneDate: target.list === "hecho" ? doneDateOf(card) : null,
      };
      return { entry, rank: target.rank, pos: card.pos };
    }),
  );

  return mapped.toSorted((a, b) => a.rank - b.rank || a.pos - b.pos).map(({ entry }) => entry);
}

// Line breaks leave the literal as char() calls so every statement stays on one
// line. D1's `exec` splits a file into statements by line.
const quote = (value: string) =>
  value
    .split(/(\r\n|\n|\r)/)
    .map((part) =>
      part === "\n"
        ? "char(10)"
        : part === "\r"
          ? "char(13)"
          : part === "\r\n"
            ? "char(13) || char(10)"
            : `'${part.replaceAll("'", "''")}'`,
    )
    .join(" || ");
const nullable = (value: string | null) => (value === null ? "NULL" : quote(value));

function appendPosition(card: ImportedCard): string {
  const group =
    card.list === "hecho"
      ? `done_date = ${quote(card.doneDate!)}`
      : card.list === "pendiente"
        ? `later = ${card.later ? 1 : 0}`
        : "1";
  return `(SELECT coalesce(max(position), 0) + 1 FROM cards WHERE list = ${quote(card.list)} AND ${group})`;
}

/**
 * One idempotent INSERT per card, in order. Each card goes to the end of its
 * group, so importing into a board with cards keeps them. Running the same file
 * twice adds nothing.
 */
export function toSql(cards: ImportedCard[]): string {
  return cards
    .map(
      (card) =>
        "INSERT OR IGNORE INTO cards (id, title, description, category, requester, checklist, list, later, position, done_date) VALUES (" +
        [
          quote(card.id),
          quote(card.title),
          quote(card.description),
          quote(card.category),
          nullable(card.requester),
          quote(JSON.stringify(card.checklist)),
          quote(card.list),
          card.later ? 1 : 0,
          appendPosition(card),
          nullable(card.doneDate),
        ].join(", ") +
        ");",
    )
    .join("\n");
}
