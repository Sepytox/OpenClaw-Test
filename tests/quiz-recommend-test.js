#!/usr/bin/env node
/**
 * Headless Test — Quiz-Modell-Empfehlung (Feature 1)
 *
 * Prüft die Lookup-Logik hinter getRecommendedBike(categoryKey) in quiz.html:
 * jede der 6 Quiz-Kategorien muss über BIKE_RESULTS[cat].key auf einen
 * gültigen SHARED_BIKES-Eintrag mit name/ps/price auflösen.
 *
 * Run: node tests/quiz-recommend-test.js
 * Exit 0 = alle Tests bestanden, Exit 1 = mindestens ein Fehler.
 */

'use strict';

const SHARED_BIKES = require('../bikes-data.js');

// Spiegel von BIKE_RESULTS aus quiz.html (nur die für die Empfehlung
// relevanten "key"-Zuordnungen; Quelle: quiz.html, const BIKE_RESULTS).
const BIKE_RESULTS = {
  supersport: { key: 'zx10r' },
  sport:      { key: 'zx6r' },
  naked:      { key: 'z900' },
  cruiser:    { key: 'eliminator400' },
  enduro:     { key: 'klx300' },
  tourer:     { key: 'versys1000' }
};

/**
 * Ermittelt das empfohlene Kawasaki-Modell für eine Quiz-Kategorie.
 * Identische Logik zu getRecommendedBike() in quiz.html.
 * @param {string} categoryKey - Quiz-Kategorie (z. B. "naked", "tourer").
 * @returns {Object|null} Bike-Datensatz aus SHARED_BIKES oder null.
 */
function getRecommendedBike(categoryKey) {
  const result = BIKE_RESULTS[categoryKey];
  if (!result) return null;
  return SHARED_BIKES[result.key] || null;
}

// ============================================================
// Test harness (Stil analog zu tests/physics-test.js)
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

section('1 · Alle 6 Quiz-Kategorien lösen zu einem gültigen Bike auf');
(function() {
  const categories = Object.keys(BIKE_RESULTS);
  assert(categories.length === 6, `6 Quiz-Kategorien definiert (gefunden: ${categories.length})`);

  categories.forEach(cat => {
    const bike = getRecommendedBike(cat);
    assert(bike !== null, `${cat}: getRecommendedBike liefert ein Ergebnis`);
    if (!bike) return;
    assert(typeof bike.name === 'string' && bike.name.length > 0, `${cat} → ${bike.name}: name ist gültig`);
    assert(typeof bike.ps === 'number' && bike.ps > 0, `${cat} → ${bike.name}: ps ist eine positive Zahl (${bike.ps})`);
    assert(typeof bike.price === 'number' && bike.price > 0, `${cat} → ${bike.name}: price ist eine positive Zahl (${bike.price})`);
  });
})();

section('2 · Bekannte Zuordnungen stimmen');
(function() {
  assert(getRecommendedBike('naked').name === 'Kawasaki Z900', 'naked → Kawasaki Z900');
  assert(getRecommendedBike('supersport').name === 'Kawasaki Ninja ZX-10R', 'supersport → Kawasaki Ninja ZX-10R');
  assert(getRecommendedBike('tourer').name === 'Kawasaki Versys 1000', 'tourer → Kawasaki Versys 1000');
})();

section('3 · Unbekannte Kategorie liefert null (kein Absturz)');
(function() {
  assert(getRecommendedBike('unknown-category') === null, 'Unbekannte Kategorie → null');
})();

// ============================================================
// Results
// ============================================================
console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${passed}/${passed + failed} passed`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) process.exit(1);
