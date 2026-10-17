import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { dayHeading } from "../shared/dates";
import { LIST_TITLES, type Card, type ListId } from "../shared/model";
import { CardStack } from "./CardStack";
import { Composer } from "./Composer";
import styles from "./ListColumn.module.css";
import { containerId, doneDays, inContainer, HEADER_SUFFIX, type Container } from "./groups";
import type { useOpenDays } from "./useOpenDays";

type Shared = {
  cards: Card[];
  dragging: boolean;
  /** True when an empty list means the filter matched nothing. */
  filtering: boolean;
  /** The list displayed by the narrow layout. */
  current: ListId;
};

const EMPTY: Record<ListId, string> = {
  pendiente: "Aquí van las ideas sin fecha.",
  esta_semana: "Elige lo que harás esta semana.",
  en_curso: "Nada en curso por ahora.",
  hecho: "Lo que termines aparece aquí.",
};

function Column(props: {
  list: ListId;
  current: ListId;
  count: number;
  composer?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={`list-${props.list}`}
      className={styles.column}
      data-list={props.list}
      data-composer={props.composer}
      data-hidden={props.list !== props.current}
      aria-label={LIST_TITLES[props.list]}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>{LIST_TITLES[props.list]}</h2>
        <span className={styles.count}>{props.count}</span>
      </header>
      {props.children}
    </section>
  );
}

/** Describes an empty list above its composer. */
function Empty(props: { list: ListId; filtering: boolean }) {
  return <p className={styles.empty}>{props.filtering ? "Sin coincidencias" : EMPTY[props.list]}</p>;
}

/** A list whose cards sit in one stack: Pendiente, Esta semana or En curso. */
export function FlatColumn(props: Shared & { list: Exclude<ListId, "hecho"> }) {
  const container: Container = { list: props.list, doneDate: null };
  const cards = inContainer(props.cards, container);
  return (
    <Column list={props.list} current={props.current} count={cards.length} composer={props.list}>
      <div className={styles.body}>
        {cards.length === 0 && !props.dragging && <Empty list={props.list} filtering={props.filtering} />}
        <CardStack container={container} cards={cards} dragging={props.dragging} />
      </div>
      <footer className={styles.footer}>
        <Composer container={props.list} />
      </footer>
    </Column>
  );
}

/** Keeps its children mounted while the height animates closed. */
function Collapsible(props: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(props.open);
  if (props.open && !mounted) setMounted(true);

  useEffect(() => {
    if (props.open || !mounted) return;
    const timer = setTimeout(() => setMounted(false), 150);
    return () => clearTimeout(timer);
  }, [props.open, mounted]);

  return (
    <div className={styles.collapsible} data-open={props.open}>
      <div className={styles.collapsibleInner}>{mounted && props.children}</div>
    </div>
  );
}

function DayGroup(props: Shared & { date: string; today: string; open: boolean; onToggle: () => void }) {
  const container: Container = { list: "hecho", doneDate: props.date };
  const cards = inContainer(props.cards, container);
  const { setNodeRef, isOver } = useDroppable({
    id: containerId(container) + HEADER_SUFFIX,
    data: { open: props.open },
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
      <Collapsible open={props.open}>
        <CardStack container={container} cards={cards} dragging={props.dragging} />
      </Collapsible>
    </div>
  );
}

export function DoneColumn(
  props: Shared & {
    today: string;
    days: ReturnType<typeof useOpenDays>;
    hasOlder: boolean;
    onLoadOlder: () => void;
  },
) {
  const { isOpen, toggle } = props.days;
  const days = doneDays(props.cards);
  // An empty today still needs a place to drop a card.
  const shown = props.dragging && !days.includes(props.today) ? [props.today, ...days] : days;
  const todayId = containerId({ list: "hecho", doneDate: props.today });

  const total = props.cards.filter((card) => card.list === "hecho").length;

  return (
    <Column list="hecho" current={props.current} count={total} composer={todayId}>
      <div className={styles.body}>
        {total === 0 && !props.dragging && <Empty list="hecho" filtering={props.filtering} />}
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
      </div>
      <footer className={styles.footer}>
        <Composer container={todayId} />
      </footer>
    </Column>
  );
}
