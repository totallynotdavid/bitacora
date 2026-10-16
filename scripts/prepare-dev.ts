import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync(".dev.vars")) {
  copyFileSync(".dev.vars.example", ".dev.vars");
  console.log("Created .dev.vars from .dev.vars.example. The password is bitacora-dev.");
}

const state = process.env.BITACORA_STATE ?? ".wrangler/state";
const migrate = spawnSync(
  "bunx",
  ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", state],
  { stdio: "inherit" },
);
process.exit(migrate.status ?? 1);
