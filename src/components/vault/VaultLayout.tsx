import {
  CalendarDays,
  Download,
  FileText,
  Moon,
  Sprout,
  Sun,
  TimerIcon,
  Upload,
  Waypoints,
} from "lucide-react";
import { useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/contexts/ThemeContext";
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
  const { exportData, importData } = useVault();
  const { running } = useTimer();
  const fileRef = useRef<HTMLInputElement>(null);

  const path = location.pathname;
  const isNotes = path === "/" || path.startsWith("/note");

  const handleExport = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindgarden-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Резервная копия сохранена");
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importData(String(reader.result));
      if (ok) {
        toast.success("Данные импортированы");
        navigate("/");
      } else {
        toast.error("Не удалось прочитать файл");
      }
    };
    reader.readAsText(file);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh w-full overflow-hidden bg-background">
        {/* Ribbon */}
        <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border/60 bg-sidebar py-3">
          <Link
            to="/"
            aria-label="MindGarden"
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

          <div className="mt-auto flex flex-col items-center gap-1">
            <RibbonAction label="Экспорт данных" onClick={handleExport}>
              <Download className="size-4" />
            </RibbonAction>
            <RibbonAction
              label="Импорт данных"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
            </RibbonAction>
            {switchable && toggleTheme && (
              <RibbonAction label="Сменить тему" onClick={toggleTheme}>
                {theme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
              </RibbonAction>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              e.target.value = "";
            }}
          />
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
        <FloatingTimerPill />
      </div>
    </TooltipProvider>
  );
}
