import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { hashPassword } from "./src/worker/password";
import { TEST_PASSWORD } from "./test/constants";

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          OWNER_NAME: "Ana Prueba",
          OWNER_PASSWORD_HASH: await hashPassword(TEST_PASSWORD),
          SESSION_SECRET: "secreto-de-prueba-secreto-de-prueba",
          MIGRATIONS: await readD1Migrations("./drizzle"),
        },
      },
    }),
  ],
  test: { setupFiles: ["./test/setup.ts"] },
}));
