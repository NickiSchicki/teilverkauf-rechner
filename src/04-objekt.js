  // ---------- Klasse Objekt ----------
  // Ein Objekt trägt seine Annahmen und leitet daraus alles ab, was es allein
  // betrifft: Preise, Finanzierungsverlauf, Rechenwerk und Zahlungsstrom.
  // Was mehrere Objekte betrifft — Steuersatz, Gemeinkostenanteil — kommt als
  // Kontext von außen und wird nie im Objekt festgehalten.

  function Objekt(daten) {
    this.a = daten;                 // die Annahmen, unverändert
  }

  Objekt.neu = function (name) {
    var o = {};
    Object.keys(OBJ_DEF).forEach(function (k) { o[k] = OBJ_DEF[k]; });
    if (name) o.name = name;
    return new Objekt(o);
  };

  // Eine Kopie mit abgewandelten Annahmen — Grundlage jeder Was-wäre-wenn-Rechnung.
  Objekt.prototype.mit = function (aenderungen) {
    return new Objekt(Object.assign({}, this.a, aenderungen));
  };

  // ---- Preise und Kapitaleinsatz ----
  // Bewusst ohne Zwischenspeicher: Die Regler schreiben direkt in a, ein Cache
  // würde veraltete Werte liefern. Die Rechnung selbst ist billig.
  Objekt.prototype.preise = function () {
    var o = this.a, s = o.share / 100;
    // Der Ankaufsabschlag mindert nur den Kaufpreis. Der spätere Anteil am
    // Verkaufserlös richtet sich weiter nach der Beteiligungsquote — genau darin
    // liegt der Renditehebel des Abschlags.
    var vollpreis = s * o.v0;
    var P = vollpreis * (1 - (o.abschlag || 0) / 100);
    // Grunderwerbsteuer, Notar und Maklercourtage sind Anschaffungsnebenkosten und
    // werden aktiviert. Die Courtage trägt die Gesellschaft in voller Höhe — bewusst
    // die ungünstigere Annahme, statt sie mit dem Verkäufer zu teilen.
    var nebenSatz = o.grest / 100 + o.notar / 100 + (o.makler || 0) / 100;
    var invest0 = P * (1 + nebenSatz);
    var loan0 = P * o.ltv / 100;
    // Akquisitionskosten sind Vertriebsaufwand, nicht dem Erwerb einzeln zurechenbar:
    // Sie werden nicht aktiviert, sondern im Erwerbsjahr aufwandswirksam. Bezahlt
    // werden müssen sie trotzdem, deshalb erhöhen sie den Eigenkapitalbedarf.
    var akquise = Math.max(0, o.akquise || 0);
    return {
      vollpreis: vollpreis, P: P, nebenkosten: invest0 - P, invest0: invest0,
      loan0: loan0, akquise: akquise, equity0: invest0 - loan0 + akquise,
      annuity: loan0 * (o.zins + o.tilg) / 100
    };
  };

  // ---- Laufzeiten ----
  // Drei Zeiträume, die auseinanderfallen können:
  //   kredit  — die Bindung des Darlehens, an der sich der Vertrag ausrichtet
  //   verkauf — wann der Anteil tatsächlich veräußert wird
  //   bindung — wie lange das Eigenkapital gebunden bleibt
  // Endet der Vertrag vor dem Kredit, liegt der Erlös bis zur Ablösung in der
  // Geldanlage: Das Kapital arbeitet dann zum Anlagezins statt im Objekt.
  Objekt.prototype.holdEffektiv = function () {
    return this.a.holdAuto ? this.exitGewichte().median : this.a.hold;
  };

  Objekt.prototype.darlehensJahre = function (hold) {
    var h = hold === undefined ? this.a.hold : hold;
    return this.a.weiterfuehren ? Math.max(h, this.a.zinsbindung) : h;
  };

  Objekt.prototype.exitGewichte = function () { return exitGewichte(this.a); };

  // Über welche Zeit die Rendite gerechnet wird. Ohne Sterbetafel-Kopplung ist der
  // Verkaufszeitpunkt eine feste Annahme, mit ihr eine Verteilung. Beides führt auf
  // dieselbe gewichtete Form — im ersten Fall mit einem einzigen Gewicht von 1.
  Objekt.prototype.renditeGewichte = function () {
    if (!this.a.holdAuto) {
      var h = Math.min(HMAX, Math.max(1, Math.round(this.a.hold)));
      var w = [];
      for (var k = 0; k <= HMAX; k++) w.push(k === h ? 1 : 0);
      return w;
    }
    return this.exitGewichte().w;
  };

  Objekt.prototype.laufzeiten = function () {
    var o = this.a, w = this.renditeGewichte(), GW = this.exitGewichte();
    var verkauf = 0, bindung = 0, nachlauf = 0, pNachlauf = 0;
    for (var k = 1; k <= HMAX; k++) {
      if (!w[k]) continue;
      var ende = this.darlehensJahre(k);
      verkauf += w[k] * k;
      bindung += w[k] * ende;
      nachlauf += w[k] * (ende - k);
      if (ende > k) pNachlauf += w[k];
    }
    return { kredit: o.zinsbindung, verkauf: verkauf, bindung: bindung,
      nachlauf: nachlauf, pNachlauf: pNachlauf * 100,
      auto: !!o.holdAuto, median: GW.median, eH: GW.eH, gesetzt: o.hold };
  };

  // ---- Verlauf über die Jahre ----
  // hold ist ausdrücklich ein Parameter: Die Kurven der Analyse rechnen dasselbe
  // Objekt über alle möglichen Haltedauern.
  Objekt.prototype.verlauf = function (hold) {
    var o = this.a, pr = this.preise();
    var h = hold === undefined ? o.hold : hold;
    var ende = this.darlehensJahre(h);
    var s = o.share / 100, g = o.growth / 100;
    var afaBase = pr.invest0 * o.gebAnteil / 100;
    var afaYear = afaBase * o.afaSatz / 100;

    var bal = pr.loan0, cumAfa = 0, years = [], ownerFlows = [pr.P];
    for (var k = 1; k <= ende; k++) {
      var imBestand = k <= h;
      var ne = imBestand ? pr.P * (o.ne / 100) * Math.pow(1 + o.esc / 100, k - 1) : 0;
      var zins = bal * o.zins / 100;
      var pay = Math.min(pr.annuity, bal + zins);
      var tilg = pay - zins;
      bal = bal + zins - pay;
      if (bal < 0.005) bal = 0;
      var afa = imBestand ? Math.min(afaYear, Math.max(0, afaBase - cumAfa)) : 0;
      cumAfa += afa;
      years.push({ y: o.start + k, ne: ne, zins: zins, tilg: tilg, pay: pay, afa: afa,
        buchwert: pr.invest0 - cumAfa, rest: bal, imBestand: imBestand });
      if (imBestand) ownerFlows.push(-ne);
    }

    // Marktentwicklung und Zustandsverfall wirken multiplikativ auf den Verkaufspreis
    var VT = o.v0 * Math.pow(1 + g, h) * Math.pow(1 - o.verfall / 100, h);
    var B = Math.max(s * VT, (o.min / 100) * pr.P);
    var DE = (o.de / 100) * VT;
    var vkTotal = (o.vkKosten / 100) * VT;
    var vkBuyer = s * vkTotal;
    var buchwert = pr.invest0 - cumAfa;
    ownerFlows[h] -= (B + DE);

    var exitY = o.start + h, ablöseY = o.start + ende;
    var restBeiExit = 0;
    years.forEach(function (r) { if (r.y === exitY) restBeiExit = r.rest; });

    return {
      // o ist die Rechnungsgrundlage dieses Verlaufs, nicht die rohen Annahmen:
      // Bei aktiver Sterbetafel-Kopplung steht hier die gerechnete Haltedauer,
      // nicht der Reglerwert. Die Annahmen selbst stehen unter obj.a.
      o: h === o.hold ? o : Object.assign({}, o, { hold: h }),
      obj: this, hold: h, years: years, exitY: exitY, ablöseY: ablöseY,
      darlehensJahre: ende, restBeiExit: restBeiExit, restAtExit: bal,
      VT: VT, B: B, DE: DE, vkTotal: vkTotal, vkBuyer: vkBuyer,
      proceeds: B + DE - vkBuyer, buchwert: buchwert, cumAfa: cumAfa,
      gewinn: (B + DE - vkBuyer) - buchwert,
      // direkt zurechenbares Ergebnis, vor Gemeinkosten und Steuern
      beitrag: years.reduce(function (a, r) { return a + r.ne - r.zins - r.afa; }, 0) + (B + DE - vkBuyer) - buchwert,
      ownerFlows: ownerFlows,
      ownerGets: Math.max(0, VT - B - DE - (vkTotal - vkBuyer)),
      P: pr.P, vollpreis: pr.vollpreis, invest0: pr.invest0, loan0: pr.loan0,
      equity0: pr.equity0, akquise: pr.akquise, annuity: pr.annuity
    };
  };

  // Effektive Jahreskosten des Eigentümers — teuer, deshalb nur auf Anforderung
  Objekt.prototype.ownerCost = function (hold) {
    var r = irr(this.verlauf(hold).ownerFlows);
    return r === null ? null : r * 100;
  };

  // ---- Rechenwerk des einzelnen Projekts ----
  // ctx: { opexShare, taxRate, anlage, kkZins } — alles, was von außen kommt.
  Objekt.prototype.rechenwerk = function (ctx, hold) {
    var v = this.verlauf(hold);
    var vortrag = v.akquise, cash = 0, cumProfit = -v.akquise;
    var taxSum = 0, neSum = 0, opexSum = 0, dsSum = 0;

    // Erwerbsjahr: Anschaffung, Darlehen und Einlage. Der Akquiseaufwand fällt hier
    // an und erzeugt einen Verlust, der vorgetragen wird.
    var rows = [zeile({
      y: v.o.start, akquise: v.akquise, invest: v.invest0, loanNew: v.loan0,
      einlage: v.equity0, buchwert: v.invest0, cash: 0, ek: v.equity0 - v.akquise,
      rest: v.loan0, erwerb: true
    }, 0, ctx.taxRate)];

    v.years.forEach(function (r) {
      var isExit = r.y === v.exitY, isAbloese = r.y === v.ablöseY;
      neSum += r.ne; opexSum += ctx.opexShare; dsSum += r.pay;
      var roh = {
        y: r.y, ne: r.ne, afa: r.afa, zins: r.zins, opex: ctx.opexShare,
        anlageErtrag: Math.max(0, cash) * ctx.anlage / 100,
        kkZins: Math.max(0, -cash) * ctx.kkZins / 100,
        vGewinn: isExit ? v.gewinn : 0,
        proceeds: isExit ? v.proceeds : 0,
        payoff: isAbloese ? v.restAtExit : 0,
        tilg: r.tilg, pay: r.pay,
        buchwert: r.y >= v.exitY ? 0 : r.buchwert,
        rest: r.y >= v.ablöseY ? 0 : r.rest,
        exit: isExit, abloese: isAbloese
      };
      var z = zeile(roh, vortrag, ctx.taxRate);
      vortrag = z._vortrag;
      taxSum += z.tax;
      cumProfit += z.jue;
      cash += z.cashChange;
      z.cash = cash;
      z.ek = v.equity0 + cumProfit;
      rows.push(z);
    });

    return {
      v: v, rows: rows, cashFinal: cash, taxSum: taxSum, neSum: neSum,
      opexSum: opexSum, dsSum: dsSum, gewinn: cash - v.equity0
    };
  };

  // Baut eine Jahreszeile: Ergebnis, Steuer und Zahlungswirkung entstehen
  // ausschließlich aus dem Kontenrahmen.
  function zeile(roh, vortrag, taxRate) {
    var r = Object.assign({ ne: 0, afa: 0, zins: 0, opex: 0, akquise: 0, anlageErtrag: 0,
      kkZins: 0, vGewinn: 0, proceeds: 0, payoff: 0, invest: 0, loanNew: 0,
      einlage: 0, tilg: 0, pay: 0, tax: 0 }, roh);
    r.ebt = ebtVon(r);
    var st = steuer(r.ebt, vortrag, taxRate);
    r.tax = st.tax;
    r._vortrag = st.vortrag;
    r.jue = r.ebt - r.tax;
    r.cashChange = cashChangeVon(r);
    if (r.cash === undefined) r.cash = 0;
    return r;
  }

  // Rendite dieses einen Szenarios. Bewusst getrennt vom Rechenwerk, weil der
  // Zinsfuß teuer ist und die Kapitalwertkurven ihn nicht brauchen.
  Objekt.prototype.projektRendite = function (ctx, hold) {
    var r = irr(this.ekStrom(ctx, hold).flows);
    return r === null ? null : r * 100;
  };

  // ---- Zahlungsstrom des Eigenkapitals ----
  // Der Rückfluss steht erst zur Verfügung, wenn auch das Darlehen abgelöst ist.
  // Läuft es nach dem Verkauf bis zum Ende der Zinsbindung weiter, ist das später
  // als der Verkaufszeitpunkt — sonst würde die Rendite zu gut gerechnet.
  Objekt.prototype.ekStrom = function (ctx, hold) {
    var R = this.rechenwerk(ctx, hold);
    var ende = R.v.darlehensJahre;
    var f = [-R.v.equity0];
    for (var k = 1; k <= ende; k++) f.push(0);
    f[ende] += R.cashFinal;
    return { flows: f, cashFinal: R.cashFinal, equity0: R.v.equity0, ende: ende, rechenwerk: R };
  };
