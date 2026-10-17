import { useEffect, useMemo, useRef, useState } from "react";
import type { Card, Label } from "../shared/model";
import type { CreateLabel, UpdateLabel } from "../shared/schemas";
import { api, ApiError, removeOnExit } from "./api";
import { project, serverIndex, settled, type Fields, type Op, type Pending } from "./boardState";
import type { Container } from "./groups";

export type Toast = {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
};

type State = {
  loaded: boolean;
  loadError: boolean;
  today: string;
  requesters: string[];
  labels: Label[];
  olderWeek: string | null;
  /** The cards as the server holds them, once every write before the pending ones has settled. */
  base: Card[];
  pending: Pending[];
  toasts: Toast[];
};

const empty: State = {
  loaded: false,
  loadError: false,
  today: "",
  requesters: [],
  labels: [],
  olderWeek: null,
  base: [],
  pending: [],
  toasts: [],
};

const byName = (labels: Label[]) => labels.toSorted((a, b) => a.name.localeCompare(b.name, "es"));

/** A saved label, or the message that says why it was not. */
export type LabelResult = { label: Label } | { error: string };

function labelError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) return "Ya existe una etiqueta con ese nombre.";
  console.error(error);
  return "No se pudo guardar la etiqueta.";
}

const UNDO_MS = 6000;
const NOTICE_MS = 4000;

/**
 * The one owner of the board. Every action changes what the screen shows at
 * once, then writes in the background, one write at a time in the order made.
 * A write that fails is taken back and offered again in a toast.
 */
export function useBoard() {
  const [state, setState] = useState<State>(empty);
  const live = useRef(state);
  const keys = useRef(0);
  const pumping = useRef(false);
  const timers = useRef(new Map<number, number>());
  const closers = useRef(new Map<number, () => void>());

  const change = (next: (s: State) => State) => {
    live.current = next(live.current);
    setState(live.current);
  };

  useEffect(() => {
    api.board().then(
      (board) =>
        change((s) => ({
          ...s,
          loaded: true,
          today: board.today,
          requesters: board.requesters,
          labels: board.labels,
          olderWeek: board.olderWeek,
          base: board.cards,
        })),
      () => change((s) => ({ ...s, loadError: true })),
    );
  }, []);

  useEffect(() => {
    // The page may close while a delete waits for its undo to expire.
    const flush = () => {
      for (const { op, phase } of live.current.pending) {
        if (op.kind === "remove" && phase !== "sending") removeOnExit(op.id);
      }
    };
    addEventListener("pagehide", flush);
    return () => removeEventListener("pagehide", flush);
  }, []);

  function closeToast(id: number, by: "timer" | "user" | "action") {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    const onClose = closers.current.get(id);
    closers.current.delete(id);
    change((s) => ({ ...s, toasts: s.toasts.filter((item) => item.id !== id) }));
    if (by !== "action") onClose?.();
  }

  function toast(
    text: string,
    options: { action?: Toast["action"]; ms?: number; onClose?: () => void } = {},
  ) {
    const id = ++keys.current;
    change((s) => ({ ...s, toasts: [...s.toasts, { id, text, action: options.action }] }));
    if (options.onClose) closers.current.set(id, options.onClose);
    if (options.ms)
      timers.current.set(
        id,
        window.setTimeout(() => closeToast(id, "timer"), options.ms),
      );
    return id;
  }

  async function pump() {
    if (pumping.current) return;
    pumping.current = true;
    try {
      for (let next = firstQueued(); next; next = firstQueued()) {
        await send(next);
      }
    } finally {
      pumping.current = false;
    }
  }

  const firstQueued = () => live.current.pending.find((p) => p.phase === "queued");

  async function send(entry: Pending) {
    setPhase(entry.key, "sending");
    try {
      const answer = await write(entry.op, live.current.base);
      change((s) => ({
        ...s,
        base: settled(s.base, entry.op, answer),
        pending: s.pending.filter((p) => p.key !== entry.key),
      }));
    } catch (error) {
      console.error(error);
      change((s) => ({ ...s, pending: s.pending.filter((p) => p.key !== entry.key) }));
      toast("No se pudo guardar.", { action: { label: "Reintentar", run: () => enqueue(entry.op) } });
    }
  }

  function setPhase(key: number, phase: Pending["phase"]) {
    change((s) => ({ ...s, pending: s.pending.map((p) => (p.key === key ? { ...p, phase } : p)) }));
  }

  function enqueue(op: Op, phase: Pending["phase"] = "queued"): number {
    const key = ++keys.current;
    change((s) => ({ ...s, pending: [...s.pending, { key, op, phase }] }));
    void pump();
    return key;
  }

  const view = useMemo(() => project(state.base, state.pending), [state.base, state.pending]);
  const requesters = useMemo(
    () => [
      ...new Set([
        ...state.requesters,
        ...view.all.flatMap((card) => (card.requester ? [card.requester] : [])),
      ]),
    ],
    [state.requesters, view.all],
  );

  return {
    ready: state.loaded,
    loadError: state.loadError,
    today: state.today,
    requesters,
    labels: state.labels,
    cards: view.visible,
    olderWeek: state.olderWeek,
    toasts: state.toasts,
    closeToast: (id: number) => closeToast(id, "user"),
    notify: (text: string) => toast(text, { ms: NOTICE_MS }),

    add(title: string, to: Container): string {
      const card: Card = {
        id: crypto.randomUUID(),
        title,
        description: "",
        labelId: null,
        requester: null,
        checklist: [],
        list: to.list,
        position: 0,
        doneDate: to.list === "hecho" ? to.doneDate : null,
      };
      enqueue({ kind: "create", card });
      return card.id;
    },

    edit(id: string, fields: Fields) {
      enqueue({ kind: "edit", id, fields });
    },

    move(id: string, to: Container, beforeId: string | null) {
      enqueue({ kind: "move", id, to, beforeId });
    },

    /**
     * Labels are written at once rather than queued: a card edit that names a
     * new label must find it on the server. The label picker sits in a modal
     * that hides the toasts, so each call answers with the message to show.
     */
    async createLabel(input: Omit<CreateLabel, "id">): Promise<LabelResult> {
      try {
        const label = await api.createLabel({ id: crypto.randomUUID(), ...input });
        change((s) => ({ ...s, labels: byName([...s.labels, label]) }));
        return { label };
      } catch (error) {
        return { error: labelError(error) };
      }
    },

    async updateLabel(id: string, patch: UpdateLabel): Promise<LabelResult> {
      try {
        const label = await api.updateLabel(id, patch);
        change((s) => ({ ...s, labels: byName(s.labels.map((known) => (known.id === id ? label : known))) }));
        return { label };
      } catch (error) {
        return { error: labelError(error) };
      }
    },

    /** The server clears the label from its cards. The screen does the same. */
    async removeLabel(id: string): Promise<{ error: string } | null> {
      try {
        await api.removeLabel(id);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) return { error: labelError(error) };
      }
      const clear = (card: Card): Card => (card.labelId === id ? { ...card, labelId: null } : card);
      change((s) => ({
        ...s,
        labels: s.labels.filter((label) => label.id !== id),
        base: s.base.map(clear),
        pending: s.pending.map((p) =>
          p.op.kind === "edit" && p.op.fields.labelId === id
            ? { ...p, op: { ...p.op, fields: { ...p.op.fields, labelId: null } } }
            : p,
        ),
      }));
      return null;
    },

    remove(id: string) {
      const key = enqueue({ kind: "remove", id }, "held");
      const release = () => {
        setPhase(key, "queued");
        void pump();
      };
      const toastId = toast("Tarjeta eliminada.", {
        ms: UNDO_MS,
        onClose: release,
        action: {
          label: "Deshacer",
          run: () => {
            change((s) => ({ ...s, pending: s.pending.filter((p) => p.key !== key) }));
            closeToast(toastId, "action");
          },
        },
      });
    },

    /**
     * Whether the card exists. A card on screen, including one whose create has
     * not been answered yet, is known. Any other is read from the server and
     * added to the board.
     */
    async open(id: string): Promise<boolean> {
      const { base, pending } = live.current;
      if (project(base, pending).all.some((card) => card.id === id)) return true;
      try {
        const card = await api.card(id);
        change((s) => ({ ...s, base: [...s.base, card] }));
        return true;
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) console.error(error);
        return false;
      }
    },

    async loadOlder() {
      const week = live.current.olderWeek;
      if (!week) return;
      try {
        const done = await api.doneWeek(week);
        change((s) => ({
          ...s,
          olderWeek: done.olderWeek,
          base: [...s.base, ...done.cards.filter((card) => !s.base.some((known) => known.id === card.id))],
        }));
      } catch {
        toast("No se pudieron cargar las semanas anteriores.", { ms: NOTICE_MS });
      }
    },
  };
}

async function write(op: Op, base: Card[]): Promise<Card | undefined> {
  switch (op.kind) {
    case "create":
      return api.create({ id: op.card.id, title: op.card.title, list: op.card.list });
    case "edit":
      return api.update(op.id, op.fields);
    case "move":
      return api.move(
        op.id,
        {
          list: op.to.list,
          doneDate: op.to.list === "hecho" ? (op.to.doneDate ?? undefined) : undefined,
        },
        serverIndex(base, op),
      );
    case "remove":
      // A 404 means the card is already gone, which is what the delete wanted.
      await api.remove(op.id).catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      });
      return undefined;
  }
}
