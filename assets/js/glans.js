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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', byrja);
  } else {
    byrja();
  }
})();
