/** @jsxImportSource hono/jsx */
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { doneInWeek, pendingAndActive } from "../cards";
import { limaDate, parseWeek, weekDays, weekOf } from "../../shared/dates";
import { isReportToken } from "../report-token";
import { ReportPage } from "../views/report";

export const report = new Hono<{ Bindings: Env }>();

report.use(async (c, next) => {
  await next();
  c.header("X-Robots-Tag", "noindex, nofollow");
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
});

report.get("/:token", async (c) => {
  const db = drizzle(c.env.DB);
  if (!(await isReportToken(db, c.req.param("token")))) return c.text("No encontrado", 404);

  const today = limaDate(new Date());
  const currentWeek = weekOf(today);
  const week = parseWeek(c.req.query("semana")) ?? currentWeek;

  const done = await doneInWeek(db, week);
  const days = weekDays(week)
    .map((date) => ({ date, cards: done.filter((card) => card.doneDate === date) }))
    .filter((day) => day.cards.length > 0);
  const active =
    week === currentWeek ? (await pendingAndActive(db)).filter((card) => card.list === "en_curso") : null;

  return c.html(
    <ReportPage
      token={c.req.param("token")}
      week={week}
      currentWeek={currentWeek}
      ownerName={c.env.OWNER_NAME}
      today={today}
      days={days}
      active={active}
    />,
  );
});
