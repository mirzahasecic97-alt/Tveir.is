/* Glerhúsið kaflinn á forsíðunni: hreyfingin fer af stað þegar kaflinn
   sést og stoppar þegar hann fer úr augsýn, svo hún éti ekki rafhlöðuna. */
(function () {
  'use strict';
  var hlutar = document.querySelectorAll('.ghk-flaedi, .ghk-hub, .ghk-eig, .ghk-afhverju');
  if (!hlutar.length) return;
  if (!('IntersectionObserver' in window)) {
    hlutar.forEach(function (h) { h.classList.add('er-synilegt', 'er-i-gangi'); });
    return;
  }
  var vakt = new IntersectionObserver(function (faerslur) {
    faerslur.forEach(function (f) {
      if (f.isIntersecting) f.target.classList.add('er-synilegt');
      f.target.classList.toggle('er-i-gangi', f.isIntersecting);
    });
  }, { threshold: 0.2 });
  hlutar.forEach(function (h) { vakt.observe(h); });
})();
