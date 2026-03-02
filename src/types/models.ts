export type TransactionType = "income" | "expense";

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

export interface Settings {
  month: string;
  startBalanceByMonth: Record<string, number>;
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
  referenceDate: string | null;
}
