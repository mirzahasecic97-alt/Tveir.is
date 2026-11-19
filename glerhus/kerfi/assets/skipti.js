/* ==========================================================================
   Glerhúsið: síðuskipti í kerfinu án þess að endurhlaða síðuna.

   Smellt á flipa: næsta síða er sótt í bakgrunni á meðan efnið rennur út,
   svo er bara efninu (#main) skipt út og síðueining hennar keyrð. Hausinn,
   bakgrunnurinn og innskráningin standa kyrr allan tímann. Flipi til
   hægri kemur inn frá hægri, flipi til vinstri frá vinstri.

   Til baka í vafranum hleður síðunni venjulega. Klikki eitthvað er farið
   á síðuna á venjulegan hátt, svo kerfið virkar alltaf.

   Hlaðið í <head> (ekki defer).
   ========================================================================== */
(function () {
  'use strict';
  var html = document.documentElement;
  var KYRRT = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LYKILL = 'glerhusid-skipti';
  var HAUS = 'glerhusid-skipti-haus';
  var STUDD = !!(window.fetch && window.DOMParser && history.pushState);
  var umferd = 0;

  /* Tímar sem síðurnar setja af stað (t.d. pósthólfið sem les aftur á
     mínútu fresti) eru stöðvaðir þegar skipt er um síðu */
  var timar = new Set();
  var upprSetInterval = window.setInterval.bind(window);
  var upprClearInterval = window.clearInterval.bind(window);
  window.setInterval = function () { var id = upprSetInterval.apply(null, arguments); timar.add(id); return id; };
  window.clearInterval = function (id) { timar.delete(id); return upprClearInterval(id); };

  /* ---------- Hausinn þegar síðan er hlaðin venjulega (t.d. fyrst) ---------- */
  var att = null, geymdurHaus = null;
  try {
    att = sessionStorage.getItem(LYKILL); sessionStorage.removeItem(LYKILL);
    geymdurHaus = sessionStorage.getItem(HAUS); sessionStorage.removeItem(HAUS);
  } catch (e) { /* lokaður gluggi */ }
  if (att !== 'fram' && att !== 'aftur') att = null;
  if (att && !KYRRT) html.classList.add('gh-skipti-' + att);

  function merkjaFlipa(haus) {
    var nuna = location.pathname.split('/').pop() || 'stjornbord.html';
    var samskipti = nuna === 'samskipti.html' || nuna === 'fyrirspurnir.html';
    haus.querySelectorAll('[aria-current]').forEach(function (x) { x.removeAttribute('aria-current'); });
    haus.querySelectorAll('.phead__nav a[href], a.phead__stillingar').forEach(function (a) {
      if (a.classList.contains('phead__undir')) return;
      var h = a.getAttribute('href');
      if (h === nuna || (samskipti && a.classList.contains('phead__hopur-hn'))) a.setAttribute('aria-current', 'page');
    });
  }
  if (geymdurHaus && window.MutationObserver) {
    var setja = function (h) { if (!h.firstChild) { h.innerHTML = geymdurHaus; merkjaFlipa(h); } };
    var fyrri = document.getElementById('phead');
    if (fyrri) setja(fyrri);
    else {
      var vakt = new MutationObserver(function () { var h = document.getElementById('phead'); if (h) { vakt.disconnect(); setja(h); } });
      vakt.observe(html, { childList: true, subtree: true });
      document.addEventListener('DOMContentLoaded', function () { vakt.disconnect(); });
    }
  }

  /* ---------- Innrennslið: bíður eftir að síðan teikni efnið ---------- */
  function rennaInn(stefna) {
    var main = document.getElementById('main');
    if (!stefna || KYRRT || !main) { html.classList.remove('gh-skipti-fram', 'gh-skipti-aftur'); return; }
    var innihald = document.getElementById('innihald') || main;
    var buid = false, eftirlit = null;
    function inn() {
      if (buid) return; buid = true;
      if (eftirlit) eftirlit.disconnect();
      void main.offsetWidth;
      html.classList.add('gh-skipti-keyrir');
      html.classList.remove('gh-skipti-' + stefna);
      setTimeout(function () {
        html.classList.remove('gh-skipti-keyrir');
        if (main.getAnimations) main.getAnimations().forEach(function (h) { try { h.finish(); } catch (v) { /* ekkert */ } });
      }, 700);
    }
    if (innihald && !innihald.children.length && window.MutationObserver) {
      eftirlit = new MutationObserver(function () { if (innihald.children.length) inn(); });
      eftirlit.observe(innihald, { childList: true });
      setTimeout(inn, 450);
    } else inn();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { rennaInn(att); });
  else rennaInn(att);

  /* ---------- Skiptin sjálf ---------- */
  var bida = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function venjulega(slod, stefna) {
    try {
      sessionStorage.setItem(LYKILL, stefna);
      var haus = document.getElementById('phead');
      if (haus && haus.innerHTML.length < 60000) sessionStorage.setItem(HAUS, haus.innerHTML);
    } catch (villa) { /* skiptir ekki máli */ }
    location.href = slod;
  }

  async function skipta(slod, stefna) {
    var min = ++umferd;
    var main = document.getElementById('main');
    if (!KYRRT) html.classList.add('gh-skipti-ut', 'gh-skipti-ut-' + stefna);
    var svar;
    try {
      var [texti] = await Promise.all([
        fetch(slod, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }),
        bida(KYRRT ? 0 : 260)
      ]);
      svar = new DOMParser().parseFromString(texti, 'text/html');
    } catch (villa) { venjulega(slod, stefna); return; }
    if (min !== umferd) return;
    var nyrMain = svar.getElementById('main');
    var eining = svar.querySelector('script[type="module"][src]');
    if (!nyrMain || !main) { venjulega(slod, stefna); return; }

    /* Gamla síðan hreinsuð: tímar, opnir gluggar */
    timar.forEach(function (id) { upprClearInterval(id); }); timar.clear();
    document.querySelectorAll('dialog').forEach(function (d) { try { d.close(); } catch (v) { /* ekkert */ } d.remove(); });

    /* Nýja síðan inn: slóð fyrst, svo síðan lesi rétta slóð (t.d. ?f=) */
    history.pushState({ glerhus: 1 }, '', slod);
    sidastaSlod = location.pathname + location.search;
    document.title = svar.title;
    document.body.className = svar.body.className;
    main.className = nyrMain.className;
    html.classList.remove('gh-skipti-ut', 'gh-skipti-ut-fram', 'gh-skipti-ut-aftur');
    if (!KYRRT) html.classList.add('gh-skipti-' + stefna);
    main.innerHTML = nyrMain.innerHTML;
    window.scrollTo(0, 0);
    var haus = document.getElementById('phead');
    if (haus) merkjaFlipa(haus);
    rennaInn(stefna);

    if (eining) {
      var src = new URL(eining.getAttribute('src'), new URL(slod, location.href)).href;
      try { await import(src + (src.indexOf('?') === -1 ? '?' : '&') + 'skipti=' + min); }
      catch (villa) { venjulega(slod, stefna); }
    }
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('.phead__nav a[href], a.phead__stillingar, a.phead__logo');
    if (!a || a.target === '_blank') return;
    var url;
    try { url = new URL(a.href, location.href); } catch (villa) { return; }
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) { e.preventDefault(); return; }
    var flipar = Array.prototype.slice.call(document.querySelectorAll('.phead__nav a[href]:not(.phead__undir), a.phead__stillingar'));
    var flipi = a.classList.contains('phead__undir') ? a.closest('.phead__hopur').querySelector('.phead__hopur-hn') : a;
    var nu = flipar.findIndex(function (x) { return x.getAttribute('aria-current') === 'page'; });
    var nyr = flipar.indexOf(flipi);
    var stefna = nu === -1 || nyr === -1 || nyr >= nu ? 'fram' : 'aftur';
    e.preventDefault();
    /* Hamborgaravalmyndin í síma lokast */
    var ph = document.getElementById('phead'); if (ph) ph.classList.remove('er-opin');
    if (STUDD) skipta(url.href, stefna); else venjulega(url.href, stefna);
  });

  /* Til baka og áfram: síðan hlaðin venjulega, alltaf rétt. Hopp innan
     síðunnar (t.d. #taskar) breytir bara slóðarenda og er látið í friði. */
  var sidastaSlod = location.pathname + location.search;
  window.addEventListener('popstate', function () {
    if (location.pathname + location.search === sidastaSlod) return;
    location.reload();
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) html.classList.remove('gh-skipti-ut', 'gh-skipti-ut-fram', 'gh-skipti-ut-aftur');
  });
})();
