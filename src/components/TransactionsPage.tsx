import { useMemo, useState } from "react";
import { formatMoney } from "../lib/money";
import { toHumanDate } from "../lib/date";
import type { Transaction, TransactionType } from "../types/models";

interface TransactionsPageProps {
  transactions: Transaction[];
  categories: Record<TransactionType, string[]>;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TransactionsPage({ transactions, categories, onAdd, onEdit, onDelete }: TransactionsPageProps) {
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const availableCategories = useMemo(() => {
    if (typeFilter === "all") {
      return [...new Set([...categories.income, ...categories.expense])];
    }
    return categories[typeFilter];
  }, [categories, typeFilter]);

  const filtered = useMemo(() => {
    return transactions
      .filter((tx) => (typeFilter === "all" ? true : tx.type === typeFilter))
      .filter((tx) => (categoryFilter === "all" ? true : tx.category === categoryFilter))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [transactions, typeFilter, categoryFilter]);

  return (
    <section className="panel">
      <div className="toolbar">
        <label className="field compact">
          <span>Тип</span>
          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as "all" | TransactionType);
              setCategoryFilter("all");
            }}
          >
            <option value="all">Все</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>

        <label className="field compact">
          <span>Категория</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Все</option>
            {availableCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="btn" onClick={onAdd}>
          + Добавить
        </button>
      </div>

      <div className="transactions-list">
        {filtered.map((tx) => (
          <article key={tx.id} className="tx-card">
            <div>
              <p className="tx-meta">
                <span className={tx.type === "income" ? "positive" : "negative"}>{tx.type}</span>
                <span>{toHumanDate(tx.date)}</span>
                <span>{tx.category}</span>
              </p>
              <h4>{formatMoney(tx.amount)}</h4>
              {tx.note && <p className="tx-note">{tx.note}</p>}
              {tx.type === "income" && tx.spread?.enabled && (
                <p className="tx-note">Распределение: {toHumanDate(tx.spread.startDate)} - {toHumanDate(tx.spread.endDate)}</p>
              )}
            </div>
            <div className="actions">
              <button type="button" className="btn secondary" onClick={() => onEdit(tx.id)}>
                Изменить
              </button>
              <button type="button" className="btn danger" onClick={() => onDelete(tx.id)}>
                Удалить
              </button>
            </div>
          </article>
        ))}
        {filtered.length === 0 && <p className="empty">Транзакций по фильтру нет.</p>}
      </div>
    </section>
  );
}
