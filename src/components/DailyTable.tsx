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
            <th>Остаток</th>
            <th>Дневной лимит</th>
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
                <td className={row.balanceEnd < 0 ? "negative" : ""}>{formatMoney(row.balanceEnd)}</td>
                <td>{row.dailyLimit !== null ? formatMoney(row.dailyLimit) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
