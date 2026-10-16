import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { Settings } from "../shared/model";
import { api } from "./api";
import { Dialog } from "./Dialog";
import form from "./form.module.css";
import styles from "./SettingsDialog.module.css";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    api.settings().then(setSettings, console.error);
  }, []);

  const link = settings ? `${location.origin}/r/${settings.reportToken}` : "";

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerate() {
    setSettings(await api.regenerateToken());
    setConfirming(false);
  }

  return (
    <Dialog title="Ajustes" onClose={onClose}>
      <div className={form.field}>
        <label className={form.label} htmlFor="report-link">
          Enlace del informe semanal
        </label>
        <div className={styles.linkRow}>
          <input
            id="report-link"
            className={form.input}
            value={link}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" className={form.secondary} onClick={copy} disabled={!settings}>
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{" "}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className={styles.hint}>Quien tenga el enlace puede leer el informe. No pide contraseña.</p>
      </div>

      <div className={form.actions}>
        {settings && (
          <a className={form.secondary + " " + styles.anchor} href={link} target="_blank" rel="noreferrer">
            <ExternalLink size={14} aria-hidden /> Abrir informe
          </a>
        )}
        <span className={form.spacer} />
        {!confirming && (
          <button type="button" className={form.danger} onClick={() => setConfirming(true)}>
            <RefreshCw size={14} aria-hidden /> Generar enlace nuevo
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
    </Dialog>
  );
}
