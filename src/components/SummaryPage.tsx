import { useMemo } from "react";
import { getTodayISO, isDateInPeriod, type Period } from "../lib/date";
import { dayMonthShort, num } from "../lib/format";
import { resolveCategoryStyle } from "../lib/categoryStyle";
import { CategoryBadge } from "./ui/CategoryBadge";
import type { CategoryStyle, ForecastResult, Transaction, TransactionType } from "../types/models";

interface SummaryPageProps {
  period: Period;
  forecast: ForecastResult;
  transactions: Transaction[];
  styles: Record<string, CategoryStyle>;
}

function byCategory(transactions: Transaction[], period: Period, type: TransactionType) {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === type && isDateInPeriod(tx.date, period)) {
      map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount);
    }
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export function SummaryPage({ period, forecast, transactions, styles }: SummaryPageProps) {
  const { totalIncome, totalExpense } = forecast;
  const net = totalIncome - totalExpense;
  const scale = Math.max(totalIncome, totalExpense, 1);

  const expenses = useMemo(() => byCategory(transactions, period, "expense"), [transactions, period]);
  const incomes = useMemo(() => byCategory(transactions, period, "income"), [transactions, period]);
  const expenseSum = expenses.reduce((acc, item) => acc + item.amount, 0);

  const today = getTodayISO();
  const daysSoFar = forecast.rows.filter((row) => row.date <= today).length || forecast.rows.length;
  const avgPerDay = daysSoFar > 0 ? totalExpense / daysSoFar : 0;

  const peak = useMemo(() => {
    const top = forecast.rows.reduce<(typeof forecast.rows)[number] | null>(
      (best, row) => (row.expense > (best?.expense ?? 0) ? row : best),
      null
    );
    if (!top) {
      return null;
    }
    const mainTx = transactions
      .filter((tx) => tx.type === "expense" && tx.date === top.date)
      .sort((a, b) => b.amount - a.amount)[0];
    return { date: top.date, amount: top.expense, category: mainTx?.category };
  }, [forecast.rows, transactions]);

  return (
    <div className="page">
      <section className="result">
        <span className="result-label">Чистый результат периода</span>
        <span className={`result-value${net < 0 ? " is-negative" : ""}`}>
          {net >= 0 ? "+" : "−"}
          {num(Math.abs(net))} ₽
        </span>
        <div className="result-bars">
          <div>
            <div className="result-row">
              <span>Доходы</span>
              <span>{num(totalIncome)} ₽</span>
            </div>
            <div className="result-track">
              <div className="result-fill result-fill--in" style={{ width: `${(totalIncome / scale) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="result-row">
              <span>Расходы</span>
              <span>{num(totalExpense)} ₽</span>
            </div>
            <div className="result-track">
              <div className="result-fill result-fill--out" style={{ width: `${(totalExpense / scale) * 100}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="card card--pad">
        <div className="section-head section-head--row">
          <h2 className="section-title">Куда ушли деньги</h2>
          <span className="section-hint">{num(expenseSum)} ₽</span>
        </div>
        {expenses.length > 0 ? (
          <>
            <div
              className="stack"
              role="img"
              aria-label={`Доли расходов: ${expenses
                .map((item) => `${item.category} ${Math.round((item.amount / expenseSum) * 100)}%`)
                .join(", ")}`}
            >
              {expenses.map((item) => (
                <div
                  key={item.category}
                  style={{
                    flexGrow: item.amount,
                    background: resolveCategoryStyle(item.category, "expense", styles).solid
                  }}
                />
              ))}
            </div>
            <div className="legend">
              {expenses.map((item) => (
                <div key={item.category} className="legend-row">
                  <span className="legend-dot" style={{ background: resolveCategoryStyle(item.category, "expense", styles).solid }} />
                  <span className="legend-name">{item.category}</span>
                  <span className="legend-pct">{Math.round((item.amount / expenseSum) * 100)}%</span>
                  <span className="legend-sum">{num(item.amount)} ₽</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="empty">Расходов за этот период нет.</p>
        )}
      </section>

      {incomes.length > 0 && (
        <section className="card card--pad">
          <h2 className="section-title">Доходы</h2>
          {incomes.map((item) => (
            <div key={item.category} className="income-row">
              <CategoryBadge look={resolveCategoryStyle(item.category, "income", styles)} />
              <span className="income-name">{item.category}</span>
              <span className="income-sum">+{num(item.amount)} ₽</span>
            </div>
          ))}
        </section>
      )}

      <div className="tiles tiles--two">
        <div className="tile tile--violet">
          <span className="tile-label">В среднем в день</span>
          <span className="tile-value">{num(avgPerDay)} ₽</span>
          <span className="tile-sub">за {daysSoFar} дн.</span>
        </div>
        <div className="tile">
          <span className="tile-label">Самый дорогой день</span>
          <span className="tile-value">{peak ? dayMonthShort(peak.date) : "—"}</span>
          {peak && (
            <span className="tile-sub">
              {num(peak.amount)} ₽{peak.category ? ` · ${peak.category.toLowerCase()}` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
