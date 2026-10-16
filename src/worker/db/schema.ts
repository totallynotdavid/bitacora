import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { CATEGORIES, LISTS, type Category, type ChecklistItem, type ListId } from "../../shared/model";

export const cards = sqliteTable(
  "cards",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    description: text().notNull().default(""),
    category: text({ enum: CATEGORIES }).$type<Category>().notNull().default("Otros"),
    requester: text(),
    checklist: text({ mode: "json" }).$type<ChecklistItem[]>().notNull().default([]),
    list: text({ enum: LISTS }).$type<ListId>().notNull(),
    later: integer({ mode: "boolean" }).notNull().default(false),
    position: integer().notNull(),
    doneDate: text("done_date"),
  },
  (table) => [
    index("cards_group").on(table.list, table.later, table.doneDate, table.position),
    check("done_date_iff_hecho", sql`(${table.list} = 'hecho') = (${table.doneDate} is not null)`),
    check("later_only_in_pendiente", sql`${table.later} = 0 or ${table.list} = 'pendiente'`),
  ],
);

export const settings = sqliteTable("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
});
