  // ---------- Kennzahlen eines Objekts ----------
  // Eine einzige Stelle, an der Rendite, Kapitalwert und Laufzeiten entstehen.
  // Zuvor rechneten drei Ansichten dieselbe Größe unabhängig voneinander und
  // zeigten drei verschiedene Zahlen; jede Aufrufstelle musste selbst an die
  // richtige Gewichtung und Kostenbasis denken. Beides steckt jetzt hier.

  function Kennzahlen(ob, pf) {
    this.ob = ob;
    this.pf = pf;
    this.ctx = pf.ctx;
    this._c = {};
  }

  // Kapitalwertkurve über alle Haltedauern — ohne Zinsfuß, deshalb schnell genug
  // für Bisektionen. Grundlage sowohl der Analyse als auch des Ankaufsfilters.
  Kennzahlen.prototype.kurve = function (ob, nurGewichtete) {
    var o = ob || this.ob, ctx = this.ctx, k = [];
    // Ohne Sterbetafel-Kopplung trägt genau eine Haltedauer Gewicht. Die übrigen
    // 39 Punkte gehen mit null in jede Summe ein — sie zu rechnen kostet nur Zeit.
    var w = nurGewichtete ? o.renditeGewichte() : null;
    for (var h = 1; h <= HMAX; h++) {
      if (w && !w[h]) { k.push(null); continue; }
      var s = o.ekStrom(ctx, h);
      k.push({ h: h, ende: s.ende, endwert: s.cashFinal, equity0: s.equity0, flows: s.flows });
    }
    return k;
  };

  // Wahrscheinlichkeitsgewichteter Kapitalwert. Weil der Kapitalwert linear in den
  // Zahlungen ist, entspricht er exakt dem Kapitalwert des gewichteten Zahlungsstroms —
  // die Zielgröße braucht daher keine unterstellte Haltedauer.
  function gewKapitalwert(kurve, w, disk) {
    var a = 0;
    for (var k = 1; k <= HMAX; k++) {
      if (!w[k] || !kurve[k - 1]) continue;
      a += w[k] * kapitalwert(kurve[k - 1].flows, disk);
    }
    return a;
  }

  Kennzahlen.prototype.kw = function (disk, ob) {
    var o = ob || this.ob;
    return gewKapitalwert(this.kurve(o, true), o.renditeGewichte(), disk);
  };

  // Der Zinsfuß, bei dem der gewichtete Kapitalwert null wird: die Rendite, die
  // dieser Vertrag tatsächlich abwirft. Alle Renditeangaben leiten sich hieraus ab.
  Kennzahlen.prototype.rendite = function (ob) {
    var self = this, o = ob || this.ob;
    var kurve = this.kurve(o, true), w = o.renditeGewichte();
    function bei(r) { return gewKapitalwert(kurve, w, r / 100); }
    var jetzt = bei(G.mindestRendite);
    var lo = -60, hi = 40;
    if (bei(lo) < 0) return { status: "unerreichbar", jetzt: jetzt };
    if (bei(hi) >= 0) return { status: "unkritisch", jetzt: jetzt };
    for (var i = 0; i < 48 && hi - lo > 1e-7; i++) {
      var mid = (lo + hi) / 2;
      if (bei(mid) >= 0) lo = mid; else hi = mid;
    }
    // wert ist der angezeigte Jahreszins, exakt der ungerundete — aus ihm wird die
    // Gesamtrendite gerechnet, sonst potenziert sich der Rundungsrest über die Jahre.
    var wrt = Math.round(lo * 100) / 100;
    return { status: "gefunden", wert: wrt, exakt: lo, jetzt: jetzt,
      reicht: G.mindestRendite <= wrt + 0.02 };
  };

  // Dasselbe Projekt ohne Fremdkapital. Die Zinsbindung entfällt dabei von selbst,
  // weil ohne Darlehen nichts abzulösen ist — siehe Objekt.darlehensJahre.
  Kennzahlen.prototype.ohneHebel = function () {
    return this.rendite(this.ob.mit({ ltv: 0 }));
  };

  // Umkehrrechnung: Welcher Wert einer Stellschraube bringt — bei sonst unveränderten
  // Annahmen — genau den Renditeanspruch? Die Wirkungsrichtung wird gemessen, nicht unterstellt.
  Kennzahlen.prototype.kritischerWert = function (sch) {
    var self = this, disk = G.mindestRendite / 100, ist = this.ob.a[sch.k];
    function bei(v) { return self.kw(disk, self.ob.mit(zuweisung(sch.k, v))); }
    var kwMin = bei(sch.min), kwMax = bei(sch.max);
    var jetzt = bei(ist);
    var steigend = kwMax > kwMin;
    var gut = steigend ? sch.max : sch.min, schlecht = steigend ? sch.min : sch.max;
    if ((steigend ? kwMax : kwMin) < 0) return { status: "unerreichbar", jetzt: jetzt };
    if ((steigend ? kwMin : kwMax) >= 0) return { status: "unkritisch", jetzt: jetzt };
    var lo = schlecht, hi = gut;
    for (var i = 0; i < 22 && Math.abs(hi - lo) > 0.005; i++) {
      var mid = (lo + hi) / 2;
      if (bei(mid) < 0) lo = mid; else hi = mid;
    }
    var wrt = Math.round(hi * 100) / 100;
    // Toleranz, damit an der Nullstelle kein Rundungsrest als Unterschreitung erscheint
    return { status: "gefunden", wert: wrt, jetzt: jetzt,
      reicht: steigend ? ist >= wrt - 0.02 : ist <= wrt + 0.02 };
  };

  function zuweisung(k, v) { var o = {}; o[k] = v; return o; }

  // Ankaufsfilter: Welches Nutzungsentgelt ist nötig, damit der gewichtete
  // Kapitalwert gerade null wird?
  var NE_MIN = 1, NE_MAX = 9;
  Kennzahlen.prototype.mindestEntgelt = function () {
    var self = this, disk = G.mindestRendite / 100;
    function bei(ne) { return self.kw(disk, self.ob.mit({ ne: ne })); }
    var kwAktuell = bei(this.ob.a.ne);
    if (bei(NE_MIN) >= 0) return { status: "nicht bindend", ne: NE_MIN, kwAktuell: kwAktuell };
    if (bei(NE_MAX) < 0) return { status: "nicht erreichbar", ne: null, kwAktuell: kwAktuell };
    var lo = NE_MIN, hi = NE_MAX;
    for (var i = 0; i < 24 && hi - lo > 0.005; i++) {
      var mid = (lo + hi) / 2;
      if (bei(mid) < 0) lo = mid; else hi = mid;
    }
    var ne = Math.ceil(hi * 100) / 100;
    // Eigentümerkosten zum Mindestentgelt — ohne sie entstehen Preise, die niemand zahlt
    var xo = this.ob.mit({ ne: ne });
    return { status: "gefunden", ne: ne, ownerCost: xo.ownerCost(xo.holdEffektiv()),
      monat: this.ob.preise().P * (ne / 100) / 12, kwAktuell: kwAktuell };
  };

  // Welcher Immobilienwert beim Verkauf trägt den Renditeanspruch?
  // Übersetzt die Hürde in eine Aussage über den Markt: Nicht „welche Wachstumsrate",
  // sondern „wie viel Prozent des heutigen Werts muss der Verkaufspreis erreichen".
  // Das hängt an allem — Anteil, Entgelt, Finanzierung, Kosten —, ist aber die Größe,
  // die sich am ehesten mit einer Markteinschätzung vergleichen lässt.
  Kennzahlen.prototype.werterhalt = function () {
    var o = this.ob.a, disk = G.mindestRendite / 100, self = this;
    var t = this.ob.laufzeiten().verkauf;
    if (!(t > 0)) return { status: "unerreichbar" };

    // Gesucht ist der Faktor auf den heutigen Wert. Er wirkt allein über den
    // Verkaufspreis, deshalb wird er als Wachstumsrate eingesetzt und danach
    // wieder in einen Faktor zurückgerechnet — inklusive Instandhaltungsverfall,
    // denn der mindert denselben Preis.
    // Bei gewichteter Rechnung wird über die Verkaufszeitpunkte gemittelt, nicht
    // über die mittlere Laufzeit hochgerechnet: Wachstum ist exponentiell, deshalb
    // ist der Faktor zur Durchschnittsdauer nicht der durchschnittliche Faktor.
    var w = this.ob.renditeGewichte();
    function faktorVon(g) {
      var a = 1 + g / 100, b = 1 - o.verfall / 100, sum = 0, mass = 0;
      for (var k = 1; k <= HMAX; k++) {
        if (!w[k]) continue;
        sum += w[k] * Math.pow(a, k) * Math.pow(b, k);
        mass += w[k];
      }
      return mass > 0 ? sum / mass : Math.pow(a, t) * Math.pow(b, t);
    }
    function kwBei(g) { return self.kw(disk, self.ob.mit({ growth: g })); }

    var lo = -20, hi = 25;
    if (kwBei(hi) < 0) return { status: "unerreichbar", jetzt: faktorVon(o.growth) * 100 };
    if (kwBei(lo) >= 0) return { status: "immer", jetzt: faktorVon(o.growth) * 100 };
    for (var i = 0; i < 40 && hi - lo > 1e-4; i++) {
      var mid = (lo + hi) / 2;
      if (kwBei(mid) >= 0) hi = mid; else lo = mid;
    }
    var noetig = faktorVon(hi) * 100;
    var jetzt = faktorVon(o.growth) * 100;
    return {
      status: "gefunden",
      noetig: noetig,                       // in Prozent des heutigen Werts
      jetzt: jetzt,                         // was die Annahmen ergeben
      wachstum: hi,                         // die zugehörige Rate p.a.
      preis: o.v0 * noetig / 100,           // absoluter Verkaufspreis
      jahre: t,
      reicht: jetzt >= noetig - 0.2
    };
  };

  // Verteilung des Exit-Zeitpunkts mit Break-even und Kapitalwertverlauf
  Kennzahlen.prototype.analyse = function () {
    if (this._c.a) return this._c.a;
    var ob = this.ob, ctx = this.ctx, disk = G.mindestRendite / 100;
    var GW = ob.exitGewichte(), w = GW.w, wR = ob.renditeGewichte();
    var LZ = ob.laufzeiten();

    var kurve = [];
    for (var h = 1; h <= HMAX; h++) {
      var s = ob.ekStrom(ctx, h);
      kurve.push({ h: h, ende: s.ende, kw: kapitalwert(s.flows, disk),
        endwert: s.cashFinal, equity0: s.equity0, flows: s.flows });
    }

    // Break-even über den Kapitalwert — bei kurzen Haltedauern mit stark negativen
    // Anfangszahlungen ist der interne Zinsfuß nicht eindeutig.
    var beKW = null, beNull = null;
    kurve.forEach(function (p) {
      if (beKW === null && p.kw >= 0) beKW = p.h;
      if (beNull === null && p.endwert >= p.equity0) beNull = p.h;
    });

    var eEnd = 0, eEndR = 0, pVorBE = 0;
    for (var k = 1; k <= HMAX; k++) {
      eEnd += w[k] * kurve[k - 1].endwert;
      eEndR += wR[k] * kurve[k - 1].endwert;
      // Anteil der Fälle, in denen der Kapitalwert negativ bleibt — setzt keine
      // Monotonie über die Haltedauer voraus, anders als ein einzelner Break-even-Punkt
      if (kurve[k - 1].kw < 0) pVorBE += w[k];
    }

    var R = this.rendite();
    var hEff = Math.min(HMAX, Math.max(1, ob.holdEffektiv()));
    // Zinsfuß nur für den gewählten Punkt — nicht für alle vierzig Haltedauern,
    // das war in der alten Fassung der teuerste Teil der Analyse.
    var gew = kurve[hEff - 1];
    var rGew = irr(gew.flows);
    gew.irr = rGew === null ? null : rGew * 100;
    this._c.a = {
      kurve: kurve, beKW: beKW, beNull: beNull, median: GW.median, eH: GW.eH,
      p25: GW.p25, p75: GW.p75, ueber40: GW.ueber40,
      eEnd: eEnd, eEndR: eEndR, pVorBE: pVorBE * 100, lz: LZ, w: w, wR: wR,
      hEff: hEff, gewaehlt: gew,
      // Die Rendite kommt aus derselben Bisektion wie die Stellschraubentabelle,
      // damit auf einer Seite nicht zwei Zahlen für dieselbe Größe stehen.
      rendite: R, eIrr: R.status === "gefunden" ? R.exakt : null
    };
    return this._c.a;
  };

  // Alles, was die Objektseite braucht — einmal gerechnet, von allen Blöcken gelesen.
  Kennzahlen.prototype.alles = function () {
    if (this._c.alles) return this._c.alles;
    var A = this.analyse();
    this._c.alles = {
      A: A, lz: A.lz, rendite: A.rendite, ohneHebel: this.ohneHebel(),
      entgelt: this.mindestEntgelt(), werterhalt: this.werterhalt(),
      stell: STELLSCHRAUBEN.map(this.kritischerWert, this)
    };
    return this._c.alles;
  };
