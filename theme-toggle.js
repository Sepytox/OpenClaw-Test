/**
 * VROOOOM — Shared Theme-Toggle-Button-Handler
 *
 * Bindet den #themeToggle-Button an das globale data-theme-System
 * (siehe settings.js). Diese Logik war zuvor wortidentisch als
 * ca. 13-Zeilen-IIFE in quiz.html, race.html, wheel.html und shop.html
 * dupliziert (Mängelliste 3.1) — jetzt einmalige Single Source of Truth.
 *
 * index.html und soundcheck.html verwenden bewusst weiterhin ihre
 * eigene Logik (index.html: testabhängig, siehe dark-mode.test.js;
 * soundcheck.html: geschützte Datei, siehe GOLDEN_PRINCIPLES_KE.md
 * Regel 6) und binden diese Datei daher nicht ein.
 */
(function () {
    'use strict';

    /**
     * Initialisiert den Theme-Toggle-Button im Nav: setzt das Icon passend
     * zum aktuell gespeicherten Theme und registriert den Klick-Handler,
     * der zwischen Dark- und Light-Mode wechselt, das data-theme-Attribut
     * aktualisiert und die Wahl unter dem 'theme'-Key in localStorage
     * persistiert.
     * @returns {void}
     */
    function initThemeToggle() {
        var btn = document.getElementById('themeToggle');
        if (!btn) return;
        var t = localStorage.getItem('theme') || 'dark';
        btn.textContent = t === 'dark' ? '☀️' : '🌙';
        btn.addEventListener('click', function () {
            var current = document.documentElement.getAttribute('data-theme');
            var next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            btn.textContent = next === 'dark' ? '☀️' : '🌙';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemeToggle);
    } else {
        initThemeToggle();
    }
})();
