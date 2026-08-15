#!/usr/bin/env node
// Setzt die Quelldateien zu einer eigenständigen HTML-Datei zusammen.
// Kein npm, keine Abhängigkeiten — damit das Ergebnis weiterhin per Doppelklick
// funktioniert und ohne Server auf GitHub Pages liegen kann.
var fs = require("fs"), path = require("path");
var SRC = path.join(__dirname, "src");
var ZIEL = process.argv[2] || path.join(__dirname, "modell.html");

function lies(n) { return fs.readFileSync(path.join(SRC, n), "utf8").replace(/\s+$/, ""); }

// Reihenfolge ist Abhängigkeitsreihenfolge: untere Schichten zuerst.
var MODULE = fs.readdirSync(SRC)
  .filter(function (f) { return /^\d\d-.*\.js$/.test(f); })
  .sort();

var js = MODULE.map(function (f) {
  return "  // ══════════ " + f + " ══════════\n" + lies(f);
}).join("\n\n");

var out =
  '<!doctype html>\n<html lang="de">\n<head>\n' +
  '<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  "<title>Teilverkauf-Portfolio</title>\n" +
  "<style>\n" + lies("_css.css") + "\n</style>\n" +
  "</head>\n<body>\n" +
  lies("_markup.html") + "\n" +
  "<script>\n(function () {\n  \"use strict\";\n\n" + js + "\n\n  start();\n})();\n<\/script>\n" +
  "</body>\n</html>\n";

fs.writeFileSync(ZIEL, out);
console.log("gebaut: " + path.basename(ZIEL) + "  (" + MODULE.length + " Module, " +
  out.split("\n").length + " Zeilen, " + Math.round(out.length / 1024) + " KB)");
MODULE.forEach(function (f) {
  console.log("   " + String(lies(f).split("\n").length).padStart(5) + "  " + f);
});
