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
import { useCloudSync } from "@/lib/sync";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  deletedAt?: number | null;
}

export interface Task {
  id: string;
  text: string;
  due: string; // YYYY-MM-DD
  done: boolean;
  createdAt: number;
  completedAt?: number | null;
  deletedAt?: number | null;
}

const NOTES_KEY = "noxilith.notes.v1";
const TASKS_KEY = "noxilith.tasks.v1";

/** One-time migration from the old MindGarden storage keys. */
function migrateKey(newKey: string): void {
  const oldKey = newKey.replace(/^noxilith\./, "mindgarden.");
  if (localStorage.getItem(newKey) === null) {
    const old = localStorage.getItem(oldKey);
    if (old !== null) localStorage.setItem(newKey, old);
  }
}

migrateKey(NOTES_KEY);
migrateKey(TASKS_KEY);

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const MONTHS_RU = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export function dailyNoteTitle(date = new Date()): string {
  return `${date.getDate()} ${MONTHS_RU[date.getMonth()]} ${date.getFullYear()}`;
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
      `# Добро пожаловать в Noxilith 🌑

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
      text: "Осмотреться в Noxilith",
      due: toDayKey(Date.now()),
      done: false,
      createdAt: Date.now(),
    },
  ];
  localStorage.setItem(TASKS_KEY, JSON.stringify(seeded));
  return seeded;
}

interface VaultContextValue {
  /** active (non-deleted) notes */
  notes: Note[];
  /** active (non-deleted) tasks */
  tasks: Task[];
  trashedNotes: Note[];
  trashedTasks: Task[];
  createNote: (title?: string, content?: string) => Note;
  updateNote: (
    id: string,
    patch: Partial<Pick<Note, "title" | "content" | "pinned">>,
  ) => void;
  /** soft delete -> trash */
  deleteNote: (id: string) => void;
  restoreNote: (id: string) => void;
  purgeNote: (id: string) => void;
  addTask: (text: string, due: string) => void;
  toggleTask: (id: string) => void;
  /** soft delete -> trash */
  deleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  purgeTask: (id: string) => void;
  emptyTrash: () => void;
  /** find or create today's daily note */
  getDailyNote: () => Note;
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
  const [allNotes, setNotes] = useState<Note[]>(loadNotes);
  const [allTasks, setTasks] = useState<Task[]>(loadTasks);

  useCloudSync(allNotes, allTasks, setNotes, setTasks);

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(allNotes));
  }, [allNotes]);
  useEffect(() => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(allTasks));
  }, [allTasks]);

  const notes = useMemo(() => allNotes.filter(n => !n.deletedAt), [allNotes]);
  const tasks = useMemo(() => allTasks.filter(t => !t.deletedAt), [allTasks]);
  const trashedNotes = useMemo(
    () =>
      allNotes
        .filter(n => n.deletedAt)
        .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
    [allNotes],
  );
  const trashedTasks = useMemo(
    () =>
      allTasks
        .filter(t => t.deletedAt)
        .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
    [allTasks],
  );

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
    setNotes(prev =>
      prev.map(n => (n.id === id ? { ...n, deletedAt: Date.now() } : n)),
    );
  }, []);

  const restoreNote = useCallback((id: string) => {
    setNotes(prev =>
      prev.map(n => (n.id === id ? { ...n, deletedAt: null } : n)),
    );
  }, []);

  const purgeNote = useCallback((id: string) => {
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
      prev.map(t =>
        t.id === id
          ? { ...t, done: !t.done, completedAt: t.done ? null : Date.now() }
          : t,
      ),
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, deletedAt: Date.now() } : t)),
    );
  }, []);

  const restoreTask = useCallback((id: string) => {
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, deletedAt: null } : t)),
    );
  }, []);

  const purgeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const getDailyNote = useCallback((): Note => {
    const title = dailyNoteTitle();
    const existing = allNotes.find(
      n => !n.deletedAt && n.title.trim().toLowerCase() === title.toLowerCase(),
    );
    if (existing) return existing;
    const now = Date.now();
    const note: Note = {
      id: uid(),
      title,
      content: `# ${title}\n\n#дневник\n\n## Мысли\n\n- `,
      createdAt: now,
      updatedAt: now,
      pinned: false,
    };
    setNotes(prev => [note, ...prev]);
    return note;
  }, [allNotes]);

  const emptyTrash = useCallback(() => {
    setNotes(prev => prev.filter(n => !n.deletedAt));
    setTasks(prev => prev.filter(t => !t.deletedAt));
  }, []);

  const exportData = useCallback(() => {
    return JSON.stringify(
      { version: 1, notes: allNotes, tasks: allTasks },
      null,
      2,
    );
  }, [allNotes, allTasks]);

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
      trashedNotes,
      trashedTasks,
      createNote,
      updateNote,
      deleteNote,
      restoreNote,
      purgeNote,
      addTask,
      toggleTask,
      deleteTask,
      restoreTask,
      purgeTask,
      emptyTrash,
      getDailyNote,
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
      trashedNotes,
      trashedTasks,
      createNote,
      updateNote,
      deleteNote,
      restoreNote,
      purgeNote,
      addTask,
      toggleTask,
      deleteTask,
      restoreTask,
      purgeTask,
      emptyTrash,
      getDailyNote,
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
