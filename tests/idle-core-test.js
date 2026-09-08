#!/usr/bin/env node
/**
 * Headless Test — idle-core.js (Kawasaki Idle Racer: Kern-Economy)
 *
 * Prüft: Bike-Kosten sind streng monoton steigend/exponentiell und
 * stimmen exakt mit bikeCost() überein; Tuning-Kosten steigen mit dem
 * Level und respektieren den Level-Cap; Passiv-/Aktiv-Ertragsformeln
 * liefern die erwarteten Werte; Level-Zustand pro Bike übersteht
 * saveState()/loadState(); loadState() liefert bei leerem Speicher einen
 * gültigen initialen {version:1,...}-Zustand; migrateState() behandelt
 * fehlende/ältere/korrupte Rohdaten defensiv.
 *
 * Run: node tests/idle-core-test.js
 * Exit 0 = alle Tests bestanden, Exit 1 = mindestens ein Fehler.
 */

'use strict';

/**
 * Minimale localStorage-Mock-Implementierung für Node (Muster identisch
 * zu tests/garage-test.js).
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

const IdleCore = require('../idle-core.js');

// ============================================================
// Test harness (Stil analog zu tests/shop-data-test.js / garage-test.js)
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

section('1 · IDLE_BIKES — 16 Modelle, aufsteigend nach Topspeed');
(function () {
  assert(Array.isArray(IdleCore.IDLE_BIKES), 'IDLE_BIKES ist ein Array');
  assert(IdleCore.IDLE_BIKES.length === 16, `IDLE_BIKES enthält 16 Modelle (gefunden: ${IdleCore.IDLE_BIKES.length})`);

  const REQUIRED_FIELDS = ['id', 'name', 'topspeed', 'ps', 'kategorie', 'kaufpreisKm'];
  IdleCore.IDLE_BIKES.forEach((bike, i) => {
    REQUIRED_FIELDS.forEach(field => {
      assert(bike[field] !== undefined && bike[field] !== null, `IDLE_BIKES[${i}].${field} ist gesetzt`);
    });
  });

  for (let i = 1; i < IdleCore.IDLE_BIKES.length; i++) {
    assert(
      IdleCore.IDLE_BIKES[i].topspeed > IdleCore.IDLE_BIKES[i - 1].topspeed,
      `IDLE_BIKES[${i}].topspeed (${IdleCore.IDLE_BIKES[i].topspeed}) > IDLE_BIKES[${i - 1}].topspeed (${IdleCore.IDLE_BIKES[i - 1].topspeed})`
    );
  }

  const ids = IdleCore.IDLE_BIKES.map(b => b.id);
  assert(new Set(ids).size === ids.length, 'Alle Bike-ids sind eindeutig');
})();

section('2 · bikeCost() — streng monoton steigend/exponentiell, deckt sich mit kaufpreisKm');
(function () {
  assert(IdleCore.bikeCost(0) === 0, 'bikeCost(0) === 0 (Startbike kostenlos)');
  assert(IdleCore.IDLE_BIKES[0].kaufpreisKm === 0, 'IDLE_BIKES[0].kaufpreisKm === 0');

  for (let i = 0; i < IdleCore.IDLE_BIKES.length; i++) {
    assert(
      IdleCore.IDLE_BIKES[i].kaufpreisKm === IdleCore.bikeCost(i),
      `IDLE_BIKES[${i}].kaufpreisKm (${IdleCore.IDLE_BIKES[i].kaufpreisKm}) === bikeCost(${i}) (${IdleCore.bikeCost(i)})`
    );
  }

  for (let i = 1; i < IdleCore.IDLE_BIKES.length; i++) {
    assert(IdleCore.bikeCost(i) > IdleCore.bikeCost(i - 1), `bikeCost(${i}) > bikeCost(${i - 1})`);
  }

  // Exponentiell: das Verhältnis aufeinanderfolgender Kosten (ab Index 2)
  // sollte nahe am konfigurierten BIKE_COST_GROWTH-Faktor liegen.
  const ratio = IdleCore.bikeCost(3) / IdleCore.bikeCost(2);
  const growth = IdleCore.IDLE_BALANCE.BIKE_COST_GROWTH;
  assert(Math.abs(ratio - growth) < 0.1, `bikeCost(3)/bikeCost(2) (${ratio.toFixed(3)}) liegt nahe BIKE_COST_GROWTH (${growth})`);
})();

section('3 · tuningCost() — steigt mit Level, respektiert den Level-Cap');
(function () {
  const bikeId = IdleCore.IDLE_BIKES[0].id;
  const cap = IdleCore.IDLE_BALANCE.TUNING_LEVEL_CAP;

  assert(typeof IdleCore.tuningCost(bikeId, 0) === 'number', `tuningCost(${bikeId}, 0) ist eine Zahl`);
  for (let lvl = 1; lvl < 5; lvl++) {
    assert(
      IdleCore.tuningCost(bikeId, lvl) > IdleCore.tuningCost(bikeId, lvl - 1),
      `tuningCost(${bikeId}, ${lvl}) > tuningCost(${bikeId}, ${lvl - 1})`
    );
  }

  assert(IdleCore.tuningCost(bikeId, cap) === null, `tuningCost(${bikeId}, cap=${cap}) === null (Cap erreicht)`);
  assert(IdleCore.tuningCost(bikeId, cap - 1) !== null, `tuningCost(${bikeId}, cap-1=${cap - 1}) !== null (letztes Upgrade noch möglich)`);
  assert(IdleCore.tuningCost('unbekannte-id', 0) === null, 'tuningCost() mit unbekannter Bike-id === null');

  // Teurere Bikes (höherer Index) kosten pro Level mehr als das Startbike.
  const lastBikeId = IdleCore.IDLE_BIKES[IdleCore.IDLE_BIKES.length - 1].id;
  assert(
    IdleCore.tuningCost(lastBikeId, 0) > IdleCore.tuningCost(bikeId, 0),
    `tuningCost(${lastBikeId}, 0) > tuningCost(${bikeId}, 0) (teureres Bike = teureres Tuning)`
  );
})();

section('4 · passiveEarn() / activeEarn() — erwartete Werte');
(function () {
  const state = IdleCore.createInitialState();

  assert(IdleCore.passiveEarn(state, 0) === 0, 'passiveEarn(state, 0) === 0');
  assert(IdleCore.passiveEarn(state, -5) === 0, 'passiveEarn(state, negativ) === 0');

  const expectedPassive = IdleCore.IDLE_BALANCE.PASSIVE_KM_PER_SEC * 10; // Startbike: Level 0, Faktor 1
  assert(
    Math.abs(IdleCore.passiveEarn(state, 10) - expectedPassive) < 1e-9,
    `passiveEarn(startState, 10s) === ${expectedPassive} (Startbike, Level 0)`
  );

  const expectedActive = IdleCore.IDLE_BALANCE.ACTIVE_KM_PER_CLICK;
  assert(
    Math.abs(IdleCore.activeEarn(state) - expectedActive) < 1e-9,
    `activeEarn(startState) === ${expectedActive} (Startbike, Level 0)`
  );

  // Getuntes Bike wirft mehr ab als ungetuntes (ertragMultiplier > 1).
  state.bikeLevels[state.currentBikeId] = 5;
  assert(IdleCore.activeEarn(state) > expectedActive, 'activeEarn() nach Tuning-Level 5 > activeEarn() bei Level 0');

  // Ein schnelleres Bike (höherer bikeSpeedFactor) wirft mehr ab als das Startbike.
  const fastBike = IdleCore.IDLE_BIKES[IdleCore.IDLE_BIKES.length - 1];
  const fastState = IdleCore.createInitialState();
  fastState.ownedBikeIds.push(fastBike.id);
  fastState.currentBikeId = fastBike.id;
  fastState.bikeLevels[fastBike.id] = 0;
  assert(IdleCore.activeEarn(fastState) > expectedActive, `activeEarn() mit ${fastBike.id} (Topspeed ${fastBike.topspeed}) > Startbike-Ertrag`);
})();

section('5 · Per-Bike-Level-Zustand übersteht saveState()/loadState()');
(function () {
  localStorage.clear();
  const state = IdleCore.createInitialState();
  const secondBike = IdleCore.IDLE_BIKES[1];
  state.ownedBikeIds.push(secondBike.id);
  state.bikeLevels[secondBike.id] = 7;
  state.km = 1234;
  state.currentBikeId = secondBike.id;

  IdleCore.saveState(state);
  const loaded = IdleCore.loadState();

  assert(loaded.version === IdleCore.IDLE_STATE_VERSION, `loadState().version === ${IdleCore.IDLE_STATE_VERSION}`);
  assert(loaded.km === 1234, `loadState().km === 1234 (${loaded.km})`);
  assert(loaded.bikeLevels[secondBike.id] === 7, `loadState().bikeLevels["${secondBike.id}"] === 7 (${loaded.bikeLevels[secondBike.id]})`);
  assert(loaded.currentBikeId === secondBike.id, `loadState().currentBikeId === "${secondBike.id}"`);
  assert(typeof loaded.lastSavedAt === 'number', 'saveState() setzt lastSavedAt auf einen Zeitstempel');
})();

section('6 · loadState() bei leerem Speicher liefert gültigen initialen Zustand');
(function () {
  localStorage.clear();
  const state = IdleCore.loadState();

  assert(state.version === 1, 'loadState() (leerer Speicher): version === 1');
  assert(state.km === 0, 'loadState() (leerer Speicher): km === 0');
  assert(Array.isArray(state.ownedBikeIds) && state.ownedBikeIds.length === 1, 'loadState() (leerer Speicher): genau 1 besessenes Bike (Startbike)');
  assert(state.ownedBikeIds[0] === IdleCore.IDLE_BIKES[0].id, 'loadState() (leerer Speicher): Startbike === IDLE_BIKES[0]');
  assert(state.currentBikeId === IdleCore.IDLE_BIKES[0].id, 'loadState() (leerer Speicher): currentBikeId === Startbike');
  assert(typeof state.prestige === 'object' && state.prestige !== null, 'loadState() (leerer Speicher): prestige-Erweiterungspunkt vorhanden');
  assert(typeof state.parts === 'object' && state.parts !== null, 'loadState() (leerer Speicher): parts-Erweiterungspunkt vorhanden');
  assert(typeof state.offline === 'object' && state.offline !== null, 'loadState() (leerer Speicher): offline-Erweiterungspunkt vorhanden');
})();

section('7 · migrateState() — fehlende/ältere/korrupte Rohdaten defensiv behandelt');
(function () {
  const viaNull = IdleCore.migrateState(null);
  assert(viaNull.version === 1, 'migrateState(null) liefert version 1');
  assert(viaNull.km === 0, 'migrateState(null) liefert km 0');

  const viaUndefined = IdleCore.migrateState(undefined);
  assert(viaUndefined.version === 1, 'migrateState(undefined) liefert version 1');

  const viaGarbage = IdleCore.migrateState('nicht-mal-ein-objekt');
  assert(viaGarbage.version === 1, 'migrateState(string) liefert version 1 (kein Absturz)');

  const viaNoVersion = IdleCore.migrateState({ km: 42 });
  assert(viaNoVersion.version === 1, 'migrateState({km:42}) (fehlende version) liefert version 1');
  assert(viaNoVersion.km === 42, 'migrateState({km:42}) übernimmt gültiges km-Feld');
  assert(Array.isArray(viaNoVersion.ownedBikeIds) && viaNoVersion.ownedBikeIds.length > 0, 'migrateState({km:42}) füllt fehlendes ownedBikeIds auf');

  const viaOlderVersion = IdleCore.migrateState({ version: 0, km: 10, ownedBikeIds: ['z125pro'], currentBikeId: 'z125pro', bikeLevels: { z125pro: 3 } });
  assert(viaOlderVersion.version === 1, 'migrateState() hebt ältere version auf aktuelle version an');
  assert(viaOlderVersion.bikeLevels.z125pro === 3, 'migrateState() übernimmt gültige bikeLevels aus älterem Zustand');

  const viaBrokenOwned = IdleCore.migrateState({ version: 1, ownedBikeIds: 'kaputt', currentBikeId: 'unbekannt' });
  assert(Array.isArray(viaBrokenOwned.ownedBikeIds) && viaBrokenOwned.ownedBikeIds.length > 0, 'migrateState() repariert korruptes ownedBikeIds');
  assert(viaBrokenOwned.ownedBikeIds.indexOf(viaBrokenOwned.currentBikeId) !== -1, 'migrateState() stellt sicher, dass currentBikeId in ownedBikeIds enthalten ist');

  const viaUnknownCurrentBike = IdleCore.migrateState({ version: 1, ownedBikeIds: ['z125pro'], currentBikeId: 'existiert-nicht', bikeLevels: {} });
  assert(viaUnknownCurrentBike.currentBikeId === 'z125pro', 'migrateState() korrigiert unbekanntes currentBikeId auf besessenes Bike');
})();

section('8 · Kauf-/Tuning-/Wechsel-Mutationen (buyNextBike/upgradeBike/selectBike)');
(function () {
  const state = IdleCore.createInitialState();
  const secondBike = IdleCore.IDLE_BIKES[1];

  const tooExpensive = IdleCore.buyNextBike(state);
  assert(tooExpensive.success === false, 'buyNextBike() schlägt bei 0 km fehl (nächstes Bike zu teuer)');

  state.km = IdleCore.bikeCost(1) + 100;
  const bought = IdleCore.buyNextBike(state);
  assert(bought.success === true, 'buyNextBike() gelingt mit genug km');
  assert(state.ownedBikeIds.indexOf(secondBike.id) !== -1, 'buyNextBike() fügt Bike zu ownedBikeIds hinzu');
  assert(state.km === 100, `buyNextBike() zieht Kaufpreis ab (verbleibend: ${state.km})`);

  assert(IdleCore.selectBike(state, secondBike.id) === true, 'selectBike() gelingt für besessenes Bike');
  assert(state.currentBikeId === secondBike.id, 'selectBike() setzt currentBikeId');
  assert(IdleCore.selectBike(state, 'nicht-besessen') === false, 'selectBike() schlägt für unbesessenes Bike fehl');

  state.km = 10000;
  const upgraded = IdleCore.upgradeBike(state, secondBike.id);
  assert(upgraded.success === true, 'upgradeBike() gelingt mit genug km');
  assert(state.bikeLevels[secondBike.id] === 1, 'upgradeBike() erhöht das Level um 1');
})();

// ============================================================
// Results
// ============================================================
console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${passed}/${passed + failed} passed`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) process.exit(1);
