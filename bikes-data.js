/**
 * bikes-data.js — Geteilte Kawasaki-Motorrad-Datenquelle (Single Source of Truth).
 *
 * Spiegelt exakt die 19 Motorräder aus dem `BIKES`-Objekt in index.html (siehe
 * dortiges `makeBike(...)`-Inline-Script). Wird sowohl im Browser (window/globalThis)
 * als auch in Node (module.exports) bereitgestellt, damit shop.html, quiz.html,
 * wheel.html sowie die Tests unter tests/ dieselben Werte verwenden.
 *
 * Felder pro Eintrag: id, name, icon, category, license, ps, kw, torque, weight,
 * vmax, accel, price, sub (Subtitle).
 */
'use strict';

/**
 * Baut einen einzelnen Bike-Datensatz mit ergänzter id.
 * @param {string} id - Eindeutiger Bike-Schlüssel (z. B. "z900").
 * @param {Object} data - Rohdaten des Motorrads.
 * @returns {Object} Vollständiger Bike-Datensatz inklusive id.
 */
function makeSharedBike(id, data) {
  return Object.assign({ id: id }, data);
}

/**
 * SHARED_BIKES — kanonische Liste aller 19 Kawasaki-Motorräder.
 * Quelle: index.html, var BIKES (Inline-Script, ~Zeile 579).
 */
var SHARED_BIKES = {
  h2: makeSharedBike('h2', {
    name: 'Kawasaki Ninja H2', sub: 'Supercharged Hypersport', icon: '⚡',
    category: 'Hypersportler', license: 'A',
    ps: 231, kw: 170, torque: 141, weight: 216, vmax: 300, accel: 3.0, price: 33000
  }),
  klx110: makeSharedBike('klx110', {
    name: 'Kawasaki KLX 110', sub: 'Einsteiger Dirt Bike', icon: '🐢',
    category: 'Off-Road', license: 'A2',
    ps: 7, kw: 5.4, torque: 8, weight: 76, vmax: 90, accel: 0, price: 2800
  }),
  hybrid1200: makeSharedBike('hybrid1200', {
    name: 'Kawasaki Ninja 1200 Hybrid', sub: 'Hybrid-Innovation 2026', icon: '🆕',
    category: 'Sport Tourer', license: 'A',
    ps: 220, kw: 162, torque: 220, weight: 227, vmax: 280, accel: 3.2, price: 35000
  }),
  samurai: makeSharedBike('samurai', {
    name: 'Kawasaki Samurai (Replica)', sub: 'Klassiker der 1960er', icon: '⏰',
    category: 'Klassiker', license: 'A2',
    ps: 31, kw: 23, torque: 25, weight: 145, vmax: 160, accel: 0, price: 8000
  }),
  z650: makeSharedBike('z650', {
    name: 'Kawasaki Z650', sub: 'Einsteiger-Naked mit Biss', icon: '🟢',
    category: 'Naked', license: 'A2',
    ps: 68, kw: 50, torque: 64, weight: 168, vmax: 190, accel: 4.2, price: 7700
  }),
  ninja400: makeSharedBike('ninja400', {
    name: 'Kawasaki Ninja 400', sub: 'Anfänger-Sportler', icon: '🏍️',
    category: 'Sportler', license: 'A2',
    ps: 45, kw: 33, torque: 38, weight: 168, vmax: 190, accel: 4.8, price: 6500
  }),
  zx10r: makeSharedBike('zx10r', {
    name: 'Kawasaki Ninja ZX-10R', sub: 'Superbike-Weltmeister', icon: '🏆',
    category: 'Supersportler', license: 'A',
    ps: 203, kw: 149.3, torque: 114.9, weight: 186, vmax: 299, accel: 2.9, price: 20400
  }),
  versys1000: makeSharedBike('versys1000', {
    name: 'Kawasaki Versys 1000', sub: 'Adventure Tourer', icon: '🌍',
    category: 'Adventure', license: 'A',
    ps: 120, kw: 88.2, torque: 102, weight: 235, vmax: 220, accel: 3.9, price: 13500
  }),
  w800: makeSharedBike('w800', {
    name: 'Kawasaki W800', sub: 'Retro-Klassiker', icon: '🕰️',
    category: 'Klassiker', license: 'A2',
    ps: 48, kw: 35, torque: 62.9, weight: 202, vmax: 170, accel: 6.0, price: 10500
  }),
  h2sx: makeSharedBike('h2sx', {
    name: 'Kawasaki Ninja H2 SX', sub: 'Supercharged Sport Tourer', icon: '🚀',
    category: 'Sport Tourer', license: 'A',
    ps: 200, kw: 147.1, torque: 137.3, weight: 240, vmax: 299, accel: 3.1, price: 25500
  }),
  h2se: makeSharedBike('h2se', {
    name: 'Kawasaki Ninja H2 SX SE', sub: 'Luxury Supercharged Tourer', icon: '💎',
    category: 'Sport Tourer', license: 'A',
    ps: 200, kw: 147.1, torque: 137.3, weight: 243, vmax: 299, accel: 3.1, price: 29000
  }),
  ninja650: makeSharedBike('ninja650', {
    name: 'Kawasaki Ninja 650', sub: 'Mid-Range Sportler', icon: '🎯',
    category: 'Sportler', license: 'A2',
    ps: 68, kw: 50, torque: 64, weight: 172, vmax: 200, accel: 4.5, price: 8200
  }),
  klx300: makeSharedBike('klx300', {
    name: 'Kawasaki KLX 300', sub: 'Dual-Sport Enduro', icon: '⛰️',
    category: 'Off-Road', license: 'A2',
    ps: 27, kw: 20, torque: 26.3, weight: 137, vmax: 137, accel: 7.5, price: 6200
  }),
  eliminator400: makeSharedBike('eliminator400', {
    name: 'Kawasaki Eliminator 400', sub: 'Cruiser-Klassiker neu aufgelegt', icon: '😎',
    category: 'Cruiser', license: 'A2',
    ps: 45, kw: 33.4, torque: 42.6, weight: 176, vmax: 165, accel: 5.5, price: 6700
  }),
  zx6r: makeSharedBike('zx6r', {
    name: 'Kawasaki Ninja ZX-6R', sub: '636cc Supersport-Legende', icon: '🔥',
    category: 'Supersportler', license: 'A',
    ps: 130, kw: 95.6, torque: 70.8, weight: 193, vmax: 260, accel: 3.5, price: 12900
  }),
  z900: makeSharedBike('z900', {
    name: 'Kawasaki Z900', sub: 'Aggressive Naked-Macht', icon: '💪',
    category: 'Naked', license: 'A',
    ps: 125, kw: 91.9, torque: 98.6, weight: 193, vmax: 248, accel: 3.4, price: 10200
  }),
  zh2: makeSharedBike('zh2', {
    name: 'Kawasaki Z H2', sub: 'Supercharged Naked Monster', icon: '👹',
    category: 'Naked', license: 'A',
    ps: 200, kw: 147, torque: 137, weight: 239, vmax: 290, accel: 3.2, price: 22900
  }),
  zx25r: makeSharedBike('zx25r', {
    name: 'Kawasaki Ninja ZX-25R', sub: '4-Zylinder 250cc Revolution', icon: '🎆',
    category: 'Sportler', license: 'A2',
    ps: 51, kw: 37.5, torque: 22.9, weight: 182, vmax: 215, accel: 5.0, price: 9800
  }),
  kx450: makeSharedBike('kx450', {
    name: 'Kawasaki KX 450', sub: 'MX-Rennmaschine pur', icon: '🏟️',
    category: 'Off-Road', license: 'A',
    ps: 62, kw: 45.6, torque: 54, weight: 110, vmax: 150, accel: 3.8, price: 9500
  })
};

if (typeof window !== 'undefined') {
  window.SHARED_BIKES = SHARED_BIKES;
} else if (typeof globalThis !== 'undefined') {
  globalThis.SHARED_BIKES = SHARED_BIKES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SHARED_BIKES;
}
