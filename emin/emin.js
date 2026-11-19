/* Emin Kadri: hamborgarinn í síma og ártalið í fætinum */
(function () {
  'use strict';
  var h = document.getElementById('haus');
  var b = h && h.querySelector('.haus__hamborgari');
  if (b) {
    b.addEventListener('click', function () {
      var opid = h.classList.toggle('er-opin');
      b.setAttribute('aria-expanded', String(opid));
    });
    h.querySelectorAll('.haus__tenglar a').forEach(function (a) {
      a.addEventListener('click', function () { h.classList.remove('er-opin'); b.setAttribute('aria-expanded', 'false'); });
    });
  }
  var ar = document.querySelector('[data-ar]');
  if (ar) ar.textContent = new Date().getFullYear();
})();
