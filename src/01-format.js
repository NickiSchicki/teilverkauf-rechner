  // Zahlen- und Zeitformate. Einzige Stelle, an der aus Werten Text wird.

  var KST = 15.825;     // Körperschaftsteuer einschließlich Solidaritätszuschlag
  var ABGELT = 26.375;  // Abgeltungsteuer einschließlich Solidaritätszuschlag
  var HMAX = 40;        // längste betrachtete Haltedauer, deckt den Regler ab

  var eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  function fEur(v) {
    var n = v < 0 ? -Math.round(-v) : Math.round(v);
    return eur.format(n === 0 ? 0 : n);
  }

  function fPct(v, d) {
    if (v === null || v === undefined || !isFinite(v)) return "–";
    return v.toLocaleString("de-DE", {
      minimumFractionDigits: d === undefined ? 1 : d,
      maximumFractionDigits: d === undefined ? 1 : d
    }) + " %";
  }

  function fFaktor(v, d) {
    return v.toLocaleString("de-DE", { minimumFractionDigits: d || 4, maximumFractionDigits: d || 4 });
  }

  // Der Mindesterlös ist eine Untergrenze in Prozent der Auszahlung; interessant ist
  // aber der Teil oberhalb von 100 % — das ist der Aufschlag, den die GmbH beim
  // Verkauf mindestens erhält. Die Anzeige nennt beides, damit der Abstand in der
  // Stellschraubentabelle in derselben Skala rechnet wie die Beschriftung.
  function fAufschlag(v) {
    if (v === 0) return "keiner";
    var d = Math.round(v - 100);
    return fPct(v, 0) + (d === 0 ? " (±0)" : " (" + (d > 0 ? "+" : "−") + Math.abs(d) + ")");
  }

  // Alles, was aus einer Eingabe stammt und in Markup landet, muss hier durch.
  // Ohne das interpretiert die Seite eingegebene Tags — harmlos, solange nichts
  // gespeichert oder geteilt wird, und ein Sicherheitsproblem, sobald doch.
  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function csvNum(v) { return (Math.round(v * 100) / 100).toFixed(2).replace(".", ","); }

  // Jahresangaben: ganze Zahlen ohne Nachkomma, gemittelte mit einer Stelle
  function fJahre(v) {
    if (v === null || v === undefined || !isFinite(v)) return "–";
    var ganz = Math.abs(v - Math.round(v)) < 0.05;
    return v.toLocaleString("de-DE", { minimumFractionDigits: ganz ? 0 : 1, maximumFractionDigits: ganz ? 0 : 1 }) +
      (ganz && Math.round(v) === 1 ? " Jahr" : " Jahre");
  }
  function fJahreDat(v) { return fJahre(v).replace(" Jahre", " Jahren"); }

  // Zeitangaben laufen intern relativ zum Basisjahr; angezeigt werden Kalenderjahre.
  // Negative Werte sind zulässig — sie bezeichnen Objekte, die schon im Bestand sind.
  function fJahr(j) { return String(G.basisjahr + Math.round(j)); }

  // Ohne Zwischenausschüttungen realisiert sich die gesamte Rendite beim Verkauf:
  // Das Eigenkapital geht einmal hinein und kommt einmal zurück. Die Gesamtrendite
  // über die Kapitalbindung ist deshalb die anschaulichere Größe; der Jahreszins ist
  // nur ihre Verteilung auf die Zeit.
  function gesamtRendite(pa, jahre) { return (Math.pow(1 + pa / 100, jahre) - 1) * 100; }

  // Interner Zinsfuß über Bisektion. Ohne Vorzeichenwechsel gibt es keine Lösung.
  function irr(cfs) {
    function npv(r) {
      var a = 0;
      for (var i = 0; i < cfs.length; i++) a += cfs[i] / Math.pow(1 + r, i);
      return a;
    }
    // Der Suchbereich muss auch extreme, aber gültige Renditen einschließen —
    // sonst zeigt die Anzeige einen Strich, obwohl ein Zinsfuß existiert.
    var lo = -0.999, hi = 10;
    while (hi < 1e7 && npv(lo) * npv(hi) > 0) hi *= 10;
    if (npv(lo) * npv(hi) > 0) return null;
    for (var i = 0; i < 90 && hi - lo > 1e-11; i++) {
      var mid = (lo + hi) / 2;
      if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  function kapitalwert(flows, r) {
    var a = 0;
    for (var i = 0; i < flows.length; i++) a += flows[i] / Math.pow(1 + r, i);
    return a;
  }
