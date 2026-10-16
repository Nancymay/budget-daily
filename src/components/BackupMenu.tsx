import { CalendarOutlined, DownloadOutlined, MoreOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, Dropdown, Modal, Select, Typography } from "antd";
import { useRef, useState } from "react";
import { getTodayISO } from "../lib/date";
import { parseBackup } from "../lib/storage";
import type { AppState } from "../types/models";

interface BackupMenuProps {
  state: AppState;
  onRestore: (state: AppState) => void;
  payDays: number[];
  onPayDaysChange: (payDays: number[]) => void;
}

const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => ({ value: index + 1, label: String(index + 1) }));

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BackupMenu({ state, onRestore, payDays, onPayDaysChange }: BackupMenuProps) {
  const { message, modal } = App.useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [payDaysOpen, setPayDaysOpen] = useState(false);
  const [draftPayDays, setDraftPayDays] = useState<number[]>(payDays);

  const exportData = () => {
    downloadJson({ app: "budget-daily", exportedAt: new Date().toISOString(), ...state }, `budget-daily-${getTodayISO()}.json`);
    message.success("Резервная копия сохранена");
  };

  const importFile = async (file: File) => {
    try {
      const restored = parseBackup(await file.text());
      modal.confirm({
        title: "Заменить данные из файла?",
        content: `В файле ${restored.transactions.length} транзакций. Текущие данные (${state.transactions.length} транзакций) будут заменены.`,
        okText: "Заменить",
        okButtonProps: { danger: true },
        cancelText: "Отмена",
        onOk: () => {
          onRestore(restored);
          message.success("Данные восстановлены");
        }
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Не удалось прочитать файл");
    }
  };

  return (
    <>
      <Dropdown
        trigger={["click"]}
        menu={{
          items: [
            {
              key: "paydays",
              icon: <CalendarOutlined />,
              label: "Дни зарплаты",
              onClick: () => {
                setDraftPayDays(payDays);
                setPayDaysOpen(true);
              }
            },
            { type: "divider" },
            { key: "export", icon: <DownloadOutlined />, label: "Сохранить копию в файл", onClick: exportData },
            { key: "import", icon: <UploadOutlined />, label: "Загрузить из файла", onClick: () => inputRef.current?.click() }
          ]
        }}
      >
        <Button icon={<MoreOutlined />} aria-label="Меню" />
      </Dropdown>
      <Modal
        title="Дни зарплаты"
        open={payDaysOpen}
        okText="Сохранить"
        cancelText="Отмена"
        onCancel={() => setPayDaysOpen(false)}
        onOk={() => {
          onPayDaysChange([...draftPayDays].sort((a, b) => a - b));
          setPayDaysOpen(false);
        }}
      >
        <Select
          mode="multiple"
          style={{ width: "100%" }}
          placeholder="Например: 5 и 20"
          value={draftPayDays}
          onChange={setDraftPayDays}
          options={DAY_OPTIONS}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          Бюджет делится на периоды от одной зарплаты до следующей. Если день выпадает на субботу или воскресенье,
          период начинается с пятницы. Без дней зарплаты бюджет считается по календарным месяцам.
        </Typography.Paragraph>
      </Modal>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            void importFile(file);
          }
        }}
      />
    </>
  );
}
