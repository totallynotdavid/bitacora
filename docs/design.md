# Design

`src/web/styles/tokens.css` holds the visual values of the app and of the server
pages (login, invitation, reset and the report). Colors, type, space, radius,
shadow, layers and motion come from it. A component reads a role name such as
`--text`, `--card` or `--accent`. It never reads a scale step (`--accent-9`) and
never writes a color, a font, a shadow, a duration or a spacing value of its
own.

A size that one component owns stays in that component's stylesheet, in rem: the
height of a toast, the minimum height of the description field, the box of an
icon. A size that two components share, or that is spacing, is a token.

This command finds a color, font or shadow written outside the token file. It
prints nothing:

```sh
rg -n '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|font-family|box-shadow:|\[[0-9.]+(px|rem)\]' \
  src --glob '!src/web/styles/tokens.css'
```

## Goal of the board

The goal is to see what is on the plate this week and move a card forward. The
next action is to open the composer of the list that matters, usually En curso,
or to drag a card. The chrome is quiet so the cards carry the color.

## Themes

The page follows the system through `color-scheme: light dark`. Each color token
is `light-dark(<light>, <dark>)`, so one declaration holds both themes. A
`data-theme` attribute on `<html>` pins one. Sistema removes it. Each theme has
its own 12-step scale, not an inversion of the other.

- A higher surface is lighter in dark: `--list` < `--card` < `--overlay`.
- The board background is one token, `--board`, per theme.
- Login, invitation, reset and the report follow the system and never read a
  stored choice.

## Color

All colors are OKLCH. One accent at hue 255 (`--hue`) and every neutral carries
the same hue at chroma 0.003 to 0.02. The four scales are `--neutral-*`,
`--accent-*`, `--danger-*` and `--success-*`, steps 1 to 12. Steps 1 to 5 are
surfaces, 6 to 8 borders, 9 and 10 solid fills, 11 and 12 text.

| Role                                       | Used for                               |
| ------------------------------------------ | -------------------------------------- |
| `--text`                                   | Card titles, headings, field text      |
| `--text-muted`                             | Counts, dates, hints, closed icons     |
| `--text-accent`                            | Links on the server pages              |
| `--text-danger`, `--text-success`          | An error, a done card, a finished list |
| `--text-on-solid`                          | Text on `--accent` and `--danger`      |
| `--accent`, `--danger`, `--success`        | Solid fills                            |
| `--board`, `--list`, `--card`, `--overlay` | Surfaces from back to front            |
| `--border`, `--border-control`             | A divider, and the edge of a control   |
| `--hover`, `--pressed`                     | Alpha layers of the text color         |

The app holds to three text tones: `--text`, `--text-muted` and `--text-accent`.
The danger and success tones mark a state and never body text.

Label colors are six pairs, `--label-<color>-bg` and `--label-<color>-text`,
with a light and a dark pair each. A label's inline style is `labelStyle(color)`
in `src/shared/model.ts`, which returns the two variables.

### Contrast

`test/contrast.test.ts` parses `tokens.css`, resolves each pair in both themes
and fails under the ratio:

- 4.5:1 for text: `--text` and `--text-muted` on every surface, the accent,
  danger and success text tones on the surfaces they sit on and on their washes,
  text on a solid button, text on a toast, and each label's text on its fill.
- 3:1 for a non-text mark: the edge of a control and the focus ring on every
  surface, a solid accent and success fill on a list, a card and an overlay, and
  each label fill on a list and on a card.

## Type

Inter 4, variable, self-hosted in `public/fonts/` as two woff2 files subset to
Latin and Latin Extended. The Worker serves them at `/fonts/*`. The first file
is preloaded and `font-display: swap` shows the system face until it arrives. A
page requests no font from another origin.

| Token          | Size                  | Use                         |
| -------------- | --------------------- | --------------------------- |
| `--text-xs`    | 12px                  | Counts, badges, hints       |
| `--text-sm`    | 14px                  | Card titles, controls, body |
| `--text-base`  | 16px                  | Fields, dialog body         |
| `--text-lg`    | 20px                  | Dialog and page headings    |
| `--text-xl`    | 24px                  | Card back title             |
| `--text-title` | 32px, 40px from 768px | A page title                |

Sizes are in rem. Two weights: `--weight-regular` 400 and `--weight-strong` 600.
Counts, dates and percentages use `font-variant-numeric: tabular-nums`. A field
on a phone is 16px so the browser does not zoom on focus.

## Space and radius

Space is a 4px unit in rem: `--space-1` 4, `--space-2` 8, `--space-3` 12,
`--space-4` 16, `--space-6` 24, `--space-8` 32, `--space-12` 48. A gap, padding
or margin is one of these, or a `calc()` of them. Related things sit closer than
unrelated things.

Radius is four values: `--radius-sm` 4 for a bar or a checkbox, `--radius-md` 8
for a control or a card, `--radius-lg` 12 for a dialog or a list,
`--radius-full` for a pill. A nested element has a radius no larger than its
parent's.

Control sizes are shared, so they are tokens: `--control` 40px, `--field` 44px,
`--icon-button` 32px. On a coarse pointer `--control` and `--icon-button` are
44px, the size of a finger. A border is 1px, and a focus ring or a checkbox edge
is 2px, written where it is used.

## Depth

An element names its level with `data-elevation="raised|overlay|modal"`, and the
token file turns that into a shadow. A component never writes `box-shadow`. Each
shadow has a 1px ring and two layers, offsets down, tinted with the surface hue.
A card is `raised` at rest and `overlay` while lifted. A popover and a menu are
`overlay`, a dialog and the card back are `modal`. A list carries no shadow. A
modal sits on `--scrim`.

## Motion

Durations are `--duration-fast` 120ms, `--duration` 180ms and `--duration-slow`
250ms, all with `--ease-out`, `cubic-bezier(0.23, 1, 0.32, 1)`. A transition
names the properties it changes and never uses `all`. Movement uses `transform`
and `opacity`. The exception is a day group, which collapses by animating
`grid-template-rows`.

- A popover grows from its trigger corner, a dialog from its center. Nothing
  enters from scale 0.
- A pressed button scales to 0.97.
- Hover styles sit in `@media (hover: hover) and (pointer: fine)`, so a touch
  tap leaves no stuck hover.
- Focus uses `:focus-visible` with a 2px `--focus` ring.
- Under `prefers-reduced-motion: reduce` every animation and transition is off.

## Layers

`#root` isolates the app. Three layers compete only with each other:
`--layer-overlay` 20, `--layer-popover` 30 and `--layer-toast` 40.

## Narrow screens

Under 768px the lists collapse into a tab bar of four tabs, each with its count.
One list shows at a time, starting on En curso. The controls grow to 44px on a
coarse pointer. Mover on the card back changes a card's list there.

## Exceptions

- **A disabled submit.** Guardar nombre in Ajustes, Mover in the move picker and
  Guardar in the date picker stay disabled until there is a change to send.
- **The quick-edit field.** It is 14px and one line high because it is the
  card's own title, edited in place over the card.
- **The card back title.** It has no edge at rest, like Trello's inline title,
  and shows a background and the focus ring on focus.
- **Quick edit outline.** The field has no focus ring of its own. The lifted
  card and the scrim around it are the focus mark.
