import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mapTrelloExport, toSql } from "../src/import/trello";

const USAGE = "Usage: bun run import:trello <export.json> [--apply local|remote]";

const args = process.argv.slice(2);
const applyAt = args.indexOf("--apply");
const target = applyAt === -1 ? null : args[applyAt + 1];
const path = args.find((arg, i) => !arg.startsWith("--") && (applyAt === -1 || i !== applyAt + 1));

if (!path || (applyAt !== -1 && target !== "local" && target !== "remote")) {
  console.error(USAGE);
  process.exit(2);
}

const cards = await mapTrelloExport(JSON.parse(readFileSync(path, "utf8")));
const sql = toSql(cards);

if (!target) {
  console.log(sql);
  process.exit(0);
}

const file = join(mkdtempSync(join(tmpdir(), "bitacora-import-")), "import.sql");
writeFileSync(file, sql);
const run = spawnSync("bunx", ["wrangler", "d1", "execute", "DB", `--${target}`, "--file", file], {
  stdio: "inherit",
});
if (run.status === 0) console.error(`Imported ${cards.length} cards (${target}).`);
process.exit(run.status ?? 1);
