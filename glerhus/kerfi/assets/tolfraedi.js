/* ==========================================================================
   Glerhúsið: tölfræði
   Fylgjendur, áhorf og færslur á samfélagsmiðlum, dag fyrir dag, og
   mánaðarskýrslurnar. Viðskiptavinur sér sitt fyrirtæki og sendar
   skýrslur. Við sjáum öll fyrirtæki, drögin, miðlana og skráninguna.

   Allt sem kemur frá miðlunum eða viðskiptavinum er ótraust: texti fer
   bara inn með textContent (el()), og hlekkir og myndir bara ef https.
   Gröfin eru teiknuð hér sem SVG, ekkert safn að utan.
   ========================================================================== */

import { gogn, el, fylla, lesaTolu, vardaHlid, teiknaHaus, geymt, geyma, tolu, erEnska } from './portal.js';
import { opnaSendingu } from './tolfraedi-senda.js';

const ek = await vardaHlid({ badir: true });
if (ek) start();

/* ------------------------------------------------------------------
   Föst gildi
   ------------------------------------------------------------------ */
const MIDLAR = {
  instagram: { heiti: 'Instagram', litur: '#d62976' },
  facebook:  { heiti: 'Facebook',  litur: '#1877f2' },
  tiktok:    { heiti: 'TikTok',    litur: '#1c3050' }
};
const RODMIDLA = ['instagram', 'facebook', 'tiktok'];
const LITUR_ALLS = '#5b93f0';

const TIMABIL = [
  ['30', '30 dagar'], ['90', '90 dagar'], ['manudur', 'Þessi mánuður'],
  ['fyrri', 'Síðasti mánuður'], ['12', '12 mánuðir']
];

const TEGUNDIR = {
  mynd: 'Mynd', myndband: 'Myndband', reel: 'Reel', karusell: 'Hringekja',
  saga: 'Saga', annad: 'Færsla'
};

const TOLUHEITI = {
  fylgjendur: 'Fylgjendur', ahorf: 'Áhorf', nadir: 'Náð', samskipti: 'Samskipti',
  heimsoknir: 'Heimsóknir á prófíl', faerslur: 'Færslur'
};
/* Á ensku: heiti sem passa tölfræðinni (Samskipti eru hér interactions, ekki pósthólfið) */
if (erEnska()) Object.assign(TOLUHEITI, { fylgjendur: 'Followers', ahorf: 'Views', nadir: 'Reach', samskipti: 'Interactions', heimsoknir: 'Profile visits', faerslur: 'Posts' });
const eittDag = (n) => (erEnska() ? n === 1 : n % 10 === 1 && n % 100 !== 11);
const MAELITOLUR = ['fylgjendur', 'ahorf', 'nadir', 'samskipti', 'heimsoknir', 'faerslur'];

const MAN_STUTT = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
const MAN_LANGT = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí',
                   'ágúst', 'september', 'október', 'nóvember', 'desember'];

/* ------------------------------------------------------------------
   Dagsetningar sem strengir "YYYY-MM-DD" í staðartíma, svo tímabelti
   rugli aldrei deginum
   ------------------------------------------------------------------ */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const lesaD = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); };
const plusDagar = (s, n) => { const d = lesaD(s); d.setDate(d.getDate() + n); return ymd(d); };
const idag = () => ymd(new Date());
const dagaFjoldi = (fra, til) => Math.round((lesaD(til) - lesaD(fra)) / 86400000) + 1;
const fyrstiIMan = (s) => String(s).slice(0, 8) + '01';
const sidastiIMan = (s) => { const d = lesaD(s); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); };
const manudFra = (s, n) => { const d = lesaD(s); return ymd(new Date(d.getFullYear(), d.getMonth() + n, 1, 12)); };

/* "3. nóv" og "3. nóvember 2026" */
function dagsStutt(s) {
  if (!s) return '';
  const d = lesaD(s);
  return isNaN(d) ? '' : d.getDate() + '. ' + MAN_STUTT[d.getMonth()];
}
function dagsLangt(s) {
  if (!s) return '';
  const d = lesaD(s);
  return isNaN(d) ? '' : d.getDate() + '. ' + MAN_LANGT[d.getMonth()] + ' ' + d.getFullYear();
}
/* Tímastimpill (birt, sent_dags) í dagsetningu í staðartíma */
function dagurAfStimpli(t) {
  const d = new Date(t);
  return isNaN(d) ? null : ymd(d);
}
const manHeiti = (s) => { const d = lesaD(s); return MAN_LANGT[d.getMonth()] + ' ' + d.getFullYear(); };
const manNafn = (s) => MAN_LANGT[lesaD(s).getMonth()];

/* ------------------------------------------------------------------
   Tölur á íslensku: 1234 -> "1.234", 0,123 -> "12%"
   ------------------------------------------------------------------ */
function tala(n) {
  if (n === null || n === undefined || !isFinite(n)) return '';
  const t = Math.round(Math.abs(Number(n)));
  return (Number(n) < 0 && t ? '-' : '') + tolu(t);
}
function asTala(v) {
  if (Math.abs(v) >= 1e6) return erEnska() ? String(Math.round(v / 1e5) / 10) + 'M' : String(Math.round(v / 1e5) / 10).replace('.', ',') + ' m.';
  return tala(v);
}
function prosenta(hlutfall) {
  const a = Math.abs(hlutfall * 100);
  const t = a < 10 ? Math.round(a * 10) / 10 : Math.round(a);
  return (erEnska() ? String(t) : String(t).replace('.', ',')) + '%';
}

/* Bara https hlekkir og myndir, án bila og gæsalappa */
function oruggSlod(s) {
  return typeof s === 'string' && s.length <= 2000 && /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : null;
}

const erMidill = (m) => Object.prototype.hasOwnProperty.call(MIDLAR, m);
const midilHeiti = (m) => (erMidill(m) ? MIDLAR[m].heiti : 'Miðill');

/* ------------------------------------------------------------------
   Tímabil: valið bil og jafnlangt bil á undan til samanburðar
   ------------------------------------------------------------------ */
/* Tölur dagsins safnast næsta morgun, svo bilin enda í gær. Annars
   væri síðasti dagurinn alltaf tómur og samanburðurinn skakkur. */
function reiknaTimabil(kodi) {
  const nu = plusDagar(idag(), -1);
  if (kodi === 'manudur' || kodi === 'fyrri') {
    const fra = kodi === 'manudur' ? fyrstiIMan(idag()) : manudFra(idag(), -1);
    const til = kodi === 'manudur' ? (nu < fra ? fra : nu) : sidastiIMan(fra);
    const fyrriFra = manudFra(fra, -1);
    const fyrriLok = sidastiIMan(fyrriFra);
    const lengd = dagaFjoldi(fra, til);
    const fyrriTil = kodi === 'manudur'
      ? (plusDagar(fyrriFra, lengd - 1) < fyrriLok ? plusDagar(fyrriFra, lengd - 1) : fyrriLok)
      : fyrriLok;
    return {
      fra, til, fyrriFra, fyrriTil,
      samanburdur: kodi === 'manudur' ? 'miðað við sama tíma í ' + manNafn(fyrriFra) : 'miðað við ' + manNafn(fyrriFra)
    };
  }
  const n = kodi === '90' ? 90 : kodi === '12' ? 365 : 30;
  const fra = plusDagar(nu, -(n - 1));
  const fyrriTil = plusDagar(fra, -1);
  return {
    fra, til: nu, fyrriFra: plusDagar(fyrriTil, -(n - 1)), fyrriTil,
    samanburdur: kodi === '12' ? 'miðað við árið á undan' : 'miðað við ' + n + ' dagana á undan'
  };
}

/* ------------------------------------------------------------------
   Smáhlutar
   ------------------------------------------------------------------ */
const reitur = (merki, inntak) => el('label', { class: 'field' }, [el('span', { texti: merki }), inntak]);

function stadaBod(stada, texti, tegund) {
  stada.textContent = texti;
  stada.className = 'form-status form-status--' + tegund;
  stada.hidden = false;
}

function talnareitur(gildi) {
  const inn = el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off',
                            value: gildi === null || gildi === undefined ? '' : tala(gildi) });
  inn.addEventListener('blur', () => { const t = lesaTolu(inn.value); inn.value = t === null ? '' : tala(t); });
  return inn;
}

/* Spjald (dialog) í sama stíl og bókhaldið */
function opnaSpjald(titill, born, { mjor } = {}) {
  const kort = el('div', { class: 'pdialog__kort' });
  const d = el('dialog', { class: 'pdialog' + (mjor ? ' pdialog--mjor' : '') }, [kort]);
  fylla(kort, [
    el('div', { class: 'pdialog__haus' }, [
      el('h2', { texti: titill }),
      el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
    ])
  ].concat(born));
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}

/* ==================================================================
   Gröf: SVG teiknað hér
   ================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, eigin, born) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(eigin || {})) {
    if (v === null || v === undefined) continue;
    if (k === 'texti') n.textContent = v; else n.setAttribute(k, v);
  }
  for (const b of [].concat(born || [])) if (b) n.append(b);
  return n;
}

/* Gröfin teiknast upp á nýtt þegar breiddin breytist. Vaktirnar eru
   aftengdar áður en síðan teiknar nýja hluta, svo þær safnist ekki upp. */
let vaktir = [];
function hreinsaRit() { vaktir.forEach((v) => v()); vaktir = []; }

/* Kvarði með heilum, þægilegum skrefum: 1, 2, 5, 10 sinnum tíu í veldi */
function kvardi(lo, hi, fjoldi) {
  const spann = hi - lo || 1;
  const grof = spann / fjoldi;
  const veldi = Math.pow(10, Math.floor(Math.log10(grof)));
  const h = grof / veldi;
  const skref = Math.max(1, (h <= 1 ? 1 : h <= 2 ? 2 : h <= 5 ? 5 : 10) * veldi);
  const fra = Math.floor(lo / skref) * skref;
  const til = Math.ceil(hi / skref) * skref;
  const ut = [];
  for (let v = fra; v <= til + skref / 2; v += skref) ut.push(Math.round(v));
  if (ut.length < 2) ut.push(ut[0] + skref);
  return ut;
}

/* tegund 'lina' eða 'sulur'. x er listi af dagsetningum (fyrsti dagur
   hvers bils), rodir [{heiti, litur, gildi}] þar sem null er gat. */
function rit({ tegund, x, xMerki, rodir, nafn, lysing }) {
  const flotur = el('div', { class: 'tf-rit__flotur' });
  const abending = el('div', { class: 'tf-rit__abending', hidden: true, 'aria-hidden': 'true' });
  const holf = el('div', { class: 'tf-rit__svg' });
  flotur.append(holf, abending);

  const n = x.length;
  let breidd = 0;

  function byggja(b) {
    const H = b < 480 ? 210 : 250;
    let lo = 0;
    let hi = 0;
    if (tegund === 'sulur') {
      for (let i = 0; i < n; i++) {
        let summa = 0;
        for (const r of rodir) if (r.gildi[i] > 0) summa += r.gildi[i];
        hi = Math.max(hi, summa);
      }
      if (!hi) hi = 1;
    } else {
      const oll = [];
      rodir.forEach((r) => r.gildi.forEach((v) => { if (v !== null && v !== undefined) oll.push(v); }));
      lo = oll.length ? Math.min(...oll) : 0;
      hi = oll.length ? Math.max(...oll) : 1;
      if (lo === hi) { lo -= 1; hi += 1; }
      const bil = (hi - lo) * 0.08;
      lo = Math.max(0, lo - bil); hi += bil;
    }
    const merkin = kvardi(lo, hi, H < 230 ? 4 : 5);
    lo = merkin[0]; hi = merkin[merkin.length - 1];
    const yTextar = merkin.map(asTala);
    const padL = Math.max(...yTextar.map((t) => t.length)) * 6.8 + 12;
    const padR = 8; const padT = 10; const padB = 28;
    const pw = Math.max(10, b - padL - padR);
    const ph = H - padT - padB;
    const bil = pw / Math.max(1, n);
    const xAt = (i) => padL + (i + 0.5) * bil;
    const yAt = (v) => padT + ph - ((v - lo) / (hi - lo || 1)) * ph;

    const svg = s('svg', { viewBox: '0 0 ' + b + ' ' + H, width: '100%', height: String(H),
                           role: 'img', 'aria-label': lysing, focusable: 'false', class: 'tf-rit__teikning' });

    /* Línur á bak við og tölur á y-ás */
    merkin.forEach((v, j) => {
      svg.append(s('line', { x1: padL, x2: b - padR, y1: yAt(v), y2: yAt(v),
                             class: j === 0 ? 'tf-rit__grunnur' : 'tf-rit__lina' }));
      svg.append(s('text', { x: padL - 8, y: yAt(v) + 4, 'text-anchor': 'end', class: 'tf-rit__texti',
                             texti: yTextar[j] }));
    });

    /* Dagsetningar á x-ás, sá síðasti alltaf með */
    const fjoldiMerkja = Math.max(2, Math.floor(pw / 74));
    const skref = Math.max(1, Math.ceil(n / fjoldiMerkja));
    for (let i = (n - 1) % skref; i < n; i += skref) {
      const xx = Math.min(Math.max(xAt(i), padL + 18), b - padR - 18);
      svg.append(s('text', { x: xx, y: H - 8, 'text-anchor': 'middle', class: 'tf-rit__texti',
                             texti: dagsStutt(x[i]) }));
    }

    if (tegund === 'sulur') {
      const w = Math.max(1, bil * (n > 60 ? 0.8 : 0.64));
      for (let i = 0; i < n; i++) {
        let undir = 0;
        rodir.forEach((r) => {
          const v = r.gildi[i];
          if (!(v > 0)) return;
          const y1 = yAt(undir + v);
          const y0 = yAt(undir);
          svg.append(s('rect', { x: xAt(i) - w / 2, y: y1, width: w, height: Math.max(0.5, y0 - y1),
                                 fill: r.litur, rx: Math.min(2, w / 3) }));
          undir += v;
        });
      }
    } else {
      rodir.forEach((r) => {
        let d = '';
        let penni = false;
        r.gildi.forEach((v, i) => {
          if (v === null || v === undefined) { penni = false; return; }
          d += (penni ? 'L' : 'M') + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1);
          /* Stakur punktur milli gata sæist ekki sem lína */
          const stakur = (i === 0 || r.gildi[i - 1] == null) && (i === n - 1 || r.gildi[i + 1] == null);
          if (stakur) svg.append(s('circle', { cx: xAt(i), cy: yAt(v), r: 2.4, fill: r.litur }));
          penni = true;
        });
        if (d) svg.append(s('path', { d, fill: 'none', stroke: r.litur, 'stroke-width': 2,
                                      'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      });
    }

    /* Ábending þegar bent er eða snert */
    const leidari = s('line', { x1: 0, x2: 0, y1: padT, y2: padT + ph, class: 'tf-rit__leidari', visibility: 'hidden' });
    const punktar = s('g', {});
    svg.append(leidari, punktar);
    const yfir = s('rect', { x: padL, y: padT, width: pw, height: ph, fill: 'transparent', class: 'tf-rit__yfir' });
    svg.append(yfir);

    function syna(e) {
      const r = svg.getBoundingClientRect();
      if (!r.width) return;
      const sx = (e.clientX - r.left) * (b / r.width);
      const i = Math.min(n - 1, Math.max(0, Math.floor((sx - padL) / bil)));
      leidari.setAttribute('x1', xAt(i)); leidari.setAttribute('x2', xAt(i));
      leidari.setAttribute('visibility', 'visible');
      while (punktar.firstChild) punktar.removeChild(punktar.firstChild);
      if (tegund === 'lina') {
        rodir.forEach((rr) => {
          const v = rr.gildi[i];
          if (v !== null && v !== undefined) {
            punktar.append(s('circle', { cx: xAt(i), cy: yAt(v), r: 4, fill: '#fff', stroke: rr.litur, 'stroke-width': 2 }));
          }
        });
      }
      let samtals = 0; let medGildi = 0;
      fylla(abending, [el('strong', { texti: xMerki(i) })].concat(rodir.map((rr) => {
        const v = rr.gildi[i];
        if (v !== null && v !== undefined) { samtals += v; medGildi++; }
        return el('span', {}, [
          el('i', { style: 'background:' + rr.litur }),
          document.createTextNode(rr.heiti + ': ' + (v === null || v === undefined ? 'engin gögn' : tala(v)))
        ]);
      })).concat(tegund === 'sulur' && rodir.length > 1 && medGildi
        ? [el('span', { class: 'tf-rit__samtals', texti: 'Samtals: ' + tala(samtals) })] : []));
      abending.hidden = false;
      const fr = flotur.getBoundingClientRect();
      const px = xAt(i) * (r.width / b) + (r.left - fr.left);
      const w = abending.offsetWidth;
      const vinstri = px + 14 + w > fr.width ? px - 14 - w : px + 14;
      abending.style.left = Math.max(0, Math.min(fr.width - w, vinstri)) + 'px';
    }
    function fela() {
      abending.hidden = true;
      leidari.setAttribute('visibility', 'hidden');
      while (punktar.firstChild) punktar.removeChild(punktar.firstChild);
    }
    svg.addEventListener('pointermove', syna);
    svg.addEventListener('pointerdown', syna);
    svg.addEventListener('pointerleave', fela);
    return svg;
  }

  function teikna() {
    const b = Math.round(holf.clientWidth || flotur.clientWidth || 0);
    if (!b || b === breidd) return;
    breidd = b;
    abending.hidden = true;
    while (holf.firstChild) holf.removeChild(holf.firstChild);
    holf.append(byggja(b));
  }

  if (typeof ResizeObserver !== 'undefined') {
    const v = new ResizeObserver(() => teikna());
    v.observe(holf);
    vaktir.push(() => v.disconnect());
  } else {
    window.addEventListener('resize', teikna);
    vaktir.push(() => window.removeEventListener('resize', teikna));
  }
  requestAnimationFrame(teikna);

  /* Sama efni sem tafla fyrir skjálesara */
  const tafla = el('table', { class: 'sr-only' }, [
    el('caption', { texti: nafn }),
    el('thead', {}, [el('tr', {}, [el('th', { scope: 'col', texti: 'Dagur' })]
      .concat(rodir.map((r) => el('th', { scope: 'col', texti: r.heiti }))))]),
    el('tbody', {}, x.map((d, i) => el('tr', {}, [el('th', { scope: 'row', texti: xMerki(i) })]
      .concat(rodir.map((r) => el('td', {
        texti: r.gildi[i] === null || r.gildi[i] === undefined ? 'engin gögn' : tala(r.gildi[i])
      }))))))
  ]);

  return el('div', { class: 'tf-rit' }, [
    rodir.length > 1 || tegund === 'lina'
      ? el('div', { class: 'tf-rit__skyring', 'aria-hidden': 'true' }, rodir.map((r) =>
          el('span', {}, [el('i', { style: 'background:' + r.litur }), document.createTextNode(r.heiti)])))
      : null,
    flotur,
    tafla
  ]);
}

/* ==================================================================
   CSV lestur
   ================================================================== */
const HAUSAR = {
  date: 'dags', dags: 'dags', dagsetning: 'dags', dagur: 'dags', day: 'dags',
  followers: 'fylgjendur', fylgjendur: 'fylgjendur', followerscount: 'fylgjendur',
  totalfollowers: 'fylgjendur',
  views: 'ahorf', ahorf: 'ahorf', videoviews: 'ahorf',
  reach: 'nadir', nad: 'nadir', nadir: 'nadir',
  interactions: 'samskipti', samskipti: 'samskipti', engagement: 'samskipti', engagements: 'samskipti',
  profilevisits: 'heimsoknir', heimsoknir: 'heimsoknir', visits: 'heimsoknir',
  posts: 'faerslur', faerslur: 'faerslur'
};

function hreinsaHaus(h) {
  return String(h || '').toLowerCase().trim()
    .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/* Ein lína í reiti, með gæsalöppum eins og CSV leyfir */
function sundra(lina, skil) {
  const ut = [];
  let nu = '';
  let innan = false;
  for (let i = 0; i < lina.length; i++) {
    const c = lina[i];
    if (innan) {
      if (c === '"' && lina[i + 1] === '"') { nu += '"'; i++; }
      else if (c === '"') innan = false;
      else nu += c;
    } else if (c === '"') innan = true;
    else if (c === skil) { ut.push(nu); nu = ''; }
    else nu += c;
  }
  ut.push(nu);
  return ut.map((x) => x.trim());
}

function giskaSkil(lina) {
  const utan = lina.replace(/"[^"]*"/g, '');
  const fjoldi = (c) => utan.split(c).length - 1;
  const val = [[';', fjoldi(';')], ['\t', fjoldi('\t')], [',', fjoldi(',')]].sort((a, b) => b[1] - a[1]);
  return val[0][1] > 0 ? val[0][0] : ',';
}

function lesaDags(gildi, rod) {
  const t = String(gildi || '').trim();
  let y; let m; let d; let k;
  if ((k = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +k[1]; m = +k[2]; d = +k[3]; }
  else if ((k = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) { d = +k[1]; m = +k[2]; y = +k[3]; }
  else if ((k = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
    y = +k[3] < 100 ? 2000 + +k[3] : +k[3];
    if (rod === 'mdy') { m = +k[1]; d = +k[2]; } else { d = +k[1]; m = +k[2]; }
  } else return null;
  const dd = new Date(y, m - 1, d, 12);
  if (dd.getFullYear() !== y || dd.getMonth() !== m - 1 || dd.getDate() !== d) return null;
  if (y < 2000 || ymd(dd) > idag()) return null;
  return ymd(dd);
}

function lesaFjolda(gildi) {
  const t = String(gildi === undefined || gildi === null ? '' : gildi).trim().replace(/[\s ]/g, '');
  if (!t || /[^0-9.,]/.test(t)) return null;
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''));
  if (/^\d+([.,]\d+)?$/.test(t)) return Math.round(parseFloat(t.replace(',', '.')));
  return null;
}

function lesaCsv(texti) {
  const linur = String(texti || '').replace(/^﻿/, '').split(/\r\n|\n|\r/).filter((l) => l.trim());
  if (!linur.length) return { villa: 'Ekkert til að lesa ennþá.' };

  let hausNr = -1; let skil = ','; let dalkar = null;
  for (let i = 0; i < Math.min(6, linur.length); i++) {
    if (/^sep=/i.test(linur[i])) continue;
    const sk = giskaSkil(linur[i]);
    const kort = {};
    sundra(linur[i], sk).map(hreinsaHaus).forEach((h, j) => {
      const k = HAUSAR[h];
      if (k && kort[k] === undefined) kort[k] = j;
    });
    if (kort.dags !== undefined && Object.keys(kort).length > 1) { hausNr = i; skil = sk; dalkar = kort; break; }
  }
  if (hausNr < 0) {
    return { villa: 'Fann ekki dálkaheitin. Fyrsta línan þarf að hafa dagsetningu (dags eða date) og minnst eina tölu, til dæmis fylgjendur eða followers.' };
  }

  const hrar = linur.slice(hausNr + 1).map((l) => sundra(l, skil));
  if (hrar.length > 3000) return { villa: 'Of margar línur. Mest 3.000 dagar í einu.' };

  /* 03/11/2026: dagur fyrst nema einhver lína sýni annað */
  let rod = 'dmy';
  for (const r of hrar) {
    const k = String(r[dalkar.dags] || '').match(/^(\d{1,2})\/(\d{1,2})\//);
    if (k && +k[1] > 12) { rod = 'dmy'; break; }
    if (k && +k[2] > 12) { rod = 'mdy'; break; }
  }

  const tolur = MAELITOLUR.filter((k) => dalkar[k] !== undefined);
  const kort = new Map();
  let ogild = 0;
  for (const r of hrar) {
    const dagsetning = lesaDags(r[dalkar.dags], rod);
    if (!dagsetning) { ogild++; continue; }
    const gildi = {};
    let eitthvad = false;
    for (const k of tolur) {
      const v = lesaFjolda(r[dalkar[k]]);
      if (v !== null) { gildi[k] = v; eitthvad = true; }
    }
    if (!eitthvad) { ogild++; continue; }
    kort.set(dagsetning, { dags: dagsetning, gildi });
  }
  const radir = [...kort.values()].sort((a, b) => a.dags.localeCompare(b.dags));
  if (!radir.length) return { villa: 'Engin lína hafði bæði dagsetningu og tölu.' };
  return { radir, tolur, ogild };
}

/* ==================================================================
   Síðan
   ================================================================== */
async function start() {
  const g = await gogn();
  const admin = ek.hlutverk === 'admin';
  teiknaHaus(ek, 'Tölfræði');
  const innihald = document.getElementById('innihald');

  if (!admin && !ek.fyrirtaeki_id) {
    fylla(innihald, [el('div', { class: 'card pblokk' }, [
      el('h2', { texti: 'Aðgangurinn er ekki tengdur fyrirtæki' }),
      el('p', { class: 'lead', style: 'margin-top:10px',
        texti: 'Við þurfum að tengja þig við fyrirtækið þitt áður en þú sérð tölfræðina. Sendu okkur línu á tveir@tveir.is og við gerum það í dag.' })
    ])]);
    return;
  }

  let fyrirtaekin = [];
  if (admin) {
    try { fyrirtaekin = await g.fyrirtaeki(); } catch (villa) { synaVillu(villa); return; }
  }

  /* Admin byrjar á yfirliti með spjaldi fyrir hvert fyrirtæki. Fyrirtækið
     sem er opið stendur í slóðinni (?f=...), svo Til baka í vafranum fer
     aftur á yfirlitið og hlekkinn má senda áfram. */
  const slodF = new URLSearchParams(location.search).get('f');
  let fid = admin ? (fyrirtaekin.some((f) => f.id === slodF) ? slodF : null) : ek.fyrirtaeki_id;
  const opna = (id) => { location.search = '?f=' + encodeURIComponent(id); };
  let timabil = TIMABIL.some(([k]) => k === geymt('tolfraedi-timabil')) ? geymt('tolfraedi-timabil') : '30';
  let sia = 'allir';

  const fyrNafn = () => {
    if (!admin) return ek.fyrirtaeki ? ek.fyrirtaeki.nafn : '';
    const f = fyrirtaekin.find((x) => x.id === fid);
    return f ? f.nafn : '';
  };

  /* Gögn valins fyrirtækis */
  let midlar = [];
  let maelingar = [];
  let skyrslur = [];
  let skyrsluVilla = null;
  let myndbond = [];
  let myndbandaVilla = null;
  const faerslurMinni = new Map();
  let utgafa = 0;
  let vaktTimi = null;
  const skyrsluHnutar = new Map();

  const hlutar = {
    haus: el('div'), tolur: el('div'), myndbond: el('div'), skyrslur: el('div'), midlar: el('div')
  };
  fylla(innihald, [
    hlutar.haus, hlutar.tolur, hlutar.myndbond, hlutar.skyrslur, hlutar.midlar,
    g.prufa ? el('div', { class: 'prufubanner', style: 'margin-top:18px' }, [
      el('strong', { texti: 'Prufustilling. ' }),
      document.createTextNode('Tölurnar eru sýnidæmi sem verða til í vafranum. Ekkert fer út á netið og enginn póstur er sendur.')
    ]) : null
  ]);

  if (!fid) {
    teiknaHausinn();
    if (admin && fyrirtaekin.length) { await teiknaYfirlit(); return; }
    fylla(hlutar.tolur, [el('div', { class: 'card pblokk' }, [
      el('p', { class: 'tomt', texti: 'Ekkert fyrirtæki skráð ennþá. Stofnaðu það á stjórnborðinu fyrst.' })
    ])]);
    return;
  }

  teiknaHausinn();
  await hlada();

  /* ------------------------------------------------------------------
     Haus síðunnar og fyrirtækjaval
     ------------------------------------------------------------------ */
  function teiknaHausinn() {
    const yfirlit = admin && !fid;
    fylla(hlutar.haus, [
      admin && fid
        ? el('a', { class: 'tf-tilbaka', href: 'tolfraedi.html', texti: 'Öll fyrirtæki' })
        : null,
      el('div', { class: 'page-head tf-haus', style: 'padding-top:0' }, [
        el('div', {}, [
          el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)',
                     texti: admin && fid ? fyrNafn() || 'Tölfræði' : 'Tölfræði' }),
          el('p', { class: 'lead', texti: yfirlit
            ? 'Veldu fyrirtæki til að sjá fylgjendur, áhorf og færslur dag fyrir dag.'
            : admin
              ? 'Fylgjendur, áhorf og færslur á samfélagsmiðlum, dag fyrir dag.'
              : 'Fylgjendur, áhorf og færslur á samfélagsmiðlunum ykkar, dag fyrir dag.' })
        ]),
        admin && fid
          ? el('button', { type: 'button', class: 'btn tf-senda', onclick: () => {
              const tb = reiknaTimabil(timabil);
              const heiti = { '30': ['síðustu 30 daga', '30 dagana á undan'], '90': ['síðustu 90 daga', '90 dagana á undan'],
                '12': ['síðustu 12 mánuði', 'árið á undan'],
                manudur: ['það sem af er ' + manNafn(tb.fra), 'sama tíma í ' + manNafn(tb.fyrriFra)],
                fyrri: ['í ' + manNafn(tb.fra), 'í ' + manNafn(tb.fyrriFra)] }[timabil] || ['á tímabilinu', 'tímabilið á undan'];
              const valdir = sia === 'allir' ? midlar : midlar.filter((m) => m.midill === sia);
              opnaSendingu({ g, ek, fid, fyrirtaeki: fyrNafn(), midlar: valdir, maelingar, tb, timabilHeiti: heiti[0], fyrriHeiti: heiti[1], myndbond });
            } }, [el('span', { 'aria-hidden': 'true', texti: '✉ ' }), document.createTextNode('Senda á viðskiptavin')])
          : null,
        admin && fid && fyrirtaekin.length > 1
          ? el('label', { class: 'pyfir tf-velja', style: 'margin:0' }, [
              el('span', { class: 'sr-only', texti: 'Skipta um fyrirtæki' }),
              el('select', { onchange: (e) => opna(e.target.value) },
                fyrirtaekin.map((f) => el('option', { value: f.id, selected: f.id === fid, texti: f.nafn })))
            ])
          : null
      ])
    ]);
  }

  /* ------------------------------------------------------------------
     Yfirlit: eitt spjald á fyrirtæki með helstu tölum síðustu 30 daga
     ------------------------------------------------------------------ */
  async function teiknaYfirlit() {
    fylla(hlutar.tolur, [el('div', { class: 'card pblokk' }, [el('p', { class: 'tomt', texti: 'Sæki tölurnar' })])]);
    const nu = idag();
    const fra = plusDagar(nu, -90);
    const gogn30 = await Promise.all(fyrirtaekin.map(async (f) => {
      try {
        const [m, ma] = await Promise.all([g.midlar(f.id), g.maelingar(f.id, fra, nu)]);
        return { f, midlar: m || [], maelingar: ma || [] };
      } catch (villa) {
        return { f, midlar: [], maelingar: [], villa };
      }
    }));

    const tolu = (v) => (v === null || v === undefined || v === '' || !isFinite(Number(v)) ? null : Number(v));
    const samantekt = (x) => {
      const virkir = x.midlar.filter((m) => m.virkt !== false);
      /* Sömu 30 dagar og á síðu fyrirtækisins: enda á síðasta degi með tölum */
      const lok = x.maelingar.reduce((h, r) => (String(r.dags).slice(0, 10) > h ? String(r.dags).slice(0, 10) : h), '') || nu;
      const skil = plusDagar(lok, -29);
      const fyrriFra = plusDagar(lok, -59);
      let nyleg = 0, fyrri = 0, nyHefur = false, fyrriHefur = false;
      const dagleg = new Map();
      const sidustuFylgj = new Map();
      for (const r of x.maelingar) {
        const d = String(r.dags).slice(0, 10);
        const a = tolu(r.ahorf);
        if (a != null) {
          if (d >= skil && d <= lok) { nyleg += a; nyHefur = true; dagleg.set(d, (dagleg.get(d) || 0) + a); }
          else if (d >= fyrriFra && d < skil) { fyrri += a; fyrriHefur = true; }
        }
        const fy = tolu(r.fylgjendur);
        if (fy != null) {
          const fyrir = sidustuFylgj.get(r.midill_id);
          if (!fyrir || d > fyrir.d) sidustuFylgj.set(r.midill_id, { d, fy });
        }
      }
      let fylgjendur = null;
      sidustuFylgj.forEach((v) => { fylgjendur = (fylgjendur || 0) + v.fy; });
      const ferill = [];
      for (let i = 29; i >= 0; i--) ferill.push(dagleg.get(plusDagar(lok, -i)) || 0);
      return {
        virkir,
        ahorf: nyHefur ? nyleg : null,
        breyting: nyHefur && fyrriHefur && fyrri > 0 ? (nyleg - fyrri) / fyrri : null,
        fylgjendur,
        ferill: nyHefur ? ferill : null
      };
    };

    const ferilsRit = (gildi) => {
      const B = 120, H = 34;
      const hamark = Math.max(...gildi, 1);
      const pt = gildi.map((v, i) => (i * B / (gildi.length - 1)).toFixed(1) + ',' + (H - 2 - v / hamark * (H - 4)).toFixed(1));
      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + B + ' ' + H);
      svg.setAttribute('class', 'tf-kort__ferill');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('preserveAspectRatio', 'none');
      const svaedi = document.createElementNS(SVGNS, 'polygon');
      svaedi.setAttribute('points', '0,' + H + ' ' + pt.join(' ') + ' ' + B + ',' + H);
      svaedi.setAttribute('class', 'tf-kort__svaedi');
      const lina = document.createElementNS(SVGNS, 'polyline');
      lina.setAttribute('points', pt.join(' '));
      lina.setAttribute('class', 'tf-kort__lina');
      svg.append(svaedi, lina);
      return svg;
    };

    const rodud = gogn30.map((x) => ({ ...x, s: samantekt(x) }))
      .sort((a, b) => (b.s.virkir.length > 0) - (a.s.virkir.length > 0)
        || (b.s.ahorf || 0) - (a.s.ahorf || 0)
        || a.f.nafn.localeCompare(b.f.nafn, 'is'));

    const spjald = ({ f, s, villa }) => {
      const tegundir = RODMIDLA.filter((k) => s.virkir.some((m) => m.midill === k));
      const merkiSlod = oruggSlod(f.merki_url);
      return el('a', { class: 'tf-kort', href: 'tolfraedi.html?f=' + encodeURIComponent(f.id),
                       'aria-label': f.nafn + ', opna tölfræði' }, [
        el('div', { class: 'tf-kort__haus' }, [
          merkiSlod
            ? el('img', { class: 'tf-kort__merki', src: merkiSlod, alt: '' })
            : el('span', { class: 'tf-kort__merki tf-kort__merki--stafur', 'aria-hidden': 'true',
                           texti: (f.nafn || '?').trim().charAt(0).toUpperCase() }),
          el('div', { class: 'tf-kort__nafn' }, [
            el('strong', { texti: f.nafn }),
            el('span', { class: 'tf-kort__midlar' }, tegundir.length
              ? tegundir.map((k) => el('span', {}, [
                  el('i', { class: 'tf-punktur', style: 'background:' + MIDLAR[k].litur, 'aria-hidden': 'true' }),
                  document.createTextNode(MIDLAR[k].heiti)
                ]))
              : [document.createTextNode(villa ? 'Tölurnar komu ekki' : 'Engir miðlar tengdir')])
          ])
        ]),
        s.ferill ? ferilsRit(s.ferill) : el('div', { class: 'tf-kort__ferill tf-kort__ferill--tomt' }),
        el('dl', { class: 'tf-kort__tolur' }, [
          el('div', {}, [
            el('dt', { texti: 'Áhorf, 30 dagar' }),
            el('dd', { texti: s.ahorf != null ? tala(s.ahorf) : 'Engin gögn' }),
            s.breyting != null
              ? el('span', { class: 'tf-breyting ' + (s.breyting >= 0 ? 'tf-breyting--upp' : 'tf-breyting--nidur'),
                             texti: (s.breyting >= 0 ? '▲ ' : '▼ ') + prosenta(Math.abs(s.breyting)) })
              : null
          ]),
          el('div', {}, [
            el('dt', { texti: 'Fylgjendur' }),
            el('dd', { texti: s.fylgjendur != null ? tala(s.fylgjendur) : 'Engin gögn' })
          ])
        ])
      ]);
    };

    fylla(hlutar.tolur, [
      el('div', { class: 'tf-kortin' }, rodud.map(spjald))
    ]);
  }

  function synaVillu(villa, hvar) {
    fylla(hvar || innihald, [el('div', { class: 'card pblokk' }, [
      el('h2', { texti: 'Tölurnar komu ekki' }),
      el('p', { class: 'lead', style: 'margin-top:10px', texti: (villa && villa.message) || 'Þetta gekk ekki. Prófaðu aftur.' }),
      el('button', { type: 'button', class: 'btn btn--sm', style: 'margin-top:16px', texti: 'Reyna aftur',
                     onclick: () => (hvar ? hlada() : location.reload()) })
    ])]);
  }

  /* ------------------------------------------------------------------
     Sækja gögn fyrirtækisins: miðla, mælingar í tvö ár og skýrslur
     ------------------------------------------------------------------ */
  async function hlada() {
    const min = ++utgafa;
    clearTimeout(vaktTimi);
    hreinsaRit();
    faerslurMinni.clear();
    fylla(hlutar.tolur, [el('div', { class: 'card pblokk' }, [el('p', { class: 'tomt', texti: 'Sæki tölurnar' })])]);
    fylla(hlutar.skyrslur, []);
    fylla(hlutar.midlar, []);
    fylla(hlutar.myndbond, []);
    const nu = idag();
    try {
      const [m, ma] = await Promise.all([
        g.midlar(fid),
        g.maelingar(fid, plusDagar(nu, -731), nu)
      ]);
      if (min !== utgafa) return;
      midlar = m || [];
      maelingar = (ma || []).slice().sort((a, b) => String(a.dags).localeCompare(String(b.dags)));
    } catch (villa) {
      if (min !== utgafa) return;
      synaVillu(villa, hlutar.tolur);
      return;
    }
    try {
      skyrslur = await g.skyrslur(fid) || [];
      skyrsluVilla = null;
    } catch (villa) {
      skyrslur = []; skyrsluVilla = villa;
    }
    try {
      myndbond = await g.myndbond(fid) || [];
      myndbandaVilla = null;
    } catch (villa) {
      myndbond = []; myndbandaVilla = villa;
    }
    if (min !== utgafa) return;
    if (sia !== 'allir' && !midlar.some((x) => x.midill === sia)) sia = 'allir';
    teiknaAllt();
  }

  async function hladaMaelingum() {
    const nu = idag();
    const ma = await g.maelingar(fid, plusDagar(nu, -731), nu);
    maelingar = (ma || []).slice().sort((a, b) => String(a.dags).localeCompare(String(b.dags)));
  }

  function teiknaAllt() {
    teiknaTolur();
    teiknaMyndbond();
    teiknaSkyrslur();
    teiknaMidla();
  }

  /* ------------------------------------------------------------------
     Tölur og gröf
     ------------------------------------------------------------------ */
  function teiknaTolur() {
    hreinsaRit();

    if (!midlar.length) {
      fylla(hlutar.tolur, [admin
        ? el('section', { class: 'card pblokk' }, [
            el('div', { class: 'pyfir' }, [el('h2', { texti: 'Tengdu fyrsta miðilinn' })]),
            el('p', { class: 'skyring', style: 'margin:-6px 0 16px',
              texti: 'Settu inn Instagram, Facebook eða TikTok reikning fyrir ' + fyrNafn() + '. Með auðkenni safnast Instagram og Facebook sjálfkrafa á hverjum morgni. Annars eru tölurnar skráðar í höndunum eða fluttar inn úr CSV.' }),
            midilsForm({}, null)
          ])
        : el('div', { class: 'card pblokk' }, [
            el('p', { class: 'tomt', texti: 'Tölfræðin birtist hér þegar miðlarnir þínir hafa verið tengdir.' })
          ])]);
      return;
    }

    const tb = reiknaTimabil(timabil);
    const valdir = sia === 'allir' ? midlar : midlar.filter((m) => m.midill === sia);
    const ids = new Set(valdir.map((m) => m.id));
    const radir = maelingar.filter((r) => ids.has(r.midill_id));
    const eftirMidli = new Map();
    for (const r of radir) {
      if (!eftirMidli.has(r.midill_id)) eftirMidli.set(r.midill_id, new Map());
      eftirMidli.get(r.midill_id).set(String(r.dags).slice(0, 10), r);
    }

    const summa = (svid, fra, til) => {
      let alls = 0; const dagar = new Set();
      for (const r of radir) {
        const d = String(r.dags).slice(0, 10);
        if (d < fra || d > til || r[svid] === null || r[svid] === undefined) continue;
        alls += Number(r[svid]); dagar.add(d);
      }
      return dagar.size ? { s: alls, dagar: dagar.size } : null;
    };

    /* Fylgjendur: síðasta tala hvers miðils á bilinu, borið saman við
       síðustu tölu fyrir bilið (eða þá fyrstu á því) */
    let fLok = 0; let fUpphaf = 0; let fMed = 0;
    for (const m of valdir) {
      const hans = radir.filter((r) => r.midill_id === m.id && r.fylgjendur !== null && r.fylgjendur !== undefined);
      const iTb = hans.filter((r) => r.dags >= tb.fra && r.dags <= tb.til);
      if (!iTb.length) continue;
      const fyrir = hans.filter((r) => r.dags < tb.fra);
      fLok += Number(iTb[iTb.length - 1].fylgjendur);
      fUpphaf += Number(fyrir.length ? fyrir[fyrir.length - 1].fylgjendur : iTb[0].fylgjendur);
      fMed++;
    }

    const samanburdur = (nu, fyrri) => {
      if (!nu) return null;
      if (!fyrri || !fyrri.s || fyrri.dagar < nu.dagar * 0.8) return { texti: 'Enginn samanburður ennþá', att: null };
      const p = (nu.s - fyrri.s) / fyrri.s;
      return { hlutfall: p, texti: prosenta(p) + ' ' + tb.samanburdur, att: Math.abs(p) < 0.0005 ? 'jafnt' : p > 0 ? 'upp' : 'nidur' };
    };

    const sAhorf = summa('ahorf', tb.fra, tb.til);
    const sNad = summa('nadir', tb.fra, tb.til);
    const sSam = summa('samskipti', tb.fra, tb.til);
    const sFaer = summa('faerslur', tb.fra, tb.til);
    const fBreyting = fLok - fUpphaf;

    const faerslurTala = el('dd', { class: sFaer ? null : 'tf-engin', texti: sFaer ? tala(sFaer.s) : 'Engin gögn' });

    const tolurnar = el('dl', { class: 'tekjur tf-tolur' }, [
      kpi('Fylgjendur', fMed ? tala(fLok) : null, fMed ? {
        texti: (fBreyting > 0 ? '+' : '') + tala(fBreyting)
          + (fUpphaf ? ' (' + prosenta(fBreyting / fUpphaf) + ')' : '') + ' á tímabilinu',
        att: fBreyting > 0 ? 'upp' : fBreyting < 0 ? 'nidur' : 'jafnt'
      } : null),
      kpi('Áhorf', sAhorf ? tala(sAhorf.s) : null, samanburdur(sAhorf, summa('ahorf', tb.fyrriFra, tb.fyrriTil))),
      kpi('Náð', sNad ? tala(sNad.s) : null, samanburdur(sNad, summa('nadir', tb.fyrriFra, tb.fyrriTil))),
      kpi('Samskipti', sSam ? tala(sSam.s) : null, samanburdur(sSam, summa('samskipti', tb.fyrriFra, tb.fyrriTil))),
      el('div', {}, [el('dt', { texti: 'Færslur' }), faerslurTala])
    ]);

    /* Gröfin: dagar á bilinu, og vikur þegar bilið er langt */
    const dagar = [];
    for (let d = tb.fra; d <= tb.til; d = plusDagar(d, 1)) dagar.push(d);

    const hopar = (sia === 'allir'
      ? RODMIDLA.filter((k) => midlar.some((m) => m.midill === k))
      : [sia]
    ).map((k) => ({
      heiti: midilHeiti(k), litur: MIDLAR[k] ? MIDLAR[k].litur : LITUR_ALLS,
      ids: midlar.filter((m) => m.midill === k).map((m) => m.id)
    }));

    /* Fylgjendur á dag. Dagur fær gildi bara ef allir miðlar hópsins
       sem hafa gögn á bilinu eru með tölu þann dag, annars gat. */
    const fylgjendaRodir = hopar.map((h) => {
      const virkir = h.ids.filter((id) => {
        const k = eftirMidli.get(id);
        if (!k) return false;
        for (const d of dagar) { const r = k.get(d); if (r && r.fylgjendur !== null && r.fylgjendur !== undefined) return true; }
        return false;
      });
      return {
        heiti: h.heiti, litur: h.litur,
        gildi: dagar.map((d) => {
          if (!virkir.length) return null;
          let alls = 0;
          for (const id of virkir) {
            const r = eftirMidli.get(id).get(d);
            if (!r || r.fylgjendur === null || r.fylgjendur === undefined) return null;
            alls += Number(r.fylgjendur);
          }
          return alls;
        })
      };
    }).filter((r) => r.gildi.some((v) => v !== null));

    const vikur = dagar.length > 120;
    const bilin = [];
    if (vikur) {
      /* Vikur taldar aftur frá síðasta degi, svo síðasta súlan sé heil */
      for (let enda = dagar.length - 1; enda >= 0; enda -= 7) {
        bilin.unshift(dagar.slice(Math.max(0, enda - 6), enda + 1));
      }
    } else {
      dagar.forEach((d) => bilin.push([d]));
    }
    const ahorfsRodir = hopar.map((h) => ({
      heiti: h.heiti, litur: hopar.length > 1 ? h.litur : (sia === 'allir' ? LITUR_ALLS : h.litur),
      gildi: bilin.map((bil) => {
        let alls = 0; let til = false;
        for (const d of bil) for (const id of h.ids) {
          const k = eftirMidli.get(id);
          const r = k && k.get(d);
          if (r && r.ahorf !== null && r.ahorf !== undefined) { alls += Number(r.ahorf); til = true; }
        }
        return til ? alls : null;
      })
    }));
    const ahorfMedGognum = ahorfsRodir.some((r) => r.gildi.some((v) => v !== null));

    const sidast = radir.length ? radir[radir.length - 1] : null;
    const bilTexti = dagsLangt(tb.fra) + ' til ' + dagsLangt(tb.til);

    const faerslurHolf = el('div');

    fylla(hlutar.tolur, [
      el('div', { class: 'tf-siur' }, [
        el('div', { class: 'pflipar tf-flipar', role: 'group', 'aria-label': 'Tímabil' }, TIMABIL.map(([k, heiti]) =>
          el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(timabil === k), texti: heiti,
            onclick: () => { timabil = k; geyma('tolfraedi-timabil', k); teiknaTolur(); teiknaMyndbond(); } }))),
        el('div', { class: 'pflipar tf-flipar', role: 'group', 'aria-label': 'Miðlar' }, [
          el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(sia === 'allir'), texti: 'Allir miðlar',
            onclick: () => { sia = 'allir'; teiknaTolur(); } })
        ].concat(RODMIDLA.filter((k) => midlar.some((m) => m.midill === k)).map((k) =>
          el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(sia === k),
            onclick: () => { sia = k; teiknaTolur(); } }, [
            el('i', { class: 'tf-punktur', style: 'background:' + MIDLAR[k].litur, 'aria-hidden': 'true' }),
            document.createTextNode(MIDLAR[k].heiti)
          ]))))
      ]),

      tolurnar,
      el('p', { class: 'skyring', style: 'margin-top:10px', texti: bilTexti + '. '
        + (sidast ? 'Nýjustu tölur eru frá ' + dagsLangt(sidast.dags) + '.' : 'Engar tölur skráðar ennþá.') }),

      el('section', { class: 'card pblokk tf-blokk' }, [
        el('div', { class: 'pyfir' }, [el('h2', { texti: 'Fylgjendur' })]),
        fylgjendaRodir.length
          ? rit({
              tegund: 'lina', x: dagar, xMerki: (i) => dagsLangt(dagar[i]), rodir: fylgjendaRodir,
              nafn: 'Fylgjendur á dag, ' + bilTexti,
              lysing: 'Línurit yfir fylgjendur á dag, ' + bilTexti + '. ' + fylgjendaRodir.map((r) => {
                const med = r.gildi.filter((v) => v !== null);
                return r.heiti + ': frá ' + tala(med[0]) + ' í ' + tala(med[med.length - 1]);
              }).join('. ') + '.'
            })
          : el('p', { class: 'tomt', texti: 'Engar tölur um fylgjendur á þessu tímabili.' })
      ]),

      el('section', { class: 'card pblokk tf-blokk' }, [
        el('div', { class: 'pyfir' }, [
          el('h2', { texti: vikur ? 'Áhorf á viku' : 'Áhorf á dag' }),
          sAhorf ? el('span', { class: 'pyfir__telja', texti: tala(sAhorf.s) + ' samtals' }) : null
        ]),
        ahorfMedGognum
          ? rit({
              tegund: 'sulur', x: bilin.map((b) => b[0]),
              xMerki: (i) => (vikur
                ? dagsStutt(bilin[i][0]) + ' til ' + dagsStutt(bilin[i][bilin[i].length - 1])
                : dagsLangt(bilin[i][0])),
              rodir: ahorfsRodir,
              nafn: (vikur ? 'Áhorf á viku, ' : 'Áhorf á dag, ') + bilTexti,
              lysing: 'Súlurit yfir áhorf ' + (vikur ? 'á viku' : 'á dag') + ', ' + bilTexti
                + '. Samtals ' + tala(sAhorf ? sAhorf.s : 0) + '.'
            })
          : el('p', { class: 'tomt', texti: 'Engar tölur um áhorf á þessu tímabili.' })
      ]),

      el('section', { class: 'card pblokk tf-blokk' }, [
        el('div', { class: 'pyfir' }, [el('h2', { texti: 'Bestu færslurnar' })]),
        faerslurHolf
      ])
    ]);

    hladaFaerslum(tb, faerslurHolf, ids, sFaer ? null : faerslurTala);
  }

  function kpi(merki, gildi, breyting) {
    return el('div', {}, [
      el('dt', { texti: merki }),
      el('dd', { class: gildi === null ? 'tf-engin' : null, texti: gildi === null ? 'Engin gögn' : gildi }),
      breyting
        ? el('p', { class: 'tf-breyting' + (breyting.att ? ' tf-breyting--' + breyting.att : '') }, [
            breyting.att === 'upp' || breyting.att === 'nidur'
              ? el('span', { 'aria-hidden': 'true', texti: breyting.att === 'upp' ? '▲ ' : '▼ ' }) : null,
            breyting.att === 'upp' || breyting.att === 'nidur'
              ? el('span', { class: 'sr-only', texti: breyting.att === 'upp' ? 'Upp: ' : 'Niður: ' }) : null,
            document.createTextNode(breyting.texti)
          ])
        : null
    ]);
  }

  async function hladaFaerslum(tb, holf, ids, faerslurTala) {
    const min = utgafa;
    const lykill = tb.fra + '|' + tb.til;
    let listi = faerslurMinni.get(lykill);
    if (!listi) {
      fylla(holf, [el('p', { class: 'tomt', texti: 'Sæki færslurnar' })]);
      try {
        listi = await g.midlaFaerslur(fid, tb.fra, tb.til) || [];
      } catch (villa) {
        if (holf.isConnected) fylla(holf, [el('p', { class: 'tomt', texti: villa.message || 'Færslurnar komu ekki.' })]);
        return;
      }
      if (min !== utgafa) return;
      faerslurMinni.set(lykill, listi);
    }
    if (!holf.isConnected) return;
    const hans = listi.filter((p) => ids.has(p.midill_id));
    if (faerslurTala && hans.length) {
      faerslurTala.textContent = tala(hans.length);
      faerslurTala.classList.remove('tf-engin');
    }
    const bestu = hans.slice().sort((a, b) => (Number(b.ahorf) || 0) - (Number(a.ahorf) || 0)).slice(0, 5);
    const midillAf = new Map(midlar.map((m) => [m.id, m]));
    fylla(holf, [bestu.length
      ? el('ol', { class: 'tf-faerslur' }, bestu.map((p) => faerslaLina(p, midillAf.get(p.midill_id))))
      : el('p', { class: 'tomt', texti: 'Engar færslur skráðar á þessu tímabili.' })]);
  }

  function stadgengill(midill) {
    return el('span', { class: 'tf-faersla__mynd tf-faersla__mynd--tom',
                        style: 'background:' + (erMidill(midill) ? MIDLAR[midill].litur : LITUR_ALLS),
                        'aria-hidden': 'true', texti: midilHeiti(midill).slice(0, 1) });
  }

  function faerslaLina(p, m) {
    const midill = m ? m.midill : null;
    const mynd = oruggSlod(p.mynd_slod);
    const slod = oruggSlod(p.slod);
    const samskipti = ['likes', 'athugasemdir', 'deilingar', 'vistanir']
      .map((k) => p[k]).filter((v) => v !== null && v !== undefined);
    const samtals = samskipti.length ? samskipti.reduce((a, v) => a + Number(v), 0) : null;
    const tolur = [
      p.ahorf !== null && p.ahorf !== undefined ? [tala(p.ahorf), 'áhorf'] : null,
      p.nadir !== null && p.nadir !== undefined ? [tala(p.nadir), 'náð'] : null,
      samtals !== null ? [tala(samtals), 'samskipti'] : null
    ].filter(Boolean);

    return el('li', { class: 'tf-faersla' }, [
      mynd
        ? el('img', { class: 'tf-faersla__mynd', src: mynd, alt: '', width: '60', height: '60',
                      loading: 'lazy', referrerpolicy: 'no-referrer',
                      onerror: (e) => e.currentTarget.replaceWith(stadgengill(midill)) })
        : stadgengill(midill),
      el('div', { class: 'tf-faersla__mid' }, [
        el('div', { class: 'tf-faersla__haus' }, [
          el('span', { class: 'tf-faersla__midill', texti: midilHeiti(midill) + (m ? ' ' + m.nafn : '') }),
          el('span', { texti: TEGUNDIR[p.tegund] || 'Færsla' }),
          p.birt ? el('span', { texti: dagsStutt(dagurAfStimpli(p.birt)) }) : null
        ]),
        p.texti ? el('p', { class: 'tf-faersla__texti', texti: String(p.texti).slice(0, 500) }) : null,
        tolur.length
          ? el('div', { class: 'tf-faersla__tolur' }, tolur.map(([t, o]) =>
              el('span', {}, [el('b', { texti: t }), document.createTextNode(' ' + o)])))
          : null
      ]),
      slod
        ? el('a', { class: 'tf-faersla__opna', href: slod, target: '_blank', rel: 'noopener noreferrer',
                    texti: 'Opna', 'aria-label': 'Opna færsluna á ' + midilHeiti(midill) })
        : null
    ]);
  }

  /* ------------------------------------------------------------------
     Mánaðarskýrslur
     ------------------------------------------------------------------ */
  function teiknaSkyrslur() {
    skyrsluHnutar.clear();
    if (!midlar.length && !skyrslur.length) { fylla(hlutar.skyrslur, []); return; }

    fylla(hlutar.skyrslur, [el('section', { class: 'card pblokk tf-blokk' }, [
      el('div', { class: 'pyfir' }, [el('h2', { texti: 'Mánaðarskýrslur' })]),
      el('p', { class: 'skyring', style: 'margin:-6px 0 14px', texti: admin
        ? 'Drög verða til 1. hvers mánaðar. Lestu textann yfir, breyttu ef þarf og samþykktu. Þá fer skýrslan í tölvupósti til ' + fyrNafn() + '.'
        : 'Yfirlit yfir hvern mánuð, það sama og kom í tölvupósti.' }),
      skyrsluVilla
        ? el('p', { class: 'tomt', texti: skyrsluVilla.message || 'Skýrslurnar komu ekki.' })
        : skyrslur.length
          ? el('div', { class: 'tf-skyrslur' }, skyrslur.map((sk, i) => {
              const n = skyrsluHluti(sk, i === 0);
              skyrsluHnutar.set(sk.id, n);
              return n;
            }))
          : el('p', { class: 'tomt', texti: admin
              ? 'Engar skýrslur ennþá. Fyrstu drögin verða til 1. næsta mánaðar.'
              : 'Fyrsta mánaðarskýrslan birtist hér eftir næstu mánaðamót.' })
    ])]);
  }

  function endurteiknaSkyrslu(sk) {
    const gamall = skyrsluHnutar.get(sk.id);
    if (!gamall || !gamall.isConnected) { teiknaSkyrslur(); return; }
    const nyr = skyrsluHluti(sk, gamall.open);
    gamall.replaceWith(nyr);
    skyrsluHnutar.set(sk.id, nyr);
  }

  function stadaSkyrslu(sk) {
    if (sk.stada === 'send') {
      return el('span', { class: 'pstat pstat--ok', texti: 'Sent' + (sk.sent_dags ? ' ' + dagsStutt(dagurAfStimpli(sk.sent_dags)) : '') });
    }
    if (sk.stada === 'samthykkt') {
      return el('span', { class: 'pstat pstat--vinnsla', texti: sk.sent_dags ? 'Sent' : 'Samþykkt, fer út' });
    }
    return el('span', { class: 'pstat pstat--bid', texti: 'Drög' });
  }

  function skyrsluHluti(sk, opin) {
    const forsyn = forskodun(sk);
    return el('details', { class: 'tf-skyrsla', open: opin }, [
      el('summary', {}, [
        el('span', { class: 'tf-skyrsla__man', texti: manHeiti(sk.manudur) }),
        stadaSkyrslu(sk)
      ]),
      el('div', { class: 'tf-skyrsla__inn' }, [
        admin && sk.stada === 'drog' ? ritill(sk, forsyn) : null,
        admin && sk.stada === 'samthykkt' && !sk.sent_dags
          ? el('p', { class: 'skyring', style: 'margin:0 0 12px',
                      texti: 'Samþykkt. Pósturinn fer út innan fárra mínútna.' })
          : null,
        forsyn.node
      ])
    ]);
  }

  function ritill(sk, forsyn) {
    const reitId = 'samantekt-' + String(sk.id).replace(/[^a-zA-Z0-9_]/g, '');
    const svaedi = el('textarea', { id: reitId, rows: '6', maxlength: '4000' });
    svaedi.value = sk.samantekt || '';
    const telja = el('span', { class: 'tf-ritill__telja', texti: svaedi.value.length + ' / 4000' });
    svaedi.addEventListener('input', () => {
      forsyn.setjaTexta(svaedi.value.trim());
      telja.textContent = svaedi.value.length + ' / 4000';
    });
    const stadan = el('div', { class: 'form-status', role: 'status', hidden: true });

    const vistaHn = el('button', {
      type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Vista',
      onclick: async () => {
        vistaHn.disabled = true;
        try {
          const ny = await g.uppfaeraSkyrslu(sk.id, { samantekt: svaedi.value.trim() || null });
          Object.assign(sk, ny || {});
          stadaBod(stadan, 'Vistað.', 'ok');
        } catch (villa) {
          stadaBod(stadan, villa.message || 'Þetta gekk ekki.', 'err');
        } finally {
          vistaHn.disabled = false;
        }
      }
    });
    const sendaHn = el('button', {
      type: 'button', class: 'btn btn--sm', texti: 'Samþykkja og senda',
      onclick: () => stadfestaSendingu(sk, svaedi.value.trim(), stadan)
    });

    return el('div', { class: 'tf-ritill' }, [
      el('div', { class: 'field' }, [
        el('label', { for: reitId, texti: 'Samantekt sem fer í póstinum' }),
        svaedi
      ]),
      el('p', { class: 'skyring tf-ritill__undir' }, [
        document.createTextNode('Tölurnar koma beint úr gögnunum, bara textinn breytist.'), telja
      ]),
      stadan,
      el('div', { class: 'tf-hnappar' }, [vistaHn, sendaHn])
    ]);
  }

  async function stadfestaSendingu(sk, texti, stadanUti) {
    let netfong = null;
    try {
      const notendur = await g.notendur();
      netfong = notendur.filter((n) => n.fyrirtaeki_id === fid && n.hlutverk === 'vidskiptavinur' && n.netfang)
        .map((n) => n.netfang);
    } catch (e) { netfong = null; }

    const stadan = el('div', { class: 'form-status', role: 'status', hidden: true });
    const jaHn = el('button', { type: 'button', class: 'btn btn--sm', texti: 'Samþykkja og senda' });
    const d = opnaSpjald('Senda skýrsluna?', [
      el('p', { class: 'lead', style: 'margin-top:10px; font-size:15.5px',
        texti: 'Mánaðarskýrslan fyrir ' + manHeiti(sk.manudur) + ' fer í tölvupósti til ' + fyrNafn() + '.' }),
      netfong === null
        ? el('p', { class: 'skyring', texti: 'Hún fer til allra notenda fyrirtækisins.' })
        : netfong.length
          ? el('ul', { class: 'tf-netfong' }, netfong.map((n) => el('li', { texti: n })))
          : el('p', { class: 'form-status form-status--err',
              texti: 'Enginn notandi er tengdur fyrirtækinu, svo skýrslan fer ekki út fyrr en einhver er tengdur á stjórnborðinu.' }),
      el('p', { class: 'skyring', texti: 'Eftir þetta breytist skýrslan ekki.' }),
      stadan,
      el('div', { class: 'tf-hnappar', style: 'margin-top:16px' }, [
        jaHn,
        el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Hætta við', onclick: () => d.close() })
      ])
    ], { mjor: true });

    jaHn.addEventListener('click', async () => {
      jaHn.disabled = true;
      jaHn.textContent = 'Augnablik';
      try {
        const ny = await g.uppfaeraSkyrslu(sk.id, { samantekt: texti || null, stada: 'samthykkt' });
        Object.assign(sk, ny || { stada: 'samthykkt' });
        d.close();
        endurteiknaSkyrslu(sk);
        vakta(sk.id);
      } catch (villa) {
        stadaBod(stadan, villa.message || 'Þetta gekk ekki.', 'err');
        jaHn.disabled = false;
        jaHn.textContent = 'Samþykkja og senda';
        if (stadanUti) stadanUti.hidden = true;
      }
    });
  }

  /* Eftir samþykki: líta eftir sent_dags í nokkrar mínútur */
  function vakta(id) {
    clearTimeout(vaktTimi);
    const min = utgafa;
    let skipti = 0;
    const lota = async () => {
      if (min !== utgafa || ++skipti > 36) return;
      try {
        const ny = await g.skyrslur(fid);
        if (min !== utgafa) return;
        const sk = (ny || []).find((x) => x.id === id);
        if (sk) {
          const i = skyrslur.findIndex((x) => x.id === id);
          if (i >= 0) skyrslur[i] = sk;
          if (sk.sent_dags || sk.stada === 'send') { endurteiknaSkyrslu(sk); return; }
        }
      } catch (e) { /* reynum aftur */ }
      vaktTimi = setTimeout(lota, 5000);
    };
    vaktTimi = setTimeout(lota, 3000);
  }

  /* Skýrslan eins og hún lítur út í pósti */
  function forskodun(sk) {
    const t = sk.tolur && typeof sk.tolur === 'object' ? sk.tolur : {};
    const sa = t.samtals && typeof t.samtals === 'object' ? t.samtals : {};
    const fyrriMan = manNafn(manudFra(sk.manudur, -1));
    const til = (v) => v !== null && v !== undefined && isFinite(v);

    const pct = (nu, fyrri) => {
      if (!til(nu) || !til(fyrri) || !Number(fyrri)) return null;
      const p = (nu - fyrri) / fyrri;
      return { texti: prosenta(p) + ' frá ' + fyrriMan, att: Math.abs(p) < 0.0005 ? 'jafnt' : p > 0 ? 'upp' : 'nidur' };
    };
    const reit = (merki, v, br) => el('div', { class: 'tf-postur__reitur' }, [
      el('span', { class: 'tf-postur__merki', texti: merki }),
      el('strong', { texti: til(v) ? tala(v) : 'Engin gögn' }),
      br ? el('span', { class: 'tf-breyting' + (br.att ? ' tf-breyting--' + br.att : '') }, [
        br.att === 'upp' || br.att === 'nidur'
          ? el('span', { 'aria-hidden': 'true', texti: br.att === 'upp' ? '▲ ' : '▼ ' }) : null,
        document.createTextNode(br.texti)
      ]) : null
    ]);

    const fb = sa.fylgjendur_breyting;
    const textinn = el('p', { class: 'tf-postur__texti', texti: sk.samantekt || '', hidden: !sk.samantekt });

    const midlarSk = Array.isArray(t.midlar) ? t.midlar : [];
    const bestu = [];
    midlarSk.forEach((m) => (Array.isArray(m.bestu_faerslur) ? m.bestu_faerslur : [])
      .forEach((p) => bestu.push({ ...p, midill: m.midill, nafn: m.nafn })));
    bestu.sort((a, b) => (Number(b.ahorf) || 0) - (Number(a.ahorf) || 0));

    const engar = !Object.keys(sa).some((k) => til(sa[k])) && !midlarSk.length;

    const node = el('div', { class: 'tf-postur' }, [
      el('div', { class: 'tf-postur__haus' }, [
        el('span', { class: 'tf-postur__merki', texti: 'Mánaðarskýrsla' }),
        el('strong', { texti: manHeiti(sk.manudur) }),
        el('span', { texti: t.fyrirtaeki ? String(t.fyrirtaeki) : fyrNafn() })
      ]),
      engar ? el('p', { class: 'tomt', texti: 'Engar tölur í skýrslunni.' }) : el('div', { class: 'tf-postur__tolur' }, [
        reit('Fylgjendur', sa.fylgjendur_lok, til(fb)
          ? { texti: (fb > 0 ? '+' : '') + tala(fb) + ' í ' + manNafn(sk.manudur), att: fb > 0 ? 'upp' : fb < 0 ? 'nidur' : 'jafnt' }
          : null),
        reit('Áhorf', sa.ahorf, pct(sa.ahorf, sa.ahorf_fyrri)),
        reit('Náð', sa.nadir, pct(sa.nadir, sa.nadir_fyrri)),
        reit('Samskipti', sa.samskipti, pct(sa.samskipti, sa.samskipti_fyrri)),
        reit('Færslur', sa.faerslur, null)
      ]),
      textinn,
      midlarSk.length > 1 ? el('div', { class: 'ptafla-skrun' }, [el('table', { class: 'ptafla tf-postur__tafla' }, [
        el('thead', {}, [el('tr', {}, ['Miðill', 'Fylgjendur', 'Áhorf', 'Náð', 'Samskipti']
          .map((h) => el('th', { scope: 'col', texti: h })))]),
        el('tbody', {}, midlarSk.map((m) => el('tr', {}, [
          el('td', { class: 'nafn', texti: midilHeiti(m.midill) + ' ' + (m.nafn || '') }),
          el('td', { texti: til(m.fylgjendur_lok) ? tala(m.fylgjendur_lok) : '' }),
          el('td', { texti: til(m.ahorf) ? tala(m.ahorf) : '' }),
          el('td', { texti: til(m.nadir) ? tala(m.nadir) : '' }),
          el('td', { texti: til(m.samskipti) ? tala(m.samskipti) : '' })
        ])))
      ])]) : null,
      bestu.length ? el('div', { class: 'tf-postur__bestu' }, [
        el('span', { class: 'tf-postur__merki', texti: 'Mest skoðað' }),
        el('ol', {}, bestu.slice(0, 3).map((p) => {
          const slod = oruggSlod(p.slod);
          const lysing = midilHeiti(p.midill) + ', ' + (TEGUNDIR[p.tegund] || 'Færsla').toLowerCase()
            + (p.birt ? ' ' + dagsStutt(dagurAfStimpli(p.birt)) : '')
            + (til(p.ahorf) ? ': ' + tala(p.ahorf) + ' áhorf' : '');
          return el('li', {}, [
            el('span', { texti: lysing }),
            p.texti ? el('span', { class: 'tf-postur__ftexti', texti: String(p.texti).slice(0, 160) }) : null,
            slod ? el('a', { href: slod, target: '_blank', rel: 'noopener noreferrer', texti: 'Opna' }) : null
          ]);
        }))
      ]) : null
    ]);

    return {
      node,
      setjaTexta(nyr) { textinn.textContent = nyr; textinn.hidden = !nyr; }
    };
  }

  /* ------------------------------------------------------------------
     Miðlar: bara við
     ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------
     Myndböndin: áhorf á mánuði fyrir hvert myndband sem við gerðum.
     Tengt færslu frá Meta fyllist það sjálfkrafa, annars skráð í höndunum.
     ------------------------------------------------------------------ */
  function mbManHeiti(m) { return manNafn(m) + ' ' + String(m).slice(0, 4); }
  function mbSumma(m, fra, til, k) {
    let summa = null;
    for (const t of m.tolur || []) {
      if (t.manudur >= fra && t.manudur <= til && t[k] !== null && t[k] !== undefined) summa = (summa || 0) + Number(t[k]);
    }
    return summa;
  }

  function teiknaMyndbond() {
    if (!fid) return;
    if (!admin && !myndbond.length) { fylla(hlutar.myndbond, []); return; }
    const tb = reiknaTimabil(timabil);
    const fra = fyrstiIMan(tb.fra), til = fyrstiIMan(tb.til);
    const bilTexti = fra === til ? mbManHeiti(fra) : mbManHeiti(fra) + ' til ' + mbManHeiti(til);
    const rodud = myndbond.slice().sort((a, b) => (mbSumma(b, fra, til, 'ahorf') || 0) - (mbSumma(a, fra, til, 'ahorf') || 0));
    const alls = rodud.reduce((a, m) => a + (mbSumma(m, fra, til, 'ahorf') || 0), 0);

    fylla(hlutar.myndbond, [el('section', { class: 'card pblokk tf-blokk tf-mb' }, [
      el('div', { class: 'pyfir' }, [
        el('h2', { texti: 'Myndböndin' }),
        admin ? el('button', { type: 'button', class: 'btn btn--sm', texti: 'Nýtt myndband', onclick: () => opnaMyndband({}) }) : null
      ]),
      el('p', { class: 'skyring', style: 'margin:-6px 0 12px',
        texti: (admin
          ? 'Hvert myndband sem við gerðum fyrir ' + fyrNafn() + ', með áhorfi á mánuði. Tengt færslu frá Instagram eða Facebook fyllist það sjálfkrafa. Annars skráirðu tölurnar í höndunum.'
          : 'Myndböndin sem við gerðum fyrir ykkur og áhorfið á þau.')
          + ' Tölurnar hér eru fyrir ' + bilTexti + '.' }),
      myndbandaVilla ? el('p', { class: 'tomt', texti: myndbandaVilla.message || 'Náði ekki í myndböndin.' }) : null,
      !myndbandaVilla && !rodud.length ? el('p', { class: 'tomt', texti: 'Ekkert myndband skráð ennþá. Ýttu á Nýtt myndband til að byrja.' }) : null,
      rodud.length ? el('div', { class: 'tf-mb__samtals' }, [
        el('span', { texti: rodud.length === 1 ? '1 myndband' : rodud.length + ' myndbönd' }),
        el('strong', { texti: tala(alls) + ' áhorf' }),
        el('span', { texti: bilTexti })
      ]) : null,
      rodud.length ? el('ul', { class: 'tf-mb__listi' }, rodud.map((m) => {
        const a = mbSumma(m, fra, til, 'ahorf');
        const heild = mbSumma(m, '0000-01-01', '9999-12-31', 'ahorf');
        const likes = mbSumma(m, fra, til, 'likes');
        const slod = oruggSlod(m.slod);
        const stopp = alls > 0 && a ? Math.max(3, Math.round(a / alls * 100)) : 0;
        return el('li', { class: 'tf-mb__lina' }, [
          el('div', { class: 'tf-mb__mid' }, [
            admin
              ? el('button', { type: 'button', class: 'tf-mb__titill', texti: m.titill, onclick: () => opnaMyndband(m) })
              : el('span', { class: 'tf-mb__titill', texti: m.titill }),
            el('div', { class: 'tf-mb__undir' }, [
              el('span', { texti: ({ instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube' })[m.midill] || 'Annað' }),
              m.birt ? el('span', { texti: 'Birt ' + dagsStutt(m.birt) }) : null,
              el('span', { class: 'tf-mb__uppruni' + (m.faersla_id ? ' er-sjalfvirkt' : ''), texti: m.faersla_id ? 'Sjálfvirkt' : 'Handvirkt' }),
              slod ? el('a', { href: slod, target: '_blank', rel: 'noopener noreferrer', texti: 'Horfa' }) : null
            ]),
            el('span', { class: 'tf-mb__stika', 'aria-hidden': 'true' }, [el('i', { style: 'width:' + stopp + '%' })])
          ]),
          el('div', { class: 'tf-mb__tolur' }, [
            el('strong', { texti: a === null ? 'Engar tölur' : tala(a) + ' áhorf' }),
            el('span', { texti: [likes !== null ? tala(likes) + ' líkar' : '', heild !== null && heild !== a ? tala(heild) + ' alls' : ''].filter(Boolean).join(' · ') || ' ' }),
            admin ? el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Skrá tölur', onclick: () => opnaMyndband(m, true) }) : null
          ])
        ]);
      })) : null
    ])]);
  }

  /* Spjaldið: upplýsingar um myndbandið og tölurnar mánuð fyrir mánuð */
  async function opnaMyndband(m, beintITolur) {
    const nytt = !m.id;
    const kort = el('div', { style: 'margin-top:14px' });
    const d = opnaSpjald(nytt ? 'Nýtt myndband' : m.titill, [kort]);
    const stadan = el('div', { class: 'form-status', role: 'status', hidden: true });

    /* Færslur frá Meta sem má tengja (myndbönd og reels síðustu 2 árin) */
    let faerslur = [];
    try { faerslur = (await g.midlaFaerslur(fid, plusDagar(idag(), -730), idag())) || []; } catch (villa) { faerslur = []; }
    faerslur = faerslur.filter((f) => ['myndband', 'reel'].includes(f.tegund) || f.id === m.faersla_id)
      .sort((a, b) => String(b.birt || '').localeCompare(String(a.birt || '')));

    const titill = el('input', { type: 'text', required: true, maxlength: '120', value: m.titill || '', placeholder: 'Til dæmis Vetrarnámskeiðin kynnt' });
    const midill = el('select', {}, [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['annad', 'Annað']]
      .map(([k, h]) => el('option', { value: k, selected: (m.midill || 'instagram') === k, texti: h })));
    const slod = el('input', { type: 'url', maxlength: '2000', value: m.slod || '', placeholder: 'https://', autocomplete: 'off' });
    const birt = el('input', { type: 'date', value: m.birt || '' });
    const tengja = el('select', {}, [el('option', { value: '', texti: 'Ekki tengt: ég skrái tölurnar sjálf(ur)' })].concat(
      /* Tengd færsla sem er ekki í listanum (eldri en 2 ára) helst tengd */
      m.faersla_id && !faerslur.some((f) => f.id === m.faersla_id)
        ? [el('option', { value: m.faersla_id, selected: true, texti: 'Tengt færslu, tölurnar koma sjálfkrafa' })] : [],
      faerslur.map((f) => el('option', { value: f.id, selected: f.id === m.faersla_id,
        texti: [midilHeiti((midlar.find((x) => x.id === f.midill_id) || {}).midill), f.birt ? dagsStutt(f.birt) : '',
                String(f.texti || '').trim().slice(0, 50) || TEGUNDIR[f.tegund] || 'Færsla', f.ahorf != null ? tala(f.ahorf) + ' áhorf' : '']
          .filter(Boolean).join(' · ') }))));

    let stadfest = false;
    const eydaHn = nytt ? null : el('button', { type: 'button', class: 'spjald__eyda', texti: 'Eyða myndbandi',
      onclick: async () => {
        if (!stadfest) {
          stadfest = true; eydaHn.textContent = 'Ýttu aftur: tölurnar hverfa líka'; eydaHn.classList.add('er-vis');
          setTimeout(() => { stadfest = false; if (eydaHn.isConnected) { eydaHn.textContent = 'Eyða myndbandi'; eydaHn.classList.remove('er-vis'); } }, 5000);
          return;
        }
        eydaHn.disabled = true;
        try { await g.eydaMyndbandi(m.id); myndbond = myndbond.filter((x) => x.id !== m.id); d.close(); teiknaMyndbond(); }
        catch (villa) { stadaBod(stadan, villa.message || 'Þetta gekk ekki.', 'err'); eydaHn.disabled = false; }
      } });

    /* Tölurnar: einn mánuður í línu, frá birtingu (mest 12) til þessa mánaðar */
    const nuM = fyrstiIMan(idag());
    const fyrsti = m.birt ? fyrstiIMan(m.birt) : manudFra(nuM, -2);
    const manudir = [];
    for (let x = nuM; x >= fyrsti && manudir.length < 12; x = manudFra(x, -1)) manudir.push(x);
    const linur = manudir.map((man) => {
      const t = (m.tolur || []).find((r) => r.manudur === man) || {};
      const sjalf = t.uppruni === 'sjalfvirkt';
      const inntok = {};
      const reitir = [['ahorf', 'Áhorf'], ['likes', 'Líkar'], ['athugasemdir', 'Athugasemdir'], ['deilingar', 'Deilingar'], ['vistanir', 'Vistanir']].map(([k, h]) => {
        inntok[k] = el('input', { type: 'text', inputmode: 'numeric', 'aria-label': h + ' í ' + mbManHeiti(man), placeholder: '0',
          value: t[k] === null || t[k] === undefined ? '' : String(t[k]), disabled: sjalf ? true : null, class: 'tf-mb__reitur' });
        return el('td', {}, [inntok[k]]);
      });
      const breytaHn = sjalf ? el('button', { type: 'button', class: 'tf-mb__breyta', texti: 'Breyta', title: 'Skrá þennan mánuð í höndunum',
        onclick: (e) => { Object.values(inntok).forEach((i) => { i.disabled = false; }); lina.dataset.breytt = '1'; e.currentTarget.remove(); inntok.ahorf.focus(); } }) : null;
      const lina = el('tr', { 'data-manudur': man }, [
        el('th', { scope: 'row' }, [el('span', { texti: mbManHeiti(man) }), sjalf ? el('small', { class: 'tf-mb__sjalf', texti: 'Sjálfvirkt' }) : null, breytaHn])
      ].concat(reitir));
      lina._inntok = inntok; lina._var = t; lina._sjalf = sjalf;
      return lina;
    });
    const tafla = el('div', { class: 'tf-mb__tafla-svid' }, [el('table', { class: 'tf-mb__tafla' }, [
      el('thead', {}, [el('tr', {}, [el('th', { texti: 'Mánuður' })].concat(['Áhorf', 'Líkar', 'Athugas.', 'Deilingar', 'Vistanir'].map((h) => el('th', { texti: h }))))]),
      el('tbody', {}, linur)
    ])]);

    const vistaHn = el('button', { type: 'submit', class: 'btn btn--sm', texti: nytt ? 'Vista myndband' : 'Vista' });
    const form = el('form', { class: 'tf-form', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      const t = titill.value.trim();
      const sl = slod.value.trim();
      if (!t) { stadaBod(stadan, 'Titilinn vantar.', 'err'); titill.focus(); return; }
      if (sl && !oruggSlod(sl)) { stadaBod(stadan, 'Slóðin þarf að byrja á https:// og vera án bila.', 'err'); slod.focus(); return; }
      /* Tölurnar: bara línur sem eru skráðar í höndunum og hafa breyst */
      const rodir = [];
      for (const lina of linur) {
        if (lina._sjalf && !lina.dataset.breytt) continue;
        const r = { manudur: lina.dataset.manudur };
        let villa = null, eitthvad = false, breytt = false;
        for (const [k, inp] of Object.entries(lina._inntok)) {
          const v = inp.value.replace(/[.\s]/g, '').trim();
          if (v && !/^\d{1,12}$/.test(v)) { villa = inp; break; }
          r[k] = v === '' ? null : Number(v);
          if (v !== '') eitthvad = true;
          const fyrra = lina._var[k] === null || lina._var[k] === undefined ? null : Number(lina._var[k]);
          if (r[k] !== fyrra) breytt = true;
        }
        if (villa) { stadaBod(stadan, 'Tölur mega bara vera heilar tölur, til dæmis 12400.', 'err'); villa.focus(); return; }
        if (breytt && (eitthvad || lina._var.manudur)) rodir.push({ ...r, tomt: !eitthvad });
      }
      vistaHn.disabled = true;
      try {
        const upp = { titill: t, midill: midill.value, slod: sl || null, birt: birt.value || null, faersla_id: tengja.value || null };
        const vistad = nytt ? await g.nyttMyndband({ ...upp, fyrirtaeki_id: fid }) : await g.uppfaeraMyndband(m.id, upp);
        const id = vistad.id;
        const skra = rodir.filter((r) => !r.tomt).map((r) => ({ ...r, myndband_id: id }));
        if (skra.length) await g.vistaMyndbandstolur(skra);
        for (const r of rodir.filter((r) => r.tomt)) await g.eydaMyndbandstolu(id, r.manudur);
        myndbond = await g.myndbond(fid) || [];
        d.close();
        teiknaMyndbond();
      } catch (villa) {
        stadaBod(stadan, villa.message || 'Þetta gekk ekki.', 'err');
        vistaHn.disabled = false;
      }
    } }, [
      el('div', { class: 'field-row' }, [reitur('Titill', titill), reitur('Miðill', midill)]),
      el('div', { class: 'field-row' }, [reitur('Slóð á myndbandið (valfrjálst)', slod), reitur('Birt', birt)]),
      reitur('Sækja tölurnar sjálfkrafa úr færslu', tengja),
      el('p', { class: 'skyring', style: 'margin-top:-8px', texti: faerslur.length
        ? 'Veldu færsluna á Instagram eða Facebook og áhorfið fyllist á hverjum morgni. Mánuð sem þú skráir í höndunum lætur kerfið í friði.'
        : 'Engar myndbandsfærslur hafa komið frá Meta ennþá. Skráðu tölurnar í höndunum hér fyrir neðan.' }),
      el('div', { class: 'tf-mb__tolur-haus' }, [el('strong', { texti: 'Tölur á mánuði' }),
        el('span', { class: 'skyring', texti: 'Áhorfið í hverjum mánuði fyrir sig, ekki samtals. Tómt þýðir engin tala.' })]),
      tafla,
      stadan,
      el('div', { class: 'spjald__fot' }, [vistaHn, eydaHn])
    ]);
    fylla(kort, [form]);
    if (beintITolur) setTimeout(() => { const fyrsta = linur.find((l) => !l._sjalf); if (fyrsta) fyrsta._inntok.ahorf.focus(); }, 60);
    else setTimeout(() => titill.focus(), 60);
  }

  function teiknaMidla() {
    if (!admin || !midlar.length) { fylla(hlutar.midlar, []); return; }
    const stadan = el('div', { class: 'form-status', role: 'status', hidden: true });
    const sidastaMaeling = new Map();
    for (const r of maelingar) sidastaMaeling.set(r.midill_id, r.dags);

    fylla(hlutar.midlar, [el('section', { class: 'card pblokk tf-blokk' }, [
      el('div', { class: 'pyfir' }, [
        el('h2', { texti: 'Miðlar' }),
        el('div', { class: 'tf-hnappar' }, [
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Skrá dag', onclick: () => opnaDag() }),
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Flytja inn CSV', onclick: () => opnaCsv() }),
          el('button', { type: 'button', class: 'btn btn--sm', texti: 'Nýr miðill', onclick: () => opnaMidil({}) })
        ])
      ]),
      el('p', { class: 'skyring', style: 'margin:-6px 0 8px',
        texti: 'Instagram og Facebook með auðkenni safnast sjálfkrafa á hverjum morgni. TikTok og miðlar án auðkennis eru skráðir í höndunum eða fluttir inn úr CSV. Handskráðar tölur víkja aldrei fyrir sjálfvirkum.' }),
      stadan,
      el('ul', { class: 'tasklisti' }, midlar.map((m) => {
        const sjalfvirkt = !!m.ytra_id && m.midill !== 'tiktok';
        const slod = oruggSlod(m.slod);
        const sidast = sidastaMaeling.get(m.id);
        return el('li', {}, [el('div', { class: 'task' + (m.virkt ? '' : ' tf-ovirkt') }, [
          el('i', { class: 'tf-punktur tf-punktur--stor', 'aria-hidden': 'true',
                    style: 'background:' + (erMidill(m.midill) ? MIDLAR[m.midill].litur : LITUR_ALLS) }),
          el('div', { class: 'task__mid' }, [
            el('button', { type: 'button', class: 'task__titill', texti: midilHeiti(m.midill) + ': ' + m.nafn,
                           onclick: () => opnaMidil(m) }),
            el('div', { class: 'task__undir' }, [
              el('span', { texti: sjalfvirkt ? 'Sjálfvirk söfnun' : 'Handvirkt' }),
              m.ytra_id ? el('span', { texti: 'Auðkenni ' + m.ytra_id }) : null,
              el('span', { texti: sidast ? 'Síðast ' + dagsStutt(sidast) : 'Engar tölur ennþá' }),
              slod ? el('a', { href: slod, target: '_blank', rel: 'noopener noreferrer', texti: 'Opna síðuna' }) : null
            ])
          ]),
          el('div', { class: 'task__hofn' }, [
            el('button', {
              type: 'button', class: 'pstat pstat--' + (m.virkt ? 'ok' : 'hafnad') + ' tf-rofi',
              'aria-pressed': String(!!m.virkt),
              title: m.virkt ? 'Slökkva á söfnun' : 'Kveikja á söfnun',
              texti: m.virkt ? 'Virkt' : 'Óvirkt',
              onclick: async (e) => {
                e.currentTarget.disabled = true;
                try {
                  const ny = await g.uppfaeraMidil(m.id, { virkt: !m.virkt });
                  Object.assign(m, ny || { virkt: !m.virkt });
                  teiknaMidla();
                } catch (villa) {
                  stadaBod(stadan, villa.message || 'Þetta gekk ekki.', 'err');
                  e.currentTarget.disabled = false;
                }
              }
            })
          ])
        ])]);
      }))
    ])]);
  }

  /* Form fyrir nýjan miðil eða breytingu. Í tóma spjaldinu stendur það
     eitt og sér, annars í spjaldi (dialog). */
  function midilsForm(m, d) {
    const velja = el('select', { required: true }, RODMIDLA.map((k) =>
      el('option', { value: k, selected: (m.midill || 'instagram') === k, texti: MIDLAR[k].heiti })));
    const nafn = el('input', { type: 'text', required: true, maxlength: '120', value: m.nafn || '',
                               placeholder: 'Til dæmis nafnid_okkar', autocomplete: 'off' });
    const ytra = el('input', { type: 'text', maxlength: '100', value: m.ytra_id || '',
                               autocomplete: 'off', spellcheck: 'false' });
    const slod = el('input', { type: 'url', maxlength: '500', value: m.slod || '',
                               placeholder: 'https://', autocomplete: 'off' });
    const hjalp = el('p', { class: 'skyring', style: 'margin-top:-8px' });
    const uppfaeraHjalp = () => {
      hjalp.textContent = velja.value === 'instagram'
        ? 'Auðkenni Instagram reikningsins, löng tala sem byrjar oft á 1784. Hún finnst eins og lýst er í LESTU-MIG, kaflanum Tölfræði. Tómt þýðir að tölurnar eru skráðar í höndunum.'
        : velja.value === 'facebook'
          ? 'Page ID síðunnar. Það finnst á síðunni sjálfri undir Um, eða í Meta Business Suite undir Stillingar. Tómt þýðir að tölurnar eru skráðar í höndunum.'
          : 'TikTok safnast ekki sjálfkrafa ennþá. Skildu reitinn eftir tóman og skráðu tölurnar í höndunum eða úr CSV.';
    };
    velja.addEventListener('change', uppfaeraHjalp);
    uppfaeraHjalp();

    const stadan = el('div', { class: 'form-status', role: 'status', hidden: true });
    let stadfest = false;
    const eydaHn = m.id ? el('button', {
      type: 'button', class: 'spjald__eyda', texti: 'Eyða',
      onclick: async () => {
        if (!stadfest) {
          stadfest = true;
          eydaHn.textContent = 'Ýttu aftur: allar tölur miðilsins hverfa';
          eydaHn.classList.add('er-vis');
          setTimeout(() => {
            stadfest = false;
            if (eydaHn.isConnected) { eydaHn.textContent = 'Eyða'; eydaHn.classList.remove('er-vis'); }
          }, 5000);
          return;
        }
        eydaHn.disabled = true;
        try {
          await g.eydaMidli(m.id);
          midlar = midlar.filter((x) => x.id !== m.id);
          maelingar = maelingar.filter((r) => r.midill_id !== m.id);
          faerslurMinni.clear();
          if (d) d.close();
          if (sia !== 'allir' && !midlar.some((x) => x.midill === sia)) sia = 'allir';
          teiknaAllt();
        } catch (villa) {
          stadaBod(stadan, villa.message || 'Þetta gekk ekki.', 'err');
          eydaHn.disabled = false;
        }
      }
    }) : null;

    const vistaHn = el('button', { type: 'submit', class: 'btn btn--sm', texti: m.id ? 'Vista' : 'Tengja miðil' });

    return el('form', {
      class: 'tf-form', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const n = nafn.value.trim();
        const y = ytra.value.trim();
        const sl = slod.value.trim();
        if (!n || n.length > 120) { stadaBod(stadan, 'Nafnið vantar.', 'err'); nafn.focus(); return; }
        if (y && !/^[A-Za-z0-9_.:-]{1,100}$/.test(y)) {
          stadaBod(stadan, 'Auðkennið má bara hafa tölustafi og bókstafi, án bila.', 'err'); ytra.focus(); return;
        }
        if (sl && (!oruggSlod(sl) || sl.length > 500)) {
          stadaBod(stadan, 'Slóðin þarf að byrja á https:// og vera án bila.', 'err'); slod.focus(); return;
        }
        vistaHn.disabled = true;
        try {
          const gogn_ = { midill: velja.value, nafn: n, ytra_id: y || null, slod: sl || null };
          if (m.id) await g.uppfaeraMidil(m.id, gogn_);
          else await g.nyrMidill({ ...gogn_, fyrirtaeki_id: fid, virkt: true });
          midlar = await g.midlar(fid);
          if (d) d.close();
          teiknaAllt();
        } catch (villa) {
          stadaBod(stadan, villa.message || 'Þetta gekk ekki.', 'err');
          vistaHn.disabled = false;
        }
      }
    }, [
      el('div', { class: 'field-row' }, [reitur('Miðill', velja), reitur('Nafn á reikningi eða síðu', nafn)]),
      reitur('Auðkenni hjá miðlinum (valfrjálst)', ytra),
      hjalp,
      reitur('Slóð á síðuna (valfrjálst)', slod),
      stadan,
      el('div', { class: 'spjald__fot' }, [vistaHn, eydaHn])
    ]);
  }

  function opnaMidil(m) {
    const kort = el('div', { style: 'margin-top:18px' });
    const d = opnaSpjald(m.id ? midilHeiti(m.midill) + ': ' + m.nafn : 'Nýr miðill', [kort]);
    fylla(kort, [midilsForm(m, d)]);
  }

  /* Velja miðil í spjöldunum */
  function midlaval() {
    return el('select', {}, midlar.map((m) => el('option', { value: m.id, texti: midilHeiti(m.midill) + ': ' + m.nafn })));
  }

  /* Ein dagsmæling í höndunum */
  function opnaDag() {
    const velja = midlaval();
    const dagur = el('input', { type: 'date', value: plusDagar(idag(), -1), max: idag(), required: true });
    const reitir = {};
    MAELITOLUR.forEach((k) => { reitir[k] = talnareitur(null); });
    const stadan = el('div', { class: 'form-status', role: 'status', hidden: true });

    const fyllaUt = () => {
      const r = maelingar.find((x) => x.midill_id === velja.value && String(x.dags).slice(0, 10) === dagur.value);
      MAELITOLUR.forEach((k) => {
        reitir[k].value = r && r[k] !== null && r[k] !== undefined ? tala(r[k]) : '';
      });
    };
    velja.addEventListener('change', fyllaUt);
    dagur.addEventListener('change', fyllaUt);
    fyllaUt();

    const vistaHn = el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Vista' });
    const d = opnaSpjald('Skrá dag', [el('form', {
      class: 'tf-form', style: 'margin-top:18px', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dagur.value) || dagur.value > idag()) {
          stadaBod(stadan, 'Veldu dag, í dag eða fyrr.', 'err'); dagur.focus(); return;
        }
        const lina = { midill_id: velja.value, dags: dagur.value, uppruni: 'handvirkt' };
        let eitthvad = false;
        MAELITOLUR.forEach((k) => {
          const v = lesaTolu(reitir[k].value);
          if (v !== null) { lina[k] = v; eitthvad = true; }
        });
        if (!eitthvad) { stadaBod(stadan, 'Settu inn minnst eina tölu.', 'err'); return; }
        vistaHn.disabled = true;
        try {
          await g.vistaMaelingar([lina]);
          await hladaMaelingum();
          d.close();
          teiknaTolur();
          teiknaMidla();
        } catch (villa) {
          stadaBod(stadan, villa.message || 'Þetta gekk ekki.', 'err');
          vistaHn.disabled = false;
        }
      }
    }, [
      el('div', { class: 'field-row' }, [reitur('Miðill', velja), reitur('Dagur', dagur)]),
      el('div', { class: 'tf-talnareitir' }, MAELITOLUR.map((k) => reitur(TOLUHEITI[k], reitir[k]))),
      el('p', { class: 'skyring', style: 'margin-top:-6px',
        texti: 'Tómur reitur breytir engu. Handskráðar tölur víkja ekki fyrir sjálfvirkri söfnun.' }),
      stadan,
      el('div', { class: 'spjald__fot' }, [vistaHn])
    ])]);
  }

  /* CSV innflutningur: límt eða úr skrá, forskoðun fyrst */
  function opnaCsv() {
    const velja = midlaval();
    const svaedi = el('textarea', { rows: '6', spellcheck: 'false', class: 'tf-csv',
      placeholder: 'dags;fylgjendur;áhorf;náð\n2026-11-01;4512;2300;1500' });
    const skra = el('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv,text/plain', class: 'sr-only' });
    const skraHn = el('label', { class: 'btn btn--sm btn--ghost' }, [document.createTextNode('Velja skrá'), skra]);
    const forsyn = el('div', { class: 'tf-csv__forsyn', 'aria-live': 'polite' });
    const stadan = el('div', { class: 'form-status', role: 'status', hidden: true });
    const vistaHn = el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Vista', disabled: true });
    let greint = null;
    let bid = null;

    const greina = () => {
      stadan.hidden = true;
      greint = svaedi.value.trim() ? lesaCsv(svaedi.value) : null;
      vistaHn.disabled = !(greint && greint.radir);
      if (!greint) { fylla(forsyn, []); vistaHn.textContent = 'Vista'; return; }
      if (greint.villa) {
        fylla(forsyn, [el('p', { class: 'form-status form-status--err', texti: greint.villa })]);
        vistaHn.textContent = 'Vista';
        return;
      }
      const r = greint.radir;
      vistaHn.textContent = 'Vista ' + tala(r.length) + (eittDag(r.length) ? ' dag' : ' daga');
      fylla(forsyn, [
        el('p', { class: 'skyring', style: 'margin-top:0', texti: 'Fann ' + tala(r.length)
          + (eittDag(r.length) ? ' dag' : ' daga') + ', frá ' + dagsLangt(r[0].dags) + ' til '
          + dagsLangt(r[r.length - 1].dags) + '. Dálkar: ' + greint.tolur.map((k) => TOLUHEITI[k]).join(', ') + '.'
          + (greint.ogild ? ' ' + tala(greint.ogild) + ' línum var sleppt, þær vantaði dagsetningu eða tölu.' : '') }),
        el('div', { class: 'ptafla-skrun' }, [el('table', { class: 'ptafla tf-csv__tafla' }, [
          el('thead', {}, [el('tr', {}, [el('th', { scope: 'col', texti: 'Dagur' })]
            .concat(greint.tolur.map((k) => el('th', { scope: 'col', texti: TOLUHEITI[k] }))))]),
          el('tbody', {}, r.slice(0, 8).map((x) => el('tr', {}, [el('td', { texti: dagsLangt(x.dags) })]
            .concat(greint.tolur.map((k) => el('td', { texti: x.gildi[k] !== undefined ? tala(x.gildi[k]) : '' }))))))
        ])]),
        r.length > 8 ? el('p', { class: 'skyring', texti: tala(r.length - 8) + ' í viðbót.' }) : null
      ]);
    };
    svaedi.addEventListener('input', () => { clearTimeout(bid); bid = setTimeout(greina, 250); });
    skra.addEventListener('change', () => {
      const f = skra.files && skra.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { stadaBod(stadan, 'Skráin er stærri en 2 MB.', 'err'); return; }
      const lesari = new FileReader();
      lesari.onload = () => { svaedi.value = String(lesari.result || ''); greina(); };
      lesari.onerror = () => stadaBod(stadan, 'Náði ekki að lesa skrána.', 'err');
      lesari.readAsText(f);
    });

    const d = opnaSpjald('Flytja inn CSV', [el('form', {
      class: 'tf-form', style: 'margin-top:18px', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        if (!greint || !greint.radir) return;
        vistaHn.disabled = true;
        try {
          const n = await g.vistaMaelingar(greint.radir.map((r) => ({
            midill_id: velja.value, dags: r.dags, ...r.gildi, uppruni: 'innflutt'
          })));
          await hladaMaelingum();
          teiknaTolur();
          teiknaMidla();
          stadaBod(stadan, 'Vistað: ' + tala(n) + (eittDag(n) ? ' dagur.' : ' dagar.'), 'ok');
          vistaHn.textContent = 'Loka';
          vistaHn.disabled = false;
          vistaHn.type = 'button';
          vistaHn.onclick = () => d.close();
        } catch (villa) {
          stadaBod(stadan, villa.message || 'Þetta gekk ekki.', 'err');
          vistaHn.disabled = false;
        }
      }
    }, [
      reitur('Miðill', velja),
      el('div', { class: 'field' }, [
        el('span', { texti: 'Límdu tölurnar hér eða veldu skrá' }),
        svaedi
      ]),
      el('div', { class: 'tf-hnappar' }, [skraHn]),
      el('p', { class: 'skyring', style: 'margin-top:-6px',
        texti: 'Fyrsta línan eru dálkaheiti, á íslensku eða ensku: dags eða date, fylgjendur eða followers, áhorf eða views, náð eða reach, samskipti eða interactions. Dagar sem eru til fyrir fá nýju tölurnar, tómur reitur breytir engu.' }),
      forsyn,
      stadan,
      el('div', { class: 'spjald__fot' }, [vistaHn])
    ])]);
  }
}
