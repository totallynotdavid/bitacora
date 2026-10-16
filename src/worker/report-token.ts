import { eq } from "drizzle-orm";
import { safeEqualText, randomToken } from "./crypto";
import type { Db } from "./cards";
import { settings } from "./db/schema";

const KEY = "report_token";

/** The migration seeds the row, so a read never writes. */
export async function reportToken(db: Db): Promise<string> {
  const row = await db.select().from(settings).where(eq(settings.key, KEY)).get();
  return row!.value;
}

/** Replaces the token with one UPDATE. The previous link stops working at once. */
export async function regenerateReportToken(db: Db): Promise<string> {
  const value = randomToken();
  await db.update(settings).set({ value }).where(eq(settings.key, KEY));
  return value;
}

export async function isReportToken(db: Db, candidate: string): Promise<boolean> {
  return safeEqualText(candidate, await reportToken(db));
}
