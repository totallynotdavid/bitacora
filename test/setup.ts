import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";
import { FIRST_ADMIN_ID } from "../src/worker/db/first-admin";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.MIGRATIONS);
});

/** Every test starts from the board a fresh deployment has: the unclaimed first admin and nothing else. */
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM cards"),
    env.DB.prepare("DELETE FROM labels"),
    env.DB.prepare("DELETE FROM links"),
    env.DB.prepare("DELETE FROM login_attempts"),
    env.DB.prepare("DELETE FROM users WHERE id <> ?").bind(FIRST_ADMIN_ID),
    env.DB.prepare(
      `UPDATE users SET email = NULL, password_hash = NULL, name = 'Propietario', role = 'admin',
        session_version = 0, disabled = 0, report_token = lower(hex(randomblob(32))) WHERE id = ?`,
    ).bind(FIRST_ADMIN_ID),
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});
