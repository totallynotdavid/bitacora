import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { limaDate, parseWeek, weekOf } from "../../shared/dates";
import type { Board, DoneWeek, Settings } from "../../shared/model";
import {
  changePasswordSchema,
  createCardSchema,
  createLabelSchema,
  moveCardSchema,
  updateCardSchema,
  updateLabelSchema,
  updateSettingsSchema,
} from "../../shared/schemas";
import { cardsOf } from "../cards";
import { connect } from "../db/client";
import { labelsOf } from "../labels";
import { hashPassword, verifyPassword } from "../password";
import { requireSession, startSession, type AppEnv } from "../session";
import { changePassword, regenerateReportToken, renameUser, reportTokenOf } from "../users";
import { members } from "./members";
import { tokens } from "./tokens";

export const api = new Hono<AppEnv>();

api.use(requireSession);
api.route("/members", members);
api.route("/tokens", tokens);

const today = () => limaDate(new Date());

api.get("/board", async (c) => {
  const db = connect(c.env);
  const userId = c.get("user").id;
  const cards = cardsOf(db, userId);
  const week = weekOf(today());
  const [open, done, labels, olderWeek, requesters] = await Promise.all([
    cards.pendingAndActive(),
    cards.doneInWeek(week),
    labelsOf(db, userId).list(),
    cards.olderWeekWithCards(week),
    cards.requesterSuggestions(),
  ]);
  const board: Board = { today: today(), week, cards: [...open, ...done], labels, olderWeek, requesters };
  return c.json(board);
});

api.get("/done", async (c) => {
  const week = parseWeek(c.req.query("week"));
  if (!week) return c.json({ error: "week must look like 2026-W42" }, 400);
  const cards = cardsOf(connect(c.env), c.get("user").id);
  const [done, olderWeek] = await Promise.all([cards.doneInWeek(week), cards.olderWeekWithCards(week)]);
  const result: DoneWeek = { week, cards: done, olderWeek };
  return c.json(result);
});

api.post("/cards", zValidator("json", createCardSchema), async (c) => {
  const card = await cardsOf(connect(c.env), c.get("user").id).create(c.req.valid("json"), today());
  return c.json(card, 201);
});

api.get("/cards/:id", async (c) => {
  const card = await cardsOf(connect(c.env), c.get("user").id).get(c.req.param("id"));
  return card ? c.json(card) : c.json({ error: "not found" }, 404);
});

api.patch("/cards/:id", zValidator("json", updateCardSchema), async (c) => {
  const cards = cardsOf(connect(c.env), c.get("user").id);
  const card = await cards.get(c.req.param("id"));
  if (!card) return c.json({ error: "not found" }, 404);
  return c.json(await cards.update(card, c.req.valid("json"), today()));
});

api.post("/cards/:id/move", zValidator("json", moveCardSchema), async (c) => {
  const cards = cardsOf(connect(c.env), c.get("user").id);
  const card = await cards.get(c.req.param("id"));
  if (!card) return c.json({ error: "not found" }, 404);
  const { index, ...placement } = c.req.valid("json");
  return c.json(await cards.update(card, placement, today(), index));
});

api.delete("/cards/:id", async (c) => {
  const deleted = await cardsOf(connect(c.env), c.get("user").id).delete(c.req.param("id"));
  return deleted ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});

api.post("/labels", zValidator("json", createLabelSchema), async (c) => {
  const label = await labelsOf(connect(c.env), c.get("user").id).create(c.req.valid("json"));
  return c.json(label, 201);
});

api.patch("/labels/:id", zValidator("json", updateLabelSchema), async (c) => {
  const label = await labelsOf(connect(c.env), c.get("user").id).update(
    c.req.param("id"),
    c.req.valid("json"),
  );
  return label ? c.json(label) : c.json({ error: "not found" }, 404);
});

api.delete("/labels/:id", async (c) => {
  const deleted = await labelsOf(connect(c.env), c.get("user").id).delete(c.req.param("id"));
  return deleted ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});

type Account = { id: string; name: string; email: string; role: Settings["role"] };

const settingsOf = (user: Account, reportToken: string): Settings => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  reportToken,
});

api.get("/settings", async (c) => {
  const user = c.get("user");
  return c.json(settingsOf(user, await reportTokenOf(connect(c.env), user.id)));
});

api.patch("/settings", zValidator("json", updateSettingsSchema), async (c) => {
  const user = c.get("user");
  const { name } = c.req.valid("json");
  const db = connect(c.env);
  await renameUser(db, user.id, name);
  return c.json(settingsOf({ ...user, name }, await reportTokenOf(db, user.id)));
});

/** Changes the password, signs out every other browser and keeps this one signed in. */
api.post("/settings/password", zValidator("json", changePasswordSchema), async (c) => {
  const user = c.get("user");
  const { current, password } = c.req.valid("json");
  if (!(await verifyPassword(current, user.passwordHash))) {
    return c.json({ error: "wrong password" }, 403);
  }
  const version = await changePassword(connect(c.env), user, await hashPassword(password));
  if (version === undefined) return c.json({ error: "session changed, try again" }, 409);
  await startSession(c, user.id, version);
  return c.body(null, 204);
});

api.post("/settings/report-token", async (c) => {
  const user = c.get("user");
  return c.json(settingsOf(user, await regenerateReportToken(connect(c.env), user.id)));
});
