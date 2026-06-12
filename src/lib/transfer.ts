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
    `noxilith-${stamp()}.json`,
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
  download(blob, `noxilith-${ext}-${stamp()}.zip`);
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
  XLSX.writeFile(wb, `noxilith-${stamp()}.xlsx`);
}

export async function exportPptx(notes: Note[]): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";

  const title = pptx.addSlide();
  title.background = { color: "1A1626" };
  title.addText("Noxilith 🌑", {
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
  await pptx.writeFile({ fileName: `noxilith-${stamp()}.pptx` });
}

async function fetchFontBase64(path: string): Promise<string> {
  const buf = await (await fetch(path)).arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function exportPdf(notes: Note[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const [regular, bold] = await Promise.all([
    fetchFontBase64("/fonts/DejaVuSans.ttf"),
    fetchFontBase64("/fonts/DejaVuSans-Bold.ttf"),
  ]);
  doc.addFileToVFS("DejaVuSans.ttf", regular);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");

  const W = 210;
  const M = 20;
  const bottom = 277;
  let y = 0;

  // Title page
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(30);
  doc.setTextColor(109, 78, 217);
  doc.text("Noxilith", W / 2, 120, { align: "center" });
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(12);
  doc.setTextColor(120, 120, 130);
  doc.text(
    `Экспорт заметок · ${new Date().toLocaleDateString("ru-RU")} · заметок: ${notes.length}`,
    W / 2,
    132,
    { align: "center" },
  );

  for (const n of notes) {
    doc.addPage();
    y = M + 4;
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(17);
    doc.setTextColor(40, 35, 60);
    for (const line of doc.splitTextToSize(n.title, W - M * 2) as string[]) {
      doc.text(line, M, y);
      y += 8;
    }
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 150);
    doc.text(
      `создана ${fmtDate(n.createdAt)} · изменена ${fmtDate(n.updatedAt)}`,
      M,
      y,
    );
    y += 4;
    doc.setDrawColor(109, 78, 217);
    doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y);
    y += 8;
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 60);
    const body = n.content || "(пустая заметка)";
    for (const line of doc.splitTextToSize(body, W - M * 2) as string[]) {
      if (y > bottom) {
        doc.addPage();
        y = M;
      }
      doc.text(line, M, y);
      y += 5.6;
    }
  }
  doc.save(`noxilith-${stamp()}.pdf`);
}

export async function exportDocx(notes: Note[]): Promise<void> {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun, AlignmentType } =
    await import("docx");

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 200 },
      children: [
        new TextRun({
          text: "Noxilith 🌑",
          bold: true,
          size: 64,
          color: "6D4ED9",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Экспорт заметок · ${new Date().toLocaleDateString("ru-RU")} · заметок: ${notes.length}`,
          size: 22,
          color: "8A8A96",
        }),
      ],
    }),
  ];

  for (const n of notes) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun({ text: n.title, bold: true, color: "6D4ED9" })],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `создана ${fmtDate(n.createdAt)} · изменена ${fmtDate(n.updatedAt)}`,
            italics: true,
            size: 18,
            color: "8A8A96",
          }),
        ],
      }),
    );
    for (const line of (n.content || "(пустая заметка)").split("\n")) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: line, size: 22 })],
        }),
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: { document: { run: { font: "Calibri" } } },
    },
  });
  const blob = await Packer.toBlob(doc);
  download(blob, `noxilith-${stamp()}.docx`);
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
      } else if (ext === "docx") {
        const mammoth = await import("mammoth");
        const { default: TurndownService } = await import("turndown");
        const { value: html } = await mammoth.convertToHtml({
          arrayBuffer: await file.arrayBuffer(),
        });
        const td = new TurndownService({
          headingStyle: "atx",
          bulletListMarker: "-",
        });
        const md = td.turndown(html);
        const base = file.name.replace(/\.docx$/i, "");
        const m = md.match(/^#\s+(.+)\n+/);
        h.createNote(m ? m[1].trim() : base, m ? md.slice(m[0].length) : md);
        res.notes++;
      } else if (ext === "pdf") {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (
          await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
        ).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const pdf = await pdfjs.getDocument({
          data: await file.arrayBuffer(),
        }).promise;
        const pages: string[] = [];
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const tc = await page.getTextContent();
          let text = "";
          for (const item of tc.items) {
            if ("str" in item) {
              text += item.str;
              if (item.hasEOL) text += "\n";
            }
          }
          pages.push(text.trim());
        }
        const base = file.name.replace(/\.pdf$/i, "");
        h.createNote(base, pages.filter(Boolean).join("\n\n"));
        res.notes++;
      } else {
        res.errors.push(`${file.name}: формат .${ext} не поддерживается`);
      }
    } catch {
      res.errors.push(`${file.name}: не удалось прочитать файл`);
    }
  }
  return res;
}
