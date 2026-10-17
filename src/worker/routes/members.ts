import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { inviteSchema, updateMemberSchema } from "../../shared/schemas";
import { connect } from "../db/client";
import { issueInvite, issueReset } from "../links";
import { requireAdmin, type AppEnv } from "../session";
import { findMember, listMembers, updateMember } from "../users";

/** Admin-only routes behind `/api/members`. */
export const members = new Hono<AppEnv>();

members.use(requireAdmin);

members.get("/", async (c) => c.json(await listMembers(connect(c.env))));

members.post("/invites", zValidator("json", inviteSchema), async (c) => {
  return c.json(await issueInvite(connect(c.env), c.req.valid("json").role), 201);
});

members.post("/:id/reset-link", async (c) => {
  const db = connect(c.env);
  const member = await findMember(db, c.req.param("id"));
  if (!member) return c.json({ error: "not found" }, 404);
  return c.json(await issueReset(db, member.id), 201);
});

members.patch("/:id", zValidator("json", updateMemberSchema), async (c) => {
  const db = connect(c.env);
  const id = c.req.param("id");
  const patch = c.req.valid("json");
  const member = await findMember(db, id);
  if (!member) return c.json({ error: "not found" }, 404);
  if (id === c.get("user").id && (patch.role === "member" || patch.disabled === true)) {
    return c.json({ error: "an admin cannot disable or demote themselves" }, 400);
  }
  if (!(await updateMember(db, id, patch))) {
    return c.json({ error: "there must be another admin" }, 409);
  }
  return c.json((await findMember(db, id))!);
});
