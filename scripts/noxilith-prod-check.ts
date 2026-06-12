/** Production smoke test: app loads, signup + cloud sync works on the live URL. */
import { chromium } from "playwright";

const APP_URL = process.env.APP_URL || "https://noxilith.vercel.app";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForURL(/\/note\//, { timeout: 15000 });
  console.log("app loads:", page.url());

  const email = `svat-noxi-prod-${Date.now()}@yahoo.com`;
  await page.getByLabel("Облачная синхронизация — войти").click();
  await page.getByRole("tab", { name: "Регистрация" }).click();
  await page.locator("#email-up").fill(email);
  await page.locator("#password-up").fill("Noxi-prod-12345");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await page.waitForSelector('[aria-label="Облако: синхронизировано"]', {
    timeout: 25000,
  });
  console.log("cloud signup + sync: OK");
  await browser.close();
  console.log("✅ PROD CHECK PASSED");
}

main().catch(err => {
  console.error("❌ PROD CHECK FAILED:", err);
  process.exit(1);
});
