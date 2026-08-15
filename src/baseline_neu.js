// Derselbe Fingerabdruck wie baseline.js, aber gegen die neue Struktur gerechnet.
var fs = require("fs"), path = require("path");
// Die Module liegen entweder neben diesem Skript (Repo: alles in src/) oder
// in einem Unterordner src/ (Arbeitskopie). Beides muss laufen.
var SRC = fs.existsSync(path.join(__dirname, "01-format.js"))
  ? __dirname : path.join(__dirname, "src");
var kern = ["01-format.js","02-konten.js","03-stammdaten.js","04-objekt.js",
            "05-portfolio.js","06-kennzahlen.js","07-parameter.js","08-zustand.js"]
  .map(function (f) { return fs.readFileSync(path.join(SRC, f), "utf8"); }).join("\n");

var M = eval("(function(){\n\"use strict\";\n" + kern +
  "\nreturn {G:G,OBJ_DEF:OBJ_DEF,Objekt:Objekt,Portfolio:Portfolio,Kennzahlen:Kennzahlen," +
  "STELLSCHRAUBEN:STELLSCHRAUBEN,OBJ:OBJ};\n})()");

function r2(v) { return v === null || v === undefined || !isFinite(v) ? null : Math.round(v * 100) / 100; }

var LAGEN = [{}];
[["ne",2],["ne",8],["share",10],["share",90],["v0",100000],["v0",1500000],
 ["hold",1],["hold",40],["start",-20],["start",15],["ltv",0],["ltv",95],
 ["zins",1],["zins",9],["tilg",0],["tilg",5],["zinsbindung",5],["zinsbindung",30],
 ["growth",-2],["growth",5],["verfall",0],["verfall",3],["abschlag",0],["abschlag",40],
 ["makler",0],["makler",7.14],["akquise",0],["akquise",40000],["grest",3.5],["grest",6.5],
 ["notar",0],["notar",3],["vkKosten",0],["vkKosten",8],["de",0],["de",8],["min",0],["min",140],
 ["esc",0],["esc",4],["alter",55],["alter",95],["pflege",0],["pflege",6],
 ["afaSatz",1],["afaSatz",4],["gebAnteil",40],["gebAnteil",90],
 ["holdAuto",true],["holdAuto",false],["weiterfuehren",true],["weiterfuehren",false],
 ["haus","m"],["haus","w"],["haus","Paar"]
].forEach(function (p) { var o = {}; o[p[0]] = p[1]; LAGEN.push(o); });
LAGEN.push({holdAuto:true, weiterfuehren:false, zinsbindung:30});
LAGEN.push({hold:5, zinsbindung:25, ltv:90});
LAGEN.push({start:-15, hold:35, akquise:20000});
LAGEN.push({ltv:0, akquise:0, makler:0});

var GES = [{}, {opex:0}, {opex:20000}, {hebesatz:200}, {hebesatz:600},
           {erwKuerzung:false}, {anlage:0}, {anlage:6}, {kkZins:0}, {kkZins:12},
           {mindestRendite:0}, {mindestRendite:12}, {basisjahr:2015}, {basisjahr:2040}];

// Die beiden Beispielobjekte als Portfolio — wie in der alten Fassung
var zeilen = [];
GES.forEach(function (gp, gi) {
  var gAlt = {};
  Object.keys(gp).forEach(function (k) { gAlt[k] = M.G[k]; M.G[k] = gp[k]; });
  // Prüf-Fixture: zwei Objekte, unabhängig davon, womit die Anwendung startet
  var FIX = [
    new M.Objekt(Object.assign({}, M.OBJ_DEF, { name: "A", v0: 500000, share: 50, alter: 75, haus: "Paar" })),
    new M.Objekt(Object.assign({}, M.OBJ_DEF, { name: "B", v0: 400000, share: 40, start: 2, hold: 15, alter: 80, haus: "w" }))
  ];
  var pf = new M.Portfolio(FIX, M.G);
  var P = pf.rechnen();
  LAGEN.forEach(function (lp, li) {
    var ob = new M.Objekt(Object.assign({}, M.OBJ_DEF, lp));
    var KZ = new M.Kennzahlen(ob, pf);
    var v = ob.verlauf(ob.holdEffektiv());
    var RW = ob.rechenwerk(pf.ctx, ob.holdEffektiv());
    var A = KZ.analyse();
    var L = ob.laufzeiten();
    var R = A.rendite;
    var H = KZ.ohneHebel();
    var F = KZ.mindestEntgelt();
    var st = M.STELLSCHRAUBEN.map(function (sch) {
      var k = KZ.kritischerWert(sch);
      return sch.k + "=" + k.status + ":" + (k.wert === undefined ? "-" : r2(k.wert));
    }).join(",");
    var irrObj = irrVon(RW);
    zeilen.push([gi, li,
      Math.round(v.P), Math.round(v.invest0), Math.round(v.equity0), Math.round(v.loan0),
      Math.round(v.akquise), Math.round(RW.cashFinal), Math.round(RW.taxSum), r2(irrObj),
      r2(ob.ownerCost(ob.holdEffektiv())), Math.round(v.gewinn), Math.round(v.VT), Math.round(v.proceeds),
      r2(A.eIrr === null ? null : A.eIrr), Math.round(A.eEndR), r2(A.pVorBE), A.beKW, A.beNull, r2(A.eH), A.median,
      r2(L.verkauf), r2(L.bindung), r2(L.nachlauf), L.kredit,
      R.status, r2(R.wert), Math.round(R.jetzt), H.status, r2(H.wert),
      F.status, r2(F.ne), st,
      Math.round(P.cashFinal), Math.round(P.taxSum), r2(P.irr), P.T, P.start0, RW.rows.length
    ].join("|"));
  });
  Object.keys(gAlt).forEach(function (k) { M.G[k] = gAlt[k]; });
});

// interner Zinsfuß des Projekts, wie ihn die alte objectDetail-Funktion lieferte
function irrVon(RW) {
  var f = [-RW.v.equity0];
  for (var k = 1; k < RW.rows.length; k++) f.push(0);
  f[f.length - 1] += RW.cashFinal;
  var a = 0, lo = -0.95, hi = 10;
  function npv(r) { var s = 0; for (var i = 0; i < f.length; i++) s += f[i] / Math.pow(1 + r, i); return s; }
  if (npv(lo) * npv(hi) > 0) return null;
  for (var i = 0; i < 60 && hi - lo > 1e-7; i++) { var m = (lo + hi) / 2; if (npv(lo) * npv(m) <= 0) hi = m; else lo = m; }
  return (lo + hi) / 2 * 100;
}
console.log(zeilen.join("\n"));
