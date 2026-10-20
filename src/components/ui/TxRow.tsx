import { dayMonthShort, signedRub } from "../../lib/format";
import { resolveCategoryStyle } from "../../lib/categoryStyle";
import { CategoryBadge } from "./CategoryBadge";
import type { CategoryStyle, Transaction } from "../../types/models";

interface TxRowProps {
  tx: Transaction;
  styles: Record<string, CategoryStyle>;
  onClick: () => void;
  /** Hide the category name (e.g. inside a single category's list) and lead with the note. */
  hideCategory?: boolean;
}

/** One operation in a list: category badge, name or note, signed amount. */
export function TxRow({ tx, styles, onClick, hideCategory = false }: TxRowProps) {
  const look = resolveCategoryStyle(tx.category, tx.type, styles);
  const fallback = tx.type === "income" ? "Доход" : "Расход";
  const sub = tx.spread?.enabled
    ? `по дням ${dayMonthShort(tx.spread.startDate)} – ${dayMonthShort(tx.spread.endDate)}`
    : tx.note || fallback;
  const title = hideCategory ? tx.note || "Без заметки" : tx.category;
  const subtitle = hideCategory ? (tx.spread?.enabled ? sub : null) : sub;

  return (
    <button type="button" className="tx" onClick={onClick}>
      <CategoryBadge look={look} />
      <span className="tx-text">
        <span className={`tx-cat${hideCategory && !tx.note ? " is-muted" : ""}`}>{title}</span>
        {subtitle && <span className="tx-note">{subtitle}</span>}
      </span>
      <span className={`tx-amount${tx.type === "income" ? " is-income" : ""}`}>{signedRub(tx.amount, tx.type)}</span>
    </button>
  );
}
