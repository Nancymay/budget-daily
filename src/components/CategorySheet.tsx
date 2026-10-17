import { App } from "antd";
import { useEffect, useState } from "react";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  COLOR_KEYS,
  ICON_KEYS,
  resolveCategoryStyle,
  type CategoryColor,
  type CategoryIcon
} from "../lib/categoryStyle";
import { num, plural } from "../lib/format";
import { CategoryBadge } from "./ui/CategoryBadge";
import { Icon, UI_ICONS } from "./ui/Icon";
import { Sheet } from "./ui/Sheet";
import type { CategoryStyle, TransactionType } from "../types/models";

export type CategorySheetTarget = { kind: "add"; type: TransactionType } | { kind: "edit"; type: TransactionType; name: string };

export interface CategoryDraft {
  type: TransactionType;
  name: string;
  style: CategoryStyle;
  monthlyLimit: number | null;
}

interface CategorySheetProps {
  target: CategorySheetTarget | null;
  styles: Record<string, CategoryStyle>;
  limits: Record<string, number>;
  usage: (type: TransactionType, name: string) => { count: number; total: number };
  onClose: () => void;
  /** Returns an error message, or null when saved. */
  onSave: (draft: CategoryDraft, previousName?: string) => string | null;
  onDelete: (type: TransactionType, name: string) => void;
}

export function CategorySheet({ target, styles, limits, usage, onClose, onSave, onDelete }: CategorySheetProps) {
  const { modal } = App.useApp();
  const [type, setType] = useState<TransactionType>("expense");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<CategoryIcon>("star");
  const [color, setColor] = useState<CategoryColor>("violet");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) {
      return;
    }
    setError("");
    setType(target.type);
    if (target.kind === "edit") {
      const look = resolveCategoryStyle(target.name, target.type, styles);
      setName(target.name);
      setIcon(look.icon);
      setColor(look.color);
      setLimit(limits[target.name] ? String(limits[target.name]) : "");
    } else {
      setName("");
      setIcon(target.type === "income" ? "wallet" : "star");
      setColor(target.type === "income" ? "lime" : "violet");
      setLimit("");
    }
    // Only when a new target opens: edits to styles elsewhere must not reset what is being typed.
  }, [target]);

  if (!target) {
    return null;
  }

  const editing = target.kind === "edit";
  const palette = CATEGORY_COLORS[color];
  const used = editing ? usage(target.type, target.name) : null;

  const save = () => {
    const parsedLimit = Number(limit.replace(/\s/g, "").replace(",", "."));
    const result = onSave(
      {
        type,
        name: name.trim(),
        style: { icon, color },
        monthlyLimit: type === "expense" && Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.round(parsedLimit) : null
      },
      editing ? target.name : undefined
    );
    if (result) {
      setError(result);
    } else {
      onClose();
    }
  };

  const remove = () => {
    if (!editing) {
      return;
    }
    modal.confirm({
      title: `Удалить категорию «${target.name}»?`,
      content: used && used.count > 0 ? "Операции с ней останутся, категория просто пропадёт из списка." : undefined,
      okText: "Удалить",
      okButtonProps: { danger: true },
      cancelText: "Отмена",
      onOk: () => {
        onDelete(target.type, target.name);
        onClose();
      }
    });
  };

  return (
    <Sheet
      open
      title={editing ? "Изменить категорию" : "Новая категория"}
      onClose={onClose}
      footer={
        <button type="button" className="primary-btn" onClick={save}>
          {editing ? "Сохранить" : "Создать категорию"}
        </button>
      }
    >
      <div className="cat-preview">
        <CategoryBadge look={{ path: CATEGORY_ICONS[icon].path, fg: palette.fg, bg: palette.bg }} size={76} />
        <span className="cat-preview-text">
          <strong>{name.trim() || "Название"}</strong>
          <span>
            {used
              ? `${used.count} ${plural(used.count, "операция", "операции", "операций")} · ${num(used.total)} ₽ всего`
              : "так она будет выглядеть"}
          </span>
        </span>
      </div>

      {!editing && (
        <div className="segmented" role="group" aria-label="Тип категории">
          <button type="button" className={type === "expense" ? "is-active" : ""} aria-pressed={type === "expense"} onClick={() => setType("expense")}>
            Расход
          </button>
          <button type="button" className={type === "income" ? "is-active" : ""} aria-pressed={type === "income"} onClick={() => setType("income")}>
            Доход
          </button>
        </div>
      )}

      <label className="field">
        <span className="field-caption">Название</span>
        <span className="input-wrap input-wrap--focus">
          {editing && <Icon path={UI_ICONS.pencil} size={18} color="var(--accent)" />}
          <input
            value={name}
            autoFocus={!editing}
            maxLength={40}
            placeholder="Например: Такси"
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => event.key === "Enter" && save()}
          />
        </span>
        {editing && <span className="field-hint">Все прошлые операции переедут под новое название</span>}
      </label>

      <div className="field">
        <span className="field-caption">Иконка</span>
        <div className="icon-grid">
          {ICON_KEYS.map((key) => {
            const selected = key === icon;
            return (
              <button
                key={key}
                type="button"
                aria-label={CATEGORY_ICONS[key].label}
                aria-pressed={selected}
                className={`icon-cell${selected ? " is-selected" : ""}`}
                style={selected ? { background: palette.bg, borderColor: palette.fg } : undefined}
                onClick={() => setIcon(key)}
              >
                <Icon path={CATEGORY_ICONS[key].path} size={24} strokeWidth={2} color={selected ? palette.fg : "var(--muted)"} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <span className="field-caption">Цвет</span>
        <div className="swatches">
          {COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-label={CATEGORY_COLORS[key].label}
              aria-pressed={key === color}
              className={`swatch${key === color ? " is-selected" : ""}`}
              style={{ background: CATEGORY_COLORS[key].solid }}
              onClick={() => setColor(key)}
            />
          ))}
        </div>
      </div>

      {type === "expense" && (
        <label className="row-field">
          <span>Лимит в месяц</span>
          <span className="row-field-input">
            <input inputMode="numeric" placeholder="без лимита" value={limit} onChange={(event) => setLimit(event.target.value.replace(/[^\d\s]/g, ""))} />
            {limit && <span className="muted">₽</span>}
          </span>
        </label>
      )}

      {error && <p className="form-error">{error}</p>}

      {editing && (
        <button type="button" className="danger-btn" onClick={remove}>
          <Icon path={UI_ICONS.trash} size={18} />
          Удалить категорию
        </button>
      )}
    </Sheet>
  );
}
