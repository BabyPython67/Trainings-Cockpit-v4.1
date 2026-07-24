// Nachtest der Items 4+5 aus dem Anpassungsdokument NACH dem v7.17-Popup-Timing-Fix (Item 3): beide
// Bugreports (fehlendes Icon im Popup/Banner, doppelte Anzeige in "Neueste Erfolge") ließen sich im
// Quellcode nicht nachstellen — Hypothese war, dass beide tatsächlich Symptome des Item-3-Architektur-Bugs
// waren (Abzeichen-Prüfung lief nur, solange man auf dem Start-Tab war). Testet den ORIGINAL-Repro-Pfad:
// Meilenstein erreichen, während man NICHT auf dem Start-Tab ist (hier: manueller Lauf-Eintrag im
// Fortschritt-Tab, erreicht über den Schnelleintrag ohne je den Start-Tab zu besuchen).
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

const server = createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(readFileSync(HTML)); }).listen(8365);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });
const problems = [];

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme === "dark" ? "dark" : "light" });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-07-15T09:00:00") }); // Plan-Woche 3 — s. verify-app.mjs; SEED-runLog summiert sich auf genau 50 km
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.addInitScript(([seed, th]) => { localStorage.setItem("trainings-cockpit-v1", JSON.stringify({ ...seed, theme: th })); }, [SEED, theme]);
  await page.goto("http://localhost:8365/");
  await page.waitForFunction(() => window.__mounted === true, null, { timeout: 15000 });
  await page.waitForTimeout(1000);

  const nav = page.locator("nav");
  const main = page.locator("main");
  const shot = async (name, opts = {}) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOTS_DIR, `${name}-${theme}.png`), fullPage: true, ...opts }); };

  // Direkt zum Fortschritt-Tab (Laufzeiten) — der Start-Tab wird zu KEINEM Zeitpunkt besucht, bevor der
  // Meilenstein erreicht wird. App startet laut App-Root-Default ohnehin auf "cockpit" (Start) —
  // deshalb zuerst weg navigieren, dann erst der Schnelleintrag zum Fortschritt-Tab.
  await nav.getByRole("button", { name: "Kalender", exact: true }).click();
  await page.waitForTimeout(300);
  await nav.getByRole("button", { name: "Schnelleintrag", exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Lauf protokollieren", exact: true }).click();
  await page.waitForTimeout(400);

  // SEED-runLog summiert sich auf genau 50 km -> ein 50,1-km-Lauf reißt die 100-km-Schwelle (nächste Stufe
  // nach 25/50 in [25,50,100,150,...]) sofort, ohne dass die App je den Start-Tab montiert hätte.
  await main.locator("input[placeholder='Distanz (km)']").fill("50.1");
  await main.locator("input[placeholder='Zeit (mm:ss)']").fill("300:00");
  await main.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await page.waitForTimeout(600);

  // Item 3 (jetzt gefixt): Popup muss SOFORT erscheinen, obwohl wir nach wie vor auf dem Fortschritt-Tab sind.
  const popupTitle = page.locator("text=/Abzeichen erreicht!/");
  if (!(await popupTitle.count())) { problems.push(theme + ": Item 3 REGRESSION — kein Popup nach Meilenstein-Erreichen außerhalb des Start-Tabs"); await ctx.close(); continue; }
  // Item 4 (Nachtest): korrektes Icon (Berg-Symbol für Lauf-km-Abzeichen), NICHT der generische
  // Trophy-Fallback aus BadgeGlyph (greift nur, wenn "icon" nicht auf ein bekanntes Icon auflöst).
  // v7.21: die vendorten lucide-Icons hier rendern OHNE "class"-Attribut (kein "lucide lucide-x" wie im
  // echten npm-Paket) — eine Klassen-basierte Prüfung geht also nicht. Stattdessen direkt auf die exakte,
  // per Playwright aus window.lucide extrahierte Pfad-Geometrie prüfen (stabiler als eine Klasse zu raten):
  // Mountain = "m8 3 4 8 5-5 5 15H2L8 3z", ein eindeutiger Trophy-Pfad = "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z".
  // v7.21: gezielt die Popup-Karte selbst (rounded-2xl-Klasse ist eindeutig für dieses Modal), nicht
  // "div mit has: popupTitle" — letzteres matcht auch alle umschließenden Ancestor-Divs (root/App-Shell),
  // was popup.evaluate() (braucht genau ein Element) mit "strict mode violation" scheitern lässt.
  const popup = page.locator("div.rounded-2xl", { hasText: "Abzeichen erreicht!" });
  const hasMountainPath = await popup.locator('path[d="m8 3 4 8 5-5 5 15H2L8 3z"]').count();
  const hasTrophyPath = await popup.locator('path[d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"]').count();
  if (!hasMountainPath) problems.push(theme + ": Item 4 Nachtest — Berg-Icon (Mountain) nicht im Popup gefunden");
  if (hasTrophyPath) problems.push(theme + ": Item 4 Nachtest — Popup zeigt den generischen Trophy-Fallback statt des Berg-Icons");
  if (!(await popup.locator("text=100 km gesamt").count())) problems.push(theme + ": Popup nennt nicht '100 km gesamt'");
  // Nutzer-Wunsch (24.07.2026, Nachfrage nach Item 7/8): das Popup soll die echte Hexagon-Medaille zeigen,
  // nicht nur irgendein Icon — HexMedal ist an ihrem abgerundeten Hexagon-clip-path (hexClip -> "path(...")
  // eindeutig zu erkennen, das unterscheidet sie von der alten generischen Kreis-Variante.
  const hasHexMedal = await popup.evaluate((el) => [...el.querySelectorAll("div")].some((d) => (d.style.clipPath || "").startsWith("path(")));
  if (!hasHexMedal) problems.push(theme + ": v7.21 — Popup zeigt keine echte Hexagon-Medaille (HexMedal), nur ein einfaches Icon");
  // Metric-Banderole der Medaille zeigt "100" (b.target der 100-km-Schwelle), nicht nur den Titeltext.
  if (!(await popup.locator("text=/^100$/").count())) problems.push(theme + ": v7.21 — Medaillen-Banderole zeigt nicht die Zielzahl '100'");
  await shot("40-popup-meilenstein-ausserhalb-start-tab");
  await page.getByRole("button", { name: "Stark! Weiter", exact: true }).click();
  await page.waitForTimeout(400);

  // Item 5 (Nachtest): am Start-Tab darf "100 km gesamt" NICHT gleichzeitig in "Heute erreicht" UND
  // "Neueste Erfolge" auftauchen.
  await nav.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForTimeout(400);
  const reviewToggle = page.getByRole("button", { name: /Rückblick & Fortschritt/ });
  if (await reviewToggle.count()) { await reviewToggle.click(); await page.waitForTimeout(300); }
  const heuteBanner = page.locator("text=Heute erreicht");
  if (!(await heuteBanner.count())) problems.push(theme + ": 'Heute erreicht'-Banner fehlt nach frischem Meilenstein");
  const recentSection = page.locator("text=Neueste Erfolge").locator("xpath=following-sibling::*[1]");
  const dupInRecent = await recentSection.locator("text=100 km").count();
  if (dupInRecent) problems.push(theme + ": Item 5 REGRESSION — '100 km gesamt' erscheint zusätzlich in 'Neueste Erfolge', obwohl heute erreicht (im 'Heute erreicht'-Banner)");
  await shot("41-cockpit-heute-erreicht-vs-neueste-erfolge");

  if (errors.length) problems.push(`${theme}: ${errors.length} Konsolenfehler: ` + errors.slice(0, 3).join(" ;; "));
  await ctx.close();
}

await browser.close();
server.close();
if (problems.length) { console.log("PROBLEME:\n" + problems.join("\n")); process.exit(1); }
console.log("Meilenstein-Popup-Nachtest (Items 3/4/5) ok — Screenshots in tools/.build/shots/");
