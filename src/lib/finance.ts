import { clampDateToMonth, getDaysInMonth, getTodayISO, isDateInMonth } from "./date";
import { round2 } from "./money";
import type { DistributionSettings, ForecastResult, Transaction } from "../types/models";

interface BuildForecastInput {
  month: string;
  startBalance: number;
  transactions: Transaction[];
  distribution: DistributionSettings;
}

function diffDaysInclusive(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const msPerDay = 1000 * 60 * 60 * 24;

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    return 0;
  }

  return Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
}

function resolveReferenceDate(month: string, distribution: DistributionSettings): string | null {
  const days = getDaysInMonth(month);
  if (!days.length) {
    return null;
  }

  if (distribution.mode === "fromStart") {
    return days[0];
  }

  if (distribution.mode === "fromDate") {
    return clampDateToMonth(distribution.fromDate ?? days[0], month);
  }

  const today = getTodayISO();
  if (today >= days[0] && today <= days[days.length - 1]) {
    return today;
  }

  return days[0];
}

function applyIncomeToRows(rows: Map<string, { income: number; expense: number }>, tx: Transaction, monthDays: string[]): void {
  if (tx.type !== "income") {
    return;
  }

  const spread = tx.spread;
  if (spread?.enabled) {
    const totalDays = diffDaysInclusive(spread.startDate, spread.endDate);
    if (!totalDays) {
      return;
    }

    const perDay = tx.amount / totalDays;
    for (const day of monthDays) {
      if (day >= spread.startDate && day <= spread.endDate) {
        const row = rows.get(day);
        if (row) {
          row.income += perDay;
        }
      }
    }
    return;
  }

  if (monthDays.length > 0 && isDateInMonth(tx.date, monthDays[0].slice(0, 7))) {
    const row = rows.get(tx.date);
    if (row) {
      row.income += tx.amount;
    }
  }
}

function applyExpenseToRows(rows: Map<string, { income: number; expense: number }>, tx: Transaction, month: string): void {
  if (tx.type !== "expense") {
    return;
  }

  if (!isDateInMonth(tx.date, month)) {
    return;
  }

  const row = rows.get(tx.date);
  if (row) {
    row.expense += tx.amount;
  }
}

export function buildForecast(input: BuildForecastInput): ForecastResult {
  const monthDays = getDaysInMonth(input.month);
  if (monthDays.length === 0) {
    return {
      rows: [],
      totalIncome: 0,
      totalExpense: 0,
      availableFunds: round2(input.startBalance),
      endBalance: round2(input.startBalance),
      distBase: null,
      dailyLimit: null,
      referenceDate: null
    };
  }

  const rowsMap = new Map<string, { income: number; expense: number }>();
  monthDays.forEach((day) => rowsMap.set(day, { income: 0, expense: 0 }));

  for (const tx of input.transactions) {
    applyIncomeToRows(rowsMap, tx, monthDays);
    applyExpenseToRows(rowsMap, tx, input.month);
  }

  const rows: ForecastResult["rows"] = [];
  monthDays.forEach((date, index) => {
    const source = rowsMap.get(date) ?? { income: 0, expense: 0 };
    const income = round2(source.income);
    const expense = round2(source.expense);
    const prevEnd = index === 0 ? round2(input.startBalance) : rows[index - 1].balanceEnd;
    const balanceStart = prevEnd;
    const balanceEnd = round2(balanceStart + income - expense);

    rows.push({
      date,
      income,
      expense,
      balanceStart,
      balanceEnd,
      dailyLimit: null,
      projectedEnd: null
    });
  });

  const totalIncome = round2(rows.reduce((acc, row) => acc + row.income, 0));
  const totalExpense = round2(rows.reduce((acc, row) => acc + row.expense, 0));
  const availableFunds = round2(input.startBalance + totalIncome - totalExpense);

  let distBase: number | null = null;
  let dailyLimit: number | null = null;
  let referenceDate: string | null = null;

  if (input.distribution.enabled && rows.length > 0) {
    referenceDate = resolveReferenceDate(input.month, input.distribution);
    const refIndex = rows.findIndex((row) => row.date === referenceDate);

    if (refIndex >= 0) {
      const rowsFromReference = rows.slice(refIndex);
      const balanceAtRef = rows[refIndex].balanceStart;
      const futureIncome = rowsFromReference.reduce((acc, row) => acc + row.income, 0);
      const futureExpense = rowsFromReference.reduce((acc, row) => acc + row.expense, 0);

      distBase = round2(balanceAtRef + futureIncome - futureExpense);
      const daysLeft = rowsFromReference.length;
      dailyLimit = daysLeft > 0 ? round2(distBase / daysLeft) : null;

      if (dailyLimit !== null) {
        for (let i = refIndex; i < rows.length; i += 1) {
          const dayOffset = i - refIndex + 1;
          rows[i].dailyLimit = dailyLimit;
          rows[i].projectedEnd = round2(distBase - dailyLimit * dayOffset);
        }
      }
    }
  }

  return {
    rows,
    totalIncome,
    totalExpense,
    availableFunds,
    endBalance: rows.length > 0 ? rows[rows.length - 1].balanceEnd : round2(input.startBalance),
    distBase,
    dailyLimit,
    referenceDate
  };
}
