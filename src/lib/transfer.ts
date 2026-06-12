import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";
import type { Note, Task } from "@/lib/vault";

/** Export / import of vault data in multiple formats (all client-side). */

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function safeName(title: string): string {
  return (
    title
      .replace(/[\\/:*?"<>|]/g, "-")
      .trim()
      .slice(0, 80) || "untitled"
  );
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ru-RU");
}

const stamp = () => new Date().toISOString().slice(0, 10);

// ── Export ──

export function exportJson(json: string): void {
  download(
    new Blob([json], { type: "application/json" }),
    `mindgarden-${stamp()}.json`,
  );
}

async function notesZip(notes: Note[], ext: "md" | "txt"): Promise<void> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const n of notes) {
    let name = safeName(n.title);
    let i = 2;
    while (used.has(name)) name = `${safeName(n.title)}-${i++}`;
    used.add(name);
    const header =
      ext === "md"
        ? `# ${n.title}\n\n> Создана: ${fmtDate(n.createdAt)} · Изменена: ${fmtDate(n.updatedAt)}\n\n`
        : `${n.title}\nСоздана: ${fmtDate(n.createdAt)}\n\n`;
    zip.file(`${name}.${ext}`, header + n.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  download(blob, `mindgarden-${ext}-${stamp()}.zip`);
}

export const exportMarkdown = (notes: Note[]) => notesZip(notes, "md");
export const exportTxt = (notes: Note[]) => notesZip(notes, "txt");

export function exportXlsx(notes: Note[], tasks: Task[]): void {
  const wb = XLSX.utils.book_new();
  const noteRows = notes.map(n => ({
    Название: n.title,
    Содержимое: n.content,
    Создана: fmtDate(n.createdAt),
    Изменена: fmtDate(n.updatedAt),
    Закреплена: n.pinned ? "да" : "",
  }));
  const taskRows = tasks.map(t => ({
    Задача: t.text,
    Дата: t.due,
    Выполнена: t.done ? "да" : "",
    "Когда выполнена": t.completedAt ? fmtDate(t.completedAt) : "",
  }));
  const ws1 = XLSX.utils.json_to_sheet(noteRows);
  ws1["!cols"] = [
    { wch: 32 },
    { wch: 80 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
  ];
  const ws2 = XLSX.utils.json_to_sheet(taskRows);
  ws2["!cols"] = [{ wch: 40 }, { wch: 12 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Заметки");
  XLSX.utils.book_append_sheet(wb, ws2, "Задачи");
  XLSX.writeFile(wb, `mindgarden-${stamp()}.xlsx`);
}

export async function exportPptx(notes: Note[]): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";

  const title = pptx.addSlide();
  title.background = { color: "1A1626" };
  title.addText("MindGarden 🌱", {
    x: 0.8,
    y: 2.6,
    w: 11.7,
    h: 1.2,
    fontSize: 44,
    bold: true,
    color: "C4B5FD",
    fontFace: "Arial",
  });
  title.addText(
    `Экспорт заметок · ${new Date().toLocaleDateString("ru-RU")} · ${notes.length} заметок`,
    {
      x: 0.8,
      y: 3.9,
      w: 11.7,
      h: 0.6,
      fontSize: 18,
      color: "9A93B0",
      fontFace: "Arial",
    },
  );

  for (const n of notes) {
    const s = pptx.addSlide();
    s.background = { color: "1A1626" };
    s.addText(n.title, {
      x: 0.7,
      y: 0.45,
      w: 12,
      h: 0.9,
      fontSize: 28,
      bold: true,
      color: "C4B5FD",
      fontFace: "Arial",
    });
    s.addText(
      `создана ${fmtDate(n.createdAt)} · изменена ${fmtDate(n.updatedAt)}`,
      {
        x: 0.7,
        y: 1.3,
        w: 12,
        h: 0.4,
        fontSize: 12,
        color: "9A93B0",
        fontFace: "Arial",
      },
    );
    const body =
      n.content.length > 1800 ? `${n.content.slice(0, 1800)}…` : n.content;
    s.addText(body || "(пустая заметка)", {
      x: 0.7,
      y: 1.85,
      w: 12,
      h: 5.2,
      fontSize: 14,
      color: "EDEAF6",
      fontFace: "Arial",
      valign: "top",
    });
  }
  await pptx.writeFile({ fileName: `mindgarden-${stamp()}.pptx` });
}

// ── Import ──

export interface ImportHandlers {
  importData: (json: string) => boolean;
  createNote: (title?: string, content?: string) => Note;
}

export interface ImportResult {
  notes: number;
  restored: boolean;
  errors: string[];
}

export async function importFiles(
  files: FileList | File[],
  h: ImportHandlers,
): Promise<ImportResult> {
  const res: ImportResult = { notes: 0, restored: false, errors: [] };
  for (const file of Array.from(files)) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      if (ext === "json") {
        const ok = h.importData(await file.text());
        if (ok) res.restored = true;
        else res.errors.push(`${file.name}: неверный формат бэкапа`);
      } else if (ext === "md" || ext === "txt") {
        const text = await file.text();
        const base = file.name.replace(/\.(md|txt)$/i, "");
        // If the file starts with an H1, use it as the title
        const m = text.match(/^#\s+(.+)\n+/);
        const title = m ? m[1].trim() : base;
        const content = m ? text.slice(m[0].length) : text;
        h.createNote(title, content);
        res.notes++;
      } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        const wb = XLSX.read(await file.arrayBuffer());
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        for (const row of rows) {
          const title = String(
            row.Название ??
              row.Title ??
              row.title ??
              Object.values(row)[0] ??
              "",
          ).trim();
          const content = String(
            row.Содержимое ??
              row.Content ??
              row.content ??
              Object.values(row)[1] ??
              "",
          );
          if (title) {
            h.createNote(title, content);
            res.notes++;
          }
        }
      } else {
        res.errors.push(`${file.name}: формат .${ext} не поддерживается`);
      }
    } catch {
      res.errors.push(`${file.name}: не удалось прочитать файл`);
    }
  }
  return res;
}
