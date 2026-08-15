// Vergleicht zwei Fingerabdrücke numerisch. Reine Rundungsgrenzen sind kein Befund,
// echte Modellabweichungen schon.
var fs = require("fs");
var A = fs.readFileSync(process.argv[2], "utf8").trim().split("\n");
var B = fs.readFileSync(process.argv[3], "utf8").trim().split("\n");
var FELD = ["gi","li","P","invest0","equity0","loan0","akquise","cashFinal","taxSum","irr",
  "ownerCost","gewinn","VT","proceeds","eIrr","eEndR","pVorBE","beKW","beNull","eH","median",
  "lzVerkauf","lzBindung","lzNachlauf","lzKredit","rStatus","rWert","rJetzt","hStatus","hWert",
  "fStatus","fNe","stell","pCash","pTax","pIrr","pT","pStart0","rows"];
if (A.length !== B.length) { console.log("Zeilenzahl verschieden: " + A.length + " / " + B.length); process.exit(1); }

function nah(a, b) {
  var x = parseFloat(a), y = parseFloat(b);
  if (isNaN(x) || isNaN(y)) return a === b;
  var skala = Math.max(Math.abs(x), Math.abs(y), 1);
  return Math.abs(x - y) <= skala * 2e-4 + 0.011;   // deckt Rundung auf 2 Stellen ab
}

var echt = [], rund = 0;
for (var i = 0; i < A.length; i++) {
  if (A[i] === B[i]) continue;
  var a = A[i].split("|"), b = B[i].split("|");
  for (var j = 0; j < a.length; j++) {
    if (a[j] === b[j]) continue;
    if (nah(a[j], b[j])) { rund++; continue; }
    echt.push("Zeile " + i + " Feld " + (FELD[j] || j) + ": " + a[j] + "  ->  " + b[j]);
  }
}
console.log("Zeilen: " + A.length);
console.log("Rundungsgrenzen (ignoriert): " + rund);
console.log("Echte Abweichungen: " + echt.length);
echt.slice(0, 15).forEach(function (z) { console.log("  " + z); });
process.exit(echt.length ? 1 : 0);
