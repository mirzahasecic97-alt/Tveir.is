/* ==========================================================================
   Tveir.is — glans
   Kaflar risa upp thegar skrunad er nidur a tha.
   Parast vid assets/css/glans.css. Takirdu badar skrarnar ut
   verdur sidan nakvaemlega eins og hun var adur.

   Hér er lesid beint ur stodu hvers hluta vid hvert skrun i stad thess ad
   treysta a IntersectionObserver. Hann skilar stundum of seint og tha stod
   heill kafli eftir osynilegur a skjanum.
   ========================================================================== */
(function () {
  'use strict';

  var hoegari = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (hoegari) return;

  /* Sett strax svo ekkert blikki adur en stilarnir na ad fela. */
  document.documentElement.className += ' gl-js';

  /* Thessi listi verdur ad vera eins og listinn i glans.css. */
  var VAL = '.section-title:not(.vinnulag__fyrirsogn), .leid, .cta, .trust h2';

  var eftir = [];
  var bidur = false;

  function syna(el) {
    el.className += ' gl-komid';
  }

  function skoda() {
    bidur = false;
    var mork = window.innerHeight * 0.92;
    var naest = [];
    for (var i = 0; i < eftir.length; i++) {
      var el = eftir[i];
      var kassi = el.getBoundingClientRect();
      /* Komid i ljos ef efsta brunin er ofan vid morkin og nedsta nedan vid toppinn. */
      if (kassi.top < mork && kassi.bottom > 0) { syna(el); }
      else { naest.push(el); }
    }
    eftir = naest;
    if (!eftir.length) {
      window.removeEventListener('scroll', bidja);
      window.removeEventListener('resize', bidja);
    }
  }

  function bidja() {
    if (bidur) return;
    bidur = true;
    window.requestAnimationFrame(skoda);
  }

  function byrja() {
    eftir = Array.prototype.slice.call(document.querySelectorAll(VAL));
    if (!eftir.length) { document.documentElement.className =
      document.documentElement.className.replace(' gl-js', ''); return; }

    /* Rodin innan hvers hops gefur litla tof svo their koma hver af odrum. */
    var teljari = {};
    eftir.forEach(function (el) {
      var lykill = el.parentNode ? (el.parentNode.className || 'rot') : 'rot';
      teljari[lykill] = (teljari[lykill] || 0) + 1;
      var n = Math.min(teljari[lykill] - 1, 5);
      el.style.transitionDelay = (n * 70) + 'ms';
    });

    window.addEventListener('scroll', bidja, { passive: true });
    window.addEventListener('resize', bidja);
    skoda();

    /* Oryggisnet: ef eitthvad situr enn falid eftir fimm sekundur
       er thad synt hvad sem lidur, svo enginn kafli hverfi. */
    window.setTimeout(function () {
      eftir.forEach(syna);
      eftir = [];
    }, 5000);
  }

  /* Siminn i vinnulagskaflanum. Hann byrjar hallandi og fjaer og rettir sig
     upp og faerist naer eftir thvi sem skrunid gengur i gegnum kaflann.
     Lesid er beint ur stodu brautarinnar, --fram fer a .simi sjalfan. */
  function simi() {
    var kafli = document.querySelector('.vinnulag');
    if (!kafli) return;
    var braut = kafli.querySelector('.vinnulag__braut');
    var taeki = kafli.querySelector('.simi');
    if (!braut || !taeki) return;

    var bidur2 = false;
    var sidast = -1;

    /* Transform er sett beint. Adur var thetta CSS breyta a simanum, en
       breytur erfast, svo oll 24 stykkin inni i simanum fengu stilinn
       sinn endurreiknadan i hverjum ramma. */
    function setja(p) {
      if (Math.abs(p - sidast) < 0.002) return;
      sidast = p;
      var q = 1 - p;
      taeki.style.transform =
        'rotateY(' + (-15 * q).toFixed(2) + 'deg) ' +
        'rotateX(' + (10 * q).toFixed(2) + 'deg) ' +
        'scale(' + (0.88 + 0.22 * p).toFixed(4) + ')';
    }

    /* Mælt einu sinni og aftur bara þegar síðan breytist, ekki í hverjum
       ramma. Það hélt símanum uppteknum við útlitsreikning meðan skrunað var. */
    var brautTopp = 0, svigrum = 0;
    function maela() {
      brautTopp = braut.getBoundingClientRect().top + window.pageYOffset;
      svigrum = braut.offsetHeight - window.innerHeight;
    }

    function reikna() {
      bidur2 = false;
      /* Enginn festiskrun, til daemis thegar JS naer ekki i gegn eda
         kaflinn er styttri en skjarinn. Tha situr siminn i endastodu. */
      if (svigrum <= 0 || kafli.classList.contains('engin-festing')) {
        setja(1);
        return;
      }
      var p = (window.pageYOffset - brautTopp) / svigrum;
      setja(p < 0 ? 0 : (p > 1 ? 1 : p));
    }

    function vid() {
      if (bidur2) return;
      bidur2 = true;
      window.requestAnimationFrame(reikna);
    }

    function endurmaela() { maela(); vid(); }

    window.addEventListener('scroll', vid, { passive: true });
    window.addEventListener('resize', endurmaela);
    window.addEventListener('load', endurmaela);
    if ('ResizeObserver' in window) new ResizeObserver(endurmaela).observe(document.body);
    maela();
    reikna();
  }

  function raesa() {
    byrja();
    simi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', raesa);
  } else {
    raesa();
  }
})();
