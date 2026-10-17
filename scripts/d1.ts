import { spawnSync } from "node:child_process";

export type Target = { remote: boolean; state?: string };

/** `wrangler d1 execute` arguments for a local state directory or the remote database. */
export const targetArgs = ({ remote, state }: Target): string[] =>
  remote ? ["--remote"] : ["--local", ...(state ? ["--persist-to", state] : [])];

/**
 * Runs one SQL statement against the `DB` database and returns how many rows it
 * returned. It passes the statement with `--command`: `--file` against the remote
 * database goes through D1 import, which returns a summary instead of the rows.
 */
export function executeSql(sql: string, target: Target): number {
  const run = spawnSync(
    "bunx",
    ["wrangler", "d1", "execute", "DB", ...targetArgs(target), "--json", "--command", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  if (run.status !== 0) {
    process.stdout.write(run.stdout);
    process.exit(run.status ?? 1);
  }
  const statements = JSON.parse(run.stdout) as { results?: unknown[] }[];
  return statements[0]?.results?.length ?? 0;
}
