import { useEffect, useMemo, useState } from "react";
import type { Transaction, TransactionType } from "../types/models";

interface TransactionFormModalProps {
  open: boolean;
  month: string;
  categories: Record<TransactionType, string[]>;
  initial: Transaction | null;
  onClose: () => void;
  onSubmit: (payload: Omit<Transaction, "id">, existingId?: string) => void;
}

interface FormState {
  type: TransactionType;
  date: string;
  amount: string;
  selectedCategory: string;
  newCategory: string;
  note: string;
  spreadEnabled: boolean;
  spreadStartDate: string;
  spreadEndDate: string;
}

function getInitialState(
  month: string,
  initial: Transaction | null,
  categories: Record<TransactionType, string[]>
): FormState {
  const type = initial?.type ?? "expense";
  const options = categories[type];
  const hasInitialCategory = Boolean(initial?.category && options.includes(initial.category));

  if (initial) {
    return {
      type,
      date: initial.date,
      amount: String(initial.amount),
      selectedCategory: hasInitialCategory ? initial.category : "__new__",
      newCategory: hasInitialCategory ? "" : initial.category,
      note: initial.note ?? "",
      spreadEnabled: Boolean(initial.spread?.enabled),
      spreadStartDate: initial.spread?.startDate ?? initial.date,
      spreadEndDate: initial.spread?.endDate ?? `${month}-01`
    };
  }

  return {
    type,
    date: `${month}-01`,
    amount: "",
    selectedCategory: options[0] ?? "__new__",
    newCategory: "",
    note: "",
    spreadEnabled: false,
    spreadStartDate: `${month}-01`,
    spreadEndDate: `${month}-01`
  };
}

export function TransactionFormModal({ open, month, categories, initial, onClose, onSubmit }: TransactionFormModalProps) {
  const [form, setForm] = useState<FormState>(getInitialState(month, initial, categories));
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (open) {
      setForm(getInitialState(month, initial, categories));
      setError("");
    }
  }, [open, month, initial, categories]);

  const options = useMemo(() => categories[form.type], [categories, form.type]);

  if (!open) {
    return null;
  }

  const submit = () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Сумма должна быть больше 0");
      return;
    }

    if (!form.date) {
      setError("Укажите дату");
      return;
    }

    const category = form.selectedCategory === "__new__" ? form.newCategory.trim() : form.selectedCategory;
    if (!category) {
      setError("Укажите категорию");
      return;
    }

    if (form.type === "income" && form.spreadEnabled && form.spreadStartDate > form.spreadEndDate) {
      setError("Дата начала распределения не может быть позже даты окончания");
      return;
    }

    onSubmit(
      {
        type: form.type,
        date: form.date,
        amount,
        category,
        note: form.note.trim(),
        spread:
          form.type === "income" && form.spreadEnabled
            ? {
                enabled: true,
                startDate: form.spreadStartDate,
                endDate: form.spreadEndDate
              }
            : undefined
      },
      initial?.id
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h3>{initial ? "Редактировать транзакцию" : "Новая транзакция"}</h3>

        <label className="field">
          <span>Тип</span>
          <select
            value={form.type}
            onChange={(event) => {
              const nextType = event.target.value as TransactionType;
              const nextOptions = categories[nextType];
              setForm({
                ...form,
                type: nextType,
                selectedCategory: nextOptions[0] ?? "__new__"
              });
            }}
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>

        <label className="field modal-date-field">
          <span>Дата</span>
          <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        </label>

        <label className="field">
          <span>Сумма</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Категория</span>
          <select value={form.selectedCategory} onChange={(event) => setForm({ ...form, selectedCategory: event.target.value })}>
            <option value="__new__">+ Новая категория</option>
            {options.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        {form.selectedCategory === "__new__" && (
          <label className="field">
            <span>Новая категория</span>
            <input value={form.newCategory} onChange={(event) => setForm({ ...form, newCategory: event.target.value })} />
          </label>
        )}

        <label className="field">
          <span>Комментарий</span>
          <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        </label>

        {form.type === "income" && (
          <div className="spread-box">
            <label className="switch-field">
              <span>Размазать приход по диапазону</span>
              <input
                type="checkbox"
                checked={form.spreadEnabled}
                onChange={(event) => setForm({ ...form, spreadEnabled: event.target.checked })}
              />
            </label>
            {form.spreadEnabled && (
              <div className="row-2">
                <label className="field">
                  <span>От</span>
                  <input
                    type="date"
                    value={form.spreadStartDate}
                    onChange={(event) => setForm({ ...form, spreadStartDate: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>До</span>
                  <input
                    type="date"
                    value={form.spreadEndDate}
                    onChange={(event) => setForm({ ...form, spreadEndDate: event.target.value })}
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn" onClick={submit}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
