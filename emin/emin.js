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

/* Samstarfsformið: sent án þess að fara af síðunni */
(function () {
  'use strict';
  var f = document.querySelector('.samstorf__form');
  if (!f || !window.fetch) return;
  var stada = f.querySelector('.samstorf__stada'), hn = f.querySelector('button[type="submit"]');
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    hn.disabled = true; hn.textContent = 'Sendi';
    fetch(f.action, { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); })
      .then(function () {
        f.reset(); stada.hidden = false; stada.classList.remove('er-villa');
        stada.textContent = 'Takk! Við heyrum í þér fljótlega.';
        hn.textContent = 'Sent';
      })
      .catch(function () {
        stada.hidden = false; stada.classList.add('er-villa');
        stada.textContent = 'Það tókst ekki að senda. Prófaðu aftur eða sendu póst á tveir@tveir.is.';
        hn.disabled = false; hn.textContent = 'Senda';
      });
  });
  /* Samfélagsmiðlar sem eru ekki komnir með slóð sjást ekki */
  document.querySelectorAll('.smidill[href="#"]').forEach(function (a) { a.setAttribute('aria-disabled', 'true'); a.addEventListener('click', function (ev) { ev.preventDefault(); }); });
})();

/* Hero myndbandið: 1080p á tölvu, 720p í síma */
(function () {
  var v = document.querySelector('.hetja__vid');
  if (!v) return;
  var litid = window.matchMedia('(max-width: 820px)').matches || (navigator.connection && navigator.connection.saveData);
  v.src = litid ? v.dataset.litid : v.dataset.stor;
  var p = v.play(); if (p && p.catch) p.catch(function () {});
})();

/* Merkið á Inside Training hverfur þegar spilað er */
document.querySelectorAll('.efni__skjar video').forEach(function (v) {
  v.addEventListener('play', function () { v.parentNode.classList.add('er-ad-spila'); });
  v.addEventListener('pause', function () { v.parentNode.classList.remove('er-ad-spila'); });
});
