/**
 * CYBERPUNK ANIMATIONS — Vrooooom Motorrad Website
 * Intersection Observer Scroll Reveal + 3D Tilt + Progress Bar + Floating
 */

(function() {
  'use strict';

  /* ============================================================
     1. SCROLL PROGRESS BAR
     ============================================================ */
  function initScrollProgressBar() {
    // Inject progress bar element
    const bar = document.createElement('div');
    bar.className = 'scroll-progress-bar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.prepend(bar);

    function updateProgress() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      document.documentElement.style.setProperty('--scroll-progress', progress.toFixed(2) + '%');
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  /* ============================================================
     2. SCROLL REVEAL — Intersection Observer
     ============================================================ */
  function initScrollReveal() {
    // Apply sr classes to key elements
    applyScrollRevealClasses();

    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('sr-visible');
          // Don't unobserve for floating elements — we want them to stay
          if (!entry.target.classList.contains('float-card')) {
            // Keep observing for potential re-animations; already visible so fine
          }
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    // Observe all sr-* elements
    document.querySelectorAll('.sr-fade, .sr-left, .sr-right, .sr-scale, .sr-up').forEach(function(el) {
      observer.observe(el);
    });
  }

  function applyScrollRevealClasses() {
    // Motorcycle cards — slide from left with stagger
    var motorcycleCards = document.querySelectorAll('.facts .fact-card');
    motorcycleCards.forEach(function(card, idx) {
      // Alternate: left/right for visual variety
      if (idx % 3 === 0) {
        card.classList.add('sr-left');
      } else if (idx % 3 === 1) {
        card.classList.add('sr-fade');
      } else {
        card.classList.add('sr-right');
      }
      // Stagger delay (max 6 levels)
      var delayClass = 'sr-delay-' + Math.min((idx % 6) + 1, 6);
      card.classList.add(delayClass);
      // Also add float animation
      card.classList.add('float-card');
    });

    // Section headings — slide up
    document.querySelectorAll('h2, h3').forEach(function(el) {
      if (!el.closest('header') && !el.closest('.modal-content')) {
        el.classList.add('sr-up');
      }
    });

    // Intro section
    var intro = document.querySelector('.intro');
    if (intro) {
      intro.classList.add('sr-fade');
    }

    // Search filter section
    var searchSection = document.querySelector('.search-filter-section');
    if (searchSection) {
      searchSection.classList.add('sr-scale');
    }

    // Stats (if any)
    document.querySelectorAll('.stat-item, .stat-card').forEach(function(el, idx) {
      el.classList.add('sr-scale');
      el.classList.add('sr-delay-' + Math.min(idx + 1, 6));
    });

    // Race section cards
    document.querySelectorAll('.race-card').forEach(function(card, idx) {
      card.classList.add(idx % 2 === 0 ? 'sr-left' : 'sr-right');
      card.classList.add('sr-delay-' + Math.min(idx + 1, 6));
    });

    // Advice / purchase cards
    document.querySelectorAll('.advice-card, .tip-card').forEach(function(card, idx) {
      card.classList.add('sr-up');
      card.classList.add('sr-delay-' + Math.min(idx + 1, 6));
    });
  }

  /* ============================================================
     3. 3D TILT ON HOVER (mouse-based)
     ============================================================ */
  function initTiltEffect() {
    document.addEventListener('mousemove', function(e) {
      var tiltCards = document.querySelectorAll('.tilt-card');
      tiltCards.forEach(function(card) {
        var rect = card.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        var deltaX = (e.clientX - centerX) / rect.width;
        var deltaY = (e.clientY - centerY) / rect.height;
        var maxTilt = 8; // degrees
        var tiltX = (-deltaY * maxTilt).toFixed(2);
        var tiltY = (deltaX * maxTilt).toFixed(2);
        card.style.setProperty('--tilt-x', tiltX + 'deg');
        card.style.setProperty('--tilt-y', tiltY + 'deg');
      });
    }, { passive: true });

    // Reset on mouse leave
    document.addEventListener('mouseleave', function() {
      document.querySelectorAll('.tilt-card').forEach(function(card) {
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
      });
    });
  }

  /* ============================================================
     4. ADD TILT CLASS TO CARDS
     ============================================================ */
  function applyTiltToCards() {
    document.querySelectorAll('.fact-card').forEach(function(card) {
      card.classList.add('tilt-card');
    });
  }

  /* ============================================================
     5. PARALLAX ON HERO
     ============================================================ */
  function initParallax() {
    var header = document.querySelector('header');
    if (!header) return;

    window.addEventListener('scroll', function() {
      var scrollY = window.scrollY;
      if (scrollY < 600) { // Only in hero zone
        var offset = scrollY * 0.3;
        header.style.backgroundPositionY = offset + 'px';
        // Slight scale on hero h1
        var h1 = header.querySelector('h1');
        if (h1) {
          var scale = 1 + (scrollY * 0.0002);
          h1.style.transform = 'scale(' + Math.min(scale, 1.05) + ')';
        }
      }
    }, { passive: true });
  }

  /* ============================================================
     6. CYBERPUNK MODE TOGGLE
     ============================================================ */
  function initCyberpunkToggle() {
    // Add cyberpunk toggle button to header
    var headerTop = document.querySelector('.header-top');
    if (!headerTop) return;

    var saved = localStorage.getItem('cyberpunkMode') === 'true';

    var btn = document.createElement('button');
    btn.className = 'cyberpunk-toggle' + (saved ? ' active' : '');
    btn.textContent = '⚡ CYBER';
    btn.setAttribute('aria-label', 'Toggle Cyberpunk Mode');
    btn.setAttribute('title', 'Toggle Cyberpunk Mode');
    headerTop.appendChild(btn);

    function applyCyberpunkMode(active) {
      document.body.classList.toggle('cyberpunk-mode', active);
      btn.classList.toggle('active', active);
      btn.textContent = active ? '⚡ CYBER ON' : '⚡ CYBER';
      localStorage.setItem('cyberpunkMode', active ? 'true' : 'false');

      if (active) {
        applyGlitchToHeadings();
        applyHearButtons();
      }
    }

    btn.addEventListener('click', function() {
      var isActive = document.body.classList.contains('cyberpunk-mode');
      applyCyberpunkMode(!isActive);
    });

    // Apply saved preference immediately
    if (saved) {
      applyCyberpunkMode(true);
    }
  }

  /* ============================================================
     7. GLITCH EFFECT ON HEADINGS
     ============================================================ */
  function applyGlitchToHeadings() {
    // Apply glitch-text class to main headings
    var headings = document.querySelectorAll('h1, h2, h3');
    headings.forEach(function(h) {
      if (!h.classList.contains('glitch-text') && !h.closest('.modal-content')) {
        h.classList.add('glitch-text');
        if (!h.getAttribute('data-text')) {
          h.setAttribute('data-text', h.textContent);
        }
        // Add cyberpunk heading class
        if (h.tagName === 'H1') {
          h.classList.add('cyberpunk-heading');
        } else {
          h.classList.add('cyberpunk-heading-magenta');
        }
      }
    });
  }

  /* ============================================================
     8. HEAR THIS BIKE BUTTONS
     ============================================================ */
  function applyHearButtons() {
    // Add "Hear this bike" button to each motorcycle card
    var cards = document.querySelectorAll('.fact-card');
    cards.forEach(function(card) {
      if (card.querySelector('.btn-hear')) return; // Already added

      var name = card.querySelector('.fact-name');
      if (!name) return;

      var bikeName = encodeURIComponent(name.textContent.trim());
      var btn = document.createElement('a');
      btn.href = 'soundcheck.html?bike=' + bikeName;
      btn.className = 'btn-hear';
      btn.innerHTML = '🔊 HEAR THIS BIKE';
      btn.setAttribute('aria-label', 'SoundCheck für ' + name.textContent.trim());

      var actions = card.querySelector('.fact-actions');
      if (actions) {
        actions.appendChild(btn);
      } else {
        card.appendChild(btn);
      }
    });
  }

  /* ============================================================
     9. TEXT REVEAL ANIMATION (clip-path)
     ============================================================ */
  function initTextReveal() {
    var revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          el.style.clipPath = 'inset(0 0% 0 0)';
          revealObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('.text-reveal').forEach(function(el) {
      el.style.clipPath = 'inset(0 100% 0 0)';
      el.style.transition = 'clip-path 0.8s cubic-bezier(0.23, 1, 0.32, 1)';
      revealObserver.observe(el);
    });
  }

  /* ============================================================
     10. NEON PULSE ON FAVORITE/COMPARE BUTTONS
     ============================================================ */
  function initNeonPulse() {
    // Apply pulse border animation to key interactive elements
    document.querySelectorAll('.btn-modal, .btn-race').forEach(function(btn) {
      btn.classList.add('neon-pulse');
    });
  }

  /* ============================================================
     INIT ALL
     ============================================================ */
  function init() {
    initScrollProgressBar();
    initCyberpunkToggle();
    initScrollReveal();
    initTiltEffect();
    applyTiltToCards();
    initParallax();
    initTextReveal();
    initNeonPulse();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
