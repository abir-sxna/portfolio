/* Portfolio interactions
   - scroll reveal (fade + rise + blur-in)
   - cursor spotlight with velocity-based motion blur
   - card focus: hovered card sharp, siblings dimmed and softened
   - light scroll motion blur
   All effects are skipped for reduced-motion users. */

(function () {
  'use strict';

  // Mark JS as running right away so CSS can hide .reveal items without a flash.
  document.documentElement.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  document.addEventListener('DOMContentLoaded', function () {
    initReveal();
    initFocusGroups();
    initNavHighlight();
    if (!reduceMotion) {
      initScrollBlur();
      if (finePointer) {
        initSpotlight();
        initCardGlow();
      }
    }
  });

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var siblings = el.parentElement ? el.parentElement.querySelectorAll(':scope > .reveal') : [];
        var index = Array.prototype.indexOf.call(siblings, el);
        el.style.transitionDelay = (Math.max(index, 0) * 80) + 'ms';
        el.classList.add('in');
        observer.unobserve(el);

        // Once revealed, hand the element back to its normal styles
        // so hover / focus transitions on cards are not delayed.
        el.addEventListener('transitionend', function done(e) {
          if (e.propertyName !== 'filter') return;
          el.removeEventListener('transitionend', done);
          el.style.transitionDelay = '';
          el.classList.remove('reveal', 'in');
        });
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- Cursor spotlight with motion blur ---------- */
  function initSpotlight() {
    var orb = document.querySelector('.spotlight');
    if (!orb) return;

    var tx = 0, ty = 0;          // target (pointer)
    var x = 0, y = 0;            // eased position
    var px = 0, py = 0;          // previous position
    var angle = 0;
    var running = false;
    var seen = false;

    function frame() {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;

      var vx = x - px;
      var vy = y - py;
      px = x; py = y;

      var speed = Math.hypot(vx, vy);
      if (speed > 0.2) angle = Math.atan2(vy, vx);

      var blur = Math.min(speed * 0.6, 14);
      var stretch = 1 + Math.min(speed / 40, 0.6);

      orb.style.transform =
        'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%) ' +
        'rotate(' + angle + 'rad) scale(' + stretch + ',' + (1 / Math.sqrt(stretch)) + ')';
      orb.style.filter = blur > 0.3 ? 'blur(' + blur.toFixed(1) + 'px)' : '';

      if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) {
        requestAnimationFrame(frame);
      } else {
        running = false;
        orb.style.filter = '';
      }
    }

    window.addEventListener('pointermove', function (e) {
      tx = e.clientX;
      ty = e.clientY;
      if (!seen) {
        seen = true;
        x = px = tx;
        y = py = ty;
        orb.classList.add('on');
      }
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', function () {
      orb.classList.remove('on');
      seen = false;
    });
  }

  /* ---------- Per-card highlight that follows the pointer ---------- */
  function initCardGlow() {
    document.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    });
  }

  /* ---------- Focus groups: sharpen one card, soften the rest ---------- */
  function initFocusGroups() {
    document.querySelectorAll('[data-focus-group]').forEach(function (group) {
      var cards = Array.prototype.slice.call(group.querySelectorAll('.card'));

      function focusOn(active) {
        group.classList.add('is-focusing');
        cards.forEach(function (c) { c.classList.toggle('is-active', c === active); });
      }
      function clear() {
        group.classList.remove('is-focusing');
        cards.forEach(function (c) { c.classList.remove('is-active'); });
      }

      cards.forEach(function (card) {
        if (finePointer) card.addEventListener('pointerenter', function () { focusOn(card); });
        card.addEventListener('focusin', function () { focusOn(card); });
      });

      group.addEventListener('pointerleave', clear);
      group.addEventListener('focusout', function (e) {
        if (!group.contains(e.relatedTarget)) clear();
      });
    });
  }

  /* ---------- Subtle motion blur while scrolling fast ---------- */
  function initScrollBlur() {
    var main = document.querySelector('main');
    if (!main) return;

    var lastY = window.scrollY;
    var current = 0;
    var raf = 0;

    function loop() {
      var y = window.scrollY;
      var velocity = Math.abs(y - lastY);
      lastY = y;

      var target = Math.min(velocity * 0.04, 1.6);   // max ~1.6px
      current += (target - current) * 0.25;
      main.style.filter = current > 0.15 ? 'blur(' + current.toFixed(2) + 'px)' : '';

      if (current > 0.15 || velocity > 0) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    }

    window.addEventListener('scroll', function () {
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
  }

  /* ---------- Highlight the current section in the nav ---------- */
  function initNavHighlight() {
    if (!('IntersectionObserver' in window)) return;
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-list a'));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = map[entry.target.id];
        if (!link || !entry.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    Object.keys(map).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }
})();
