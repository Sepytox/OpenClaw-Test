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
 * Phase B ergänzte Canvas-Strecke/Tacho/Motorsound sowie die
 * Schaltpunkt-Combo (MECHANIK A). Phase C ergänzt MECHANIK B — Saison/
 * Prestige: ab der ZX-10R kann eine Saison abgeschlossen werden
 * (trophiesForSeason/canFinishSeason/finishSeason); die dabei verdienten
 * TROPHÄEN sind PERMANENT und kaufen dauerhafte WERKSVERTRÄGE
 * (IDLE_CONTRACTS/contractEffects), die Reset-Saisons überleben. Teile-
 * Sammlung/Offline-Ertrag/Statistiken folgen in weiteren Phase-C-Commits.
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

  /* ── Phase C: MECHANIK B — Saison/Prestige/Werksverträge ─────────
   * Ab der ZX-10R (siehe canFinishSeason) kann eine Saison abgeschlossen
   * werden (finishSeason): km + besessene Bikes werden zurückgesetzt,
   * TROPHÄEN (siehe trophiesForSeason) bleiben PERMANENT und kaufen
   * Werksverträge (IDLE_CONTRACTS), die selbst einen Reset überleben. */
  /** Permanenter Ertrags-Bonus pro abgeschlossener Saison (prestige.level), stackt multiplikativ mit Werksverträgen. */
  PRESTIGE_BONUS_PER_LEVEL: 0.05,
  /** Je 5 kumulierte Tuning-Level (über alle Bikes) gibt es +1 Bonus-Trophäe beim Saisonabschluss. */
  TROPHY_LEVEL_BONUS_DIVISOR: 5,
  /** @todo Phase C (feat(idle-parts)) — Ertrag-Multiplikator aus gesammelten Teilen (aktuell ungenutzt). */
  PARTS_BONUS_MULTIPLIER: 1,
  /** @todo Phase C (feat(idle-offline)) — Anteil des Passivertrags, der offline gutgeschrieben wird (0=kein Offline-Ertrag). */
  OFFLINE_EARN_FRACTION: 0,

  /* ── Phase B: Schaltpunkt-Combo (MECHANIK A) ────────────────────
   * Alle ca. 15–30s erscheint eine Schaltpunkt-Leiste mit wandernder
   * Markierung und einer grünen "perfekten Zone" in der Mitte. Ein
   * Treffer (Klick innerhalb der Zone) erhöht die Combo und gewährt für
   * COMBO_MULTIPLIER_DURATION_MS einen steigenden Ertrags-Multiplikator
   * (x2 bis maximal x5); ein Fehlklick (ausserhalb der Zone) setzt die
   * Combo zurück auf 0; Ignorieren (Leiste läuft ab) hat KEINE Strafe. */
  /** Basis-Breite der perfekten Zone in % der Leistenbreite (Combo 0). */
  COMBO_ZONE_BASE_WIDTH_PCT: 34,
  /** Untere Grenze, unter die die Zone niemals schrumpft (% Leistenbreite). */
  COMBO_ZONE_MIN_WIDTH_PCT: 8,
  /** Schrumpfung der Zonenbreite je Combo-Punkt (Prozentpunkte). */
  COMBO_ZONE_SHRINK_PER_COMBO_PCT: 2,
  /** Ertrags-Multiplikator, der bei Combo 1 gewährt wird. */
  COMBO_MULTIPLIER_BASE: 2,
  /** Höchster erreichbarer Ertrags-Multiplikator (Deckel). */
  COMBO_MULTIPLIER_MAX: 5,
  /** Zusätzlicher Multiplikator je weiterem Combo-Punkt über 1 hinaus. */
  COMBO_MULTIPLIER_STEP: 0.5,
  /** Dauer (ms), die ein frisch gewährter Multiplikator aktiv bleibt. */
  COMBO_MULTIPLIER_DURATION_MS: 10000,
  /** Zufälliges Intervall (Sekunden) zwischen zwei Schaltpunkt-Leisten — untere Grenze. */
  SHIFT_INTERVAL_MIN_SECONDS: 15,
  /** Zufälliges Intervall (Sekunden) zwischen zwei Schaltpunkt-Leisten — obere Grenze. */
  SHIFT_INTERVAL_MAX_SECONDS: 30,
  /** Dauer (Sekunden) des Marker-Durchlaufs einer einzelnen Schaltpunkt-Leiste. */
  SHIFT_SWEEP_DURATION_SECONDS: 2.2,
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
 * IDLE_CONTRACTS — MECHANIK B: die käuflichen Werksverträge. Jeder Vertrag
 * kostet eine feste Anzahl TROPHÄEN (permanente Saison-Währung, siehe
 * trophiesForSeason/finishSeason) und gewährt einen dauerhaften, Saison-
 * Reset überlebenden Effekt. `effect` benennt den Schlüssel in dem von
 * contractEffects() aggregierten Ergebnisobjekt, `value` den anzuwendenden
 * Rohwert (Multiplikator, Prozentpunkte oder Bike-id, je nach `effect`).
 */
var IDLE_CONTRACTS = [
  { id: 'ertrag25', name: '+25% passiver Ertrag', beschreibung: 'Erhöht sämtlichen Ertrag (aktiv & passiv) dauerhaft um 25%.', kostenTrophaeen: 3, effect: 'earnMultiplier', value: 1.25 },
  { id: 'startNinja400', name: 'Start mit Ninja 400', beschreibung: 'Jede neue Saison beginnt direkt mit der Ninja 400 statt der Z125 PRO.', kostenTrophaeen: 5, effect: 'startBikeId', value: 'ninja400' },
  { id: 'zoneBreiter10', name: 'Perfekt-Zone 10% breiter', beschreibung: 'Die Schaltpunkt-Zone ist dauerhaft 10 Prozentpunkte breiter.', kostenTrophaeen: 4, effect: 'zoneWidthBonusPct', value: 10 },
  { id: 'offlineVerdoppelt', name: 'Offline-Ertrag verdoppelt', beschreibung: 'Verdoppelt die Offline-Ertragsdeckelung von 4 auf 8 Stunden.', kostenTrophaeen: 6, effect: 'offlineCapMultiplier', value: 2 },
  { id: 'tuningGuenstiger15', name: 'Tuning 15% günstiger', beschreibung: 'Alle Tuning-Kosten sinken dauerhaft um 15%.', kostenTrophaeen: 4, effect: 'tuningCostMultiplier', value: 0.85 },
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
 * ausgewählt, 0 km, Level 0). Enthält bereits alle Erweiterungsfelder aus
 * Phase B (combo/sound) sowie Phase C MECHANIK B (prestige inkl.
 * Trophäen/Verträge), damit die Zustandsform von Anfang an stabil ist.
 * parts/offline sind weiterhin die inaktiven Phase-A/B-Platzhalter (siehe
 * feat(idle-parts)/feat(idle-offline)).
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

    /* ── Phase C: MECHANIK B — Saison/Prestige/Werksverträge ──────
     * level = Anzahl abgeschlossener Saisons (0 = erste, laufende
     * Saison). points = Lebenszeit-Summe aller je verdienten Trophäen
     * (Statistik, sinkt nie). trophies = aktuell verfügbare/ausgebbare
     * Trophäen (siehe buyContract). contracts = ids der dauerhaft
     * gekauften Werksverträge (überleben jeden Saison-Reset). */
    prestige: { level: 0, points: 0, trophies: 0, contracts: [] },
    /** @todo Phase C (feat(idle-parts)) — gesammelte Teile-ids. */
    parts: { collected: [] },
    /** @todo Phase C (feat(idle-offline)) — Zeitstempel für Offline-Ertragsberechnung beim nächsten Laden. */
    offline: { lastSeenAt: null },

    /* ── Phase B ────────────────────────────────────────────────── */
    /** Schaltpunkt-Combo-Fortschritt (siehe applyShiftResult/comboMultiplier). */
    combo: { count: 0, multiplier: 1, multiplierExpiresAt: null },
    /** Motorsound-Einstellungen (Web Audio, standardmässig AUS). */
    sound: { enabled: false, volume: 0.5 },
  };
}

/**
 * Migriert das prestige-Feld (level/points/trophies/contracts) defensiv.
 * @param {*} raw - Rohes Zustandsobjekt (evtl. null/korrupt).
 * @param {Object} fresh - Frischer Referenzzustand für Standardwerte.
 * @returns {Object} Gültiges prestige-Objekt.
 */
function migratePrestige(raw, fresh) {
  var rp = raw && raw.prestige && typeof raw.prestige === 'object' ? raw.prestige : {};
  return {
    level: typeof rp.level === 'number' && rp.level >= 0 ? rp.level : fresh.prestige.level,
    points: typeof rp.points === 'number' && rp.points >= 0 ? rp.points : fresh.prestige.points,
    trophies: typeof rp.trophies === 'number' && rp.trophies >= 0 ? rp.trophies : fresh.prestige.trophies,
    contracts: Array.isArray(rp.contracts) ? rp.contracts.filter(function (id) { return !!getContractById(id); }) : fresh.prestige.contracts.slice(),
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
    prestige: migratePrestige(raw, fresh),
    parts: raw.parts && typeof raw.parts === 'object' ? raw.parts : fresh.parts,
    offline: raw.offline && typeof raw.offline === 'object' ? raw.offline : fresh.offline,
    combo: raw.combo && typeof raw.combo === 'object' ? {
      count: typeof raw.combo.count === 'number' && raw.combo.count >= 0 ? raw.combo.count : 0,
      multiplier: typeof raw.combo.multiplier === 'number' && raw.combo.multiplier >= 1 ? raw.combo.multiplier : 1,
      multiplierExpiresAt: typeof raw.combo.multiplierExpiresAt === 'number' ? raw.combo.multiplierExpiresAt : null,
    } : fresh.combo,
    sound: raw.sound && typeof raw.sound === 'object' ? {
      enabled: typeof raw.sound.enabled === 'boolean' ? raw.sound.enabled : false,
      volume: typeof raw.sound.volume === 'number' && raw.sound.volume >= 0 && raw.sound.volume <= 1 ? raw.sound.volume : 0.5,
    } : fresh.sound,
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
 * vorhanden sind UND das Level-Cap noch nicht erreicht ist. Nutzt
 * effectiveTuningCost() statt der rohen tuningCost(), damit der
 * "Tuning 15% günstiger"-Werksvertrag (siehe contractEffects) automatisch
 * greift. Mutiert state bei Erfolg.
 * @param {Object} state - Zentraler Idle-Zustand (wird bei Erfolg mutiert).
 * @param {string} bikeId - id des zu tunenden, besessenen Bikes.
 * @returns {{success: boolean, cost: (number|null), newLevel: number}} Ergebnis.
 */
function upgradeBike(state, bikeId) {
  if (state.ownedBikeIds.indexOf(bikeId) === -1) return { success: false, cost: null, newLevel: getBikeLevel(state, bikeId) };
  var currentLevel = getBikeLevel(state, bikeId);
  var cost = effectiveTuningCost(state, bikeId, currentLevel);
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

/**
 * MECHANIK A — Schaltpunkt-Combo: berechnet den Ertrags-Multiplikator für
 * eine gegebene Combo-Anzahl. Combo 0 (oder kleiner) bedeutet "kein
 * Multiplikator" (1x). Ab Combo 1 startet der Multiplikator bei
 * COMBO_MULTIPLIER_BASE und wächst je weiterem Combo-Punkt um
 * COMBO_MULTIPLIER_STEP, gedeckelt auf COMBO_MULTIPLIER_MAX. Reine,
 * deterministische Funktion.
 * @param {number} combo - Aktuelle Combo-Anzahl (>= 0).
 * @returns {number} Ertrags-Multiplikator (1 bis COMBO_MULTIPLIER_MAX).
 */
function comboMultiplier(combo) {
  if (!combo || combo <= 0) return 1;
  var raw = IDLE_BALANCE.COMBO_MULTIPLIER_BASE + (combo - 1) * IDLE_BALANCE.COMBO_MULTIPLIER_STEP;
  return Math.min(IDLE_BALANCE.COMBO_MULTIPLIER_MAX, raw);
}

/**
 * MECHANIK A — Schaltpunkt-Combo: berechnet die Breite der "perfekten
 * Zone" (in % der Leistenbreite) für eine gegebene Combo-Anzahl. Die Zone
 * schrumpft monoton mit steigender Combo (schwerer zu treffen bei hoher
 * Combo), fällt aber nie unter COMBO_ZONE_MIN_WIDTH_PCT. Reine,
 * deterministische Funktion.
 * @param {number} combo - Aktuelle Combo-Anzahl (>= 0).
 * @param {number} [baseWidth] - Basis-Breite in % (Combo 0); Standard
 *   IDLE_BALANCE.COMBO_ZONE_BASE_WIDTH_PCT, falls ausgelassen/ungültig.
 * @returns {number} Zonenbreite in % (>= COMBO_ZONE_MIN_WIDTH_PCT).
 */
function perfectZoneWidth(combo, baseWidth) {
  var base = typeof baseWidth === 'number' && baseWidth > 0 ? baseWidth : IDLE_BALANCE.COMBO_ZONE_BASE_WIDTH_PCT;
  var c = combo > 0 ? combo : 0;
  var shrunk = base - c * IDLE_BALANCE.COMBO_ZONE_SHRINK_PER_COMBO_PCT;
  return Math.max(IDLE_BALANCE.COMBO_ZONE_MIN_WIDTH_PCT, shrunk);
}

/**
 * Stellt sicher, dass state.combo ein gültiges Objekt ist (defensiv, für
 * Zustände, die nicht über createInitialState()/migrateState() gelaufen
 * sind, z. B. handgebaute Test-Zustände).
 * @param {Object} state - Zentraler Idle-Zustand (wird ggf. mutiert).
 * @returns {void}
 */
function ensureComboState(state) {
  if (!state.combo || typeof state.combo !== 'object') {
    state.combo = { count: 0, multiplier: 1, multiplierExpiresAt: null };
  }
}

/**
 * MECHANIK A — Schaltpunkt-Combo: verarbeitet das Ergebnis EINES Klicks
 * auf die Schaltpunkt-Leiste. Treffer (hit=true) erhöht die Combo um 1
 * und gewährt für IDLE_BALANCE.COMBO_MULTIPLIER_DURATION_MS den per
 * comboMultiplier() berechneten Ertrags-Multiplikator. Fehlklick
 * (hit=false) setzt Combo UND aktiven Multiplikator zurück. Mutiert
 * state.combo. Ignorieren (Leiste läuft unbeklickt ab) ruft diese
 * Funktion NICHT auf — daher keine Strafe fürs Ignorieren.
 * @param {Object} state - Zentraler Idle-Zustand (wird mutiert).
 * @param {boolean} hit - true = Klick innerhalb der perfekten Zone.
 * @param {number} [nowMs] - Zeitstempel "jetzt" in ms; Standard Date.now()
 *   (als Parameter überreichbar, damit die Funktion deterministisch/
 *   testbar bleibt).
 * @returns {{count:number, multiplier:number, multiplierExpiresAt:(number|null)}} Neuer Combo-Zustand.
 */
function applyShiftResult(state, hit, nowMs) {
  var now = typeof nowMs === 'number' ? nowMs : Date.now();
  ensureComboState(state);
  if (hit) {
    state.combo.count += 1;
    state.combo.multiplier = comboMultiplier(state.combo.count);
    state.combo.multiplierExpiresAt = now + IDLE_BALANCE.COMBO_MULTIPLIER_DURATION_MS;
  } else {
    state.combo.count = 0;
    state.combo.multiplier = 1;
    state.combo.multiplierExpiresAt = null;
  }
  return { count: state.combo.count, multiplier: state.combo.multiplier, multiplierExpiresAt: state.combo.multiplierExpiresAt };
}

/**
 * Liefert den aktuell aktiven Combo-Ertrags-Multiplikator (1, falls kein
 * Treffer-Multiplikator gerade aktiv/abgelaufen ist). Reine Funktion —
 * mutiert state NICHT. Für die Anwendung des Multiplikators auf
 * passiveEarn()/activeEarn()-Erträge in idle.js gedacht.
 * @param {Object} state - Zentraler Idle-Zustand.
 * @param {number} [nowMs] - Zeitstempel "jetzt" in ms; Standard Date.now().
 * @returns {number} Aktiver Multiplikator (>= 1).
 */
function activeComboMultiplier(state, nowMs) {
  var now = typeof nowMs === 'number' ? nowMs : Date.now();
  if (!state || !state.combo || typeof state.combo.multiplierExpiresAt !== 'number') return 1;
  if (now >= state.combo.multiplierExpiresAt) return 1;
  return state.combo.multiplier || 1;
}

/**
 * Würfelt das nächste Zufallsintervall (Sekunden) bis zur nächsten
 * Schaltpunkt-Leiste, zwischen SHIFT_INTERVAL_MIN_SECONDS und
 * SHIFT_INTERVAL_MAX_SECONDS. Zufälligkeit wird als Parameter
 * übergeben (Standard Math.random), damit die Funktion testbar bleibt.
 * @param {Function} [randomFn] - Zufallsfunktion, liefert [0,1); Standard Math.random.
 * @returns {number} Sekunden bis zur nächsten Schaltpunkt-Leiste.
 */
function nextShiftIntervalSeconds(randomFn) {
  var rnd = typeof randomFn === 'function' ? randomFn : Math.random;
  var min = IDLE_BALANCE.SHIFT_INTERVAL_MIN_SECONDS;
  var max = IDLE_BALANCE.SHIFT_INTERVAL_MAX_SECONDS;
  return min + rnd() * (max - min);
}

/* ============================================================
   MECHANIK B — SAISON/PRESTIGE/WERKSVERTRÄGE — feat(idle-prestige)
   ============================================================ */

/**
 * Findet einen Werksvertrag anhand seiner id.
 * @param {string} contractId - id des Werksvertrags.
 * @returns {Object|null} Eintrag aus IDLE_CONTRACTS, oder null.
 */
function getContractById(contractId) {
  for (var i = 0; i < IDLE_CONTRACTS.length; i++) {
    if (IDLE_CONTRACTS[i].id === contractId) return IDLE_CONTRACTS[i];
  }
  return null;
}

/**
 * Aggregiert ALLE aktiven Werksvertrag-Effekte (siehe IDLE_CONTRACTS)
 * UND den permanenten Pro-Saison-Bonus (IDLE_BALANCE.PRESTIGE_BONUS_PER_
 * LEVEL) zu einem einzigen Ergebnisobjekt. Reine, deterministische
 * Funktion — mutiert state NICHT. Zentrale Stelle, die von earn-/tuning-/
 * offline-/combo-zone-Berechnungen konsumiert wird (siehe passiveEarn/
 * activeEarn-Aufrufstellen in idle.js, effectiveTuningCost, offlineEarn,
 * perfectZoneWidthForState).
 * @param {Object} state - Zentraler Idle-Zustand.
 * @returns {{earnMultiplier:number, startBikeId:(string|null), zoneWidthBonusPct:number, offlineCapMultiplier:number, tuningCostMultiplier:number}} Aggregierte Effekte.
 */
function contractEffects(state) {
  var effects = {
    earnMultiplier: 1,
    startBikeId: null,
    zoneWidthBonusPct: 0,
    offlineCapMultiplier: 1,
    tuningCostMultiplier: 1,
  };
  if (!state) return effects;

  var level = state.prestige && typeof state.prestige.level === 'number' ? state.prestige.level : 0;
  effects.earnMultiplier *= 1 + level * IDLE_BALANCE.PRESTIGE_BONUS_PER_LEVEL;

  var contracts = state.prestige && Array.isArray(state.prestige.contracts) ? state.prestige.contracts : [];
  contracts.forEach(function (contractId) {
    var contract = getContractById(contractId);
    if (!contract) return;
    switch (contract.effect) {
      case 'earnMultiplier': effects.earnMultiplier *= contract.value; break;
      case 'startBikeId': effects.startBikeId = contract.value; break;
      case 'zoneWidthBonusPct': effects.zoneWidthBonusPct += contract.value; break;
      case 'offlineCapMultiplier': effects.offlineCapMultiplier *= contract.value; break;
      case 'tuningCostMultiplier': effects.tuningCostMultiplier *= contract.value; break;
      default: break;
    }
  });
  return effects;
}

/**
 * Prüft, ob ein Werksvertrag aktuell kaufbar ist (existiert, noch nicht
 * besessen, genug Trophäen vorhanden).
 * @param {Object} state - Zentraler Idle-Zustand.
 * @param {string} contractId - id des Werksvertrags.
 * @returns {boolean} true, falls kaufbar.
 */
function canBuyContract(state, contractId) {
  var contract = getContractById(contractId);
  if (!contract || !state || !state.prestige) return false;
  if (Array.isArray(state.prestige.contracts) && state.prestige.contracts.indexOf(contractId) !== -1) return false;
  return (state.prestige.trophies || 0) >= contract.kostenTrophaeen;
}

/**
 * Kauft einen Werksvertrag, falls canBuyContract() zustimmt. Zieht die
 * Trophäenkosten ab und fügt die id dauerhaft zu state.prestige.contracts
 * hinzu (überlebt jeden Saison-Reset). Mutiert state bei Erfolg.
 * @param {Object} state - Zentraler Idle-Zustand (wird bei Erfolg mutiert).
 * @param {string} contractId - id des zu kaufenden Werksvertrags.
 * @returns {{success: boolean, cost: (number|null)}} Ergebnis.
 */
function buyContract(state, contractId) {
  var contract = getContractById(contractId);
  if (!canBuyContract(state, contractId)) return { success: false, cost: contract ? contract.kostenTrophaeen : null };
  state.prestige.trophies -= contract.kostenTrophaeen;
  state.prestige.contracts.push(contractId);
  return { success: true, cost: contract.kostenTrophaeen };
}

/**
 * Berechnet die Anzahl Trophäen, die ein Saisonabschluss JETZT gewähren
 * würde: 1 Trophäe pro über das Startbike hinaus gekauftem Bike, plus 1
 * Bonus-Trophäe je IDLE_BALANCE.TROPHY_LEVEL_BONUS_DIVISOR kumulierten
 * Tuning-Leveln (über alle Bikes). Reine, deterministische Funktion.
 * @param {Object} state - Zentraler Idle-Zustand.
 * @returns {number} Anzahl Trophäen (>= 0).
 */
function trophiesForSeason(state) {
  if (!state || !Array.isArray(state.ownedBikeIds)) return 0;
  var bikesBeyondStarter = Math.max(0, state.ownedBikeIds.length - 1);
  var totalLevels = 0;
  if (state.bikeLevels && typeof state.bikeLevels === 'object') {
    Object.keys(state.bikeLevels).forEach(function (id) {
      var lvl = state.bikeLevels[id];
      if (typeof lvl === 'number' && lvl > 0) totalLevels += lvl;
    });
  }
  var levelBonus = Math.floor(totalLevels / IDLE_BALANCE.TROPHY_LEVEL_BONUS_DIVISOR);
  return bikesBeyondStarter + levelBonus;
}

/**
 * Prüft, ob eine Saison aktuell abgeschlossen werden kann: frühestens ab
 * Besitz der Ninja ZX-10R (Bikes werden strikt in IDLE_BIKES-Reihenfolge
 * gekauft, ein Besitz der ZX-10R impliziert also den Besitz aller
 * günstigeren Bikes davor).
 * @param {Object} state - Zentraler Idle-Zustand.
 * @returns {boolean} true, falls finishSeason() jetzt einen echten Reset ausführen würde.
 */
function canFinishSeason(state) {
  if (!state || !Array.isArray(state.ownedBikeIds)) return false;
  var zxIndex = findBikeIndex('zx10r');
  if (zxIndex === -1) return false;
  return state.ownedBikeIds.length >= zxIndex + 1;
}

/**
 * MECHANIK B — Saison-Abschluss: setzt km, ownedBikeIds, bikeLevels UND
 * die Schaltpunkt-Combo auf einen frischen Saison-Start zurück, während
 * Trophäen, Werksverträge, Teile-Sammlung, die Lebenszeit-km-Statistik
 * (totalKmEarned), Sound-Einstellungen und der Offline-Zeitstempel
 * PERMANENT erhalten bleiben. Verdient dabei trophiesForSeason(state)
 * neue Trophäen. Reine Funktion — mutiert das übergebene state NICHT,
 * sondern gibt einen komplett neuen Zustand zurück (Aufrufer in idle.js
 * muss die lokale state-Referenz ersetzen + saveState() aufrufen). Ist
 * canFinishSeason(state) false, wird state UNVERÄNDERT zurückgegeben
 * (kein Reset, kein Effekt).
 * @param {Object} state - Zentraler Idle-Zustand vor dem Saisonabschluss.
 * @returns {Object} Neuer, nach dem Saisonabschluss gültiger Idle-Zustand
 *   (oder das unveränderte state, falls (noch) nicht abschliessbar).
 */
function finishSeason(state) {
  if (!canFinishSeason(state)) return state;

  var earnedTrophies = trophiesForSeason(state);
  var fresh = createInitialState();
  var prevPrestige = state.prestige || fresh.prestige;
  var prevParts = state.parts || fresh.parts;

  fresh.totalKmEarned = typeof state.totalKmEarned === 'number' ? state.totalKmEarned : fresh.totalKmEarned;

  fresh.prestige = {
    level: (typeof prevPrestige.level === 'number' ? prevPrestige.level : 0) + 1,
    points: (typeof prevPrestige.points === 'number' ? prevPrestige.points : 0) + earnedTrophies,
    trophies: (typeof prevPrestige.trophies === 'number' ? prevPrestige.trophies : 0) + earnedTrophies,
    contracts: Array.isArray(prevPrestige.contracts) ? prevPrestige.contracts.slice() : [],
  };
  fresh.parts = { collected: Array.isArray(prevParts.collected) ? prevParts.collected.slice() : [] };
  fresh.offline = state.offline && typeof state.offline === 'object' ? { lastSeenAt: state.offline.lastSeenAt } : fresh.offline;
  fresh.sound = state.sound && typeof state.sound === 'object' ? { enabled: state.sound.enabled, volume: state.sound.volume } : fresh.sound;

  // "Start mit Ninja 400"-Werksvertrag: die neue Saison beginnt weiter
  // oben in der Bike-Reihe statt beim Z125 PRO.
  var effects = contractEffects(fresh);
  if (effects.startBikeId) {
    var idx = findBikeIndex(effects.startBikeId);
    if (idx > 0) {
      var ownedIds = [];
      var levels = {};
      for (var i = 0; i <= idx; i++) {
        ownedIds.push(IDLE_BIKES[i].id);
        levels[IDLE_BIKES[i].id] = 0;
      }
      fresh.ownedBikeIds = ownedIds;
      fresh.bikeLevels = levels;
      fresh.currentBikeId = effects.startBikeId;
    }
  }

  return fresh;
}

/**
 * Berechnet die tatsächlich zu zahlenden Tuning-Kosten UNTER Berücksichtigung
 * des "Tuning 15% günstiger"-Werksvertrags (siehe contractEffects). Reine
 * Funktion — mutiert state NICHT.
 * @param {Object} state - Zentraler Idle-Zustand (nur lesend, für contractEffects).
 * @param {string} bikeId - id des zu tunenden Bikes.
 * @param {number} currentLevel - Aktuelles Level des Bikes.
 * @returns {number|null} Effektive Kosten in km, oder null (siehe tuningCost()).
 */
function effectiveTuningCost(state, bikeId, currentLevel) {
  var base = tuningCost(bikeId, currentLevel);
  if (base === null) return null;
  var multiplier = contractEffects(state).tuningCostMultiplier;
  var step = IDLE_BALANCE.TUNING_COST_ROUND_TO;
  return Math.max(step, Math.round((base * multiplier) / step) * step);
}

/**
 * Berechnet die Breite der perfekten Schaltpunkt-Zone UNTER
 * Berücksichtigung des "Perfekt-Zone 10% breiter"-Werksvertrags (siehe
 * contractEffects). Reine Funktion — wraps perfectZoneWidth().
 * @param {Object} state - Zentraler Idle-Zustand (nur lesend, für contractEffects).
 * @param {number} combo - Aktuelle Combo-Anzahl (>= 0).
 * @returns {number} Zonenbreite in % (siehe perfectZoneWidth()).
 */
function perfectZoneWidthForState(state, combo) {
  var bonus = contractEffects(state).zoneWidthBonusPct;
  return perfectZoneWidth(combo, IDLE_BALANCE.COMBO_ZONE_BASE_WIDTH_PCT + bonus);
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
  comboMultiplier: comboMultiplier,
  perfectZoneWidth: perfectZoneWidth,
  applyShiftResult: applyShiftResult,
  activeComboMultiplier: activeComboMultiplier,
  nextShiftIntervalSeconds: nextShiftIntervalSeconds,

  /* ── Phase C: MECHANIK B — Saison/Prestige/Werksverträge ────────── */
  IDLE_CONTRACTS: IDLE_CONTRACTS,
  getContractById: getContractById,
  contractEffects: contractEffects,
  canBuyContract: canBuyContract,
  buyContract: buyContract,
  trophiesForSeason: trophiesForSeason,
  canFinishSeason: canFinishSeason,
  finishSeason: finishSeason,
  effectiveTuningCost: effectiveTuningCost,
  perfectZoneWidthForState: perfectZoneWidthForState,
};

if (typeof window !== 'undefined') {
  window.IdleCore = IdleCore;
} else if (typeof globalThis !== 'undefined') {
  globalThis.IdleCore = IdleCore;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = IdleCore;
}
