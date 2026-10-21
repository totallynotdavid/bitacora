import { readFileSync, writeFileSync } from "node:fs";
import { withDatabaseId } from "./database-id";

const CONFIG = "wrangler.jsonc";

try {
  writeFileSync(CONFIG, withDatabaseId(readFileSync(CONFIG, "utf8"), process.env.D1_DATABASE_ID));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
console.log(`Set the D1 database id in ${CONFIG}.`);
