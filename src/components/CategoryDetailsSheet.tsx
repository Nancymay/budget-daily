import { useEffect, useMemo, useState } from "react";
import { getTodayISO, isDateInPeriod, toWeekday, type Period } from "../lib/date";
import { dayMonthShort, num, periodLabelShort, plural } from "../lib/format";
import { getLimitStatus, limitForPeriod } from "../lib/limits";
import { Sheet } from "./ui/Sheet";
import { TxRow } from "./ui/TxRow";
import type { CategoryStyle, Transaction, TransactionType } from "../types/models";

export interface CategoryDetailsTarget {
  type: TransactionType;
  name: string;
}

interface CategoryDetailsSheetProps {
  target: CategoryDetailsTarget | null;
  open: boolean;
  period: Period;
  transactions: Transaction[];
  limits: Record<string, number>;
  styles: Record<string, CategoryStyle>;
  onClose: () => void;
  onEditTransaction: (id: string) => void;
}

type Scope = "period" | "all";

function groupLabel(date: string): string {
  const label = `${dayMonthShort(date)}, ${toWeekday(date)}`;
  return date === getTodayISO() ? `Сегодня, ${dayMonthShort(date)}` : label;
}

/** All operations of one category, grouped by day, for the shown period or all time. */
export function CategoryDetailsSheet({
  target,
  open,
  period,
  transactions,
  limits,
  styles,
  onClose,
  onEditTransaction
}: CategoryDetailsSheetProps) {
  const [scope, setScope] = useState<Scope>("period");

  // Every newly opened category starts on the current period.
  useEffect(() => {
    setScope("period");
  }, [target?.type, target?.name]);

  const items = useMemo(() => {
    if (!target) {
      return [];
    }
    return transactions
      .filter((tx) => tx.type === target.type && tx.category === target.name)
      .filter((tx) => scope === "all" || isDateInPeriod(tx.date, period))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [target, transactions, scope, period]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of items) {
      map.set(tx.date, [...(map.get(tx.date) ?? []), tx]);
    }
    return [...map.entries()].map(([date, list]) => ({
      date,
      list,
      total: list.reduce((acc, tx) => acc + tx.amount, 0)
    }));
  }, [items]);

  if (!target) {
    return null;
  }

  const isExpense = target.type === "expense";
  const total = items.reduce((acc, tx) => acc + tx.amount, 0);
  const monthly = isExpense ? limits[target.name] ?? null : null;
  const limit = monthly !== null && scope === "period" ? limitForPeriod(monthly, period) : null;
  const status = limit === null ? null : getLimitStatus(total, limit);
  const count = items.length;
  const scopeLabel = scope === "period" ? `за ${periodLabelShort(period)}` : "за всё время";

  let limitText: string | null = null;
  if (limit !== null && status !== null) {
    limitText =
      status === "over" ? `Превышен на ${num(total - limit)} ₽` : `Осталось ${num(limit - total)} ₽ из ${num(limit)} ₽`;
  }

  return (
    <Sheet open={open} title={target.name} onClose={onClose}>
      <div className="details">
        <div className="chips" role="group" aria-label="Показать операции">
          <button
            type="button"
            className={`chip${scope === "period" ? " is-active" : ""}`}
            aria-pressed={scope === "period"}
            onClick={() => setScope("period")}
          >
            {periodLabelShort(period)}
          </button>
          <button
            type="button"
            className={`chip${scope === "all" ? " is-active" : ""}`}
            aria-pressed={scope === "all"}
            onClick={() => setScope("all")}
          >
            Всё время
          </button>
        </div>

        <div className={`tile ${isExpense ? (status === "over" ? "tile--red" : "tile--violet") : "tile--green"}`}>
          <span className="tile-label">
            {isExpense ? "Потрачено" : "Получено"} {scopeLabel}
          </span>
          <span className="tile-value">
            {isExpense ? "−" : "+"}
            {num(total)} ₽
          </span>
          <span className="tile-sub">
            {count} {plural(count, "операция", "операции", "операций")}
            {limitText ? ` · ${limitText}` : ""}
          </span>
        </div>

        {groups.map((group) => (
          <section key={group.date} className="tx-group">
            <div className="tx-group-head">
              <span className="tx-group-label">{groupLabel(group.date)}</span>
              <span className="tx-group-total">
                {isExpense ? "−" : "+"}
                {num(group.total)} ₽
              </span>
            </div>
            <div className="card card--list details-list">
              {group.list.map((tx) => (
                <TxRow key={tx.id} tx={tx} styles={styles} hideCategory onClick={() => onEditTransaction(tx.id)} />
              ))}
            </div>
          </section>
        ))}

        {groups.length === 0 && (
          <p className="empty">
            {scope === "period" ? "В этом периоде операций нет." : "Операций в этой категории пока нет."}
          </p>
        )}
      </div>
    </Sheet>
  );
}
