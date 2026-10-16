import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_TEXT,
  LIST_TITLES,
  LISTS,
  type Card,
  type Category,
  type ListId,
} from "../shared/model";
import type { Container } from "./groups";
import styles from "./Pickers.module.css";

export function CategoryPicker(props: { value: Category; onPick: (category: Category) => void }) {
  return (
    <ul className={styles.options}>
      {CATEGORIES.map((name) => (
        <li key={name}>
          <button
            type="button"
            className={styles.category}
            style={{ background: CATEGORY_COLORS[name], color: CATEGORY_TEXT[name] }}
            onClick={() => props.onPick(name)}
          >
            {name}
            {name === props.value && <Check size={16} aria-label="Actual" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function RequesterPicker(props: {
  value: string | null;
  suggestions: string[];
  onSave: (requester: string | null) => void;
}) {
  const [text, setText] = useState(props.value ?? "");
  const typed = text.trim().toLowerCase();
  const shown = props.suggestions.filter(
    (name) => name.toLowerCase().includes(typed) && name.toLowerCase() !== typed,
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    props.onSave(text.trim() || null);
  };

  return (
    <form onSubmit={submit}>
      <label className={styles.label} htmlFor="requester-input">
        Solicitante
      </label>
      <input
        id="requester-input"
        className={styles.input}
        autoFocus
        maxLength={80}
        autoComplete="off"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {shown.length > 0 && (
        <ul className={styles.options} aria-label="Sugerencias">
          {shown.slice(0, 6).map((name) => (
            <li key={name}>
              <button type="button" className={styles.option} onClick={() => props.onSave(name)}>
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary}>
          Guardar
        </button>
        {props.value && (
          <button type="button" className={styles.button} onClick={() => props.onSave(null)}>
            Quitar
          </button>
        )}
      </div>
    </form>
  );
}

export function MovePicker(props: { card: Card; today: string; onMove: (to: Container) => void }) {
  const [list, setList] = useState<ListId>(props.card.list);
  const [later, setLater] = useState(props.card.later);
  const target: Container = {
    list,
    later: list === "pendiente" && later,
    doneDate: list === "hecho" ? props.today : null,
  };
  const unchanged = list === props.card.list && target.later === props.card.later;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!unchanged) props.onMove(target);
      }}
    >
      <label className={styles.label} htmlFor="move-list">
        Lista
      </label>
      <select
        id="move-list"
        className={styles.input}
        autoFocus
        value={list}
        onChange={(event) => setList(event.target.value as ListId)}
      >
        {LISTS.map((id) => (
          <option key={id} value={id}>
            {LIST_TITLES[id]}
            {id === props.card.list ? " (actual)" : ""}
          </option>
        ))}
      </select>
      {list === "pendiente" && (
        <>
          <label className={styles.label} htmlFor="move-group">
            Grupo
          </label>
          <select
            id="move-group"
            className={styles.input}
            value={later ? "later" : "week"}
            onChange={(event) => setLater(event.target.value === "later")}
          >
            <option value="week">Esta semana</option>
            <option value="later">Después</option>
          </select>
        </>
      )}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={unchanged}>
          Mover
        </button>
      </div>
    </form>
  );
}

export function DatePicker(props: { value: string | null; today: string; onSave: (date: string) => void }) {
  const [date, setDate] = useState(props.value ?? props.today);
  const future = date > props.today;
  const valid = date !== "" && !future;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) props.onSave(date);
      }}
    >
      <label className={styles.label} htmlFor="done-date">
        Fecha de término
      </label>
      <input
        id="done-date"
        className={styles.input}
        type="date"
        autoFocus
        max={props.today}
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />
      {future && <p className={styles.error}>La fecha no puede ser futura.</p>}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={!valid}>
          Guardar
        </button>
      </div>
    </form>
  );
}
