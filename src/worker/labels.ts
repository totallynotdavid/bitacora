import { and, asc, eq } from "drizzle-orm";
import type { Label } from "../shared/model";
import type { CreateLabel, UpdateLabel } from "../shared/schemas";
import { isUniqueViolation, type Db } from "./db/client";
import { labels } from "./db/schema";

/** The user already has a label with that name, or the id belongs to someone else. */
export class LabelConflict extends Error {}

const labelColumns = { id: labels.id, name: labels.name, color: labels.color };

/**
 * Every read and write of labels, for one user. Deleting a label clears it from
 * the cards that carry it (`cards.label_id` is `ON DELETE SET NULL`).
 */
export function labelsOf(db: Db, userId: string) {
  const mine = eq(labels.userId, userId);

  const get = (id: string): Promise<Label | undefined> =>
    db
      .select(labelColumns)
      .from(labels)
      .where(and(eq(labels.id, id), mine))
      .get();

  return {
    list(): Promise<Label[]> {
      return db.select(labelColumns).from(labels).where(mine).orderBy(asc(labels.name));
    },

    /** A repeated create with the same id returns the label the first one made. */
    async create(input: CreateLabel): Promise<Label> {
      const id = input.id ?? crypto.randomUUID();
      const created = await db
        .insert(labels)
        .values({ id, userId, name: input.name, color: input.color })
        .onConflictDoNothing()
        .returning(labelColumns)
        .get();
      if (created) return created;
      const existing = await get(id);
      if (!existing) throw new LabelConflict();
      return existing;
    },

    async update(id: string, patch: UpdateLabel): Promise<Label | undefined> {
      if (Object.keys(patch).length === 0) return get(id);
      try {
        return await db
          .update(labels)
          .set(patch)
          .where(and(eq(labels.id, id), mine))
          .returning(labelColumns)
          .get();
      } catch (error) {
        if (isUniqueViolation(error)) throw new LabelConflict();
        throw error;
      }
    },

    async delete(id: string): Promise<boolean> {
      const deleted = await db
        .delete(labels)
        .where(and(eq(labels.id, id), mine))
        .returning({ id: labels.id });
      return deleted.length > 0;
    },
  };
}
