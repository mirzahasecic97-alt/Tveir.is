/* ==========================================================================
   Tveir.is: hreyfing á forsíðunni (prufa, ekki í loftinu)
   GSAP 3.13 (ScrollTrigger og SplitText) og Lenis fyrir mjúkt skrun.
   Allt er slökkt ef notandinn hefur beðið tækið um minni hreyfingu, og
   síðan virkar eins og áður ef forritasöfnin hlaðast ekki.
   ========================================================================== */
(function () {
  'use strict';

  var html = document.documentElement;
  var kyrrt = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var opnun = document.querySelector('.hr-opnun');

  function haetta() {
    html.classList.remove('hr-js');
    if (opnun) opnun.remove();
  }
  if (kyrrt || !window.gsap || !window.ScrollTrigger || !window.SplitText) { haetta(); return; }

  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({ ease: 'power3.out' });

  var fin = window.matchMedia('(pointer: fine)').matches;
  var enska = function () {
    var b = document.querySelector('.langsw__btn[data-lang="en"]');
    return !!(b && b.getAttribute('aria-pressed') === 'true');
  };
  var klemma = gsap.utils.clamp;

  /* ------------------------------------------------------------------
     Mjúkt skrun (bara með mús eða snertifleti, ekki í síma)
     ------------------------------------------------------------------ */
  var lenis = null;
  if (window.Lenis && fin) {
    lenis = new window.Lenis({ lerp: 0.11, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ------------------------------------------------------------------
     Hero: hlutar og strikið undir "skemmtilegri"
     ------------------------------------------------------------------ */
  var hero = document.querySelector('.hero');
  var bak = hero && hero.querySelector('.hero__bak');
  var yfir = hero && hero.querySelector('.hero__yfir');
  var h1 = hero && hero.querySelector('h1');
  var heroKlofid = null;

  function setjaStrik(teiknad) {
    var em = h1 && h1.querySelector('em');
    if (!em || em.querySelector('.hr-strik')) return null;
    em.insertAdjacentHTML('beforeend',
      '<svg class="hr-strik" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<path pathLength="1" d="M4 16 C 58 6, 116 4, 168 11 S 256 21, 296 7"/></svg>');
    var p = em.querySelector('.hr-strik path');
    gsap.set(p, { strokeDasharray: 1, strokeDashoffset: teiknad ? 0 : 1 });
    return p;
  }

  /* ------------------------------------------------------------------
     Opnun og innkoma hero
     ------------------------------------------------------------------ */
  var fyrstaSinn = true;
  try {
    fyrstaSinn = !window.sessionStorage.getItem('hr-opnun');
    window.sessionStorage.setItem('hr-opnun', '1');
  } catch (e) { /* einkagluggi: sýnum opnunina */ }
  var h = fyrstaSinn ? 1 : 0.5;

  var inn = gsap.timeline({ defaults: { ease: 'power4.out' } });

  if (opnun) {
    var merki = opnun.querySelector('.hr-opnun__merki img');
    var lina = opnun.querySelector('.hr-opnun__lina span');
    inn.set(opnun, { autoAlpha: 1 })
      .fromTo(merki, { yPercent: 115 }, { yPercent: 0, duration: 0.9 * h })
      .fromTo(lina, { scaleX: 0 }, { scaleX: 1, duration: 0.75 * h, ease: 'power2.inOut' }, '<0.1')
      .to(merki, { yPercent: -115, duration: 0.55 * h, ease: 'power3.in' }, '+=0.05')
      .to(opnun, { yPercent: -100, duration: 0.95 * h, ease: 'expo.inOut' }, '-=0.3')
      .set(opnun, { display: 'none' });
  }

  /* Hægt tæki má aldrei sitja fast í opnuninni: eftir 3,5 sekúndur er
     stokkið beint á endann. Varnetið í CSS felur hana líka eftir 4. */
  setTimeout(function () { if (inn.progress() < 1) inn.progress(1); }, 3500);

  if (hero && h1) {
    heroKlofid = SplitText.create(h1, { type: 'lines,words', mask: 'lines', linesClass: 'hr-lina' });
    var strik = setjaStrik(false);
    var oll = [h1.parentNode.querySelector('.lead'), hero.querySelector('.hero__actions'), hero.querySelector('.hero__nofn')]
      .filter(Boolean);

    var stadur = opnun ? '-=0.75' : 0;
    inn.fromTo(hero, { clipPath: 'inset(8% 6% 8% 6% round 48px)' },
                     { clipPath: 'inset(0% 0% 0% 0% round 28px)', duration: 1.5, ease: 'expo.inOut' }, stadur)
      .fromTo(bak, { scale: 1.32 }, { scale: 1, duration: 2, ease: 'expo.out' }, '<')
      .from(heroKlofid.words, { yPercent: 120, rotation: 5, duration: 1.15, stagger: 0.075 }, '<0.5')
      .from(oll, { y: 34, autoAlpha: 0, duration: 1, stagger: 0.12 }, '<0.45');
    if (strik) inn.to(strik, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, '<0.15');
    inn.add(function () {
      /* Línuskiptingin á bara við meðan textinn kemur inn. Svo fer hann
         aftur í upprunalegt horf, svo hann brotni rétt á öllum breiddum. */
      gsap.set(hero, { clearProps: 'clipPath' });
      if (heroKlofid) { heroKlofid.revert(); heroKlofid = null; }
      setjaStrik(true);
      ScrollTrigger.refresh();
    });

    /* Dýpt: myndin fer hægar en textinn þegar skrunað er */
    gsap.to(bak, { yPercent: 16, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to(yfir, { y: -70, autoAlpha: 0.15, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'center center', end: 'bottom top', scrub: true } });

    /* Ljós sem fylgir músinni og myndin hallar örlítið á móti */
    if (fin) {
      var ljos = document.createElement('div');
      ljos.className = 'hero__ljos';
      ljos.setAttribute('aria-hidden', 'true');
      hero.insertBefore(ljos, yfir);
      /* Músarhreyfingin fer í CSS eiginleikann translate, ekki transform,
         svo hún rekist aldrei á dýptina og innkomuna sem GSAP sér um */
      var hm = { x: 0, y: 0 };
      var hreyfaBak = function (x, y) {
        gsap.to(hm, { x: x, y: y, duration: 1, ease: 'power3.out', overwrite: true,
          onUpdate: function () { bak.style.translate = hm.x.toFixed(1) + 'px ' + hm.y.toFixed(1) + 'px'; } });
      };
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        hero.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        hero.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        hreyfaBak((px - 0.5) * -22, (py - 0.5) * -14);
      });
      hero.addEventListener('pointerleave', function () { hreyfaBak(0, 0); });
    }
  }

  /* ------------------------------------------------------------------
     Haus sem felur sig þegar skrunað er niður og kemur þegar farið er upp
     ------------------------------------------------------------------ */
  var haus = document.querySelector('.site-head');
  if (haus) {
    var fela = function (j) {
      var opin = document.querySelector('.burger[aria-expanded="true"]');
      gsap.to(haus, { yPercent: j && !opin ? -115 : 0, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
    };
    ScrollTrigger.create({
      start: 160, end: 'max',
      onUpdate: function (s) { fela(s.direction === 1); },
      onLeaveBack: function () { fela(false); }
    });
  }

  /* ------------------------------------------------------------------
     Fyrirsagnir og texti (byggt upp aftur ef skipt er um tungumál)
     ------------------------------------------------------------------ */
  function byggjaTexta() {
    gsap.utils.toArray('.section-title, .trust h2').forEach(function (fyr) {
      SplitText.create(fyr, {
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit: function (self) {
          return gsap.from(self.lines, {
            yPercent: 110, duration: 1.05, ease: 'power4.out', stagger: 0.1,
            scrollTrigger: { trigger: fyr, start: 'top 86%', once: true }
          });
        }
      });
    });

    var cta = document.querySelector('.cta h2');
    if (cta) {
      SplitText.create(cta, {
        type: 'words,chars', autoSplit: true,
        onSplit: function (self) {
          return gsap.from(self.chars, {
            yPercent: 130, rotation: 14, autoAlpha: 0, duration: 0.9, ease: 'back.out(1.7)',
            stagger: 0.03, scrollTrigger: { trigger: cta, start: 'top 82%', once: true }
          });
        }
      });
    }
  }
  var textaSamhengi = gsap.context(byggjaTexta);

  /* main.js skiptir um texta þegar ýtt er á IS/EN. Klofinn texti er
     settur aftur í upprunalegt horf áður en það gerist og klofinn upp á
     nýtt á eftir. */
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.langsw__btn')) return;
    textaSamhengi.revert();
    if (heroKlofid) { heroKlofid.revert(); heroKlofid = null; }
    setTimeout(function () {
      textaSamhengi = gsap.context(byggjaTexta);
      setjaStrik(true);
      ScrollTrigger.refresh();
    }, 0);
  }, true);

  /* ------------------------------------------------------------------
     Þjónustuspjöldin: koma inn í þrívídd og halla að músinni
     ------------------------------------------------------------------ */
  var leidir = gsap.utils.toArray('.leid');
  if (leidir.length) {
    gsap.set(leidir, { transformPerspective: 1000, autoAlpha: 0 });
    ScrollTrigger.batch(leidir, {
      start: 'top 90%', once: true,
      onEnter: function (hopur) {
        gsap.fromTo(hopur, { autoAlpha: 0, y: 90, rotationX: -26, scale: 0.94 },
          { autoAlpha: 1, y: 0, rotationX: 0, scale: 1, duration: 1.15, ease: 'expo.out', stagger: 0.12, overwrite: true,
            onComplete: function () { hopur.forEach(function (k) { k.hrInni = true; }); } });
      }
    });
    if (fin) {
      leidir.forEach(function (k) {
        /* Búið til fyrst eftir að kortið er komið inn: annars hætti
           innkoman í miðjum klíðum */
        var rx = null, ry = null;
        k.addEventListener('pointermove', function (e) {
          if (!k.hrInni) return;
          if (!rx) {
            rx = gsap.quickTo(k, 'rotationX', { duration: 0.6, ease: 'power3' });
            ry = gsap.quickTo(k, 'rotationY', { duration: 0.6, ease: 'power3' });
          }
          var r = k.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          ry((px - 0.5) * 16);
          rx((0.5 - py) * 16);
          k.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
          k.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        });
        k.addEventListener('pointerleave', function () { if (rx) { rx(0); ry(0); } });
      });
    }
  }

  /* ------------------------------------------------------------------
     Tökum spjallið: kassinn vex á móti þér
     ------------------------------------------------------------------ */
  var ctaKassi = document.querySelector('.cta');
  if (ctaKassi) {
    gsap.fromTo(ctaKassi, { scale: 0.86, y: 40 }, {
      scale: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: ctaKassi, start: 'top bottom', end: 'center 60%', scrub: true }
    });
  }
  var fotur = document.querySelector('.site-foot');
  if (fotur) {
    gsap.from(fotur.children, {
      y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.1,
      scrollTrigger: { trigger: fotur, start: 'top 95%', once: true }
    });
  }

  /* ------------------------------------------------------------------
     Segultakkar (bara með mús)
     ------------------------------------------------------------------ */
  if (fin) {
    document.querySelectorAll('.hero__actions .btn, .cta .btn, .pillnav .btn, .leidir__fleiri .btn').forEach(function (b) {
      var bx = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3' });
      var by = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3' });
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        bx((e.clientX - (r.left + r.width / 2)) * 0.35);
        by((e.clientY - (r.top + r.height / 2)) * 0.45);
      });
      b.addEventListener('pointerleave', function () { bx(0); by(0); });
    });
  }

  /* ------------------------------------------------------------------
     Endurreikna þegar letrið er komið og myndir hafa hlaðist
     ------------------------------------------------------------------ */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
