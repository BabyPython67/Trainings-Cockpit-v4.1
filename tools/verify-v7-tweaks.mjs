// Gezielte Verifikation der Nach-v7.0-Anpassungen: Ring-Eskalation über mehrere Stufen (aufgeklappt),
// Ausgefallen-Kennzeichnung in den Wochen-Charts, Tap-Hervorhebung im Fortschritt-je-Lauftyp-Chart.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SEED } from "./seed.mjs";

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(TOOLS_DIR, "..", "index.html");
const SHOTS_DIR = path.join(TOOLS_DIR, ".build", "shots");
mkdirSync(SHOTS_DIR, { recursive: true });

const server = createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(readFileSync(HTML)); }).listen(8352);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });
const problems = [];

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.addInitScript(([seed, th]) => { localStorage.setItem("trainings-cockpit-v1", JSON.stringify({ ...seed, theme: th })); }, [SEED, theme]);
  await page.goto("http://localhost:8352/");
  await page.waitForFunction(() => window.__mounted === true, null, { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 1) Cockpit: Auszeichnungen-Karte aufklappen, alle Leitern sichtbar (Ring-Eskalation über Stufen)
  const badgesCard = page.locator("text=Auszeichnungen").first().locator("xpath=ancestor::div[contains(@class,'p-4')][1]");
  await badgesCard.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Alle Auszeichnungen/ }).click();
  await page.waitForTimeout(400);
  await badgesCard.screenshot({ path: path.join(SHOTS_DIR, `v7tweak-badges-expanded-${theme}.png`) });

  // 2) Woche-Tab: Ausgefallen-Bar in WeekRhythm (Cockpit) bereits sichtbar auf Screenshot 1 — hier
  // gezielt die "Diese Woche: Plan vs. Ist"-Karte im Recovery-Tab
  await page.getByRole("button", { name: "Recovery" }).click();
  await page.waitForTimeout(500);
  const planVsIst = page.locator("text=Diese Woche: Plan vs. Ist").locator("xpath=ancestor::div[contains(@class,'p-4')][1]");
  await planVsIst.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await planVsIst.screenshot({ path: path.join(SHOTS_DIR, `v7tweak-planvsist-${theme}.png`) });

  // 3) Fortschritt-Tab: TypeProgressCharts antippen, große Zahlen + hervorgehobener Punkt prüfen
  await page.getByRole("button", { name: "Fortschritt" }).click();
  await page.waitForTimeout(500);
  const progressCard = page.locator("text=Fortschritt je Lauftyp").locator("xpath=ancestor::div[contains(@class,'p-4')][1]");
  await progressCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await progressCard.screenshot({ path: path.join(SHOTS_DIR, `v7tweak-progress-default-${theme}.png`) });
  const paceChart = progressCard.locator("svg.recharts-surface").first();
  const box = await paceChart.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await page.waitForTimeout(300);
    await progressCard.screenshot({ path: path.join(SHOTS_DIR, `v7tweak-progress-tapped-${theme}.png`) });
  } else {
    problems.push(`${theme}: Pace-Chart-SVG nicht gefunden, Tap-Test übersprungen`);
  }

  if (errors.length) problems.push(`${theme}: ${errors.length} Konsolenfehler: ` + errors.slice(0, 3).join(" ;; "));
  await ctx.close();
}

await browser.close();
server.close();
if (problems.length) { console.log("PROBLEME:\n" + problems.join("\n")); process.exit(1); }
console.log("v7.0-Nachbesserungen verifiziert — Screenshots in tools/.build/shots/");
