  // ---------- Neuzeichnen und Verdrahtung ----------
  function refresh() {
    Object.keys(fmtOf).forEach(function (id) {
      var el = document.getElementById("valg_" + id);
      if (el) el.textContent = fmtOf[id](G[id]);
    });

    var P = portfolioJetzt().rechnen();

    document.getElementById("taxRateOut").textContent = fPct(P.taxRate, 2);
    document.getElementById("investOut").textContent = fEur(P.investTotal);
    document.getElementById("equityOut").textContent = fEur(P.cumEinlage);

    var nachschuss = Math.max(0, -P.minCash);
    var zuwachs = P.cashFinal - P.cumEinlage;
    // Die Rendite führt, nicht die Zuwachssumme: Über fünfzehn Jahre wächst fast
    // jeder Vertrag absolut, entscheidend ist der Abstand zum eigenen Anspruch.
    var ziel = G.mindestRendite, ist = P.irr;
    var hz = document.getElementById("hZuwachs");
    hz.textContent = OBJ.length ? fPct(ist, 1) : "";
    hz.className = "hero-big" + (OBJ.length && ist !== null && ist < ziel - 0.05 ? " neg" : "");
    document.getElementById("hLabel").textContent = OBJ.length
      ? "Rendite auf das Eigenkapital bis " + fJahr(P.T)
      : "Noch kein Vertrag angelegt";

    // Balken: erreichter Anteil des Anspruchs, Marke sitzt beim Anspruch selbst.
    var spanne = Math.max(ziel, ist === null ? 0 : ist, 1) * 1.15;
    var erreicht = OBJ.length && ist !== null ? Math.max(0, Math.min(100, ist / spanne * 100)) : 0;
    var markeBei = Math.max(0, Math.min(100, ziel / spanne * 100));
    // Ohne Objekte gibt es nichts zu messen — dann steht statt des Balkens der Einstieg.
    document.getElementById("zielBlock").hidden = !OBJ.length;
    document.getElementById("startBtn").hidden = !!OBJ.length;
    var bIst = document.getElementById("zielIst"), bMarke = document.getElementById("zielMarke");
    bIst.style.width = erreicht + "%";
    bIst.className = "ziel-ist" + (ist !== null && ist < ziel - 0.05 ? " unter" : "");
    bMarke.style.left = "calc(" + markeBei + "% - 1px)";
    document.getElementById("zielText").innerHTML = !OBJ.length ? ""
      : (ist === null ? "Kein Zinsfuß bestimmbar."
        : ist < ziel - 0.05
          ? "<b>" + fPct(ziel - ist, 2) + "</b> unter dem Anspruch von " + fPct(ziel, 2)
          : "<b>" + fPct(ist - ziel, 2) + "</b> über dem Anspruch von " + fPct(ziel, 2));

    document.getElementById("hNote").textContent = OBJ.length
      ? "Aus " + fEur(P.cumEinlage) + " Einlagen werden " + fEur(P.cashFinal) + " Liquidität. " +
        (nachschuss > 0
          ? "Zwischenzeitlich fehlen bis zu " + fEur(nachschuss) + " auf dem Konto."
          : "Das Konto bleibt durchgehend positiv.")
      : "Jeder Vertrag trägt seine eigenen Annahmen — Immobilienwert, Anteil, Nutzungsentgelt, Finanzierung. " +
        "Auf Gesellschaftsebene gelten nur laufende Kosten, Steuersätze und den Renditeanspruch.";

    document.getElementById("kObj").textContent = OBJ.length
      ? OBJ.length + (OBJ.length === 1 ? " Vertrag" : " Verträge")
      : "keine";
    document.getElementById("kNeed").textContent = fEur(P.cumEinlage + nachschuss);
    document.getElementById("kZuw").textContent = OBJ.length ? (zuwachs >= 0 ? "+" : "−") + fEur(Math.abs(zuwachs)) : "–";
    document.getElementById("kCash").textContent = fEur(P.cashFinal);
    document.getElementById("kCost").textContent = fEur(P.taxSum + P.opexSum);

    document.getElementById("brueckeBox").innerHTML = OBJ.length
      ? brueckeChart(bilanzBruecke(P.rows)) : "";

    renderContrib(P);

    // Karten, die ohne Objekte nichts zeigen können, bleiben weg — ein leeres
    // Portfolio soll auf den Einstieg zeigen, nicht auf fünf leere Kästen.
    ["cardBeitrag", "cardChart", "cardFin", "cardBruecke"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.hidden = !OBJ.length;
    });

    // Die Einleitung erklärt den Aufbau des Modells und gehört auf die Einstiegsseite.
    // Auf Objekt- und Analyseseite kostet sie nur Platz über dem eigentlichen Inhalt.
    var lede = document.getElementById("lede");
    if (lede) lede.hidden = detailIdx !== null || view === "analyse";

    if (detailIdx !== null && !P.verlaeufe[detailIdx]) detailIdx = null;
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
      tabObj.textContent = OBJ[detailIdx].a.name || "Objekt " + (detailIdx + 1);
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
        baueGruppen(po, OBJ_GROUPS, OBJ[detailIdx].a, "o", function (nurText) {
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
    var P = portfolioJetzt().rechnen();
    if (detailIdx !== null && P.verlaeufe[detailIdx]) {
      var nam = OBJ[detailIdx].a.name || "Objekt " + (detailIdx + 1);
      var t = document.querySelector("#viewDetail h2");
      if (t) t.textContent = nam;
      var tb = document.getElementById("tabObjekt");
      if (tb) tb.textContent = nam;
    }
  }


  // ---------- Start ----------
  function start() {
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
  }
