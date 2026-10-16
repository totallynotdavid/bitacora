# Architecture

One Worker serves the JSON API, the report page and the React app.

```text
src/shared   model, schemas and date rules used by both sides
src/worker   Hono app, D1 queries, auth
src/web      React app: board, dialogs, drag and drop
src/import   Trello export to cards
scripts      hash-password, import-trello, prepare-dev
drizzle      generated migrations
test         tests that drive the Worker over HTTP
```

## Requests

`src/worker/index.ts` mounts, in this order:

1. `/login` and `/logout` (`routes/auth.tsx`).
2. `/api/*` (`routes/api.ts`), the JSON API. It checks the session itself.
3. `/r/<token>` (`routes/report.tsx`), public.
4. `/assets/*` and `/favicon.svg`, public static files.
5. Everything else needs the session and returns the React app.

Without a session, a page request redirects to `/login` and an API request gets
401 (`session.ts`).

## Shared state

Only the owner writes, but the owner can have two tabs open. D1 runs each
statement, and each batch, as one unit. Every rule below rests on one statement
or one batch, never on a read followed by a write.

### Card position

A card's group is its list, plus `later` in Pendiente, plus the done date in
Hecho. Positions are distinct and ordered inside a group. Gaps are allowed, so
only the order means anything. All writes are in `src/worker/cards.ts`.

| Write                          | What runs                                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create                         | One INSERT that computes `max(position) + 1` inside the statement.                                                                                                                                          |
| Move, or reorder with an index | One batch: the card's fields with a slot computed in SQL (half a step before the card now at the index, or after the last), then a renumber 1..n of the destination group, then of the group the card left. |
| Edit without a move            | One UPDATE of the edited fields. Positions stay.                                                                                                                                                            |
| Delete                         | One DELETE. The group keeps a gap and its order.                                                                                                                                                            |
| Trello import                  | One INSERT per card at `max(position) + 1` of its group.                                                                                                                                                    |

Two tabs moving into one group both succeed. The second batch runs after the
first and renumbers everything, so positions stay distinct. A request carries
the index its tab saw, so the later request can land one slot off from what its
tab showed. The next board fetch shows the real order.

### Done date

The date exists exactly when the list is Hecho. The `cards` table enforces it
with a CHECK constraint, as it does `later` only in Pendiente.

| Move                                                   | Done date                                 |
| ------------------------------------------------------ | ----------------------------------------- |
| Into Hecho, no date given (a drag from another list)   | Today in Lima                             |
| Into Hecho with a date, or a date edited in the dialog | The given date, never in the future (400) |
| To another day inside Hecho                            | That day                                  |
| Out of Hecho                                           | Cleared                                   |

The placement comes from the card as read at the start of the request. When two
tabs change one card, the later write wins. A move writes list, `later` and date
together, so a write never breaks the CHECK constraints.

### Session

The session is a signed cookie. The server stores nothing.

| State      | Entered by                                                                   | Left by                                                                         |
| ---------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Signed out | No cookie, a bad signature or a past expiry                                  | `POST /login` with the right password                                           |
| Signed in  | Login sets `bitacora_session`: an expiry and its HMAC under `SESSION_SECRET` | Expiry after 30 days, `POST /logout` in that browser, or a new `SESSION_SECRET` |

Only the owner knows the password, and only the deployer sets the secrets. Tabs
in one browser share the cookie, so they share the state. Logging out in one
browser does not end a session in another, because nothing is revoked on the
server. Replacing `SESSION_SECRET` ends every session.

### Report token

The `settings` row `report_token` holds one token of 32 random bytes. The second
migration inserts the row, so the row always exists and a read never writes.

| State   | Entered by                     | Left by             |
| ------- | ------------------------------ | ------------------- |
| Current | The migration, or a regenerate | The next regenerate |

Only the signed-in owner reads or regenerates it (`/api/settings`). Anyone with
the token reads the report. Regenerating is one UPDATE, so the old link stops at
once. Two tabs regenerating together leave one token in the row, the later
write, and the other tab shows a link that no longer works until it reloads the
settings.

The report sends `X-Robots-Tag: noindex, nofollow` and
`Cache-Control: no-store`.

## Dates

`src/shared/dates.ts` owns the time zone. Dates are `YYYY-MM-DD` strings in
America/Lima. A week runs Monday to Sunday and is named `YYYY-Www` (ISO week).

## Auth

`OWNER_PASSWORD_HASH` has the form `pbkdf2-sha256$<iterations>$<salt>$<hash>`.
`scripts/hash-password.ts` writes it with 100000 iterations, the most the
Workers runtime allows. The cookie is HttpOnly, Secure and SameSite=Lax.

## Board in the browser

`src/web/groups.ts` names every drop target: `pendiente:week`,
`pendiente:later`, `en_curso` and `hecho:<date>`. A collapsed day keeps a
`:header` target so a card can still be dropped on it. `useCardDrag.ts` keeps
the order while dragging and sends one move request on drop. The board is
fetched again after every write. The open or closed state of each day is in
localStorage under `bitacora.hecho-open`.
