#!/usr/bin/env node
// Setzt die Quelldateien zu einer eigenständigen HTML-Datei zusammen.
// Kein npm, keine Abhängigkeiten — damit das Ergebnis weiterhin per Doppelklick
// funktioniert und ohne Server auf GitHub Pages liegen kann.
var fs = require("fs"), path = require("path");
var SRC = path.join(__dirname, "src");
var ZIEL = process.argv[2] || path.join(__dirname, "modell.html");

function lies(n) {
  var s = fs.readFileSync(path.join(SRC, n), "utf8").replace(/\s+$/, "");
  // Die Fragmente dürfen die umgebenden Tags nicht selbst mitbringen — ein
  // verirrtes <style> hier verschluckt sonst die erste CSS-Regel, ohne dass
  // die Seite sichtbar bricht.
  var verboten = /^\s*<(style|script|body|html|head)\b/i;
  if (verboten.test(s)) throw new Error(n + " beginnt mit einem Tag, das der Build selbst setzt");
  if (/<\/(style|script|body|html)>\s*$/i.test(s)) throw new Error(n + " endet mit einem Tag, das der Build selbst setzt");
  return s;
}

// Reihenfolge ist Abhängigkeitsreihenfolge: untere Schichten zuerst.
var MODULE = fs.readdirSync(SRC)
  .filter(function (f) { return /^\d\d-.*\.js$/.test(f); })
  .sort();

var js = MODULE.map(function (f) {
  return "  // ══════════ " + f + " ══════════\n" + lies(f);
}).join("\n\n");

// Der gemeinsame Rumpf: Titel, Stil, Markup, Programm.
var rumpf =
  "<title>Teilverkauf-Portfolio</title>\n" +
  "<style>\n" + lies("_css.css") + "\n</style>\n" +
  lies("_markup.html") + "\n" +
  "<script>\n(function () {\n  \"use strict\";\n\n" + js + "\n\n  start();\n})();\n<\/script>\n";

// Vollständige Seite — für GitHub Pages und zum lokalen Öffnen. Der Doctype ist
// nicht optional: Ohne ihn rendert der Browser im Quirks-Modus und Abstände
// fallen anders aus als beabsichtigt.
var seite =
  '<!doctype html>\n<html lang="de">\n<head>\n' +
  '<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  rumpf.replace(/^(<title>[^<]*<\/title>\n<style>[\s\S]*?<\/style>\n)/, "$1</head>\n<body>\n") +
  "</body>\n</html>\n";

fs.writeFileSync(ZIEL, seite);
// Fragment ohne Rahmen-Tags — die Artifact-Veröffentlichung setzt sie selbst.
fs.writeFileSync(ZIEL.replace(/\.html$/, "-fragment.html"), rumpf);
console.log("gebaut: " + path.basename(ZIEL) + " + Fragment  (" + MODULE.length + " Module, " +
  seite.split("\n").length + " Zeilen, " + Math.round(seite.length / 1024) + " KB)");
MODULE.forEach(function (f) {
  console.log("   " + String(lies(f).split("\n").length).padStart(5) + "  " + f);
});
