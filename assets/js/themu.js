/* ==========================================================================
   Tveir.is: þemu
   Hleðst efst í <head>, svo rétt þema sé komið áður en síðan birtist.

   Nýtt þema: bættu því í THEMU hér, og stílunum í assets/css/themu.css
   undir html[data-thema="nafn"].

   Þema velst svona, fyrsta sem passar gildir:
     1. ?thema=nafn í slóðinni (til að prófa og senda hlekk)
     2. það sem gesturinn valdi síðast í þemavalinu
     3. DAGSKRA: þema sem kemur sjálft á ákveðnum dögum
     4. SJALFGEFID
   ========================================================================== */
(function () {
  'use strict';

  var THEMU = {
    venjulegt:  { heiti: 'Venjulegt', en: 'Classic' },
    naeturborg: { heiti: 'GTA', en: 'GTA', hetja: 'assets/img/themu/okkur-gta.jpg' }
  };
  var SJALFGEFID = 'naeturborg';

  /* Dæmi: { thema: 'naeturborg', fra: '2026-11-19', til: '2026-12-03' } */
  var DAGSKRA = [];

  /* Á að sýna þemavalið neðst í horninu? */
  var SYNA_VAL = true;

  var html = document.documentElement;
  var val = null;
  try {
    var p = new URLSearchParams(window.location.search).get('thema');
    if (p && THEMU[p]) {
      val = p;
      window.localStorage.setItem('tveir-thema', p);
    } else {
      var g = window.localStorage.getItem('tveir-thema');
      if (g && THEMU[g]) val = g;
    }
  } catch (e) { /* einkagluggi eða lokað geymslurými */ }

  if (!val) {
    var d = new Date();
    var dags = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    DAGSKRA.forEach(function (x) { if (THEMU[x.thema] && dags >= x.fra && dags <= x.til) val = x.thema; });
  }
  html.setAttribute('data-thema', val || SJALFGEFID);

  /* Þema getur haft sína eigin mynd í hero (hetja) */
  function setjaMynd(nafn) {
    var img = document.querySelector('.hero__bak');
    if (!img) return;
    if (!img.dataset.upphafleg) img.dataset.upphafleg = img.getAttribute('src');
    var ny = (THEMU[nafn] && THEMU[nafn].hetja) || img.dataset.upphafleg;
    if (img.getAttribute('src') !== ny) img.setAttribute('src', ny);
  }
  document.addEventListener('DOMContentLoaded', function () { setjaMynd(html.getAttribute('data-thema')); });

  function setja(nafn) {
    html.setAttribute('data-thema', nafn);
    setjaMynd(nafn);
    try { window.localStorage.setItem('tveir-thema', nafn); } catch (e) { /* skiptir ekki máli */ }
    document.querySelectorAll('.themaval button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.thema === nafn));
    });
    if (window.ScrollTrigger) setTimeout(function () { window.ScrollTrigger.refresh(); }, 50);
  }

  if (!SYNA_VAL) return;
  document.addEventListener('DOMContentLoaded', function () {
    var enska = function () {
      var b = document.querySelector('.langsw__btn[data-lang="en"]');
      return !!(b && b.getAttribute('aria-pressed') === 'true');
    };
    var box = document.createElement('div');
    box.className = 'themaval';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Þema');
    var merki = document.createElement('span');
    merki.className = 'themaval__merki';
    merki.textContent = 'Þema';
    box.appendChild(merki);
    Object.keys(THEMU).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.thema = k;
      b.textContent = THEMU[k].heiti;
      b.setAttribute('aria-pressed', String(html.getAttribute('data-thema') === k));
      b.addEventListener('click', function () { setja(k); });
      box.appendChild(b);
    });
    document.body.appendChild(box);
    /* Fylgir tungumálinu þegar ýtt er á IS/EN */
    document.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('.langsw__btn')) return;
      setTimeout(function () {
        var en = enska();
        merki.textContent = en ? 'Theme' : 'Þema';
        box.querySelectorAll('button').forEach(function (b) {
          b.textContent = en ? THEMU[b.dataset.thema].en : THEMU[b.dataset.thema].heiti;
        });
      }, 0);
    });
  });
})();
