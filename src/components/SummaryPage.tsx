import { useMemo } from "react";
import { isDateInMonth } from "../lib/date";
import { formatMoney } from "../lib/money";
import type { Transaction } from "../types/models";

interface SummaryPageProps {
  month: string;
  transactions: Transaction[];
}

export function SummaryPage({ month, transactions }: SummaryPageProps) {
  const slices = useMemo(() => {
    const byCategory = new Map<string, number>();

    for (const tx of transactions) {
      if (tx.type !== "expense" || !isDateInMonth(tx.date, month)) {
        continue;
      }
      byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
    }

    const list = Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const total = list.reduce((acc, item) => acc + item.amount, 0);
    const palette = ["#ffffff", "#d9d9d9", "#b8b8b8", "#969696", "#777777", "#5d5d5d"];

    return {
      total,
      list: list.map((item, index) => ({
        ...item,
        color: palette[index % palette.length],
        percent: total > 0 ? (item.amount / total) * 100 : 0
      }))
    };
  }, [transactions, month]);

  const pieBackground = useMemo(() => {
    if (slices.list.length === 0) {
      return "conic-gradient(#2a3243 0 100%)";
    }

    let start = 0;
    const chunks = slices.list.map((item) => {
      const end = start + item.percent;
      const chunk = `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
      start = end;
      return chunk;
    });

    return `conic-gradient(${chunks.join(",")})`;
  }, [slices]);

  return (
    <section className="panel">
      <h3 className="categories-title">Итого по расходам за месяц</h3>
      <div className="summary-grid">
        <div className="pie-wrap">
          <div className="pie-chart" style={{ background: pieBackground }} />
          <div className="pie-center">
            <span>Всего</span>
            <strong>{formatMoney(slices.total)}</strong>
          </div>
        </div>

        <div className="categories-list-vertical">
          {slices.list.map((item) => (
            <div key={item.category} className="summary-row">
              <div className="summary-label">
                <span className="dot" style={{ background: item.color }} />
                <span>{item.category}</span>
              </div>
              <div className="summary-values">
                <strong>{formatMoney(item.amount)}</strong>
                <span>{item.percent.toFixed(1)}%</span>
              </div>
            </div>
          ))}
          {slices.list.length === 0 && <p className="empty">Нет расходов за выбранный месяц.</p>}
        </div>
      </div>
    </section>
  );
}
