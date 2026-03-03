import { Card, Col, Progress, Row, Space, Tag, Typography } from "antd";
import { useMemo } from "react";
import { isDateInMonth } from "../lib/date";
import { formatMoney } from "../lib/money";
import type { Transaction } from "../types/models";

interface SummaryPageProps {
  month: string;
  transactions: Transaction[];
}

function colorByCategory(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}deg 90% 52%)`;
}

export function SummaryPage({ month, transactions }: SummaryPageProps) {
  const slices = useMemo(() => {
    const byCategory = new Map<string, number>();

    for (const tx of transactions) {
      if (tx.type !== "expense" || !isDateInMonth(tx.date, month)) {
        continue;
      }
      byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
    }

    const list = Array.from(byCategory.entries())
      .map(([category, amount], index) => ({
        category,
        amount,
        color: colorByCategory(`${category}:${index}`)
      }))
      .sort((a, b) => b.amount - a.amount);

    const total = list.reduce((acc, item) => acc + item.amount, 0);
    return {
      total,
      list: list.map((item) => ({
        ...item,
        percent: total > 0 ? Number(((item.amount / total) * 100).toFixed(1)) : 0
      }))
    };
  }, [transactions, month]);

  return (
    <Card>
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={8}>
          <div className="progress-wrap">
            <Progress type="circle" percent={100} format={() => formatMoney(slices.total)} />
          </div>
        </Col>
        <Col xs={24} md={16}>
          <Typography.Title level={5}>Распределение расходов по категориям</Typography.Title>
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            {slices.list.map((item) => (
              <div key={item.category} className="summary-line">
                <Space>
                  <Tag color={item.color}>{item.category}</Tag>
                  <Typography.Text>{formatMoney(item.amount)}</Typography.Text>
                </Space>
                <Typography.Text type="secondary">{item.percent}%</Typography.Text>
              </div>
            ))}
            {slices.list.length === 0 && <Typography.Text type="secondary">Нет расходов за выбранный месяц.</Typography.Text>}
          </Space>
        </Col>
      </Row>
    </Card>
  );
}
