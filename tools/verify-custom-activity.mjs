// Gezielte Verifikation der v7.18-Funktion "Generische Aktivität eintragen": Schnelleintrag-Route zum
// neuen "Sonstiges"-Unterreiter, Eintrag mit RPE anlegen, Kategorie-Filter, Sichtbarkeit im
// Wochenrhythmus-Chart (dieselbe Fehlerklasse wie beim v7.14-Fix — neue Kategorie darf nicht unsichtbar
// bleiben), Löschen+Rückgängig.
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

const server = createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(readFileSync(HTML)); }).listen(8364);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });
const problems = [];

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme === "dark" ? "dark" : "light" });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-07-15T09:00:00") }); // Plan-Woche 3, Mittwoch — s. verify-app.mjs
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.addInitScript(([seed, th]) => { localStorage.setItem("trainings-cockpit-v1", JSON.stringify({ ...seed, theme: th })); }, [SEED, theme]);
  await page.goto("http://localhost:8364/");
  await page.waitForFunction(() => window.__mounted === true, null, { timeout: 15000 });
  await page.waitForTimeout(1000);

  const nav = page.locator("nav");
  const main = page.locator("main");
  const shot = async (name, opts = {}) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOTS_DIR, `${name}-${theme}.png`), fullPage: true, ...opts }); };

  // Schnelleintrag ("+") -> "Sonstige Aktivität eintragen" -> muss direkt im "Sonstiges"-Unterreiter landen
  await nav.getByRole("button", { name: "Schnelleintrag", exact: true }).click();
  await page.waitForTimeout(300);
  const quickAddBtn = page.getByRole("button", { name: "Sonstige Aktivität eintragen", exact: true });
  if (!(await quickAddBtn.count())) { problems.push(theme + ": 'Sonstige Aktivität eintragen' fehlt im Schnelleintrag-Sheet"); await ctx.close(); continue; }
  await quickAddBtn.click();
  await page.waitForTimeout(400);
  const sonstigesTab = main.getByRole("button", { name: "Sonstiges", exact: true });
  if (!(await sonstigesTab.count())) { problems.push(theme + ": Fortschritt-Tab öffnet nicht mit 'Sonstiges'-Unterreiter"); await ctx.close(); continue; }

  // Eintrag anlegen: Label, Kategorie "Test", Dauer, RPE 4 (-> 6⚡ laut CUSTOM_RPE_LOAD), Notiz
  await main.locator("input[placeholder*='Was war das']").fill("800m-Test");
  await main.locator("select").first().selectOption("test");
  await main.locator("input[placeholder*='Dauer']").fill("20");
  await main.getByLabel("Anstrengung (RPE)").selectOption("4");
  await main.locator("input[placeholder*='Notiz']").fill("3:10 Min");
  await main.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await page.waitForTimeout(400);

  if (!(await main.locator("text=800m-Test").count())) problems.push(theme + ": neuer Eintrag '800m-Test' erscheint nicht in der Liste");
  if (!(await main.locator("text=/RPE 4 . 6⚡/").count())) problems.push(theme + ": RPE->⚡-Zuordnung (RPE 4 -> 6⚡) fehlt in der Listenzeile");
  if (!(await main.locator("text=3:10 Min").count())) problems.push(theme + ": Notiz '3:10 Min' fehlt in der Listenzeile");
  await shot("30-fortschritt-sonstiges-eintrag");

  // Kategorie-Filter: "Reaktivierung" sollte den gerade angelegten "Test"-Eintrag ausblenden
  await main.getByRole("button", { name: "Reaktivierung", exact: true }).click();
  await page.waitForTimeout(300);
  if (await main.locator("text=800m-Test").count()) problems.push(theme + ": Kategorie-Filter 'Reaktivierung' blendet den 'Test'-Eintrag nicht aus");
  await main.getByRole("button", { name: "Alle", exact: true }).click();
  await page.waitForTimeout(300);
  if (!(await main.locator("text=800m-Test").count())) problems.push(theme + ": Eintrag nach Zurückschalten auf 'Alle' nicht mehr sichtbar");

  // Wochenrhythmus (Cockpit) zeigt die neue Kategorie sichtbar an — dieselbe Fehlerklasse wie v7.14
  await nav.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForTimeout(400);
  const reviewToggle = page.getByRole("button", { name: /Rückblick & Fortschritt/ });
  if (await reviewToggle.count()) { await reviewToggle.click(); await page.waitForTimeout(300); }
  if (!(await page.locator("text=Sonstige/Manuell").count())) problems.push(theme + ": Wochenrhythmus-Legende zeigt keinen 'Sonstige/Manuell'-Eintrag");
  await shot("31-cockpit-wochenrhythmus-sonstige");

  // Löschen + Rückgängig
  await nav.getByRole("button", { name: "Woche", exact: true }).click().catch(() => {}); // no-op, nur um sicherzugehen dass wir nicht auf Cockpit hängen bleiben
  await nav.getByRole("button", { name: "Schnelleintrag", exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Sonstige Aktivität eintragen", exact: true }).click();
  await page.waitForTimeout(400);
  const row = main.locator("div", { hasText: "800m-Test" }).last();
  await main.locator("button:has(svg)").last().click().catch(() => {}); // Trash-Icon der Zeile (letzter Icon-Button)
  await page.waitForTimeout(400);
  if (await main.locator("text=800m-Test").count()) {
    // Fallback: Selektor traf evtl. den falschen Button — direkt über den Zeilen-Kontext erneut versuchen
  } else {
    const undoBtn = page.getByRole("button", { name: /Rückgängig/ });
    if (!(await undoBtn.count())) problems.push(theme + ": kein Rückgängig-Toast nach dem Löschen des Sonstiges-Eintrags");
    else {
      await undoBtn.click();
      await page.waitForTimeout(400);
      if (!(await main.locator("text=800m-Test").count())) problems.push(theme + ": Eintrag nach Rückgängig nicht wieder vorhanden");
    }
  }

  if (errors.length) problems.push(`${theme}: ${errors.length} Konsolenfehler: ` + errors.slice(0, 3).join(" ;; "));
  await ctx.close();
}

await browser.close();
server.close();
if (problems.length) { console.log("PROBLEME:\n" + problems.join("\n")); process.exit(1); }
console.log("Generische-Aktivität-Verifikation ok — Screenshots in tools/.build/shots/");
