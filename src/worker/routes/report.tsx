/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { limaDate, parseWeek, weekDays, weekOf } from "../../shared/dates";
import { cardsOf } from "../cards";
import { connect } from "../db/client";
import { labelsOf } from "../labels";
import { userByReportToken } from "../users";
import { ReportPage } from "../views/report";

export const report = new Hono<{ Bindings: Env }>();

report.use(async (c, next) => {
  await next();
  c.header("X-Robots-Tag", "noindex, nofollow");
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
});

report.get("/:token", async (c) => {
  const db = connect(c.env);
  const owner = await userByReportToken(db, c.req.param("token"));
  if (!owner) return c.text("No encontrado", 404);
  const cards = cardsOf(db, owner.id);

  const today = limaDate(new Date());
  const currentWeek = weekOf(today);
  const week = parseWeek(c.req.query("semana")) ?? currentWeek;

  const done = await cards.doneInWeek(week);
  const days = weekDays(week)
    .map((date) => ({ date, cards: done.filter((card) => card.doneDate === date) }))
    .filter((day) => day.cards.length > 0);
  const active =
    week === currentWeek ? (await cards.pendingAndActive()).filter((card) => card.list === "en_curso") : null;

  return c.html(
    <ReportPage
      token={c.req.param("token")}
      week={week}
      currentWeek={currentWeek}
      ownerName={owner.name}
      today={today}
      days={days}
      active={active}
      labels={await labelsOf(db, owner.id).list()}
    />,
  );
});
