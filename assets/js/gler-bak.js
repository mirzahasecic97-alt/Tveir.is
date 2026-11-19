/* ==========================================================================
   Tveir.is: glerplötur í bakgrunninum, sama og á Glerhúsinu.
   Býr til .gb fremst í <body>. Ljósið undir kemur frá glans.css
   (body::before og ::after), plöturnar liggja ofan á því.
   Stílar: assets/css/samraemi.css
   ========================================================================== */
(function () {
  'use strict';
  if (document.querySelector('.gb')) return;
  var gb = document.createElement('div');
  gb.className = 'gb';
  gb.setAttribute('aria-hidden', 'true');
  gb.innerHTML =
    '<div class="gb__plata gb__plata--1"></div>' +
    '<div class="gb__plata gb__plata--2"></div>' +
    '<div class="gb__plata gb__plata--3"></div>' +
    '<div class="gb__plata gb__plata--4"></div>' +
    '<div class="gb__glampi"></div>';
  var setja = function () { document.body.insertBefore(gb, document.body.firstChild); };
  if (document.body) setja(); else document.addEventListener('DOMContentLoaded', setja);

  /* Hreyfingin bíður meðan skrunað er, svo skrunið fái allan kraftinn */
  var html = document.documentElement, bid;
  window.addEventListener('scroll', function () {
    if (!bid) html.classList.add('er-ad-skruna');
    clearTimeout(bid);
    bid = setTimeout(function () { html.classList.remove('er-ad-skruna'); bid = null; }, 180);
  }, { passive: true });
})();
