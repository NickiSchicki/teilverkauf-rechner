  // ---------- Klasse Portfolio ----------
  // Das Portfolio ist die Aggregation der Objekte. Es hält keine eigenen Annahmen
  // über einzelne Verträge, sondern nur, was für die Gesellschaft gilt: Steuersatz,
  // Gemeinkosten und Zinsen auf den Kassenbestand.

  function Portfolio(objekte, ges) {
    this.objekte = objekte;
    this.G = ges;
    this.taxRate = (KST + (ges.erwKuerzung ? 0 : 3.5 * ges.hebesatz / 100)) / 100;
    this.opexShare = objekte.length ? ges.opex / objekte.length : 0;
    // Der Kontext, den ein Objekt braucht, um sich allein zu rechnen
    this.ctx = { opexShare: this.opexShare, taxRate: this.taxRate,
                 anlage: ges.anlage, kkZins: ges.kkZins };
    this._cache = {};
  }

  // Verläufe aller Objekte bei ihrer jeweils maßgeblichen Haltedauer
  Portfolio.prototype.verlaeufe = function () {
    if (this._cache.v) return this._cache.v;
    this._cache.v = this.objekte.map(function (ob) {
      var v = ob.verlauf(ob.holdEffektiv());
      var r = irr(v.ownerFlows);
      v.ownerCost = r === null ? null : r * 100;   // effektive Jahreskosten des Eigentümers
      return v;
    });
    return this._cache.v;
  };

  Portfolio.prototype.rechnen = function () {
    if (this._cache.r) return this._cache.r;
    var self = this, vs = this.verlaeufe();

    var T = 0, start0 = 0;
    if (vs.length) {
      T = Math.max.apply(null, vs.map(function (v) { return v.ablöseY; }));
      start0 = Math.min.apply(null, vs.map(function (v) { return v.o.start; }));
    }

    // Die Zeitachse beginnt beim frühesten Erwerb, nicht beim Basisjahr — Objekte
    // dürfen davor liegen, dann ist ihr Erwerb Bestand und start0 wird negativ.
    var Y = [];
    for (var y = start0; y <= T; y++) {
      Y.push({ y: y, ne: 0, zins: 0, tilg: 0, pay: 0, afa: 0, opex: 0, akquise: 0,
        vGewinn: 0, proceeds: 0, payoff: 0, invest: 0, loanNew: 0, einlage: 0,
        buchwert: 0, rest: 0, aktiv: 0 });
    }
    function at(y) { return Y[y - start0]; }

    vs.forEach(function (v) {
      var e = at(v.o.start);
      e.invest += v.invest0; e.loanNew += v.loan0;
      e.einlage += v.equity0; e.akquise += v.akquise;
      e.buchwert += v.invest0; e.rest += v.loan0; e.aktiv += 1;
      v.years.forEach(function (r) {
        var t = at(r.y);
        t.ne += r.ne; t.zins += r.zins; t.tilg += r.tilg; t.pay += r.pay; t.afa += r.afa;
        // Bestände am Jahresende: Buchwert nur solange gehalten, Restschuld bis zur Ablösung
        if (r.y < v.exitY) { t.buchwert += r.buchwert; t.aktiv += 1; }
        if (r.y < v.ablöseY) t.rest += r.rest;
      });
      at(v.exitY).vGewinn += v.gewinn;
      at(v.exitY).proceeds += v.proceeds;
      at(v.ablöseY).payoff += v.restAtExit;
    });

    var vortrag = 0, cash = 0, cumProfit = 0, cumEinlage = 0, taxSum = 0, opexSum = 0;
    var flows = [], rows = [];
    for (var i = start0; i <= T; i++) {
      var t = at(i);
      // Die GmbH trägt laufende Kosten von der ersten Anschaffung bis zum letzten Verkauf
      t.opex = vs.length ? self.G.opex : 0;
      opexSum += t.opex;
      // Zinsen auf den Kassenbestand des Vorjahres: Guthaben in Anleihen, Fehlbetrag im Kontokorrent
      t.anlageErtrag = Math.max(0, cash) * self.G.anlage / 100;
      t.kkZins = Math.max(0, -cash) * self.G.kkZins / 100;

      var z = zeile(t, vortrag, self.taxRate);
      vortrag = z._vortrag;
      taxSum += z.tax;
      cumProfit += z.jue;
      cumEinlage += z.einlage;
      cash += z.cashChange;
      z.cash = cash;
      z.ek = cumEinlage + cumProfit;
      z.aktiv = t.aktiv;
      flows.push(-z.einlage);
      rows.push(z);
    }

    var austax = this.G.ausschuetten ? Math.max(0, cash - cumEinlage) * ABGELT / 100 : 0;
    if (flows.length) flows[flows.length - 1] += cash - austax;
    var minCash = 0;
    rows.forEach(function (x) { minCash = Math.min(minCash, x.cash); });
    var r = (vs.length && cumEinlage > 0) ? irr(flows) : null;

    this._cache.r = {
      verlaeufe: vs, rows: rows, T: T, start0: start0, taxRate: this.taxRate * 100,
      cashFinal: cash, austax: austax, payout: cash - austax, taxSum: taxSum,
      opexSum: opexSum, cumEinlage: cumEinlage, ekFinal: cumEinlage + cumProfit,
      minCash: minCash, irr: r === null ? null : r * 100,
      investTotal: summe(vs, "invest0"), loanTotal: summe(vs, "loan0"),
      payoutTotal: summe(vs, "P"), akquiseTotal: summe(vs, "akquise")
    };
    return this._cache.r;
  };

  function summe(liste, feld) {
    return liste.reduce(function (a, x) { return a + x[feld]; }, 0);
  }
