import { CATEGORIES } from "../shared/model";
import styles from "./FilterPopover.module.css";
import { Popover } from "./Popover";
import type { Filter } from "./useFilter";

export function FilterPopover(props: {
  anchor: HTMLElement;
  filter: Filter;
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

      <label className={styles.label} htmlFor="filter-category">
        Categoría
      </label>
      <select
        id="filter-category"
        className={styles.input}
        value={filter.category}
        onChange={(event) =>
          props.onChange({ ...filter, category: event.target.value as Filter["category"] })
        }
      >
        <option value="">Todas</option>
        {CATEGORIES.map((name) => (
          <option key={name}>{name}</option>
        ))}
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
