// Gezielte Verifikation des v7.13-Fixes: das "Wochenrhythmus"-Chart (Cockpit-Tab) zeigte einen Tag mit
// zwei verschiedenen Sportarten (z. B. eine per "Verschieben" hinzugekommene Lauf-Einheit neben einer
// bereits bestehenden Volleyball-/Turnier-Einheit) bisher komplett in EINER Farbe — dominantSport() ließ
// die "verlierende" Sportart optisch komplett verschwinden, obwohl der Tooltip beide korrekt auflistete.
// Reproduziert mit den echten Seed-Fixtures: Woche 3, Mittwoch trägt das Schulturnier (sport "vb", Last 9),
// Donnerstag eine offene Tempo-Laufeinheit (Last 6) — nach dem Verschieben auf Mittwoch muss der Balken
// zwei sichtbar unterschiedliche Segmentfarben zeigen, nicht nur die Turnier-Farbe.
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

const server = createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(readFileSync(HTML)); }).listen(8371);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });
const problems = [];

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme === "dark" ? "dark" : "light" });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-07-15T09:00:00") }); // gleiches eingefrorenes Datum wie verify-app.mjs/verify-move-unit.mjs, Plan-Woche 3
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.addInitScript(([seed, th]) => { localStorage.setItem("trainings-cockpit-v1", JSON.stringify({ ...seed, theme: th })); }, [SEED, theme]);
  await page.goto("http://localhost:8371/");
  await page.waitForFunction(() => window.__mounted === true, null, { timeout: 15000 });
  await page.waitForTimeout(1000);

  const nav = page.locator("nav");
  const main = page.locator("main");
  const shot = async (name, opts = {}) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOTS_DIR, `${name}-${theme}.png`), fullPage: true, ...opts }); };

  // Vor dem Verschieben: Wochenrhythmus-Balken für Mittwoch ist rein die Turnier-Farbe (Kontrollzustand)
  await shot("20-cockpit-vor-verschieben");

  // Donnerstags-Tempo (offen, Last 6) über die reale UI auf Mittwoch (Turnier, Last 9) verschieben
  await nav.getByRole("button", { name: "Woche", exact: true }).click();
  await page.waitForTimeout(400);
  const heading = main.locator("div.font-display.font-bold", { hasText: /^Do$/ });
  const doCard = heading.locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
  const doRow = doCard.locator("div.transition").first();
  await doRow.locator("button").last().click().catch(() => problems.push(theme + ": Donnerstag-Zeile nicht aufklappbar"));
  await page.waitForTimeout(300);
  const moveBtn = doRow.getByRole("button", { name: "Verschieben", exact: true });
  if (!(await moveBtn.count())) { problems.push(theme + ": 'Verschieben'-Button an offener Donnerstag-Einheit (Tempo) nicht gefunden"); await ctx.close(); continue; }
  await moveBtn.click();
  await page.waitForTimeout(300);
  await doRow.locator("select").selectOption("Mi");
  await doRow.getByRole("button", { name: "Dorthin verschieben", exact: true }).click();
  await page.waitForTimeout(400);

  // Zurück zum Cockpit: Wochenrhythmus-Balken für Mittwoch prüfen
  await nav.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForTimeout(500);
  await shot("21-cockpit-nach-verschieben");

  const rhythmCard = main.locator("div", { hasText: "Wochenrhythmus" }).locator("xpath=ancestor-or-self::div[contains(@class,'p-4')]").first();
  const byDay = await rhythmCard.evaluate((card) => {
    // XAxis-Tick-Beschriftungen ("Mo".."So") liefern die x-Position jedes Tages auch dann, wenn der
    // Balken selbst (Gesamtlast 0) gar kein <rect> rendert — robuster als Balken-Gruppen zu zählen.
    const ticks = [...card.querySelectorAll(".recharts-cartesian-axis-tick text")].map((t) => ({
      day: t.textContent.trim(), x: t.getBoundingClientRect().x + t.getBoundingClientRect().width / 2,
    }));
    const rects = [...card.querySelectorAll("svg .recharts-bar-rectangle path, svg .recharts-bar-rectangle rect")];
    const boxes = rects.map((r) => {
      const b = r.getBoundingClientRect();
      return { x: b.x + b.width / 2, h: Math.round(b.height * 10) / 10, fill: getComputedStyle(r).fill || r.getAttribute("fill") };
    }).filter((b) => b.h > 0.5);
    return ticks.map((t) => ({
      day: t.day,
      fills: [...new Set(boxes.filter((b) => Math.abs(b.x - t.x) < 15).map((b) => b.fill))],
    }));
  });
  const mi = byDay.find((d) => d.day === "Mi");
  if (!mi) problems.push(theme + ": Mittwoch-Balken im Wochenrhythmus-Chart nicht gefunden (Tick-Beschriftung fehlt)");
  else if (mi.fills.length < 2) problems.push(theme + `: Mittwochs-Balken zeigt nur ${mi.fills.length} Farbe(n) (${mi.fills.join(", ")}) — Turnier- und verschobene Tempo-Einheit müssen beide sichtbar sein`);
  const doDay = byDay.find((d) => d.day === "Do");
  if (doDay && doDay.fills.length > 0) problems.push(theme + `: Donnerstag zeigt nach dem Verschieben noch Last (${doDay.fills.join(", ")}), sollte leer sein`);

  // Regressionscheck: bestehende Ausfallen-Ersatz-Fixture (w3-Fr-vb) unverändert
  await nav.getByRole("button", { name: "Woche", exact: true }).click();
  await page.waitForTimeout(400);
  const frHeading = main.locator("div.font-display.font-bold", { hasText: /^Fr$/ });
  const frCard = frHeading.locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
  if (!(await frCard.locator("text=Ausgefallen").count())) problems.push(theme + ": bestehende Ausfall-Zeile (Fr, VB) nach Chart-Fix nicht mehr vorhanden");

  if (errors.length) problems.push(`${theme}: ${errors.length} Konsolenfehler: ` + errors.slice(0, 3).join(" ;; "));
  await ctx.close();
}

await browser.close();
server.close();
if (problems.length) { console.log("PROBLEME:\n" + problems.join("\n")); process.exit(1); }
console.log("Wochenrhythmus-Mix-Verifikation ok — Screenshots in tools/.build/shots/");
