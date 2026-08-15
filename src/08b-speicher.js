  // ---------- Speichern ----------
  // Ein Finanzrechner, der beim Neuladen alles vergisst, ist nicht benutzbar.
  // Gespeichert wird ausschließlich im Browser dieses Geräts — es gibt keinen
  // Server, an den etwas ginge.

  var SPEICHER = "teilverkauf.stand.v1";

  function standLesen() {
    try {
      var roh = window.localStorage.getItem(SPEICHER);
      if (!roh) return null;
      var d = JSON.parse(roh);
      if (!d || !Array.isArray(d.objekte)) return null;
      return d;
    } catch (e) { return null; }   // beschädigter oder gesperrter Speicher
  }

  // Nur bekannte Felder übernehmen und auf ihre Reglergrenzen begrenzen: Ein
  // veralteter oder von Hand veränderter Stand darf die Rechnung nicht kippen.
  function objektAusStand(roh) {
    var o = {};
    Object.keys(OBJ_DEF).forEach(function (k) {
      var v = roh && roh[k];
      var vor = OBJ_DEF[k];
      if (typeof vor === "number") {
        v = typeof v === "number" && isFinite(v) ? v : vor;
        var g = reglerGrenzen(k);
        if (g) v = Math.max(g.min, Math.min(g.max, v));
      } else if (typeof vor === "boolean") {
        v = typeof v === "boolean" ? v : vor;
      } else {
        v = typeof v === "string" ? v.slice(0, 80) : vor;
      }
      o[k] = v;
    });
    return new Objekt(o);
  }

  function standAnwenden(d) {
    if (!d) return false;
    if (d.gesellschaft) {
      Object.keys(G).forEach(function (k) {
        var v = d.gesellschaft[k];
        if (typeof G[k] === "number" && typeof v === "number" && isFinite(v)) G[k] = v;
        else if (typeof G[k] === "boolean" && typeof v === "boolean") G[k] = v;
      });
    }
    OBJ.length = 0;
    d.objekte.slice(0, 50).forEach(function (r) { OBJ.push(objektAusStand(r)); });
    return true;
  }

  // Ein leerer Ausgangszustand ist nichts, was sich zu merken lohnt — sonst meldet
  // die Kopfzeile „gespeichert", obwohl nach dem Verwerfen nichts mehr da ist.
  function nichtsZuMerken() {
    if (OBJ.length) return false;
    return Object.keys(GES_DEF).every(function (k) { return G[k] === GES_DEF[k]; });
  }

  function standSchreiben() {
    if (nichtsZuMerken()) { standLoeschen(); return true; }
    try {
      window.localStorage.setItem(SPEICHER, JSON.stringify({
        version: 1,
        gespeichert: new Date().toISOString(),
        gesellschaft: G,
        objekte: OBJ.map(function (ob) { return ob.a; })
      }));
      return true;
    } catch (e) { return false; }   // privater Modus oder Speicher voll
  }

  function standLoeschen() {
    try { window.localStorage.removeItem(SPEICHER); } catch (e) { /* egal */ }
  }

  // ---------- Austausch ----------
  function standAlsText() {
    return JSON.stringify({
      version: 1,
      gespeichert: new Date().toISOString(),
      gesellschaft: G,
      objekte: OBJ.map(function (ob) { return ob.a; })
    }, null, 2);
  }

  function standAusText(text) {
    var d;
    try { d = JSON.parse(text); } catch (e) { return "Das ist kein gültiger Stand (JSON konnte nicht gelesen werden)."; }
    if (!d || !Array.isArray(d.objekte)) return "In der Datei stehen keine Objekte.";
    standAnwenden(d);
    return null;
  }
