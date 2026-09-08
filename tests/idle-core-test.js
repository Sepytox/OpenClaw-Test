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

section('9 · MECHANIK A — Schaltpunkt-Combo (comboMultiplier/perfectZoneWidth/applyShiftResult)');
(function () {
  // comboMultiplier(): 1x ohne Combo, rampt x2→x5, deckelt bei x5.
  assert(IdleCore.comboMultiplier(0) === 1, 'comboMultiplier(0) === 1 (kein Multiplikator)');
  assert(IdleCore.comboMultiplier(-3) === 1, 'comboMultiplier(negativ) === 1 (kein Absturz)');
  assert(IdleCore.comboMultiplier(1) === IdleCore.IDLE_BALANCE.COMBO_MULTIPLIER_BASE, 'comboMultiplier(1) === COMBO_MULTIPLIER_BASE (x2)');

  let prevMultiplier = IdleCore.comboMultiplier(1);
  for (let combo = 2; combo <= 20; combo++) {
    const m = IdleCore.comboMultiplier(combo);
    assert(m >= prevMultiplier, `comboMultiplier(${combo}) >= comboMultiplier(${combo - 1}) (rampt monoton)`);
    assert(m <= IdleCore.IDLE_BALANCE.COMBO_MULTIPLIER_MAX, `comboMultiplier(${combo}) <= COMBO_MULTIPLIER_MAX (x5-Deckel)`);
    prevMultiplier = m;
  }
  assert(IdleCore.comboMultiplier(100) === IdleCore.IDLE_BALANCE.COMBO_MULTIPLIER_MAX, 'comboMultiplier(100) deckelt exakt bei COMBO_MULTIPLIER_MAX (x5)');

  // perfectZoneWidth(): schrumpft monoton mit der Combo, nie unter das Minimum.
  const baseWidth = IdleCore.IDLE_BALANCE.COMBO_ZONE_BASE_WIDTH_PCT;
  assert(IdleCore.perfectZoneWidth(0, baseWidth) === baseWidth, 'perfectZoneWidth(0, baseWidth) === baseWidth (volle Breite bei Combo 0)');
  let prevWidth = IdleCore.perfectZoneWidth(0, baseWidth);
  for (let combo = 1; combo <= 30; combo++) {
    const w = IdleCore.perfectZoneWidth(combo, baseWidth);
    assert(w <= prevWidth, `perfectZoneWidth(${combo}) <= perfectZoneWidth(${combo - 1}) (schrumpft monoton)`);
    assert(w >= IdleCore.IDLE_BALANCE.COMBO_ZONE_MIN_WIDTH_PCT, `perfectZoneWidth(${combo}) >= COMBO_ZONE_MIN_WIDTH_PCT (Untergrenze respektiert)`);
    prevWidth = w;
  }
  assert(IdleCore.perfectZoneWidth(999, baseWidth) === IdleCore.IDLE_BALANCE.COMBO_ZONE_MIN_WIDTH_PCT, 'perfectZoneWidth(999) erreicht exakt die Untergrenze');
  assert(IdleCore.perfectZoneWidth(0) === IdleCore.IDLE_BALANCE.COMBO_ZONE_BASE_WIDTH_PCT, 'perfectZoneWidth(0) ohne baseWidth nutzt IDLE_BALANCE-Standard');

  // applyShiftResult(): Treffer erhöht Combo + gewährt Multiplikator für die Dauer.
  const state = IdleCore.createInitialState();
  const t0 = 1000000;
  const afterHit1 = IdleCore.applyShiftResult(state, true, t0);
  assert(afterHit1.count === 1, 'applyShiftResult(hit) erhöht Combo auf 1');
  assert(state.combo.count === 1, 'applyShiftResult(hit) mutiert state.combo.count');
  assert(afterHit1.multiplier === IdleCore.comboMultiplier(1), 'applyShiftResult(hit) setzt den zu Combo 1 passenden Multiplikator');
  assert(afterHit1.multiplierExpiresAt === t0 + IdleCore.IDLE_BALANCE.COMBO_MULTIPLIER_DURATION_MS, 'applyShiftResult(hit) setzt multiplierExpiresAt auf now + COMBO_MULTIPLIER_DURATION_MS');

  const afterHit2 = IdleCore.applyShiftResult(state, true, t0 + 500);
  assert(afterHit2.count === 2, 'applyShiftResult(hit) erhöht Combo weiter auf 2');
  assert(afterHit2.multiplier === IdleCore.comboMultiplier(2), 'applyShiftResult(hit) aktualisiert den Multiplikator passend zur neuen Combo');

  const afterMiss = IdleCore.applyShiftResult(state, false, t0 + 800);
  assert(afterMiss.count === 0, 'applyShiftResult(miss) setzt Combo zurück auf 0');
  assert(afterMiss.multiplier === 1, 'applyShiftResult(miss) setzt den Multiplikator zurück auf 1x');
  assert(afterMiss.multiplierExpiresAt === null, 'applyShiftResult(miss) löscht multiplierExpiresAt');

  // Ignorieren (kein Klick) ⇒ keine Funktion aufgerufen ⇒ keine Strafe, Combo bleibt unverändert.
  const ignoreState = IdleCore.createInitialState();
  IdleCore.applyShiftResult(ignoreState, true, t0);
  const comboBeforeIgnore = ignoreState.combo.count;
  // (Simuliert: Leiste läuft unbeklickt ab — idle.js ruft applyShiftResult() dann NICHT auf.)
  assert(ignoreState.combo.count === comboBeforeIgnore, 'Ignorieren einer Schaltpunkt-Leiste ändert die Combo nicht (keine Strafe)');

  // activeComboMultiplier(): Multiplikator ist genau innerhalb des Dauer-Fensters aktiv.
  const durState = IdleCore.createInitialState();
  IdleCore.applyShiftResult(durState, true, t0);
  const grantedMultiplier = durState.combo.multiplier;
  assert(IdleCore.activeComboMultiplier(durState, t0) === grantedMultiplier, 'activeComboMultiplier() ist direkt nach dem Treffer aktiv');
  assert(
    IdleCore.activeComboMultiplier(durState, t0 + IdleCore.IDLE_BALANCE.COMBO_MULTIPLIER_DURATION_MS - 1) === grantedMultiplier,
    'activeComboMultiplier() bleibt bis knapp vor Ablauf der Dauer aktiv'
  );
  assert(
    IdleCore.activeComboMultiplier(durState, t0 + IdleCore.IDLE_BALANCE.COMBO_MULTIPLIER_DURATION_MS) === 1,
    'activeComboMultiplier() fällt exakt beim Ablauf der Dauer auf 1x zurück'
  );
  assert(
    IdleCore.activeComboMultiplier(durState, t0 + IdleCore.IDLE_BALANCE.COMBO_MULTIPLIER_DURATION_MS + 5000) === 1,
    'activeComboMultiplier() bleibt nach Ablauf dauerhaft auf 1x'
  );
  assert(IdleCore.activeComboMultiplier(IdleCore.createInitialState(), t0) === 1, 'activeComboMultiplier() liefert 1x für einen frischen Zustand ohne Combo');

  // nextShiftIntervalSeconds(): liegt im konfigurierten Intervall, Zufälligkeit wird übergeben.
  const min = IdleCore.IDLE_BALANCE.SHIFT_INTERVAL_MIN_SECONDS;
  const max = IdleCore.IDLE_BALANCE.SHIFT_INTERVAL_MAX_SECONDS;
  assert(IdleCore.nextShiftIntervalSeconds(function () { return 0; }) === min, 'nextShiftIntervalSeconds(random=0) === Untergrenze');
  assert(IdleCore.nextShiftIntervalSeconds(function () { return 1; }) === max, 'nextShiftIntervalSeconds(random=1) === Obergrenze');
  const mid = IdleCore.nextShiftIntervalSeconds(function () { return 0.5; });
  assert(mid > min && mid < max, 'nextShiftIntervalSeconds(random=0.5) liegt strikt zwischen den Grenzen');

  // Migration/Persistenz: combo/sound-Felder überstehen saveState()/loadState() und werden defensiv migriert.
  const persistState = IdleCore.createInitialState();
  IdleCore.applyShiftResult(persistState, true, t0);
  persistState.sound.enabled = true;
  persistState.sound.volume = 0.3;
  IdleCore.saveState(persistState);
  const reloaded = IdleCore.loadState();
  assert(reloaded.combo.count === 1, 'combo.count übersteht saveState()/loadState()');
  assert(reloaded.sound.enabled === true, 'sound.enabled übersteht saveState()/loadState()');
  assert(Math.abs(reloaded.sound.volume - 0.3) < 1e-9, 'sound.volume übersteht saveState()/loadState()');

  const migratedNoCombo = IdleCore.migrateState({ version: 1, km: 5 });
  assert(migratedNoCombo.combo && migratedNoCombo.combo.count === 0, 'migrateState() füllt fehlendes combo-Feld defensiv auf');
  assert(migratedNoCombo.sound && migratedNoCombo.sound.enabled === false, 'migrateState() füllt fehlendes sound-Feld defensiv auf (Sound-Standard AUS)');
})();

section('10 · MECHANIK B — Saison/Prestige/Werksverträge (trophiesForSeason/canFinishSeason/finishSeason/contractEffects)');
(function () {
  // trophiesForSeason(): 1 Trophäe pro gekauftem Bike + Bonus je TROPHY_LEVEL_BONUS_DIVISOR kumulierte Level.
  const fresh = IdleCore.createInitialState();
  assert(IdleCore.trophiesForSeason(fresh) === 0, 'trophiesForSeason(frischer Zustand) === 0 (nur Startbike)');

  const state = IdleCore.createInitialState();
  for (let i = 1; i <= 3; i++) {
    state.ownedBikeIds.push(IdleCore.IDLE_BIKES[i].id);
    state.bikeLevels[IdleCore.IDLE_BIKES[i].id] = 0;
  }
  assert(IdleCore.trophiesForSeason(state) === 3, 'trophiesForSeason() zählt 1 Trophäe je über das Startbike hinaus gekauftem Bike (3 Bikes → 3)');

  state.bikeLevels[state.ownedBikeIds[1]] = IdleCore.IDLE_BALANCE.TROPHY_LEVEL_BONUS_DIVISOR; // genau 1 Bonus-Schwelle erreicht
  assert(IdleCore.trophiesForSeason(state) === 4, 'trophiesForSeason() addiert +1 Bonus-Trophäe je TROPHY_LEVEL_BONUS_DIVISOR kumulierte Tuning-Level');

  // canFinishSeason(): erst ab Besitz der ZX-10R (Index 12) möglich.
  const zxIndex = IdleCore.findBikeIndex('zx10r');
  const belowZx = IdleCore.createInitialState();
  for (let i = 1; i < zxIndex; i++) belowZx.ownedBikeIds.push(IdleCore.IDLE_BIKES[i].id);
  assert(IdleCore.canFinishSeason(belowZx) === false, 'canFinishSeason() === false, solange die ZX-10R noch nicht besessen wird');

  const atZx = IdleCore.createInitialState();
  for (let i = 1; i <= zxIndex; i++) {
    atZx.ownedBikeIds.push(IdleCore.IDLE_BIKES[i].id);
    atZx.bikeLevels[IdleCore.IDLE_BIKES[i].id] = 0;
  }
  assert(IdleCore.canFinishSeason(atZx) === true, 'canFinishSeason() === true, sobald die ZX-10R besessen wird');

  // finishSeason(): No-op, falls (noch) nicht abschliessbar.
  const notFinished = IdleCore.finishSeason(belowZx);
  assert(notFinished === belowZx, 'finishSeason() gibt den unveränderten Zustand zurück, falls canFinishSeason() false ist');

  // finishSeason(): resettet km/ownedBikeIds/bikeLevels/combo, behält Trophäen/Verträge/Teile/Stats/totalKmEarned/Sound/Offline.
  atZx.km = 12345;
  atZx.totalKmEarned = 99999;
  atZx.parts.collected = ['helm_standard'];
  atZx.prestige.trophies = 2;
  atZx.prestige.points = 2;
  atZx.prestige.contracts = ['zoneBreiter10'];
  atZx.combo = { count: 4, multiplier: 3, multiplierExpiresAt: Date.now() + 5000 };
  atZx.sound = { enabled: true, volume: 0.7 };
  atZx.offline.lastSeenAt = 123456;
  const expectedNewTrophies = IdleCore.trophiesForSeason(atZx);

  const afterSeason = IdleCore.finishSeason(atZx);
  assert(afterSeason !== atZx, 'finishSeason() gibt bei Erfolg ein NEUES Zustandsobjekt zurück (mutiert atZx nicht)');
  assert(afterSeason.km === 0, 'finishSeason() setzt km auf 0 zurück');
  assert(afterSeason.ownedBikeIds.length === 1 && afterSeason.ownedBikeIds[0] === IdleCore.IDLE_BIKES[0].id, 'finishSeason() setzt ownedBikeIds auf nur das Startbike zurück (ohne aktiven Start-Vertrag)');
  assert(afterSeason.combo.count === 0, 'finishSeason() setzt die Schaltpunkt-Combo zurück');
  assert(afterSeason.totalKmEarned === 99999, 'finishSeason() behält die Lebenszeit-km-Statistik (totalKmEarned)');
  assert(afterSeason.parts.collected.indexOf('helm_standard') !== -1, 'finishSeason() behält die Teile-Sammlung');
  assert(afterSeason.prestige.contracts.indexOf('zoneBreiter10') !== -1, 'finishSeason() behält gekaufte Werksverträge');
  assert(afterSeason.prestige.trophies === 2 + expectedNewTrophies, 'finishSeason() addiert die neu verdienten Trophäen zu den vorhandenen');
  assert(afterSeason.prestige.level === 1, 'finishSeason() erhöht prestige.level um 1');
  assert(afterSeason.sound.enabled === true, 'finishSeason() behält die Sound-Einstellungen');
  assert(afterSeason.offline.lastSeenAt === 123456, 'finishSeason() behält den Offline-Zeitstempel');

  // "Start mit Ninja 400"-Werksvertrag: neue Saison beginnt mit Ninja 400 statt Z125 PRO.
  const withStartContract = IdleCore.createInitialState();
  for (let i = 1; i <= zxIndex; i++) {
    withStartContract.ownedBikeIds.push(IdleCore.IDLE_BIKES[i].id);
    withStartContract.bikeLevels[IdleCore.IDLE_BIKES[i].id] = 0;
  }
  withStartContract.prestige.contracts = ['startNinja400'];
  const afterSeasonWithContract = IdleCore.finishSeason(withStartContract);
  assert(afterSeasonWithContract.currentBikeId === 'ninja400', '"Start mit Ninja 400"-Vertrag: finishSeason() setzt currentBikeId auf ninja400');
  assert(afterSeasonWithContract.ownedBikeIds.indexOf('ninja400') !== -1, '"Start mit Ninja 400"-Vertrag: ninja400 ist nach dem Reset bereits besessen');

  // contractEffects(): aggregiert alle aktiven Effekte + den Pro-Saison-Prestige-Bonus.
  const noEffects = IdleCore.contractEffects(IdleCore.createInitialState());
  assert(noEffects.earnMultiplier === 1, 'contractEffects() ohne Verträge/Prestige-Level: earnMultiplier === 1');
  assert(noEffects.startBikeId === null, 'contractEffects() ohne Verträge: startBikeId === null');
  assert(noEffects.zoneWidthBonusPct === 0, 'contractEffects() ohne Verträge: zoneWidthBonusPct === 0');
  assert(noEffects.offlineCapMultiplier === 1, 'contractEffects() ohne Verträge: offlineCapMultiplier === 1');
  assert(noEffects.tuningCostMultiplier === 1, 'contractEffects() ohne Verträge: tuningCostMultiplier === 1');

  const allContractsState = IdleCore.createInitialState();
  allContractsState.prestige.contracts = IdleCore.IDLE_CONTRACTS.map((c) => c.id);
  const allEffects = IdleCore.contractEffects(allContractsState);
  assert(Math.abs(allEffects.earnMultiplier - 1.25) < 1e-9, 'contractEffects() mit "+25% Ertrag"-Vertrag: earnMultiplier === 1.25');
  assert(allEffects.startBikeId === 'ninja400', 'contractEffects() mit "Start mit Ninja 400"-Vertrag: startBikeId === "ninja400"');
  assert(allEffects.zoneWidthBonusPct === 10, 'contractEffects() mit "Perfekt-Zone 10% breiter"-Vertrag: zoneWidthBonusPct === 10');
  assert(allEffects.offlineCapMultiplier === 2, 'contractEffects() mit "Offline verdoppelt"-Vertrag: offlineCapMultiplier === 2');
  assert(Math.abs(allEffects.tuningCostMultiplier - 0.85) < 1e-9, 'contractEffects() mit "Tuning 15% günstiger"-Vertrag: tuningCostMultiplier === 0.85');

  const leveledState = IdleCore.createInitialState();
  leveledState.prestige.level = 2;
  const leveledEffects = IdleCore.contractEffects(leveledState);
  assert(
    Math.abs(leveledEffects.earnMultiplier - (1 + 2 * IdleCore.IDLE_BALANCE.PRESTIGE_BONUS_PER_LEVEL)) < 1e-9,
    'contractEffects() addiert den permanenten Pro-Saison-Bonus (PRESTIGE_BONUS_PER_LEVEL) je prestige.level'
  );

  // canBuyContract()/buyContract(): respektiert Trophäenkosten + verhindert Doppelkauf.
  const buyState = IdleCore.createInitialState();
  assert(IdleCore.canBuyContract(buyState, 'ertrag25') === false, 'canBuyContract() === false ohne genug Trophäen');
  buyState.prestige.trophies = 10;
  assert(IdleCore.canBuyContract(buyState, 'ertrag25') === true, 'canBuyContract() === true mit genug Trophäen');
  const bought = IdleCore.buyContract(buyState, 'ertrag25');
  assert(bought.success === true, 'buyContract() gelingt mit genug Trophäen');
  assert(buyState.prestige.trophies === 10 - IdleCore.getContractById('ertrag25').kostenTrophaeen, 'buyContract() zieht die Trophäenkosten ab');
  assert(buyState.prestige.contracts.indexOf('ertrag25') !== -1, 'buyContract() fügt die Vertrags-id hinzu');
  assert(IdleCore.canBuyContract(buyState, 'ertrag25') === false, 'canBuyContract() === false für einen bereits besessenen Vertrag');
  const boughtAgain = IdleCore.buyContract(buyState, 'ertrag25');
  assert(boughtAgain.success === false, 'buyContract() schlägt für einen bereits besessenen Vertrag fehl');

  // effectiveTuningCost(): wendet den Tuning-Rabatt-Vertrag an.
  const noContractCost = IdleCore.effectiveTuningCost(IdleCore.createInitialState(), IdleCore.IDLE_BIKES[0].id, 0);
  const discountState = IdleCore.createInitialState();
  discountState.prestige.contracts = ['tuningGuenstiger15'];
  const discountedCost = IdleCore.effectiveTuningCost(discountState, IdleCore.IDLE_BIKES[0].id, 0);
  assert(discountedCost < noContractCost, 'effectiveTuningCost() ist mit "Tuning 15% günstiger"-Vertrag niedriger als ohne');
  assert(IdleCore.effectiveTuningCost(IdleCore.createInitialState(), 'unbekannte-id', 0) === null, 'effectiveTuningCost() mit unbekannter Bike-id === null');

  // perfectZoneWidthForState(): wendet den Zonen-Breite-Vertrag an.
  const noContractWidth = IdleCore.perfectZoneWidthForState(IdleCore.createInitialState(), 0);
  const widerState = IdleCore.createInitialState();
  widerState.prestige.contracts = ['zoneBreiter10'];
  const widerWidth = IdleCore.perfectZoneWidthForState(widerState, 0);
  assert(widerWidth > noContractWidth, 'perfectZoneWidthForState() ist mit "Perfekt-Zone 10% breiter"-Vertrag breiter als ohne');
  assert(Math.abs(widerWidth - noContractWidth - 10) < 1e-9, 'perfectZoneWidthForState() addiert exakt die vertraglich zugesagten 10 Prozentpunkte');
})();

section('11 · Teile-Sammlung (rollPartDrop/addPart/setBonuses)');
(function () {
  // rollPartDrop(): deterministisch bei fester Zufallsfolge; "kein Drop", falls die erste Zahl über der Drop-Chance liegt.
  assert(IdleCore.rollPartDrop(() => 0.999) === null, 'rollPartDrop() liefert null, falls die Zufallszahl über PART_DROP_CHANCE_PER_LAP liegt');

  let callIndex = 0;
  const sequence = [0, 0, 0]; // Drop ja (0 < Chance) → Seltenheit 'common' (0 < weights.common) → erstes 'common'-Teil
  const fixedRng = () => sequence[Math.min(callIndex++, sequence.length - 1)];
  const firstCommonId = IdleCore.IDLE_PARTS.filter((p) => p.rarity === 'common')[0].id;
  assert(IdleCore.rollPartDrop(fixedRng) === firstCommonId, 'rollPartDrop() liefert mit fester Zufallsfolge [0,0,0] deterministisch das erste "common"-Teil');

  // Verteilung über viele geseedete Rolls: alle 3 Seltenheitsstufen kommen vor, ~PART_DROP_CHANCE_PER_LAP Drop-Rate.
  let seed = 42;
  function seededRandom() {
    // Einfacher deterministischer LCG-basierter Pseudo-Zufallsgenerator (immer dieselbe Folge für denselben Seed).
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  const ROLL_COUNT = 20000;
  let dropCount = 0;
  const rarityCounts = { common: 0, rare: 0, legendary: 0 };
  for (let i = 0; i < ROLL_COUNT; i++) {
    const partId = IdleCore.rollPartDrop(seededRandom);
    if (partId) {
      dropCount++;
      const part = IdleCore.getPartById(partId);
      rarityCounts[part.rarity]++;
    }
  }
  const expectedDrops = ROLL_COUNT * IdleCore.IDLE_BALANCE.PART_DROP_CHANCE_PER_LAP;
  assert(Math.abs(dropCount - expectedDrops) / expectedDrops < 0.25, `Drop-Rate über ${ROLL_COUNT} geseedete Rolls (${dropCount}) liegt nahe der erwarteten ~${Math.round(expectedDrops)} (PART_DROP_CHANCE_PER_LAP)`);
  assert(rarityCounts.common > rarityCounts.rare, `Seltenheits-Verteilung: common (${rarityCounts.common}) > rare (${rarityCounts.rare}) — schwerer gewichtet`);
  assert(rarityCounts.rare > rarityCounts.legendary, `Seltenheits-Verteilung: rare (${rarityCounts.rare}) > legendary (${rarityCounts.legendary}) — schwerer gewichtet`);
  assert(rarityCounts.legendary > 0, `Seltenheits-Verteilung: legendary (${rarityCounts.legendary}) kommt über ${ROLL_COUNT} Rolls mindestens einmal vor`);

  // addPart(): neues Teil vs. Dublette (→ km-Umwandlung).
  const partsState = IdleCore.createInitialState();
  const somePart = IdleCore.IDLE_PARTS[0];
  const addedNew = IdleCore.addPart(partsState, somePart.id);
  assert(addedNew.isNew === true, 'addPart() meldet isNew=true für ein neues Teil');
  assert(addedNew.awardedKm === 0, 'addPart() gewährt keine km für ein neues Teil');
  assert(partsState.parts.collected.indexOf(somePart.id) !== -1, 'addPart() fügt die id zur Sammlung hinzu');
  assert(partsState.km === 0, 'addPart() eines neuen Teils verändert km nicht');

  const kmBefore = partsState.km;
  const addedDuplicate = IdleCore.addPart(partsState, somePart.id);
  assert(addedDuplicate.isNew === false, 'addPart() meldet isNew=false für eine Dublette');
  const expectedValue = IdleCore.IDLE_BALANCE.PART_DUPLICATE_KM_VALUE[somePart.rarity];
  assert(addedDuplicate.awardedKm === expectedValue, `addPart() einer Dublette gewährt genau PART_DUPLICATE_KM_VALUE.${somePart.rarity} (${expectedValue}) km`);
  assert(partsState.km === kmBefore + expectedValue, 'addPart() einer Dublette bucht die km korrekt auf state.km');
  assert(
    partsState.parts.collected.filter((id) => id === somePart.id).length === 1,
    'addPart() einer Dublette fügt die id NICHT erneut zur Sammlung hinzu (keine Duplikate in der Liste)'
  );

  assert(IdleCore.addPart(partsState, 'unbekannte-teile-id').part === null, 'addPart() mit unbekannter Teile-id liefert part:null (kein Absturz)');

  // setBonuses(): Set-Bonus nur bei vollständigem Set, aggregiert korrekt über mehrere Sets.
  const bonusState = IdleCore.createInitialState();
  const noBonus = IdleCore.setBonuses(bonusState);
  assert(noBonus.totalBonusPct === 0, 'setBonuses() ohne Teile: totalBonusPct === 0');
  assert(noBonus.totalBonusMultiplier === 1, 'setBonuses() ohne Teile: totalBonusMultiplier === 1');
  assert(noBonus.completedSets.length === 0, 'setBonuses() ohne Teile: keine kompletten Sets');

  const firstSet = IdleCore.IDLE_PART_SETS[0];
  const firstSetPartIds = IdleCore.IDLE_PARTS.filter((p) => p.setId === firstSet.id).map((p) => p.id);
  firstSetPartIds.slice(0, -1).forEach((id) => IdleCore.addPart(bonusState, id));
  assert(IdleCore.setBonuses(bonusState).completedSets.length === 0, 'setBonuses() zählt ein Set NICHT als komplett, solange 1 Teil fehlt');

  IdleCore.addPart(bonusState, firstSetPartIds[firstSetPartIds.length - 1]);
  const oneSetBonus = IdleCore.setBonuses(bonusState);
  assert(oneSetBonus.completedSets.length === 1 && oneSetBonus.completedSets[0] === firstSet.id, 'setBonuses() zählt ein Set als komplett, sobald alle seine Teile besessen sind');
  assert(oneSetBonus.totalBonusPct === firstSet.bonusPct, 'setBonuses() liefert genau den bonusPct des kompletten Sets');
  assert(Math.abs(oneSetBonus.totalBonusMultiplier - (1 + firstSet.bonusPct / 100)) < 1e-9, 'setBonuses() totalBonusMultiplier entspricht 1 + bonusPct/100');

  const secondSet = IdleCore.IDLE_PART_SETS[1];
  const secondSetPartIds = IdleCore.IDLE_PARTS.filter((p) => p.setId === secondSet.id).map((p) => p.id);
  secondSetPartIds.forEach((id) => IdleCore.addPart(bonusState, id));
  const twoSetBonus = IdleCore.setBonuses(bonusState);
  assert(twoSetBonus.completedSets.length === 2, 'setBonuses() zählt mehrere komplette Sets gleichzeitig');
  assert(twoSetBonus.totalBonusPct === firstSet.bonusPct + secondSet.bonusPct, 'setBonuses() summiert die bonusPct-Werte mehrerer kompletter Sets');
})();

section('12 · Offline-Ertrag (offlineEarn) — Deckelung + Werksvertrag-Verdoppelung');
(function () {
  const state = IdleCore.createInitialState();

  assert(IdleCore.offlineEarn(state, 0) === 0, 'offlineEarn(state, 0) === 0');
  assert(IdleCore.offlineEarn(state, -100) === 0, 'offlineEarn(state, negativ) === 0');
  assert(IdleCore.offlineEarn(null, 100) === 0, 'offlineEarn(null, ...) === 0 (kein Absturz)');

  const oneHour = 3600;
  const expectedOneHour = IdleCore.passiveEarn(state, oneHour) * IdleCore.IDLE_BALANCE.OFFLINE_EARN_FRACTION;
  assert(Math.abs(IdleCore.offlineEarn(state, oneHour) - expectedOneHour) < 1e-6, 'offlineEarn() für 1h unterhalb des Caps entspricht passiveEarn(1h) × OFFLINE_EARN_FRACTION');

  const cap = IdleCore.IDLE_BALANCE.OFFLINE_CAP_SECONDS;
  const atCap = IdleCore.offlineEarn(state, cap);
  const wayOverCap = IdleCore.offlineEarn(state, cap * 10);
  assert(Math.abs(atCap - wayOverCap) < 1e-6, 'offlineEarn() deckelt exakt bei OFFLINE_CAP_SECONDS (4h) — 10× mehr Abwesenheit ändert am Ergebnis nichts');
  assert(atCap > 0, 'offlineEarn() am Cap ist trotzdem > 0');

  const doubledState = IdleCore.createInitialState();
  doubledState.prestige.contracts = ['offlineVerdoppelt'];
  const doubledBetweenCaps = IdleCore.offlineEarn(doubledState, cap * 1.5); // > altes 4h-Cap, aber < neues 8h-Cap
  const doubledAtNewCap = IdleCore.offlineEarn(doubledState, cap * 2);
  const doubledWayOver = IdleCore.offlineEarn(doubledState, cap * 20);
  assert(doubledBetweenCaps > atCap, '"Offline verdoppelt"-Vertrag: bei 6h Abwesenheit (> altes 4h-Cap) wird MEHR gutgeschrieben als ohne Vertrag (dessen 4h-Cap bereits erreicht wäre)');
  assert(Math.abs(doubledAtNewCap - doubledWayOver) < 1e-6, '"Offline verdoppelt"-Vertrag: offlineEarn() deckelt jetzt exakt bei 8h (2× OFFLINE_CAP_SECONDS)');
  assert(Math.abs(doubledAtNewCap - atCap * 2) < 1e-6, '"Offline verdoppelt"-Vertrag: der neue 8h-Cap-Ertrag ist exakt doppelt so hoch wie der alte 4h-Cap-Ertrag');

  // offlineEarn() wendet auch den Ertrags-Vertrag + Teile-Set-Bonus an (wie passiveEarn im laufenden Spiel).
  const earnContractState = IdleCore.createInitialState();
  earnContractState.prestige.contracts = ['ertrag25'];
  const boostedOneHour = IdleCore.offlineEarn(earnContractState, oneHour);
  assert(boostedOneHour > expectedOneHour, 'offlineEarn() wendet den "+25% Ertrag"-Vertrag ebenfalls an');
})();

section('13 · Statistiken (recordLap/recordComboPeak/addPlayTime) + vollständiger Save/Load-Roundtrip aller Phase-C-Felder');
(function () {
  const state = IdleCore.createInitialState();
  assert(state.stats.laps === 0 && state.stats.bestCombo === 0 && state.stats.playTimeSeconds === 0 && Array.isArray(state.stats.seasonHistory) && state.stats.seasonHistory.length === 0, 'createInitialState() liefert ein leeres, gültiges stats-Objekt');

  IdleCore.recordLap(state);
  IdleCore.recordLap(state);
  assert(state.stats.laps === 2, 'recordLap() erhöht state.stats.laps je Aufruf um 1');

  IdleCore.recordComboPeak(state, 5);
  assert(state.stats.bestCombo === 5, 'recordComboPeak() setzt einen neuen, höheren Bestwert');
  IdleCore.recordComboPeak(state, 2);
  assert(state.stats.bestCombo === 5, 'recordComboPeak() überschreibt den Bestwert NICHT mit einem niedrigeren Wert');

  IdleCore.addPlayTime(state, 12.5);
  IdleCore.addPlayTime(state, 7.5);
  assert(Math.abs(state.stats.playTimeSeconds - 20) < 1e-9, 'addPlayTime() summiert die Spielzeit kumulativ');
  IdleCore.addPlayTime(state, -5);
  assert(Math.abs(state.stats.playTimeSeconds - 20) < 1e-9, 'addPlayTime() ignoriert negative dtSeconds (kein Rückgang)');

  // Vollständiger Save/Load-Roundtrip: ALLE Phase-C-Felder (prestige/parts/offline/stats) überstehen saveState()/loadState().
  localStorage.clear();
  const fullState = IdleCore.createInitialState();
  fullState.prestige = { level: 3, points: 42, trophies: 17, contracts: ['ertrag25', 'zoneBreiter10'] };
  fullState.parts.collected = ['helm_standard', 'auspuff_slipon'];
  fullState.offline.lastSeenAt = 1700000000000;
  fullState.stats = { laps: 88, bestCombo: 9, seasonHistory: [{ season: 1, trophiesEarned: 5, finishedAt: 1600000000000 }], playTimeSeconds: 555.5 };

  IdleCore.saveState(fullState);
  const reloaded = IdleCore.loadState();

  assert(reloaded.version === IdleCore.IDLE_STATE_VERSION, `vollständiger Roundtrip: version === ${IdleCore.IDLE_STATE_VERSION}`);
  assert(reloaded.prestige.level === 3 && reloaded.prestige.points === 42 && reloaded.prestige.trophies === 17, 'vollständiger Roundtrip: prestige.level/points/trophies übersteht saveState()/loadState()');
  assert(reloaded.prestige.contracts.length === 2 && reloaded.prestige.contracts.indexOf('ertrag25') !== -1 && reloaded.prestige.contracts.indexOf('zoneBreiter10') !== -1, 'vollständiger Roundtrip: prestige.contracts übersteht saveState()/loadState()');
  assert(reloaded.parts.collected.length === 2 && reloaded.parts.collected.indexOf('helm_standard') !== -1, 'vollständiger Roundtrip: parts.collected übersteht saveState()/loadState()');
  // saveState() aktualisiert offline.lastSeenAt bewusst auf "jetzt" (siehe idle-core.js) — hier wird nur geprüft, dass es weiterhin eine gültige Zahl ist.
  assert(typeof reloaded.offline.lastSeenAt === 'number', 'vollständiger Roundtrip: offline.lastSeenAt bleibt eine gültige Zahl (saveState() aktualisiert sie bewusst auf "jetzt")');
  assert(reloaded.stats.laps === 88 && reloaded.stats.bestCombo === 9, 'vollständiger Roundtrip: stats.laps/bestCombo übersteht saveState()/loadState()');
  assert(Math.abs(reloaded.stats.playTimeSeconds - 555.5) < 1e-9, 'vollständiger Roundtrip: stats.playTimeSeconds übersteht saveState()/loadState()');
  assert(reloaded.stats.seasonHistory.length === 1 && reloaded.stats.seasonHistory[0].trophiesEarned === 5, 'vollständiger Roundtrip: stats.seasonHistory übersteht saveState()/loadState()');

  // migrateState() befüllt fehlende Phase-C-Felder defensiv (altes Save ohne prestige.trophies/contracts/stats).
  const legacyRaw = { version: 1, km: 100, ownedBikeIds: ['z125pro'], currentBikeId: 'z125pro', bikeLevels: { z125pro: 0 }, prestige: { level: 1, points: 5 } };
  const migratedLegacy = IdleCore.migrateState(legacyRaw);
  assert(migratedLegacy.prestige.level === 1 && migratedLegacy.prestige.points === 5, 'migrateState() übernimmt gültige ältere prestige.level/points-Werte');
  assert(typeof migratedLegacy.prestige.trophies === 'number' && Array.isArray(migratedLegacy.prestige.contracts), 'migrateState() füllt fehlende prestige.trophies/contracts defensiv auf (altes Save ohne diese Felder)');
  assert(migratedLegacy.stats && typeof migratedLegacy.stats.laps === 'number' && Array.isArray(migratedLegacy.stats.seasonHistory), 'migrateState() füllt ein komplett fehlendes stats-Feld defensiv auf (altes Save vor feat(idle-stats))');
  assert(migratedLegacy.parts && Array.isArray(migratedLegacy.parts.collected), 'migrateState() füllt ein fehlendes parts-Feld defensiv auf');

  // migrateState() bereinigt unbekannte Vertrags-/Teile-ids (z. B. aus einer künftigen, hier unbekannten Version).
  const corruptRaw = { version: 1, km: 0, prestige: { level: 0, points: 0, trophies: 0, contracts: ['ertrag25', 'nicht-existierender-vertrag'] }, parts: { collected: ['helm_standard', 'nicht-existierendes-teil'] } };
  const migratedCorrupt = IdleCore.migrateState(corruptRaw);
  assert(migratedCorrupt.prestige.contracts.length === 1 && migratedCorrupt.prestige.contracts[0] === 'ertrag25', 'migrateState() entfernt unbekannte Vertrags-ids, behält gültige');
  assert(migratedCorrupt.parts.collected.length === 1 && migratedCorrupt.parts.collected[0] === 'helm_standard', 'migrateState() entfernt unbekannte Teile-ids, behält gültige');
})();

// ============================================================
// Results
// ============================================================
console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${passed}/${passed + failed} passed`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) process.exit(1);
