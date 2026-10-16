import { getPeriodFor, getTodayISO } from "./date";
import type { AppState, DistributionMode, IncomeSpread, OpeningBalance, Transaction, TransactionType } from "../types/models";

const STORAGE_KEY = "budget-daily.v1";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const BASE_CATEGORIES: Record<TransactionType, string[]> = {
  income: [],
  expense: []
};

function isTransactionType(value: unknown): value is TransactionType {
  return value === "income" || value === "expense";
}

function isDistributionMode(value: unknown): value is DistributionMode {
  return value === "fromStart" || value === "fromToday" || value === "fromDate";
}

function sanitizeSpread(input: unknown): IncomeSpread | undefined {
  if (typeof input !== "object" || input === null) {
    return undefined;
  }
  const candidate = input as Partial<IncomeSpread>;
  if (
    !candidate.enabled ||
    typeof candidate.startDate !== "string" ||
    typeof candidate.endDate !== "string" ||
    !ISO_DATE.test(candidate.startDate) ||
    !ISO_DATE.test(candidate.endDate) ||
    candidate.endDate < candidate.startDate
  ) {
    return undefined;
  }
  return { enabled: true, startDate: candidate.startDate, endDate: candidate.endDate };
}

function sanitizeStringList(input: unknown): string[] {
  return Array.isArray(input) ? input.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

function sanitizeBalances(input: unknown): Record<string, number> {
  if (typeof input !== "object" || input === null) {
    return {};
  }
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    const amount = Number(value);
    if (/^\d{4}-\d{2}$/.test(key) && Number.isFinite(amount)) {
      result[key] = amount;
    }
  }
  return result;
}

function sanitizeTransactions(input: unknown): Transaction[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.reduce<Transaction[]>((acc, item) => {
    if (typeof item !== "object" || item === null) {
      return acc;
    }

    const candidate = item as Partial<Transaction>;
    if (
      typeof candidate.id !== "string" ||
      !isTransactionType(candidate.type) ||
      typeof candidate.date !== "string" ||
      !ISO_DATE.test(candidate.date) ||
      typeof candidate.category !== "string"
    ) {
      return acc;
    }

    const amount = Number(candidate.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return acc;
    }

    acc.push({
      id: candidate.id,
      type: candidate.type,
      date: candidate.date,
      amount,
      category: candidate.category,
      note: typeof candidate.note === "string" ? candidate.note : "",
      spread: candidate.type === "income" ? sanitizeSpread(candidate.spread) : undefined
    });

    return acc;
  }, []);
}

export const DEFAULT_PAY_DAYS = [5, 20];

function sanitizePayDays(input: unknown): number[] | null {
  if (!Array.isArray(input)) {
    return null;
  }
  const days = input.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 31);
  return [...new Set(days)].sort((a, b) => a - b);
}

function sanitizeOpening(input: unknown): OpeningBalance | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as Partial<OpeningBalance>;
  const amount = Number(candidate.amount);
  if (typeof candidate.date !== "string" || !ISO_DATE.test(candidate.date) || !Number.isFinite(amount)) {
    return null;
  }
  return { date: candidate.date, amount };
}

// Older versions stored a manual start balance per calendar month. The latest
// non-zero one becomes the anchor; everything else is carried over from it.
function migrateMonthBalances(input: unknown, payDays: number[]): OpeningBalance {
  const balances = sanitizeBalances(input);
  const latest = Object.keys(balances)
    .filter((month) => balances[month] !== 0)
    .sort()
    .pop();
  if (latest) {
    return { date: `${latest}-01`, amount: balances[latest] };
  }
  const earliest = Object.keys(balances).sort()[0];
  if (earliest) {
    return { date: `${earliest}-01`, amount: 0 };
  }
  return { date: getPeriodFor(getTodayISO(), payDays).start, amount: 0 };
}

export function getBaseCategories(): Record<TransactionType, string[]> {
  return BASE_CATEGORIES;
}

export function getDefaultState(): AppState {
  return {
    settings: {
      payDays: DEFAULT_PAY_DAYS,
      periodMode: "pay",
      opening: { date: getPeriodFor(getTodayISO(), DEFAULT_PAY_DAYS).start, amount: 0 },
      distribution: {
        enabled: true,
        mode: "fromToday"
      },
      customCategories: {
        income: [],
        expense: []
      }
    },
    transactions: []
  };
}

/** Validates arbitrary parsed JSON and turns it into a safe AppState. */
export function normalizeState(parsed: Partial<AppState>): AppState {
  const fallback = getDefaultState();
  const settings = parsed.settings as (AppState["settings"] & { startBalanceByMonth?: unknown }) | undefined;
  const payDays = sanitizePayDays(settings?.payDays) ?? fallback.settings.payDays;
  const opening = sanitizeOpening(settings?.opening) ?? migrateMonthBalances(settings?.startBalanceByMonth, payDays);
  const mode = isDistributionMode(settings?.distribution?.mode) ? settings.distribution.mode : "fromToday";
  const fromDate = settings?.distribution?.fromDate;

  return {
    settings: {
      payDays,
      periodMode: settings?.periodMode === "month" ? "month" : "pay",
      opening,
      distribution: {
        enabled: true,
        mode,
        fromDate: typeof fromDate === "string" && ISO_DATE.test(fromDate) ? fromDate : undefined
      },
      customCategories: {
        income: sanitizeStringList(settings?.customCategories?.income),
        expense: sanitizeStringList(settings?.customCategories?.expense)
      }
    },
    transactions: sanitizeTransactions(parsed.transactions)
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultState();
    }
    return normalizeState(JSON.parse(raw) as Partial<AppState>);
  } catch {
    return getDefaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private mode) — nothing more we can do here.
  }
}

/** Parses a backup file's text. Throws a user-readable error when it isn't a backup. */
export function parseBackup(text: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Файл не похож на резервную копию (это не JSON).");
  }
  if (typeof parsed !== "object" || parsed === null || !("transactions" in parsed) || !("settings" in parsed)) {
    throw new Error("В файле нет данных Budget Daily.");
  }
  return normalizeState(parsed as Partial<AppState>);
}
