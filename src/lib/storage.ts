import { getCurrentMonth } from "./date";
import type { AppState, Transaction, TransactionType } from "../types/models";

const STORAGE_KEY = "budget-daily.v1";

const BASE_CATEGORIES: Record<TransactionType, string[]> = {
  income: ["Salary", "Freelance", "Gift", "Cashback", "Other"],
  expense: ["Food", "Rent", "Transport", "Health", "Fun", "Other"]
};

function isTransactionType(value: unknown): value is TransactionType {
  return value === "income" || value === "expense";
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
      spread: candidate.spread
    });

    return acc;
  }, []);
}

export function getBaseCategories(): Record<TransactionType, string[]> {
  return BASE_CATEGORIES;
}

export function getDefaultState(): AppState {
  const month = getCurrentMonth();
  return {
    settings: {
      month,
      startBalanceByMonth: { [month]: 0 },
      distribution: {
        enabled: false,
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

export function loadState(): AppState {
  const fallback = getDefaultState();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<AppState>;

    const month = parsed.settings?.month ?? fallback.settings.month;
    const startBalanceByMonth = parsed.settings?.startBalanceByMonth ?? {};

    return {
      settings: {
        month,
        startBalanceByMonth,
        distribution: {
          enabled: Boolean(parsed.settings?.distribution?.enabled),
          mode: parsed.settings?.distribution?.mode ?? "fromToday",
          fromDate: parsed.settings?.distribution?.fromDate
        },
        customCategories: {
          income: parsed.settings?.customCategories?.income ?? [],
          expense: parsed.settings?.customCategories?.expense ?? []
        }
      },
      transactions: sanitizeTransactions(parsed.transactions)
    };
  } catch {
    return fallback;
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
