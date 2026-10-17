/** @jsxImportSource hono/jsx */
import { addWeeks, dayHeading, weekRangeLabel } from "../../shared/dates";
import { labelStyle, type Card, type Label } from "../../shared/model";
import { Document } from "./layout";

const REPORT_CSS = `
body { background: var(--card); }
main { max-width: var(--reading-width); margin: 0 auto; padding: var(--space-8) var(--space-4) var(--space-12); }
@media (min-width: 48rem) { main { padding-inline: var(--space-6); } }
header h1 { font-size: var(--text-title); line-height: var(--leading-tight); font-weight: var(--weight-strong); }
.owner { color: var(--text-muted); }
.counts { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); padding: 0; list-style: none; }
.counts li { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full); background: var(--chip); font-weight: var(--weight-strong);
  font-variant-numeric: tabular-nums; }
.swatch { width: var(--space-3); height: var(--space-3); border-radius: var(--radius-sm); }
nav { display: flex; justify-content: space-between; margin-top: var(--space-4); }
nav a { display: inline-flex; align-items: center; min-height: var(--control); color: var(--text-accent);
  font-weight: var(--weight-strong); text-decoration: none; }
@media (hover: hover) and (pointer: fine) { nav a:hover { text-decoration: underline; } }
section { margin-top: var(--space-8); }
h2 { margin-bottom: var(--space-2); font-size: var(--text-base); line-height: var(--leading); font-weight: var(--weight-strong); }
h2::first-letter { text-transform: uppercase; }
article { padding: var(--space-2) 0 var(--space-2) var(--space-3); border-left: var(--space-1) solid;
  break-inside: avoid; margin-bottom: var(--space-2); }
article h3 { font-size: var(--text-sm); font-weight: var(--weight-strong); }
.meta { color: var(--text-muted); font-size: var(--text-xs); line-height: var(--leading); }
.description { margin-top: var(--space-1); white-space: pre-wrap; }
.empty { color: var(--text-muted); }
@page { size: A4; margin: 16mm; }
@media print {
  :root { color-scheme: light; }
  main { max-width: none; padding: 0; }
  nav { display: none; }
  a { color: inherit; text-decoration: none; }
  .counts li { border: 1px solid var(--border-control); background: none; }
  section { margin-top: var(--space-6); }
}
`;

const NO_LABEL_BORDER = "var(--border-control)";

function ReportCard(props: { card: Card; label: Label | undefined }) {
  const { card, label } = props;
  const meta = [label?.name, card.requester].filter(Boolean).join(" · ");
  return (
    <article style={{ borderColor: label ? labelStyle(label.color).background : NO_LABEL_BORDER }}>
      <h3>{card.title}</h3>
      {meta && <p class="meta">{meta}</p>}
      {card.description && <p class="description">{card.description}</p>}
    </article>
  );
}

export type ReportData = {
  token: string;
  week: string;
  currentWeek: string;
  ownerName: string;
  today: string;
  days: { date: string; cards: Card[] }[];
  active: Card[] | null;
  labels: Label[];
};

/** Labels with finished cards, by name, then the cards without one. */
function countsByLabel(finished: Card[], labels: Label[]) {
  const counts = labels
    .map((label) => ({
      key: label.id,
      name: label.name,
      swatch: labelStyle(label.color).background,
      count: finished.filter((card) => card.labelId === label.id).length,
    }))
    .filter((entry) => entry.count > 0);
  const unlabeled = finished.filter((card) => card.labelId === null).length;
  if (unlabeled > 0)
    counts.push({ key: "none", name: "Sin etiqueta", swatch: NO_LABEL_BORDER, count: unlabeled });
  return counts;
}

export function ReportPage(props: ReportData) {
  const { token, week, currentWeek, days, labels } = props;
  const href = (target: string) => `/r/${token}?semana=${target}`;
  const finished = days.flatMap((day) => day.cards);
  const labelOf = (card: Card) => labels.find((label) => label.id === card.labelId);

  return (
    <Document title={`Informe ${weekRangeLabel(week)}`} css={REPORT_CSS}>
      <main>
        <header>
          <h1>{weekRangeLabel(week)}</h1>
          <p class="owner">{props.ownerName}</p>
          <ul class="counts">
            {countsByLabel(finished, labels).map((entry) => (
              <li key={entry.key}>
                <span class="swatch" style={{ background: entry.swatch }} />
                {entry.name} {entry.count}
              </li>
            ))}
          </ul>
        </header>
        <nav>
          <a href={href(addWeeks(week, -1))}>← Semana anterior</a>
          {week < currentWeek && <a href={href(addWeeks(week, 1))}>Semana siguiente →</a>}
        </nav>
        {days.length === 0 && <p class="empty">Sin tareas terminadas esta semana.</p>}
        {days.map((day) => (
          <section key={day.date}>
            <h2>{dayHeading(day.date, props.today)}</h2>
            {day.cards.map((card) => (
              <ReportCard key={card.id} card={card} label={labelOf(card)} />
            ))}
          </section>
        ))}
        {props.active && (
          <section>
            <h2>En curso</h2>
            {props.active.length === 0 && <p class="empty">Nada en curso.</p>}
            {props.active.map((card) => (
              <ReportCard key={card.id} card={card} label={labelOf(card)} />
            ))}
          </section>
        )}
      </main>
    </Document>
  );
}
