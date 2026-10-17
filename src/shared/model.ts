export const LISTS = ["pendiente", "esta_semana", "en_curso", "hecho"] as const;
export type ListId = (typeof LISTS)[number];

export const LIST_TITLES: Record<ListId, string> = {
  pendiente: "Pendiente",
  esta_semana: "Esta semana",
  en_curso: "En curso",
  hecho: "Hecho",
};

/** Trello's six label colors. The database stores the name, never the values. */
export const LABEL_COLORS = ["green", "yellow", "orange", "red", "purple", "blue"] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export const LABEL_COLOR_NAMES: Record<LabelColor, string> = {
  green: "Verde",
  yellow: "Amarillo",
  orange: "Naranja",
  red: "Rojo",
  purple: "Morado",
  blue: "Azul",
};

/** The background of a label and the text color that reads on it. */
export const LABEL_STYLES: Record<LabelColor, { background: string; text: string }> = {
  green: { background: "rgb(75 206 151)", text: "rgb(22 75 53)" },
  yellow: { background: "rgb(238 209 43)", text: "rgb(83 63 4)" },
  orange: { background: "rgb(252 167 0)", text: "rgb(105 50 0)" },
  red: { background: "rgb(248 113 104)", text: "rgb(93 31 26)" },
  purple: { background: "rgb(201 124 244)", text: "rgb(72 36 93)" },
  blue: { background: "rgb(102 157 241)", text: "rgb(18 50 99)" },
};

export const MIN_PASSWORD = 8;

export const ROLES = ["admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_TITLES: Record<Role, string> = {
  admin: "Administrador",
  member: "Miembro",
};

export type Label = { id: string; name: string; color: LabelColor };

export type ChecklistItem = { text: string; done: boolean };

export type Card = {
  id: string;
  title: string;
  description: string;
  /** The card's label, or null. A card without a label shows no stripe. */
  labelId: string | null;
  requester: string | null;
  checklist: ChecklistItem[];
  list: ListId;
  position: number;
  /** Lima date, `YYYY-MM-DD`. Set exactly when the card is in Hecho. */
  doneDate: string | null;
};

export type Board = {
  today: string;
  week: string;
  cards: Card[];
  labels: Label[];
  olderWeek: string | null;
  requesters: string[];
};

export type DoneWeek = {
  week: string;
  cards: Card[];
  olderWeek: string | null;
};

/** What Ajustes shows about the signed-in user. */
export type Settings = {
  id: string;
  name: string;
  email: string;
  role: Role;
  reportToken: string;
};

export type Member = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  disabled: boolean;
};

/** A single-use link the admin copies and sends. `path` is relative to the site. */
export type IssuedLink = { path: string; expiresAt: number };
