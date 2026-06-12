import { CheckCircle2, FileText, Flame, Hash, Link2, Type } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useVault } from "@/lib/vault";

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKS = 18;
const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

export function StatsPage() {
  const { notes, tasks, linksOf, allTags } = useVault();

  const stats = useMemo(() => {
    const words = notes.reduce(
      (sum, n) => sum + (n.content.match(/\S+/g)?.length ?? 0),
      0,
    );
    let links = 0;
    for (const arr of linksOf.values()) links += arr.length;
    const done = tasks.filter(t => t.done).length;

    // Activity per day: note created/updated + task completed
    const activity = new Map<string, number>();
    const bump = (ts: number) =>
      activity.set(dayKey(ts), (activity.get(dayKey(ts)) ?? 0) + 1);
    for (const n of notes) {
      bump(n.createdAt);
      if (dayKey(n.updatedAt) !== dayKey(n.createdAt)) bump(n.updatedAt);
    }
    for (const t of tasks) if (t.completedAt) bump(t.completedAt);

    // Streak: consecutive days with activity ending today/yesterday
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; ; i++) {
      const d = new Date(today.getTime() - i * 86_400_000);
      if (activity.has(dayKey(d.getTime()))) streak++;
      else if (i === 0)
        continue; // today may be empty, check yesterday
      else break;
    }

    // Heatmap grid: WEEKS columns × 7 rows, ending today
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - ((end.getDay() + 6) % 7))); // end of ISO week
    const cells: { key: string; count: number; date: Date }[] = [];
    for (let i = WEEKS * 7 - 1; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 86_400_000);
      const key = dayKey(d.getTime());
      cells.push({ key, count: activity.get(key) ?? 0, date: d });
    }
    const max = Math.max(1, ...cells.map(c => c.count));

    const topTags = [...allTags.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const maxTag = Math.max(1, ...topTags.map(([, c]) => c));

    return { words, links, done, streak, cells, max, topTags, maxTag };
  }, [notes, tasks, linksOf, allTags]);

  const level = (count: number) => {
    if (count === 0) return "bg-muted";
    const r = count / stats.max;
    if (r <= 0.25) return "bg-primary/25";
    if (r <= 0.5) return "bg-primary/45";
    if (r <= 0.75) return "bg-primary/70";
    return "bg-primary";
  };

  const cards = [
    {
      icon: <FileText className="size-4" />,
      label: "Заметок",
      value: notes.length,
    },
    {
      icon: <Type className="size-4" />,
      label: "Слов написано",
      value: stats.words,
    },
    { icon: <Link2 className="size-4" />, label: "Связей", value: stats.links },
    { icon: <Hash className="size-4" />, label: "Тегов", value: allTags.size },
    {
      icon: <CheckCircle2 className="size-4" />,
      label: "Задач выполнено",
      value: stats.done,
    },
    {
      icon: <Flame className="size-4" />,
      label: "Дней подряд",
      value: stats.streak,
    },
  ];

  // Month labels above heatmap columns
  const monthLabels: { idx: number; label: string }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const d = stats.cells[w * 7].date;
    if (d.getDate() <= 7)
      monthLabels.push({ idx: w, label: MONTHS_SHORT[d.getMonth()] });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8" data-testid="stats-page">
        <h1 className="text-2xl font-bold tracking-tight">Сад в цифрах</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Как растёт твой сад мыслей.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map(c => (
            <div
              key={c.label}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="text-primary">{c.icon}</span>
                <span className="text-xs font-medium uppercase tracking-wide">
                  {c.label}
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Активность</h2>
          <p className="text-xs text-muted-foreground">
            Создание и правка заметок, выполнение задач — за последние {WEEKS}{" "}
            недель.
          </p>
          <div className="mt-4 overflow-x-auto pb-1">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${WEEKS}, 1fr)`,
                minWidth: WEEKS * 18,
              }}
            >
              {monthLabels.length > 0 &&
                Array.from({ length: WEEKS }, (_, w) => (
                  <span
                    key={`m-${stats.cells[w * 7].key}`}
                    className="h-4 text-[10px] text-muted-foreground"
                  >
                    {monthLabels.find(m => m.idx === w)?.label ?? ""}
                  </span>
                ))}
              {Array.from({ length: WEEKS }, (_, w) => (
                <div
                  key={`w-${stats.cells[w * 7].key}`}
                  className="flex flex-col gap-1"
                >
                  {Array.from({ length: 7 }, (_, d) => {
                    const cell = stats.cells[w * 7 + d];
                    return (
                      <div
                        key={cell.key}
                        title={`${cell.date.toLocaleDateString("ru-RU")}: ${cell.count}`}
                        className={cn(
                          "aspect-square w-full rounded-[4px]",
                          level(cell.count),
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
            меньше
            {[
              "bg-muted",
              "bg-primary/25",
              "bg-primary/45",
              "bg-primary/70",
              "bg-primary",
            ].map(c => (
              <span key={c} className={cn("size-2.5 rounded-[3px]", c)} />
            ))}
            больше
          </div>
        </div>

        {stats.topTags.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Любимые теги</h2>
            <div className="mt-3 space-y-2">
              {stats.topTags.map(([tag, count]) => (
                <div key={tag} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm text-primary">
                    #{tag}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(count / stats.maxTag) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
