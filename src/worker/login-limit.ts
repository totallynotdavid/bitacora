import { sql } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import type { Db } from "./db/client";
import { loginAttempts } from "./db/schema";
import { nowSeconds } from "./links";

export const MAX_ATTEMPTS = 5;
export const WINDOW_SECONDS = 15 * 60;

const dialect = new SQLiteSyncDialect();

/**
 * Counts one attempt in a single upsert and returns the unix second until which
 * the key is refused, or null. The sixth attempt in a window locks the key,
 * whatever it carries. A locked row does not change. Inserting a row
 * deletes, through a trigger, the rows whose window and lock have ended.
 */
export async function countAttempt(db: Db, key: string): Promise<number | null> {
  const now = nowSeconds();
  const windowOpen = sql`${loginAttempts.windowStart} > ${now - WINDOW_SECONDS}`;
  const locked = sql`${loginAttempts.lockedUntil} > ${now}`;
  const query = dialect.sqlToQuery(sql`
    insert into login_attempts (key, attempts, window_start, locked_until)
    values (${key}, 1, ${now}, 0)
    on conflict (key) do update set
      attempts = case when ${locked} then attempts when ${windowOpen} then attempts + 1 else 1 end,
      window_start = case when ${locked} or ${windowOpen} then window_start else ${now} end,
      locked_until = case
        when ${locked} then locked_until
        when ${windowOpen} and attempts + 1 > ${MAX_ATTEMPTS} then ${now + WINDOW_SECONDS}
        else 0 end
    returning locked_until`);
  const row = await db.$client
    .prepare(query.sql)
    .bind(...query.params)
    .first<{ locked_until: number }>();
  return row && row.locked_until > now ? row.locked_until : null;
}

/** A successful sign-in forgets the failures. */
export async function clearAttempts(db: Db, key: string): Promise<void> {
  await db.$client.prepare("delete from login_attempts where key = ?").bind(key).run();
}
