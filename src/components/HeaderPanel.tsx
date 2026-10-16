import dayjs from "dayjs";
import { Card, Col, DatePicker, InputNumber, Row, Segmented, Statistic } from "antd";
import { formatMoney } from "../lib/money";
import { clampDateToMonth, toHumanDayMonth } from "../lib/date";
import type { DistributionMode, DistributionSettings, ForecastResult } from "../types/models";

interface HeaderPanelProps {
  month: string;
  onMonthChange: (month: string) => void;
  startBalance: number;
  onStartBalanceChange: (value: number) => void;
  distribution: DistributionSettings;
  onDistributionChange: (value: DistributionSettings) => void;
  forecast: ForecastResult;
}

function daysFrom(referenceDate: string | null, rowsCount: number, rows: ForecastResult["rows"]): number {
  if (!referenceDate) {
    return 0;
  }
  const index = rows.findIndex((row) => row.date === referenceDate);
  return index >= 0 ? rowsCount - index : 0;
}

export function HeaderPanel({
  month,
  onMonthChange,
  startBalance,
  onStartBalanceChange,
  distribution,
  onDistributionChange,
  forecast
}: HeaderPanelProps) {
  const daysLeft = daysFrom(forecast.referenceDate, forecast.rows.length, forecast.rows);
  const limit = forecast.dailyLimit;

  return (
    <Card className="header-card">
      <Row gutter={[12, 12]}>
        <Col xs={12} md={8} lg={6}>
          <label className="field-label">Месяц</label>
          <DatePicker
            picker="month"
            value={dayjs(`${month}-01`)}
            allowClear={false}
            onChange={(_, dateString) => {
              if (typeof dateString === "string" && dateString) {
                onMonthChange(dateString);
              }
            }}
            style={{ width: "100%" }}
            format="YYYY-MM"
          />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <label className="field-label">Стартовый баланс</label>
          <InputNumber
            style={{ width: "100%" }}
            value={startBalance === 0 ? null : startBalance}
            onChange={(value) => onStartBalanceChange(Number(value ?? 0))}
            precision={2}
            inputMode="decimal"
            placeholder="0"
          />
        </Col>
      </Row>

      <div className={`limit-block${limit !== null && limit < 0 ? " limit-block--negative" : ""}`}>
        <div className="limit-main">
          <span className="limit-caption">Можно тратить в день</span>
          <strong className="limit-value">{limit === null ? "—" : formatMoney(limit)}</strong>
          {forecast.referenceDate && (
            <span className="limit-caption">
              с {toHumanDayMonth(forecast.referenceDate)}, ещё {daysLeft} дн. · свободно {formatMoney(forecast.distBase ?? 0)}
            </span>
          )}
        </div>
        <div className="limit-controls">
          <Segmented
            size="small"
            value={distribution.mode}
            onChange={(value) => onDistributionChange({ ...distribution, mode: value as DistributionMode })}
            options={[
              { value: "fromToday", label: "От сегодня" },
              { value: "fromStart", label: "С начала" },
              { value: "fromDate", label: "От даты" }
            ]}
          />
          {distribution.mode === "fromDate" && (
            <DatePicker
              size="small"
              allowClear={false}
              format="DD/MM/YYYY"
              value={dayjs(clampDateToMonth(distribution.fromDate ?? `${month}-01`, month))}
              disabledDate={(current) => current.format("YYYY-MM") !== month}
              onChange={(value) => {
                if (value) {
                  onDistributionChange({ ...distribution, fromDate: value.format("YYYY-MM-DD") });
                }
              }}
            />
          )}
        </div>
      </div>

      <Row gutter={[12, 12]} className="stats-row">
        <Col xs={8}>
          <Statistic title="Доходы" value={formatMoney(forecast.totalIncome)} />
        </Col>
        <Col xs={8}>
          <Statistic title="Расходы" value={formatMoney(forecast.totalExpense)} />
        </Col>
        <Col xs={8}>
          <Statistic
            title="Остаток на конец"
            value={formatMoney(forecast.endBalance)}
            valueStyle={{ color: forecast.endBalance < 0 ? "#ff4d4f" : undefined }}
          />
        </Col>
      </Row>
    </Card>
  );
}
