import { formatMoney } from "../lib/money";
import { toHumanDate } from "../lib/date";
import type { DailyRow } from "../types/models";

interface DailyTableProps {
  rows: DailyRow[];
  referenceDate: string | null;
}

export function DailyTable({ rows, referenceDate }: DailyTableProps) {
  return (
    <div className="panel table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Дата</th>
            <th>Доход</th>
            <th>Расход</th>
            <th>Остаток на начало</th>
            <th>Остаток на конец</th>
            <th>Дневной лимит</th>
            <th>Проекция остатка</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isRef = row.date === referenceDate;
            return (
              <tr key={row.date} className={isRef ? "reference-row" : ""}>
                <td>{toHumanDate(row.date)}</td>
                <td>{formatMoney(row.income)}</td>
                <td>{formatMoney(row.expense)}</td>
                <td className={row.balanceStart < 0 ? "negative" : ""}>{formatMoney(row.balanceStart)}</td>
                <td className={row.balanceEnd < 0 ? "negative" : ""}>{formatMoney(row.balanceEnd)}</td>
                <td>{row.dailyLimit !== null ? formatMoney(row.dailyLimit) : "—"}</td>
                <td className={row.projectedEnd !== null && row.projectedEnd < 0 ? "negative" : ""}>
                  {row.projectedEnd !== null ? formatMoney(row.projectedEnd) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
