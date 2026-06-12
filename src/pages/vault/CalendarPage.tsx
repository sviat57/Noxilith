import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toDayKey, useVault } from "@/lib/vault";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const monthFmt = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
});
const dayFmt = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function CalendarPage() {
  const { notes, tasks, addTask, toggleTask, deleteTask } = useVault();
  const navigate = useNavigate();
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState<string>(toDayKey(Date.now()));
  const [newTask, setNewTask] = useState("");

  const notesByDay = useMemo(() => {
    const m = new Map<string, typeof notes>();
    for (const n of notes) {
      const k = toDayKey(n.createdAt);
      const arr = m.get(k) ?? [];
      arr.push(n);
      m.set(k, arr);
    }
    return m;
  }, [notes]);

  const tasksByDay = useMemo(() => {
    const m = new Map<string, typeof tasks>();
    for (const t of tasks) {
      const arr = m.get(t.due) ?? [];
      arr.push(t);
      m.set(t.due, arr);
    }
    return m;
  }, [tasks]);

  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const start = new Date(first);
    start.setDate(1 - startOffset);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    const out: Date[][] = [];
    for (let i = 0; i < 6; i++) out.push(cells.slice(i * 7, i * 7 + 7));
    return out;
  }, [cursor]);

  const todayKey = toDayKey(Date.now());
  const selNotes = notesByDay.get(selected) ?? [];
  const selTasks = (tasksByDay.get(selected) ?? []).sort((a, b) =>
    a.done === b.done ? a.createdAt - b.createdAt : a.done ? 1 : -1,
  );
  const openTaskCount = tasks.filter(t => !t.done).length;

  const submitTask = () => {
    if (!newTask.trim()) return;
    addTask(newTask, selected);
    setNewTask("");
  };

  const selDate = new Date(`${selected}T00:00:00`);

  return (
    <div className="flex h-full min-w-0 max-lg:flex-col">
      {/* Calendar grid */}
      <div className="flex min-w-0 flex-1 flex-col p-4 lg:p-6">
        <header className="mb-4 flex items-center gap-2">
          <h1 className="text-xl font-semibold" data-testid="calendar-month">
            {capitalize(monthFmt.format(cursor))}
          </h1>
          <span className="text-sm text-muted-foreground">
            · {openTaskCount} открытых задач
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
                setSelected(todayKey);
              }}
            >
              Сегодня
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Предыдущий месяц"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                )
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Следующий месяц"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                )
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1">
          {weeks.flat().map(d => {
            const key = toDayKey(d.getTime());
            const inMonth = d.getMonth() === cursor.getMonth();
            const dayNotes = notesByDay.get(key) ?? [];
            const dayTasks = tasksByDay.get(key) ?? [];
            const openTasks = dayTasks.filter(t => !t.done).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors",
                  inMonth
                    ? "border-border/50"
                    : "border-transparent opacity-40",
                  selected === key
                    ? "border-primary/50 bg-primary/10"
                    : "hover:bg-accent",
                )}
                data-testid={key === todayKey ? "calendar-today" : undefined}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs",
                    key === todayKey &&
                      "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {d.getDate()}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {dayNotes.length > 0 && (
                    <span className="flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-medium text-primary">
                      <FileText className="size-2.5" />
                      {dayNotes.length}
                    </span>
                  )}
                  {dayTasks.length > 0 && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium",
                        openTasks > 0
                          ? "bg-warning/20 text-warning"
                          : "bg-success/20 text-success",
                      )}
                    >
                      <CheckCircle2 className="size-2.5" />
                      {dayTasks.filter(t => t.done).length}/{dayTasks.length}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day panel */}
      <aside className="flex w-80 shrink-0 flex-col border-l border-border/60 bg-sidebar/50 max-lg:w-full max-lg:border-l-0 max-lg:border-t">
        <div className="border-b border-border/60 p-4">
          <h2 className="font-semibold">
            {capitalize(dayFmt.format(selDate))}
          </h2>
          <p className="text-xs text-muted-foreground">
            {selNotes.length} заметок · {selTasks.length} задач
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Задачи
            </h3>
            <div className="mb-2 flex gap-2">
              <Input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitTask()}
                placeholder="Новая задача…"
                className="h-9"
                data-testid="task-input"
              />
              <Button
                size="icon"
                className="size-9 shrink-0"
                onClick={submitTask}
                data-testid="task-add"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            {selTasks.length === 0 && (
              <p className="text-sm text-muted-foreground/70">
                На этот день задач нет.
              </p>
            )}
            <ul className="space-y-1" data-testid="task-list">
              {selTasks.map(t => (
                <li
                  key={t.id}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent"
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(t.id)}
                    aria-label={t.done ? "Отметить невыполненной" : "Выполнить"}
                    className={cn(
                      "shrink-0",
                      t.done ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {t.done ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <Circle className="size-4" />
                    )}
                  </button>
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      t.done && "text-muted-foreground line-through",
                    )}
                  >
                    {t.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteTask(t.id)}
                    aria-label="Удалить задачу"
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Создано в этот день
            </h3>
            {selNotes.length === 0 && (
              <p className="text-sm text-muted-foreground/70">
                Заметок не создавалось.
              </p>
            )}
            <ul className="space-y-1">
              {selNotes.map(n => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/note/${n.id}`)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <FileText className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{n.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
