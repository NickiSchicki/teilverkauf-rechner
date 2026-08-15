  // ---------- Kontenrahmen ----------
  // Jede Position wird hier einmal deklariert. Ergebnis vor Steuern, die drei
  // Cashflow-Bereiche und sämtliche Tabellenzeilen werden daraus abgeleitet —
  // nicht getrennt gepflegt. Damit kann eine Position nicht mehr in der einen
  // Sicht auftauchen und in der anderen fehlen; genau daran ist die Rechnung
  // zuvor mehrfach auseinandergelaufen.
  //
  //   feld     Name im Jahresdatensatz
  //   guv      Vorzeichen in der Gewinn- und Verlustrechnung, 0 = nicht ergebniswirksam
  //   cf       Bereich der Kapitalflussrechnung, null = nicht zahlungswirksam
  //   cfVz     Vorzeichen in der Kapitalflussrechnung (voreingestellt wie guv)
  var POSTEN = [
    { feld: "ne",           guv: +1, cf: "operativ",     label: "Nutzungsentgelt",      labelP: "Nutzungsentgelte" },
    { feld: "anlageErtrag", guv: +1, cf: "operativ",     label: "Zinserträge aus Geldanlage" },
    { feld: "afa",          guv: -1, cf: null,           label: "Abschreibungen (AfA)" },
    { feld: "opex",         guv: -1, cf: "operativ",     label: "Anteilige laufende Kosten", labelP: "Sonstige betriebliche Aufwendungen" },
    { feld: "akquise",      guv: -1, cf: "operativ",     label: "Akquisitionskosten" },
    { feld: "zins",         guv: -1, cf: "operativ",     label: "Zinsaufwand Darlehen" },
    { feld: "kkZins",       guv: -1, cf: "operativ",     label: "Zinsaufwand Kontokorrent" },
    { feld: "vGewinn",      guv: +1, cf: null,           label: "Ergebnis Anteilsverkauf", labelP: "Ergebnis Anteilsverkäufe" },
    { feld: "tax",          guv:  0, cf: "operativ", cfVz: -1, label: null },   // eigene Zeile unter dem Ergebnis
    { feld: "proceeds",     guv:  0, cf: "investiv", cfVz: +1, label: null },
    { feld: "invest",       guv:  0, cf: "investiv", cfVz: -1, label: null },
    { feld: "einlage",      guv:  0, cf: "finanzierung", cfVz: +1, label: null },
    { feld: "loanNew",      guv:  0, cf: "finanzierung", cfVz: +1, label: null },
    { feld: "tilg",         guv:  0, cf: "finanzierung", cfVz: -1, label: null },
    { feld: "payoff",       guv:  0, cf: "finanzierung", cfVz: -1, label: null }
  ];

  function vz(p) { return p.cfVz === undefined ? p.guv : p.cfVz; }
  function wert(r, feld) { return r[feld] || 0; }

  // Ergebnis vor Steuern aus dem Kontenrahmen
  function ebtVon(r) {
    var a = 0;
    POSTEN.forEach(function (p) { if (p.guv) a += p.guv * wert(r, p.feld); });
    return a;
  }

  // Ein Cashflow-Bereich aus dem Kontenrahmen
  function cfVon(r, bereich) {
    var a = 0;
    POSTEN.forEach(function (p) { if (p.cf === bereich) a += vz(p) * wert(r, p.feld); });
    return a;
  }

  // Summe aller drei Bereiche — dies ist die Veränderung der Zahlungsmittel.
  // Weil die Kassenrechnung dieselbe Funktion benutzt, kann sie nicht von der
  // ausgewiesenen Gliederung abweichen.
  function cashChangeVon(r) {
    return cfVon(r, "operativ") + cfVon(r, "investiv") + cfVon(r, "finanzierung");
  }

  // Tabellenzeilen der Gewinn- und Verlustrechnung, portfolio = konsolidierte Bezeichnungen
  function guvZeilen(portfolio) {
    var z = POSTEN.filter(function (p) { return p.guv && p.label; }).map(function (p) {
      return { l: (portfolio && p.labelP) || p.label, f: function (r) { return p.guv * wert(r, p.feld); } };
    });
    z.push({ l: "Ergebnis vor Steuern", sum: true, f: function (r) { return r.ebt; } });
    z.push({ l: portfolio ? "Steuern (KSt, Soli, GewSt)" : "Steuern (anteilig)", f: function (r) { return -wert(r, "tax"); } });
    z.push({ l: "Jahresüberschuss", sum: true, f: function (r) { return r.jue; } });
    return z;
  }

  function cfZeilen(mitEinlagen) {
    var z = [
      { l: "Operativer Cashflow", f: function (r) { return cfVon(r, "operativ"); } },
      { l: "Investitionscashflow", f: function (r) { return cfVon(r, "investiv"); } },
      { l: "Finanzierungscashflow", f: function (r) { return cfVon(r, "finanzierung"); } }
    ];
    if (mitEinlagen) z.push({ l: "davon Einlagen", f: function (r) { return wert(r, "einlage"); } });
    z.push({ l: "Veränderung Zahlungsmittel", sum: true, f: function (r) { return r.cashChange; } });
    z.push({ l: "Bestand Zahlungsmittel", f: function (r) { return r.cash; } });
    return z;
  }

  function bilanzZeilen(portfolio) {
    return [
      { l: portfolio ? "Immobilienanteile (Buchwert)" : "Immobilienanteil (Buchwert)", f: function (r) { return r.buchwert; } },
      { l: "Guthaben und Wertpapiere", f: function (r) { return r.cash; } },
      { l: "Summe Aktiva", sum: true, f: function (r) { return r.buchwert + r.cash; } },
      { l: "Eigenkapital", f: function (r) { return r.ek; } },
      { l: "Bankdarlehen", f: function (r) { return r.rest; } },
      { l: "Summe Passiva", sum: true, f: function (r) { return r.ek + r.rest; } }
    ];
  }

  function rechenwerkGruppen(portfolio) {
    return [
      { title: "Gewinn- und Verlustrechnung", rows: guvZeilen(portfolio) },
      { title: "Bilanz (Stichtag 31.12.)", rows: bilanzZeilen(portfolio) },
      { title: "Kapitalflussrechnung", rows: cfZeilen(portfolio) }
    ];
  }

  // Steuer eines Jahres unter Berücksichtigung des Verlustvortrags.
  // Gibt den neuen Vortrag zurück, damit der Aufrufer keinen eigenen Zustand führt.
  function steuer(ebt, vortrag, satz) {
    if (ebt > 0) {
      var genutzt = Math.min(vortrag, ebt);
      return { tax: (ebt - genutzt) * satz, vortrag: vortrag - genutzt };
    }
    return { tax: 0, vortrag: vortrag - ebt };
  }
