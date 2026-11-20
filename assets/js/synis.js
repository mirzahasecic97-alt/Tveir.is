/* ==========================================================================
   Tveir.is: sýnishornin undir hero. Lítil myndbönd renna til hægri.
   Hvert myndband hleðst og spilast bara meðan það sést, annars bíður það.
   Stílar: assets/css/samraemi.css (.synis)
   ========================================================================== */
(function () {
  'use strict';
  var vids = document.querySelectorAll('.synis__vid');
  if (!vids.length) return;
  /* Lógóin undir renna á sama hraða og myndböndin: sami fjöldi punkta á
     sekúndu, þó strimlarnir séu misbreiðir */
  function samaHrada() {
    var braut = document.querySelector('.synis__braut');
    var logo = document.querySelector('.trust--undir .marquee__track');
    if (!braut || !logo) return;
    var tBraut = parseFloat(getComputedStyle(braut).animationDuration) || 47;
    var bBraut = braut.scrollWidth / 2, bLogo = logo.scrollWidth / 2;
    if (!bBraut || !bLogo) return;
    logo.style.setProperty('--logo-timi', (tBraut * bLogo / bBraut).toFixed(2) + 's');
  }
  samaHrada();
  window.addEventListener('load', samaHrada);
  window.addEventListener('resize', function () { clearTimeout(samaHrada.t); samaHrada.t = setTimeout(samaHrada, 200); });
  var kyrrt = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hlada(v) { if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.preload = 'auto'; } }
  if (!('IntersectionObserver' in window)) { vids.forEach(function (v) { hlada(v); if (!kyrrt) v.play().catch(function () {}); }); return; }
  var vakt = new IntersectionObserver(function (atr) {
    atr.forEach(function (a) {
      var v = a.target;
      if (a.isIntersecting) { hlada(v); if (!kyrrt) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
      else if (!v.paused) v.pause();
    });
  }, { rootMargin: '0px 1400px', threshold: 0.01 });  /* byrjar að hlaðast vel áður en myndbandið rennur inn */
  vids.forEach(function (v) { vakt.observe(v); });
  /* Flipinn falinn: allt stoppar */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) vids.forEach(function (v) { if (!v.paused) v.pause(); });
  });
})();
