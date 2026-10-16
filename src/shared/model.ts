export const LISTS = ["pendiente", "en_curso", "hecho"] as const;
export type ListId = (typeof LISTS)[number];

export const LIST_TITLES: Record<ListId, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  hecho: "Hecho",
};

export const CATEGORIES = ["Desarrollo", "Cursos", "Otros"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<Category, string> = {
  Desarrollo: "rgb(75 206 151)",
  Cursos: "rgb(201 124 244)",
  Otros: "rgb(252 167 0)",
};

/** The text color that reads on the category's color. */
export const CATEGORY_TEXT: Record<Category, string> = {
  Desarrollo: "rgb(22 75 53)",
  Cursos: "rgb(72 36 93)",
  Otros: "rgb(105 50 0)",
};

export type ChecklistItem = { text: string; done: boolean };

export type Card = {
  id: string;
  title: string;
  description: string;
  category: Category;
  requester: string | null;
  checklist: ChecklistItem[];
  list: ListId;
  /** The "Después" group of Pendiente. False in every other list. */
  later: boolean;
  position: number;
  /** Lima date, `YYYY-MM-DD`. Set exactly when the card is in Hecho. */
  doneDate: string | null;
};

export type Board = {
  today: string;
  week: string;
  cards: Card[];
  olderWeek: string | null;
  requesters: string[];
};

export type DoneWeek = {
  week: string;
  cards: Card[];
  olderWeek: string | null;
};

export type Settings = {
  ownerName: string;
  reportToken: string;
};
