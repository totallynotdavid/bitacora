import { z } from "zod";
import { parseWeek } from "./dates";
import { LABEL_COLORS, LISTS, MIN_PASSWORD, ROLES } from "./model";

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
const rowId = z.string().min(1).max(64);

export const createCardSchema = z.object({
  /** Chosen by the client so a card can be shown and edited before the server answers. */
  id: z.uuid().optional(),
  title,
  list: z.enum(LISTS),
});

/** The card a script posts. The label is a name, and `date` is the Lima date of a Hecho card. */
export const apiCreateCardSchema = z
  .strictObject({
    title,
    list: z.enum(LISTS),
    label: z.string().trim().min(1).max(40).optional(),
    notes: description.optional(),
    requester: requester.optional(),
    date: doneDate.optional(),
  })
  .refine((card) => card.date === undefined || card.list === "hecho", {
    message: "date applies only to the hecho list",
    path: ["date"],
  });

export const apiListCardsSchema = z.object({
  list: z.enum(LISTS).optional(),
  semana: z
    .string()
    .refine((week) => parseWeek(week) !== null, "semana must look like 2026-W42")
    .optional(),
});

export const createTokenSchema = z.object({ name: z.string().trim().min(1).max(80) });

export const updateCardSchema = z.object({
  title: title.optional(),
  description: description.optional(),
  labelId: rowId.nullable().optional(),
  requester: requester.optional(),
  checklist: checklist.optional(),
  list: z.enum(LISTS).optional(),
  doneDate: doneDate.optional(),
});

export const moveCardSchema = z.object({
  list: z.enum(LISTS),
  doneDate: doneDate.optional(),
  index: z.number().int().min(0),
});

const labelName = z.string().trim().min(1).max(40);

export const createLabelSchema = z.object({
  id: z.uuid().optional(),
  name: labelName,
  color: z.enum(LABEL_COLORS),
});

export const updateLabelSchema = z.object({
  name: labelName.optional(),
  color: z.enum(LABEL_COLORS).optional(),
});

const userName = z.string().trim().min(1).max(80);
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const password = z.string().min(MIN_PASSWORD).max(200);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().max(200),
});
export const signUpSchema = z.object({ name: userName, email, password });
export const resetSchema = z.object({ password });
export const updateSettingsSchema = z.object({ name: userName });
export const changePasswordSchema = z.object({ current: z.string().max(200), password });

export const inviteSchema = z.object({ role: z.enum(ROLES) });
export const updateMemberSchema = z.object({
  role: z.enum(ROLES).optional(),
  disabled: z.boolean().optional(),
});

export type CreateCard = z.infer<typeof createCardSchema>;
export type UpdateCard = z.infer<typeof updateCardSchema>;
export type MoveCard = z.infer<typeof moveCardSchema>;
export type CreateLabel = z.infer<typeof createLabelSchema>;
export type UpdateLabel = z.infer<typeof updateLabelSchema>;
