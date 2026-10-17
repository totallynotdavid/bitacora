import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { safeEqualText, sign } from "./crypto";
import { connect } from "./db/client";
import { findUser, type User } from "./users";

const COOKIE = "bitacora_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type AppEnv = { Bindings: Env; Variables: { user: User } };

type AppContext = Context<AppEnv>;

const payload = (userId: string, version: number, expires: number) =>
  `session.${userId}.${version}.${expires}`;

/** Signs the browser in as a user at their current session version. */
export async function startSession(c: AppContext, userId: string, version: number): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const signature = await sign(c.env.SESSION_SECRET, payload(userId, version, expires));
  setCookie(c, COOKIE, `${userId}.${version}.${expires}.${signature}`, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function endSession(c: AppContext): void {
  deleteCookie(c, COOKIE, { path: "/", secure: true });
}

/**
 * The user the cookie signs in, or undefined. The cookie carries the user id
 * and a session version. A disabled user, or a session version different from
 * the stored one, is signed out.
 */
export async function sessionUser(c: AppContext): Promise<User | undefined> {
  const value = getCookie(c, COOKIE);
  if (!value) return undefined;
  const [userId, version, expires, signature] = value.split(".");
  if (!userId || !version || !expires || !signature || Number(expires) < Date.now() / 1000) {
    return undefined;
  }
  const expected = await sign(c.env.SESSION_SECRET, payload(userId, Number(version), Number(expires)));
  if (!safeEqualText(signature, expected)) return undefined;
  const user = await findUser(connect(c.env), userId);
  if (!user || user.disabled || user.sessionVersion !== Number(version)) return undefined;
  return user;
}

/** Reads the user row once and leaves it in `c.get("user")`. API calls get 401. Page loads go to the login page. */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const user = await sessionUser(c);
  if (user) {
    c.set("user", user);
    return next();
  }
  if (c.req.path.startsWith("/api/")) return c.json({ error: "unauthorized" }, 401);
  return c.redirect("/login");
});

/** Used after `requireSession`. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user").role !== "admin") return c.json({ error: "forbidden" }, 403);
  return next();
});
