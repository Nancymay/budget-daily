// Local calendar date (toISOString() would give the UTC date, which is
// "yesterday" for users east of UTC shortly after midnight).
export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentMonth(): string {
  return getTodayISO().slice(0, 7);
}

// Today if it falls inside the month, otherwise the month's first day.
export function getDefaultDateForMonth(month: string): string {
  const today = getTodayISO();
  return isDateInMonth(today, month) ? today : `${month}-01`;
}

// Whether a transaction affects the given month (by date or by spread range).
export function transactionTouchesMonth(
  tx: { date: string; spread?: { enabled: boolean; startDate: string; endDate: string } },
  month: string
): boolean {
  if (tx.spread?.enabled) {
    return tx.spread.startDate.slice(0, 7) <= month && tx.spread.endDate.slice(0, 7) >= month;
  }
  return isDateInMonth(tx.date, month);
}

export function parseMonthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00`);
}

export function getDaysInMonth(month: string): string[] {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return [];
  }

  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const result: string[] = [];

  for (let day = 1; day <= days; day += 1) {
    result.push(`${month}-${String(day).padStart(2, "0")}`);
  }

  return result;
}

export function isDateInMonth(date: string, month: string): boolean {
  return date.slice(0, 7) === month;
}

export function clampDateToMonth(date: string, month: string): string {
  const days = getDaysInMonth(month);
  if (days.length === 0) {
    return `${month}-01`;
  }

  if (days.includes(date)) {
    return date;
  }

  if (date < days[0]) {
    return days[0];
  }

  return days[days.length - 1];
}

export function toHumanDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

export function toHumanDayMonth(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}.${month}`;
}
