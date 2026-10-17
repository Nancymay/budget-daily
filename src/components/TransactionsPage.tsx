import { useMemo, useState } from "react";
import { getTodayISO, toWeekday, transactionTouchesPeriod, type Period } from "../lib/date";
import { dayMonthShort, num, signedRub } from "../lib/format";
import { resolveCategoryStyle } from "../lib/categoryStyle";
import { CategoryBadge } from "./ui/CategoryBadge";
import { Icon, UI_ICONS } from "./ui/Icon";
import type { CategoryStyle, Transaction, TransactionType } from "../types/models";

interface TransactionsPageProps {
  period: Period;
  transactions: Transaction[];
  categories: Record<TransactionType, string[]>;
  styles: Record<string, CategoryStyle>;
  onEdit: (id: string) => void;
}

type TypeFilter = "all" | TransactionType;

function groupLabel(date: string): string {
  if (date === getTodayISO()) {
    return `Сегодня, ${dayMonthShort(date)}`;
  }
  return `${dayMonthShort(date)}, ${toWeekday(date)}`;
}

export function TransactionsPage({ period, transactions, categories, styles, onEdit }: TransactionsPageProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [allPeriods, setAllPeriods] = useState(false);
  const [query, setQuery] = useState("");

  const availableCategories = useMemo(
    () => (typeFilter === "all" ? [...new Set([...categories.expense, ...categories.income])] : categories[typeFilter]),
    [categories, typeFilter]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions
      .filter((tx) => allPeriods || transactionTouchesPeriod(tx, period))
      .filter((tx) => typeFilter === "all" || tx.type === typeFilter)
      .filter((tx) => categoryFilter === "all" || tx.category === categoryFilter)
      .filter((tx) => !q || tx.category.toLowerCase().includes(q) || (tx.note ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, typeFilter, categoryFilter, allPeriods, period, query]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, tx) => {
          acc[tx.type] += tx.amount;
          acc.count[tx.type] += 1;
          return acc;
        },
        { income: 0, expense: 0, count: { income: 0, expense: 0 } }
      ),
    [filtered]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of filtered) {
      map.set(tx.date, [...(map.get(tx.date) ?? []), tx]);
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items,
      net: items.reduce((acc, tx) => acc + (tx.type === "income" ? tx.amount : -tx.amount), 0)
    }));
  }, [filtered]);

  const chip = (value: TypeFilter, label: string) => (
    <button
      type="button"
      className={`chip${typeFilter === value ? " is-active" : ""}`}
      aria-pressed={typeFilter === value}
      onClick={() => {
        setTypeFilter(value);
        setCategoryFilter("all");
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="page">
      <label className="search">
        <Icon path={UI_ICONS.search} size={18} color="var(--muted)" />
        <span className="sr-only">Поиск по операциям</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по заметкам и категориям" />
      </label>

      <div className="chips">
        {chip("all", "Все")}
        {chip("expense", "Расходы")}
        {chip("income", "Доходы")}
        <label className={`chip chip--select${categoryFilter !== "all" ? " is-active" : ""}`}>
          <span className="sr-only">Категория</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Категория</option>
            {availableCategories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Icon path={UI_ICONS.down} size={14} strokeWidth={2.6} />
        </label>
        <button
          type="button"
          className={`chip${allPeriods ? " is-active" : ""}`}
          aria-pressed={allPeriods}
          onClick={() => setAllPeriods((value) => !value)}
        >
          Все периоды
        </button>
      </div>

      <div className="tiles tiles--two">
        <div className="tile tile--green">
          <span className="tile-label">Пришло</span>
          <span className="tile-value">+{num(totals.income)} ₽</span>
        </div>
        <div className="tile tile--red">
          <span className="tile-label">Ушло · {totals.count.expense} шт.</span>
          <span className="tile-value">−{num(totals.expense)} ₽</span>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.date} className="tx-group">
          <div className="tx-group-head">
            <span className="tx-group-label">{groupLabel(group.date)}</span>
            <span className="tx-group-total">
              {group.net >= 0 ? "+" : "−"}
              {num(Math.abs(group.net))} ₽
            </span>
          </div>
          <div className="card card--list">
            {group.items.map((tx) => {
              const look = resolveCategoryStyle(tx.category, tx.type, styles);
              const sub = tx.spread?.enabled
                ? `по дням ${dayMonthShort(tx.spread.startDate)} – ${dayMonthShort(tx.spread.endDate)}`
                : tx.note || (tx.type === "income" ? "Доход" : "Расход");
              return (
                <button key={tx.id} type="button" className="tx" onClick={() => onEdit(tx.id)}>
                  <CategoryBadge look={look} />
                  <span className="tx-text">
                    <span className="tx-cat">{tx.category}</span>
                    <span className="tx-note">{sub}</span>
                  </span>
                  <span className={`tx-amount${tx.type === "income" ? " is-income" : ""}`}>{signedRub(tx.amount, tx.type)}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <p className="empty">{allPeriods ? "Операций по фильтру нет." : "В этом периоде операций по фильтру нет."}</p>
      )}
    </div>
  );
}
