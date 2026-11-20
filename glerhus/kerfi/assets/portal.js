/* ==========================================================================
   Glerhúsið: sameiginlegt
   ========================================================================== */

import { gogn, STODUR_TASK, STODUR_VERK, STODUR_INNRI, FORGANGUR } from './gogn.js';
import { stillingar } from './stillingar.js';
import { undirverkHluti, undirverkTala } from './undirverk.js';

/* Kom fólk inn með hlekk úr pósti? Supabase les slóðina og hreinsar hana
   um leið og það ræsir, svo við lítum á hana fyrst. Geymt í flipanum því
   admin er sendur áfram af yfirliti á stjórnborðið og slóðin týnist. */
try {
  const h = location.hash || '';
  if (/access_token=/.test(h) && /type=(magiclink|invite|signup)/.test(h)) {
    sessionStorage.setItem('tveir-kom-med-hlekk', 'ja');
  }
  if (/error_code=/.test(h)) {
    sessionStorage.setItem('tveir-hlekkjavilla',
      new URLSearchParams(h.slice(1)).get('error_code') || 'villa');
  }
} catch (e) { /* lokað sessionStorage */ }

/* ------------------------------------------------------------------
   Smáhjálp
   ------------------------------------------------------------------ */
/* Valið úr "Settu saman ykkar kerfi" (byggja.html), ef gesturinn kom þaðan */
export const sersnid = (() => {
  try { const x = JSON.parse(localStorage.getItem('glerhus-tveir-byggja') || 'null'); return x && x.buid ? x : null; }
  catch (e) { return null; }
})();
/* Íþróttafólk og áhrifavaldar fá sitt eigið kerfi í sýnidæminu (persona.js) */
export const erPersona = () => !!sersnid && ['ithrottir', 'ahrif'].includes(sersnid.grein);
/* Verktakar og lítil fyrirtæki fá Tilboð og Myndir í sýnidæminu (verktaki.js) */
export const erVerktaki = () => !!sersnid && ['verktaki', 'fyrirtaeki'].includes(sersnid.grein);
/* Lítil fyrirtæki fá sitt eigið yfirlit (fyrirtaeki.html), verktakar byrja á Tilboðum */
export const erFyrirtaeki = () => !!sersnid && sersnid.grein === 'fyrirtaeki';
const erBaraVerktaki = () => !!sersnid && sersnid.grein === 'verktaki';
/* Fyrsta síðan í sýnidæmi hvers hóps. Stofurnar byrja á Stjórnborðinu. */
export const upphafssida = () => (erPersona() ? 'mitt.html' : erFyrirtaeki() ? 'fyrirtaeki.html'
  : erBaraVerktaki() ? 'tilbod.html' : 'stjornbord.html');
if (sersnid && /(^|\/)stjornbord\.html$/.test(location.pathname) && upphafssida() !== 'stjornbord.html') {
  location.replace(upphafssida() + location.search);
}
export const ertengt = (id) => !!sersnid && (sersnid.tengingar || []).includes(id);
/* Í sýnidæminu birtist nákvæmlega það sem gesturinn valdi, ekkert annað */
export const ervalid = (id) => !sersnid || (sersnid.einingar || []).includes(id);
export const bokhaldskerfi = () => (ertengt('payday') ? 'Payday' : ertengt('dk') ? 'DK' : null);
const TENGINGAR_HEITI = {
  gmail: ['Gmail', 'Póstur á verk-netfangið verður að verkum og lokið-pósturinn fer héðan'],
  facebook: ['Facebook', 'Áhorf og fylgjendur síðunnar koma inn á hverjum morgni'],
  instagram: ['Instagram', 'Áhorf, heimsóknir og fylgjendur koma inn á hverjum morgni'],
  googlecalendar: ['Google Calendar', 'Fundirnir koma á dagatalið, við hlið skiladaga'],
  tiktok: ['TikTok', 'Tölurnar skráðar í höndunum eða úr skrá'],
  dk: ['DK', 'Lokin verk og samningar verða að reikningum í DK'],
  payday: ['Payday', 'Lokin verk og samningar verða að reikningum í Payday'],
  shopify: ['Shopify', 'Pantanir og sala úr vefversluninni'],
  claude: ['Claude', 'Gervigreind sem skrifar drög að svörum og samantektum'],
  chatgpt: ['ChatGPT', 'Gervigreind sem skrifar drög að svörum og samantektum']
};
/* Tengingar sem eru ekki tilbúnar í alvöru aðganginum */
const TENGINGAR_SMIDI = ['dk', 'payday', 'shopify', 'claude', 'chatgpt'];
/* Tengingarnar sem gesturinn valdi, sem glerspjald */
export function tengingaSpjald() {
  const valdar = sersnid ? (sersnid.tengingar || []).filter((t) => TENGINGAR_HEITI[t]) : [];
  if (!valdar.length) return null;
  return el('div', { class: 'card pblokk gh-teng' }, [
    el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500', texti: 'Tengingar' }),
    el('ul', {}, valdar.map((t, i) => el('li', { style: '--d:' + (200 + i * 180) + 'ms' }, [
      el('b', { texti: TENGINGAR_HEITI[t][0] }),
      el('span', { texti: TENGINGAR_HEITI[t][1] }),
      el('em', { texti: TENGINGAR_SMIDI.includes(t) ? 'Í smíðum' : t === 'tiktok' ? 'Handvirkt' : 'Tengt' })
    ])))
  ]);
}
/* Lítil tilkynning neðst á skjánum */
export function tilkynna(texti) {
  let svid = document.querySelector('.gh-tk-svid');
  if (!svid) { svid = el('div', { class: 'gh-tk-svid', 'aria-live': 'polite' }); document.body.appendChild(svid); }
  const t = el('div', { class: 'gh-tk' }, [el('i', { 'aria-hidden': 'true' }), el('span', { texti })]);
  svid.appendChild(t);
  setTimeout(() => { t.classList.add('er-farin'); setTimeout(() => t.remove(), 400); }, 3800);
}
/* Litur stofunnar: áherslan, dekkri útgáfa fyrir texta á ljósu og
   texti ofan á litnum sem sést (dökkur á gulu, hvítur á dökku) */
if (sersnid && /^#[0-9a-f]{6}$/i.test(sersnid.litur || '')) {
  const l = sersnid.litur;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(l.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const birta = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const s = document.documentElement.style;
  s.setProperty('--acc', l);
  s.setProperty('--acc-hover', 'color-mix(in srgb, ' + l + ' 86%, #000)');
  s.setProperty('--acc-on-navy', l);
  s.setProperty('--accs', 'color-mix(in srgb, ' + l + ' 16%, #fff)');
  s.setProperty('--acc-djupt', 'color-mix(in srgb, ' + l + (birta > 0.45 ? ' 42%' : ' 78%') + ', #1c3050)');
  s.setProperty('--acc-texti', birta > 0.45 ? '#1c3050' : '#fff');
  document.documentElement.classList.add('gh-eigin-litur');
}
/* Letur stofunnar af vefsíðunni hennar, sótt frá Google Fonts */
if (sersnid && /^[A-Za-z0-9 ]{2,40}$/.test(sersnid.letur || '')) {
  const f = sersnid.letur.trim();
  const tengill = document.createElement('link');
  tengill.rel = 'stylesheet';
  tengill.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;500;600;700&display=swap';
  document.head.appendChild(tengill);
  const stafla = "'" + f + "', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  document.documentElement.style.setProperty('--f-head', stafla);
  document.documentElement.style.setProperty('--f-body', stafla);
}
/* Merki stofunnar: slóð af vefnum hennar eða mynd sem var hlaðið upp */
export const stofuMerki = () => {
  const m = sersnid && sersnid.merki;
  return typeof m === 'string' && (/^https:\/\//.test(m) || /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/.test(m)) ? m : null;
};
export const stofuNafn = () => (sersnid && sersnid.nafn) || 'Tveir';
/* Nafnið sem gesturinn skrifaði í Settu saman. Tómt ef hann skrifaði
   ekkert og sjálfgefna nafnið stendur, svo það birtist ekki eins og alvöru nafn. */
const SJALFGEFIN_NOFN = ['Stofan', 'Fyrirtækið', 'Glerhúsið mitt'];
export const gestNafn = () => {
  const n = sersnid && typeof sersnid.nafn === 'string' ? sersnid.nafn.trim() : '';
  return n && !SJALFGEFIN_NOFN.includes(n) ? n : '';
};

export function el(tag, eigin, born) {
  const n = document.createElement(tag);
  if (eigin) {
    for (const [k, v] of Object.entries(eigin)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'texti') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const b of [].concat(born || [])) {
    if (b === null || b === undefined || b === false) continue;
    n.append(b);
  }
  return n;
}

export function tom(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

/* append() breytir null í textann "null", því síum við fyrst. */
export function fylla(n, born) {
  tom(n);
  for (const b of [].concat(born || [])) {
    if (b === null || b === undefined || b === false) continue;
    n.append(b);
  }
  return n;
}

/* Íslensk mánaðanofn handvirkt. Chrome er ekki alltaf með is-IS
   locale gögn og skilar þá enskum mánuðum. */
const MAN_STUTT = ['jan.', 'feb.', 'mars', 'apr.', 'maí', 'jún.', 'júl.',
                   'ágú.', 'sep.', 'okt.', 'nóv.', 'des.'];
const MAN_LANGT = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí',
                   'ágúst', 'september', 'október', 'nóvember', 'desember'];

export function dags(gildi, medAri) {
  if (!gildi) return null;
  const d = new Date(gildi);
  if (isNaN(d)) return null;
  const m = medAri ? MAN_LANGT[d.getMonth()] : MAN_STUTT[d.getMonth()];
  return d.getDate() + '. ' + m + (medAri ? ' ' + d.getFullYear() : '');
}

/* Tungumál (hver notandi í sínum vafra) og gjaldmiðill (allt kerfið,
   samstillt úr kerfisstillingum í gagnagrunninum) */
const TUNGA_LYKILL = 'glerhus-tveir-tungumal', GJALD_LYKILL = 'glerhus-tveir-gjaldmidill';
export const tungumal = () => { try { return localStorage.getItem(TUNGA_LYKILL) === 'en' ? 'en' : 'is'; } catch (e) { return 'is'; } };
export const gjaldmidill = () => { try { const v = localStorage.getItem(GJALD_LYKILL); return ['ISK', 'EUR', 'USD'].includes(v) ? v : 'ISK'; } catch (e) { return 'ISK'; } };
export function setjaTungumal(t) { try { localStorage.setItem(TUNGA_LYKILL, t === 'en' ? 'en' : 'is'); } catch (e) { /* lokað */ } }
export function setjaGjaldmidil(v) { try { localStorage.setItem(GJALD_LYKILL, ['ISK', 'EUR', 'USD'].includes(v) ? v : 'ISK'); } catch (e) { /* lokað */ } }
/* Enskt snið á tölum bara ef þýðingin hlóðst, annars er allt á íslensku */
let enska = false;
export const erEnska = () => enska;

/* Gengi: allar upphæðir eru geymdar í krónum og umreiknaðar á gengi dagsins
   (viðmiðunargengi Seðlabanka Evrópu). Sótt einu sinni á dag og geymt í vafranum.
   Náist ekkert gengi eru upphæðirnar sýndar í krónum, aldrei rangt merki á krónutölu. */
const GENGI_LYKILL = 'glerhus-tveir-gengi';
const GENGI_SLOD = 'https://api.frankfurter.dev/v1/latest?base=ISK&symbols=EUR,USD';
let gengi = null;
function lesaGeymtGengi() {
  try { const g = JSON.parse(localStorage.getItem(GENGI_LYKILL) || 'null'); return g && g.EUR > 0 && g.USD > 0 ? g : null; } catch (e) { return null; }
}
async function saekjaGengi() {
  try {
    const st = new AbortController(); const t = setTimeout(() => st.abort(), 4000);
    try {
      const svar = await fetch(GENGI_SLOD, { signal: st.signal });
      if (!svar.ok) throw new Error('gengi ' + svar.status);
      const d = await svar.json();
      const EUR = Number(d && d.rates && d.rates.EUR), USD = Number(d && d.rates && d.rates.USD);
      if (!(EUR > 0 && USD > 0)) throw new Error('ekkert gengi');
      const nytt = { EUR, USD, dags: String(d.date || ''), sott: Date.now() };
      try { localStorage.setItem(GENGI_LYKILL, JSON.stringify(nytt)); } catch (e) { /* lokað */ }
      return nytt;
    } finally { clearTimeout(t); }
  } catch (e) {
    /* Mistókst: reynum ekki aftur fyrr en eftir hálftíma, svo síðurnar bíði ekki */
    const geymt = lesaGeymtGengi();
    try { localStorage.setItem(GENGI_LYKILL, JSON.stringify({ ...(geymt || {}), reynt: Date.now() })); } catch (e2) { /* lokað */ }
    return geymt;
  }
}
if (gjaldmidill() !== 'ISK') {
  const geymt = lesaGeymtGengi();
  try {
    const hratt = JSON.parse(localStorage.getItem(GENGI_LYKILL) || '{}') || {};
    const ferskt = geymt && Date.now() - (geymt.sott || 0) < 6 * 3600 * 1000;
    const nyreynt = Date.now() - (hratt.reynt || 0) < 30 * 60 * 1000;
    if (geymt) {
      /* Gengi til: notað strax, uppfært í bakgrunni ef það er orðið gamalt */
      gengi = geymt;
      if (!ferskt && !nyreynt) saekjaGengi();
    } else if (!nyreynt) {
      gengi = await saekjaGengi();
    }
  } catch (e) { gengi = geymt; }
}
export const gengid = () => gengi;
/* Gjaldmiðillinn sem upphæðirnar eru í raun sýndar í */
export const virkurGjaldmidill = () => { const g = gjaldmidill(); return g !== 'ISK' && gengi && gengi[g] > 0 ? g : 'ISK'; };
/* Krónur -> sýndur gjaldmiðill, og til baka */
export function umreikna(isk) { const g = virkurGjaldmidill(); return g === 'ISK' ? Number(isk) : Number(isk) * gengi[g]; }
export function iKronur(upph) { const g = virkurGjaldmidill(); return Math.round(g === 'ISK' ? Number(upph) : Number(upph) / gengi[g]); }
export const gjaldmidilsMerki = () => ({ ISK: enska ? 'ISK' : 'kr.', EUR: '€', USD: '$' })[virkurGjaldmidill()];

/* 250000 -> "250.000" (á ensku "250,000"). Fyrir reiti og útreikninga. */
export function tolu(gildi) {
  if (gildi === null || gildi === undefined || gildi === '') return null;
  const tala = Math.round(Number(gildi));
  if (isNaN(tala)) return null;
  return String(tala).replace(/\B(?=(\d{3})+(?!\d))/g, enska ? ',' : '.');
}

/* 250000 (krónur) -> "250.000 kr." eða, í evrum, "1.822 €" / "€1,822" á ensku */
export function kronur(gildi) {
  if (gildi === null || gildi === undefined || gildi === '' || isNaN(Number(gildi))) return null;
  return synaGjaldmidil(umreikna(gildi));
}
/* Tala sem er þegar í sýndum gjaldmiðli -> "1.822 €" / "€1,822" / "250.000 kr." */
export function synaGjaldmidil(n) {
  const t = tolu(n);
  if (t === null) return null;
  const en = enska, g = virkurGjaldmidill();
  if (g === 'EUR') return en ? '€' + t : t + ' €';
  if (g === 'USD') return en ? '$' + t : t + ' $';
  return en ? t + ' ISK' : t + ' kr.';
}

/* Enska: þýðingarlagið þýðir textann á síðunni um leið og hann birtist */
if (tungumal() === 'en') {
  try { await import('./thyding.js'); enska = true; } catch (e) { document.documentElement.lang = 'is'; /* íslenska ef þýðingin hleðst ekki */ }
}

/* "250.000" eða "250000" -> 250000 */
export function lesaTolu(texti) {
  const hreint = String(texti == null ? '' : texti).replace(/[^0-9]/g, '');
  return hreint ? Number(hreint) : null;
}

/* Upphæðarreitir: sýna krónutöluna í völdum gjaldmiðli og skila alltaf krónum.
   Sé reiturinn óbreyttur kemur upphaflega krónutalan til baka, svo gengið
   breyti aldrei vistaðri upphæð sem enginn snerti. */
export function upphaedTexti(isk) {
  if (isk === null || isk === undefined || isk === '' || !Number(isk)) return '';
  return tolu(umreikna(isk));
}
export function setjaUpphaed(inn, isk) {
  inn.value = upphaedTexti(isk);
  inn.dataset.isk = inn.value ? String(Math.round(Number(isk))) : '';
  inn.dataset.birt = inn.value;
}
/* Tala í sýndum gjaldmiðli, með aurum/sentum ef þeir eru slegnir inn ("1.500,50" eða "1,500.50") */
/* Lesið úr textanum sjálfum, ekki tungumálinu: "1.500" og "1,500" eru þúsund,
   "12.99", "12,99" og "1.500,50" / "1,500.50" hafa aura. */
export function lesaGjaldmidil(texti) {
  let s = String(texti == null ? '' : texti).replace(/[^0-9.,]/g, '');
  if (!/\d/.test(s)) return null;
  const sidPunktur = s.lastIndexOf('.'), sidKomma = s.lastIndexOf(',');
  let tug = null;
  if (sidPunktur >= 0 && sidKomma >= 0) tug = sidPunktur > sidKomma ? '.' : ',';
  else if (sidPunktur >= 0 || sidKomma >= 0) {
    const sk = sidPunktur >= 0 ? '.' : ',';
    const hlutar = s.split(sk);
    const thusund = hlutar.length > 1 && hlutar[0].length >= 1 && hlutar[0].length <= 3 && hlutar.slice(1).every((h) => h.length === 3);
    if (!thusund) tug = sk;
  }
  let heilt = s, brot = '';
  if (tug) { const k = s.lastIndexOf(tug); heilt = s.slice(0, k); brot = s.slice(k + 1); }
  heilt = heilt.replace(/[.,]/g, ''); brot = brot.replace(/[.,]/g, '');
  const n = Number((heilt || '0') + (brot ? '.' + brot : ''));
  return isFinite(n) ? n : null;
}
/* Lyklaborð á síma: aurar bara í evrum og dollurum */
export const upphaedInntak = () => (virkurGjaldmidill() === 'ISK' ? 'numeric' : 'decimal');
/* Krónutala -> heil tala í sýndum gjaldmiðli. Notað til að leggja saman það sem er sýnt. */
export const syntTala = (isk) => Math.round(umreikna(Number(isk) || 0));
export function lesaUpphaed(inn) {
  const v = String(inn.value || '').trim();
  if (!v) return null;
  if (inn.dataset.birt && v === inn.dataset.birt && inn.dataset.isk) return Number(inn.dataset.isk);
  if (virkurGjaldmidill() === 'ISK') return lesaTolu(v);
  const n = lesaGjaldmidil(v);
  return n === null ? null : iKronur(n);
}
/* Snyrtir reitinn eftir innslátt án þess að breyta upphæðinni */
export function snyrtaUpphaed(inn) {
  const v = String(inn.value || '').trim();
  if (!v || v === inn.dataset.birt) return;
  if (virkurGjaldmidill() === 'ISK') { const t = lesaTolu(v); inn.value = t ? tolu(t) : ''; return; }
  const n = lesaGjaldmidil(v);
  if (n === null) { inn.value = ''; return; }
  const aurar = Math.round(n * 100);
  inn.value = aurar % 100 === 0 ? tolu(aurar / 100) : tolu(Math.floor(aurar / 100)) + (enska ? '.' : ',') + String(aurar % 100).padStart(2, '0');
}

/* Hversu langt síðan, í orðum */
export function sidan(gildi) {
  if (!gildi) return '';
  const min = Math.round((Date.now() - new Date(gildi)) / 60000);
  if (min < 2) return enska ? 'just now' : 'núna';
  if (min < 60) return min + (enska ? ' min' : ' mín.');
  const klst = Math.round(min / 60);
  if (klst < 24) return klst + (enska ? ' h' : ' klst.');
  const dagar = Math.round(klst / 24);
  if (dagar < 8) return dagar === 1 ? (enska ? 'yesterday' : 'í gær') : dagar + (enska ? ' days' : ' dagar');
  return dags(gildi);
}

/* 1536000 -> "1,5 MB" */
export function staerd(bitar) {
  if (!bitar && bitar !== 0) return '';
  if (bitar < 1024) return bitar + ' B';
  if (bitar < 1024 * 1024) return Math.round(bitar / 1024) + ' KB';
  const mb = String(Math.round(bitar / 1024 / 102.4) / 10);
  return (enska ? mb : mb.replace('.', ',')) + ' MB';
}

/* Er skiladagur liðinn */
export function erSeint(dagsetning) {
  if (!dagsetning) return false;
  const i_dag = new Date(); i_dag.setHours(0, 0, 0, 0);
  return new Date(dagsetning) < i_dag;
}

export function pilla(stada, tafla) {
  const toflur = { verk: STODUR_VERK, innri: STODUR_INNRI };
  const s = (toflur[tafla] || STODUR_TASK)[stada];
  if (!s) return el('span', { class: 'pstat pstat--nytt', texti: stada });
  return el('span', { class: 'pstat pstat--' + s.litur, texti: s.heiti });
}

/* ------------------------------------------------------------------
   Innskráningarvörður
   Skilar notandanum eða sendir á innskráningu.
   ------------------------------------------------------------------ */
/* Síðustu gögn síðunnar, geymd meðan flipinn er opinn. Síðan teiknar þau
   strax og sækir svo ný í bakgrunni, í stað þess að standa auð á meðan. */
export function geymt(lykill) {
  try { return JSON.parse(sessionStorage.getItem('tveir-sida-' + lykill) || 'null'); } catch (e) { return null; }
}
export function geyma(lykill, gildi) {
  try { sessionStorage.setItem('tveir-sida-' + lykill, JSON.stringify(gildi)); } catch (e) { /* of stórt eða lokað */ }
}

/* Gjaldmiðill kerfisins: sóttur einu sinni í hverri lotu. Hafi hann breyst
   er síðan hlaðin aftur svo allar upphæðir sýni réttan gjaldmiðil. */
async function samstillaGjaldmidil(g) {
  try {
    if (!g.kerfisstillingar || sessionStorage.getItem('glerhus-tveir-gjald-lotu')) return;
    const s = await g.kerfisstillingar();
    if (!s) return; /* lesturinn mistókst: höldum því sem er geymt og reynum aftur næst */
    sessionStorage.setItem('glerhus-tveir-gjald-lotu', '1');
    const ny = s.gjaldmidill || 'ISK';
    if (ny !== gjaldmidill()) { setjaGjaldmidil(ny); location.reload(); }
  } catch (e) { /* sjálfgefið ISK */ }
}

export async function vardaHlid({ krefstAdmin, badir } = {}) {
  const g = await gogn();
  const ek = await g.eg();

  if (!ek) { location.replace('./'); return null; }
  samstillaGjaldmidil(g);

  if (krefstAdmin && ek.hlutverk !== 'admin') { location.replace('yfirlit.html'); return null; }
  if (!krefstAdmin && !badir && ek.hlutverk === 'admin') {
    /* Admin lendir á stjórnborðinu, ekki á viðskiptavinayfirliti */
    location.replace('stjornbord.html'); return null;
  }
  if (!krefstAdmin && !badir && !ek.fyrirtaeki_id) {
    teiknaHaus(ek, 'Vinnusvæði');
    const m = document.getElementById('innihald');
    if (m) {
      fylla(m, [el('div', { class: 'card pblokk' }, [
        el('h2', { texti: 'Aðgangurinn er ekki tengdur fyrirtæki' }),
        el('p', { class: 'lead', style: 'margin-top:10px',
          texti: 'Við þurfum að tengja þig við fyrirtækið þitt áður en þú sérð verkefnin. Sendu okkur línu á tveir@tveir.is og við gerum það í dag.' })
      ])]);
    }
    return null;
  }
  return ek;
}

/* ------------------------------------------------------------------
   Haus
   ------------------------------------------------------------------ */
let hausMerki = null;
let hausOkkar = null;
let hausEgId  = null;
let hausFyrirspurnir = null;
let hausPostholf = null;
let hausSamskipti = null;

function setjaTolu(n, fjoldi) {
  n.textContent = String(fjoldi);
  n.hidden = fjoldi === 0;
}

/* Kallað eftir að tillaga er afgreidd eða verk hakað, svo tölurnar
   í hausnum séu réttar án þess að hlaða síðunni upp á nýtt. */
export function uppfaeraMerki() {
  if (hausMerki) {
    gogn()
      .then((g) => g.verkefni())
      .then((listi) => setjaTolu(hausMerki, listi.filter((v) => v.stada === 'tillaga').length))
      .catch(() => { /* merkið bíður bara */ });
  }
  if (hausOkkar) {
    gogn()
      .then((g) => g.innriTaskar())
      .then((listi) => setjaTolu(hausOkkar,
        listi.filter((t) => t.stada !== 'lokid' && t.abyrgd === hausEgId).length))
      .catch(() => { /* merkið bíður bara */ });
  }
  if (hausFyrirspurnir) {
    /* Samskipti: nýjar fyrirspurnir og ólesnir póstþræðir, saman og hvort í sínu lagi */
    gogn().then(async (g) => {
      const [fsp, post] = await Promise.all([
        g.fyrirspurnir().then((l) => l.filter((f) => f.stada === 'ny').length).catch(() => 0),
        g.postholf ? g.postholf().then((l) => l.filter(postOlesinn).length).catch(() => 0) : 0
      ]);
      setjaTolu(hausFyrirspurnir, fsp);
      if (hausPostholf) setjaTolu(hausPostholf, post);
      if (hausSamskipti) setjaTolu(hausSamskipti, fsp + post);
    }).catch(() => { /* merkið bíður bara */ });
  }
}

/* Ólesinn á vinnusvæðinu: aldrei opnaður, eða nýr póstur kom eftir að hann var opnaður */
export const postOlesinn = (t) => !t.lesid_kerfi || new Date(t.lesid_kerfi) < new Date(t.sidast);

/* Flipar efst á Samskiptum: Pósthólf og Fyrirspurnir, Messenger og Instagram koma */
export function samskiptaFlipar(virkur) {
  const flipi = (slod, heiti, kodi) => el('a', { class: 'sk-flipi', href: slod, 'aria-current': virkur === kodi ? 'page' : null, texti: heiti });
  return el('nav', { class: 'sk-flipar', 'aria-label': 'Samskipti' }, [
    flipi('samskipti.html', 'Pósthólf', 'postholf'),
    flipi('fyrirspurnir.html', 'Fyrirspurnir', 'fyrirspurnir'),
    el('span', { class: 'sk-flipi sk-flipi--kemur', title: 'Kemur þegar Meta appið er tilbúið', texti: 'Messenger' }),
    el('span', { class: 'sk-flipi sk-flipi--kemur', title: 'Kemur þegar Meta appið er tilbúið', texti: 'Instagram' })
  ]);
}

export function teiknaHaus(ek, heiti) {
  const haus = document.getElementById('phead');
  if (!haus) return;

  const admin = ek.hlutverk === 'admin';

  /* Merkin fyllast á eftir, því tölurnar liggja ekki fyrir strax */
  const merki = admin ? el('span', { class: 'phead__merki', hidden: true }) : null;
  const merkiOkkar = admin
    ? el('span', { class: 'phead__merki phead__merki--okkar', hidden: true }) : null;
  hausMerki = merki;
  hausOkkar = merkiOkkar;
  const merkiFyrirspurna = admin
    ? el('span', { class: 'phead__merki phead__merki--ny', hidden: true }) : null;
  hausFyrirspurnir = merkiFyrirspurna;
  const merkiPostholf = admin ? el('span', { class: 'phead__merki phead__merki--ny', hidden: true }) : null;
  const merkiSamskipti = admin ? el('span', { class: 'phead__merki phead__merki--ny', hidden: true }) : null;
  hausPostholf = merkiPostholf;
  hausSamskipti = merkiSamskipti;
  hausEgId = ek.id;
  uppfaeraMerki();

  const nuna = location.pathname.split('/').pop() || 'stjornbord.html';
  const tengill = (slod, texti) => el('a', { href: slod, texti, 'aria-current': nuna === slod ? 'page' : null });

  /* Tölurnar í merkjunum haldast á meðan nýju tölurnar eru sóttar, svo
     þær blikki ekki þegar skipt er um síðu (skipti.js) */
  const fyrriMerki = {};
  haus.querySelectorAll('.phead__merki').forEach((m) => {
    const a = m.closest('a');
    if (a) fyrriMerki[a.getAttribute('href') + '|' + a.className] = [m.textContent, m.hidden];
  });

  fylla(haus, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'phead__inn' }, [
        el('a', { class: 'phead__logo', href: admin ? upphafssida() : 'yfirlit.html',
                  'aria-label': 'Glerhúsið' }, [
          /* Hafi viðskiptavinurinn sett inn merki kemur það í stað okkar.
             Þetta er hans vinnusvæði, tvö merki eru einu of mikil. */
          ek.fyrirtaeki && ek.fyrirtaeki.merki_url
            ? el('img', { class: 'phead__kunnamerki', src: ek.fyrirtaeki.merki_url,
                          alt: ek.fyrirtaeki.nafn })
            : stofuMerki()
              /* Stofan setti inn merki: hennar merki, og lítið Glerhúsið hús við hliðina */
              ? el('span', { class: 'phead__logo' }, [
                  el('img', { class: 'phead__glerhus', src: '../assets/merki/glerhusid-merki-blatt.svg', alt: 'Glerhúsið',
                              width: '26', height: '26' }),
                  el('img', { class: 'phead__stofumerki', src: stofuMerki(), alt: stofuNafn(), referrerpolicy: 'no-referrer' })
                ])
              : el('img', { class: 'phead__tveir', src: '/assets/img/tveir-merki-gegnsaett.png', alt: 'Tveir',
                            width: '124', height: '29' })
        ]),
        el('span', { class: 'phead__skil', 'aria-hidden': 'true' }),

        /* Sýnidæmi fyrir íþróttafólk og áhrifavalda: bara það sem skiptir máli */
        admin && erPersona()
          ? el('nav', { class: 'phead__nav', 'aria-label': 'Vinnusvæði' }, [
              tengill('mitt.html', 'Yfirlit'),
              ervalid('samstarf') ? tengill('samstarfsadilar.html', 'Samstarfsaðilar') : null,
              ervalid('efnisplan') ? tengill('efnisplan.html', 'Efnisplan') : null,
              ['tveir', 'onnur'].includes(sersnid.stofa) && ervalid('stofan') ? tengill('beidnir.html', 'Beiðnir') : null
            ])
        /* Sýnidæmi fyrir lítil fyrirtæki: yfirlitið og tilboðin */
        : admin && erFyrirtaeki()
          ? el('nav', { class: 'phead__nav', 'aria-label': 'Vinnusvæði' }, [
              tengill('fyrirtaeki.html', 'Yfirlit'),
              ervalid('tilbod') ? tengill('tilbod.html', 'Tilboð') : null
            ])
        /* Sýnidæmi fyrir verktaka: tilboðin og myndirnar */
        : admin && erBaraVerktaki()
          ? el('nav', { class: 'phead__nav', 'aria-label': 'Vinnusvæði' }, [
              ervalid('tilbod') || !ervalid('myndir') ? tengill('tilbod.html', 'Tilboð') : null,
              ervalid('myndir') ? tengill('myndir.html', 'Myndir') : null
            ])
        : admin
          ? el('nav', { class: 'phead__nav', 'aria-label': 'Vinnusvæði' }, [
              el('a', { href: 'stjornbord.html', texti: 'Stjórnborð',
                        'aria-current': nuna === 'stjornbord.html' ? 'page' : null }),
              ervalid('tillogur') ? el('a', { href: 'tillogur.html',
                        'aria-current': nuna === 'tillogur.html' ? 'page' : null }, [
                document.createTextNode('Tillögur'), merki
              ]) : null,
              /* Innri verkin eru fyrir Tveir sjálf, ekki sýnidæmið */
              sersnid ? null : el('a', { href: 'okkar.html',
                        'aria-current': nuna === 'okkar.html' ? 'page' : null }, [
                document.createTextNode('Okkar'), merkiOkkar
              ]),
              /* Samskipti: pósthólfið og fyrirspurnirnar, fellivalmynd í tölvu */
              sersnid && !ervalid('postur') && !ervalid('postur_verk') ? null : el('div', { class: 'phead__hopur' }, [
                el('a', { href: 'samskipti.html', class: 'phead__hopur-hn', 'aria-haspopup': 'true',
                          'aria-current': ['samskipti.html', 'fyrirspurnir.html'].includes(nuna) ? 'page' : null }, [
                  document.createTextNode('Samskipti'), merkiSamskipti
                ]),
                el('div', { class: 'phead__fellival' }, [
                  el('a', { href: 'samskipti.html', class: 'phead__undir' }, [document.createTextNode('Pósthólf'), merkiPostholf]),
                  el('a', { href: 'fyrirspurnir.html', class: 'phead__undir' }, [document.createTextNode('Fyrirspurnir'), merkiFyrirspurna]),
                  el('span', { class: 'phead__undir phead__undir--kemur', texti: 'Messenger og Instagram koma' })
                ])
              ]),
              sersnid && !ertengt('googlecalendar') ? null : el('a', { href: 'dagatal.html', texti: 'Dagatal',
                        'aria-current': nuna === 'dagatal.html' ? 'page' : null }),
              ervalid('tekjur') ? el('a', { href: 'bokhald.html', texti: 'Bókhald',
                        'aria-current': nuna === 'bokhald.html' ? 'page' : null }) : null,
              ervalid('tolfraedi') ? el('a', { href: 'tolfraedi.html', texti: 'Tölfræði',
                        'aria-current': nuna === 'tolfraedi.html' ? 'page' : null }) : null,
              /* Harvey spjallið er ekki komið í loftið, fallið undir api/ þarf
                 API lykil. Kveikt í stillingar.js þegar það er tilbúið. */
              stillingar.harvey ? el('a', { href: 'harvey.html', texti: 'Harvey',
                        'aria-current': nuna === 'harvey.html' ? 'page' : null }) : null
            ])
          : el('div', { class: 'phead__heiti' }, [
              /* Með valmyndinni segir hún hvar maður er, svo nafn
                 fyrirtækisins dugar eitt og sér */
              ek.fyrirtaeki_id && ek.fyrirtaeki ? null : document.createTextNode(heiti ? heiti + ' ' : ''),
              ek.fyrirtaeki ? el('strong', { texti: ek.fyrirtaeki.nafn }) : null
            ]),
        /* Viðskiptavinur: verkefnin og tölfræðin */
        !admin && ek.fyrirtaeki_id
          ? el('nav', { class: 'phead__nav phead__nav--kunni', 'aria-label': 'Vinnusvæði' }, [
              el('a', { href: 'yfirlit.html', texti: 'Verkefni',
                        'aria-current': nuna === 'yfirlit.html' || nuna === 'verk.html' ? 'page' : null }),
              ervalid('tolfraedi') ? el('a', { href: 'tolfraedi.html', texti: 'Tölfræði',
                        'aria-current': nuna === 'tolfraedi.html' ? 'page' : null }) : null
            ])
          : null,
        el('div', { class: 'phead__hnappar' }, [
          /* Í síma fer valmyndin bak við hamborgara */
          (admin || ek.fyrirtaeki_id) ? el('button', {
            type: 'button', class: 'phead__hamborgari', 'aria-label': 'Valmynd', 'aria-expanded': 'false',
            html: '<span></span><span></span><span></span>',
            onclick: (e) => {
              const opid = haus.classList.toggle('er-opin');
              e.currentTarget.setAttribute('aria-expanded', String(opid));
            }
          }) : null,
          /* Í sýnidæmi: nafnið sem gesturinn skrifaði, ef eitthvað, og Sýnidæmi
             undir. Aldrei nafnið á prufuaðganginum. Sést líka í síma. */
          sersnid
            ? el('div', { class: 'phead__notandi phead__notandi--synid' }, [
                gestNafn() ? el('strong', { texti: gestNafn() }) : null,
                el('span', { class: 'phead__synid', texti: 'Sýnidæmi' })
              ])
            : el('div', { class: 'phead__notandi' }, [
                el('strong', { texti: ek.nafn }),
                document.createTextNode(admin ? stofuNafn() : ek.netfang)
              ]),
          /* Stillingar: aðgangur, lykilorð, undirskrift og tengingar.
             Sýnidæmi persónu, verktaka og fyrirtækis eru án þeirra. */
          erPersona() || erVerktaki() ? null : el('a', {
            class: 'btn btn--sm btn--ghost phead__lykill phead__stillingar', href: 'stillingar.html',
            'aria-label': 'Stillingar', title: 'Stillingar',
            'aria-current': nuna === 'stillingar.html' ? 'page' : null,
            html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
          }),
          /* Í sýnidæmi er engin útskráning, bara leið aftur á vefinn */
          sersnid
            ? el('a', { class: 'btn btn--sm btn--ghost phead__loka', href: '../index.html', 'aria-label': 'Loka sýnidæmi' }, [
                document.createTextNode('Loka'),
                el('span', { class: 'phead__loka-sd', texti: ' sýnidæmi' })
              ])
            : el('button', {
                type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Út',
                onclick: async () => { const g = await gogn(); await g.utskra(); location.replace('./'); }
              })
        ])
      ])
    ])
  ]);
  haus.querySelectorAll('.phead__merki').forEach((m) => {
    const a = m.closest('a');
    const f = a && fyrriMerki[a.getAttribute('href') + '|' + a.className];
    if (f && f[0]) { m.textContent = f[0]; m.hidden = f[1]; }
  });

  bjodaLykilord(ek);
  synaBorda();

  /* Liðirnir eru orðnir sex og komast ekki allir fyrir á þrengstu
     símunum. Sá sem maður stendur á skal alltaf sjást. */
  const virkur = haus.querySelector('.phead__nav a[aria-current="page"]');
  if (virkur && virkur.parentElement.scrollWidth > virkur.parentElement.clientWidth) {
    virkur.parentElement.scrollLeft = Math.max(0, virkur.offsetLeft - 10);
  }
}

/* ==================================================================
   Lykilorð
   ================================================================== */
const LYKILTAKN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
  + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2"/></svg>';

export const LYKILORD_LAGMARK = 10;

/* Reitur með Sýna/Fela hnappi. Notað hér og á innskráningarsíðunni. */
export function lykilordsreitur({ id, heiti, autocomplete }) {
  const inntak = el('input', { type: 'password', id, name: id, required: true,
                               autocomplete, minlength: String(LYKILORD_LAGMARK) });
  const syna = el('button', { type: 'button', class: 'lykilord__syna', 'aria-pressed': 'false',
                              'aria-controls': id, texti: 'Sýna' });
  syna.addEventListener('click', () => {
    const synilegt = inntak.type === 'password';
    inntak.type = synilegt ? 'text' : 'password';
    syna.textContent = synilegt ? 'Fela' : 'Sýna';
    syna.setAttribute('aria-pressed', String(synilegt));
  });
  return el('div', { class: 'field' }, [
    el('label', { for: id, texti: heiti }),
    el('div', { class: 'lykilord' }, [inntak, syna])
  ]);
}

/* Spjaldið til að velja lykilorð. Opnast eftir innskráningu með hlekk,
   af hlekk til að endurstilla, og af lyklinum í hausnum. */
export function opnaLykilord({ heiti = 'Veldu lykilorð', inngangur, netfang, bjodaSeinna, eftir } = {}) {
  let vistad = false;
  const stada = el('div', { class: 'form-status', role: 'status', hidden: true });
  const nytt = lykilordsreitur({ id: 'nytt-lykilord', heiti: 'Nýtt lykilorð', autocomplete: 'new-password' });
  const aftur = lykilordsreitur({ id: 'lykilord-aftur', heiti: 'Sláðu það inn aftur', autocomplete: 'new-password' });
  const vista = el('button', { type: 'submit', class: 'btn btn--block', texti: 'Vista lykilorð' });

  function segja(texti, tegund) {
    stada.textContent = texti;
    stada.className = 'form-status form-status--' + tegund;
    stada.hidden = false;
  }

  const form = el('form', { class: 'lykilordform', novalidate: true }, [
    /* Svo lykilorðageymslan viti fyrir hvaða netfang lykilorðið er */
    netfang ? el('input', { type: 'email', name: 'username', autocomplete: 'username',
                            value: netfang, hidden: true, readonly: true, tabindex: '-1' }) : null,
    nytt,
    el('p', { class: 'skyring', style: 'margin-top:-6px',
              texti: 'Minnst ' + LYKILORD_LAGMARK + ' stafir. Nokkur orð saman eru bæði sterk og auðmunuð.' }),
    aftur,
    stada,
    vista,
    bjodaSeinna
      ? el('button', { type: 'button', class: 'btn btn--block btn--ghost', texti: 'Seinna',
                       onclick: () => d.close() })
      : null
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = form.querySelector('#nytt-lykilord');
    const b = form.querySelector('#lykilord-aftur');
    if (a.value.length < LYKILORD_LAGMARK) {
      segja('Lykilorðið þarf að vera minnst ' + LYKILORD_LAGMARK + ' stafir.', 'err'); a.focus(); return;
    }
    if (a.value !== b.value) { segja('Lykilorðin eru ekki eins.', 'err'); b.focus(); return; }

    vista.disabled = true;
    vista.textContent = 'Augnablik';
    try {
      const g = await gogn();
      await g.setjaLykilord(a.value);
      vistad = true;
      fylla(kort, [
        el('div', { class: 'pdialog__haus' }, [el('h2', { texti: 'Lykilorðið er vistað' })]),
        el('p', { class: 'lead', style: 'margin-top:10px',
                  texti: 'Næst skráir þú þig inn með netfanginu og lykilorðinu. Hlekkurinn í pósti virkar áfram ef þú gleymir því.' }),
        el('button', { type: 'button', class: 'btn btn--block', style: 'margin-top:20px',
                       texti: 'Halda áfram', onclick: () => d.close() })
      ]);
      kort.querySelector('button').focus();
    } catch (villa) {
      segja(villa.message || 'Þetta gekk ekki. Prófaðu aftur.', 'err');
      vista.disabled = false;
      vista.textContent = 'Vista lykilorð';
    }
  });

  const kort = el('div', { class: 'pdialog__kort' }, [
    el('div', { class: 'pdialog__haus' }, [
      el('h2', { texti: heiti }),
      el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                     onclick: () => d.close() })
    ]),
    inngangur ? el('p', { class: 'lead', style: 'margin-top:10px', texti: inngangur }) : null,
    form
  ]);
  const d = el('dialog', { class: 'pdialog pdialog--mjor' }, [kort]);

  d.addEventListener('close', () => { d.remove(); if (eftir) eftir(vistad); });
  document.body.append(d);
  d.showModal();
  form.querySelector('#nytt-lykilord').focus();
  return d;
}

/* Eftir innskráningu með hlekk: bjóða einu sinni að velja lykilorð, svo
   ekki þurfi hlekk næst. Ekki aftur fyrr en næst er komið inn með hlekk. */
async function bjodaLykilord(ek) {
  let kom = false;
  try {
    kom = sessionStorage.getItem('tveir-kom-med-hlekk') === 'ja';
    sessionStorage.removeItem('tveir-kom-med-hlekk');
  } catch (e) { /* lokað */ }
  if (!kom) return;
  try {
    const g = await gogn();
    if (!g.vantarLykilord || !(await g.vantarLykilord())) return;
  } catch (e) { return; }
  opnaLykilord({
    heiti: 'Veldu lykilorð',
    inngangur: 'Þá kemstu inn með netfangi og lykilorði næst, án þess að bíða eftir hlekk.',
    netfang: ek.netfang,
    bjodaSeinna: true
  });
}

/* ==================================================================
   Setja vinnusvæðið í símann
   ================================================================== */

/* Þjónustustarfi: geymir ekkert nema sambandsleysissíðuna, en án hans
   býður Android ekki upp á að setja síðuna upp sem forrit. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' })
      .catch(() => { /* þá er það bara venjuleg síða */ });
  });
}

/* Android gefur okkur boð sem við geymum og notum þegar á þarf að halda */
let innsetningarbod = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  innsetningarbod = e;
});

export function erUppsett() {
  /* ?app=1 sýnir appútlitið í venjulegum vafra. Það helst í flipanum svo
     hægt sé að smella sig um án þess að slá það inn aftur. */
  try {
    if (location.search.includes('app=1')) sessionStorage.setItem('tveir-appsyn', 'ja');
    if (sessionStorage.getItem('tveir-appsyn') === 'ja') return true;
  } catch (e) { /* lokað sessionStorage */ }

  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

/* Leiðbeiningarnar eiga bara við í síma. Enginn setur viðskiptavinasvæði
   á skrifborðið hjá sér. */
export function erSimi() {
  const hvada = taeki();
  return hvada === 'ios' || hvada === 'android';
}

export function taeki() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  /* iPad segist vera Mac frá iPadOS 13 */
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'tolva';
}

function skref(nr, texti, aukatexti) {
  return el('li', {}, [
    el('span', { class: 'uppsetning__nr', texti: String(nr) }),
    el('div', {}, [
      el('div', { texti: texti }),
      aukatexti ? el('div', { class: 'skyring', texti: aukatexti }) : null
    ])
  ]);
}

export function opnaUppsetningu() {
  const hvada = taeki();

  const d = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort' }, [
    el('div', { class: 'pdialog__haus' }, [
      el('h2', { texti: 'Glerhúsið í símann' }),
      el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                     onclick: () => d.close() })
    ]),

    el('div', { class: 'uppsetning__haus' }, [
      el('img', { src: 'assets/takn-192.png', alt: '', width: '56', height: '56' }),
      el('div', {}, [
        el('strong', { texti: 'Glerhúsið' }),
        el('span', { class: 'skyring',
                     texti: 'Þannig lítur táknið út á heimaskjánum' })
      ])
    ]),

    hvada === 'ios'
      ? el('ol', { class: 'uppsetning' }, [
          skref(1, 'Ýðu á deilitáknið neðst í Safari',
                   'Ferningurinn með örinni upp úr.'),
          skref(2, 'Skrunaðu niður og veldu Bæta við heimaskjá'),
          skref(3, 'Ýðu á Bæta við uppi í hægra horninu')
        ])
      : hvada === 'android'
        ? el('ol', { class: 'uppsetning' }, [
            skref(1, 'Ýðu á þrjá punkta uppi í hægra horninu'),
            skref(2, 'Veldu Setja upp forrit eða Bæta við heimaskjá'),
            skref(3, 'Staðfestu')
          ])
        : el('ol', { class: 'uppsetning' }, [
            skref(1, 'Smelltu á uppsetningartáknið hægra megin í veffangastikunni',
                     'Lítill skjár með ör niður.'),
            skref(2, 'Ef það sést ekki: þrjú punktarnir og svo Varpa eða Setja upp'),
            skref(3, 'Staðfestu')
          ]),

    innsetningarbod
      ? el('button', { type: 'button', class: 'btn btn--block', style: 'margin-top:20px',
                       texti: 'Setja upp núna',
                       onclick: async (e) => {
                         e.currentTarget.disabled = true;
                         innsetningarbod.prompt();
                         await innsetningarbod.userChoice;
                         innsetningarbod = null;
                         d.close();
                       } })
      : null,

    el('p', { class: 'skyring', style: 'margin-top:18px',
              texti: hvada === 'ios'
                ? 'Appið heldur sinni eigin innskráningu, svo þú skráir þig inn einu sinni í '
                  + 'viðbót þegar þú opnar það í fyrsta sinn. Notaðu lykilorðið þar, hlekkur úr '
                  + 'pósti opnast í Safari en ekki í appinu.'
                : 'Það þarf ekkert úr App Store eða Play. Þetta er síðan sjálf, bara í heilum skjá '
                  + 'og með tákni á heimaskjánum.' })
  ])]);

  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}

/* ------------------------------------------------------------------
   Borðinn sem rennur upp að neðan
   ------------------------------------------------------------------ */
const BORDALYKILL = 'tveir-simabordi-falinn';

export function bordiFalinn() {
  try { return localStorage.getItem(BORDALYKILL) === 'ja'; }
  catch (e) { return false; }
}

function felaBorda(bordi) {
  try { localStorage.setItem(BORDALYKILL, 'ja'); } catch (e) { /* sleppum */ }
  bordi.classList.remove('er-inni');
  document.body.style.paddingBottom = '';
  setTimeout(() => bordi.remove(), 360);
}

function syndaSimabordi() {
  /* Í sýnidæmi er Sýnidæmisborðinn neðst, tveir borðar þar rekast á */
  if (sersnid) return;
  if (!erSimi() || erUppsett() || bordiFalinn()) return;
  if (document.querySelector('.simabordi')) return;

  const bordi = el('div', { class: 'simabordi', role: 'complementary',
                            'aria-label': 'Setja vinnusvæðið í símann' }, [
    el('button', {
      type: 'button', class: 'simabordi__loka', 'aria-label': 'Fela', texti: '✕',
      onclick: () => felaBorda(bordi)
    }),
    el('div', { class: 'simabordi__inn' }, [
      el('img', { src: 'assets/takn-192.png', alt: '', width: '48', height: '48' }),
      el('div', { class: 'simabordi__texti' }, [
        el('strong', { texti: 'Settu þetta í símann' }),
        el('span', { texti: 'Opnast eins og app af heimaskjánum' })
      ])
    ]),
    el('button', {
      type: 'button', class: 'btn btn--white btn--block btn--sm',
      style: 'margin-top:14px', texti: 'Sýna mér hvernig',
      onclick: () => opnaUppsetningu()
    })
  ]);

  document.body.append(bordi);

  /* Tvö rammö svo vafrinn nái að teikna hann niðri áður en hann rennur upp */
  setTimeout(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bordi.classList.add('er-inni');
      document.body.style.paddingBottom = bordi.offsetHeight + 'px';
    }));
  }, 700);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syndaSimabordi);
} else {
  syndaSimabordi();
}

/* ------------------------------------------------------------------
   Verkspjald
   ------------------------------------------------------------------ */
let spjald = null;

function byggjaSpjald() {
  if (spjald) return spjald;
  spjald = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort', id: 'spjald-kort' })]);
  spjald.addEventListener('click', (e) => { if (e.target === spjald) spjald.close(); });
  document.body.append(spjald);
  return spjald;
}

function fraVidskiptavini(t) {
  return !!(t.hofundur_notandi && t.hofundur_notandi.nafn && t.hofundur_notandi.hlutverk !== 'admin');
}

export async function opnaTask(id, { admin, eftir } = {}) {
  const g = await gogn();
  const d = byggjaSpjald();
  const kort = d.querySelector('#spjald-kort');
  const allir = await g.taskar({});
  const t = allir.find((x) => x.id === id);
  if (!t) return;

  const ek = await g.eg();
  const notendur = admin ? await g.notendur() : [];
  const ath = await g.athugasemdir(id);
  const skrar = await g.vidhengi(id);
  /* Sé taflan ekki komin í gagnagrunninn opnast spjaldið samt */
  const undir = await g.undirverk(id).catch(() => []);

  /* Spjaldið teiknast upp á nýtt eftir hverja breytingu. Það á að standa
     kyrrt á sama stað, ekki hoppa upp á topp. */
  const skrunad = d.open && kort.dataset.task === id ? kort.scrollTop : 0;
  kort.dataset.task = id;

  const stodurILausu = admin
    ? Object.keys(STODUR_TASK)
    : Object.keys(STODUR_TASK).filter((s) => s !== 'lokid');

  const velStada = el('select', {
    'aria-label': 'Staða',
    onchange: async (e) => {
      await g.uppfaeraTask(id, { stada: e.target.value });
      if (eftir) eftir();
      opnaTask(id, { admin, eftir });
    }
  }, stodurILausu.map((s) =>
    el('option', { value: s, selected: t.stada === s, texti: STODUR_TASK[s].heiti })));

  const velAbyrgd = admin ? el('select', {
    'aria-label': 'Ábyrgð',
    onchange: async (e) => {
      await g.uppfaeraTask(id, { abyrgd: e.target.value || null });
      if (eftir) eftir();
    }
  }, [el('option', { value: '', texti: 'Óráðið' })].concat(
    notendur.map((n) => el('option', {
      value: n.id, selected: t.abyrgd === n.id,
      texti: n.nafn + (n.hlutverk === 'admin' ? ' (stofan)' : '')
    })))) : el('span', { texti: t.abyrgd_notandi ? t.abyrgd_notandi.nafn : 'Óráðið' });

  const svarsvaedi = el('textarea', {
    rows: '3', placeholder: 'Skrifaðu svar eða spurningu', 'aria-label': 'Ný athugasemd'
  });

  fylla(kort, [
    el('div', { class: 'pdialog__haus' }, [
      el('h2', { texti: t.titill }),
      el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                     onclick: () => d.close() })
    ]),
    el('div', { class: 'task__undir', style: 'margin-top:4px' }, [
      pilla(t.stada, 'task'),
      t.forgangur === 'hatt' ? el('span', { class: 'pforg', texti: 'Hátt forgang' }) : null,
      admin && t.fyrirtaeki ? el('span', { texti: t.fyrirtaeki.nafn }) : null
    ]),
    t.lysing ? el('p', { class: 'lead', style: 'margin-top:16px; font-size:15px', texti: t.lysing }) : null,

    el('ul', { class: 'pmeta' }, [
      el('li', {}, [el('span', { texti: 'Staða' }), el('span', {}, [velStada])]),
      t.hofundur_notandi && t.hofundur_notandi.nafn
        ? el('li', {}, [el('span', { texti: 'Frá' }), el('span', { texti: t.hofundur_notandi.nafn })]) : null,
      el('li', {}, [el('span', { texti: 'Ábyrgð' }), el('span', {}, [velAbyrgd])]),
      el('li', {}, [el('span', { texti: 'Skiladagur' }), el('span', {
        class: erSeint(t.skiladagur) && t.stada !== 'lokid' ? 'seint' : '',
        texti: dags(t.skiladagur, true) || 'Enginn'
      })]),
      t.verkefni ? el('li', {}, [el('span', { texti: 'Verkefni' }), el('span', { texti: t.verkefni.titill })]) : null,
      el('li', {}, [el('span', { texti: 'Stofnað' }), el('span', { texti: dags(t.stofnad, true) })])
    ]),

    undirverkHluti({ t, listi: undir, admin, g, eftir,
                     teiknaAftur: () => opnaTask(id, { admin, eftir }) }),

    el('h3', { style: 'margin-top:24px; font-family:var(--f-body); font-weight:500; font-size:15px',
               texti: 'Viðhengi' }),

    skrar.length
      ? el('ul', { class: 'skralisti' }, skrar.map((sk) => skraLina(sk, g)))
      : el('p', { class: 'tomt', style: 'padding:14px 0', texti: 'Engin skrá enn.' }),

    (() => {
      const inntak = el('input', {
        type: 'file', multiple: true, style: 'display:none',
        onchange: async (e) => {
          const skrarNyjar = Array.from(e.target.files || []);
          if (!skrarNyjar.length) return;
          merki.textContent = 'Hleð upp';
          try {
            for (const sk of skrarNyjar) {
              if (sk.size > 25 * 1024 * 1024) {
                throw new Error(sk.name + ' er stærri en 25 MB. Sendu okkur hlekk á hana í staðinn.');
              }
              await g.nyttVidhengi(id, t.fyrirtaeki_id, sk);
            }
            opnaTask(id, { admin, eftir });
          } catch (villa) {
            merki.textContent = villa.message;
            merki.className = 'form-status form-status--err';
          }
        }
      });
      const merki = el('span', { texti: 'Bæta við skrá' });
      return el('label', { class: 'btn btn--sm btn--ghost', style: 'margin-top:4px' }, [merki, inntak]);
    })(),

    el('h3', { style: 'margin-top:24px; font-family:var(--f-body); font-weight:500; font-size:15px',
               texti: 'Samtal' }),

    ath.length
      ? el('ul', { class: 'ath-listi' }, ath.map((a) => el('li', {
          class: 'ath' + (a.notandi && a.notandi.hlutverk === 'admin' ? ' ath--tveir' : '')
        }, [
          el('div', { class: 'ath__haus' }, [
            el('strong', { texti: a.notandi ? a.notandi.nafn : 'Óþekkt' }),
            el('span', { texti: sidan(a.stofnad) })
          ]),
          el('div', { class: 'ath__texti', texti: a.texti })
        ])))
      : el('p', { class: 'tomt', style: 'padding:18px 0', texti: 'Engar athugasemdir enn.' }),

    el('form', {
      class: 'field', style: 'margin-top:16px',
      onsubmit: async (e) => {
        e.preventDefault();
        const texti = svarsvaedi.value.trim();
        if (!texti) return;
        await g.nyAthugasemd(id, texti);
        if (eftir) eftir();
        opnaTask(id, { admin, eftir });
      }
    }, [
      svarsvaedi,
      el('div', { style: 'margin-top:10px' }, [
        el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Senda' })
      ])
    ])
  ]);

  if (!d.open) d.showModal();
  if (skrunad) kort.scrollTop = skrunad;
}

function skraLina(sk, g) {
  return el('li', { class: 'skra' }, [
    el('span', { class: 'skra__nafn', texti: sk.nafn }),
    el('span', { class: 'skra__meta', texti: staerd(sk.staerd) }),
    el('button', {
      type: 'button', class: 'skra__opna', texti: 'Opna',
      onclick: async (e) => {
        const hnappur = e.currentTarget;
        hnappur.disabled = true;
        try {
          const slod = await g.slodAVidhengi(sk);
          window.open(slod, '_blank', 'noopener');
        } catch (villa) {
          hnappur.textContent = 'Ekki til';
          hnappur.title = villa.message;
        } finally {
          hnappur.disabled = false;
        }
      }
    })
  ]);
}

/* ------------------------------------------------------------------
   Verklína
   ------------------------------------------------------------------ */
export function taskLina(t, { admin, eftir }) {
  const lokid = t.stada === 'lokid';

  return el('li', {}, [el('div', { class: 'task' + (lokid ? ' task--lokid' : '') }, [
    el('button', {
      type: 'button', class: 'hak', 'aria-pressed': String(lokid),
      'aria-label': lokid ? 'Taka úr lokið' : 'Haka í lokið',
      disabled: !admin,
      title: admin ? '' : 'Við hökum í lokið',
      onclick: async () => {
        const g = await gogn();
        await g.uppfaeraTask(t.id, { stada: lokid ? 'i_vinnslu' : 'lokid' });
        if (eftir) eftir();
      }
    }),
    el('div', { class: 'task__mid' }, [
      el('button', { type: 'button', class: 'task__titill', texti: t.titill,
                     onclick: () => opnaTask(t.id, { admin, eftir }) }),
      el('div', { class: 'task__undir' }, [
        admin && t.fyrirtaeki ? el('span', { texti: t.fyrirtaeki.nafn }) : null,
        /* Hver bað um þetta. Bara þegar það kom frá viðskiptavininum,
           okkar eigin taskar þurfa það ekki. */
        fraVidskiptavini(t) ? el('span', { class: 'task__fra', texti: 'Frá ' + t.hofundur_notandi.nafn }) : null,
        t.verkefni ? el('span', { texti: t.verkefni.titill }) : null,
        t.skiladagur ? el('span', {
          class: erSeint(t.skiladagur) && !lokid ? 'seint' : '',
          texti: (erSeint(t.skiladagur) && !lokid ? 'Rann út ' : 'Skil ') + dags(t.skiladagur)
        }) : null,
        t.abyrgd_notandi ? el('span', { texti: t.abyrgd_notandi.nafn }) : null,
        undirverkTala(t)
      ])
    ]),
    el('div', { class: 'task__hofn' }, [
      t.forgangur === 'hatt' && !lokid ? el('span', { class: 'pforg', texti: 'Hátt' }) : null,
      pilla(t.stada, 'task')
    ])
  ])]);
}

export { gogn, STODUR_TASK, STODUR_VERK, STODUR_INNRI, FORGANGUR, stillingar, undirverkTala };


/* Glerborði neðst á skjánum þegar gesturinn kom úr "Settu saman ykkar kerfi" */
function synaBorda() {
  if (!sersnid || document.querySelector('.gh-bordi')) return;
  const nafn = gestNafn();
  const b = el('div', { class: 'gh-bordi', role: 'region', 'aria-label': 'Sýnidæmi' }, [
    el('span', { class: 'gh-bordi__punktur', 'aria-hidden': 'true' }),
    el('span', { class: 'gh-bordi__texti', texti: nafn ? 'Sýnidæmi: ' + nafn : 'Sýnidæmi með tilbúnum gögnum' }),
    /* Í síma er ekki pláss fyrir allt, en orðið Sýnidæmi sést alltaf */
    el('span', { class: 'gh-bordi__stutt', texti: 'Sýnidæmi' }),
    el('a', { class: 'gh-bordi__hn', href: '../byggja.html?breyta=1', texti: 'Breyta vali' }),
    el('a', { class: 'gh-bordi__hn gh-bordi__hn--gull', href: '../index.html#kynning', texti: 'Sækja um aðgang' })
  ]);
  document.body.appendChild(b);
}
