import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The end-to-end tests point this at a directory of their own, so they start on an empty local D1.
const state = process.env.BITACORA_STATE ?? ".wrangler/state";

export default defineConfig({
  plugins: [react(), cloudflare({ persistState: { path: state } })],
});
