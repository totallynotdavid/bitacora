import { useState, type FormEvent } from "react";
import { MIN_PASSWORD, type Settings } from "../shared/model";
import { api, ApiError } from "./api";
import form from "./form.module.css";
import styles from "./SettingsDialog.module.css";

function NameForm(props: { settings: Settings; onChange: (settings: Settings) => void }) {
  const [name, setName] = useState(props.settings.name);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const next = name.trim();

  async function save(event: FormEvent) {
    event.preventDefault();
    setFailed(false);
    try {
      props.onChange(await api.rename(next));
      setSaved(true);
    } catch (error) {
      console.error(error);
      setFailed(true);
    }
  }

  return (
    <form className={styles.form} onSubmit={save}>
      <div className={form.field}>
        <label className={form.label} htmlFor="account-name">
          Nombre
        </label>
        <input
          id="account-name"
          className={form.input}
          maxLength={80}
          autoComplete="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setSaved(false);
          }}
        />
        <p className={styles.hint}>{props.settings.email}</p>
      </div>
      <div className={form.actions}>
        <button type="submit" className={form.secondary} disabled={!next || next === props.settings.name}>
          Guardar nombre
        </button>
        {saved && <span role="status">Nombre guardado.</span>}
        {failed && <span role="alert">No se pudo guardar el nombre.</span>}
      </div>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await api.changePassword(current, password);
      setCurrent("");
      setPassword("");
      setMessage({ text: "Contraseña cambiada. Las demás sesiones se cerraron.", ok: true });
    } catch (error) {
      const wrong = error instanceof ApiError && error.status === 403;
      setMessage({
        text: wrong ? "La contraseña actual no es correcta." : "No se pudo cambiar la contraseña.",
        ok: false,
      });
    }
  }

  return (
    <form className={styles.form} onSubmit={save}>
      <div className={form.row}>
        <div className={form.field}>
          <label className={form.label} htmlFor="current-password">
            Contraseña actual
          </label>
          <input
            id="current-password"
            className={form.input}
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </div>
        <div className={form.field}>
          <label className={form.label} htmlFor="new-password">
            Contraseña nueva
          </label>
          <input
            id="new-password"
            className={form.input}
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      </div>
      <p className={styles.hint}>Mínimo {MIN_PASSWORD} caracteres.</p>
      <div className={form.actions}>
        <button type="submit" className={form.secondary}>
          Cambiar contraseña
        </button>
        {message && <span role={message.ok ? "status" : "alert"}>{message.text}</span>}
      </div>
    </form>
  );
}

export function AccountSection(props: { settings: Settings; onChange: (settings: Settings) => void }) {
  return (
    <section className={styles.section} aria-labelledby="account-heading">
      <h3 id="account-heading" className={styles.heading}>
        Cuenta
      </h3>
      <NameForm settings={props.settings} onChange={props.onChange} />
      <PasswordForm />
    </section>
  );
}
