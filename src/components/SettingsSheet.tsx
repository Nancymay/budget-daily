import { App } from "antd";
import { useEffect, useRef, useState } from "react";
import { getPeriodFor, getTodayISO, type Period } from "../lib/date";
import { dayMonthShort, num, periodLabel } from "../lib/format";
import { parseBackup } from "../lib/storage";
import type { CloudSync } from "../lib/cloud";
import { CloudSection } from "./CloudSection";
import { Icon, UI_ICONS } from "./ui/Icon";
import { Sheet } from "./ui/Sheet";
import { useConfirm } from "./ui/ConfirmDialog";
import type { AppState, PeriodMode } from "../types/models";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  state: AppState;
  period: Period;
  startBalance: number;
  onStartBalanceChange: (value: number) => void;
  onPeriodModeChange: (mode: PeriodMode) => void;
  onPayDaysChange: (payDays: number[]) => void;
  onRestore: (state: AppState) => void;
  cloud: CloudSync;
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

export function SettingsSheet({
  open,
  onClose,
  state,
  period,
  startBalance,
  onStartBalanceChange,
  onPeriodModeChange,
  onPayDaysChange,
  onRestore,
  cloud
}: SettingsSheetProps) {
  const { message } = App.useApp();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const { payDays, periodMode } = state.settings;
  const [balance, setBalance] = useState("");

  useEffect(() => {
    if (open) {
      setBalance(String(startBalance).replace(".", ","));
    }
  }, [open, startBalance]);

  const today = getTodayISO();
  const payPeriod = getPeriodFor(today, payDays);
  const monthPeriod = getPeriodFor(today, []);

  const commitBalance = () => {
    const value = Number(balance.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(value) && value !== startBalance) {
      onStartBalanceChange(value);
    }
  };

  const exportData = () => {
    downloadJson({ app: "budget-daily", exportedAt: new Date().toISOString(), ...state }, `budget-daily-${today}.json`);
    message.success("Резервная копия сохранена");
  };

  const importFile = async (file: File) => {
    try {
      const restored = parseBackup(await file.text());
      const ok = await confirm({
        title: "Заменить данные из файла?",
        text: `В файле ${restored.transactions.length} операций. Текущие данные (${state.transactions.length} операций) будут заменены.`,
        confirmText: "Заменить",
        icon: "alert"
      });
      if (ok) {
        onRestore(restored);
        onClose();
        message.success("Данные восстановлены");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Не удалось прочитать файл");
    }
  };

  const modeCard = (mode: PeriodMode, title: string, current: Period) => {
    const active = periodMode === mode;
    return (
      <button type="button" className={`radio-card${active ? " is-active" : ""}`} aria-pressed={active} onClick={() => onPeriodModeChange(mode)}>
        <span className="radio" aria-hidden="true">
          <span />
        </span>
        <span className="radio-text">
          <strong>{title}</strong>
          <span>сейчас: {periodLabel(current, false)}</span>
        </span>
      </button>
    );
  };

  const freeDays = Array.from({ length: 31 }, (_, index) => index + 1).filter((day) => !payDays.includes(day));

  return (
    <Sheet open={open} title="Настройки" onClose={onClose}>
      <CloudSection cloud={cloud} />

      <div className="field">
        <span className="field-caption">Как считать период</span>
        {modeCard("pay", "От зарплаты до зарплаты", payPeriod)}
        {periodMode === "pay" && (
          <div className="paydays">
            <span className="paydays-label">Зарплата приходит</span>
            {payDays.map((day) => (
              <span key={day} className="payday">
                {day}-го
                <button
                  type="button"
                  aria-label={`Убрать ${day}-е число`}
                  onClick={() => onPayDaysChange(payDays.filter((item) => item !== day))}
                >
                  <Icon path={UI_ICONS.close} size={12} strokeWidth={3} />
                </button>
              </span>
            ))}
            <label className="payday-add">
              <span aria-hidden="true">+</span>
              <select
                aria-label="Добавить день зарплаты"
                value=""
                onChange={(event) => {
                  const day = Number(event.target.value);
                  if (day) {
                    onPayDaysChange([...payDays, day].sort((a, b) => a - b));
                  }
                }}
              >
                <option value="">день</option>
                {freeDays.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <span className="field-hint paydays-hint">Если день выпадает на выходные, период начинается с пятницы.</span>
          </div>
        )}
        {modeCard("month", "Календарный месяц", monthPeriod)}
      </div>

      <label className="field">
        <span className="field-caption">Остаток на начало периода</span>
        <span className="input-wrap">
          <input
            inputMode="decimal"
            value={balance}
            onChange={(event) => setBalance(event.target.value.replace(/[^\d.,\s-]/g, ""))}
            onBlur={commitBalance}
            onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
          />
          <span className="muted">₽</span>
        </span>
        <span className="field-hint">
          На {dayMonthShort(period.start)} — {num(startBalance)} ₽. Остальные периоды пересчитаются от этой суммы.
        </span>
      </label>

      <div className="field">
        <span className="field-caption">Резервная копия</span>
        <div className="card card--rows card--soft">
          <button type="button" className="menu-row" onClick={exportData}>
            <span className="menu-icon menu-icon--lime">
              <Icon path={UI_ICONS.download} size={20} strokeWidth={2.4} />
            </span>
            <span className="menu-text">
              <strong>Скачать копию</strong>
              <span>все операции и настройки в .json</span>
            </span>
          </button>
          <button type="button" className="menu-row" onClick={() => inputRef.current?.click()}>
            <span className="menu-icon menu-icon--blue">
              <Icon path={UI_ICONS.upload} size={20} strokeWidth={2.4} />
            </span>
            <span className="menu-text">
              <strong>Загрузить из файла</strong>
              <span className="warn-text">заменит текущие данные</span>
            </span>
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            void importFile(file);
          }
        }}
      />
    </Sheet>
  );
}
