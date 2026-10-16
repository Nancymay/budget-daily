import dayjs from "dayjs";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Card, Col, DatePicker, InputNumber, Row, Segmented, Statistic } from "antd";
import { formatMoney } from "../lib/money";
import { clampDateToPeriod, diffDays, toHumanDayMonth, type Period } from "../lib/date";
import type { DistributionMode, DistributionSettings, ForecastResult, PeriodMode } from "../types/models";

interface HeaderPanelProps {
  period: Period;
  isCurrentPeriod: boolean;
  onPrevPeriod: () => void;
  onNextPeriod: () => void;
  onCurrentPeriod: () => void;
  periodMode: PeriodMode;
  onPeriodModeChange: (mode: PeriodMode) => void;
  startBalance: number;
  onStartBalanceChange: (value: number) => void;
  distribution: DistributionSettings;
  onDistributionChange: (value: DistributionSettings) => void;
  forecast: ForecastResult;
}

function formatMonthName(date: string): string {
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" })
    .format(new Date(`${date}T12:00:00`))
    .replace(/\s*г\.?$/, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function LimitCaption({ forecast, period }: { forecast: ForecastResult; period: Period }) {
  const { referenceDate, limitUntil, nextLimit, shortfall } = forecast;
  if (!referenceDate || !limitUntil) {
    return null;
  }

  const days = diffDays(referenceDate, limitUntil) + 1;
  const until = limitUntil === period.end ? `до ${toHumanDayMonth(limitUntil)} включительно` : `до ${toHumanDayMonth(limitUntil)}`;
  const next = nextLimit ? `с ${toHumanDayMonth(nextLimit.from)} — ${formatMoney(nextLimit.limit)} в день` : null;

  if (shortfall > 0) {
    return (
      <>
        <span className="limit-caption limit-caption--alert">
          Не хватает {formatMoney(shortfall)} {until}
        </span>
        {next && <span className="limit-caption">{next}</span>}
      </>
    );
  }

  return (
    <>
      <span className="limit-caption">
        {until}, ещё {days} дн.
      </span>
      {next && <span className="limit-caption">{next}</span>}
    </>
  );
}

export function HeaderPanel({
  period,
  isCurrentPeriod,
  onPrevPeriod,
  onNextPeriod,
  onCurrentPeriod,
  periodMode,
  onPeriodModeChange,
  startBalance,
  onStartBalanceChange,
  distribution,
  onDistributionChange,
  forecast
}: HeaderPanelProps) {
  const limit = forecast.dailyLimit;
  const alert = forecast.shortfall > 0 || (limit !== null && limit < 0);

  return (
    <Card className="header-card">
      <Row gutter={[12, 12]} align="bottom">
        <Col xs={24} sm={14} md={10}>
          <div className="period-head">
            <label className="field-label">Период</label>
            <Segmented
              size="small"
              value={periodMode}
              onChange={(value) => onPeriodModeChange(value as PeriodMode)}
              options={[
                { value: "pay", label: "От зп до зп" },
                { value: "month", label: "Месяц" }
              ]}
            />
          </div>
          <div className="period-nav">
            <Button icon={<LeftOutlined />} onClick={onPrevPeriod} aria-label="Предыдущий период" />
            <span className="period-label">
              {periodMode === "month"
                ? formatMonthName(period.start)
                : `${toHumanDayMonth(period.start)} – ${toHumanDayMonth(period.end)}`}
            </span>
            <Button icon={<RightOutlined />} onClick={onNextPeriod} aria-label="Следующий период" />
            {!isCurrentPeriod && (
              <Button type="link" onClick={onCurrentPeriod}>
                Текущий
              </Button>
            )}
          </div>
        </Col>
        <Col xs={24} sm={10} md={8}>
          <label className="field-label">Остаток на начало периода</label>
          <InputNumber
            style={{ width: "100%" }}
            value={startBalance}
            onChange={(value) => onStartBalanceChange(Number(value ?? 0))}
            precision={2}
            inputMode="decimal"
          />
        </Col>
      </Row>

      <div className={`limit-block${alert ? " limit-block--negative" : ""}`}>
        <div className="limit-main">
          <span className="limit-caption">Можно тратить в день</span>
          <strong className="limit-value">{limit === null ? "—" : formatMoney(limit)}</strong>
          <LimitCaption forecast={forecast} period={period} />
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
              value={dayjs(clampDateToPeriod(distribution.fromDate ?? period.start, period))}
              disabledDate={(current) => {
                const day = current.format("YYYY-MM-DD");
                return day < period.start || day > period.end;
              }}
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
