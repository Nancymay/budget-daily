import { useMemo } from "react";
import { isDateInPeriod, type Period } from "../lib/date";
import { getLimitStatus, limitForPeriod, type LimitStatus } from "../lib/limits";
import { num, periodLabelShort, plural } from "../lib/format";
import { resolveCategoryStyle } from "../lib/categoryStyle";
import { CategoryBadge } from "./ui/CategoryBadge";
import { Icon, UI_ICONS } from "./ui/Icon";
import type { CategoryStyle, PeriodMode, Transaction, TransactionType } from "../types/models";

interface CategoriesPageProps {
  type: TransactionType;
  onTypeChange: (type: TransactionType) => void;
  period: Period;
  periodMode: PeriodMode;
  categories: Record<TransactionType, string[]>;
  transactions: Transaction[];
  limits: Record<string, number>;
  styles: Record<string, CategoryStyle>;
  onAdd: () => void;
  onEdit: (type: TransactionType, category: string) => void;
  onDetails: (type: TransactionType, category: string) => void;
}

interface Row {
  category: string;
  total: number;
  limit: number | null;
  status: LimitStatus | null;
}

function countLabel(count: number): string {
  return count === 0 ? "В периоде операций нет" : `${count} ${plural(count, "операция", "операции", "операций")} в периоде`;
}

export function CategoriesPage({
  type,
  onTypeChange,
  period,
  periodMode,
  categories,
  transactions,
  limits,
  styles,
  onAdd,
  onEdit,
  onDetails
}: CategoriesPageProps) {
  const totals = useMemo(() => {
    const result: Record<TransactionType, Map<string, number>> = { income: new Map(), expense: new Map() };
    const counts: Record<TransactionType, Map<string, number>> = { income: new Map(), expense: new Map() };
    for (const tx of transactions) {
      if (isDateInPeriod(tx.date, period)) {
        result[tx.type].set(tx.category, (result[tx.type].get(tx.category) ?? 0) + tx.amount);
        counts[tx.type].set(tx.category, (counts[tx.type].get(tx.category) ?? 0) + 1);
      }
    }
    return Object.assign(result, { counts });
  }, [transactions, period]);

  const rows = useMemo<Row[]>(() => {
    const list = categories[type].map((category) => {
      const total = totals[type].get(category) ?? 0;
      const monthly = type === "expense" ? limits[category] ?? null : null;
      const limit = monthly === null ? null : limitForPeriod(monthly, period);
      return { category, total, limit, status: limit === null ? null : getLimitStatus(total, limit) };
    });
    // Limited categories first, most used-up on top; then the rest by amount.
    const ratio = (row: Row) => (row.limit === null ? -1 : row.limit === 0 ? Infinity : row.total / row.limit);
    return list.sort((a, b) => ratio(b) - ratio(a) || b.total - a.total || a.category.localeCompare(b.category));
  }, [categories, type, totals, limits, period]);

  const over = rows.filter((row) => row.status === "over");

  return (
    <div className="page">
      <div className="segmented" role="group" aria-label="Тип категорий">
        <button type="button" className={type === "expense" ? "is-active" : ""} aria-pressed={type === "expense"} onClick={() => onTypeChange("expense")}>
          Расходы
        </button>
        <button type="button" className={type === "income" ? "is-active" : ""} aria-pressed={type === "income"} onClick={() => onTypeChange("income")}>
          Доходы
        </button>
      </div>

      {type === "expense" && over.length > 0 && (
        <div className="banner">
          <span className="banner-icon">
            <Icon path={UI_ICONS.alert} color="#FFFFFF" strokeWidth={2.4} />
          </span>
          <span className="banner-text">
            <strong>
              Превышен {over.length} {plural(over.length, "лимит", "лимита", "лимитов")}
            </strong>
            <span>
              {over
                .slice(0, 2)
                .map((row) => `${row.category}: +${num(row.total - (row.limit ?? 0))} ₽`)
                .join(", ")}
              {over.length > 2 ? "…" : " сверх плана на период"}
            </span>
          </span>
        </div>
      )}

      <div className="section-head">
        <h2 className="section-title">{type === "expense" ? "Расходы и лимиты" : "Источники дохода"}</h2>
        {type === "expense" && (
          <span className="section-hint">
            Лимит задаётся на месяц
            {periodMode === "pay" ? `, на период ${periodLabelShort(period)} он пересчитан по дням` : ""}
          </span>
        )}
      </div>

      {rows.map((row) => {
        const look = resolveCategoryStyle(row.category, type, styles);
        const share = row.limit ? Math.min(100, (row.total / row.limit) * 100) : 100;
        let status: string;
        if (type === "income") {
          status = row.total > 0 ? "получено в этом периоде" : "в этом периоде не было";
        } else if (row.limit === null || row.status === null) {
          status = "Лимит не задан";
        } else if (row.status === "over") {
          status = `Превышен на ${num(row.total - row.limit)} ₽`;
        } else {
          status = `Осталось ${num(row.limit - row.total)} ₽ · ${Math.round(share)}%`;
        }
        return (
          <div key={row.category} className="card cat">
            <div className="cat-row">
              <CategoryBadge look={look} />
              <span className="cat-text">
                <span className="cat-name">{row.category}</span>
                <span className={`cat-status${row.status ? ` is-${row.status}` : ""}`}>{status}</span>
              </span>
              <span className="cat-sum">
                <span className={`cat-total${type === "income" && row.total > 0 ? " is-income" : ""}`}>
                  {type === "income" && row.total > 0 ? "+" : ""}
                  {num(row.total)} ₽
                </span>
                {type === "expense" && <span className="cat-of">{row.limit === null ? "без лимита" : `из ${num(row.limit)} ₽`}</span>}
              </span>
              <button
                type="button"
                className="icon-btn icon-btn--soft"
                aria-label={`Изменить категорию ${row.category}`}
                onClick={() => onEdit(type, row.category)}
              >
                <Icon path={UI_ICONS.pencil} size={18} />
              </button>
            </div>
            {row.limit !== null && row.status !== null && (
              <div className="bar" role="progressbar" aria-label={`${row.category}: потрачено из лимита`} aria-valuenow={Math.round(share)} aria-valuemin={0} aria-valuemax={100}>
                <div className={`bar-fill is-${row.status}`} style={{ width: `${share}%` }} />
              </div>
            )}
            <div className="cat-foot">
              <span className="cat-count">{countLabel(totals.counts[type].get(row.category) ?? 0)}</span>
              <button
                type="button"
                className="link-btn cat-more"
                aria-label={`Подробнее: ${row.category}`}
                onClick={() => onDetails(type, row.category)}
              >
                Подробнее
                <Icon path={UI_ICONS.right} size={14} strokeWidth={2.8} />
              </button>
            </div>
          </div>
        );
      })}

      {rows.length === 0 && (
        <p className="empty">
          {type === "expense" ? "Добавьте категорию расходов, чтобы задать для неё лимит." : "Категорий доходов пока нет."}
        </p>
      )}

      <button type="button" className="dashed-btn" onClick={onAdd}>
        <Icon path={UI_ICONS.plus} size={20} strokeWidth={2.8} />
        Новая категория
      </button>
    </div>
  );
}
