/**
 * VROOOOM — Settings Panel v2
 * Dark / Light Theme via data-theme attribute + CSS variables
 * Brightness & Accessibility options
 * Persisted in localStorage
 */

(function () {
  'use strict';

  /* ── Storage keys ───────────────────────────────────────────── */
  var KEYS = {
    theme:        'theme',
    brightness:   'vroooom_brightness',
    highContrast: 'vroooom_a11y_contrast',
    largeText:    'vroooom_a11y_text',
    reduceMotion: 'vroooom_a11y_motion',
  };

  /* ── Defaults ───────────────────────────────────────────────── */
  var DEFAULTS = {
    theme:        'dark',
    brightness:   100,
    highContrast: false,
    largeText:    false,
    reduceMotion: false,
  };

  /* ── Helpers ────────────────────────────────────────────────── */
  function load(key, fallback) {
    var v = localStorage.getItem(key);
    if (v === null) return fallback;
    if (v === 'true') return true;
    if (v === 'false') return false;
    var n = parseFloat(v);
    return isNaN(n) ? v : n;
  }

  function save(key, value) {
    localStorage.setItem(key, String(value));
  }

  /* ── State ──────────────────────────────────────────────────── */
  var state = {
    theme:        load(KEYS.theme,        DEFAULTS.theme),
    brightness:   load(KEYS.brightness,   DEFAULTS.brightness),
    highContrast: load(KEYS.highContrast, DEFAULTS.highContrast),
    largeText:    load(KEYS.largeText,    DEFAULTS.largeText),
    reduceMotion: load(KEYS.reduceMotion, DEFAULTS.reduceMotion),
  };

  /* ── Apply theme ────────────────────────────────────────────── */
  function applyTheme(theme) {
    var t = (theme === 'light') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    // Update all theme-toggle buttons on page
    document.querySelectorAll('#themeToggle').forEach(function(btn) {
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
    });
    // Remove legacy classes if present
    document.body.classList.remove('dark-mode', 'neon-dark', 'cyberpunk-mode');
  }

  function applyBrightness(value) {
    var pct = Math.max(50, Math.min(100, value)) / 100;
    if (pct < 1) {
      document.body.classList.add('brightness-adjusted');
      document.documentElement.style.setProperty('--brightness-value', pct);
    } else {
      document.body.classList.remove('brightness-adjusted');
      document.documentElement.style.removeProperty('--brightness-value');
    }
  }

  function applyA11y(high, large, motion) {
    document.body.classList.toggle('a11y-high-contrast', !!high);
    document.body.classList.toggle('a11y-large-text',    !!large);
    document.body.classList.toggle('a11y-reduce-motion', !!motion);
  }

  function applyAll() {
    applyTheme(state.theme);
    applyBrightness(state.brightness);
    applyA11y(state.highContrast, state.largeText, state.reduceMotion);
  }

  /* Apply immediately (before DOM ready to avoid flash) */
  applyAll();

  /* ── Seitenbesuch-Tracking (Gamification) ───────────────────────
   * Läuft auf JEDER Seite, die settings.js einbindet — auch auf
   * soundcheck.html (geschützte Datei, wird hier bewusst NICHT
   * angefasst). Dieser Block ist komplett eigenständig: er hängt
   * NICHT von stats.js/achievements.js ab, da beide auf
   * soundcheck.html nicht geladen werden. Er darf niemals einen
   * Fehler nach außen werfen (try/catch), damit bestehende Seiten
   * nie blockiert werden. */
  var VISITED_PAGES_KEY = 'vroooom_stats_visitedPages';

  /**
   * Ermittelt den normalisierten Seiten-Schlüssel aus dem aktuellen
   * Pfad (z. B. "soundcheck" für "/soundcheck.html", "index" für "/"
   * oder "/index.html").
   * @returns {string} Seiten-Schlüssel ohne Verzeichnis/Endung.
   */
  function currentPageKey() {
    var path = window.location.pathname || '';
    var base = path.substring(path.lastIndexOf('/') + 1);
    base = base.replace(/\.html?$/i, '');
    return base || 'index';
  }

  /**
   * Trägt den Besuch der aktuellen Seite mit Zeitstempel in
   * vroooom_stats_visitedPages ein und stößt (falls verfügbar) eine
   * erneute Achievement-Prüfung für "alle Mini-Apps besucht" an.
   * Rein additiv, defensiv gegen fehlendes/korruptes localStorage.
   * @returns {void}
   */
  function recordPageVisit() {
    try {
      var key = currentPageKey();
      var raw = localStorage.getItem(VISITED_PAGES_KEY);
      var visits = {};
      try { visits = raw ? JSON.parse(raw) : {}; } catch (e) { visits = {}; }
      if (!visits || typeof visits !== 'object') visits = {};
      visits[key] = new Date().toISOString();
      localStorage.setItem(VISITED_PAGES_KEY, JSON.stringify(visits));
      if (window.VroooomAchievements && typeof window.VroooomAchievements.checkAllAppsVisited === 'function') {
        window.VroooomAchievements.checkAllAppsVisited();
      }
    } catch (e) {
      /* Seitenbesuch-Tracking darf nie eine bestehende Seite blockieren */
    }
  }
  recordPageVisit();

  /* ── Build Settings Panel HTML ──────────────────────────────── */
  function themeOption(value, icon, previewClass, name, desc) {
    var active = state.theme === value ? ' active' : '';
    return [
      '<button class="theme-option' + active + '" data-theme-value="' + value + '" type="button">',
        '<span class="theme-option-radio"></span>',
        '<span class="theme-option-preview ' + previewClass + '" aria-hidden="true"></span>',
        '<span class="theme-option-info">',
          '<span class="theme-option-name">' + icon + ' ' + name + '</span>',
          '<span class="theme-option-desc">' + desc + '</span>',
        '</span>',
      '</button>',
    ].join('');
  }

  function checkRow(id, stateKey, label, desc, checked) {
    return [
      '<label class="settings-check-row" for="' + id + '">',
        '<input type="checkbox" id="' + id + '" data-state-key="' + stateKey + '"' + (checked ? ' checked' : '') + '>',
        '<span class="settings-check-label">' + label + '<small>' + desc + '</small></span>',
      '</label>',
    ].join('');
  }

  function buildPanel() {
    return [
      '<div class="settings-overlay" id="settingsOverlay" role="presentation"></div>',
      '<button class="settings-trigger" id="settingsTrigger" aria-label="Einstellungen öffnen" title="⚙️ Einstellungen">⚙️</button>',
      '<aside class="settings-panel" id="settingsPanel" role="dialog" aria-modal="true" aria-label="Einstellungen">',
        '<div class="settings-panel-header">',
          '<span class="settings-panel-title">⚙️ Einstellungen</span>',
          '<button class="settings-close" id="settingsClose" aria-label="Einstellungen schließen">✕</button>',
        '</div>',
        '<div class="settings-panel-body">',

          '<div class="settings-section">',
            '<div class="settings-section-title">🌙 Theme</div>',
            '<div class="theme-options">',
              themeOption('dark',  '🌑', 'theme-preview-neon',   'Dark Mode',  'Orange/Schwarz — Standard'),
              themeOption('light', '☀️', 'theme-preview-light',  'Light Mode', 'Hell & aufgeräumt'),
            '</div>',
          '</div>',

          '<div class="settings-section">',
            '<div class="settings-section-title">🔆 Helligkeit</div>',
            '<div class="settings-slider-row">',
              '<div class="settings-slider-label">',
                '<span>Helligkeit</span>',
                '<span class="settings-slider-val" id="brightnessVal">' + state.brightness + '%</span>',
              '</div>',
              '<input class="vc-range" type="range" id="brightnessRange" min="50" max="100" step="5" value="' + state.brightness + '" aria-label="Helligkeit anpassen">',
            '</div>',
          '</div>',

          '<div class="settings-section">',
            '<div class="settings-section-title">♿ Accessibility</div>',
            checkRow('a11yContrast', 'highContrast', 'Hoher Kontrast',        'Stärkere Farb-Kontraste',          state.highContrast),
            checkRow('a11yText',    'largeText',    'Große Schrift',           'Text-Größe erhöhen',               state.largeText),
            checkRow('a11yMotion',  'reduceMotion', 'Animationen reduzieren',  'Weniger Bewegung',                 state.reduceMotion),
          '</div>',

        '</div>',
        '<div class="settings-panel-footer">',
          '<button class="settings-reset-btn" id="settingsReset">Auf Standard zurücksetzen</button>',
        '</div>',
      '</aside>',
    ].join('');
  }

  /* ── Inject panel into DOM ──────────────────────────────────── */
  function injectPanel() {
    var el = document.createElement('div');
    el.id = 'vroooom-settings-root';
    el.innerHTML = buildPanel();
    document.body.appendChild(el);
    bindEvents();
    updateThemeButtons();
  }

  /* ── Event binding ──────────────────────────────────────────── */
  function bindEvents() {
    var trigger    = document.getElementById('settingsTrigger');
    var overlay    = document.getElementById('settingsOverlay');
    var panel      = document.getElementById('settingsPanel');
    var closeBtn   = document.getElementById('settingsClose');
    var brightness = document.getElementById('brightnessRange');
    var resetBtn   = document.getElementById('settingsReset');

    function openPanel() {
      panel.classList.add('open');
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closePanel() {
      panel.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    trigger.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) closePanel();
    });

    // Theme buttons
    document.querySelectorAll('[data-theme-value]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.theme = btn.getAttribute('data-theme-value');
        save(KEYS.theme, state.theme);
        applyTheme(state.theme);
        updateThemeButtons();
      });
    });

    // Brightness slider
    if (brightness) {
      brightness.addEventListener('input', function () {
        state.brightness = parseInt(brightness.value, 10);
        var valEl = document.getElementById('brightnessVal');
        if (valEl) valEl.textContent = state.brightness + '%';
        save(KEYS.brightness, state.brightness);
        applyBrightness(state.brightness);
      });
    }

    // Checkboxes (a11y)
    document.querySelectorAll('[data-state-key]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var key = chk.getAttribute('data-state-key');
        state[key] = chk.checked;
        if (KEYS[key]) save(KEYS[key], state[key]);
        applyA11y(state.highContrast, state.largeText, state.reduceMotion);
      });
    });

    // Reset
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        Object.keys(DEFAULTS).forEach(function (k) {
          state[k] = DEFAULTS[k];
          if (KEYS[k]) save(KEYS[k], DEFAULTS[k]);
        });
        applyAll();
        var root = document.getElementById('vroooom-settings-root');
        if (root) root.remove();
        injectPanel();
        setTimeout(function () {
          var p = document.getElementById('settingsPanel');
          var o = document.getElementById('settingsOverlay');
          if (p && o) { p.classList.add('open'); o.classList.add('open'); }
        }, 50);
      });
    }
  }

  function updateThemeButtons() {
    document.querySelectorAll('[data-theme-value]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-theme-value') === state.theme);
    });
  }

  /* ── Init on DOM ready ──────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPanel);
  } else {
    injectPanel();
  }

})();
