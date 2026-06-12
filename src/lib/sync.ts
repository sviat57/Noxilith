import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { useCloud } from "@/lib/cloud";
import { getSupabase } from "@/lib/supabase";
import type { Note, Task } from "@/lib/vault";

const NOTES_TABLE = "notes";
const TASKS_TABLE = "tasks";

/** Titles of the seeded onboarding notes — skipped at first cloud merge. */
const SEED_NOTE_TITLES = new Set([
  "добро пожаловать",
  "как делать заметки",
  "метод zettelkasten",
  "мои цели",
]);
const SEED_TASK_TEXT = "осмотреться в noxilith";

interface NoteRow {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface TaskRow {
  id: string;
  text: string;
  due: string;
  done: boolean;
  created_at: number;
  completed_at: number | null;
  deleted_at: number | null;
}

function noteToRow(n: Note): NoteRow {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    pinned: n.pinned,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
    deleted_at: n.deletedAt ?? null,
  };
}

function rowToNote(r: NoteRow): Note {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    pinned: r.pinned,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deletedAt: r.deleted_at === null ? null : Number(r.deleted_at),
  };
}

function taskToRow(t: Task): TaskRow {
  return {
    id: t.id,
    text: t.text,
    due: t.due,
    done: t.done,
    created_at: t.createdAt,
    completed_at: t.completedAt ?? null,
    deleted_at: t.deletedAt ?? null,
  };
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    text: r.text,
    due: r.due,
    done: r.done,
    createdAt: Number(r.created_at),
    completedAt: r.completed_at === null ? null : Number(r.completed_at),
    deletedAt: r.deleted_at === null ? null : Number(r.deleted_at),
  };
}

function isUntouchedSeedNote(n: Note): boolean {
  return (
    n.updatedAt === n.createdAt &&
    SEED_NOTE_TITLES.has(n.title.trim().toLowerCase())
  );
}

function isUntouchedSeedTask(t: Task): boolean {
  return (
    !t.done && !t.deletedAt && t.text.trim().toLowerCase() === SEED_TASK_TEXT
  );
}

/** Last-write-wins merge of local and cloud notes (newer updatedAt wins). */
export function mergeNotes(local: Note[], cloud: Note[]): Note[] {
  const out = new Map<string, Note>(cloud.map(n => [n.id, n]));
  for (const ln of local) {
    const cn = out.get(ln.id);
    if (cn) {
      if (ln.updatedAt > cn.updatedAt) out.set(ln.id, ln);
    } else {
      // First sync on a fresh device: don't pollute a non-empty cloud
      // with the default onboarding notes.
      if (cloud.length > 0 && isUntouchedSeedNote(ln)) continue;
      out.set(ln.id, ln);
    }
  }
  return [...out.values()];
}

function taskVersion(t: Task): number {
  return Math.max(t.createdAt, t.completedAt ?? 0, t.deletedAt ?? 0);
}

/** Merge tasks: newer version wins, ties go to cloud. */
export function mergeTasks(local: Task[], cloud: Task[]): Task[] {
  const out = new Map<string, Task>(cloud.map(t => [t.id, t]));
  for (const lt of local) {
    const ct = out.get(lt.id);
    if (ct) {
      if (taskVersion(lt) > taskVersion(ct)) out.set(lt.id, lt);
    } else {
      if (cloud.length > 0 && isUntouchedSeedTask(lt)) continue;
      out.set(lt.id, lt);
    }
  }
  return [...out.values()];
}

interface Snapshot {
  notes: Map<string, string>;
  tasks: Map<string, string>;
}

function makeSnapshot(notes: Note[], tasks: Task[]): Snapshot {
  return {
    notes: new Map(notes.map(n => [n.id, JSON.stringify(noteToRow(n))])),
    tasks: new Map(tasks.map(t => [t.id, JSON.stringify(taskToRow(t))])),
  };
}

/**
 * Cloud sync engine. Lives inside VaultProvider.
 *
 * - On sign-in: pulls cloud rows, merges with local state (LWW),
 *   pushes the merged result back and replaces local state.
 * - On every change afterwards: debounced incremental diff push.
 */
export function useCloudSync(
  allNotes: Note[],
  allTasks: Task[],
  setNotes: Dispatch<SetStateAction<Note[]>>,
  setTasks: Dispatch<SetStateAction<Task[]>>,
): void {
  const { user, setSyncStatus } = useCloud();
  const ready = useRef(false);
  const snapshot = useRef<Snapshot>(makeSnapshot([], []));
  const queue = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef({ allNotes, allTasks });
  stateRef.current = { allNotes, allTasks };
  const userId = user?.id ?? null;

  // Initial pull + merge after sign-in.
  useEffect(() => {
    ready.current = false;
    if (!userId) {
      setSyncStatus("off");
      return;
    }
    let cancelled = false;
    (async () => {
      const supa = getSupabase();
      if (!supa) return;
      setSyncStatus("syncing");
      try {
        const [nRes, tRes] = await Promise.all([
          supa.from(NOTES_TABLE).select("*"),
          supa.from(TASKS_TABLE).select("*"),
        ]);
        if (nRes.error) throw nRes.error;
        if (tRes.error) throw tRes.error;
        const cloudNotes = ((nRes.data ?? []) as NoteRow[]).map(rowToNote);
        const cloudTasks = ((tRes.data ?? []) as TaskRow[]).map(rowToTask);
        const mergedNotes = mergeNotes(stateRef.current.allNotes, cloudNotes);
        const mergedTasks = mergeTasks(stateRef.current.allTasks, cloudTasks);
        if (cancelled) return;
        if (mergedNotes.length > 0) {
          const { error } = await supa
            .from(NOTES_TABLE)
            .upsert(mergedNotes.map(noteToRow));
          if (error) throw error;
        }
        if (mergedTasks.length > 0) {
          const { error } = await supa
            .from(TASKS_TABLE)
            .upsert(mergedTasks.map(taskToRow));
          if (error) throw error;
        }
        if (cancelled) return;
        snapshot.current = makeSnapshot(mergedNotes, mergedTasks);
        setNotes(mergedNotes);
        setTasks(mergedTasks);
        ready.current = true;
        setSyncStatus("synced");
      } catch (err) {
        console.error("[sync] initial sync failed", err);
        if (!cancelled) setSyncStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, setSyncStatus, setNotes, setTasks]);

  // Debounced incremental push.
  useEffect(() => {
    if (!userId || !ready.current) return;
    const timer = setTimeout(() => {
      const supa = getSupabase();
      if (!supa) return;
      const prev = snapshot.current;
      const next = makeSnapshot(allNotes, allTasks);
      const noteUpserts = allNotes.filter(
        n => prev.notes.get(n.id) !== next.notes.get(n.id),
      );
      const noteDeletes = [...prev.notes.keys()].filter(
        id => !next.notes.has(id),
      );
      const taskUpserts = allTasks.filter(
        t => prev.tasks.get(t.id) !== next.tasks.get(t.id),
      );
      const taskDeletes = [...prev.tasks.keys()].filter(
        id => !next.tasks.has(id),
      );
      if (
        noteUpserts.length === 0 &&
        noteDeletes.length === 0 &&
        taskUpserts.length === 0 &&
        taskDeletes.length === 0
      ) {
        return;
      }
      setSyncStatus("syncing");
      queue.current = queue.current.then(async () => {
        try {
          if (noteUpserts.length > 0) {
            const { error } = await supa
              .from(NOTES_TABLE)
              .upsert(noteUpserts.map(noteToRow));
            if (error) throw error;
          }
          if (noteDeletes.length > 0) {
            const { error } = await supa
              .from(NOTES_TABLE)
              .delete()
              .in("id", noteDeletes);
            if (error) throw error;
          }
          if (taskUpserts.length > 0) {
            const { error } = await supa
              .from(TASKS_TABLE)
              .upsert(taskUpserts.map(taskToRow));
            if (error) throw error;
          }
          if (taskDeletes.length > 0) {
            const { error } = await supa
              .from(TASKS_TABLE)
              .delete()
              .in("id", taskDeletes);
            if (error) throw error;
          }
          snapshot.current = next;
          setSyncStatus("synced");
        } catch (err) {
          console.error("[sync] push failed", err);
          setSyncStatus("error");
        }
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [allNotes, allTasks, userId, setSyncStatus]);
}
