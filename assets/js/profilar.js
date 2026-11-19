/* ==========================================================================
   Tveir.is: Personal branding prófílarnir á forsíðunni.
   Myndbandið spilast þegar músin fer yfir (eða prófíllinn sést í síma).
   ========================================================================== */
(function () {
  'use strict';
  var kort = document.querySelectorAll('.profill');
  if (!kort.length) return;
  var snerting = window.matchMedia('(hover: none)').matches;
  function spila(k) {
    var v = k.querySelector('.profill__vid'); if (!v) return;
    if (!v.src && v.dataset.src) v.src = v.dataset.src;
    var p = v.play(); if (p && p.catch) p.catch(function () {});
    k.classList.add('er-ad-spila');
  }
  function stoppa(k) {
    var v = k.querySelector('.profill__vid'); if (v && !v.paused) v.pause();
    k.classList.remove('er-ad-spila');
  }
  if (snerting && 'IntersectionObserver' in window) {
    var vakt = new IntersectionObserver(function (a) {
      a.forEach(function (x) { if (x.intersectionRatio > 0.6) spila(x.target); else stoppa(x.target); });
    }, { threshold: [0, 0.6] });
    kort.forEach(function (k) { vakt.observe(k); });
  } else {
    kort.forEach(function (k) {
      k.addEventListener('mouseenter', function () { spila(k); });
      k.addEventListener('mouseleave', function () { stoppa(k); });
      k.addEventListener('focus', function () { spila(k); });
      k.addEventListener('blur', function () { stoppa(k); });
    });
  }
})();
