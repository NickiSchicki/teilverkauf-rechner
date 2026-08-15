  // ---------- Diagramme ----------
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

    P.verlaeufe.forEach(function (o) {
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
