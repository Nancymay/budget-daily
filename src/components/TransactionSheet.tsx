import { App } from "antd";
import { useEffect, useMemo, useState } from "react";
import { diffDays, getDefaultDateForPeriod, getTodayISO, isDateInPeriod, type Period } from "../lib/date";
import { dayMonthShort, groupTypedAmount, num } from "../lib/format";
import { resolveCategoryStyle } from "../lib/categoryStyle";
import { Icon, UI_ICONS } from "./ui/Icon";
import { Sheet } from "./ui/Sheet";
import type { CategoryStyle, Transaction, TransactionType } from "../types/models";

interface TransactionSheetProps {
  open: boolean;
  period: Period;
  categories: Record<TransactionType, string[]>;
  styles: Record<string, CategoryStyle>;
  initial: Transaction | null;
  onClose: () => void;
  onSubmit: (payload: Omit<Transaction, "id">, existingId?: string) => void;
  onDelete: (id: string) => void;
}

interface FormState {
  type: TransactionType;
  date: string;
  amount: string;
  category: string;
  newCategory: string;
  addingCategory: boolean;
  note: string;
  spreadEnabled: boolean;
  spreadStart: string;
  spreadEnd: string;
}

// By default a spread income lasts until the end of the pay period it arrives in.
function defaultSpreadEnd(date: string, period: Period): string {
  return isDateInPeriod(date, period) ? period.end : date;
}

function initialState(period: Period, initial: Transaction | null, categories: Record<TransactionType, string[]>): FormState {
  if (initial) {
    const known = categories[initial.type].includes(initial.category);
    return {
      type: initial.type,
      date: initial.date,
      amount: groupTypedAmount(String(initial.amount)),
      category: known ? initial.category : "",
      newCategory: known ? "" : initial.category,
      addingCategory: !known,
      note: initial.note ?? "",
      spreadEnabled: Boolean(initial.spread?.enabled),
      spreadStart: initial.spread?.startDate ?? initial.date,
      spreadEnd: initial.spread?.endDate ?? defaultSpreadEnd(initial.date, period)
    };
  }
  const date = getDefaultDateForPeriod(period);
  const first = categories.expense[0];
  return {
    type: "expense",
    date,
    amount: "",
    category: first ?? "",
    newCategory: "",
    addingCategory: !first,
    note: "",
    spreadEnabled: false,
    spreadStart: date,
    spreadEnd: defaultSpreadEnd(date, period)
  };
}

function dateLabel(date: string): string {
  return date === getTodayISO() ? `Сегодня, ${dayMonthShort(date)}` : dayMonthShort(date);
}

export function TransactionSheet({ open, period, categories, styles, initial, onClose, onSubmit, onDelete }: TransactionSheetProps) {
  const { modal } = App.useApp();
  const [form, setForm] = useState<FormState>(() => initialState(period, initial, categories));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(initialState(period, initial, categories));
      setError("");
    }
    // categories are intentionally not a dependency: re-initialising would wipe what the user typed.
  }, [open, period, initial]);

  const options = useMemo(() => categories[form.type], [categories, form.type]);
  const amountValue = Number(form.amount.replace(/[\s ]/g, "").replace(",", "."));
  const spreadDays = form.spreadStart && form.spreadEnd && form.spreadEnd >= form.spreadStart ? diffDays(form.spreadStart, form.spreadEnd) + 1 : 0;

  const set = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setError("");
  };

  const submit = () => {
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Введите сумму больше нуля");
      return;
    }
    if (!form.date) {
      setError("Укажите дату");
      return;
    }
    const category = (form.addingCategory ? form.newCategory : form.category).trim();
    if (!category) {
      setError("Выберите или добавьте категорию");
      return;
    }
    const useSpread = form.type === "income" && form.spreadEnabled;
    if (useSpread && spreadDays <= 0) {
      setError("Проверьте даты распределения");
      return;
    }
    onSubmit(
      {
        type: form.type,
        date: form.date,
        amount: Math.round(amountValue * 100) / 100,
        category,
        note: form.note.trim(),
        spread: useSpread ? { enabled: true, startDate: form.spreadStart, endDate: form.spreadEnd } : undefined
      },
      initial?.id
    );
  };

  const remove = () => {
    if (!initial) {
      return;
    }
    modal.confirm({
      title: "Удалить операцию?",
      content: `${initial.category} · ${num(initial.amount)} ₽`,
      okText: "Удалить",
      okButtonProps: { danger: true },
      cancelText: "Отмена",
      onOk: () => onDelete(initial.id)
    });
  };

  const amountText = form.amount || "0";

  return (
    <Sheet
      open={open}
      title={initial ? "Операция" : "Новая операция"}
      onClose={onClose}
      footer={
        <button type="button" className="primary-btn" onClick={submit}>
          Сохранить
        </button>
      }
    >
      <div className="segmented" role="group" aria-label="Тип операции">
        {(["expense", "income"] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={form.type === type ? "is-active" : ""}
            aria-pressed={form.type === type}
            onClick={() => {
              const first = categories[type][0];
              set({ type, category: first ?? "", addingCategory: !first, newCategory: "" });
            }}
          >
            {type === "expense" ? "Расход" : "Доход"}
          </button>
        ))}
      </div>

      <div className="amount">
        <label htmlFor="tx-amount" className="amount-label">
          Сумма
        </label>
        <div className="amount-row">
          {/* The hidden copy of the text sizes the field exactly to what is typed. */}
          <span className={`amount-field${form.type === "income" ? " is-income" : ""}`} data-value={amountText}>
          <input
            id="tx-amount"
            className="amount-input"
            size={1}
            inputMode="decimal"
            autoFocus={!initial}
            placeholder="0"
            value={form.amount}
            onChange={(event) => set({ amount: groupTypedAmount(event.target.value) })}
            onKeyDown={(event) => event.key === "Enter" && submit()}
          />
          </span>
          <span className="amount-currency">₽</span>
        </div>
      </div>

      <div className="field">
        <span className="field-caption">Категория</span>
        <div className="chips">
          {options.map((category) => {
            const selected = !form.addingCategory && form.category === category;
            const look = resolveCategoryStyle(category, form.type, styles);
            return (
              <button
                key={category}
                type="button"
                className={`cat-chip${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => set({ category, addingCategory: false })}
              >
                <Icon path={look.path} size={16} color={selected ? "#14131A" : look.fg} strokeWidth={2.2} />
                {category}
              </button>
            );
          })}
          <button
            type="button"
            className={`cat-chip cat-chip--new${form.addingCategory ? " is-selected" : ""}`}
            aria-pressed={form.addingCategory}
            onClick={() => set({ addingCategory: true })}
          >
            + Новая
          </button>
        </div>
        {form.addingCategory && (
          <span className="input-wrap">
            <input
              autoFocus={Boolean(options.length)}
              aria-label="Название новой категории"
              placeholder="Название новой категории"
              value={form.newCategory}
              maxLength={40}
              onChange={(event) => set({ newCategory: event.target.value })}
            />
          </span>
        )}
      </div>

      <div className="card card--rows">
        <label className="row-field">
          <span>Дата</span>
          <span className="row-field-input">
            <span className="accent-text">{form.date ? dateLabel(form.date) : "—"}</span>
            <input
              type="date"
              className="date-overlay"
              aria-label="Дата"
              value={form.date}
              onChange={(event) => {
                const date = event.target.value;
                if (!date) {
                  return;
                }
                set(form.spreadEnabled ? { date } : { date, spreadStart: date, spreadEnd: defaultSpreadEnd(date, period) });
              }}
            />
          </span>
        </label>
        <label className="row-field">
          <span>Заметка</span>
          <span className="row-field-input">
            <input placeholder="Необязательно" value={form.note} onChange={(event) => set({ note: event.target.value })} />
          </span>
        </label>
        {form.type === "income" && (
          <>
            <label className="row-field row-field--tall">
              <span className="row-field-stack">
                <span>Распределить по дням</span>
                <small>доход «капает» равными частями до даты</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="switch"
                checked={form.spreadEnabled}
                onChange={(event) => set({ spreadEnabled: event.target.checked })}
              />
            </label>
            {form.spreadEnabled && (
              <div className="spread">
                <label>
                  <small>с</small>
                  <input type="date" value={form.spreadStart} onChange={(event) => event.target.value && set({ spreadStart: event.target.value })} />
                </label>
                <label>
                  <small>по</small>
                  <input type="date" value={form.spreadEnd} onChange={(event) => event.target.value && set({ spreadEnd: event.target.value })} />
                </label>
                {spreadDays > 0 && amountValue > 0 && (
                  <small className="spread-hint">
                    {spreadDays} дн. × {num(amountValue / spreadDays)} ₽ в день
                  </small>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      {initial && (
        <button type="button" className="danger-btn" onClick={remove}>
          <Icon path={UI_ICONS.trash} size={18} />
          Удалить операцию
        </button>
      )}
    </Sheet>
  );
}
