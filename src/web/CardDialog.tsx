import { Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  CATEGORIES,
  LIST_TITLES,
  LISTS,
  type Card,
  type Category,
  type ChecklistItem,
  type ListId,
} from "../shared/model";
import type { UpdateCard } from "../shared/schemas";
import { Dialog } from "./Dialog";
import form from "./form.module.css";
import styles from "./CardDialog.module.css";

type Props = {
  card: Card;
  today: string;
  requesters: string[];
  onSave: (patch: UpdateCard) => void;
  onDelete: () => void;
  onClose: () => void;
};

export function CardDialog({ card, today, requesters, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [category, setCategory] = useState<Category>(card.category);
  const [requester, setRequester] = useState(card.requester ?? "");
  const [list, setList] = useState<ListId>(card.list);
  const [later, setLater] = useState(card.later);
  const [doneDate, setDoneDate] = useState(card.doneDate ?? today);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(card.checklist);
  const [newItem, setNewItem] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function save(event: FormEvent) {
    event.preventDefault();
    const items = newItem.trim() ? [...checklist, { text: newItem.trim(), done: false }] : checklist;
    const patch: UpdateCard = {
      title: title.trim() || card.title,
      description,
      category,
      requester: requester.trim() || null,
      checklist: items.filter((item) => item.text.trim()),
    };
    if (list !== card.list) patch.list = list;
    if (list === "pendiente" && (later !== card.later || list !== card.list)) patch.later = later;
    if (list === "hecho" && (doneDate !== card.doneDate || list !== card.list)) patch.doneDate = doneDate;
    onSave(patch);
    onClose();
  }

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    setChecklist([...checklist, { text, done: false }]);
    setNewItem("");
  }

  const updateItem = (index: number, change: Partial<ChecklistItem>) =>
    setChecklist(checklist.map((item, i) => (i === index ? { ...item, ...change } : item)));

  return (
    <Dialog title="Tarjeta" onClose={onClose} wide>
      <form
        onSubmit={save}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save(event);
        }}
      >
        <label className={form.field}>
          <span className={form.label}>Título</span>
          <input className={form.input} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <div className={form.row}>
          <label className={form.field}>
            <span className={form.label}>Categoría</span>
            <select
              className={form.input}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className={form.field}>
            <span className={form.label}>Solicitante</span>
            <input
              className={form.input}
              list="requesters"
              value={requester}
              onChange={(e) => setRequester(e.target.value)}
            />
            <datalist id="requesters">
              {requesters.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
        </div>

        <div className={form.row}>
          <label className={form.field}>
            <span className={form.label}>Lista</span>
            <select className={form.input} value={list} onChange={(e) => setList(e.target.value as ListId)}>
              {LISTS.map((id) => (
                <option key={id} value={id}>
                  {LIST_TITLES[id]}
                </option>
              ))}
            </select>
          </label>
          {list === "pendiente" && (
            <label className={form.field}>
              <span className={form.label}>Grupo</span>
              <select
                className={form.input}
                value={later ? "later" : "week"}
                onChange={(e) => setLater(e.target.value === "later")}
              >
                <option value="week">Esta semana</option>
                <option value="later">Después</option>
              </select>
            </label>
          )}
          {list === "hecho" && (
            <label className={form.field}>
              <span className={form.label}>Fecha de término</span>
              <input
                className={form.input}
                type="date"
                value={doneDate}
                max={today}
                required
                onChange={(e) => setDoneDate(e.target.value)}
              />
            </label>
          )}
        </div>

        <label className={form.field}>
          <span className={form.label}>Descripción</span>
          <textarea
            className={form.input}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <fieldset className={styles.checklist}>
          <legend className={form.label}>Lista de tareas</legend>
          {checklist.map((item, index) => (
            <div key={index} className={styles.item}>
              <input
                type="checkbox"
                checked={item.done}
                aria-label={`Hecho: ${item.text}`}
                onChange={(e) => updateItem(index, { done: e.target.checked })}
              />
              <input
                className={form.input}
                value={item.text}
                aria-label={`Texto del elemento ${index + 1}`}
                onChange={(e) => updateItem(index, { text: e.target.value })}
              />
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`Quitar elemento ${index + 1}`}
                onClick={() => setChecklist(checklist.filter((_, i) => i !== index))}
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <div className={styles.item}>
            <Plus size={16} aria-hidden />
            <input
              className={form.input}
              value={newItem}
              placeholder="Añadir un elemento"
              aria-label="Nuevo elemento"
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
                  event.preventDefault();
                  addItem();
                }
              }}
            />
          </div>
        </fieldset>

        {confirmingDelete ? (
          <div className={form.confirm} role="alertdialog" aria-label="Confirmar eliminación">
            <p>¿Eliminar esta tarjeta? No se puede deshacer.</p>
            <div className={form.confirmActions}>
              <button
                type="button"
                className={form.destroy}
                onClick={() => {
                  onDelete();
                  onClose();
                }}
              >
                Sí, eliminar
              </button>
              <button type="button" className={form.secondary} onClick={() => setConfirmingDelete(false)}>
                Conservar
              </button>
            </div>
          </div>
        ) : (
          <div className={form.actions}>
            <button type="submit" className={form.primary}>
              Guardar
            </button>
            <button type="button" className={form.secondary} onClick={onClose}>
              Cancelar
            </button>
            <span className={form.spacer} />
            <button type="button" className={form.danger} onClick={() => setConfirmingDelete(true)}>
              <Trash2 size={14} aria-hidden /> Eliminar
            </button>
          </div>
        )}
      </form>
    </Dialog>
  );
}
