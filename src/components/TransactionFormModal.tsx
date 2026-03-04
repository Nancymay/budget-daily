import dayjs from "dayjs";
import { Alert, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space } from "antd";
import { useEffect, useMemo, useState } from "react";
import type { Transaction, TransactionType } from "../types/models";
import type { Dayjs } from "dayjs";
import { getTodayISO } from "../lib/date";

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
  amount: number | null;
  selectedCategory: string;
  newCategory: string;
  note: string;
}

function parseDateValue(input: string): Dayjs | null {
  const value = dayjs(input);
  return value.isValid() ? value : null;
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
      amount: initial.amount,
      selectedCategory: hasInitialCategory ? initial.category : "__new__",
      newCategory: hasInitialCategory ? "" : initial.category,
      note: initial.note ?? ""
    };
  }

  return {
    type,
    date: getTodayISO(),
    amount: null,
    selectedCategory: options[0] ?? "__new__",
    newCategory: "",
    note: ""
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

    onSubmit(
      {
        type: form.type,
        date: form.date,
        amount,
        category,
        note: form.note.trim(),
        spread: undefined
      },
      initial?.id
    );
  };

  return (
    <Modal
      title={initial ? "Редактировать транзакцию" : "Новая транзакция"}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Отмена
        </Button>,
        <Button key="submit" type="primary" onClick={submit}>
          Сохранить
        </Button>
      ]}
      destroyOnClose
    >
      <Form layout="vertical">
        <Form.Item label="Тип">
          <Select
            value={form.type}
            onChange={(value) => {
              const nextType = value as TransactionType;
              const nextOptions = categories[nextType];
              setForm({
                ...form,
                type: nextType,
                selectedCategory: nextOptions[0] ?? "__new__"
              });
            }}
            options={[
              { value: "income", label: "Доходы" },
              { value: "expense", label: "Расходы" }
            ]}
          />
        </Form.Item>

        <Space style={{ width: "100%" }} size={12} wrap>
          <Form.Item label="Дата" style={{ minWidth: 170, flex: 1 }}>
            <DatePicker
              value={parseDateValue(form.date)}
              onChange={(value) => setForm({ ...form, date: value ? value.format("YYYY-MM-DD") : getTodayISO() })}
              format="DD/MM/YYYY"
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label="Сумма" style={{ minWidth: 170, flex: 1 }}>
            <InputNumber
              min={0.01}
              precision={2}
              value={form.amount}
              onChange={(value) => setForm({ ...form, amount: value })}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Space>

        <Form.Item label="Категория">
          <Select
            value={form.selectedCategory}
            onChange={(value) => setForm({ ...form, selectedCategory: value })}
            options={[
              { value: "__new__", label: "+ Новая категория" },
              ...options.map((cat) => ({ value: cat, label: cat }))
            ]}
          />
        </Form.Item>

        {form.selectedCategory === "__new__" && (
          <Form.Item label="Новая категория">
            <Input value={form.newCategory} onChange={(event) => setForm({ ...form, newCategory: event.target.value })} />
          </Form.Item>
        )}

        <Form.Item label="Комментарий">
          <Input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        </Form.Item>

        {error && <Alert type="error" message={error} />}
      </Form>
    </Modal>
  );
}
