import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { mapTrelloExport, toSql } from "../src/import/trello";
import type { Card } from "../src/shared/model";
import fixture from "./fixtures/trello-export.json";
import { owner } from "./helpers";

async function importFixture() {
  const sql = toSql(await mapTrelloExport(fixture));
  for (const statement of sql.split("\n")) await env.DB.exec(statement);
  return sql;
}

const summary = (cards: Card[]) =>
  cards.map((c) => [c.title, c.list, c.later, c.position, c.doneDate, c.requester] as const);

describe("Trello import", () => {
  it("maps the lists, order, requester, category and done dates", async () => {
    await importFixture();
    const me = await owner();
    const cards = (await me.board()).cards;

    expect(summary(cards.filter((c) => c.list !== "hecho"))).toEqual([
      ["Informe de ventas", "en_curso", false, 1, null, null],
      ["Revisar API de pagos", "en_curso", false, 2, null, "Augusto"],
      ["Estudiar Rust", "pendiente", false, 1, null, null],
      ["Migrar la base de datos", "pendiente", true, 1, null, "Rodrigo"],
    ]);
    expect(cards.every((c) => c.category === "Otros")).toBe(true);
  });

  it("dates Completado cards from the last move into it, in Lima time", async () => {
    await importFixture();
    const me = await owner();
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
    await importFixture();
    const cards = (await (await owner()).board()).cards;
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
    const count = await env.DB.prepare("SELECT count(*) AS n FROM cards").first<{ n: number }>();
    expect(count?.n).toBe(7);
  });

  it("names a list it does not know", async () => {
    const bad = { cards: [{ name: "x", list: "Archivo", pos: 1 }] };
    await expect(mapTrelloExport(bad)).rejects.toThrow('unknown list "Archivo"');
  });
});
