import { describe, expect, it } from "vitest";
import type { Card } from "../src/shared/model";
import { owner, send, setNow } from "./helpers";

const NOON_FRIDAY = "2026-10-16T17:00:00Z"; // 12:00 in Lima

describe("cards", () => {
  it("adds a card at the end of each list", async () => {
    setNow(NOON_FRIDAY);
    const me = await owner();
    const first = await me.add("Uno", "pendiente");
    const second = await me.add("Dos", "pendiente");
    const later = await me.add("Luego", "pendiente", true);
    const doing = await me.add("Ahora", "en_curso");
    const done = await me.add("Listo", "hecho");

    expect([first.position, second.position, later.position]).toEqual([1, 2, 1]);
    expect(later.later).toBe(true);
    expect(doing.list).toBe("en_curso");
    expect(done.doneDate).toBe("2026-10-16");
    expect(first).toMatchObject({ category: "Otros", requester: null, checklist: [], description: "" });
  });

  it("validates input", async () => {
    const me = await owner();
    const res = await send("/api/cards", {
      method: "POST",
      cookie: me.cookie,
      json: { title: "  ", list: "pendiente" },
    });
    expect(res.status).toBe(400);
    const card = await me.add("Algo", "pendiente");
    const bad = await send(`/api/cards/${card.id}`, {
      method: "PATCH",
      cookie: me.cookie,
      json: { category: "Ocio" },
    });
    expect(bad.status).toBe(400);
  });

  it("edits every field", async () => {
    const me = await owner();
    const card = await me.add("Borrador", "pendiente");
    const edited = await me.edit(card.id, {
      title: "Entrega final",
      description: "línea 1\nlínea 2",
      category: "Desarrollo",
      requester: "Augusto",
      checklist: [
        { text: "Escribir", done: true },
        { text: "Revisar", done: false },
      ],
    });
    expect(edited).toMatchObject({ title: "Entrega final", category: "Desarrollo", requester: "Augusto" });

    const stored = (await me.board()).cards.find((c) => c.id === card.id);
    expect(stored).toEqual(edited);
    expect(stored?.description).toBe("línea 1\nlínea 2");

    const cleared = await me.edit(card.id, { requester: "  " });
    expect(cleared.requester).toBeNull();
  });

  it("suggests earlier requesters, most used first", async () => {
    const me = await owner();
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
    const me = await owner();
    const card = await me.add("Borrar", "pendiente");
    expect((await send(`/api/cards/${card.id}`, { method: "DELETE", cookie: me.cookie })).status).toBe(204);
    expect((await send(`/api/cards/${card.id}`, { method: "DELETE", cookie: me.cookie })).status).toBe(404);
    expect((await me.board()).cards).toEqual([]);
  });
});

describe("moving cards", () => {
  it("reorders inside a list and keeps positions 1..n", async () => {
    const me = await owner();
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
    const me = await owner();
    await me.add("a", "en_curso");
    const [x, y, z] = await Promise.all([
      me.add("x", "pendiente"),
      me.add("y", "pendiente", true),
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
    const me = await owner();
    const added = await Promise.all(["a", "b", "c", "d"].map((title) => me.add(title, "en_curso")));
    expect(added.map((c) => c.position).toSorted()).toEqual([1, 2, 3, 4]);
  });

  it("inserts into the middle of another list", async () => {
    const me = await owner();
    await me.add("a", "en_curso");
    await me.add("b", "en_curso");
    const card = await me.add("x", "pendiente");
    await me.move(card.id, { list: "en_curso", index: 1 });
    const doing = (await me.board()).cards.filter((c) => c.list === "en_curso");
    expect(doing.map((c) => c.title)).toEqual(["a", "x", "b"]);
  });

  it("moves between the Pendiente groups", async () => {
    const me = await owner();
    const card = await me.add("x", "pendiente");
    const moved = await me.move(card.id, { list: "pendiente", later: true });
    expect(moved.later).toBe(true);
    const back = await me.move(card.id, { list: "pendiente", later: false });
    expect(back.later).toBe(false);
  });

  it("sets the done date to today when a card enters Hecho and clears it on leaving", async () => {
    setNow(NOON_FRIDAY);
    const me = await owner();
    const card = await me.add("x", "en_curso");

    const done = await me.move(card.id, { list: "hecho" });
    expect(done).toMatchObject({ list: "hecho", doneDate: "2026-10-16" });

    const reopened = await me.move(card.id, { list: "pendiente" });
    expect(reopened).toMatchObject({ list: "pendiente", doneDate: null, later: false });
    expect((await me.board()).cards[0]?.doneDate).toBeNull();
  });

  it("changes the done date from the dialog and files the card under that day", async () => {
    setNow(NOON_FRIDAY);
    const me = await owner();
    const card = await me.add("x", "hecho");
    const edited = await me.edit(card.id, { doneDate: "2026-10-15" });
    expect(edited.doneDate).toBe("2026-10-15");
    expect((await me.board()).cards[0]?.doneDate).toBe("2026-10-15");
  });

  it("refuses a future done date", async () => {
    setNow(NOON_FRIDAY);
    const me = await owner();
    const card = await me.add("x", "hecho");
    const res = await send(`/api/cards/${card.id}`, {
      method: "PATCH",
      cookie: me.cookie,
      json: { doneDate: "2026-10-17" },
    });
    expect(res.status).toBe(400);
  });

  it("moving a card to Hecho from the dialog sets the date, with an explicit one winning", async () => {
    setNow(NOON_FRIDAY);
    const me = await owner();
    const a = await me.add("a", "en_curso");
    const b = await me.add("b", "en_curso");
    expect((await me.edit(a.id, { list: "hecho" })).doneDate).toBe("2026-10-16");
    expect((await me.edit(b.id, { list: "hecho", doneDate: "2026-10-14" })).doneDate).toBe("2026-10-14");
  });

  it("moves between days inside Hecho by naming the day", async () => {
    setNow(NOON_FRIDAY);
    const me = await owner();
    const card = await me.add("x", "hecho");
    const moved = await me.move(card.id, { list: "hecho", doneDate: "2026-10-14" });
    expect(moved.doneDate).toBe("2026-10-14");
  });

  it("answers 404 for an unknown card", async () => {
    const me = await owner();
    const res = await send("/api/cards/nope/move", {
      method: "POST",
      cookie: me.cookie,
      json: { list: "hecho", index: 0 },
    });
    expect(res.status).toBe(404);
  });
});

describe("card by id", () => {
  it("creates a card under the id the client chose, once", async () => {
    const me = await owner();
    const id = crypto.randomUUID();
    const first = await me.call<Card>("/api/cards", "POST", { id, title: "Uno", list: "en_curso" });
    const again = await me.call<Card>("/api/cards", "POST", { id, title: "Otro", list: "en_curso" });
    expect(first.id).toBe(id);
    expect(again).toEqual(first);
    expect((await me.board()).cards).toHaveLength(1);
  });

  it("refuses an id that is not a UUID", async () => {
    const me = await owner();
    const res = await send("/api/cards", {
      method: "POST",
      cookie: me.cookie,
      json: { id: "x", title: "Uno", list: "pendiente" },
    });
    expect(res.status).toBe(400);
  });

  it("reads one card, including one done in an earlier week", async () => {
    setNow(NOON_FRIDAY);
    const me = await owner();
    const old = await me.add("Vieja", "hecho");
    await me.edit(old.id, { doneDate: "2026-09-01" });
    expect(await me.call<Card>(`/api/cards/${old.id}`)).toMatchObject({
      title: "Vieja",
      doneDate: "2026-09-01",
    });
    const res = await send("/api/cards/nope", { cookie: me.cookie });
    expect(res.status).toBe(404);
  });
});

describe("card pages", () => {
  it("sends a card URL without a session to the login page", async () => {
    const res = await send("/c/3f2a");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });
});
