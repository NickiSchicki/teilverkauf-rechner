  // ---------- Sterblichkeit, Stammdaten und Exit-Verteilung ----------

  // Gompertz-Makeham, kalibriert an die ferneren Lebenserwartungen der amtlichen
  // Sterbetafel 2022/24 (Alter 65/70/80, Abweichung unter 0,4 Jahren).
  var MORT = {
    m: { A: 4.46e-3, B: 1.44125e-6, C: 0.132 },
    w: { A: 0, B: 1.438727e-6, C: 0.128 }
  };
  function jahresQ(par, alter) {
    var H = par.A + par.B * Math.exp(par.C * alter) * (Math.exp(par.C) - 1) / par.C;
    return 1 - Math.exp(-H);
  }

  // Gesellschaftsebene: gilt für die GmbH als Ganzes
  var G = {
    basisjahr: 2026, opex: 3000, hebesatz: 400, erwKuerzung: true, ausschuetten: false,
    anlage: 3.0, kkZins: 6.0, mindestRendite: 5.5
  };

  // Objektebene: jedes Objekt trägt seine Annahmen selbst.
  // Neue Objekte starten mit diesen festen Standardwerten.
  var OBJ_DEF = {
    name: "Neues Objekt", v0: 500000, share: 50, ne: 4.5, start: 0, hold: 15,
    alter: 75, haus: "Paar", pflege: 2.5,
    growth: 2, verfall: 0.75, abschlag: 0,
    esc: 0, de: 0, min: 0, vkKosten: 3.5,
    grest: 6.5, notar: 2.0, makler: 7.14, akquise: 5000,
    holdAuto: false,
    ltv: 60, zins: 3.9, tilg: 2.0, zinsbindung: 15, weiterfuehren: true,
    afaSatz: 2, gebAnteil: 70
  };

  // Verteilung des Exit-Zeitpunkts: Sterblichkeit (bei Paaren der Letztversterbende)
  // plus eine konstante Wahrscheinlichkeit für Pflegeheim oder Auszug.
  function exitVerteilung(o, maxJahre) {
    var art = (o.haus || "Paar").toLowerCase();
    var alter = Math.max(50, Math.min(100, o.alter || 75));
    var sM = 1, sW = 1, lebt = 1;
    var p = [0], kum = [0], rest = 1;
    for (var k = 1; k <= maxJahre; k++) {
      var a = alter + k - 1;
      if (art === "paar") {
        sM *= 1 - jahresQ(MORT.m, a);
        sW *= 1 - jahresQ(MORT.w, a);
        lebt = sM + sW - sM * sW; // mindestens eine Person lebt noch
      } else {
        lebt *= 1 - jahresQ(art === "m" ? MORT.m : MORT.w, a);
      }
      var ohnePflege = Math.pow(1 - (o.pflege || 0) / 100, k);
      var bleibt = lebt * ohnePflege;
      var pk = Math.max(0, rest - bleibt);
      p.push(pk);
      rest = bleibt;
      kum.push(1 - rest);
    }
    return { p: p, kum: kum, restNachEnde: rest };
  }

  // Einziger Ort, an dem die Exit-Verteilung normiert wird.
  // Die Restmasse jenseits des Horizonts wird dem letzten Jahr zugeschlagen, statt sie
  // wegzuwerfen — sonst rutschen Median und Erwartungswert bei jungen Haushalten zu weit nach vorn.
  var GEW_CACHE = {};
  function exitGewichte(o) {
    // Schlüssel aus genau den Größen, von denen die Verteilung abhängt — dadurch
    // veraltet der Zwischenspeicher nicht, wenn Regler die Annahmen ändern.
    var key = (o.haus || "Paar") + "|" + (o.alter || 75) + "|" + (o.pflege || 0);
    if (GEW_CACHE[key]) return GEW_CACHE[key];
    var V = exitVerteilung(o, HMAX);
    var w = [0], summe = 0;
    for (var k = 1; k <= HMAX; k++) { w.push(V.p[k]); summe += V.p[k]; }
    w[HMAX] += V.restNachEnde;
    summe += V.restNachEnde;
    if (summe > 0) for (var j = 1; j <= HMAX; j++) w[j] /= summe;
    var kum = 0, median = HMAX, eH = 0;
    for (var m = 1; m <= HMAX; m++) {
      kum += w[m];
      eH += w[m] * m;
      if (median === HMAX && kum >= 0.5) median = m;
    }
    GEW_CACHE[key] = { w: w, median: median, eH: eH };
    return GEW_CACHE[key];
  }

  // Renditehürde: was das eingesetzte Eigenkapital mindestens bringen muss.
  // Bewusst unabhängig vom Sollzins — Eigenkapital haftet und ist lange gebunden,
  // der Maßstab ist die Alternativanlage, nicht die Bankkondition.
  function zielZins() { return G.mindestRendite; }

  // Name und Wert der Renditehürde an einer Stelle. Erklärtexte setzen sie ein,
  // statt sie zu behaupten — vorher stand in drei Bildunterschriften noch der
  // Sollzins, während längst gegen die Mindestrendite gerechnet wurde.
  var ZIEL = {
    name: "Mindestrendite",
    wert: function () { return fPct(zielZins(), 2); },
    benannt: function () { return ZIEL.name + " von " + ZIEL.wert(); }
  };
