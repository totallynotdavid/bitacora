import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { mapTrelloExport, ownerKeyOf, toSql, type Owner } from "../src/import/trello";
import type { Card } from "../src/shared/model";
import { FIRST_ADMIN_ID } from "../src/worker/db/first-admin";
import fixture from "./fixtures/trello-export.json";
import { admin, ADMIN, member } from "./helpers";

async function importFixture(owner: Owner = { id: FIRST_ADMIN_ID }) {
  const sql = toSql(await mapTrelloExport(fixture, ownerKeyOf(owner)), owner);
  for (const statement of sql.split("\n")) await env.DB.exec(statement);
  return sql;
}

describe("Trello import", () => {
  it("maps the lists, order, labels and done dates", async () => {
    const me = await admin();
    await importFixture();
    const { cards, labels } = await me.board();
    const name = (id: string | null) => labels.find((l) => l.id === id)?.name ?? null;

    expect(
      cards
        .filter((c) => c.list !== "hecho")
        .map((c) => [c.title, c.list, c.position, name(c.labelId), c.requester]),
    ).toEqual([
      ["Informe de ventas", "en_curso", 1, null, null],
      ["Revisar API de pagos", "en_curso", 2, "Augusto", null],
      ["Estudiar Rust", "esta_semana", 1, null, null],
      ["Migrar la base de datos", "pendiente", 1, "Rodrigo", null],
    ]);
  });

  it("creates each Trello label once, with the nearest of the six colors", async () => {
    const me = await admin();
    await importFixture();
    expect((await me.board()).labels.map((l) => [l.name, l.color])).toEqual([
      ["Augusto", "green"],
      ["Rodrigo", "blue"],
    ]);
  });

  it("reuses a label the user already has", async () => {
    const me = await admin();
    const mine = await me.addLabel("Augusto", "red");
    await importFixture();
    const { cards, labels } = await me.board();
    expect(labels).toHaveLength(2);
    expect(cards.find((c) => c.title === "Revisar API de pagos")?.labelId).toBe(mine.id);
  });

  it("dates Completado cards from the last move into it, in Lima time", async () => {
    const me = await admin();
    await importFixture();
    const done = [
      ...(await me.call<{ cards: Card[] }>("/api/done?week=2026-W42")).cards,
      ...(await me.call<{ cards: Card[] }>("/api/done?week=2026-W41")).cards,
    ];
    expect(Object.fromEntries(done.map((c) => [c.title, c.doneDate]))).toEqual({
      "Configurar CI": "2026-10-13", // moved at 03:30 UTC on the 14th, 22:30 on the 13th in Lima
      "Tarea creada ya terminada": "2026-10-15",
      "Tarea reabierta y cerrada otra vez": "2026-10-14",
    });
  });

  it("keeps the description, quotes and checklist", async () => {
    const me = await admin();
    await importFixture();
    const cards = (await me.board()).cards;
    const payments = cards.find((c) => c.title === "Revisar API de pagos");
    expect(payments?.description).toBe("Primera línea\nSegunda línea");
    expect(payments?.checklist).toEqual([
      { text: "Leer el contrato", done: true },
      { text: "Probar el sandbox", done: false },
    ]);
    expect(cards.find((c) => c.title.startsWith("Migrar"))?.description).toBe("No pasar al cliente 'viejo'");
  });

  it("adds nothing when the same file is imported again", async () => {
    await importFixture();
    await importFixture();
    const cards = await env.DB.prepare("SELECT count(*) AS n FROM cards").first<{ n: number }>();
    const labels = await env.DB.prepare("SELECT count(*) AS n FROM labels").first<{ n: number }>();
    expect([cards?.n, labels?.n]).toEqual([7, 2]);
  });

  it("imports into the account named by email, and into no one else's", async () => {
    const me = await admin();
    const beto = await member(me);
    await importFixture({ email: "BETO@example.com" });
    expect((await beto.board()).cards).toHaveLength(7);
    expect((await me.board()).cards).toEqual([]);
  });

  it("lets two users import the same export", async () => {
    const me = await admin();
    const beto = await member(me);
    await importFixture({ email: ADMIN.email });
    await importFixture({ email: "beto@example.com" });
    expect((await me.board()).cards).toHaveLength(7);
    expect((await beto.board()).cards).toHaveLength(7);
  });

  it("names a list it does not know", async () => {
    const bad = { cards: [{ name: "x", list: "Archivo", pos: 1 }] };
    await expect(mapTrelloExport(bad, "owner")).rejects.toThrow('unknown list "Archivo"');
  });
});
