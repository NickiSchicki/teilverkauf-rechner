// Erzeugt einen Fingerabdruck aller Modellergebnisse über viele Parameterlagen.
// Der Umbau gilt nur dann als geglückt, wenn dieser Abdruck unverändert bleibt.
var fs = require("fs");
var datei = process.argv[2] || "referenz-alt.html";
var html = fs.readFileSync(__dirname + "/" + datei, "utf8");
var body = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
var core = body.slice(0, body.indexOf("// ---------- Objekttabelle"));
var M = eval(core + "\n  return ({G:G,OBJ:OBJ,OBJ_DEF:OBJ_DEF,portfolio:portfolio,exitAnalyse:exitAnalyse," +
  "kritischeRendite:kritischeRendite,kritischerWert:kritischerWert,mindestEntgelt:mindestEntgelt," +
  "ohneHebel:ohneHebel,laufzeiten:laufzeiten,buildObject:buildObject,objectDetail:objectDetail," +
  "STELLSCHRAUBEN:STELLSCHRAUBEN,holdEffektiv:holdEffektiv});\n})();");

function r2(v) { return v === null || v === undefined || !isFinite(v) ? null : Math.round(v * 100) / 100; }

// Parameterlagen: jeweils ein Wert vom Standard abweichend, plus Kombinationen
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
// Kombinationen, die sich gegenseitig beeinflussen
LAGEN.push({holdAuto:true, weiterfuehren:false, zinsbindung:30});
LAGEN.push({hold:5, zinsbindung:25, ltv:90});
LAGEN.push({start:-15, hold:35, akquise:20000});
LAGEN.push({ltv:0, akquise:0, makler:0});

var GES = [{}, {opex:0}, {opex:20000}, {hebesatz:200}, {hebesatz:600},
           {erwKuerzung:false}, {anlage:0}, {anlage:6}, {kkZins:0}, {kkZins:12},
           {mindestRendite:0}, {mindestRendite:12}, {basisjahr:2015}, {basisjahr:2040}];

var zeilen = [];
GES.forEach(function (gp, gi) {
  var gAlt = {};
  Object.keys(gp).forEach(function (k) { gAlt[k] = M.G[k]; M.G[k] = gp[k]; });
  LAGEN.forEach(function (lp, li) {
    var o = Object.assign({}, M.OBJ_DEF, lp);
    var P = M.portfolio();
    var opex = M.G.opex / Math.max(1, M.OBJ.length), tr = P.taxRate / 100;
    var x = M.buildObject(Object.assign({}, o, { hold: M.holdEffektiv(o) }));
    var D = M.objectDetail(x, opex, tr);
    var A = M.exitAnalyse(o, opex, tr);
    var L = M.laufzeiten(o);
    var R = M.kritischeRendite(o, opex, tr);
    var H = M.ohneHebel(o, opex, tr);
    var F = M.mindestEntgelt(o, opex, tr);
    var st = M.STELLSCHRAUBEN.map(function (sch) {
      var k = M.kritischerWert(o, sch, opex, tr);
      return sch.k + "=" + k.status + ":" + (k.wert === undefined ? "-" : r2(k.wert));
    }).join(",");
    zeilen.push([gi, li,
      Math.round(x.P), Math.round(x.invest0), Math.round(x.equity0), Math.round(x.loan0),
      Math.round(x.akquise), Math.round(D.cashFinal), Math.round(D.taxSum), r2(D.irr),
      r2(x.ownerCost), Math.round(x.gewinn), Math.round(x.VT), Math.round(x.proceeds),
      r2(A.eIrr), Math.round(A.eEndR), r2(A.pVorBE), A.beKW, A.beNull, r2(A.eH), A.median,
      r2(L.verkauf), r2(L.bindung), r2(L.nachlauf), L.kredit,
      R.status, r2(R.wert), Math.round(R.jetzt), H.status, r2(H.wert),
      F.status, r2(F.ne), st,
      Math.round(P.cashFinal), Math.round(P.taxSum), r2(P.irr), P.T, P.start0, D.rows.length
    ].join("|"));
  });
  Object.keys(gAlt).forEach(function (k) { M.G[k] = gAlt[k]; });
});
console.log(zeilen.join("\n"));
