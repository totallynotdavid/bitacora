import { and, desc, eq, sql } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { ApiToken, IssuedToken } from "../shared/model";
import { randomToken, sha256 } from "./crypto";
import { connect, type Db } from "./db/client";
import { apiTokens } from "./db/schema";
import { nowSeconds } from "./links";
import { countAttempt } from "./login-limit";
import type { AppEnv } from "./session";
import { findUser, type User } from "./users";

/** Makes a token recognizable in a leaked file or a secret scanner. */
const PREFIX = "bit_";

const tokenColumns = {
  id: apiTokens.id,
  name: apiTokens.name,
  createdAt: apiTokens.createdAt,
  lastUsedAt: apiTokens.lastUsedAt,
};

/** Makes a token for a user. The returned secret is the only copy. */
export async function issueToken(db: Db, userId: string, name: string): Promise<IssuedToken> {
  const token = PREFIX + randomToken();
  const row = await db
    .insert(apiTokens)
    .values({
      id: crypto.randomUUID(),
      userId,
      name,
      tokenHash: await sha256(token),
      createdAt: nowSeconds(),
    })
    .returning(tokenColumns)
    .get();
  return { ...row, token };
}

export function listTokens(db: Db, userId: string): Promise<ApiToken[]> {
  return db
    .select(tokenColumns)
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt), apiTokens.id);
}

/** Deletes one of the user's tokens. Returns false when they have none with that id. */
export async function revokeToken(db: Db, userId: string, id: string): Promise<boolean> {
  const revoked = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id });
  return revoked.length > 0;
}

/**
 * The user a token acts for, or undefined. A token of a disabled user matches
 * nothing. A match stamps the token's last use.
 */
async function userOfToken(db: Db, token: string): Promise<User | undefined> {
  const used = await db
    .update(apiTokens)
    .set({ lastUsedAt: nowSeconds() })
    .where(
      and(
        eq(apiTokens.tokenHash, await sha256(token)),
        sql`exists (select 1 from users where users.id = ${apiTokens.userId} and users.disabled = 0)`,
      ),
    )
    .returning({ userId: apiTokens.userId })
    .get();
  return used && findUser(db, used.userId);
}

const bearerOf = (header: string | undefined): string | undefined => header?.match(/^Bearer +(\S+)$/i)?.[1];

/**
 * Signs a request in with `Authorization: Bearer <token>` and leaves the owner
 * in `c.get("user")`. The cookie is not read, so a request without a bearer is
 * a 401. Only a presented token that matches nothing counts as a bad attempt:
 * the sixth from one address in 15 minutes is a 429, as at sign-in.
 */
export const requireToken = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearerOf(c.req.header("Authorization"));
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const db = connect(c.env);
  const user = await userOfToken(db, token);
  if (user) {
    c.set("user", user);
    return next();
  }
  const address = c.req.header("CF-Connecting-IP") ?? "unknown";
  const lockedUntil = await countAttempt(db, `bearer:${address}`);
  if (lockedUntil === null) return c.json({ error: "unauthorized" }, 401);
  c.header("Retry-After", String(Math.max(1, lockedUntil - nowSeconds())));
  return c.json({ error: "too many attempts" }, 429);
});
