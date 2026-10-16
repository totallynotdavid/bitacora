import { describe, expect, it } from "vitest";
import { owner, send, setNow } from "./helpers";

const FRIDAY = "2026-10-16T17:00:00Z";

async function seeded() {
  setNow(FRIDAY);
  const me = await owner();
  const shipped = await me.add("Publicar la API", "hecho");
  await me.edit(shipped.id, {
    category: "Desarrollo",
    requester: "Augusto",
    description: "Primera línea\nSegunda línea",
    doneDate: "2026-10-15",
  });
  const course = await me.add("Curso de SQL", "hecho");
  await me.edit(course.id, { category: "Cursos" });
  const lastWeek = await me.add("Tarea de la semana pasada", "hecho");
  await me.edit(lastWeek.id, { doneDate: "2026-10-09" });
  await me.add("Trabajo en marcha", "en_curso");
  await me.add("Todavía pendiente", "pendiente");
  const { reportToken } = await me.settings();
  return { me, token: reportToken };
}

const report = (token: string, query = "") => send(`/r/${token}${query}`);

describe("weekly report", () => {
  it("opens without a session and tells crawlers to stay away", async () => {
    const { token } = await seeded();
    const res = await report(token);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toContain('name="robots" content="noindex');
  });

  it("shows the week, the owner, counts per category and each finished card", async () => {
    const { token } = await seeded();
    const html = await (await report(token)).text();

    expect(html).toContain("12 – 18 oct 2026");
    expect(html).toContain("Ana Prueba");
    expect(html).toMatch(/Desarrollo\s*1/);
    expect(html).toMatch(/Cursos\s*1/);
    expect(html).toMatch(/Otros\s*0/);
    expect(html).toContain("Publicar la API");
    expect(html).toContain("Desarrollo · Augusto");
    expect(html).toContain("Primera línea\nSegunda línea");
    expect(html).not.toContain("Tarea de la semana pasada");
    expect(html).not.toContain("Todavía pendiente");
  });

  it("lists days Monday to Sunday and only those with finished cards", async () => {
    const { token } = await seeded();
    const html = await (await report(token)).text();
    const yesterday = html.indexOf("Ayer, jueves 15 oct");
    const today = html.indexOf("Hoy, viernes 16 oct");
    expect(yesterday).toBeGreaterThan(-1);
    expect(today).toBeGreaterThan(yesterday);
    expect(html).not.toContain("sábado 17 oct");
    expect(html).not.toContain("lunes 12 oct");
  });

  it("shows En curso on the current week only", async () => {
    const { token } = await seeded();
    const current = await (await report(token)).text();
    expect(current).toContain("En curso");
    expect(current).toContain("Trabajo en marcha");

    const previous = await (await report(token, "?semana=2026-W41")).text();
    expect(previous).not.toContain("Trabajo en marcha");
    expect(previous).toContain("Tarea de la semana pasada");
    expect(previous).toContain("5 – 11 oct 2026");
  });

  it("links to the previous and next week", async () => {
    const { token } = await seeded();
    const current = await (await report(token)).text();
    expect(current).toContain(`/r/${token}?semana=2026-W41`);
    expect(current).not.toContain("Semana siguiente");

    const previous = await (await report(token, "?semana=2026-W41")).text();
    expect(previous).toContain(`/r/${token}?semana=2026-W42`);
    expect(previous).toContain(`/r/${token}?semana=2026-W40`);
  });

  it("falls back to the current week on a bad week", async () => {
    const { token } = await seeded();
    const html = await (await report(token, "?semana=basura")).text();
    expect(html).toContain("12 – 18 oct 2026");
  });

  it("answers 404 for an unknown token", async () => {
    await seeded();
    const res = await report("not-the-token");
    expect(res.status).toBe(404);
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
  });
});

describe("report token", () => {
  it("is long, random and stable until regenerated", async () => {
    const { me, token } = await seeded();
    expect(token.length).toBeGreaterThanOrEqual(43); // 256 bits in base64url
    expect((await me.settings()).reportToken).toBe(token);
  });

  it("regenerating kills the old link and opens the new one", async () => {
    const { me, token } = await seeded();
    const fresh = await me.call<{ reportToken: string }>("/api/settings/report-token", "POST");
    expect(fresh.reportToken).not.toBe(token);
    expect((await report(token)).status).toBe(404);
    expect((await report(fresh.reportToken)).status).toBe(200);
    expect((await me.settings()).reportToken).toBe(fresh.reportToken);
  });

  it("keeps exactly one working link when two tabs regenerate at once", async () => {
    const { me } = await seeded();
    const regenerate = () => me.call<{ reportToken: string }>("/api/settings/report-token", "POST");
    const tokens = (await Promise.all([regenerate(), regenerate()])).map((s) => s.reportToken);
    const statuses = await Promise.all(tokens.map(async (t) => (await report(t)).status));
    expect(statuses.toSorted()).toEqual([200, 404]);
    expect(tokens).toContain((await me.settings()).reportToken);
  });

  it("needs a session to read or regenerate", async () => {
    await seeded();
    expect((await send("/api/settings")).status).toBe(401);
    expect((await send("/api/settings/report-token", { method: "POST" })).status).toBe(401);
  });
});
