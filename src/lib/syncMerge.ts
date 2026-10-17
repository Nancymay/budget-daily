import { normalizeState } from "./storage";
import type { AppState, Settings, Transaction } from "../types/models";

/**
 * Pure merge logic for cloud sync, kept free of network code so it can be tested.
 *
 * Every transaction is its own cloud record, plus one record for the settings.
 * `base` is what this device last saw in the cloud (as JSON per record). Comparing
 * the current local state with it tells which records were changed or deleted
 * here; everything else is taken from the cloud. When the same transaction was
 * changed on both sides, this device's version wins.
 */

export type RecordKind = "transaction" | "settings";

export const SETTINGS_ID = "main";

export interface SyncBase {
  transactions: Record<string, string>;
  /** null until the first successful sync on this device. */
  settings: string | null;
}

export interface RemoteRow {
  kind: RecordKind;
  id: string;
  data: unknown;
  deleted: boolean;
  updated_at: string;
}

export interface PushRow {
  kind: RecordKind;
  id: string;
  data: unknown;
  deleted: boolean;
}

export interface MergeResult {
  state: AppState;
  push: PushRow[];
  base: SyncBase;
}

export const EMPTY_BASE: SyncBase = { transactions: {}, settings: null };

/** JSON with sorted keys and no undefined fields, so equal records compare equal whatever their key order. */
export function json(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item
  ) ?? "null";
}

function cleanTransaction(data: unknown): Transaction | null {
  return normalizeState({ transactions: [data as Transaction] }).transactions[0] ?? null;
}

function cleanSettings(data: unknown): Settings {
  return normalizeState({ settings: data as Settings, transactions: [] }).settings;
}

function union(primary: string[], secondary: string[]): string[] {
  return [...primary, ...secondary.filter((item) => !primary.includes(item))];
}

/** Both sides changed the settings: keep `primary`'s values, but don't lose categories added on the other side. */
export function mergeSettings(primary: Settings, secondary: Settings): Settings {
  return {
    ...primary,
    customCategories: {
      income: union(primary.customCategories.income, secondary.customCategories.income),
      expense: union(primary.customCategories.expense, secondary.customCategories.expense)
    },
    categoryLimits: { ...secondary.categoryLimits, ...primary.categoryLimits },
    categoryStyles: { ...secondary.categoryStyles, ...primary.categoryStyles }
  };
}

export function mergeSync(local: AppState, base: SyncBase, remote: RemoteRow[]): MergeResult {
  const push: PushRow[] = [];

  // --- transactions
  const localById = new Map(local.transactions.map((tx) => [tx.id, tx]));
  const changedHere = new Set<string>();
  for (const tx of local.transactions) {
    if (base.transactions[tx.id] !== json(tx)) {
      changedHere.add(tx.id);
    }
  }
  const deletedHere = new Set(Object.keys(base.transactions).filter((id) => !localById.has(id)));

  const merged = new Map(localById);
  for (const row of remote) {
    if (row.kind !== "transaction" || changedHere.has(row.id) || deletedHere.has(row.id)) {
      continue;
    }
    const tx = row.deleted ? null : cleanTransaction(row.data);
    if (tx && tx.id === row.id) {
      merged.set(row.id, tx);
    } else {
      merged.delete(row.id);
    }
  }

  for (const id of changedHere) {
    push.push({ kind: "transaction", id, data: merged.get(id), deleted: false });
  }
  for (const id of deletedHere) {
    push.push({ kind: "transaction", id, data: null, deleted: true });
  }

  // --- settings
  const remoteSettingsRow = remote.find((row) => row.kind === "settings" && row.id === SETTINGS_ID && !row.deleted);
  const remoteSettings = remoteSettingsRow ? cleanSettings(remoteSettingsRow.data) : null;
  let settings = local.settings;
  let pushSettings = false;

  if (base.settings === null) {
    // First sync on this device: the cloud's settings lead (a fresh phone must not
    // overwrite them with defaults), local categories are added on top.
    if (remoteSettings) {
      settings = mergeSettings(remoteSettings, local.settings);
      pushSettings = json(settings) !== json(remoteSettings);
    } else {
      pushSettings = true;
    }
  } else {
    const changedLocally = json(local.settings) !== base.settings;
    if (remoteSettings && !changedLocally) {
      settings = remoteSettings;
    } else if (remoteSettings && changedLocally) {
      settings = mergeSettings(local.settings, remoteSettings);
      pushSettings = true;
    } else if (changedLocally) {
      pushSettings = true;
    }
  }
  if (pushSettings) {
    push.push({ kind: "settings", id: SETTINGS_ID, data: settings, deleted: false });
  }

  const transactions = [...merged.values()];
  return {
    state: { settings, transactions },
    push,
    base: {
      transactions: Object.fromEntries(transactions.map((tx) => [tx.id, json(tx)])),
      settings: json(settings)
    }
  };
}

/**
 * The user may have edited something while a sync was in flight. Apply the merge
 * only to the records that did not change meanwhile; the rest stays as the user
 * left it and goes up with the next sync.
 */
export function applyOnTop(current: AppState, snapshot: AppState, merged: AppState): AppState {
  if (current === snapshot) {
    return merged;
  }
  const snap = new Map(snapshot.transactions.map((tx) => [tx.id, json(tx)]));
  const now = new Map(current.transactions.map((tx) => [tx.id, tx]));
  const result = new Map(merged.transactions.map((tx) => [tx.id, tx]));

  for (const id of new Set([...snap.keys(), ...now.keys()])) {
    const before = snap.get(id);
    const after = now.get(id);
    if (json(after) !== (before ?? "null")) {
      if (after) {
        result.set(id, after);
      } else {
        result.delete(id);
      }
    }
  }

  return {
    settings: current.settings === snapshot.settings ? merged.settings : current.settings,
    transactions: [...result.values()]
  };
}
