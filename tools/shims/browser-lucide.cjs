// Icon-Adapter: baut aus den Lucide-UMD-Daten (window.lucide.icons) echte React-Komponenten.
// WICHTIG: muss ein echtes Objekt mit eigenen Properties sein (kein Proxy) — esbuilds
// CJS→ESM-Interop kopiert benannte Importe über getOwnPropertyNames.
var React = window.React;
function __mkIcon(e) {
  return function (t) {
    t = t || {};
    var n = t.size == null ? 24 : t.size, a = t.color, s = t.strokeWidth == null ? 2 : t.strokeWidth, i = t.className, l = t.style;
    var o = (window.lucide && (window.lucide.icons || window.lucide) || {})[e];
    if (o && o.node) o = o.node;
    return Array.isArray(o)
      ? React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: n, height: n, viewBox: "0 0 24 24", fill: "none", stroke: a || "currentColor", strokeWidth: s, strokeLinecap: "round", strokeLinejoin: "round", className: i, style: l },
          o.map(function (d, c) { return React.createElement(d[0], Object.assign({ key: c }, d[1])); }))
      : React.createElement("span", { className: i, style: Object.assign({ display: "inline-block", width: n, height: n }, l) });
  };
}
var src = (window.lucide && (window.lucide.icons || window.lucide)) || {};
var out = {};
for (var k in src) out[k] = __mkIcon(k);
// Sicherheitsnetz: alle im Quellcode importierten Namen garantieren (__mkIcon hat eigenen Fallback)
["Gauge", "CalendarDays", "TrendingUp", "Moon", "Dumbbell", "Footprints", "Plus", "Check", "ChevronRight", "ChevronLeft", "ChevronDown", "Info", "Trophy", "Trash2", "Heart", "RotateCcw", "ExternalLink", "Sparkles", "Upload", "ArrowUp", "ArrowDown", "HeartPulse", "Mountain", "Download", "Copy", "RefreshCw", "Settings", "Sun", "MonitorSmartphone", "Flame", "Target", "Utensils", "Watch", "GraduationCap", "Thermometer", "Pencil", "Calendar"].forEach(function (n) { if (!out[n]) out[n] = __mkIcon(n); });
module.exports = out;
