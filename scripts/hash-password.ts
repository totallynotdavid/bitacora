import { readFileSync } from "node:fs";
import { hashPassword } from "../src/worker/password";

const password = readFileSync(0, "utf8").replace(/\r?\n$/, "");
if (!password) {
  console.error("Pipe the password on stdin: echo -n 'my password' | bun run hash-password");
  process.exit(2);
}
console.log(await hashPassword(password));
