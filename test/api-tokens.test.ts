import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { ApiCard } from "../src/shared/model";
import { admin, idOf, member, MEMBER, send, setNow } from "./helpers";

const post = (token: string, json: unknown, address?: string) =>
  send("/api/v1/cards", { method: "POST", json, bearer: token, address });

const get = (token: string, query = "", address?: string) =>
  send(`/api/v1/cards${query}`, { bearer: token, address });

async function ana() {
  const me = await admin();
  const { token } = await me.makeToken("cicat");
  return { me, token };
}

async function seededBoard() {
  const { me, token } = await ana();
  await me.addLabel("CICAT");
  await post(token, { title: "Pendiente uno", list: "pendiente" });
  await post(token, { title: "En marcha", list: "en_curso", label: "CICAT" });
  await post(token, { title: "Esta semana", list: "hecho", date: "2026-10-13" });
  await post(token, { title: "Semana anterior", list: "hecho", date: "2026-10-08" });
  return token;
}

const titles = async (res: Response) =>
  ((await res.json()) as { cards: ApiCard[] }).cards.map((c) => c.title);

describe("creating a token", () => {
  it("shows the secret once and lists the token by name and last use", async () => {
    const { me, token } = await ana();
    expect(token).toMatch(/^bit_[\w-]{43}$/);

    const [listed] = await me.tokens();
    expect(listed).toEqual({
      id: expect.any(String),
      name: "cicat",
      createdAt: expect.any(Number),
      lastUsedAt: null,
    });
    expect(JSON.stringify(await me.tokens())).not.toContain(token);

    setNow("2026-10-17T09:00:00Z");
    await get(token);
    expect((await me.tokens())[0]!.lastUsedAt).toBe(Date.parse("2026-10-17T09:00:00Z") / 1000);
  });

  it("stores only a hash of the token", async () => {
    const { token } = await ana();
    const rows = await env.DB.prepare("SELECT * FROM api_tokens").all<Record<string, unknown>>();
    expect(JSON.stringify(rows.results)).not.toContain(token);
  });

  it("needs a name", async () => {
    const me = await admin();
    expect(await me.status("/api/tokens", "POST", { name: "  " })).toBe(400);
  });
});

describe("POST /api/v1/cards", () => {
  it("adds a card to the owner's board with its label, notes and requester", async () => {
    const { me, token } = await ana();
    const label = await me.addLabel("CICAT", "blue");

    const res = await post(token, {
      title: "Informe de enero",
      list: "en_curso",
      label: "cicat",
      notes: "Revisar cifras",
      requester: "Augusto",
    });
    expect(res.status).toBe(201);
    const card = (await res.json()) as ApiCard;
    expect(card).toMatchObject({
      title: "Informe de enero",
      list: "en_curso",
      label: "CICAT",
      labelId: label.id,
      description: "Revisar cifras",
      requester: "Augusto",
      doneDate: null,
    });
    expect((await me.board()).cards).toEqual([
      expect.objectContaining({ id: card.id, title: "Informe de enero" }),
    ]);
  });

  it("dates a Hecho card today in Lima, or on the date given", async () => {
    const { token } = await ana();
    // 2026-10-17T03:00Z is still the 16th in Lima.
    setNow("2026-10-17T03:00:00Z");
    const today = (await (await post(token, { title: "Hoy", list: "hecho" })).json()) as ApiCard;
    expect(today.doneDate).toBe("2026-10-16");
    const earlier = (await (
      await post(token, { title: "Antes", list: "hecho", date: "2026-10-12" })
    ).json()) as ApiCard;
    expect(earlier.doneDate).toBe("2026-10-12");
  });

  it("refuses what it cannot place", async () => {
    const { token } = await ana();
    const refused = [
      { title: "", list: "hecho" },
      { title: "x", list: "archivo" },
      { title: "x", list: "pendiente", date: "2026-10-12" },
      { title: "x", list: "hecho", date: "2026-10-17" },
      { title: "x", list: "hecho", date: "ayer" },
      { title: "x", list: "pendiente", label: "no existe" },
      { title: "x", list: "pendiente", lable: "typo" },
    ];
    for (const body of refused) expect([body, (await post(token, body)).status]).toEqual([body, 400]);
    expect(((await (await get(token)).json()) as { cards: ApiCard[] }).cards).toEqual([]);
  });

  it("works on the token owner's board only", async () => {
    const { me, token } = await ana();
    const beto = await member(me);
    const { token: betoToken } = await beto.makeToken("beto");
    await post(token, { title: "De Ana", list: "pendiente" });
    await post(betoToken, { title: "De Beto", list: "pendiente" });
    expect((await me.board()).cards.map((c) => c.title)).toEqual(["De Ana"]);
    expect((await beto.board()).cards.map((c) => c.title)).toEqual(["De Beto"]);
  });
});

describe("GET /api/v1/cards", () => {
  it("lists open cards and this week's Hecho cards", async () => {
    const token = await seededBoard();
    const body = (await (await get(token)).json()) as { week: string; cards: ApiCard[] };
    expect(body.week).toBe("2026-W42");
    expect(body.cards.map((c) => [c.title, c.label])).toEqual([
      ["En marcha", "CICAT"],
      ["Pendiente uno", null],
      ["Esta semana", null],
    ]);
  });

  it("narrows by list and by week", async () => {
    const token = await seededBoard();
    expect(await titles(await get(token, "?list=en_curso"))).toEqual(["En marcha"]);
    expect(await titles(await get(token, "?list=hecho"))).toEqual(["Esta semana"]);
    expect(await titles(await get(token, "?list=hecho&semana=2026-W41"))).toEqual(["Semana anterior"]);
  });

  it("refuses an unknown list or week", async () => {
    const token = await seededBoard();
    expect((await get(token, "?list=archivo")).status).toBe(400);
    expect((await get(token, "?semana=2026-W99")).status).toBe(400);
  });
});

describe("which routes take which credential", () => {
  it("refuses a cookie-only call to the token routes", async () => {
    const { me } = await ana();
    const res = await send("/api/v1/cards", { cookie: me.cookie });
    expect(res.status).toBe(401);
    expect(
      (
        await send("/api/v1/cards", {
          method: "POST",
          cookie: me.cookie,
          json: { title: "x", list: "pendiente" },
        })
      ).status,
    ).toBe(401);
  });

  it("refuses a bearer on every other route, so a token cannot make tokens", async () => {
    const { token } = await ana();
    expect((await send("/api/board", { bearer: token })).status).toBe(401);
    expect((await send("/api/tokens", { bearer: token })).status).toBe(401);
    expect(
      (await send("/api/tokens", { method: "POST", bearer: token, json: { name: "otro" } })).status,
    ).toBe(401);
    expect((await send("/", { bearer: token })).status).toBe(302);
  });

  it("ignores the cookie when a bearer is sent", async () => {
    const { me } = await ana();
    const res = await send("/api/v1/cards", { cookie: me.cookie, bearer: "bit_otro" });
    expect(res.status).toBe(401);
  });

  it("answers an unknown path under /api/v1 with 404", async () => {
    const { token } = await ana();
    expect((await send("/api/v1/nada", { bearer: token })).status).toBe(404);
  });
});

describe("revoking", () => {
  it("stops the token at once and leaves the others", async () => {
    const { me, token } = await ana();
    const other = await me.makeToken("otro");
    const { id } = (await me.tokens()).find((t) => t.name === "cicat")!;
    expect(await me.status(`/api/tokens/${id}`, "DELETE")).toBe(204);

    expect((await get(token)).status).toBe(401);
    expect((await get(other.token)).status).toBe(200);
    expect((await me.tokens()).map((t) => t.name)).toEqual(["otro"]);
    expect(await me.status(`/api/tokens/${id}`, "DELETE")).toBe(404);
  });

  it("belongs to the owner: another member cannot revoke it", async () => {
    const { me, token } = await ana();
    const beto = await member(me);
    const id = (await me.tokens())[0]!.id;
    expect(await beto.status(`/api/tokens/${id}`, "DELETE")).toBe(404);
    expect(await beto.tokens()).toEqual([]);
    expect((await get(token)).status).toBe(200);
  });
});

describe("a disabled owner", () => {
  it("loses the token until the account is enabled again", async () => {
    const { me } = await ana();
    const beto = await member(me);
    const { token } = await beto.makeToken("beto");
    expect((await get(token)).status).toBe(200);

    const id = await idOf(me, MEMBER.email);
    await me.call(`/api/members/${id}`, "PATCH", { disabled: true });
    expect((await get(token)).status).toBe(401);
    expect((await post(token, { title: "x", list: "pendiente" })).status).toBe(401);

    await me.call(`/api/members/${id}`, "PATCH", { disabled: false });
    expect((await get(token)).status).toBe(200);
  });
});

describe("a wrong token", () => {
  it("is refused with the same answer whether it is malformed or well formed", async () => {
    await ana();
    for (const bearer of ["x", "bit_" + "A".repeat(43)]) {
      const res = await get(bearer);
      expect([res.status, await res.json()]).toEqual([401, { error: "unauthorized" }]);
    }
    expect((await send("/api/v1/cards")).status).toBe(401);
  });

  it("locks an address at the sixth bad attempt, not a good token, not another address", async () => {
    const { token } = await ana();
    const bad = "bit_" + "B".repeat(43);
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await get(bad, "", "203.0.113.7")).status).toBe(401);
    }
    const locked = await get(bad, "", "203.0.113.7");
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await get(bad, "", "203.0.113.7")).status).toBe(429);

    expect((await get(token, "", "203.0.113.7")).status).toBe(200);
    expect((await get(bad, "", "203.0.113.8")).status).toBe(401);

    setNow("2026-10-16T17:16:00Z");
    expect((await get(bad, "", "203.0.113.7")).status).toBe(401);
  });

  it("does not count calls that carry no bearer", async () => {
    const { me } = await ana();
    for (let attempt = 0; attempt < 8; attempt++) {
      expect((await send("/api/v1/cards", { cookie: me.cookie })).status).toBe(401);
    }
    const rows = await env.DB.prepare("SELECT count(*) AS n FROM login_attempts").first<{ n: number }>();
    expect(rows!.n).toBe(0);
  });
});
