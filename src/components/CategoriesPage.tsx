import { useMemo, useState } from "react";
import { isDateInMonth } from "../lib/date";
import { formatMoney } from "../lib/money";
import type { Transaction, TransactionType } from "../types/models";

interface CategoriesPageProps {
  month: string;
  categories: Record<TransactionType, string[]>;
  transactions: Transaction[];
  onAddCategory: (type: TransactionType, category: string) => boolean;
  onDeleteCategory: (type: TransactionType, category: string) => void;
}

export function CategoriesPage({ month, categories, transactions, onAddCategory, onDeleteCategory }: CategoriesPageProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [name, setName] = useState("");

  const rows = useMemo(() => {
    const list: Array<{ type: TransactionType; category: string; total: number }> = [];

    for (const type of ["expense", "income"] as const) {
      for (const category of categories[type]) {
        const total = transactions.reduce((acc, tx) => {
          if (tx.type !== type || tx.category !== category || !isDateInMonth(tx.date, month)) {
            return acc;
          }
          return acc + tx.amount;
        }, 0);

        list.push({ type, category, total });
      }
    }

    return list.sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  }, [categories, transactions, month]);

  const add = () => {
    const ok = onAddCategory(type, name);
    if (ok) {
      setName("");
    }
  };

  return (
    <section className="panel">
      <div className="toolbar">
        <label className="field compact">
          <span>Тип</span>
          <select value={type} onChange={(event) => setType(event.target.value as TransactionType)}>
            <option value="income">Доходы</option>
            <option value="expense">Расходы</option>
          </select>
        </label>
        <label className="field">
          <span>Новая категория</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например: Кафе" />
        </label>
        <button type="button" className="btn" onClick={add}>
          + Добавить категорию
        </button>
      </div>

      <h3 className="categories-title">Категории за выбранный месяц</h3>
      <div className="categories-list-vertical">
        {rows.map((row) => (
          <article key={`${row.type}:${row.category}`} className="category-row">
            <div>
              <p className="tx-meta">
                <span className={row.type === "income" ? "positive" : "negative"}>
                  {row.type === "income" ? "Доходы" : "Расходы"}
                </span>
                <span>{row.category}</span>
              </p>
              <strong>{formatMoney(row.total)}</strong>
            </div>
            <button
              type="button"
              className="btn danger"
              onClick={() => onDeleteCategory(row.type, row.category)}
            >
              Удалить
            </button>
          </article>
        ))}
        {rows.length === 0 && <p className="empty">Категорий пока нет.</p>}
      </div>
    </section>
  );
}
