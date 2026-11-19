/* Vignir Vatnar: hamborgarinn í síma og ártalið í fætinum */
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

/* Bara eitt myndband spilar í einu */
document.querySelectorAll('.efni__skjar video').forEach(function (v, i, allt) {
  v.addEventListener('play', function () { allt.forEach(function (o) { if (o !== v) o.pause(); }); });
});

/* Í beinni: slóðin í data-straumur verður að spilara (Twitch, YouTube eða Kick) */
(function () {
  'use strict';
  var skjar = document.querySelector('.beint__skjar');
  if (!skjar) return;
  var slod = (skjar.getAttribute('data-straumur') || '').trim();
  if (!slod) return;
  var u; try { u = new URL(slod); } catch (e) { return; }
  var h = u.hostname.replace(/^www\.|^m\./, ''), inn = null;
  if (h === 'twitch.tv') {
    var nafn = u.pathname.split('/').filter(Boolean)[0];
    if (nafn) inn = 'https://player.twitch.tv/?channel=' + encodeURIComponent(nafn) + '&parent=' + encodeURIComponent(location.hostname) + '&muted=true';
  } else if (h === 'youtube.com' || h === 'youtu.be') {
    var p = u.pathname.split('/').filter(Boolean), id = u.searchParams.get('v');
    if (!id && h === 'youtu.be') id = p[0];
    if (!id && (p[0] === 'live' || p[0] === 'embed' || p[0] === 'shorts')) id = p[1];
    if (id) inn = 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1&mute=1&rel=0';
    else if (u.searchParams.get('channel')) inn = 'https://www.youtube.com/embed/live_stream?channel=' + encodeURIComponent(u.searchParams.get('channel')) + '&autoplay=1&mute=1';
  } else if (h === 'kick.com') {
    var k = u.pathname.split('/').filter(Boolean)[0];
    if (k) inn = 'https://player.kick.com/' + encodeURIComponent(k) + '?muted=true&autoplay=true';
  }
  if (!inn) return;
  var f = document.createElement('iframe');
  f.src = inn; f.title = 'Útsending Vignis Vatnar'; f.loading = 'lazy';
  f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  f.allowFullscreen = true;
  var tomt = skjar.querySelector('.beint__tomt'); if (tomt) tomt.remove();
  skjar.classList.add('er-i-beinni'); skjar.appendChild(f);
})();

/* Sleðinn: örvarnar færa um nokkur myndbönd í einu */
(function () {
  var listi = document.querySelector('.efni__listi');
  var orvar = document.querySelectorAll('.efni__or');
  if (!listi || !orvar.length) return;
  function stada() {
    var max = listi.scrollWidth - listi.clientWidth - 2;
    orvar[0].disabled = listi.scrollLeft <= 2;
    orvar[1].disabled = listi.scrollLeft >= max;
  }
  orvar.forEach(function (b) {
    b.addEventListener('click', function () {
      var kort = listi.querySelector('.efni');
      var skref = kort ? kort.getBoundingClientRect().width + 16 : 280;
      var fjoldi = Math.max(1, Math.floor(listi.clientWidth / skref) - 1);
      listi.scrollBy({ left: +b.getAttribute('data-att') * skref * fjoldi, behavior: 'smooth' });
    });
  });
  listi.addEventListener('scroll', stada, { passive: true });
  window.addEventListener('resize', stada);
  stada();
})();
