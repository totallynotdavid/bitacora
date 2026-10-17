import type { Card } from "../shared/model";
import type { Fields } from "./boardState";
import type { Container } from "./groups";
import { LabelPicker } from "./LabelPicker";
import { DatePicker, MovePicker, RequesterPicker } from "./Pickers";
import { Popover } from "./Popover";

export type PopoverKind = "label" | "requester" | "move" | "date";

export type CardActions = {
  edit: (fields: Fields) => void;
  move: (to: Container) => void;
};

const TITLES: Record<PopoverKind, string> = {
  label: "Etiqueta",
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
      {props.kind === "label" && (
        <LabelPicker
          value={card.labelId}
          onPick={(labelId) => {
            if (labelId !== card.labelId) actions.edit({ labelId });
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
            if (date !== card.doneDate) actions.move({ list: "hecho", doneDate: date });
            props.onClose();
          }}
        />
      )}
    </Popover>
  );
}
