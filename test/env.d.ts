declare namespace Cloudflare {
  interface Env {
    SESSION_SECRET: string;
    MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
