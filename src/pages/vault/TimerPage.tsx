import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatClock,
  TIMER_PRESETS,
  type TimerMode,
  useTimer,
} from "@/lib/timer";
import { cn } from "@/lib/utils";

const MODE_HINTS: Record<TimerMode, string> = {
  focus: "25 минут глубокой работы. Одна задача, никаких отвлечений.",
  short: "5 минут передышки. Встань, разомнись, посмотри в окно.",
  long: "15 минут отдыха после четырёх фокус-сессий. Ты заслужил.",
};

export function TimerPage() {
  const {
    mode,
    running,
    remaining,
    totalSeconds,
    sessionsDone,
    start,
    pause,
    reset,
    setMode,
  } = useTimer();

  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 0;
  const R = 130;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-8 p-6"
      data-testid="timer-page"
    >
      <div className="flex gap-1 rounded-full border border-border/60 bg-card p-1">
        {(Object.keys(TIMER_PRESETS) as TimerMode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {TIMER_PRESETS[m].label}
          </button>
        ))}
      </div>

      <div className="relative">
        <svg width="300" height="300" viewBox="0 0 300 300" aria-hidden="true">
          <circle
            cx="150"
            cy="150"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-border"
          />
          <circle
            cx="150"
            cy="150"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            transform="rotate(-90 150 150)"
            className={cn(
              "transition-[stroke-dashoffset] duration-500",
              mode === "focus" ? "text-primary" : "text-success",
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono text-6xl font-semibold tabular-nums"
            data-testid="timer-clock"
          >
            {formatClock(remaining)}
          </span>
          <span className="mt-1 text-sm text-muted-foreground">
            {TIMER_PRESETS[mode].label}
            {running ? " · идёт" : ""}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="lg"
          className="h-12 w-36 text-base"
          onClick={running ? pause : start}
          data-testid="timer-toggle"
        >
          {running ? (
            <>
              <Pause className="size-5" /> Пауза
            </>
          ) : (
            <>
              <Play className="size-5" /> Старт
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-12"
          onClick={reset}
          aria-label="Сбросить"
        >
          <RotateCcw className="size-5" />
        </Button>
      </div>

      <div className="max-w-sm text-center">
        <p className="text-sm text-muted-foreground">{MODE_HINTS[mode]}</p>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length indicator
            <span
              key={i}
              className={cn(
                "size-2.5 rounded-full",
                i < sessionsDone % 4 ? "bg-primary" : "bg-border",
              )}
            />
          ))}
          <span className="ml-2 text-muted-foreground">
            {sessionsDone} фокус-сессий сегодня
          </span>
        </p>
      </div>
    </div>
  );
}
