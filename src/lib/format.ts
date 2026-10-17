import { getTodayISO, type Period } from "./date";

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAYS_LONG = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

function parts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
}

/** "17 окт" */
export function dayMonthShort(date: string): string {
  const { month, day } = parts(date);
  return `${day} ${MONTHS_SHORT[month]}`;
}

/** "17 октября" */
export function dayMonthLong(date: string): string {
  const { month, day } = parts(date);
  return `${day} ${MONTHS_GEN[month]}`;
}

export function weekdayLong(date: string): string {
  return WEEKDAYS_LONG[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function dayOfMonth(date: string): string {
  return String(parts(date).day);
}

/** "5 – 19 октября", "25 сентября – 4 октября" or "Октябрь 2026" for a calendar month. */
export function periodLabel(period: Period, isMonth: boolean): string {
  const a = parts(period.start);
  const b = parts(period.end);
  if (isMonth) {
    const thisYear = Number(getTodayISO().slice(0, 4));
    return a.year === thisYear ? MONTHS_NOM[a.month] : `${MONTHS_NOM[a.month]} ${a.year}`;
  }
  if (a.month === b.month) {
    return `${a.day} – ${b.day} ${MONTHS_GEN[b.month]}`;
  }
  return `${a.day} ${MONTHS_GEN[a.month]} – ${b.day} ${MONTHS_GEN[b.month]}`;
}

/** "5 – 19 окт" */
export function periodLabelShort(period: Period): string {
  const a = parts(period.start);
  const b = parts(period.end);
  return a.month === b.month
    ? `${a.day} – ${b.day} ${MONTHS_SHORT[b.month]}`
    : `${a.day} ${MONTHS_SHORT[a.month]} – ${b.day} ${MONTHS_SHORT[b.month]}`;
}

/** Russian plural: plural(3, "день", "дня", "дней") → "дня". */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }
  return many;
}

const wholeNumber = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** "18 740" — whole roubles, no currency sign. Rounds toward zero so an allowance is never overstated. */
export function num(value: number): string {
  return wholeNumber.format(Math.trunc(value)).replace("-", "−");
}

/** "18 740 ₽" (non-breaking space, so the sign never wraps onto its own line) */
export function rub(value: number): string {
  return `${num(value)} ₽`;
}

/** "+85 000 ₽" / "−1 800 ₽" */
export function signedRub(value: number, type: "income" | "expense"): string {
  return `${type === "income" ? "+" : "−"}${num(Math.abs(value))} ₽`;
}

/** Groups the digits of a typed amount as the user types: "85000,5" → "85 000,5". */
export function groupTypedAmount(raw: string): string {
  const clean = raw.replace(/[^\d.,]/g, "").replace(".", ",");
  const [int = "", ...rest] = clean.split(",");
  const grouped = int.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return rest.length ? `${grouped},${rest.join("").slice(0, 2)}` : grouped;
}
