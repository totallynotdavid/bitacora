import { z } from "zod";
import { CATEGORIES, LISTS } from "./model";

const title = z.string().trim().min(1).max(200);
const description = z.string().max(10_000);
const requester = z
  .string()
  .trim()
  .max(80)
  .nullable()
  .transform((value) => value || null);
const checklist = z.array(z.object({ text: z.string().trim().min(1).max(200), done: z.boolean() })).max(100);
const doneDate = z.iso.date();

export const createCardSchema = z.object({
  title,
  list: z.enum(LISTS),
  later: z.boolean().default(false),
});

export const updateCardSchema = z.object({
  title: title.optional(),
  description: description.optional(),
  category: z.enum(CATEGORIES).optional(),
  requester: requester.optional(),
  checklist: checklist.optional(),
  list: z.enum(LISTS).optional(),
  later: z.boolean().optional(),
  doneDate: doneDate.optional(),
});

export const moveCardSchema = z.object({
  list: z.enum(LISTS),
  later: z.boolean().default(false),
  doneDate: doneDate.optional(),
  index: z.number().int().min(0),
});

export type CreateCard = z.infer<typeof createCardSchema>;
export type UpdateCard = z.infer<typeof updateCardSchema>;
export type MoveCard = z.infer<typeof moveCardSchema>;
