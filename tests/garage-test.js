#!/usr/bin/env node
/**
 * Headless Test — garage.js (Meine Garage — reine Helper-Funktionen)
 *
 * Prüft die pure View-Model-/Capping-/Dream-Bike-Helper aus garage.js
 * gegen eine gemockte localStorage-Umgebung sowie gegen die echte
 * SHARED_BIKES-Datenquelle. Fokus: Empty-State-Sicherheit (leerer
 * Speicher darf nie zu einem Fehler führen).
 *
 * Run: node tests/garage-test.js
 * Exit 0 = alle Tests bestanden, Exit 1 = mindestens ein Fehler.
 */

'use strict';

/**
 * Minimale localStorage-Mock-Implementierung für Node.
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

const Garage = require('../garage.js');
const SHARED_BIKES = require('../bikes-data.js');

// ============================================================
// Test harness (Stil analog zu tests/stats-test.js / achievements-test.js)
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

section('1 · addToRecentlyViewed() — Dedup, Reihenfolge, Cap');
(function () {
  var list = [];
  list = Garage.addToRecentlyViewed(list, 'h2', 8, '2026-01-01T10:00:00.000Z');
  list = Garage.addToRecentlyViewed(list, 'z900', 8, '2026-01-01T10:01:00.000Z');
  list = Garage.addToRecentlyViewed(list, 'zx10r', 8, '2026-01-01T10:02:00.000Z');
  assert(list.length === 3, `3 unterschiedliche Bikes → 3 Einträge (${list.length})`);
  assert(list[0].bikeKey === 'zx10r', 'Neuester Eintrag steht vorne');

  // Erneutes Ansehen eines bereits vorhandenen Bikes → nach vorne verschoben, kein Duplikat
  list = Garage.addToRecentlyViewed(list, 'h2', 8, '2026-01-01T10:03:00.000Z');
  assert(list.length === 3, `Erneutes Ansehen dedupliziert statt zu duplizieren (${list.length})`);
  assert(list[0].bikeKey === 'h2', 'Erneut angesehenes Bike steht jetzt vorne');

  // Cap
  var capped = [];
  for (var i = 0; i < 12; i++) {
    capped = Garage.addToRecentlyViewed(capped, 'bike' + i, 8, '2026-01-01T00:00:0' + (i % 10) + '.000Z');
  }
  assert(capped.length === 8, `Liste wird auf maxLen gekappt (${capped.length})`);
  assert(capped[0].bikeKey === 'bike11', 'Neuestes Bike bleibt nach Cap vorne');
})();

section('2 · getRecentlyViewed()/recordRecentlyViewed() — mit gemocktem localStorage');
(function () {
  global.localStorage.clear();
  assert(Array.isArray(Garage.getRecentlyViewed()) && Garage.getRecentlyViewed().length === 0, 'Leerer Speicher → leere Liste, kein Fehler');
  Garage.recordRecentlyViewed('h2');
  Garage.recordRecentlyViewed('z900');
  var list = Garage.getRecentlyViewed();
  assert(list.length === 2, `recordRecentlyViewed() persistiert korrekt (${list.length})`);
  assert(list[0].bikeKey === 'z900', 'Zuletzt angesehenes Bike steht vorne');
})();

section('3 · Traum-Bike get/set');
(function () {
  global.localStorage.clear();
  assert(Garage.getDreamBikeKey() === null, 'Ohne Auswahl → null, kein Fehler');
  Garage.setDreamBikeKey('zx10r');
  assert(Garage.getDreamBikeKey() === 'zx10r', 'Gesetztes Traum-Bike wird korrekt gelesen');
  Garage.setDreamBikeKey(null);
  assert(Garage.getDreamBikeKey() === null, 'Traum-Bike kann wieder gelöscht werden');
})();

section('4 · buildFavoritesViewModel() — Empty-State + Filterung unbekannter Keys');
(function () {
  var empty = Garage.buildFavoritesViewModel([], SHARED_BIKES);
  assert(empty.empty === true && empty.items.length === 0, 'Keine Favoriten → empty-state');

  var withUnknown = Garage.buildFavoritesViewModel(['h2', 'does-not-exist'], SHARED_BIKES);
  assert(withUnknown.items.length === 1 && withUnknown.items[0].bikeKey === 'h2', 'Unbekannte Bike-IDs werden sicher herausgefiltert');
  assert(withUnknown.empty === false, 'Bei mind. 1 gültigem Favorit kein empty-state');
})();

section('5 · buildRecentlyViewedViewModel() — Empty-State');
(function () {
  var empty = Garage.buildRecentlyViewedViewModel([], SHARED_BIKES);
  assert(empty.empty === true, 'Leere Liste → empty-state');
  var withData = Garage.buildRecentlyViewedViewModel([{ bikeKey: 'z900', viewedAt: '2026-01-01T00:00:00.000Z' }], SHARED_BIKES);
  assert(withData.empty === false && withData.items[0].bike.name === SHARED_BIKES.z900.name, 'Bike-Daten werden korrekt angereichert');
})();

section('6 · buildReviewsViewModel() — Empty-State + neueste zuerst');
(function () {
  var empty = Garage.buildReviewsViewModel({}, SHARED_BIKES);
  assert(empty.empty === true && empty.count === 0, 'Keine Reviews → empty-state');

  var reviews = {
    h2: [
      { rating: 3, text: 'ok', date: '01.01.2026' },
      { rating: 5, text: 'super', date: '02.01.2026' }
    ]
  };
  var vm = Garage.buildReviewsViewModel(reviews, SHARED_BIKES);
  assert(vm.count === 2, `Alle Reviews werden gezählt (${vm.count})`);
  assert(vm.items[0].text === 'super', 'Neueste Review (zuletzt hinzugefügt) steht vorne');
})();

section('7 · buildDreamBikeViewModel() — gültig/ungültig/leer');
(function () {
  assert(Garage.buildDreamBikeViewModel(null, SHARED_BIKES).empty === true, 'null → empty-state');
  assert(Garage.buildDreamBikeViewModel('nicht-vorhanden', SHARED_BIKES).empty === true, 'Unbekannte ID → empty-state (kein Absturz)');
  var vm = Garage.buildDreamBikeViewModel('zx10r', SHARED_BIKES);
  assert(vm.empty === false && vm.bike.name === SHARED_BIKES.zx10r.name, 'Gültige ID liefert korrekte Bike-Daten');
})();

section('8 · buildMostViewedBike()');
(function () {
  assert(Garage.buildMostViewedBike({}, SHARED_BIKES) === null, 'Keine Ansichten → null');
  var most = Garage.buildMostViewedBike({ h2: 2, z900: 5, zx10r: 1 }, SHARED_BIKES);
  assert(most !== null && most.bikeKey === 'z900' && most.count === 5, 'Bike mit den meisten Ansichten wird korrekt ermittelt');
})();

section('9 · buildStatBars() — Skalierung auf 0–100%');
(function () {
  var bars = Garage.buildStatBars({}, 0);
  assert(Array.isArray(bars) && bars.length > 0, 'Auch ohne Statistik-Daten wird eine Balken-Liste geliefert');
  bars.forEach(function (b) {
    assert(b.pct >= 0 && b.pct <= 100, `${b.label}: pct liegt im gültigen Bereich (${b.pct})`);
  });
  var full = Garage.buildStatBars({ quizBestMatchPct: 100 }, 6);
  var quizBar = full.find(function (b) { return b.label === 'Quiz-Bestwert'; });
  var appsBar = full.find(function (b) { return b.label === 'Mini-Apps besucht'; });
  assert(quizBar.pct === 100, 'Quiz-Bestwert 100% → Balken bei 100%');
  assert(appsBar.pct === 100, '6/6 besuchte Mini-Apps → Balken bei 100%');
})();

section('10 · buildGarageViewModel() — komplett leerer Zustand (frisches localStorage)');
(function () {
  var vm = Garage.buildGarageViewModel({
    favorites: [],
    reviews: {},
    recentlyViewed: [],
    dreamBikeKey: null,
    stats: {},
    visitedPageCount: 0,
    achievements: [],
    bikes: SHARED_BIKES
  });
  assert(vm.favorites.empty === true, 'Favoriten: empty-state ohne Fehler');
  assert(vm.recentlyViewed.empty === true, 'Zuletzt angesehen: empty-state ohne Fehler');
  assert(vm.reviews.empty === true, 'Reviews: empty-state ohne Fehler');
  assert(vm.dreamBike.empty === true, 'Traum-Bike: empty-state ohne Fehler');
  assert(vm.stats.mostViewedBike === null, 'Meistgesehenes Bike: null ohne Fehler');
  assert(vm.achievements.totalCount === 0 && vm.achievements.progressPct === 0, 'Achievements: 0/0 ohne Division-durch-0-Fehler');
})();

section('11 · buildGarageViewModel() — befüllter Zustand');
(function () {
  var vm = Garage.buildGarageViewModel({
    favorites: ['h2', 'z900'],
    reviews: { h2: [{ rating: 4, text: 'nice', date: '01.01.2026' }] },
    recentlyViewed: [{ bikeKey: 'zx10r', viewedAt: '2026-01-01T00:00:00.000Z' }],
    dreamBikeKey: 'zh2',
    stats: { bikesViewed: { zx10r: 3 } },
    visitedPageCount: 3,
    achievements: [
      { id: 'A', titel: 'A', beschreibung: 'a', icon: '🏅', unlocked: true, unlockedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'B', titel: 'B', beschreibung: 'b', icon: '🏅', unlocked: false, unlockedAt: null }
    ],
    bikes: SHARED_BIKES
  });
  assert(vm.favorites.items.length === 2, 'Favoriten korrekt befüllt');
  assert(vm.reviews.items.length === 1, 'Reviews korrekt befüllt');
  assert(vm.dreamBike.bike.name === SHARED_BIKES.zh2.name, 'Traum-Bike korrekt aufgelöst');
  assert(vm.achievements.unlockedCount === 1 && vm.achievements.progressPct === 50, 'Achievement-Fortschritt korrekt berechnet (1/2 = 50%)');
})();

// ============================================================
// Results
// ============================================================
console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${passed}/${passed + failed} passed`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) process.exit(1);
