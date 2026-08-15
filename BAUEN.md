# Bauen

Die Quelldateien liegen in `src/`. `index.html` wird daraus erzeugt:

```bash
node build.js index.html
```

Kein npm, keine Abhängigkeiten. Der Build erzeugt zwei Dateien:

- `index.html` — vollständige Seite mit Doctype, für GitHub Pages und zum lokalen
  Öffnen per Doppelklick. **Der Doctype ist nicht optional**: Ohne ihn rendert der
  Browser im Quirks-Modus, Abstände fallen anders aus und Layoutfehler bleiben
  unentdeckt.
- `fragment.html` — derselbe Inhalt ohne Rahmen-Tags, für Veröffentlichungswege,
  die `<html>`/`<head>`/`<body>` selbst setzen.

Der Build-Schritt ersetzt ES-Module, die über `file://` blockiert würden. Er lehnt
Quelldateien ab, die die umgebenden Tags selbst mitbringen — ein verirrtes `<style>`
in `_css.css` verschluckt sonst die erste CSS-Regel und damit alle Farbvariablen,
ohne dass die Seite sichtbar bricht.

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

Der Zahlenabdruck allein genügt nicht: Ein zerstörter Style-Block lässt alle Zahlen
unverändert und macht die Seite trotzdem unlesbar. Zusätzlich zu prüfen sind
deshalb im Browser: `document.compatMode === "CSS1Compat"`, alle Farbvariablen
gesetzt, kein horizontaler Seitenüberlauf, und keine `position: sticky`-Zelle ohne
deckenden Hintergrund.
