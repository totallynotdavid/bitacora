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
e2e          Playwright tests that drive the app in Chromium
```

## Requests

`src/worker/index.ts` mounts, in this order:

1. `/login` and `/logout` (`routes/auth.tsx`).
2. `/api/*` (`routes/api.ts`), the JSON API. It checks the session itself.
3. `/r/<token>` (`routes/report.tsx`), public.
4. `/assets/*` and `/favicon.svg`, public static files.
5. Everything else needs the session and returns the React app, including a
   card's own page, `/c/<id>`.

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
| Create                         | One INSERT that computes `max(position) + 1` inside the statement. The client may choose the card's id. A second create with the same id inserts nothing and returns the stored card.                       |
| Move, or reorder with an index | One batch: the card's fields with a slot computed in SQL (half a step before the card now at the index, or after the last), then a renumber 1..n of the destination group, then of the group the card left. |
| Edit without a move            | One UPDATE of the edited fields. Positions stay.                                                                                                                                                            |
| Delete                         | One DELETE. The group keeps a gap and its order.                                                                                                                                                            |
| Trello import                  | One INSERT per card at `max(position) + 1` of its group.                                                                                                                                                    |

Two tabs moving into one group both succeed. The second batch runs after the
first and renumbers everything, so positions stay distinct. A request carries
the index its tab computed from the cards it holds, so the later request can
land one slot off from what its tab showed. A tab fetches the board once, when
it loads, so it shows the real order after the next load.

### Done date

The date exists exactly when the list is Hecho. The `cards` table enforces it
with a CHECK constraint, as it does `later` only in Pendiente.

| Move                                                 | Done date                                 |
| ---------------------------------------------------- | ----------------------------------------- |
| Created in Hecho, or moved into it with no date      | Today in Lima                             |
| Into Hecho with a date, or a date edited in the card | The given date, never in the future (400) |
| To another day inside Hecho                          | That day                                  |
| Out of Hecho                                         | Cleared                                   |

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

### Card state

`src/web/useBoard.ts` is the only owner of the cards. Components read the cards
it returns and call its actions: `add`, `edit`, `move`, `remove`, `open` and
`loadOlder`. They keep no copy.

The hook holds `base`, the cards as the server holds them, and `pending`, the
changes the user made that the server has not confirmed. The screen shows `base`
with every pending change applied (`boardState.ts`). A change shows at once, and
the board is never fetched again after a write.

- Writes go out one at a time, in the order made.
- A write that succeeds folds into `base`. The card the server returns replaces
  the local one, so its position and done date come from the server.
- A write that fails is dropped from `pending`, which puts the card back. A
  toast reads "No se pudo guardar. Reintentar", and Reintentar queues the same
  change again.
- A move names the card it goes before. The index in the request is computed
  from `base` when the write is sent, so earlier writes, deleted cards and the
  filter do not shift it.
- A new card gets its id in the browser (`crypto.randomUUID`), so it can be
  edited, and opened, before the server answers. `open` looks for a card in the
  cards on screen (`base` plus `pending`) and reads from `/api` only a card
  that is not there.
- A delete is held in `pending` for 6 seconds behind the toast "Tarjeta
  eliminada. Deshacer". Deshacer drops it. When the toast closes, the request is
  queued. If the page hides first, the held deletes go out as `fetch` with
  `keepalive`. A delete that gets 404 counts as done.

The completion circle on a card (`Board.tsx`) is a move. Outside Hecho it goes
before the first card of today's group, so the card lands on top. In Hecho it
goes to the end of En curso.

### Drag and drop

`src/web/groups.ts` names every drop target: `pendiente:week`,
`pendiente:later`, `en_curso` and `hecho:<date>`. Each day in Hecho also has a
`:header` target, open or collapsed, so a card dropped on a day header joins
that day. An empty list or group is a target too.

`useCardDrag.ts` starts a drag after the pointer moves 5px, so a click still
opens the card. While a card is lifted, a local copy of the cards shows the gray
placeholder in the slot the card would take. A drop hands the final place to
`useBoard.move` and discards the copy in the same render, so the card stays
where the placeholder was. Escape cancels the drag. The keyboard sensor lifts a
card with Space, moves it with the arrows and drops it with Space.

### URL and local state

| State                     | Kept in                                   |
| ------------------------- | ----------------------------------------- |
| The open card             | The path `/c/<id>` (`useCardRoute.ts`)    |
| The filter                | The query `q`, `categoria`, `solicitante` |
| Open or closed day        | localStorage, `bitacora.hecho-open`       |
| Labels as pills or stripe | localStorage, `bitacora.labels-expanded`  |
| Composer drafts           | Memory, until the page reloads            |

Opening a card pushes `/c/<id>`, so the back button closes it. A page loaded on
`/c/<id>` fetches the card with `GET /api/cards/<id>` when the loaded weeks do
not hold it. When the server has no such card, the board shows the toast "No se
encontró la tarjeta." and the URL returns to `/`.

### Layers and keys

`useEscape.ts` keeps a stack of open layers (popover, dialog, composer, title
field). Escape closes the last one opened. Modal dialogs use the native
`<dialog>`, which traps focus, so a popover opened from the card back renders
inside it. `Board.tsx` handles the letter shortcuts that the `?` dialog lists.
They do nothing while the focus is in a text field or a modal is open.

### Motion

Hover backgrounds, popovers and the day groups animate for 85 to 150ms
(`--motion-fast`, `--motion` and `--motion-slow` in `styles/tokens.css`). A day
group collapses by animating `grid-template-rows`. `styles/global.css` turns
every animation and transition off under `prefers-reduced-motion: reduce`. The
report page has no animation.
