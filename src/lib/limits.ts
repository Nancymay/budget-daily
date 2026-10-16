import { getDaysInRange, type Period } from "./date";

function daysInMonthOf(date: string): number {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * A monthly limit scaled to an arbitrary period: each day of the period gets
 * 1/N of the limit of the month it belongs to (N = days in that month). A full
 * calendar month gives exactly the monthly limit; a pay period spanning two
 * months takes its share from each. Rounded to whole roubles.
 */
export function limitForPeriod(monthlyLimit: number, period: Period): number {
  const share = getDaysInRange(period).reduce((acc, day) => acc + 1 / daysInMonthOf(day), 0);
  return Math.round(monthlyLimit * share);
}

export type LimitStatus = "ok" | "warning" | "over";

/** Yellow from 80% of the limit, red once it is exceeded. */
export function getLimitStatus(spent: number, limit: number): LimitStatus {
  if (spent > limit) {
    return "over";
  }
  return spent >= limit * 0.8 ? "warning" : "ok";
}
