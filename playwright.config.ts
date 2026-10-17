import { defineConfig, devices } from "@playwright/test";

const port = 5273;
const state = ".wrangler/e2e";

export default defineConfig({
  testDir: "e2e",
  // The tests share one local D1, so they run one after another.
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "es-PE",
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A fresh local D1 on every run. The built app is served, so a page load is a few
    // requests instead of one per source module.
    command: `rm -rf ${state} && bun scripts/prepare-dev.ts && vite build && vite preview --port ${port} --strictPort`,
    env: { BITACORA_STATE: state },
    url: `http://localhost:${port}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
