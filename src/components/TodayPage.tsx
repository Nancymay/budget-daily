import { useState } from "react";
import { diffDays, getTodayISO, isDateInPeriod, toWeekday, type Period } from "../lib/date";
import { dayMonthShort, dayOfMonth, num, plural, rub, weekdayLong } from "../lib/format";
import type { DailyRow, DistributionMode, DistributionSettings, ForecastResult } from "../types/models";

interface TodayPageProps {
  period: Period;
  forecast: ForecastResult;
  distribution: DistributionSettings;
  onDistributionChange: (value: DistributionSettings) => void;
}

const MODES: { value: DistributionMode; label: string }[] = [
  { value: "fromToday", label: "От сегодня" },
  { value: "fromStart", label: "С начала" },
  { value: "fromDate", label: "От даты" }
];

function daySub(row: DailyRow, isLast: boolean): string {
  const parts: string[] = [];
  if (row.income) {
    parts.push(`доход +${num(row.income)} ₽`);
  }
  if (row.expense) {
    parts.push(`расход ${num(row.expense)} ₽`);
  }
  if (parts.length === 0) {
    parts.push(isLast ? "последний день" : "без операций");
  }
  return parts.join(" · ");
}

export function TodayPage({ period, forecast, distribution, onDistributionChange }: TodayPageProps) {
  const today = getTodayISO();
  const [showPast, setShowPast] = useState(false);
  const { referenceDate, limitUntil, dailyLimit, shortfall, nextLimit } = forecast;

  const todayInPeriod = isDateInPeriod(today, period);
  const isToday = referenceDate === today;
  const daysLeft = referenceDate && limitUntil ? diffDays(referenceDate, limitUntil) + 1 : 0;
  const negative = shortfall > 0 || (dailyLimit !== null && dailyLimit < 0);
  const todayRow = forecast.rows.find((row) => row.date === today);
  const spentToday = todayRow?.expense ?? 0;
  const leftToday = dailyLimit !== null ? dailyLimit - spentToday : 0;
  const usedShare = dailyLimit && dailyLimit > 0 ? Math.min(100, (spentToday / dailyLimit) * 100) : spentToday > 0 ? 100 : 0;

  const pastRows = todayInPeriod ? forecast.rows.filter((row) => row.date < today) : [];
  const visibleRows = showPast ? forecast.rows : forecast.rows.filter((row) => !pastRows.includes(row));
  const lastDate = forecast.rows[forecast.rows.length - 1]?.date;

  return (
    <div className="page">
      <section className={`hero${negative ? " hero--alert" : ""}`}>
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-top">
          <span className="hero-label">{isToday ? "Можно тратить сегодня" : "Можно тратить в день"}</span>
          {daysLeft > 0 && (
            <span className="pill pill--lime">
              {limitUntil === period.end
                ? `ещё ${daysLeft} ${plural(daysLeft, "день", "дня", "дней")}`
                : `до ${dayMonthShort(limitUntil!)}`}
            </span>
          )}
        </div>
        <div className="hero-value">
          {dailyLimit === null ? "—" : num(dailyLimit)} <span className="hero-currency">₽</span>
        </div>

        {shortfall > 0 ? (
          <p className="hero-note">
            Не хватает {rub(shortfall)} до {dayMonthShort(limitUntil!)}
          </p>
        ) : (
          isToday &&
          dailyLimit !== null && (
            <p className="hero-note">
              Сегодня потрачено {rub(spentToday)} ·{" "}
              {leftToday >= 0 ? `осталось ${rub(leftToday)}` : `сверх лимита ${rub(-leftToday)}`}
            </p>
          )
        )}
        {isToday && dailyLimit !== null && shortfall === 0 && (
          <div
            className="hero-bar"
            role="progressbar"
            aria-label="Потрачено из дневного лимита"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usedShare)}
          >
            <div style={{ width: `${usedShare}%` }} />
          </div>
        )}
        {todayInPeriod && (
          <div
            className="hero-days"
            style={{ gridTemplateColumns: `repeat(${forecast.rows.length}, minmax(0, 1fr))` }}
            role="img"
            aria-label={`Дни периода: прошло ${pastRows.length} из ${forecast.rows.length}`}
          >
            {forecast.rows.map((row) => (
              <span
                key={row.date}
                className={row.date < today ? "is-past" : row.date === today ? "is-today" : undefined}
              />
            ))}
          </div>
        )}
        {nextLimit && (
          <p className="hero-note hero-note--dim">
            с {dayMonthShort(nextLimit.from)} — {rub(nextLimit.limit)} в день
          </p>
        )}

        <div className="hero-modes" role="group" aria-label="Считать лимит">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={`hero-mode${distribution.mode === mode.value ? " is-active" : ""}`}
              aria-pressed={distribution.mode === mode.value}
              onClick={() => onDistributionChange({ ...distribution, mode: mode.value })}
            >
              {mode.label}
            </button>
          ))}
          {distribution.mode === "fromDate" && (
            <input
              type="date"
              className="hero-date"
              aria-label="Дата начала расчёта"
              min={period.start}
              max={period.end}
              value={referenceDate ?? period.start}
              onChange={(event) => {
                if (event.target.value) {
                  onDistributionChange({ ...distribution, fromDate: event.target.value });
                }
              }}
            />
          )}
        </div>
      </section>

      <div className="tiles">
        <div className="tile tile--green">
          <span className="tile-label">Доходы</span>
          <span className="tile-value">+{num(forecast.totalIncome)}</span>
        </div>
        <div className="tile tile--red">
          <span className="tile-label">Расходы</span>
          <span className="tile-value">−{num(forecast.totalExpense)}</span>
        </div>
        <div className="tile">
          <span className="tile-label">На конец</span>
          <span className={`tile-value${forecast.endBalance < 0 ? " is-negative" : ""}`}>{num(forecast.endBalance)}</span>
        </div>
      </div>

      <h2 className="section-title">По дням</h2>
      <div className="card days">
        {pastRows.length > 0 && (
          <button type="button" className="days-past" onClick={() => setShowPast((value) => !value)} aria-expanded={showPast}>
            <span>
              {dayMonthShort(pastRows[0].date).split(" ")[0]} – {dayMonthShort(pastRows[pastRows.length - 1].date)} ·{" "}
              {pastRows.length} {plural(pastRows.length, "день прошёл", "дня прошло", "дней прошло")}
            </span>
            <span>{showPast ? "скрыть" : "показать"}</span>
          </button>
        )}
        {visibleRows.map((row) => {
          const isTodayRow = row.date === today;
          return (
            <div key={row.date} className={`day${isTodayRow ? " day--today" : ""}${row.date < today ? " day--past" : ""}`}>
              <div className="day-badge">
                <span className="day-num">{dayOfMonth(row.date)}</span>
                <span className="day-wd">{toWeekday(row.date)}</span>
              </div>
              <div className="day-text">
                <span className="day-title">{isTodayRow ? "Сегодня" : weekdayLong(row.date)}</span>
                <span className="day-sub">{daySub(row, row.date === lastDate)}</span>
              </div>
              <span className={`day-balance${row.balanceEnd < 0 ? " is-negative" : ""}`}>{num(row.balanceEnd)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
