import {
  CalendarPlus,
  Eye,
  FileText,
  Info,
  Link2,
  PanelLeft,
  PanelRight,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MarkdownView } from "@/components/vault/MarkdownView";
import { countWords } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { type Note, useVault } from "@/lib/vault";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
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
      .slice(0, 90) || "Пустая заметка"
  );
}

export function NotesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const vault = useVault();
  const {
    notes,
    createNote,
    updateNote,
    deleteNote,
    byTitle,
    linksOf,
    backlinksOf,
    allTags,
    tagsOf,
  } = vault;

  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showList, setShowList] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [linkSuggest, setLinkSuggest] = useState<{
    start: number;
    frag: string;
  } | null>(null);
  const [suggestIdx, setSuggestIdx] = useState(0);

  const sorted = useMemo(() => {
    const filtered = notes.filter(n => {
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q);
      const matchTag = !tagFilter || tagsOf(n).includes(tagFilter);
      return matchQ && matchTag;
    });
    return filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [notes, query, tagFilter, tagsOf]);

  const active: Note | undefined = useMemo(
    () => notes.find(n => n.id === id) ?? (id ? undefined : sorted[0]),
    [notes, id, sorted],
  );

  // redirect "/" to the first note for a stable URL
  useEffect(() => {
    if (!id && sorted[0]) navigate(`/note/${sorted[0].id}`, { replace: true });
  }, [id, sorted, navigate]);

  // new/empty notes open in edit mode
  useEffect(() => {
    if (active && active.content === "") setEditing(true);
  }, [active]);

  const openByTitle = (target: string) => {
    const existing = byTitle.get(target.toLowerCase());
    if (existing) {
      navigate(`/note/${existing.id}`);
    } else {
      const note = createNote(target, "");
      toast.success(`Создана заметка «${target}»`);
      navigate(`/note/${note.id}`);
    }
  };

  const handleCreate = () => {
    const note = createNote();
    setEditing(true);
    navigate(`/note/${note.id}`);
  };

  const detectSuggest = (el: HTMLTextAreaElement) => {
    const caret = el.selectionStart ?? 0;
    const text = el.value.slice(0, caret);
    const open = text.lastIndexOf("[[");
    if (open === -1) return null;
    const frag = text.slice(open + 2);
    if (frag.includes("]]") || frag.includes("\n") || frag.length > 60)
      return null;
    return { start: open + 2, frag };
  };

  const suggestions = useMemo(() => {
    if (!linkSuggest) return [];
    const q = linkSuggest.frag.trim().toLowerCase();
    const rank = (t: string) => (q && t.toLowerCase().startsWith(q) ? 0 : 1);
    return notes
      .filter(n => n.id !== active?.id)
      .filter(n => !q || n.title.toLowerCase().includes(q))
      .sort(
        (a, b) => rank(a.title) - rank(b.title) || b.updatedAt - a.updatedAt,
      )
      .slice(0, 6);
  }, [linkSuggest, notes, active]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset highlight when the typed fragment changes
  useEffect(() => {
    setSuggestIdx(0);
  }, [linkSuggest?.frag]);

  const insertLink = (title: string) => {
    const el = textareaRef.current;
    if (!el || !linkSuggest || !active) return;
    const caret = el.selectionStart ?? linkSuggest.start;
    const before = `${active.content.slice(0, linkSuggest.start) + title}]]`;
    let after = active.content.slice(caret);
    if (after.startsWith("]]")) after = after.slice(2);
    updateNote(active.id, { content: before + after });
    setLinkSuggest(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const triggerLinkInsert = () => {
    if (!active) return;
    setEditing(true);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const caret = el.selectionStart ?? active.content.length;
      const next = `${active.content.slice(0, caret)}[[${active.content.slice(caret)}`;
      updateNote(active.id, { content: next });
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret + 2, caret + 2);
        setLinkSuggest({ start: caret + 2, frag: "" });
      });
    });
  };

  const outgoing = active ? (linksOf.get(active.id) ?? []) : [];
  const incoming = active ? (backlinksOf.get(active.id) ?? []) : [];
  const noteById = (nid: string) => notes.find(n => n.id === nid);

  return (
    <div className="flex h-full min-w-0">
      {/* Note list */}
      <aside
        className={cn(
          "flex h-full w-72 shrink-0 flex-col border-r border-border/60 bg-sidebar/50 max-md:absolute max-md:z-30 max-md:h-dvh max-md:bg-sidebar",
          !showList && "hidden",
        )}
        data-testid="note-list"
      >
        <div className="flex items-center gap-2 p-3 pb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск…"
              className="h-9 pl-8"
              data-testid="search-input"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="size-9"
                onClick={handleCreate}
                data-testid="new-note"
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Новая заметка</TooltipContent>
          </Tooltip>
        </div>

        {allTags.size > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
            {[...allTags.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    tagFilter === tag
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  #{tag}
                  <span className="ml-1 opacity-60">{count}</span>
                </button>
              ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {sorted.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Ничего не найдено
            </p>
          )}
          {sorted.map(n => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                navigate(`/note/${n.id}`);
                if (window.innerWidth < 768) setShowList(false);
              }}
              className={cn(
                "mb-1 block w-full rounded-lg px-3 py-2 text-left transition-colors",
                active?.id === n.id
                  ? "bg-primary/10 shadow-[inset_0_0_0_1px] shadow-primary/20"
                  : "hover:bg-accent",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium leading-tight">
                {n.pinned && <Pin className="size-3 shrink-0 text-primary" />}
                <span className="truncate">{n.title}</span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {snippet(n.content)}
              </span>
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
                {dateTimeFmt.format(n.updatedAt)}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
          {notes.length} заметок · {[...allTags.keys()].length} тегов
        </div>
      </aside>

      {/* Editor */}
      <section className="flex h-full min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <header className="flex items-center gap-1 border-b border-border/60 px-3 py-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={() => setShowList(v => !v)}
                aria-label="Список заметок"
              >
                <PanelLeft className="size-4" />
              </Button>
              <input
                value={active.title}
                onChange={e => updateNote(active.id, { title: e.target.value })}
                className="min-w-0 flex-1 bg-transparent px-2 text-lg font-semibold outline-none placeholder:text-muted-foreground"
                placeholder="Название заметки"
                data-testid="note-title"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setEditing(v => !v)}
                    data-testid="toggle-edit"
                  >
                    {editing ? (
                      <Eye className="size-4" />
                    ) : (
                      <Pencil className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {editing ? "Просмотр" : "Редактировать"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={triggerLinkInsert}
                    data-testid="insert-link"
                  >
                    <Link2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Вставить ссылку на заметку</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      updateNote(active.id, { pinned: !active.pinned })
                    }
                  >
                    {active.pinned ? (
                      <PinOff className="size-4" />
                    ) : (
                      <Pin className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {active.pinned ? "Открепить" : "Закрепить"}
                </TooltipContent>
              </Tooltip>
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Удалить</TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить заметку?</AlertDialogTitle>
                    <AlertDialogDescription>
                      «{active.title}» отправится в корзину — восстановить можно
                      в Архиве.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        deleteNote(active.id);
                        toast.success("Заметка перемещена в корзину");
                        navigate("/");
                      }}
                    >
                      В корзину
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground max-lg:hidden"
                onClick={() => setShowInfo(v => !v)}
                aria-label="Сведения"
              >
                <PanelRight className="size-4" />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {editing ? (
                <div className="relative size-full">
                  <textarea
                    ref={textareaRef}
                    value={active.content}
                    onChange={e => {
                      updateNote(active.id, { content: e.target.value });
                      setLinkSuggest(detectSuggest(e.target));
                    }}
                    onClick={e =>
                      setLinkSuggest(detectSuggest(e.currentTarget))
                    }
                    onBlur={() => setTimeout(() => setLinkSuggest(null), 150)}
                    onKeyDown={e => {
                      if (!linkSuggest || suggestions.length === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSuggestIdx(i => (i + 1) % suggestions.length);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSuggestIdx(
                          i =>
                            (i - 1 + suggestions.length) % suggestions.length,
                        );
                      } else if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        insertLink(suggestions[suggestIdx].title);
                      } else if (e.key === "Escape") {
                        setLinkSuggest(null);
                      }
                    }}
                    placeholder={
                      "Пиши здесь…\n\nСвязывай мысли: [[Название заметки]]\nДобавляй теги: #идея"
                    }
                    className="block size-full resize-none bg-transparent px-6 py-5 font-mono text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
                    data-testid="note-editor"
                  />
                  {linkSuggest && suggestions.length > 0 && (
                    <div
                      className="absolute left-6 top-12 z-20 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
                      data-testid="link-suggest"
                    >
                      <p className="border-b border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Связать с заметкой
                      </p>
                      {suggestions.map((n, i) => (
                        <button
                          key={n.id}
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            insertLink(n.title);
                          }}
                          onMouseEnter={() => setSuggestIdx(i)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                            i === suggestIdx
                              ? "bg-primary/15 text-primary"
                              : "text-foreground",
                          )}
                        >
                          <FileText className="size-3.5 shrink-0 opacity-60" />
                          <span className="truncate">{n.title}</span>
                        </button>
                      ))}
                      <p className="border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">
                        ↑↓ выбрать · Enter вставить · Esc закрыть
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <MarkdownView
                  content={
                    active.content ||
                    "*Пустая заметка — нажми ✏️, чтобы начать писать.*"
                  }
                  onWikilinkClick={openByTitle}
                  className="mx-auto max-w-3xl px-6 py-5"
                />
              )}
            </div>

            <footer className="flex items-center gap-4 border-t border-border/60 px-4 py-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarPlus className="size-3" />
                создано {dateFmt.format(active.createdAt)}
              </span>
              <span>{countWords(active.content)} слов</span>
              <span className="ml-auto flex items-center gap-1">
                <Link2 className="size-3" />
                {outgoing.length} → · ← {incoming.length}
              </span>
            </footer>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <p>Заметка не найдена</p>
            <Button onClick={handleCreate}>
              <Plus className="size-4" /> Новая заметка
            </Button>
          </div>
        )}
      </section>

      {/* Info panel */}
      {active && showInfo && (
        <aside className="hidden h-full w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border/60 bg-sidebar/50 p-4 lg:flex">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Info className="size-3" /> Сведения
            </h3>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Создано</dt>
                <dd data-testid="created-date">
                  {dateFmt.format(active.createdAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Изменено</dt>
                <dd>{dateFmt.format(active.updatedAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Слов</dt>
                <dd>{countWords(active.content)}</dd>
              </div>
            </dl>
          </div>

          {tagsOf(active).length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Теги
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {tagsOf(active).map(t => (
                  <Badge key={t} variant="secondary" className="text-primary">
                    #{t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ссылки из заметки
            </h3>
            {outgoing.length === 0 && (
              <p className="text-sm text-muted-foreground/70">
                Нет ссылок. Используй [[название]].
              </p>
            )}
            <ul className="space-y-1">
              {outgoing.map(nid => {
                const n = noteById(nid);
                return n ? (
                  <li key={nid}>
                    <button
                      type="button"
                      onClick={() => navigate(`/note/${nid}`)}
                      className="w-full truncate rounded-md px-2 py-1 text-left text-sm text-primary hover:bg-accent"
                    >
                      {n.title}
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Упоминания (backlinks)
            </h3>
            {incoming.length === 0 && (
              <p className="text-sm text-muted-foreground/70">
                Пока никто не ссылается сюда.
              </p>
            )}
            <ul className="space-y-1" data-testid="backlinks">
              {incoming.map(nid => {
                const n = noteById(nid);
                return n ? (
                  <li key={nid}>
                    <button
                      type="button"
                      onClick={() => navigate(`/note/${nid}`)}
                      className="w-full truncate rounded-md px-2 py-1 text-left text-sm text-primary hover:bg-accent"
                    >
                      {n.title}
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
