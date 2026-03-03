import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Col, Popconfirm, Row, Select, Space, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { formatMoney } from "../lib/money";
import { toHumanDate } from "../lib/date";
import type { Transaction, TransactionType } from "../types/models";

interface TransactionsPageProps {
  transactions: Transaction[];
  categories: Record<TransactionType, string[]>;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TransactionsPage({ transactions, categories, onAdd, onEdit, onDelete }: TransactionsPageProps) {
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const availableCategories = useMemo(() => {
    if (typeFilter === "all") {
      return [...new Set([...categories.income, ...categories.expense])];
    }
    return categories[typeFilter];
  }, [categories, typeFilter]);

  const filtered = useMemo(() => {
    return transactions
      .filter((tx) => (typeFilter === "all" ? true : tx.type === typeFilter))
      .filter((tx) => (categoryFilter === "all" ? true : tx.category === categoryFilter))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [transactions, typeFilter, categoryFilter]);

  return (
    <Card>
      <Row gutter={[12, 12]} align="bottom" className="toolbar-row">
        <Col xs={24} sm={8}>
          <label className="field-label">Тип</label>
          <Select
            value={typeFilter}
            onChange={(value) => {
              setTypeFilter(value);
              setCategoryFilter("all");
            }}
            style={{ width: "100%" }}
            options={[
              { value: "all", label: "Все" },
              { value: "income", label: "Доходы" },
              { value: "expense", label: "Расходы" }
            ]}
          />
        </Col>
        <Col xs={24} sm={10}>
          <label className="field-label">Категория</label>
          <Select
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value)}
            style={{ width: "100%" }}
            options={[{ value: "all", label: "Все" }, ...availableCategories.map((item) => ({ value: item, label: item }))]}
          />
        </Col>
        <Col xs={24} sm={6}>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd} block>
            Добавить
          </Button>
        </Col>
      </Row>

      <Space direction="vertical" style={{ width: "100%", marginTop: 16 }} size={10}>
        {filtered.map((tx) => (
          <Card key={tx.id} size="small" className="tx-item">
            <Row justify="space-between" align="middle" gutter={[8, 8]}>
              <Col xs={24} md={16}>
                <Space size={8} wrap>
                  <Tag color={tx.type === "income" ? "green" : "red"}>{tx.type === "income" ? "Доходы" : "Расходы"}</Tag>
                  <Tag>{toHumanDate(tx.date)}</Tag>
                  <Tag>{tx.category}</Tag>
                </Space>
                <Typography.Title level={5} style={{ margin: "8px 0 0" }}>
                  {formatMoney(tx.amount)}
                </Typography.Title>
                {tx.note && (
                  <Typography.Text type="secondary" style={{ display: "block" }}>
                    {tx.note}
                  </Typography.Text>
                )}
              </Col>
              <Col xs={24} md={8}>
                <Space>
                  <Button icon={<EditOutlined />} onClick={() => onEdit(tx.id)}>
                    Изменить
                  </Button>
                  <Popconfirm title="Удалить транзакцию?" onConfirm={() => onDelete(tx.id)} okText="Удалить" cancelText="Отмена">
                    <Button icon={<DeleteOutlined />}>Удалить</Button>
                  </Popconfirm>
                </Space>
              </Col>
            </Row>
          </Card>
        ))}

        {filtered.length === 0 && <Typography.Text type="secondary">Транзакций по фильтру нет.</Typography.Text>}
      </Space>
    </Card>
  );
}
