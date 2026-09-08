#!/usr/bin/env node
/**
 * Headless Test — Vollständigkeit der Bike-Datenquellen (Teil 3: 6 neue Modelle)
 *
 * Prüft:
 *  1. SHARED_BIKES (bikes-data.js) enthält alle 25 Modelle (19 bestehende +
 *     6 neue: ninja7hybrid, z900se, versys650, w230, klr650, vulcans) mit
 *     allen erforderlichen Feldern im korrekten Typ.
 *  2. race.html RACE_BIKES enthält für jedes referenzierte Modell gültige
 *     Physik-Felder (ps, torque, weight, vmax, redline, idleRpm, gears) —
 *     statische Quelltext-Prüfung (kein DOM/Browser nötig).
 *  3. Der RACE_BIKES-Spiegel in tests/physics-test.js bleibt mit race.html
 *     synchron (gleiche Schlüsselmenge).
 *  4. wheel.html/shop.html referenzieren die 6 neuen Modelle (und ihre
 *     jeweiligen Test-Spiegel in tests/ ziehen mit).
 *
 * Run: node tests/bikes-data-test.js
 * Exit 0 = alle Tests bestanden, Exit 1 = mindestens ein Fehler.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const SHARED_BIKES = require('../bikes-data.js');

const ROOT = path.join(__dirname, '..');

/**
 * Liest eine Datei aus dem Projekt-Root als UTF-8-String.
 * @param {string} file - Dateiname relativ zum Projekt-Root.
 * @returns {string} Dateiinhalt.
 */
function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// ============================================================
// Test harness (Stil analog zu tests/physics-test.js)
// ============================================================
let passed = 0, failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅  ${msg}`);
    passed++;
  } else {
    console.log(`  ❌  FAIL: ${msg}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

const NEW_BIKE_IDS = ['ninja7hybrid', 'z900se', 'versys650', 'w230', 'klr650', 'vulcans'];
const REQUIRED_STRING_FIELDS = ['id', 'name', 'icon', 'category', 'license', 'sub'];
const REQUIRED_NUMBER_FIELDS = ['ps', 'kw', 'torque', 'weight', 'vmax', 'accel', 'price'];

section('1 · SHARED_BIKES enthält alle 25 Modelle inkl. der 6 neuen');
(function() {
  assert(Object.keys(SHARED_BIKES).length === 25, `SHARED_BIKES hat 25 Einträge (gefunden: ${Object.keys(SHARED_BIKES).length})`);
  NEW_BIKE_IDS.forEach(id => {
    assert(Object.prototype.hasOwnProperty.call(SHARED_BIKES, id), `SHARED_BIKES enthält neues Modell "${id}"`);
  });
})();

section('2 · Jedes Modell (alt + neu) hat alle Pflichtfelder im korrekten Typ');
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
    assert(bike.ps > 0 && bike.ps < 400, `${key}.ps ist plausibel (${bike.ps} PS)`);
    assert(bike.weight > 50 && bike.weight < 400, `${key}.weight ist plausibel (${bike.weight} kg)`);
    assert(bike.vmax > 50 && bike.vmax < 350, `${key}.vmax ist plausibel (${bike.vmax} km/h)`);
    assert(bike.price > 0, `${key}.price ist positiv (${bike.price} €)`);
  });
})();

section('3 · Die 6 neuen Modelle haben plausible, konsistente Detail-Werte');
(function() {
  assert(SHARED_BIKES.ninja7hybrid.category === 'Sport Tourer', 'ninja7hybrid ist Sport Tourer');
  assert(SHARED_BIKES.z900se.category === 'Naked', 'z900se ist Naked');
  assert(SHARED_BIKES.versys650.category === 'Adventure', 'versys650 ist Adventure');
  assert(SHARED_BIKES.w230.category === 'Klassiker', 'w230 ist Klassiker');
  assert(SHARED_BIKES.klr650.category === 'Off-Road', 'klr650 ist Off-Road');
  assert(SHARED_BIKES.vulcans.category === 'Cruiser', 'vulcans ist Cruiser');
  // Keine der 6 neuen IDs kollidiert mit den 19 bestehenden.
  const existing = ['h2', 'klx110', 'hybrid1200', 'samurai', 'z650', 'ninja400', 'zx10r', 'versys1000', 'w800', 'h2sx', 'h2se', 'ninja650', 'klx300', 'eliminator400', 'zx6r', 'z900', 'zh2', 'zx25r', 'kx450'];
  NEW_BIKE_IDS.forEach(id => {
    assert(!existing.includes(id), `Neue ID "${id}" kollidiert nicht mit einer bestehenden ID`);
  });
})();

section('4 · race.html RACE_BIKES: gültige Physik-Felder für jedes referenzierte Modell');
(function() {
  const raceHtml = read('race.html');
  const raceBikesBlockMatch = raceHtml.match(/const RACE_BIKES = \{([\s\S]*?)\n\};/);
  assert(raceBikesBlockMatch !== null, 'RACE_BIKES-Block wurde in race.html gefunden');
  const block = raceBikesBlockMatch ? raceBikesBlockMatch[1] : '';

  const entryRe = /(\w+):\s*\{\s*name:'[^']*',\s*ps:(\d+),\s*torque:(\d+),\s*weight:(\d+),\s*vmax:(\d+),\s*redline:(\d+),\s*idleRpm:(\d+),\s*gears:(\d+)/g;
  const foundKeys = [];
  let m;
  while ((m = entryRe.exec(block)) !== null) {
    const [, key, ps, torque, weight, vmax, redline, idleRpm, gears] = m;
    foundKeys.push(key);
    assert(Number(ps) > 0, `RACE_BIKES.${key}.ps > 0 (${ps})`);
    assert(Number(torque) > 0, `RACE_BIKES.${key}.torque > 0 (${torque})`);
    assert(Number(weight) > 50 && Number(weight) < 400, `RACE_BIKES.${key}.weight plausibel (${weight} kg)`);
    assert(Number(vmax) > 50 && Number(vmax) < 350, `RACE_BIKES.${key}.vmax plausibel (${vmax} km/h)`);
    assert(Number(redline) >= 5000 && Number(redline) <= 20000, `RACE_BIKES.${key}.redline plausibel (${redline} U/min)`);
    assert(Number(idleRpm) > 0 && Number(idleRpm) < Number(redline), `RACE_BIKES.${key}.idleRpm < redline (${idleRpm} < ${redline})`);
    assert(Number(gears) >= 1 && Number(gears) <= 6, `RACE_BIKES.${key}.gears im plausiblen Bereich (${gears})`);
  }
  assert(foundKeys.length === 23, `race.html RACE_BIKES hat 23 Einträge (gefunden: ${foundKeys.length})`);
  NEW_BIKE_IDS.forEach(id => {
    assert(foundKeys.includes(id), `RACE_BIKES enthält neues Modell "${id}"`);
  });
})();

section('5 · tests/physics-test.js RACE_BIKES-Spiegel bleibt mit race.html synchron');
(function() {
  const physicsTestSrc = read('tests/physics-test.js');
  const raceHtml = read('race.html');
  const keyRe = /^\s*(\w+):\s*\{\s*name:/gm;

  function extractKeys(src, startMarker) {
    const start = src.indexOf(startMarker);
    const relevant = src.slice(start);
    const end = relevant.indexOf('\n};');
    const block = relevant.slice(0, end === -1 ? undefined : end);
    const keys = [];
    let mm;
    const re = new RegExp(keyRe.source, 'gm');
    while ((mm = re.exec(block)) !== null) keys.push(mm[1]);
    return keys;
  }

  const raceKeys = extractKeys(raceHtml, 'const RACE_BIKES = {').sort();
  const testKeys = extractKeys(physicsTestSrc, 'const RACE_BIKES = {').sort();
  assert(raceKeys.length === 23, `race.html RACE_BIKES-Schlüssel: 23 (gefunden: ${raceKeys.length})`);
  assert(testKeys.length === raceKeys.length, `tests/physics-test.js Spiegel hat gleiche Anzahl Schlüssel (${testKeys.length} === ${raceKeys.length})`);
  assert(JSON.stringify(raceKeys) === JSON.stringify(testKeys), 'race.html und tests/physics-test.js RACE_BIKES referenzieren exakt dieselben Modelle');
})();

section('6 · wheel.html / shop.html referenzieren die 6 neuen Modelle (+ Test-Spiegel)');
(function() {
  const wheelHtml = read('wheel.html');
  const wheelTest = read('tests/wheel-test.js');
  const shopHtml = read('shop.html');

  NEW_BIKE_IDS.forEach(id => {
    assert(wheelHtml.includes(`'${id}'`), `wheel.html WHEEL_BIKE_KEYS enthält "${id}"`);
    assert(wheelTest.includes(`'${id}'`), `tests/wheel-test.js Spiegel enthält "${id}"`);
    assert(shopHtml.includes(`'${id}'`), `shop.html SHOP_BIKE_KEYS enthält "${id}"`);
  });
  assert(wheelTest.includes('WHEEL_BIKES.length === 23'), 'tests/wheel-test.js erwartet 23 Glücksrad-Segmente');
})();

// ============================================================
// Results
// ============================================================
console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${passed}/${passed + failed} passed`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) process.exit(1);
