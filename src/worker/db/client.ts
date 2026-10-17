import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { Query, SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";

export type Db = DrizzleD1Database & { $client: D1Database };

export const connect = (env: Env): Db => drizzle(env.DB);

/** Whether a statement failed on a UNIQUE or PRIMARY KEY constraint. Drizzle wraps the driver's error. */
export function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if (/UNIQUE constraint failed/i.test(e.message)) return true;
  }
  return false;
}

const dialect = new SQLiteSyncDialect();

/**
 * Runs statements as one D1 batch, which D1 executes as a transaction: one that
 * fails undoes the others. Returns each statement's result in order.
 */
export async function batch(db: Db, statements: (SQL | { toSQL(): Query })[]): Promise<D1Result[]> {
  const prepared = statements.map((statement) => {
    const { sql: text, params } = "toSQL" in statement ? statement.toSQL() : dialect.sqlToQuery(statement);
    return db.$client.prepare(text).bind(...params);
  });
  return db.$client.batch(prepared);
}
