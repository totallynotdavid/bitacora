import { Hono } from "hono";
import { InvalidCard } from "./cards";
import { api } from "./routes/api";
import { auth } from "./routes/auth";
import { report } from "./routes/report";
import { requireSession } from "./session";

const app = new Hono<{ Bindings: Env }>();

app.onError((error, c) => {
  if (error instanceof InvalidCard) return c.json({ error: error.message }, 400);
  console.error(error);
  return c.json({ error: "internal error" }, 500);
});

app.route("/", auth);
app.route("/api", api);
app.route("/r", report);

// Static assets are public. The fallback page still requires a session.
app.get("/assets/*", (c) => c.env.ASSETS.fetch(c.req.raw));
app.get("/favicon.svg", (c) => c.env.ASSETS.fetch(c.req.raw));

app.use(requireSession);
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
