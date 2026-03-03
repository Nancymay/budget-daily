import dayjs from "dayjs";
import { Card, Col, DatePicker, InputNumber, Row, Statistic } from "antd";
import { formatMoney } from "../lib/money";
import type { ForecastResult } from "../types/models";

interface HeaderPanelProps {
  month: string;
  onMonthChange: (month: string) => void;
  startBalance: number;
  onStartBalanceChange: (value: number) => void;
  forecast: ForecastResult;
}

export function HeaderPanel({
  month,
  onMonthChange,
  startBalance,
  onStartBalanceChange,
  forecast
}: HeaderPanelProps) {
  return (
    <Card className="header-card">
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <label className="field-label">Месяц</label>
          <DatePicker
            picker="month"
            value={dayjs(`${month}-01`)}
            onChange={(_, dateString) => {
              if (typeof dateString === "string" && dateString) {
                onMonthChange(dateString);
              }
            }}
            style={{ width: "100%" }}
            format="YYYY-MM"
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <label className="field-label">Стартовый баланс</label>
          <InputNumber
            style={{ width: "100%" }}
            value={startBalance === 0 ? null : startBalance}
            onChange={(value) => onStartBalanceChange(Number(value ?? 0))}
            min={0}
            precision={2}
            placeholder="0"
          />
        </Col>
      </Row>

      <Row gutter={[12, 12]} className="stats-row">
        <Col xs={12} md={6}>
          <Statistic title="Доходы" value={formatMoney(forecast.totalIncome)} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Расходы" value={formatMoney(forecast.totalExpense)} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Доступно" value={formatMoney(forecast.availableFunds)} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic
            title="Остаток"
            value={formatMoney(forecast.endBalance)}
            valueStyle={{ color: forecast.endBalance < 0 ? "#ff4d4f" : "#1677ff" }}
          />
        </Col>
      </Row>
    </Card>
  );
}
