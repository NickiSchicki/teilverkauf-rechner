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
