import { Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { formatMoney } from "../lib/money";
import { toHumanDayMonth } from "../lib/date";
import type { DailyRow } from "../types/models";

interface DailyTableProps {
  rows: DailyRow[];
  referenceDate: string | null;
}

export function DailyTable({ rows, referenceDate }: DailyTableProps) {
  const columns: ColumnsType<DailyRow> = [
    {
      title: "Дата",
      dataIndex: "date",
      width: 74,
      render: (value: string) =>
        value === referenceDate ? <Tag color="blue">{toHumanDayMonth(value)}</Tag> : toHumanDayMonth(value)
    },
    {
      title: "Доход",
      dataIndex: "income",
      width: 104,
      align: "right",
      render: (value: number) => formatMoney(value)
    },
    {
      title: "Расход",
      dataIndex: "expense",
      width: 104,
      align: "right",
      render: (value: number) => formatMoney(value)
    },
    {
      title: "Остаток",
      dataIndex: "balanceEnd",
      width: 112,
      align: "right",
      render: (value: number) => (
        <span style={{ color: value < 0 ? "#ff4d4f" : undefined, fontWeight: 600 }}>{formatMoney(value)}</span>
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
      scroll={{ y: 560 }}
      sticky
    />
  );
}
