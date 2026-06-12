import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type TimerMode = "focus" | "short" | "long";

export const TIMER_PRESETS: Record<
  TimerMode,
  { label: string; minutes: number }
> = {
  focus: { label: "Фокус", minutes: 25 },
  short: { label: "Перерыв", minutes: 5 },
  long: { label: "Отдых", minutes: 15 },
};

const TIMER_KEY = "mindgarden.timer.v1";

interface PersistedTimer {
  mode: TimerMode;
  /** epoch ms when the timer will hit zero (only if running) */
  endsAt: number | null;
  /** remaining seconds when paused */
  remaining: number;
  sessionsDone: number;
}

function load(): PersistedTimer {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (raw) return JSON.parse(raw) as PersistedTimer;
  } catch {
    /* ignore */
  }
  return {
    mode: "focus",
    endsAt: null,
    remaining: TIMER_PRESETS.focus.minutes * 60,
    sessionsDone: 0,
  };
}

interface TimerContextValue {
  mode: TimerMode;
  running: boolean;
  /** remaining seconds */
  remaining: number;
  totalSeconds: number;
  sessionsDone: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setMode: (mode: TimerMode) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedTimer>(load);
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    localStorage.setItem(TIMER_KEY, JSON.stringify(state));
  }, [state]);

  const running = state.endsAt !== null;
  const remaining = running
    ? Math.max(0, Math.round(((state.endsAt as number) - now) / 1000))
    : state.remaining;
  const totalSeconds = TIMER_PRESETS[state.mode].minutes * 60;

  // tick while running
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => setNow(Date.now()), 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running]);

  // completion
  useEffect(() => {
    if (running && remaining <= 0) {
      setState(s => {
        const finishedFocus = s.mode === "focus";
        const nextMode: TimerMode = finishedFocus
          ? (s.sessionsDone + 1) % 4 === 0
            ? "long"
            : "short"
          : "focus";
        return {
          mode: nextMode,
          endsAt: null,
          remaining: TIMER_PRESETS[nextMode].minutes * 60,
          sessionsDone: finishedFocus ? s.sessionsDone + 1 : s.sessionsDone,
        };
      });
      // gentle chime via Web Audio (no asset needed)
      try {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = 660;
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 1.2);
        }
      } catch {
        /* audio unavailable */
      }
    }
  }, [running, remaining]);

  const start = useCallback(() => {
    setNow(Date.now());
    setState(s =>
      s.endsAt !== null ? s : { ...s, endsAt: Date.now() + s.remaining * 1000 },
    );
  }, []);

  const pause = useCallback(() => {
    setState(s => {
      if (s.endsAt === null) return s;
      return {
        ...s,
        endsAt: null,
        remaining: Math.max(0, Math.round((s.endsAt - Date.now()) / 1000)),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState(s => ({
      ...s,
      endsAt: null,
      remaining: TIMER_PRESETS[s.mode].minutes * 60,
    }));
  }, []);

  const setMode = useCallback((mode: TimerMode) => {
    setState(s => ({
      ...s,
      mode,
      endsAt: null,
      remaining: TIMER_PRESETS[mode].minutes * 60,
    }));
  }, []);

  const value = useMemo(
    () => ({
      mode: state.mode,
      running,
      remaining,
      totalSeconds,
      sessionsDone: state.sessionsDone,
      start,
      pause,
      reset,
      setMode,
    }),
    [
      state.mode,
      running,
      remaining,
      totalSeconds,
      state.sessionsDone,
      start,
      pause,
      reset,
      setMode,
    ],
  );

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${`${s}`.padStart(2, "0")}`;
}
