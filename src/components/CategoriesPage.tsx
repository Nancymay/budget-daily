import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Col, Input, InputNumber, Popconfirm, Progress, Row, Segmented, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { isDateInPeriod, toHumanDayMonth, type Period } from "../lib/date";
import { getLimitStatus, limitForPeriod, type LimitStatus } from "../lib/limits";
import { formatMoney, formatMoneyShort } from "../lib/money";
import type { PeriodMode, Transaction, TransactionType } from "../types/models";

interface CategoriesPageProps {
  period: Period;
  periodMode: PeriodMode;
  categories: Record<TransactionType, string[]>;
  transactions: Transaction[];
  limits: Record<string, number>;
  onLimitChange: (category: string, monthlyLimit: number | null) => void;
  onAddCategory: (type: TransactionType, category: string) => boolean;
  onDeleteCategory: (type: TransactionType, category: string) => void;
}

interface ExpenseRow {
  category: string;
  spent: number;
  monthlyLimit: number | null;
  limit: number | null;
  status: LimitStatus | null;
}

const STATUS_COLOR: Record<LimitStatus, string> = {
  ok: "#1677ff",
  warning: "#faad14",
  over: "#ff4d4f"
};

/** Monthly limit input that saves on blur or Enter, so typing doesn't re-sort the list. */
function LimitInput({ value, onCommit }: { value: number | null; onCommit: (value: number | null) => void }) {
  const [draft, setDraft] = useState<number | null>(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const next = draft && draft > 0 ? draft : null;
    if (next !== value) {
      onCommit(next);
    }
  };

  return (
    <InputNumber
      className="limit-input"
      size="small"
      min={0}
      precision={0}
      inputMode="numeric"
      placeholder="без лимита"
      value={draft}
      onChange={(next) => setDraft(next)}
      onBlur={commit}
      onPressEnter={commit}
      addonAfter="₽/мес"
    />
  );
}

function StatusText({ row }: { row: ExpenseRow }) {
  if (row.limit === null || row.status === null) {
    return <Typography.Text type="secondary">Лимит не задан</Typography.Text>;
  }
  if (row.status === "over") {
    return <span className="cat-status cat-status--over">Превышен на {formatMoneyShort(row.spent - row.limit)}</span>;
  }
  return (
    <span className={`cat-status${row.status === "warning" ? " cat-status--warning" : ""}`}>
      Осталось {formatMoneyShort(row.limit - row.spent)}
    </span>
  );
}

export function CategoriesPage({
  period,
  periodMode,
  categories,
  transactions,
  limits,
  onLimitChange,
  onAddCategory,
  onDeleteCategory
}: CategoriesPageProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [name, setName] = useState("");

  const totals = useMemo(() => {
    const result: Record<TransactionType, Map<string, number>> = { income: new Map(), expense: new Map() };
    for (const tx of transactions) {
      if (isDateInPeriod(tx.date, period)) {
        result[tx.type].set(tx.category, (result[tx.type].get(tx.category) ?? 0) + tx.amount);
      }
    }
    return result;
  }, [transactions, period]);

  const expenseRows = useMemo<ExpenseRow[]>(() => {
    const rows = categories.expense.map((category) => {
      const spent = totals.expense.get(category) ?? 0;
      const monthlyLimit = limits[category] ?? null;
      const limit = monthlyLimit === null ? null : limitForPeriod(monthlyLimit, period);
      return { category, spent, monthlyLimit, limit, status: limit === null ? null : getLimitStatus(spent, limit) };
    });
    // Categories with a limit first, most used-up on top; then the rest by amount spent.
    const ratio = (row: ExpenseRow) => (row.limit === null ? -1 : row.limit === 0 ? Infinity : row.spent / row.limit);
    return rows.sort((a, b) => ratio(b) - ratio(a) || b.spent - a.spent || a.category.localeCompare(b.category));
  }, [categories.expense, totals, limits, period]);

  const incomeRows = useMemo(
    () =>
      categories.income
        .map((category) => ({ category, total: totals.income.get(category) ?? 0 }))
        .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category)),
    [categories.income, totals]
  );

  const overCount = expenseRows.filter((row) => row.status === "over").length;

  const add = () => {
    if (onAddCategory(type, name)) {
      setName("");
    }
  };

  const deleteButton = (categoryType: TransactionType, category: string) => (
    <Popconfirm
      title="Удалить категорию?"
      onConfirm={() => onDeleteCategory(categoryType, category)}
      okText="Удалить"
      cancelText="Отмена"
    >
      <Button size="small" type="text" icon={<DeleteOutlined />} aria-label={`Удалить ${category}`} />
    </Popconfirm>
  );

  return (
    <Card>
      <Row gutter={[12, 12]} align="bottom">
        <Col xs={24} md={6}>
          <label className="field-label">Тип</label>
          <Segmented
            block
            value={type}
            onChange={(value) => setType(value as TransactionType)}
            options={[
              { value: "expense", label: "Расход" },
              { value: "income", label: "Доход" }
            ]}
          />
        </Col>
        <Col xs={24} md={12}>
          <label className="field-label">Новая категория</label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onPressEnter={add}
            placeholder="Например: Такси"
          />
        </Col>
        <Col xs={24} md={6}>
          <Button type="primary" icon={<PlusOutlined />} onClick={add} block>
            Добавить
          </Button>
        </Col>
      </Row>

      <div className="cat-section-head">
        <Typography.Title level={5} style={{ margin: 0 }}>
          Расходы и лимиты
        </Typography.Title>
        {overCount > 0 && <span className="cat-status cat-status--over">Превышено: {overCount}</span>}
      </div>
      <Typography.Text type="secondary" className="cat-hint">
        Лимит задаётся на месяц.
        {periodMode === "pay" &&
          ` На период ${toHumanDayMonth(period.start)}–${toHumanDayMonth(period.end)} он пересчитывается по числу дней.`}
      </Typography.Text>

      <div className="cat-list">
        {expenseRows.map((row) => (
          <div key={row.category} className={`cat-item${row.status === "over" ? " cat-item--over" : ""}`}>
            <div className="cat-head">
              <span className="cat-name">{row.category}</span>
              <span className="cat-amount">
                {formatMoneyShort(row.spent)}
                {row.limit !== null && <span className="cat-of"> из {formatMoneyShort(row.limit)}</span>}
              </span>
            </div>
            {row.limit !== null && row.status !== null && (
              <Progress
                percent={row.limit > 0 ? Math.min(100, (row.spent / row.limit) * 100) : 100}
                showInfo={false}
                strokeColor={STATUS_COLOR[row.status]}
                size="small"
              />
            )}
            <div className="cat-foot">
              <StatusText row={row} />
              <div className="cat-actions">
                <LimitInput value={row.monthlyLimit} onCommit={(value) => onLimitChange(row.category, value)} />
                {deleteButton("expense", row.category)}
              </div>
            </div>
          </div>
        ))}
        {expenseRows.length === 0 && (
          <Typography.Text type="secondary">Добавьте категорию расходов, чтобы задать для неё лимит.</Typography.Text>
        )}
      </div>

      {incomeRows.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>
            Доходы
          </Typography.Title>
          <div className="cat-list">
            {incomeRows.map((row) => (
              <div key={row.category} className="cat-item cat-item--compact">
                <span className="cat-name">{row.category}</span>
                <div className="cat-actions">
                  <span className="cat-amount amount-income">{formatMoney(row.total)}</span>
                  {deleteButton("income", row.category)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
