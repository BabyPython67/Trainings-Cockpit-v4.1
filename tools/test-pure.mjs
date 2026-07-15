// Pure-Function-Tests für Trainings-Cockpit v6.0 — läuft gegen die echte Quelldatei (via build-pure.sh)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as M from "./.build/pure.mjs";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("  ✓ " + name); };

console.log("parseHrTarget");
t("Bereich '130–138'", () => assert.deepEqual(M.parseHrTarget("130–138"), { lo: 130, hi: 138 }));
t("Bereich mit Bindestrich '162-172'", () => assert.deepEqual(M.parseHrTarget("162-172"), { lo: 162, hi: 172 }));
t("Obergrenze 'bis 196'", () => assert.deepEqual(M.parseHrTarget("bis 196"), { lo: null, hi: 196 }));
t("leer/Müll → null", () => { assert.equal(M.parseHrTarget(""), null); assert.equal(M.parseHrTarget("locker"), null); assert.equal(M.parseHrTarget(null), null); });

console.log("Kalender-Helfer");
t("monthGrid: 42 Zellen, Montag zuerst", () => {
  const g = M.monthGrid(new Date(2026, 6, 15)); // Juli 2026
  assert.equal(g.length, 42);
  assert.equal(g[0].getDay(), 1); // Montag
  assert.equal(M.toLocalISO(g[0]), "2026-06-29"); // 1. Juli = Mittwoch → Grid beginnt Mo 29.06.
});
t("weekGrid: 7 Tage ab Montag", () => {
  const g = M.weekGrid(new Date(2026, 6, 15)); // Mi 15.07.
  assert.equal(g.length, 7);
  assert.equal(M.toLocalISO(g[0]), "2026-07-13");
  assert.equal(M.toLocalISO(g[6]), "2026-07-19");
});
t("toLocalISO ohne UTC-Kippkante", () => assert.equal(M.toLocalISO(new Date(2026, 0, 1, 0, 30)), "2026-01-01"));
t("rawPlanWeekOf: innerhalb/außerhalb", () => {
  assert.equal(M.rawPlanWeekOf(new Date(2026, 5, 29), [], "fixed"), 1);
  assert.equal(M.rawPlanWeekOf(new Date(2026, 6, 14), [], "fixed"), 3);
  assert.equal(M.rawPlanWeekOf(new Date(2026, 4, 1), [], "fixed"), null);  // vor Planstart
  assert.equal(M.rawPlanWeekOf(new Date(2026, 11, 1), [], "fixed"), null); // nach Planende
});

console.log("planRunTargets");
t("Intervalle Woche 3: Pace 275 ±15, HF 180–188", () => {
  const r = M.planRunTargets("2026-07-14", "int", [], "fixed"); // Di der Woche 3
  assert.equal(r.week, 3);
  assert.equal(r.pace, 275);
  assert.equal(M.PACE_BAND_SEC, 15);
  assert.deepEqual(r.hr, { lo: 180, hi: 188 });
});
t("Easy Woche 1: kein Pace-Ziel, HF 130–138", () => {
  const r = M.planRunTargets("2026-06-29", "easy", [], "fixed");
  assert.equal(r.pace, null);
  assert.deepEqual(r.hr, { lo: 130, hi: 138 });
});
t("verschobener Lauf: typgleicher Lauf derselben Woche greift", () => {
  const r = M.planRunTargets("2026-07-15", "tempo", [], "fixed"); // Mi statt Do gelaufen
  assert.equal(r.pace, 315);
  assert.deepEqual(r.hr, { lo: 162, hi: 172 });
});
t("Testwoche: nur Obergrenze 196", () => {
  const r = M.planRunTargets("2026-10-14", "test", [], "fixed"); // Mi der Woche 16
  assert.equal(r.week, 16);
  assert.deepEqual(r.hr, { lo: null, hi: 196 });
});
t("außerhalb des Plans: alles null", () => {
  const r = M.planRunTargets("2026-05-01", "easy", [], "fixed");
  assert.equal(r.week, null); assert.equal(r.hr, null); assert.equal(r.pace, null);
});
t("hrTargetForType", () => {
  assert.deepEqual(M.hrTargetForType("tempo", 3).band, { lo: 162, hi: 172 });
  assert.equal(M.hrTargetForType("tempo", 3).label, "162–172");
  assert.equal(M.hrTargetForType("test", 3).band, null); // Woche 3 hat keinen Testlauf
});

console.log("Overrides (Ausfall + Ersatz)");
const W = 2; // Woche 2: regulär, kein Turnier
t("Basis: Woche 2 enthält w2-Mi-vb mit Last 6", () => {
  const plan = M.buildWeekPlan(W, undefined, undefined, [], "fixed");
  const vb = plan.flatMap((d) => d.items).find((i) => i.uid === "w2-Mi-vb");
  assert.ok(vb); assert.equal(vb.load, 6); assert.ok(!vb.cancelled);
});
t("Ausfall ohne Ersatz: Einheit bleibt sichtbar, Last 0, Wochenlast −6", () => {
  const ov = { "w2-Mi-vb": { status: "ausgefallen" } };
  const base = M.plannedWeekLoad(W, undefined, [], "fixed");
  const plan = M.buildWeekPlan(W, undefined, undefined, [], "fixed", ov);
  const vb = plan.flatMap((d) => d.items).find((i) => i.uid === "w2-Mi-vb");
  assert.ok(vb.cancelled); assert.equal(vb.load, 0);
  assert.equal(M.plannedWeekLoad(W, undefined, [], "fixed", ov), base - 6);
});
t("Ausfall mit Ersatz (Do, Last 4): Wochenlast −2, uid w2-Mi-vb-ersatz", () => {
  const ov = { "w2-Mi-vb": { status: "ausgefallen", replacement: { day: "Do", sport: "run", label: "Lockerer Ersatzlauf", dur: "30 Min", load: 4 } } };
  const base = M.plannedWeekLoad(W, undefined, [], "fixed");
  assert.equal(M.plannedWeekLoad(W, undefined, [], "fixed", ov), base - 2);
  const plan = M.buildWeekPlan(W, undefined, undefined, [], "fixed", ov);
  const ers = plan.find((d) => d.day === "Do").items.find((i) => i.replacement);
  assert.equal(ers.uid, "w2-Mi-vb-ersatz");
  assert.equal(ers.sport, "run"); assert.equal(ers.load, 4);
  assert.equal(ers.replacesUid, "w2-Mi-vb");
});
t("Ersatz-Last wird auf 1–9 geklemmt, Sport validiert", () => {
  const ov = { "w2-Mi-vb": { status: "ausgefallen", replacement: { day: "Do", sport: "strength", load: 99 } } };
  const plan = M.buildWeekPlan(W, undefined, undefined, [], "fixed", ov);
  assert.equal(plan.find((d) => d.day === "Do").items.find((i) => i.replacement).load, 9);
  const bad = { "w2-Mi-vb": { status: "ausgefallen", replacement: { day: "Xx", sport: "run", load: 4 } } };
  assert.ok(!M.buildWeekPlan(W, undefined, undefined, [], "fixed", bad).flatMap((d) => d.items).some((i) => i.replacement));
});
t("Overrides anderer Wochen wirken nicht", () => {
  const ov = { "w5-Mi-vb": { status: "ausgefallen" } };
  const plan = M.buildWeekPlan(W, undefined, undefined, [], "fixed", ov);
  assert.ok(!plan.flatMap((d) => d.items).some((i) => i.cancelled));
});
t("weekFulfilled: Ausfall zählt nicht, Ersatz muss abgehakt werden", () => {
  const ov = { "w2-Mi-vb": { status: "ausgefallen", replacement: { day: "Do", sport: "run", label: "Ersatzlauf", load: 4 } } };
  const items = M.buildWeekPlan(W, undefined, undefined, [], "fixed", ov).flatMap((d) => d.items).filter((i) => i.load > 0);
  const doneAll = {}; items.forEach((i) => (doneAll[i.uid] = true));
  assert.equal(M.weekFulfilled(W, doneAll, undefined, [], "fixed", ov), true);
  const doneOhneErsatz = { ...doneAll }; delete doneOhneErsatz["w2-Mi-vb-ersatz"];
  const quote = items.filter((i) => doneOhneErsatz[i.uid]).length / items.length;
  assert.equal(M.weekFulfilled(W, doneOhneErsatz, undefined, [], "fixed", ov), quote >= 0.8);
});
t("krank + Ersatz: Ersatz-Einheit erbt die Krank-Markierung des Tages", () => {
  const ill = [{ id: "i1", start: "2026-07-09", end: "2026-07-10", note: "" }]; // Do/Fr Woche 2
  const ov = { "w2-Mi-vb": { status: "ausgefallen", replacement: { day: "Do", sport: "run", label: "Ersatzlauf", load: 4 } } };
  const plan = M.buildWeekPlan(W, undefined, undefined, ill, "fixed", ov);
  const ers = plan.find((d) => d.day === "Do").items.find((i) => i.replacement);
  assert.equal(ers.illness, "sick");
});

console.log("Regression: bestehende Logik unverändert");
t("buildWeekPlan ohne overrides identisch zu v5.1-Aufruf", () => {
  const a = JSON.stringify(M.buildWeekPlan(3, undefined, undefined, [], "fixed"));
  const b = JSON.stringify(M.buildWeekPlan(3, undefined, undefined, [], "fixed", {}));
  assert.equal(a, b);
});
t("migrateDone: alte Positions-Keys → uids", () => {
  const r = M.migrateDone({ "2-Mi-0": true, "w3-Di-run": true });
  assert.equal(r.changed, true);
  assert.deepEqual(r.done, { "w2-Mi-vb": true, "w3-Di-run": true });
});
t("DEFAULT_DATA enthält overrides:{} und alle v5.1-Keys", () => {
  const k = Object.keys(M.DEFAULT_DATA);
  ["runLog", "strengthLog", "recoveryLog", "done", "prios", "theme", "vbSlots", "nutrition", "schoolLog", "illnessLog", "planEndMode", "overrides"].forEach((x) => assert.ok(k.includes(x), x));
});
t("targetPaceSec unverändert", () => {
  assert.equal(M.targetPaceSec("int", 3), 275);
  assert.equal(M.targetPaceSec("int", 9), 280);
  assert.equal(M.targetPaceSec("tempo", 1), 315);
  assert.equal(M.targetPaceSec("easy", 1), null);
});

console.log("Schule");
t("groupByFach: alphabetisch, Ohne Fach zuletzt, innerhalb nach Fälligkeit", () => {
  const list = [
    { id: "1", titel: "b", fach: "Mathe", faelligkeit: "2026-07-20" },
    { id: "2", titel: "a", fach: "Mathe", faelligkeit: "2026-07-14" },
    { id: "3", titel: "c", fach: "", faelligkeit: "2026-07-15" },
    { id: "4", titel: "d", fach: "Bio", faelligkeit: "2026-07-16" },
  ];
  const g = M.groupByFach(list);
  assert.deepEqual(g.map((x) => x.fach), ["Bio", "Mathe", "Ohne Fach"]);
  assert.deepEqual(g[1].items.map((x) => x.id), ["2", "1"]);
});

console.log("v5.0-Bugfix: Krank-Text ohne 'undefined'");
t("VB-Einheit krank: desc beginnt nicht mit 'undefined'", () => {
  const ill = [{ id: "x", start: "2026-07-08", end: "2026-07-09", note: "" }];
  const vb = M.buildWeekPlan(2, undefined, undefined, ill, "fixed").find((d) => d.day === "Mi").items.find((i) => i.sport === "vb");
  assert.equal(vb.illness, "sick");
  assert.ok(!/undefined/.test(vb.desc), vb.desc);
  assert.ok(vb.desc.startsWith("Krank gemeldet"));
});

console.log("secToMMSS-Rundung (v5.1-Bugfix)");
t("359,7 s → 6:00 (nicht 5:60)", () => assert.equal(M.secToMMSS(359.7), "6:00"));
t("normale Werte unverändert", () => { assert.equal(M.secToMMSS(275), "4:35"); assert.equal(M.secToMMSS(0), "0:00"); assert.equal(M.secToMMSS(null), "—"); });

console.log("chipSide");
t("rechts nah, links frei → Links-Anker", () => assert.equal(M.chipSide([5, 5, 5, 7.9, 8.1, 7.8], 8, 4), "aboveLeft"));
t("Datenlinie weit weg → Standard", () => assert.equal(M.chipSide([5, 5.2, 5.1], 8, 4, "below"), "below"));
t("beide Seiten nah → Standard rechts (Chip liegt dank Hintergrund über der Linie)", () => assert.equal(M.chipSide([8, 8.1, 7.9, 8, 8.1, 8], 8, 4), "above"));
t("null-Werte werden ignoriert", () => assert.equal(M.chipSide([null, 5, null], 8, 4), "above"));

console.log("applyTimeRange (v6.2)");
const rowsAt = (isos) => isos.map((iso, i) => ({ iso, v: i }));
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
t("u10: letzte 10 Zeilen, unabhängig vom Datum", () => {
  const rows = rowsAt(Array.from({ length: 15 }, (_, i) => daysAgoIso(15 - i)));
  assert.equal(M.applyTimeRange(rows, "u10").length, 10);
  assert.equal(M.applyTimeRange(rows, "u10")[9].v, 14);
});
t("d14: nur Zeilen der letzten 14 Tage", () => {
  const rows = rowsAt([daysAgoIso(20), daysAgoIso(13), daysAgoIso(1), todayIso()]);
  const r = M.applyTimeRange(rows, "d14");
  assert.equal(r.length, 3);
});
t("all: unverändert", () => { const rows = rowsAt([daysAgoIso(400), todayIso()]); assert.equal(M.applyTimeRange(rows, "all").length, 2); assert.equal(M.applyTimeRange(rows, null).length, 2); });
t("leere Liste bleibt leer", () => assert.deepEqual(M.applyTimeRange([], "d30"), []));
t("Grenzfall exakt am Cutoff zählt noch dazu", () => { const rows = rowsAt([daysAgoIso(30)]); assert.equal(M.applyTimeRange(rows, "d30").length, 1); });

console.log("decouplingPct (v6.2)");
t("klarer Drift: Effizienz sinkt in 2. Hälfte → positiver Wert", () => {
  const rows = [{ pace: 300, hr: 150 }, { pace: 300, hr: 150 }, { pace: 300, hr: 170 }, { pace: 300, hr: 175 }];
  const d = M.decouplingPct(rows);
  assert.ok(d > 0, `erwartet >0, war ${d}`);
});
t("stabil: kaum Unterschied → nahe 0", () => {
  const rows = [{ pace: 300, hr: 150 }, { pace: 300, hr: 151 }, { pace: 300, hr: 150 }, { pace: 300, hr: 151 }];
  assert.ok(Math.abs(M.decouplingPct(rows)) < 2);
});
t("Effizienz steigt: negativer Wert", () => {
  const rows = [{ pace: 300, hr: 175 }, { pace: 300, hr: 170 }, { pace: 300, hr: 150 }, { pace: 300, hr: 150 }];
  assert.ok(M.decouplingPct(rows) < 0);
});
t("<4 nutzbare Runden → null", () => { assert.equal(M.decouplingPct([{ pace: 300, hr: 150 }, { pace: 300, hr: 150 }]), null); });
t("fehlender Puls wird ignoriert (< 4 valide → null)", () => { assert.equal(M.decouplingPct([{ pace: 300, hr: null }, { pace: 300, hr: 150 }, { pace: 300, hr: null }]), null); });

console.log("runPlanProgress (v6.2) — 58 ist nur der Basisfall, NIE hartkodieren");
t("ohne Krankheit: 58 in beiden Modi", () => {
  assert.equal(M.runPlanProgress([], "fixed").total, 58);
  assert.equal(M.runPlanProgress([], "dynamic").total, 58);
});
t("Krankheit trifft volle Regen-Woche (Woche 4), dynamic: 65 (Nachhol-Effekt, NICHT 58)", () => {
  const ill = [{ id: "i1", start: "2026-07-20", end: "2026-07-26", note: "" }];
  assert.equal(M.runPlanProgress(ill, "dynamic").total, 65);
});
t("dieselbe Krankheit, fixed: 57 (< 58, echte Kürzung am Planende)", () => {
  const ill = [{ id: "i1", start: "2026-07-20", end: "2026-07-26", note: "" }];
  const t1 = M.runPlanProgress(ill, "fixed").total;
  assert.ok(t1 < 58, `erwartet <58, war ${t1}`);
  assert.equal(t1, 57);
});
t("uids sind eindeutig und alle w{n}-{Tag}-run-Muster", () => {
  const r = M.runPlanProgress([], "fixed");
  assert.equal(new Set(r.uids).size, r.uids.length);
  assert.ok(r.uids.every((u) => /^w\d+-(Mo|Di|Mi|Do|Fr|Sa|So)-run$/.test(u)));
});

console.log("extractLaps: hrMax aus echter Garmin-CSV (v6.4)");
{
  // Simpler CSV-Parser fürs Test-Fixture: alle Felder sind quote-delimitiert ohne eingebettete Quotes/Kommas.
  const parseSimpleCsv = (text) => {
    const lines = text.trim().split(/\r?\n/);
    const cells = (line) => line.slice(1, -1).split('","');
    const header = cells(lines[0]);
    return lines.slice(1).map((line) => Object.fromEntries(header.map((h, i) => [h, cells(line)[i]])));
  };
  const csv = readFileSync(new URL("./fixtures/activity_23427253834_2.csv", import.meta.url), "utf8");
  const rows = parseSimpleCsv(csv);
  const laps = M.extractLaps(rows);
  const work = laps.filter((l) => [2, 4, 6, 8, 10].includes(l.lap));
  t("5 Arbeitsrunden erkannt (Laufen-Abschnitte)", () => assert.equal(work.length, 5));
  t("hr (Durchschnitt) korrekt aus 'Ø Herzfrequenz'", () => {
    assert.deepEqual(work.map((l) => l.hr), [158, 162, 159, 162, 170]);
  });
  t("hrMax korrekt aus 'Maximale Herzfrequenz' (bisher ungenutzte Spalte)", () => {
    assert.deepEqual(work.map((l) => l.hrMax), [178, 181, 181, 185, 186]);
  });
  t("Pause-/Warm-up/Cool-Down-Zeilen bleiben draußen (nur 'Laufen'-Abschnitte)", () => {
    assert.ok(laps.every((l) => [2, 4, 6, 8, 10].includes(l.lap)));
  });
}

console.log("hrPeakStatus (v6.4) — Peak-mit-Marge statt Durchschnitt, echte Werte aus dem Screenshot-Lauf");
t("erste Arbeitsrunde immer neutral, unabhängig vom Wert", () => {
  assert.equal(M.hrPeakStatus(158, 178, true, { lo: 180, hi: 188 }), "neutral");
  assert.equal(M.hrPeakStatus(999, 999, true, { lo: 180, hi: 188 }), "neutral");
});
t("ohne Zielbereich immer neutral", () => assert.equal(M.hrPeakStatus(170, 186, false, null), "neutral"));
t("Peak knapp unter Ziel minus Marge → out (Runde 4: Ø162/Max181, Ziel 180-188)", () => {
  assert.equal(M.hrPeakStatus(162, 181, false, { lo: 180, hi: 188 }), "out");
});
t("Peak minus Marge erreicht Ziel → in (Runde 8: Ø162/Max185)", () => {
  assert.equal(M.hrPeakStatus(162, 185, false, { lo: 180, hi: 188 }), "in");
});
t("Peak minus Marge erreicht Ziel → in (Runde 10: Ø170/Max186)", () => {
  assert.equal(M.hrPeakStatus(170, 186, false, { lo: 180, hi: 188 }), "in");
});
t("ohne hrMax: Fallback auf Durchschnitt", () => {
  assert.equal(M.hrPeakStatus(185, null, false, { lo: 180, hi: 188 }), "in");
  assert.equal(M.hrPeakStatus(150, null, false, { lo: 180, hi: 188 }), "out");
});
t("nur Obergrenze (Test-Lauf 'bis X'): Marge zieht ab, nicht dazu", () => {
  assert.equal(M.hrPeakStatus(150, 200, false, { lo: null, hi: 196 }), "in"); // 200-5=195 <= 196
  assert.equal(M.hrPeakStatus(150, 205, false, { lo: null, hi: 196 }), "out"); // 205-5=200 > 196
});
t("weder hr noch hrMax vorhanden → neutral", () => assert.equal(M.hrPeakStatus(null, null, false, { lo: 180, hi: 188 }), "neutral"));

console.log(`\nAlle ${n} Tests grün.`);
