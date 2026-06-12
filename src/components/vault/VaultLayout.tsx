import {
  Archive,
  ArrowDownUp,
  BarChart3,
  CalendarDays,
  Check,
  FileText,
  Moon,
  NotebookPen,
  Palette,
  Search,
  Sprout,
  Sun,
  TimerIcon,
  Waypoints,
} from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/vault/CommandPalette";
import { TransferDialog } from "@/components/vault/TransferDialog";
import { useTheme } from "@/contexts/ThemeContext";
import { PALETTES, setPrefs, usePrefs } from "@/lib/prefs";
import { formatClock, useTimer } from "@/lib/timer";
import { cn } from "@/lib/utils";
import { useVault } from "@/lib/vault";

function RibbonButton({
  to,
  label,
  active,
  children,
}: {
  to: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={to}
          aria-label={label}
          className={cn(
            "flex size-10 items-center justify-center rounded-xl transition-all",
            active
              ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px] shadow-primary/30"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {children}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function RibbonAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function FloatingTimerPill() {
  const { running, remaining, mode } = useTimer();
  const location = useLocation();
  if (!running || location.pathname === "/timer") return null;
  return (
    <Link
      to="/timer"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-primary/30 bg-card/90 px-4 py-2 font-mono text-sm text-primary shadow-lg backdrop-blur transition-transform hover:scale-105"
    >
      <span
        className={cn(
          "size-2 animate-pulse rounded-full",
          mode === "focus" ? "bg-primary" : "bg-success",
        )}
      />
      {formatClock(remaining)}
    </Link>
  );
}

export function VaultLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme, switchable } = useTheme();
  const { getDailyNote } = useVault();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const { palette } = usePrefs();
  const { running } = useTimer();

  const path = location.pathname;
  const isNotes = path === "/" || path.startsWith("/note");

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh w-full overflow-hidden bg-background">
        {/* Ribbon */}
        <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border/60 bg-sidebar py-3">
          <Link
            to="/"
            aria-label="Noxilith"
            className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <Sprout className="size-5" />
          </Link>
          <RibbonButton to="/" label="Заметки" active={isNotes}>
            <FileText className="size-5" />
          </RibbonButton>
          <RibbonButton
            to="/graph"
            label="Граф связей"
            active={path === "/graph"}
          >
            <Waypoints className="size-5" />
          </RibbonButton>
          <RibbonButton
            to="/calendar"
            label="Календарь"
            active={path === "/calendar"}
          >
            <CalendarDays className="size-5" />
          </RibbonButton>
          <RibbonButton to="/timer" label="Таймер" active={path === "/timer"}>
            <TimerIcon className={cn("size-5", running && "text-primary")} />
          </RibbonButton>
          <RibbonButton
            to="/archive"
            label="Архив и корзина"
            active={path === "/archive"}
          >
            <Archive className="size-5" />
          </RibbonButton>
          <RibbonButton
            to="/stats"
            label="Статистика"
            active={path === "/stats"}
          >
            <BarChart3 className="size-5" />
          </RibbonButton>

          <div className="my-1 h-px w-7 bg-border/70" />
          <RibbonAction
            label="Быстрый переход (Ctrl+K)"
            onClick={() => setPaletteOpen(true)}
          >
            <Search className="size-5" />
          </RibbonAction>
          <RibbonAction
            label="Заметка дня"
            onClick={() => {
              const n = getDailyNote();
              navigate(`/note/${n.id}`);
            }}
          >
            <NotebookPen className="size-5" />
          </RibbonAction>

          <div className="mt-auto flex flex-col items-center gap-1">
            <RibbonAction
              label="Экспорт и импорт"
              onClick={() => setTransferOpen(true)}
            >
              <ArrowDownUp className="size-4" />
            </RibbonAction>
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Цветовая тема"
                      data-testid="palette-picker"
                      className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                    >
                      <Palette className="size-4" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">Цветовая тема</TooltipContent>
              </Tooltip>
              <PopoverContent side="right" align="end" className="w-60 p-2">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Цветовая тема
                </p>
                {PALETTES.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    data-testid={`palette-${p.id}`}
                    onClick={() => setPrefs({ palette: p.id })}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                      palette === p.id && "bg-accent",
                    )}
                  >
                    <span className="flex shrink-0 -space-x-1">
                      {p.swatch.map(c => (
                        <span
                          key={c}
                          className="size-4 rounded-full border border-black/20"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                    <span className="flex-1 truncate">{p.name}</span>
                    {palette === p.id && (
                      <Check className="size-4 text-primary" />
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {switchable && toggleTheme && (
              <RibbonAction label="Светлая / тёмная" onClick={toggleTheme}>
                {theme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
              </RibbonAction>
            )}
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
        <FloatingTimerPill />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
      </div>
    </TooltipProvider>
  );
}
