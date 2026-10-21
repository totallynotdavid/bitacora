import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createTokenSchema } from "../../shared/schemas";
import { issueToken, listTokens, revokeToken } from "../api-tokens";
import { connect } from "../db/client";
import type { AppEnv } from "../session";

/** A member's own API tokens, behind `/api/tokens`. They need the session, never a bearer. */
export const tokens = new Hono<AppEnv>();

tokens.get("/", async (c) => c.json(await listTokens(connect(c.env), c.get("user").id)));

tokens.post("/", zValidator("json", createTokenSchema), async (c) => {
  const { name } = c.req.valid("json");
  return c.json(await issueToken(connect(c.env), c.get("user").id, name), 201);
});

tokens.delete("/:id", async (c) => {
  const revoked = await revokeToken(connect(c.env), c.get("user").id, c.req.param("id"));
  return revoked ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});
