import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card } from "../shared/model";
import { SortableCard } from "./CardView";
import styles from "./CardStack.module.css";
import { containerId, type Container } from "./groups";

export function CardStack(props: { container: Container; cards: Card[]; dragging: boolean }) {
  const id = containerId(props.container);
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <SortableContext
      id={id}
      items={props.cards.map((card) => card.id)}
      strategy={verticalListSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={styles.stack}
        data-dragging={props.dragging}
        data-over={isOver && props.cards.length === 0}
      >
        {props.cards.map((card) => (
          <SortableCard key={card.id} card={card} />
        ))}
      </div>
    </SortableContext>
  );
}
