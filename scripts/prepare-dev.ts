import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { claimAdminSql } from "../src/worker/db/first-admin";
import { hashPassword } from "../src/worker/password";
import { executeSql } from "./d1";
import { DEV_ACCOUNT } from "./dev-account";

if (!existsSync(".dev.vars")) {
  copyFileSync(".dev.vars.example", ".dev.vars");
  console.log("Created .dev.vars from .dev.vars.example.");
}

const state = process.env.BITACORA_STATE ?? ".wrangler/state";
const migrate = spawnSync(
  "bunx",
  ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", state],
  { stdio: "inherit" },
);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

// The migration leaves the first admin without an email or a password. Local
// development signs in with a fixed account, claimed once.
const claimed = executeSql(
  claimAdminSql({
    email: DEV_ACCOUNT.email,
    name: DEV_ACCOUNT.name,
    passwordHash: await hashPassword(DEV_ACCOUNT.password),
  }),
  { remote: false, state },
);
if (claimed > 0)
  console.log(`Signed in locally as ${DEV_ACCOUNT.email} with the password ${DEV_ACCOUNT.password}.`);
