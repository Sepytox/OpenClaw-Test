/**
 * VROOOOM — Scroll-Reveal (Eintritts-Animationen)
 *
 * Beobachtet alle Elemente mit der Klasse ".js-reveal" per
 * IntersectionObserver und blendet sie beim ersten Sichtbarwerden sanft
 * ein (Opacity + Transform, gesteuert über CSS-Transitions in
 * styles.css/design.css — hier wird nur die Klasse "is-visible" gesetzt).
 *
 * Sicherheitsnetz (Mängelliste-Vorgabe "nie dauerhaft verstecken"):
 * - Ohne diese Datei bzw. ohne unterstützten IntersectionObserver bleiben
 *   ".js-reveal"-Elemente sichtbar, weil die "versteckt"-Optik nur unter
 *   der Klasse "reveal-ready" (von diesem Skript auf <html> gesetzt) aktiv
 *   wird. Kein JS/kein Observer = kein Verstecken.
 * - Bei aktivierter Systemeinstellung "Bewegung reduzieren"
 *   (prefers-reduced-motion) werden alle Elemente sofort ohne Animation
 *   sichtbar gemacht.
 *
 * Wird von index.html, quiz.html, race.html, wheel.html und shop.html
 * eingebunden. index.html/soundcheck.html sind bewusst ausgenommen
 * (soundcheck.html: geschützte Datei, siehe GOLDEN_PRINCIPLES_KE.md
 * Regel 6; index.html bindet stattdessen dieselbe Datei ebenfalls ein,
 * sofern im HTML referenziert).
 */
(function () {
    'use strict';

    /** CSS-Selektor für alle zu beobachtenden Eintritts-Elemente. */
    var REVEAL_SELECTOR = '.js-reveal';
    /** Klasse, die beim Sichtbarwerden auf das Zielelement gesetzt wird. */
    var VISIBLE_CLASS = 'is-visible';
    /** Klasse auf <html>, die die "versteckt bis sichtbar"-Optik aktiviert. */
    var READY_CLASS = 'reveal-ready';
    /** Verzögerung zwischen gestaffelten Elementen in Millisekunden. */
    var STAGGER_STEP_MS = 70;
    /** Maximale Anzahl an gestaffelten Schritten (danach identische Verzögerung). */
    var MAX_STAGGER_STEPS = 8;

    /**
     * Prüft, ob der Benutzer reduzierte Bewegung bevorzugt (Systemeinstellung).
     * @returns {boolean} true, wenn prefers-reduced-motion: reduce aktiv ist.
     */
    function prefersReducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /**
     * Macht alle übergebenen Elemente sofort sichtbar (kein Staffel-Effekt).
     * @param {Element[]} elements - Zu enthüllende Elemente.
     * @returns {void}
     */
    function revealAllImmediately(elements) {
        elements.forEach(function (el) {
            el.classList.add(VISIBLE_CLASS);
        });
    }

    /**
     * Initialisiert die Scroll-Reveal-Beobachtung für alle ".js-reveal"-Elemente
     * auf der aktuellen Seite.
     * @returns {void}
     */
    function initScrollReveal() {
        var elements = Array.prototype.slice.call(document.querySelectorAll(REVEAL_SELECTOR));
        if (!elements.length) return;

        if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
            revealAllImmediately(elements);
            return;
        }

        document.documentElement.classList.add(READY_CLASS);

        elements.forEach(function (el, index) {
            var step = Math.min(index, MAX_STAGGER_STEPS);
            el.style.transitionDelay = (step * STAGGER_STEP_MS) + 'ms';
        });

        var observer = new IntersectionObserver(function (entries, obs) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add(VISIBLE_CLASS);
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        elements.forEach(function (el) {
            observer.observe(el);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScrollReveal);
    } else {
        initScrollReveal();
    }
})();
