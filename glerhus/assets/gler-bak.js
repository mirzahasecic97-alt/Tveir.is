/* Glerhúsið: gljáandi glerbakgrunnur. Lifandi ljós undir og glerplötur
   ofan á sem blörra og brjóta ljósið. Sama á vefnum og í kerfinu. */
(function () {
  if (document.querySelector('.gb')) return;
  var gb = document.createElement('div');
  gb.className = 'gb';
  gb.setAttribute('aria-hidden', 'true');
  gb.innerHTML =
    '<div class="gb__ljos"><i></i><i></i><i></i><i></i><i></i></div>' +
    '<div class="gb__plata gb__plata--1"></div>' +
    '<div class="gb__plata gb__plata--2"></div>' +
    '<div class="gb__plata gb__plata--3"></div>' +
    '<div class="gb__plata gb__plata--4"></div>' +
    '<div class="gb__glampi"></div>';
  var setja = function () { document.body.insertBefore(gb, document.body.firstChild); };
  if (document.body) setja(); else document.addEventListener('DOMContentLoaded', setja);
  /* Hreyfingin í bakgrunninum bíður meðan skrunað er */
  var html = document.documentElement, bid;
  window.addEventListener('scroll', function () {
    if (!bid) html.classList.add('er-ad-skruna');
    clearTimeout(bid);
    bid = setTimeout(function () { html.classList.remove('er-ad-skruna'); bid = null; }, 180);
  }, { passive: true });
})();
