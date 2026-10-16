import { Grid, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { formatMoney, formatMoneyShort } from "../lib/money";
import { getTodayISO, toHumanDayMonth } from "../lib/date";
import type { DailyRow } from "../types/models";

interface DailyTableProps {
  rows: DailyRow[];
  referenceDate: string | null;
}

export function DailyTable({ rows, referenceDate }: DailyTableProps) {
  const today = getTodayISO();
  const isMobile = !Grid.useBreakpoint().md;
  const money = isMobile ? formatMoneyShort : formatMoney;

  const columns: ColumnsType<DailyRow> = [
    {
      title: "Дата",
      dataIndex: "date",
      width: isMobile ? 58 : 74,
      render: (value: string) =>
        value === referenceDate ? <Tag color="blue">{toHumanDayMonth(value)}</Tag> : toHumanDayMonth(value)
    },
    {
      title: "Доход",
      dataIndex: "income",
      width: isMobile ? undefined : 120,
      align: "right",
      render: (value: number) => (value ? money(value) : <span className="cell-empty">—</span>)
    },
    {
      title: "Расход",
      dataIndex: "expense",
      width: isMobile ? undefined : 120,
      align: "right",
      render: (value: number) => (value ? money(value) : <span className="cell-empty">—</span>)
    },
    {
      title: "Остаток",
      dataIndex: "balanceEnd",
      width: isMobile ? undefined : 140,
      align: "right",
      render: (value: number) => (
        <span style={{ color: value < 0 ? "#ff4d4f" : undefined, fontWeight: 600 }}>{money(value)}</span>
      )
    }
  ];

  return (
    <Table
      className="forecast-table"
      rowKey="date"
      size="small"
      pagination={false}
      dataSource={rows}
      columns={columns}
      rowClassName={(row) => (row.date === today ? "row-today" : row.date < today ? "row-past" : "")}
      scroll={{ y: 560 }}
      sticky
    />
  );
}
