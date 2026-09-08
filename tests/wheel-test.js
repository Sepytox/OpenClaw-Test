#!/usr/bin/env node
/**
 * Headless Test — Glücksrad-Segmente aus geteilter Bike-Datenquelle (Feature 2)
 *
 * Prüft die Logik hinter buildWheelBikes(keys) aus wheel.html: die erwartete
 * Anzahl an Segmenten und dass jedes Segment die für die Ergebnis-Info-Karte
 * benötigten Felder (name, ps, price, category) trägt.
 *
 * Run: node tests/wheel-test.js
 * Exit 0 = alle Tests bestanden, Exit 1 = mindestens ein Fehler.
 */

'use strict';

const SHARED_BIKES = require('../bikes-data.js');

// Spiegel von WHEEL_BIKE_KEYS aus wheel.html
const WHEEL_BIKE_KEYS = [
  'h2', 'zx10r', 'zh2', 'h2sx', 'hybrid1200', 'zx6r', 'z900', 'versys1000',
  'ninja650', 'z650', 'ninja400', 'zx25r', 'eliminator400', 'w800',
  'klx300', 'kx450', 'samurai',
  'ninja7hybrid', 'z900se', 'versys650', 'w230', 'klr650', 'vulcans'
];

/**
 * Baut die Glücksrad-Segmente aus SHARED_BIKES. Identische Logik zu
 * buildWheelBikes() in wheel.html.
 * @param {string[]} keys - Bike-IDs, die im Glücksrad vertreten sind.
 * @returns {Array<Object>} Liste von Segment-Objekten für das Glücksrad.
 */
function buildWheelBikes(keys) {
  return keys.map(function(key) {
    const b = SHARED_BIKES[key];
    return {
      key: b.id,
      name: b.name,
      shortName: b.name.replace(/^Kawasaki\s+/, ''),
      icon: b.icon,
      sub: b.sub,
      category: b.category,
      ps: b.ps,
      vmax: b.vmax,
      accel: b.accel,
      weight: b.weight,
      price: b.price
    };
  });
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

const WHEEL_BIKES = buildWheelBikes(WHEEL_BIKE_KEYS);

section('1 · Erwartete Anzahl an Segmenten');
(function() {
  assert(WHEEL_BIKES.length === 23, `WHEEL_BIKES hat 23 Segmente (gefunden: ${WHEEL_BIKES.length})`);
  assert(WHEEL_BIKES.length === WHEEL_BIKE_KEYS.length, 'Segmentanzahl entspricht Anzahl der Bike-Keys');
})();

section('2 · Jedes Segment trägt die für die Ergebnis-Karte nötigen Felder');
(function() {
  WHEEL_BIKES.forEach(bike => {
    assert(typeof bike.name === 'string' && bike.name.length > 0, `${bike.key}: name ist gültig ("${bike.name}")`);
    assert(typeof bike.shortName === 'string' && bike.shortName.length > 0, `${bike.key}: shortName ist gültig ("${bike.shortName}")`);
    assert(typeof bike.ps === 'number' && bike.ps > 0, `${bike.key}: ps ist eine positive Zahl (${bike.ps})`);
    assert(typeof bike.price === 'number' && bike.price > 0, `${bike.key}: price ist eine positive Zahl (${bike.price})`);
    assert(typeof bike.category === 'string' && bike.category.length > 0, `${bike.key}: category ist gültig ("${bike.category}")`);
    assert(typeof bike.vmax === 'number' && bike.vmax > 0, `${bike.key}: vmax ist eine positive Zahl (${bike.vmax})`);
    assert(typeof bike.weight === 'number' && bike.weight > 0, `${bike.key}: weight ist eine positive Zahl (${bike.weight})`);
  });
})();

section('3 · Keine doppelten Bike-Keys, alle in SHARED_BIKES vorhanden');
(function() {
  const keys = WHEEL_BIKES.map(b => b.key);
  const uniqueKeys = new Set(keys);
  assert(uniqueKeys.size === keys.length, `Keine Duplikate unter den Segment-Keys (${uniqueKeys.size}/${keys.length})`);
  keys.forEach(key => {
    assert(Object.prototype.hasOwnProperty.call(SHARED_BIKES, key), `"${key}" existiert in SHARED_BIKES`);
  });
})();

section('4 · Bekannte Werte stimmen mit SHARED_BIKES überein');
(function() {
  const h2 = WHEEL_BIKES.find(b => b.key === 'h2');
  assert(h2.name === 'Kawasaki Ninja H2', `h2.name === "Kawasaki Ninja H2" (${h2.name})`);
  assert(h2.shortName === 'Ninja H2', `h2.shortName === "Ninja H2" (${h2.shortName})`);
  assert(h2.ps === 231, `h2.ps === 231 (${h2.ps})`);
  assert(h2.price === 33000, `h2.price === 33000 (${h2.price})`);
})();

// ============================================================
// Results
// ============================================================
console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${passed}/${passed + failed} passed`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) process.exit(1);
