// Seed-Daten für die Browser-Verifikation: 2 Wochen realistisches Training (Läufe mit Runden),
// Krankheit am Wochenende (ohne Plan-Verzug), VB-Ausfall mit Ersatz, Schule inkl. Klausuren.
const L = (lap, dist, sec, hr) => ({ lap, dist, sec, pace: sec / dist, hr });
const run = (id, date, type, dist, sec, hrAvg, laps, extra = {}) => ({ id, imported: true, date, type, dist, sec: Math.round(sec), pace: sec / dist, hrAvg, laps, calories: Math.round(dist * 70), ...extra });

export const SEED = {
  runLog: [
    run("r1", "2026-06-29", "easy", 5.0, 5 * 331, 136, [L(1, 1, 333, 131), L(2, 1, 330, 135), L(3, 1, 329, 137), L(4, 1, 334, 138), L(5, 1, 329, 139)], { cadence: 168, strideLen: 1.02 }),
    run("r2", "2026-06-30", "int", 6.2, 2260, 171, [
      L(1, 0.8, 224, 179), L(2, 0.4, 190, 148), L(3, 0.8, 221, 183), L(4, 0.4, 192, 150),
      L(5, 0.8, 219, 185), L(6, 0.4, 195, 149), L(7, 0.8, 226, 186), L(8, 0.4, 193, 151), L(9, 0.8, 222, 187),
    ], { cadence: 176, strideLen: 1.14 }),
    run("r3", "2026-07-02", "tempo", 5.5, 5.5 * 322, 167, [L(1, 1.1, 352, 152), L(2, 1.1, 349, 165), L(3, 1.1, 346, 169), L(4, 1.1, 351, 171)], { cadence: 172, strideLen: 1.08 }),
    run("r4", "2026-07-04", "long", 8.0, 8 * 350, 147, [L(1, 2, 706, 141), L(2, 2, 700, 146), L(3, 2, 698, 149), L(4, 2, 696, 151)], { cadence: 166, strideLen: 0.99 }),
    run("r5", "2026-07-06", "easy", 5.2, 5.2 * 327, 133, [L(1, 1.3, 428, 129), L(2, 1.3, 424, 132), L(3, 1.3, 423, 135), L(4, 1.3, 426, 136)], { cadence: 169, strideLen: 1.03 }),
    run("r6", "2026-07-07", "int", 6.2, 2230, 172, [
      L(1, 0.8, 220, 181), L(2, 0.4, 188, 147), L(3, 0.8, 217, 184), L(4, 0.4, 190, 149),
      L(5, 0.8, 216, 186), L(6, 0.4, 191, 150), L(7, 0.8, 221, 187), L(8, 0.4, 192, 150), L(9, 0.8, 218, 188),
    ], { cadence: 177, strideLen: 1.15 }),
    run("r7", "2026-07-09", "tempo", 5.5, 5.5 * 318, 165, [L(1, 1.1, 348, 150), L(2, 1.1, 344, 163), L(3, 1.1, 342, 167), L(4, 1.1, 346, 169)], { cadence: 173, strideLen: 1.09 }),
    run("r8", "2026-07-11", "long", 8.4, 8.4 * 347, 145, [L(1, 2.1, 736, 139), L(2, 2.1, 730, 144), L(3, 2.1, 727, 147), L(4, 2.1, 725, 149)], { cadence: 167, strideLen: 1.0 }),
  ],
  strengthLog: [
    { id: "s1", date: "2026-06-29", exercise: "Kniebeuge (5 Wdh.)", weight: 60 },
    { id: "s2", date: "2026-07-06", exercise: "Kniebeuge (5 Wdh.)", weight: 65 },
  ],
  recoveryLog: [
    { id: "c1", date: "2026-07-04", sleep: 6.5, readiness: 3 },
    { id: "c2", date: "2026-07-05", sleep: 5.8, readiness: 2 },
    { id: "c3", date: "2026-07-06", sleep: 7.2, readiness: 3 },
    { id: "c4", date: "2026-07-07", sleep: 6.9, readiness: 3 },
    { id: "c5", date: "2026-07-08", sleep: 7.8, readiness: 4 },
    { id: "c6", date: "2026-07-09", sleep: 8.2, readiness: 4 },
    { id: "c7", date: "2026-07-10", sleep: 7.9, readiness: 4 },
    { id: "c8", date: "2026-07-11", sleep: 8.1, readiness: 4 },
    { id: "c9", date: "2026-07-12", sleep: 7.6, readiness: 3 },
  ],
  done: {
    "w1-Mo-run": true, "w1-Di-run": true, "w1-Mi-vb": true, "w1-Do-run": true, "w1-Mo-str-upper": true,
    "w2-Mo-run": true, "w2-Di-run": true, "w2-Mi-vb": true, "w2-Do-run": true, "w2-Sa-run": true, "w2-Fr-vb": true,
    "w3-Mo-run": true,
  },
  prios: ["vb", "run", "strength"],
  theme: "light",
  vbSlots: [{ day: "Mi", time: "19:00" }, { day: "Fr", time: "17:00" }],
  schoolLog: [
    { id: "h1", titel: "S. 42 Nr. 3–5", fach: "Mathe", faelligkeit: "2026-07-14", art: "hausaufgabe", erledigt: false },
    { id: "h2", titel: "Analysis-Klausur", fach: "Mathe", faelligkeit: "2026-07-16", art: "klausur", erledigt: false },
    { id: "h3", titel: "Gedichtanalyse fertigstellen", fach: "Deutsch", faelligkeit: "2026-07-13", art: "hausaufgabe", erledigt: false },
    { id: "h4", titel: "Vokabeltest Unit 5", fach: "Englisch", faelligkeit: "2026-07-20", art: "klausur", erledigt: false },
    { id: "h5", titel: "Referat Ökosysteme", fach: "Bio", faelligkeit: "2026-07-10", art: "hausaufgabe", erledigt: true },
    { id: "h6", titel: "Sportfest-Anmeldung abgeben", fach: "", faelligkeit: "2026-07-15", art: "hausaufgabe", erledigt: false },
  ],
  illnessLog: [{ id: "i1", start: "2026-07-04", end: "2026-07-04", note: "Erkältung" }],
  planEndMode: "fixed",
  overrides: { "w3-Fr-vb": { status: "ausgefallen", replacement: { day: "Sa", sport: "run", label: "Lockerer Ersatzlauf", dur: "30 Min", load: 4 } } },
};
