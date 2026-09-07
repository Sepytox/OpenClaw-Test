#!/usr/bin/env node
/**
 * Headless Test — Geteilte Bike-Datenquelle (bikes-data.js)
 *
 * Prüft: SHARED_BIKES enthält die erwarteten Modelle, jedes Modell hat die
 * erforderlichen Felder mit korrektem Typ, und bekannte Werte stimmen exakt
 * mit index.html überein (z. B. z900 ps=125, price=10200).
 *
 * Run: node tests/shop-data-test.js
 * Exit 0 = alle Tests bestanden, Exit 1 = mindestens ein Fehler.
 */

'use strict';

const SHARED_BIKES = require('../bikes-data.js');

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

const REQUIRED_STRING_FIELDS = ['id', 'name', 'icon', 'category', 'license', 'sub'];
const REQUIRED_NUMBER_FIELDS = ['ps', 'kw', 'torque', 'weight', 'vmax', 'accel', 'price'];

section('1 · SHARED_BIKES existiert und enthält erwartete Modelle');
(function() {
  assert(typeof SHARED_BIKES === 'object' && SHARED_BIKES !== null, 'SHARED_BIKES ist ein Objekt');
  const expectedKeys = ['z900', 'ninja400', 'h2', 'versys1000', 'zx10r', 'zh2', 'zx6r', 'w800', 'klx300', 'kx450'];
  expectedKeys.forEach(key => {
    assert(Object.prototype.hasOwnProperty.call(SHARED_BIKES, key), `SHARED_BIKES enthält "${key}"`);
  });
  assert(Object.keys(SHARED_BIKES).length === 19, `SHARED_BIKES enthält alle 19 Modelle (gefunden: ${Object.keys(SHARED_BIKES).length})`);
})();

section('2 · Jedes Modell hat die erforderlichen Felder mit korrektem Typ');
(function() {
  Object.keys(SHARED_BIKES).forEach(key => {
    const bike = SHARED_BIKES[key];
    REQUIRED_STRING_FIELDS.forEach(field => {
      assert(typeof bike[field] === 'string' && bike[field].length > 0, `${key}.${field} ist ein nicht-leerer String`);
    });
    REQUIRED_NUMBER_FIELDS.forEach(field => {
      assert(typeof bike[field] === 'number' && !Number.isNaN(bike[field]), `${key}.${field} ist eine gültige Zahl`);
    });
    assert(bike.id === key, `${key}: id-Feld stimmt mit Objektschlüssel überein`);
  });
})();

section('3 · Bekannte Werte stimmen exakt mit index.html überein');
(function() {
  assert(SHARED_BIKES.z900.ps === 125, `z900.ps === 125 (${SHARED_BIKES.z900.ps})`);
  assert(SHARED_BIKES.z900.price === 10200, `z900.price === 10200 (${SHARED_BIKES.z900.price})`);
  assert(SHARED_BIKES.z900.name === 'Kawasaki Z900', `z900.name === "Kawasaki Z900"`);

  assert(SHARED_BIKES.ninja400.ps === 45, `ninja400.ps === 45 (${SHARED_BIKES.ninja400.ps})`);
  assert(SHARED_BIKES.ninja400.price === 6500, `ninja400.price === 6500 (${SHARED_BIKES.ninja400.price})`);

  assert(SHARED_BIKES.h2.ps === 231, `h2.ps === 231 (${SHARED_BIKES.h2.ps})`);
  assert(SHARED_BIKES.h2.vmax === 300, `h2.vmax === 300 (${SHARED_BIKES.h2.vmax})`);
  assert(SHARED_BIKES.h2.price === 33000, `h2.price === 33000 (${SHARED_BIKES.h2.price})`);

  assert(SHARED_BIKES.versys1000.category === 'Adventure', `versys1000.category === "Adventure"`);
  assert(SHARED_BIKES.versys1000.price === 13500, `versys1000.price === 13500 (${SHARED_BIKES.versys1000.price})`);
})();

section('4 · Modul-Export funktioniert für Node (CommonJS)');
(function() {
  assert(typeof require === 'function', 'require() ist verfügbar (Node-Kontext)');
  assert(SHARED_BIKES === require('../bikes-data.js'), 'Wiederholtes require() liefert dieselbe Instanz');
})();

// ============================================================
// Results
// ============================================================
console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${passed}/${passed + failed} passed`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) process.exit(1);
