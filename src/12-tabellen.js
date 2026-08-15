  // ---------- Rechenwerke und Beitragskarte ----------
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
        var werte = rows.map(row.f);
        html += '<tr' + (row.sum ? ' class="sum"' : "") + '><td><span class="zl">' + row.l +
          "</span>" + sparkline(werte, row.sum ? "var(--ink-2)" : "var(--ink-3)") + "</td>";
        var line = [row.l];
        werte.forEach(function (v) {
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
    if (!P.verlaeufe.length) {
      host.innerHTML = '<div class="empty">Noch keine Objekte.</div>';
      document.getElementById("contribCaption").textContent = "";
      return;
    }
    var max = Math.max.apply(null, P.verlaeufe.map(function (x) { return Math.abs(x.beitrag); })) || 1;
    var summe = P.verlaeufe.reduce(function (a, x) { return a + x.beitrag; }, 0);
    var h = '<div class="contrib">';
    P.verlaeufe.forEach(function (x, i) {
      var anteil = summe !== 0 ? x.beitrag / summe * 100 : 0;
      h += '<div class="contrib-row" data-open="' + i + '" role="button" tabindex="0">' +
        '<div class="contrib-name" title="' + esc(x.o.name || "") + '">' +
          esc(x.o.name || "Objekt " + (i + 1)) + "</div>" +
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
