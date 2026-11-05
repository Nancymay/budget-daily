import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { applyOnTop, EMPTY_BASE, mergeSync, type PushRow, type RemoteRow, type SyncBase } from "./syncMerge";
import type { AppState } from "../types/models";

// The app's own PocketBase server (in Russia). Set at build time from the
// POCKETBASE_URL repository variable; without it the cloud is simply off.
const SERVER_URL = (import.meta.env.VITE_POCKETBASE_URL ?? "").trim().replace(/\/+$/, "");
const TABLE = "budget_records";
const META_KEY = "budget-daily.sync.v1";
/** PocketBase's batch limit set by the server migration. */
const BATCH_SIZE = 100;
/** Pull a bit further back than the last sync to cover clock differences between devices. */
const OVERLAP_MS = 10 * 60 * 1000;
/** Delays before retrying a sync that failed on the network (iOS often drops the first requests after resume). */
const RETRY_DELAYS_MS = [2000, 5000, 15000];
/** Give the network a moment after the app comes back from the background. */
const RESUME_DELAY_MS = 1200;

export const cloudConfigured = SERVER_URL !== "";

const pb = new PocketBase(cloudConfigured ? SERVER_URL : "http://localhost");
// Several syncs can run the same request; PocketBase would otherwise cancel the earlier one.
pb.autoCancellation(false);

// Session key left over from the previous cloud setup.
try {
  localStorage.removeItem("budget-daily.auth");
} catch {
  // storage blocked
}

export interface CloudUser {
  id: string;
  email: string;
}

interface SyncMeta {
  userId: string;
  lastPulledAt: string | null;
  base: SyncBase;
}

function loadMeta(userId: string): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    const meta = raw ? (JSON.parse(raw) as SyncMeta) : null;
    if (meta && meta.userId === userId && meta.base && typeof meta.base.transactions === "object") {
      return meta;
    }
  } catch {
    // fall through to a fresh start
  }
  return { userId, lastPulledAt: null, base: EMPTY_BASE };
}

function saveMeta(meta: SyncMeta | null): void {
  try {
    if (meta) {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } else {
      localStorage.removeItem(META_KEY);
    }
  } catch {
    // storage blocked: sync still works for this session
  }
}

/**
 * A stable 15-character record id for (user, kind, rid), so pushing the same
 * record again updates it instead of creating a copy (batch upsert needs the id).
 */
async function recordId(userId: string, kind: string, rid: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}|${kind}|${rid}`)));
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(bytes.slice(0, 15), (byte) => alphabet[byte % alphabet.length]).join("");
}

async function pullSince(since: Date | null): Promise<RemoteRow[]> {
  const records = await pb.collection(TABLE).getFullList<RecordModel>({
    batch: 500,
    sort: "updated",
    fields: "kind,rid,data,deleted,updated",
    // The value is our own date, in PocketBase's "YYYY-MM-DD HH:MM:SS.sssZ" form, so no escaping is needed.
    ...(since ? { filter: `updated > "${since.toISOString().replace("T", " ")}"` } : {})
  });
  return records.map((record) => ({
    kind: record.kind as RemoteRow["kind"],
    id: String(record.rid),
    data: record.data,
    deleted: Boolean(record.deleted),
    updated_at: String(record.updated)
  }));
}

async function pushRows(userId: string, rows: PushRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = pb.createBatch();
    for (const row of rows.slice(i, i + BATCH_SIZE)) {
      batch.collection(TABLE).upsert({
        id: await recordId(userId, row.kind, row.id),
        user: userId,
        kind: row.kind,
        rid: row.id,
        data: row.data,
        deleted: row.deleted
      });
    }
    await batch.send();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error);
}

/**
 * The request never reached the server. PocketBase reports that as status 0;
 * the underlying browser message differs (Chrome "Failed to fetch", Safari "Load failed", ...).
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ClientResponseError) {
    return error.status === 0 && !error.isAbort;
  }
  return /failed to fetch|load failed|networkerror|network connection was lost|network request failed|internet connection appears to be offline|timed? ?out/i.test(
    errorMessage(error)
  );
}

function describeError(error: unknown): string {
  if (isNetworkError(error)) {
    return "Не удалось связаться с сервером — проверь интернет";
  }
  if (error instanceof ClientResponseError) {
    if (error.status === 401) {
      return "Сессия истекла — войди заново";
    }
    if (error.status === 403) {
      return "Сервер не разрешил запрос — проверь настройку сервера";
    }
    if (error.status === 429) {
      return "Слишком много запросов — подожди минуту";
    }
    if (error.status >= 500) {
      return "Сервер временно недоступен";
    }
  }
  return errorMessage(error);
}

/** Field-level validation errors PocketBase returns as response.data.<field>.code. */
function fieldErrorCode(error: ClientResponseError, field: string): string | undefined {
  const data = error.response?.data as Record<string, { code?: string }> | undefined;
  return data?.[field]?.code;
}

export interface AuthResult {
  error?: string;
  info?: string;
}

export type CloudStatus = "signedOut" | "syncing" | "synced" | "offline" | "error";

export interface CloudSync {
  /** False when the app was built without a server address. */
  configured: boolean;
  user: CloudUser | null;
  status: CloudStatus;
  lastSyncedAt: Date | null;
  error: string;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Deletes the account and every record of it on the server. Local data stays on this device. */
  deleteAccount: () => Promise<AuthResult>;
  syncNow: () => void;
}

function toUser(record: RecordModel | null): CloudUser | null {
  return record ? { id: record.id, email: String(record.email ?? "") } : null;
}

/** Keeps the local state and the user's cloud copy in step. Local storage stays the source of truth offline. */
export function useCloudSync(state: AppState, setState: Dispatch<SetStateAction<AppState>>): CloudSync {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [status, setStatus] = useState<CloudStatus>("signedOut");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const stateRef = useRef(state);
  stateRef.current = state;
  const userRef = useRef<CloudUser | null>(null);
  const running = useRef(false);
  const again = useRef(false);
  const lastPushed = useRef<AppState | null>(null);
  const retryAttempt = useRef(0);
  const retryTimer = useRef<number | undefined>(undefined);

  const sync = useCallback(async () => {
    const current = userRef.current;
    if (!current) {
      return;
    }
    if (running.current) {
      again.current = true;
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }

    running.current = true;
    setStatus("syncing");
    try {
      do {
        again.current = false;
        const meta = loadMeta(current.id);
        const startedAt = new Date();
        const since = meta.lastPulledAt ? new Date(new Date(meta.lastPulledAt).getTime() - OVERLAP_MS) : null;
        const remote = await pullSince(since);

        const snapshot = stateRef.current;
        const result = mergeSync(snapshot, meta.base, remote);
        if (result.push.length > 0) {
          await pushRows(current.id, result.push);
        }
        saveMeta({ userId: current.id, lastPulledAt: startedAt.toISOString(), base: result.base });

        // When the merged state lands unchanged, the edit-watcher below sees it as already synced;
        // edits made during the sync make it differ, so they go up with the next round.
        lastPushed.current = result.state;
        setState((prev) => {
          const next = applyOnTop(prev, snapshot, result.state);
          return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
        });
      } while (again.current && userRef.current);

      setError("");
      setStatus("synced");
      setLastSyncedAt(new Date());
      retryAttempt.current = 0;
    } catch (err) {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      const delay = RETRY_DELAYS_MS[retryAttempt.current];
      if (err instanceof ClientResponseError && err.status === 401) {
        // The token expired or the account is gone: sign out cleanly.
        pb.authStore.clear();
        setError("");
      } else if (!offline && isNetworkError(err) && delay !== undefined) {
        // A blip, not a real error yet: stay in "syncing" and quietly try again.
        retryAttempt.current += 1;
        window.clearTimeout(retryTimer.current);
        retryTimer.current = window.setTimeout(() => void syncRef.current(), delay);
      } else {
        retryAttempt.current = 0;
        setStatus(offline ? "offline" : "error");
        setError(offline ? "" : describeError(err));
      }
    } finally {
      running.current = false;
    }
  }, [setState]);
  const syncRef = useRef(sync);
  syncRef.current = sync;

  // Session: restore on start, follow sign-in/out.
  useEffect(() => {
    if (!cloudConfigured) {
      return;
    }
    const apply = (record: RecordModel | null) => {
      const next = record && record.verified ? toUser(record) : null;
      const changed = next?.id !== userRef.current?.id;
      userRef.current = next;
      setUser(next);
      if (!next) {
        setStatus("signedOut");
      } else if (changed) {
        void sync();
      }
    };
    const unsubscribe = pb.authStore.onChange((_token, record) => apply(record), true);
    // Renew the saved session (and pick up a deleted account or a changed email).
    if (pb.authStore.isValid) {
      pb.collection("users")
        .authRefresh()
        .catch((err: unknown) => {
          if (err instanceof ClientResponseError && (err.status === 401 || err.status === 404)) {
            pb.authStore.clear();
          }
        });
    }
    return unsubscribe;
  }, [sync]);

  // Push local edits shortly after they happen.
  useEffect(() => {
    if (!userRef.current || state === lastPushed.current) {
      return;
    }
    const timer = window.setTimeout(() => void sync(), 1500);
    return () => window.clearTimeout(timer);
  }, [state, sync]);

  // Pick up changes from other devices when the app comes back, regains network, or every couple of minutes.
  useEffect(() => {
    let resumeTimer: number | undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(() => void sync(), RESUME_DELAY_MS);
      }
    };
    const onOnline = () => {
      retryAttempt.current = 0;
      void sync();
    };
    const onOffline = () => userRef.current && setStatus("offline");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = window.setInterval(() => document.visibilityState === "visible" && void sync(), 2 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(timer);
      window.clearTimeout(resumeTimer);
      window.clearTimeout(retryTimer.current);
    };
  }, [sync]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { record } = await pb.collection("users").authWithPassword(email, password);
      if (!record.verified) {
        // Not confirmed yet: don't keep the session, send the link again.
        pb.authStore.clear();
        await pb.collection("users").requestVerification(email).catch(() => undefined);
        return { error: "Почта ещё не подтверждена — мы отправили письмо со ссылкой ещё раз" };
      }
      return {};
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 400) {
        return { error: "Неверная почта или пароль" };
      }
      return { error: describeError(err) };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      await pb.collection("users").create({ email, password, passwordConfirm: password, emailVisibility: false });
      await pb.collection("users").requestVerification(email);
      return { info: "Мы отправили письмо — подтверди почту по ссылке, потом вернись сюда и нажми «Войти»." };
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 400) {
        if (fieldErrorCode(err, "email") === "validation_not_unique") {
          return { error: "Такой аккаунт уже есть — нажми «Войти»" };
        }
        if (fieldErrorCode(err, "email")) {
          return { error: "Проверь адрес почты" };
        }
        if (fieldErrorCode(err, "password")) {
          return { error: "Пароль слишком короткий — нужно минимум 8 символов" };
        }
      }
      return { error: describeError(err) };
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      await pb.collection("users").requestPasswordReset(email);
      // PocketBase answers the same whether or not the account exists.
      return { info: "Если такой аккаунт есть, на почту придёт ссылка для смены пароля." };
    } catch (err) {
      return { error: describeError(err) };
    }
  }, []);

  const signOut = useCallback(async () => {
    pb.authStore.clear();
    saveMeta(null);
    setLastSyncedAt(null);
    setError("");
  }, []);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    const current = userRef.current;
    if (!current) {
      return {};
    }
    try {
      // The server deletes all of the account's records along with it.
      await pb.collection("users").delete(current.id);
      pb.authStore.clear();
      saveMeta(null);
      setLastSyncedAt(null);
      setError("");
      return {};
    } catch (err) {
      return { error: describeError(err) };
    }
  }, []);

  return {
    configured: cloudConfigured,
    user,
    status,
    lastSyncedAt,
    error,
    signIn,
    signUp,
    resetPassword,
    signOut,
    deleteAccount,
    syncNow: () => void sync()
  };
}
