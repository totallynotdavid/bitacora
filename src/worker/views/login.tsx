/** @jsxImportSource hono/jsx */
import { MIN_PASSWORD } from "../../shared/model";
import { Document } from "./layout";

const LOGIN_CSS = `
body { display: grid; place-items: center; }
main { width: min(22.5rem, 100% - var(--space-8)); padding: var(--space-6);
  background: var(--overlay); border-radius: var(--radius-lg); }
h1 { margin-bottom: var(--space-4); font-size: var(--text-lg); line-height: var(--leading-tight); font-weight: var(--weight-strong); }
label { display: block; margin: var(--space-4) 0 var(--space-1); font-weight: var(--weight-strong); }
input { width: 100%; height: var(--field); padding: 0 var(--space-3); border: 1px solid var(--border-control);
  border-radius: var(--radius-md); background: var(--field-background); font: inherit; font-size: var(--text-base);
  transition: border-color var(--duration-fast) var(--ease-out); }
input:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; border-color: var(--focus); }
button { margin-top: var(--space-6); width: 100%; height: var(--field); padding: 0; border: 0; border-radius: var(--radius-md);
  background: var(--accent); color: var(--text-on-solid); font: inherit; font-size: var(--text-base);
  font-weight: var(--weight-strong); cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out); }
@media (hover: hover) and (pointer: fine) { button:hover { background: var(--accent-hover); } }
button:active { transform: scale(0.97); }
.error { margin-bottom: var(--space-3); color: var(--text-danger); font-weight: var(--weight-strong); }
.note { margin-bottom: var(--space-3); color: var(--text-muted); }
a { color: var(--text-accent); }
`;

type Field = {
  name: string;
  label: string;
  type: string;
  autocomplete: string;
  value?: string;
  autofocus?: boolean;
  minlength?: number;
};

function FormPage(props: {
  title: string;
  action: string;
  submit: string;
  error?: string;
  note?: string;
  fields: Field[];
}) {
  return (
    <Document title={`${props.title} · Bitácora`} css={LOGIN_CSS}>
      <main data-elevation="overlay">
        <h1>{props.title}</h1>
        {props.note && <p class="note">{props.note}</p>}
        <form method="post" action={props.action}>
          {props.error && (
            <p class="error" role="alert">
              {props.error}
            </p>
          )}
          {props.fields.map((field) => (
            <>
              <label for={field.name}>{field.label}</label>
              <input
                id={field.name}
                name={field.name}
                type={field.type}
                autocomplete={field.autocomplete}
                value={field.value}
                autofocus={field.autofocus}
                minlength={field.minlength}
                required
              />
            </>
          ))}
          <button type="submit">{props.submit}</button>
        </form>
      </main>
    </Document>
  );
}

const passwordField = (autocomplete: "current-password" | "new-password", autofocus = false): Field => ({
  name: "password",
  label: "Contraseña",
  type: "password",
  autocomplete,
  autofocus,
  minlength: autocomplete === "new-password" ? MIN_PASSWORD : undefined,
});

export function LoginPage(props: { error?: string; email?: string }) {
  return (
    <FormPage
      title="Bitácora"
      action="/login"
      submit="Entrar"
      error={props.error}
      fields={[
        {
          name: "email",
          label: "Correo",
          type: "email",
          autocomplete: "username",
          value: props.email,
          autofocus: !props.email,
        },
        passwordField("current-password", Boolean(props.email)),
      ]}
    />
  );
}

export function SignUpPage(props: { token: string; error?: string; name?: string; email?: string }) {
  return (
    <FormPage
      title="Crear tu cuenta"
      note="Te invitaron a Bitácora."
      action={`/invitacion/${props.token}`}
      submit="Crear cuenta"
      error={props.error}
      fields={[
        {
          name: "name",
          label: "Nombre",
          type: "text",
          autocomplete: "name",
          value: props.name,
          autofocus: true,
        },
        { name: "email", label: "Correo", type: "email", autocomplete: "username", value: props.email },
        passwordField("new-password"),
      ]}
    />
  );
}

export function ResetPage(props: { token: string; error?: string }) {
  return (
    <FormPage
      title="Nueva contraseña"
      action={`/restablecer/${props.token}`}
      submit="Guardar contraseña"
      error={props.error}
      fields={[passwordField("new-password", true)]}
    />
  );
}

/** Shown for a link that is used, expired or unknown. */
export function LinkGonePage() {
  return (
    <Document title="Enlace no válido · Bitácora" css={LOGIN_CSS}>
      <main data-elevation="overlay">
        <h1>Este enlace ya no sirve</h1>
        <p class="note">Ya se usó o venció. Pide uno nuevo a quien te lo envió.</p>
        <p class="note">
          <a href="/login">Ir a entrar</a>
        </p>
      </main>
    </Document>
  );
}
