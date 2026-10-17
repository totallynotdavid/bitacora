import { describe, expect, it } from "vitest";
import type { Card } from "../src/shared/model";
import { admin, send, setNow } from "./helpers";

const NOON_FRIDAY = "2026-10-16T17:00:00Z"; // 12:00 in Lima

describe("cards", () => {
  it("adds a card at the end of each list", async () => {
    setNow(NOON_FRIDAY);
    const me = await admin();
    const first = await me.add("Uno", "pendiente");
    const second = await me.add("Dos", "pendiente");
    const week = await me.add("Semana", "esta_semana");
    const doing = await me.add("Ahora", "en_curso");
    const done = await me.add("Listo", "hecho");

    expect([first.position, second.position, week.position]).toEqual([1, 2, 1]);
    expect(doing.list).toBe("en_curso");
    expect(done.doneDate).toBe("2026-10-16");
    expect(first).toMatchObject({ labelId: null, requester: null, checklist: [], description: "" });
  });

  it("validates input", async () => {
    const me = await admin();
    expect(await me.status("/api/cards", "POST", { title: "  ", list: "pendiente" })).toBe(400);
    expect(await me.status("/api/cards", "POST", { title: "x", list: "later" })).toBe(400);
  });

  it("edits every field", async () => {
    const me = await admin();
    const label = await me.addLabel("Desarrollo");
    const card = await me.add("Borrador", "pendiente");
    const edited = await me.edit(card.id, {
      title: "Entrega final",
      description: "línea 1\nlínea 2",
      labelId: label.id,
      requester: "Augusto",
      checklist: [
        { text: "Escribir", done: true },
        { text: "Revisar", done: false },
      ],
    });
    expect(edited).toMatchObject({ title: "Entrega final", labelId: label.id, requester: "Augusto" });

    const stored = (await me.board()).cards.find((c) => c.id === card.id);
    expect(stored).toEqual(edited);
    expect(stored?.description).toBe("línea 1\nlínea 2");

    expect((await me.edit(card.id, { requester: "  " })).requester).toBeNull();
    expect((await me.edit(card.id, { labelId: null })).labelId).toBeNull();
  });

  it("refuses a label that does not exist", async () => {
    const me = await admin();
    const card = await me.add("x", "pendiente");
    expect(await me.status(`/api/cards/${card.id}`, "PATCH", { labelId: "nope" })).toBe(400);
  });

  it("suggests earlier requesters, most used first", async () => {
    const me = await admin();
    for (const [title, requester] of [
      ["a", "Rodrigo"],
      ["b", "Augusto"],
      ["c", "Augusto"],
    ] as const) {
      const card = await me.add(title, "pendiente");
      await me.edit(card.id, { requester });
    }
    expect((await me.board()).requesters).toEqual(["Augusto", "Rodrigo"]);
  });

  it("deletes a card and answers 404 afterwards", async () => {
    const me = await admin();
    const card = await me.add("Borrar", "pendiente");
    expect(await me.status(`/api/cards/${card.id}`, "DELETE")).toBe(204);
    expect(await me.status(`/api/cards/${card.id}`, "DELETE")).toBe(404);
    expect((await me.board()).cards).toEqual([]);
  });
});

describe("moving cards", () => {
  it("reorders inside a list and keeps positions 1..n", async () => {
    const me = await admin();
    await me.add("a", "en_curso");
    await me.add("b", "en_curso");
    const c = await me.add("c", "en_curso");
    await me.move(c.id, { list: "en_curso", index: 0 });
    const titles = (await me.board()).cards.filter((x) => x.list === "en_curso");
    expect(titles.map((x) => [x.title, x.position])).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 3],
    ]);
  });

  it("leaves distinct positions when two tabs move cards into the same group at once", async () => {
    const me = await admin();
    await me.add("a", "en_curso");
    const [x, y, z] = await Promise.all([
      me.add("x", "pendiente"),
      me.add("y", "esta_semana"),
      me.add("z", "pendiente"),
    ]);
    await Promise.all([
      me.move(x.id, { list: "en_curso", index: 0 }),
      me.move(y.id, { list: "en_curso", index: 0 }),
      me.move(z.id, { list: "en_curso", index: 1 }),
    ]);
    const doing = (await me.board()).cards.filter((c) => c.list === "en_curso");
    expect(doing.map((c) => c.position).toSorted()).toEqual([1, 2, 3, 4]);
  });

  it("gives concurrently added cards distinct positions", async () => {
    const me = await admin();
    const added = await Promise.all(["a", "b", "c", "d"].map((title) => me.add(title, "en_curso")));
    expect(added.map((c) => c.position).toSorted()).toEqual([1, 2, 3, 4]);
  });

  it("inserts into the middle of another list", async () => {
    const me = await admin();
    await me.add("a", "en_curso");
    await me.add("b", "en_curso");
    const card = await me.add("x", "pendiente");
    await me.move(card.id, { list: "en_curso", index: 1 });
    const doing = (await me.board()).cards.filter((c) => c.list === "en_curso");
    expect(doing.map((c) => c.title)).toEqual(["a", "x", "b"]);
  });

  it("moves a card through the four lists", async () => {
    const me = await admin();
    const card = await me.add("x", "pendiente");
    for (const list of ["esta_semana", "en_curso", "pendiente"] as const) {
      expect((await me.move(card.id, { list })).list).toBe(list);
    }
  });

  it("sets the done date to today when a card enters Hecho and clears it on leaving", async () => {
    setNow(NOON_FRIDAY);
    const me = await admin();
    const card = await me.add("x", "en_curso");

    const done = await me.move(card.id, { list: "hecho" });
    expect(done).toMatchObject({ list: "hecho", doneDate: "2026-10-16" });

    const reopened = await me.move(card.id, { list: "esta_semana" });
    expect(reopened).toMatchObject({ list: "esta_semana", doneDate: null });
    expect((await me.board()).cards[0]?.doneDate).toBeNull();
  });

  it("changes the done date from the dialog and files the card under that day", async () => {
    setNow(NOON_FRIDAY);
    const me = await admin();
    const card = await me.add("x", "hecho");
    const edited = await me.edit(card.id, { doneDate: "2026-10-15" });
    expect(edited.doneDate).toBe("2026-10-15");
    expect((await me.board()).cards[0]?.doneDate).toBe("2026-10-15");
  });

  it("refuses a future done date", async () => {
    setNow(NOON_FRIDAY);
    const me = await admin();
    const card = await me.add("x", "hecho");
    expect(await me.status(`/api/cards/${card.id}`, "PATCH", { doneDate: "2026-10-17" })).toBe(400);
  });

  it("moving a card to Hecho from the dialog sets the date, with an explicit one winning", async () => {
    setNow(NOON_FRIDAY);
    const me = await admin();
    const a = await me.add("a", "en_curso");
    const b = await me.add("b", "en_curso");
    expect((await me.edit(a.id, { list: "hecho" })).doneDate).toBe("2026-10-16");
    expect((await me.edit(b.id, { list: "hecho", doneDate: "2026-10-14" })).doneDate).toBe("2026-10-14");
  });

  it("moves between days inside Hecho by naming the day", async () => {
    setNow(NOON_FRIDAY);
    const me = await admin();
    const card = await me.add("x", "hecho");
    const moved = await me.move(card.id, { list: "hecho", doneDate: "2026-10-14" });
    expect(moved.doneDate).toBe("2026-10-14");
  });

  it("answers 404 for an unknown card", async () => {
    const me = await admin();
    expect(await me.status("/api/cards/nope/move", "POST", { list: "hecho", index: 0 })).toBe(404);
  });
});

describe("card by id", () => {
  it("creates a card under the id the client chose, once", async () => {
    const me = await admin();
    const id = crypto.randomUUID();
    const first = await me.call<Card>("/api/cards", "POST", { id, title: "Uno", list: "en_curso" });
    const again = await me.call<Card>("/api/cards", "POST", { id, title: "Otro", list: "en_curso" });
    expect(first.id).toBe(id);
    expect(again).toEqual(first);
    expect((await me.board()).cards).toHaveLength(1);
  });

  it("refuses an id that is not a UUID", async () => {
    const me = await admin();
    expect(await me.status("/api/cards", "POST", { id: "x", title: "Uno", list: "pendiente" })).toBe(400);
  });

  it("reads one card, including one done in an earlier week", async () => {
    setNow(NOON_FRIDAY);
    const me = await admin();
    const old = await me.add("Vieja", "hecho");
    await me.edit(old.id, { doneDate: "2026-09-01" });
    expect(await me.call<Card>(`/api/cards/${old.id}`)).toMatchObject({
      title: "Vieja",
      doneDate: "2026-09-01",
    });
    expect(await me.status("/api/cards/nope")).toBe(404);
  });
});

describe("card pages", () => {
  it("sends a card URL without a session to the login page", async () => {
    const res = await send("/c/3f2a");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });
});
