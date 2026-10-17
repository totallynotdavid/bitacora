import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { admin, send, setNow } from "./helpers";

const TABLES = ["cards", "labels", "links", "login_attempts", "users", "settings", "d1_migrations"];

async function dropEverything() {
  await env.DB.batch(TABLES.map((table) => env.DB.prepare(`DROP TABLE IF EXISTS ${table}`)));
}

const OLD_TOKEN = "token-del-informe-de-antes-0123456789abcdef";

/** Rows as the database held them before accounts: one board, categories, and `later` inside Pendiente. */
const OLD_CARDS: [
  id: string,
  title: string,
  category: string,
  list: string,
  later: number,
  position: number,
  doneDate: string | null,
][] = [
  ["c1", "Luego uno", "Otros", "pendiente", 1, 1, null],
  ["c2", "Luego dos", "Desarrollo", "pendiente", 1, 2, null],
  ["c3", "Para la semana", "Cursos", "pendiente", 0, 1, null],
  ["c4", "Otra de la semana", "Otros", "pendiente", 0, 2, null],
  ["c5", "En marcha", "Desarrollo", "en_curso", 0, 1, null],
  ["c6", "Terminada", "Cursos", "hecho", 0, 1, "2026-10-15"],
  ["c7", "Terminada sin etiqueta", "Otros", "hecho", 0, 2, "2026-10-15"],
];

describe("the accounts migration on a database with data", () => {
  it("moves the board to the first admin: lists, labels and the report link", async () => {
    setNow("2026-10-16T17:00:00Z");
    try {
      await dropEverything();
      await applyD1Migrations(env.DB, env.MIGRATIONS.slice(0, 2));
      await env.DB.exec("DELETE FROM settings");
      await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('report_token', ?)")
        .bind(OLD_TOKEN)
        .run();
      for (const [id, title, category, list, later, position, doneDate] of OLD_CARDS) {
        await env.DB.prepare(
          "INSERT INTO cards (id, title, category, requester, list, later, position, done_date) VALUES (?, ?, ?, 'Augusto', ?, ?, ?, ?)",
        )
          .bind(id, title, category, list, later, position, doneDate)
          .run();
      }

      await applyD1Migrations(env.DB, env.MIGRATIONS);

      // The account cannot sign in until it is claimed.
      const unclaimed = await env.DB.prepare("SELECT email, password_hash AS hash, role FROM users").all();
      expect(unclaimed.results).toEqual([{ email: null, hash: null, role: "admin" }]);

      const me = await admin();
      const { cards, labels } = await me.board();
      const labelName = (id: string | null) => labels.find((label) => label.id === id)?.name ?? null;
      expect(labels.map((label) => [label.name, label.color])).toEqual([
        ["Cursos", "purple"],
        ["Desarrollo", "green"],
      ]);

      const shape = Object.fromEntries(
        cards.map((card) => [card.id, [card.list, card.position, labelName(card.labelId), card.requester]]),
      );
      expect(shape).toEqual({
        c1: ["pendiente", 1, null, "Augusto"],
        c2: ["pendiente", 2, "Desarrollo", "Augusto"],
        c3: ["esta_semana", 1, "Cursos", "Augusto"],
        c4: ["esta_semana", 2, null, "Augusto"],
        c5: ["en_curso", 1, "Desarrollo", "Augusto"],
        c6: ["hecho", 1, "Cursos", "Augusto"],
        c7: ["hecho", 2, null, "Augusto"],
      });
      expect(cards.find((card) => card.id === "c6")?.doneDate).toBe("2026-10-15");

      expect((await me.settings()).reportToken).toBe(OLD_TOKEN);
      const report = await send(`/r/${OLD_TOKEN}?semana=2026-W42`);
      expect(report.status).toBe(200);
      expect(await report.text()).toContain("Terminada sin etiqueta");
    } finally {
      await dropEverything();
      await applyD1Migrations(env.DB, env.MIGRATIONS);
    }
  });
});
