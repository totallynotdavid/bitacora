/** @jsxImportSource hono/jsx */
import { MIN_PASSWORD } from "../../shared/model";
import { Document } from "./layout";

const LOGIN_CSS = `
main { max-width: 320px; margin: 18vh auto 0; padding: 24px; background: #fff; border-radius: 12px;
  box-shadow: 0 1px 1px rgba(30 31 33 / .25), 0 0 1px rgba(30 31 33 / .31); }
h1 { margin: 0 0 16px; font-size: 16px; font-weight: 650; color: rgb(23 43 77); }
label { display: block; margin: 12px 0 4px; font-weight: 600; color: rgb(80 82 88); }
input { width: 100%; height: 36px; padding: 0 12px; border: 1px solid rgb(9 30 66 / .25); border-radius: 8px; font: inherit; }
input:focus-visible { outline: 2px solid #1868db; outline-offset: 1px; }
button { margin-top: 16px; width: 100%; height: 36px; border: 0; border-radius: 8px; background: #1868db;
  color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
button:hover { background: #1558bc; }
.error { margin: 0 0 12px; color: #ae2e24; }
.note { margin: 0 0 12px; color: rgb(80 82 88); }
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
      <main>
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
      <main>
        <h1>Este enlace ya no sirve</h1>
        <p class="note">Ya se usó o venció. Pide uno nuevo a quien te lo envió.</p>
        <p class="note">
          <a href="/login">Ir a entrar</a>
        </p>
      </main>
    </Document>
  );
}
