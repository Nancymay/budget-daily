import { addDays, clampDateToPeriod, diffDays, getDaysInRange, getTodayISO, isDateInPeriod, type Period } from "./date";
import { round2 } from "./money";
import type { DistributionSettings, ForecastResult, OpeningBalance, Transaction } from "../types/models";

interface BuildForecastInput {
  period: Period;
  startBalance: number;
  transactions: Transaction[];
  distribution: DistributionSettings;
}

/**
 * Amount (in kopecks) a transaction contributes on each day it touches.
 * A spread income is split evenly in whole kopecks; the remainder goes to its
 * last day so the parts add up to the exact amount.
 */
function forEachDayPart(tx: Transaction, from: string, to: string, visit: (day: string, cents: number) => void): void {
  const totalCents = Math.round(tx.amount * 100);
  const spread = tx.type === "income" ? tx.spread : undefined;

  if (!spread?.enabled) {
    if (tx.date >= from && tx.date <= to) {
      visit(tx.date, totalCents);
    }
    return;
  }

  const totalDays = diffDays(spread.startDate, spread.endDate) + 1;
  if (totalDays <= 0) {
    return;
  }
  const perDay = Math.floor(totalCents / totalDays);
  const lastDay = totalCents - perDay * (totalDays - 1);
  const start = spread.startDate > from ? spread.startDate : from;
  const end = spread.endDate < to ? spread.endDate : to;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    visit(day, day === spread.endDate ? lastDay : perDay);
  }
}

/** Balance at the start of `date`, carried forward (or back) from the opening balance. */
export function balanceAt(date: string, opening: OpeningBalance, transactions: Transaction[]): number {
  if (date === opening.date) {
    return round2(opening.amount);
  }
  const forward = date > opening.date;
  const from = forward ? opening.date : date;
  const to = addDays(forward ? date : opening.date, -1);

  let netCents = 0;
  for (const tx of transactions) {
    forEachDayPart(tx, from, to, (_, cents) => {
      netCents += tx.type === "income" ? cents : -cents;
    });
  }
  return round2(opening.amount + (forward ? netCents : -netCents) / 100);
}

function resolveReferenceDate(period: Period, distribution: DistributionSettings): string {
  if (distribution.mode === "fromStart") {
    return period.start;
  }
  if (distribution.mode === "fromDate") {
    return clampDateToPeriod(distribution.fromDate ?? period.start, period);
  }
  const today = getTodayISO();
  return isDateInPeriod(today, period) ? today : period.start;
}

interface LimitSegment {
  from: number;
  to: number;
  limit: number;
  shortfall: number;
}

function floor2(value: number): number {
  return Math.floor(value * 100 + 1e-6) / 100;
}

/**
 * Splits the days from `startIndex` into stretches with an even daily limit so
 * that the balance never goes below zero: money that arrives later is never
 * spent before it arrives. Each stretch ends where the cash runs tightest
 * (typically the day before the next income). Where even spending nothing
 * leaves the balance negative, the limit is 0 and the gap is the shortfall.
 */
function splitIntoLimitSegments(net: number[], startIndex: number, startBalance: number): LimitSegment[] {
  const segments: LimitSegment[] = [];
  let cash = startBalance;
  let i = startIndex;

  while (i < net.length) {
    let cumulative = cash;
    let tightest = Infinity;
    let tightestAt = i;
    let lastNegative = -1;
    let lowest = Infinity;
    for (let j = i; j < net.length; j += 1) {
      cumulative += net[j];
      const perDay = cumulative / (j - i + 1);
      if (perDay <= tightest) {
        tightest = perDay;
        tightestAt = j;
      }
      if (cumulative < -0.005) {
        lastNegative = j;
      }
      lowest = Math.min(lowest, cumulative);
    }

    if (tightest >= 0) {
      const limit = floor2(tightest);
      let spent = cash;
      for (let j = i; j <= tightestAt; j += 1) {
        spent += net[j] - limit;
      }
      segments.push({ from: i, to: tightestAt, limit, shortfall: 0 });
      cash = spent;
      i = tightestAt + 1;
    } else {
      // Not enough money even when spending nothing: hold at 0 until the
      // balance recovers for good.
      let atEnd = cash;
      for (let j = i; j <= lastNegative; j += 1) {
        atEnd += net[j];
      }
      segments.push({ from: i, to: lastNegative, limit: 0, shortfall: round2(-lowest) });
      cash = atEnd;
      i = lastNegative + 1;
    }
  }

  return segments;
}

export function buildForecast(input: BuildForecastInput): ForecastResult {
  const days = getDaysInRange(input.period);

  const totals = new Map<string, { income: number; expense: number }>();
  days.forEach((day) => totals.set(day, { income: 0, expense: 0 }));
  for (const tx of input.transactions) {
    forEachDayPart(tx, input.period.start, input.period.end, (day, cents) => {
      const row = totals.get(day);
      if (row) {
        row[tx.type] += cents;
      }
    });
  }

  const rows: ForecastResult["rows"] = [];
  days.forEach((date, index) => {
    const source = totals.get(date) ?? { income: 0, expense: 0 };
    const income = source.income / 100;
    const expense = source.expense / 100;
    const balanceStart = index === 0 ? round2(input.startBalance) : rows[index - 1].balanceEnd;
    rows.push({
      date,
      income,
      expense,
      balanceStart,
      balanceEnd: round2(balanceStart + income - expense),
      dailyLimit: null,
      projectedEnd: null
    });
  });

  const totalIncome = round2(rows.reduce((acc, row) => acc + row.income, 0));
  const totalExpense = round2(rows.reduce((acc, row) => acc + row.expense, 0));
  const endBalance = rows.length > 0 ? rows[rows.length - 1].balanceEnd : round2(input.startBalance);

  const referenceDate = resolveReferenceDate(input.period, input.distribution);
  const refIndex = rows.findIndex((row) => row.date === referenceDate);

  let distBase: number | null = null;
  let dailyLimit: number | null = null;
  let limitUntil: string | null = null;
  let nextLimit: ForecastResult["nextLimit"] = null;
  let shortfall = 0;

  if (refIndex >= 0) {
    const net = rows.map((row) => row.income - row.expense);
    const startCash = rows[refIndex].balanceStart;
    distBase = round2(startCash + net.slice(refIndex).reduce((acc, value) => acc + value, 0));

    const segments = splitIntoLimitSegments(net, refIndex, startCash);
    let projected = startCash;
    for (const segment of segments) {
      for (let i = segment.from; i <= segment.to; i += 1) {
        projected += net[i] - segment.limit;
        rows[i].dailyLimit = segment.limit;
        rows[i].projectedEnd = round2(projected);
      }
    }

    const [current, next] = segments;
    if (current) {
      dailyLimit = current.limit;
      limitUntil = rows[current.to].date;
      shortfall = current.shortfall;
    }
    if (next) {
      nextLimit = { from: rows[next.from].date, limit: next.limit };
    }
  }

  return {
    rows,
    totalIncome,
    totalExpense,
    availableFunds: endBalance,
    endBalance,
    distBase,
    dailyLimit,
    limitUntil,
    nextLimit,
    shortfall,
    referenceDate
  };
}
