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
  Desarrollo: "#1f845a",
  Cursos: "#6e5dc6",
  Otros: "#cf9f02",
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
