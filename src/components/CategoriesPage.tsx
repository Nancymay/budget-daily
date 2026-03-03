import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Col, Popconfirm, Row, Select, Space, Table, Typography, Input, Tag } from "antd";
import { useMemo, useState } from "react";
import { isDateInMonth } from "../lib/date";
import { formatMoney } from "../lib/money";
import type { Transaction, TransactionType } from "../types/models";

interface CategoriesPageProps {
  month: string;
  categories: Record<TransactionType, string[]>;
  transactions: Transaction[];
  onAddCategory: (type: TransactionType, category: string) => boolean;
  onDeleteCategory: (type: TransactionType, category: string) => void;
}

export function CategoriesPage({ month, categories, transactions, onAddCategory, onDeleteCategory }: CategoriesPageProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [name, setName] = useState("");

  const rows = useMemo(() => {
    const list: Array<{ key: string; type: TransactionType; category: string; total: number }> = [];

    for (const currentType of ["expense", "income"] as const) {
      for (const category of categories[currentType]) {
        const total = transactions.reduce((acc, tx) => {
          if (tx.type !== currentType || tx.category !== category || !isDateInMonth(tx.date, month)) {
            return acc;
          }
          return acc + tx.amount;
        }, 0);

        list.push({
          key: `${currentType}:${category}`,
          type: currentType,
          category,
          total
        });
      }
    }

    return list.sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  }, [categories, transactions, month]);

  const add = () => {
    const ok = onAddCategory(type, name);
    if (ok) {
      setName("");
    }
  };

  return (
    <Card>
      <Row gutter={[12, 12]} align="bottom">
        <Col xs={24} md={6}>
          <label className="field-label">Тип</label>
          <Select
            value={type}
            onChange={(value) => setType(value)}
            style={{ width: "100%" }}
            options={[
              { value: "income", label: "Доходы" },
              { value: "expense", label: "Расходы" }
            ]}
          />
        </Col>
        <Col xs={24} md={12}>
          <label className="field-label">Новая категория</label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например: Продукты" />
        </Col>
        <Col xs={24} md={6}>
          <Button type="primary" icon={<PlusOutlined />} onClick={add} block>
            Добавить
          </Button>
        </Col>
      </Row>

      <Typography.Title level={5} style={{ marginTop: 20 }}>
        Категории за выбранный месяц
      </Typography.Title>

      <Table
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={rows}
        columns={[
          {
            title: "Тип",
            dataIndex: "type",
            width: 120,
            render: (value: TransactionType) => (
              <Tag color={value === "income" ? "green" : "red"}>{value === "income" ? "Доходы" : "Расходы"}</Tag>
            )
          },
          { title: "Категория", dataIndex: "category" },
          {
            title: "Сумма",
            dataIndex: "total",
            align: "right",
            width: 160,
            render: (value: number) => formatMoney(value)
          },
          {
            title: "",
            dataIndex: "actions",
            width: 120,
            render: (_, row) => (
              <Space>
                <Popconfirm
                  title="Удалить категорию?"
                  onConfirm={() => onDeleteCategory(row.type, row.category)}
                  okText="Удалить"
                  cancelText="Отмена"
                >
                  <Button icon={<DeleteOutlined />}>Удалить</Button>
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />
    </Card>
  );
}
