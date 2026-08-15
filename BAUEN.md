# Bauen

Die Quelldateien liegen in `src/`. `index.html` wird daraus erzeugt:

```bash
node build.js index.html
```

Kein npm, keine Abhängigkeiten. Das Ergebnis ist eine eigenständige HTML-Datei,
die sich ohne Server per Doppelklick öffnen lässt — deshalb der Build-Schritt
statt ES-Modulen, die über `file://` blockiert werden.

## Aufbau

| Modul | Inhalt |
|---|---|
| `01-format.js` | Zahlen-, Prozent- und Jahresformate, Zinsfuß, Kapitalwert |
| `02-konten.js` | **Kontenrahmen** — jede Position einmal deklariert; GuV, Kapitalflussrechnung und Tabellenzeilen werden daraus abgeleitet |
| `03-stammdaten.js` | Sterbetafel, Voreinstellungen, Exit-Verteilung |
| `04-objekt.js` | **Klasse Objekt** — Preise, Laufzeiten, Verlauf, Rechenwerk, Zahlungsstrom |
| `05-portfolio.js` | **Klasse Portfolio** — Aggregation über alle Objekte |
| `06-kennzahlen.js` | **Kennzahlen** — Rendite, Kapitalwert, Umkehrrechnungen; einzige Quelle dieser Größen |
| `07-parameter.js` | Regler- und Spaltendefinitionen |
| `08-zustand.js` | Objektliste und geöffnete Ansicht |
| `09`–`15` | Reglerpanels, Tabellen, Diagramme, die drei Ansichten, Verdrahtung |

Die Rechnung steht in `01`–`08` und kommt ohne DOM aus; `09`–`15` bauen nur Anzeige.

## Prüfen

`src/baseline.js` erzeugt einen Fingerabdruck aus 840 Parameterlagen mit je 38
Kennzahlen. `src/vergleich.js` stellt zwei solche Abdrücke numerisch gegenüber und
unterscheidet echte Abweichungen von Rundungsgrenzen. Änderungen an der Rechnung
sind erst dann fertig, wenn der Abdruck unverändert ist oder die Abweichung
begründet werden kann.
