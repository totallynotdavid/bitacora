import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { mapTrelloExport, ownerKeyOf, toSql, type Owner } from "../src/import/trello";
import { FIRST_ADMIN_ID } from "../src/worker/db/first-admin";
import { targetArgs } from "./d1";

const USAGE = "Usage: mise run import:trello <export.json> [--email <email>] [--apply local|remote]";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { apply: { type: "string" }, email: { type: "string" } },
});
const [path] = positionals;

if (!path || (values.apply !== undefined && values.apply !== "local" && values.apply !== "remote")) {
  console.error(USAGE);
  process.exit(2);
}

// Without --email the cards go to the first admin.
const owner: Owner = values.email ? { email: values.email } : { id: FIRST_ADMIN_ID };
const cards = await mapTrelloExport(JSON.parse(readFileSync(path, "utf8")), ownerKeyOf(owner));
const sql = toSql(cards, owner);

if (!values.apply) {
  console.log(sql);
  process.exit(0);
}

const file = join(mkdtempSync(join(tmpdir(), "bitacora-import-")), "import.sql");
writeFileSync(file, sql);
const run = spawnSync(
  "bunx",
  [
    "wrangler",
    "d1",
    "execute",
    "DB",
    ...targetArgs({ remote: values.apply === "remote", state: process.env.BITACORA_STATE }),
    "--file",
    file,
  ],
  { stdio: "inherit" },
);
if (run.status === 0) console.error(`Imported ${cards.length} cards (${values.apply}).`);
process.exit(run.status ?? 1);
