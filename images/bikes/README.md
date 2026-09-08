# images/bikes/ — Foto-Konvention

Dieses Verzeichnis ist absichtlich leer (bis auf diese README) und enthält
**keine** externen/heruntergeladenen Bilder.

## Konvention

Lege eine echte Fotografie eines Motorrads unter folgendem Pfad ab, um die
automatisch generierte SVG-Illustration für dieses Modell zu ersetzen:

```
images/bikes/<bike-id>.jpg
```

`<bike-id>` ist der Schlüssel aus `SHARED_BIKES` (siehe `bikes-data.js`),
z. B. `images/bikes/z900.jpg`, `images/bikes/versys650.jpg`,
`images/bikes/klr650.jpg`.

## Verhalten (siehe `bike-image.js`)

- Ist unter diesem Pfad eine Datei vorhanden, wird sie geladen und beim
  erfolgreichen Laden sanft eingeblendet (Fade-in).
- Fehlt die Datei (oder schlägt das Laden fehl), wird automatisch und ohne
  sichtbaren Fehler auf eine selbst erzeugte, kategorie-spezifische
  SVG-Illustration zurückgefallen (Sport, Naked, Touring/Adventure, Retro,
  Offroad, Cruiser je nach Kategorie des Modells) — keinerlei externe
  Bild-Requests, kein Broken-Image-Icon.
- Es ist **kein Code-Änderung nötig**, um ein Foto zu ergänzen — einfach die
  Datei mit korrektem Namen in diesen Ordner legen.

## Format-Empfehlung

- Format: `.jpg`
- Seitenverhältnis: 16:9 (wird per CSS zugeschnitten, `object-fit: cover`)
- Keine eingebetteten Wasserzeichen/Fremdlogos; nur Bildmaterial, an dem die
  nötigen Rechte vorliegen (kein automatisierter Download aus dem Internet).
