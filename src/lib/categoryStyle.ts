import type { CategoryStyle, TransactionType } from "../types/models";

/** Stroke icons on a 24×24 grid, one path each. */
export const CATEGORY_ICONS = {
  cafe: { label: "Кафе", path: "M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V8zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v2M12 3v2" },
  food: { label: "Продукты", path: "M3 4h2l2.5 11h11L21 7H6.5M9 20h.01M18 20h.01" },
  home: { label: "Дом", path: "M4 11l8-7 8 7v9H4zM10 20v-5h4v5" },
  bus: { label: "Транспорт", path: "M5 16V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v9M5 16h14M5 11h14M8 19v-3M16 19v-3" },
  car: { label: "Машина", path: "M4 13l2-6h12l2 6v4H4zM6 17v2M18 17v2M7.5 14h.01M16.5 14h.01" },
  heart: { label: "Здоровье", path: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" },
  gift: { label: "Подарки", path: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0" },
  phone: { label: "Связь", path: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2" },
  shirt: { label: "Одежда", path: "M8 4l4 2 4-2 4 4-3 3v9H7v-9L4 8z" },
  ticket: { label: "Развлечения", path: "M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM14 7v10" },
  gym: { label: "Спорт", path: "M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12" },
  plane: { label: "Путешествия", path: "M10 14l-6 2v-2l6-4V5a2 2 0 0 1 4 0v5l6 4v2l-6-2v4l2 2h-6l2-2z" },
  book: { label: "Учёба", path: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10" },
  star: { label: "Хобби", path: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" },
  wallet: { label: "Деньги", path: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7zM4 7l11-3v3M16 13h.01" }
} as const;

export type CategoryIcon = keyof typeof CATEGORY_ICONS;

/** fg: icon/text on the tint; bg: the tint; solid: bars and swatches. */
export const CATEGORY_COLORS = {
  orange: { label: "Оранжевый", fg: "#C2410C", bg: "#FFE9D9", solid: "#FF8A3D" },
  green: { label: "Зелёный", fg: "#137A43", bg: "#DDF7E4", solid: "#18A058" },
  violet: { label: "Фиолетовый", fg: "#4B2FD8", bg: "#EEE9FF", solid: "#5B3DF5" },
  blue: { label: "Синий", fg: "#1D5FD1", bg: "#DDEBFF", solid: "#2F7CF6" },
  pink: { label: "Розовый", fg: "#BE185D", bg: "#FFE0EF", solid: "#EC4899" },
  yellow: { label: "Жёлтый", fg: "#8A5A00", bg: "#FFF1C2", solid: "#F5B700" },
  lime: { label: "Лаймовый", fg: "#14131A", bg: "#C8F55A", solid: "#9BD12E" }
} as const;

export type CategoryColor = keyof typeof CATEGORY_COLORS;

export const ICON_KEYS = Object.keys(CATEGORY_ICONS) as CategoryIcon[];
export const COLOR_KEYS = Object.keys(CATEGORY_COLORS) as CategoryColor[];

export function isCategoryIcon(value: unknown): value is CategoryIcon {
  return typeof value === "string" && value in CATEGORY_ICONS;
}

export function isCategoryColor(value: unknown): value is CategoryColor {
  return typeof value === "string" && value in CATEGORY_COLORS;
}

// Guesses a fitting look from the category name so existing categories don't all look the same.
const GUESSES: [RegExp, CategoryIcon, CategoryColor][] = [
  [/кафе|ресторан|кофе|обед|еда вне|бар/i, "cafe", "orange"],
  [/продукт|магазин|супермаркет|еда/i, "food", "green"],
  [/аренд|квартир|жкх|коммунал|дом|ипотек/i, "home", "violet"],
  [/такси|машин|бензин|авто|парков/i, "car", "yellow"],
  [/транспорт|метро|автобус|проезд/i, "bus", "blue"],
  [/здоров|аптек|врач|медиц|лекарств/i, "heart", "pink"],
  [/подар/i, "gift", "pink"],
  [/связь|телефон|интернет|мобил/i, "phone", "blue"],
  [/одежд|обув/i, "shirt", "violet"],
  [/развлеч|кино|театр|концерт|подписк/i, "ticket", "orange"],
  [/спорт|фитнес|зал/i, "gym", "green"],
  [/путешеств|отпуск|отдых|билет/i, "plane", "blue"],
  [/учёб|учеб|курс|книг|образов/i, "book", "yellow"],
  [/хобби/i, "star", "yellow"],
  [/зарплат|аванс|доход|подработ|преми|кэшбэк/i, "wallet", "lime"]
];

export function defaultCategoryStyle(name: string, type: TransactionType): CategoryStyle {
  const hit = GUESSES.find(([pattern]) => pattern.test(name));
  if (hit) {
    return { icon: hit[1], color: hit[2] };
  }
  if (type === "income") {
    return { icon: "wallet", color: "lime" };
  }
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return { icon: "star", color: COLOR_KEYS[hash % (COLOR_KEYS.length - 1)] };
}

export interface ResolvedCategoryStyle {
  icon: CategoryIcon;
  path: string;
  color: CategoryColor;
  fg: string;
  bg: string;
  solid: string;
}

export function resolveCategoryStyle(
  name: string,
  type: TransactionType,
  styles: Record<string, CategoryStyle>
): ResolvedCategoryStyle {
  const chosen = styles[name];
  const style = chosen && isCategoryIcon(chosen.icon) && isCategoryColor(chosen.color) ? chosen : defaultCategoryStyle(name, type);
  const icon = style.icon as CategoryIcon;
  const color = style.color as CategoryColor;
  return { icon, path: CATEGORY_ICONS[icon].path, color, ...CATEGORY_COLORS[color] };
}
