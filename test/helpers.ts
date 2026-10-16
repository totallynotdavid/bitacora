import { exports } from "cloudflare:workers";
import { vi } from "vitest";
import { TEST_PASSWORD } from "./constants";
import type { Board, Card, Settings } from "../src/shared/model";

type Init = { method?: string; json?: unknown; cookie?: string; form?: Record<string, string> };

export function send(path: string, init: Init = {}): Promise<Response> {
  const headers = new Headers();
  if (init.cookie) headers.set("Cookie", init.cookie);
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

export async function login(): Promise<string> {
  const res = await send("/login", { method: "POST", form: { password: TEST_PASSWORD } });
  return res.headers.getSetCookie()[0]!.split(";")[0]!;
}

export async function owner() {
  const cookie = await login();
  const call = async <T>(path: string, method = "GET", json?: unknown): Promise<T> => {
    const res = await send(path, { method, json, cookie });
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  };
  return {
    cookie,
    call,
    board: () => call<Board>("/api/board"),
    add: (title: string, list: Card["list"], later = false) =>
      call<Card>("/api/cards", "POST", { title, list, later }),
    move: (id: string, move: { list: Card["list"]; later?: boolean; index?: number; doneDate?: string }) =>
      call<Card>(`/api/cards/${id}/move`, "POST", { index: 0, ...move }),
    edit: (id: string, patch: Record<string, unknown>) => call<Card>(`/api/cards/${id}`, "PATCH", patch),
    settings: () => call<Settings>("/api/settings"),
  };
}
