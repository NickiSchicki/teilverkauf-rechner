  // ---------- Anwendungszustand ----------
  // Die Objektliste ist Zustand, keine Stammdaten — sie steht deshalb hinter der
  // Klasse und nicht bei den Voreinstellungen.

  // Beispielobjekte mit generischen Werten — keine echten Vertragsdaten
  var OBJ = [
    new Objekt(Object.assign({}, OBJ_DEF, { name: "Beispielobjekt A", v0: 500000, share: 50, alter: 75, haus: "Paar" })),
    new Objekt(Object.assign({}, OBJ_DEF, { name: "Beispielobjekt B", v0: 400000, share: 40, start: 2, hold: 15, alter: 80, haus: "w" }))
  ];

  var detailIdx = null;   // geöffnetes Projekt, null = Portfolioansicht
  var ansicht = "portfolio";

  // Das jeweils aktuelle Portfolio. Wird bei jeder Änderung neu gebaut, damit
  // keine veralteten Zwischenergebnisse überleben.
  var PF = null;
  function portfolioJetzt() {
    PF = new Portfolio(OBJ, G);
    return PF;
  }

  function kennzahlenFuer(ob) { return new Kennzahlen(ob, PF || portfolioJetzt()); }
