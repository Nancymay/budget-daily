export function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
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
