import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { safeEqualText, sign } from "./crypto";

const COOKIE = "bitacora_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type AppContext = Context<{ Bindings: Env }>;

export async function startSession(c: AppContext): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const signature = await sign(c.env.SESSION_SECRET, `session.${expires}`);
  setCookie(c, COOKIE, `${expires}.${signature}`, {
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

export async function hasSession(c: AppContext): Promise<boolean> {
  const value = getCookie(c, COOKIE);
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) < Date.now() / 1000) return false;
  const expected = await sign(c.env.SESSION_SECRET, `session.${expires}`);
  return safeEqualText(signature, expected);
}

/** API calls get 401. Page loads go to the login page. */
export const requireSession = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (await hasSession(c)) return next();
  if (c.req.path.startsWith("/api/")) return c.json({ error: "unauthorized" }, 401);
  return c.redirect("/login");
});
