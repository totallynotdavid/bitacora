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
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import type { Card } from "../shared/model";
import type { Placement } from "./api";
import { containerId, containerOf, inContainer, parseContainerId, type Container } from "./groups";

function place(cards: Card[], id: string, target: Container, index: number): Card[] {
  const moving = cards.find((card) => card.id === id)!;
  const rest = cards.filter((card) => card.id !== id);
  const peers = inContainer(rest, target);
  peers.splice(index, 0, { ...moving, ...target });
  const renumbered = new Map(peers.map((card, i) => [card.id, { ...card, position: i + 1 }]));
  return [...rest.filter((card) => !renumbered.has(card.id)), ...renumbered.values()];
}

const keyboardCodes = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] };

export const dragAnnouncements = {
  screenReaderInstructions: {
    draggable:
      "Para mover la tarjeta, pulsa la barra espaciadora. Usa las flechas para elegir el lugar y la barra espaciadora para soltar. Escape cancela.",
  },
};

/**
 * Local drag state over the server's cards. A card dragged into Hecho from
 * another list can only land on today, because the server dates it today.
 */
export function useCardDrag(
  cards: Card[],
  today: string,
  commit: (id: string, placement: Placement, index: number) => Promise<void>,
) {
  const [local, setLocal] = useState<Card[] | null>(null);
  const [origin, setOrigin] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes }),
  );

  const shown = local ?? cards;

  function targetFor(overId: string, current: Card[]): Container | null {
    const overCard = current.find((card) => card.id === overId);
    const target = parseContainerId(overId) ?? (overCard ? containerOf(overCard) : null);
    if (target?.list === "hecho" && origin?.list !== "hecho") return { ...target, doneDate: today };
    return target;
  }

  function onDragStart({ active }: DragStartEvent) {
    setOrigin(cards.find((card) => card.id === active.id) ?? null);
    setLocal(cards);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !local) return;
    const moving = local.find((card) => card.id === active.id);
    const target = targetFor(String(over.id), local);
    if (!moving || !target || containerId(moving) === containerId(target)) return;

    const peers = inContainer(local, target);
    const overIndex = peers.findIndex((card) => card.id === over.id);
    const below =
      overIndex >= 0 &&
      active.rect.current.translated &&
      active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
    const index = overIndex < 0 ? peers.length : overIndex + (below ? 1 : 0);
    setLocal(place(local, moving.id, target, index));
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    const moving = local?.find((card) => card.id === active.id);
    if (!over || !local || !moving || !origin) return cancel();

    const peers = inContainer(local, moving);
    const activeIndex = peers.findIndex((card) => card.id === moving.id);
    const overIndex = peers.findIndex((card) => card.id === over.id);
    const index = overIndex >= 0 ? overIndex : activeIndex;
    const final = containerOf(moving);

    const unchanged =
      containerId(origin) === containerId(final) &&
      inContainer(cards, origin).findIndex((card) => card.id === origin.id) === index;
    if (unchanged) return cancel();

    setLocal(place(local, moving.id, final, index));
    const sameHecho = origin.list === "hecho" && final.list === "hecho";
    await commit(
      moving.id,
      {
        list: final.list,
        later: final.later,
        doneDate: sameHecho ? (final.doneDate ?? undefined) : undefined,
      },
      index,
    );
    cancel();
  }

  function cancel() {
    setLocal(null);
    setOrigin(null);
  }

  return {
    cards: shown,
    dragging: origin,
    sensors,
    collisionDetection: closestCorners,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel: cancel,
  };
}
