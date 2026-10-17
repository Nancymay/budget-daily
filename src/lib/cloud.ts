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

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error);
  if (/permission denied|does not exist|42501|42P01|PGRST/i.test(message)) {
    return "Нет доступа к таблице в Supabase — проверь SQL из настройки";
  }
  if (/fetch|network|Failed to/i.test(message)) {
    return "Не удалось связаться с сервером";
  }
  return message;
}

export type CloudStatus = "signedOut" | "syncing" | "synced" | "offline" | "error";

export interface CloudSync {
  user: User | null;
  status: CloudStatus;
  lastSyncedAt: Date | null;
  error: string;
  sendCode: (email: string) => Promise<string | null>;
  verifyCode: (email: string, code: string) => Promise<string | null>;
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
    } catch (err) {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setStatus(offline ? "offline" : "error");
      setError(offline ? "" : describeError(err));
    } finally {
      running.current = false;
    }
  }, [setState]);

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
    const onVisible = () => document.visibilityState === "visible" && void sync();
    const onOnline = () => void sync();
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
    };
  }, [sync]);

  const sendCode = useCallback(async (email: string) => {
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` }
    });
    if (!err) {
      return null;
    }
    if (/rate|seconds/i.test(err.message)) {
      return "Слишком часто — подожди минуту и попробуй снова";
    }
    return describeError(err);
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { error: err } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (!err) {
      return null;
    }
    return /fetch|network/i.test(err.message) ? describeError(err) : "Код не подошёл или устарел — запроси новый";
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    saveMeta(null);
    setLastSyncedAt(null);
    setError("");
  }, []);

  return { user, status, lastSyncedAt, error, sendCode, verifyCode, signOut, syncNow: () => void sync() };
}
