/**
 * idle-core.js — Kawasaki Idle Racer: reine Spiel-/Wirtschafts-Logik.
 *
 * DOM-freies, Node-requireable Modul (Muster identisch zu bikes-data.js):
 * bereitgestellt sowohl im Browser (window/globalThis) als auch in Node
 * (module.exports). Enthält NUR reine Funktionen + Datenkonstanten — kein
 * DOM-Zugriff, kein requestAnimationFrame, kein Rendering. Die Seiten-
 * steuerung (Game-Loop, DOM-Bindings) lebt in idle.js.
 *
 * Verantwortlich für:
 *   - IDLE_BIKES: die 16 spielbaren Kawasaki-Modelle (aufsteigend nach
 *     Topspeed), mit exponentiell wachsendem Kaufpreis (kaufpreisKm).
 *   - IDLE_BALANCE: EIN zentrales Balancing-Konfigurationsobjekt.
 *   - Zustands-Erzeugung/-Migration/-Persistenz (createInitialState,
 *     migrateState, loadState, saveState) unter dem EINEN neuen
 *     localStorage-Key `vroooom_idle_state` (Präfix vroooom_idle_*,
 *     siehe GOLDEN_PRINCIPLES_KE.md Regel 7 — bestehende Keys werden nie
 *     umbenannt/angefasst).
 *   - Wirtschafts-Formeln (bikeCost, tuningCost, passiveEarn, activeEarn,
 *     deriveBikeStats) sowie Zustands-Mutationen fürs Kaufen/Tunen/
 *     Wechseln von Bikes (buyNextBike, upgradeBike, selectBike).
 *
 * Erweiterungspunkte für Phase B (Canvas-Strecke, Tacho, Motorsound,
 * Schaltpunkt-Combo) und Phase C (Prestige, Teile-Sammlung, Offline-
 * Erträge, Statistiken) sind im State-Objekt UND in IDLE_BALANCE als
 * klar markierte, aber bewusst leere/inaktive Platzhalter angelegt — sie
 * werden in dieser Phase NICHT implementiert.
 */
'use strict';

/** localStorage-Key des zentralen, versionierten Idle-Zustands (EIN Key für alles). */
var IDLE_STATE_KEY = 'vroooom_idle_state';

/** Aktuelle Zustands-Versionsnummer (für migrateState). */
var IDLE_STATE_VERSION = 1;

/**
 * IDLE_BALANCE — zentrale Balancing-Konstanten für die gesamte Idle-Economy.
 *
 * Zielvorgabe "erste 3 Bikes in ~10 Minuten erreichbar":
 *   - PASSIVE_KM_PER_SEC=1 ergibt bei reinem Idle-Zusehen 600 km in 10 Min
 *     (600s × 1 km/s), ohne jeglichen Klick.
 *   - Bike-Index 1 (KLX 300) kostet BASE_BIKE_COST=300 km, Bike-Index 2
 *     (Eliminator 500) kostet 300×1.6=480 km → kumulativ 780 km für die
 *     ersten beiden Käufe (macht das Startbike + 2 gekaufte = "erste 3
 *     Bikes" komplett).
 *   - 780 km liegt knapp über den rein-passiven 600 km in 10 Minuten;
 *     bereits gelegentliches Klicken auf "Gas geben" (ACTIVE_KM_PER_CLICK
 *     =10 km/Klick, ca. 20 Klicks über 10 Minuten verteilt = 200 km)
 *     schließt die Lücke komfortabel (600+200=800 ≥ 780). Damit sind die
 *     ersten 3 Bikes für aktive UND rein passive Spieler:innen realistisch
 *     in ~10 Minuten erreichbar, ohne die Kurve danach zu verflachen
 *     (BIKE_COST_GROWTH=1.6 sorgt für spürbares, aber nicht extremes
 *     exponentielles Wachstum bis Bike 16 bei ca. 216.170 km).
 */
var IDLE_BALANCE = {
  /** Index des kostenlosen Startbikes in IDLE_BIKES (immer besessen). */
  STARTER_BIKE_INDEX: 0,

  /** Kaufpreis (in km) des ersten käuflichen Bikes (Index 1). */
  BASE_BIKE_COST: 300,
  /** Wachstumsfaktor je weiterem Bike-Index (exponentiell). */
  BIKE_COST_GROWTH: 1.6,
  /** Rundungsschritt für Bike-Kaufpreise (auf "runde" km-Werte). */
  BIKE_COST_ROUND_TO: 10,

  /** Basis-Passivertrag in km/Sekunde (vor Bike-/Level-Boni), bei laufendem Spiel. */
  PASSIVE_KM_PER_SEC: 1,
  /** km-Ertrag pro Klick auf "Gas geben" (vor Bike-/Level-Boni). */
  ACTIVE_KM_PER_CLICK: 10,

  /** Maximales Tuning-/Level pro Bike (siehe tuningCost). */
  TUNING_LEVEL_CAP: 25,
  /** Basis-Tuningkosten (in km) für Level 0→1 des Startbikes (Index 0). */
  TUNING_BASE_COST: 50,
  /** Wachstumsfaktor der Tuningkosten je Level (exponentiell). */
  TUNING_GROWTH: 1.35,
  /** Rundungsschritt für Tuningkosten. */
  TUNING_COST_ROUND_TO: 5,
  /** Ertrag-Bonus pro Tuning-Level (multiplikativ, z. B. 0.04 = +4%/Level). */
  ERTRAG_BONUS_PER_LEVEL: 0.04,

  /** Referenzwerte zur Normierung der Statistik-Balken (0–100%). */
  STAT_BAR_MAX_TOPSPEED: 400,
  STAT_BAR_MAX_PS: 320,
  /** Zusätzlicher Balken-Boost pro Tuning-Level (Geschwindigkeit/Beschleunigung). */
  STAT_BAR_LEVEL_BOOST_PER_LEVEL: 0.01,

  /** Zeit-Deckelung (Sekunden) für EINEN Game-Loop-Tick in idle.js — verhindert,
   *  dass ein längere Zeit inaktiver/hintergründiger Tab beim Zurückkehren
   *  einen riesigen Delta-Sprung auf einmal gutschreibt. Nur hier zentral
   *  definiert, damit idle.js keine eigene "magische Zahl" pflegt. */
  MAX_TICK_DELTA_SECONDS: 0.25,

  /* ── Erweiterungspunkte (Phase B/C) ─────────────────────────────
   * Bewusst als benannte, aber inaktive Platzhalter angelegt (Wert 0/1
   * = "kein Effekt"), damit Phase B/C sie befüllen kann, ohne die
   * IDLE_BALANCE-Struktur zu brechen oder bestehende Felder zu verschieben. */
  /** @todo Phase C — Prestige-Multiplikator pro Prestige-Level (aktuell ungenutzt). */
  PRESTIGE_BONUS_PER_LEVEL: 0,
  /** @todo Phase C — Ertrag-Multiplikator aus gesammelten Teilen (aktuell ungenutzt). */
  PARTS_BONUS_MULTIPLIER: 1,
  /** @todo Phase C — Anteil des Passivertrags, der offline gutgeschrieben wird (0=kein Offline-Ertrag). */
  OFFLINE_EARN_FRACTION: 0,
};

/**
 * Baut einen einzelnen IDLE_BIKES-Eintrag inkl. berechnetem Kaufpreis.
 * @param {number} index - Position in der aufsteigend sortierten Liste (0-basiert).
 * @param {string} id - Eindeutiger Bike-Schlüssel.
 * @param {string} name - Anzeigename.
 * @param {number} topspeed - Höchstgeschwindigkeit in km/h.
 * @param {number} ps - Leistung in PS.
 * @param {string} kategorie - Fahrzeugkategorie (deutsch).
 * @returns {Object} Vollständiger IDLE_BIKES-Eintrag.
 */
function makeIdleBike(index, id, name, topspeed, ps, kategorie) {
  return {
    id: id,
    name: name,
    topspeed: topspeed,
    ps: ps,
    kategorie: kategorie,
    kaufpreisKm: bikeCost(index),
  };
}

/**
 * IDLE_BIKES — die 16 spielbaren Kawasaki-Modelle, AUFSTEIGEND nach
 * Topspeed sortiert (Index 0 = Startbike, kostenlos besessen). Reale,
 * plausible Eckdaten (Topspeed/PS/Kategorie); der Kaufpreis wächst rein
 * exponentiell über IDLE_BALANCE (siehe bikeCost()), unabhängig von der
 * realen Preisgestaltung der Fahrzeuge.
 */
var IDLE_BIKES = [
  makeIdleBike(0, 'z125pro', 'Kawasaki Z125 PRO', 100, 15, 'Einsteiger-Naked'),
  makeIdleBike(1, 'klx300', 'Kawasaki KLX 300', 130, 27, 'Off-Road'),
  makeIdleBike(2, 'eliminator500', 'Kawasaki Eliminator 500', 165, 45, 'Cruiser'),
  makeIdleBike(3, 'ninja400', 'Kawasaki Ninja 400', 180, 45, 'Sportler'),
  makeIdleBike(4, 'w800', 'Kawasaki W800', 190, 52, 'Klassiker'),
  makeIdleBike(5, 'z650', 'Kawasaki Z650', 200, 68, 'Naked'),
  makeIdleBike(6, 'ninja650', 'Kawasaki Ninja 650', 210, 68, 'Sportler'),
  makeIdleBike(7, 'versys1000', 'Kawasaki Versys 1000', 220, 120, 'Adventure'),
  makeIdleBike(8, 'z900', 'Kawasaki Z900', 245, 125, 'Naked'),
  makeIdleBike(9, 'ninja1000sx', 'Kawasaki Ninja 1000SX', 250, 142, 'Sport Tourer'),
  makeIdleBike(10, 'zx6r', 'Kawasaki Ninja ZX-6R', 260, 130, 'Supersportler'),
  makeIdleBike(11, 'zh2', 'Kawasaki Z H2', 270, 200, 'Naked'),
  makeIdleBike(12, 'zx10r', 'Kawasaki Ninja ZX-10R', 290, 203, 'Supersportler'),
  makeIdleBike(13, 'zx10rr', 'Kawasaki Ninja ZX-10RR', 295, 204, 'Supersportler'),
  makeIdleBike(14, 'ninjah2', 'Kawasaki Ninja H2', 300, 231, 'Hypersportler'),
  makeIdleBike(15, 'ninjah2r', 'Kawasaki Ninja H2R', 400, 310, 'Hypersportler (Track)'),
];

/**
 * Berechnet den Kaufpreis (in km) des Bikes an der gegebenen Position in
 * IDLE_BIKES. Reine Funktion aus IDLE_BALANCE — Index 0 (Startbike) ist
 * immer 0 (kostenlos besessen), ab Index 1 wächst der Preis exponentiell
 * mit IDLE_BALANCE.BIKE_COST_GROWTH, gerundet auf BIKE_COST_ROUND_TO.
 * @param {number} index - Position in IDLE_BIKES (0-basiert).
 * @returns {number} Kaufpreis in km (0 für das Startbike).
 */
function bikeCost(index) {
  if (index <= IDLE_BALANCE.STARTER_BIKE_INDEX) return 0;
  var raw = IDLE_BALANCE.BASE_BIKE_COST * Math.pow(IDLE_BALANCE.BIKE_COST_GROWTH, index - 1);
  var step = IDLE_BALANCE.BIKE_COST_ROUND_TO;
  return Math.round(raw / step) * step;
}

/**
 * Findet den Index eines Bikes in IDLE_BIKES anhand seiner id.
 * @param {string} bikeId - Bike-id.
 * @returns {number} Index in IDLE_BIKES, oder -1 falls nicht gefunden.
 */
function findBikeIndex(bikeId) {
  for (var i = 0; i < IDLE_BIKES.length; i++) {
    if (IDLE_BIKES[i].id === bikeId) return i;
  }
  return -1;
}

/**
 * Liefert den Bike-Datensatz zu einer id.
 * @param {string} bikeId - Bike-id.
 * @returns {Object|null} Bike-Datensatz aus IDLE_BIKES oder null.
 */
function getBikeById(bikeId) {
  var index = findBikeIndex(bikeId);
  return index === -1 ? null : IDLE_BIKES[index];
}

/**
 * Berechnet die Tuning-/Level-Kosten (in km), um ein Bike von currentLevel
 * auf currentLevel+1 zu heben. Wächst exponentiell mit dem Level UND mit
 * der Position des Bikes in IDLE_BIKES (teurere/bessere Bikes kosten pro
 * Level mehr). Respektiert IDLE_BALANCE.TUNING_LEVEL_CAP.
 * @param {string} bikeId - id des zu tunenden Bikes.
 * @param {number} currentLevel - Aktuelles Level des Bikes (0 = ungetunt).
 * @returns {number|null} Kosten in km, oder null falls bikeId unbekannt
 *   ODER currentLevel bereits am/über dem Level-Cap liegt (kein weiteres
 *   Tuning möglich).
 */
function tuningCost(bikeId, currentLevel) {
  var index = findBikeIndex(bikeId);
  if (index === -1) return null;
  if (currentLevel >= IDLE_BALANCE.TUNING_LEVEL_CAP) return null;
  var raw = IDLE_BALANCE.TUNING_BASE_COST * (index + 1) * Math.pow(IDLE_BALANCE.TUNING_GROWTH, currentLevel);
  var step = IDLE_BALANCE.TUNING_COST_ROUND_TO;
  return Math.max(step, Math.round(raw / step) * step);
}

/**
 * Liest das aktuelle Tuning-Level eines Bikes aus dem Zustand (0, falls
 * noch nie getunt).
 * @param {Object} state - Zentraler Idle-Zustand.
 * @param {string} bikeId - Bike-id.
 * @returns {number} Aktuelles Level (>= 0).
 */
function getBikeLevel(state, bikeId) {
  if (!state || !state.bikeLevels) return 0;
  var lvl = state.bikeLevels[bikeId];
  return typeof lvl === 'number' && lvl >= 0 ? lvl : 0;
}

/**
 * Leitet die normierten Anzeige-Statistiken (0–100%) sowie den
 * Ertrags-Multiplikator eines Bikes bei einem bestimmten Tuning-Level ab.
 * Geschwindigkeit/Beschleunigung basieren auf Topspeed/PS (IDLE_BIKES hat
 * keine separate Beschleunigungs-Kennzahl, daher PS als Näherung — mehr
 * PS = spürbar bessere Beschleunigungs-Balken-Füllung) und werden durch
 * das Tuning-Level leicht angehoben; der Ertrag-Bonus-Balken zeigt den
 * Fortschritt zum Level-Cap.
 * @param {Object} bike - Ein Eintrag aus IDLE_BIKES.
 * @param {number} level - Aktuelles Tuning-Level des Bikes.
 * @returns {{geschwindigkeitPct:number, beschleunigungPct:number, ertragBonusPct:number, ertragMultiplier:number}}
 */
function deriveBikeStats(bike, level) {
  var lvl = level > 0 ? level : 0;
  var boost = 1 + lvl * IDLE_BALANCE.STAT_BAR_LEVEL_BOOST_PER_LEVEL;
  var geschwindigkeitPct = clampPct((bike.topspeed / IDLE_BALANCE.STAT_BAR_MAX_TOPSPEED) * 100 * boost);
  var beschleunigungPct = clampPct((bike.ps / IDLE_BALANCE.STAT_BAR_MAX_PS) * 100 * boost);
  var ertragBonusPct = clampPct((lvl / IDLE_BALANCE.TUNING_LEVEL_CAP) * 100);
  var ertragMultiplier = 1 + lvl * IDLE_BALANCE.ERTRAG_BONUS_PER_LEVEL;
  return {
    geschwindigkeitPct: geschwindigkeitPct,
    beschleunigungPct: beschleunigungPct,
    ertragBonusPct: ertragBonusPct,
    ertragMultiplier: ertragMultiplier,
  };
}

/**
 * Begrenzt einen Prozentwert auf den Bereich [0, 100].
 * @param {number} value - Eingabewert.
 * @returns {number} Begrenzter Wert.
 */
function clampPct(value) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Liefert den bikeSpeedFactor für die Ertragsberechnung: das Verhältnis
 * der Topspeed des aktuell gefahrenen Bikes zur Topspeed des Startbikes.
 * Schnellere (später gekaufte) Bikes erwirtschaften dadurch spürbar mehr
 * km pro Sekunde/Klick als das Startbike.
 * @param {Object} bike - Aktuell gefahrenes Bike (IDLE_BIKES-Eintrag).
 * @returns {number} Faktor >= 1.
 */
function bikeSpeedFactor(bike) {
  var starter = IDLE_BIKES[IDLE_BALANCE.STARTER_BIKE_INDEX];
  if (!starter || !starter.topspeed) return 1;
  return bike.topspeed / starter.topspeed;
}

/**
 * Berechnet den passiven km-Ertrag für ein Zeitintervall, basierend auf
 * dem aktuell gefahrenen Bike (Topspeed-Faktor) und dessen Tuning-Level
 * (Ertrag-Bonus). Reine Funktion — mutiert state NICHT.
 * @param {Object} state - Zentraler Idle-Zustand (liest currentBikeId/bikeLevels).
 * @param {number} dtSeconds - Verstrichene Zeit in Sekunden (>= 0).
 * @returns {number} Erwirtschaftete km (>= 0).
 */
function passiveEarn(state, dtSeconds) {
  if (!dtSeconds || dtSeconds <= 0) return 0;
  var bike = getBikeById(state.currentBikeId) || IDLE_BIKES[IDLE_BALANCE.STARTER_BIKE_INDEX];
  var level = getBikeLevel(state, bike.id);
  var stats = deriveBikeStats(bike, level);
  return IDLE_BALANCE.PASSIVE_KM_PER_SEC * dtSeconds * stats.ertragMultiplier * bikeSpeedFactor(bike);
}

/**
 * Berechnet den km-Ertrag für EINEN Klick auf "Gas geben", basierend auf
 * dem aktuell gefahrenen Bike (Topspeed-Faktor) und dessen Tuning-Level
 * (Ertrag-Bonus). Reine Funktion — mutiert state NICHT.
 * @param {Object} state - Zentraler Idle-Zustand (liest currentBikeId/bikeLevels).
 * @returns {number} Erwirtschaftete km (>= 0).
 */
function activeEarn(state) {
  var bike = getBikeById(state.currentBikeId) || IDLE_BIKES[IDLE_BALANCE.STARTER_BIKE_INDEX];
  var level = getBikeLevel(state, bike.id);
  var stats = deriveBikeStats(bike, level);
  return IDLE_BALANCE.ACTIVE_KM_PER_CLICK * stats.ertragMultiplier * bikeSpeedFactor(bike);
}

/**
 * Erzeugt einen frischen, initialen Idle-Zustand (Startbike besessen und
 * ausgewählt, 0 km, Level 0). Enthält bereits alle Erweiterungspunkte für
 * Phase B/C (prestige/parts/offline) als klar markierte, inaktive
 * Platzhalter, damit spätere Phasen den State NICHT umstrukturieren
 * müssen.
 * @returns {Object} Neuer, gültiger Idle-Zustand mit version=IDLE_STATE_VERSION.
 */
function createInitialState() {
  var starter = IDLE_BIKES[IDLE_BALANCE.STARTER_BIKE_INDEX];
  var bikeLevels = {};
  bikeLevels[starter.id] = 0;
  return {
    version: IDLE_STATE_VERSION,
    km: 0,
    totalKmEarned: 0,
    ownedBikeIds: [starter.id],
    currentBikeId: starter.id,
    bikeLevels: bikeLevels,
    lastSavedAt: null,

    /* ── Erweiterungspunkte (Phase B/C) ───────────────────────────
     * Bewusst bereits im initialen Zustand angelegt (statt später per
     * Migration nachgerüstet), damit die Zustandsform von Anfang an
     * stabil ist. In Phase A/B unverändert/ungenutzt. */
    /** @todo Phase C — Prestige-Fortschritt (Reset-Mechanik mit Dauerbonus). */
    prestige: { level: 0, points: 0 },
    /** @todo Phase C — gesammelte Tuning-/Kosmetik-Teile. */
    parts: { collected: [] },
    /** @todo Phase C — Zeitstempel für Offline-Ertragsberechnung beim nächsten Laden. */
    offline: { lastSeenAt: null },
  };
}

/**
 * Migriert/validiert ein aus localStorage geparstes Rohobjekt zu einem
 * garantiert gültigen, aktuellen Idle-Zustand. Fehlt das Objekt komplett,
 * ist es kein Objekt, fehlt/veraltet die version, oder fehlen/haben
 * einzelne Felder einen falschen Typ, werden sie defensiv aus einem
 * frischen createInitialState() aufgefüllt (nie ein Fehler/Absturz).
 * @param {*} raw - Rohwert (z. B. JSON.parse-Ergebnis, evtl. null/korrupt).
 * @returns {Object} Gültiger Idle-Zustand mit version=IDLE_STATE_VERSION.
 */
function migrateState(raw) {
  var fresh = createInitialState();
  if (!raw || typeof raw !== 'object') return fresh;

  var state = {
    version: IDLE_STATE_VERSION,
    km: typeof raw.km === 'number' && raw.km >= 0 ? raw.km : fresh.km,
    totalKmEarned: typeof raw.totalKmEarned === 'number' && raw.totalKmEarned >= 0 ? raw.totalKmEarned : fresh.totalKmEarned,
    ownedBikeIds: Array.isArray(raw.ownedBikeIds) && raw.ownedBikeIds.length > 0 ? raw.ownedBikeIds.filter(function (id) { return findBikeIndex(id) !== -1; }) : fresh.ownedBikeIds.slice(),
    currentBikeId: typeof raw.currentBikeId === 'string' && findBikeIndex(raw.currentBikeId) !== -1 ? raw.currentBikeId : fresh.currentBikeId,
    bikeLevels: raw.bikeLevels && typeof raw.bikeLevels === 'object' ? raw.bikeLevels : fresh.bikeLevels,
    lastSavedAt: typeof raw.lastSavedAt === 'number' ? raw.lastSavedAt : fresh.lastSavedAt,
    prestige: raw.prestige && typeof raw.prestige === 'object' ? raw.prestige : fresh.prestige,
    parts: raw.parts && typeof raw.parts === 'object' ? raw.parts : fresh.parts,
    offline: raw.offline && typeof raw.offline === 'object' ? raw.offline : fresh.offline,
  };

  if (state.ownedBikeIds.length === 0) state.ownedBikeIds = fresh.ownedBikeIds.slice();
  if (state.ownedBikeIds.indexOf(state.currentBikeId) === -1) state.currentBikeId = state.ownedBikeIds[0];

  return state;
}

/**
 * Liest den zentralen Idle-Zustand aus localStorage und migriert/validiert
 * ihn. Bei leerem/fehlendem/korruptem Speicher wird ein frischer, gültiger
 * Zustand zurückgegeben (nie ein Fehler nach außen).
 * @returns {Object} Gültiger Idle-Zustand.
 */
function loadState() {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) return createInitialState();
    var raw = localStorage.getItem(IDLE_STATE_KEY);
    if (raw === null || raw === undefined) return createInitialState();
    return migrateState(JSON.parse(raw));
  } catch (e) {
    return createInitialState();
  }
}

/**
 * Persistiert den zentralen Idle-Zustand in localStorage (setzt
 * lastSavedAt auf jetzt). Rein additiv/defensiv — darf die Seite nie
 * blockieren, falls localStorage nicht verfügbar/voll ist.
 * @param {Object} state - Zu speichernder Idle-Zustand.
 * @returns {void}
 */
function saveState(state) {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) return;
    state.lastSavedAt = Date.now();
    localStorage.setItem(IDLE_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    /* bewusst ignoriert — darf App nie blockieren */
  }
}

/**
 * Prüft, ob das nächste (noch nicht besessene) Bike in der IDLE_BIKES-
 * Reihenfolge aktuell käuflich ist (genug km vorhanden). Bikes müssen in
 * aufsteigender Reihenfolge gekauft werden.
 * @param {Object} state - Zentraler Idle-Zustand.
 * @returns {{bike: Object|null, cost: number, affordable: boolean}} Info
 *   zum nächsten Bike, oder bike:null falls bereits alle besessen.
 */
function getNextBikeToBuy(state) {
  var nextIndex = state.ownedBikeIds.length;
  if (nextIndex >= IDLE_BIKES.length) return { bike: null, cost: 0, affordable: false };
  var bike = IDLE_BIKES[nextIndex];
  var cost = bikeCost(nextIndex);
  return { bike: bike, cost: cost, affordable: state.km >= cost };
}

/**
 * Kauft das nächste Bike in der IDLE_BIKES-Reihenfolge, falls genug km
 * vorhanden sind. Mutiert state bei Erfolg (zieht km ab, fügt zu
 * ownedBikeIds hinzu, initialisiert bikeLevels-Eintrag mit 0).
 * @param {Object} state - Zentraler Idle-Zustand (wird bei Erfolg mutiert).
 * @returns {{success: boolean, bike: (Object|null), cost: number}} Ergebnis.
 */
function buyNextBike(state) {
  var next = getNextBikeToBuy(state);
  if (!next.bike || !next.affordable) return { success: false, bike: next.bike, cost: next.cost };
  state.km -= next.cost;
  state.ownedBikeIds.push(next.bike.id);
  if (typeof state.bikeLevels[next.bike.id] !== 'number') state.bikeLevels[next.bike.id] = 0;
  return { success: true, bike: next.bike, cost: next.cost };
}

/**
 * Erhöht das Tuning-Level eines besessenen Bikes um 1, falls genug km
 * vorhanden sind UND das Level-Cap noch nicht erreicht ist. Mutiert state
 * bei Erfolg.
 * @param {Object} state - Zentraler Idle-Zustand (wird bei Erfolg mutiert).
 * @param {string} bikeId - id des zu tunenden, besessenen Bikes.
 * @returns {{success: boolean, cost: (number|null), newLevel: number}} Ergebnis.
 */
function upgradeBike(state, bikeId) {
  if (state.ownedBikeIds.indexOf(bikeId) === -1) return { success: false, cost: null, newLevel: getBikeLevel(state, bikeId) };
  var currentLevel = getBikeLevel(state, bikeId);
  var cost = tuningCost(bikeId, currentLevel);
  if (cost === null || state.km < cost) return { success: false, cost: cost, newLevel: currentLevel };
  state.km -= cost;
  state.bikeLevels[bikeId] = currentLevel + 1;
  return { success: true, cost: cost, newLevel: currentLevel + 1 };
}

/**
 * Wechselt das aktuell gefahrene Bike, sofern es bereits besessen ist.
 * @param {Object} state - Zentraler Idle-Zustand (wird bei Erfolg mutiert).
 * @param {string} bikeId - id des Ziel-Bikes.
 * @returns {boolean} true bei Erfolg, false falls Bike nicht besessen.
 */
function selectBike(state, bikeId) {
  if (state.ownedBikeIds.indexOf(bikeId) === -1) return false;
  state.currentBikeId = bikeId;
  return true;
}

/**
 * Gutschreibt einen km-Betrag auf den Zustand (km + totalKmEarned).
 * Zentrale Stelle, damit Passiv-/Aktiv-Ertrag konsistent gebucht werden.
 * @param {Object} state - Zentraler Idle-Zustand (wird mutiert).
 * @param {number} amount - Zu verbuchende km (>= 0).
 * @returns {void}
 */
function creditKm(state, amount) {
  if (!amount || amount <= 0) return;
  state.km += amount;
  state.totalKmEarned += amount;
}

var IdleCore = {
  IDLE_STATE_KEY: IDLE_STATE_KEY,
  IDLE_STATE_VERSION: IDLE_STATE_VERSION,
  IDLE_BIKES: IDLE_BIKES,
  IDLE_BALANCE: IDLE_BALANCE,
  bikeCost: bikeCost,
  tuningCost: tuningCost,
  getBikeById: getBikeById,
  findBikeIndex: findBikeIndex,
  getBikeLevel: getBikeLevel,
  deriveBikeStats: deriveBikeStats,
  bikeSpeedFactor: bikeSpeedFactor,
  passiveEarn: passiveEarn,
  activeEarn: activeEarn,
  createInitialState: createInitialState,
  migrateState: migrateState,
  loadState: loadState,
  saveState: saveState,
  getNextBikeToBuy: getNextBikeToBuy,
  buyNextBike: buyNextBike,
  upgradeBike: upgradeBike,
  selectBike: selectBike,
  creditKm: creditKm,
};

if (typeof window !== 'undefined') {
  window.IdleCore = IdleCore;
} else if (typeof globalThis !== 'undefined') {
  globalThis.IdleCore = IdleCore;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = IdleCore;
}
