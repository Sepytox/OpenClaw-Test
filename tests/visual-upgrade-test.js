#!/usr/bin/env node
/**
 * Visual-Upgrade-Regressionstests
 *
 * Statische Prüfungen (keine DOM-Simulation nötig), die sicherstellen,
 * dass das visuelle Upgrade (Design-Tokens, Hover/Micro-Interactions,
 * Eintritts-Animationen, Hero, Bild-System, Glassmorphism) vorhanden
 * ist und die harten Regeln aus der Aufgabenstellung einhält:
 *  1. design.css definiert die neuen Design-Tokens (Spacing, Radius,
 *     Motion/Easing, Schatten) für Dark- UND Light-Mode.
 *  2. Eine prefers-reduced-motion-Media-Query existiert.
 *  3. :focus-visible ist für Tastaturnutzer sichtbar definiert.
 *  4. Keine externen Bild-URLs (http/https, insb. placehold.co) mehr
 *     in den bearbeiteten HTML/CSS-Dateien.
 *  5. scroll-reveal.js (IntersectionObserver-Modul) existiert, ist
 *     syntaktisch gültig, enthält JSDoc, kein console.log und wird von
 *     index/quiz/race/wheel/shop.html eingebunden, nicht aber von
 *     soundcheck.html (geschützte Datei).
 *  6. index.html enthält den neuen Hero-Bereich.
 *  7. Glassmorphism (backdrop-filter) ist sparsam über @supports
 *     abgesichert vorhanden.
 *
 * Run: node tests/visual-upgrade-test.js
 * Exit 0 = alle Tests bestanden, Exit 1 = mindestens ein Fehler.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
// Test harness (Stil an tests/physics-test.js / tests/polish-test.js angelehnt)
// ============================================================
let passed = 0, failed = 0;

/**
 * Prüft eine Bedingung und protokolliert das Ergebnis.
 * @param {boolean} cond - Zu prüfende Bedingung.
 * @param {string} msg - Beschreibung des Tests.
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
 * Druckt eine Abschnittsüberschrift für die Konsolenausgabe.
 * @param {string} title - Abschnittstitel.
 */
function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// ============================================================
// Tests
// ============================================================

section('1. Design-Tokens in design.css (Dark + Light)');
{
  const css = read('design.css');
  const tokens = [
    '--space-4', '--radius-lg', '--radius-full',
    '--dur-base', '--dur-slow', '--ease-standard', '--ease-spring',
    '--font-hero'
  ];
  tokens.forEach((token) => {
    assert(css.includes(token + ':'), `design.css definiert Token ${token}`);
  });

  const darkBlockMatch = css.match(/:root\s*\{[\s\S]*?--shadow-lg:[\s\S]*?\}/);
  assert(!!darkBlockMatch, 'Dark-Mode-:root definiert --shadow-lg (Elevation-Token)');
  const lightBlockMatch = css.match(/\[data-theme="light"\]\s*\{[\s\S]*?--shadow-lg:[\s\S]*?\}/);
  assert(!!lightBlockMatch, 'Light-Mode ([data-theme="light"]) definiert --shadow-lg ebenfalls');
}

section('2. prefers-reduced-motion wird respektiert');
{
  const css = read('design.css');
  assert(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css),
    'design.css enthält eine prefers-reduced-motion-Media-Query'
  );
}

section('3. Sichtbarer Tastatur-Fokus (:focus-visible)');
{
  const design = read('design.css');
  const styles = read('styles.css');
  assert(design.includes(':focus-visible') || styles.includes(':focus-visible'),
    'design.css oder styles.css definiert :focus-visible-Regeln');
}

section('4. Keine externen Bild-URLs mehr (kein placehold.co, kein <img http)');
{
  ['index.html', 'quiz.html', 'race.html', 'wheel.html', 'shop.html'].forEach((file) => {
    const html = read(file);
    assert(!html.includes('placehold.co'), `${file} referenziert placehold.co nicht mehr`);
    assert(
      !/<img[^>]+src=["']https?:\/\//i.test(html),
      `${file} hat kein <img> mit externer http(s)-Quelle`
    );
  });
  ['design.css', 'styles.css'].forEach((file) => {
    const css = read(file);
    assert(!/url\(\s*['"]?https?:\/\//i.test(css), `${file} lädt keine externen Bild-URLs via url()`);
  });
}

section('5. Gemeinsames Eintritts-Animations-Modul scroll-reveal.js');
{
  const scrollRevealPath = path.join(ROOT, 'scroll-reveal.js');
  assert(fs.existsSync(scrollRevealPath), 'scroll-reveal.js existiert im Projekt-Root');
  const js = fs.readFileSync(scrollRevealPath, 'utf8');

  assert(!js.includes('console.log'), 'scroll-reveal.js enthält kein console.log');
  assert(js.includes('/**'), 'scroll-reveal.js enthält JSDoc-Kommentare');
  assert(js.includes('IntersectionObserver'), 'scroll-reveal.js nutzt IntersectionObserver');
  assert(js.includes('prefersReducedMotion'), 'scroll-reveal.js prüft prefers-reduced-motion');

  try {
    execSync(`node --check "${scrollRevealPath}"`, { cwd: ROOT, stdio: 'pipe' });
    assert(true, 'scroll-reveal.js ist syntaktisch gültiges JavaScript (node --check)');
  } catch (e) {
    assert(false, 'scroll-reveal.js ist syntaktisch gültiges JavaScript (node --check)');
  }

  ['index.html', 'quiz.html', 'race.html', 'wheel.html', 'shop.html'].forEach((file) => {
    const html = read(file);
    assert(
      html.includes('<script src="scroll-reveal.js">'),
      `${file} bindet scroll-reveal.js ein`
    );
  });

  const soundcheckHtml = read('soundcheck.html');
  assert(
    !soundcheckHtml.includes('scroll-reveal.js'),
    'soundcheck.html bindet scroll-reveal.js NICHT ein (geschützte Datei)'
  );
}

section('6. Hero-Bereich auf index.html (feat(hero))');
{
  const html = read('index.html');
  assert(html.includes('class="hero'), 'index.html enthält einen Hero-Bereich (class="hero...")');
  assert(html.includes('hero-cta'), 'Der Hero-Bereich enthält mindestens einen Call-to-Action-Link');
}

section('7. Glassmorphism sparsam via @supports abgesichert');
{
  const design = read('design.css');
  const styles = read('styles.css');
  const combined = design + styles;
  assert(
    /@supports[^{]*backdrop-filter/i.test(combined),
    'Ein @supports-Feature-Query für backdrop-filter existiert (Fallback für nicht unterstützende Browser)'
  );
  assert(combined.includes('backdrop-filter:'), 'backdrop-filter wird tatsächlich irgendwo eingesetzt');
}

// ============================================================
// Ergebnis
// ============================================================
console.log(`\n${'═'.repeat(60)}`);
console.log(`  RESULTS: ${passed}/${passed + failed} passed`);
console.log('═'.repeat(60));

if (failed > 0) process.exit(1);
