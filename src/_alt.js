(function () {
  "use strict";

  var eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  function fEur(v) { var n = v < 0 ? -Math.round(-v) : Math.round(v); return eur.format(n === 0 ? 0 : n); }
  function fPct(v, d) {
    if (v === null || v === undefined || !isFinite(v)) return "–";
    d = d === undefined ? 1 : d;
    return v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";
  }
  function csvNum(v) { return (Math.round(v * 100) / 100).toFixed(2).replace(".", ","); }

  // Alle Zeitangaben laufen intern relativ zum Basisjahr; angezeigt werden Kalenderjahre.
  // Negative Werte sind zulässig — sie bezeichnen Objekte, die schon im Bestand sind.
  function fJahr(j) { return String(G.basisjahr + Math.round(j)); }
  // Ohne Zwischenausschüttungen realisiert sich die gesamte Rendite beim Verkauf:
  // Das Eigenkapital geht einmal hinein und kommt einmal zurück. Die Gesamtrendite
  // über die Kapitalbindung ist deshalb die anschaulichere Größe; der Jahreszins ist
  // nur ihre Verteilung auf die Zeit.
  function gesamtRendite(pa, jahre) { return (Math.pow(1 + pa / 100, jahre) - 1) * 100; }

  // Jahresangaben: ganze Zahlen ohne Nachkomma, gemittelte mit einer Stelle
  function fJahre(v) {
    if (v === null || v === undefined || !isFinite(v)) return "–";
    var ganz = Math.abs(v - Math.round(v)) < 0.05;
    return v.toLocaleString("de-DE", { minimumFractionDigits: ganz ? 0 : 1, maximumFractionDigits: ganz ? 0 : 1 }) +
      (ganz && Math.round(v) === 1 ? " Jahr" : " Jahre");
  }

  var KST = 15.825, ABGELT = 26.375;

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

  function neuesObjekt(name) {
    var o = {};
    Object.keys(OBJ_DEF).forEach(function (k) { o[k] = OBJ_DEF[k]; });
    if (name) o.name = name;
    return o;
  }

  // Beispielobjekte mit generischen Werten — keine echten Vertragsdaten
  var OBJ = [
    Object.assign(neuesObjekt("Beispielobjekt A"), { v0: 500000, share: 50, alter: 75, haus: "Paar" }),
    Object.assign(neuesObjekt("Beispielobjekt B"), { v0: 400000, share: 40, start: 2, hold: 15, alter: 80, haus: "w" })
  ];

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
  function exitGewichte(o) {
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
    return { w: w, median: median, eH: eH };
  }

  // Die Haltedauer, mit der tatsächlich gerechnet wird
  function holdEffektiv(o) {
    return o.holdAuto ? exitGewichte(o).median : o.hold;
  }

  // Über welche Zeit die Rendite gerechnet wird. Ohne Sterbetafel-Kopplung ist der
  // Verkaufszeitpunkt eine feste Annahme, mit ihr eine Verteilung. Beides führt auf
  // dieselbe gewichtete Form — im ersten Fall mit einem einzigen Gewicht von 1.
  // Dadurch wirkt der Schalter auch auf die Rendite und nicht nur auf die Bilanz.
  function renditeGewichte(o) {
    if (o.holdAuto) return exitGewichte(o).w;
    var h = Math.min(HMAX, Math.max(1, Math.round(o.hold)));
    var w = [];
    for (var k = 0; k <= HMAX; k++) w.push(k === h ? 1 : 0);
    return w;
  }

  // Drei Laufzeiten, die auseinanderfallen können:
  //   kredit   — die Bindung des Darlehens, an der sich der Vertrag ausrichtet
  //   verkauf  — wann der Anteil tatsächlich veräußert wird
  //   bindung  — wie lange das Eigenkapital gebunden bleibt
  // Endet der Vertrag vor dem Kredit, liegt der Erlös bis zur Ablösung in der
  // Geldanlage: Das Kapital arbeitet dann zum Anlagezins statt im Objekt.
  function laufzeiten(o) {
    var w = renditeGewichte(o), GW = exitGewichte(o);
    var verkauf = 0, bindung = 0, nachlauf = 0, pNachlauf = 0;
    for (var k = 1; k <= HMAX; k++) {
      if (!w[k]) continue;
      var ende = o.weiterfuehren ? Math.max(k, o.zinsbindung) : k;
      verkauf += w[k] * k;
      bindung += w[k] * ende;
      nachlauf += w[k] * (ende - k);
      if (ende > k) pNachlauf += w[k];
    }
    return { kredit: o.zinsbindung, verkauf: verkauf, bindung: bindung,
      nachlauf: nachlauf, pNachlauf: pNachlauf * 100,
      auto: !!o.holdAuto, median: GW.median, eH: GW.eH, gesetzt: o.hold };
  }

  // Renditehürde: was das eingesetzte Eigenkapital mindestens bringen muss.
  // Bewusst unabhängig vom Sollzins — Eigenkapital haftet und ist lange gebunden,
  // der Maßstab ist die Alternativanlage, nicht die Bankkondition.
  function zielZins(o) { return G.mindestRendite; }

  // Gesellschaftsebene — gilt für alle Objekte
  var GES_GROUPS = [
    { title: "Gesellschaft", dot: "s3", items: [
      { id: "basisjahr", label: "Basisjahr", min: 2015, max: 2040, step: 1, fmt: function (v) { return String(v); }, note: "Bezugsjahr der Zeitachse; Objekte dürfen davor liegen" },
      { id: "opex", label: "Laufende Kosten", min: 0, max: 20000, step: 250, fmt: function (v) { return fEur(v) + " / Jahr"; }, note: "je Geschäftsjahr, unabhängig von der Objektzahl" },
      { id: "hebesatz", label: "Gewerbesteuer-Hebesatz", min: 200, max: 600, step: 10, fmt: function (v) { return fPct(v, 0); }, note: "nur ohne erweiterte Kürzung relevant" },
      { id: "anlage", label: "Anlagezins", min: 0, max: 6, step: 0.1, fmt: function (v) { return fPct(v, 2) + " p.a."; }, note: "Bundeswertpapiere für geparkte Mittel" },
      { id: "kkZins", label: "Kontokorrentzins", min: 0, max: 12, step: 0.25, fmt: function (v) { return fPct(v, 2) + " p.a."; }, note: "bei negativem Konto der Gesellschaft" },
      { id: "mindestRendite", label: "Mindestrendite", min: 0, max: 12, step: 0.25, fmt: function (v) { return fPct(v, 2) + " p.a."; }, note: "auf das Eigenkapital — Maßstab für Break-even und Ankaufsfilter" }
    ], tax: true }
  ];

  // Objektebene — jedes Objekt trägt diese Annahmen selbst
  var OBJ_GROUPS = [
    { title: "Immobilie & Haushalt", items: [
      { id: "name", label: "Bezeichnung", text: true },
      { id: "v0", label: "Wert bei Erwerb", min: 50000, max: 2000000, step: 10000, fmt: fEur },
      { id: "share", label: "Verkaufter Anteil", min: 5, max: 90, step: 1, fmt: function (v) { return fPct(v, 0); } },
      { id: "alter", label: "Alter im Haushalt", min: 55, max: 95, step: 1, fmt: function (v) { return v + " Jahre"; }, note: "bei Paaren die jüngere Person" },
      { id: "haus", label: "Haushalt", choices: ["m", "w", "Paar"], note: "bei Paaren zählt die zuletzt lebende Person" },
      { id: "pflege", label: "Auszugswahrscheinlichkeit", min: 0, max: 6, step: 0.5, fmt: function (v) { return fPct(v, 1) + " p.a."; }, note: "Pflegeheim oder Auszug, zusätzlich zur Sterblichkeit" },
      { id: "growth", label: "Wertentwicklung", min: -2, max: 5, step: 0.25, fmt: function (v) { return fPct(v, 2) + " p.a."; }, note: "Marktentwicklung dieser Lage" },
      { id: "verfall", label: "Instandhaltungsverfall", min: 0, max: 3, step: 0.25, fmt: function (v) { return v === 0 ? "keiner" : "−" + fPct(v, 2) + " p.a."; }, note: "Wertverlust durch unterlassene Instandhaltung" },
      { id: "abschlag", label: "Ankaufsabschlag", min: 0, max: 40, step: 0.5, fmt: function (v) { return v === 0 ? "keiner" : "−" + fPct(v, 1); }, note: "unter dem anteiligen Verkehrswert gekaufter Anteil" }
    ] },
    { title: "Vertrag", dot: "s1", items: [
      { id: "ne", label: "Nutzungsentgelt", min: 1, max: 9, step: 0.05, fmt: function (v) { return fPct(v, 2) + " p.a."; }, note: "auf den Auszahlungsbetrag, fest" },
      { id: "esc", label: "Jährliche Anpassung", min: 0, max: 4, step: 0.25, fmt: function (v) { return v === 0 ? "keine" : fPct(v, 2) + " p.a."; }, note: "0 % = feste Rate bis zum Verkauf" },
      { id: "start", label: "Erwerbsjahr", min: -25, max: 20, step: 1, fmt: function (v) {
        return fJahr(v) + (v === 0 ? " (Basisjahr)" : (v < 0 ? " (Bestand, vor " + -v + (v === -1 ? " Jahr)" : " Jahren)") : " (in " + v + (v === 1 ? " Jahr)" : " Jahren)")));
      } },
      { id: "holdAuto", label: "Haltedauer aus Sterbetafel", bool: true, note: "rechnet über die Exit-Verteilung statt über eine feste Annahme" },
      { id: "hold", label: "Haltedauer", min: 1, max: 40, step: 1, fmt: function (v) { return v + " Jahre"; }, note: "angenommener Verkaufszeitpunkt, wirkt nur ohne Sterbetafel-Kopplung" },
      { id: "de", label: "Durchführungsentgelt", min: 0, max: 8, step: 0.25, fmt: function (v) { return fPct(v, 2); }, note: "vom Gesamterlös beim Verkauf" },
      { id: "min", label: "Mindesterlös", min: 0, max: 140, step: 1, fmt: function (v) { return v === 0 ? "keiner" : fPct(v, 0); }, note: "garantierter Rückfluss in % der Auszahlung" },
      { id: "vkKosten", label: "Verkaufskosten beim Exit", min: 0, max: 8, step: 0.25, fmt: function (v) { return fPct(v, 2); }, note: "Makler etc., anteilig getragen" }
    ] },
    { title: "Ankauf & Finanzierung", dot: "s2", items: [
      { id: "grest", label: "Grunderwerbsteuer", min: 3.5, max: 6.5, step: 0.5, fmt: function (v) { return fPct(v, 1); }, note: "je Bundesland verschieden" },
      { id: "notar", label: "Notar & Grundbuch", min: 0, max: 3, step: 0.25, fmt: function (v) { return fPct(v, 2); } },
      { id: "akquise", label: "Akquisitionskosten", min: 0, max: 40000, step: 500, fmt: function (v) { return v === 0 ? "keine" : fEur(v); }, note: "Werbung und Vertrieb je Abschluss, sofort abzugsfähiger Aufwand" },
      { id: "makler", label: "Maklercourtage", min: 0, max: 8, step: 0.595, fmt: function (v) { return v === 0 ? "keine" : fPct(v, 2); }, note: "volle Provision, von der Gesellschaft allein getragen — 7,14 % sind 6 % zzgl. Umsatzsteuer" },
      { id: "ltv", label: "Beleihung", min: 0, max: 95, step: 5, fmt: function (v) { return fPct(v, 0); }, note: "Darlehen in % des Anteilskaufpreises" },
      { id: "zins", label: "Sollzins", min: 1, max: 9, step: 0.05, fmt: function (v) { return fPct(v, 2) + " p.a."; } },
      { id: "tilg", label: "Anfangstilgung", min: 0, max: 5, step: 0.25, fmt: function (v) { return fPct(v, 2) + " p.a."; }, note: "0 % = endfälliges Darlehen" },
      { id: "zinsbindung", label: "Zinsbindung", min: 5, max: 30, step: 1, fmt: function (v) { return v + " Jahre"; }, note: "Vertragslaufzeit — vorher keine Ablösung ohne Entschädigung" },
      { id: "weiterfuehren", label: "Bei Verkauf weiterführen", bool: true, note: "Darlehen läuft bis Ende der Vertragslaufzeit, der Erlös wird bis dahin angelegt" }
    ] },
    { title: "Steuerliche Angaben", items: [
      { id: "afaSatz", label: "AfA-Satz", min: 1, max: 4, step: 0.5, fmt: function (v) { return fPct(v, 1) + " p.a."; }, note: "2 % Standard · 2,5 % vor 1925 · 3 % Neubau" },
      { id: "gebAnteil", label: "Gebäudeanteil", min: 40, max: 90, step: 5, fmt: function (v) { return fPct(v, 0); }, note: "AfA-Basis, Rest ist Grund und Boden" }
    ] }
  ];

  var fmtOf = {};

  // Baut eine Reglergruppe. quelle ist das Objekt, dessen Werte bearbeitet werden.
  // Wird das Basisjahr verstellt, behalten die Objekte ihr Kalenderjahr: ein Objekt,
  // das 2020 erworben wurde, bleibt 2020. Der Regler benennt die Zeitachse um, er
  // verschiebt sie nicht — deshalb werden die Erwerbsjahre gegenläufig nachgeführt.
  var basisAlt = G.basisjahr;
  function gesGeaendert() {
    if (G.basisjahr !== basisAlt) {
      var d = G.basisjahr - basisAlt;
      OBJ.forEach(function (o) { o.start = Math.max(-25, Math.min(20, o.start - d)); });
      var pO = document.getElementById("panelObjekt");
      if (pO) pO.dataset.idx = "";
    }
    basisAlt = G.basisjahr;
    refresh();
  }

  function baueGruppen(host, gruppen, quelle, praefix, nachAenderung) {
    host.innerHTML = "";
    gruppen.forEach(function (g) {
      var card = document.createElement("div");
      card.className = "card";
      var kopf = document.createElement("div");
      kopf.className = "grp-title";
      if (g.dot) { var d = document.createElement("span"); d.className = "dot " + g.dot; kopf.appendChild(d); }
      kopf.appendChild(document.createTextNode(g.title));
      card.appendChild(kopf);

      g.items.forEach(function (it) {
        if (praefix === "g") fmtOf[it.id] = it.fmt;
        var ctl = document.createElement("div");
        ctl.className = "ctl";

        if (it.bool) {
          var lb = document.createElement("label");
          lb.className = "check";
          lb.style.marginTop = "0";
          var cb = document.createElement("input");
          cb.type = "checkbox"; cb.checked = !!quelle[it.id];
          cb.addEventListener("change", function () { quelle[it.id] = cb.checked; nachAenderung(); });
          lb.appendChild(cb);
          lb.appendChild(document.createTextNode(it.label));
          ctl.appendChild(lb);
          if (it.note) { var n0 = document.createElement("div"); n0.className = "ctl-note"; n0.style.marginLeft = "22px"; n0.textContent = it.note; ctl.appendChild(n0); }
          card.appendChild(ctl);
          return;
        }

        var head = document.createElement("div");
        head.className = "ctl-head";
        var lab = document.createElement("label");
        lab.htmlFor = praefix + "_" + it.id;
        lab.textContent = it.label;
        head.appendChild(lab);
        if (!it.text && !it.choices) {
          var val = document.createElement("span");
          val.className = "ctl-val";
          val.id = "val" + praefix + "_" + it.id;
          val.textContent = it.fmt(quelle[it.id]);
          head.appendChild(val);
        }
        ctl.appendChild(head);

        if (it.text) {
          var tin = document.createElement("input");
          tin.type = "text"; tin.id = praefix + "_" + it.id;
          tin.className = "textfeld";
          tin.value = quelle[it.id];
          tin.addEventListener("input", function () { quelle[it.id] = tin.value; nachAenderung(true); });
          ctl.appendChild(tin);
        } else if (it.choices) {
          var seg = document.createElement("div");
          seg.className = "seg";
          it.choices.forEach(function (c) {
            var b = document.createElement("button");
            b.type = "button";
            b.textContent = c;
            b.setAttribute("aria-pressed", String(quelle[it.id] === c));
            b.addEventListener("click", function () {
              quelle[it.id] = c;
              [].forEach.call(seg.children, function (x) { x.setAttribute("aria-pressed", String(x.textContent === c)); });
              nachAenderung();
            });
            seg.appendChild(b);
          });
          ctl.appendChild(seg);
        } else {
          var inp = document.createElement("input");
          inp.type = "range"; inp.id = praefix + "_" + it.id;
          inp.min = it.min; inp.max = it.max; inp.step = it.step; inp.value = quelle[it.id];
          inp.addEventListener("input", function () {
            quelle[it.id] = parseFloat(inp.value);
            var v = document.getElementById("val" + praefix + "_" + it.id);
            if (v) v.textContent = it.fmt(quelle[it.id]);
            nachAenderung();
          });
          ctl.appendChild(inp);
        }
        if (it.note) { var n = document.createElement("div"); n.className = "ctl-note"; n.textContent = it.note; ctl.appendChild(n); }
        card.appendChild(ctl);
      });

      if (g.tax) {
        [["erwKuerzung", "Erweiterte Kürzung (§ 9 Nr. 1 S. 2 GewStG)"], ["ausschuetten", "Abgeltungsteuer auf die Schlussentnahme"]].forEach(function (pair) {
          var lb2 = document.createElement("label");
          lb2.className = "check";
          var cb2 = document.createElement("input");
          cb2.type = "checkbox"; cb2.checked = G[pair[0]];
          cb2.addEventListener("change", function () { G[pair[0]] = cb2.checked; nachAenderung(); });
          lb2.appendChild(cb2);
          lb2.appendChild(document.createTextNode(pair[1]));
          card.appendChild(lb2);
        });
        var t1 = document.createElement("div");
        t1.className = "derived";
        t1.innerHTML = '<span>Steuersatz</span><b id="taxRateOut">–</b>';
        card.appendChild(t1);
        var t2 = document.createElement("div");
        t2.className = "derived tight";
        t2.innerHTML = '<span>Investition gesamt</span><b id="investOut">–</b>';
        card.appendChild(t2);
        var t3 = document.createElement("div");
        t3.className = "derived tight";
        t3.innerHTML = '<span>Einlagen gesamt</span><b id="equityOut">–</b>';
        card.appendChild(t3);
      }
      host.appendChild(card);
    });
  }

  function irr(cfs) {
    function npv(r) { var a = 0; for (var i = 0; i < cfs.length; i++) a += cfs[i] / Math.pow(1 + r, i); return a; }
    var lo = -0.95, hi = 5, flo = npv(lo), fhi = npv(hi);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
    for (var k = 0; k < 60; k++) { // 2^-60 liegt weit jenseits der Anzeigegenauigkeit
      var mid = (lo + hi) / 2, fm = npv(mid);
      if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  // Zahlungsströme eines einzelnen Objekts, auf absolute Portfoliojahre bezogen
  // schnell = true überspringt den internen Zinsfuß; er kostet den Großteil der Rechenzeit
  // und wird beim Aufbau der Kurven nicht gebraucht.
  function buildObject(o, schnell) {
    var s = o.share / 100, g = o.growth / 100;
    // Der Ankaufsabschlag mindert nur den Kaufpreis. Der spätere Anteil am
    // Verkaufserlös richtet sich weiter nach der Beteiligungsquote — genau darin
    // liegt der Renditehebel des Abschlags.
    var vollpreis = s * o.v0;
    var P = vollpreis * (1 - (o.abschlag || 0) / 100);
    // Die Maklercourtage wird hier in voller Höhe von der Gesellschaft getragen —
    // bewusst die ungünstigere Annahme, statt sie mit dem Verkäufer zu teilen.
    // Wie Grunderwerbsteuer und Notar ist sie Anschaffungsnebenkosten und wird aktiviert.
    var nebenSatz = o.grest / 100 + o.notar / 100 + (o.makler || 0) / 100;
    var invest0 = P * (1 + nebenSatz);
    var loan0 = P * o.ltv / 100;
    // Akquisitionskosten sind Vertriebsaufwand, nicht dem Erwerb einzeln zurechenbar:
    // Sie werden nicht aktiviert, sondern im Erwerbsjahr aufwandswirksam. Bezahlt
    // werden müssen sie trotzdem, deshalb erhöhen sie den Eigenkapitalbedarf.
    var akquise = Math.max(0, o.akquise || 0);
    var equity0 = invest0 - loan0 + akquise;
    var annuity = loan0 * (o.zins + o.tilg) / 100;
    var afaBase = invest0 * o.gebAnteil / 100;
    var afaYear = afaBase * o.afaSatz / 100;

    // Bei Verkauf vor Ende der Zinsbindung kann das Darlehen nicht entschädigungsfrei
    // abgelöst werden — es läuft weiter, während der Erlös verzinst angelegt wird.
    var darlehensJahre = o.weiterfuehren ? Math.max(o.hold, o.zinsbindung) : o.hold;

    var bal = loan0, cumAfa = 0;
    var years = [];
    var ownerFlows = [P];
    for (var k = 1; k <= darlehensJahre; k++) {
      var imBestand = k <= o.hold;
      var ne = imBestand ? P * (o.ne / 100) * Math.pow(1 + o.esc / 100, k - 1) : 0;
      var zins = bal * o.zins / 100;
      var pay = Math.min(annuity, bal + zins);
      var tilg = pay - zins;
      bal = bal + zins - pay;
      if (bal < 0.005) bal = 0;
      var afa = imBestand ? Math.min(afaYear, Math.max(0, afaBase - cumAfa)) : 0;
      cumAfa += afa;
      years.push({ y: o.start + k, ne: ne, zins: zins, tilg: tilg, pay: pay, afa: afa,
        buchwert: invest0 - cumAfa, rest: bal, imBestand: imBestand });
      if (imBestand) ownerFlows.push(-ne);
    }
    // Marktentwicklung und Zustandsverfall wirken multiplikativ auf den Verkaufspreis
    var VT = o.v0 * Math.pow(1 + g, o.hold) * Math.pow(1 - o.verfall / 100, o.hold);
    var B = Math.max(s * VT, (o.min / 100) * P);
    var DE = (o.de / 100) * VT;
    var vkTotal = (o.vkKosten / 100) * VT;
    var vkBuyer = s * vkTotal;
    var proceeds = B + DE - vkBuyer;
    var buchwert = invest0 - cumAfa;
    ownerFlows[o.hold] -= (B + DE);
    var oc = schnell ? null : irr(ownerFlows);

    var exitY = o.start + o.hold;
    var ablöseY = o.start + darlehensJahre;
    var restBeiExit = 0;
    years.forEach(function (r) { if (r.y === exitY) restBeiExit = r.rest; });

    return {
      o: o, P: P, vollpreis: vollpreis, invest0: invest0, loan0: loan0, equity0: equity0, akquise: akquise, annuity: annuity,
      years: years, exitY: exitY, ablöseY: ablöseY, darlehensJahre: darlehensJahre,
      restBeiExit: restBeiExit, VT: VT, B: B, DE: DE,
      vkTotal: vkTotal, vkBuyer: vkBuyer, proceeds: proceeds,
      buchwert: buchwert, restAtExit: bal, cumAfa: cumAfa,
      gewinn: proceeds - buchwert,
      ownerCost: oc === null ? null : oc * 100,
      ownerGets: Math.max(0, VT - B - DE - (vkTotal - vkBuyer))
    };
  }

  function portfolio() {
    // Die Haltedauer kommt je nach Schalter aus der Sterbetafel; OBJ bleibt unberührt
    var objs = OBJ.map(function (o) {
      return buildObject(Object.assign({}, o, { hold: holdEffektiv(o) }));
    });
    // direkt zurechenbares Ergebnis je Projekt, vor Gemeinkosten und Steuern
    objs.forEach(function (x) {
      x.beitrag = x.years.reduce(function (a, r) { return a + r.ne - r.zins - r.afa; }, 0) + x.gewinn;
    });
    var T = 0;
    objs.forEach(function (x) { T = Math.max(T, x.ablöseY); });
    var start0 = objs.length ? Math.min.apply(null, objs.map(function (x) { return x.o.start; })) : 0;

    var gewst = G.erwKuerzung ? 0 : 3.5 * G.hebesatz / 100;
    var taxRate = (KST + gewst) / 100;

    // Die Zeitachse beginnt beim frühesten Erwerb, nicht beim Basisjahr — Objekte
    // dürfen davor liegen, dann ist ihr Erwerb Bestand und start0 wird negativ.
    var Y = [];
    for (var y = start0; y <= T; y++) {
      Y.push({ y: y, ne: 0, zins: 0, tilg: 0, pay: 0, afa: 0, opex: 0, akquise: 0, vGewinn: 0, proceeds: 0, payoff: 0, invest: 0, loanNew: 0, einlage: 0, buchwert: 0, rest: 0, aktiv: 0 });
    }
    function at(y) { return Y[y - start0]; }

    objs.forEach(function (x) {
      at(x.o.start).invest += x.invest0;
      at(x.o.start).loanNew += x.loan0;
      at(x.o.start).einlage += x.equity0;
      at(x.o.start).akquise += x.akquise;
      x.years.forEach(function (r) {
        var t = at(r.y);
        t.ne += r.ne; t.zins += r.zins; t.tilg += r.tilg; t.pay += r.pay; t.afa += r.afa;
      });
      at(x.exitY).vGewinn += x.gewinn;
      at(x.exitY).proceeds += x.proceeds;
      at(x.ablöseY).payoff += x.restAtExit;
    });

    // Bestände am Jahresende: Buchwerte nur solange gehalten, Restschuld bis zur Ablösung
    objs.forEach(function (x) {
      at(x.o.start).buchwert += x.invest0;
      at(x.o.start).rest += x.loan0;
      at(x.o.start).aktiv += 1;
      x.years.forEach(function (r) {
        if (r.y < x.exitY) { at(r.y).buchwert += r.buchwert; at(r.y).aktiv += 1; }
        if (r.y < x.ablöseY) at(r.y).rest += r.rest;
      });
    });

    var lossCarry = 0, cash = 0, cumProfit = 0, cumEinlage = 0, taxSum = 0, opexSum = 0;
    var flows = [];
    var rows = [];
    for (var i = start0; i <= T; i++) {
      var t = at(i);
      // Die GmbH trägt laufende Kosten von der ersten Anschaffung bis zum letzten Verkauf
      var opex = (objs.length && i >= start0) ? G.opex : 0;
      t.opex = opex;
      opexSum += opex;

      // Zinsen auf den Kassenbestand des Vorjahres: Guthaben in Anleihen, Fehlbetrag im Kontokorrent
      var anlageErtrag = Math.max(0, cash) * G.anlage / 100;
      var kkZins = Math.max(0, -cash) * G.kkZins / 100;

      var ebt = t.ne + anlageErtrag - t.afa - t.zins - kkZins - opex - t.akquise + t.vGewinn;
      var tax = 0;
      {
        if (ebt > 0) {
          var used = Math.min(lossCarry, ebt);
          lossCarry -= used;
          tax = (ebt - used) * taxRate;
        } else {
          lossCarry += -ebt;
        }
      }
      taxSum += tax;
      var jue = ebt - tax;
      cumProfit += jue;
      cumEinlage += t.einlage;

      var cashChange = t.einlage + t.loanNew - t.invest - t.akquise + t.ne - t.pay - opex - tax
        + t.proceeds - t.payoff + anlageErtrag - kkZins;
      cash += cashChange;

      flows.push(-t.einlage);

      rows.push({
        y: i, ne: t.ne, afa: t.afa, zins: t.zins, opex: opex, akquise: t.akquise, vGewinn: t.vGewinn,
        anlageErtrag: anlageErtrag, kkZins: kkZins,
        ebt: ebt, tax: tax, jue: jue,
        buchwert: t.buchwert, cash: cash, ek: cumEinlage + cumProfit, rest: t.rest,
        einlage: t.einlage, loanNew: t.loanNew, invest: t.invest,
        proceeds: t.proceeds, payoff: t.payoff, tilg: t.tilg, pay: t.pay,
        cashChange: cashChange, aktiv: t.aktiv
      });
    }

    var cashFinal = cash;
    var austax = G.ausschuetten ? Math.max(0, cashFinal - cumEinlage) * ABGELT / 100 : 0;
    var payout = cashFinal - austax;
    if (flows.length) flows[flows.length - 1] += payout;
    // ohne Objekte oder ohne Einlage gibt es keinen sinnvollen Zinsfuß
    var r = (objs.length && cumEinlage > 0) ? irr(flows) : null;

    var minCash = 0;
    rows.forEach(function (x) { minCash = Math.min(minCash, x.cash); });

    return {
      objs: objs, rows: rows, T: T, start0: start0, taxRate: taxRate * 100,
      cashFinal: cashFinal, payout: payout, austax: austax, taxSum: taxSum, opexSum: opexSum,
      cumEinlage: cumEinlage, ekFinal: cumEinlage + cumProfit, minCash: minCash,
      irr: r === null ? null : r * 100,
      investTotal: objs.reduce(function (a, x) { return a + x.invest0; }, 0),
      loanTotal: objs.reduce(function (a, x) { return a + x.loan0; }, 0),
      payoutTotal: objs.reduce(function (a, x) { return a + x.P; }, 0)
    };
  }

  // Eigenständige Rechenwerke für ein einzelnes Projekt.
  // Die Gemeinkosten der GmbH werden dabei anteilig zugeordnet, die Steuer auf das
  // Projekt allein gerechnet — die maßgebliche Steuer steht in der Portfolioansicht.
  function objectDetail(x, opexShare, taxRate, schnell) {
    var lossCarry = 0, cash = 0, cumProfit = 0, taxSum = 0, neSum = 0, opexSum = 0, dsSum = 0;
    // Der Akquiseaufwand fällt im Erwerbsjahr an und erzeugt dort einen Verlust,
    // der vorgetragen wird. Einlage und Aufwand heben sich in der Kasse auf.
    var akq = x.akquise || 0;
    lossCarry = akq;
    cumProfit = -akq;
    var rows = [{
      y: x.o.start, ne: 0, afa: 0, zins: 0, opex: 0, akquise: akq, vGewinn: 0,
      ebt: -akq, tax: 0, jue: -akq,
      buchwert: x.invest0, cash: 0, ek: x.equity0 - akq, rest: x.loan0,
      einlage: x.equity0, loanNew: x.loan0, invest: x.invest0,
      proceeds: 0, payoff: 0, tilg: 0, pay: 0, cashChange: 0, erwerb: true
    }];

    x.years.forEach(function (r) {
      var isExit = r.y === x.exitY;
      var isAbloese = r.y === x.ablöseY;
      var vG = isExit ? x.gewinn : 0;
      neSum += r.ne; opexSum += opexShare; dsSum += r.pay;
      var anlageErtrag = Math.max(0, cash) * G.anlage / 100;
      var kkZins = Math.max(0, -cash) * G.kkZins / 100;
      var ebt = r.ne + anlageErtrag - r.afa - r.zins - kkZins - opexShare + vG;
      var tax = 0;
      if (ebt > 0) {
        var used = Math.min(lossCarry, ebt);
        lossCarry -= used;
        tax = (ebt - used) * taxRate;
      } else { lossCarry += -ebt; }
      taxSum += tax;
      var jue = ebt - tax;
      cumProfit += jue;
      var cashChange = r.ne - r.pay - opexShare - tax + anlageErtrag - kkZins +
        (isExit ? x.proceeds : 0) - (isAbloese ? x.restAtExit : 0);
      cash += cashChange;
      rows.push({
        y: r.y, ne: r.ne, afa: r.afa, zins: r.zins, opex: opexShare, vGewinn: vG,
        anlageErtrag: anlageErtrag, kkZins: kkZins,
        ebt: ebt, tax: tax, jue: jue,
        buchwert: r.y >= x.exitY ? 0 : r.buchwert, cash: cash, ek: x.equity0 + cumProfit,
        rest: r.y >= x.ablöseY ? 0 : r.rest,
        einlage: 0, loanNew: 0, invest: 0,
        proceeds: isExit ? x.proceeds : 0, payoff: isAbloese ? x.restAtExit : 0,
        tilg: r.tilg, pay: r.pay, cashChange: cashChange, exit: isExit, abloese: isAbloese
      });
    });

    var flows = [-x.equity0];
    for (var k = 1; k < rows.length; k++) flows.push(0);
    flows[flows.length - 1] += cash;
    var ri = schnell ? null : irr(flows);
    return {
      rows: rows, cashFinal: cash, taxSum: taxSum, neSum: neSum, opexSum: opexSum, dsSum: dsSum,
      gewinn: cash - x.equity0, irr: ri === null ? null : ri * 100
    };
  }

  // ---------- Exit-Analyse je Objekt ----------
  var HMAX = 40; // muss mindestens dem Maximum des Haltedauer-Reglers entsprechen

  // Zahlungsströme des Objekts bei Haltedauer h, aus Sicht der GmbH (Eigenkapital).
  // Die Steuer wird hier objektbezogen mit anteiligen Gemeinkosten gerechnet.
  function ekStrom(o, h, opexShare, taxRate, schnell) {
    var x = buildObject(Object.assign({}, o, { hold: h }), schnell);
    var D = objectDetail(x, opexShare, taxRate, schnell);
    // Der Rückfluss steht erst zur Verfügung, wenn auch das Darlehen abgelöst ist.
    // Läuft es nach dem Verkauf bis zum Ende der Zinsbindung weiter, ist das später
    // als der Verkaufszeitpunkt — sonst würde die Rendite zu gut gerechnet.
    var ende = x.darlehensJahre;
    var f = [-x.equity0];
    for (var k = 1; k <= ende; k++) f.push(0);
    f[ende] += D.cashFinal;
    return { flows: f, cashFinal: D.cashFinal, equity0: x.equity0, obj: x, ende: ende };
  }

  function kapitalwert(flows, r) {
    var a = 0;
    for (var i = 0; i < flows.length; i++) a += flows[i] / Math.pow(1 + r, i);
    return a;
  }

  // Kapitalwertkurve über alle Haltedauern — ohne Zinsfuß, deshalb schnell genug
  // für Bisektionen. Grundlage sowohl der Analyse als auch des Ankaufsfilters.
  function kwKurve(o, opexShare, taxRate, disk) {
    var kurve = [];
    for (var h = 1; h <= HMAX; h++) {
      var s = ekStrom(o, h, opexShare, taxRate, true);
      kurve.push({ h: h, ende: s.ende, kw: kapitalwert(s.flows, disk),
        endwert: s.cashFinal, equity0: s.equity0, flows: s.flows });
    }
    return kurve;
  }

  // Wahrscheinlichkeitsgewichteter Kapitalwert. Weil der Kapitalwert linear in den
  // Zahlungen ist, entspricht er exakt dem Kapitalwert des gewichteten Zahlungsstroms —
  // die Zielgröße braucht daher keine unterstellte Haltedauer.
  function eKapitalwert(kurve, w, disk) {
    var summe = 0;
    for (var k = 1; k <= HMAX; k++) summe += w[k] * kurve[k - 1].kw;
    return summe;
  }

  // Ankaufsfilter: Welches Nutzungsentgelt ist nötig, damit der gewichtete Kapitalwert
  // gerade null wird? Die Zielgröße ist haltedauerfrei, deshalb entfällt jede Annahme
  // darüber, wie lange der Eigentümer bleibt.
  var NE_MIN = 1, NE_MAX = 9;

  // Umkehrrechnung für beliebige Stellschrauben: Welcher Wert bringt — bei sonst
  // unveränderten Annahmen — genau die Mindestrendite? Grundlage ist derselbe
  // gewichtete Kapitalwert, der ohne unterstellte Haltedauer auskommt.
  var STELLSCHRAUBEN = [
    { k: "ne", label: "Nutzungsentgelt", min: 0.5, max: 15, fmt: function (v) { return fPct(v, 2) + " p.a."; }, richtung: "mehr" },
    { k: "abschlag", label: "Ankaufsabschlag", min: 0, max: 60, fmt: function (v) { return fPct(v, 1); }, richtung: "mehr" },
    { k: "growth", label: "Wertentwicklung", min: -5, max: 10, fmt: function (v) { return fPct(v, 2) + " p.a."; }, richtung: "mehr" },
    { k: "verfall", label: "Instandhaltungsverfall", min: 0, max: 6, fmt: function (v) { return fPct(v, 2) + " p.a."; }, richtung: "weniger" },
    { k: "zins", label: "Sollzins", min: 0, max: 12, fmt: function (v) { return fPct(v, 2) + " p.a."; }, richtung: "weniger" },
    { k: "grest", label: "Grunderwerbsteuer", min: 0, max: 10, fmt: function (v) { return fPct(v, 2); }, richtung: "weniger" },
    { k: "makler", label: "Maklercourtage", min: 0, max: 8, fmt: function (v) { return fPct(v, 2); }, richtung: "weniger" },
    { k: "vkKosten", label: "Verkaufskosten", min: 0, max: 12, fmt: function (v) { return fPct(v, 2); }, richtung: "weniger" }
  ];

  // Die Hürde selbst ist ebenfalls eine Stellschraube: Ihr kritischer Wert ist die
  // Rendite, die der Vertrag bei den aktuellen Annahmen tatsächlich abwirft.
  function kritischeRendite(o, opexShare, taxRate) {
    var w = renditeGewichte(o);
    function kwBei(r) { return eKapitalwert(kwKurve(o, opexShare, taxRate, r / 100), w, r / 100); }
    var lo = -20, hi = 40;
    if (kwBei(lo) < 0) return { status: "unerreichbar", jetzt: kwBei(G.mindestRendite) };
    if (kwBei(hi) >= 0) return { status: "unkritisch", jetzt: kwBei(G.mindestRendite) };
    for (var i = 0; i < 32 && hi - lo > 0.0002; i++) {
      var mid = (lo + hi) / 2;
      if (kwBei(mid) >= 0) lo = mid; else hi = mid;
    }
    // wert ist der angezeigte Jahreszins, exakt der ungerundete — aus ihm wird die
    // Gesamtrendite gerechnet, sonst potenziert sich der Rundungsrest über die Jahre.
    var wert = Math.round(lo * 100) / 100;
    return { status: "gefunden", wert: wert, exakt: lo, jetzt: kwBei(G.mindestRendite),
      reicht: G.mindestRendite <= wert + 0.02 };
  }

  // Dasselbe Projekt ohne Fremdkapital. Ohne Darlehen gibt es auch keine Zinsbindung —
  // sonst läge der Erlös nach dem Verkauf ohne Grund in der Geldanlage und der
  // Vergleich fiele zugunsten der Finanzierung aus.
  function ohneHebel(o, opexShare, taxRate) {
    return kritischeRendite(Object.assign({}, o, { ltv: 0, weiterfuehren: false }), opexShare, taxRate);
  }

  function kritischerWert(o, sch, opexShare, taxRate) {
    var disk = zielZins(o) / 100;
    var w = renditeGewichte(o);
    function kwBei(v) {
      var oo = Object.assign({}, o); oo[sch.k] = v;
      return eKapitalwert(kwKurve(oo, opexShare, taxRate, disk), w, disk);
    }
    var kwMin = kwBei(sch.min), kwMax = kwBei(sch.max);
    var jetzt = kwBei(o[sch.k]);
    // Die Wirkungsrichtung wird gemessen, nicht unterstellt
    var steigend = kwMax > kwMin;
    var gut = steigend ? sch.max : sch.min;
    var schlecht = steigend ? sch.min : sch.max;
    if (kwBei(gut) < 0) return { status: "unerreichbar", jetzt: jetzt };
    if (kwBei(schlecht) >= 0) return { status: "unkritisch", jetzt: jetzt };
    var lo = schlecht, hi = gut;
    for (var i = 0; i < 22 && Math.abs(hi - lo) > 0.005; i++) {
      var mid = (lo + hi) / 2;
      if (kwBei(mid) < 0) lo = mid; else hi = mid;
    }
    var wert = Math.round(hi * 100) / 100;
    // Toleranz, damit an der Nullstelle kein Rundungsrest als Unterschreitung erscheint
    return { status: "gefunden", wert: wert, jetzt: jetzt,
      reicht: steigend ? o[sch.k] >= wert - 0.02 : o[sch.k] <= wert + 0.02 };
  }

  function mindestEntgelt(o, opexShare, taxRate) {
    var disk = zielZins(o) / 100;
    var w = renditeGewichte(o);
    function kwBei(ne) {
      return eKapitalwert(kwKurve(Object.assign({}, o, { ne: ne }), opexShare, taxRate, disk), w, disk);
    }
    var kwUnten = kwBei(NE_MIN), kwOben = kwBei(NE_MAX);
    if (kwUnten >= 0) {
      return { status: "nicht bindend", ne: NE_MIN, kwAktuell: kwBei(o.ne) };
    }
    if (kwOben < 0) {
      return { status: "nicht erreichbar", ne: null, kwAktuell: kwBei(o.ne) };
    }
    var lo = NE_MIN, hi = NE_MAX;
    for (var i = 0; i < 24 && hi - lo > 0.005; i++) {
      var mid = (lo + hi) / 2;
      if (kwBei(mid) < 0) lo = mid; else hi = mid;
    }
    var ne = Math.ceil(hi * 100) / 100;
    // Eigentümerkosten zum Mindestentgelt — ohne sie entstehen Preise, die niemand zahlt
    var xo = buildObject(Object.assign({}, o, { ne: ne, hold: holdEffektiv(o) }));
    return { status: "gefunden", ne: ne, ownerCost: xo.ownerCost,
      monat: xo.P * (ne / 100) / 12, kwAktuell: kwBei(o.ne) };
  }

  function exitAnalyse(o, opexShare, taxRate) {
    var GW = exitGewichte(o);
    var w = GW.w;              // reine Sterbetafel — Diagramm und Risikoanteile
    var wR = renditeGewichte(o); // maßgeblich für die Rendite, folgt dem Schalter
    var LZ = laufzeiten(o);
    var disk = zielZins(o) / 100; // dieselbe Hürde wie im Ankaufsfilter
    var kurve = [];
    for (var h = 1; h <= HMAX; h++) {
      var s = ekStrom(o, h, opexShare, taxRate);
      var xo = s.obj;
      kurve.push({
        h: h,
        ende: s.ende,
        irr: (function () { var r = irr(s.flows); return r === null ? null : r * 100; })(),
        kw: kapitalwert(s.flows, disk),
        endwert: s.cashFinal,
        equity0: s.equity0,
        ownerCost: xo.ownerCost
      });
    }

    // Break-even über den Kapitalwert — bei kurzen Haltedauern mit stark negativen
    // Anfangszahlungen ist der interne Zinsfuß nicht eindeutig.
    var beKW = null, beNull = null;
    kurve.forEach(function (p) {
      if (beKW === null && p.kw >= 0) beKW = p.h;
      if (beNull === null && p.endwert >= p.equity0) beNull = p.h;
    });

    var eH = GW.eH, eEnd = 0, eEndR = 0, median = GW.median, pVorBE = 0;
    for (var k2 = 1; k2 <= HMAX; k2++) {
      eEnd += w[k2] * kurve[k2 - 1].endwert;
      // Rückfluss auf der maßgeblichen Gewichtung — Grundlage der Kapitalwertrechnung
      eEndR += wR[k2] * kurve[k2 - 1].endwert;
      // Anteil der Fälle, in denen der Kapitalwert negativ bleibt — setzt keine
      // Monotonie über die Haltedauer voraus, anders als ein einzelner Break-even-Punkt
      if (kurve[k2 - 1].kw < 0) pVorBE += w[k2];
    }
    var summe = 1;

    // Rendite als interner Zinsfuß des gewichteten Zahlungsstroms. Gewichtet wird mit
    // wR, damit ohne Sterbetafel-Kopplung genau der eingestellte Zeitpunkt gilt.
    var maxEnde = HMAX;
    kurve.forEach(function (p) { maxEnde = Math.max(maxEnde, p.ende); });
    var eFlows = [-kurve[0].equity0];
    for (var k3 = 1; k3 <= maxEnde; k3++) eFlows.push(0);
    for (var k4 = 1; k4 <= HMAX; k4++) {
      // Rückfluss zum tatsächlichen Ablösejahr, nicht zum Verkaufsjahr
      eFlows[kurve[k4 - 1].ende] += wR[k4] * kurve[k4 - 1].endwert;
    }
    var eIrrRaw = irr(eFlows);

    // Die gerechnete Haltedauer, nicht der Reglerwert — sonst zeigt die Analyse
    // bei aktiver Sterbetafel-Kopplung einen anderen Punkt als die Bilanz.
    var hEff = Math.min(HMAX, Math.max(1, holdEffektiv(o)));
    return {
      kurve: kurve, beKW: beKW, beNull: beNull,
      median: median, eH: eH, eEnd: eEnd, eEndR: eEndR, pVorBE: pVorBE * 100, lz: LZ, wR: wR,
      eIrr: eIrrRaw === null ? null : eIrrRaw * 100, w: w, hEff: hEff,
      gewaehlt: kurve[hEff - 1]
    };
  }

  // ---------- Objekttabelle: reine Übersicht, Bearbeitung auf der Objektseite ----------
  var SPALTEN = [
    { h: "Objekt", sub: "Bezeichnung", col: "w-name", links: true, get: function (o, x, i) { return o.name || "Objekt " + (i + 1); } },
    { h: "Wert", sub: "bei Erwerb", col: "w-num", get: function (o) { return fEur(o.v0); } },
    { h: "Anteil", sub: "%", col: "w-narrow", get: function (o) { return fPct(o.share, 0); } },
    { h: "Entgelt", sub: "% p.a.", col: "w-mid", get: function (o) { return fPct(o.ne, 2); } },
    { h: "Erwerb", sub: "Jahr", col: "w-narrow", get: function (o) { return fJahr(o.start); } },
    { h: "Dauer", sub: "Jahre", col: "w-narrow", get: function (o) { return String(o.hold); } },
    { h: "Haushalt", sub: "Art / Alter", col: "w-mid", get: function (o) { return (o.haus || "Paar") + " " + (o.alter || 75); } },
    { h: "Auszahlung", sub: "heute", col: "w-calc", lead: true, get: function (o, x) { return fEur(x.P); } },
    { h: "Eigenkapital", sub: "beim Erwerb", col: "w-calc", get: function (o, x) { return fEur(x.equity0); } },
    { h: "Kosten", sub: "Eigentümer", col: "w-calc", get: function (o, x) { return fPct(x.ownerCost); } }
  ];

  function buildObjectTable(P) {
    var t = document.getElementById("objTable");
    if (!OBJ.length) {
      t.innerHTML = '<tbody><tr><td class="empty">Noch keine Objekte — oben rechts ein Objekt hinzufügen.</td></tr></tbody>';
      document.getElementById("objCaption").textContent = "";
      return;
    }
    var html = "<colgroup>";
    SPALTEN.forEach(function (c) { html += '<col class="' + c.col + '">'; });
    html += '<col class="w-act"><col class="w-act"></colgroup><thead><tr>';
    SPALTEN.forEach(function (c, i) {
      html += "<th" + (i === 0 ? ' class="c-name"' : "") + "><span>" + c.h + '</span><span class="h-sub">' + c.sub + "</span></th>";
    });
    html += "<th></th><th></th></tr></thead><tbody>";

    OBJ.forEach(function (o, idx) {
      var x = P.objs[idx];
      html += '<tr class="zeile" data-row="' + idx + '">';
      SPALTEN.forEach(function (c, i) {
        html += "<td class=\"" + (i === 0 ? "c-name" : "calc") + (c.lead ? " lead" : "") + "\">" + c.get(x.o, x, idx) + "</td>";
      });
      html += '<td><button type="button" class="open" data-open="' + idx +
        '" aria-label="Objekt ' + (idx + 1) + ' öffnen" title="Öffnen">›</button></td>';
      html += '<td><button type="button" class="del" data-del="' + idx +
        '" aria-label="Objekt ' + (idx + 1) + ' entfernen" title="Entfernen">✕</button></td>';
      html += "</tr>";
    });

    html += '</tbody><tfoot><tr><td class="c-name">Summe</td>';
    for (var c2 = 1; c2 < 7; c2++) html += "<td></td>";
    html += "<td>" + fEur(P.payoutTotal) + "</td><td>" + fEur(P.cumEinlage) + "</td><td></td><td></td><td></td></tr></tfoot>";
    t.innerHTML = html;

    t.querySelectorAll("button[data-del]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        OBJ.splice(+b.dataset.del, 1);
        refresh();
      });
    });
    t.querySelectorAll("button[data-open]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); openDetail(+b.dataset.open); });
    });
    t.querySelectorAll("tr.zeile").forEach(function (tr) {
      tr.addEventListener("click", function () { openDetail(+tr.dataset.row); });
      tr.setAttribute("title", "Projekt öffnen");
    });

    var perObj = OBJ.length ? G.opex / OBJ.length : 0;
    document.getElementById("objCaption").textContent =
      "Laufende Kosten von " + fEur(G.opex) + " je Jahr verteilen sich auf " + OBJ.length +
      (OBJ.length === 1 ? " Objekt" : " Objekte") + " — " + fEur(perObj) +
      " je Vertrag und Jahr. Alle weiteren Annahmen stehen auf der jeweiligen Objektseite.";
  }

  document.getElementById("addBtn").addEventListener("click", function () {
    var n = OBJ.length + 1;
    OBJ.push(neuesObjekt("Objekt " + n));
    refresh();
  });

  // ---------- Chart ----------
  var CW = 820, CH = 340, M = { l: 62, r: 16, t: 14, b: 30 };
  var chartRows = [], chartGeom = null;

  function niceStep(range) {
    if (range <= 0) return 1;
    var raw = range / 5;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * mag >= raw) return steps[i] * mag;
    return 10 * mag;
  }
  function fShort(v) {
    var a = Math.abs(v);
    if (a >= 1000000) return (v / 1000000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Mio";
    if (a >= 1000) return Math.round(v / 1000) + "k";
    return String(Math.round(v));
  }

  function buildChart(P) {
    chartRows = P.rows;
    var svgEl = document.getElementById("chart");
    if (!chartRows.length || P.T === P.start0) {
      svgEl.innerHTML = '<text x="' + (CW / 2) + '" y="' + (CH / 2) + '" text-anchor="middle" font-size="13" fill="var(--ink-3)">Noch keine Daten</text>';
      document.getElementById("chartCaption").textContent = "";
      return;
    }
    var maxV = 0, minV = 0;
    chartRows.forEach(function (r) {
      [r.cash, r.ek, 0].forEach(function (v) { maxV = Math.max(maxV, v); minV = Math.min(minV, v); });
      maxV = Math.max(maxV, r.ek);
    });
    var cumE = 0;
    var einlagen = chartRows.map(function (r) { cumE += r.einlage; maxV = Math.max(maxV, cumE); return cumE; });

    var step = niceStep(maxV - minV);
    var yMax = step * Math.ceil(maxV / step || 1);
    // Die Unterdeckung ist oft klein gegenüber dem Vermögensaufbau — dann nur so weit
    // unter null gehen, wie tatsächlich gebraucht wird, statt eine volle Gitterstufe
    var yMin = minV < 0 ? Math.min(minV * 1.15, -step * 0.12) : 0;
    if (yMax === yMin) yMax = yMin + step;

    var plotW = CW - M.l - M.r, plotH = CH - M.t - M.b;
    var T = P.T, T0 = P.start0, spanne = T - T0;
    function x(y) { return M.l + (spanne === 0 ? 0 : (y - T0) / spanne * plotW); }
    function yy(v) { return M.t + plotH - (v - yMin) / (yMax - yMin) * plotH; }

    var svg = [];
    var ticks = [];
    for (var v = 0; v <= yMax + 1e-6; v += step) ticks.push(v);
    for (var vn = -step; vn >= yMin; vn -= step) ticks.push(vn);
    if (minV < 0) ticks.push(minV);
    ticks.forEach(function (tv) {
      var py = yy(tv);
      var istNull = Math.abs(tv) < 1e-6;
      var istTief = tv === minV && minV < 0;
      svg.push('<line x1="' + M.l + '" x2="' + (CW - M.r) + '" y1="' + py + '" y2="' + py + '" stroke="' + (istNull ? "var(--axis)" : "var(--grid)") + '" stroke-width="1"' + (istTief ? ' stroke-dasharray="2 3"' : "") + "/>");
      svg.push('<text x="' + (M.l - 8) + '" y="' + (py + 4) + '" text-anchor="end" font-size="11" fill="' + (istTief ? "var(--s2)" : "var(--ink-3)") + '" style="font-variant-numeric:tabular-nums">' + fShort(tv) + "</text>");
    });
    var tickEvery = spanne <= 12 ? 1 : (spanne <= 25 ? 5 : 10);
    for (var ty = T0; ty <= T; ty += tickEvery) {
      svg.push('<text x="' + x(ty) + '" y="' + (CH - 8) + '" text-anchor="middle" font-size="11" fill="var(--ink-3)">' + fJahr(ty) + "</text>");
    }

    P.objs.forEach(function (o) {
      svg.push('<line x1="' + x(o.exitY) + '" x2="' + x(o.exitY) + '" y1="' + M.t + '" y2="' + (CH - M.b) + '" stroke="var(--axis)" stroke-width="1" stroke-dasharray="2 4"/>');
    });

    function path(get) {
      var p = "";
      chartRows.forEach(function (r, i) {
        p += (p === "" ? "M" : "L") + x(r.y).toFixed(1) + " " + yy(get(r, i)).toFixed(1);
      });
      return p;
    }
    svg.push('<path d="' + path(function (r, i) { return einlagen[i]; }) + '" fill="none" stroke="var(--s2)" stroke-width="2" stroke-linejoin="round"/>');
    svg.push('<path d="' + path(function (r) { return r.ek; }) + '" fill="none" stroke="var(--s3)" stroke-width="2" stroke-linejoin="round"/>');
    svg.push('<path d="' + path(function (r) { return r.cash; }) + '" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>');

    svg.push('<line id="cross" x1="0" x2="0" y1="' + M.t + '" y2="' + (CH - M.b) + '" stroke="var(--ink-3)" stroke-width="1" visibility="hidden"/>');
    svg.push('<rect x="' + M.l + '" y="' + M.t + '" width="' + plotW + '" height="' + plotH + '" fill="transparent" id="hover"/>');
    svgEl.innerHTML = svg.join("");
    chartGeom = { x: x, y: yy, T: T, T0: T0, spanne: spanne, einlagen: einlagen };
    bindHover();

    document.getElementById("chartCaption").textContent =
      (P.minCash < -1
        ? "Tiefster Kontostand " + fEur(P.minCash) + " im Jahr " + fJahr(chartRows.reduce(function (a, r) { return r.cash < a.c ? { y: r.y, c: r.cash } : a; }, { y: 0, c: 0 }).y) + ". "
        : "Das Bankkonto bleibt durchgehend positiv. ") +
      "Gestrichelte Linien markieren die Verkaufszeitpunkte der einzelnen Objekte.";
  }

  function bindHover() {
    var svgEl = document.getElementById("chart");
    var box = document.getElementById("chartBox");
    var tip = document.getElementById("tip");
    var cross = svgEl.querySelector("#cross");
    var hover = svgEl.querySelector("#hover");
    if (!hover) return;

    function move(cx, cy) {
      var rect = svgEl.getBoundingClientRect();
      var sx = (cx - rect.left) / rect.width * CW;
      var y = chartGeom.T0 + Math.round((sx - M.l) / (CW - M.l - M.r) * chartGeom.spanne);
      y = Math.max(chartGeom.T0, Math.min(chartGeom.T, y));
      var idx = y - chartGeom.T0;
      var r = chartRows[idx];
      cross.setAttribute("x1", chartGeom.x(y));
      cross.setAttribute("x2", chartGeom.x(y));
      cross.setAttribute("visibility", "visible");
      tip.innerHTML =
        "<b>" + fJahr(y) + (r.aktiv ? " · " + r.aktiv + (r.aktiv === 1 ? " Objekt" : " Objekte") : "") + "</b>" +
        '<div class="t-row"><span class="swatch" style="background:var(--s1)"></span>Bankguthaben: <b>' + fEur(r.cash) + "</b></div>" +
        '<div class="t-row"><span class="swatch" style="background:var(--s3)"></span>Eigenkapital: <b>' + fEur(r.ek) + "</b></div>" +
        '<div class="t-row"><span class="swatch" style="background:var(--s2)"></span>Einlagen: <b>' + fEur(chartGeom.einlagen[idx]) + "</b></div>" +
        '<div class="t-row" style="color:var(--ink-3)">Jahresüberschuss ' + fEur(r.jue) + "</div>";
      tip.style.display = "block";
      var bx = box.getBoundingClientRect();
      var px = cx - bx.left, py = cy - bx.top;
      var tw = tip.offsetWidth;
      tip.style.left = (px + tw + 24 > bx.width ? px - tw - 14 : px + 14) + "px";
      tip.style.top = Math.max(0, py - 20) + "px";
    }
    hover.addEventListener("mousemove", function (e) { move(e.clientX, e.clientY); });
    hover.addEventListener("mouseleave", function () { tip.style.display = "none"; cross.setAttribute("visibility", "hidden"); });
    hover.addEventListener("touchstart", function (e) { if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    hover.addEventListener("touchmove", function (e) { if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  }

  // ---------- Rechenwerke ----------
  var csvFin = [];

  function buildStatements(P) {
    var rows = P.rows, T = P.T;
    var groups = [
      { title: "Gewinn- und Verlustrechnung", rows: [
        { l: "Nutzungsentgelte", f: function (r) { return r.ne; } },
        { l: "Zinserträge aus Geldanlage", f: function (r) { return r.anlageErtrag; } },
        { l: "Abschreibungen (AfA)", f: function (r) { return -r.afa; } },
        { l: "Sonstige betriebliche Aufwendungen", f: function (r) { return -r.opex; } },
        { l: "Akquisitionskosten", f: function (r) { return -(r.akquise || 0); } },
        { l: "Zinsaufwand Darlehen", f: function (r) { return -r.zins; } },
        { l: "Zinsaufwand Kontokorrent", f: function (r) { return -r.kkZins; } },
        { l: "Ergebnis Anteilsverkäufe", f: function (r) { return r.vGewinn; } },
        { l: "Ergebnis vor Steuern", sum: true, f: function (r) { return r.ebt; } },
        { l: "Steuern (KSt, Soli, GewSt)", f: function (r) { return -r.tax; } },
        { l: "Jahresüberschuss", sum: true, f: function (r) { return r.jue; } }
      ] },
      { title: "Bilanz (Stichtag 31.12.)", rows: [
        { l: "Immobilienanteile (Buchwert)", f: function (r) { return r.buchwert; } },
        { l: "Guthaben und Wertpapiere", f: function (r) { return r.cash; } },
        { l: "Summe Aktiva", sum: true, f: function (r) { return r.buchwert + r.cash; } },
        { l: "Eigenkapital", f: function (r) { return r.ek; } },
        { l: "Bankdarlehen", f: function (r) { return r.rest; } },
        { l: "Summe Passiva", sum: true, f: function (r) { return r.ek + r.rest; } }
      ] },
      { title: "Kapitalflussrechnung", rows: [
        { l: "Operativer Cashflow", f: function (r) { return r.ne + r.anlageErtrag - r.zins - r.kkZins - r.opex - (r.akquise || 0) - r.tax; } },
        { l: "Investitionscashflow", f: function (r) { return r.proceeds - r.invest; } },
        { l: "Finanzierungscashflow", f: function (r) { return r.einlage + r.loanNew - r.tilg - r.payoff; } },
        { l: "davon Einlagen", f: function (r) { return r.einlage; } },
        { l: "Veränderung Zahlungsmittel", sum: true, f: function (r) { return r.cashChange; } },
        { l: "Bestand Zahlungsmittel", f: function (r) { return r.cash; } }
      ] }
    ];

    var html = "<thead><tr><th>in Euro</th>";
    rows.forEach(function (r) { html += "<th>" + fJahr(r.y) + "</th>"; });
    html += "</tr></thead><tbody>";
    csvFin = [["in Euro"].concat(rows.map(function (r) { return fJahr(r.y); }))];

    groups.forEach(function (g, gi) {
      if (gi > 0) html += '<tr class="spacer"><td colspan="' + (rows.length + 1) + '"></td></tr>';
      html += '<tr class="grp"><td>' + g.title + "</td>";
      rows.forEach(function () { html += "<td></td>"; });
      html += "</tr>";
      csvFin.push([g.title]);
      g.rows.forEach(function (row) {
        html += '<tr' + (row.sum ? ' class="sum"' : "") + "><td>" + row.l + "</td>";
        var line = [row.l];
        rows.forEach(function (r) {
          var v = row.f(r);
          html += '<td class="' + (v < -0.5 ? "neg" : "") + '">' + fEur(v) + "</td>";
          line.push(csvNum(v));
        });
        html += "</tr>";
        csvFin.push(line);
      });
    });
    html += "</tbody>";
    document.getElementById("finTable").innerHTML = html;

    document.getElementById("finSub").textContent =
      "Konsolidiert über " + OBJ.length + (OBJ.length === 1 ? " Objekt" : " Objekte") +
      ", " + fJahr(P.start0) + " bis " + fJahr(T) + " · Steuersatz " + fPct(P.taxRate, 2);
    document.getElementById("finCaption").textContent =
      "Steuern werden auf Gesellschaftsebene über alle Objekte gerechnet; Verluste einzelner Jahre werden vorgetragen. " +
      "Nach dem letzten Verkauf besteht die Bilanz nur noch aus Bankguthaben und Eigenkapital — dann zeigt sie, was aus " +
      fEur(P.cumEinlage) + " Einlagen geworden ist.";
  }

  document.getElementById("csvBtn").addEventListener("click", function () {
    var btn = this;
    var text = csvFin.map(function (r) { return r.join(";"); }).join("\n");
    function done(m) { btn.textContent = m; setTimeout(function () { btn.textContent = "Als CSV kopieren"; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done("Kopiert ✓"); }, function () { done("Fehlgeschlagen"); });
    } else { done("Nicht möglich"); }
  });

  function renderContrib(P) {
    var host = document.getElementById("contribList");
    if (!P.objs.length) {
      host.innerHTML = '<div class="empty">Noch keine Objekte.</div>';
      document.getElementById("contribCaption").textContent = "";
      return;
    }
    var max = Math.max.apply(null, P.objs.map(function (x) { return Math.abs(x.beitrag); })) || 1;
    var summe = P.objs.reduce(function (a, x) { return a + x.beitrag; }, 0);
    var h = '<div class="contrib">';
    P.objs.forEach(function (x, i) {
      var anteil = summe !== 0 ? x.beitrag / summe * 100 : 0;
      h += '<div class="contrib-row" data-open="' + i + '" role="button" tabindex="0">' +
        '<div class="contrib-name" title="' + (x.o.name || "").replace(/"/g, "&quot;") + '">' +
          (x.o.name || "Objekt " + (i + 1)) + "</div>" +
        '<div class="cb"><div class="' + (x.beitrag < 0 ? "neg" : "") + '" style="width:' +
          (Math.abs(x.beitrag) / max * 100).toFixed(1) + '%"></div></div>' +
        '<div style="text-align:right"><div class="contrib-val">' + fEur(x.beitrag) + "</div>" +
        '<div class="contrib-sub">' + fPct(anteil, 0) + " · " + fJahr(x.o.start) + "–" + fJahr(x.exitY) + "</div></div>" +
        "</div>";
    });
    h += "</div>";
    host.innerHTML = h;
    host.querySelectorAll(".contrib-row[data-open]").forEach(function (r) {
      r.addEventListener("click", function () { openDetail(+r.dataset.open); });
      r.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(+r.dataset.open); }
      });
    });
    document.getElementById("contribCaption").textContent =
      "Summe der direkt zurechenbaren Beiträge: " + fEur(summe) + ". Nicht enthalten sind " +
      fEur(P.opexSum) + " laufende Kosten, " + fEur(P.taxSum) + " Steuern sowie Zinsen auf Guthaben und Kontokorrent — " +
      "diese entstehen auf Gesellschaftsebene. Die Summe entspricht daher nicht dem Vermögenszuwachs oben.";
  }

  // ---------- Detailansicht je Projekt ----------
  var detailIdx = null;
  var view = "portfolio";

  function openDetail(i) { detailIdx = i; refresh(); window.scrollTo(0, 0); }
  function closeDetail() { detailIdx = null; refresh(); window.scrollTo(0, 0); }

  function finTableHtml(rows, groups, yLabel) {
    var html = "<thead><tr><th>in Euro</th>";
    rows.forEach(function (r) { html += "<th>" + yLabel(r) + "</th>"; });
    html += "</tr></thead><tbody>";
    groups.forEach(function (g, gi) {
      if (gi > 0) html += '<tr class="spacer"><td colspan="' + (rows.length + 1) + '"></td></tr>';
      html += '<tr class="grp"><td>' + g.title + "</td>";
      rows.forEach(function () { html += "<td></td>"; });
      html += "</tr>";
      g.rows.forEach(function (row) {
        html += '<tr' + (row.sum ? ' class="sum"' : "") + "><td>" + row.l + "</td>";
        rows.forEach(function (r) {
          var v = row.f(r);
          html += '<td class="' + (v < -0.5 ? "neg" : "") + '">' + fEur(v) + "</td>";
        });
        html += "</tr>";
      });
    });
    return html + "</tbody>";
  }

  var STMT_GROUPS = [
    { title: "Gewinn- und Verlustrechnung", rows: [
      { l: "Nutzungsentgelt", f: function (r) { return r.ne; } },
      { l: "Zinserträge aus Geldanlage", f: function (r) { return r.anlageErtrag || 0; } },
      { l: "Abschreibungen (AfA)", f: function (r) { return -r.afa; } },
      { l: "Anteilige laufende Kosten", f: function (r) { return -r.opex; } },
      { l: "Akquisitionskosten", f: function (r) { return -(r.akquise || 0); } },
      { l: "Zinsaufwand Darlehen", f: function (r) { return -r.zins; } },
      { l: "Zinsaufwand Kontokorrent", f: function (r) { return -(r.kkZins || 0); } },
      { l: "Ergebnis Anteilsverkauf", f: function (r) { return r.vGewinn; } },
      { l: "Ergebnis vor Steuern", sum: true, f: function (r) { return r.ebt; } },
      { l: "Steuern (anteilig)", f: function (r) { return -r.tax; } },
      { l: "Jahresüberschuss", sum: true, f: function (r) { return r.jue; } }
    ] },
    { title: "Bilanz (Stichtag 31.12.)", rows: [
      { l: "Immobilienanteil (Buchwert)", f: function (r) { return r.buchwert; } },
      { l: "Guthaben und Wertpapiere", f: function (r) { return r.cash; } },
      { l: "Summe Aktiva", sum: true, f: function (r) { return r.buchwert + r.cash; } },
      { l: "Eigenkapital", f: function (r) { return r.ek; } },
      { l: "Bankdarlehen", f: function (r) { return r.rest; } },
      { l: "Summe Passiva", sum: true, f: function (r) { return r.ek + r.rest; } }
    ] },
    { title: "Kapitalflussrechnung", rows: [
      { l: "Operativer Cashflow", f: function (r) { return r.ne + (r.anlageErtrag || 0) - r.zins - (r.kkZins || 0) - r.opex - (r.akquise || 0) - r.tax; } },
      { l: "Investitionscashflow", f: function (r) { return r.proceeds - r.invest; } },
      { l: "Finanzierungscashflow", f: function (r) { return r.einlage + r.loanNew - r.tilg - r.payoff; } },
      { l: "Veränderung Zahlungsmittel", sum: true, f: function (r) { return r.cashChange; } },
      { l: "Bestand Zahlungsmittel", f: function (r) { return r.cash; } }
    ] }
  ];

  function renderDetail(P) {
    var host = document.getElementById("viewDetail");
    var x = P.objs[detailIdx];
    if (!x) { detailIdx = null; return; }
    var o = x.o;
    var opexShare = OBJ.length ? G.opex / OBJ.length : 0;
    var D = objectDetail(x, opexShare, P.taxRate / 100);

    var h = "";
    h += '<div class="card">';
    h += '<button type="button" class="crumb" id="backBtn">‹ Zurück zum Portfolio</button>';
    h += "<h2>" + (o.name || "Objekt " + (detailIdx + 1)) + "</h2>";
    h += '<p class="sub" style="margin-bottom:0">Erwerb ' + fJahr(o.start) + ", Verkauf " + fJahr(x.exitY) +
      " · " + fPct(o.share, 0) + " Anteil an " + fEur(o.v0) + " · Nutzungsentgelt " + fPct(o.ne, 2) + " p.a.</p>";
    h += "</div>";

    // ---- Teil 1: Vertrag ----
    h += '<div class="section-head"><h3>Vertrag</h3><span class="sh-note">Was mit dem Eigentümer vereinbart ist</span></div>';

    h += '<div class="card"><div class="stat-row">';
    h += '<div><div class="stat-label">Auszahlung</div><div class="stat-num">' + fEur(x.P) +
      '</div><div class="stat-sub">an den Eigentümer</div></div>';
    h += '<div><div class="stat-label">Monatliche Rate</div><div class="stat-num">' + fEur(x.P * (o.ne / 100) / 12) +
      '</div><div class="stat-sub">' + (o.esc === 0 ? "fest bis zum Verkauf" : "steigt um " + fPct(o.esc, 2) + " p.a.") + "</div></div>";
    h += '<div><div class="stat-label">Laufzeit</div><div class="stat-num">' + o.hold +
      '</div><div class="stat-sub">Jahre bis zum Verkauf</div></div>';
    h += '<div><div class="stat-label"><span class="dot s1"></span>Kosten Eigentümer</div><div class="stat-num">' + fPct(x.ownerCost) +
      '</div><div class="stat-sub">effektiv pro Jahr</div></div>';
    h += "</div></div>";

    // Eigentümersicht
    h += '<div class="card"><h2>Was der Eigentümer insgesamt zahlt</h2>';
    h += '<p class="sub">Alle Zahlungen aus Sicht des Verkäufers.</p><table class="cmp"><tbody>';
    var mo = x.P * (o.ne / 100) / 12;
    var moLast = x.P * (o.ne / 100) * Math.pow(1 + o.esc / 100, o.hold - 1) / 12;
    var neSum = x.years.reduce(function (a, r) { return a + r.ne; }, 0);
    if (o.abschlag > 0) {
      h += "<tr><td>Anteiliger Verkehrswert</td><td>" + fEur(x.vollpreis) + "</td></tr>";
      h += "<tr><td>Ankaufsabschlag " + fPct(o.abschlag, 1) + "</td><td>−" + fEur(x.vollpreis - x.P) + "</td></tr>";
    }
    h += "<tr><td>Auszahlung heute</td><td>" + fEur(x.P) + "</td></tr>";
    h += "<tr><td>Monatliche Rate</td><td>" + (o.esc === 0 ? fEur(mo) + " (fest)" : fEur(mo) + " → " + fEur(moLast)) + "</td></tr>";
    h += "<tr><td>Σ Nutzungsentgelte bis Verkauf</td><td>−" + fEur(neSum) + "</td></tr>";
    h += "<tr><td>Anteil der GmbH beim Verkauf</td><td>−" + fEur(x.B + x.DE) + "</td></tr>";
    h += "<tr><td>Eigentümer erhält beim Verkauf</td><td>" + fEur(x.ownerGets) + "</td></tr>";
    h += '<tr class="big"><td>Effektive Jahreskosten</td><td>' + fPct(x.ownerCost) + "</td></tr>";
    h += "</tbody></table></div>";

    // Erlösverteilung
    h += '<div class="card"><h2>Wohin fließt der Verkaufserlös?</h2>';
    h += '<p class="sub">Verkaufspreis ' + fJahr(x.exitY) + ": " + fEur(x.VT) + "</p>";
    h += '<div class="bar-legend"><span><span class="sq" style="background:var(--grid)"></span>Eigentümer</span>' +
      '<span><span class="sq" style="background:var(--s1)"></span>GmbH</span>' +
      (x.DE > 0 ? '<span><span class="sq" style="background:var(--ink-3)"></span>Durchführungsentgelt</span>' : "") +
      (x.vkTotal > 0 ? '<span><span class="sq" style="background:var(--s2)"></span>Verkaufskosten</span>' : "") + "</div>";
    // Das Durchführungsentgelt steckt bereits in proceeds — der GmbH-Balken zeigt daher
    // nur den Anteil ohne Entgelt, sonst würde derselbe Betrag zweimal gezeichnet.
    var segGmbH = x.B - x.vkBuyer;
    var segSumme = Math.max(1, x.ownerGets + segGmbH + x.DE + x.vkTotal);
    function w(v) { return Math.max(0, v / segSumme * 100).toFixed(2) + "%"; }
    h += '<div class="bar"><div class="seg-owner" style="width:' + w(x.ownerGets) + '"></div>' +
      '<div class="seg-buy" style="width:' + w(segGmbH) + '"></div>' +
      (x.DE > 0 ? '<div class="seg-fee" style="width:' + w(x.DE) + '"></div>' : "") +
      (x.vkTotal > 0 ? '<div class="seg-cost" style="width:' + w(x.vkTotal) + '"></div>' : "") + "</div>";
    h += '<div class="bar-caption">Eigentümer ' + fEur(x.ownerGets) + " · GmbH " + fEur(x.proceeds) +
      (x.DE > 0 ? " (davon Entgelt " + fEur(x.DE) + ")" : "") +
      (x.vkTotal > 0 ? " · Verkaufskosten " + fEur(x.vkTotal) : "") +
      (x.B > (o.share / 100) * x.VT + 0.5 ? " · Mindesterlös greift" : "") + "</div></div>";

    // ---- Teil 2: Wirtschaftlichkeit ----
    h += '<div class="section-head"><h3>Wirtschaftlichkeit</h3><span class="sh-note">Was das Projekt für die GmbH bedeutet</span></div>';

    h += '<div class="card"><div class="stat-row">';
    h += '<div><div class="stat-label"><span class="dot s2"></span>Eigenkapital</div><div class="stat-num">' + fEur(x.equity0) +
      '</div><div class="stat-sub">' + fEur(x.loan0) + " Darlehen</div></div>";
    var LZd = laufzeiten(o);
    h += '<div><div class="stat-label"><span class="dot s3"></span>Rendite nach Steuern</div><div class="stat-num">' + fPct(D.irr) +
      '</div><div class="stat-sub">' + (LZd.auto ? "Median-Szenario, " : "über ") +
      fJahre(x.darlehensJahre) + " gebunden</div></div>";
    h += '<div><div class="stat-label">Ergebnisbeitrag</div><div class="stat-num">' + fEur(x.beitrag) +
      '</div><div class="stat-sub">vor Gemeinkosten und Steuern</div></div>';
    h += '<div><div class="stat-label">Liquidität am Ende</div><div class="stat-num">' + fEur(D.cashFinal) +
      '</div><div class="stat-sub">aus ' + fEur(x.equity0) + " Einlage</div></div>";
    h += "</div>";
    // Aufschlüsselung der Anschaffung — die Nebenkosten sind vollständig aus
    // Eigenkapital zu stellen, Banken finanzieren sie nicht mit.
    var neben = x.invest0 - x.P;
    h += '<div class="stat-foot">Anschaffung ' + fEur(x.invest0) + " = " + fEur(x.P) + " Auszahlung + " +
      fEur(neben) + " Nebenkosten (" + fPct(o.grest, 1) + " Grunderwerbsteuer, " + fPct(o.notar, 2) +
      " Notar" + ((o.makler || 0) > 0 ? ", " + fPct(o.makler, 2) + " Makler" : "") + "), davon " +
      fEur(x.loan0) + " über Darlehen" +
      (x.akquise > 0
        ? "; zuzüglich " + fEur(x.akquise) + " Akquisitionskosten, die nicht aktiviert werden, ergibt das " +
          fEur(x.equity0) + " Eigenkapitalbedarf. "
        : ". ") +
      "Anteilige laufende Kosten: " + fEur(opexShare) + " je Jahr (" + fEur(G.opex) +
      " geteilt durch " + OBJ.length + (OBJ.length === 1 ? " Objekt" : " Objekte") +
      "). Zuwachs gegenüber der Einlage: " + fEur(D.gewinn) + ".</div></div>";

    // Jahr für Jahr
    h += '<div class="card"><h2>Jahr für Jahr</h2>';
    h += '<p class="sub">Zahlungsströme dieses Projekts, Jahreszahlen wie im Portfolio.</p>';
    h += '<div class="sched-scroll"><table class="sched"><thead><tr>' +
      "<th>Jahr</th><th>Nutzungsentgelt</th><th>Zinsertrag</th><th>Zins</th><th>Tilgung</th><th>Anteil. Kosten</th><th>AfA</th><th>Steuer</th><th>Cashflow</th><th>Bankkonto</th><th>Restschuld</th>" +
      "</tr></thead><tbody>";
    D.rows.forEach(function (r) {
      var isExit = r.exit;
      h += "<tr" + (isExit ? ' class="exit-row"' : "") + "><td>" +
        (r.erwerb ? "Erwerb " + r.y : r.y + (isExit ? " · Verkauf" : (r.abloese ? " · Ablösung" : ""))) + "</td>";
      h += "<td>" + (r.erwerb ? "–" : fEur(r.ne)) + "</td>";
      h += "<td>" + (r.erwerb ? "–" : fEur(r.anlageErtrag || 0)) + "</td>";
      h += "<td>" + (r.erwerb ? "–" : fEur(r.zins + (r.kkZins || 0))) + "</td>";
      h += "<td>" + (r.erwerb ? "–" : fEur(r.tilg + (r.abloese ? r.payoff : 0))) + "</td>";
      h += "<td>" + (r.erwerb ? "–" : fEur(r.opex)) + "</td>";
      h += "<td>" + (r.erwerb ? "–" : fEur(r.afa)) + "</td>";
      h += "<td>" + (r.erwerb ? "–" : fEur(r.tax)) + "</td>";
      h += '<td class="' + (r.cashChange < 0 ? "neg" : "") + '">' + (r.erwerb ? "–" : (r.cashChange >= 0 ? "+" : "−") + fEur(Math.abs(r.cashChange))) + "</td>";
      h += '<td class="' + (r.cash < 0 ? "neg" : "") + '">' + fEur(r.cash) + "</td>";
      h += "<td>" + fEur(r.rest) + "</td></tr>";
    });
    h += "</tbody><tfoot><tr><td>Summe</td><td>" + fEur(D.neSum) + "</td><td></td><td></td><td>" + fEur(x.loan0) +
      "</td><td>" + fEur(D.opexSum) + "</td><td>" + fEur(x.cumAfa) + "</td><td>" + fEur(D.taxSum) +
      "</td><td>" + fEur(D.cashFinal) + "</td><td></td><td></td></tr></tfoot></table></div>";
    if (x.ablöseY > x.exitY) {
      h += '<p class="caption">Der Verkauf fällt in die Zinsbindung: Das Darlehen läuft nach dem Verkauf noch bis ' +
        fJahr(x.ablöseY) + " weiter, der Erlös liegt so lange zu " + fPct(G.anlage, 2) +
        " angelegt und verzinst sich mit " + fPct(G.anlage - o.zins, 2) + " gegenüber dem Sollzins.</p>";
    }
    h += "</div>";

    // Rechenwerke
    h += '<div class="card"><h2>Bilanz, GuV und Cashflow</h2>';
    h += '<p class="sub">Nur dieses Projekt, mit anteiligen Gemeinkosten und eigenständig gerechneter Steuer.</p>';
    h += '<div class="fin-scroll"><table class="fin">' +
      finTableHtml(D.rows, STMT_GROUPS, function (r) { return r.erwerb ? "Erwerb " + fJahr(r.y) : fJahr(r.y); }) +
      "</table></div>";
    h += '<p class="caption">Die maßgebliche Steuer entsteht auf Gesellschaftsebene: Im Portfolio werden Gewinne und Verluste aller Projekte verrechnet, hier wird das Projekt isoliert gerechnet. Die Summe der Einzelsteuern kann daher von der Portfoliosteuer abweichen.</p>';
    h += "</div>";

    // ---- Teil 3: Analyse ----
    h += '<div class="section-head"><h3>Analyse</h3><span class="sh-note">Wie belastbar die angenommene Haltedauer ist</span></div>';
    var A = exitAnalyse(o, opexShare, P.taxRate / 100);
    // Dieselbe Kostenbasis wie in der übrigen Objektrechnung, sonst stünden auf
    // einer Seite zwei verschiedene Renditen für denselben Vertrag.
    var oShare = opexShare;
    var F = mindestEntgelt(o, oShare, P.taxRate / 100);
    F.stell = STELLSCHRAUBEN.map(function (sch) { return kritischerWert(o, sch, oShare, P.taxRate / 100); });
    F.rendite = kritischeRendite(o, oShare, P.taxRate / 100);
    F.ohneHebel = ohneHebel(o, oShare, P.taxRate / 100);
    h += objektAnalyseHtml(o, A, F);

    host.innerHTML = h;
    document.getElementById("backBtn").addEventListener("click", closeDetail);
    var bR = host.querySelector("button[data-setzR]");
    if (bR) bR.addEventListener("click", function () {
      if (F.rendite.status !== "gefunden") return;
      G.mindestRendite = Math.max(0, Math.floor(F.rendite.wert * 4) / 4); // Schrittweite 0,25
      document.getElementById("panelGes").dataset.rebuild = "1";
      baueGruppen(document.getElementById("panelGes"), GES_GROUPS, G, "g", gesGeaendert);
      refresh();
    });
    host.querySelectorAll("button[data-setz]").forEach(function (b) {
      b.addEventListener("click", function () {
        var sch = STELLSCHRAUBEN[+b.dataset.setz];
        var K = F.stell[+b.dataset.setz];
        if (K.status !== "gefunden") return;
        // Auf die Schrittweite des Reglers runden, damit Anzeige und Rechnung
        // übereinstimmen — und zwar in die Richtung, die die Hürde sicher erreicht.
        var reg = null;
        OBJ_GROUPS.forEach(function (g) {
          g.items.forEach(function (it) { if (it.id === sch.k) reg = it; });
        });
        var wert = K.wert;
        if (reg && reg.step) {
          var auf = Math.ceil(K.wert / reg.step) * reg.step;
          var ab = Math.floor(K.wert / reg.step) * reg.step;
          wert = K.reichtRichtungMehr === false ? ab : auf;
          if (sch.richtung === "weniger") wert = ab;
          wert = Math.max(reg.min, Math.min(reg.max, Math.round(wert * 100) / 100));
        }
        OBJ[detailIdx][sch.k] = wert;
        // Panel neu aufbauen, damit der Regler den übernommenen Wert zeigt
        document.getElementById("panelObjekt").dataset.idx = "";
        refresh();
      });
    });
  }

  // ---------- Analyseseite ----------
  function exitChart(A, o) {
    var W = 820, H = 300, m = { l: 58, r: 58, t: 12, b: 26 };
    var pw = W - m.l - m.r, ph = H - m.t - m.b;
    var obereH = ph * 0.32, luecke = 14, untereH = ph - obereH - luecke;
    var pMax = Math.max.apply(null, A.w.slice(1, HMAX + 1)) || 1;

    var kws = A.kurve.map(function (p) { return p.kw; });
    // Die Nulllinie ist die Entscheidungsgrenze und muss immer im Bild sein
    var kwMax = Math.max(0, Math.max.apply(null, kws));
    var kwMin = Math.min(0, Math.min.apply(null, kws));
    if (kwMax === kwMin) kwMax = kwMin + 1;
    var spanne = kwMax - kwMin, kwHi = kwMax + spanne * 0.08, kwLo = kwMin - spanne * 0.08;

    function x(h) { return m.l + (h - 1) / (HMAX - 1) * pw; }
    function yP(v) { return m.t + obereH - v / pMax * obereH; }
    function yK(v) { return m.t + obereH + luecke + (kwHi - v) / (kwHi - kwLo) * untereH; }

    var s = [];
    // obere Fläche: Exitwahrscheinlichkeit
    s.push('<text x="' + m.l + '" y="' + (m.t + 9) + '" font-size="10.5" fill="var(--ink-3)">Wahrscheinlichkeit des Verkaufs im Jahr</text>');
    for (var h = 1; h <= HMAX; h++) {
      var bh = A.w[h] / pMax * obereH;
      var bw = Math.max(2, pw / HMAX - 2.5);
      s.push('<rect x="' + (x(h) - bw / 2).toFixed(1) + '" y="' + (m.t + obereH - bh).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, bh).toFixed(1) +
        '" rx="1.5" fill="var(--s3)" opacity="' + (h === o.hold ? "1" : "0.5") + '"/>');
    }
    s.push('<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (m.t + obereH) + '" y2="' + (m.t + obereH) + '" stroke="var(--axis)" stroke-width="1"/>');

    // untere Fläche: Kapitalwert über die Haltedauer
    var y0 = yK(0);
    s.push('<rect x="' + m.l + '" y="' + y0 + '" width="' + pw + '" height="' + Math.max(0, m.t + obereH + luecke + untereH - y0) + '" fill="var(--s2)" opacity="0.07"/>');
    s.push('<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y0 + '" y2="' + y0 + '" stroke="var(--axis)" stroke-width="1"/>');
    // Beschriftung nur setzen, wenn genug Abstand zur Nulllinie bleibt
    s.push('<text x="' + (m.l - 8) + '" y="' + (yK(0) + 4) + '" text-anchor="end" font-size="10.5" fill="var(--ink-3)">0</text>');
    [kwHi, kwLo].forEach(function (v) {
      if (Math.abs(yK(v) - yK(0)) < 14) return;
      s.push('<text x="' + (m.l - 8) + '" y="' + (yK(v) + 4) + '" text-anchor="end" font-size="10.5" fill="var(--ink-3)">' + fShort(v) + "</text>");
    });
    s.push('<text x="' + m.l + '" y="' + (m.t + obereH + luecke + 10) + '" font-size="10.5" fill="var(--ink-3)">Kapitalwert bei ' + fPct(G.mindestRendite, 2) + " Mindestrendite</text>");

    var p = "";
    A.kurve.forEach(function (pt) { p += (p === "" ? "M" : "L") + x(pt.h).toFixed(1) + " " + yK(pt.kw).toFixed(1); });
    s.push('<path d="' + p + '" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>');

    // Marken — Beschriftungen werden gestapelt, damit sie sich bei nahen Jahren nicht überlagern
    var belegt = [];
    function marke(h, farbe, text, oben) {
      if (!h || h < 1 || h > HMAX) return;
      var px = x(h);
      s.push('<line x1="' + px + '" x2="' + px + '" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="' + farbe + '" stroke-width="1" stroke-dasharray="3 3"/>');
      var basis = oben ? m.t + 22 : H - m.b - 6;
      var stufe = 0;
      while (belegt.some(function (b) { return b.y === basis + stufe * 13 && Math.abs(b.x - px) < 78; })) stufe += (oben ? 1 : -1);
      var py = basis + stufe * 13;
      belegt.push({ x: px, y: py });
      var rechtsbuendig = px > CWX - 90;
      s.push('<text x="' + (px + (rechtsbuendig ? -4 : 4)) + '" y="' + py + '" font-size="10.5"' +
        (rechtsbuendig ? ' text-anchor="end"' : "") + ' fill="' + farbe + '">' + text + "</text>");
    }
    var CWX = W - m.r;
    marke(A.beKW, "var(--s2)", "Break-even " + A.beKW, true);
    marke(o.hold, "var(--ink-2)", "gewählt " + o.hold, false);
    if (A.median) marke(A.median, "var(--s3)", "Median " + A.median, false);

    for (var t = 5; t <= HMAX; t += 5) {
      s.push('<text x="' + x(t) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10.5" fill="var(--ink-3)">' + t + "</text>");
    }
    s.push('<text x="' + (W - m.r) + '" y="' + (H - 6) + '" text-anchor="end" font-size="10.5" fill="var(--ink-3)">Haltedauer in Jahren</text>');

    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Exitwahrscheinlichkeit je Jahr und Kapitalwert über die Haltedauer">' + s.join("") + "</svg>";
  }

  // Objektbezogene Analyse — auf der Objektseite und in der Portfoliosicht wiederverwendet
  function objektAnalyseHtml(o, A, F) {
    var gew = A.gewaehlt;
    var h = "";
    if (F) {
      h += '<div class="card"><h2>Trägt sich dieser Vertrag?</h2>';
      h += '<p class="sub">Gemessen am gewichteten Kapitalwert über alle möglichen Haltedauern, gegen eine Hürde von ' +
        fPct(zielZins(o), 2) + " Mindestrendite auf das eingesetzte Eigenkapital.</p>";
      h += '<div class="derived"><span>Vereinbartes Nutzungsentgelt</span><b>' + fPct(o.ne, 2) + " p.a.</b></div>";
      if (F.status === "gefunden") {
        var reserve = o.ne - F.ne;
        h += '<div class="derived tight"><span>Nötiges Mindestentgelt</span><b class="' + (reserve < 0 ? "warnzahl" : "") + '">' +
          fPct(F.ne, 2) + " p.a.</b></div>";
        h += '<div class="derived need"><span>' + (reserve >= 0 ? "Reserve" : "Fehlt") + "</span><b>" +
          fPct(Math.abs(reserve), 2) + "-Punkte</b></div>";
        h += '<div class="ctl-note" style="margin-top:8px">Beim Mindestentgelt zahlt der Eigentümer ' +
          fEur(F.monat) + " im Monat, seine effektiven Jahreskosten lägen bei " + fPct(F.ownerCost) + ".</div>";
      } else if (F.status === "nicht bindend") {
        h += '<div class="derived tight"><span>Nötiges Mindestentgelt</span><b>unter ' + fPct(NE_MIN, 2) + "</b></div>";
        h += '<div class="ctl-note" style="margin-top:8px">Der Vertrag trägt sich in der gesamten zulässigen Spanne — die Hürde ist hier nicht bindend.</div>';
      } else {
        h += '<div class="derived tight"><span>Nötiges Mindestentgelt</span><b class="warnzahl">nicht erreichbar</b></div>';
        h += '<div class="ctl-note" style="margin-top:8px">Auch bei ' + fPct(NE_MAX, 2) +
          " bleibt der gewichtete Kapitalwert negativ. Ursache sind meist zu kurze erwartete Haltedauer, hohe Kaufnebenkosten oder Instandhaltungsverfall.</div>";
      }
      h += "</div>";

      var LZ = A.lz;
      var Rk = F.rendite;

      // ---- Kapitalwert: die Rechnung offengelegt ----
      // Der Zahlungsstrom hat genau zwei Punkte, deshalb lässt sich der Kapitalwert
      // Zeile für Zeile zeigen statt nur als Ergebnis zu behaupten.
      var eq0 = A.gewaehlt.equity0;
      var rZins = G.mindestRendite / 100;
      var fest = !LZ.auto;
      var rueckfluss = fest ? A.gewaehlt.endwert : A.eEndR;
      var jahrE = fest ? A.gewaehlt.ende : LZ.bindung;
      var npv = Rk.jetzt;                       // dieselbe Größe wie im Ankaufsfilter
      var barwertR = npv + eq0;                 // Kapitalwert = Barwert − Einsatz
      var faktor = eq0 !== 0 ? barwertR / rueckfluss : 0;

      h += '<div class="card"><h2>Kapitalwert (NPV)</h2>';
      h += '<p class="sub">Alle Zahlungen auf den Erwerbszeitpunkt abgezinst, Maßstab ist die Mindestrendite von ' +
        fPct(G.mindestRendite, 2) + '. Ein positiver Kapitalwert heißt: Das Projekt bringt mehr als den Anspruch — ein negativer, dass der Anspruch nicht gedeckt ist.</p>';
      h += '<div class="obj-scroll"><table class="sched"><thead><tr>' +
        "<th>Zahlung</th><th>Zeitpunkt</th><th>Betrag</th><th>Abzinsung</th><th>Barwert</th>" +
        "</tr></thead><tbody>";
      h += "<tr><td>Eigenkapital beim Erwerb</td><td>" + fJahr(o.start) + "</td><td>" + fEur(-eq0) +
        "</td><td>1,0000</td><td>" + fEur(-eq0) + "</td></tr>";
      h += "<tr><td>Rückfluss nach Ablösung des Darlehens" +
        (fest ? "" : '<span class="zsub">gewichtet über alle Verkaufszeitpunkte</span>') +
        "</td><td>" + (fest ? "" : "Ø ") + fJahr(o.start + jahrE) + "</td><td>" +
        (fest ? "" : "Ø ") + fEur(rueckfluss) + "</td><td>" +
        faktor.toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) +
        "</td><td>" + fEur(barwertR) + "</td></tr>";
      h += '<tr class="exit-row"><td>Kapitalwert</td><td></td><td></td><td></td><td class="' +
        (npv < 0 ? "neg" : "") + '">' + fEur(npv) + "</td></tr>";
      h += "</tbody></table></div>";
      h += '<div class="ctl-note" style="margin-top:10px">' +
        (fest
          ? "Abgezinst wird mit 1 / " + (1 + rZins).toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) +
            " hoch " + jahrE + " — " + fEur(rueckfluss) + " in " + fJahre(jahrE).replace(" Jahre", " Jahren") + " sind heute " + fEur(barwertR) + " wert."
          : "Jeder mögliche Verkaufszeitpunkt wird einzeln abgezinst und mit seiner Wahrscheinlichkeit gewichtet; die Abzinsung in der Tabelle ist das Ergebnis dieser Gewichtung, nicht ein einzelner Faktor.") +
        (Rk.status === "gefunden"
          ? " Der Kapitalwert wird genau dann null, wenn der Anspruch bei " + fPct(Rk.wert, 2) +
            " liegt — das ist die Rendite, die dieser Vertrag abwirft."
          : "") + "</div>";
      h += "</div>";

      // ---- Hebelwirkung: trägt sich der Vertrag aus sich heraus? ----
      var OH = F.ohneHebel;
      if (Rk.status === "gefunden" && OH && OH.status === "gefunden") {
        var hebel = Rk.wert - OH.wert;
        var wirkt = hebel > 0.02, neutral = Math.abs(hebel) <= 0.02;
        h += '<div class="card"><h2>Wirkt die Finanzierung für oder gegen das Projekt?</h2>';
        h += '<p class="sub">Dasselbe Objekt einmal ohne Darlehen gerechnet. Die Differenz ist der Beitrag der Finanzierung — sie kann auch negativ sein.</p>';
        h += '<div class="lz-box">';
        h += '<div class="derived tight"><span>Rendite ohne Darlehen</span><b>' + fPct(OH.wert, 2) + " p.a.</b></div>";
        h += '<div class="derived tight"><span>Rendite bei ' + fPct(o.ltv, 0) + " Beleihung</span><b>" +
          fPct(Rk.wert, 2) + " p.a.</b></div>";
        h += '<div class="derived need"><span>Beitrag der Finanzierung</span><b class="' +
          (wirkt || neutral ? "" : "warnzahl") + '">' + (hebel >= 0 ? "+" : "−") +
          fPct(Math.abs(hebel), 2) + "-Punkte</b></div>";
        h += '<div class="ctl-note" style="margin-top:8px">' +
          (o.ltv === 0
            ? "Ohne Beleihung gibt es keinen Hebel. Ein Darlehen lohnt sich, solange das Objekt mehr erwirtschaftet, als es nach Steuern kostet."
            : neutral
              ? "Die Finanzierung ist bei diesen Annahmen ergebnisneutral — der Sollzins entspricht nach Steuern gerade dem, was das Objekt erwirtschaftet."
              : wirkt
                ? "Das Objekt erwirtschaftet mehr, als das Darlehen nach Steuern kostet. Mehr Fremdkapital verbessert die Eigenkapitalrendite, erhöht aber auch die Abhängigkeit vom Anschlusszins."
                : "Das Darlehen kostet nach Steuern mehr, als das Objekt erwirtschaftet — der Hebel arbeitet gegen das Projekt. Weniger Fremdkapital verbessert das Ergebnis, löst aber das eigentliche Problem nicht: Der Vertrag trägt schon ohne Finanzierung nur " +
                  fPct(OH.wert, 2) + ".") +
          "</div>";
        h += "</div></div>";
      }

      // Umkehrrechnung je Stellschraube
      h += '<div class="card"><h2>Welche Stellschraube bringt die Mindestrendite?</h2>';
      h += '<p class="sub">Ziel sind ' + fPct(G.mindestRendite, 2) +
        ' auf das Eigenkapital, gerechnet einschließlich der anteiligen Gemeinkosten. Jede Zeile verändert genau eine Größe, alle übrigen bleiben unverändert; der kritische Wert ist der Punkt, an dem der gewichtete Kapitalwert gerade null wird.</p>';

      // Über welche Zeit gerechnet wird — eine Rendite ohne Laufzeit sagt nichts aus
      h += '<div class="lz-box">';
      h += '<div class="derived tight"><span>Vertragslaufzeit <em>= Kreditbindung</em></span><b>' +
        fJahre(LZ.kredit) + "</b></div>";
      h += '<div class="derived tight"><span>Verkauf des Anteils' +
        (LZ.auto ? ' <em>= Sterbetafel</em>' : ' <em>= feste Annahme</em>') + "</span><b>" +
        fJahre(LZ.verkauf) + "</b></div>";
      h += '<div class="derived need"><span>Kapitalbindung</span><b>' + fJahre(LZ.bindung) + "</b></div>";
      if (LZ.nachlauf > 0.05) {
        h += '<div class="ctl-note" style="margin-top:8px">Der Anteil wird vor dem Ende der Kreditbindung verkauft. Das Darlehen läuft weiter, der Erlös liegt ' +
          fJahre(LZ.nachlauf) + " in der Geldanlage zu " + fPct(G.anlage, 2) + ", während er " + fPct(o.zins, 2) +
          " Zinsen kostet — diese Zeit senkt die Rendite, ohne dass ein Nutzungsentgelt gegenübersteht." +
          (LZ.pNachlauf < 99.5 ? " Das betrifft " + fPct(LZ.pNachlauf, 0) + " der Fälle." : "") + "</div>";
      } else if (LZ.verkauf > LZ.kredit + 0.05) {
        h += '<div class="ctl-note" style="margin-top:8px">Der Vertrag läuft über die Kreditbindung hinaus. Für die Zeit danach ist keine Anschlusskondition unterstellt — der Sollzins gilt unverändert weiter.</div>';
      }
      h += "</div>";
      h += '<div class="obj-scroll"><table class="sched"><thead><tr>' +
        "<th>Stellschraube</th><th>eingestellt</th><th>kritischer Wert</th><th>Abstand</th><th>Status</th><th></th></tr></thead><tbody>";

      // Die Hürde selbst zuerst — sie zeigt, was der Vertrag tatsächlich abwirft
      var R = Rk;
      // Die Hürde in Gesamtrendite über die Kapitalbindung, der Jahreszins darunter —
      // ausgeschüttet wird nichts, der gesamte Rückfluss entsteht beim Verkauf.
      var zielGes = gesamtRendite(G.mindestRendite, LZ.bindung);
      h += '<tr class="exit-row"><td>Mindestrendite<span class="zsub">gesamt über ' + fJahre(LZ.bindung) +
        ' Kapitalbindung</span></td><td>' + fPct(zielGes, 1) +
        '<span class="zsub">' + fPct(G.mindestRendite, 2) + " p.a.</span></td>";
      if (R.status === "gefunden") {
        var istGes = gesamtRendite(R.exakt, LZ.bindung);
        h += "<td>" + fPct(istGes, 1) + '<span class="zsub">' + fPct(R.wert, 2) + " p.a.</span></td>";
        h += "<td>" + (R.reicht ? "+" : "−") + fPct(Math.abs(zielGes - istGes), 1) +
          '<span class="zsub">' + (R.reicht ? "+" : "−") + fPct(Math.abs(G.mindestRendite - R.wert), 2) + "</span></td>";
        h += '<td class="' + (R.reicht ? "" : "neg") + '">' + (R.reicht ? "erreicht" : "verfehlt") + "</td>";
        h += '<td><button type="button" class="act" data-setzR="1" title="Anspruch auf das Erreichbare senken">setzen</button></td>';
      } else {
        h += '<td colspan="3" class="neg">kein Wert im Bereich −20 bis 40 %</td><td></td>';
      }
      h += "</tr>";
      STELLSCHRAUBEN.forEach(function (sch, si) {
        var K = F.stell[si];
        var ist = o[sch.k];
        h += "<tr><td>" + sch.label + "</td><td>" + sch.fmt(ist) + "</td>";
        if (K.status === "gefunden") {
          var delta = Math.abs(ist - K.wert);
          h += "<td>" + sch.fmt(K.wert) + "</td>";
          h += "<td>" + (K.reicht ? "+" : "−") + sch.fmt(delta).replace(" p.a.", "") + "</td>";
          h += '<td class="' + (K.reicht ? "" : "neg") + '">' + (K.reicht ? "reicht" : "reicht nicht") + "</td>";
          h += '<td><button type="button" class="act" data-setz="' + si + '" title="Diesen Wert übernehmen">setzen</button></td>';
        } else if (K.status === "unkritisch") {
          h += '<td colspan="3">im gesamten Bereich unkritisch</td><td></td>';
        } else {
          h += '<td colspan="3" class="neg">reicht allein nicht aus</td><td></td>';
        }
        h += "</tr>";
      });
      h += "</tbody></table></div>";
      h += '<p class="caption">Die erste Zeile ist die Hürde selbst: Ihr kritischer Wert ist die Rendite, die dieser Vertrag bei den aktuellen Annahmen tatsächlich abwirft. Sie steht als Gesamtrendite über die Kapitalbindung, weil nichts ausgeschüttet wird — das Eigenkapital geht einmal hinein und kommt beim Verkauf einmal zurück; der Jahreszins darunter ist nur die Verteilung dieses einen Rückflusses auf die Zeit. Bei zugeschalteter Sterbetafel ist die Gesamtangabe auf die mittlere Kapitalbindung umgerechnet, weil dort jeder Pfad eine eigene Laufzeit hat. Sie gilt für die ganze Gesellschaft — wird sie gesenkt, ändert sich der Maßstab für alle Objekte. Die übrigen Zeilen betreffen nur dieses Objekt. „Reicht allein nicht aus“ bedeutet: Selbst am günstigsten Ende dieser Größe bleibt der Kapitalwert negativ, dann müssen mehrere Stellschrauben zusammen bewegt werden.</p>';
      h += "</div>";
    }
    h += '<div class="card"><div class="stat-row">';
    h += '<div><div class="stat-label">Erwartete Haltedauer</div><div class="stat-num">' +
      A.eH.toLocaleString("de-DE", { maximumFractionDigits: 1 }) +
      '</div><div class="stat-sub">Median ' + (A.median || "–") + " Jahre · " +
      (A.lz.auto ? "gerechnet wird die Verteilung" : "gerechnet wird die Annahme von " + fJahre(o.hold)) + "</div></div>";
    h += '<div><div class="stat-label"><span class="dot s2"></span>Break-even</div><div class="stat-num">' +
      (A.beKW ? A.beKW + " J." : "nie") +
      '</div><div class="stat-sub">' +
      (A.beKW ? "ab hier über " + fPct(G.mindestRendite, 2) : "Mindestrendite nie erreicht") +
      (A.beNull ? " · Kapitalerhalt ab " + A.beNull + " J." : "") + "</div></div>";
    h += '<div><div class="stat-label">Verkauf davor</div><div class="stat-num">' + fPct(A.pVorBE, 0) +
      '</div><div class="stat-sub">' + (A.beKW ? "Wahrscheinlichkeit eines Frühexits" : "kein Zeitpunkt erreicht die Hürde") + "</div></div>";
    h += '<div><div class="stat-label"><span class="dot s3"></span>' +
      (A.lz.auto ? "Erwartete Rendite" : "Rendite der Annahme") + '</div><div class="stat-num">' + fPct(A.eIrr) +
      '</div><div class="stat-sub">' + (A.lz.auto
        ? "über die Verteilung · " + fJahre(A.lz.bindung) + " gebunden"
        : fJahre(A.lz.verkauf) + " bis zum Verkauf · " + fJahre(A.lz.bindung) + " gebunden") + "</div></div>";
    h += "</div>";

    var diff = (A.eIrr !== null && gew.irr !== null) ? A.eIrr - gew.irr : null;
    h += '<div class="warn-note">Der Haushalt ist als <b>' + (o.haus || "Paar") + "</b> mit " + (o.alter || 75) +
      " Jahren hinterlegt. " +
      (String(o.haus || "").toLowerCase() === "paar"
        ? "Bei Paaren endet der Vertrag mit der zuletzt lebenden Person — das verlängert die Haltedauer um mehrere Jahre gegenüber einer Einzelperson. "
        : "Bei einer Einzelperson endet der Vertrag deutlich früher als bei einem Paar gleichen Alters. ") +
      (diff !== null
        ? "Über die gesamte Verteilung gerechnet liegt die Rendite bei " + fPct(A.eIrr) + ", die eingestellten " + o.hold +
          " Jahre ergeben " + fPct(gew.irr) + " — eine Abweichung von " + fPct(Math.abs(diff)) + "-Punkten."
        : "") +
      "</div></div>";

    h += '<div class="card">';
    h += '<div class="legend"><span><span class="swatch" style="background:var(--s3)"></span>Verkaufswahrscheinlichkeit je Jahr</span>' +
      '<span><span class="swatch" style="background:var(--s1)"></span>Kapitalwert der Beteiligung</span></div>';
    h += '<div class="chart-box">' + exitChart(A, o) + "</div>";
    h += '<p class="caption">Der Kapitalwert misst gegen die Mindestrendite von ' + fPct(G.mindestRendite, 2) +
      " — oberhalb der Nulllinie erreicht das Projekt den geforderten Anspruch. " +
      "Als Maßstab dient bewusst der Kapitalwert und nicht der interne Zinsfuß, der bei kurzen Haltedauern nicht eindeutig ist. " +
      "Die rot hinterlegte Zone ist die Verlustzone: Dort sind Grunderwerbsteuer und Notarkosten noch nicht verdient.</p>";
    h += "</div>";
    return h;
  }

  // Erwartete Rückflüsse aller Objekte auf der Portfolio-Zeitachse
  function portfolioRueckfluss(P, opexShare) {
    var maxJ = 0, reihen = [];
    P.objs.forEach(function (x, i) {
      var o = x.o;
      var A = exitAnalyse(o, opexShare, P.taxRate / 100);
      reihen.push({ o: o, x: x, A: A });
      maxJ = Math.max(maxJ, o.start + HMAX);
    });
    // Die Achse beginnt beim frühesten Erwerb, der vor dem Basisjahr liegen darf.
    var minJ = P.start0;
    var rueck = [], wahr = [];
    for (var j = minJ; j <= maxJ; j++) { rueck.push(0); wahr.push(0); }
    reihen.forEach(function (r) {
      for (var k = 1; k <= HMAX; k++) {
        var w = r.A.w[k];
        var jVerkauf = r.o.start + k;
        var jGeld = r.o.start + r.A.kurve[k - 1].ende;
        if (jVerkauf <= maxJ) wahr[jVerkauf - minJ] += w;
        if (jGeld <= maxJ) rueck[jGeld - minJ] += w * r.A.kurve[k - 1].endwert;
      }
    });
    return { reihen: reihen, rueck: rueck, wahr: wahr, maxJ: maxJ, minJ: minJ };
  }

  function rueckflussChart(R) {
    var W = 820, H = 250, m = { l: 62, r: 16, t: 14, b: 26 };
    var pw = W - m.l - m.r, ph = H - m.t - m.b;
    var T0 = R.minJ, T = R.maxJ, spanne = Math.max(1, T - T0);
    var maxV = Math.max.apply(null, R.rueck) || 1;
    function x(j) { return m.l + (j - T0) / spanne * pw; }
    function y(v) { return m.t + ph - v / maxV * ph; }
    var s = [];
    [0, maxV / 2, maxV].forEach(function (v) {
      s.push('<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="' + (v === 0 ? "var(--axis)" : "var(--grid)") + '" stroke-width="1"/>');
      s.push('<text x="' + (m.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="10.5" fill="var(--ink-3)">' + fShort(v) + "</text>");
    });
    var bw = Math.max(2, pw / (spanne + 1) - 2);
    R.rueck.forEach(function (v, idx) {
      if (v <= 0) return;
      var j = T0 + idx, bh = v / maxV * ph;
      s.push('<rect x="' + (x(j) - bw / 2).toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + bw.toFixed(1) +
        '" height="' + bh.toFixed(1) + '" rx="1.5" fill="var(--s1)" opacity="0.75"><title>' + fJahr(j) + ": " + fEur(v) + "</title></rect>");
    });
    var tick = spanne <= 12 ? 2 : (spanne <= 30 ? 5 : 10);
    for (var t = T0; t <= T; t += tick) {
      s.push('<text x="' + x(t) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10.5" fill="var(--ink-3)">' + fJahr(t) + "</text>");
    }
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Erwartete Rückflüsse je Jahr über alle Objekte">' + s.join("") + "</svg>";
  }

  // Portfolioweite Analyse — Gesamtsicht statt Einzelobjekt
  function renderAnalyse(P) {
    var host = document.getElementById("viewAnalyse");
    if (!P.objs.length) {
      host.innerHTML = '<div class="card"><h2>Analyse</h2><p class="sub">Noch keine Objekte — im Portfolio ein Objekt anlegen.</p></div>';
      return;
    }
    var opexShare = OBJ.length ? G.opex / OBJ.length : 0;
    var R = portfolioRueckfluss(P, opexShare);

    // Gewichtung nach Kapitaleinsatz
    var ekSumme = R.reihen.reduce(function (a, r) { return a + r.x.equity0; }, 0) || 1;
    var gewFrueh = 0, ohneBE = 0, gewRendite = 0, gewDauer = 0, abweichung = 0, rMitIrr = 0, kwSumme = 0;
    R.reihen.forEach(function (r) {
      var g = r.x.equity0 / ekSumme;
      gewFrueh += g * r.A.pVorBE;
      gewDauer += g * r.A.eH;
      if (r.A.eIrr !== null) { gewRendite += g * r.A.eIrr; rMitIrr += g; }
      if (!r.A.beKW) ohneBE++;
      kwSumme += eKapitalwert(r.A.kurve, r.A.wR, zielZins(r.o) / 100);
      if (!r.o.holdAuto) abweichung += Math.abs(r.o.hold - r.A.eH) * g;
    });

    var h = "";
    h += '<div class="card">';
    h += "<h2>Wann kommt das Geld zurück?</h2>";
    h += '<p class="sub">Die Haltedauer ist keine Entscheidung, sondern eine Verteilung — sie hängt daran, wie lange die Eigentümer wohnen bleiben. Diese Sicht fasst alle Verträge zusammen.</p>';
    h += '<div class="stat-row">';
    h += '<div><div class="stat-label">Erwartete Haltedauer</div><div class="stat-num">' +
      gewDauer.toLocaleString("de-DE", { maximumFractionDigits: 1 }) +
      '</div><div class="stat-sub">nach Kapitaleinsatz gewichtet</div></div>';
    h += '<div><div class="stat-label"><span class="dot s2"></span>Frühexit-Risiko</div><div class="stat-num">' + fPct(gewFrueh, 0) +
      '</div><div class="stat-sub">' + (ohneBE ? ohneBE + " von " + R.reihen.length + " ohne Break-even" : "alle Objekte erreichen den Break-even") + "</div></div>";
    h += '<div><div class="stat-label"><span class="dot s3"></span>Kapitalwert</div><div class="stat-num' + (kwSumme < 0 ? " warnzahl" : "") + '">' + fEur(kwSumme) +
      '</div><div class="stat-sub">gewichtet, gegen die Mindestrendite von ' + fPct(G.mindestRendite, 2) + "</div></div>";
    h += '<div><div class="stat-label">Abweichung</div><div class="stat-num">' +
      abweichung.toLocaleString("de-DE", { maximumFractionDigits: 1 }) +
      '</div><div class="stat-sub">Jahre zwischen Eingabe und Erwartung</div></div>';
    h += "</div>";
    if (abweichung >= 2) {
      h += '<div class="warn-note">Die eingestellten Haltedauern weichen im Mittel um ' +
        abweichung.toLocaleString("de-DE", { maximumFractionDigits: 1 }) +
        " Jahre von der statistischen Erwartung ab. Da alle Geldzahlen des Modells auf der eingestellten Haltedauer beruhen, " +
        "verschiebt das auch Rendite, Bilanz und Liquiditätsverlauf. Die Werte lassen sich je Objekt anpassen.</div>";
    }
    h += "</div>";

    h += '<div class="card"><h2>Erwartete Rückflüsse je Jahr</h2>';
    h += '<p class="sub">Wahrscheinlichkeitsgewichtet über alle Objekte. Der Rückfluss steht dort, wo das Geld tatsächlich frei wird — bei laufender Zinsbindung also erst nach deren Ende.</p>';
    h += '<div class="chart-box">' + rueckflussChart(R) + "</div>";
    var spitze = 0, spitzeJ = R.minJ;
    R.rueck.forEach(function (v, idx) { if (v > spitze) { spitze = v; spitzeJ = R.minJ + idx; } });
    h += '<p class="caption">Größter erwarteter Rückfluss ' + fJahr(spitzeJ) + " mit " + fEur(spitze) +
      ". Je stärker sich Rückflüsse auf wenige Jahre bündeln, desto mehr hängt das Ergebnis am Marktumfeld genau dieser Jahre.</p>";
    h += "</div>";

    h += '<div class="card"><h2>Objekte im Vergleich</h2>';
    h += '<p class="sub">Wie die Laufzeiten je Vertrag auseinanderfallen und was das für die Rendite bedeutet. Ein Klick öffnet das Projekt.</p>';
    h += '<div class="obj-scroll"><table class="sched"><thead><tr>' +
      "<th>Objekt</th><th>Haushalt</th><th>Alter</th><th>Verkauf</th><th>Kredit</th><th>Bindung</th><th>Entgelt</th><th>nötig</th><th>Kapitalwert negativ</th><th>Rendite</th>" +
      "</tr></thead><tbody>";
    R.reihen.forEach(function (r, i) {
      var g2 = r.A.gewaehlt;
      h += '<tr class="zeile" data-open="' + i + '" style="cursor:pointer" title="Projekt öffnen"><td style="color:var(--accent);font-weight:600">' +
        (r.o.name || "Objekt " + (i + 1)) + "</td>";
      var F = mindestEntgelt(r.o, opexShare, P.taxRate / 100);
      var noetig = F.status === "gefunden" ? fPct(F.ne, 2)
        : (F.status === "nicht bindend" ? "unter " + fPct(NE_MIN, 0) : "nicht erreichbar");
      var knapp = F.status === "nicht erreichbar" || (F.status === "gefunden" && F.ne > r.o.ne);
      h += "<td>" + (r.o.haus || "Paar") + "</td><td>" + (r.o.alter || 75) + "</td>";
      // Verkauf, Kreditbindung und die daraus folgende Kapitalbindung getrennt —
      // die Rendite bezieht sich auf die Bindung, nicht auf die Zeit bis zum Verkauf.
      var L2 = r.A.lz;
      h += "<td>" + fJahre(L2.verkauf).replace(" Jahre", "").replace(" Jahr", "") +
        (L2.auto ? " ◆" : "") + "</td>";
      h += "<td>" + L2.kredit + "</td>";
      h += '<td class="' + (L2.nachlauf > 0.05 ? "neg" : "") + '">' +
        fJahre(L2.bindung).replace(" Jahre", "").replace(" Jahr", "") + "</td>";
      h += "<td>" + fPct(r.o.ne, 2) + "</td>";
      h += '<td class="' + (knapp ? "neg" : "") + '">' + noetig + "</td>";
      h += '<td class="' + (r.A.pVorBE > 25 ? "neg" : "") + '">' + fPct(r.A.pVorBE, 0) + "</td>";
      h += "<td>" + fPct(r.A.eIrr) + "</td></tr>";
    });
    h += "</tbody></table></div>";
    h += '<p class="caption">Die Spalte „nötig“ nennt das Nutzungsentgelt, bei dem der gewichtete Kapitalwert gerade null wird. Weil der Kapitalwert linear in den Zahlungen ist, braucht diese Größe keine unterstellte Haltedauer. Alle Jahresangaben sind Jahre: „Verkauf“ ist der Zeitpunkt der Veräußerung — mit ◆ aus der Sterbetafel gewichtet, sonst die eingestellte Annahme —, „Kredit“ die Vertrags- und Kreditbindung, „Bindung“ die daraus folgende Kapitalbindung. Ist sie länger als die Zeit bis zum Verkauf, liegt der Erlös bis zur Ablösung in der Geldanlage; darauf bezieht sich die Rendite. Renditen einzelner Objekte lassen sich nicht mitteln, Kapitalwerte dagegen addieren. Die Verteilung eines einzelnen Objekts steht auf dessen Projektseite.</p>';
    h += "</div>";

    h += '<div class="card fine"><h2>Woher die Sterbewahrscheinlichkeiten kommen</h2>' +
      "<p>Zugrunde liegt eine Gompertz-Makeham-Funktion, kalibriert an die ferneren Lebenserwartungen der amtlichen Sterbetafel 2022/24 " +
      "(Alter 65, 70 und 80 je Geschlecht, Abweichung unter 0,4 Jahren). Bei „Paar“ wird die zuletzt lebende Person maßgeblich, " +
      "berechnet aus zwei unabhängigen Verläufen für Mann und Frau gleichen Alters.</p>" +
      "<p>Zwei bewusste Vereinfachungen, die in dieselbe Richtung wirken: Es handelt sich um eine Periodentafel, " +
      "eine Generationentafel läge höher. Und wer ein schuldenfreies Eigenheim besitzt, hat statistisch eine " +
      "überdurchschnittliche Lebenserwartung. Die tatsächliche Haltedauer dürfte daher eher über den hier gezeigten Werten liegen.</p>" +
      "<p>Die Auszugswahrscheinlichkeit für Pflegeheim oder freiwilligen Auszug ist ein Schätzwert und je Objekt einstellbar; " +
      "sie dominiert die ersten Jahre der Verteilung.</p></div>";

    host.innerHTML = h;
    host.querySelectorAll("tr.zeile[data-open]").forEach(function (tr) {
      tr.addEventListener("click", function () { openDetail(+tr.dataset.open); });
    });
  }

  // ---------- Render ----------
  // refresh() rechnet neu, ohne die Objekttabelle anzufassen — sonst verlöre das
  // gerade bearbeitete Feld bei jedem Tastendruck den Fokus.
  function refresh() {
    Object.keys(fmtOf).forEach(function (id) {
      var el = document.getElementById("valg_" + id);
      if (el) el.textContent = fmtOf[id](G[id]);
    });

    var P = portfolio();

    document.getElementById("taxRateOut").textContent = fPct(P.taxRate, 2);
    document.getElementById("investOut").textContent = fEur(P.investTotal);
    document.getElementById("equityOut").textContent = fEur(P.cumEinlage);

    var nachschuss = Math.max(0, -P.minCash);
    var zuwachs = P.cashFinal - P.cumEinlage;
    var hz = document.getElementById("hZuwachs");
    hz.textContent = OBJ.length ? (zuwachs >= 0 ? "+" : "−") + fEur(Math.abs(zuwachs)) : "–";
    hz.className = "hero-big" + (zuwachs < 0 ? " neg" : "");
    document.getElementById("hLabel").textContent = OBJ.length
      ? "Vermögenszuwachs bis " + fJahr(P.T)
      : "Vermögenszuwachs der Gesellschaft";
    document.getElementById("hNote").textContent = OBJ.length
      ? "Aus " + fEur(P.cumEinlage) + " Einlagen werden " + fEur(P.cashFinal) + " Liquidität. " +
        (nachschuss > 0
          ? "Zwischenzeitlich fehlen bis zu " + fEur(nachschuss) + " auf dem Konto."
          : "Das Konto bleibt durchgehend positiv.")
      : "Objekte hinzufügen, um das Portfolio zu berechnen.";

    document.getElementById("kObj").textContent = OBJ.length
      ? OBJ.length + (OBJ.length === 1 ? " Vertrag" : " Verträge")
      : "keine";
    document.getElementById("kNeed").textContent = fEur(P.cumEinlage + nachschuss);
    document.getElementById("kIrr").textContent = fPct(P.irr);
    document.getElementById("kCash").textContent = fEur(P.cashFinal);
    document.getElementById("kCost").textContent = fEur(P.taxSum + P.opexSum);

    renderContrib(P);

    if (detailIdx !== null && !P.objs[detailIdx]) detailIdx = null;
    var imDetail = detailIdx !== null;
    var imAnalyse = view === "analyse" && !imDetail;
    document.getElementById("viewPortfolio").hidden = imDetail || imAnalyse;
    document.getElementById("viewDetail").hidden = !imDetail;
    document.getElementById("viewAnalyse").hidden = !imAnalyse;
    document.querySelectorAll("#tabs .tab[data-view]").forEach(function (t) {
      var aktiv = (t.dataset.view === "analyse") === imAnalyse && !imDetail;
      if (aktiv) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    // Das geöffnete Objekt erscheint als eigener Reiter hinter dem Portfolio
    var tabObj = document.getElementById("tabObjekt");
    document.getElementById("tabSep").hidden = !imDetail;
    tabObj.hidden = !imDetail;
    if (imDetail) {
      tabObj.textContent = OBJ[detailIdx].name || "Objekt " + (detailIdx + 1);
      tabObj.setAttribute("aria-current", "page");
    }

    var po = document.getElementById("panelObjekt");
    po.hidden = !imDetail;
    if (imDetail) {
      if (po.dataset.idx !== String(detailIdx)) {
        po.dataset.idx = String(detailIdx);
        var kopf = document.createElement("div");
        kopf.className = "panel-kopf";
        kopf.textContent = "Annahmen dieses Objekts";
        baueGruppen(po, OBJ_GROUPS, OBJ[detailIdx], "o", function (nurText) {
          if (nurText) { refreshLeicht(); } else { refresh(); }
        });
        po.insertBefore(kopf, po.firstChild);
      }
      renderDetail(P);
    } else {
      po.dataset.idx = "";
      if (imAnalyse) renderAnalyse(P);
      else {
        buildObjectTable(P);
        buildChart(P);
        buildStatements(P);
      }
    }
  }

  // Bei reiner Namensänderung nicht das Panel neu bauen — sonst verliert das Feld den Fokus
  function refreshLeicht() {
    var P = portfolio();
    if (detailIdx !== null && P.objs[detailIdx]) {
      var nam = OBJ[detailIdx].name || "Objekt " + (detailIdx + 1);
      var t = document.querySelector("#viewDetail h2");
      if (t) t.textContent = nam;
      var tb = document.getElementById("tabObjekt");
      if (tb) tb.textContent = nam;
    }
  }

  document.querySelectorAll("#tabs .tab[data-view]").forEach(function (t) {
    t.addEventListener("click", function () {
      view = t.dataset.view;
      detailIdx = null;
      refresh();
      window.scrollTo(0, 0);
    });
  });

  baueGruppen(document.getElementById("panelGes"), GES_GROUPS, G, "g", gesGeaendert);
  refresh();
