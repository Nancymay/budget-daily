import type { TransactionType } from "../types/models";

/**
 * Reading bank statements (for now: T-Bank's CSV/XLSX export) into plain
 * operations. Nothing here touches the app's data; the import sheet decides
 * what to add.
 */

export interface StatementOperation {
  /** Stable id of the bank operation, so re-importing the same file adds nothing twice. */
  key: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: TransactionType;
  amount: number; // positive, in roubles
  description: string;
  bankCategory: string;
  account: string;
  /** The bank's own "count in analytics" flag: "Нет" marks transfers between own accounts and the like. */
  counted: boolean;
  /** A positive amount on a card purchase category: most likely a refund. */
  refund: boolean;
}

export interface Statement {
  bank: string;
  operations: StatementOperation[];
  /** Rows dropped as not completed or zero-amount. */
  skipped: number;
}

type Cell = string | number | null;

// ---------- CSV ----------

function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, "");
  } catch {
    // Older exports and other banks often use Windows-1251.
    return new TextDecoder("windows-1251").decode(buffer);
  }
}

function parseCsv(text: string): Cell[][] {
  const newline = text.indexOf("\n");
  const firstLine = newline >= 0 ? text.slice(0, newline) : text;
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }
  return rows;
}

// ---------- XLSX (a zip of XML files) ----------

function columnIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let index = 0;
  for (const ch of letters) {
    index = index * 26 + (ch.charCodeAt(0) - 64);
  }
  return index - 1;
}

async function parseXlsx(buffer: ArrayBuffer): Promise<Cell[][]> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(new Uint8Array(buffer));
  const xml = (path: string) => (files[path] ? new DOMParser().parseFromString(strFromU8(files[path]), "application/xml") : null);

  const shared: string[] = [];
  const sharedDoc = xml("xl/sharedStrings.xml");
  sharedDoc?.querySelectorAll("si").forEach((si) => {
    shared.push(Array.from(si.getElementsByTagName("t"), (t) => t.textContent ?? "").join(""));
  });

  const sheetPath =
    Object.keys(files)
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .sort()[0] ?? "";
  const sheet = xml(sheetPath);
  if (!sheet) {
    throw new Error("В файле Excel не нашлось листа с операциями.");
  }

  const rows: Cell[][] = [];
  sheet.querySelectorAll("sheetData > row").forEach((rowEl) => {
    const row: Cell[] = [];
    rowEl.querySelectorAll("c").forEach((c) => {
      const index = columnIndex(c.getAttribute("r") ?? "A");
      const type = c.getAttribute("t");
      const raw = c.getElementsByTagName("v")[0]?.textContent ?? null;
      let value: Cell = raw;
      if (type === "s" && raw !== null) {
        value = shared[Number(raw)] ?? "";
      } else if (type === "inlineStr") {
        value = Array.from(c.getElementsByTagName("t"), (t) => t.textContent ?? "").join("");
      } else if ((type === null || type === "n") && raw !== null && raw !== "") {
        value = Number(raw);
      }
      row[index] = value;
    });
    if (row.some((cell) => cell !== null && cell !== undefined && cell !== "")) {
      rows.push(Array.from(row, (cell) => cell ?? null));
    }
  });
  return rows;
}

// ---------- mapping ----------

function text(cell: Cell | undefined): string {
  return cell === null || cell === undefined ? "" : String(cell).trim();
}

function number(cell: Cell | undefined): number {
  if (typeof cell === "number") {
    return cell;
  }
  const clean = text(cell).replace(/\s| /g, "").replace(",", ".");
  return clean === "" ? NaN : Number(clean);
}

/**
 * "31.10.2026 21:18:23", "2026-10-31 21:18:23" or an Excel serial date number,
 * normalised so the same operation gets the same key from CSV and from Excel.
 */
function dateTime(cell: Cell | undefined): { date: string; time: string; seconds: string } | null {
  if (typeof cell === "number" && Number.isFinite(cell)) {
    // Excel serial: days since 1899-12-30, in the bank's local time.
    const iso = new Date(Math.round((cell - 25569) * 86400) * 1000).toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16), seconds: iso.slice(17, 19) };
  }
  const value = text(cell);
  const ru = value.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ru) {
    return { date: `${ru[3]}-${ru[2]}-${ru[1]}`, time: ru[4] ? `${ru[4].padStart(2, "0")}:${ru[5]}` : "00:00", seconds: ru[6] ?? "00" };
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, time: iso[4] ? `${iso[4]}:${iso[5]}` : "00:00", seconds: iso[6] ?? "00" };
  }
  return null;
}

/** Short stable hash (FNV-1a, 52 bits) for operation keys. */
function hash(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).slice(0, 14);
}

const T_BANK_COLUMNS = {
  date: "Дата операции",
  status: "Статус",
  amount: "Сумма операции",
  accountAmount: "Сумма в валюте счёта",
  category: "Категория по-умолчанию",
  mcc: "MCC",
  description: "Описание",
  message: "Сообщение",
  account: "Имя счёта",
  counted: "Учёт в аналитике"
};

function toStatement(table: Cell[][]): Statement {
  const headerIndex = table.findIndex((row) => row.some((cell) => text(cell) === T_BANK_COLUMNS.date));
  if (headerIndex < 0) {
    throw new Error("Не узнала формат выписки. Пока поддерживается выписка Т-Банка (CSV или Excel).");
  }
  const header = table[headerIndex].map(text);
  const col = (name: string) => header.indexOf(name);
  const idx = Object.fromEntries(Object.entries(T_BANK_COLUMNS).map(([key, name]) => [key, col(name)])) as Record<
    keyof typeof T_BANK_COLUMNS,
    number
  >;
  if (idx.amount < 0 && idx.accountAmount < 0) {
    throw new Error("В выписке нет столбца с суммой операции.");
  }

  const operations: StatementOperation[] = [];
  const seen = new Map<string, number>();
  let skipped = 0;

  for (const row of table.slice(headerIndex + 1)) {
    const when = dateTime(row[idx.date]);
    const status = idx.status >= 0 ? text(row[idx.status]).toLowerCase() : "ок";
    // Prefer the amount in the account's currency (roubles) over the purchase currency.
    const signed = idx.accountAmount >= 0 && Number.isFinite(number(row[idx.accountAmount])) ? number(row[idx.accountAmount]) : number(row[idx.amount]);
    if (!when || !Number.isFinite(signed) || signed === 0 || !["ок", "ok"].includes(status)) {
      skipped += 1;
      continue;
    }

    const description = text(row[idx.description]) || text(row[idx.message]) || "Без описания";
    const account = idx.account >= 0 ? text(row[idx.account]) : "";
    const bankCategory = idx.category >= 0 ? text(row[idx.category]) : "";
    const hasMcc = idx.mcc >= 0 && text(row[idx.mcc]) !== "";
    const amount = Math.round(Math.abs(signed) * 100) / 100;

    // Two identical operations in the same second are rare but real (e.g. fee + payment): number them.
    const base = `tbank|${account}|${when.date} ${when.time}:${when.seconds}|${signed}|${description}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);

    operations.push({
      key: `tb_${hash(`${base}|${n}`)}`,
      date: when.date,
      time: when.time,
      type: signed < 0 ? "expense" : "income",
      amount,
      description,
      bankCategory,
      account,
      counted: idx.counted >= 0 ? text(row[idx.counted]).toLowerCase() !== "нет" : true,
      refund: signed > 0 && hasMcc
    });
  }

  operations.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return { bank: "Т-Банк", operations, skipped };
}

export async function readStatement(file: File): Promise<Statement> {
  const buffer = await file.arrayBuffer();
  const isZip = new Uint8Array(buffer.slice(0, 2)).join(",") === "80,75"; // "PK"
  if (/\.xls$/i.test(file.name) && !isZip) {
    throw new Error("Старый формат .xls не поддерживается — выгрузи выписку в CSV или .xlsx.");
  }
  const table = isZip ? await parseXlsx(buffer) : parseCsv(decodeText(buffer));
  return toStatement(table);
}
