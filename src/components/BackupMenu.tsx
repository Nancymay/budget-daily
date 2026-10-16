import { DownloadOutlined, MoreOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, Dropdown } from "antd";
import { useRef } from "react";
import { getTodayISO } from "../lib/date";
import { parseBackup } from "../lib/storage";
import type { AppState } from "../types/models";

interface BackupMenuProps {
  state: AppState;
  onRestore: (state: AppState) => void;
}

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

export function BackupMenu({ state, onRestore }: BackupMenuProps) {
  const { message, modal } = App.useApp();
  const inputRef = useRef<HTMLInputElement>(null);

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
            { key: "export", icon: <DownloadOutlined />, label: "Сохранить копию в файл", onClick: exportData },
            { key: "import", icon: <UploadOutlined />, label: "Загрузить из файла", onClick: () => inputRef.current?.click() }
          ]
        }}
      >
        <Button icon={<MoreOutlined />} aria-label="Резервная копия" />
      </Dropdown>
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
