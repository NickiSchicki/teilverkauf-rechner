  // ---------- Objekttabelle: reine Übersicht ----------
  var SPALTEN = [
    { h: "Objekt", sub: "Bezeichnung", col: "w-name", links: true,
      // Der Name ist die Schaltfläche zum Öffnen — als echter Knopf ist er mit
      // der Tastatur erreichbar und wird Vorleseprogrammen angesagt.
      get: function (o, x, i) { return '<button type="button" class="zeilen-knopf" data-open="' + i + '">' + esc(o.name || "Objekt " + (i + 1)) + "</button>"; } },
    { h: "Wert", sub: "bei Erwerb", kurz: "Wert bei Erwerb", col: "w-num", get: function (o) { return fEur(o.v0); } },
    { h: "Anteil", sub: "%", col: "w-narrow", get: function (o) { return fPct(o.share, 0); } },
    { h: "Entgelt", sub: "% p.a. der Auszahlung", kurz: "Entgelt, % p.a. der Auszahlung", col: "w-calc", get: function (o) { return fPct(o.ne, 2); } },
    { h: "Erwerb", sub: "Jahr", kurz: "Erwerbsjahr", col: "w-narrow", get: function (o) { return fJahr(o.start); } },
    { h: "Haltedauer", sub: "Jahre · ◆", kurz: "Haltedauer in Jahren", col: "w-mid", get: function (o) { return String(o.hold) + (o.holdAuto ? " ◆" : ""); } },
    { h: "Haushalt", sub: "Art / Alter", col: "w-mid", get: function (o) { return (o.haus || "Paar") + " " + (o.alter || 75); } },
    { h: "Auszahlung", sub: "heute", col: "w-calc", lead: true, get: function (o, x) { return fEur(x.P); } },
    { h: "Eigenkapital", sub: "beim Erwerb", col: "w-calc", get: function (o, x) { return fEur(x.equity0); } },
    { h: "Kosten Eigentümer", sub: "effektiv % p.a.", kurz: "Kosten Eigentümer, effektiv % p.a.", col: "w-calc", get: function (o, x) { return fPct(x.ownerCost); } }
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
      var x = P.verlaeufe[idx];
      html += '<tr class="zeile" data-row="' + idx + '">';
      SPALTEN.forEach(function (c, i) {
        // Der Feldname reist mit: Unter 620 px steht er als Beschriftung über
        // dem Wert, weil dort keine Spaltenköpfe mehr sichtbar sind.
        html += '<td class="' + (i === 0 ? "c-name" : "calc") + (c.lead ? " lead" : "") +
          '" data-l="' + esc(c.kurz || c.h + " " + c.sub) + '">' + c.get(x.o, x, idx) + "</td>";
      });
      html += '<td><button type="button" class="open" data-open="' + idx +
        '" aria-label="Objekt ' + (idx + 1) + ' öffnen" title="Öffnen">›</button></td>';
      html += '<td><button type="button" class="del" data-del="' + idx +
        '" aria-label="Objekt ' + (idx + 1) + ' entfernen" title="Entfernen">✕</button></td>';
      html += "</tr>";
    });

    html += '</tbody><tfoot><tr><td class="c-name">Summe</td>';
    for (var c2 = 1; c2 < 7; c2++) html += "<td></td>";
    html += '<td data-l="Auszahlung">' + fEur(P.payoutTotal) + '</td><td data-l="Eigenkapital">' +
      fEur(P.cumEinlage) + "</td><td></td><td></td><td></td></tr></tfoot>";
    t.innerHTML = html;

    t.querySelectorAll("button[data-del]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var i = +b.dataset.del;
        var nam = OBJ[i].a.name || "Objekt " + (i + 1);
        // Ohne Rückgängig muss die Rückfrage stehen: Auf dem Telefon liegt dieser
        // Knopf dicht neben dem Öffnen, und der Stand wird sofort gesichert.
        if (!window.confirm(nam + " entfernen? Das lässt sich nicht rückgängig machen.")) return;
        OBJ.splice(i, 1);
        refresh();
      });
    });
    t.querySelectorAll("button[data-open]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); openDetail(+b.dataset.open); });
    });
    t.querySelectorAll("tr.zeile").forEach(function (tr) {
      tr.addEventListener("click", function () { openDetail(+tr.dataset.row); });
    });

    var perObj = OBJ.length ? G.opex / OBJ.length : 0;
    document.getElementById("objCaption").textContent =
      "Laufende Kosten von " + fEur(G.opex) + " je Jahr verteilen sich auf " + OBJ.length +
      (OBJ.length === 1 ? " Objekt" : " Objekte") + " — " + fEur(perObj) +
      " je Vertrag und Jahr. Ein ◆ hinter der Haltedauer heißt: Der Wert ist der Median der Sterbetafel, " +
      "nicht die eingestellte Annahme. Alle weiteren Annahmen stehen auf der jeweiligen Objektseite.";
  }

  function objektAnlegen() {
    OBJ.push(Objekt.neu("Objekt " + (OBJ.length + 1)));
    // Direkt öffnen: Ein neues Objekt trägt Standardwerte und will eingestellt
    // werden — es in der Liste suchen zu lassen wäre ein unnötiger Schritt.
    detailIdx = OBJ.length - 1;
    refresh();
    window.scrollTo(0, 0);
  }
  document.getElementById("addBtn").addEventListener("click", objektAnlegen);
  document.getElementById("startBtn").addEventListener("click", objektAnlegen);

