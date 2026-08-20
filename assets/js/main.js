/* ==========================================================================
   Tveir.is — main.js
   Engin ytri bókasöfn. Allt keyrir eftir að DOM er tilbúinn.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Dropdown ("Hafa samband ▾") — smellur opnar, Esc og smellur utan loka
     ------------------------------------------------------------------ */
  function initDropdowns() {
    var dropdowns = Array.prototype.slice.call(document.querySelectorAll('.dropdown'));
    if (!dropdowns.length) return;

    function close(dd) {
      var toggle = dd.querySelector('.dropdown__toggle');
      var menu = dd.querySelector('.dropdown__menu');
      if (!toggle || !menu) return;
      toggle.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    }

    function closeAll(except) {
      dropdowns.forEach(function (dd) { if (dd !== except) close(dd); });
    }

    dropdowns.forEach(function (dd) {
      var toggle = dd.querySelector('.dropdown__toggle');
      var menu = dd.querySelector('.dropdown__menu');
      if (!toggle || !menu) return;

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = toggle.getAttribute('aria-expanded') === 'true';
        closeAll(dd);
        toggle.setAttribute('aria-expanded', String(!isOpen));
        menu.hidden = isOpen;
      });

      menu.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    document.addEventListener('click', function () { closeAll(null); });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      dropdowns.forEach(function (dd) {
        var toggle = dd.querySelector('.dropdown__toggle');
        if (toggle && toggle.getAttribute('aria-expanded') === 'true') {
          close(dd);
          toggle.focus();
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     Mobile valmynd
     ------------------------------------------------------------------ */
  function initMobileMenu() {
    var burger = document.querySelector('.burger');
    var menu = document.getElementById('mobile-menu');
    if (!burger || !menu) return;

    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!isOpen));
      menu.hidden = isOpen;
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        burger.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
        burger.focus();
      }
    });
  }

  /* ------------------------------------------------------------------
     Lógóstrimill — tvöfaldar innihaldið svo lykkjan sé samfelld
     ------------------------------------------------------------------ */
  function initMarquee() {
    document.querySelectorAll('.marquee__track').forEach(function (track) {
      var group = track.querySelector('.marquee__group');
      if (!group || track.children.length > 1) return;
      var clone = group.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }

  /* ------------------------------------------------------------------
     Myndaslott — fela <video> sem tekst ekki að hlaða (líkt og img onerror)
     ------------------------------------------------------------------ */
  function initSlots() {
    document.querySelectorAll('.slot > video').forEach(function (video) {
      video.addEventListener('error', function () { video.classList.add('is-missing'); }, true);
      var source = video.querySelector('source');
      if (source) {
        source.addEventListener('error', function () { video.classList.add('is-missing'); });
      }
      // Sum vafrar kveikja ekki á error-atburði fyrir skrá sem er ekki til
      video.addEventListener('loadeddata', function () { video.classList.remove('is-missing'); });

      // autoplay-eigindin ein og sér bregst stundum. Við reynum bæði strax og
      // aftur við canplay — canplay getur nefnilega verið búið að gerast áður
      // en þessi kóði keyrir, og þá grípur hlustarinn einn ekkert.
      if (video.autoplay) {
        var nudge = function () {
          if (!video.paused) return;
          video.muted = true;
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
        };
        nudge();
        video.addEventListener('canplay', nudge);
        video.addEventListener('loadeddata', nudge);
      }
    });
  }

  /* ------------------------------------------------------------------
     Endalaus verkefnaröð — þrjú eintök af spjöldunum hlið við hlið og
     skrunið stokkið um eitt eintak þegar notandinn nálgast brúnina.
     Stökkið er ósýnilegt því eintökin eru eins.
     ------------------------------------------------------------------ */
  function initLoopRail() {
    var rail = document.querySelector('.hscroll');
    if (!rail) return;

    var originals = Array.prototype.slice.call(rail.children);
    if (originals.length < 2) return;

    function afrit() {
      return originals.map(function (node) {
        var c = node.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        // afritin mega ekki grípa lyklaborðið
        if (c.hasAttribute('href')) c.setAttribute('tabindex', '-1');
        c.querySelectorAll('a, button').forEach(function (el) { el.setAttribute('tabindex', '-1'); });
        return c;
      });
    }

    afrit().forEach(function (n) { rail.appendChild(n); });
    var fremst = afrit();
    fremst.reverse().forEach(function (n) { rail.insertBefore(n, rail.firstChild); });

    var breidd = 0;
    function maelaBreidd() {
      // breidd eins eintaks = heildarbreidd deilt með þremur
      breidd = rail.scrollWidth / 3;
    }

    function midja() {
      maelaBreidd();
      rail.style.scrollBehavior = 'auto';
      rail.scrollLeft = breidd;
    }

    // Leiðréttingin gerist samstundis, ekki í requestAnimationFrame:
    // rAF er kæft í bakgrunnsflipum og þá myndi lykkjan hætta að ganga.
    rail.addEventListener('scroll', function () {
      if (!breidd) maelaBreidd();
      if (!breidd) return;
      var x = rail.scrollLeft;
      if (x < breidd * 0.5) {
        rail.style.scrollBehavior = 'auto';
        rail.scrollLeft = x + breidd;
      } else if (x > breidd * 1.5) {
        rail.style.scrollBehavior = 'auto';
        rail.scrollLeft = x - breidd;
      }
    }, { passive: true });

    window.addEventListener('resize', midja);
    // myndir breyta breiddinni þegar þær hlaðast
    window.addEventListener('load', midja);
    midja();
  }

  /* ------------------------------------------------------------------
     Myndbönd á verkefnaspjöldum — sækjast fyrst þegar spjaldið sést,
     svo forsíðan dragi ekki 14 MB niður við fyrstu heimsókn.
     Kyrrmyndin liggur undir og sést þar til myndbandið byrjar.
     ------------------------------------------------------------------ */
  function initLazyVideos() {
    var videos = Array.prototype.slice.call(document.querySelectorAll('video[data-src]'));
    if (!videos.length) return;

    // Virðum val notandans um minni hreyfingu — þá stendur kyrrmyndin ein
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    function tryPlay(video) {
      video.muted = true;          // án þessa hafnar vafrinn sjálfvirkri spilun
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }

    function start(video) {
      if (!video.getAttribute('src')) {
        video.setAttribute('src', video.getAttribute('data-src'));
        // Fyrsta play() gerist áður en skráin er tilbúin og skilar sér ekki,
        // svo við reynum aftur um leið og hún er spilanleg.
        video.addEventListener('canplay', function () { tryPlay(video); }, { once: true });
      }
      tryPlay(video);
    }

    if (!('IntersectionObserver' in window)) {
      videos.forEach(start);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) start(entry.target);
        else if (entry.target.getAttribute('src')) entry.target.pause();
      });
    }, { rootMargin: '150px', threshold: 0.25 });

    videos.forEach(function (video) { io.observe(video); });
  }

  /* ------------------------------------------------------------------
     Flokkasía á verkefnasíðu
     ------------------------------------------------------------------ */
  function initFilters() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-filter]'));
    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-category]'));
    var empty = document.querySelector('.no-results');
    if (!buttons.length || !cards.length) return;

    function apply(value) {
      var shown = 0;
      cards.forEach(function (card) {
        // data-category getur haldið fleiri en einum flokki, bilaðskildum
        var own = (card.getAttribute('data-category') || '').split(/\s+/);
        var match = value === 'allt' || own.indexOf(value) !== -1;
        card.hidden = !match;
        if (match) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        apply(btn.getAttribute('data-filter'));
      });
    });
  }

  /* ------------------------------------------------------------------
     Tögg í formum — velja/afvelja, safnast í falið input
     ------------------------------------------------------------------ */
  function initChips() {
    document.querySelectorAll('[data-chips]').forEach(function (group) {
      var hidden = document.getElementById(group.getAttribute('data-chips'));
      var chips = Array.prototype.slice.call(group.querySelectorAll('.chip'));

      function sync() {
        if (!hidden) return;
        hidden.value = chips
          .filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; })
          .map(function (c) { return c.textContent.trim(); })
          .join(', ');
      }

      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          var on = chip.getAttribute('aria-pressed') === 'true';
          chip.setAttribute('aria-pressed', String(!on));
          sync();
        });
      });

      sync();
    });
  }

  /* ------------------------------------------------------------------
     Form — AJAX POST á Formspree, staða birt í .form-status
     ------------------------------------------------------------------ */
  function initForms() {
    document.querySelectorAll('form[data-ajax]').forEach(function (form) {
      var status = form.querySelector('.form-status');
      var submit = form.querySelector('[type="submit"]');
      var originalLabel = submit ? submit.textContent : '';

      function show(kind, message) {
        if (!status) return;
        status.hidden = false;
        status.className = 'form-status form-status--' + kind;
        status.textContent = message;
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Honeypot — vélmenni fylla þennan reit út
        var hp = form.querySelector('.hp input');
        if (hp && hp.value) return;

        // Innbyggð validation (formið er novalidate svo vafrinn trufli ekki AJAX)
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        var endpoint = form.getAttribute('action') || '';
        if (!endpoint || endpoint.indexOf('XXXX') !== -1) {
          show('err', 'Formið er ekki tengt ennþá. Sendu okkur línu á tveir@tveir.is á meðan.');
          return;
        }

        if (submit) { submit.disabled = true; submit.textContent = 'Sendi…'; }
        if (status) status.hidden = true;

        fetch(endpoint, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' }
        })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            form.reset();
            form.querySelectorAll('.chip[aria-pressed="true"]').forEach(function (chip) {
              chip.setAttribute('aria-pressed', 'false');
            });
            form.querySelectorAll('[data-chips]').forEach(function (group) {
              var hidden = document.getElementById(group.getAttribute('data-chips'));
              if (hidden) hidden.value = '';
            });
            show('ok', 'Takk fyrir! Við höfum samband innan sólarhrings.');
          })
          .catch(function () {
            show('err', 'Eitthvað fór úrskeiðis. Prófaðu aftur eða sendu okkur póst á tveir@tveir.is.');
          })
          .then(function () {
            if (submit) { submit.disabled = false; submit.textContent = originalLabel; }
          });
      });
    });
  }

  /* ------------------------------------------------------------------
     Ártal í fæti
     ------------------------------------------------------------------ */
  function initYear() {
    var year = new Date().getFullYear();
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = year; });
  }

  function init() {
    initDropdowns();
    initMobileMenu();
    initMarquee();
    initSlots();
    initLoopRail();
    initLazyVideos();
    initFilters();
    initChips();
    initForms();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
