/* ==========================================================================
   Glerhúsið: síðuskipti í kerfinu. Smellt á flipa í valmyndinni og efnið
   rennur til hliðar: flipi til hægri kemur inn frá hægri, flipi til
   vinstri frá vinstri. Hausinn stendur alveg kyrr.

   Hausinn er teiknaður með JavaScript á hverri síðu og var því tómur í
   smástund eftir skipti. Því er hann geymdur við smellinn og settur strax
   inn á nýju síðunni um leið og vafrinn les hann, áður en neitt sést.
   Síðan teiknar kerfið hann sjálft ofan í, eins.

   Hlaðið í <head> (ekki defer) svo þetta gerist fyrir fyrstu teikningu.
   ========================================================================== */
(function () {
  'use strict';
  var html = document.documentElement;
  var KYRRT = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LYKILL = 'glerhusid-skipti';
  var HAUS = 'glerhusid-skipti-haus';
  var nuna = location.pathname.split('/').pop() || 'stjornbord.html';

  /* 1. Ný síða: kom hún úr flipaskiptum? Þá byrjar efnið úti á hlið */
  var att = null, geymdurHaus = null;
  try {
    att = sessionStorage.getItem(LYKILL); sessionStorage.removeItem(LYKILL);
    geymdurHaus = sessionStorage.getItem(HAUS); sessionStorage.removeItem(HAUS);
  } catch (e) { /* lokaður gluggi */ }
  if (att !== 'fram' && att !== 'aftur') att = null;
  if (att && !KYRRT) html.classList.add('gh-skipti-' + att);

  /* Hausinn inn um leið og vafrinn les <header id="phead">, með rétta
     flipann merktan. Hnapparnir virka ekki fyrr en kerfið teiknar hann
     sjálft, en það gerist innan sekúndubrots. */
  function setjaHaus(haus) {
    if (!geymdurHaus || haus.firstChild) return;
    haus.innerHTML = geymdurHaus;
    haus.querySelectorAll('[aria-current]').forEach(function (x) { x.removeAttribute('aria-current'); });
    var samskipti = nuna === 'samskipti.html' || nuna === 'fyrirspurnir.html';
    haus.querySelectorAll('.phead__nav a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (a.classList.contains('phead__undir')) return;
      if (h === nuna || (samskipti && a.classList.contains('phead__hopur-hn'))) a.setAttribute('aria-current', 'page');
    });
    var st = haus.querySelector('a[href="stillingar.html"]');
    if (st && nuna === 'stillingar.html') st.setAttribute('aria-current', 'page');
  }
  if (geymdurHaus && window.MutationObserver) {
    var fyrri = document.getElementById('phead');
    if (fyrri) setjaHaus(fyrri);
    else {
      var vakt = new MutationObserver(function () {
        var h = document.getElementById('phead');
        if (h) { vakt.disconnect(); setjaHaus(h); }
      });
      vakt.observe(html, { childList: true, subtree: true });
      document.addEventListener('DOMContentLoaded', function () { vakt.disconnect(); });
    }
  }

  function renna() {
    if (!att || KYRRT) return;
    var main = document.getElementById('main');
    var innihald = document.getElementById('innihald') || main;
    var buid = false;
    function inn() {
      if (buid) return; buid = true;
      if (eftirlit) eftirlit.disconnect();
      /* Upphafsstaðan reiknuð fyrst (offsetWidth), svo rennur efnið inn.
         Ekki requestAnimationFrame: í falnum flipa kæmi hann aldrei og efnið sæist ekki. */
      void main.offsetWidth;
      html.classList.add('gh-skipti-keyrir');
      html.classList.remove('gh-skipti-' + att);
      setTimeout(function () {
        html.classList.remove('gh-skipti-keyrir');
        /* Öryggisnet: ef hreyfingin stóð kyrr (t.d. falinn flipi) er hún kláruð svo efnið sjáist */
        if (main.getAnimations) main.getAnimations().forEach(function (h) { try { h.finish(); } catch (v) { /* ekkert */ } });
      }, 700);
    }
    /* Bíðum eftir að kerfið teikni efnið, en aldrei lengur en 450 ms */
    var eftirlit = null;
    if (innihald && !innihald.children.length && window.MutationObserver) {
      eftirlit = new MutationObserver(function () { if (innihald.children.length) inn(); });
      eftirlit.observe(innihald, { childList: true });
      setTimeout(inn, 450);
    } else {
      inn();
    }
  }

  /* 2. Smellt á flipa: hausinn geymdur, gamla efnið byrjar að renna út og
     nýja síðan er sótt strax, á meðan. Vafrinn sýnir gömlu síðuna þar til
     sú nýja er tilbúin, svo það verður aldrei autt á milli. */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('.phead__nav a[href], a.phead__stillingar');
    if (!a || a.target === '_blank') return;
    var url;
    try { url = new URL(a.href, location.href); } catch (villa) { return; }
    if (url.origin !== location.origin || (url.pathname === location.pathname && !url.hash)) return;
    var flipar = Array.prototype.slice.call(document.querySelectorAll('.phead__nav a[href]:not(.phead__undir), a.phead__stillingar'));
    var undir = a.classList.contains('phead__undir') ? a.closest('.phead__hopur').querySelector('.phead__hopur-hn') : a;
    var nu = flipar.findIndex(function (x) { return x.getAttribute('aria-current') === 'page'; });
    var nyr = flipar.indexOf(undir);
    var stefna = nu === -1 || nyr >= nu ? 'fram' : 'aftur';
    try {
      sessionStorage.setItem(LYKILL, stefna);
      var haus = document.getElementById('phead');
      if (haus && haus.innerHTML.length < 60000) sessionStorage.setItem(HAUS, haus.innerHTML);
    } catch (villa) { /* skiptir ekki máli */ }
    if (KYRRT) return;
    e.preventDefault();
    html.classList.add('gh-skipti-ut', 'gh-skipti-ut-' + stefna);
    /* Ein mynd af útrennslinu, svo af stað: hleðslan og hreyfingin gerast samtímis */
    setTimeout(function () { location.href = a.href; }, 90);
  });

  /* Til baka í vafranum úr flýtiminni: hreinsa útstöðuna */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) html.classList.remove('gh-skipti-ut', 'gh-skipti-ut-fram', 'gh-skipti-ut-aftur');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renna);
  else renna();
})();
