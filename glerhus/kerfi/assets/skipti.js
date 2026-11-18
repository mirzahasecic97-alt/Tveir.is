/* ==========================================================================
   Glerhúsið: síðuskipti í kerfinu. Smellt á flipa í valmyndinni og efnið
   rennur til hliðar: flipi til hægri kemur inn frá hægri, flipi til
   vinstri frá vinstri. Hausinn stendur kyrr.
   Hlaðið í <head> (ekki defer) svo nýja síðan byrji úti á hlið og blikki ekki.
   ========================================================================== */
(function () {
  'use strict';
  var html = document.documentElement;
  var KYRRT = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LYKILL = 'glerhusid-skipti';

  /* 1. Ný síða: kom hún úr flipaskiptum? Þá byrjar efnið úti á hlið */
  var att = null;
  try { att = sessionStorage.getItem(LYKILL); sessionStorage.removeItem(LYKILL); } catch (e) { /* lokaður gluggi */ }
  if (att !== 'fram' && att !== 'aftur') att = null;
  if (att && !KYRRT) html.classList.add('gh-skipti-' + att);

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
      }, 600);
    }
    /* Bíðum eftir að kerfið teikni efnið, en aldrei lengur en 700 ms */
    var eftirlit = null;
    if (innihald && !innihald.children.length && window.MutationObserver) {
      eftirlit = new MutationObserver(function () { if (innihald.children.length) inn(); });
      eftirlit.observe(innihald, { childList: true });
      setTimeout(inn, 700);
    } else {
      inn();
    }
  }

  /* 2. Smellt á flipa: gamla efnið rennur út og svo er farið á nýju síðuna */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('.phead__nav a[href]');
    if (!a || a.target === '_blank' || a.getAttribute('aria-current') === 'page') return;
    var url;
    try { url = new URL(a.href, location.href); } catch (villa) { return; }
    if (url.origin !== location.origin) return;
    var flipar = Array.prototype.slice.call(a.closest('.phead__nav').querySelectorAll('a[href]'));
    var nu = flipar.findIndex(function (x) { return x.getAttribute('aria-current') === 'page'; });
    var nyr = flipar.indexOf(a);
    var stefna = nu === -1 || nyr > nu ? 'fram' : 'aftur';
    try { sessionStorage.setItem(LYKILL, stefna); } catch (villa) { /* skiptir ekki máli */ }
    if (KYRRT) return;
    e.preventDefault();
    html.classList.add('gh-skipti-ut', 'gh-skipti-ut-' + stefna);
    setTimeout(function () { location.href = a.href; }, 170);
  });

  /* Til baka í vafranum úr flýtiminni: hreinsa útstöðuna */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) html.classList.remove('gh-skipti-ut', 'gh-skipti-ut-fram', 'gh-skipti-ut-aftur');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renna);
  else renna();
})();
