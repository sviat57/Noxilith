/**
 * E2E test for MindGarden (viktor_auth mode is mocked locally —
 * the platform serves /__viktor_auth/me in real deployments).
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = join(__dirname, "..", "tmp");
const APP_URL = process.env.APP_URL || "http://localhost:4173";
const SPACE_ID = "AebyKt87KEozBSdBuP5kcE";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function setupPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.route("**/__viktor_auth/me", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "allowed",
        user: {
          id: "test-user",
          email: "test@example.com",
          display_name: "Test",
        },
        resource: {
          resource_type: "space",
          resource_id: SPACE_ID,
          audience: `space:${SPACE_ID}`,
        },
      }),
    }),
  );
  return page;
}

async function main() {
  mkdirSync(TMP_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await setupPage(browser);
  const shot = (name: string) => page.screenshot({ path: join(TMP_DIR, name) });

  try {
    // ── 1. Notes view: seeded welcome note opens ──
    await page.goto(`${APP_URL}/`, { waitUntil: "networkidle" });
    await page.waitForURL(/\/note\//, { timeout: 10000 });
    const title = page.getByTestId("note-title");
    assert(
      (await title.inputValue()) === "Добро пожаловать",
      `welcome note open, got "${await title.inputValue()}"`,
    );
    // preview renders wikilinks
    const wikilink = page.locator(".md-preview .wikilink", {
      hasText: "Как делать заметки",
    });
    assert(await wikilink.isVisible(), "wikilink visible in preview");
    // created date shown in info panel
    assert(
      await page.getByTestId("created-date").isVisible(),
      "created date visible",
    );
    await shot("01-notes.png");

    // ── 2. Wikilink navigation + backlinks ──
    await wikilink.click();
    await page.waitForTimeout(300);
    assert(
      (await title.inputValue()) === "Как делать заметки",
      "wikilink navigated to target note",
    );
    const backlinks = page.getByTestId("backlinks");
    assert(
      (await backlinks.textContent())?.includes("Добро пожаловать"),
      "backlink from welcome note shown",
    );

    // ── 3. Create a note with link + tag ──
    await page.getByTestId("new-note").click();
    await page.waitForTimeout(300);
    await title.fill("Тестовая заметка");
    await page
      .getByTestId("note-editor")
      .fill("Мысль дня: связи решают. См. [[Добро пожаловать]] #тест");
    await page.getByTestId("toggle-edit").click(); // to preview
    await page.waitForTimeout(200);
    const newLink = page.locator(".md-preview .wikilink");
    await newLink.click();
    await page.waitForTimeout(300);
    assert(
      (await title.inputValue()) === "Добро пожаловать",
      "new note's wikilink navigates",
    );
    assert(
      (await backlinks.textContent())?.includes("Тестовая заметка"),
      "backlinks updated with new note",
    );

    // ── 4. Search ──
    await page.getByTestId("search-input").fill("Zettelkasten");
    await page.waitForTimeout(200);
    const listText = await page.getByTestId("note-list").textContent();
    assert(listText?.includes("Метод Zettelkasten"), "search finds note");
    assert(
      !listText?.includes("Тестовая заметка"),
      "search filters others out",
    );
    await page.getByTestId("search-input").fill("");

    // ── 5. Graph view ──
    await page.goto(`${APP_URL}/graph`, { waitUntil: "networkidle" });
    assert(
      await page.getByTestId("graph-view").isVisible(),
      "graph view visible",
    );
    const graphHeader = await page.getByTestId("graph-view").textContent();
    assert(graphHeader?.includes("заметок"), "graph stats shown");
    await page.waitForTimeout(2000); // let simulation settle
    await shot("02-graph.png");

    // ── 6. Calendar: notes by creation day + tasks ──
    await page.goto(`${APP_URL}/calendar`, { waitUntil: "networkidle" });
    assert(
      await page.getByTestId("calendar-month").isVisible(),
      "calendar month header",
    );
    const todayCell = page.getByTestId("calendar-today");
    assert(
      (await todayCell.textContent())?.includes("1"),
      "today cell shows note created today",
    );
    await page.getByTestId("task-input").fill("Проверить календарь");
    await page.getByTestId("task-add").click();
    await page.waitForTimeout(200);
    const taskList = await page.getByTestId("task-list").textContent();
    assert(taskList?.includes("Проверить календарь"), "task added");
    await shot("03-calendar.png");

    // ── 7. Timer ──
    await page.goto(`${APP_URL}/timer`, { waitUntil: "networkidle" });
    const clock = page.getByTestId("timer-clock");
    assert((await clock.textContent()) === "25:00", "timer starts at 25:00");
    await page.getByTestId("timer-toggle").click();
    await page.waitForTimeout(2500);
    const after = await clock.textContent();
    assert(after !== "25:00", `timer counts down (now ${after})`);
    await shot("04-timer.png");
    // floating pill on other pages while running
    await page.goto(`${APP_URL}/calendar`, { waitUntil: "networkidle" });
    assert(
      await page.locator("a[href='/timer']").last().isVisible(),
      "floating timer pill visible",
    );

    // ── 8. Persistence across reload ──
    await page.goto(`${APP_URL}/`, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("search-input").fill("Тестовая");
    await page.waitForTimeout(200);
    assert(
      (await page.getByTestId("note-list").textContent())?.includes(
        "Тестовая заметка",
      ),
      "note persisted after reload",
    );

    // ── 9. Wikilink autocomplete ──
    await page.goto(`${APP_URL}/`, { waitUntil: "networkidle" });
    await page.getByTestId("new-note").click();
    await page.waitForTimeout(300);
    await page.getByTestId("note-title").fill("Проверка ссылок");
    const editor = page.getByTestId("note-editor");
    await editor.click();
    await editor.pressSequentially("Идея: [[Мет", { delay: 30 });
    assert(
      await page.getByTestId("link-suggest").isVisible(),
      "autocomplete panel appears after [[",
    );
    await shot("06-autocomplete.png");
    await page.keyboard.press("Enter");
    const edited = await editor.inputValue();
    assert(
      edited.includes("[[Метод Zettelkasten]]"),
      `autocomplete inserted link, got: ${edited}`,
    );

    // ── 10. Trash: delete note -> archive -> restore ──
    await page
      .locator("button:has(svg.lucide-trash2), button:has(svg.lucide-trash-2)")
      .first()
      .click();
    await page.getByRole("button", { name: "В корзину" }).click();
    await page.waitForTimeout(300);
    await page.goto(`${APP_URL}/archive`, { waitUntil: "networkidle" });
    await page.getByTestId("tab-trash").click();
    await page.waitForTimeout(200);
    assert(
      (await page.getByTestId("trash-list").textContent())?.includes(
        "Проверка ссылок",
      ),
      "deleted note shown in trash",
    );
    await shot("05-archive.png");
    await page.getByTestId("note-restore").first().click();
    await page.waitForURL(/\/note\//, { timeout: 5000 });
    assert(
      (await page.getByTestId("note-title").inputValue()) === "Проверка ссылок",
      "note restored from trash",
    );

    // ── 11. Completed tasks tab ──
    await page.goto(`${APP_URL}/calendar`, { waitUntil: "networkidle" });
    await page.getByTestId("task-list").locator("li button").first().click(); // toggle first task done
    await page.waitForTimeout(200);
    await page.goto(`${APP_URL}/archive`, { waitUntil: "networkidle" });
    const doneText = await page.getByTestId("done-list").textContent();
    assert(
      doneText !== null && doneText.includes("выполнено"),
      "completed task shown in archive",
    );
    await page.getByTestId("task-reopen").first().click();
    await page.waitForTimeout(200);

    // ── 12. Command palette (Ctrl+K) ──
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(300);
    assert(
      await page.getByTestId("palette-input").isVisible(),
      "palette opens on Ctrl+K",
    );
    await page.getByTestId("palette-input").fill("Zettel");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/note\//, { timeout: 5000 });
    assert(
      (await page.getByTestId("note-title").inputValue()) ===
        "Метод Zettelkasten",
      "palette navigates to note",
    );

    // ── 13. Daily note ──
    await page.locator("button[aria-label='Заметка дня']").click();
    await page.waitForTimeout(300);
    const dailyTitle = await page.getByTestId("note-title").inputValue();
    assert(
      /^\d+ .+ \d{4}$/.test(dailyTitle),
      `daily note created: ${dailyTitle}`,
    );

    // ── 14. Theme palettes ──
    await page.getByTestId("palette-picker").click();
    await page.waitForTimeout(300);
    await page.getByTestId("palette-aurora").click();
    await page.waitForTimeout(300);
    assert(
      (await page.evaluate(() => document.documentElement.dataset.theme)) ===
        "aurora",
      "aurora palette applied",
    );
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    assert(
      (await page.evaluate(() => document.documentElement.dataset.theme)) ===
        "aurora",
      "palette persists after reload",
    );
    await shot("07-theme-aurora.png");

    // ── 15. Graph styles ──
    await page.goto(`${APP_URL}/graph`, { waitUntil: "networkidle" });
    await page.getByTestId("graph-style-crystal").click();
    await page.waitForTimeout(1200);
    await shot("08-graph-crystal.png");
    await page.getByTestId("graph-style-neon").click();
    await page.waitForTimeout(1200);
    await shot("09-graph-neon.png");

    // ── 16. Transfer dialog ──
    await page.locator("button[aria-label='Экспорт и импорт']").click();
    await page.waitForTimeout(300);
    assert(
      await page.getByTestId("transfer-dialog").isVisible(),
      "transfer dialog opens",
    );
    for (const f of ["json", "md", "txt", "xlsx", "pptx", "docx", "pdf"]) {
      assert(
        await page.getByTestId(`export-${f}`).isVisible(),
        `export format ${f} present`,
      );
    }
    await shot("10-transfer.png");
    const dl = page.waitForEvent("download", { timeout: 10000 });
    await page.getByTestId("export-xlsx").click();
    const file = await dl;
    assert(
      file.suggestedFilename().endsWith(".xlsx"),
      `xlsx downloaded: ${file.suggestedFilename()}`,
    );
    const dlPdf = page.waitForEvent("download", { timeout: 20000 });
    await page.getByTestId("export-pdf").click();
    const pdfFile = await dlPdf;
    assert(
      pdfFile.suggestedFilename().endsWith(".pdf"),
      `pdf exported: ${pdfFile.suggestedFilename()}`,
    );
    const dlDocx = page.waitForEvent("download", { timeout: 20000 });
    await page.getByTestId("export-docx").click();
    const docxFile = await dlDocx;
    assert(
      docxFile.suggestedFilename().endsWith(".docx"),
      `docx exported: ${docxFile.suggestedFilename()}`,
    );
    await page.getByTestId("tab-import").click();
    assert(
      await page.getByTestId("import-pick").isVisible(),
      "import tab shows dropzone",
    );

    // ── 16b. Import .docx and .pdf via file input ──
    await page
      .locator("input[type=file]")
      .setInputFiles([
        "tmp/fixtures/import-test.docx",
        "tmp/fixtures/import-test.pdf",
      ]);
    await page.waitForTimeout(2500);
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    const sidebar = await page.textContent("body");
    assert(
      sidebar !== null && sidebar.includes("Заметка из Word"),
      "docx imported with H1 title",
    );
    assert(
      sidebar !== null && sidebar.includes("import-test"),
      "pdf imported as note",
    );

    // ── 17. Stats page ──
    await page.goto(`${APP_URL}/stats`, { waitUntil: "networkidle" });
    assert(
      await page.getByTestId("stats-page").isVisible(),
      "stats page renders",
    );
    const statsText = await page.getByTestId("stats-page").textContent();
    assert(
      statsText !== null &&
        statsText.includes("Активность") &&
        statsText.includes("Заметок"),
      "stats page has cards and heatmap",
    );
    await shot("11-stats.png");

    // reset palette back to default for repeatability
    await page.evaluate(() => localStorage.removeItem("mindgarden.prefs.v1"));

    console.log("\n✅ MindGarden e2e PASSED\n");
  } catch (err) {
    await shot("failure.png");
    console.error("\n❌ MindGarden e2e FAILED:", err);
    console.error("Page URL:", page.url());
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
