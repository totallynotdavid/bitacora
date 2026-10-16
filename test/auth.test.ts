import { describe, expect, it } from "vitest";
import { TEST_PASSWORD } from "./constants";
import { login, send } from "./helpers";

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
    const res = await send("/login");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('name="password"');
  });

  it("refuses a wrong password and sets no cookie", async () => {
    const res = await send("/login", { method: "POST", form: { password: "otra" } });
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(await res.text()).toContain("Contraseña incorrecta");
  });

  it("signs in with the password and sets a hardened cookie", async () => {
    const res = await send("/login", { method: "POST", form: { password: TEST_PASSWORD } });
    expect(res.status).toBe(303);
    const cookie = res.headers.getSetCookie()[0]!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const api = await send("/api/board", { cookie: cookie.split(";")[0] });
    expect(api.status).toBe(200);
  });

  it("rejects a forged or tampered cookie", async () => {
    const cookie = await login();
    const [name, value] = cookie.split("=") as [string, string];
    const [expires, signature] = value.split(".") as [string, string];
    const farFuture = String(Number(expires) + 10_000_000);

    expect((await send("/api/board", { cookie: `${name}=${farFuture}.${signature}` })).status).toBe(401);
    expect((await send("/api/board", { cookie: `${name}=${expires}.AAAA` })).status).toBe(401);
  });

  it("signs out", async () => {
    const cookie = await login();
    const res = await send("/logout", { method: "POST", cookie });
    expect(res.headers.get("Set-Cookie")).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});
