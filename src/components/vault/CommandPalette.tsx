import {
  Archive,
  BarChart3,
  CalendarDays,
  FileText,
  NotebookPen,
  Plus,
  Sprout,
  TimerIcon,
  Waypoints,
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { dailyNoteTitle, useVault } from "@/lib/vault";

const PAGES = [
  { to: "/", label: "Заметки", icon: FileText },
  { to: "/graph", label: "Граф связей", icon: Waypoints },
  { to: "/calendar", label: "Календарь", icon: CalendarDays },
  { to: "/timer", label: "Таймер", icon: TimerIcon },
  { to: "/archive", label: "Архив", icon: Archive },
  { to: "/stats", label: "Статистика", icon: BarChart3 },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { notes, createNote, getDailyNote } = useVault();

  // global Ctrl/Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const recent = [...notes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 50);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Быстрый переход"
      description="Поиск по заметкам и командам"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Заметка или команда…"
        data-testid="palette-input"
      />
      <CommandList data-testid="palette-list">
        <CommandEmpty>Ничего не найдено.</CommandEmpty>
        <CommandGroup heading="Действия">
          <CommandItem
            onSelect={() =>
              run(() => {
                const n = createNote();
                navigate(`/note/${n.id}`);
              })
            }
          >
            <Plus className="size-4" />
            Новая заметка
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => {
                const n = getDailyNote();
                toast.success(`Заметка дня: ${dailyNoteTitle()}`);
                navigate(`/note/${n.id}`);
              })
            }
          >
            <NotebookPen className="size-4" />
            Заметка дня — {dailyNoteTitle()}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Заметки">
          {recent.map(n => (
            <CommandItem
              key={n.id}
              value={`${n.title} ${n.id}`}
              onSelect={() => run(() => navigate(`/note/${n.id}`))}
            >
              <Sprout className="size-4 text-primary/70" />
              <span className="truncate">{n.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Разделы">
          {PAGES.map(p => (
            <CommandItem
              key={p.to}
              value={`раздел ${p.label}`}
              onSelect={() => run(() => navigate(p.to))}
            >
              <p.icon className="size-4" />
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
