import { createContext, useContext } from "react";
import type { Label } from "../shared/model";
import type { CreateLabel, UpdateLabel } from "../shared/schemas";
import type { LabelResult } from "./useBoard";

/** What the cards and lists ask the board page to do. */
export type Ui = {
  today: string;
  openCard: (id: string) => void;
  quickEdit: (id: string) => void;
  /** Finishes a card, to the top of today in Hecho, or puts a finished card back in En curso. */
  toggleDone: (id: string) => void;
  /** The composer that is open, by container id. Only one is open at a time. */
  composer: string | null;
  setComposer: (id: string | null) => void;
  addCard: (container: string, title: string) => void;
  /** The user's labels, by name. */
  labels: Label[];
  /** Each of these answers with the message to show when the server refused. */
  createLabel: (input: Omit<CreateLabel, "id">) => Promise<LabelResult>;
  updateLabel: (id: string, patch: UpdateLabel) => Promise<LabelResult>;
  removeLabel: (id: string) => Promise<{ error: string } | null>;
};

export const UiContext = createContext<Ui | null>(null);

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error("UiContext is missing");
  return ui;
}
