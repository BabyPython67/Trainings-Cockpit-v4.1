# Trainings-Cockpit — Hinweise für Claude Code

Dieses Repo ist Teil eines Mehr-Repo-Projekts für Mirko (18, Schüler): Trainings-App für
Volleyball/Laufen/Kraft/Schule/Kalender. Bei JEDER neuen Session, die dieses Repo betrifft:

1. **Kontext aus `claude-memory` (Repo `BabyPython67/claude-memory`)**: Seit 22.07.2026 übernimmt das
   ein SessionStart-Hook (`.claude/hooks/session-start.mjs`, registriert in `.claude/settings.json`) —
   findet er `claude-memory` als Sibling-Ordner (`../claude-memory`), injiziert er automatisch die
   „Kurzfassung" aus `Trainings-Cockpit — Projektkontext.txt` (Abschnitt 0) als Kontext, OHNE dass die
   volle ~82-KB-Datei gelesen werden muss. Grund: die alte Pflicht „bei jeder Session komplett lesen"
   kostete auch für einen Ein-Zeilen-Fix ~20k Tokens, bevor überhaupt eine Aufgabe begann.
   - Meldet der Hook-Output, dass `claude-memory` nicht gefunden wurde (kein Sibling-Ordner vorhanden)
     oder der Kurzfassung-Block fehlt: **wie bisher `Trainings-Cockpit — Projektkontext.txt` UND
     `Trainings-Cockpit — Plan-Status.txt` vollständig lesen**, bevor an dieser App gearbeitet wird.
   - Auch wenn der Hook lief: `Trainings-Cockpit — Plan-Status.txt` (aktueller Trainings-/
     Krankheitsstand, kompakt, ~80 Zeilen) wird NICHT injiziert und bleibt bei jeder Aufgabe mit
     Trainings-/Krankheits-/Plan-Bezug vollständig zu lesen.
   - Der Volltext von `Projektkontext.txt` (Standing Rules mit Begründung, volle Versionshistorie,
     Fallstricke) bleibt Nachschlagewerk für alles, was die Kurzfassung nicht beantwortet — gezielt per
     Grep/Abschnittsnummer nachschlagen, nicht prophylaktisch komplett neu lesen.
2. **Dieses Repo**: `README.md` immer. `Trainings-Cockpit-vX.Y-Quellcode.txt` (~4300 Zeilen) NICHT
   pauschal komplett lesen — bei einer konkreten Änderung gezielt per Grep zum betroffenen Bereich
   springen; einen vollständigen Durchgang nur bei einem breiten Refactoring/Audit, das ohnehin die
   ganze Datei betrifft.

## Die wichtigsten Standing Rules auf einen Blick

(Vollständig und mit Begründung in `claude-memory`s Projektkontext.txt Abschnitt 1 — hier nur als
Kurzreferenz, damit sie auch ohne das volle Nachschlagen präsent sind.)

- **Direkt auf main mergen**, sobald getestet — kein offener PR, kein Warten auf Freigabe.
- **Planmodus bei größeren Änderungen**: kurz skizzieren (Ziel/betroffene Dateien/Datenstruktur),
  bei mehreren sinnvollen Wegen Optionen mit Trade-offs nennen statt stillschweigend zu wählen. Kleine,
  eindeutige Änderungen direkt umsetzen.
- **Qualitäts-Review vor jeder Lieferung**: dieselbe Fehlerklasse aktiv im Rest der Datei suchen,
  nicht nur die gemeldete Stelle flicken. Keine Symptom-Patches.
- **Design-Aufgaben: erst Samples-Artefakt, dann Implementierung** — bei visuell geprägten Aufgaben
  (Design-System-Umbau, externes Mockup/Prompt umsetzen, offenes ästhetisches Feedback) zuerst ein
  eigenständiges HTML-Muster als Artifact bauen und mit dem Nutzer freigeben lassen, NICHT direkt im
  App-Code iterieren. Dabei aktiv beachten (aus dem v7.12-Redesign gelernt, Details in Projektkontext.txt):
  bekannte Fallstricke aus `workflows/ship-version.md` sofort anwenden statt erst beim nächsten Mal;
  fehlende, aber angekündigte Referenzbilder aktiv ansprechen statt stillschweigend nur mit Text
  weiterzuarbeiten; vor dem ersten Zeigen eine eigene kritische Design-Abnahme durchführen (liest sich
  ein Detail als Fehler/Schaden statt als Absicht? ist es ein bekanntes "billiges" CSS-Muster?); neue,
  dauerhafte UI-Elemente als Option zur Wahl stellen statt direkt zu bauen. Ein freigegebenes Muster
  ersetzt NICHT die reguläre Verifikation (Schritt-für-Schritt-SOP unten).
- **Verifizieren statt behaupten**: bei Fragen zum eigenen Erledigt-/Gemerged-Stand die Datei/den
  Branch tatsächlich frisch prüfen, nicht aus dem Gedächtnis antworten.
- **Consultant-Personality**: aktiv eigene fachliche Einschätzung/Gegenvorschläge einbringen, nicht
  nur wörtlich 1:1 umsetzen.
- Nach mehrrundigen Feedback-Sessions (>3 Zyklen zu demselben Artefakt) von sich aus eine kurze Retro
  anbieten, statt darauf zu warten, dass der Nutzer danach fragen muss.

## Build/Test/Verify

Scripts liegen in `tools/`, der operative Ablauf inkl. bekannter Fallstricke steht in
`workflows/ship-version.md` — dort zuerst nachsehen, bevor Build-/Test-/Verify-Logik neu geschrieben
wird ("Look for existing tools first").

## Kommunikation

Mirko kennt sich nur minimal mit Code/Fachsprache aus: Erklärungen laienverständlich, ohne Jargon;
technische Details nur auf ausdrückliche Nachfrage.
