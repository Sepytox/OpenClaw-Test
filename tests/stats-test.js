#!/usr/bin/env node
/**
 * Headless Test — stats.js (Gamification Statistik-Modul)
 *
 * Prüft Increment-/Min-/Max-Logik von stats.js gegen eine gemockte
 * localStorage-Umgebung: Rennen-Zähler, beste 0–100-Zeit (Minimum),
 * meistgesehenes Bike (Aggregation), Endlos-Bestzeit (Maximum),
 * Favoriten-Höchststand (monoton) und besuchte Seiten.
 *
 * Run: node tests/stats-test.js
 * Exit 0 = alle Tests bestanden, Exit 1 = mindestens ein Fehler.
 */

'use strict';

/**
 * Minimale localStorage-Mock-Implementierung für Node (kein DOM/jsdom
 * nötig), analog zum bewusst einfachen Mock-Stil in dark-mode.test.js.
 */
function makeMockLocalStorage() {
  var store = {};
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { store[key] = String(value); },
    removeItem: function (key) { delete store[key]; },
    clear: function () { store = {}; }
  };
}

global.localStorage = makeMockLocalStorage();

// stats.js liest/schreibt `localStorage` als globale Variable (wie im
// Browser) — daher erst NACH dem Setzen von global.localStorage laden.
const Stats = require('../stats.js');

// ============================================================
// Test harness (Stil analog zu tests/physics-test.js / quiz-recommend-test.js)
// ============================================================
let passed = 0, failed = 0;

/**
 * Prüft eine Bedingung und protokolliert das Ergebnis.
 * @param {boolean} cond - Zu prüfende Bedingung.
 * @param {string} msg - Beschreibung des Testfalls.
 */
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅  ${msg}`);
    passed++;
  } else {
    console.log(`  ❌  FAIL: ${msg}`);
    failed++;
  }
}

/**
 * Gibt eine Abschnittsüberschrift in der Testausgabe aus.
 * @param {string} title - Titel des Abschnitts.
 */
function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

section('1 · Leerer Speicher liefert saubere Standardwerte');
(function () {
  global.localStorage.clear();
  const stats = Stats.getStats();
  assert(stats.raceFinishes === 0, 'raceFinishes startet bei 0');
  assert(stats.raceBestT100 === null, 'raceBestT100 startet bei null');
  assert(stats.favoritesMaxCount === 0, 'favoritesMaxCount startet bei 0');
  assert(Object.keys(stats.bikesViewed).length === 0, 'bikesViewed startet leer');
  assert(Stats.getMostViewedBike() === null, 'getMostViewedBike() liefert null ohne Daten');
})();

section('2 · Rennen-Zähler + beste 0–100-Zeit (Minimum)');
(function () {
  global.localStorage.clear();
  Stats.recordRaceFinish(3.5);
  Stats.recordRaceFinish(2.9);
  const stats = Stats.recordRaceFinish(4.1);
  assert(stats.raceFinishes === 3, `raceFinishes zählt korrekt hoch (${stats.raceFinishes})`);
  assert(stats.raceBestT100 === 2.9, `raceBestT100 hält die schnellste Zeit (${stats.raceBestT100})`);
})();

section('3 · Ungültige 0–100-Zeit verändert den Bestwert nicht');
(function () {
  global.localStorage.clear();
  Stats.recordRaceFinish(3.2);
  const stats = Stats.recordRaceFinish(null);
  assert(stats.raceFinishes === 2, 'raceFinishes zählt auch ohne gültige Zeit hoch');
  assert(stats.raceBestT100 === 3.2, 'raceBestT100 bleibt bei gültigem Vorwert unverändert');
})();

section('4 · Endlos-Modus-Bestzeit (Maximum)');
(function () {
  global.localStorage.clear();
  Stats.recordEndlessRun(45);
  Stats.recordEndlessRun(72.3);
  const stats = Stats.recordEndlessRun(30);
  assert(stats.raceEndlessRuns === 3, 'raceEndlessRuns zählt korrekt hoch');
  assert(stats.raceBestEndlessTime === 72.3, `raceBestEndlessTime hält die längste Überlebenszeit (${stats.raceBestEndlessTime})`);
})();

section('5 · Meistgesehenes Bike (Aggregation über bikesViewed)');
(function () {
  global.localStorage.clear();
  Stats.recordBikeView('z900');
  Stats.recordBikeView('h2');
  Stats.recordBikeView('z900');
  Stats.recordBikeView('z900');
  const stats = Stats.getStats();
  assert(stats.bikeViewCount === 4, `bikeViewCount summiert alle Ansichten (${stats.bikeViewCount})`);
  assert(stats.bikesViewed.z900 === 3, 'z900 wurde 3× gezählt');
  const most = Stats.getMostViewedBike();
  assert(most !== null && most.bikeKey === 'z900' && most.count === 3, 'getMostViewedBike() liefert z900 als meistgesehen');
})();

section('6 · Favoriten-Höchststand bleibt monoton (sinkt nie)');
(function () {
  global.localStorage.clear();
  Stats.recordFavoritesCount(2);
  Stats.recordFavoritesCount(5);
  const stats = Stats.recordFavoritesCount(3); // Nutzer entfernt wieder einen Favoriten
  assert(stats.favoritesMaxCount === 5, `favoritesMaxCount sinkt nicht mehr unter den Höchststand (${stats.favoritesMaxCount})`);
})();

section('7 · Quiz-Bestwert (Maximum) + Wheel-Spins');
(function () {
  global.localStorage.clear();
  Stats.recordQuizCompletion(60);
  const q = Stats.recordQuizCompletion(40);
  assert(q.quizCompletions === 2, 'quizCompletions zählt korrekt hoch');
  assert(q.quizBestMatchPct === 60, `quizBestMatchPct bleibt beim Höchstwert (${q.quizBestMatchPct})`);

  global.localStorage.clear();
  Stats.recordWheelSpin('h2');
  const w = Stats.recordWheelSpin('h2');
  assert(w.wheelSpins === 2, 'wheelSpins zählt korrekt hoch');
  assert(w.wheelResultCounts.h2 === 2, 'wheelResultCounts zählt pro Bike korrekt');
})();

section('8 · Reviews + Shop-Konfigurationen');
(function () {
  global.localStorage.clear();
  Stats.recordReview();
  const r = Stats.recordReview();
  assert(r.reviewsWritten === 2, 'reviewsWritten zählt korrekt hoch');

  global.localStorage.clear();
  const s = Stats.recordShopConfigSaved();
  assert(s.shopConfigsSaved === 1, 'shopConfigsSaved zählt korrekt hoch');
})();

section('9 · Besuchte Seiten (visitedPages, separat von settings.js gepflegt)');
(function () {
  global.localStorage.clear();
  assert(Stats.getVisitedPageCount() === 0, 'Ohne Daten sind 0 Seiten besucht');
  global.localStorage.setItem(Stats.VISITED_PAGES_KEY, JSON.stringify({ index: '2026-01-01T00:00:00.000Z', race: '2026-01-01T00:00:01.000Z' }));
  assert(Stats.getVisitedPageCount() === 2, 'getVisitedPageCount liest von settings.js geschriebene Daten korrekt');
})();

section('10 · Robustheit gegen korrupte localStorage-Daten');
(function () {
  global.localStorage.clear();
  global.localStorage.setItem(Stats.STATS_KEY, '{invalid json');
  const stats = Stats.getStats();
  assert(stats.raceFinishes === 0, 'Korruptes JSON führt zu sauberen Standardwerten statt Absturz');

  global.localStorage.setItem(Stats.VISITED_PAGES_KEY, 'not json at all');
  assert(Stats.getVisitedPageCount() === 0, 'Korruptes visitedPages-JSON führt zu 0 statt Absturz');
})();

// ============================================================
// Results
// ============================================================
console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${passed}/${passed + failed} passed`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) process.exit(1);
