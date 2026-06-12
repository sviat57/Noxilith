import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { extractTags, extractWikilinks } from "@/lib/markdown";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

export interface Task {
  id: string;
  text: string;
  due: string; // YYYY-MM-DD
  done: boolean;
  createdAt: number;
}

const NOTES_KEY = "mindgarden.notes.v1";
const TASKS_KEY = "mindgarden.tasks.v1";

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function toDayKey(ts: number): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function seedNotes(): Note[] {
  const now = Date.now();
  const mk = (
    title: string,
    content: string,
    offsetDays: number,
    pinned = false,
  ): Note => ({
    id: uid() + Math.random().toString(36).slice(2, 5),
    title,
    content,
    createdAt: now - offsetDays * 86_400_000,
    updatedAt: now - offsetDays * 86_400_000,
    pinned,
  });
  return [
    mk(
      "Добро пожаловать",
      `# Добро пожаловать в MindGarden 🌱

Это твоё личное пространство для заметок и размышлений — в духе Obsidian.

## Как это работает

- Пиши заметки в **Markdown** — заголовки, списки, цитаты, код.
- Связывай мысли двойными скобками: [[Как делать заметки]] — клик по ссылке открывает заметку.
- Добавляй теги: #идеи #важное — по ним можно фильтровать.
- Открой **Граф** в левой панели, чтобы увидеть карту своих мыслей.
- В **Календаре** видно, когда какая заметка создана, и задачи по дням.
- **Таймер** поможет сфокусироваться — техника Помодоро.

> Начни с чистого листа: создай новую заметку кнопкой «+» слева.

Связанные заметки: [[Метод Zettelkasten]], [[Мои цели]]`,
      3,
      true,
    ),
    mk(
      "Как делать заметки",
      `# Как делать заметки

Несколько принципов хороших заметок: #практика

1. **Одна мысль — одна заметка.** Маленькие заметки легче связывать.
2. **Своими словами.** Пересказ закрепляет понимание.
3. **Связывай.** Заметка без связей — потерянная мысль. См. [[Метод Zettelkasten]].
4. **Возвращайся.** Перечитывай и дополняй старые заметки.

Идеи для будущих записей храню в [[Мои цели]].`,
      2,
    ),
    mk(
      "Метод Zettelkasten",
      `# Метод Zettelkasten

Система заметок Никласа Лумана: тысячи карточек, связанных ссылками. #идеи

Ключевая мысль: **ценность не в заметках, а в связях между ними**.

- Каждая заметка имеет уникальный адрес
- Ссылки создают «цепочки мыслей»
- Со временем сеть начинает «думать вместе с тобой»

Похоже на то, как работает [[Добро пожаловать|этот сайт]] — открой граф и посмотри.`,
      2,
    ),
    mk(
      "Мои цели",
      `# Мои цели

#цели #планы

- [ ] Вести заметки каждый день
- [ ] Связывать новые мысли со старыми
- [ ] Раз в неделю просматривать граф

Вдохновение: [[Метод Zettelkasten]]`,
      1,
    ),
  ];
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) return JSON.parse(raw) as Note[];
  } catch {
    /* corrupted -> reseed */
  }
  const seeded = seedNotes();
  localStorage.setItem(NOTES_KEY, JSON.stringify(seeded));
  return seeded;
}

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (raw) return JSON.parse(raw) as Task[];
  } catch {
    /* ignore */
  }
  const seeded: Task[] = [
    {
      id: uid(),
      text: "Осмотреться в MindGarden",
      due: toDayKey(Date.now()),
      done: false,
      createdAt: Date.now(),
    },
  ];
  localStorage.setItem(TASKS_KEY, JSON.stringify(seeded));
  return seeded;
}

interface VaultContextValue {
  notes: Note[];
  tasks: Task[];
  createNote: (title?: string, content?: string) => Note;
  updateNote: (
    id: string,
    patch: Partial<Pick<Note, "title" | "content" | "pinned">>,
  ) => void;
  deleteNote: (id: string) => void;
  addTask: (text: string, due: string) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  importData: (json: string) => boolean;
  exportData: () => string;
  /** note title (lowercased) -> note */
  byTitle: Map<string, Note>;
  /** noteId -> outgoing linked note ids */
  linksOf: Map<string, string[]>;
  /** noteId -> incoming linker note ids */
  backlinksOf: Map<string, string[]>;
  /** all tags with counts */
  allTags: Map<string, number>;
  tagsOf: (note: Note) => string[];
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [tasks, setTasks] = useState<Task[]>(loadTasks);

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);
  useEffect(() => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const createNote = useCallback((title?: string, content?: string) => {
    const now = Date.now();
    const note: Note = {
      id: uid(),
      title: title?.trim() || "Новая заметка",
      content: content ?? "",
      createdAt: now,
      updatedAt: now,
      pinned: false,
    };
    setNotes(prev => [note, ...prev]);
    return note;
  }, []);

  const updateNote = useCallback(
    (
      id: string,
      patch: Partial<Pick<Note, "title" | "content" | "pinned">>,
    ) => {
      setNotes(prev =>
        prev.map(n =>
          n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
        ),
      );
    },
    [],
  );

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const addTask = useCallback((text: string, due: string) => {
    setTasks(prev => [
      { id: uid(), text: text.trim(), due, done: false, createdAt: Date.now() },
      ...prev,
    ]);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const exportData = useCallback(() => {
    return JSON.stringify({ version: 1, notes, tasks }, null, 2);
  }, [notes, tasks]);

  const importData = useCallback((json: string) => {
    try {
      const data = JSON.parse(json) as { notes?: Note[]; tasks?: Task[] };
      if (!Array.isArray(data.notes)) return false;
      setNotes(data.notes);
      if (Array.isArray(data.tasks)) setTasks(data.tasks);
      return true;
    } catch {
      return false;
    }
  }, []);

  const byTitle = useMemo(() => {
    const m = new Map<string, Note>();
    for (const n of notes) m.set(n.title.trim().toLowerCase(), n);
    return m;
  }, [notes]);

  const { linksOf, backlinksOf } = useMemo(() => {
    const links = new Map<string, string[]>();
    const back = new Map<string, string[]>();
    for (const n of notes) {
      const targets = extractWikilinks(n.content)
        .map(t => byTitle.get(t.toLowerCase()))
        .filter((x): x is Note => Boolean(x) && x?.id !== n.id)
        .map(x => x.id);
      links.set(n.id, [...new Set(targets)]);
      for (const t of targets) {
        const arr = back.get(t) ?? [];
        if (!arr.includes(n.id)) arr.push(n.id);
        back.set(t, arr);
      }
    }
    return { linksOf: links, backlinksOf: back };
  }, [notes, byTitle]);

  const allTags = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) {
      for (const t of extractTags(n.content)) m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }, [notes]);

  const tagsOf = useCallback((note: Note) => extractTags(note.content), []);

  const value: VaultContextValue = useMemo(
    () => ({
      notes,
      tasks,
      createNote,
      updateNote,
      deleteNote,
      addTask,
      toggleTask,
      deleteTask,
      importData,
      exportData,
      byTitle,
      linksOf,
      backlinksOf,
      allTags,
      tagsOf,
    }),
    [
      notes,
      tasks,
      createNote,
      updateNote,
      deleteNote,
      addTask,
      toggleTask,
      deleteTask,
      importData,
      exportData,
      byTitle,
      linksOf,
      backlinksOf,
      allTags,
      tagsOf,
    ],
  );

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}
