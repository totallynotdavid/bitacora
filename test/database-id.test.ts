import { describe, expect, it } from "vitest";
import { PLACEHOLDER, withDatabaseId } from "../scripts/database-id";

const CONFIG = `{ "d1_databases": [{ "binding": "DB", "database_id": "${PLACEHOLDER}" }] }`;

describe("withDatabaseId", () => {
  it("puts the id where the placeholder was", () => {
    const id = "3f2a1c9e-0b7d-4e55-9a41-6c1d2e8f7a90";
    expect(JSON.parse(withDatabaseId(CONFIG, ` ${id}\n`)).d1_databases[0].database_id).toBe(id);
  });

  it("keeps an id that holds replacement patterns as it is", () => {
    expect(withDatabaseId(CONFIG, "a$&b")).toContain('"a$&b"');
  });

  it.each([undefined, "", "  \n"])("fails when the variable is %j", (value) => {
    expect(() => withDatabaseId(CONFIG, value)).toThrow(/D1_DATABASE_ID is empty/);
  });

  it("fails when the placeholder is gone", () => {
    expect(() => withDatabaseId(CONFIG.replace(PLACEHOLDER, "already-set"), "abc")).toThrow(
      /no REPLACE_WITH_DATABASE_ID/,
    );
  });
});
