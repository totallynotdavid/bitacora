import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import {
  LABEL_COLORS,
  LISTS,
  ROLES,
  type ChecklistItem,
  type LabelColor,
  type ListId,
  type Role,
} from "../../shared/model";

export const LINK_KINDS = ["invite", "reset"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/** The email and the password hash of the account created by the migration stay null until it is claimed. */
export const users = sqliteTable(
  "users",
  {
    id: text().primaryKey(),
    email: text().unique(),
    name: text().notNull(),
    passwordHash: text("password_hash"),
    role: text({ enum: ROLES }).$type<Role>().notNull(),
    sessionVersion: integer("session_version").notNull().default(0),
    disabled: integer({ mode: "boolean" }).notNull().default(false),
    reportToken: text("report_token")
      .notNull()
      .unique()
      .default(sql`(lower(hex(randomblob(32))))`),
  },
  (table) => [
    check("email_lowercase", sql`${table.email} = lower(${table.email})`),
    check("role_known", sql`${table.role} in ('admin', 'member')`),
  ],
);

export const labels = sqliteTable(
  "labels",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    color: text({ enum: LABEL_COLORS }).$type<LabelColor>().notNull(),
  },
  (table) => [
    unique("labels_user_name").on(table.userId, table.name),
    check("color_known", sql`${table.color} in ('green', 'yellow', 'orange', 'red', 'purple', 'blue')`),
  ],
);

export const cards = sqliteTable(
  "cards",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text().notNull().default(""),
    labelId: text("label_id").references(() => labels.id, { onDelete: "set null" }),
    requester: text(),
    checklist: text({ mode: "json" }).$type<ChecklistItem[]>().notNull().default([]),
    list: text({ enum: LISTS }).$type<ListId>().notNull(),
    position: integer().notNull(),
    doneDate: text("done_date"),
  },
  (table) => [
    index("cards_group").on(table.userId, table.list, table.doneDate, table.position),
    check("done_date_iff_hecho", sql`(${table.list} = 'hecho') = (${table.doneDate} is not null)`),
  ],
);

/**
 * Single-use links an admin sends: an invite carries the role, a reset the user.
 * Only the SHA-256 of the token is stored.
 */
export const links = sqliteTable(
  "links",
  {
    tokenHash: text("token_hash").primaryKey(),
    kind: text({ enum: LINK_KINDS }).$type<LinkKind>().notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    role: text({ enum: ROLES }).$type<Role>(),
    /** Unix seconds. */
    expiresAt: integer("expires_at").notNull(),
    usedAt: integer("used_at"),
  },
  (table) => [
    check(
      "link_kind_fields",
      sql`(${table.kind} = 'invite' and ${table.role} is not null and ${table.userId} is null)
        or (${table.kind} = 'reset' and ${table.userId} is not null and ${table.role} is null)`,
    ),
  ],
);

/** Sign-in attempts per email in the current window. See `login-limit.ts`. */
export const loginAttempts = sqliteTable("login_attempts", {
  email: text().primaryKey(),
  attempts: integer().notNull(),
  /** Unix seconds. */
  windowStart: integer("window_start").notNull(),
  /** Unix seconds. Zero, or in the past, when the email is not locked. */
  lockedUntil: integer("locked_until").notNull().default(0),
});
