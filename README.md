# Teilverkauf-Rechner

Interaktives Modell zur Wirtschaftlichkeit von Immobilien-Teilverkäufen, gerechnet aus Sicht einer erwerbenden GmbH.

**→ [Rechner öffnen](https://nickischicki.github.io/teilverkauf-rechner/)**

## Was das Modell rechnet

Ein Teilverkauf bedeutet: Ein Eigentümer verkauft einen Anteil an seiner selbstgenutzten Immobilie, bleibt darin wohnen und zahlt dafür ein laufendes Nutzungsentgelt. Beim späteren Gesamtverkauf erhält der Erwerber seinen Anteil am dann erzielten Preis.

Das Modell bildet beide Seiten ab:

- **Sicht des Eigentümers** — monatliche Rate, Gesamtbelastung und die effektiven Jahreskosten als interner Zinsfuß, wodurch der Vertrag mit dem Effektivzins eines Kredits vergleichbar wird.
- **Sicht der Gesellschaft** — Eigenkapitalbedarf, Rendite vor und nach Steuern, Liquiditätsverlauf sowie Bilanz, Gewinn- und Verlustrechnung und Kapitalflussrechnung für jedes Jahr.

## Aufbau

| Ansicht | Inhalt |
|---|---|
| **Portfolio** | Alle Verträge zusammen: Vermögenszuwachs, Objektliste, Beitrag je Objekt, Liquiditätsverlauf und konsolidierte Rechenwerke |
| **Objekt** | Ein einzelner Vertrag mit allen Annahmen, getrennt nach Vertragsbedingungen und Wirtschaftlichkeit |
| **Analyse** | Verteilung des Verkaufszeitpunkts, Break-even und die Frage, wie belastbar eine angenommene Haltedauer ist |

Die Zeitachse läuft in Kalenderjahren. Das **Basisjahr** ist auf Gesellschaftsebene einstellbar und benennt die Achse, ohne die Objekte zu verschieben — ein 2020 erworbenes Objekt bleibt bei 2020. Erwerbsjahre dürfen vor dem Basisjahr liegen; solche Objekte sind Bestand, und die konsolidierte Rechnung beginnt dann beim frühesten Erwerb.

Jedes Objekt trägt seine Annahmen selbst — Immobilienwert, Anteil, Nutzungsentgelt, Finanzierung, Grunderwerbsteuer, Abschreibung sowie Alter und Zusammensetzung des Haushalts. Auf Gesellschaftsebene verbleiben nur laufende Kosten, Gewerbesteuer-Hebesatz, Anlage- und Kontokorrentzins sowie die Schalter für die erweiterte Kürzung und die Abgeltungsteuer.

## Rechengrundlagen

- **Finanzierung** als Annuitätendarlehen mit Zinsbindung. Fällt der Verkauf in die Zinsbindung, läuft das Darlehen wahlweise weiter, während der Erlös verzinst angelegt wird.
- **Steuern** mit Körperschaftsteuer und Solidaritätszuschlag (15,825 %), optionaler Gewerbesteuer und konsolidierter Verlustverrechnung über alle Objekte.
- **Erwerbsnebenkosten** aus Grunderwerbsteuer, Notar und Grundbuch sowie einer Maklercourtage, die in voller Höhe von der Gesellschaft getragen wird — bewusst die ungünstigere Annahme statt einer Teilung mit dem Verkäufer. Sie sind vollständig aus Eigenkapital zu stellen, da das Darlehen am Kaufpreis bemessen wird.
- **Abschreibung** auf den Gebäudeanteil der Anschaffungskosten; Anschaffungsnebenkosten werden aktiviert und wirken über den Buchwert.
- **Kapitalwert** je Objekt Zeile für Zeile offengelegt: Einsatz, Rückfluss, Abzinsungsfaktor und Barwert. Der Zahlungsstrom hat genau zwei Punkte, weil nichts ausgeschüttet wird.
- **Verkaufszeitpunkt** entweder als feste Annahme oder — zuschaltbar — als Verteilung, berechnet aus einer an die amtliche Sterbetafel 2022/24 kalibrierten Gompertz-Makeham-Funktion zuzüglich einer einstellbaren Auszugswahrscheinlichkeit. Bei Paaren ist die zuletzt lebende Person maßgeblich.
- **Laufzeiten** getrennt ausgewiesen: die Vertragslaufzeit entspricht der Kreditbindung, der Verkauf des Anteils kann davor oder danach liegen. Fällt er davor, läuft das Darlehen weiter und der Erlös wird bis zur Ablösung zum Anlagezins geparkt — die Kapitalbindung ist dann länger als die Zeit bis zum Verkauf. Alle Renditeangaben beziehen sich auf die Kapitalbindung.
- **Break-even** über den Kapitalwert gegen eine frei einstellbare Mindestrendite, nicht über den internen Zinsfuß, der bei kurzen Haltedauern nicht eindeutig ist.
- **Ankaufsfilter** als Umkehrrechnung: Zu jeder Stellschraube — Nutzungsentgelt, Ankaufsabschlag, Wertentwicklung, Sollzins, Erwerbsnebenkosten — wird der Wert bestimmt, bei dem die Mindestrendite ceteris paribus gerade erreicht wird. Die Mindestrendite selbst steht als erste Zeile in derselben Tabelle; ihr kritischer Wert ist die Rendite, die der Vertrag tatsächlich abwirft.

Bilanz, Kapitalflussrechnung und Kassenfortschreibung prüfen sich gegenseitig: Aktiva und Passiva stimmen in jedem Jahr überein, und die drei Cashflow-Bereiche summieren sich auf die ausgewiesene Bestandsveränderung.

## Was das Modell nicht abbildet

Zahlungsausfall des Eigentümers, Vorfälligkeitsentschädigung bei vorzeitiger Ablösung, Zinsänderung nach Ablauf der Zinsbindung, einen Bewertungsabschlag für die schlechtere Verkäuflichkeit eines Miteigentumsanteils mit Wohnrecht, Akquisitionskosten je Vertragsabschluss sowie Wiederanlage der Verkaufserlöse.

Die angezeigten Werte sind **Beispielwerte** und beschreiben keinen bestehenden Vertrag.

## Nutzung

Eine einzelne HTML-Datei ohne Server, ohne externe Bibliotheken und ohne Datenübertragung. Alle Eingaben bleiben im Browser. Die Datei lässt sich auch herunterladen und lokal öffnen.

## Hinweis

Dies ist eine vereinfachte Modellrechnung zu Anschauungszwecken und **keine Rechts-, Steuer- oder Finanzberatung**. Die rechtliche Einordnung des Immobilien-Teilverkaufs ist Gegenstand einer laufenden Diskussion; vor einem Vertragsabschluss sind fachkundiger Rat und eine Prüfung der konkreten Umstände erforderlich.
