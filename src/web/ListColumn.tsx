import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { dayHeading } from "../shared/dates";
import { LIST_TITLES, type Card, type ListId } from "../shared/model";
import { CardStack } from "./CardStack";
import styles from "./ListColumn.module.css";
import { containerId, doneDays, inContainer, HEADER_SUFFIX, type Container } from "./groups";
import { QuickAdd } from "./QuickAdd";
import { useOpenDays } from "./useOpenDays";

type Shared = {
  cards: Card[];
  dragging: boolean;
  onOpen: (id: string) => void;
};

function Column(props: { list: ListId; count: number; footer: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.column} data-list={props.list} aria-label={LIST_TITLES[props.list]}>
      <header className={styles.header}>
        <h2 className={styles.title}>{LIST_TITLES[props.list]}</h2>
        <span className={styles.count}>{props.count}</span>
      </header>
      <div className={styles.body}>{props.children}</div>
      <footer className={styles.footer}>{props.footer}</footer>
    </section>
  );
}

function PendingGroup(props: Shared & { later: boolean; label: string }) {
  const container: Container = { list: "pendiente", later: props.later, doneDate: null };
  const cards = inContainer(props.cards, container);
  return (
    <div className={styles.group}>
      <h3 className={styles.groupLabel}>
        <span>{props.label}</span>
        <span className={styles.count}>{cards.length}</span>
      </h3>
      <CardStack container={container} cards={cards} dragging={props.dragging} onOpen={props.onOpen} />
    </div>
  );
}

export function PendingColumn(props: Shared & { onAdd: (title: string, later: boolean) => void }) {
  const total = props.cards.filter((card) => card.list === "pendiente").length;
  return (
    <Column list="pendiente" count={total} footer={<QuickAdd withHorizon onAdd={props.onAdd} />}>
      <PendingGroup {...props} later={false} label="Esta semana" />
      <PendingGroup {...props} later label="Después" />
    </Column>
  );
}

export function ActiveColumn(props: Shared & { onAdd: (title: string, later: boolean) => void }) {
  const container: Container = { list: "en_curso", later: false, doneDate: null };
  const cards = inContainer(props.cards, container);
  return (
    <Column
      list="en_curso"
      count={cards.length}
      footer={<QuickAdd withHorizon={false} onAdd={props.onAdd} />}
    >
      <CardStack container={container} cards={cards} dragging={props.dragging} onOpen={props.onOpen} />
    </Column>
  );
}

function DayGroup(props: Shared & { date: string; today: string; open: boolean; onToggle: () => void }) {
  const container: Container = { list: "hecho", later: false, doneDate: props.date };
  const cards = inContainer(props.cards, container);
  const { setNodeRef, isOver } = useDroppable({
    id: containerId(container) + HEADER_SUFFIX,
    disabled: props.open,
  });
  const Chevron = props.open ? ChevronDown : ChevronRight;

  return (
    <div className={styles.group}>
      <button
        ref={setNodeRef}
        type="button"
        className={styles.dayHeader}
        data-over={isOver}
        aria-expanded={props.open}
        onClick={props.onToggle}
      >
        <Chevron size={16} aria-hidden />
        <span className={styles.dayLabel}>{dayHeading(props.date, props.today)}</span>
        <span className={styles.count}>{cards.length}</span>
      </button>
      {props.open && (
        <CardStack container={container} cards={cards} dragging={props.dragging} onOpen={props.onOpen} />
      )}
    </div>
  );
}

export function DoneColumn(
  props: Shared & {
    today: string;
    hasOlder: boolean;
    onLoadOlder: () => void;
    onAdd: (title: string, later: boolean) => void;
  },
) {
  const { isOpen, toggle } = useOpenDays(props.today);
  const days = doneDays(props.cards);
  // An empty today still needs a place to drop a card.
  const shown = props.dragging && !days.includes(props.today) ? [props.today, ...days] : days;

  return (
    <Column
      list="hecho"
      count={props.cards.filter((card) => card.list === "hecho").length}
      footer={<QuickAdd withHorizon={false} onAdd={props.onAdd} />}
    >
      {shown.map((date) => (
        <DayGroup
          key={date}
          {...props}
          date={date}
          open={isOpen(date) || (props.dragging && date === props.today)}
          onToggle={() => toggle(date)}
        />
      ))}
      {props.hasOlder && (
        <button type="button" className={styles.older} onClick={props.onLoadOlder}>
          Semanas anteriores
        </button>
      )}
    </Column>
  );
}
