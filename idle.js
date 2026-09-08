/**
 * idle.js — Kawasaki Idle Racer: Seitensteuerung (DOM + Game-Loop).
 *
 * Konsumiert das DOM-freie idle-core.js (window.IdleCore) und übernimmt
 * ALLES, was idle-core.js bewusst NICHT tut: DOM-Bindings, Rendering,
 * den requestAnimationFrame-Game-Loop mit Delta-Zeit (entkoppelt von der
 * Render-Rate, tab-inactive-safe per IDLE_BALANCE.MAX_TICK_DELTA_SECONDS)
 * sowie sanft animierte ("tweenende") Zahlenanzeigen.
 *
 * Persistiert den Zustand regelmässig sowie bei jeder Kauf-/Tuning-
 * Aktion und beim Verlassen der Seite (siehe wireLifecycleSave()).
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.IdleCore) return;
  var IdleCore = window.IdleCore;

  /** Intervall (ms) für periodisches Auto-Speichern des Zustands. */
  var AUTO_SAVE_INTERVAL_MS = 5000;
  /** Glättungsfaktor pro Frame für die "tweenende" km-Anzeige (0..1, höher = schneller). */
  var KM_DISPLAY_EASE = 0.12;
  /** Differenz-Schwelle (km), unterhalb derer die Anzeige direkt auf den Zielwert springt. */
  var KM_DISPLAY_SNAP_THRESHOLD = 0.05;

  /** Emoji-Zuordnung je Bike-Kategorie, rein dekorativ (kein externes Bildmaterial). */
  var CATEGORY_ICONS = {
    'Einsteiger-Naked': '🔰',
    'Off-Road': '⛰️',
    'Cruiser': '😎',
    'Sportler': '🏍️',
    'Klassiker': '🕰️',
    'Naked': '💪',
    'Adventure': '🌍',
    'Sport Tourer': '🚀',
    'Supersportler': '🏆',
    'Hypersportler': '⚡',
    'Hypersportler (Track)': '🔥',
  };

  /** Zentraler, aus localStorage geladener Idle-Zustand (siehe idle-core.js). */
  var state = IdleCore.loadState();
  /** Aktuell angezeigter (sanft nachlaufender) km-Wert für die Tween-Animation. */
  var displayedKm = state.km;
  /** Zeitstempel des letzten Game-Loop-Frames (für Delta-Zeit-Berechnung). */
  var lastFrameTime = null;

  /**
   * Formatiert eine km-Zahl für die Anzeige (deutsches Zahlenformat,
   * abgerundet auf ganze km).
   * @param {number} value - Roh-km-Wert.
   * @returns {string} Formatierte Zeichenkette.
   */
  function formatKm(value) {
    return Math.floor(Math.max(0, value)).toLocaleString('de-DE');
  }

  /**
   * Liefert das aktuell gefahrene Bike-Objekt inkl. Level und
   * abgeleiteten Statistiken.
   * @returns {{bike: Object, level: number, stats: Object}} Aktuelles Bike + Stats.
   */
  function getCurrentBikeInfo() {
    var bike = IdleCore.getBikeById(state.currentBikeId) || IdleCore.IDLE_BIKES[0];
    var level = IdleCore.getBikeLevel(state, bike.id);
    var stats = IdleCore.deriveBikeStats(bike, level);
    return { bike: bike, level: level, stats: stats };
  }

  /**
   * Rendert die Bike-Detailkarte (Name, Kategorie, Statistik-Balken,
   * Tuning-Level, Upgrade-Button inkl. Preis/Deaktivierung).
   * @returns {void}
   */
  function renderBikeCard() {
    var info = getCurrentBikeInfo();
    var nameEl = document.getElementById('idleBikeName');
    var metaEl = document.getElementById('idleBikeMeta');
    if (nameEl) nameEl.textContent = info.bike.name;
    if (metaEl) metaEl.textContent = info.bike.kategorie + ' · ' + info.bike.topspeed + ' km/h · ' + info.bike.ps + ' PS';

    setBar('idleStatSpeedFill', 'idleStatSpeedVal', info.stats.geschwindigkeitPct);
    setBar('idleStatAccelFill', 'idleStatAccelVal', info.stats.beschleunigungPct);
    setBar('idleStatErtragFill', 'idleStatErtragVal', info.stats.ertragBonusPct);

    var levelEl = document.getElementById('idleBikeLevel');
    if (levelEl) levelEl.textContent = String(info.level);

    var cost = IdleCore.tuningCost(info.bike.id, info.level);
    var upgradeBtn = document.getElementById('idleUpgradeBtn');
    var costEl = document.getElementById('idleUpgradeCost');
    if (costEl) costEl.textContent = cost === null ? 'MAX' : formatKm(cost);
    if (upgradeBtn) upgradeBtn.disabled = cost === null || state.km < cost;
  }

  /**
   * Setzt Breite + Prozent-Text eines Statistik-Balkens.
   * @param {string} fillId - Element-id des Fülleistens-Elements.
   * @param {string} valueId - Element-id des Prozent-Text-Elements.
   * @param {number} pct - Prozentwert (0–100).
   * @returns {void}
   */
  function setBar(fillId, valueId, pct) {
    var fillEl = document.getElementById(fillId);
    var valueEl = document.getElementById(valueId);
    if (fillEl) fillEl.style.width = pct + '%';
    if (valueEl) valueEl.textContent = Math.round(pct) + '%';
  }

  /**
   * Rendert die Bike-Shop-Liste: bereits besessene Bikes (mit "Fahren"-
   * Button, hervorgehoben falls aktuell aktiv), das nächste käufliche
   * Bike (mit Preis + Kaufen-Button, deaktiviert falls zu teuer) sowie
   * alle noch gesperrten, zukünftigen Bikes (nur Vorschau, keine
   * Interaktion).
   * @returns {void}
   */
  function renderShopList() {
    var list = document.getElementById('idleShopList');
    if (!list) return;
    list.innerHTML = '';

    IdleCore.IDLE_BIKES.forEach(function (bike, index) {
      var owned = state.ownedBikeIds.indexOf(bike.id) !== -1;
      var isCurrent = state.currentBikeId === bike.id;
      var isNextToBuy = !owned && index === state.ownedBikeIds.length;

      var item = document.createElement('div');
      item.className = 'idle-shop-item' + (isCurrent ? ' is-current' : '') + (!owned && !isNextToBuy ? ' is-locked' : '');

      var icon = document.createElement('span');
      icon.className = 'idle-shop-item-icon';
      icon.textContent = CATEGORY_ICONS[bike.kategorie] || '🏍️';
      item.appendChild(icon);

      var info = document.createElement('div');
      info.className = 'idle-shop-item-info';
      var h4 = document.createElement('h4');
      h4.textContent = bike.name;
      var p = document.createElement('p');
      p.textContent = bike.kategorie + ' · ' + bike.topspeed + ' km/h · ' + bike.ps + ' PS';
      info.appendChild(h4);
      info.appendChild(p);
      item.appendChild(info);

      var action = document.createElement('div');
      action.className = 'idle-shop-item-action';

      if (owned) {
        if (isCurrent) {
          var badge = document.createElement('span');
          badge.className = 'idle-shop-item-badge';
          badge.textContent = '🏁 Aktuell gefahren';
          action.appendChild(badge);
        } else {
          var selectBtn = document.createElement('button');
          selectBtn.type = 'button';
          selectBtn.className = 'btn-outline';
          selectBtn.textContent = 'Fahren';
          selectBtn.addEventListener('click', function () {
            IdleCore.selectBike(state, bike.id);
            IdleCore.saveState(state);
            renderAll();
          });
          action.appendChild(selectBtn);
        }
      } else if (isNextToBuy) {
        var buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        buyBtn.className = 'btn idle-buy-btn';
        buyBtn.textContent = 'Kaufen — ' + formatKm(bike.kaufpreisKm) + ' km';
        buyBtn.disabled = state.km < bike.kaufpreisKm;
        buyBtn.addEventListener('click', function () {
          var result = IdleCore.buyNextBike(state);
          if (result.success) {
            IdleCore.selectBike(state, result.bike.id);
            IdleCore.saveState(state);
            renderAll();
          }
        });
        action.appendChild(buyBtn);
      } else {
        var lockedBadge = document.createElement('span');
        lockedBadge.className = 'idle-shop-item-badge';
        lockedBadge.textContent = '🔒 ' + formatKm(bike.kaufpreisKm) + ' km';
        action.appendChild(lockedBadge);
      }

      item.appendChild(action);
      list.appendChild(item);
    });
  }

  /**
   * Rendert alle Teile der Seite neu (Bike-Karte + Shop-Liste). Die
   * km-Anzeige wird separat im Game-Loop weich nachgezogen, siehe
   * updateKmDisplay().
   * @returns {void}
   */
  function renderAll() {
    renderBikeCard();
    renderShopList();
  }

  /**
   * Zieht die angezeigte km-Zahl weich in Richtung des tatsächlichen
   * state.km nach (einfache Lerp-"Tween"-Animation statt hartem Sprung)
   * und schreibt sie in die DOM-Anzeige.
   * @returns {void}
   */
  function updateKmDisplay() {
    var diff = state.km - displayedKm;
    if (Math.abs(diff) < KM_DISPLAY_SNAP_THRESHOLD) {
      displayedKm = state.km;
    } else {
      displayedKm += diff * KM_DISPLAY_EASE;
    }
    var el = document.getElementById('idleKmValue');
    if (el) el.textContent = formatKm(displayedKm);
  }

  /**
   * Verdrahtet den "Gas geben"-Button: schreibt sofort activeEarn() auf
   * den Zustand gut, löst eine kurze Puls-Animation aus und aktualisiert
   * die abhängigen Anzeigen (Shop-Kaufbarkeit, Upgrade-Kosten).
   * @returns {void}
   */
  function wireGasButton() {
    var btn = document.getElementById('idleGasBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var earned = IdleCore.activeEarn(state);
      IdleCore.creditKm(state, earned);
      btn.classList.remove('is-pulsing');
      // Reflow erzwingen, damit die Animation bei schnellem Mehrfach-Klick erneut startet.
      void btn.offsetWidth;
      btn.classList.add('is-pulsing');
      renderAll();
    });
  }

  /**
   * Verdrahtet den Tuning-Upgrade-Button der Bike-Detailkarte.
   * @returns {void}
   */
  function wireUpgradeButton() {
    var btn = document.getElementById('idleUpgradeBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var result = IdleCore.upgradeBike(state, state.currentBikeId);
      if (result.success) {
        IdleCore.saveState(state);
        renderAll();
      }
    });
  }

  /**
   * Verdrahtet regelmässiges Auto-Speichern sowie ein finales Speichern,
   * bevor die Seite verlassen/versteckt wird (Tab-Wechsel, Schliessen).
   * @returns {void}
   */
  function wireLifecycleSave() {
    setInterval(function () {
      IdleCore.saveState(state);
    }, AUTO_SAVE_INTERVAL_MS);

    window.addEventListener('beforeunload', function () {
      IdleCore.saveState(state);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') IdleCore.saveState(state);
    });
  }

  /**
   * EIN Game-Loop-Frame: berechnet die (auf IDLE_BALANCE.MAX_TICK_DELTA_
   * SECONDS gedeckelte) verstrichene Zeit seit dem letzten Frame,
   * schreibt den passiven Ertrag für dieses Delta gut und aktualisiert
   * die weich nachlaufende km-Anzeige. Die Wirtschaft (Erträge) tickt
   * damit von der Bildwiederholrate entkoppelt — verstrichene Echtzeit
   * wird akkumuliert, nicht die Anzahl der Frames gezählt.
   * @param {number} timestamp - Von requestAnimationFrame übergebener High-Res-Zeitstempel.
   * @returns {void}
   */
  function tick(timestamp) {
    if (lastFrameTime === null) lastFrameTime = timestamp;
    var dtSeconds = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    // Tab-inactive-safe: ein einzelner Frame darf nie mehr als
    // MAX_TICK_DELTA_SECONDS an Ertrag auf einmal gutschreiben (verhindert
    // einen riesigen Sprung, wenn ein hintergründiger Tab zurückkehrt).
    var clampedDt = Math.min(Math.max(dtSeconds, 0), IdleCore.IDLE_BALANCE.MAX_TICK_DELTA_SECONDS);

    var earned = IdleCore.passiveEarn(state, clampedDt);
    IdleCore.creditKm(state, earned);

    updateKmDisplay();

    window.requestAnimationFrame(tick);
  }

  /**
   * Initialisiert die Idle-Racer-Seite: rendert den initialen Zustand,
   * verdrahtet alle Buttons + das Auto-Speichern und startet den
   * Game-Loop.
   * @returns {void}
   */
  function initIdlePage() {
    renderAll();
    updateKmDisplay();
    wireGasButton();
    wireUpgradeButton();
    wireLifecycleSave();
    window.requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIdlePage);
  } else {
    initIdlePage();
  }
})();
