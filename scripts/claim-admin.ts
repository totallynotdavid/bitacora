import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { claimAdminSql } from "../src/worker/db/first-admin";
import { hashPassword } from "../src/worker/password";
import { MIN_PASSWORD } from "../src/shared/model";
import { executeSql } from "./d1";

const USAGE = "Usage: bun run claim-admin -- --email <email> --name <name> [--remote]";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    remote: { type: "boolean", default: false },
  },
});

if (!values.email?.includes("@") || !values.name?.trim()) {
  console.error(USAGE);
  process.exit(2);
}

/** Reads a line from the terminal without echoing it. */
function promptHidden(label: string): Promise<string> {
  process.stderr.write(label);
  return new Promise((resolve) => {
    let line = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off("data", onData);
          process.stderr.write("\n");
          return resolve(line);
        }
        if (char === "\u0003") process.exit(130);
        line = char === "\u007f" ? line.slice(0, -1) : line + char;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) return readFileSync(0, "utf8").replace(/\r?\n$/, "");
  const password = await promptHidden("Password: ");
  if (password !== (await promptHidden("Repeat the password: "))) {
    console.error("The passwords differ.");
    process.exit(1);
  }
  return password;
}

const password = await readPassword();
if (password.length < MIN_PASSWORD) {
  console.error(`The password needs at least ${MIN_PASSWORD} characters.`);
  process.exit(1);
}

const sql = claimAdminSql({
  email: values.email,
  name: values.name.trim(),
  passwordHash: await hashPassword(password),
});
const claimed = executeSql(sql, {
  remote: values.remote,
  state: process.env.BITACORA_STATE,
});
if (claimed === 0) {
  console.error("The first admin is already claimed. Nothing changed.");
  process.exit(1);
}
console.log(
  `Claimed the first admin as ${values.email.trim().toLowerCase()} (${values.remote ? "remote" : "local"}).`,
);
