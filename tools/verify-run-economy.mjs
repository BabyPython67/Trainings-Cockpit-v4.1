// Verifikation von Item 8 (Anpassungsdokument): Laufökonomie-Chart zeigt jetzt zwei Rohdaten-Linien
// (Schrittfrequenz/Schrittlänge) mit unabhängigen Trend-Toggles statt der alten Verhältniszahl.
// Prüft: beide Linien/Achsen vorhanden, "Alle Typen"-Hinweis, Trend-Chip schaltet Ø-Marker + Trendlinie
// unabhängig je Seite, kein SVG-Text-Clipping (chart-margin-safety).
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

const server = createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(readFileSync(HTML)); }).listen(8366);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });
const problems = [];

async function checkSvgClipping(page, label) {
  const clipped = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("svg text").forEach((t) => {
      const svg = t.closest("svg"); if (!svg) return;
      const tb = t.getBoundingClientRect(), sb = svg.getBoundingClientRect();
      if (tb.width === 0) return;
      if (tb.left < sb.left - 1 || tb.right > sb.right + 1 || tb.top < sb.top - 1 || tb.bottom > sb.bottom + 1)
        out.push((t.textContent || "").slice(0, 24));
    });
    return out;
  });
  if (clipped.length) problems.push(`${label}: SVG-Text ragt aus dem Chart: ${[...new Set(clipped)].join(" | ")}`);
}

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme === "dark" ? "dark" : "light" });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-07-15T09:00:00") }); // Plan-Woche 3 — s. verify-app.mjs
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.addInitScript(([seed, th]) => { localStorage.setItem("trainings-cockpit-v1", JSON.stringify({ ...seed, theme: th })); }, [SEED, theme]);
  await page.goto("http://localhost:8366/");
  await page.waitForFunction(() => window.__mounted === true, null, { timeout: 15000 });
  await page.waitForTimeout(1000);

  const nav = page.locator("nav");
  const main = page.locator("main");
  const shot = async (name, opts = {}) => { await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOTS_DIR, `${name}-${theme}.png`), fullPage: true, ...opts }); await checkSvgClipping(page, `${name}-${theme}`); };

  // Fortschritt (hinter "Mehr") -> Standard-Unterreiter ist "Lauf", SmartChartsCard startet auf "Laufökonomie"
  await nav.getByRole("button", { name: "Mehr", exact: true }).click();
  await page.waitForTimeout(300);
  await main.getByRole("button", { name: "Fortschritt" }).click();
  await page.waitForTimeout(500);

  // SmartChartsCard ist eine von mehreren Karten mit Chart+Select auf dem Fortschritt-Tab (u. a. auch
  // "Fortschritt je Lauftyp" hat einen Lauftyp-Select) — deshalb ab hier konsequent auf die Card scopen
  // (Card-Root trägt "rounded-xl", s. Card-Komponente), statt versehentlich die falsche Karte zu treffen.
  const chipCadence = main.getByRole("button", { name: /Schrittfrequenz/ });
  const chipStride = main.getByRole("button", { name: /Schrittlänge/ });
  if (!(await chipCadence.count())) { problems.push(theme + ": Trend-Chip 'Schrittfrequenz' fehlt — Laufökonomie-Karte nicht wie erwartet auf dem Fortschritt-Tab"); await ctx.close(); continue; }
  if (!(await chipStride.count())) problems.push(theme + ": Trend-Chip 'Schrittlänge' fehlt (Seed-Daten sollten Schrittlängen enthalten)");
  const ecoCard = chipCadence.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");

  // Beide Rohdaten-Linien im SVG vorhanden (grün durchgezogen Kadenz, violett gestrichelt Schrittlänge)
  const chartSvg = ecoCard.locator("svg.recharts-surface").first();
  const strokes = await chartSvg.locator("path.recharts-line-curve").evaluateAll((els) => els.map((e) => e.getAttribute("stroke")));
  if (!strokes.includes("#059669")) problems.push(theme + ": Kadenz-Linie (grün, #059669) fehlt im Chart");
  if (!strokes.includes("#8b5cf6")) problems.push(theme + ": Schrittlänge-Linie (violett, #8b5cf6) fehlt im Chart");

  // "Alle Typen" ist der Default-Filter -> Hinweistext muss sichtbar sein
  if (!(await ecoCard.locator("text=/Bei „Alle Typen/").count())) problems.push(theme + ": 'Alle Typen'-Hinweistext fehlt bei Default-Filter");
  await shot("50-fortschritt-laufoekonomie-default");

  // Kadenz-Trend einschalten: Ø-Marker im Kopf + Chip aktiv, Schrittlänge bleibt unberührt (unabhängig)
  await chipCadence.click();
  await page.waitForTimeout(400);
  if (!(await ecoCard.locator("text=Ø").count())) problems.push(theme + ": kein Ø-Marker sichtbar, nachdem Kadenz-Trend eingeschaltet wurde");
  await shot("51-fortschritt-laufoekonomie-kadenz-trend");

  // Zusätzlich Schrittlänge-Trend einschalten: beide Ø gleichzeitig aktiv
  await chipStride.click();
  await page.waitForTimeout(400);
  const oCount = await ecoCard.locator("text=Ø").count();
  if (oCount < 2) problems.push(theme + `: nach Einschalten beider Trends nur ${oCount}x 'Ø' sichtbar, erwartet mind. 2 (Kopf-Kennzahl + Chip je Seite unabhängig)`);
  await shot("52-fortschritt-laufoekonomie-beide-trends");

  // Lauftyp-Filter auf "Easy" -> "Alle Typen"-Hinweis muss verschwinden (Select innerhalb der Laufökonomie-Karte)
  await ecoCard.locator("select").filter({ has: page.locator("option", { hasText: "Easy" }) }).first().selectOption("easy").catch(() => problems.push(theme + ": Lauftyp-Select in der Laufökonomie-Karte nicht gefunden"));
  await page.waitForTimeout(400);
  if (await ecoCard.locator("text=/Bei „Alle Typen/").count()) problems.push(theme + ": 'Alle Typen'-Hinweistext bleibt sichtbar, obwohl auf 'Easy' gefiltert wurde");
  await shot("53-fortschritt-laufoekonomie-easy-gefiltert");

  if (errors.length) problems.push(`${theme}: ${errors.length} Konsolenfehler: ` + errors.slice(0, 3).join(" ;; "));
  await ctx.close();
}

await browser.close();
server.close();
if (problems.length) { console.log("PROBLEME:\n" + problems.join("\n")); process.exit(1); }
console.log("Laufökonomie-Chart-Verifikation ok — Screenshots in tools/.build/shots/");
