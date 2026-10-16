import { and, asc, desc, eq, gte, lt, lte, max, ne, sql, type Query, type SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { weekDays, weekOf } from "../shared/dates";
import type { Card, ListId } from "../shared/model";
import type { CreateCard, UpdateCard } from "../shared/schemas";
import { cards } from "./db/schema";

export type Db = DrizzleD1Database & { $client: D1Database };

type Placement = { list: ListId; later: boolean; doneDate: string | null };

export class InvalidCard extends Error {}

const byBoardOrder = [asc(cards.list), asc(cards.later), asc(cards.doneDate), asc(cards.position)];

function sameGroup(a: Placement, b: Placement): boolean {
  return a.list === b.list && a.later === b.later && a.doneDate === b.doneDate;
}

type Requested = { list?: ListId; later?: boolean; doneDate?: string };

/**
 * Where a card lands. Entering Hecho dates the card today unless a date is given.
 * Leaving Hecho clears the date. A card entering Pendiente starts in "Esta semana".
 */
function resolvePlacement(card: Card, requested: Requested, today: string): Placement {
  const list = requested.list ?? card.list;
  const later = list === "pendiente" && (requested.later ?? (list === card.list && card.later));
  if (list !== "hecho") return { list, later, doneDate: null };

  const doneDate = requested.doneDate ?? (card.list === "hecho" ? card.doneDate : today);
  if (doneDate! > today) throw new InvalidCard("doneDate is in the future");
  return { list, later, doneDate };
}

export async function getCard(db: Db, id: string): Promise<Card | undefined> {
  return db.select().from(cards).where(eq(cards.id, id)).get();
}

export async function pendingAndActive(db: Db): Promise<Card[]> {
  return db
    .select()
    .from(cards)
    .where(ne(cards.list, "hecho"))
    .orderBy(...byBoardOrder);
}

export async function doneInWeek(db: Db, week: string): Promise<Card[]> {
  const days = weekDays(week);
  return db
    .select()
    .from(cards)
    .where(and(gte(cards.doneDate, days[0]!), lte(cards.doneDate, days[6]!)))
    .orderBy(desc(cards.doneDate), asc(cards.position));
}

export async function olderWeekWithCards(db: Db, week: string): Promise<string | null> {
  const start = weekDays(week)[0]!;
  const row = await db
    .select({ date: max(cards.doneDate) })
    .from(cards)
    .where(lt(cards.doneDate, start))
    .get();
  return row?.date ? weekOf(row.date) : null;
}

export async function requesterSuggestions(db: Db): Promise<string[]> {
  const rows = await db
    .select({ requester: cards.requester })
    .from(cards)
    .where(sql`${cards.requester} is not null`)
    .groupBy(cards.requester)
    .orderBy(desc(sql`count(*)`), asc(cards.requester));
  return rows.map((row) => row.requester!);
}

/** The group as a WHERE fragment on unqualified columns, valid in any subquery over `cards`. */
function groupWhere(p: Placement): SQL {
  if (p.list === "hecho") return sql`list = 'hecho' and done_date = ${p.doneDate}`;
  if (p.list === "pendiente") return sql`list = 'pendiente' and later = ${p.later ? 1 : 0}`;
  return sql`list = 'en_curso'`;
}

/**
 * Positions are computed inside the statement that writes them, so two requests
 * touching one group cannot read the same "last position".
 */
const endOfGroup = (p: Placement, except?: string): SQL =>
  sql`(select coalesce(max(position), 0) + 1 from cards where ${groupWhere(p)}${except ? sql` and id <> ${except}` : sql``})`;

/**
 * Rewrites a group's positions as 1..n in their current order. The ranks are
 * materialized first: ranking while rows change would read half-updated positions.
 */
const renumber = (p: Placement): SQL => sql`
  with ranked as materialized (
    select id, row_number() over (order by position, id) as rank from cards where ${groupWhere(p)}
  )
  update cards set position = (select rank from ranked where ranked.id = cards.id) where ${groupWhere(p)}`;

const dialect = new SQLiteSyncDialect();

/** Runs statements as one D1 batch, which D1 executes as a transaction. */
async function batch(db: Db, statements: (SQL | { toSQL(): Query })[]): Promise<void> {
  const prepared = statements.map((statement) => {
    const { sql: text, params } = "toSQL" in statement ? statement.toSQL() : dialect.sqlToQuery(statement);
    return db.$client.prepare(text).bind(...params);
  });
  await db.$client.batch(prepared);
}

export async function createCard(db: Db, input: CreateCard, today: string): Promise<Card> {
  const placement: Placement = {
    list: input.list,
    later: input.list === "pendiente" && input.later,
    doneDate: input.list === "hecho" ? today : null,
  };
  const id = input.id ?? crypto.randomUUID();
  const created = await db
    .insert(cards)
    .values({ id, title: input.title, ...placement, position: endOfGroup(placement) })
    .onConflictDoNothing()
    .returning()
    .get();
  // A repeated create with the same id returns the card the first one made.
  return created ?? (await getCard(db, id))!;
}

/**
 * Applies a patch. A move into a group, or to a given index, is one D1 batch: the
 * card takes a slot computed in SQL and both groups are renumbered 1..n, so
 * concurrent moves leave distinct positions. A plain edit writes only its fields.
 */
export async function updateCard(
  db: Db,
  card: Card,
  patch: UpdateCard,
  today: string,
  index?: number,
): Promise<Card> {
  const { list, later, doneDate, ...fields } = patch;
  const placement = resolvePlacement(card, { list, later, doneDate }, today);
  const moved = !sameGroup(card, placement);

  if (!moved && index === undefined) {
    await db.update(cards).set(fields).where(eq(cards.id, card.id));
    return { ...card, ...fields };
  }

  // Place the card half a step before the card at `index`, or at the end.
  // Renumbering turns the temporary position into an integer.
  const before =
    index === undefined
      ? sql`null`
      : sql`(select position from cards where ${groupWhere(placement)} and id <> ${card.id} order by position, id limit 1 offset ${index}) - 0.5`;
  const own = db
    .update(cards)
    .set({ ...fields, ...placement, position: sql`coalesce(${before}, ${endOfGroup(placement, card.id)})` })
    .where(eq(cards.id, card.id));
  await batch(db, [own, renumber(placement), ...(moved ? [renumber(card)] : [])]);
  return (await getCard(db, card.id))!;
}

export async function deleteCard(db: Db, id: string): Promise<boolean> {
  const deleted = await db.delete(cards).where(eq(cards.id, id)).returning({ id: cards.id });
  return deleted.length > 0;
}
