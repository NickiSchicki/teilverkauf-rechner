// Prüft, ob sich die Endliquidität lückenlos aus den Einzelposten aufbauen lässt.
// Eine Brücke, die nicht exakt aufgeht, ist schlimmer als keine.
var fs=require("fs"), path=require("path");
var SRC=path.join(__dirname,"src");
var kern=["01-format.js","02-konten.js","03-stammdaten.js","04-objekt.js","05-portfolio.js","06-kennzahlen.js","07-parameter.js","08-zustand.js"]
  .map(f=>fs.readFileSync(path.join(SRC,f),"utf8")).join("\n");
var M=eval("(function(){\"use strict\";\n"+kern+"\nreturn {G:G,OBJ_DEF:OBJ_DEF,Objekt:Objekt,Portfolio:Portfolio,POSTEN:POSTEN,cfVon:cfVon};})()");

function pruefe(objekte, titel){
  var pf=new M.Portfolio(objekte, M.G), P=pf.rechnen();
  var s={einlage:0,ne:0,proceeds:0,anlage:0,invest:0,akquise:0,zins:0,kk:0,opex:0,tax:0,loanNew:0,tilg:0,payoff:0};
  P.rows.forEach(function(r){
    s.einlage+=r.einlage; s.ne+=r.ne; s.proceeds+=r.proceeds; s.anlage+=r.anlageErtrag||0;
    s.invest+=r.invest; s.akquise+=r.akquise||0; s.zins+=r.zins; s.kk+=r.kkZins||0;
    s.opex+=r.opex; s.tax+=r.tax; s.loanNew+=r.loanNew; s.tilg+=r.tilg; s.payoff+=r.payoff;
  });
  var summe = s.einlage + s.ne + s.proceeds + s.anlage + s.loanNew
            - s.invest - s.akquise - s.zins - s.kk - s.opex - s.tax - s.tilg - s.payoff;
  var d=Math.abs(summe-P.cashFinal);
  console.log("\n"+titel);
  Object.keys(s).forEach(function(k){ if(Math.abs(s[k])>0.5) console.log("   "+k.padEnd(10)+Math.round(s[k]).toString().padStart(10)); });
  console.log("   " + "-".repeat(20));
  console.log("   Summe     "+Math.round(summe).toString().padStart(10));
  console.log("   cashFinal "+Math.round(P.cashFinal).toString().padStart(10));
  console.log("   Differenz "+d.toFixed(2)+(d<1?"  OK":"  <<< GEHT NICHT AUF"));
  // Netto-Finanzierung: Aufnahme minus Tilgung minus Abloesung
  console.log("   Finanzierung netto: "+Math.round(s.loanNew-s.tilg-s.payoff));
}
var A=new M.Objekt(Object.assign({},M.OBJ_DEF,{name:"A"}));
var B=new M.Objekt(Object.assign({},M.OBJ_DEF,{name:"B",v0:400000,share:40,start:2,alter:80,haus:"w"}));
pruefe([A], "ein Objekt");
pruefe([A,B], "zwei Objekte");
pruefe([new M.Objekt(Object.assign({},M.OBJ_DEF,{hold:8,zinsbindung:20}))], "Nachlauf (Verkauf vor Kreditende)");
pruefe([new M.Objekt(Object.assign({},M.OBJ_DEF,{ltv:0,akquise:0}))], "ohne Darlehen");
