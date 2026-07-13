# Trainings-Cockpit v6.0

Volleyball · Laufen · Kraft · Schule · Kalender

Eigenständige Single-File-Web-App (React, im Browser, ohne Backend). Gehostet über GitHub Pages als `index.html`.

## Aufbau

Zweistufige Navigation: oben die Bereiche **Training**, **Kalender** und **Schule**, im Training darunter die Tabs Cockpit · Woche · Kcal · Fortschritt · Recovery. Cockpit ist die Startseite und zeigt einen Schnellblick über alles (nächste Fristen inklusive).

## Versionen

- v4.0 – Schule-Tab (Hausaufgaben & Klausuren, Fristen-Ampel)
- v4.1 – Navigation in Bereiche Training/Schule umgebaut (Vorbereitung für den Kalender)
- v5.0 – Krankheits-Logik: Krankheiten lassen sich im Recovery-Bereich eintragen (auch rückwirkend). Betroffene Einheiten gelten als „entschuldigt" statt „offen" (eigene Stufe in den Charts, Serie bleibt erhalten), harte Einheiten in den Aufbau-Tagen danach bekommen leichte Empfehlungen, und die Block-Steigerung des Laufplans verschiebt sich um die verlorenen Wochen. Wahlweise bleibt der 5-km-Testtermin fest (Endblock wird kürzer) oder der Plan verlängert sich nach hinten (Umschalter in den Einstellungen).
- v5.1 – Schule-Tab: bestehende Hausaufgaben/Klausuren lassen sich nachträglich bearbeiten (Stift-Symbol öffnet das Formular vorausgefüllt, Speichern aktualisiert den Eintrag statt einen neuen anzulegen, Abbrechen verwirft die Änderung).
- v6.0 – Großes Bündel:
  - **Kalender-Bereich** (zurück aus v4.2, an die aktuelle Logik angepasst): Monat/Woche/Tag, Training + Schule mit Filter-Chips, Farb-Punkte pro Tag, Tages-Detail per Tap. Berücksichtigt Krankheits-Verzug, Ausfälle und Ersatz-Einheiten.
  - **Volleyball-Ausfall**: Vereinstraining lässt sich im Woche-Tab als „ausgefallen" markieren (zählt dann nirgends mehr als offen) und durch eine frei wählbare Ersatz-Einheit (Sportart, Tag, Dauer, Belastung) ersetzen.
  - **Schule**: Einträge wahlweise nach Fälligkeit oder nach Fach gruppiert; Klausuren deutlich gekennzeichnet (roséfarbener Randbalken + Chip) — auch im Cockpit-Schnellblick und Kalender.
  - **Lauf-Detail-Charts**: im aufgeklappten Lauf zeigen zwei Verläufe Pace und Puls je Runde, mit den Zielbereichen aus dem Plan (HF-Bereich; Ziel-Pace ±15 s bei Intervallen/Tempo) als Band.
  - **Fortschritt je Lauftyp** ersetzt den Pace-Verlauf: Arbeits-Pace und Ø-Puls übereinander, mit denselben Zielbändern — gleiche Pace bei weniger Puls = echte Verbesserung.
  - **Klarere Charts**: erledigt/entschuldigt/offen jetzt eindeutig (voll/schraffiert/Umriss); Laufökonomie ohne Doppel-Y-Achse; Tooltips an der Chart-Oberkante (iPhone: Finger verdeckt nichts mehr); Beschriftungen weichen der Datenlinie automatisch aus.

## Dateien

- `index.html` – fertige, ausgelieferte App (gebaut)
- `Trainings-Cockpit-v6.0-Quellcode.txt` – lesbare Quellfassung (Basis für künftige Builds)
