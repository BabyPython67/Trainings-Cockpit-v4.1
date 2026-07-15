// Gezielte Verifikation der neuen SplitsChart/PulseTrendChart-Logik (v6.4): lädt die ECHTE, vom Nutzer
// bereitgestellte Garmin-CSV über den regulären App-Import-Weg hoch (nicht nur Seed-Fixtures) und
// fotografiert das Ergebnis — direkter Vergleich mit dem ursprünglich eingereichten Screenshot-Problem
// (5 von 5 Arbeitsrunden fälschlich "out of zone" bei reiner Durchschnitts-Bewertung).
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SEED } from "./seed.mjs";

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(TOOLS_DIR, "..", "index.html");
const CSV_FIXTURE = path.join(TOOLS_DIR, "fixtures", "activity_23427253834_2.csv");
const SHOTS_DIR = path.join(TOOLS_DIR, ".build", "shots");
mkdirSync(SHOTS_DIR, { recursive: true });

const server = createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(readFileSync(HTML)); }).listen(8353);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });
const problems = [];

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: theme });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.addInitScript(([seed, th]) => { localStorage.setItem("trainings-cockpit-v1", JSON.stringify({ ...seed, theme: th })); }, [SEED, theme]);
  await page.goto("http://localhost:8353/");
  await page.waitForFunction(() => window.__mounted === true, null, { timeout: 15000 });
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Training" }).click();
  await page.getByRole("button", { name: "Fortschritt" }).click();
  await page.waitForTimeout(600);

  // Echte CSV über den regulären Import-Weg hochladen (verdeckter <input type="file">)
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles(CSV_FIXTURE);
  await page.waitForTimeout(600);
  const previewVisible = await page.locator("text=Vorschau · Datum bestätigen").count();
  if (!previewVisible) { problems.push(`${theme}: CSV-Import-Vorschau nicht erschienen`); await ctx.close(); continue; }

  // Datum auf einen Intervall-Termin im Plan setzen (Woche 3, wie im Original-Screenshot: HF-Ziel 180-188)
  // und Typ explizit auf Intervalle — deckungsgleich mit der Session, aus der die CSV stammt.
  const previewCard = page.locator("text=Vorschau · Datum bestätigen").locator("xpath=ancestor::div[contains(@class,'p-4')][1]");
  await previewCard.locator('input[type="date"]').fill("2026-07-07");
  await previewCard.locator("select").selectOption("int");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await page.waitForTimeout(600);

  // Neu importierte Runde aufklappen (eindeutig über die Distanz 5.85 km identifizierbar)
  const rows = page.locator("div.divide-y > div");
  const rowCount = await rows.count();
  let opened = false;
  for (let i = 0; i < rowCount && !opened; i++) {
    const row = rows.nth(i);
    if ((await row.innerText()).includes("5.85")) {
      const btns = row.locator("button");
      const n = await btns.count();
      if (n >= 2) { await btns.nth(n - 2).click(); opened = true; }
    }
  }
  if (!opened) { problems.push(`${theme}: importierte Runde (5.85 km) nicht gefunden/aufklappbar`); await ctx.close(); continue; }
  await page.waitForTimeout(700);

  const splitsCard = page.locator("text=Zielbereich").locator("xpath=ancestor::div[contains(@class,'px-4') and contains(@class,'pb-3')][1]").first();
  if (await splitsCard.count()) {
    await splitsCard.screenshot({ path: path.join(SHOTS_DIR, `real-import-splits-${theme}.png`) });
    console.log(theme + ": echte CSV importiert und SplitsChart fotografiert");
  } else {
    problems.push(`${theme}: SplitsChart-Karte nach Import nicht gefunden`);
  }

  if (errors.length) problems.push(`${theme}: ${errors.length} Konsolenfehler: ` + errors.slice(0, 3).join(" ;; "));
  await ctx.close();
}

await browser.close();
server.close();
if (problems.length) { console.log("PROBLEME:\n" + problems.join("\n")); process.exit(1); }
console.log("Echte-CSV-Verifikation ok — Screenshots in tools/.build/shots/");
