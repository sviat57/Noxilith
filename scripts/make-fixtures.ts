/** Generates test fixture files (docx, pdf) for the e2e import test. */
import { mkdirSync, writeFileSync } from "node:fs";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";

const DIR = "tmp/fixtures";
mkdirSync(DIR, { recursive: true });

// ── .docx with H1 title + Cyrillic body ──
const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("Заметка из Word")],
        }),
        new Paragraph({
          children: [
            new TextRun("Это текст, импортированный из документа Word."),
          ],
        }),
        new Paragraph({ children: [new TextRun("Вторая строка из docx.")] }),
      ],
    },
  ],
});
const buf = await Packer.toBuffer(doc);
writeFileSync(`${DIR}/import-test.docx`, buf);

// ── .pdf (latin text — standard fonts) ──
const pdf = new jsPDF();
pdf.setFontSize(16);
pdf.text("PDF import fixture", 20, 30);
pdf.setFontSize(11);
pdf.text("This text was imported from a PDF file.", 20, 45);
writeFileSync(
  `${DIR}/import-test.pdf`,
  Buffer.from(pdf.output("arraybuffer")),
);

console.log("fixtures written to", DIR);
