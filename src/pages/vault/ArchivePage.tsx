import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  FileText,
  ListChecks,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVault } from "@/lib/vault";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function snippet(content: string): string {
  return (
    content
      .replace(/[#>*`[\]]/g, "")
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(" · ")
      .slice(0, 110) || "Пустая заметка"
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 py-16 text-muted-foreground">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/60">
        {icon}
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  destructive,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={
            destructive
              ? "size-8 text-muted-foreground hover:text-destructive"
              : "size-8 text-muted-foreground hover:text-primary"
          }
          onClick={onClick}
          data-testid={testId}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ArchivePage() {
  const navigate = useNavigate();
  const {
    tasks,
    trashedNotes,
    trashedTasks,
    toggleTask,
    deleteTask,
    restoreNote,
    purgeNote,
    restoreTask,
    purgeTask,
    emptyTrash,
  } = useVault();

  const doneTasks = tasks
    .filter(t => t.done)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const trashCount = trashedNotes.length + trashedTasks.length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8" data-testid="archive-page">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Archive className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Архив</h1>
            <p className="text-sm text-muted-foreground">
              Выполненные задачи и корзина — ничего не теряется.
            </p>
          </div>
        </header>

        <Tabs defaultValue="done">
          <TabsList className="mb-4 h-10 rounded-xl">
            <TabsTrigger
              value="done"
              className="gap-1.5 rounded-lg px-4"
              data-testid="tab-done"
            >
              <ListChecks className="size-4" />
              Выполненные
              {doneTasks.length > 0 && (
                <Badge variant="secondary" className="px-1.5 text-xs">
                  {doneTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="trash"
              className="gap-1.5 rounded-lg px-4"
              data-testid="tab-trash"
            >
              <Trash2 className="size-4" />
              Корзина
              {trashCount > 0 && (
                <Badge variant="secondary" className="px-1.5 text-xs">
                  {trashCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Completed tasks ── */}
          <TabsContent value="done" data-testid="done-list">
            {doneTasks.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="size-6 text-success" />}
                text="Выполненных задач пока нет — всё впереди!"
              />
            ) : (
              <ul className="space-y-2">
                {doneTasks.map(t => (
                  <li
                    key={t.id}
                    className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 transition-colors hover:border-border"
                  >
                    <CheckCircle2 className="size-5 shrink-0 text-success" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm line-through decoration-muted-foreground/50">
                        {t.text}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.completedAt
                          ? `выполнено ${dateFmt.format(t.completedAt)}`
                          : `срок: ${t.due}`}
                      </p>
                    </div>
                    <div className="flex opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
                      <IconAction
                        label="Вернуть в работу"
                        onClick={() => {
                          toggleTask(t.id);
                          toast.success("Задача снова в работе");
                        }}
                        testId="task-reopen"
                      >
                        <Undo2 className="size-4" />
                      </IconAction>
                      <IconAction
                        label="В корзину"
                        destructive
                        onClick={() => {
                          deleteTask(t.id);
                          toast.success("Задача перемещена в корзину");
                        }}
                      >
                        <Trash2 className="size-4" />
                      </IconAction>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* ── Trash ── */}
          <TabsContent value="trash" data-testid="trash-list">
            {trashCount === 0 ? (
              <EmptyState
                icon={<Trash2 className="size-6" />}
                text="Корзина пуста."
              />
            ) : (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Trash2 className="size-3.5" />
                        Очистить корзину
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Очистить корзину?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {trashCount} элемент(ов) будут удалены безвозвратно.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            emptyTrash();
                            toast.success("Корзина очищена");
                          }}
                        >
                          Удалить всё
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {trashedNotes.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Заметки
                    </h3>
                    <ul className="space-y-2">
                      {trashedNotes.map(n => (
                        <li
                          key={n.id}
                          className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 transition-colors hover:border-border"
                        >
                          <FileText className="size-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {n.title}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {snippet(n.content)}
                              {n.deletedAt &&
                                ` · удалено ${dateFmt.format(n.deletedAt)}`}
                            </p>
                          </div>
                          <div className="flex opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
                            <IconAction
                              label="Восстановить"
                              onClick={() => {
                                restoreNote(n.id);
                                toast.success(`«${n.title}» восстановлена`);
                                navigate(`/note/${n.id}`);
                              }}
                              testId="note-restore"
                            >
                              <ArchiveRestore className="size-4" />
                            </IconAction>
                            <IconAction
                              label="Удалить навсегда"
                              destructive
                              onClick={() => {
                                purgeNote(n.id);
                                toast.success("Заметка удалена навсегда");
                              }}
                            >
                              <Trash2 className="size-4" />
                            </IconAction>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {trashedTasks.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Задачи
                    </h3>
                    <ul className="space-y-2">
                      {trashedTasks.map(t => (
                        <li
                          key={t.id}
                          className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 transition-colors hover:border-border"
                        >
                          <RotateCcw className="size-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{t.text}</p>
                            <p className="text-xs text-muted-foreground">
                              срок: {t.due}
                              {t.deletedAt &&
                                ` · удалено ${dateFmt.format(t.deletedAt)}`}
                            </p>
                          </div>
                          <div className="flex opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
                            <IconAction
                              label="Восстановить"
                              onClick={() => {
                                restoreTask(t.id);
                                toast.success("Задача восстановлена");
                              }}
                            >
                              <ArchiveRestore className="size-4" />
                            </IconAction>
                            <IconAction
                              label="Удалить навсегда"
                              destructive
                              onClick={() => {
                                purgeTask(t.id);
                                toast.success("Задача удалена навсегда");
                              }}
                            >
                              <Trash2 className="size-4" />
                            </IconAction>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
