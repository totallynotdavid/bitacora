# bitacora

A personal work log for one developer. A Trello-style board with three lists
(Pendiente, En curso, Hecho) where finished cards fall into one lane per day,
and a read-only weekly report the owner shares as a link. The interface is in
Spanish. It runs as one Cloudflare Worker with a D1 database.

## Run it

Needs [Bun](https://bun.sh). `mise.toml` pins the version.

```sh
bun install
bun run dev
```

`bun run dev` creates `.dev.vars` from `.dev.vars.example` on the first run,
applies the migrations to the local D1 database and serves the app at
<http://localhost:5173>. The development password is `bitacora-dev`.

## Use it

- Drag cards between lists, between the two Pendiente groups ("Esta semana",
  "Después") and inside a list. With the keyboard, focus a card, press Space to
  lift it, the arrow keys to move it and Space to drop it. Enter opens the card.
- A card dropped into Hecho gets today's date in America/Lima. Moving it out
  clears the date. The card dialog changes the date for work finished earlier.
- Hecho shows the days of the current week. "Semanas anteriores" loads earlier
  weeks one at a time.
- The settings dialog shows the report link, copies it and regenerates it.
  Regenerating invalidates the old link.
- The report is at `/r/<token>`. `?semana=2026-W42` picks another week.

## Secrets and variables

| Name                  | Kind     | Meaning                                      |
| --------------------- | -------- | -------------------------------------------- |
| `OWNER_PASSWORD_HASH` | secret   | PBKDF2 hash of the owner's password.         |
| `SESSION_SECRET`      | secret   | Key that signs the session cookie.           |
| `OWNER_NAME`          | variable | Name in the report, set in `wrangler.jsonc`. |

Print a hash for a password read from stdin:

```sh
echo -n 'my password' | bun run hash-password
```

Generate a signing key with `openssl rand -base64 48`.

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

| Trello list     | bitacora                 |
| --------------- | ------------------------ |
| Trabajando, Hoy | En curso                 |
| Esta semana     | Pendiente, "Esta semana" |
| Pendiente       | Pendiente, "Después"     |
| Completado      | Hecho                    |

A Hecho card gets the Lima date of the last move into Completado, or of its
creation when it was created there. A named label becomes the requester and
every card gets the category Otros. Within each Trello list, cards keep their
`pos` order. En curso takes Trabajando first, then Hoy. Imported cards go after
the cards already on the board. Importing the same file twice adds nothing.

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

3. Set `OWNER_NAME` under `vars` in `wrangler.jsonc`.
4. Apply the migrations and deploy:

   ```sh
   bun run db:migrate:remote
   bun run deploy
   ```

5. Set the secrets. Each command asks for the value. Paste the output of
   `bun run hash-password` for the first and a random string for the second (see
   Secrets and variables):

   ```sh
   bunx wrangler secret put OWNER_PASSWORD_HASH
   bunx wrangler secret put SESSION_SECRET
   ```

`workers_dev` is on, so the Worker answers at
`https://bitacora.<subdomain>.workers.dev`. Wrangler prints the address after
the deploy. The first deploy on an account asks you to register the
`<subdomain>`. Log in there, open the settings dialog and copy the report link.

## Develop

```sh
bun run check   # format, lint, types and tests
```

The code map and the rules the code keeps are in
[docs/architecture.md](docs/architecture.md).
