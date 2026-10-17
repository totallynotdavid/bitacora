import { Check, Copy } from "lucide-react";
import { useState } from "react";
import form from "./form.module.css";
import styles from "./SettingsDialog.module.css";

export function CopyLink(props: { id: string; label: string; value: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(props.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={form.field}>
      <label className={form.label} htmlFor={props.id}>
        {props.label}
      </label>
      <div className={styles.linkRow}>
        <input
          id={props.id}
          className={form.input}
          value={props.value}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" className={form.secondary} onClick={copy} disabled={props.disabled}>
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{" "}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
