import { Dialog } from "./Dialog";
import styles from "./ShortcutsDialog.module.css";

const SHORTCUTS: [string, string][] = [
  ["n", "Abrir el compositor de la lista bajo el puntero, o de En curso"],
  ["e", "Editar la tarjeta bajo el puntero o con el foco"],
  ["Enter", "Abrir la tarjeta con el foco"],
  ["f", "Abrir el filtro"],
  ["x", "Limpiar el filtro"],
  ["?", "Mostrar esta tabla"],
  ["Esc", "Cerrar el panel, el diálogo o el compositor de arriba"],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Atajos de teclado" onClose={onClose}>
      <p className={styles.note}>Funcionan cuando el foco no está en un campo de texto.</p>
      <table className={styles.table}>
        <tbody>
          {SHORTCUTS.map(([key, action]) => (
            <tr key={key}>
              <th scope="row">
                <kbd className={styles.key}>{key}</kbd>
              </th>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
