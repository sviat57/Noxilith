import {
  FileCode2,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileUp,
  Presentation,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  exportDocx,
  exportJson,
  exportMarkdown,
  exportPdf,
  exportPptx,
  exportTxt,
  exportXlsx,
  importFiles,
} from "@/lib/transfer";
import { useVault } from "@/lib/vault";

interface Format {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
}

const EXPORT_FORMATS: Format[] = [
  {
    id: "json",
    name: "JSON — полный бэкап",
    desc: "Всё: заметки, задачи, корзина. Лучший вариант для переноса.",
    icon: <FileCode2 className="size-5" />,
  },
  {
    id: "md",
    name: "Markdown (.zip)",
    desc: "Каждая заметка отдельным .md-файлом — для Obsidian и других.",
    icon: <FileDown className="size-5" />,
  },
  {
    id: "txt",
    name: "Текст (.zip)",
    desc: "Простые .txt-файлы, читаются где угодно.",
    icon: <FileText className="size-5" />,
  },
  {
    id: "xlsx",
    name: "Excel (.xlsx)",
    desc: "Таблица: лист «Заметки» + лист «Задачи».",
    icon: <FileSpreadsheet className="size-5" />,
  },
  {
    id: "pptx",
    name: "PowerPoint (.pptx)",
    desc: "Презентация — по слайду на каждую заметку.",
    icon: <Presentation className="size-5" />,
  },
  {
    id: "docx",
    name: "Word (.docx)",
    desc: "Документ Word — заметки с заголовками и датами.",
    icon: <FileType2 className="size-5" />,
  },
  {
    id: "pdf",
    name: "PDF",
    desc: "Красивый документ для чтения и печати.",
    icon: <FileDown className="size-5" />,
  },
];

export function TransferDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { notes, tasks, exportData, importData, createNote } = useVault();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const doExport = async (id: string) => {
    try {
      if (id === "json") exportJson(exportData());
      else if (id === "md") await exportMarkdown(notes);
      else if (id === "txt") await exportTxt(notes);
      else if (id === "xlsx") exportXlsx(notes, tasks);
      else if (id === "pptx") await exportPptx(notes);
      else if (id === "docx") await exportDocx(notes);
      else if (id === "pdf") await exportPdf(notes);
      toast.success("Экспорт готов — файл скачивается");
    } catch {
      toast.error("Не получилось экспортировать");
    }
  };

  const doImport = async (files: FileList | File[]) => {
    const res = await importFiles(files, { importData, createNote });
    if (res.restored) toast.success("Бэкап восстановлен полностью");
    if (res.notes > 0) toast.success(`Импортировано заметок: ${res.notes}`);
    for (const e of res.errors) toast.error(e);
    if (res.restored || res.notes > 0) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="transfer-dialog">
        <DialogHeader>
          <DialogTitle>Экспорт и импорт</DialogTitle>
          <DialogDescription>
            Выбери формат — всё происходит прямо в браузере.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="export">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" data-testid="tab-export">
              <FileUp className="mr-1.5 size-4" /> Экспорт
            </TabsTrigger>
            <TabsTrigger value="import" data-testid="tab-import">
              <FileDown className="mr-1.5 size-4" /> Импорт
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="mt-3 space-y-2">
            {EXPORT_FORMATS.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => doExport(f.id)}
                data-testid={`export-${f.id}`}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <span className="text-primary">{f.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{f.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {f.desc}
                  </span>
                </span>
              </button>
            ))}
          </TabsContent>

          <TabsContent value="import" className="mt-3">
            {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone wraps a real button */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length) doImport(e.dataTransfer.files);
              }}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <Upload className="size-8 text-primary" />
              <p className="text-sm font-medium">
                Перетащи файлы сюда или{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-2"
                  onClick={() => fileRef.current?.click()}
                  data-testid="import-pick"
                >
                  выбери на диске
                </button>
              </p>
              <p className="text-xs text-muted-foreground">
                Поддерживаются: .json (полный бэкап), .md и .txt (файл →
                заметка), .docx и .pdf (текст → заметка), .xlsx / .csv (строки →
                заметки)
              </p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".json,.md,.txt,.xlsx,.xls,.csv,.docx,.pdf"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.length) doImport(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
