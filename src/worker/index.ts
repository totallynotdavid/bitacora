import { Hono } from "hono";
import { CardIdTaken, InvalidCard } from "./cards";
import { LabelConflict } from "./labels";
import { api } from "./routes/api";
import { auth } from "./routes/auth";
import { report } from "./routes/report";
import { requireSession, type AppEnv } from "./session";

const app = new Hono<AppEnv>();

app.onError((error, c) => {
  if (error instanceof InvalidCard) return c.json({ error: error.message }, 400);
  if (error instanceof CardIdTaken) return c.json({ error: "id already used" }, 409);
  if (error instanceof LabelConflict) return c.json({ error: "label already exists" }, 409);
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
