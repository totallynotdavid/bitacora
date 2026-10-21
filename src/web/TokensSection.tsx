import { useEffect, useState, type FormEvent } from "react";
import type { ApiToken, IssuedToken } from "../shared/model";
import { api } from "./api";
import { CopyLink } from "./CopyLink";
import form from "./form.module.css";
import styles from "./SettingsDialog.module.css";

const day = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

export function TokensSection() {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.tokens().then(setTokens, console.error);
  }, []);

  async function run(action: () => Promise<void>) {
    setFailed(false);
    try {
      await action();
    } catch (error) {
      console.error(error);
      setFailed(true);
    }
  }

  const create = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => {
      const created = await api.createToken(name.trim());
      const { token: _secret, ...listed } = created;
      setIssued(created);
      setTokens((all) => [listed, ...(all ?? [])]);
      setName("");
    });
  };

  const revoke = (token: ApiToken) =>
    run(async () => {
      await api.revokeToken(token.id);
      setTokens((all) => all?.filter((other) => other.id !== token.id) ?? null);
      setIssued((shown) => (shown?.id === token.id ? null : shown));
    });

  return (
    <section className={styles.section} aria-labelledby="tokens-heading">
      <h3 id="tokens-heading" className={styles.heading}>
        Tokens de acceso
      </h3>
      <p className={styles.hint}>
        Un token deja que un script lea y añada tarjetas a tu tablero con <code>Authorization: Bearer</code>.
      </p>
      <form className={styles.inviteRow} onSubmit={create}>
        <input
          className={form.input}
          aria-label="Nombre del token"
          placeholder="Nombre, por ejemplo cicat"
          maxLength={80}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className={form.primary} disabled={!name.trim()}>
          Crear token
        </button>
      </form>
      {failed && (
        <p className={form.error} role="alert">
          No se pudo completar la acción.
        </p>
      )}
      {issued && (
        <>
          <CopyLink id="new-token" label="Token nuevo" value={issued.token} />
          <p className={styles.hint}>Cópialo ahora. No se vuelve a mostrar.</p>
        </>
      )}
      <ul className={styles.members} aria-label="Tokens">
        {tokens?.map((token) => (
          <li key={token.id} className={styles.member}>
            <div className={styles.memberHead}>
              <div className={styles.who}>
                <strong>{token.name}</strong>
                <span className={styles.hint}>
                  Creado el {day(token.createdAt)} ·{" "}
                  {token.lastUsedAt === null ? "Sin usar" : `Último uso el ${day(token.lastUsedAt)}`}
                </span>
              </div>
              <button
                type="button"
                className={form.danger}
                aria-label={`Revocar ${token.name}`}
                onClick={() => revoke(token)}
              >
                Revocar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
