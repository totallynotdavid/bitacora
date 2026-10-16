import { describe, expect, it } from "vitest";
import { dayHeading, weekRangeLabel } from "../src/shared/dates";
import type { DoneWeek } from "../src/shared/model";
import { owner, send, setNow } from "./helpers";

describe("Lima days", () => {
  it("dates a card with the Lima day, not the UTC day", async () => {
    const me = await owner();

    setNow("2026-10-17T04:59:00Z"); // 23:59 Friday 16 in Lima
    const late = await me.add("late", "en_curso");
    expect((await me.move(late.id, { list: "hecho" })).doneDate).toBe("2026-10-16");

    setNow("2026-10-17T05:01:00Z"); // 00:01 Saturday 17 in Lima
    const early = await me.add("early", "en_curso");
    expect((await me.move(early.id, { list: "hecho" })).doneDate).toBe("2026-10-17");
  });

  it("rolls the board from Sunday to Monday at Lima midnight", async () => {
    const me = await owner();

    setNow("2026-10-19T04:30:00Z"); // Sunday 18 Oct, 23:30 in Lima
    const sunday = await me.add("domingo", "en_curso");
    await me.move(sunday.id, { list: "hecho" });
    let board = await me.board();
    expect(board).toMatchObject({ today: "2026-10-18", week: "2026-W42", olderWeek: null });
    expect(board.cards.map((c) => c.title)).toEqual(["domingo"]);

    setNow("2026-10-19T05:30:00Z"); // Monday 19 Oct, 00:30 in Lima
    const monday = await me.add("lunes", "en_curso");
    await me.move(monday.id, { list: "hecho" });
    board = await me.board();
    expect(board).toMatchObject({ today: "2026-10-19", week: "2026-W43", olderWeek: "2026-W42" });
    expect(board.cards.map((c) => [c.title, c.doneDate])).toEqual([["lunes", "2026-10-19"]]);

    const previous = await me.call<DoneWeek>("/api/done?week=2026-W42");
    expect(previous.cards.map((c) => [c.title, c.doneDate])).toEqual([["domingo", "2026-10-18"]]);
    expect(previous.olderWeek).toBeNull();
  });

  it("walks back one week with finished cards at a time, skipping empty weeks", async () => {
    setNow("2026-10-16T17:00:00Z");
    const me = await owner();
    for (const [title, day] of [
      ["w42", "2026-10-14"],
      ["w40", "2026-09-30"],
      ["w36", "2026-09-02"],
    ] as const) {
      const card = await me.add(title, "hecho");
      await me.edit(card.id, { doneDate: day });
    }
    const board = await me.board();
    expect(board.cards.map((c) => c.title)).toEqual(["w42"]);
    expect(board.olderWeek).toBe("2026-W40");

    const w40 = await me.call<DoneWeek>(`/api/done?week=${board.olderWeek}`);
    expect(w40.cards.map((c) => c.title)).toEqual(["w40"]);
    expect(w40.olderWeek).toBe("2026-W36");
  });

  it("rejects a malformed week", async () => {
    const me = await owner();
    for (const week of ["2026-42", "2026-W54", "2025-W53", ""]) {
      const res = await send(`/api/done?week=${week}`, { cookie: me.cookie });
      expect(res.status, week).toBe(400);
    }
  });
});

describe("date labels", () => {
  it("heads a day as Hoy, Ayer, then the weekday", () => {
    expect(dayHeading("2026-10-16", "2026-10-16")).toBe("Hoy, viernes 16 oct");
    expect(dayHeading("2026-10-15", "2026-10-16")).toBe("Ayer, jueves 15 oct");
    expect(dayHeading("2026-10-13", "2026-10-16")).toBe("martes 13 oct");
  });

  it("writes a week range, naming the month or year only where the week crosses it", () => {
    expect(weekRangeLabel("2026-W42")).toBe("12 – 18 oct 2026");
    expect(weekRangeLabel("2026-W40")).toBe("28 set – 4 oct 2026");
    expect(weekRangeLabel("2026-W01")).toBe("29 dic 2025 – 4 ene 2026");
  });
});
