import dayjs from "dayjs";
import {
  Alert,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Select,
  Typography
} from "antd";
import { useEffect, useMemo, useState } from "react";
import type { Transaction, TransactionType } from "../types/models";
import type { Dayjs } from "dayjs";
import { getDaysInMonth, getDefaultDateForMonth } from "../lib/date";
import { formatMoney } from "../lib/money";

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
  spreadEnabled: boolean;
  spreadStart: string;
  spreadEnd: string;
}

function parseDateValue(input: string): Dayjs | null {
  if (!input) {
    return null;
  }
  const value = dayjs(input);
  return value.isValid() ? value : null;
}

function lastDayOfMonth(date: string): string {
  const days = getDaysInMonth(date.slice(0, 7));
  return days[days.length - 1] ?? date;
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
    const spread = initial.spread;
    return {
      type,
      date: initial.date,
      amount: initial.amount,
      selectedCategory: hasInitialCategory ? initial.category : "__new__",
      newCategory: hasInitialCategory ? "" : initial.category,
      note: initial.note ?? "",
      spreadEnabled: Boolean(spread?.enabled),
      spreadStart: spread?.startDate ?? initial.date,
      spreadEnd: spread?.endDate ?? lastDayOfMonth(initial.date)
    };
  }

  const date = getDefaultDateForMonth(month);
  return {
    type,
    date,
    amount: null,
    selectedCategory: options[0] ?? "__new__",
    newCategory: "",
    note: "",
    spreadEnabled: false,
    spreadStart: date,
    spreadEnd: lastDayOfMonth(date)
  };
}

function countDays(start: string, end: string): number {
  return dayjs(end).diff(dayjs(start), "day") + 1;
}

export function TransactionFormModal({
  open,
  month,
  categories,
  initial,
  onClose,
  onSubmit
}: TransactionFormModalProps) {
  const [form, setForm] = useState<FormState>(() => getInitialState(month, initial, categories));
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (open) {
      setForm(getInitialState(month, initial, categories));
      setError("");
    }
    // categories are intentionally not a dependency: re-initialising the form
    // when a category is added elsewhere would wipe what the user typed.
  }, [open, month, initial]);

  const options = useMemo(() => categories[form.type], [categories, form.type]);
  const canSpread = form.type === "income";
  const spreadDays = form.spreadStart && form.spreadEnd ? countDays(form.spreadStart, form.spreadEnd) : 0;

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

    const useSpread = canSpread && form.spreadEnabled;
    if (useSpread && (!form.spreadStart || !form.spreadEnd || form.spreadEnd < form.spreadStart)) {
      setError("Укажите корректный период распределения");
      return;
    }

    onSubmit(
      {
        type: form.type,
        date: form.date,
        amount,
        category,
        note: form.note.trim(),
        spread: useSpread ? { enabled: true, startDate: form.spreadStart, endDate: form.spreadEnd } : undefined
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
      <Form layout="vertical" onFinish={submit}>
        <Form.Item>
          <Segmented
            block
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
              { value: "expense", label: "Расход" },
              { value: "income", label: "Доход" }
            ]}
          />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Сумма">
              <InputNumber
                autoFocus
                min={0.01}
                precision={2}
                inputMode="decimal"
                value={form.amount}
                onChange={(value) => setForm({ ...form, amount: value })}
                onPressEnter={submit}
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Дата">
              <DatePicker
                value={parseDateValue(form.date)}
                allowClear={false}
                onChange={(value) => {
                  if (!value) {
                    return;
                  }
                  const date = value.format("YYYY-MM-DD");
                  // Keep the spread range following the date until the user customises it.
                  const followSpread = !form.spreadEnabled;
                  setForm({
                    ...form,
                    date,
                    ...(followSpread ? { spreadStart: date, spreadEnd: lastDayOfMonth(date) } : {})
                  });
                }}
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Col>
        </Row>

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
            <Input
              value={form.newCategory}
              onChange={(event) => setForm({ ...form, newCategory: event.target.value })}
            />
          </Form.Item>
        )}

        {canSpread && (
          <Form.Item>
            <Checkbox
              checked={form.spreadEnabled}
              onChange={(event) => setForm({ ...form, spreadEnabled: event.target.checked })}
            >
              Распределить доход по дням
            </Checkbox>
            {form.spreadEnabled && (
              <div style={{ marginTop: 8 }}>
                <DatePicker.RangePicker
                  style={{ width: "100%" }}
                  format="DD/MM/YYYY"
                  allowClear={false}
                  value={[parseDateValue(form.spreadStart), parseDateValue(form.spreadEnd)]}
                  onChange={(values) => {
                    const [start, end] = values ?? [];
                    if (start && end) {
                      setForm({
                        ...form,
                        spreadStart: start.format("YYYY-MM-DD"),
                        spreadEnd: end.format("YYYY-MM-DD")
                      });
                    }
                  }}
                />
                {spreadDays > 0 && Number(form.amount) > 0 && (
                  <Typography.Text type="secondary" style={{ display: "block", marginTop: 6, fontSize: 12 }}>
                    {spreadDays} дн. × {formatMoney(Number(form.amount) / spreadDays)} в день
                  </Typography.Text>
                )}
              </div>
            )}
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
