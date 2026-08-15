  // ---------- Anwendungszustand ----------
  // Die Objektliste ist Zustand, keine Stammdaten — sie steht deshalb hinter der
  // Klasse und nicht bei den Voreinstellungen.

  // Das Modell startet leer — es soll mit den eigenen Verträgen gefüllt werden,
  // nicht mit fremden Beispielwerten, die man erst wegräumen muss.
  var OBJ = [];

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
