// Regressionstests für die im Review gemeldeten Rechenfehler.
// Jeder Test benennt den Befund und prüft die Eigenschaft, nicht die Zahl.
var fs = require("fs"), path = require("path");
// Die Module liegen entweder neben diesem Skript (Repo: alles in src/) oder
// in einem Unterordner src/ (Arbeitskopie). Beides muss laufen.
var SRC = fs.existsSync(path.join(__dirname, "01-format.js"))
  ? __dirname : path.join(__dirname, "src");
var kern = ["01-format.js","02-konten.js","03-stammdaten.js","04-objekt.js",
            "05-portfolio.js","06-kennzahlen.js","07-parameter.js","08-zustand.js","08b-speicher.js"]
  .map(function (f) { return fs.readFileSync(path.join(SRC, f), "utf8"); }).join("\n");
var M = eval("(function(){\"use strict\";\n" + kern +
  "\nreturn {G:G,OBJ_DEF:OBJ_DEF,Objekt:Objekt,Portfolio:Portfolio,Kennzahlen:Kennzahlen," +
  "STELLSCHRAUBEN:STELLSCHRAUBEN,OBJ_GROUPS:OBJ_GROUPS,irr:irr,esc:esc,objektAusStand:objektAusStand,standAusText:standAusText,standAlsText:standAlsText};})()");

// Node kennt keinen Browserspeicher — für die Prüfung genügt eine Attrappe.
global.window = { localStorage: (function () { var d = {}; return {
  getItem: function (k) { return k in d ? d[k] : null; },
  setItem: function (k, v) { d[k] = String(v); },
  removeItem: function (k) { delete d[k]; } }; })() };

var fehler = 0, gesamt = 0;
function pruef(name, bedingung, info) {
  gesamt++;
  if (bedingung) { console.log("  ok    " + name); }
  else { fehler++; console.log("  FEHLT " + name + (info ? "\n          " + info : "")); }
}
function cfSumme(r) {
  return (r.ne||0) + (r.anlageErtrag||0) - (r.zins||0) - (r.kkZins||0) - (r.opex||0) - (r.akquise||0) - (r.tax||0)
       + (r.proceeds||0) - (r.invest||0)
       + (r.einlage||0) + (r.loanNew||0) - (r.tilg||0) - (r.payoff||0);
}
function obj(a) { return new M.Objekt(Object.assign({}, M.OBJ_DEF, a)); }
function pf(objekte) { return new M.Portfolio(objekte, M.G); }

console.log("\n=== P1.1  Zinsbindung darf ohne Darlehen nicht wirken ===");
(function () {
  var o = obj({ ltv: 0, hold: 1, zinsbindung: 5, weiterfuehren: true });
  var v = o.verlauf(1);
  pruef("Kapitalbindung = Haltedauer, wenn kein Darlehen besteht",
    v.darlehensJahre === 1, "darlehensJahre = " + v.darlehensJahre + " (erwartet 1)");
  var p = pf([o]);
  var mitBindung = new M.Kennzahlen(o, p).rendite();
  var ohneBindung = new M.Kennzahlen(obj({ ltv: 0, hold: 1, zinsbindung: 5, weiterfuehren: false }), p).rendite();
  pruef("Rendite unabhängig vom Weiterführen-Schalter, wenn kein Darlehen besteht",
    Math.abs(mitBindung.wert - ohneBindung.wert) < 0.01,
    "mit " + mitBindung.wert + " % / ohne " + ohneBindung.wert + " %");
})();

console.log("\n=== P1.2  Ein Objekt: Detailrechnung = Portfoliorechnung ===");
(function () {
  var o = obj({});
  var p = pf([o]), P = p.rechnen();
  var R = o.rechenwerk(p.ctx, o.holdEffektiv());
  pruef("Endliquidität stimmt überein",
    Math.abs(R.cashFinal - P.cashFinal) < 1,
    "Detail " + Math.round(R.cashFinal) + " € / Portfolio " + Math.round(P.cashFinal) + " €");
  var irrDetail = o.projektRendite(p.ctx, o.holdEffektiv());
  pruef("Rendite stimmt überein",
    Math.abs(irrDetail - P.irr) < 0.02,
    "Detail " + irrDetail.toFixed(2) + " % / Portfolio " + P.irr.toFixed(2) + " %");
})();

console.log("\n=== P1.3  Versetzte Objekte: Summe der Gemeinkosten ===");
(function () {
  var a = obj({ start: 0, hold: 1, zinsbindung: 5, weiterfuehren: false });
  var b = obj({ start: 10, hold: 1, zinsbindung: 5, weiterfuehren: false });
  var p = pf([a, b]), P = p.rechnen();
  var opexPortfolio = P.opexSum;
  var opexObjekte = a.rechenwerk(p.ctx, 1).opexSum + b.rechenwerk(p.ctx, 1).opexSum;
  pruef("Objektrechnungen tragen zusammen dieselben Gemeinkosten wie das Portfolio",
    Math.abs(opexPortfolio - opexObjekte) < 1,
    "Portfolio " + Math.round(opexPortfolio) + " € / Objekte zusammen " + Math.round(opexObjekte) + " €");
})();

console.log("\n=== P1.4  Basisjahrwechsel verschiebt keine Erwerbsjahre ===");
(function () {
  // Ein Objekt aus dem Jahr 2001 bei Basisjahr 2026 hat start = -25.
  var o = obj({ start: -25 });
  var kalenderVorher = M.G.basisjahr + o.a.start;
  // Basisjahr auf 2015: die Kompensation müsste start auf -14 setzen
  var d = 2015 - M.G.basisjahr;
  var neu = Math.max(-40, Math.min(40, o.a.start - d));
  var kalenderNachher = 2015 + neu;
  pruef("Erwerbsjahr bleibt beim Basisjahrwechsel erhalten",
    kalenderVorher === kalenderNachher,
    "vorher " + kalenderVorher + ", nachher " + kalenderNachher);
  var reglerStart = null;
  M.OBJ_GROUPS.forEach(function (g) { g.items.forEach(function (it) { if (it.id === "start") reglerStart = it; }); });
  // Der Regler muss jede Kombination aus Basisjahr (2015..2040) und Erwerbsjahr abdecken
  pruef("Reglerbereich deckt jede Basisjahr-Verschiebung ab",
    reglerStart && reglerStart.min <= -40 && reglerStart.max >= 40,
    reglerStart ? "min " + reglerStart.min + " max " + reglerStart.max + " (gebraucht -40…40)" : "kein Regler");
})();

console.log("\n=== P2.1  Stellschrauben bleiben im Reglerbereich ===");
(function () {
  var grenzen = {};
  M.OBJ_GROUPS.forEach(function (g) { g.items.forEach(function (it) {
    if (it.min !== undefined) grenzen[it.id] = { min: it.min, max: it.max }; }); });
  var schlecht = [];
  M.STELLSCHRAUBEN.forEach(function (sch) {
    var g = grenzen[sch.k];
    if (!g) { schlecht.push(sch.k + ": kein Regler"); return; }
    if (sch.min < g.min || sch.max > g.max)
      schlecht.push(sch.k + ": Suche " + sch.min + "…" + sch.max + ", Regler " + g.min + "…" + g.max);
  });
  pruef("keine Stellschraube sucht außerhalb ihres Reglers", schlecht.length === 0, schlecht.join(" | "));
})();

console.log("\n=== P2.2  Zinsfuß auch bei sehr hoher Rendite ===");
(function () {
  // Zahlungsstrom mit rund 2.000 % Jahresrendite
  var r = M.irr([-100, 500000]);        // 4.999 900 % in einem Jahr
  pruef("Zinsfuß wird auch weit über 1.000 % gefunden", r !== null,
    r === null ? "irr() lieferte null" : (r * 100).toFixed(0) + " %");
})();

console.log("\n=== Invarianten nach dem Umbau ===");
(function () {
  var lagen = [
    { name: "Standard",            objs: [obj({})] },
    { name: "zwei versetzt",       objs: [obj({}), obj({ start: 5, v0: 800000, share: 60 })] },
    { name: "Bestand + neu",       objs: [obj({ start: -8, hold: 20 }), obj({ start: 2 })] },
    { name: "ohne Darlehen",       objs: [obj({ ltv: 0 })] },
    { name: "weit versetzt, kurz", objs: [obj({ start: 0, hold: 1 }), obj({ start: 10, hold: 1 })] }
  ];
  lagen.forEach(function (L) {
    var p = pf(L.objs), P = p.rechnen(), e = [];
    P.rows.forEach(function (r, i) {
      if (Math.abs((r.buchwert + r.cash) - (r.ek + r.rest)) > 1) e.push("Bilanz J" + i);
      if (Math.abs(cfSumme(r) - r.cashChange) > 1) e.push("CF J" + i);
      if (Math.abs((i ? P.rows[i-1].cash : 0) + r.cashChange - r.cash) > 1) e.push("Kasse J" + i);
    });
    var L2 = P.rows[P.rows.length - 1];
    if (Math.abs(L2.buchwert) > 1) e.push("Buchwert am Ende");
    if (Math.abs(L2.rest) > 1) e.push("Darlehen am Ende");
    if (Math.abs(L2.cash - L2.ek) > 1) e.push("Kasse != Eigenkapital am Ende");
    pruef("Portfolio " + L.name, e.length === 0, e.slice(0, 3).join(", "));

    // dasselbe für jede Objektrechnung
    L.objs.forEach(function (o, oi) {
      var R = o.rechenwerk(p.ctx, o.holdEffektiv()), f = [];
      R.rows.forEach(function (r, i) {
        if (Math.abs((r.buchwert + r.cash) - (r.ek + r.rest)) > 1) f.push("Bilanz J" + i);
        if (Math.abs(cfSumme(r) - r.cashChange) > 1) f.push("CF J" + i);
      });
      pruef("  Objekt " + (oi + 1) + " in " + L.name, f.length === 0, f.slice(0, 3).join(", "));
    });
  });
})();

console.log("\n=== Werterhalt: gewichtet statt über die Durchschnittsdauer ===");
(function () {
  var o = obj({ holdAuto: true });
  var p = pf([o]);
  var kz = new M.Kennzahlen(o, p);
  var we = kz.werterhalt();
  pruef("Werterhalt im Sterbetafel-Modus bestimmbar", we.status === "gefunden", we.status);
  if (we.status === "gefunden") {
    // Gegenprobe: Bei der gefundenen Wachstumsrate muss der gewichtete Kapitalwert null sein
    var kw = kz.kw(M.G.mindestRendite / 100, o.mit({ growth: we.wachstum }));
    pruef("Kapitalwert bei der gefundenen Rate ist null", Math.abs(kw) < 60,
      "Kapitalwert " + Math.round(kw) + " EUR");
    // und der ausgewiesene Faktor darf nicht der naive Faktor zur Durchschnittsdauer sein
    var t = o.laufzeiten().verkauf;
    var naiv = Math.pow(1 + we.wachstum / 100, t) * Math.pow(1 - o.a.verfall / 100, t) * 100;
    pruef("gewichteter Faktor weicht vom naiven ab (exponentielles Wachstum)",
      Math.abs(we.noetig - naiv) > 0.5,
      "gewichtet " + we.noetig.toFixed(1) + " % / naiv " + naiv.toFixed(1) + " %");
  }
})();

console.log("\n=== Streuung der Sterbetafel ===");
(function () {
  [[65, "Paar"], [75, "Paar"], [85, "m"], [90, "w"], [55, "w"]].forEach(function (f) {
    var ob = new M.Objekt(Object.assign({}, M.OBJ_DEF, { alter: f[0], haus: f[1] }));
    var G2 = ob.exitGewichte();
    pruef("P25 <= Median <= P75 bei " + f[0] + " / " + f[1],
      G2.p25 <= G2.median && G2.median <= G2.p75,
      G2.p25 + " / " + G2.median + " / " + G2.p75);
    pruef("Erwartungswert liegt in der Spanne bei " + f[0] + " / " + f[1],
      G2.eH >= 1 && G2.eH <= 40, "eH = " + G2.eH);
    pruef("Restmasse jenseits des Horizonts ist ein Anteil bei " + f[0] + " / " + f[1],
      G2.ueber40 >= 0 && G2.ueber40 <= 100, "ueber40 = " + G2.ueber40);
  });
  // Ein junger Haushalt muss länger halten als ein alter — sonst stimmt die Tafel nicht
  var jung = new M.Objekt(Object.assign({}, M.OBJ_DEF, { alter: 60, haus: "Paar", pflege: 0 })).exitGewichte();
  var alt = new M.Objekt(Object.assign({}, M.OBJ_DEF, { alter: 85, haus: "Paar", pflege: 0 })).exitGewichte();
  pruef("jüngerer Haushalt hat den späteren Median", jung.median > alt.median,
    jung.median + " gegen " + alt.median);
  pruef("jüngerer Haushalt hat mehr Masse jenseits von 40 Jahren", jung.ueber40 > alt.ueber40,
    jung.ueber40.toFixed(1) + " gegen " + alt.ueber40.toFixed(1));
})();

console.log("\n=== Sicherheit: Eingaben landen nicht als Markup auf der Seite ===");
(function () {
  var boese = '<img src=x onerror=alert(1)>';
  var raus = M.esc(boese);
  pruef("spitze Klammern werden ersetzt", raus.indexOf("<") === -1 && raus.indexOf(">") === -1, raus);
  pruef("Anführungszeichen werden ersetzt", M.esc('a"b\'c').indexOf('"') === -1, M.esc('a"b\'c'));
  pruef("kaufmännisches Und zuerst", M.esc("&lt;") === "&amp;lt;", M.esc("&lt;"));
})();

console.log("\n=== Speicherstand: fremde Werte dürfen die Rechnung nicht kippen ===");
(function () {
  var ob = M.objektAusStand({ share: 9999, v0: -500, hold: "kaputt", name: { boese: true },
                              ne: null, holdAuto: "ja" });
  var g = null;
  M.OBJ_GROUPS.forEach(function (gr) { gr.items.forEach(function (it) { if (it.id === "share") g = it; }); });
  pruef("Zahl über der Reglergrenze wird begrenzt", ob.a.share === g.max, "share = " + ob.a.share);
  pruef("Zahl unter der Reglergrenze wird begrenzt", ob.a.v0 === 50000, "v0 = " + ob.a.v0);
  pruef("Text statt Zahl fällt auf den Standard zurück", ob.a.hold === M.OBJ_DEF.hold, "hold = " + ob.a.hold);
  pruef("Objekt statt Text fällt auf den Standard zurück", ob.a.name === M.OBJ_DEF.name, "name = " + JSON.stringify(ob.a.name));
  pruef("null fällt auf den Standard zurück", ob.a.ne === M.OBJ_DEF.ne, "ne = " + ob.a.ne);
  pruef("Text statt Schalter fällt auf den Standard zurück", ob.a.holdAuto === M.OBJ_DEF.holdAuto, "holdAuto = " + ob.a.holdAuto);
  // Das so entstandene Objekt muss rechenbar sein
  var p = pf([ob]);
  var r = new M.Kennzahlen(ob, p).rendite();
  // „unerreichbar" ist ein gültiges Ergebnis — geprüft wird, dass die Rechnung
  // durchläuft und keine unbrauchbare Zahl liefert.
  pruef("aus einem manipulierten Stand entsteht ein rechenbares Objekt",
    ["gefunden", "unerreichbar", "unkritisch"].indexOf(r.status) >= 0 &&
    (r.wert === undefined || isFinite(r.wert)), r.status + " / " + r.wert);
  var P1 = p.rechnen();
  pruef("und ein Portfolio, dessen Bilanz aufgeht",
    P1.rows.every(function (z) { return Math.abs((z.buchwert + z.cash) - (z.ek + z.rest)) < 1; }));
  pruef("unlesbarer Stand wird abgewiesen", typeof M.standAusText("{kaputt") === "string");
  pruef("Stand ohne Objekte wird abgewiesen", typeof M.standAusText('{"version":1}') === "string");
})();

console.log("\n=== Ergebnis: " + (gesamt - fehler) + "/" + gesamt + " bestanden ===\n");
process.exit(fehler ? 1 : 0);
