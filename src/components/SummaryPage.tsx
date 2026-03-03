import { Card, Col, Row, Space, Tag, Typography } from "antd";
import { blue, cyan, geekblue, gold, green, lime, magenta, orange, purple, red, volcano } from "@ant-design/colors";
import { useMemo } from "react";
import { isDateInMonth } from "../lib/date";
import { formatMoney } from "../lib/money";
import type { Transaction } from "../types/models";

interface SummaryPageProps {
  month: string;
  transactions: Transaction[];
}

const ANT_COLOR_SCALE = [
  red[5],
  volcano[5],
  orange[5],
  gold[5],
  lime[5],
  green[5],
  cyan[5],
  blue[5],
  geekblue[5],
  purple[5],
  magenta[5]
];

export function SummaryPage({ month, transactions }: SummaryPageProps) {
  const slices = useMemo(() => {
    const byCategory = new Map<string, number>();

    for (const tx of transactions) {
      if (tx.type !== "expense" || !isDateInMonth(tx.date, month)) {
        continue;
      }
      byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
    }

    const sorted = Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const total = sorted.reduce((acc, item) => acc + item.amount, 0);

    const list = sorted.map((item, index) => ({
      ...item,
      color: ANT_COLOR_SCALE[index % ANT_COLOR_SCALE.length],
      percent: total > 0 ? Number(((item.amount / total) * 100).toFixed(1)) : 0
    }));

    return { total, list };
  }, [transactions, month]);

  const pieBackground = useMemo(() => {
    if (slices.list.length === 0) {
      return "conic-gradient(#d9d9d9 0 100%)";
    }

    let start = 0;
    const chunks = slices.list.map((item) => {
      const end = start + item.percent;
      const chunk = `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
      start = end;
      return chunk;
    });

    return `conic-gradient(${chunks.join(",")})`;
  }, [slices]);

  return (
    <Card>
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={9}>
          <div className="pie-wrap-ant">
            <div className="pie-chart-ant" style={{ background: pieBackground }} />
            <div className="pie-center-ant">
              <span>Всего</span>
              <strong className="pie-total-ant">{formatMoney(slices.total)}</strong>
            </div>
          </div>
        </Col>
        <Col xs={24} md={15}>
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
