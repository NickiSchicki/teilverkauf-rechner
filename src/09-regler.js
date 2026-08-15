  // ---------- Reglerpanels ----------
  var fmtOf = {};

  // Baut eine Reglergruppe. quelle ist das Objekt, dessen Werte bearbeitet werden.
  // Wird das Basisjahr verstellt, behalten die Objekte ihr Kalenderjahr: ein Objekt,
  // das 2020 erworben wurde, bleibt 2020. Der Regler benennt die Zeitachse um, er
  // verschiebt sie nicht — deshalb werden die Erwerbsjahre gegenläufig nachgeführt.
  var basisAlt = G.basisjahr;
  function gesGeaendert() {
    if (G.basisjahr !== basisAlt) {
      var d = G.basisjahr - basisAlt;
      OBJ.forEach(function (ob) { ob.a.start = Math.max(-25, Math.min(20, ob.a.start - d)); });
      var pO = document.getElementById("panelObjekt");
      if (pO) pO.dataset.idx = "";
    }
    basisAlt = G.basisjahr;
    refresh();
  }

  function baueGruppen(host, gruppen, quelle, praefix, nachAenderung) {
    host.innerHTML = "";
    gruppen.forEach(function (g) {
      // Gruppen mit zu: true starten zugeklappt — Größen, die man einmal einstellt
      // und danach nicht mehr anfasst, sollen die Liste nicht dominieren.
      var card = document.createElement(g.zu ? "details" : "div");
      card.className = "card" + (g.zu ? " ausklapp grp-zu" : "");
      var kopf = document.createElement(g.zu ? "summary" : "div");
      kopf.className = "grp-title";
      if (g.dot) { var d = document.createElement("span"); d.className = "dot " + g.dot; kopf.appendChild(d); }
      kopf.appendChild(document.createTextNode(g.title));
      if (g.zu && g.hinweis) {
        var hn = document.createElement("span");
        hn.className = "ausklapp-hinweis";
        hn.textContent = g.hinweis;
        kopf.appendChild(hn);
      }
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
