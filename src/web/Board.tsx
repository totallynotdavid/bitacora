import { DndContext, DragOverlay } from "@dnd-kit/core";
import { Filter as FilterIcon, Keyboard, LogOut, Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Board.module.css";
import { CardBack } from "./CardBack";
import { CardFace } from "./CardView";
import { FilterPopover } from "./FilterPopover";
import { inContainer, parseContainerId } from "./groups";
import { DoneColumn, FlatColumn } from "./ListColumn";
import { QuickEdit } from "./QuickEdit";
import { SettingsDialog } from "./SettingsDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Toasts } from "./Toasts";
import { UiContext, type Ui } from "./ui";
import { useBoard } from "./useBoard";
import { useCardRoute } from "./useCardRoute";
import { dragAnnouncements, useCardDrag } from "./useCardDrag";
import { matches, useFilter } from "./useFilter";
import { useOpenDays } from "./useOpenDays";
import { StripeNamesContext, useStripeNamesState } from "./useStripeNames";

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Board() {
  const board = useBoard();
  const route = useCardRoute();
  const { filter, active: filtering, set: setFilter, clear: clearFilter } = useFilter();
  const stripeNames = useStripeNamesState();
  const days = useOpenDays(board.today);

  const [composer, setComposer] = useState<string | null>(null);
  const [quick, setQuick] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const filterButton = useRef<HTMLButtonElement>(null);
  const hover = useRef<{ card: string | null; composer: string | null }>({ card: null, composer: null });

  const shown = useMemo(() => board.cards.filter((card) => matches(card, filter)), [board.cards, filter]);
  const drag = useCardDrag(shown, board.move);

  const quickEdit = (id: string) => {
    const rect = document.querySelector(`[data-card-id="${id}"]`)?.getBoundingClientRect();
    if (rect) setQuick({ id, rect });
  };

  const toggleDone = (id: string) => {
    const card = board.cards.find((c) => c.id === id);
    if (!card) return;
    if (card.list === "hecho") {
      board.move(id, { list: "en_curso", doneDate: null }, null);
      return;
    }
    const today = { list: "hecho", doneDate: board.today } as const;
    board.move(id, today, inContainer(board.cards, today)[0]?.id ?? null);
    days.open(board.today);
  };

  const addCard = (containerId: string, title: string) => {
    const container = parseContainerId(containerId);
    if (!container) return;
    if (container.list === "hecho" && container.doneDate) days.open(container.doneDate);
    const id = board.add(title, container);
    requestAnimationFrame(() =>
      document.querySelector(`[data-card-id="${id}"]`)?.scrollIntoView({ block: "nearest" }),
    );
  };

  const ui: Ui = {
    today: board.today,
    openCard: route.open,
    quickEdit,
    toggleDone,
    composer,
    setComposer,
    addCard,
    labels: board.labels,
    createLabel: board.createLabel,
    updateLabel: board.updateLabel,
    removeLabel: board.removeLabel,
  };

  const openCard = route.id ? board.cards.find((card) => card.id === route.id) : undefined;
  const quickCard = quick && board.cards.find((card) => card.id === quick.id);

  // A card URL names a card the loaded weeks may not hold. If the server has none, say so.
  useEffect(() => {
    if (!board.ready || !route.id) return;
    void board.open(route.id).then((found) => {
      if (found) return;
      board.notify("No se encontró la tarjeta.");
      route.close();
    });
    // Only a new URL or the first load decides this. A card deleted while open must not trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.ready, route.id]);

  useEffect(() => {
    document.documentElement.dataset.dragging = String(drag.dragging !== null);
  }, [drag.dragging]);

  const modalOpen = Boolean(route.id) || quick !== null || settingsOpen || helpOpen || filterOpen;
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target) || modalOpen) return;
      const focused = document.activeElement?.closest<HTMLElement>("[data-card-id]")?.dataset.cardId;
      const card = hover.current.card ?? focused ?? null;
      const actions: Record<string, () => void> = {
        n: () => setComposer(hover.current.composer ?? "en_curso"),
        e: () => card && quickEdit(card),
        f: () => setFilterOpen(true),
        x: clearFilter,
        "?": () => setHelpOpen(true),
      };
      const act = actions[event.key];
      if (!act) return;
      // The key must not reach the field that the action focuses.
      event.preventDefault();
      act();
    }
    addEventListener("keydown", onKeyDown);
    return () => removeEventListener("keydown", onKeyDown);
  });

  const dragged = drag.dragging && drag.cards.find((card) => card.id === drag.dragging?.id);
  const shared = { cards: drag.cards, dragging: drag.dragging !== null };

  return (
    <StripeNamesContext.Provider value={stripeNames}>
      <UiContext.Provider value={ui}>
        <div
          className={styles.page}
          onMouseOver={(event) => {
            const target = event.target as HTMLElement;
            hover.current = {
              card: target.closest<HTMLElement>("[data-card-id]")?.dataset.cardId ?? null,
              composer: target.closest<HTMLElement>("[data-composer]")?.dataset.composer ?? null,
            };
          }}
          onMouseLeave={() => (hover.current = { card: null, composer: null })}
        >
          <header className={styles.header}>
            <h1 className={styles.title}>Bitácora</h1>
            <div className={styles.tools}>
              {filtering && (
                <span className={styles.matches} role="status">
                  {shown.length} {shown.length === 1 ? "tarjeta coincide" : "tarjetas coinciden"}
                  <button
                    type="button"
                    className={styles.clear}
                    aria-label="Limpiar filtro"
                    onClick={clearFilter}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </span>
              )}
              <button
                ref={filterButton}
                type="button"
                className={styles.tool}
                data-active={filtering}
                aria-haspopup="dialog"
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <FilterIcon size={16} aria-hidden /> Filtrar
              </button>
              <button type="button" className={styles.tool} onClick={() => setSettingsOpen(true)}>
                <Settings size={16} aria-hidden /> Ajustes
              </button>
              <button
                type="button"
                className={styles.tool}
                aria-label="Atajos de teclado"
                onClick={() => setHelpOpen(true)}
              >
                <Keyboard size={16} aria-hidden />
              </button>
              <form method="post" action="/logout">
                <button type="submit" className={styles.tool}>
                  <LogOut size={16} aria-hidden /> Salir
                </button>
              </form>
            </div>
          </header>

          {board.loadError && (
            <div className={styles.error} role="alert">
              No se pudo cargar el tablero.
              <button type="button" onClick={() => location.reload()}>
                Recargar
              </button>
            </div>
          )}

          {board.ready && (
            <DndContext
              sensors={drag.sensors}
              collisionDetection={drag.collisionDetection}
              accessibility={dragAnnouncements}
              onDragStart={drag.onDragStart}
              onDragOver={drag.onDragOver}
              onDragEnd={drag.onDragEnd}
              onDragCancel={drag.onDragCancel}
            >
              <main className={styles.lists}>
                <FlatColumn {...shared} list="pendiente" />
                <FlatColumn {...shared} list="esta_semana" />
                <FlatColumn {...shared} list="en_curso" />
                <DoneColumn
                  {...shared}
                  today={board.today}
                  days={days}
                  hasOlder={board.olderWeek !== null}
                  onLoadOlder={board.loadOlder}
                />
              </main>
              <DragOverlay dropAnimation={reducedMotion() ? null : { duration: 150, easing: "ease-out" }}>
                {dragged ? <CardFace card={dragged} lifted /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {openCard && (
          <CardBack
            key={openCard.id}
            card={openCard}
            today={board.today}
            requesters={board.requesters}
            actions={{
              edit: (fields) => board.edit(openCard.id, fields),
              move: (to) => board.move(openCard.id, to, null),
              remove: () => board.remove(openCard.id),
              toggleDone: () => toggleDone(openCard.id),
            }}
            onClose={route.close}
          />
        )}

        {quick && quickCard && (
          <QuickEdit
            key={quick.id}
            card={quickCard}
            rect={quick.rect}
            today={board.today}
            requesters={board.requesters}
            actions={{
              edit: (fields) => board.edit(quickCard.id, fields),
              move: (to) => board.move(quickCard.id, to, null),
            }}
            onOpenCard={() => route.open(quickCard.id)}
            onDelete={() => {
              board.remove(quickCard.id);
              setQuick(null);
            }}
            onClose={() => setQuick(null)}
          />
        )}

        {filterOpen && filterButton.current && (
          <FilterPopover
            anchor={filterButton.current}
            filter={filter}
            labels={board.labels}
            requesters={board.requesters}
            onChange={setFilter}
            onClear={clearFilter}
            onClose={() => setFilterOpen(false)}
          />
        )}

        {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
        {helpOpen && <ShortcutsDialog onClose={() => setHelpOpen(false)} />}
        <Toasts toasts={board.toasts} onClose={board.closeToast} />
      </UiContext.Provider>
    </StripeNamesContext.Provider>
  );
}
