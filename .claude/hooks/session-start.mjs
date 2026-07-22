#!/usr/bin/env node
// SessionStart-Hook: injiziert die "Kurzfassung" aus claude-memory statt den
// vollen Projektkontext.txt (~82 KB) bei jeder Session neu lesen zu müssen.
// Hintergrund/Wartungsregeln: claude-memory/CLAUDE.md, Abschnitt
// "Bei JEDER neuen Session zuerst lesen".
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const candidates = [
  resolve(projectDir, "..", "claude-memory"),
  resolve(projectDir, "..", "claude-memory-main"),
];

const memoryDir = candidates.find((dir) => existsSync(dir));

function output(additionalContext) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    })
  );
}

if (!memoryDir) {
  output(
    "claude-memory-Repo lokal nicht gefunden (erwartet als Sibling-Ordner " +
      "../claude-memory neben diesem Repo). Fallback: Trainings-Cockpit — " +
      "Projektkontext.txt und Trainings-Cockpit — Plan-Status.txt aus dem " +
      "Repo BabyPython67/claude-memory vollständig lesen, bevor an dieser " +
      "App gearbeitet wird (siehe Trainings-Cockpit-v4.1/CLAUDE.md)."
  );
  process.exit(0);
}

const kontextPath = join(memoryDir, "Trainings-Cockpit — Projektkontext.txt");
const planStatusPath = join(memoryDir, "Trainings-Cockpit — Plan-Status.txt");

if (!existsSync(kontextPath)) {
  output(
    `claude-memory-Repo gefunden unter ${memoryDir}, aber ` +
      "Projektkontext.txt fehlt dort. Bitte im claude-memory-Repo nachsehen " +
      "und ggf. vollständig lesen."
  );
  process.exit(0);
}

const kontext = readFileSync(kontextPath, "utf8");
const startMarker = "===KURZFASSUNG-START===";
const endMarker = "===KURZFASSUNG-ENDE===";
const startIdx = kontext.indexOf(startMarker);
const endIdx = kontext.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
  output(
    `claude-memory-Repo gefunden unter ${memoryDir}, aber kein ` +
      "Kurzfassung-Block (===KURZFASSUNG-START=== / ===KURZFASSUNG-ENDE===) " +
      "in Projektkontext.txt erkannt — Datei wurde vermutlich umstrukturiert. " +
      "Bitte Projektkontext.txt und Plan-Status.txt vollständig lesen."
  );
  process.exit(0);
}

const kurzfassung = kontext
  .slice(startIdx + startMarker.length, endIdx)
  .trim();

const planHint = existsSync(planStatusPath)
  ? `Trainings-Cockpit — Plan-Status.txt liegt unter ${planStatusPath} — ` +
    "diese Datei wird von diesem Hook NICHT injiziert (Pflege-Anweisung " +
    "steht in claude-memory/CLAUDE.md); bei jeder Aufgabe mit Trainings-/" +
    "Krankheits-/Plan-Bezug trotzdem vollständig lesen (kompakt, ~80 Zeilen)."
  : "Trainings-Cockpit — Plan-Status.txt wurde unter " +
    `${memoryDir} nicht gefunden — bei Bedarf im claude-memory-Repo nachsehen.`;

output(
  "Kurzfassung aus claude-memory/Trainings-Cockpit — Projektkontext.txt " +
    "(Abschnitt 0, automatisch eingelesen statt der vollen Datei):\n\n" +
    kurzfassung +
    "\n\n" +
    planHint
);
