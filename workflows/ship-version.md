# Workflow: neue Version bauen und ausliefern

SOP für den kompletten Ablauf, wenn Feature-Änderungen an der App fertig sind und als neue Version
ausgeliefert werden sollen. Die zugehörigen Scripts liegen in `tools/` — vor dem Neuschreiben von
Build-/Test-/Verify-Logik immer hier zuerst nachsehen (WAT-Prinzip: „Look for existing tools first").

## Schritte

1. **Quellcode ändern**: `Trainings-Cockpit-vX.Y-Quellcode.txt` im Repo-Root bearbeiten. Bei einem
   Versions-Sprung die Datei per `git mv` umbenennen (`vX.Y` → `vX.Y+1`) — die Tools erkennen die
   aktuelle Version automatisch am Dateinamen, an den Scripts selbst muss dafür nichts geändert werden.
2. **Pure-Function-Tests bauen und laufen lassen**:
   ```
   cd tools && bash build-pure.sh && node test-pure.mjs
   ```
   Neue pure Funktionen (reine Berechnungs-/Parser-Logik ohne React/DOM) müssen in der
   `export {...}`-Liste in `build-pure.sh` ergänzt werden, sonst sind sie im Test-Bundle nicht sichtbar.
3. **App-Bundle bauen**:
   ```
   cd tools && node build-app.mjs
   ```
   Baut `index.html` neu (JSX → minifiziertes IIFE im letzten `<script>`-Block). Die `data-lib`-Bibliotheksblöcke
   bleiben dabei durch einen Hash-Vergleich garantiert unverändert — schlägt das Script hier fehl, wurde
   versehentlich einer der Bibliotheksblöcke berührt (nicht ignorieren, Ursache finden).
4. **Browser-Verifikation**:
   ```
   cd tools && node verify-app.mjs
   ```
   Läuft komplett automatisch (Seed-Daten, iPhone-Viewport 390×844, hell + dunkel, alle Haupt-Tabs) und
   meldet SVG-Clipping sowie Konsolenfehler. Für gezielte Einzelfragen (z. B. Achsenbeschriftung bei
   langem Zeitraum, oder eine bestimmte Chart-Karte) eignen sich `verify-axis.mjs` / `verify-splits.mjs`
   als Vorlage für ein neues, eng fokussiertes Verify-Script — lieber ein kleines neues Script nach diesem
   Muster schreiben als `verify-app.mjs` mit Spezialfällen zu überladen.
5. **Screenshots ansehen** (`tools/.build/shots/`) und dem Nutzer die relevanten zur Bestätigung schicken,
   bevor gepusht wird — besonders bei visuellen/Interaktions-Änderungen, die sich nicht rein durch Tests
   abdecken lassen.
6. **Version/README**: Footer-Versionsstring im Quellcode, `README.md` (Versionshistorie + Dateien-Abschnitt) aktualisieren.
7. **Commit + Push** (App-Repo `main`, siehe Projekt-Git-Konventionen für Commit-Message-Format).
8. **`claude-memory` aktualisieren** (separates Repo, cross-session Kontext): Feature-Historie, neue
   Erkenntnisse/Entscheidungen, ggf. neue „Bekannte Fallstricke" (siehe unten) ergänzen. Dorthin gehören
   Architektur/Entscheidungs-Narrative; hierher (dieses Dokument) gehören die operativen Schritte und
   die konkrete Checkliste unten.

## Bekannte Fallstricke

Checkliste, VOR dem nächsten ähnlichen Fix aktiv konsultieren — nicht nur zur Kenntnisnahme im
Nachhinein. Jeder neue Fallstrick, der beim Bauen/Verifizieren entdeckt wird, kommt hierher (Self-improvement-Loop:
Tool fixen → verifizieren → hier dokumentieren → nicht wiederholen).

- **Lucide-Shim darf kein `Proxy` sein.** esbuilds CJS→ESM-Interop kopiert benannte Importe über
  `getOwnPropertyNames` — ein `Proxy`-Objekt liefert dabei `undefined` für alle Properties, was zu
  React-Fehler #130 (weiße Seite trotz `window.__mounted === true`) führt. Der Shim muss ein echtes
  Objekt mit eigenen, aufzählbaren Properties sein.
- **Recharts `XAxis interval` nie mit einer eigenen numerischen Zähl-Logik ersetzen, ohne die
  eingebauten String-Modi zu prüfen.** Der Default ist `"preserveEnd"` (nicht `0`) und hat eingebaute
  Rand-Sicherheit (letzte Beschriftung wird nie über den Chart-Rand hinausgeschoben). Sobald ein
  numerischer `interval`-Wert gesetzt wird (auch `0`), wird diese eingebaute Logik abgeschaltet.
  `interval="preserveStartEnd"` löst Überlappung bei vielen Datenpunkten UND Randabschneiden bei
  wenigen gleichzeitig, weil Recharts die tatsächliche Label-Breite kennt — immer zuerst diesen
  eingebauten Modus probieren, bevor eine eigene Tick-Verdichtung geschrieben wird.
- **`data-lib`-Bibliotheksblöcke in `index.html` nie manuell anfassen.** Sie werden per Hash-Vergleich
  in `build-app.mjs` geschützt; für neue/aktualisierte Bibliotheken den Block komplett neu aus der
  offiziellen UMD-Distribution einsetzen, nicht patchen.
- **Nach jedem Achsen-/Chart-Fix immer die volle Regressionssuite laufen lassen, nicht nur den gezielt
  reproduzierten Einzelfall.** Ein Fix für ein Symptom (z. B. Überlappung bei langen Zeiträumen) kann an
  anderer Stelle ein neues, gegenteiliges Symptom erzeugen (z. B. Abschneiden bei kurzen Zeiträumen) —
  das fällt nur auf, wenn alle betroffenen Charts erneut geprüft werden.
- **Garmin-CSV-Rundenexport enthält mehr Spalten, als der aktuelle Parser (`extractLaps`) nutzt** — u. a.
  „Maximale Herzfrequenz" pro Runde (nicht nur der Gesamt-Durchschnitt). Vor der Annahme „diese Daten
  gibt es nicht" immer eine echte Beispiel-CSV ansehen (`tools/fixtures/`), nicht nur den Code, der sie
  aktuell parst — der Code parst oft weniger, als die Datei hergibt.
- **`verify-app.mjs`-Selektoren nie an Präsentations-Klassen koppeln** (v7.6-Fund): der Ausfall-Zeilen-Test
  suchte `div.rounded-2xl` mit Text „Ausgefallen" — als der Radius-Token-Umbau `Card`/`SessionRow` auf
  `rounded-xl` umstellte, fand der Test plötzlich nichts mehr, obwohl die App fehlerfrei war. Selektoren
  auf strukturell stabile Klassen (`border`, `shadow-sm`) oder Text/Rolle stützen, nie auf Klassen, die
  ein Design-Refresh als Erstes ändert. Dieselbe Lehre traf den SVG-Clipping-Check (`checkSvgClipping`
  scannte nur `.rounded-2xl svg text` statt aller `svg text`) — nach jedem Radius-/Klassen-Umbau aktiv
  nach weiteren Selektoren derselben Fehlerklasse suchen, nicht nur den zuerst gemeldeten fixen.
- **`verify-app.mjs` lief bisher auf echter Wall-Clock-Zeit** — der Ausfall-Override in `seed.mjs` ist an
  Plan-Woche 3 gebunden (`w3-Fr-vb`), also indirekt an ein festes Kalenderdatum relativ zu `PLAN_START`.
  Sobald das echte Datum aus Woche 3 herausläuft, zeigt die App standardmäßig eine andere Woche und der
  Test findet die erwartete Zeile nicht mehr — ein stiller Drift-Bug, der irgendwann in der Zukunft ohne
  jede Code-Änderung wieder auftaucht. Fix: `page.clock.install({ time: new Date("2026-07-15T09:00:00") })`
  vor jedem `goto()`, friert „heute" auf einen Tag in Woche 3 ein. Bei künftigen Änderungen an `seed.mjs`
  (neue wochenabhängige Fixtures) immer prüfen, ob die eingefrorene Uhrzeit noch zur erwarteten Plan-Woche
  passt.
