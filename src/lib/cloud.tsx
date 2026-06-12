import type { User } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cloudEnabled, getSupabase } from "@/lib/supabase";

export type SyncStatus = "off" | "syncing" | "synced" | "error";

interface CloudContextValue {
  /** true when the app is built with Supabase credentials */
  enabled: boolean;
  /** current signed-in user (null = local-only mode) */
  user: User | null;
  /** true until the initial session check completes */
  loading: boolean;
  syncStatus: SyncStatus;
  /** used by the vault sync engine */
  setSyncStatus: (s: SyncStatus) => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const CloudContext = createContext<CloudContextValue | null>(null);

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Неверный email или пароль";
  }
  if (
    m.includes("already registered") ||
    m.includes("already been registered")
  ) {
    return "Этот email уже зарегистрирован — попробуй войти";
  }
  if (m.includes("password should be at least")) {
    return "Пароль слишком короткий (минимум 6 символов)";
  }
  if (m.includes("valid email") || m.includes("invalid format")) {
    return "Некорректный email";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Слишком много попыток — подожди минуту";
  }
  if (m.includes("not confirmed")) {
    return "Email не подтверждён — проверь почту";
  }
  return message;
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(cloudEnabled);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");

  useEffect(() => {
    const supa = getSupabase();
    if (!supa) return;
    supa.auth
      .getSession()
      .then(({ data }) => {
        setUser(data.session?.user ?? null);
      })
      .finally(() => setLoading(false));
    const { data: sub } = supa.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supa = getSupabase();
    if (!supa) return "Облако не настроено в этой сборке";
    const { error } = await supa.auth.signInWithPassword({ email, password });
    return error ? translateAuthError(error.message) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supa = getSupabase();
    if (!supa) return "Облако не настроено в этой сборке";
    const { data, error } = await supa.auth.signUp({ email, password });
    if (error) return translateAuthError(error.message);
    if (!data.session) {
      return "Аккаунт создан — подтверди email по ссылке из письма, затем войди";
    }
    return null;
  }, []);

  const signOut = useCallback(async () => {
    const supa = getSupabase();
    if (!supa) return;
    await supa.auth.signOut();
    setSyncStatus("off");
  }, []);

  const value = useMemo(
    () => ({
      enabled: cloudEnabled,
      user,
      loading,
      syncStatus,
      setSyncStatus,
      signIn,
      signUp,
      signOut,
    }),
    [user, loading, syncStatus, signIn, signUp, signOut],
  );

  return (
    <CloudContext.Provider value={value}>{children}</CloudContext.Provider>
  );
}

export function useCloud(): CloudContextValue {
  const ctx = useContext(CloudContext);
  if (!ctx) throw new Error("useCloud must be used within CloudProvider");
  return ctx;
}
