import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { Settings } from "../shared/model";
import { api } from "./api";
import { CopyLink } from "./CopyLink";
import form from "./form.module.css";
import styles from "./SettingsDialog.module.css";

export function ReportSection(props: { settings: Settings; onChange: (settings: Settings) => void }) {
  const [confirming, setConfirming] = useState(false);
  const link = `${location.origin}/r/${props.settings.reportToken}`;

  async function regenerate() {
    props.onChange(await api.regenerateToken());
    setConfirming(false);
  }

  return (
    <section className={styles.section} aria-labelledby="report-heading">
      <h3 id="report-heading" className={styles.heading}>
        Informe semanal
      </h3>
      <CopyLink id="report-link" label="Enlace del informe semanal" value={link} />
      <p className={styles.hint}>Quien tenga el enlace puede leer el informe. No pide contraseña.</p>

      <div className={form.actions}>
        <a className={form.secondary + " " + styles.anchor} href={link} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden /> Abrir informe
        </a>
        <span className={form.spacer} />
        {!confirming && (
          <button type="button" className={form.danger} onClick={() => setConfirming(true)}>
            <RefreshCw size={16} aria-hidden /> Generar enlace nuevo
          </button>
        )}
      </div>

      {confirming && (
        <div className={form.confirm} role="alertdialog" aria-label="Confirmar enlace nuevo">
          <p>El enlace actual dejará de funcionar. ¿Generar uno nuevo?</p>
          <div className={form.confirmActions}>
            <button type="button" className={form.destroy} onClick={regenerate}>
              Sí, generar
            </button>
            <button type="button" className={form.secondary} onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
