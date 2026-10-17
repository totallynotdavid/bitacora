import { describe, expect, it } from "vitest";
import type { Card } from "../src/shared/model";
import { admin, member, send } from "./helpers";

async function twoUsers() {
  const ana = await admin();
  const beto = await member(ana);
  return { ana, beto };
}

describe("two users", () => {
  it("list only their own cards, requesters and labels", async () => {
    const { ana, beto } = await twoUsers();
    const label = await ana.addLabel("Desarrollo");
    const card = await ana.add("De Ana", "pendiente");
    await ana.edit(card.id, { requester: "Augusto", labelId: label.id });
    await beto.add("De Beto", "en_curso");

    const anaBoard = await ana.board();
    expect(anaBoard.cards.map((c) => c.title)).toEqual(["De Ana"]);
    const betoBoard = await beto.board();
    expect(betoBoard.cards.map((c) => c.title)).toEqual(["De Beto"]);
    expect(betoBoard.labels).toEqual([]);
    expect(betoBoard.requesters).toEqual([]);
  });

  it("number their positions independently", async () => {
    const { ana, beto } = await twoUsers();
    await ana.add("a1", "en_curso");
    await ana.add("a2", "en_curso");
    const first = await beto.add("b1", "en_curso");
    expect(first.position).toBe(1);
  });

  it("cannot read, edit, move or delete each other's card", async () => {
    const { ana, beto } = await twoUsers();
    const card = await ana.add("De Ana", "en_curso");

    expect(await beto.status(`/api/cards/${card.id}`)).toBe(404);
    expect(await beto.status(`/api/cards/${card.id}`, "PATCH", { title: "Mío ahora" })).toBe(404);
    expect(await beto.status(`/api/cards/${card.id}/move`, "POST", { list: "hecho", index: 0 })).toBe(404);
    expect(await beto.status(`/api/cards/${card.id}`, "DELETE")).toBe(404);

    expect(await ana.call<Card>(`/api/cards/${card.id}`)).toEqual(card);
  });

  it("cannot see each other's done cards by week", async () => {
    const { ana, beto } = await twoUsers();
    await ana.add("Terminada", "hecho");
    const week = (await ana.board()).week;
    expect((await beto.call<{ cards: Card[] }>(`/api/done?week=${week}`)).cards).toEqual([]);
    expect((await ana.call<{ cards: Card[] }>(`/api/done?week=${week}`)).cards).toHaveLength(1);
  });

  it("answer 409 to a create with an id the other user owns, and leak nothing", async () => {
    const { ana, beto } = await twoUsers();
    const id = crypto.randomUUID();
    await ana.call<Card>("/api/cards", "POST", { id, title: "Secreto de Ana", list: "pendiente" });

    const res = await send("/api/cards", {
      method: "POST",
      cookie: beto.cookie,
      json: { id, title: "Mío", list: "en_curso" },
    });
    expect(res.status).toBe(409);
    expect(await res.text()).not.toContain("Secreto de Ana");
    expect((await beto.board()).cards).toEqual([]);
    expect((await ana.call<Card>(`/api/cards/${id}`)).title).toBe("Secreto de Ana");
  });

  it("repeat a create with their own id and get their card back", async () => {
    const { ana } = await twoUsers();
    const id = crypto.randomUUID();
    const first = await ana.call<Card>("/api/cards", "POST", { id, title: "Uno", list: "pendiente" });
    expect(await ana.call<Card>("/api/cards", "POST", { id, title: "Otro", list: "pendiente" })).toEqual(
      first,
    );
  });

  it("cannot use, edit or delete each other's label", async () => {
    const { ana, beto } = await twoUsers();
    const label = await ana.addLabel("De Ana", "red");
    const card = await beto.add("De Beto", "pendiente");

    expect(await beto.status(`/api/cards/${card.id}`, "PATCH", { labelId: label.id })).toBe(400);
    expect(await beto.status(`/api/labels/${label.id}`, "PATCH", { name: "Robada" })).toBe(404);
    expect(await beto.status(`/api/labels/${label.id}`, "DELETE")).toBe(404);
    expect((await ana.board()).labels).toEqual([label]);
  });

  it("may use the same label name", async () => {
    const { ana, beto } = await twoUsers();
    await ana.addLabel("Desarrollo", "green");
    await beto.addLabel("Desarrollo", "blue");
    expect((await beto.board()).labels).toMatchObject([{ name: "Desarrollo", color: "blue" }]);
  });
});

describe("labels", () => {
  it("clears a deleted label from its cards", async () => {
    const ana = await admin();
    const label = await ana.addLabel("Desarrollo");
    const other = await ana.addLabel("Cursos", "purple");
    const a = await ana.add("a", "pendiente");
    const b = await ana.add("b", "en_curso");
    const c = await ana.add("c", "hecho");
    await ana.edit(a.id, { labelId: label.id });
    await ana.edit(b.id, { labelId: label.id });
    await ana.edit(c.id, { labelId: other.id });

    expect(await ana.status(`/api/labels/${label.id}`, "DELETE")).toBe(204);

    const cards = (await ana.board()).cards;
    expect(Object.fromEntries(cards.map((card) => [card.title, card.labelId]))).toEqual({
      a: null,
      b: null,
      c: other.id,
    });
    expect((await ana.board()).labels).toEqual([other]);
  });

  it("renames and recolors a label, and refuses a name already used", async () => {
    const ana = await admin();
    const label = await ana.addLabel("Desarrollo", "green");
    await ana.addLabel("Cursos", "purple");

    expect(await ana.call("/api/labels/" + label.id, "PATCH", { name: "Código", color: "blue" })).toEqual({
      id: label.id,
      name: "Código",
      color: "blue",
    });
    expect(await ana.status(`/api/labels/${label.id}`, "PATCH", { name: "Cursos" })).toBe(409);
    expect(await ana.status("/api/labels", "POST", { name: "Cursos", color: "red" })).toBe(409);
  });

  it("accepts only Trello's six colors", async () => {
    const ana = await admin();
    expect(await ana.status("/api/labels", "POST", { name: "x", color: "pink" })).toBe(400);
    expect(await ana.status("/api/labels", "POST", { name: "  ", color: "red" })).toBe(400);
  });

  it("creates under a client id once", async () => {
    const ana = await admin();
    const id = crypto.randomUUID();
    const first = await ana.call("/api/labels", "POST", { id, name: "Uno", color: "red" });
    expect(await ana.call("/api/labels", "POST", { id, name: "Uno", color: "red" })).toEqual(first);
    expect((await ana.board()).labels).toHaveLength(1);
  });
});
