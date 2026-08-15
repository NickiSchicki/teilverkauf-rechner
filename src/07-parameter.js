  // ---------- Regler- und Spaltendefinitionen ----------
  // Gesellschaftsebene — gilt für alle Objekte
  var GES_GROUPS = [
    { title: "Gesellschaft", dot: "s3", zuImDetail: true, hinweis: "gilt für alle Objekte", items: [
      { id: "basisjahr", label: "Basisjahr", min: 2015, max: 2040, step: 1, fmt: function (v) { return String(v); }, note: "Bezugsjahr der Zeitachse; Objekte dürfen davor liegen" },
      { id: "opex", label: "Laufende Kosten", min: 0, max: 20000, step: 250, fmt: function (v) { return fEur(v) + " / Jahr"; }, note: "je Geschäftsjahr, unabhängig von der Objektzahl" },
      { id: "hebesatz", label: "Gewerbesteuer-Hebesatz", min: 200, max: 600, step: 10, fmt: function (v) { return fPct(v, 0); }, note: "nur ohne erweiterte Kürzung relevant" },
      { id: "anlage", label: "Anlagezins", min: 0, max: 6, step: 0.1, fmt: function (v) { return fPct(v, 2) + " p.a."; }, note: "Bundeswertpapiere für geparkte Mittel" },
      { id: "kkZins", label: "Kontokorrentzins", min: 0, max: 12, step: 0.25, fmt: function (v) { return fPct(v, 2) + " p.a."; }, note: "bei negativem Konto der Gesellschaft" },
      { id: "mindestRendite", label: "Renditeanspruch", min: 0, max: 12, step: 0.25, fmt: function (v) { return fPct(v, 2) + " p.a."; }, note: "eigene Vorgabe an die Eigenkapitalrendite — Maßstab für Break-even und Ankaufsfilter" }
    ], tax: true }
  ];

  // Objektebene — jedes Objekt trägt diese Annahmen selbst
  var OBJ_GROUPS = [
    { title: "Immobilie & Haushalt", items: [
      { id: "name", label: "Bezeichnung", text: true },
      { id: "v0", label: "Wert bei Erwerb", min: 50000, max: 2000000, step: 10000, fmt: fEur },
      { id: "share", label: "Verkaufter Anteil", min: 5, max: 90, step: 1, fmt: function (v) { return fPct(v, 0); } },
      { id: "alter", label: "Alter im Haushalt", min: 55, max: 95, step: 1, fmt: fJahre, note: "bei Paaren die jüngere Person" },
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
      { id: "hold", label: "Haltedauer", min: 1, max: 40, step: 1, fmt: fJahre, note: "angenommener Verkaufszeitpunkt, wirkt nur ohne Sterbetafel-Kopplung" },
      { id: "de", label: "Durchführungsentgelt", min: 0, max: 8, step: 0.25, fmt: function (v) { return v === 0 ? "keines" : fPct(v, 2); }, note: "vom Gesamterlös beim Verkauf" },
      { id: "min", label: "Mindesterlös", min: 0, max: 250, step: 5, fmt: fAufschlag, note: "Vertragsklausel: Untergrenze in Prozent der Auszahlung, unabhängig vom Marktpreis. In Klammern der Aufschlag über die Auszahlung hinaus" },
      { id: "vkKosten", label: "Verkaufskosten beim Exit", min: 0, max: 8, step: 0.25, fmt: function (v) { return fPct(v, 2); }, note: "Makler etc., anteilig getragen" }
    ] },
    { title: "Ankauf & Finanzierung", dot: "s2", zu: true, hinweis: "Nebenkosten, Darlehen", items: [
      { id: "grest", label: "Grunderwerbsteuer", min: 3.5, max: 6.5, step: 0.5, fmt: function (v) { return fPct(v, 1); }, note: "je Bundesland verschieden" },
      { id: "notar", label: "Notar & Grundbuch", min: 0, max: 3, step: 0.25, fmt: function (v) { return fPct(v, 2); } },
      { id: "akquise", label: "Akquisitionskosten", min: 0, max: 40000, step: 500, fmt: function (v) { return v === 0 ? "keine" : fEur(v); }, note: "Werbung und Vertrieb je Abschluss, sofort abzugsfähiger Aufwand" },
      { id: "makler", label: "Maklercourtage", min: 0, max: 8, step: 0.595, fmt: function (v) { return v === 0 ? "keine" : fPct(v, 2); }, note: "volle Provision, von der Gesellschaft allein getragen — 7,14 % sind 6 % zzgl. Umsatzsteuer" },
      { id: "ltv", label: "Beleihung", min: 0, max: 95, step: 5, fmt: function (v) { return fPct(v, 0); }, note: "Darlehen in % des Anteilskaufpreises" },
      { id: "zins", label: "Sollzins", min: 1, max: 9, step: 0.05, fmt: function (v) { return fPct(v, 2) + " p.a."; } },
      { id: "tilg", label: "Anfangstilgung", min: 0, max: 5, step: 0.25, fmt: function (v) { return fPct(v, 2) + " p.a."; }, note: "0 % = endfälliges Darlehen" },
      { id: "zinsbindung", label: "Zinsbindung", min: 5, max: 30, step: 1, fmt: fJahre, note: "Vertragslaufzeit — vorher keine Ablösung ohne Entschädigung" },
      { id: "weiterfuehren", label: "Bei Verkauf weiterführen", bool: true, note: "Darlehen läuft bis Ende der Vertragslaufzeit, der Erlös wird bis dahin angelegt" }
    ] },
    { title: "Steuerliche Angaben", zu: true, hinweis: "AfA und Gebäudeanteil", items: [
      { id: "afaSatz", label: "AfA-Satz", min: 1, max: 4, step: 0.5, fmt: function (v) { return fPct(v, 1) + " p.a."; }, note: "2 % Standard · 2,5 % vor 1925 · 3 % Neubau" },
      { id: "gebAnteil", label: "Gebäudeanteil", min: 40, max: 90, step: 5, fmt: function (v) { return fPct(v, 0); }, note: "AfA-Basis, Rest ist Grund und Boden" }
    ] }
  ];


  // Umkehrrechnung: Welcher Wert bringt ceteris paribus den Renditeanspruch?
  var STELLSCHRAUBEN = [
    { k: "ne", label: "Nutzungsentgelt", min: 0.5, max: 15, fmt: function (v) { return fPct(v, 2) + " p.a."; }, richtung: "mehr" },
    { k: "min", label: "Mindesterlös", min: 0, max: 250, fmt: fAufschlag,
      fmtDelta: function (v) { return fPct(v, 0) + "-Punkte"; }, richtung: "mehr" },
    { k: "abschlag", label: "Ankaufsabschlag", min: 0, max: 60, fmt: function (v) { return fPct(v, 1); }, richtung: "mehr" },
    { k: "growth", label: "Wertentwicklung", min: -5, max: 10, fmt: function (v) { return fPct(v, 2) + " p.a."; }, richtung: "mehr" },
    { k: "verfall", label: "Instandhaltungsverfall", min: 0, max: 6, fmt: function (v) { return fPct(v, 2) + " p.a."; }, richtung: "weniger" },
    { k: "zins", label: "Sollzins", min: 0, max: 12, fmt: function (v) { return fPct(v, 2) + " p.a."; }, richtung: "weniger" },
    { k: "grest", label: "Grunderwerbsteuer", min: 0, max: 10, fmt: function (v) { return fPct(v, 2); }, richtung: "weniger" },
    { k: "makler", label: "Maklercourtage", min: 0, max: 8, fmt: function (v) { return fPct(v, 2); }, richtung: "weniger" },
    { k: "vkKosten", label: "Verkaufskosten", min: 0, max: 12, fmt: function (v) { return fPct(v, 2); }, richtung: "weniger" }
  ];
