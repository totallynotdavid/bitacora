import type { Card } from "../shared/model";
import type { Fields } from "./boardState";
import type { Container } from "./groups";
import { CategoryPicker, DatePicker, MovePicker, RequesterPicker } from "./Pickers";
import { Popover } from "./Popover";

export type PopoverKind = "category" | "requester" | "move" | "date";

export type CardActions = {
  edit: (fields: Fields) => void;
  move: (to: Container) => void;
};

const TITLES: Record<PopoverKind, string> = {
  category: "Categoría",
  requester: "Solicitante",
  move: "Mover tarjeta",
  date: "Fecha de término",
};

export function CardPopover(props: {
  kind: PopoverKind;
  anchor: HTMLElement;
  card: Card;
  today: string;
  requesters: string[];
  actions: CardActions;
  onClose: () => void;
}) {
  const { card, actions, today } = props;

  return (
    <Popover title={TITLES[props.kind]} anchor={props.anchor} onClose={props.onClose}>
      {props.kind === "category" && (
        <CategoryPicker
          value={card.category}
          onPick={(category) => {
            if (category !== card.category) actions.edit({ category });
            props.onClose();
          }}
        />
      )}
      {props.kind === "requester" && (
        <RequesterPicker
          value={card.requester}
          suggestions={props.requesters}
          onSave={(requester) => {
            if (requester !== card.requester) actions.edit({ requester });
            props.onClose();
          }}
        />
      )}
      {props.kind === "move" && (
        <MovePicker
          card={card}
          today={today}
          onMove={(to) => {
            actions.move(to);
            props.onClose();
          }}
        />
      )}
      {props.kind === "date" && (
        <DatePicker
          value={card.doneDate}
          today={today}
          onSave={(date) => {
            if (date !== card.doneDate) actions.move({ list: "hecho", later: false, doneDate: date });
            props.onClose();
          }}
        />
      )}
    </Popover>
  );
}
