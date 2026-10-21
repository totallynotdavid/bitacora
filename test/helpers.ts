import { env, exports } from "cloudflare:workers";
import { vi } from "vitest";
import type {
  ApiToken,
  Board,
  Card,
  IssuedLink,
  IssuedToken,
  Label,
  LabelColor,
  Member,
  Role,
  Settings,
} from "../src/shared/model";
import { claimAdminSql } from "../src/worker/db/first-admin";
import { hashPassword } from "../src/worker/password";

type Init = {
  method?: string;
  json?: unknown;
  cookie?: string;
  bearer?: string;
  /** The client address Cloudflare reports. */
  address?: string;
  form?: Record<string, string>;
};

export function send(path: string, init: Init = {}): Promise<Response> {
  const headers = new Headers();
  if (init.cookie) headers.set("Cookie", init.cookie);
  if (init.bearer) headers.set("Authorization", `Bearer ${init.bearer}`);
  if (init.address) headers.set("CF-Connecting-IP", init.address);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const body = init.form
    ? new URLSearchParams(init.form)
    : init.json !== undefined
      ? JSON.stringify(init.json)
      : undefined;
  return exports.default.fetch(
    new Request(`https://bitacora.test${path}`, {
      method: init.method ?? "GET",
      headers,
      body,
      redirect: "manual",
    }),
  );
}

/** Freezes the clock. Instants are UTC, so Lima is five hours behind. */
export function setNow(iso: string): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

export const ADMIN = { email: "ana@example.com", name: "Ana Prueba", password: "clave-de-prueba" };
export const MEMBER = { email: "beto@example.com", name: "Beto Prueba", password: "otra-clave-de-prueba" };

export const cookieOf = (res: Response): string => res.headers.getSetCookie()[0]!.split(";")[0]!;

/** Signs in through the login form and returns the session cookie. */
export async function signIn(email: string, password: string): Promise<string> {
  const res = await send("/login", { method: "POST", form: { email, password } });
  if (res.status !== 303) throw new Error(`login -> ${res.status}`);
  return cookieOf(res);
}

/** A signed-in user. Every call carries their cookie. */
export function clientFor(cookie: string) {
  const call = async <T>(path: string, method = "GET", json?: unknown): Promise<T> => {
    const res = await send(path, { method, json, cookie });
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  };
  return {
    cookie,
    call,
    /** The status of a call, for the ones that must fail. */
    status: async (path: string, method = "GET", json?: unknown) =>
      (await send(path, { method, json, cookie })).status,
    board: () => call<Board>("/api/board"),
    add: (title: string, list: Card["list"]) => call<Card>("/api/cards", "POST", { title, list }),
    move: (id: string, move: { list: Card["list"]; index?: number; doneDate?: string }) =>
      call<Card>(`/api/cards/${id}/move`, "POST", { index: 0, ...move }),
    edit: (id: string, patch: Record<string, unknown>) => call<Card>(`/api/cards/${id}`, "PATCH", patch),
    addLabel: (name: string, color: LabelColor = "green") =>
      call<Label>("/api/labels", "POST", { name, color }),
    settings: () => call<Settings>("/api/settings"),
    tokens: () => call<ApiToken[]>("/api/tokens"),
    makeToken: (name: string) => call<IssuedToken>("/api/tokens", "POST", { name }),
    members: () => call<Member[]>("/api/members"),
    invite: (role: Role = "member") => call<IssuedLink>("/api/members/invites", "POST", { role }),
    resetLink: (memberId: string) => call<IssuedLink>(`/api/members/${memberId}/reset-link`, "POST"),
  };
}

export type Client = ReturnType<typeof clientFor>;

/** Claims the first admin the way `bun run claim-admin` does and signs in. */
export async function admin(): Promise<Client> {
  await env.DB.exec(
    claimAdminSql({ email: ADMIN.email, name: ADMIN.name, passwordHash: await hashPassword(ADMIN.password) }),
  );
  return clientFor(await signIn(ADMIN.email, ADMIN.password));
}

/** Signs up through an invite link, the only way an account is made, and lands signed in. */
export async function signUp(link: IssuedLink, who = MEMBER): Promise<Response> {
  return send(link.path, {
    method: "POST",
    form: { name: who.name, email: who.email, password: who.password },
  });
}

/** A member invited by `inviter` and signed up through the real invite flow. */
export async function member(inviter: Client, who = MEMBER): Promise<Client> {
  const res = await signUp(await inviter.invite("member"), who);
  if (res.status !== 303) throw new Error(`sign-up -> ${res.status} ${await res.text()}`);
  return clientFor(cookieOf(res));
}

export async function idOf(inviter: Client, email: string): Promise<string> {
  return (await inviter.members()).find((m) => m.email === email)!.id;
}
