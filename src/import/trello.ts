import { z } from "zod";
import { limaDate } from "../shared/dates";
import { LABEL_COLORS, type Card, type LabelColor, type ListId } from "../shared/model";

const exportSchema = z.object({
  cards: z.array(
    z.object({
      name: z.string(),
      list: z.string(),
      pos: z.number(),
      desc: z.string().default(""),
      labels: z.array(z.object({ name: z.string().default(""), color: z.string().nullish() })).default([]),
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

type Target = { list: ListId; rank: number };

/** Trabajando and Hoy share En curso. */
const TARGETS: Record<string, Target> = {
  Trabajando: { list: "en_curso", rank: 0 },
  Hoy: { list: "en_curso", rank: 1 },
  "Esta semana": { list: "esta_semana", rank: 0 },
  Pendiente: { list: "pendiente", rank: 0 },
  Completado: { list: "hecho", rank: 0 },
};

/** Trello has more colors than bitacora. The extra ones take the nearest of the six. */
const NEAREST: Record<string, LabelColor> = { sky: "blue", lime: "green", pink: "purple", black: "blue" };

function colorOf(trello: string | null | undefined): LabelColor {
  const base = (trello ?? "").replace(/_(light|dark)$/, "");
  return LABEL_COLORS.find((color) => color === base) ?? NEAREST[base] ?? "blue";
}

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

/** Card ids are global, so the owner is part of the hash: two people importing one export get different ids. */
async function idOf(card: TrelloCard, index: number, ownerKey: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${ownerKey}:${index}:${JSON.stringify(card)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `trello-${hex.slice(0, 16)}`;
}

export type ImportedLabel = { name: string; color: LabelColor };
export type ImportedCard = Omit<Card, "position" | "labelId"> & { label: ImportedLabel | null };

/**
 * Keeps each group's Trello order and derives stable ids from the export and
 * `ownerKey`. A card takes the first Trello label that has a name.
 */
export async function mapTrelloExport(input: unknown, ownerKey: string): Promise<ImportedCard[]> {
  const { cards } = exportSchema.parse(input);

  const mapped = await Promise.all(
    cards.map(async (card, index) => {
      const target = TARGETS[card.list];
      if (!target) throw new Error(`Card "${card.name}" is in the unknown list "${card.list}"`);
      const named = card.labels.find((label) => label.name.trim());
      const entry: ImportedCard = {
        id: await idOf(card, index, ownerKey),
        title: card.name.trim() || "(sin título)",
        description: card.desc,
        label: named ? { name: named.name.trim(), color: colorOf(named.color) } : null,
        requester: null,
        checklist: checklistOf(card),
        list: target.list,
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

/** The user the cards go to: by id, or by the email of an account that exists. */
export type Owner = { id: string } | { email: string };

export const ownerKeyOf = (owner: Owner) => ("id" in owner ? owner.id : owner.email.trim().toLowerCase());

const ownerSql = (owner: Owner) =>
  "id" in owner
    ? quote(owner.id)
    : `(SELECT id FROM users WHERE email = ${quote(owner.email.trim().toLowerCase())})`;

function appendPosition(card: ImportedCard, owner: string): string {
  const group = card.list === "hecho" ? ` AND done_date = ${quote(card.doneDate!)}` : "";
  return `(SELECT coalesce(max(position), 0) + 1 FROM cards WHERE user_id = ${owner} AND list = ${quote(card.list)}${group})`;
}

/**
 * Idempotent statements, one per line: the labels the cards use, then each card
 * at the end of its group. Existing labels and cards are kept, so running the
 * same file twice adds nothing.
 */
export function toSql(cards: ImportedCard[], owner: Owner): string {
  const user = ownerSql(owner);
  const labels = new Map<string, ImportedLabel>();
  for (const card of cards)
    if (card.label && !labels.has(card.label.name)) labels.set(card.label.name, card.label);

  const labelStatements = [...labels.values()].map(
    (label) =>
      `INSERT INTO labels (id, user_id, name, color) VALUES (lower(hex(randomblob(16))), ${user}, ${quote(label.name)}, ${quote(label.color)}) ON CONFLICT DO NOTHING;`,
  );
  const cardStatements = cards.map(
    (card) =>
      "INSERT INTO cards (id, user_id, title, description, label_id, requester, checklist, list, position, done_date) VALUES (" +
      [
        quote(card.id),
        user,
        quote(card.title),
        quote(card.description),
        card.label
          ? `(SELECT id FROM labels WHERE user_id = ${user} AND name = ${quote(card.label.name)})`
          : "NULL",
        nullable(card.requester),
        quote(JSON.stringify(card.checklist)),
        quote(card.list),
        appendPosition(card, user),
        nullable(card.doneDate),
      ].join(", ") +
      ") ON CONFLICT DO NOTHING;",
  );
  return [...labelStatements, ...cardStatements].join("\n");
}
