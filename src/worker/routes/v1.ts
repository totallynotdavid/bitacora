import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { limaDate, weekOf } from "../../shared/dates";
import type { ApiCard, Card, Label } from "../../shared/model";
import { apiCreateCardSchema, apiListCardsSchema } from "../../shared/schemas";
import { requireToken } from "../api-tokens";
import { cardsOf, InvalidCard } from "../cards";
import { connect } from "../db/client";
import { labelsOf } from "../labels";
import type { AppEnv } from "../session";

/** The JSON API for scripts, behind `/api/v1`. It accepts a bearer token and no cookie. */
export const v1 = new Hono<AppEnv>();

v1.use(requireToken);

const today = () => limaDate(new Date());

const withLabel = (card: Card, labels: Label[]): ApiCard => ({
  ...card,
  label: labels.find((label) => label.id === card.labelId)?.name ?? null,
});

v1.post("/cards", zValidator("json", apiCreateCardSchema), async (c) => {
  const db = connect(c.env);
  const userId = c.get("user").id;
  const { label: name, notes, date, ...input } = c.req.valid("json");
  const labels = await labelsOf(db, userId).list();
  const label = name && labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (name && !label) throw new InvalidCard(`unknown label "${name}"`);
  const card = await cardsOf(db, userId).create(
    { ...input, description: notes, labelId: label ? label.id : undefined, doneDate: date },
    today(),
  );
  return c.json(withLabel(card, labels), 201);
});

/** Cards still open, and the cards done in `semana` (this week by default). `list` narrows both. */
v1.get("/cards", zValidator("query", apiListCardsSchema), async (c) => {
  const db = connect(c.env);
  const userId = c.get("user").id;
  const { list } = c.req.valid("query");
  const week = c.req.valid("query").semana ?? weekOf(today());
  const cards = cardsOf(db, userId);
  const [open, done, labels] = await Promise.all([
    list === "hecho" ? [] : cards.pendingAndActive(),
    list && list !== "hecho" ? [] : cards.doneInWeek(week),
    labelsOf(db, userId).list(),
  ]);
  const shown = [...open, ...done].filter((card) => !list || card.list === list);
  return c.json({ week, cards: shown.map((card) => withLabel(card, labels)) });
});

v1.all("*", (c) => c.json({ error: "not found" }, 404));
