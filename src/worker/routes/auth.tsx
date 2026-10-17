/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { MIN_PASSWORD } from "../../shared/model";
import { loginSchema, resetSchema, signUpSchema } from "../../shared/schemas";
import { connect } from "../db/client";
import { isUsable, useInvite, useReset } from "../links";
import { clearAttempts, countAttempt, WINDOW_SECONDS } from "../login-limit";
import { hashPassword, verifyPassword } from "../password";
import { endSession, sessionUser, startSession, type AppEnv } from "../session";
import { findUserByEmail } from "../users";
import { LinkGonePage, LoginPage, ResetPage, SignUpPage } from "../views/login";

export const auth = new Hono<AppEnv>();

/** Checked against when the email has no account, so a miss takes as long as a hit. */
const DUMMY_HASH = `pbkdf2-sha256$100000$${"A".repeat(22)}$${"A".repeat(43)}`;

const field = (form: Record<string, unknown>, name: string) =>
  typeof form[name] === "string" ? form[name] : "";

const WRONG = "Correo o contraseña incorrectos.";

auth.get("/login", async (c) => {
  if (await sessionUser(c)) return c.redirect("/");
  return c.html(<LoginPage />);
});

auth.post("/login", async (c) => {
  const form = await c.req.parseBody();
  const parsed = loginSchema.safeParse({ email: field(form, "email"), password: field(form, "password") });
  if (!parsed.success) return c.html(<LoginPage error={WRONG} />, 401);
  const { email, password } = parsed.data;
  const db = connect(c.env);

  const lockedUntil = await countAttempt(db, email);
  if (lockedUntil !== null) {
    const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now() / 1000) / 60));
    const error = `Demasiados intentos fallidos. Vuelve a intentarlo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`;
    c.header("Retry-After", String(Math.min(WINDOW_SECONDS, minutes * 60)));
    return c.html(<LoginPage error={error} email={email} />, 429);
  }

  const user = await findUserByEmail(db, email);
  const matches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) return c.html(<LoginPage error={WRONG} email={email} />, 401);
  if (user.disabled) {
    return c.html(<LoginPage error="Esta cuenta está desactivada." email={email} />, 403);
  }

  await clearAttempts(db, email);
  await startSession(c, user.id, user.sessionVersion);
  return c.redirect("/", 303);
});

auth.post("/logout", (c) => {
  endSession(c);
  return c.redirect("/login", 303);
});

function signUpError(issues: { path: PropertyKey[] }[]): string {
  const first = issues[0]?.path[0];
  if (first === "password") return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (first === "email") return "Escribe un correo válido.";
  return "Escribe tu nombre.";
}

auth.get("/invitacion/:token", async (c) => {
  const token = c.req.param("token");
  if (!(await isUsable(connect(c.env), "invite", token))) return c.html(<LinkGonePage />, 404);
  return c.html(<SignUpPage token={token} />);
});

auth.post("/invitacion/:token", async (c) => {
  const token = c.req.param("token");
  const form = await c.req.parseBody();
  const input = { name: field(form, "name"), email: field(form, "email"), password: field(form, "password") };
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return c.html(
      <SignUpPage
        token={token}
        error={signUpError(parsed.error.issues)}
        name={input.name}
        email={input.email}
      />,
      400,
    );
  }

  const { name, email, password } = parsed.data;
  const created = await useInvite(connect(c.env), token, {
    name,
    email,
    passwordHash: await hashPassword(password),
  });
  if (created === "invalid") return c.html(<LinkGonePage />, 404);
  if (created === "email-taken") {
    return c.html(
      <SignUpPage token={token} error="Ese correo ya tiene una cuenta." name={name} email={email} />,
      409,
    );
  }

  await startSession(c, created.id, 0);
  return c.redirect("/", 303);
});

auth.get("/restablecer/:token", async (c) => {
  const token = c.req.param("token");
  if (!(await isUsable(connect(c.env), "reset", token))) return c.html(<LinkGonePage />, 404);
  return c.html(<ResetPage token={token} />);
});

auth.post("/restablecer/:token", async (c) => {
  const token = c.req.param("token");
  const form = await c.req.parseBody();
  const parsed = resetSchema.safeParse({ password: field(form, "password") });
  if (!parsed.success) {
    return c.html(
      <ResetPage token={token} error={`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`} />,
      400,
    );
  }

  const user = await useReset(connect(c.env), token, await hashPassword(parsed.data.password));
  if (!user) return c.html(<LinkGonePage />, 404);
  if (user.disabled) return c.redirect("/login", 303);

  await startSession(c, user.id, user.sessionVersion);
  return c.redirect("/", 303);
});
