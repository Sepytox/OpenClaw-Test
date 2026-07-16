/**
 * VROOOOM — Settings Panel
 * Theme switching (Neon Dark / Light Professional / Dark Professional)
 * Brightness control, Accessibility options
 * Persisted in localStorage
 */

(function () {
  'use strict';

  /* ── Keys ──────────────────────────────────────────────────── */
  var STORAGE = {
    theme:         'vroooom_theme',
    brightness:    'vroooom_brightness',
    highContrast:  'vroooom_a11y_contrast',
    largeText:     'vroooom_a11y_text',
    reduceMotion:  'vroooom_a11y_motion',
  };

  /* ── Defaults ───────────────────────────────────────────────── */
  var DEFAULTS = {
    theme:         'neon-dark',
    brightness:    100,
    highContrast:  false,
    largeText:     false,
    reduceMotion:  false,
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
    theme:        load(STORAGE.theme,        DEFAULTS.theme),
    brightness:   load(STORAGE.brightness,   DEFAULTS.brightness),
    highContrast: load(STORAGE.highContrast, DEFAULTS.highContrast),
    largeText:    load(STORAGE.largeText,    DEFAULTS.largeText),
    reduceMotion: load(STORAGE.reduceMotion, DEFAULTS.reduceMotion),
  };

  /* ── Apply theme ────────────────────────────────────────────── */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Remove legacy dark-mode classes if present
    document.body.classList.remove('dark-mode', 'cyberpunk-mode');
    document.documentElement.classList.remove('dark-mode-pending', 'cyberpunk-pending');
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

  /* ── Build Settings Panel HTML ──────────────────────────────── */
  function buildPanel() {
    var html = [
      /* Overlay */
      '<div class="settings-overlay" id="settingsOverlay" role="presentation"></div>',
      /* Trigger button */
      '<button class="settings-trigger" id="settingsTrigger" aria-label="Einstellungen öffnen" title="⚙️ Einstellungen">⚙️</button>',
      /* Panel */
      '<aside class="settings-panel" id="settingsPanel" role="dialog" aria-modal="true" aria-label="Einstellungen">',
        '<div class="settings-panel-header">',
          '<span class="settings-panel-title">⚙️ Einstellungen</span>',
          '<button class="settings-close" id="settingsClose" aria-label="Einstellungen schließen">✕</button>',
        '</div>',
        '<div class="settings-panel-body">',

          /* Theme section */
          '<div class="settings-section">',
            '<div class="settings-section-title">🌙 Theme</div>',
            '<div class="theme-options">',
              themeOption('neon-dark',          '🌌', 'theme-preview-neon',      'Neon Dark',          'Energetic, Gaming, Cyberpunk'),
              themeOption('light-professional', '☀️', 'theme-preview-light',     'Light Professional', 'Clean, Readable, Business'),
              themeOption('dark-professional',  '🌃', 'theme-preview-dark-pro',  'Dark Professional',  'Sleek, Modern, Seriös'),
            '</div>',
          '</div>',

          /* Brightness section */
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

          /* Accessibility section */
          '<div class="settings-section">',
            '<div class="settings-section-title">♿ Accessibility</div>',
            checkRow('a11yContrast', 'highContrast', 'Hoher Kontrast', 'Stärkere Farb-Kontraste für bessere Lesbarkeit', state.highContrast),
            checkRow('a11yText',    'largeText',    'Große Schrift',   'Text-Größe von 14px auf 18px erhöhen',           state.largeText),
            checkRow('a11yMotion',  'reduceMotion', 'Animationen reduzieren', 'Weniger Bewegung für bessere Fokussierung', state.reduceMotion),
          '</div>',

        '</div>',
        '<div class="settings-panel-footer">',
          '<button class="settings-reset-btn" id="settingsReset">💾 Auf Standard zurücksetzen</button>',
        '</div>',
      '</aside>',
    ].join('');
    return html;
  }

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
    var trigger  = document.getElementById('settingsTrigger');
    var overlay  = document.getElementById('settingsOverlay');
    var panel    = document.getElementById('settingsPanel');
    var closeBtn = document.getElementById('settingsClose');
    var brightness = document.getElementById('brightnessRange');
    var resetBtn = document.getElementById('settingsReset');

    function openPanel() {
      panel.classList.add('open');
      overlay.classList.add('open');
      panel.focus();
      document.body.style.overflow = 'hidden';
    }

    function closePanel() {
      panel.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      trigger.focus();
    }

    trigger.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        closePanel();
      }
    });

    // Theme buttons
    var themeButtons = document.querySelectorAll('[data-theme-value]');
    themeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.theme = btn.getAttribute('data-theme-value');
        save(STORAGE.theme, state.theme);
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
        save(STORAGE.brightness, state.brightness);
        applyBrightness(state.brightness);
      });
    }

    // Checkboxes (a11y)
    var checks = document.querySelectorAll('[data-state-key]');
    checks.forEach(function (chk) {
      chk.addEventListener('change', function () {
        var key = chk.getAttribute('data-state-key');
        state[key] = chk.checked;
        var storageKey = STORAGE[key];
        if (storageKey) save(storageKey, state[key]);
        applyA11y(state.highContrast, state.largeText, state.reduceMotion);
      });
    });

    // Reset button
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        Object.keys(DEFAULTS).forEach(function (k) {
          state[k] = DEFAULTS[k];
          if (STORAGE[k]) save(STORAGE[k], DEFAULTS[k]);
        });
        applyAll();
        // Re-inject to rebuild UI
        var root = document.getElementById('vroooom-settings-root');
        if (root) root.remove();
        injectPanel();
        // Re-open panel
        setTimeout(function () {
          var p = document.getElementById('settingsPanel');
          var o = document.getElementById('settingsOverlay');
          if (p && o) { p.classList.add('open'); o.classList.add('open'); }
        }, 50);
      });
    }
  }

  function updateThemeButtons() {
    var buttons = document.querySelectorAll('[data-theme-value]');
    buttons.forEach(function (btn) {
      var isActive = btn.getAttribute('data-theme-value') === state.theme;
      btn.classList.toggle('active', isActive);
    });
  }

  /* ── Init on DOM ready ──────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPanel);
  } else {
    injectPanel();
  }

})();
