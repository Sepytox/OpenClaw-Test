# PR: Fix Racing Simulation — 4 Critical Bugs

**Branch:** `feature/fix-race-simulation`
**Target:** `main`

---

## 📋 Zusammenfassung

Die `race.html` Renn-Simulation hatte 4 kritische Bugs, die zusammen dazu führten, dass das Rennen entweder gar nicht starten, nie beenden oder nach dem Ziel in einer Endlosschleife landen konnte.

Keine neuen Features. Nur Bugfixes. Kein fremder Code angepasst.

---

## 🐛 Bug 1 — Compare-Modus: Rennschleife endet wenn Bike 1 zuerst ins Ziel kommt

**Datei/Funktion:** `raceLoop()`

**Problem:**
```javascript
// vorher (buggy)
function raceLoop(ts) {
    if (!simState.running) return;  // ← prüft NUR Bike 1!
    ...
    if (simState.running) {         // ← gleiches Problem
        simAnimId = requestAnimationFrame(raceLoop);
    }
}
```
Im Compare-Modus endet die `raceLoop` sofort, wenn Bike 1 die Ziellinie überfährt — auch wenn Bike 2 noch läuft. Bike 2 beendet nie sein Rennen. Buttons bleiben im falschen Zustand.

**Fix:**
```javascript
// nachher
function raceLoop(ts) {
    const anyRunning = simState.running || (raceMode === 'compare' && sim2State.running);
    if (!anyRunning) return;
    ...
    if (simState.running) {
        accel = stepPhysics(simState, bike1, dt, raceMode === 'manual');
    }
    if (raceMode === 'compare' && sim2State.running) {
        stepPhysics(sim2State, bike2, dt, false);
    }
    ...
    const stillRunning = simState.running || (raceMode === 'compare' && sim2State.running);
    if (stillRunning) { simAnimId = requestAnimationFrame(raceLoop); }
}
```

**Commit:** `0d5ae53`

---

## 🐛 Bug 2 — Compare-Modus: `stopRace()` wird nie aufgerufen wenn Bike 1 zuerst fertig

**Datei/Funktion:** `finishRace()`

**Problem:**
```javascript
// vorher (buggy)
function finishRace(state, bike) {
    state.running = false;
    // Bedingung schlägt fehl wenn Bike 1 zuerst fertig, Bike 2 noch läuft
    if (raceMode !== 'compare' || (state === simState && !sim2State.running)) {
        stopRace();
    }
}
```
Wenn Bike 1 zuerst die Ziellinie erreicht und Bike 2 noch läuft, wird `stopRace()` nie aufgerufen. START/STOP Buttons, RPM-Anzeige und Körperanimation bleiben im falschen Zustand.

**Fix:**
```javascript
// nachher
function finishRace(state, bike) {
    state.running = false;
    // Stoppe die UI sobald ALLE Bikes fertig sind
    if (!simState.running && !sim2State.running) {
        stopRace();
    }
}
```

**Commit:** `0d5ae53` (zusammen mit Bug 1)

---

## 🐛 Bug 3 — Re-Start nach Zieleinlauf triggert sofortigen Re-Finish

**Datei/Funktion:** `startRace()`

**Problem:**
Nach einem Rennen zeigt `stopRace()` den START-Button wieder an. Klickt der Nutzer START ohne vorherigen RESET, startet das Rennen mit `simState.dist >= trackDist` — und `stepPhysics()` ruft in der ersten Frame `finishRace()` auf. Das Rennen "startet" und endet sofort.

Das selbe tritt auf wenn der Nutzer den Gasschieber (> 10%) bewegt und `updateThrottle()` `startRace()` auto-triggert.

**Fix:**
```javascript
function startRace() {
    if (simState.running) return;

    // Physics State immer zurücksetzen damit Re-Start sauber läuft
    resetSimState(simState);
    resetSimState(sim2State);

    // Throttle-Slider Wert wiederherstellen
    const throttleVal = parseInt(document.getElementById('throttleSlider').value);
    simState.throttle = throttleVal / 100;
    sim2State.throttle = throttleVal / 100;
    ...
}
```

**Commit:** `9933e0a`

---

## 🐛 Bug 4 — Physics Engine startet nie: RPM-Deadlock verhindert Thrust

**Datei/Funktionen:** `stepPhysics()`, `startRace()`

**Problem (das schwerwiegendste):**
```javascript
// getPowerAtRpm gibt 0 zurück wenn rpm <= idleRpm
if (gear === 0 || rpm <= bike.idleRpm) return 0;

// stepPhysics setzt RPM auf exakt idleRpm bei sehr niedrigen Speeds
state.rpm = Math.max(bike.idleRpm, getRpmFromSpeed(state.speed, currentGear));
//                   ↑ = idleRpm wenn speed ≈ 0
//                   → rpm === idleRpm → power = 0 → keine Kraft → speed bleibt 0
//                   → ewige Schleife: speed=0 → rpm=idleRpm → power=0
```

Bei Speed ≈ 0 ergibt `getRpmFromSpeed()` einen Wert weit unter `idleRpm`.
`Math.max(idleRpm, ...)` klemmt auf genau `idleRpm`.
`getPowerAtRpm` prüft `rpm <= idleRpm` — bei Gleichheit gibt es 0 zurück.
Das Motorrad steht still für immer. Das Rennen läuft nie.

**Fix (2 Teile):**

*Teil A — stepPhysics: `idleRpm+1` statt `idleRpm` als Untergrenze:*
```javascript
// nachher: idleRpm+1 stellt sicher dass power > 0 produziert werden kann
state.rpm = Math.max(bike.idleRpm + 1,
                     Math.min(getRpmFromSpeed(state.speed, currentGear),
                              bike.redline * 1.05));
```
Mit `throttle=0` ist `powerW = getPowerAtRpm(...) * 735.5 * 0 = 0` — Motor-Bremsung bleibt korrekt.

*Teil B — startRace: initiales RPM über Idle seeden:*
```javascript
const b1 = RACE_BIKES[currentBike1];
simState.rpm = simState.gear === 0
    ? b1.idleRpm + simState.throttle * 2000  // neutral blip
    : b1.idleRpm + 100;                       // Gang 1, leicht über idle
```

**Commits:** `031c08e` (seed), `6bb790e` (floor)

---

## ✅ Test-Ergebnisse

### Headless Physics-Test (Node.js, 33 Assertions)

```
TEST 1: Single 400m (ZX-10R)          ✅ 400m reached, 0-100: 3.42s, time: 9.20s
TEST 2: Re-start nach Ziel (BUG 3)    ✅ Race completed again
TEST 3: Compare H2 vs W800 (BUG 1+2) ✅ H2: 9.22s, W800: 13.34s — beide fertig
TEST 4: Compare reversed               ✅ H2 (Bike2) gewinnt: 9.22s < 13.34s
TEST 5: 0-100 km/h sprint             ✅ ZX-10R: 3.42s
TEST 6: Manual mode shifts            ✅ neutral start, up/down, cap at gear 6
TEST 7: 3x konsekutive Rennen         ✅ alle 3 sauber beendet ohne RESET
TEST 8: 1000m Rennen                  ✅ H2: 16.42s
TEST 9: Splits korrekt                ✅ 50m/100m/200m/400m chronologisch
TEST 10: Samurai (Spezialfall)        ✅ Samurai 400m: 13.87s

33 tests: 33 passed, 0 failed — ALL TESTS PASSED ✅
```

### Syntax-Check

```
node --check race.html (inline scripts) — SYNTAX OK ✅
```

### Simulierte Zeiten (realistisch für Kawasaki-Bikes)

| Bike | 0-100 km/h | 0-400m |
|------|-----------|--------|
| H2 (231ps) | ~2.5s | ~9.2s |
| ZX-10R (203ps) | 3.42s | 9.20s |
| W800 (48ps) | — | 13.34s |
| Samurai (31ps) | — | 13.87s |

---

## 📝 Commit-Übersicht

| # | Hash | Message |
|---|------|---------|
| 1 | `0d5ae53` | `fix: compare mode race loop - continue until both bikes finish` |
| 2 | `9933e0a` | `fix: startRace always resets physics state before starting` |
| 3 | `031c08e` | `fix: seed initial RPM above idle so engine can produce thrust` |
| 4 | `6bb790e` | `fix: RPM floor idleRpm+1 prevents perpetual power=0 deadlock` |

---

## 🔒 Breaking Changes

**Keine.** Keine neuen Features. Keine API-Änderungen. Nur Bugfixes in der internen Simulationslogik.

---

WORKFLOW_DONE
