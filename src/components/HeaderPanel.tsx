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
    <header className="panel">
      <div className="panel-grid">
        <label className="field month-field">
          <span>Месяц</span>
          <input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} />
        </label>

        <label className="field start-balance-field">
          <span>Стартовый баланс</span>
          <input
            type="number"
            step="0.01"
            value={startBalance}
            onChange={(event) => onStartBalanceChange(Number(event.target.value || 0))}
          />
        </label>
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
