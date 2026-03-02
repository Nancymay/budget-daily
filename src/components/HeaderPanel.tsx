import { formatMoney } from "../lib/money";
import type { DistributionSettings, ForecastResult } from "../types/models";

interface HeaderPanelProps {
  month: string;
  onMonthChange: (month: string) => void;
  startBalance: number;
  onStartBalanceChange: (value: number) => void;
  distribution: DistributionSettings;
  onDistributionChange: (next: DistributionSettings) => void;
  forecast: ForecastResult;
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
  return (
    <header className="panel">
      <div className="panel-grid">
        <label className="field">
          <span>Месяц</span>
          <input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} />
        </label>

        <label className="field">
          <span>Стартовый баланс</span>
          <input
            type="number"
            step="0.01"
            value={startBalance}
            onChange={(event) => onStartBalanceChange(Number(event.target.value || 0))}
          />
        </label>

        <label className="switch-field">
          <span>Распределять по дням</span>
          <input
            type="checkbox"
            checked={distribution.enabled}
            onChange={(event) => onDistributionChange({ ...distribution, enabled: event.target.checked })}
          />
        </label>

        <label className="field">
          <span>Точка отсчёта</span>
          <select
            value={distribution.mode}
            onChange={(event) =>
              onDistributionChange({
                ...distribution,
                mode: event.target.value as DistributionSettings["mode"]
              })
            }
          >
            <option value="fromStart">С 1 числа</option>
            <option value="fromToday">С сегодняшнего дня</option>
            <option value="fromDate">С выбранной даты</option>
          </select>
        </label>

        {distribution.mode === "fromDate" && (
          <label className="field">
            <span>Дата отсчёта</span>
            <input
              type="date"
              value={distribution.fromDate ?? `${month}-01`}
              onChange={(event) => onDistributionChange({ ...distribution, fromDate: event.target.value })}
            />
          </label>
        )}
      </div>

      <div className="totals-row">
        <div className="metric">
          <span>Доходы</span>
          <strong>{formatMoney(forecast.totalIncome)}</strong>
        </div>
        <div className="metric">
          <span>Расходы</span>
          <strong>{formatMoney(forecast.totalExpense)}</strong>
        </div>
        <div className="metric">
          <span>Доступно за месяц</span>
          <strong>{formatMoney(forecast.availableFunds)}</strong>
        </div>
        <div className="metric">
          <span>Остаток на конец</span>
          <strong className={forecast.endBalance < 0 ? "negative" : "positive"}>{formatMoney(forecast.endBalance)}</strong>
        </div>
      </div>
    </header>
  );
}
