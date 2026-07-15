# Trainings-Cockpit v6.4

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
  - **Klarere Charts**: erledigt/entschuldigt/offen jetzt eindeutig (voll/schraffiert/Umriss); Tooltips an der Chart-Oberkante (iPhone: Finger verdeckt nichts mehr); Beschriftungen weichen der Datenlinie automatisch aus.
- v6.1 – Feedback aus dem ersten Testlauf: das aufgeklappte Ersatz-Formular bei einem ausgefallenen Volleyball-Training war komplett ausgegraut (nur die durchgestrichene Kopfzeile sollte das sein); Laufökonomie zurück zur kombinierten Doppelachsen-Ansicht (im direkten Vergleich bevorzugt).
- v6.2 – Weiteres Feedback-Bündel:
  - **Cockpit**: toter externer „Lauf-Tracker"-Link ersetzt durch eine große Fortschrittskarte „Laufplan-Fortschritt" (X von Y Laufeinheiten, live berechnet — 58 ist nur der Basisfall ohne Krankheit; je nach Krankheitsverlauf kann die echte Zahl höher, z. B. durch einen Nachhol-Effekt bei „dynamic", oder niedriger liegen, z. B. durch die Kürzung bei „fixed").
  - **Laufökonomie, Pace-HF-Verhältnis und VO₂max-Schätzung** in einer Karte mit Segment-Umschalter statt drei einzelnen Cards; Laufökonomie und Pace-HF zusätzlich nach Lauftyp filterbar; beide bekommen (wie VO₂max) einen fett hervorgehobenen „aktueller Wert"-Kopf.
  - **Zeitraum-Filter** (Letzte 10 Einheiten / 2 Wochen / 30 Tage / 90 Tage / Alle) an praktisch jedem Verlaufs-Chart, jeweils einzeln wählbar: 5K-Prognose, Fortschritt je Lauftyp, die drei Smart-Charts, Kraftwerte, Schlaf-Verlauf, Gewicht, Kalorien-Verlauf.
  - **Motivations-Feinschliff**: Wochenrhythmus-Vergleich jetzt als fette Zahl mit Trend-Badge statt kleinem grauem Text; neue „Bestwerte"-Karte bei den Kraftwerten (gab es bei Laufen schon, bei Kraft bisher nicht).
  - **Lauf-Detail neu gedacht**: statt zwei getrennter Pace-/Puls-Verläufe je Runde jetzt ein Pace-Puls-Streudiagramm (chronologisch verbunden, Farbverlauf hell→rose = früh→spät im Lauf) plus eine Entkopplungs-Kennzahl („+X % HF-Drift") — zeigt den Bezug zwischen Pace und Puls direkt, nicht nur beide Werte nebeneinander.
- v6.3 – Feedback aus dem zweiten Testlauf:
  - **Einzellauf-Chart erneut überarbeitet**: das Streudiagramm aus v6.2 erfüllte seinen Zweck nicht (alle Runden sollten gleichzeitig sichtbar und direkt vergleichbar sein, der Zielbereich pro Runde sofort als „innerhalb/außerhalb" erkennbar). Zurück zur bewährten Runden-Liste, jetzt erweitert: die Pace-Balken-Spur zeigt bei Intervalle/Tempo den Zielbereich als schattierte Zone um die Zielmarke (Balkenspitze sichtbar drin oder draußen), der Puls-Wert bekommt eine farbige Markierung (grün = im Plan-Bereich, rose = außerhalb). Die Entkopplungs-Kennzahl bleibt als Kopfzeile erhalten.
  - **Achsenbeschriftung bei langem Zeitraum repariert**: bei „Alle"/„90 Tage" (seit v6.2 möglich) überlappten sich die Datums-Beschriftungen auf mehreren Charts, u. a. hatte der Kalorien-Verlauf ein hartcodiertes Intervall, das nur zur alten festen 14-Tage-Ansicht passte. Alle Zeitreihen-Charts nutzen jetzt Recharts' eingebauten „preserveStartEnd"-Modus statt eines festen Intervalls — verdichtet die Beschriftungen automatisch je nach Datenmenge, ohne dass (wie bei einem selbstgebauten festen Intervall) die letzte Beschriftung am Rand abgeschnitten wird.
- v6.4 – Feedback aus dem dritten Testlauf, Lauf-Detail:
  - **Puls-Verlaufschart zusätzlich zur Rundenliste**: die Pace-Rundenliste bleibt (Stärke: alle Runden gleichzeitig vergleichbar), bekommt aber ein eigenes Puls-Verlaufschart darunter statt einer Puls-Zahl pro Zeile — Pace-Vergleich und Puls-Verlauf sind unterschiedliche Fragen und bekommen jetzt je eine passende Darstellung, statt in einer Zeile zusammengequetscht zu sein.
  - **Intervall-HF-Bewertung ehrlicher**: der Rundendurchschnitt wird bei Intervallen durch die Anlaufzeit nach jeder Pause (Cardiac Lag) gedrückt — eine ganze Session konnte dadurch fälschlich komplett als „außerhalb des Ziels" markiert werden, obwohl der Puls pro Runde tatsächlich ins Zielband hineinlief. Genutzt wird jetzt der Rundenpeak (aus einer bisher ungenutzten Spalte im Garmin-CSV-Rundenexport) minus einer kleinen Toleranz statt des Durchschnitts; die erste Arbeitsrunde bleibt immer neutral bewertet.
  - **Aufgeklappte Runde entrümpelt**: die generische Kollaps-Übersichtszeile (Ø bpm/spm/Höhenmeter/kcal) wird ausgeblendet, sobald die Runden-Details offen sind — die stapelten sich sonst mit der präziseren Kopfzeile der Rundenliste.
  - **Neue Build-/Test-Infrastruktur**: `tools/` (Build-, Test- und Browser-Verifikationsscripts) und `workflows/ship-version.md` (Ablauf-SOP inkl. bekannter Fallstricke) liegen jetzt im Repo statt nur in einer einzelnen Session — künftige Versionen bauen auf denselben, bereits erprobten Tools auf.

## Dateien

- `index.html` – fertige, ausgelieferte App (gebaut)
- `Trainings-Cockpit-v6.4-Quellcode.txt` – lesbare Quellfassung (Basis für künftige Builds)
- `tools/` – Build-/Test-/Verifikations-Scripts, `workflows/ship-version.md` – Ablauf-SOP für neue Versionen
