/** Inclusive date range of one budget period, e.g. from one payday to the day before the next. */
export interface Period {
  start: string;
  end: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseISO(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

// Local calendar date (toISOString() would give the UTC date, which is
// "yesterday" for users east of UTC shortly after midnight).
export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: string, days: number): string {
  return toISO(new Date(parseISO(date).getTime() + days * MS_PER_DAY));
}

export function diffDays(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / MS_PER_DAY);
}

export function getDaysInRange(period: Period): string[] {
  const result: string[] = [];
  for (let day = period.start; day <= period.end; day = addDays(day, 1)) {
    result.push(day);
  }
  return result;
}

export function isDateInPeriod(date: string, period: Period): boolean {
  return date >= period.start && date <= period.end;
}

export function clampDateToPeriod(date: string, period: Period): string {
  if (date < period.start) {
    return period.start;
  }
  if (date > period.end) {
    return period.end;
  }
  return date;
}

/**
 * The actual payment date for a nominal payday: a day past the end of a short
 * month becomes its last day, and Saturday/Sunday move back to Friday.
 */
export function getPayDate(year: number, month: number, day: number): string {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const date = new Date(Date.UTC(year, month - 1, Math.min(day, daysInMonth)));
  const weekday = date.getUTCDay();
  if (weekday === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  } else if (weekday === 0) {
    date.setUTCDate(date.getUTCDate() - 2);
  }
  return toISO(date);
}

function calendarMonthOf(date: string): Period {
  const [year, month] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${date.slice(0, 7)}-01`, end: `${date.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

/** The pay period containing `date`. Without paydays, falls back to the calendar month. */
export function getPeriodFor(date: string, payDays: number[]): Period {
  if (payDays.length === 0) {
    return calendarMonthOf(date);
  }

  const [year, month] = date.split("-").map(Number);
  const candidates = new Set<string>();
  for (let offset = -2; offset <= 2; offset += 1) {
    const d = new Date(Date.UTC(year, month - 1 + offset, 1));
    for (const day of payDays) {
      candidates.add(getPayDate(d.getUTCFullYear(), d.getUTCMonth() + 1, day));
    }
  }
  const sorted = [...candidates].sort();
  const start = [...sorted].reverse().find((item) => item <= date) ?? sorted[0];
  const next = sorted.find((item) => item > date) ?? addDays(start, 15);
  return { start, end: addDays(next, -1) };
}

export function shiftPeriod(period: Period, direction: -1 | 1, payDays: number[]): Period {
  return getPeriodFor(direction < 0 ? addDays(period.start, -1) : addDays(period.end, 1), payDays);
}

// Today if it falls inside the period, otherwise the period's first day.
export function getDefaultDateForPeriod(period: Period): string {
  const today = getTodayISO();
  return isDateInPeriod(today, period) ? today : period.start;
}

// Whether a transaction affects the given period (by date or by spread range).
export function transactionTouchesPeriod(
  tx: { date: string; spread?: { enabled: boolean; startDate: string; endDate: string } },
  period: Period
): boolean {
  if (tx.spread?.enabled) {
    return tx.spread.startDate <= period.end && tx.spread.endDate >= period.start;
  }
  return isDateInPeriod(tx.date, period);
}

export function toHumanDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

export function toHumanDayMonth(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}.${month}`;
}

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export function toWeekday(date: string): string {
  return WEEKDAYS[parseISO(date).getUTCDay()];
}
