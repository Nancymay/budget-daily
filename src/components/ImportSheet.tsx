import { useEffect, useMemo, useState } from "react";
import { getTodayISO, toWeekday } from "../lib/date";
import { dayMonthShort, num, plural } from "../lib/format";
import type { Statement, StatementOperation } from "../lib/statement";
import { Icon, UI_ICONS } from "./ui/Icon";
import { Sheet } from "./ui/Sheet";
import type { Transaction, TransactionType } from "../types/models";

/** Category for operations added without one; they can be sorted later from the Categories tab. */
export const UNSORTED_CATEGORY = "Разобрать";

export interface ImportResult {
  transactions: Omit<Transaction, "id">[];
  rules: Record<string, string>;
  skipped: string[];
}

interface ImportSheetProps {
  statement: Statement | null;
  transactions: Transaction[];
  categories: Record<TransactionType, string[]>;
  rules: Record<string, string>;
  skipped: string[];
  onClose: () => void;
  onImport: (result: ImportResult) => void;
}

interface Choice {
  include: boolean;
  category: string;
}

export function ruleKey(type: TransactionType, description: string): string {
  return `${type}|${description.trim().toLowerCase()}`;
}

function groupLabel(date: string): string {
  return date === getTodayISO() ? `Сегодня, ${dayMonthShort(date)}` : `${dayMonthShort(date)}, ${toWeekday(date)}`;
}

/** Preview of a bank statement: pick which operations to add and their categories. Nothing is saved until "Добавить". */
export function ImportSheet({ statement, transactions, categories, rules, skipped, onClose, onImport }: ImportSheetProps) {
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [showHidden, setShowHidden] = useState(false);

  const analysis = useMemo(() => {
    if (!statement) {
      return null;
    }
    const imported = new Set(transactions.map((tx) => tx.importKey).filter(Boolean));
    const skippedSet = new Set(skipped);
    // Entered by hand on the same day for the same amount: probably the same operation.
    const manual = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.importKey) {
        const key = `${tx.type}|${tx.date}|${tx.amount.toFixed(2)}`;
        manual.set(key, (manual.get(key) ?? 0) + 1);
      }
    }

    const fresh = statement.operations.filter((op) => !imported.has(op.key));
    const duplicate = new Set<string>();
    for (const op of fresh) {
      const key = `${op.type}|${op.date}|${op.amount.toFixed(2)}`;
      const left = manual.get(key) ?? 0;
      if (left > 0) {
        duplicate.add(op.key);
        manual.set(key, left - 1);
      }
    }

    return {
      alreadyImported: statement.operations.length - fresh.length,
      visible: fresh.filter((op) => op.counted),
      hidden: fresh.filter((op) => !op.counted),
      duplicate,
      skippedBefore: new Set(fresh.filter((op) => skippedSet.has(op.key)).map((op) => op.key))
    };
    // Only when a new statement opens: a background sync must not reset the choices being made.
  }, [statement]);

  const suggest = (op: StatementOperation): string => {
    const remembered = rules[ruleKey(op.type, op.description)];
    if (remembered && categories[op.type].includes(remembered)) {
      return remembered;
    }
    const byBank = categories[op.type].find((name) => name.toLowerCase() === op.bankCategory.toLowerCase());
    return byBank ?? "";
  };

  // Fresh defaults for every newly opened statement.
  useEffect(() => {
    if (!analysis) {
      return;
    }
    const next: Record<string, Choice> = {};
    for (const op of [...analysis.visible, ...analysis.hidden]) {
      next[op.key] = {
        include: op.counted && !analysis.duplicate.has(op.key) && !analysis.skippedBefore.has(op.key),
        category: suggest(op)
      };
    }
    setChoices(next);
    setShowHidden(false);
  }, [analysis]);

  if (!statement || !analysis) {
    return null;
  }

  const all = [...analysis.visible, ...analysis.hidden];
  const included = all.filter((op) => choices[op.key]?.include);
  const withoutCategory = included.filter((op) => !choices[op.key]?.category).length;
  const totals = included.reduce(
    (acc, op) => {
      acc[op.type] += op.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const toggle = (key: string) =>
    setChoices((prev) => ({ ...prev, [key]: { ...prev[key], include: !prev[key]?.include } }));

  // Picking a category for one "Яндекс Такси" picks it for every "Яндекс Такси" in this statement.
  const setCategory = (op: StatementOperation, category: string) =>
    setChoices((prev) => {
      const next = { ...prev };
      const key = ruleKey(op.type, op.description);
      for (const other of all) {
        if (ruleKey(other.type, other.description) === key) {
          next[other.key] = { ...next[other.key], category };
        }
      }
      return next;
    });

  const setAllVisible = (include: boolean) =>
    setChoices((prev) => {
      const next = { ...prev };
      for (const op of analysis.visible) {
        next[op.key] = { ...next[op.key], include };
      }
      return next;
    });

  const submit = () => {
    const rulesUpdate: Record<string, string> = {};
    const result: ImportResult = {
      transactions: included.map((op) => {
        const category = choices[op.key]?.category || UNSORTED_CATEGORY;
        if (choices[op.key]?.category) {
          rulesUpdate[ruleKey(op.type, op.description)] = category;
        }
        return {
          type: op.type,
          date: op.date,
          amount: op.amount,
          category,
          note: op.description,
          importKey: op.key
        };
      }),
      rules: rulesUpdate,
      // Remember what was deliberately left out, so the next statement doesn't offer it again.
      skipped: analysis.visible.filter((op) => !choices[op.key]?.include).map((op) => op.key)
    };
    onImport(result);
  };

  const renderGroups = (ops: StatementOperation[]) => {
    const groups = new Map<string, StatementOperation[]>();
    for (const op of ops) {
      groups.set(op.date, [...(groups.get(op.date) ?? []), op]);
    }
    return [...groups.entries()].map(([date, list]) => (
      <section key={date} className="tx-group">
        <div className="tx-group-head">
          <span className="tx-group-label">{groupLabel(date)}</span>
        </div>
        <div className="card card--list">
          {list.map((op) => {
            const choice = choices[op.key] ?? { include: false, category: "" };
            const badges = [
              op.refund ? "возврат?" : null,
              analysis.duplicate.has(op.key) ? "похоже, уже внесена" : null,
              analysis.skippedBefore.has(op.key) ? "пропускала раньше" : null
            ].filter(Boolean);
            return (
              <div key={op.key} className={`imp-row${choice.include ? "" : " is-off"}`}>
                <button
                  type="button"
                  className={`imp-check${choice.include ? " is-on" : ""}`}
                  role="checkbox"
                  aria-checked={choice.include}
                  aria-label={`Добавить: ${op.description}, ${num(op.amount)} ₽`}
                  onClick={() => toggle(op.key)}
                >
                  {choice.include && <Icon path="M5 12l5 5 9-10" size={14} strokeWidth={3} color="#FFFFFF" />}
                </button>
                <span className="imp-main">
                  <span className="imp-top">
                    <span className="imp-desc">{op.description}</span>
                    <span className={`imp-amount${op.type === "income" ? " is-income" : ""}`}>
                      {op.type === "income" ? "+" : "−"}
                      {num(op.amount)} ₽
                    </span>
                  </span>
                  <span className="imp-bottom">
                    <span className="imp-meta">
                      {[op.bankCategory, op.time, op.account].filter(Boolean).join(" · ")}
                      {badges.length > 0 && <span className="imp-badge"> · {badges.join(" · ")}</span>}
                    </span>
                    {choice.include && (
                      <label className={`chip chip--select imp-cat${choice.category ? " is-set" : ""}`}>
                        <span className="sr-only">Категория для {op.description}</span>
                        <select value={choice.category} onChange={(event) => setCategory(op, event.target.value)}>
                          <option value="">Без категории</option>
                          {categories[op.type].map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                        <Icon path={UI_ICONS.down} size={12} strokeWidth={2.6} />
                      </label>
                    )}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </section>
    ));
  };

  const period = statement.operations.length
    ? `${dayMonthShort(statement.operations[statement.operations.length - 1].date)} – ${dayMonthShort(statement.operations[0].date)}`
    : "";

  return (
    <Sheet
      open
      title="Выписка из банка"
      onClose={onClose}
      footer={
        <div className="imp-foot">
          {withoutCategory > 0 && (
            <span className="imp-foot-hint">
              {withoutCategory} без категории — попадут в «{UNSORTED_CATEGORY}», разберёшь потом
            </span>
          )}
          <button type="button" className="primary-btn" disabled={included.length === 0} onClick={submit}>
            {included.length === 0
              ? "Ничего не выбрано"
              : `Добавить ${included.length} ${plural(included.length, "операцию", "операции", "операций")}`}
          </button>
        </div>
      }
    >
      <div className="details">
        <div className="tile tile--violet">
          <span className="tile-label">
            {statement.bank} · {period}
          </span>
          <span className="tile-value">
            {included.length} из {analysis.visible.length + analysis.hidden.length}
          </span>
          <span className="tile-sub">
            выбрано: −{num(totals.expense)} ₽ / +{num(totals.income)} ₽
            {analysis.alreadyImported > 0 ? ` · ${analysis.alreadyImported} уже загружены раньше` : ""}
          </span>
        </div>

        <p className="section-hint imp-hint">
          Ничего не добавится, пока ты не нажмёшь кнопку внизу. Категорию для магазина достаточно выбрать один раз — в следующий
          раз подставится сама.
        </p>

        {analysis.visible.length > 0 && (
          <div className="imp-actions">
            <button type="button" className="link-btn" onClick={() => setAllVisible(true)}>
              Выбрать все
            </button>
            <button type="button" className="link-btn" onClick={() => setAllVisible(false)}>
              Снять все
            </button>
          </div>
        )}

        {renderGroups(analysis.visible)}

        {analysis.visible.length === 0 && <p className="empty">Новых операций в этой выписке нет.</p>}

        {analysis.hidden.length > 0 && (
          <div className="imp-hidden">
            <button type="button" className="dashed-btn imp-hidden-btn" onClick={() => setShowHidden((value) => !value)}>
              {showHidden ? "Скрыть" : "Показать"} переводы между своими счетами ({analysis.hidden.length})
            </button>
            {showHidden && (
              <>
                <p className="section-hint imp-hint">Банк не учитывает их в расходах. Отметь, если какие-то всё же нужны.</p>
                {renderGroups(analysis.hidden)}
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
