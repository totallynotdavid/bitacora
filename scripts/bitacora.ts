import { parseArgs } from "node:util";
import { LISTS, type ApiCard } from "../src/shared/model";

const USAGE = `Usage: bun run log -- "<title>" --list <${LISTS.join("|")}> [--label <name>] [--notes <text>] [--requester <name>] [--date <YYYY-MM-DD>]
Reads BITACORA_URL and BITACORA_TOKEN from the environment.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    list: { type: "string" },
    label: { type: "string" },
    notes: { type: "string" },
    requester: { type: "string" },
    date: { type: "string" },
  },
});

const [title, ...extra] = positionals;
const url = process.env.BITACORA_URL;
const token = process.env.BITACORA_TOKEN;
if (!title || extra.length > 0 || !values.list || !url || !token) {
  console.error(USAGE);
  process.exit(2);
}

const res = await fetch(new URL("/api/v1/cards", url), {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ title, ...values }),
});
if (!res.ok) {
  console.error(`${res.status} ${await res.text()}`);
  process.exit(1);
}
const card = (await res.json()) as ApiCard;
console.log(`${card.list} ${card.id} ${card.title}`);
