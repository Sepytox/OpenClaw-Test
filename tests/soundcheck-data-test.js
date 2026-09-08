#!/usr/bin/env node
/**
 * Headless Test — SoundCheck Audio-Zuordnung (soundcheck.js)
 *
 * Statische Prüfungen (kein DOM/Browser nötig, da soundcheck.js `window`
 * bereits beim Parsen referenziert und daher nicht direkt in Node
 * `require`-bar ist — Stil analog zu tests/polish-test.js):
 *  1. Jede in AUDIO_FILES referenzierte Datei existiert tatsächlich unter
 *     audio/ (kein 404/Broken-Audio).
 *  2. Die fehlerhafte, zu Recon-Zeiten gefundene Zuordnung
 *     "versys650 stock === harley-engine.mp3" ist behoben: 'harley-engine'
 *     wird in AUDIO_FILES nirgends mehr referenziert, und 'versys650' hat
 *     bewusst KEINEN 'stock'-Eintrag mehr (→ Web-Audio-Synthese-Fallback
 *     statt falsch zugeordnetem Sound).
 *  3. Die SoundCheck-BIKES-Roster-IDs sind — bis auf 'w230'/'h2', die
 *     bewusst umbenannt wurden (siehe unten) — echte Katalog-IDs aus
 *     bikes-data.js (Recon §D.3: vorher 3 verwaiste IDs, die es im
 *     Hauptkatalog gar nicht gab).
 *  4. hasRealAudio() existiert und wird für ein "Sound folgt"-UI-Badge
 *     genutzt (kein stilles Fehlschlagen ohne Hinweis).
 *
 * Run: node tests/soundcheck-data-test.js
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

const soundcheckSrc = read('soundcheck.js');

// Extrahiere den AUDIO_FILES-Objektliteral-Block als Text.
const audioBlockMatch = soundcheckSrc.match(/var AUDIO_FILES = \{([\s\S]*?)\n  \};/);

section('1 · AUDIO_FILES-Block existiert und referenziert nur vorhandene Dateien');
(function() {
  assert(audioBlockMatch !== null, 'AUDIO_FILES-Objektliteral wurde gefunden');
  const block = audioBlockMatch ? audioBlockMatch[1] : '';
  const pathRe = /'(audio\/[a-z0-9_-]+\.mp3)'/g;
  const referenced = [];
  let m;
  while ((m = pathRe.exec(block)) !== null) referenced.push(m[1]);
  assert(referenced.length > 0, `Mindestens eine Audio-Datei referenziert (gefunden: ${referenced.length})`);
  referenced.forEach(p => {
    assert(fs.existsSync(path.join(ROOT, p)), `${p} existiert tatsächlich unter audio/`);
  });
})();

section('2 · Harley-Fehlzuordnung behoben (Recon-Bug: versys650 stock === harley-engine.mp3)');
(function() {
  const block = audioBlockMatch ? audioBlockMatch[1] : '';
  assert(!block.includes('harley'), 'AUDIO_FILES referenziert harley-engine.mp3 nirgends mehr');

  // versys650-Eintrag darf keinen 'stock'-Schlüssel mehr haben.
  const versysEntryMatch = block.match(/versys650:\s*\{([\s\S]*?)\},/);
  assert(versysEntryMatch !== null, 'versys650-Eintrag in AUDIO_FILES gefunden');
  const versysEntry = versysEntryMatch ? versysEntryMatch[1] : '';
  assert(!/\bstock\s*:/.test(versysEntry), 'versys650 hat bewusst keinen stock-Eintrag mehr (fällt auf Synthese zurück statt falschem Sound)');
  assert(/\bracing\s*:/.test(versysEntry) && /\bcustom\s*:/.test(versysEntry), 'versys650 behält racing/custom (eigene, korrekt benannte Dateien)');
})();

section('3 · SoundCheck-Roster nutzt echte Katalog-IDs (bikes-data.js)');
(function() {
  const bikesBlockMatch = soundcheckSrc.match(/var BIKES = \[([\s\S]*?)\n  \];/);
  assert(bikesBlockMatch !== null, 'SoundCheck BIKES-Array gefunden');
  const idRe = /id:\s*'(\w+)'/g;
  const ids = [];
  let m;
  while ((m = idRe.exec(bikesBlockMatch[1])) !== null) ids.push(m[1]);
  assert(ids.length === 6, `SoundCheck-Roster hat 6 Einträge (gefunden: ${ids.length})`);

  // Alte, verwaiste Recon-IDs dürfen nicht mehr vorkommen.
  ['z650rs', 'h2r'].forEach(orphan => {
    assert(!ids.includes(orphan), `Verwaiste ID "${orphan}" (existierte nie im Hauptkatalog) wurde entfernt`);
  });

  // Jede verbleibende Roster-ID muss ein echtes SHARED_BIKES-Modell sein.
  ids.forEach(id => {
    assert(Object.prototype.hasOwnProperty.call(SHARED_BIKES, id), `SoundCheck-ID "${id}" existiert als echtes Modell in SHARED_BIKES`);
  });
})();

section('4 · "Sound folgt"-Kennzeichnung ist implementiert (kein stilles Fehlverhalten)');
(function() {
  assert(soundcheckSrc.includes('function hasRealAudio'), 'hasRealAudio() Helper-Funktion existiert');
  assert(soundcheckSrc.includes('Sound folgt'), 'UI zeigt den deutschen Hinweistext "Sound folgt" für Kombinationen ohne echte Aufnahme');
  assert(soundcheckSrc.includes('sc-badge-synth'), 'CSS-Klasse für das "Sound folgt"-Badge wird gesetzt');
})();

// ============================================================
// Results
// ============================================================
console.log('\n' + '═'.repeat(60));
console.log(`  RESULTS: ${passed}/${passed + failed} passed`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) process.exit(1);
