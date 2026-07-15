// Browser-Verifikation der gebauten index.html: iPhone-Viewport, Seed-Daten, hell + dunkel,
// alle geänderten Ansichten als Screenshot; sammelt Konsolen-Fehler und prüft SVG-Text-Clipping.
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
    document.querySelectorAll(".rounded-2xl svg text, svg.recharts-surface text").forEach((t) => {
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
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); }); // Fonts-CDN ist in der Sandbox blockiert — kein App-Fehler
  await page.addInitScript(([seed, th]) => { localStorage.setItem("trainings-cockpit-v1", JSON.stringify({ ...seed, theme: th })); }, [SEED, theme]);
  await page.goto("http://localhost:8321/");
  await page.waitForFunction(() => window.__mounted === true, null, { timeout: 15000 });
  await page.waitForTimeout(1800);
  if (await page.locator(".__errbox").count()) problems.push(theme + ": Fehler-Box sichtbar!");

  const shot = async (name, opts = {}) => { await page.waitForTimeout(1700); await page.screenshot({ path: path.join(SHOTS_DIR, `${name}-${theme}.png`), fullPage: true, ...opts }); await checkSvgClipping(page, `${name}-${theme}`); };

  await shot("01-cockpit");

  // Woche: Ausfall-Zustand + Panel aufklappen
  await page.getByRole("button", { name: "Woche", exact: true }).click();
  await page.waitForTimeout(300);
  const cancelledRow = page.locator("div.rounded-2xl", { hasText: "Ausgefallen" }).first();
  await cancelledRow.locator("button").last().click().catch(() => problems.push(theme + ": Ausfall-Zeile nicht aufklappbar"));
  await shot("02-woche-ausfall");

  // Kalender: Monat / Woche / Tag
  await page.getByRole("button", { name: "Kalender" }).click();
  await shot("03-kalender-monat");
  await page.getByRole("button", { name: "Woche", exact: true }).last().click();
  await shot("04-kalender-woche");
  await page.getByRole("button", { name: "Tag", exact: true }).click();
  await shot("05-kalender-tag");

  // Schule: beide Sortierungen
  await page.getByRole("button", { name: "Schule", exact: true }).first().click();
  await shot("06-schule-faellig");
  await page.getByRole("button", { name: "Nach Fach" }).click();
  await shot("07-schule-fach");

  // Fortschritt: Typ-Charts + Lauf-Detail (Intervall-Lauf aufklappen)
  await page.getByRole("button", { name: "Training" }).click();
  await page.getByRole("button", { name: "Fortschritt" }).click();
  await page.waitForTimeout(400);
  const intRow = page.locator("div", { hasText: /^07\.07\./ }).locator("xpath=ancestor::div[1]");
  const chevrons = page.locator("div.divide-y > div");
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

  // Recovery: Schlaf / Diese Woche / Meso
  await page.getByRole("button", { name: "Recovery" }).click();
  await shot("10-recovery");

  if (errors.length) problems.push(`${theme}: ${errors.length} Konsolen-Fehler: ` + errors.slice(0, 3).join(" ;; "));
  await ctx.close();
}

await runTheme("light");
await runTheme("dark");
await browser.close();
server.close();

if (problems.length) { console.log("PROBLEME:\n" + problems.join("\n")); process.exit(1); }
console.log("Browser-Verifikation ok — Screenshots in tools/.build/shots/");
