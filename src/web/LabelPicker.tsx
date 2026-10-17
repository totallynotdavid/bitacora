import { Check, Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { LABEL_COLOR_NAMES, LABEL_COLORS, labelStyle, type LabelColor } from "../shared/model";
import styles from "./LabelPicker.module.css";
import picker from "./Pickers.module.css";
import { useUi } from "./ui";

type Draft = { id: string | null; name: string; color: LabelColor };

const NEW_LABEL: Draft = { id: null, name: "", color: "green" };

/** The popover of a card's label: pick one, or make, rename, recolor and delete the user's labels. */
export function LabelPicker(props: { value: string | null; onPick: (id: string | null) => void }) {
  const { labels } = useUi();
  const [draft, setDraft] = useState<Draft | null>(null);

  if (draft) {
    return <LabelForm draft={draft} onCreated={props.onPick} onDone={() => setDraft(null)} />;
  }

  return (
    <>
      <ul className={picker.options} aria-label="Etiquetas">
        {labels.map((label) => (
          <li key={label.id} className={styles.row}>
            <button
              type="button"
              className={styles.label}
              style={labelStyle(label.color)}
              onClick={() => props.onPick(label.id)}
            >
              {label.name}
              {label.id === props.value && <Check size={16} aria-label="Actual" />}
            </button>
            <button
              type="button"
              className={styles.edit}
              aria-label={`Editar etiqueta ${label.name}`}
              onClick={() => setDraft({ id: label.id, name: label.name, color: label.color })}
            >
              <Pencil size={16} aria-hidden />
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={picker.option} onClick={() => props.onPick(null)}>
            Sin etiqueta
            {props.value === null && <Check size={16} aria-label="Actual" />}
          </button>
        </li>
      </ul>
      <div className={picker.actions}>
        <button type="button" className={picker.button} onClick={() => setDraft(NEW_LABEL)}>
          <Plus size={16} aria-hidden /> Crear etiqueta
        </button>
      </div>
    </>
  );
}

function LabelForm(props: {
  draft: Draft;
  /** A new label is picked for the card as soon as it exists. */
  onCreated: (id: string) => void;
  onDone: () => void;
}) {
  const ui = useUi();
  const [name, setName] = useState(props.draft.name);
  const [color, setColor] = useState(props.draft.color);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { id } = props.draft;
  const valid = name.trim() !== "";

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const saved = id
      ? await ui.updateLabel(id, { name: name.trim(), color })
      : await ui.createLabel({ name: name.trim(), color });
    setBusy(false);
    if ("error" in saved) return setError(saved.error);
    if (id) props.onDone();
    else props.onCreated(saved.label.id);
  }

  async function remove() {
    if (!id || busy) return;
    setBusy(true);
    const failed = await ui.removeLabel(id);
    setBusy(false);
    if (failed) return setError(failed.error);
    props.onDone();
  }

  return (
    <form onSubmit={save}>
      <label className={picker.label} htmlFor="label-name">
        Nombre
      </label>
      <input
        id="label-name"
        className={picker.input}
        autoFocus
        maxLength={40}
        autoComplete="off"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <fieldset className={styles.colors}>
        <legend className={picker.label}>Color</legend>
        {LABEL_COLORS.map((option) => (
          <label key={option} className={styles.swatch} style={labelStyle(option)}>
            <input
              type="radio"
              name="label-color"
              className={styles.radio}
              value={option}
              checked={color === option}
              aria-label={LABEL_COLOR_NAMES[option]}
              onChange={() => setColor(option)}
            />
            {color === option && <Check size={16} aria-hidden />}
          </label>
        ))}
      </fieldset>
      {error && (
        <p className={picker.error} role="alert">
          {error}
        </p>
      )}
      <div className={picker.actions}>
        <button type="submit" className={picker.primary} disabled={!valid || busy}>
          {id ? "Guardar" : "Crear"}
        </button>
        <button type="button" className={picker.button} onClick={props.onDone}>
          Volver
        </button>
        {id && !confirming && (
          <button type="button" className={styles.remove} onClick={() => setConfirming(true)}>
            Eliminar
          </button>
        )}
      </div>
      {confirming && (
        <div className={styles.confirm} role="alertdialog" aria-label="Confirmar eliminación">
          <p>La etiqueta se quitará de todas las tarjetas. ¿Eliminarla?</p>
          <div className={picker.actions}>
            <button type="button" className={styles.destroy} disabled={busy} onClick={remove}>
              Sí, eliminar
            </button>
            <button type="button" className={picker.button} onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
