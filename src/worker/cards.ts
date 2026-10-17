import { and, asc, desc, eq, gte, lt, lte, max, ne, sql, type SQL } from "drizzle-orm";
import { weekDays, weekOf } from "../shared/dates";
import type { Card, ListId } from "../shared/model";
import type { CreateCard, UpdateCard } from "../shared/schemas";
import { batch, type Db } from "./db/client";
import { cards, labels } from "./db/schema";

type Placement = { list: ListId; doneDate: string | null };

export class InvalidCard extends Error {}

/** A create named an id that another user's card already has. */
export class CardIdTaken extends Error {}

/** The columns of a `Card`. `user_id` never leaves the module. */
const cardColumns = {
  id: cards.id,
  title: cards.title,
  description: cards.description,
  labelId: cards.labelId,
  requester: cards.requester,
  checklist: cards.checklist,
  list: cards.list,
  position: cards.position,
  doneDate: cards.doneDate,
};

const byBoardOrder = [asc(cards.list), asc(cards.doneDate), asc(cards.position)];

function sameGroup(a: Placement, b: Placement): boolean {
  return a.list === b.list && a.doneDate === b.doneDate;
}

type Requested = { list?: ListId; doneDate?: string };

/** Where a card lands. Entering Hecho dates the card today unless a date is given. Leaving Hecho clears the date. */
function resolvePlacement(card: Card, requested: Requested, today: string): Placement {
  const list = requested.list ?? card.list;
  if (list !== "hecho") return { list, doneDate: null };

  const doneDate = requested.doneDate ?? (card.list === "hecho" ? card.doneDate : today);
  if (doneDate! > today) throw new InvalidCard("doneDate is in the future");
  return { list, doneDate };
}

/**
 * A group as a WHERE fragment on unqualified columns, valid in any subquery over
 * `cards`. It names the user, so a statement built from it cannot reach another
 * user's cards.
 */
function groupWhere(userId: string, p: Placement): SQL {
  const owner = sql`user_id = ${userId} and list = ${p.list}`;
  return p.list === "hecho" ? sql`${owner} and done_date = ${p.doneDate}` : owner;
}

/**
 * Positions are computed inside the statement that writes them, so two requests
 * touching one group cannot read the same "last position".
 */
const endOfGroup = (userId: string, p: Placement, except?: string): SQL =>
  sql`(select coalesce(max(position), 0) + 1 from cards where ${groupWhere(userId, p)}${except ? sql` and id <> ${except}` : sql``})`;

/**
 * Rewrites a group's positions as 1..n in their current order. The ranks are
 * materialized first: ranking while rows change would read half-updated positions.
 */
const renumber = (userId: string, p: Placement): SQL => sql`
  with ranked as materialized (
    select id, row_number() over (order by position, id) as rank from cards where ${groupWhere(userId, p)}
  )
  update cards set position = (select rank from ranked where ranked.id = cards.id) where ${groupWhere(userId, p)}`;

/**
 * Every read and write of cards, for one user. The user id comes from the
 * session, and every statement here names it, so a route cannot reach another
 * user's cards.
 */
export function cardsOf(db: Db, userId: string) {
  const mine = eq(cards.userId, userId);

  const get = async (id: string): Promise<Card | undefined> =>
    db
      .select(cardColumns)
      .from(cards)
      .where(and(eq(cards.id, id), mine))
      .get();

  return {
    get,

    async pendingAndActive(): Promise<Card[]> {
      return db
        .select(cardColumns)
        .from(cards)
        .where(and(mine, ne(cards.list, "hecho")))
        .orderBy(...byBoardOrder);
    },

    async doneInWeek(week: string): Promise<Card[]> {
      const days = weekDays(week);
      return db
        .select(cardColumns)
        .from(cards)
        .where(and(mine, gte(cards.doneDate, days[0]!), lte(cards.doneDate, days[6]!)))
        .orderBy(desc(cards.doneDate), asc(cards.position));
    },

    async olderWeekWithCards(week: string): Promise<string | null> {
      const start = weekDays(week)[0]!;
      const row = await db
        .select({ date: max(cards.doneDate) })
        .from(cards)
        .where(and(mine, lt(cards.doneDate, start)))
        .get();
      return row?.date ? weekOf(row.date) : null;
    },

    async requesterSuggestions(): Promise<string[]> {
      const rows = await db
        .select({ requester: cards.requester })
        .from(cards)
        .where(and(mine, sql`${cards.requester} is not null`))
        .groupBy(cards.requester)
        .orderBy(desc(sql`count(*)`), asc(cards.requester));
      return rows.map((row) => row.requester!);
    },

    /**
     * Creates a card at the end of its list. A repeated create with the same id
     * returns the card the first one made. An id that another user's card has
     * throws `CardIdTaken`.
     */
    async create(input: CreateCard, today: string): Promise<Card> {
      const placement: Placement = {
        list: input.list,
        doneDate: input.list === "hecho" ? today : null,
      };
      const id = input.id ?? crypto.randomUUID();
      const created = await db
        .insert(cards)
        .values({ id, userId, title: input.title, ...placement, position: endOfGroup(userId, placement) })
        .onConflictDoNothing()
        .returning(cardColumns)
        .get();
      if (created) return created;
      const existing = await get(id);
      if (!existing) throw new CardIdTaken();
      return existing;
    },

    /**
     * Applies a patch. A move is one D1 batch that renumbers both groups 1..n,
     * so concurrent moves leave distinct positions.
     */
    async update(card: Card, patch: UpdateCard, today: string, index?: number): Promise<Card> {
      const { list, doneDate, ...fields } = patch;
      const placement = resolvePlacement(card, { list, doneDate }, today);
      const moved = !sameGroup(card, placement);

      if (fields.labelId) {
        const label = await db
          .select({ id: labels.id })
          .from(labels)
          .where(and(eq(labels.id, fields.labelId), eq(labels.userId, userId)))
          .get();
        if (!label) throw new InvalidCard("unknown label");
      }

      if (!moved && index === undefined) {
        if (Object.keys(fields).length === 0) return card;
        await db
          .update(cards)
          .set(fields)
          .where(and(eq(cards.id, card.id), mine));
        return { ...card, ...fields };
      }

      // Place the card half a step before the card at `index`, or at the end.
      // Renumbering turns the temporary position into an integer.
      const before =
        index === undefined
          ? sql`null`
          : sql`(select position from cards where ${groupWhere(userId, placement)} and id <> ${card.id} order by position, id limit 1 offset ${index}) - 0.5`;
      const own = db
        .update(cards)
        .set({
          ...fields,
          ...placement,
          position: sql`coalesce(${before}, ${endOfGroup(userId, placement, card.id)})`,
        })
        .where(and(eq(cards.id, card.id), mine));
      await batch(db, [own, renumber(userId, placement), ...(moved ? [renumber(userId, card)] : [])]);
      return (await get(card.id))!;
    },

    async delete(id: string): Promise<boolean> {
      const deleted = await db
        .delete(cards)
        .where(and(eq(cards.id, id), mine))
        .returning({ id: cards.id });
      return deleted.length > 0;
    },
  };
}

export type UserCards = ReturnType<typeof cardsOf>;
