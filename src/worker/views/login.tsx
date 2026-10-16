/** @jsxImportSource hono/jsx */
import { Document } from "./layout";

const LOGIN_CSS = `
main { max-width: 320px; margin: 18vh auto 0; padding: 24px; background: #fff; border-radius: 12px;
  box-shadow: 0 1px 1px rgba(30 31 33 / .25), 0 0 1px rgba(30 31 33 / .31); }
h1 { margin: 0 0 16px; font-size: 16px; font-weight: 650; color: rgb(23 43 77); }
label { display: block; margin-bottom: 4px; font-weight: 600; color: rgb(80 82 88); }
input { width: 100%; height: 36px; padding: 0 12px; border: 1px solid rgb(9 30 66 / .25); border-radius: 8px; font: inherit; }
input:focus-visible { outline: 2px solid #1868db; outline-offset: 1px; }
button { margin-top: 16px; width: 100%; height: 36px; border: 0; border-radius: 8px; background: #1868db;
  color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
button:hover { background: #1558bc; }
.error { margin: 0 0 12px; color: #ae2e24; }
`;

export function LoginPage(props: { failed: boolean }) {
  return (
    <Document title="Bitácora" css={LOGIN_CSS}>
      <main>
        <h1>Bitácora</h1>
        <form method="post" action="/login">
          {props.failed && <p class="error">Contraseña incorrecta.</p>}
          <label for="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            autofocus
          />
          <button type="submit">Entrar</button>
        </form>
      </main>
    </Document>
  );
}
