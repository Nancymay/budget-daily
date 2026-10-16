export type TransactionType = "income" | "expense";

export type PeriodMode = "pay" | "month";

export type DistributionMode = "fromStart" | "fromToday" | "fromDate";

export interface IncomeSpread {
  enabled: boolean;
  startDate: string;
  endDate: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  amount: number;
  category: string;
  note?: string;
  spread?: IncomeSpread;
}

export interface DistributionSettings {
  enabled: boolean;
  mode: DistributionMode;
  fromDate?: string;
}

/** Known balance at the start of a given day; balances of all periods are derived from it. */
export interface OpeningBalance {
  date: string;
  amount: number;
}

export interface Settings {
  /** Nominal paydays (1–31); weekends shift to Friday. Empty means calendar months. */
  payDays: number[];
  /** "pay": from payday to payday; "month": calendar months. */
  periodMode: PeriodMode;
  /** Monthly spending limit per expense category; scaled to the period shown. */
  categoryLimits: Record<string, number>;
  opening: OpeningBalance;
  distribution: DistributionSettings;
  customCategories: Record<TransactionType, string[]>;
}

export interface AppState {
  settings: Settings;
  transactions: Transaction[];
}

export interface DailyRow {
  date: string;
  income: number;
  expense: number;
  balanceStart: number;
  balanceEnd: number;
  dailyLimit: number | null;
  projectedEnd: number | null;
}

export interface ForecastResult {
  rows: DailyRow[];
  totalIncome: number;
  totalExpense: number;
  availableFunds: number;
  endBalance: number;
  distBase: number | null;
  dailyLimit: number | null;
  /** Last day the current dailyLimit applies to. */
  limitUntil: string | null;
  /** Limit for the next stretch, once more money arrives. */
  nextLimit: { from: string; limit: number } | null;
  /** Money missing to get to limitUntil without going negative (0 when fine). */
  shortfall: number;
  referenceDate: string | null;
}
