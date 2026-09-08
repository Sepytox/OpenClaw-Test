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

  /* ── Phase B: Renn-Strecke (Canvas) ─────────────────────────────── */
  /** Rundenzeit (Sekunden) bei Geschwindigkeit 0% (langsamstes Bike, Level 0). */
  var TRACK_LAP_SECONDS_SLOW = 16;
  /** Rundenzeit (Sekunden) bei Geschwindigkeit 100% (schnellstes/getuntestes Bike). */
  var TRACK_LAP_SECONDS_FAST = 3.5;
  /** Anzahl der Trail-Punkte hinter dem Bike-Marker (Glow-Trail). */
  var TRACK_TRAIL_LENGTH = 14;
  /** Ab dieser Geschwindigkeit (%) werden Speed-Lines gezeichnet. */
  var TRACK_SPEED_LINES_THRESHOLD_PCT = 45;

  /* ── Phase B: Tacho (Canvas) ─────────────────────────────────────── */
  /** Glättungsfaktor pro Frame für die Tacho-Nadel (0..1, höher = schneller). */
  var TACHO_NEEDLE_EASE = 0.09;

  /* ── Phase B: "Neues Bike in der Garage"-Übergabe ───────────────── */
  /** Anzeigedauer (ms) des Übergabe-Banners nach einem Bike-Kauf. */
  var HANDOVER_BANNER_MS = 2200;

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

  /** true, wenn das System "Bewegung reduzieren" bevorzugt (prefers-reduced-motion). */
  var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ── Renn-Strecke: Laufzeit-Zustand ──────────────────────────────── */
  /** Aktueller Winkel (Radiant) des Bike-Markers auf der Oval-Strecke. */
  var trackAngle = 0;
  /** Trail-Punkte (Glow-Trail) hinter dem Bike-Marker, je {x, y}. */
  var trackTrail = [];
  /** DOM-Referenzen für Canvas + 2D-Kontext (einmalig aufgelöst, siehe initCanvases()). */
  var trackCanvas = null, trackCtx = null;
  var tachoCanvas = null, tachoCtx = null;

  /* ── Tacho: Laufzeit-Zustand ─────────────────────────────────────── */
  /** Aktuell angezeigter (weich nachlaufender) Tacho-Nadel-Prozentwert. */
  var tachoDisplayPct = 0;

  /* ── "Neues Bike in der Garage"-Übergabe ────────────────────────── */
  /** Timeout-Handle des aktuell angezeigten Übergabe-Banners (für Re-Trigger). */
  var handoverTimeoutId = null;

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
            triggerBikeHandover(result.bike);
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

  /* ============================================================
     RENN-STRECKE + TACHO (Canvas) — feat(idle-visuals)
     ============================================================ */

  /**
   * Passt die Backing-Store-Grösse eines Canvas an seine tatsächliche
   * CSS-Anzeigegrösse an (inkl. devicePixelRatio), damit Zeichnungen auf
   * hochauflösenden Displays nicht unscharf wirken.
   * @param {HTMLCanvasElement} canvas - Zu skalierendes Canvas-Element.
   * @returns {CanvasRenderingContext2D|null} 2D-Kontext des Canvas, oder null.
   */
  function resizeCanvasToDisplaySize(canvas) {
    if (!canvas) return null;
    var ratio = window.devicePixelRatio || 1;
    var width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    var height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    var ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }

  /**
   * Löst die Canvas-Elemente (Strecke + Tacho) einmalig auf und skaliert
   * sie initial. Wird zusätzlich bei jedem Fenster-Resize erneut aufgerufen.
   * @returns {void}
   */
  function initCanvases() {
    trackCanvas = document.getElementById('idleTrackCanvas');
    tachoCanvas = document.getElementById('idleTachoCanvas');
    trackCtx = resizeCanvasToDisplaySize(trackCanvas);
    tachoCtx = resizeCanvasToDisplaySize(tachoCanvas);
    window.addEventListener('resize', function () {
      trackCtx = resizeCanvasToDisplaySize(trackCanvas);
      tachoCtx = resizeCanvasToDisplaySize(tachoCanvas);
    });
  }

  /**
   * Rendert EINEN Frame der Oval-Renn-Strecke: bewegt den Bike-Marker
   * entlang einer ovalen Bahn, deren Rundenzeit mit der aktuellen
   * Geschwindigkeit (geschwindigkeitPct) sichtbar schrumpft — schneller
   * gefahren wird spürbar mehr Runden/Sekunde. Bei ausreichender
   * Geschwindigkeit werden zusätzlich Speed-Lines + ein Glow-Trail
   * gezeichnet (respektiert prefers-reduced-motion).
   * @param {number} dtSeconds - Verstrichene Zeit seit dem letzten Frame (Sekunden, gedeckelt).
   * @param {number} speedPct - Aktuelle Geschwindigkeit des Bikes (0–100%).
   * @returns {void}
   */
  function renderTrack(dtSeconds, speedPct) {
    if (!trackCtx || !trackCanvas) return;
    var w = trackCanvas.clientWidth;
    var h = trackCanvas.clientHeight;
    if (w <= 0 || h <= 0) return;

    var lapSeconds = TRACK_LAP_SECONDS_SLOW - (TRACK_LAP_SECONDS_SLOW - TRACK_LAP_SECONDS_FAST) * (speedPct / 100);
    var angularSpeed = (2 * Math.PI) / Math.max(0.5, lapSeconds);
    trackAngle = (trackAngle + angularSpeed * dtSeconds) % (2 * Math.PI);

    var cx = w / 2, cy = h / 2;
    var rx = w * 0.42, ry = h * 0.34;
    var bikeX = cx + Math.cos(trackAngle) * rx;
    var bikeY = cy + Math.sin(trackAngle) * ry;

    trackCtx.clearRect(0, 0, w, h);

    // Oval-Fahrbahn.
    trackCtx.beginPath();
    trackCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    trackCtx.lineWidth = Math.max(2, h * 0.05);
    trackCtx.strokeStyle = 'rgba(150,150,150,0.35)';
    trackCtx.stroke();

    if (!reducedMotion) {
      // Glow-Trail: verblassende Punkte entlang der zurückliegenden Positionen.
      trackTrail.push({ x: bikeX, y: bikeY });
      if (trackTrail.length > TRACK_TRAIL_LENGTH) trackTrail.shift();
      trackTrail.forEach(function (point, index) {
        var alpha = (index / trackTrail.length) * 0.35;
        trackCtx.beginPath();
        trackCtx.arc(point.x, point.y, Math.max(2, h * 0.035), 0, Math.PI * 2);
        trackCtx.fillStyle = 'rgba(47,160,107,' + alpha.toFixed(3) + ')';
        trackCtx.fill();
      });

      // Speed-Lines hinter dem Bike ab spürbarem Tempo.
      if (speedPct >= TRACK_SPEED_LINES_THRESHOLD_PCT) {
        var tangentAngle = trackAngle - Math.PI / 2;
        var lineCount = 3;
        for (var i = 0; i < lineCount; i++) {
          var lx = cx + Math.cos(trackAngle - (i + 1) * 0.14) * rx;
          var ly = cy + Math.sin(trackAngle - (i + 1) * 0.14) * ry;
          trackCtx.beginPath();
          trackCtx.moveTo(lx, ly);
          trackCtx.lineTo(lx - Math.cos(tangentAngle) * (6 + i * 3), ly - Math.sin(tangentAngle) * (6 + i * 3));
          trackCtx.strokeStyle = 'rgba(241,241,239,' + (0.35 - i * 0.1) + ')';
          trackCtx.lineWidth = 2;
          trackCtx.stroke();
        }
      }
    } else {
      trackTrail.length = 0;
    }

    // Bike-Marker.
    trackCtx.beginPath();
    trackCtx.arc(bikeX, bikeY, Math.max(4, h * 0.06), 0, Math.PI * 2);
    trackCtx.fillStyle = '#1f6d4a';
    trackCtx.shadowColor = reducedMotion ? 'transparent' : 'rgba(47,160,107,0.8)';
    trackCtx.shadowBlur = reducedMotion ? 0 : 10;
    trackCtx.fill();
    trackCtx.shadowBlur = 0;
  }

  /**
   * Rendert EINEN Frame des Halbkreis-Tachos: zeichnet Skalenstriche +
   * eine weich nachlaufende Nadel, die sich zur aktuellen Geschwindigkeit
   * des Bikes hin bewegt (siehe deriveBikeStats().geschwindigkeitPct).
   * Ein Bike-Wechsel/-Kauf erzeugt dadurch automatisch einen sichtbaren
   * Nadel-Sweep vom alten zum neuen Wert.
   * @param {number} speedPct - Ziel-Geschwindigkeit des Bikes (0–100%).
   * @param {number} kmh - Anzuzeigende km/h-Zahl (rein informativ).
   * @returns {void}
   */
  function renderTacho(speedPct, kmh) {
    if (!tachoCtx || !tachoCanvas) return;
    var w = tachoCanvas.clientWidth;
    var h = tachoCanvas.clientHeight;
    if (w <= 0 || h <= 0) return;

    var diff = speedPct - tachoDisplayPct;
    tachoDisplayPct += diff * TACHO_NEEDLE_EASE;
    if (Math.abs(diff) < 0.05) tachoDisplayPct = speedPct;

    var cx = w / 2, cy = h * 0.92;
    var radius = Math.min(w * 0.46, h * 0.85);

    tachoCtx.clearRect(0, 0, w, h);

    // Skalenbogen + feine Skalenstriche (Halbkreis, 180°→0°).
    tachoCtx.beginPath();
    tachoCtx.arc(cx, cy, radius, Math.PI, 0, false);
    tachoCtx.lineWidth = Math.max(2, radius * 0.04);
    tachoCtx.strokeStyle = 'rgba(150,150,150,0.35)';
    tachoCtx.stroke();

    var tickCount = 24;
    for (var i = 0; i <= tickCount; i++) {
      var tickAngle = Math.PI - (i / tickCount) * Math.PI;
      var isMajor = i % 4 === 0;
      var inner = radius * (isMajor ? 0.82 : 0.9);
      var outer = radius * 0.98;
      tachoCtx.beginPath();
      tachoCtx.moveTo(cx + Math.cos(tickAngle) * inner, cy - Math.sin(tickAngle) * inner);
      tachoCtx.lineTo(cx + Math.cos(tickAngle) * outer, cy - Math.sin(tickAngle) * outer);
      tachoCtx.lineWidth = isMajor ? 2 : 1;
      tachoCtx.strokeStyle = 'rgba(156,156,158,0.6)';
      tachoCtx.stroke();
    }

    // Nadel.
    var needleAngle = Math.PI - (tachoDisplayPct / 100) * Math.PI;
    var needleLen = radius * 0.78;
    tachoCtx.beginPath();
    tachoCtx.moveTo(cx, cy);
    tachoCtx.lineTo(cx + Math.cos(needleAngle) * needleLen, cy - Math.sin(needleAngle) * needleLen);
    tachoCtx.lineWidth = Math.max(2, radius * 0.05);
    tachoCtx.lineCap = 'round';
    tachoCtx.strokeStyle = '#1f6d4a';
    tachoCtx.stroke();

    tachoCtx.beginPath();
    tachoCtx.arc(cx, cy, Math.max(3, radius * 0.07), 0, Math.PI * 2);
    tachoCtx.fillStyle = '#1f6d4a';
    tachoCtx.fill();

    // km/h-Zahl.
    tachoCtx.fillStyle = '#9c9c9e';
    tachoCtx.font = (Math.max(10, radius * 0.16)) + 'px sans-serif';
    tachoCtx.textAlign = 'center';
    tachoCtx.fillText(Math.round(kmh) + ' km/h', cx, cy - radius * 0.22);
  }

  /**
   * Zeigt kurz das "Neues Bike in der Garage"-Übergabe-Banner über der
   * Strecke an und löst einen Zoom-Puls des Strecken-Containers aus. Die
   * Tacho-Nadel sweept dabei automatisch vom alten zum neuen Wert (siehe
   * renderTacho()'s Easing zusammen mit dem geänderten currentBikeId).
   * @param {Object} bike - Das neu gekaufte Bike (IDLE_BIKES-Eintrag).
   * @returns {void}
   */
  function triggerBikeHandover(bike) {
    var banner = document.getElementById('idleHandover');
    var trackWrap = document.getElementById('idleTrackWrap');
    if (banner) {
      banner.textContent = '🏁 Neues Bike in der Garage: ' + bike.name;
      banner.classList.add('is-visible');
      if (handoverTimeoutId) clearTimeout(handoverTimeoutId);
      handoverTimeoutId = setTimeout(function () {
        banner.classList.remove('is-visible');
      }, HANDOVER_BANNER_MS);
    }
    if (trackWrap && !reducedMotion) {
      trackWrap.classList.remove('is-pulsing');
      void trackWrap.offsetWidth;
      trackWrap.classList.add('is-pulsing');
    }
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

    // Strecke/Tacho teilen sich denselben Game-Loop-Tick (kein zweiter rAF-Loop).
    var info = getCurrentBikeInfo();
    var kmh = (info.bike.topspeed * info.stats.geschwindigkeitPct) / 100;
    renderTrack(clampedDt, info.stats.geschwindigkeitPct);
    renderTacho(info.stats.geschwindigkeitPct, kmh);

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
    initCanvases();
    tachoDisplayPct = getCurrentBikeInfo().stats.geschwindigkeitPct;
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
