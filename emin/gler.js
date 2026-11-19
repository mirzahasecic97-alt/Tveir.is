/* Emin Kadri: glerplötur í bakgrunninum (grátt, mjúkt) */
(function () {
  'use strict';
  var gb = document.createElement('div');
  gb.className = 'gb'; gb.setAttribute('aria-hidden', 'true');
  gb.innerHTML = '<div class="gb__ljos"><i></i><i></i><i></i></div>' +
    '<div class="gb__plata gb__plata--1"></div><div class="gb__plata gb__plata--2"></div><div class="gb__plata gb__plata--3"></div>';
  var setja = function () { document.body.insertBefore(gb, document.body.firstChild); };
  if (document.body) setja(); else document.addEventListener('DOMContentLoaded', setja);
})();
