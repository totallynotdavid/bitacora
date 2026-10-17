/** @jsxImportSource hono/jsx */
import { addWeeks, dayHeading, weekRangeLabel } from "../../shared/dates";
import { LABEL_STYLES, type Card, type Label } from "../../shared/model";
import { Document } from "./layout";

const REPORT_CSS = `
body { background: #fff; }
main { max-width: 760px; margin: 0 auto; padding: 32px 24px 64px; }
header h1 { margin: 0; font-size: 24px; line-height: 32px; font-weight: 650; color: rgb(23 43 77); }
.owner { margin: 0; color: rgb(80 82 88); }
.counts { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 0; padding: 0; list-style: none; }
.counts li { display: flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 999px;
  background: rgb(241 242 244); font-weight: 600; }
.swatch { width: 10px; height: 10px; border-radius: 3px; }
nav { display: flex; justify-content: space-between; margin-top: 16px; }
nav a { color: #1868db; text-decoration: none; font-weight: 500; }
nav a:hover { text-decoration: underline; }
section { margin-top: 32px; }
h2 { margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1px solid rgb(9 30 66 / .14); font-size: 16px;
  line-height: 24px; font-weight: 650; color: rgb(23 43 77); }
h2::first-letter { text-transform: uppercase; }
article { padding: 8px 0 8px 12px; border-left: 4px solid; break-inside: avoid; margin-bottom: 8px; }
article h3 { margin: 0; font-size: 14px; font-weight: 600; }
.meta { margin: 0; color: rgb(80 82 88); font-size: 12px; line-height: 16px; }
.description { margin: 4px 0 0; white-space: pre-wrap; }
.empty { color: rgb(80 82 88); }
@page { size: A4; margin: 16mm; }
@media print {
  main { max-width: none; padding: 0; }
  nav { display: none; }
  * { box-shadow: none !important; }
  a { color: inherit; text-decoration: none; }
  .counts li { border: 1px solid rgb(9 30 66 / .3); background: none; }
  section { margin-top: 20px; }
}
`;

const NO_LABEL_BORDER = "rgb(9 30 66 / .25)";

function ReportCard(props: { card: Card; label: Label | undefined }) {
  const { card, label } = props;
  const meta = [label?.name, card.requester].filter(Boolean).join(" · ");
  return (
    <article style={{ borderColor: label ? LABEL_STYLES[label.color].background : NO_LABEL_BORDER }}>
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
      swatch: LABEL_STYLES[label.color].background,
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
