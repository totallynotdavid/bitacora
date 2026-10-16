const DAY_MS = 86_400_000;

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

const limaFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar date in Lima, `YYYY-MM-DD`. */
export function limaDate(instant: Date): string {
  return limaFormat.format(instant);
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(utc: Date): string {
  return utc.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS));
}

function mondayOffset(utc: Date): number {
  return (utc.getUTCDay() + 6) % 7;
}

/** ISO 8601 week id such as `2026-W42`. Weeks run Monday to Sunday. */
export function weekOf(date: string): string {
  const utc = toUtc(date);
  const thursday = new Date(utc.getTime() + (3 - mondayOffset(utc)) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.floor((thursday.getTime() - jan1) / (7 * DAY_MS)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function weekStart(week: string): string {
  const [year, number] = week.split("-W").map(Number) as [number, number];
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = jan4.getTime() - mondayOffset(jan4) * DAY_MS;
  return fromUtc(new Date(monday + (number - 1) * 7 * DAY_MS));
}

export function weekDays(week: string): string[] {
  const start = weekStart(week);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Returns the week id when it names a real ISO week, otherwise null. */
export function parseWeek(value: string | undefined): string | null {
  if (!value || !/^\d{4}-W\d{2}$/.test(value)) return null;
  return weekOf(weekStart(value)) === value ? value : null;
}

export function addWeeks(week: string, count: number): string {
  return weekOf(addDays(weekStart(week), count * 7));
}

function dayLabel(date: string): string {
  const utc = toUtc(date);
  return `${WEEKDAYS[utc.getUTCDay()]} ${utc.getUTCDate()} ${MONTHS[utc.getUTCMonth()]}`;
}

export function dayHeading(date: string, today: string): string {
  if (date === today) return `Hoy, ${dayLabel(date)}`;
  if (date === addDays(today, -1)) return `Ayer, ${dayLabel(date)}`;
  return dayLabel(date);
}

function datePart(d: Date, withMonth: boolean, withYear: boolean): string {
  return [d.getUTCDate(), withMonth && MONTHS[d.getUTCMonth()], withYear && d.getUTCFullYear()]
    .filter(Boolean)
    .join(" ");
}

export function weekRangeLabel(week: string): string {
  const days = weekDays(week);
  const [first, last] = [toUtc(days[0]!), toUtc(days[6]!)];
  const crossesYear = first.getUTCFullYear() !== last.getUTCFullYear();
  const crossesMonth = first.getUTCMonth() !== last.getUTCMonth();
  return `${datePart(first, crossesMonth || crossesYear, crossesYear)} – ${datePart(last, true, true)}`;
}
