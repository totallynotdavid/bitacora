import { sql } from "drizzle-orm";
import type { IssuedLink, Role } from "../shared/model";
import { randomToken, sha256 } from "./crypto";
import { batch, isUniqueViolation, type Db } from "./db/client";
import { links } from "./db/schema";

export const LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

export const INVITE_PATH = "/invitacion";
export const RESET_PATH = "/restablecer";

export const nowSeconds = () => Math.floor(Date.now() / 1000);

/** The WHERE of a link that can still be used. */
const usable = (hash: string, kind: "invite" | "reset", now: number) =>
  sql`${links.tokenHash} = ${hash} and ${links.kind} = ${kind} and ${links.usedAt} is null and ${links.expiresAt} > ${now}`;

export async function issueInvite(db: Db, role: Role): Promise<IssuedLink> {
  const token = randomToken();
  const expiresAt = nowSeconds() + LINK_TTL_SECONDS;
  await db.insert(links).values({ tokenHash: await sha256(token), kind: "invite", role, expiresAt });
  return { path: `${INVITE_PATH}/${token}`, expiresAt };
}

export async function issueReset(db: Db, userId: string): Promise<IssuedLink> {
  const token = randomToken();
  const expiresAt = nowSeconds() + LINK_TTL_SECONDS;
  await db.insert(links).values({ tokenHash: await sha256(token), kind: "reset", userId, expiresAt });
  return { path: `${RESET_PATH}/${token}`, expiresAt };
}

/** Whether the link is unused and unexpired. */
export async function isUsable(db: Db, kind: "invite" | "reset", token: string): Promise<boolean> {
  const row = await db
    .select({ hash: links.tokenHash })
    .from(links)
    .where(usable(await sha256(token), kind, nowSeconds()))
    .get();
  return row !== undefined;
}

export type NewUser = { name: string; email: string; passwordHash: string };

/**
 * Creates the user an invite allows and marks the invite used, in one batch.
 * The insert only happens while the link is unused and unexpired, and the
 * UPDATE that marks it checks the same, so two tabs cannot both use it. An
 * email that is taken fails the batch and leaves the invite unused.
 */
export async function useInvite(
  db: Db,
  token: string,
  user: NewUser,
): Promise<{ id: string } | "invalid" | "email-taken"> {
  const hash = await sha256(token);
  const now = nowSeconds();
  const id = crypto.randomUUID();
  try {
    const [created] = await batch(db, [
      sql`insert into users (id, email, name, password_hash, role)
        select ${id}, ${user.email}, ${user.name}, ${user.passwordHash}, role from links
        where ${usable(hash, "invite", now)}`,
      sql`update links set used_at = ${now} where ${usable(hash, "invite", now)}`,
    ]);
    return created!.meta.changes === 1 ? { id } : "invalid";
  } catch (error) {
    if (isUniqueViolation(error)) return "email-taken";
    throw error;
  }
}

/**
 * Sets the password a reset link allows, bumps the user's session version and
 * marks the link used, in one batch. Returns the user, or undefined when the
 * link is used, expired or unknown.
 */
export async function useReset(
  db: Db,
  token: string,
  passwordHash: string,
): Promise<{ id: string; sessionVersion: number; disabled: boolean } | undefined> {
  const hash = await sha256(token);
  const now = nowSeconds();
  const [reset] = await batch(db, [
    sql`update users set password_hash = ${passwordHash}, session_version = session_version + 1
      where id = (select user_id from links where ${usable(hash, "reset", now)})
      returning id, session_version, disabled`,
    sql`update links set used_at = ${now} where ${usable(hash, "reset", now)}`,
  ]);
  const row = reset!.results[0] as { id: string; session_version: number; disabled: number } | undefined;
  return row && { id: row.id, sessionVersion: row.session_version, disabled: row.disabled === 1 };
}
