import type { Label } from "../shared/model";
import styles from "./FilterPopover.module.css";
import { Popover } from "./Popover";
import { NO_LABEL, type Filter } from "./useFilter";

export function FilterPopover(props: {
  anchor: HTMLElement;
  filter: Filter;
  labels: Label[];
  requesters: string[];
  onChange: (filter: Filter) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { filter } = props;

  return (
    <Popover title="Filtrar" anchor={props.anchor} onClose={props.onClose}>
      <label className={styles.label} htmlFor="filter-text">
        Texto
      </label>
      <input
        id="filter-text"
        className={styles.input}
        autoFocus
        autoComplete="off"
        placeholder="Título o descripción"
        value={filter.q}
        onChange={(event) => props.onChange({ ...filter, q: event.target.value })}
      />

      <label className={styles.label} htmlFor="filter-label">
        Etiqueta
      </label>
      <select
        id="filter-label"
        className={styles.input}
        value={filter.label}
        onChange={(event) => props.onChange({ ...filter, label: event.target.value })}
      >
        <option value="">Todas</option>
        {props.labels.map((label) => (
          <option key={label.id} value={label.id}>
            {label.name}
          </option>
        ))}
        <option value={NO_LABEL}>Sin etiqueta</option>
      </select>

      <label className={styles.label} htmlFor="filter-requester">
        Solicitante
      </label>
      <select
        id="filter-requester"
        className={styles.input}
        value={filter.requester}
        onChange={(event) => props.onChange({ ...filter, requester: event.target.value })}
      >
        <option value="">Todos</option>
        {props.requesters.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>

      <button type="button" className={styles.clear} onClick={props.onClear}>
        Limpiar filtro
      </button>
    </Popover>
  );
}
