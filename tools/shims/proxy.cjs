// Beliebige benannte Importe (Recharts-Bausteine, Lucide-Icons, Papa) als No-op-Komponenten
module.exports = new Proxy(function () { return null; }, {
  get: (t, p) => (p === "__esModule" ? false : function StubComponent() { return null; }),
});
