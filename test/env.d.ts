declare namespace Cloudflare {
  interface Env {
    OWNER_PASSWORD_HASH: string;
    SESSION_SECRET: string;
    MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
