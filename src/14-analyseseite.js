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
    s.push('<text x="' + m.l + '" y="' + (m.t + obereH + luecke + 10) + '" font-size="10.5" fill="var(--ink-3)">Kapitalwert bei ' + ZIEL.wert() + " " + ZIEL.name + "</text>");

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

    // Der Achsentitel sitzt rechts außen; der letzte Tick würde darunter geraten,
    // deshalb endet die Skala rechtzeitig davor.
    var titelAb = W - m.r - 108;
    for (var t = 5; t <= HMAX; t += 5) {
      if (x(t) > titelAb) continue;
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
      h += '<p class="sub">Gemessen am gewichteten Kapitalwert über alle möglichen Haltedauern, gegen einen Renditeanspruch von ' +
        fPct(zielZins(), 2) + " an das eingesetzte Eigenkapital.</p>";
      h += '<div class="derived"><span>Vereinbartes Nutzungsentgelt</span><b>' + fPct(o.ne, 2) + " p.a.</b></div>";
      if (F.status === "gefunden") {
        var reserve = o.ne - F.ne;
        h += '<div class="derived tight"><span>Nötiges Nutzungsentgelt</span><b class="' + (reserve < 0 ? "warnzahl" : "") + '">' +
          fPct(F.ne, 2) + " p.a.</b></div>";
        h += '<div class="derived need"><span>' + (reserve >= 0 ? "Reserve" : "Fehlt") + "</span><b>" +
          fPct(Math.abs(reserve), 2) + "-Punkte</b></div>";
        h += '<div class="ctl-note" style="margin-top:8px">Bei diesem Entgelt zahlt der Eigentümer ' +
          fEur(F.monat) + " im Monat, seine effektiven Jahreskosten lägen bei " + fPct(F.ownerCost) + ".</div>";
      } else if (F.status === "nicht bindend") {
        h += '<div class="derived tight"><span>Nötiges Nutzungsentgelt</span><b>unter ' + fPct(NE_MIN, 2) + "</b></div>";
        h += '<div class="ctl-note" style="margin-top:8px">Der Vertrag trägt sich in der gesamten zulässigen Spanne — die Hürde ist hier nicht bindend.</div>';
      } else {
        h += '<div class="derived tight"><span>Nötiges Nutzungsentgelt</span><b class="warnzahl">nicht erreichbar</b></div>';
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
      h += '<p class="sub">Alle Zahlungen auf den Erwerbszeitpunkt abgezinst, Maßstab ist der Renditeanspruch von ' +
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

      // ---- Welcher Immobilienwert trägt den Anspruch? ----
      // Die zweite Ertragsquelle neben dem Entgelt ist der Verkaufserlös. Als
      // Wachstumsrate ist er schwer einzuschätzen, als Anteil des heutigen Werts
      // dagegen vergleichbar mit dem, was man dem Markt zutraut.
      var WE = F.werterhalt;
      h += '<div class="card"><h2>Welchen Immobilienwert braucht der Vertrag?</h2>';
      h += '<p class="sub">Alles andere unverändert: Auf welchen Anteil des heutigen Werts muss der Verkaufspreis kommen, damit der Renditeanspruch aufgeht? Das hängt am verkauften Anteil, am Entgelt und an allen Kosten.</p>';
      if (WE.status === "gefunden") {
        var fehlt = WE.noetig - WE.jetzt;
        h += '<div class="derived"><span>Heutiger Immobilienwert</span><b>' + fEur(o.v0) + "</b></div>";
        h += '<div class="derived tight"><span>Nötiger Verkaufspreis ' + fJahr(o.start + Math.round(WE.jahre)) +
          '</span><b class="' + (WE.reicht ? "" : "warnzahl") + '">' + fEur(WE.preis) + "</b></div>";
        h += '<div class="derived tight"><span>entspricht</span><b class="' + (WE.reicht ? "" : "warnzahl") + '">' +
          fPct(WE.noetig, 0) + " des heutigen Werts</b></div>";
        h += '<div class="derived need"><span>' + (WE.reicht ? "Die Annahmen ergeben" : "Die Annahmen ergeben nur") +
          "</span><b>" + fPct(WE.jetzt, 0) + "</b></div>";
        h += '<div class="ctl-note" style="margin-top:8px">' +
          (WE.noetig >= 100
            ? "Der Wert müsste um " + fPct(WE.noetig - 100, 0) + " steigen, das sind " +
              fPct(WE.wachstum, 2) + " im Jahr über " + fJahre(WE.jahre) + ". "
            : "Der Wert dürfte auf " + fPct(WE.noetig, 0) + " fallen und der Vertrag trüge sich noch. ") +
          (WE.reicht
            ? "Die eingestellte Wertentwicklung reicht dafür aus."
            : "Es fehlen " + fPct(fehlt, 0) + "-Punkte — über den Verkaufserlös allein ist der Anspruch damit nicht zu decken.") +
          "</div>";
      } else if (WE.status === "immer") {
        h += '<div class="derived"><span>Nötiger Werterhalt</span><b>unter dem Prüfbereich</b></div>';
        h += '<div class="ctl-note" style="margin-top:8px">Der Vertrag trägt sich auch bei stark fallenden Preisen — das laufende Entgelt deckt den Anspruch allein.</div>';
      } else {
        h += '<div class="derived"><span>Nötiger Werterhalt</span><b class="warnzahl">nicht erreichbar</b></div>';
        h += '<div class="ctl-note" style="margin-top:8px">Selbst bei sehr starkem Wertzuwachs bleibt der Kapitalwert negativ. Dann tragen die laufenden Kosten und der Kapitaldienst mehr, als ein Verkauf je einbringen kann.</div>';
      }
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
      h += '<div class="card"><h2>Welche Stellschraube bringt den Renditeanspruch?</h2>';
      h += '<p class="sub">Ziel sind ' + fPct(G.mindestRendite, 2) +
        ' auf das Eigenkapital, gerechnet einschließlich der anteiligen Gemeinkosten. Jede Zeile verändert genau eine Größe, alle übrigen bleiben unverändert; der kritische Wert ist der Punkt, an dem der gewichtete Kapitalwert gerade null wird.</p>';

      // Über welche Zeit gerechnet wird — eine Rendite ohne Laufzeit sagt nichts aus
      h += '<div class="lz-box">';
      h += '<div class="derived tight"><span>Vertragslaufzeit ' +
        (LZ.kredit === null ? "<em>ohne Darlehen</em>" : "<em>= Kreditbindung</em>") + "</span><b>" +
        (LZ.kredit === null ? "—" : fJahre(LZ.kredit)) + "</b></div>";
      h += '<div class="derived tight"><span>Verkauf des Anteils' +
        (LZ.auto ? ' <em>= Sterbetafel</em>' : ' <em>= feste Annahme</em>') + "</span><b>" +
        fJahre(LZ.verkauf) + "</b></div>";
      h += '<div class="derived need"><span>Kapitalbindung</span><b>' + fJahre(LZ.bindung) + "</b></div>";
      if (LZ.nachlauf > 0.05) {
        h += '<div class="ctl-note" style="margin-top:8px">Der Anteil wird vor dem Ende der Kreditbindung verkauft. Das Darlehen läuft weiter, der Erlös liegt ' +
          fJahre(LZ.nachlauf) + " in der Geldanlage zu " + fPct(G.anlage, 2) + ", während er " + fPct(o.zins, 2) +
          " Zinsen kostet — diese Zeit senkt die Rendite, ohne dass ein Nutzungsentgelt gegenübersteht." +
          (LZ.pNachlauf < 99.5 ? " Das betrifft " + fPct(LZ.pNachlauf, 0) + " der Fälle." : "") + "</div>";
      } else if (LZ.kredit !== null && LZ.verkauf > LZ.kredit + 0.05) {
        h += '<div class="ctl-note" style="margin-top:8px">Der Vertrag läuft über die Kreditbindung hinaus. Für die Zeit danach ist keine Anschlusskondition unterstellt — der Sollzins gilt unverändert weiter.</div>';
      }
      h += "</div>";
      h += '<div class="obj-scroll"><table class="sched"><thead><tr>' +
        "<th>Stellschraube</th><th>eingestellt</th><th>kritischer Wert</th><th>Abstand<span class=\"th-sub\">Anteil am Reglerweg</span></th><th>Status</th><th></th></tr></thead><tbody>";

      // Die Hürde selbst zuerst — sie zeigt, was der Vertrag tatsächlich abwirft
      var R = Rk;
      // Die Hürde in Gesamtrendite über die Kapitalbindung, der Jahreszins darunter —
      // ausgeschüttet wird nichts, der gesamte Rückfluss entsteht beim Verkauf.
      var zielGes = gesamtRendite(G.mindestRendite, LZ.bindung);
      h += '<tr class="exit-row"><td>Renditeanspruch<span class="zsub">gesamt über ' + fJahre(LZ.bindung) +
        ' Kapitalbindung</span></td><td>' + fPct(zielGes, 1) +
        '<span class="zsub">' + fPct(G.mindestRendite, 2) + " p.a.</span></td>";
      if (R.status === "gefunden") {
        var istGes = gesamtRendite(R.exakt, LZ.bindung);
        h += "<td>" + fPct(istGes, 1) + '<span class="zsub">' + fPct(R.wert, 2) + " p.a.</span></td>";
        h += "<td>" + (R.reicht ? "+" : "−") + fPct(Math.abs(zielGes - istGes), 1) +
          '<span class="zsub">' + (R.reicht ? "+" : "−") + fPct(Math.abs(G.mindestRendite - R.wert), 2) + "</span></td>";
        h += '<td class="' + (R.reicht ? "" : "neg") + '">' + (R.reicht ? "erreicht" : "verfehlt") + "</td>";
        h += "<td></td>";   // Der Anspruch wird vorgegeben, nicht ans Ergebnis angepasst.
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
          // Die Abstände tragen verschiedene Einheiten und lassen sich nicht direkt
          // vergleichen. Der Balken normiert sie auf den Regelbereich der jeweiligen
          // Größe: Wie weit müsste man diesen einen Regler ziehen?
          var anteil = Math.max(0, Math.min(1, delta / Math.max(1e-9, sch.max - sch.min)));
          h += '<td><div class="weg">' +
            '<span class="weg-zahl">' + (K.reicht ? "+" : "−") +
            (sch.fmtDelta ? sch.fmtDelta(delta) : sch.fmt(delta).replace(" p.a.", "")) + "</span>" +
            '<span class="weg-bar"><i class="' + (K.reicht ? "" : "fern") + '" style="width:' +
            (anteil * 100).toFixed(1) + '%"></i></span></div></td>';
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
      h += '<p class="caption">Die erste Zeile ist der Anspruch selbst: Sein kritischer Wert ist die Rendite, die dieser Vertrag tatsächlich abwirft — als Gesamtrendite über die Kapitalbindung, weil nichts ausgeschüttet wird. Sie gilt für die ganze Gesellschaft, die übrigen Zeilen nur für dieses Objekt. „Reicht allein nicht aus“ heißt: Selbst am günstigsten Ende dieser Größe bleibt der Kapitalwert negativ.</p>';
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
      (A.beKW ? "ab hier über " + fPct(G.mindestRendite, 2) : "Renditeanspruch nie erreicht") +
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
    h += '<div class="warn-note">Haushalt <b>' + (o.haus || "Paar") + "</b>, " + (o.alter || 75) + " Jahre. " +
      (String(o.haus || "").toLowerCase() === "paar"
        ? "Bei Paaren endet der Vertrag mit der zuletzt lebenden Person, das verlängert die Haltedauer deutlich. "
        : "Bei einer Einzelperson endet der Vertrag früher als bei einem Paar gleichen Alters. ") +
      (diff !== null
        ? "Über die Verteilung: " + fPct(A.eIrr) + ", bei " + o.hold + " Jahren: " + fPct(gew.irr) + "."
        : "") +
      "</div></div>";

    h += '<div class="card">';
    h += '<div class="legend"><span><span class="swatch" style="background:var(--s3)"></span>Verkaufswahrscheinlichkeit je Jahr</span>' +
      '<span><span class="swatch" style="background:var(--s1)"></span>Kapitalwert der Beteiligung</span></div>';
    h += '<div class="chart-box">' + exitChart(A, o) + "</div>";
    h += '<p class="caption">Der Kapitalwert misst gegen den Renditeanspruch von ' + fPct(G.mindestRendite, 2) +
      " — oberhalb der Nulllinie erreicht das Projekt den Anspruch. " +
      "Die rot hinterlegte Zone ist die Verlustzone: Dort sind Grunderwerbsteuer und Notarkosten noch nicht verdient.</p>";
    h += "</div>";
    return h;
  }

  // Erwartete Rückflüsse aller Objekte auf der Portfolio-Zeitachse
  function portfolioRueckfluss(P, opexShare) {
    var maxJ = 0, reihen = [];
    P.verlaeufe.forEach(function (x, i) {
      var ob = OBJ[i], o = x.o;
      reihen.push({ ob: ob, o: o, x: x, A: kennzahlenFuer(ob).analyse() });
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
    if (!P.verlaeufe.length) {
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
      kwSumme += gewKapitalwert(r.A.kurve, r.A.wR, zielZins() / 100);
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
      '</div><div class="stat-sub">gewichtet, gegen den Renditeanspruch von ' + fPct(G.mindestRendite, 2) + "</div></div>";
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
      var F = kennzahlenFuer(r.ob).mindestEntgelt();
      var noetig = F.status === "gefunden" ? fPct(F.ne, 2)
        : (F.status === "nicht bindend" ? "unter " + fPct(NE_MIN, 0) : "nicht erreichbar");
      var knapp = F.status === "nicht erreichbar" || (F.status === "gefunden" && F.ne > r.o.ne);
      h += "<td>" + (r.o.haus || "Paar") + "</td><td>" + (r.o.alter || 75) + "</td>";
      // Verkauf, Kreditbindung und die daraus folgende Kapitalbindung getrennt —
      // die Rendite bezieht sich auf die Bindung, nicht auf die Zeit bis zum Verkauf.
      var L2 = r.A.lz;
      h += "<td>" + fJahre(L2.verkauf).replace(" Jahre", "").replace(" Jahr", "") +
        (L2.auto ? " ◆" : "") + "</td>";
      h += "<td>" + (L2.kredit === null ? "—" : L2.kredit) + "</td>";
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
