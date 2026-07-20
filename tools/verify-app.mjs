// Browser-Verifikation der gebauten index.html: iPhone-Viewport, Seed-Daten, hell + dunkel,
// alle geänderten Ansichten als Screenshot; sammelt Konsolen-Fehler und prüft SVG-Text-Clipping.
// v7.8: Navigation komplett neu (Bottom-Tab-Bar statt Bereiche/Tabs) — jeder Bottom-Tab-Klick läuft
// über das eine <nav>-Element (die Tab-Bar), jede In-Page-Interaktion über <main> (Kalender-Umschalter,
// Schule-Sortierung, Fortschritt-Unterreiter/Charts, Mehr-Liste). So werden gleichlautende Buttons
// (z. B. "Woche" als Bottom-Tab UND als Kalender-Ansicht) nie verwechselt — s. workflows/ship-version.md.
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

const server = createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(readFileSync(HTML)); }).listen(8321);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });

const problems = [];
async function checkSvgClipping(page, label) {
  const clipped = await page.evaluate(() => {
    const out = [];
    // Nicht an die Radius-Klasse koppeln (die ändert sich mit dem Design-System, s. v7.6) —
    // stattdessen jeden SVG-Text auf der Seite prüfen, nicht nur den in Karten mit einer bestimmten Rundung.
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

async function runTheme(theme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme === "dark" ? "dark" : "light" });
  const page = await ctx.newPage();
  // Uhr auf ein festes Datum in Plan-Woche 3 einfrieren (SEED hat den Ausfall-Override auf w3-Fr-vb) —
  // sonst driftet der Test still weg, sobald das echte Datum aus Woche 3 herausläuft. Immer VOR goto().
  await page.clock.install({ time: new Date("2026-07-15T09:00:00") });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); }); // Fonts-CDN ist in der Sandbox blockiert — kein App-Fehler
  await page.addInitScript(([seed, th]) => { localStorage.setItem("trainings-cockpit-v1", JSON.stringify({ ...seed, theme: th })); }, [SEED, theme]);
  await page.goto("http://localhost:8321/");
  await page.waitForFunction(() => window.__mounted === true, null, { timeout: 15000 });
  await page.waitForTimeout(1800);
  if (await page.locator(".__errbox").count()) problems.push(theme + ": Fehler-Box sichtbar!");

  const nav = page.locator("nav"); // die eine Bottom-Tab-Bar
  const main = page.locator("main"); // alles Inhaltliche — trennt "Woche" (Bottom-Tab) von "Woche" (Kalender-Ansicht) etc.
  const shot = async (name, opts = {}) => { await page.waitForTimeout(1700); await page.screenshot({ path: path.join(SHOTS_DIR, `${name}-${theme}.png`), fullPage: true, ...opts }); await checkSvgClipping(page, `${name}-${theme}`); };
  const goMehr = async () => { await nav.getByRole("button", { name: "Mehr", exact: true }).click(); await page.waitForTimeout(300); };
  const goViaMehr = async (label) => { await goMehr(); await main.getByRole("button", { name: label }).click(); await page.waitForTimeout(300); };

  await shot("01-cockpit");

  // v7.8: Zahnrad-Button im Header entfernt (Einstellungen wandert nach "Mehr")
  if (await page.getByRole("button", { name: "Einstellungen", exact: true }).count()) problems.push(theme + ": Zahnrad/Einstellungen-Button im Header sollte entfernt sein");

  // Woche: Ausfall-Zustand + Panel aufklappen (direkter Bottom-Tab)
  await nav.getByRole("button", { name: "Woche", exact: true }).click();
  await page.waitForTimeout(300);
  const cancelledRow = main.locator("div.border.shadow-sm", { hasText: "Ausgefallen" }).first();
  await cancelledRow.locator("button").last().click().catch(() => problems.push(theme + ": Ausfall-Zeile nicht aufklappbar"));
  await shot("02-woche-ausfall");

  // Kalender: Monat / Woche / Tag (direkter Bottom-Tab; der Monat/Woche/Tag-Umschalter liegt in <main>,
  // "Woche" ist dort absichtlich gleich benannt wie der Bottom-Tab — deshalb die main-Scopierung)
  await nav.getByRole("button", { name: "Kalender", exact: true }).click();
  await shot("03-kalender-monat");
  await main.getByRole("button", { name: "Woche", exact: true }).click();
  await shot("04-kalender-woche");
  await main.getByRole("button", { name: "Tag", exact: true }).click();
  await shot("05-kalender-tag");

  // Schule: seit v7.8 hinter "Mehr" statt eigenem Bereich
  await goViaMehr("Schule");
  await shot("06-schule-faellig");
  await main.getByRole("button", { name: "Nach Fach" }).click();
  await shot("07-schule-fach");

  // Fortschritt: Typ-Charts + Lauf-Detail (Intervall-Lauf aufklappen) — seit v7.8 hinter "Mehr"
  await goViaMehr("Fortschritt");
  await page.waitForTimeout(400);
  const chevrons = main.locator("div.divide-y > div");
  const rowCount = await chevrons.count();
  let opened = false;
  for (let i = 0; i < rowCount && !opened; i++) {
    const row = chevrons.nth(i);
    if ((await row.innerText()).includes("Intervalle")) {
      const btns = row.locator("button");
      const n = await btns.count();
      if (n >= 2) { await btns.nth(n - 2).click(); opened = true; }
    }
  }
  if (!opened) problems.push(theme + ": Intervall-Lauf-Detail nicht aufklappbar");
  await shot("08-fortschritt-int");
  // Lauf-Detail: Runde antippen -> Ablesezeile
  await page.locator("svg.recharts-surface").first().click({ position: { x: 120, y: 60 } }).catch(() => {});
  // Typ-Wechsel auf Easy (HF-Band ohne Pace-Band) — Select identifiziert über die Option "Easy" (RUN_OPTS)
  await page.locator("select").filter({ has: page.locator("option", { hasText: "Easy" }) }).first().selectOption("easy").catch(() => problems.push(theme + ": Typ-Select nicht gefunden"));
  await shot("09-fortschritt-easy");

  // Recovery: seit v7.8 hinter "Mehr"
  await goViaMehr("Recovery");
  await shot("10-recovery");

  // Einstellungen: seit v7.8 über "Mehr" statt Zahnrad-Icon im Header erreichbar
  await goViaMehr("Einstellungen");
  if (!(await main.getByText("Einstellungen", { exact: true }).count())) problems.push(theme + ": Einstellungen-Screen nicht über Mehr erreichbar");
  await shot("11-einstellungen");

  // Schnelleintrag: erhöhter Plus-Button öffnet ein Action-Sheet mit allen 5 Einträgen
  await nav.getByRole("button", { name: "Schnelleintrag" }).click();
  await page.waitForTimeout(300);
  const quickAddLabels = ["Lauf protokollieren", "Kraft protokollieren", "Kcal eintragen", "Recovery-Check-in", "Hausaufgabe/Klausur"];
  for (const label of quickAddLabels) {
    if (!(await page.getByRole("button", { name: label }).count())) problems.push(`${theme}: Schnelleintrag-Eintrag "${label}" fehlt`);
  }
  await shot("12-schnelleintrag");
  // Auswahl navigiert zum richtigen Screen UND wählt bei Fortschritt den passenden Unterreiter vor
  await page.getByRole("button", { name: "Kraft protokollieren" }).click();
  await page.waitForTimeout(400);
  const strengthPreselected = await main.getByRole("button", { name: "Kraftwerte" }).evaluate((el) => el.className.includes("text-white")).catch(() => false);
  if (!strengthPreselected) problems.push(theme + ": Schnelleintrag \"Kraft protokollieren\" hat Kraftwerte-Unterreiter nicht vorgewählt");
  await shot("13-schnelleintrag-kraft");

  // Schnelleintrag erneut öffnen, per Backdrop-Klick schließen ohne etwas auszuwählen
  await nav.getByRole("button", { name: "Schnelleintrag" }).click();
  await page.waitForTimeout(300);
  await page.mouse.click(20, 20);
  await page.waitForTimeout(300);
  if (await page.getByRole("button", { name: "Lauf protokollieren" }).count()) problems.push(theme + ": Schnelleintrag schließt nicht per Backdrop-Klick");

  if (errors.length) problems.push(`${theme}: ${errors.length} Konsolen-Fehler: ` + errors.slice(0, 3).join(" ;; "));
  await ctx.close();
}

await runTheme("light");
await runTheme("dark");
await browser.close();
server.close();

if (problems.length) { console.log("PROBLEME:\n" + problems.join("\n")); process.exit(1); }
console.log("Browser-Verifikation ok — Screenshots in tools/.build/shots/");
