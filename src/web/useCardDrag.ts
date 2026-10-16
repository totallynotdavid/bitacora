import {
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import type { Card } from "../shared/model";
import {
  HEADER_SUFFIX,
  containerId,
  containerOf,
  inContainer,
  parseContainerId,
  placeCard,
  type Container,
} from "./groups";

const keyboardCodes = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] };

export const dragAnnouncements = {
  screenReaderInstructions: {
    draggable:
      "Para mover la tarjeta, pulsa la barra espaciadora. Usa las flechas para elegir el lugar y la barra espaciadora para soltar. Escape cancela.",
  },
};

/** The pointer must move this far before a press becomes a drag, so a click still opens the card. */
const DRAG_DISTANCE = 5;

/**
 * Drag state over the cards on screen. While a card is lifted, a local copy of
 * the cards shows where it would land. Dropping hands the final place to
 * `move` and the local copy goes away in the same render.
 */
export function useCardDrag(
  cards: Card[],
  move: (id: string, to: Container, beforeId: string | null) => void,
) {
  const [local, setLocal] = useState<Card[] | null>(null);
  const [origin, setOrigin] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes }),
  );

  function onDragStart({ active }: DragStartEvent) {
    setOrigin(cards.find((card) => card.id === active.id) ?? null);
    setLocal(cards);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !local) return;
    const moving = local.find((card) => card.id === active.id);
    const overId = String(over.id);
    const overCard = local.find((card) => card.id === overId);
    const target = parseContainerId(overId) ?? (overCard ? containerOf(overCard) : null);
    if (!moving || !target || containerId(moving) === containerId(target)) return;

    const peers = inContainer(local, target);
    const overIndex = peers.findIndex((card) => card.id === overId);
    const lifted = active.rect.current.translated;
    const below =
      overIndex >= 0 && lifted && lifted.top + lifted.height / 2 > over.rect.top + over.rect.height / 2;
    // An open day's header is above its cards, so a card dropped there goes first.
    const onOpenHeader = overId.endsWith(HEADER_SUFFIX) && over.data.current?.open === true;
    const index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : onOpenHeader ? 0 : peers.length;
    setLocal(placeCard(local, moving.id, target, peers[index]?.id ?? null));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const moving = local?.find((card) => card.id === active.id);
    if (over && local && moving && origin) {
      const peers = inContainer(local, moving);
      const from = peers.findIndex((card) => card.id === moving.id);
      const overIndex = peers.findIndex((card) => card.id === over.id);
      const to = overIndex >= 0 ? overIndex : from;
      const unchanged =
        containerId(origin) === containerId(moving) &&
        inContainer(cards, origin).findIndex((card) => card.id === origin.id) === to;
      if (!unchanged) move(moving.id, containerOf(moving), arrayMove(peers, from, to)[to + 1]?.id ?? null);
    }
    cancel();
  }

  function cancel() {
    setLocal(null);
    setOrigin(null);
  }

  return {
    cards: local ?? cards,
    dragging: origin,
    sensors,
    collisionDetection: closestCorners,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel: cancel,
  };
}
