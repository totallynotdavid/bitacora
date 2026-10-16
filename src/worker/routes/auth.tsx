/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { verifyPassword } from "../password";
import { endSession, hasSession, startSession } from "../session";
import { LoginPage } from "../views/login";

export const auth = new Hono<{ Bindings: Env }>();

auth.get("/login", async (c) => {
  if (await hasSession(c)) return c.redirect("/");
  return c.html(<LoginPage failed={false} />);
});

auth.post("/login", async (c) => {
  const form = await c.req.parseBody();
  const password = typeof form.password === "string" ? form.password : "";
  if (!(await verifyPassword(password, c.env.OWNER_PASSWORD_HASH))) {
    return c.html(<LoginPage failed />, 401);
  }
  await startSession(c);
  return c.redirect("/", 303);
});

auth.post("/logout", (c) => {
  endSession(c);
  return c.redirect("/login", 303);
});
