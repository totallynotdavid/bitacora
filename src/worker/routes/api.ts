import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { limaDate, parseWeek, weekOf } from "../../shared/dates";
import type { Board, DoneWeek, Settings } from "../../shared/model";
import { createCardSchema, moveCardSchema, updateCardSchema } from "../../shared/schemas";
import {
  createCard,
  deleteCard,
  doneInWeek,
  getCard,
  olderWeekWithCards,
  pendingAndActive,
  requesterSuggestions,
  updateCard,
} from "../cards";
import { regenerateReportToken, reportToken } from "../report-token";
import { requireSession } from "../session";

export const api = new Hono<{ Bindings: Env }>();

api.use(requireSession);

const today = () => limaDate(new Date());

api.get("/board", async (c) => {
  const db = drizzle(c.env.DB);
  const week = weekOf(today());
  const [open, done, olderWeek, requesters] = await Promise.all([
    pendingAndActive(db),
    doneInWeek(db, week),
    olderWeekWithCards(db, week),
    requesterSuggestions(db),
  ]);
  const board: Board = { today: today(), week, cards: [...open, ...done], olderWeek, requesters };
  return c.json(board);
});

api.get("/done", async (c) => {
  const week = parseWeek(c.req.query("week"));
  if (!week) return c.json({ error: "week must look like 2026-W42" }, 400);
  const db = drizzle(c.env.DB);
  const [cards, olderWeek] = await Promise.all([doneInWeek(db, week), olderWeekWithCards(db, week)]);
  const result: DoneWeek = { week, cards, olderWeek };
  return c.json(result);
});

api.post("/cards", zValidator("json", createCardSchema), async (c) => {
  const card = await createCard(drizzle(c.env.DB), c.req.valid("json"), today());
  return c.json(card, 201);
});

api.get("/cards/:id", async (c) => {
  const card = await getCard(drizzle(c.env.DB), c.req.param("id"));
  return card ? c.json(card) : c.json({ error: "not found" }, 404);
});

api.patch("/cards/:id", zValidator("json", updateCardSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const card = await getCard(db, c.req.param("id"));
  if (!card) return c.json({ error: "not found" }, 404);
  return c.json(await updateCard(db, card, c.req.valid("json"), today()));
});

api.post("/cards/:id/move", zValidator("json", moveCardSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const card = await getCard(db, c.req.param("id"));
  if (!card) return c.json({ error: "not found" }, 404);
  const { index, ...placement } = c.req.valid("json");
  return c.json(await updateCard(db, card, placement, today(), index));
});

api.delete("/cards/:id", async (c) => {
  const deleted = await deleteCard(drizzle(c.env.DB), c.req.param("id"));
  return deleted ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});

api.get("/settings", async (c) => {
  const settings: Settings = {
    ownerName: c.env.OWNER_NAME,
    reportToken: await reportToken(drizzle(c.env.DB)),
  };
  return c.json(settings);
});

api.post("/settings/report-token", async (c) => {
  const settings: Settings = {
    ownerName: c.env.OWNER_NAME,
    reportToken: await regenerateReportToken(drizzle(c.env.DB)),
  };
  return c.json(settings);
});
