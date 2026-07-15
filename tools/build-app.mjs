// Baut die ausgelieferte index.html: App-Quellcode (JSX) -> minifiziertes IIFE-Bundle,
// eingesetzt in den letzten <script>-Block. Alle data-lib-Bibliotheksblöcke bleiben byte-identisch.
// Quelldatei wird automatisch erkannt (Trainings-Cockpit-v*-Quellcode.txt im Repo-Root) — bei einem
// Versionssprung muss dieses Script NICHT angepasst werden, nur die Quelldatei umbenannt.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.dirname(TOOLS_DIR);
const BUILD_DIR = path.join(TOOLS_DIR, ".build");
mkdirSync(BUILD_DIR, { recursive: true });

const srcFiles = readdirSync(REPO_DIR).filter((f) => /^Trainings-Cockpit-v[\d.]+-Quellcode\.txt$/.test(f));
if (srcFiles.length !== 1) throw new Error(`Erwarte genau eine Quelldatei im Repo-Root, gefunden: ${srcFiles.join(", ") || "keine"}`);
const SRC = path.join(REPO_DIR, srcFiles[0]);
const VERSION = srcFiles[0].match(/v([\d.]+)/)[1];
const HTML = path.join(REPO_DIR, "index.html");
const JSX_OUT = path.join(BUILD_DIR, "app-build.jsx");
const BUNDLE_OUT = path.join(BUILD_DIR, "app-bundle.js");

// 1) Quellcode + Mount-Footer (identisch zum bewährten v5.1-Mount inkl. Fehler-Reporter)
const mount = `
;(function(){var e=document.getElementById("root");try{window.__mounted=true;window.ReactDOM.createRoot(e).render(window.React.createElement(App));}catch(t){window.__mounted=false;window.__failMsg&&window.__failMsg("Fehler beim Start: "+(t&&t.message?t.message:t));window.console&&console.error(t);}})();
`;
writeFileSync(JSX_OUT, readFileSync(SRC, "utf8") + mount);

// 2) esbuild: JSX -> minifiziertes IIFE, Bibliotheken via Shims auf die window-Globals
execSync([
  `npx esbuild "${JSX_OUT}" --bundle --minify --format=iife --charset=utf8`,
  "--loader:.jsx=jsx --jsx=transform",
  `--alias:react="${path.join(TOOLS_DIR, "shims/browser-react.cjs")}"`,
  `--alias:recharts="${path.join(TOOLS_DIR, "shims/browser-recharts.cjs")}"`,
  `--alias:papaparse="${path.join(TOOLS_DIR, "shims/browser-papaparse.cjs")}"`,
  `--alias:lucide-react="${path.join(TOOLS_DIR, "shims/browser-lucide.cjs")}"`,
  `--outfile="${BUNDLE_OUT}" --log-level=warning`,
].join(" "), { stdio: "inherit", cwd: TOOLS_DIR });

let bundle = readFileSync(BUNDLE_OUT, "utf8");
execSync(`node --check "${BUNDLE_OUT}"`, { stdio: "inherit" });
if (bundle.includes("</script")) bundle = bundle.replace(/<\/script/g, "<\\/script"); // Escape-Falle (nach dem Syntax-Check, sonst prüft der Check die falsche Fassung)

// 3) In die HTML einsetzen: alles bis zum letzten "<script>" (der App-Block) behalten, Rest ersetzen
const html = readFileSync(HTML, "utf8");
const libHashBefore = [...html.matchAll(/<script data-lib="([^"]+)">[\s\S]*?<\/script>/g)]
  .map((m) => m[1] + ":" + createHash("sha256").update(m[0]).digest("hex").slice(0, 12));
const marker = html.lastIndexOf("\n<script>\n");
if (marker < 0) throw new Error("App-Script-Block nicht gefunden");
const head = html.slice(0, marker);
const out = head.replace(/<title>Trainings-Cockpit v[\d.]+<\/title>/, `<title>Trainings-Cockpit v${VERSION}</title>`)
  + "\n<script>\n" + bundle + "\n</script>\n</body>\n</html>\n";
writeFileSync(HTML, out);

// 4) Wache: data-lib-Blöcke unverändert?
const after = readFileSync(HTML, "utf8");
const libHashAfter = [...after.matchAll(/<script data-lib="([^"]+)">[\s\S]*?<\/script>/g)]
  .map((m) => m[1] + ":" + createHash("sha256").update(m[0]).digest("hex").slice(0, 12));
if (JSON.stringify(libHashBefore) !== JSON.stringify(libHashAfter)) throw new Error("data-lib-Blöcke haben sich verändert!");
console.log(`index.html gebaut (v${VERSION}) · Bundle ${Math.round(bundle.length / 1024)} kB · ${libHashAfter.length} data-lib-Blöcke unverändert`);
