# PR: Wartungsrechner + Modell-Konfigurator

**Branch:** `miro/wartungsrechner-und-konfigurator`  
**Ziel-Branch:** `main`  
**Author:** OpenClaw (für Miro / Sepy)

---

## 📋 Was wurde gebaut?

Zwei vollständig neue interaktive Features für die Kawasaki Vrooooom-Webapp:

1. **🔧 Wartungsrechner** — Interaktiver Service-Intervall-Rechner in `index.html`
2. **🎨 Modell-Konfigurator** — Farbe & Ausstattungs-Wähler mit Live-Preisanzeige in `shop.html`

Keine neuen npm-Abhängigkeiten. Kein bestehender Code verändert. Beide Features nutzen die vorhandenen CSS-Variablen aus `design.css` für vollständige Dark/Light-Mode-Kompatibilität.

---

## 🔧 Feature 1: Wartungsrechner (`index.html`)

**Platzierung:** Neue Section zwischen Kaufberatung-Section und der Closing-Section.

### Funktionalität

**Eingaben:**
- **Modell-Dropdown** — automatisch aus dem `BIKES`-Array befüllt (Name + Hubraum in cc)
- **Baujahr-Dropdown** — 1960–2026, absteigend
- **Kilometerstand-Input** — Zahlenfeld, Enter-Taste triggert Berechnung

**Berechnung:**
- **Era-Erkennung** aus Baujahr:
  - Klassiker `< 1980` → Basis-Intervall: **5.000 km**
  - Modern `1980–2010` → Basis-Intervall: **10.000 km**
  - Neu `> 2010` → Basis-Intervall: **15.000 km**
- **Hubraum-Modifier** (automatisch aus BIKES-Array, kein doppelter Datensatz):
  - `> 1000 cc` → **-10%** (aggressive Nutzung)
  - `< 300 cc` → **+20%** (Anfänger-freundlich)
  - Sonst → kein Modifier
- Intervall wird auf nächste 500 km gerundet
- Service-Termine werden 12 Monate auseinander angenommen

**Output:** Tabelle mit **5 Service-Terminen**, jede Zeile zeigt:
| Spalte | Inhalt |
|---|---|
| # | Service-Nummer |
| Kilometerstand | Basis-km + n × Intervall |
| Geschätzter Monat | MM/YYYY (ab heute gerechnet) |
| Service-Typ | Chips: Öl, Kerzen, Filter, Ventile, Großinspektion |
| Status | ✅ Nächster (grün), ⚠️ Bald (gelb), ⏳ Später (grau) |
| Kosten-Schätzung | Bereich in EUR, skaliert nach Service-Tiefe |

**Info-Bar** zeigt nach der Berechnung: Modellname, Hubraum, Era, berechnetes Intervall, Modifier.

**UX-Details:**
- Enter-Taste im km-Input triggert Berechnung
- Bike-Wechsel auto-rechnet neu, wenn andere Felder schon ausgefüllt
- Letzte Eingabe wird in `localStorage` (`vroooom_maint_state`) persistiert

---

## 🎨 Feature 2: Modell-Konfigurator (`shop.html`)

**Platzierung:** Neue Section unterhalb des bestehenden Aftermarket-Parts-Shop.

### Konfigurierbare Optionen

**Farben (per Bike individuell):**
- Standard-Palette (5 Farben, 3 inklusive, 2 mit +500 € Aufschlag): Black, White, Red, Metallic Blue, Racing Green
- Bike-spezifische Paletten für: H2, ZX-10R, ZX-6R, Z900, Z H2, W800, Versys 1000
- Farb-Circles: groß, klickbar, mit Checkmark bei Auswahl und Keyboard-Support (tabindex=0)

**Ausstattungs-Addons (alle Bikes):**
| Addon | Preis |
|---|---|
| 🛑 ABS | +800 € |
| ⚡ Quickshifter | +1.200 € |
| 💨 Windschild | +400 € |
| 🧤 Beheizte Griffe | +600 € |
| 🗺️ Navigation System | +2.000 € |

### Live-Preisanzeige

- **Basis-Preis** direkt aus `SHOP_BIKES[key].price`
- **Farb-Aufschlag** wird live zur Breakdown-Liste hinzugefügt (Row nur sichtbar, wenn > 0)
- **Addon-Aufschläge** werden summiert und separat gezeigt (Row nur sichtbar, wenn > 0)
- **Gesamtpreis** in 2.2rem fettem Font, mit 80ms Flash-Animation bei jeder Änderung
- **Zusammenstellungs-Chips:** Farbname (mit live farbigem Punkt), Addon-Names
- **Persistenz:** `vroooom_config_state` in localStorage

**"In den Warenkorb"** — Placeholder-Button mit 2.5-Sekunden visuellem Feedback.

**URL-Sync:** `?bike=KEY` Query-Param wird von Konfigurator und Parts-Shop synchron gelesen.

---

## 🎨 Design & Styling

- Alle neuen Elemente nutzen `var(--bg)`, `var(--card-bg)`, `var(--border)`, `var(--accent)` etc. aus `design.css`
- **Dark Mode:** Vollständig unterstützt (Standard-Theme)
- **Light Mode:** Explizite `[data-theme="light"]` Overrides für Inputs, Cards, Status-Badges
- **Wartungsrechner Responsive:**
  - `≤ 768px`: 2-Spalten-Control-Layout
  - `≤ 600px`: 1-Spalte, Datums-Spalte ausgeblendet, kompakte Service-Chips
- **Konfigurator Responsive:**
  - `≤ 900px`: 1-Spalte, Preis-Card oben
  - `≤ 600px`: Kompakte Farb-Circles (38px), kompakte Addons

---

## ✅ Getestete Szenarien (manuell)

### Wartungsrechner

- [ ] **Klassiker (vor 1980):** Samurai (1966, 247cc) → 5000 km Basis, +20% für <300cc → 6.000 km Intervall
- [ ] **Modern (1980–2010):** KLX 110 (2008, 112cc) → 10.000 km Basis, +20% → 12.000 km
- [ ] **Neu (2010+):** ZX-10R (2024, 998cc) → 15.000 km, kein Modifier → 15.000 km
- [ ] **Großer Hubraum (>1000cc):** H2 (1340cc) → 15.000 × 0.9 = **13.500 km**
- [ ] **Kleiner Hubraum (<300cc):** Ninja ZX-25R (249cc) → 15.000 × 1.2 = **18.000 km**
- [ ] **Tabellen-Ausgabe:** 5 Zeilen korrekt, km-Werte kumulativ
- [ ] **Status-Farben:** Row 1 = grün, Row 2 = gelb, Rows 3–5 = grau
- [ ] **Info-Bar:** Zeigt nach Berechnung Modell, CC, Era, Intervall, Modifier
- [ ] **Enter-Taste** triggert Berechnung
- [ ] **Fehlermeldung** bei leerem Feld

### Modell-Konfigurator

- [ ] **Bike-Wechsel:** Farben wechseln, Preis aktualisiert sich, Addons werden zurückgesetzt
- [ ] **Alle 5 Farben wählen** → Preis-Breakdown korrekt (Metallic/Racing = +500€)
- [ ] **Alle 5 Addon-Kombinationen:**
  - Nur ABS → +800 €
  - ABS + Quickshifter → +2.000 €
  - Alle 5 Addons → +5.000 €
- [ ] **Flash-Animation** bei Preis-Änderung sichtbar
- [ ] **Zusammenstellungs-String** korrekt (Bikenamen + Farb-Chip + Addon-Chips)
- [ ] **"In den Warenkorb"** Feedback erscheint und verschwindet nach 2.5s
- [ ] **URL-Param `?bike=zx10r`** syncronisiert Konfigurator und Parts-Shop
- [ ] **localStorage** speichert letzten Stand

### Dark / Light Mode

- [ ] **Dark Mode (Standard):** Alle neuen Elemente korrekt gefärbt
- [ ] **Light Mode (☀️ Toggle):** Wartungsrechner-Tabelle, Konfigurator-Cards, Status-Badges alle korrekt
- [ ] **Mode-Wechsel während Nutzung** → keine Darstellungsfehler

### Mobile Responsiveness

- [ ] **375px (Phone):** 1-Spalte überall, lesbar
- [ ] **768px (Tablet):** 2-Spalten-Controls im Wartungsrechner, Konfigurator 1-Spalte
- [ ] **1200px (Desktop):** Volle 2-Spalten-Layouts

---

## 🔒 Breaking Changes

**Keine.** Bestehender Code wurde nicht verändert. Neue Sections und Scripts wurden ausschließlich hinzugefügt.

---

## 📝 Offene Punkte

- **Warenkorb-Backend:** `mcAddToCart()` ist derzeit ein Placeholder — echte Cart-Persistenz/Checkout ist zukünftiges Feature
- **Wartungsrechner km-Basis:** Aktuell kein "Letzter Service war bei X km" Input — mögliche Erweiterung
- **Bike-Farben:** Nur ~7 Bikes haben spezifische Paletten; restliche nutzen die 5-Farben-Default-Palette

---

## 🗂️ Commit-Übersicht

| # | Commit | Was |
|---|---|---|
| 1 | `feat(maintenance): add maintenance calculator HTML + base styles` | Section-HTML + vollständiges CSS |
| 2 | `feat(maintenance): implement calculation logic for service intervals` | MaintenanceCalc IIFE + Berechnungslogik |
| 3 | `feat(maintenance): add dark mode styling + responsive layout` | Dark/Light overrides + 768px/600px Breakpoints |
| 4 | `feat(configurator): add color palette + addon checkboxes HTML` | Konfigurator-HTML + 300 Zeilen CSS |
| 5 | `feat(configurator): implement live price calculation` | JS: Farben, Addons, Live-Preis, localStorage |
| 6 | `feat(configurator): add dark mode + final styling` | Flash-Animation, Light-Mode-Overrides, Keyboard-A11y |
| 7 | `test: add manual test checklist to PR_BODY.md` | Dieser Commit |
