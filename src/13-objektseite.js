  // ---------- Objektseite ----------
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
        var werte = rows.map(row.f);
        html += '<tr' + (row.sum ? ' class="sum"' : "") + '><td><span class="zl">' + row.l +
          "</span>" + sparkline(werte, row.sum ? "var(--ink-2)" : "var(--ink-3)") + "</td>";
        werte.forEach(function (v) {
          html += '<td class="' + (v < -0.5 ? "neg" : "") + '">' + fEur(v) + "</td>";
        });
        html += "</tr>";
      });
    });
    return html + "</tbody>";
  }


  function renderDetail(P) {
    var host = document.getElementById("viewDetail");
    var ob = OBJ[detailIdx];
    if (!ob) { detailIdx = null; return; }
    var x = P.verlaeufe[detailIdx];
    var o = x.o;   // Rechnungsgrundlage: bei Sterbetafel-Kopplung die gerechnete Haltedauer
    var opexShare = PF.opexShare;
    var D = ob.rechenwerk(PF.ctx, ob.holdEffektiv());
    D.irr = ob.projektRendite(PF.ctx, ob.holdEffektiv());
    // Alle Kennzahlen einmal gerechnet — jeder Block liest aus derselben Mappe.
    var KZ = kennzahlenFuer(ob).alles();

    var h = "";
    h += '<div class="card">';
    h += '<button type="button" class="crumb" id="backBtn">‹ Zurück zum Portfolio</button>';
    h += "<h2>" + esc(o.name || "Objekt " + (detailIdx + 1)) + "</h2>";
    h += '<p class="sub">Erwerb ' + fJahr(o.start) + ", Verkauf " + fJahr(x.exitY) +
      " · " + fPct(o.share, 0) + " Anteil an " + fEur(o.v0) + " · Nutzungsentgelt " + fPct(o.ne, 2) + " p.a.</p>";

    // Die Antwort zuerst: Wer diese Seite öffnet, will wissen, ob der Vertrag den
    // Anspruch deckt. Vorher stand das erst nach fünf Bildschirmen.
    var Rq = KZ.rendite, zielQ = G.mindestRendite;
    if (Rq.status === "gefunden") {
      var trifft = Rq.wert >= zielQ - 0.02;
      var spanneQ = Math.max(zielQ, Rq.wert, 1) * 1.15;
      h += '<div class="urteil ' + (trifft ? "gut" : "knapp") + '">';
      h += '<div class="urteil-zahl">' + fPct(Rq.wert, 2) + "</div>";
      h += '<div class="urteil-rest">';
      h += '<div class="ziel-bar"><div class="ziel-ist' + (trifft ? "" : " unter") + '" style="width:' +
        Math.max(0, Math.min(100, Rq.wert / spanneQ * 100)) + '%"></div>' +
        '<div class="ziel-marke" style="left:calc(' + Math.max(0, Math.min(100, zielQ / spanneQ * 100)) + '% - 1px)"></div></div>';
      h += '<div class="ziel-text">' + (trifft
        ? "<b>" + fPct(Rq.wert - zielQ, 2) + "</b> über dem Anspruch von " + fPct(zielQ, 2)
        : "<b>" + fPct(zielQ - Rq.wert, 2) + "</b> unter dem Anspruch von " + fPct(zielQ, 2)) +
        " · über " + fJahre(KZ.lz.bindung) + " Kapitalbindung</div>";
      h += "</div></div>";
    }
    h += "</div>";

    // ---- Teil 1: Vertrag ----
    h += '<div class="section-head"><h3>Vertrag</h3><span class="sh-note">Was mit dem Eigentümer vereinbart ist</span></div>';

    h += '<div class="card"><div class="stat-row">';
    h += '<div><div class="stat-label">Auszahlung</div><div class="stat-num">' + fEur(x.P) +
      '</div><div class="stat-sub">an den Eigentümer</div></div>';
    h += '<div><div class="stat-label">Monatliche Rate</div><div class="stat-num">' + fEur(x.P * (o.ne / 100) / 12) +
      '</div><div class="stat-sub">' + (o.esc === 0 ? "fest bis zum Verkauf" : "steigt um " + fPct(o.esc, 2) + " p.a.") + "</div></div>";
    h += '<div><div class="stat-label">Haltedauer</div><div class="stat-num">' + o.hold +
      ' <span class="einheit">Jahre</span></div><div class="stat-sub">bis zum Verkauf des Anteils</div></div>';
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
    var LZd = KZ.lz;
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
    h += '<div class="card"><h2>Woher das Vermögen kommt</h2>';
    h += '<p class="sub">Vom eingesetzten Eigenkapital zur Schlussliquidität dieses Projekts, mit anteiligen Gemeinkosten.</p>';
    h += '<div class="bar-legend"><span><span class="sq" style="background:var(--s3)"></span>trägt bei</span>' +
      '<span><span class="sq" style="background:var(--s2)"></span>zieht ab</span>' +
      '<span><span class="sq" style="background:var(--ink-3)"></span>Bestand</span></div>';
    h += '<div class="chart-box">' + brueckeChart(bilanzBruecke(D.rows)) + "</div>";
    h += "</div>";

    h += '<details class="card ausklapp"><summary><h2>Jahr für Jahr</h2>' +
      '<span class="ausklapp-hinweis">Zahlungsströme dieses Projekts</span></summary>';
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
    h += "</details>";

    // Rechenwerke

    h += '<details class="card ausklapp"><summary><h2>Bilanz, GuV und Cashflow</h2>' +
      '<span class="ausklapp-hinweis">Nur dieses Projekt, mit anteiligen Gemeinkosten</span></summary>';
    h += '<div class="fin-scroll"><table class="fin">' +
      finTableHtml(D.rows, rechenwerkGruppen(false), function (r) { return r.erwerb ? "Erwerb " + fJahr(r.y) : fJahr(r.y); }) +
      "</table></div>";
    h += '<p class="caption">Die maßgebliche Steuer entsteht auf Gesellschaftsebene: Im Portfolio werden Gewinne und Verluste aller Projekte verrechnet, hier wird das Projekt isoliert gerechnet. Die Summe der Einzelsteuern kann daher von der Portfoliosteuer abweichen.</p>';
    h += "</details>";

    // ---- Teil 3: Analyse ----
    h += '<div class="section-head"><h3>Analyse</h3><span class="sh-note">Wie belastbar die angenommene Haltedauer ist</span></div>';
    var A = KZ.A;
    // Dieselbe Kostenbasis wie in der übrigen Objektrechnung, sonst stünden auf
    // einer Seite zwei verschiedene Renditen für denselben Vertrag.
    var oShare = opexShare;
    var F = KZ.entgelt;
    F.stell = KZ.stell;
    F.rendite = KZ.rendite;
    F.ohneHebel = KZ.ohneHebel;
    F.werterhalt = KZ.werterhalt;
    h += objektAnalyseHtml(o, A, F);

    host.innerHTML = h;
    document.getElementById("backBtn").addEventListener("click", closeDetail);
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
        OBJ[detailIdx].a[sch.k] = wert;
        // Panel neu aufbauen, damit der Regler den übernommenen Wert zeigt
        document.getElementById("panelObjekt").dataset.idx = "";
        refresh();
      });
    });
  }
