import { DndContext, DragOverlay } from "@dnd-kit/core";
import { LogOut, Settings } from "lucide-react";
import { useState } from "react";
import styles from "./Board.module.css";
import { CardDialog } from "./CardDialog";
import { CardFace } from "./CardView";
import { ActiveColumn, DoneColumn, PendingColumn } from "./ListColumn";
import { SettingsDialog } from "./SettingsDialog";
import { dragAnnouncements, useCardDrag } from "./useCardDrag";
import { useBoard } from "./useBoard";

export function Board() {
  const board = useBoard();
  const drag = useCardDrag(board.cards, board.today, board.move);
  const [openId, setOpenId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openCard = board.cards.find((card) => card.id === openId);
  const dragged = drag.dragging && drag.cards.find((card) => card.id === drag.dragging?.id);
  const shared = { cards: drag.cards, dragging: drag.dragging !== null, onOpen: setOpenId };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Bitácora</h1>
        <div className={styles.tools}>
          <button type="button" className={styles.tool} onClick={() => setSettingsOpen(true)}>
            <Settings size={16} aria-hidden /> Ajustes
          </button>
          <form method="post" action="/logout">
            <button type="submit" className={styles.tool}>
              <LogOut size={16} aria-hidden /> Salir
            </button>
          </form>
        </div>
      </header>

      {board.error && (
        <div className={styles.error} role="alert">
          {board.error}
          <button type="button" onClick={board.dismissError}>
            Cerrar
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
            <PendingColumn {...shared} onAdd={(title, later) => board.add(title, "pendiente", later)} />
            <ActiveColumn {...shared} onAdd={(title) => board.add(title, "en_curso", false)} />
            <DoneColumn
              {...shared}
              today={board.today}
              hasOlder={board.olderWeek !== null}
              onLoadOlder={board.loadOlder}
              onAdd={(title) => board.add(title, "hecho", false)}
            />
          </main>
          <DragOverlay>{dragged ? <CardFace card={dragged} /> : null}</DragOverlay>
        </DndContext>
      )}

      {openCard && (
        <CardDialog
          key={openCard.id}
          card={openCard}
          today={board.today}
          requesters={board.requesters}
          onSave={(patch) => board.save(openCard.id, patch)}
          onDelete={() => board.remove(openCard.id)}
          onClose={() => setOpenId(null)}
        />
      )}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
