/* ==========================================================================
   Stillingar: aðgangurinn, stofan, aðgangar, undirskriftin og tengingarnar
   á einum stað. Viðskiptavinur sér bara aðganginn sinn.
   lykilForm og opnaLykilGlugga eru líka notuð í uppsetningunni (byrja.js).
   ========================================================================== */

import {
  gogn, el, fylla, vardaHlid, teiknaHaus, opnaLykilord, sersnid, stofuNafn, gestNafn, tungumal, setjaTungumal,
  gjaldmidill, setjaGjaldmidil, gengid, virkurGjaldmidill, erEnska, stofa as nuStofa, erTveir, harPostholf,
  opnaBodGlugga, afrita, tilkynna, dags, geymaTengdar, tengdarGeymdar, ertengt, erNyStofa
} from './portal.js';
import { skeraMerki } from './merki-skera.js';
import { lesaUndirskrift, sjalfgefinUndirskrift, undirskriftHtml, opnaUndirskriftGlugga } from './undirskrift.js';

/* Sýnidæmi úr Settu saman: enginn prufuaðgangur sýndur, engin tæknimál.
   Venjulega kerfið (án sersnid) er óbreytt. */
const SYNID = !!sersnid;
const EINFALT = 'Tveir setur tenginguna upp með þér.';
/* Nánari leiðbeiningar fyrir hverja tengingu, skref fyrir skref */
const LEIDBEININGAR = 'https://tveir.is/glerhusid/leidbeiningar.html';

/* Líkönin sem Glerhúsið býður upp á (sami listi og í gervigreind.ts) */
const CLAUDE_LIKON = [['claude-opus-5-5', 'Claude Opus 5.5'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5'], ['claude-haiku-5-5', 'Claude Haiku 5.5']];
const OPENAI_LIKON = /^(gpt-5(\.[0-9]+)?(-mini|-nano)?|gpt-4\.1(-mini|-nano)?|gpt-4o(-mini)?|o3(-mini)?|o4-mini)$/;
const DK_NUMER = /^[A-Za-z0-9._-]{1,30}$/;

/* Tengingar með API lykli. reitir: leynt: false fer í stillingar (sést aftur), annað í Vault.
   val: fellilisti (fall af núverandi línu), mynstur: athugun áður en vistað er.
   nuna: hvað virkar þegar lykillinn hefur staðist prófun. */
export const LYKLAR = {
  payday: { veita: 'payday', lb: 'payday', heiti: 'Payday', merki: 'payday.png', litur: '#52bb62', fyllt: true, slod: 'bokhald.html',
    hvad: 'Lokin verk og samningar verða að reikningsdrögum', opna: ['Opna Payday', 'https://app.payday.is'],
    nuna: 'Lokin verk og samningar verða að drögum í Payday með einum smelli. Ekkert er bókað eða sent fyrr en þú gerir það í Payday.',
    skref: ['Skráðu þig inn á app.payday.is hjá fyrirtækinu sem gefur út reikningana.', 'Opnaðu stillingar fyrirtækisins og finndu API.', 'Búðu til nýtt forrit og kallaðu það Glerhúsið.', 'Afritaðu Client ID og Client Secret og límdu þá hér fyrir neðan.'],
    reitir: [{ nafn: 'clientId', heiti: 'Client ID' }, { nafn: 'clientSecret', heiti: 'Client Secret' }] },
  dk: { veita: 'dk', lb: 'dk', heiti: 'DK', merki: 'dk.png', litur: '#4743f7', slod: 'bokhald.html',
    hvad: 'Lokin verk og samningar verða að reikningsdrögum', opna: ['Opna dkPlus', 'https://dkplus.is'],
    nuna: 'Lokin verk og samningar verða að óbókuðum reikningum í DK með einum smelli. Ekkert er bókað eða sent fyrr en þú gerir það í DK.',
    skref: ['Skráðu þig inn á dkPlus með aðgangi fyrirtækisins.', 'Opnaðu stillingar notandans og veldu Auðkenningar tákn.', 'Búðu til nýjan token, kallaðu hann Glerhúsið og veldu fyrirtækið. Tokeninn hefur sama aðgang og notandinn, svo notandinn þarf aðgang að viðskiptamönnum og sölu.', 'Límdu tokeninn hér fyrir neðan, ásamt vörunúmerinu sem línurnar fara á og númeri sölumanns.'],
    athugid: 'Er fyrirtækið ekki með dkPlus API (vefþjónustu dkPlus)? Hafðu samband við dk hugbúnað og biddu um aðgang. dk segir þér hvað hann kostar. Finnurðu ekki Auðkenningar tákn er aðgangurinn líklega ekki kominn.',
    reitir: [{ nafn: 'token', heiti: 'API token' },
      { nafn: 'vorunumer', heiti: 'Vörunúmer', leynt: false, daemi: 'Til dæmis 100', mynstur: DK_NUMER,
        skyring: 'Vara eða þjónusta í DK sem línurnar á reikningnum fara á.', villa: 'Vörunúmerið má bara hafa bókstafi, tölur, punkt, strik og undirstrik.' },
      { nafn: 'solumadur', heiti: 'Sölumaður', leynt: false, daemi: 'Til dæmis 1', mynstur: DK_NUMER,
        skyring: 'Númer sölumanns í DK. DK krefst þess á hverjum reikningi.', villa: 'Sölumaðurinn má bara hafa bókstafi, tölur, punkt, strik og undirstrik.' },
      { nafn: 'vorunumer_vsklaust', heiti: 'Vörunúmer án VSK', leynt: false, valfrjalst: true, mynstur: DK_NUMER,
        skyring: 'Valfrjálst. Fyrir samninga og verk sem eru án VSK.', villa: 'Vörunúmerið má bara hafa bókstafi, tölur, punkt, strik og undirstrik.' }] },
  shopify: { veita: 'shopify', lb: 'shopify', heiti: 'Shopify', merki: 'shopify.svg', litur: '#5E8E3E', slod: 'verslun.html',
    hvad: 'Lagerstaða og pantanir úr vefversluninni', opna: ['Opna Shopify Dev Dashboard', 'https://dev.shopify.com/dashboard'],
    nuna: 'Verslun birtist í valmyndinni með pöntunum, vörum og lagerstöðu. Glerhúsið les bara, það breytir engu í versluninni.',
    skref: ['Í stjórnborði verslunarinnar (admin.shopify.com): Settings, Apps, Develop apps og svo Build apps in Dev Dashboard. Þá lendir appið hjá sömu verslun og það á að tengjast.', 'Í Dev Dashboard: smelltu á Create app, veldu Start from Dev Dashboard, kallaðu appið Glerhúsið og smelltu á Create.', 'Í Versions: láttu App URL vera eins og það er, settu read_products, read_inventory og read_orders í Scopes og smelltu á Release.', 'Á spjaldinu Installs: smelltu á Install app, veldu verslunina, smelltu á Install og samþykktu aðganginn.', 'Opnaðu Settings í appinu, afritaðu Client ID og Client secret af spjaldinu Credentials og límdu hér, ásamt slóð verslunarinnar.'],
    athugid: 'Sérðu ekki Develop apps eða Create app? Eigandi verslunarinnar þarf að gefa þér heimild til að búa til öpp (App developer). Slóðin admin.shopify.com/store/NAFN þýðir að verslunin er NAFN.myshopify.com. Lykill sem byrjar á shpat_ er gamla gerðin af appi og virkar ekki hér.',
    reitir: [{ nafn: 'verslun', heiti: 'Slóð verslunarinnar', daemi: 'nafn.myshopify.com', leynt: false }, { nafn: 'clientId', heiti: 'Client ID' }, { nafn: 'clientSecret', heiti: 'Client secret' }] },
  claude: { veita: 'claude', lb: 'claude', heiti: 'Claude', merki: 'claude.svg', litur: '#D97757',
    hvad: 'Gervigreind sem skrifar drög að svörum og samantektum', opna: ['Opna Claude Console', 'https://platform.claude.com/settings/keys'],
    nuna: 'Drög að svörum og samantektir eru komin í Samskipti, Fyrirspurnir, verkefni og skýrslur. Ekkert er sent án þess að manneskja fari yfir það.',
    skref: ['Skráðu þig inn á Claude Console (platform.claude.com).', 'Keyptu inneign undir Billing. Hver notkun kostar smá.', 'Viltu hámark á mánuði: opnaðu Limits í stillingunum og settu það þar.', 'Farðu í API keys, smelltu á Create key og kallaðu hann Glerhúsið.', 'Afritaðu lykilinn strax (hann sést bara einu sinni) og límdu hér.'],
    athugid: 'Claude áskrift (Pro eða Max) gefur ekki API lykil. API notkun er rukkuð sér hjá Anthropic.',
    reitir: [{ nafn: 'lykill', heiti: 'API lykill', daemi: 'sk-ant-...' },
      { nafn: 'likan', heiti: 'Líkan', leynt: false, val: () => [['', 'Sjálfgefið (Claude Opus 5.5)'], ...CLAUDE_LIKON],
        skyring: 'Opus skrifar best. Sonnet og Haiku eru ódýrari og fljótari.' }] },
  chatgpt: { veita: 'chatgpt', lb: 'chatgpt', heiti: 'ChatGPT', merki: 'openai.svg', litur: '#000000',
    hvad: 'Gervigreind sem skrifar drög að svörum og samantektum', opna: ['Opna OpenAI Platform', 'https://platform.openai.com/api-keys'],
    nuna: 'Drög að svörum og samantektir eru komin í Samskipti, Fyrirspurnir, verkefni og skýrslur. Ekkert er sent án þess að manneskja fari yfir það.',
    skref: ['Skráðu þig inn á OpenAI Platform (platform.openai.com).', 'Settu inn greiðslukort og inneign undir Billing. Hver notkun kostar smá.', 'Settu mánaðarhámark undir Limits.', 'Farðu í API keys, smelltu á Create new secret key og kallaðu hann Glerhúsið.', 'Afritaðu lykilinn strax (hann sést bara einu sinni) og límdu hér.'],
    athugid: 'ChatGPT Plus áskrift gefur ekki API lykil. API notkun er rukkuð sér hjá OpenAI.',
    reitir: [{ nafn: 'lykill', heiti: 'API lykill', daemi: 'sk-...' },
      { nafn: 'likan', heiti: 'Líkan', leynt: false,
        val: (r) => [['', 'Sjálfgefið (gpt-5)'], ...((r && r.stillingar && Array.isArray(r.stillingar.likon) ? r.stillingar.likon : [])
          .map(String).filter((x) => OPENAI_LIKON.test(x)).map((x) => [x, x]))],
        skyring: 'Listinn sýnir líkönin sem lykillinn hefur aðgang að. Hann fyllist þegar lykillinn hefur verið prófaður.' }] }
};

/* Slóð Shopify verslunar á forminu nafn.myshopify.com. Tekur líka við slóðinni
   úr vafranum (admin.shopify.com/store/nafn) og nafninu einu. */
function verslunarSlod(v) {
  const x = String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '');
  const admin = /^admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/.exec(x);
  if (admin) return admin[1] + '.myshopify.com';
  const hrein = x.replace(/[/?#].*$/, '');
  return /^[a-z0-9][a-z0-9-]*$/.test(hrein) ? hrein + '.myshopify.com' : hrein;
}

const MAN = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
const pad = (n) => String(n).padStart(2, '0');
const hvenaer = (s) => { const d = new Date(s); return d.getDate() + '. ' + MAN[d.getMonth()] + ' kl. ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };

/* Villutexti prófunar. Sumar villur segja að lykillinn sjálfur virki
   ("Tengt við X, en appið vantar aðganginn"): þá ekkert á undan. Aðrar eru
   tímamörk eða sambandsleysi, svo forskeytið segir bara að prófunin tókst ekki. */
function prufuVilla(svar) {
  const x = String(svar || 'óþekkt villa').trim();
  const texti = /^(Tengt við|Lykillinn virkar en)/i.test(x) ? x : 'Prófunin tókst ekki: ' + x;
  return /[.!?]$/.test(texti) ? texti : texti + '.';
}

/* Staða tengingar sem notar API lykil: [stada, texti]. r er lína úr tengingarStada. */
export function lykilStada(r, t) {
  if (!r) return ['ekki', ''];
  const ok = /^ok/i.test(r.prufa_svar || '');
  if (r.prufad && !ok) return ['bidur', prufuVilla(r.prufa_svar)];
  if (!r.prufad) return ['bidur', 'Lykill vistaður (endar á ' + (r.sidustu4 || '????') + ') en ekki prófaður ennþá.'];
  const s = r.stillingar || {};
  if (t.veita === 'dk' && (!s.vorunumer || !s.solumadur)) return ['bidur', 'Lykillinn virkar. Settu inn vörunúmer og sölumann svo drögin verði til.'];
  const svar = String(r.prufa_svar).replace(/^ok:?\s*/i, '').replace(/\.$/, '') || 'Lykillinn virkar';
  const likan = s.likan ? ' Líkan: ' + ((CLAUDE_LIKON.find((x) => x[0] === s.likan) || [])[1] || s.likan) + '.' : '';
  return ['tengt', svar + '. Prófað ' + hvenaer(r.prufad) + '.' + likan];
}

/* Leiðbeiningar skref fyrir skref, reitirnir og Vista. Lykillinn fer beint
   í gagnagrunninn og er aldrei sýndur aftur.
   eftir(): sækir tengingarnar aftur og skilar { veita: lína }. d: glugginn sem lokast. */
export function lykilForm(t, { g, r: upphaf, eftir, d } = {}) {
  let r = upphaf || null;
  const villa = el('p', { class: 'villa', role: 'alert', hidden: true });
  const tokst = el('p', { class: 'st-t__tokst', role: 'status', hidden: true });
  const syna = (ok, texti) => { villa.hidden = tokst.hidden = true; const x = ok ? tokst : villa; x.textContent = texti; x.hidden = false; };
  const fleiri = (t.reitir || []).filter((f) => f.leynt !== false).length > 1;
  /* Prófar lykilinn strax hjá veitunni. Tekst það: glugginn lokast og spjaldið
     segir að tengingin virki. Tekst það ekki: glugginn helst opinn með
     skýringunni, Prófa aftur og Aftengja. */
  async function profa(hnappur, venjulegt) {
    hnappur.disabled = true; hnappur.textContent = 'Prófa lykilinn';
    let n;
    try { n = await g.profaTengingu(t.veita); }
    catch (er) { n = { ok: false, svar: er.message || 'Ekki tókst að prófa.' }; }
    try { const ny = eftir ? await eftir() : null; if (ny && ny[t.veita]) r = ny[t.veita]; } catch (er) { /* staðan bíður */ }
    synaStjorn();
    hnappur.disabled = false; hnappur.textContent = venjulegt;
    if (n && n.ok) {
      const svar = String(n.svar || '').replace(/\.$/, '');
      const virkar = g.prufa ? '' : (fleiri ? 'Lyklarnir virka og eru vistaðir. ' : 'Lykillinn virkar og er vistaður. ');
      const vantarDk = t.veita === 'dk' && r && r.stillingar && (!r.stillingar.vorunumer || !r.stillingar.solumadur);
      syna(true, (svar ? svar + '. ' : '') + virkar + (vantarDk ? 'Settu inn vörunúmer og sölumann svo drögin verði til.' : t.nuna || ''));
      if (t.veita === 'chatgpt') teiknaVal();
      if (!vantarDk) setTimeout(() => { if (d && d.open) d.close(); }, 4500);
    } else syna(false, (n && n.svar) || 'Lykillinn virkar ekki.');
    return n;
  }
  const reitir = (t.reitir || []).map((f) => {
    const gildi = f.leynt === false && r && r.stillingar ? (r.stillingar[f.nafn] || '') : '';
    const inn = f.val
      ? el('select', { name: f.nafn })
      : el('input', { type: f.leynt === false ? 'text' : 'password', name: f.nafn, autocomplete: 'off', spellcheck: 'false',
          autocapitalize: 'off', placeholder: f.daemi || '', value: gildi });
    const vistad = f.leynt !== false ? el('small', { texti: 'Vistað. Skildu eftir autt til að halda núverandi lykli.' }) : null;
    const skyring = f.skyring ? el('small', { texti: f.skyring }) : null;
    return { f, inn, vistad, svid: el('label', { class: 'st-t__reitur' }, [el('span', { texti: f.heiti }), inn, r ? vistad : null, skyring]) };
  });
  /* Fellilistarnir (líkan) teiknaðir út frá núverandi línu */
  function teiknaVal() {
    reitir.filter(({ f }) => f.val).forEach(({ f, inn }) => {
      const nu = inn.value || (r && r.stillingar ? r.stillingar[f.nafn] || '' : '');
      const valkostir = f.val(r);
      if (nu && !valkostir.some((v) => v[0] === nu)) valkostir.push([nu, nu]);
      fylla(inn, valkostir.map(([v, h]) => el('option', { value: v, texti: h, selected: v === nu })));
    });
  }
  teiknaVal();
  const vistaTexti = () => (r ? 'Vista breytingar' : 'Vista og tengja');
  const vista = el('button', { type: 'submit', class: 'btn', texti: vistaTexti() });
  const aftur = el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Prófa aftur', onclick: () => profa(aftur, 'Prófa aftur') });
  const aftengja = el('button', { type: 'button', class: 'btn btn--ghost btn--danger', texti: 'Aftengja', onclick: async () => {
    if (!confirm('Aftengja ' + t.heiti + '? Lykillinn er þurrkaður út.')) return;
    try { await g.eydaTengingu(t.veita); if (eftir) await eftir(); if (d) d.close(); }
    catch (er) { syna(false, er.message || 'Ekki tókst að aftengja.'); }
  } });
  const fot = el('div', { class: 'spjald__fot' }, [
    vista,
    t.opna ? el('a', { class: 'btn btn--ghost', href: t.opna[1], target: '_blank', rel: 'noopener', texti: t.opna[0] }) : null
  ]);
  /* Prófa aftur og Aftengja birtast um leið og lykill er vistaður, líka ef
     fyrsta prófunin mistókst og glugginn er enn opinn */
  function synaStjorn() {
    if (!r) return;
    if (!aftur.isConnected) vista.after(aftur);
    if (!aftengja.isConnected) fot.append(aftengja);
    reitir.forEach(({ inn, vistad }) => { if (vistad && !vistad.isConnected) inn.after(vistad); });
  }
  synaStjorn();
  const form = el('form', { class: 'st-t__form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); villa.hidden = tokst.hidden = true;
    /* Það sem er þegar vistað í stillingum (t.d. líkönin sem ChatGPT lykillinn
       má nota) fer aftur með, svo það þurrkist ekki út */
    const stillingar = { ...((r && r.stillingar) || {}), ...(t.fastar || {}) }, leyndo = {};
    for (const { f, inn } of reitir) {
      const v = String(inn.value || '').trim();
      if (f.leynt !== false) { if (v) leyndo[f.nafn] = v; continue; }
      if (f.nafn === 'verslun') { const hreint = verslunarSlod(v); stillingar.verslun = hreint; inn.value = hreint; continue; }
      if (!v) {
        if (f.mynstur && !f.valfrjalst) { syna(false, 'Fylltu út ' + f.heiti.toLowerCase() + '.'); inn.focus(); return; }
        delete stillingar[f.nafn];
        continue;
      }
      if (f.mynstur && !f.mynstur.test(v)) { syna(false, f.villa || 'Reiturinn ' + f.heiti + ' er ekki á réttu formi.'); inn.focus(); return; }
      stillingar[f.nafn] = v;
    }
    const leyndirReitir = reitir.filter(({ f }) => f.leynt !== false);
    if (Object.keys(leyndo).length && Object.keys(leyndo).length < leyndirReitir.length) { syna(false, 'Fylltu út alla lyklareitina.'); return; }
    if (!r && !Object.keys(leyndo).length) { syna(false, 'Límdu lykilinn inn fyrst.'); return; }
    vista.disabled = true; vista.textContent = 'Vista';
    try {
      await g.vistaTengingu(t.veita, stillingar, Object.keys(leyndo).length ? leyndo : null);
      reitir.forEach(({ inn }) => { if (inn.type === 'password') inn.value = ''; });
    } catch (er) {
      syna(false, er.message || 'Ekki tókst að vista.');
      vista.disabled = false; vista.textContent = vistaTexti();
      return;
    }
    r = { ...(r || { veita: t.veita }), stillingar };
    synaStjorn();
    await profa(vista, 'Vista breytingar');
  } }, [
    ...reitir.map((x) => x.svid),
    villa,
    tokst,
    fot
  ]);
  return el('div', { class: 'st-t__lykill' }, [
    el('div', { class: 'st-t__tharf' }, [el('strong', { texti: 'Svona tengirðu' }),
      el('ol', { class: 'st-t__skref' }, t.skref.map((x) => el('li', { texti: x })))]),
    t.athugid ? el('p', { class: 'skyring', texti: t.athugid }) : null,
    t.lb ? el('a', { class: 'st-t__lb', href: LEIDBEININGAR + '#' + t.lb, target: '_blank', rel: 'noopener', texti: 'Nánari leiðbeiningar og algeng vandamál' }) : null,
    form,
    el('p', { class: 'skyring st-t__oruggt', texti: 'Lykillinn er prófaður um leið og þú vistar. Hann er geymdur dulkóðaður og sést aldrei aftur á þessari síðu, ekki heldur hjá þér.' })
  ]);
}

/* Merki tengingar: litaður reitur með merkinu */
export const tengingarTakn = (t) => el('span', { class: 'st-teng__takn' + (t.ljos ? ' er-ljos' : '') + (t.fyllt ? ' er-fyllt' : ''), style: 'background:' + t.litur, 'aria-hidden': 'true' },
  [t.merki ? el('img', { src: 'assets/tengingar/' + t.merki, alt: '', loading: 'lazy' }) : document.createTextNode(t.stafur || t.heiti[0])]);

/* Gluggi með lyklaforminu einu og sér (uppsetningin notar hann) */
export function opnaLykilGlugga({ g, veita, r, eftir }) {
  const t = LYKLAR[veita];
  const kort = el('div', { class: 'pdialog__kort' });
  const d = el('dialog', { class: 'pdialog', 'aria-labelledby': 'st-t-h' }, [kort]);
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => d.remove());
  fylla(kort, [
    el('div', { class: 'pdialog__haus' }, [
      el('div', { class: 'st-t__haus' }, [tengingarTakn(t), el('h2', { id: 'st-t-h', texti: t.heiti })]),
      el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
    ]),
    el('p', { class: 'st-t__hvad', texti: t.hvad + '.' }),
    lykilForm(t, { g, r, eftir, d })
  ]);
  document.body.append(d);
  d.showModal();
  return d;
}

/* Síðan sjálf keyrir bara á stillingar.html. byrja.js flytur inn lykilForm. */
const ER_SIDAN = /(^|\/)stillingar\.html$/.test(location.pathname);
const ek = ER_SIDAN ? await vardaHlid({ badir: true }) : null;
if (ek) start();

async function start() {
  const g = await gogn();
  const admin = ek.hlutverk === 'admin';
  let sidastaStada = null;
  teiknaHaus(ek, 'Stillingar');
  const innihald = document.getElementById('innihald');

  /* Komið til baka úr OAuth (Google, Meta, TikTok) */
  try {
    const leit = new URLSearchParams(location.search);
    const VEITUR = { google: 'Google', meta: 'Meta', tiktok: 'TikTok', shopify: 'Shopify' };
    const ASTAEDUR = { haett_vid: 'Hætt var við tenginguna.', adgangur: 'Aðgangurinn var ekki veittur.', lokad: 'Þessi tenging bíður enn samþykkis.',
      state: 'Hlekkurinn var útrunninn. Prófaðu aftur.', timi: 'Það tók of langan tíma. Prófaðu aftur.',
      skipti: 'Veitan tók ekki við tengingunni. Prófaðu aftur.', samband: 'Náði ekki sambandi við veituna. Prófaðu aftur.',
      vista: 'Tengingin vistaðist ekki. Prófaðu aftur.' };
    if (leit.get('tengt')) tilkynna(VEITUR[leit.get('tengt')] ? VEITUR[leit.get('tengt')] + ' er tengt.' : 'Tengingin er komin á.');
    else if (leit.get('ekki_tengt')) tilkynna('Tengingin tókst ekki. ' + (ASTAEDUR[leit.get('astaeda')] || 'Prófaðu aftur.'));
    if (leit.get('tengt') || leit.get('ekki_tengt')) history.replaceState(history.state, '', location.pathname);
  } catch (e) { /* skiptir ekki máli */ }

  const kafli = (titill, lysing, born, id) => el('section', { class: 'card pblokk st-kafli', id: id || null }, [
    el('div', { class: 'st-kafli__haus' }, [el('h2', { texti: titill }), lysing ? el('p', { class: 'skyring', texti: lysing }) : null]),
    ...born
  ]);

  /* ---------- Aðgangurinn ---------- */
  /* Í sýnidæmi: nafnið úr Settu saman í stað prufuaðgangsins */
  const ekSynt = SYNID ? { ...ek, nafn: gestNafn() || stofuNafn(), netfang: '' } : ek;
  const adgangur = kafli('Aðgangurinn þinn', null, [
    el('dl', { class: 'st-upplysingar' }, [
      el('div', {}, [el('dt', { texti: 'Nafn' }), el('dd', { texti: ekSynt.nafn || '' })]),
      el('div', {}, [el('dt', { texti: 'Netfang' }), el('dd', { texti: SYNID ? 'Sýnidæmi' : ek.netfang || '' })]),
      el('div', {}, [el('dt', { texti: 'Hlutverk' }), el('dd', { texti: admin ? (ek.er_eigandi && !SYNID ? 'Stjórnandi og eigandi' : 'Stjórnandi') : 'Viðskiptavinur' + (ek.fyrirtaeki ? ' hjá ' + ek.fyrirtaeki.nafn : '') })])
    ]),
    SYNID
      ? el('div', { class: 'st-hnappar' }, [
          el('a', { class: 'btn btn--ghost', href: 'https://tveir.is/glerhusid/index.html', texti: 'Loka sýnidæmi' })
        ])
      : el('div', { class: 'st-hnappar' }, [
          el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Breyta lykilorði',
            onclick: () => opnaLykilord({ heiti: 'Breyta lykilorði', netfang: ek.netfang }) }),
          el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Skrá út',
            onclick: async () => { await g.utskra(); location.replace('./'); } })
        ])
  ]);

  /* ---------- Tungumál og gjaldmiðill ---------- */
  /* Tungumálið fylgir vafranum, gjaldmiðillinn gildir fyrir allt kerfið */
  const tungaVal = el('select', { class: 'st-val', 'aria-label': 'Tungumál' }, [
    el('option', { value: 'is', texti: 'Íslenska', 'data-ekki-thyda': '' }), el('option', { value: 'en', texti: 'English', 'data-ekki-thyda': '' })]);
  tungaVal.value = tungumal();
  tungaVal.addEventListener('change', () => { setjaTungumal(tungaVal.value); location.reload(); });
  const gjaldVal = el('select', { class: 'st-val', 'aria-label': 'Gjaldmiðill' }, [
    el('option', { value: 'ISK', texti: 'Íslenskar krónur (ISK)' }), el('option', { value: 'EUR', texti: 'Evrur (EUR)' }), el('option', { value: 'USD', texti: 'Dollarar (USD)' })]);
  gjaldVal.value = gjaldmidill();
  const gjaldSvar = el('p', { class: 'skyring st-val__svar', role: 'status' });
  gjaldVal.addEventListener('change', async () => {
    const fyrra = gjaldmidill();
    gjaldVal.disabled = true; gjaldSvar.textContent = 'Vistar';
    try {
      await g.vistaKerfisstillingu('gjaldmidill', gjaldVal.value);
      setjaGjaldmidil(gjaldVal.value); location.reload();
    } catch (e) {
      gjaldVal.value = fyrra; gjaldVal.disabled = false; gjaldSvar.textContent = e.message || 'Tókst ekki að vista';
    }
  });
  const synid = el('div', { class: 'st-val__lina' }, [
    el('label', { class: 'st-val__reitur' }, [el('span', { texti: 'Tungumál' }), tungaVal]),
    admin ? el('label', { class: 'st-val__reitur' }, [el('span', { texti: 'Gjaldmiðill í bókhaldi' }), gjaldVal]) : null
  ]);
  /* Gengið sem upphæðirnar eru umreiknaðar á */
  const gg = gengid(), vg = virkurGjaldmidill();
  const kommu = (n) => (erEnska() ? String(n) : String(n).replace('.', ','));
  const gengiLina = !admin || gjaldmidill() === 'ISK' ? null
    : vg === 'ISK'
      ? el('p', { class: 'skyring', texti: 'Gengið náðist ekki, svo upphæðir eru sýndar í krónum þar til það næst.' })
      : el('p', { class: 'skyring' }, [
          document.createTextNode('Gengi'),
          document.createTextNode(': 1 ' + (vg === 'EUR' ? '€' : '$') + ' = ' + kommu(Math.round(1 / gg[vg] * 100) / 100) + (erEnska() ? ' ISK' : ' kr.')),
          gg.dags ? document.createTextNode(' (' + gg.dags.split('-').reverse().join('.') + ')') : null,
          document.createTextNode('. '),
          document.createTextNode('Viðmiðunargengi Seðlabanka Evrópu, uppfært daglega.')]);
  const synKafli = kafli('Tungumál og gjaldmiðill',
    admin ? 'Tungumálið gildir í þessum vafra. Gjaldmiðillinn gildir fyrir allt kerfið. Allar upphæðir eru geymdar í krónum og umreiknaðar á gengi dagsins. Reikningsdrög í Payday og DK eru í krónum.' : 'Tungumálið gildir í þessum vafra.',
    [synid, gengiLina, admin ? gjaldSvar : null]);

  if (!admin) { fylla(innihald, [siduHaus(), adgangur, synKafli]); return; }

  /* ---------- Stofan ---------- */
  const stofaSvid = el('div', {}, [el('p', { class: 'tomt', texti: 'Sæki stofuna' })]);
  const stofaKafli = kafli('Stofan', 'Nafn, merki og litur birtast í hausnum hjá öllum í Glerhúsinu ykkar.', [stofaSvid], 'stofan');

  /* ---------- Aðgangar ---------- */
  const adgangarSvid = el('div', {}, [el('p', { class: 'tomt', texti: 'Sæki aðgangana' })]);
  const adgangarKafli = kafli('Aðgangar', 'Stjórnendur sjá allt. Viðskiptavinir sjá bara verkefni síns fyrirtækis.', [adgangarSvid], 'adgangar');

  /* ---------- Undirskriftin ---------- */
  let undirskrift = await lesaUndirskrift(g, ekSynt);
  const usForsyn = el('div', { class: 'sk-undirsk st-undirsk' });
  const teiknaUs = () => { usForsyn.innerHTML = undirskriftHtml({ ...undirskrift, virk: true }) || '<p class="skyring">Engin undirskrift ennþá.</p>'; };
  teiknaUs();
  const undirskriftKafli = kafli('Undirskrift í pósti', harPostholf()
    ? 'Fer neðst í póstana sem þú sendir úr Pósthólfinu. Fylgir aðganginum þínum á milli tækja.'
    : 'Fer neðst í póstana sem þú sendir úr kerfinu. Fylgir aðganginum þínum á milli tækja.', [
    usForsyn,
    el('div', { class: 'st-hnappar' }, [
      el('button', { type: 'button', class: 'btn', texti: 'Breyta undirskrift', onclick: async () => {
        const ny = await opnaUndirskriftGlugga({ g, u: undirskrift, sjalfgefin: sjalfgefinUndirskrift(g, ekSynt) });
        if (ny) { undirskrift = ny; teiknaUs(); }
      } })
    ])
  ]);

  /* ---------- Verk-netfangið ---------- */
  const verkSvid = el('div', {}, [el('p', { class: 'tomt', texti: 'Sæki verk-netfangið' })]);
  const verkKafli = kafli('Verk-netfangið', 'Póstur á þetta netfang verður að verkum á Stjórnborðinu.', [verkSvid], 'verk');

  /* ---------- Tengingarnar ---------- */
  const tengingarSvid = el('div', { class: 'st-teng-svid' }, [el('p', { class: 'tomt', texti: 'Athuga tengingarnar' })]);
  const tengingarKafli = kafli('Tengingar', 'Öppin sem kerfið talar við. Ýttu á Tengja eða Nánar til að sjá hvað hver tenging gerir og hvað þarf til.', [tengingarSvid], 'tengingar');

  fylla(innihald, [siduHaus(), adgangur, stofaKafli, adgangarKafli, synKafli, undirskriftKafli, verkKafli, tengingarKafli]);
  const [s] = await Promise.all([stadaTenginga(), teiknaStofu(), teiknaAdganga(), teiknaVerk()]);
  teiknaTengingar(s);
  /* Komið beint á kafla (t.d. stillingar.html#tengingar) */
  if (location.hash) { const k = document.getElementById(location.hash.slice(1)); if (k) k.scrollIntoView(); }

  function siduHaus() {
    return el('div', { class: 'page-head', style: 'padding-top:0' }, [
      el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Stillingar' }),
      el('p', { class: 'lead', texti: admin ? 'Aðgangurinn, stofan, undirskriftin og öppin sem kerfið er tengt.' : 'Aðgangurinn þinn.' })
    ]);
  }

  /* ------------------------------------------------------------------
     Stofan: nafn, merki, netfang fyrir svör, litur, vefur og stillingar
     sem gilda fyrir alla stofuna (VSK, gjalddagi, gervigreind)
     ------------------------------------------------------------------ */
  async function teiknaStofu() {
    const st = nuStofa() || {};
    const ks = (await g.kerfisstillingar().catch(() => null)) || {};
    const tengdar = (sidastaStada && sidastaStada.lyklar) || (g.tengingarStada ? await g.tengingarStada().catch(() => null) : null) || {};
    const segja = el('div', { class: 'form-status', role: 'status', hidden: true });
    const svara = (texti, tegund) => { segja.textContent = texti; segja.className = 'form-status form-status--' + tegund; segja.hidden = false; };

    const inNafn = el('input', { type: 'text', required: true, maxlength: '120', value: st.nafn || '' });
    const inNetfang = el('input', { type: 'email', value: st.netfang || '', placeholder: 'nafn@stofan.is', autocomplete: 'off' });
    const inVefur = el('input', { type: 'url', value: st.vefur || '', placeholder: 'https://', autocomplete: 'off' });
    const LITUR = '#5b93f0';
    let litur = st.litur || null;
    const inLitur = el('input', { type: 'color', value: litur || LITUR, 'aria-label': 'Litur stofunnar', style: 'width:56px; height:44px; padding:2px; border-radius:10px' });
    const liturTexti = el('span', { class: 'skyring', texti: litur ? litur : 'Sjálfgefinn litur Glerhússins' });
    inLitur.addEventListener('input', () => { litur = inLitur.value; liturTexti.textContent = litur; });
    const liturAftur = el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Sjálfgefinn litur',
      onclick: () => { litur = null; inLitur.value = LITUR; liturTexti.textContent = 'Sjálfgefinn litur Glerhússins'; } });

    /* Merkið: hlaðið upp strax, sér frá Vista */
    const merkiSyn = el('div', { class: 'merkikort__synd' });
    const merkiStada = el('p', { class: 'skyring', role: 'status' });
    const teiknaMerki = (url) => fylla(merkiSyn, [url
      ? el('img', { src: url, alt: 'Merki stofunnar', style: 'max-height:60px; max-width:220px; object-fit:contain', referrerpolicy: 'no-referrer' })
      : el('span', { class: 'skyring', texti: 'Ekkert merki. Nafnið birtist í staðinn.' })]);
    teiknaMerki(st.merki_url);
    const skraInn = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', style: 'display:none', onchange: async (e) => {
      const valin = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!valin) return;
      let skra;
      try { skra = await skeraMerki(valin); } catch (villa) { merkiStada.textContent = villa.message || 'Það tókst ekki að lesa myndina.'; return; }
      if (!skra) return;
      merkiStada.textContent = 'Hleð upp';
      try {
        const ny = await g.setjaStofuMerki(skra);
        uppfaeraStofu(ny); teiknaMerki(ny.merki_url); merkiStada.textContent = 'Merkið er komið.';
        synaHenda(true);
      } catch (villa) { merkiStada.textContent = villa.message || 'Merkið fór ekki upp.'; }
    } });
    const hendaHn = el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Fjarlægja merki', onclick: async () => {
      merkiStada.textContent = 'Fjarlægi';
      try { const ny = await g.hendaStofuMerki(); uppfaeraStofu(ny); teiknaMerki(null); merkiStada.textContent = ''; synaHenda(false); }
      catch (villa) { merkiStada.textContent = villa.message || 'Það tókst ekki.'; }
    } });
    /* .btn er display:flex og hunsar hidden, svo display er stillt beint */
    const synaHenda = (syna) => { hendaHn.hidden = !syna; hendaHn.style.display = syna ? '' : 'none'; };
    synaHenda(!!st.merki_url);

    /* Kerfisstillingar stofunnar */
    const valVsk = el('select', { 'aria-label': 'VSK hlutfall' }, [['24', '24%'], ['11', '11%'], ['0', '0%']]
      .map(([v, h]) => el('option', { value: v, texti: h, selected: String(ks.vsk_hlutfall || '24') === v })));
    const inGjalddagi = el('input', { type: 'text', inputmode: 'numeric', value: ks.gjalddagi_dagar || '14', style: 'max-width:120px' });
    const valGg = el('select', { 'aria-label': 'Gervigreind' }, [
      ks.gervigreind_veita ? null : el('option', { value: '', texti: 'Sú sem er tengd', selected: true }),
      el('option', { value: 'claude', texti: 'Claude', selected: ks.gervigreind_veita === 'claude' }),
      el('option', { value: 'chatgpt', texti: 'ChatGPT', selected: ks.gervigreind_veita === 'chatgpt' })
    ]);
    const inHamark = el('input', { type: 'text', inputmode: 'numeric', value: ks.gervigreind_hamark || '200', style: 'max-width:120px' });
    const verslunTengd = tengdar.shopify && /^ok/i.test(tengdar.shopify.prufa_svar || '');
    const inLager = el('input', { type: 'text', inputmode: 'numeric', value: ks.lager_vidvorun || '5', style: 'max-width:120px' });

    const vista = el('button', { type: 'submit', class: 'btn', texti: 'Vista' });
    const reitur = (heiti, inntak, skyring) => el('label', { class: 'field' }, [el('span', { texti: heiti }), inntak, skyring ? el('small', { class: 'skyring', texti: skyring }) : null]);
    const form = el('form', { class: 'form-grid', novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); segja.hidden = true;
      const tala = (inn, heiti) => {
        const v = String(inn.value || '').trim();
        if (!/^[0-9]{1,4}$/.test(v)) throw new Error(heiti + ' á að vera heil tala.');
        return v;
      };
      vista.disabled = true; vista.textContent = 'Vistar';
      try {
        const breytt = {
          nafn: inNafn.value, netfang: inNetfang.value, vefur: inVefur.value, litur
        };
        const nyKs = {
          vsk_hlutfall: valVsk.value,
          gjalddagi_dagar: tala(inGjalddagi, 'Gjalddagi'),
          gervigreind_hamark: tala(inHamark, 'Dagshámark gervigreindar')
        };
        if (valGg.value) nyKs.gervigreind_veita = valGg.value;
        if (verslunTengd) nyKs.lager_vidvorun = tala(inLager, 'Lítil birgð');
        const ny = await g.vistaStofu(breytt);
        for (const [k, v] of Object.entries(nyKs)) {
          if (String(ks[k] || '') !== v) { await g.vistaKerfisstillingu(k, v); ks[k] = v; }
        }
        uppfaeraStofu(ny);
        svara(g.prufa ? 'Sýnidæmi: vistað í þessum vafra.' : 'Vistað.', 'ok');
      } catch (villa) { svara(villa.message || 'Það tókst ekki að vista.', 'err'); }
      finally { vista.disabled = false; vista.textContent = 'Vista'; }
    } }, [
      reitur('Nafn stofunnar', inNafn),
      el('div', { class: 'field' }, [el('span', { texti: 'Merki' }), merkiSyn,
        el('div', { class: 'st-hnappar', style: 'margin-top:10px' }, [
          el('label', { class: 'btn btn--sm btn--ghost' }, [document.createTextNode('Hlaða upp merki'), skraInn]),
          hendaHn
        ]),
        el('small', { class: 'skyring', texti: 'PNG, JPG eða WEBP, mest 2 MB. Merki með gegnsæjum bakgrunni kemur best út.' }),
        merkiStada]),
      reitur('Netfang fyrir svör', inNetfang, 'Svör við pósti frá Glerhúsinu fara á þetta netfang.'),
      el('div', { class: 'field' }, [el('span', { texti: 'Litur' }),
        el('div', { style: 'display:flex; align-items:center; gap:12px; flex-wrap:wrap' }, [inLitur, liturTexti, liturAftur])]),
      reitur('Vefur', inVefur),
      el('div', { class: 'st-val__lina' }, [
        el('label', { class: 'st-val__reitur' }, [el('span', { texti: 'VSK hlutfall á reikningum' }), valVsk]),
        el('label', { class: 'st-val__reitur' }, [el('span', { texti: 'Gervigreind' }), valGg])
      ]),
      reitur('Gjalddagi (dagar)', inGjalddagi, 'Dagar frá reikningsdegi að gjalddaga á drögum fyrir verkefni.'),
      reitur('Dagshámark gervigreindar', inHamark, 'Hve oft á dag stofan má biðja gervigreindina um drög. Hvert kall er rukkað á lykilinn ykkar.'),
      verslunTengd ? reitur('Lítil birgð', inLager, 'Vara með þetta mörg stykki eða færri telst lítil birgð í Verslun.') : null,
      segja,
      el('div', { class: 'st-hnappar' }, [vista])
    ]);
    fylla(stofaSvid, [form]);
  }

  /* Ný stofa: hausinn og liturinn fylgja strax */
  function uppfaeraStofu(ny) {
    if (!ny) return;
    ek.stofa = ny;
    teiknaHaus(ek, 'Stillingar');
  }

  /* ------------------------------------------------------------------
     Aðgangar: stjórnendur, viðskiptavinir og boð sem bíða
     ------------------------------------------------------------------ */
  async function teiknaAdganga() {
    let notendur = [], bod = [];
    try { [notendur, bod] = await Promise.all([g.notendur(), g.bod ? g.bod().catch(() => []) : []]); }
    catch (villa) { fylla(adgangarSvid, [el('p', { class: 'tomt', texti: villa.message || 'Náði ekki í aðgangana.' })]); return; }
    const hlutverk = (n) => (n.hlutverk === 'admin' ? (n.er_eigandi ? 'Stjórnandi, eigandi' : 'Stjórnandi')
      : n.fyrirtaeki ? 'Viðskiptavinur hjá ' + n.fyrirtaeki.nafn : 'Viðskiptavinur, ekki tengdur fyrirtæki');
    const rodun = [...notendur].sort((a, b) => (a.hlutverk === 'admin' ? 0 : 1) - (b.hlutverk === 'admin' ? 0 : 1)
      || String(a.nafn || a.netfang).localeCompare(String(b.nafn || b.netfang), 'is'));
    fylla(adgangarSvid, [
      el('div', { class: 'ptafla-skrun' }, [el('table', { class: 'ptafla' }, [el('tbody', {}, rodun.map((n) => el('tr', {}, [
        el('td', {}, [
          el('div', { class: 'nafn', texti: (n.nafn || n.netfang) + (n.id === ek.id ? ' (þú)' : '') }),
          el('div', { style: 'font-size:13px; color:var(--soft)', texti: n.netfang || '' })
        ]),
        el('td', { style: 'color:var(--soft); text-align:right', texti: hlutverk(n) })
      ])))])]),
      bod.length ? el('h3', { style: 'margin-top:22px; font-family:var(--f-body); font-weight:500; font-size:15px', texti: 'Boð sem bíða' }) : null,
      bod.length ? el('div', { class: 'ptafla-skrun' }, [el('table', { class: 'ptafla' }, [el('tbody', {}, bod.map((b) => el('tr', {}, [
        el('td', {}, [
          el('div', { class: 'nafn', texti: b.nafn || b.netfang }),
          el('div', { style: 'font-size:13px; color:var(--soft)', texti: (b.nafn ? b.netfang + ', ' : '')
            + (b.hlutverk === 'admin' ? 'stjórnandi' : 'viðskiptavinur' + (b.fyrirtaeki ? ' hjá ' + b.fyrirtaeki.nafn : ''))
            + (b.runnid_ut ? ', útrunnið' : ', gildir til ' + dags(b.utrunnid, true)) })
        ]),
        el('td', { style: 'text-align:right; white-space:nowrap' }, [
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Eyða boði', onclick: async (e) => {
            if (!confirm('Eyða boðinu til ' + b.netfang + '? Hlekkurinn í póstinum hættir þá að virka.')) return;
            e.currentTarget.disabled = true;
            try { await g.eydaBodi(b.id); teiknaAdganga(); } catch (villa) { tilkynna(villa.message || 'Það tókst ekki.'); e.currentTarget.disabled = false; }
          } })
        ])
      ])))])]) : null,
      el('div', { class: 'st-hnappar' }, [
        el('button', { type: 'button', class: 'btn', texti: 'Bjóða notanda', onclick: () => opnaBodGlugga({ eftir: () => teiknaAdganga() }) })
      ])
    ]);
  }

  /* ------------------------------------------------------------------
     Verk-netfangið: slóðin, hvenær póstur barst síðast og staðfestingar
     sem Gmail sendir þegar áframsending er sett upp
     ------------------------------------------------------------------ */
  async function teiknaVerk() {
    const st = nuStofa() || {};
    const adal = st.verk || (g.prufa ? 'synidaemi@verk.tveir.is' : null);
    if (!adal) { fylla(verkSvid, [el('p', { class: 'tomt', texti: 'Verk-netfangið er ekki komið upp ennþá.' })]); return; }
    const log = (await (g.verkpostStada ? g.verkpostStada().catch(() => []) : [])) || [];
    const onnur = (st.verk_netfong || []).filter((n) => n !== adal);
    const afritaHn = el('button', { type: 'button', class: 'btn btn--sm', texti: 'Afrita', onclick: (e) => afrita(adal, e.currentTarget) });
    const tveimurVikum = Date.now() - 14 * 864e5;
    const stadfestingar = log.filter((r) => r.stadfesting_slod && /^https:\/\/mail(-settings)?\.google\.com\//.test(r.stadfesting_slod)
      && new Date(r.dags).getTime() > tveimurVikum).slice(0, 3);
    const sidast = log.find((r) => r.nidurstada !== 'stadfesting');
    fylla(verkSvid, [
      el('div', { style: 'display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:14px 16px; background:var(--bg); border-radius:var(--r-input)' }, [
        el('strong', { texti: adal, style: 'font-size:16px; word-break:break-all', 'data-ekki-thyda': '' }), afritaHn
      ]),
      onnur.length ? el('p', { class: 'skyring', style: 'margin-top:8px', texti: 'Virkar líka: ' + onnur.join(', ') }) : null,
      el('p', { style: 'margin-top:14px', texti: 'Viðskiptavinir senda eða setja í CC frá netfanginu sem er skráð á þá. Ein lína í póstinum verður að einu verki. Svar í sama þræði verður að athugasemd.' }),
      el('p', { class: 'skyring', style: 'margin-top:8px', texti: harPostholf()
        ? 'Póstur frá netfangi sem er ekki skráð verður ekki að verki.'
        : 'Póstur frá netfangi sem er ekki skráð birtist í Samskiptum undir Verkpóstur. Þaðan má búa til verk eða bjóða sendandanum.' }),
      sidast ? el('p', { class: 'skyring', style: 'margin-top:8px', texti: 'Síðasti póstur barst ' + hvenaer(sidast.dags) + '.' })
        : erTveir() ? null : el('p', { class: 'skyring', style: 'margin-top:8px', texti: g.prufa ? 'Sýnidæmi: enginn póstur berst hingað.' : 'Enginn póstur hefur borist ennþá.' }),
      ...stadfestingar.map((r) => el('div', { class: 'tilkynning', style: 'margin-top:12px' }, [
        el('div', { class: 'tilkynning__inn' }, [
          el('strong', { texti: 'Gmail bíður staðfestingar' }),
          el('span', { class: 'undir', texti: 'Áframsending var sett upp ' + hvenaer(r.dags) + '. Opnaðu hlekkinn til að staðfesta hana.' })
        ]),
        el('a', { class: 'btn btn--sm', href: r.stadfesting_slod, target: '_blank', rel: 'noopener noreferrer', texti: 'Staðfesta' })
      ])),
      el('a', { class: 'st-t__lb', style: 'display:inline-block; margin-top:14px', href: LEIDBEININGAR + '#gmail', target: '_blank', rel: 'noopener', texti: 'Nánari leiðbeiningar' })
    ]);
    return log;
  }

  /* Staðan sótt úr gögnunum sjálfum, ekki skrifuð inn: breytist þegar tenging kemst á */
  async function stadaTenginga() {
    const s = {};
    /* Gmail: pósthólfið hefur verið samstillt */
    try {
      const thraedir = (g.postholf && harPostholf() ? await g.postholf() : []) || [];
      const nyjast = thraedir.reduce((a, t) => (!a || t.sidast > a ? t.sidast : a), null);
      s.gmail = thraedir.length ? ['tengt', thraedir.length + ' þræðir, nýjasti ' + hvenaer(nyjast)] : ['bidur', 'Engir þræðir hafa komið inn ennþá'];
    } catch (e) { s.gmail = ['ekki', 'Pósthólfið er ekki komið upp']; }

    /* Google Calendar: fundir hafa komið inn. dagatal() sækir líka 45 daga aftur,
       svo fjöldinn í textanum telur bara fundi sem eru framundan. */
    try {
      const atb = (g.dagatal ? await g.dagatal() : null);
      const nuna = Date.now();
      const framundan = atb ? atb.filter((a) => new Date(a.byrjar).getTime() >= nuna).length : 0;
      s.dagatal = atb === null ? ['ekki', 'Dagatalið er ekki komið upp']
        : atb.length ? ['tengt', framundan ? framundan + (framundan === 1 ? ' fundur framundan' : ' fundir framundan') : 'Fundir hafa komið inn, enginn framundan']
        : ['bidur', 'Bíður eftir fyrstu samstillingu'];
    } catch (e) { s.dagatal = ['ekki', 'Dagatalið er ekki komið upp']; }

    /* Meta: Instagram og Facebook hvort fyrir sig. Hver miðill með auðkenni telst
       tengdur ef sjálfvirkar tölur hafa komið síðustu 3 daga. */
    try {
      const fyrirtaeki = (await g.fyrirtaeki()) || [];
      const nu = new Date(), fra = new Date(nu.getTime() - 3 * 864e5);
      const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const fj = { instagram: [0, 0], facebook: [0, 0] };
      let tiktok = 0;
      for (const f of fyrirtaeki) {
        const midlar = (await g.midlar(f.id).catch(() => [])) || [];
        const meta = midlar.filter((m) => fj[m.midill] && m.ytra_id && m.virkt !== false);
        tiktok += midlar.filter((m) => m.midill === 'tiktok').length;
        if (!meta.length) continue;
        const ma = (await g.maelingar(f.id, ymd(fra), ymd(nu)).catch(() => [])) || [];
        for (const m of meta) {
          fj[m.midill][0]++;
          if (ma.some((r) => r.uppruni === 'sjalfvirkt' && r.midill_id === m.id)) fj[m.midill][1]++;
        }
      }
      const metaStada = ([n, sj], o) => sj && sj === n ? ['tengt', 'Tölurnar koma sjálfkrafa á hverjum morgni']
        : sj ? ['bidur', sj + ' af ' + n + ' ' + o.thgf + (sj === 1 ? ' fær' : ' fá') + ' tölurnar sjálfkrafa. ' + (n - sj === 1 ? o.hin1 : o.hin) + '.']
        : n ? ['bidur', n + (n === 1 ? ' ' + o.et + ' hefur' : ' ' + o.ft + ' hafa') + ' auðkenni, en engar sjálfvirkar tölur ennþá']
        : ['ekki', o.enginn];
      s.instagram = metaStada(fj.instagram, { et: 'reikningur', ft: 'reikningar', thgf: 'reikningum', hin: 'Hinir bíða', hin1: 'Hinn bíður', enginn: 'Enginn Instagram reikningur með auðkenni' });
      s.facebook = metaStada(fj.facebook, { et: 'síða', ft: 'síður', thgf: 'síðum', hin: 'Hinar bíða', hin1: 'Hin bíður', enginn: 'Engin Facebook síða með auðkenni' });
      s.tiktok = ['handvirkt', tiktok ? tiktok + (tiktok === 1 ? ' TikTok reikningur, tölurnar skráðar í höndunum' : ' TikTok reikningar, tölurnar skráðar í höndunum') : 'Tölurnar eru skráðar í höndunum'];
    } catch (e) {
      s.instagram = s.facebook = ['ekki', 'Náði ekki í miðlana'];
      s.tiktok = ['handvirkt', 'Tölurnar eru skráðar í höndunum'];
    }
    /* API lyklarnir og OAuth tengingarnar: null ef taflan er ekki komin */
    try { s.lyklar = g.tengingarStada ? await g.tengingarStada() : null; } catch (e) { s.lyklar = null; }
    /* Hvort Google, Meta og TikTok hafa samþykkt Glerhúsið */
    try { s.ms = (g.minStada ? await g.minStada() : null) || ek.min_stada || null; } catch (e) { s.ms = ek.min_stada || null; }
    /* Verk-netfangið: hvenær póstur barst síðast */
    try { s.verk = g.verkpostStada ? await g.verkpostStada() : []; } catch (e) { s.verk = []; }
    return s;
  }

  /* Tengingarnar sóttar aftur og teiknaðar. Skilar { veita: lína } fyrir lykilForm. */
  async function endurnyja() {
    const s = await stadaTenginga();
    teiknaTengingar(s);
    return s.lyklar || {};
  }

  function teiknaTengingar(s) {
    sidastaStada = s;
    /* Verslun í hausnum fylgir Shopify prófuninni */
    if (s.lyklar && !SYNID) {
      const fyrir = (tengdarGeymdar() || []).includes('shopify');
      if (geymaTengdar(s.lyklar).includes('shopify') !== fyrir) teiknaHaus(ek, 'Stillingar');
    }
    const st = nuStofa() || {};
    /* Gömlu gildin hans Tveir bara hjá Tveir (eða áður en stofur eru komnar),
       aldrei hjá annarri stofu sem hefur ekki sett sitt netfang */
    const tveirGildi = erTveir() || !st.id;
    const POSTUR = g.prufa ? 'pósthólfi stofunnar' : st.netfang || (tveirGildi ? 'tveir@tveir.is' : 'pósthólfi stofunnar');
    const VERK = g.prufa ? 'verk-netfang stofunnar' : st.verk || (tveirGildi ? 'verk@tveir.is' : 'verk-netfang stofunnar');
    const DEILA = g.prufa ? 'netfangi stofunnar' : st.netfang || (tveirGildi ? 'tveir@tveir.is' : 'netfangi stofunnar');
    const STOFA_NAFN = g.prufa ? stofuNafn() : st.nafn || (tveirGildi ? 'Tveir' : '');
    /* Án nafns: rétt fall af orðinu stofa í hverri setningu */
    const STOFA_THF = STOFA_NAFN || 'stofuna', STOFA_NF = STOFA_NAFN || 'Stofan', STOFA_EF = STOFA_NAFN || 'stofunnar';
    /* Google, Meta og TikTok: hjá öðrum stofum en Tveir fer tengingin um OAuth,
       sem bíður samþykkis veitunnar. Tveir og sýnidæmið halda sínu. */
    const OAUTH = !g.prufa && !tveirGildi;
    /* Sama orðalag og á vefnum: Í smíðum */
    const PILLUR = { tengt: 'Tengt', bidur: 'Bíður', ekki: 'Ekki tengt', handvirkt: 'Handvirkt', kemur: 'Í smíðum' };
    const SMIDI_TVEIR = 'Í smíðum. Þegar þetta er tilbúið setur Tveir tenginguna upp með þér.';
    const KEMUR = ['kemur', ''];
    const EKKI = ['ekki', ''];
    /* Tengingar með lykli. Í sýnidæminu úr Settu saman er enginn lykill sleginn inn. */
    const lykilSpjald = (t) => (SYNID
      ? { ...t, veita: null, lykill: t.veita, stada: ertengt(t.veita) ? ['tengt', 'Sýnidæmi'] : EKKI,
          tharf: 'Í alvöru Glerhúsi er lykill frá ' + t.heiti + ' límdur inn hér og tengingin prófuð strax. ' + t.nuna }
      : { ...t, stada: lykilStada(s.lyklar ? s.lyklar[t.veita] : null, t) });
    /* OAuth spjald: bíður samþykkis, eða Tengja með einum smelli þegar það er komið */
    const NOFN = { google: 'Google', meta: 'Meta', tiktok: 'TikTok' };
    const oauthSpjald = (t, veita) => {
      if (!OAUTH) return t;
      const tilbuid = !!(s.ms && s.ms[veita + '_tilbuid']);
      const r = s.lyklar ? s.lyklar[veita] : null;
      const nafn = NOFN[veita];
      if (!tilbuid) {
        return { ...t, oauth: veita, bidurSamthykkis: true, utan: true, smidum: false, pilla: 'Bíður samþykkis ' + nafn,
          stada: ['bidur', 'Kemur þegar ' + nafn + ' hefur samþykkt Glerhúsið.'],
          dTexti: 'Þessi tenging bíður samþykkis hjá ' + nafn + '. Hún opnast hér um leið og það kemur.',
          tharf: veita === 'tiktok' ? 'Þangað til eru tölurnar skráðar í höndunum á Tölfræði eða fluttar inn úr CSV.'
            : 'Þegar ' + nafn + ' hefur samþykkt Glerhúsið tengirðu aðganginn hér með einum smelli. Ekkert lykilorð fer hingað.' };
      }
      const netfang = r && r.stillingar && r.stillingar.netfang;
      return { ...t, oauth: veita, utan: false, smidum: false, pilla: undefined,
        stada: r ? ['tengt', 'Tengt' + (netfang ? ' sem ' + netfang : '')] : EKKI,
        tharf: 'Smelltu á Tengja, skráðu þig inn hjá ' + nafn + ' og samþykktu aðganginn. Ekkert lykilorð fer hingað.' };
    };
    const verkLog = s.verk || [];
    const verkSidast = verkLog.find((r) => r.nidurstada !== 'stadfesting');
    /* merki: skrá í assets/tengingar. litur: bakgrunnur flísarinnar. ljos: merkið er í lit á hvítu, annars hvítt á lit.
       utan: telst ekki með í "X af Y tengt". pilla: '' þýðir engin pilla. */
    const HOPAR = [
      ['Póstur og dagatal', [
        harPostholf() ? { heiti: 'Gmail', lb: 'gmail', merki: 'gmail.svg', litur: '#EA4335', hvad: 'Pósthólfið á Samskiptum og póstar úr kerfinu', stada: s.gmail, slod: 'samskipti.html',
          tharf: SYNID ? EINFALT + ' Pósturinn uppfærist á 5 mínútna fresti.' : 'Pósturinn er sóttur með Apps Script skrift á ' + POSTUR + ', á 5 mínútna fresti.' } : null,
        { heiti: 'Verk-netfangið', lb: 'gmail', stafur: '@', litur: '#1c3050', hvad: 'Póstur á ' + VERK + ' verður að verkum', utan: true, pilla: '',
          stada: ['handvirkt', g.prufa ? 'Sýnidæmi' : verkSidast ? 'Síðasti póstur barst ' + hvenaer(verkSidast.dags) : 'Póstur frá skráðum notanda verður að verki innan 5 mínútna'],
          dTexti: 'Hér þarf enga tengingu. Verk sem koma með pósti birtast á Stjórnborðinu.',
          tharf: 'Viðskiptavinur sendir póst á ' + VERK + ', eða setur ' + VERK + ' í CC, frá netfanginu sem er skráð á notanda hjá fyrirtækinu. Verkið birtist á Stjórnborðinu innan 5 mínútna. Póstur frá öðru netfangi verður ekki að verki.' },
        oauthSpjald({ heiti: 'Google Calendar', lb: 'googlecalendar', merki: 'googlecalendar.svg', litur: '#4285F4', hvad: 'Fundirnir þínir á Dagatalinu, við hlið skiladaga', stada: s.dagatal, slod: 'dagatal.html',
          tharf: SYNID ? EINFALT + ' Dagatalið uppfærist á 5 mínútna fresti.'
            : 'Deildu dagatalinu þínu með ' + DEILA + '. Í Google Calendar í tölvu: Settings and sharing við dagatalið, Shared with vinstra megin og svo Add people and groups. Bættu ' + DEILA + ' við, veldu See event details (sums staðar See all event details) og smelltu á Send. '
              + 'Láttu ' + STOFA_THF + ' vita. ' + STOFA_NF + ' samþykkir deilinguna og eftir það koma fundirnir inn á 5 mínútna fresti. Á vinnuaðgangi gæti Google stjórnandinn þurft að leyfa deilingu út fyrir fyrirtækið fyrst.' }, 'google')
      ].filter(Boolean)],
      ['Samfélagsmiðlar', [
        oauthSpjald({ heiti: 'Instagram', lb: 'instagram', merki: 'instagram.svg', litur: '#E4405F', hvad: 'Fylgjendur, áhorf og færslur á Tölfræði', stada: s.instagram, slod: 'tolfraedi.html',
          tharf: SYNID ? EINFALT + ' Þú gefur okkur aðgang að efni og tölfræði Instagram reikningsins.'
            : 'Þarf Meta app og System User token (META_TOKEN) í Apps Script, og auðkenni reikningsins á Tölfræði. Reikningnum er deilt með Business ID ' + STOFA_EF + ' sem samstarfsaðila (Partners), með aðgangi að bæði efni (Content) og tölfræði (Insights).' }, 'meta'),
        oauthSpjald({ heiti: 'Facebook', lb: 'facebook', merki: 'facebook.svg', litur: '#0866FF', hvad: 'Áhorf og fylgjendur síðunnar á Tölfræði', stada: s.facebook, slod: 'tolfraedi.html',
          tharf: SYNID ? EINFALT + ' Þú gefur okkur aðgang að efni og tölfræði Facebook síðunnar.'
            : 'Sama Meta app og Instagram. Page ID síðunnar fer á Tölfræði. Síðunni er deilt með Business ID ' + STOFA_EF + ' sem samstarfsaðila (Partners), með aðgangi að bæði efni (Content) og tölfræði (Insights). Tölfræðin ein dugar ekki.' }, 'meta'),
        oauthSpjald({ heiti: 'TikTok', lb: 'tiktok', merki: 'tiktok.svg', litur: '#000000', hvad: 'Tölur á Tölfræði', stada: s.tiktok, slod: 'tolfraedi.html#tiktok', utan: true,
          tharf: SYNID ? 'Sjálfvirk söfnun frá TikTok er ekki komin í Glerhúsið ennþá. Tölurnar eru skráðar í höndunum.' : 'Sjálfvirk söfnun frá TikTok er ekki komin í Glerhúsið ennþá. Tölurnar eru skráðar í höndunum á Tölfræði eða fluttar inn úr CSV.' }, 'tiktok'),
        { heiti: 'Messenger', merki: 'messenger.svg', litur: '#00B2FF', hvad: 'Skilaboð inn í Samskipti', stada: KEMUR, smidum: true,
          tharf: SYNID ? 'Í smíðum. Skilaboðin koma ekki inn í Samskipti ennþá. ' + EINFALT : 'Í smíðum. Skilaboðin koma ekki inn í Samskipti ennþá. Þetta þarf Meta appið og leyfi Meta fyrir skilaboðum (App Review).' },
        { heiti: 'Instagram skilaboð', merki: 'instagram.svg', litur: '#C13584', hvad: 'DM inn í Samskipti', stada: KEMUR, smidum: true,
          tharf: SYNID ? 'Í smíðum. Skilaboðin koma ekki inn í Samskipti ennþá. ' + EINFALT : 'Í smíðum. Þetta þarf sama Meta app og leyfi og Messenger.' }
      ]],
      ['Bókhald', [lykilSpjald(LYKLAR.payday), lykilSpjald(LYKLAR.dk)]],
      ['Verslun', [lykilSpjald(LYKLAR.shopify)]],
      ['Gervigreind', [lykilSpjald(LYKLAR.claude), lykilSpjald(LYKLAR.chatgpt)]],
      ['Vefur og skrár', [
        { heiti: 'WeTransfer', lb: 'wetransfer', merki: 'wetransfer.svg', litur: '#409FFF', hvad: 'Hlekkir á undirverkum', utan: true, pilla: 'Engin uppsetning',
          stada: ['handvirkt', 'Hlekkir virka beint á undirverkum'], dTexti: 'Hér þarf enga tengingu.',
          tharf: 'Engin tenging þarf: límdu WeTransfer hlekkinn á undirverkið og viðskiptavinurinn fær hann í pósti.' }
      ]]
    ];

    /* Ný stofa sér bara það sem virkar fyrir hana núna: verk-netfangið, Payday,
       Claude og WeTransfer. Hitt bætist við þegar það er tilbúið eða tengt. */
    if (erNyStofa()) {
      const SYNA = ['Verk-netfangið', 'Gmail', 'Payday', 'Claude', 'WeTransfer'];
      for (const h of HOPAR) h[1] = h[1].filter((t) => t && (SYNA.includes(t.heiti) || (t.stada || [])[0] === 'tengt'));
      for (let i = HOPAR.length - 1; i >= 0; i--) if (!HOPAR[i][1].length) HOPAR.splice(i, 1);
    }
    /* Bara tengingar sem geta verið tengdar núna teljast með. Í smíðum, handvirkt og
       engin uppsetning standa utan við. */
    const oll = HOPAR.flatMap(([, l]) => l);
    const telst = oll.filter((t) => !t.smidum && !t.utan);
    const tengd = telst.filter((t) => (t.stada || [])[0] === 'tengt').length;
    const smidi = oll.filter((t) => t.smidum).length;
    const bida = oll.filter((t) => t.bidurSamthykkis).length;
    fylla(tengingarSvid, [
      el('p', { class: 'st-teng-yfirlit', texti: tengd + ' af ' + telst.length + ' tengt' + (smidi ? ', ' + smidi + ' í smíðum' : '') + (bida ? ', ' + bida + ' bíða samþykkis' : '') }),
      ...HOPAR.map(([heiti, listi]) => el('div', { class: 'st-teng-hopur' }, [
        el('h3', { texti: heiti }),
        el('div', { class: 'st-tengingar' }, listi.map((t) => {
          const [stada, undir] = t.stada || EKKI;
          const pilla = t.pilla === '' ? null : t.pilla || PILLUR[stada];
          /* Tengja bara þar sem eitthvað er hægt að tengja núna, annars Nánar */
          const tengja = !t.smidum && !t.utan && (stada === 'ekki' || stada === 'bidur');
          const hnappar = t.bidurSamthykkis
            ? [el('button', { type: 'button', class: 'btn btn--sm', disabled: true, texti: 'Tengja', title: 'Bíður samþykkis' }),
               el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Nánar', onclick: () => opnaTengingu(t, stada) })]
            : t.oauth && stada === 'ekki'
              ? [el('button', { type: 'button', class: 'btn btn--sm', texti: 'Tengja', onclick: (e) => byrjaOauth(t.oauth, e.currentTarget) })]
            : t.oauth && stada === 'tengt'
              /* Tengt með OAuth: Opna, og Nánar með Aftengja */
              ? [t.slod ? el('a', { class: 'btn btn--sm btn--ghost', href: t.slod, texti: 'Opna' }) : null,
                 el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Nánar', onclick: () => opnaTengingu(t, stada) })]
              : t.veita
                ? [stada === 'tengt' && t.slod ? el('a', { class: 'btn btn--sm btn--ghost', href: t.slod, texti: 'Opna' }) : null,
                   el('button', { type: 'button', class: 'btn btn--sm' + (stada === 'tengt' ? ' btn--ghost' : ''), texti: s.lyklar && s.lyklar[t.veita] ? 'Breyta' : 'Tengja',
                     onclick: () => opnaTengingu(t, stada) })]
                : [stada === 'tengt' && t.slod
                    ? el('a', { class: 'btn btn--sm btn--ghost', href: t.slod, texti: 'Opna' })
                    : el('button', { type: 'button', class: 'btn btn--sm' + (tengja ? '' : ' btn--ghost'), texti: tengja ? 'Tengja' : 'Nánar',
                        onclick: () => opnaTengingu(t, stada) })];
          return el('article', { class: 'st-teng st-teng--' + stada }, [
            el('div', { class: 'st-teng__efst' }, [
              tengingarTakn(t),
              el('div', { class: 'st-teng__nafn' }, [el('strong', { texti: t.heiti }), el('span', { texti: t.hvad })]),
              pilla ? el('span', { class: 'st-pilla st-pilla--' + stada, texti: pilla }) : null
            ]),
            undir ? el('p', { class: 'st-teng__stada', texti: undir }) : null,
            el('div', { class: 'st-teng__fot' }, hnappar)
          ]);
        }))
      ]))
    ]);
  }

  /* OAuth: Edge Function oauth skilar slóð hjá veitunni og vafrinn fer þangað */
  async function byrjaOauth(veita, hnappur) {
    hnappur.disabled = true; hnappur.textContent = 'Augnablik';
    try {
      const svar = await g.oauthByrja(veita);
      location.href = svar.slod;
    } catch (villa) {
      tilkynna(villa.message || 'Tengingin opnaðist ekki. Prófaðu aftur.');
      hnappur.disabled = false; hnappur.textContent = 'Tengja';
    }
  }

  /* Tengja: hvað tengingin gerir, staðan og hvað þarf til */
  function opnaTengingu(t, stada) {
    const kort = el('div', { class: 'pdialog__kort' });
    const d = el('dialog', { class: 'pdialog', 'aria-labelledby': 'st-t-h' }, [kort]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    const TEXTI = {
      tengt: 'Þetta er tengt og virkar.',
      bidur: 'Tengingin er hálfnuð og bíður eftir einu skrefi.',
      handvirkt: 'Hér eru tölurnar skráðar í höndunum.',
      ekki: 'Þetta er ekki tengt ennþá.',
      kemur: 'Þessi tenging er á listanum og kemur seinna.'
    };
    const r = t.veita && sidastaStada && sidastaStada.lyklar ? sidastaStada.lyklar[t.veita] : null;
    fylla(kort, [
      el('div', { class: 'pdialog__haus' }, [
        el('div', { class: 'st-t__haus' }, [tengingarTakn(t), el('h2', { id: 'st-t-h', texti: t.heiti })]),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
      ]),
      el('p', { class: 'st-t__hvad', texti: t.hvad + '.' }),
      el('p', { class: 'st-t__stada st-t__stada--' + stada, texti: t.dTexti || (t.smidum
        ? 'Þetta er í smíðum og ekki tilbúið ennþá.'
        : t.veita && stada === 'tengt' ? TEXTI.tengt + ' ' + (t.nuna || '')
        : TEXTI[stada] || '') }),
      t.veita ? lykilForm(t, { g, r, eftir: endurnyja, d }) : el('div', { class: 'st-t__tharf' }, [el('strong', { texti: 'Hvað þarf til' }), el('p', { texti: t.tharf }),
        t.lb ? el('a', { class: 'st-t__lb', href: LEIDBEININGAR + '#' + t.lb, target: '_blank', rel: 'noopener', texti: 'Nánari leiðbeiningar' }) : null]),
      t.veita ? null : el('div', { class: 'spjald__fot' }, [
        t.slod && !t.bidurSamthykkis ? el('a', { class: 'btn', href: t.slod, texti: 'Opna' }) : null,
        t.oauth && stada === 'tengt' ? el('button', { type: 'button', class: 'btn btn--ghost btn--danger', texti: 'Aftengja', onclick: async () => {
          if (!confirm('Aftengja ' + t.heiti + '? Glerhúsið hættir þá að sækja gögnin.')) return;
          try { await g.eydaTengingu(t.oauth); d.close(); await endurnyja(); }
          catch (er) { tilkynna(er.message || 'Ekki tókst að aftengja.'); }
        } }) : null,
        el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Loka', onclick: () => d.close() })
      ])
    ]);
    document.body.append(d);
    d.showModal();
  }
}
