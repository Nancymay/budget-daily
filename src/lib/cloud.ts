import { createClient, type User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { applyOnTop, EMPTY_BASE, mergeSync, type PushRow, type RemoteRow, type SyncBase } from "./syncMerge";
import type { AppState } from "../types/models";

// Public by design: the publishable key only works together with the row-level
// security rules on the table, which limit every user to their own rows.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://jtpicakfluftkftydaka.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_OALwwVhRmnwGjvtx9T768A_Ip1NMcOL";
const TABLE = "budget_records";
const META_KEY = "budget-daily.sync.v1";
const PAGE = 1000;
/** Pull a bit further back than the last sync to cover clock differences between devices. */
const OVERLAP_MS = 10 * 60 * 1000;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "budget-daily.auth" }
});

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

async function pullSince(since: string | null): Promise<RemoteRow[]> {
  const rows: RemoteRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(TABLE).select("kind,id,data,deleted,updated_at").order("updated_at").range(from, from + PAGE - 1);
    if (since) {
      query = query.gt("updated_at", since);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    rows.push(...((data ?? []) as RemoteRow[]));
    if (!data || data.length < PAGE) {
      return rows;
    }
  }
}

async function pushRows(userId: string, rows: PushRow[]): Promise<void> {
  const updatedAt = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((row) => ({ ...row, user_id: userId, updated_at: updatedAt }));
    const { error } = await supabase.from(TABLE).upsert(chunk, { onConflict: "user_id,kind,id" });
    if (error) {
      throw error;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error);
}

/**
 * The request never reached the server. Each browser words this differently:
 * Chrome "Failed to fetch", Safari "Load failed" / "The network connection was lost",
 * Firefox "NetworkError when attempting to fetch resource".
 */
export function isNetworkError(error: unknown): boolean {
  return /failed to fetch|load failed|networkerror|network connection was lost|network request failed|internet connection appears to be offline|timed? ?out|cancelled/i.test(
    errorMessage(error)
  );
}

/** Delays before retrying a sync that failed on the network (iOS often drops the first requests after resume). */
const RETRY_DELAYS_MS = [2000, 5000, 15000];
/** Give the network a moment after the app comes back from the background. */
const RESUME_DELAY_MS = 1200;

function describeError(error: unknown): string {
  const message = errorMessage(error);
  if (isNetworkError(message)) {
    return "Не удалось связаться с сервером — проверь интернет";
  }
  if (/permission denied|does not exist|42501|42P01|PGRST/i.test(message)) {
    return "Нет доступа к таблице в Supabase — проверь SQL из настройки";
  }
  return message;
}

export interface AuthResult {
  error?: string;
  info?: string;
}

function describeAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "Неверная почта или пароль";
  }
  if (/not confirmed/i.test(message)) {
    return "Почта ещё не подтверждена — нажми ссылку в письме от Supabase";
  }
  if (/already registered|already exists/i.test(message)) {
    return "Такой аккаунт уже есть — нажми «Войти»";
  }
  if (/password/i.test(message) && /least|short|characters/i.test(message)) {
    return "Пароль слишком короткий — нужно минимум 6 символов";
  }
  if (/rate|seconds|too many/i.test(message)) {
    return "Слишком много попыток — подожди минуту";
  }
  if (/signups? not allowed|disabled/i.test(message)) {
    return "Регистрация новых аккаунтов выключена";
  }
  return describeError(message);
}

export type CloudStatus = "signedOut" | "syncing" | "synced" | "offline" | "error";

export interface CloudSync {
  user: User | null;
  status: CloudStatus;
  lastSyncedAt: Date | null;
  error: string;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  syncNow: () => void;
}

/** Keeps the local state and the user's cloud copy in step. Local storage stays the source of truth offline. */
export function useCloudSync(state: AppState, setState: Dispatch<SetStateAction<AppState>>): CloudSync {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<CloudStatus>("signedOut");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const stateRef = useRef(state);
  stateRef.current = state;
  const userRef = useRef<User | null>(null);
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
        const since = meta.lastPulledAt ? new Date(new Date(meta.lastPulledAt).getTime() - OVERLAP_MS).toISOString() : null;
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
      if (!offline && isNetworkError(err) && delay !== undefined) {
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
    const apply = (next: User | null) => {
      const changed = next?.id !== userRef.current?.id;
      userRef.current = next;
      setUser(next);
      if (!next) {
        setStatus("signedOut");
      } else if (changed) {
        void sync();
      }
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user ?? null));
    return () => data.subscription.unsubscribe();
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
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    return err ? { error: describeAuthError(err.message) } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` }
    });
    if (err) {
      return { error: describeAuthError(err.message) };
    }
    // With "Confirm email" on, Supabase sends a link first and gives no session yet.
    return data.session ? {} : { info: "Мы отправили письмо — подтверди почту по ссылке, потом вернись сюда и нажми «Войти»." };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    saveMeta(null);
    setLastSyncedAt(null);
    setError("");
  }, []);

  return { user, status, lastSyncedAt, error, signIn, signUp, signOut, syncNow: () => void sync() };
}
