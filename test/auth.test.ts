import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  ADMIN,
  admin,
  clientFor,
  cookieOf,
  idOf,
  member,
  MEMBER,
  send,
  setNow,
  signIn,
  signUp,
} from "./helpers";

const login = (email: string, password: string) =>
  send("/login", { method: "POST", form: { email, password } });

describe("access", () => {
  it("rejects API calls without a session", async () => {
    expect((await send("/api/board")).status).toBe(401);
    expect(
      (await send("/api/cards", { method: "POST", json: { title: "x", list: "pendiente" } })).status,
    ).toBe(401);
  });

  it("sends page loads to the login page", async () => {
    const res = await send("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("serves the login page without a session", async () => {
    const html = await (await send("/login")).text();
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
  });

  it("refuses a wrong password and sets no cookie", async () => {
    await admin();
    const res = await login(ADMIN.email, "otra");
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(await res.text()).toContain("Correo o contraseña incorrectos");
  });

  it("refuses an unknown email the same way", async () => {
    await admin();
    const res = await login("nadie@example.com", "clave-de-prueba");
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("Correo o contraseña incorrectos");
  });

  it("signs in with the email in any case and sets a hardened cookie", async () => {
    await admin();
    const res = await login(`  ${ADMIN.email.toUpperCase()} `, ADMIN.password);
    expect(res.status).toBe(303);
    const cookie = res.headers.getSetCookie()[0]!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect((await send("/api/board", { cookie: cookie.split(";")[0] })).status).toBe(200);
  });

  it("keeps the first admin out until it is claimed", async () => {
    expect((await login("", "")).status).toBe(401);
    expect((await login("null", "x")).status).toBe(401);
  });

  it("rejects a forged or tampered cookie", async () => {
    const me = await admin();
    const [name, value] = me.cookie.split("=") as [string, string];
    const [userId, version, expires, signature] = value.split(".") as [string, string, string, string];
    const farFuture = String(Number(expires) + 10_000_000);

    expect(
      (await send("/api/board", { cookie: `${name}=${userId}.${version}.${farFuture}.${signature}` })).status,
    ).toBe(401);
    expect(
      (
        await send("/api/board", {
          cookie: `${name}=${userId}.${Number(version) + 1}.${expires}.${signature}`,
        })
      ).status,
    ).toBe(401);
    expect(
      (await send("/api/board", { cookie: `${name}=${userId}.${version}.${expires}.AAAA` })).status,
    ).toBe(401);
  });

  it("signs out", async () => {
    const me = await admin();
    const res = await send("/logout", { method: "POST", cookie: me.cookie });
    expect(res.headers.get("Set-Cookie")).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});

describe("failed logins", () => {
  it("refuses the sixth attempt in 15 minutes even with the right password", async () => {
    await admin();
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await login(ADMIN.email, "mala")).status).toBe(401);
    }
    const locked = await login(ADMIN.email, ADMIN.password);
    expect(locked.status).toBe(429);
    expect(await locked.text()).toContain("Demasiados intentos");
    expect(locked.headers.getSetCookie()).toEqual([]);
  });

  it("lets the email in again after 15 minutes", async () => {
    setNow("2026-10-16T17:00:00Z");
    await admin();
    for (let attempt = 1; attempt <= 6; attempt++) await login(ADMIN.email, "mala");

    setNow("2026-10-16T17:14:00Z");
    expect((await login(ADMIN.email, ADMIN.password)).status).toBe(429);

    setNow("2026-10-16T17:16:00Z");
    expect((await login(ADMIN.email, ADMIN.password)).status).toBe(303);
  });

  it("counts per email and forgets the failures after a good sign-in", async () => {
    const me = await admin();
    await member(me);
    for (let attempt = 1; attempt <= 4; attempt++) await login(ADMIN.email, "mala");
    expect((await login(MEMBER.email, MEMBER.password)).status).toBe(303);
    expect((await login(ADMIN.email, ADMIN.password)).status).toBe(303);
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await login(ADMIN.email, "mala")).status).toBe(401);
    }
  });

  it("counts attempts for emails without an account too", async () => {
    await admin();
    for (let attempt = 1; attempt <= 5; attempt++) await login("nadie@example.com", "x");
    expect((await login("nadie@example.com", "x")).status).toBe(429);
  });

  it("drops the rows of emails that stopped trying, whether or not they were locked", async () => {
    setNow("2026-10-16T17:00:00Z");
    await admin();
    await login("uno@example.com", "x");
    for (let attempt = 1; attempt <= 6; attempt++) await login("dos@example.com", "x");
    const emails = async () =>
      (
        await env.DB.prepare("SELECT email FROM login_attempts ORDER BY email").all<{ email: string }>()
      ).results.map((row) => row.email);
    expect(await emails()).toEqual(["dos@example.com", "uno@example.com"]);

    setNow("2026-10-16T17:20:00Z");
    await login("tres@example.com", "x");
    expect(await emails()).toEqual(["tres@example.com"]);
  });

  it("refuses an email longer than an address can be without counting it", async () => {
    const long = `${"a".repeat(250)}@example.com`;
    expect((await login(long, "x")).status).toBe(401);
    const rows = await env.DB.prepare("SELECT count(*) AS n FROM login_attempts").first<{ n: number }>();
    expect(rows?.n).toBe(0);
  });
});

describe("sessions follow the user row", () => {
  it("signs out a disabled user at once, and back in when enabled", async () => {
    const me = await admin();
    const beto = await member(me);
    const id = await idOf(me, MEMBER.email);

    await me.call(`/api/members/${id}`, "PATCH", { disabled: true });
    expect(await beto.status("/api/board")).toBe(401);
    expect((await login(MEMBER.email, MEMBER.password)).status).toBe(403);

    await me.call(`/api/members/${id}`, "PATCH", { disabled: false });
    expect(await beto.status("/api/board")).toBe(200);
  });

  it("signs out a cookie whose session version is stale", async () => {
    const me = await admin();
    const beto = await member(me);
    await env.DB.prepare("UPDATE users SET session_version = session_version + 1 WHERE email = ?")
      .bind(MEMBER.email)
      .run();
    expect(await beto.status("/api/board")).toBe(401);
  });

  it("rejects an expired cookie", async () => {
    setNow("2026-10-16T17:00:00Z");
    const me = await admin();
    setNow("2026-11-16T17:00:00Z"); // 31 days later
    expect(await me.status("/api/board")).toBe(401);
  });
});

describe("invitations", () => {
  it("signs the invitee up with their own empty board, signed in", async () => {
    const me = await admin();
    await me.add("Solo de Ana", "en_curso");
    const link = await me.invite("member");
    expect(link.path).toMatch(/^\/invitacion\/[\w-]{43}$/);

    const page = await send(link.path);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('name="name"');

    const res = await signUp(link);
    expect(res.status).toBe(303);
    const beto = clientFor(cookieOf(res));
    expect(await beto.board()).toMatchObject({ cards: [], labels: [] });
    expect(await beto.settings()).toMatchObject({ name: MEMBER.name, email: MEMBER.email, role: "member" });
  });

  it("gives the role the invite carried", async () => {
    const me = await admin();
    const res = await signUp(await me.invite("admin"));
    const other = clientFor(cookieOf(res));
    expect((await other.settings()).role).toBe("admin");
    expect(await other.status("/api/members")).toBe(200);
  });

  it("works once", async () => {
    const me = await admin();
    const link = await me.invite("member");
    expect((await signUp(link)).status).toBe(303);

    const second = await signUp(link, { ...MEMBER, email: "otra@example.com" });
    expect(second.status).toBe(404);
    expect((await send(link.path)).status).toBe(404);
    expect(await me.members()).toHaveLength(2);
  });

  it("lets only one of two simultaneous uses win", async () => {
    const me = await admin();
    const link = await me.invite("member");
    const results = await Promise.all([
      signUp(link, { ...MEMBER, email: "uno@example.com" }),
      signUp(link, { ...MEMBER, email: "dos@example.com" }),
    ]);
    expect(results.map((r) => r.status).toSorted()).toEqual([303, 404]);
    expect(await me.members()).toHaveLength(2);
  });

  it("fails after seven days", async () => {
    setNow("2026-10-16T17:00:00Z");
    const me = await admin();
    const link = await me.invite("member");

    setNow("2026-10-23T16:59:00Z");
    expect((await send(link.path)).status).toBe(200);

    setNow("2026-10-23T17:01:00Z");
    expect((await send(link.path)).status).toBe(404);
    expect((await signUp(link)).status).toBe(404);
    expect(await me.members()).toHaveLength(1);
  });

  it("keeps the link usable when the email is taken", async () => {
    const me = await admin();
    const link = await me.invite("member");
    const taken = await signUp(link, { ...MEMBER, email: ADMIN.email.toUpperCase() });
    expect(taken.status).toBe(409);
    expect((await signUp(link)).status).toBe(303);
  });

  it("asks again for a short password or a bad email without using the link", async () => {
    const me = await admin();
    const link = await me.invite("member");
    expect((await signUp(link, { ...MEMBER, password: "corta" })).status).toBe(400);
    expect((await signUp(link, { ...MEMBER, email: "no-es-un-correo" })).status).toBe(400);
    expect((await signUp(link)).status).toBe(303);
  });

  it("stores only a hash of the token", async () => {
    const me = await admin();
    const link = await me.invite("member");
    const token = link.path.split("/").pop()!;
    const rows = await env.DB.prepare("SELECT token_hash FROM links").all<{ token_hash: string }>();
    expect(rows.results.map((row) => row.token_hash)).not.toContain(token);
    expect(rows.results).toHaveLength(1);
  });
});

describe("password reset", () => {
  it("sets the new password and signs out the user's other sessions", async () => {
    const me = await admin();
    const beto = await member(me);
    const other = clientFor(await signIn(MEMBER.email, MEMBER.password));
    const link = await me.resetLink(await idOf(me, MEMBER.email));
    expect(link.path).toMatch(/^\/restablecer\/[\w-]{43}$/);

    expect((await send(link.path)).status).toBe(200);
    const res = await send(link.path, { method: "POST", form: { password: "una-clave-nueva" } });
    expect(res.status).toBe(303);

    expect(await beto.status("/api/board")).toBe(401);
    expect(await other.status("/api/board")).toBe(401);
    expect(await clientFor(cookieOf(res)).status("/api/board")).toBe(200);
    expect((await login(MEMBER.email, MEMBER.password)).status).toBe(401);
    expect((await login(MEMBER.email, "una-clave-nueva")).status).toBe(303);
  });

  it("works once and fails after seven days", async () => {
    setNow("2026-10-16T17:00:00Z");
    const me = await admin();
    await member(me);
    const id = await idOf(me, MEMBER.email);

    const used = await me.resetLink(id);
    expect((await send(used.path, { method: "POST", form: { password: "una-clave-nueva" } })).status).toBe(
      303,
    );
    expect((await send(used.path, { method: "POST", form: { password: "y-otra-mas-larga" } })).status).toBe(
      404,
    );
    expect((await login(MEMBER.email, "una-clave-nueva")).status).toBe(303);

    const old = await me.resetLink(id);
    setNow("2026-10-24T17:00:00Z");
    expect((await send(old.path)).status).toBe(404);
    expect((await send(old.path, { method: "POST", form: { password: "y-otra-mas-larga" } })).status).toBe(
      404,
    );
  });

  it("does not sign a disabled user in", async () => {
    const me = await admin();
    await member(me);
    const id = await idOf(me, MEMBER.email);
    const link = await me.resetLink(id);
    await me.call(`/api/members/${id}`, "PATCH", { disabled: true });
    const res = await send(link.path, { method: "POST", form: { password: "una-clave-nueva" } });
    expect(res.status).toBe(303);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("rejects a link of the other kind", async () => {
    const me = await admin();
    const invite = await me.invite("member");
    const token = invite.path.split("/").pop();
    expect((await send(`/restablecer/${token}`)).status).toBe(404);
  });
});

describe("own account", () => {
  it("renames the user", async () => {
    const me = await admin();
    expect(await me.call("/api/settings", "PATCH", { name: "Ana Nueva" })).toMatchObject({
      name: "Ana Nueva",
    });
    expect((await me.settings()).name).toBe("Ana Nueva");
  });

  it("changes the password, signs out other browsers and keeps this one in", async () => {
    const me = await admin();
    const other = clientFor(await signIn(ADMIN.email, ADMIN.password));

    const res = await send("/api/settings/password", {
      method: "POST",
      cookie: me.cookie,
      json: { current: ADMIN.password, password: "una-clave-nueva" },
    });
    expect(res.status).toBe(204);

    const kept = clientFor(cookieOf(res));
    expect(await kept.status("/api/board")).toBe(200);
    expect(await me.status("/api/board")).toBe(401);
    expect(await other.status("/api/board")).toBe(401);
    expect((await login(ADMIN.email, ADMIN.password)).status).toBe(401);
    expect((await login(ADMIN.email, "una-clave-nueva")).status).toBe(303);
  });

  it("needs the current password and a long enough new one", async () => {
    const me = await admin();
    expect(
      await me.status("/api/settings/password", "POST", { current: "mala", password: "una-clave-nueva" }),
    ).toBe(403);
    expect(
      await me.status("/api/settings/password", "POST", { current: ADMIN.password, password: "corta" }),
    ).toBe(400);
    expect(await me.status("/api/board")).toBe(200);
  });
});

describe("members", () => {
  it("lists everyone to an admin", async () => {
    const me = await admin();
    await member(me);
    expect((await me.members()).map((m) => [m.email, m.role, m.disabled])).toEqual([
      [ADMIN.email, "admin", false],
      [MEMBER.email, "member", false],
    ]);
  });

  it("keeps a member out of every Miembros route", async () => {
    const me = await admin();
    const beto = await member(me);
    const id = await idOf(me, ADMIN.email);

    expect(await beto.status("/api/members")).toBe(403);
    expect(await beto.status("/api/members/invites", "POST", { role: "member" })).toBe(403);
    expect(await beto.status(`/api/members/${id}/reset-link`, "POST")).toBe(403);
    expect(await beto.status(`/api/members/${id}`, "PATCH", { disabled: true })).toBe(403);
    expect((await me.settings()).role).toBe("admin");
    expect(await me.members()).toHaveLength(2);
  });

  it("changes a member's role", async () => {
    const me = await admin();
    const beto = await member(me);
    const id = await idOf(me, MEMBER.email);
    await me.call(`/api/members/${id}`, "PATCH", { role: "admin" });
    expect(await beto.status("/api/members")).toBe(200);
    await me.call(`/api/members/${id}`, "PATCH", { role: "member" });
    expect(await beto.status("/api/members")).toBe(403);
  });

  it("does not let an admin disable or demote themselves", async () => {
    const me = await admin();
    const id = await idOf(me, ADMIN.email);
    expect(await me.status(`/api/members/${id}`, "PATCH", { disabled: true })).toBe(400);
    expect(await me.status(`/api/members/${id}`, "PATCH", { role: "member" })).toBe(400);
    expect(await me.status("/api/board")).toBe(200);
  });

  it("keeps an admin when two admins remove each other at once", async () => {
    const me = await admin();
    const res = await signUp(await me.invite("admin"));
    const other = clientFor(cookieOf(res));
    const myId = await idOf(me, ADMIN.email);
    const otherId = await idOf(me, MEMBER.email);

    const results = await Promise.all([
      me.status(`/api/members/${otherId}`, "PATCH", { disabled: true }),
      other.status(`/api/members/${myId}`, "PATCH", { disabled: true }),
    ]);
    // The one that lands second is refused: by the guard, or because its admin is already disabled.
    expect(results.filter((status) => status === 200)).toHaveLength(1);
    expect(results.filter((status) => status === 409 || status === 401)).toHaveLength(1);
    const admins = (await env.DB.prepare(
      "SELECT count(*) AS n FROM users WHERE role = 'admin' AND disabled = 0",
    ).first<{ n: number }>())!;
    expect(admins.n).toBe(1);
  });

  it("answers 404 for a member that does not exist", async () => {
    const me = await admin();
    expect(await me.status("/api/members/nope", "PATCH", { disabled: true })).toBe(404);
    expect(await me.status("/api/members/nope/reset-link", "POST")).toBe(404);
  });
});
