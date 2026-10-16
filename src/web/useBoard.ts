import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Board, Card, DoneWeek, ListId } from "../shared/model";
import type { UpdateCard } from "../shared/schemas";
import { api, type Placement } from "./api";

/** The board from the server. Every change is written, then the loaded weeks are read again. */
export function useBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [older, setOlder] = useState<DoneWeek[]>([]);
  const [error, setError] = useState<string | null>(null);
  const olderRef = useRef<DoneWeek[]>([]);

  useEffect(() => {
    olderRef.current = older;
  }, [older]);

  const refresh = useCallback(async () => {
    const [next, ...weeks] = await Promise.all([
      api.board(),
      ...olderRef.current.map((loaded) => api.doneWeek(loaded.week)),
    ]);
    setBoard(next);
    setOlder(weeks);
  }, []);

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, [refresh]);

  const write = useCallback(
    async (change: () => Promise<unknown>) => {
      try {
        await change();
        setError(null);
      } catch (e) {
        setError("No se pudo guardar el cambio.");
        console.error(e);
      }
      await refresh().catch(() => setError("No se pudo cargar el tablero."));
    },
    [refresh],
  );

  const cards = useMemo<Card[]>(
    () => (board ? [...board.cards, ...older.flatMap((week) => week.cards)] : []),
    [board, older],
  );
  const olderWeek = older.at(-1)?.olderWeek ?? board?.olderWeek ?? null;

  return {
    ready: board !== null,
    today: board?.today ?? "",
    requesters: board?.requesters ?? [],
    cards,
    olderWeek,
    error,
    dismissError: () => setError(null),
    add: (title: string, list: ListId, later: boolean) => write(() => api.create(title, list, later)),
    save: (id: string, patch: UpdateCard) => write(() => api.update(id, patch)),
    move: (id: string, placement: Placement, index: number) => write(() => api.move(id, placement, index)),
    remove: (id: string) => write(() => api.remove(id)),
    async loadOlder() {
      if (!olderWeek) return;
      try {
        const week = await api.doneWeek(olderWeek);
        setOlder((weeks) => [...weeks, week]);
      } catch {
        setError("No se pudieron cargar las semanas anteriores.");
      }
    },
  };
}
