// Gezielte Verifikation des Achsen-Fixes: viele Check-ins über einen langen Zeitraum, "Alle" ausgewählt,
// Beschriftungen müssen lesbar bleiben (keine Überlappung).
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

// 95 Tage Schlaf-Check-ins, um den Long-Range-Fall zu erzwingen
const recoveryLog = Array.from({ length: 95 }, (_, i) => {
  const d = new Date(2026, 3, 1); d.setDate(d.getDate() + i);
  const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return { id: "r" + i, date: iso, sleep: 6 + Math.sin(i / 3) * 1.5 + Math.random() * 0.4, readiness: 3 };
});
const SEED2 = { ...SEED, recoveryLog };

const server = createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(readFileSync(HTML)); }).listen(8351);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });
const problems = [];

async function checkSvgClipping(page, label) {
  const clipped = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll(".rounded-2xl svg text, svg.recharts-surface text").forEach((t) => {
      const svg = t.closest("svg"); if (!svg) return;
      const tb = t.getBoundingClientRect(), sb = svg.getBoundingClientRect();
      if (tb.width === 0) return;
      if (tb.left < sb.left - 1 || tb.right > sb.right + 1) out.push((t.textContent || "").slice(0, 24));
    });
    return out;
  });
  if (clipped.length) problems.push(`${label}: SVG-Text ragt aus dem Chart: ${[...new Set(clipped)].join(" | ")}`);
}
// Prüft, ob sich zwei X-Achsen-Tick-Labels desselben Charts horizontal überlappen
async function checkAxisOverlap(page, label) {
  const overlaps = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("svg.recharts-surface").forEach((svg, ci) => {
      const ticks = [...svg.querySelectorAll(".recharts-xAxis .recharts-cartesian-axis-tick text")];
      const boxes = ticks.map((t) => t.getBoundingClientRect()).filter((b) => b.width > 0);
      boxes.sort((a, b) => a.left - b.left);
      for (let i = 1; i < boxes.length; i++) { if (boxes[i].left < boxes[i-1].right - 1) { out.push(`chart${ci}`); break; } }
    });
    return out;
  });
  if (overlaps.length) problems.push(`${label}: X-Achsen-Beschriftungen überlappen in ${overlaps.join(", ")}`);
}

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.addInitScript(([seed, th]) => { localStorage.setItem("trainings-cockpit-v1", JSON.stringify({ ...seed, theme: th })); }, [SEED2, theme]);
  await page.goto("http://localhost:8351/");
  await page.waitForFunction(() => window.__mounted === true, null, { timeout: 15000 });
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: "Recovery" }).click();
  await page.waitForTimeout(600);
  // Schlaf-Verlauf: Zeitraum auf "Alle" umstellen (95 Tage sichtbar)
  const sleepCard = page.locator("text=Schlaf-Verlauf").locator("xpath=ancestor::div[contains(@class,'p-4')][1]");
  await sleepCard.locator("select").selectOption("all");
  await page.waitForTimeout(1200);
  await checkAxisOverlap(page, `Schlaf-Verlauf-${theme}`);
  await checkSvgClipping(page, `Schlaf-Verlauf-${theme}`);
  await sleepCard.screenshot({ path: path.join(SHOTS_DIR, `axis-sleep-all-${theme}.png`) });

  if (errors.length) problems.push(`${theme}: ${errors.length} Konsolenfehler: ` + errors.slice(0, 3).join(" ;; "));
  await ctx.close();
}

await browser.close();
server.close();
if (problems.length) { console.log("PROBLEME:\n" + problems.join("\n")); process.exit(1); }
console.log("Achsen-Verifikation ok — Screenshots in tools/.build/shots/");
