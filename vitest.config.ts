import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          SESSION_SECRET: "secreto-de-prueba-secreto-de-prueba",
          MIGRATIONS: await readD1Migrations("./drizzle"),
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    // The contrast test reads the token file as text.
    css: { include: [/tokens\.css/] },
  },
}));
