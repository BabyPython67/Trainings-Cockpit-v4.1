// Gezielte Verifikation der v7.17-Funktion "Einheit entschuldigen" (krank / körperlich nicht bereit):
// eine offene Einheit entschuldigen, Badge + Zurücknehmen-Button prüfen, zurücknehmen, und sicherstellen,
// dass die bestehende "Verschieben"-Funktion (v7.13) davon unberührt bleibt (Regressionscheck laut
// workflows/ship-version.md-Fallstrick — neue Aktion am selben Gate wie eine bestehende).
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

const server = createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(readFileSync(HTML)); }).listen(8363);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });
const problems = [];

async function dayCard(main, dayLetter) {
  const heading = main.locator("div.font-display.font-bold", { hasText: new RegExp(`^${dayLetter}$`) });
  return heading.locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
}

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme === "dark" ? "dark" : "light" });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-07-15T09:00:00") }); // Plan-Woche 3, s. verify-app.mjs
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.addInitScript(([seed, th]) => { localStorage.setItem("trainings-cockpit-v1", JSON.stringify({ ...seed, theme: th })); }, [SEED, theme]);
  await page.goto("http://localhost:8363/");
  await page.waitForFunction(() => window.__mounted === true, null, { timeout: 15000 });
  await page.waitForTimeout(1000);

  const nav = page.locator("nav");
  const main = page.locator("main");
  const shot = async (name, opts = {}) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOTS_DIR, `${name}-${theme}.png`), fullPage: true, ...opts }); };

  await nav.getByRole("button", { name: "Woche", exact: true }).click();
  await page.waitForTimeout(400);

  // Dienstag ist in Woche 3 laut Seed noch offen (nur Montag ist "done") — Zeile aufklappen, "Entschuldigen" suchen.
  const diCard = await dayCard(main, "Di");
  const diRow = diCard.locator("div.transition").first();
  const diExpandBtn = diRow.locator("button").last();
  await diExpandBtn.click().catch(() => problems.push(theme + ": Dienstag-Zeile nicht aufklappbar"));
  await page.waitForTimeout(300);
  const excuseBtn = diRow.getByRole("button", { name: "Entschuldigen", exact: true });
  if (!(await excuseBtn.count())) { problems.push(theme + ": 'Entschuldigen'-Button an offener Dienstag-Einheit nicht gefunden"); await ctx.close(); continue; }

  await excuseBtn.click();
  await page.waitForTimeout(300);
  await diRow.getByRole("button", { name: "Körperlich nicht bereit", exact: true }).click();
  await diRow.locator("input[placeholder*='Grund']").fill("Herz/Atmung nach easy Lauf schwer");
  // zweiter Button mit demselben sichtbaren Text ("Entschuldigen") ist jetzt der Speichern-Button im Formular
  await diRow.getByRole("button", { name: "Entschuldigen", exact: true }).click();
  await page.waitForTimeout(400);

  if (!(await diRow.locator("text=Nicht bereit").count())) problems.push(theme + ": Zeile zeigt nach dem Entschuldigen kein 'Nicht bereit'-Badge");
  if (!(await diRow.locator("text=/Entschuldigt \\(körperlich nicht bereit\\)/").count())) problems.push(theme + ": Beschreibungszeile nennt nicht 'entschuldigt (körperlich nicht bereit)'");
  if (!(await diRow.getByRole("button", { name: "Entschuldigung zurücknehmen", exact: true }).count())) problems.push(theme + ": kein 'Entschuldigung zurücknehmen'-Button nach dem Entschuldigen");
  await shot("20-woche-entschuldigt-nicht-bereit");

  // Wochenrhythmus (Cockpit) rendert ohne Fehler mit dem neuen Zustand — eigene Farbe/Label statt "Ausgefallen"
  await nav.getByRole("button", { name: "Start", exact: true }).click().catch(() => nav.locator("button").first().click());
  await page.waitForTimeout(400);
  const reviewToggle = page.getByRole("button", { name: /Rückblick & Fortschritt/ });
  if (await reviewToggle.count()) { await reviewToggle.click(); await page.waitForTimeout(300); }
  if (!(await page.locator("text=Nicht bereit").count())) problems.push(theme + ": Wochenrhythmus-Legende zeigt keinen 'Nicht bereit'-Eintrag");
  await shot("21-cockpit-wochenrhythmus-nicht-bereit");

  // Zurücknehmen: Zeile wieder normal — WeekTab montiert beim Tab-Wechsel neu, "open"-State geht verloren,
  // Zeile muss vor der Interaktion erneut aufgeklappt werden.
  await nav.getByRole("button", { name: "Woche", exact: true }).click();
  await page.waitForTimeout(400);
  await diExpandBtn.click();
  await page.waitForTimeout(300);
  await diRow.getByRole("button", { name: "Entschuldigung zurücknehmen", exact: true }).click();
  await page.waitForTimeout(400);
  if (await diRow.locator("text=Nicht bereit").count()) problems.push(theme + ": Zeile zeigt nach Zurücknehmen weiterhin 'Nicht bereit'");

  // "krank" (Einzelfall) probehalber ebenfalls einmal durchklicken — eigene Farbe, eigenes Label
  await excuseBtn.click();
  await page.waitForTimeout(300);
  await diRow.getByRole("button", { name: "Krank", exact: true }).click();
  await diRow.getByRole("button", { name: "Entschuldigen", exact: true }).click();
  await page.waitForTimeout(400);
  if (!(await diRow.locator("text=Krank (Einheit)").count())) problems.push(theme + ": Zeile zeigt nach 'Krank' kein 'Krank (Einheit)'-Badge");
  await diRow.getByRole("button", { name: "Entschuldigung zurücknehmen", exact: true }).click();
  await page.waitForTimeout(300);

  // Regressionscheck: bestehende "Verschieben"-Funktion (v7.13) am selben Gate weiterhin nutzbar
  if (!(await diRow.getByRole("button", { name: "Verschieben", exact: true }).count())) problems.push(theme + ": 'Verschieben'-Button neben dem neuen 'Entschuldigen' nicht mehr vorhanden (Regression)");
  const frCard = await dayCard(main, "Fr");
  if (!(await frCard.locator("div.transition", { hasText: "Ausgefallen" }).count())) problems.push(theme + ": bestehende Ausfall-Zeile (Fr, VB) nach Entschuldigen-Feature-Änderungen nicht mehr vorhanden");

  if (errors.length) problems.push(`${theme}: ${errors.length} Konsolenfehler: ` + errors.slice(0, 3).join(" ;; "));
  await ctx.close();
}

await browser.close();
server.close();
if (problems.length) { console.log("PROBLEME:\n" + problems.join("\n")); process.exit(1); }
console.log("Entschuldigen-Verifikation ok — Screenshots in tools/.build/shots/");
