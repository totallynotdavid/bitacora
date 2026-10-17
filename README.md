# bitacora

A work log for a small team. Each person keeps a Trello-style board of their
own, with four lists (Pendiente, Esta semana, En curso, Hecho) where finished
cards fall into one lane per day, and shares a read-only weekly report as a
link. The interface is in Spanish. It runs as one Cloudflare Worker with a D1
database.

## Run it

Needs [Bun](https://bun.sh). `mise.toml` pins the version.

```sh
bun install
bun run dev
```

`bun run dev` creates `.dev.vars` from `.dev.vars.example` on the first run,
applies the migrations to the local D1 database and serves the app at
<http://localhost:5173>. Sign in with `dev@bitacora.test` and the password
`bitacora-dev`.

## Use it

- Drag cards between lists and inside a list. With the keyboard, focus a card,
  press Space to lift it, the arrow keys to move it and Space to drop it. Escape
  cancels a drag. Enter opens the card.
- Every change shows at once and saves in the background. If a save fails, the
  card goes back and a notice offers to retry.
- "Añade una tarjeta" at the foot of a list opens a composer. Enter adds the
  card and keeps the composer open for the next one. The composer in Hecho adds
  to today.
- Hovering a card shows a circle left of the title and an edit button in its
  corner. The circle moves the card to the top of today in Hecho. In Hecho, the
  green check moves it back to En curso.
- The edit button, or `e` while hovering the card, edits the title in place and
  lists the card's actions beside it.
- A click opens the card. Each field in it saves on its own. The list button in
  its header moves the card. Its address is `/c/<id>`, and the browser's back
  button closes it.
- Delete shows "Tarjeta eliminada. Deshacer" for 6 seconds. The card is deleted
  when the notice closes.
- A card has one label or none. The Etiqueta button in the card opens a list of
  your labels. Pick one, pick "Sin etiqueta", create a label with a name and one
  of six colors, or rename, recolor or delete one. Deleting a label clears it
  from its cards. A card without a label shows no stripe.
- "Filtrar" hides the cards that do not match a text, a label or a requester.
  The filter is in the address, so a reload keeps it.
- A click on a label stripe turns every stripe into a pill with the label's
  name, and back.
- Shortcuts, when the focus is not in a text field: `n` opens the composer of
  the list under the pointer, `e` edits a card, `f` opens the filter, `x` clears
  it and `?` shows the list of shortcuts.
- A card dropped into Hecho gets today's date in America/Lima. Dropped on a day
  header, it gets that day. Moving it out clears the date. The card changes the
  date for work finished earlier.
- Hecho shows the days of the current week. "Semanas anteriores" loads earlier
  weeks one at a time.
- The settings dialog (Ajustes) changes your name and password and shows your
  report link, which it copies and regenerates. Regenerating invalidates the old
  link. Changing the password signs out your other browsers.
- The report is at `/r/<token>` and shows your name and your cards.
  `?semana=2026-W42` picks another week.

### Members

Admins see a Miembros section in Ajustes.

- "Invitar" makes a single-use link for a role, `/invitacion/<token>`, that
  lasts 7 days. Copy it and send it yourself, because bitacora sends no email.
  The person opens it, enters a name, an email and a password, and lands signed
  in on their own empty board.
- Each member has "Enlace para restablecer contraseña", a single-use link of 7
  days that sets a new password and signs out their other browsers.
- "Desactivar" signs a member out at once and refuses their login until
  "Activar". An admin cannot disable or demote themselves, so there is always
  one.
- Five failed logins for one email within 15 minutes lock that email for 15
  minutes.

## Secrets

| Name             | Meaning                            |
| ---------------- | ---------------------------------- |
| `SESSION_SECRET` | Key that signs the session cookie. |

Generate a signing key with `openssl rand -base64 48`. Passwords live in the
database as PBKDF2 hashes, never in a secret.

## Migrate

Migrations are SQL files in `drizzle/`. After a change to
`src/worker/db/schema.ts`, generate the next one, then apply it:

```sh
bun run db:generate
bun run db:migrate:local
bun run db:migrate:remote
```

## Import from Trello

```sh
bun run import:trello export.json                 # print the SQL
bun run import:trello export.json --apply local   # write it to the local D1
bun run import:trello export.json --apply remote  # write it to the deployed D1
```

The cards go to the first admin. `--email <email>` sends them to the account
with that email, which must exist.

| Trello list     | bitacora    |
| --------------- | ----------- |
| Trabajando, Hoy | En curso    |
| Esta semana     | Esta semana |
| Pendiente       | Pendiente   |
| Completado      | Hecho       |

A Hecho card gets the Lima date of the last move into Completado, or of its
creation when it was created there. A card takes its first named Trello label as
its label, matched by name on the person's labels and created when missing. A
card without a named label stays without one. Trello colors outside the six map
to the nearest. Within each Trello list, cards keep their `pos` order. En curso
takes Trabajando first, then Hoy. Imported cards go after the cards already on
the board. Importing the same file twice adds nothing.

## Deploy

You need a Cloudflare account. The free plan is enough.

1. Sign in with Wrangler. It opens a browser to authorize your account:

   ```sh
   bunx wrangler login
   ```

2. Create the database. Copy the `database_id` it prints into `wrangler.jsonc`:

   ```sh
   bunx wrangler d1 create bitacora
   ```

3. Apply the migrations and deploy:

   ```sh
   bun run db:migrate:remote
   bun run deploy
   ```

4. Set the signing key. The command asks for the value (see Secrets):

   ```sh
   bunx wrangler secret put SESSION_SECRET
   ```

5. Claim the first admin. The migration creates the account without an email or
   a password, so nobody can sign in until you do this. The command asks for the
   password twice:

   ```sh
   bun run claim-admin -- --remote --email you@example.com --name "Your Name"
   ```

   It works once. When the account already has a password it prints "The first
   admin is already claimed. Nothing changed." and exits with 1. Without
   `--remote` it claims the account in the local database.

`workers_dev` is on, so the Worker answers at
`https://bitacora.<subdomain>.workers.dev`. Wrangler prints the address after
the deploy. The first deploy on an account asks you to register the
`<subdomain>`. Sign in there with the email and password you chose, then invite
the others from Ajustes.

Deploying over a database that already holds cards keeps them, and the report
link, under the first admin. Run steps 3 to 5. If the Worker still has an
`OWNER_PASSWORD_HASH` secret, delete it with
`bunx wrangler secret delete OWNER_PASSWORD_HASH`.

## Develop

```sh
bun run check      # format, lint, types, Worker tests and browser tests
bun run test       # the Worker tests alone
bun run test:e2e   # the browser tests alone
```

The browser tests need Chromium (`bunx playwright install chromium`). They build
the app and serve it with `vite preview` on a port and a D1 state of their own,
which they delete first.

The code map and the rules the code keeps are in
[docs/architecture.md](docs/architecture.md).
