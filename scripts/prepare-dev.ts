import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync(".dev.vars")) {
  copyFileSync(".dev.vars.example", ".dev.vars");
  console.log("Created .dev.vars from .dev.vars.example. The password is bitacora-dev.");
}

const migrate = spawnSync("bunx", ["wrangler", "d1", "migrations", "apply", "DB", "--local"], {
  stdio: "inherit",
});
process.exit(migrate.status ?? 1);
