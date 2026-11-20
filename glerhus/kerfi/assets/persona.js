/* ==========================================================================
   Glerhúsið fyrir íþróttafólk og áhrifavalda (sýnidæmi)

   Fjórar síður: Yfirlit (mitt.html), Samstarfsaðilar (samstarfsadilar.html),
   Efnisplan (efnisplan.html) og Beiðnir til stofunnar (beidnir.html).
   Síðan er lesin úr slóðinni, svo sama eining dugar fyrir allar fjórar og
   síðuskiptin (skipti.js) virka eins og annars staðar.

   Gögnin eru sýnidæmi sem búa í vafranum. Það sem gesturinn gerir (hakar
   í skil, færir fyrirspurn, sendir beiðni) geymist í localStorage svo
   kerfið hagi sér eins og alvöru kerfi. Dagsetningar eru reiknaðar út frá
   deginum í dag, svo sýnidæmið er alltaf ferskt.

   Einfalt fyrst: Yfirlit sýnir bara það sem gesturinn valdi í Settu saman
   (sersnid.einingar, lesið með ervalid). Restin bíður undir "Fleiri
   möguleikar" neðst á Yfirliti. Engin síða tengir á síðu sem er ekki í
   valmyndinni.
   ========================================================================== */

import { el, fylla, vardaHlid, teiknaHaus, tilkynna, sersnid, erPersona, ervalid } from './portal.js';


/* ---------------- Hjálp ---------------- */
const LYKILL = 'glerhus-tveir-personan-v1';
const IDAG = new Date(); IDAG.setHours(12, 0, 0, 0);
const dagar = (n) => { const d = new Date(IDAG); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const MAN = ['jan.', 'feb.', 'mars', 'apr.', 'maí', 'jún.', 'júl.', 'ágú.', 'sep.', 'okt.', 'nóv.', 'des.'];
const VIKUDAGAR = ['sun.', 'mán.', 'þri.', 'mið.', 'fim.', 'fös.', 'lau.'];
const dg = (s) => { const d = new Date(s + 'T12:00:00'); return d.getDate() + '. ' + MAN[d.getMonth()]; };
const dgLangt = (s) => { const d = new Date(s + 'T12:00:00'); return VIKUDAGAR[d.getDay()] + ' ' + d.getDate() + '. ' + MAN[d.getMonth()]; };
const manAr = (s) => { const d = new Date(s + 'T12:00:00'); return MAN[d.getMonth()] + ' ' + d.getFullYear(); };
const eftir = (s) => Math.round((new Date(s + 'T12:00:00') - IDAG) / 864e5);
const kr = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' kr.';
const ATH = !!sersnid && sersnid.grein === 'ithrottir';
/* Stofan: HEFUR_STOFU ef Tveir eða önnur stofa. STOFA er nafnið, ef það er
   til (Tveir eða nafnið sem var slegið inn), annars null. */
const HEFUR_STOFU = !!sersnid && ['tveir', 'onnur'].includes(sersnid.stofa);
const STOFA = !HEFUR_STOFU ? null
  : (sersnid.stofa === 'tveir' ? 'Tveir' : (String(sersnid.stofaNafn || '').trim() || null));
const STOFAN = STOFA || 'Stofan þín';                       /* nefnifall */
const TIL_STOFU = STOFA === 'Tveir' ? 'Tveir' : STOFA ? 'stofunnar' : 'stofunnar þinnar'; /* eignarfall */
const NAFN = (sersnid && String(sersnid.nafn || '').trim()) || 'Glerhúsið mitt';
/* Íþróttafólk á styrktaraðila, áhrifavaldar samstarfsaðila */
const ORD = ATH
  ? { ak: 'Styrktaraðilinn', ft: 'styrktaraðila', enginn: 'Enginn styrktaraðili' }
  : { ak: 'Samstarfsaðilinn', ft: 'samstarfsaðila', enginn: 'Enginn samstarfsaðili' };
/* Það sem gesturinn valdi. Síðurnar þrjár eru bara í valmyndinni ef þær voru valdar. */
const VALID = {
  samstarf: ervalid('samstarf'),
  efnisplan: ervalid('efnisplan'),
  dagskra: ervalid('dagskra'),
  tekjur: ervalid('tekjur'),
  tolfraedi: ervalid('tolfraedi'),
  beidnir: HEFUR_STOFU && ervalid('stofan')
};
const SMIDI = 'Sýnidæmi með tilbúnum gögnum. Þessi hluti er í smíðum og kemur í alvöru aðganginn fljótlega.';
const smidi = () => el('p', { class: 'ps-smidi', role: 'note', texti: SMIDI });

/* ---------------- Sýnigögnin ---------------- */
function nyGogn() {
  const samningar = ATH ? [
    { id: 's1', nafn: 'Sprettur sportvörur', stafur: 'S', litur: '#2f8f6f', grunnur: 'ar', upphaed: 1200000, ar: 1200000, fra: dagar(-320), til: dagar(41), tengilidur: 'Anna hjá Spretti',
      skil: [{ id: 'a', t: 'Færslur á Instagram', af: 4, buid: 3, tima: 'í mánuðinum' }, { id: 'b', t: 'Merkið á keppnisfötunum', af: 1, buid: 1, tima: 'á árinu' }, { id: 'c', t: 'Viðburðir í versluninni', af: 2, buid: 1, tima: 'á árinu' }] },
    { id: 's2', nafn: 'Kraftur orkudrykkur', stafur: 'K', litur: '#c8643b', grunnur: 'ar', upphaed: 600000, ar: 600000, fra: dagar(-260), til: dagar(105), tengilidur: 'Gunnar hjá Krafti',
      skil: [{ id: 'a', t: 'Reels', af: 2, buid: 1, tima: 'í mánuðinum' }, { id: 'b', t: 'Sögur', af: 4, buid: 4, tima: 'í mánuðinum' }] },
    { id: 's3', nafn: 'Bílasalan Hraði', stafur: 'B', litur: '#5662b4', grunnur: 'ar', upphaed: 360000, ar: 360000, fra: dagar(-350), til: dagar(15), tengilidur: 'Sigrún hjá Hraða',
      skil: [{ id: 'a', t: 'Færsla með bílnum', af: 1, buid: 1, tima: 'í mánuðinum' }, { id: 'b', t: 'Myndataka', af: 1, buid: 0, tima: 'á árinu' }] }
  ] : [
    { id: 's1', nafn: 'Snyrtivörur Glói', stafur: 'G', litur: '#c8643b', grunnur: 'ar', upphaed: 900000, ar: 900000, fra: dagar(-200), til: dagar(165), tengilidur: 'Lilja hjá Glóa',
      skil: [{ id: 'a', t: 'Reels', af: 3, buid: 2, tima: 'í mánuðinum' }, { id: 'b', t: 'Sögur með hlekk', af: 6, buid: 4, tima: 'í mánuðinum' }] },
    { id: 's2', nafn: 'Kaffihúsið Hornið', stafur: 'H', litur: '#8a5a3c', grunnur: 'herferd', upphaed: 300000, ar: 300000, fra: dagar(-40), til: dagar(20), tengilidur: 'Óli hjá Horninu',
      skil: [{ id: 'a', t: 'Jólaherferð, færslur', af: 3, buid: 1, tima: 'í herferðinni' }, { id: 'b', t: 'Gjafaleikur', af: 1, buid: 0, tima: 'í herferðinni' }] },
    { id: 's3', nafn: 'Sprettur sportvörur', stafur: 'S', litur: '#2f8f6f', grunnur: 'ar', upphaed: 480000, ar: 480000, fra: dagar(-300), til: dagar(65), tengilidur: 'Anna hjá Spretti',
      skil: [{ id: 'a', t: 'Færslur á TikTok', af: 2, buid: 2, tima: 'í mánuðinum' }] }
  ];
  const fyrirspurnir = [
    { id: 'f1', fra: 'Hótel Fjörður', efni: 'Helgarferð og þrjár færslur í janúar', dags: dagar(-1), stada: 'ny' },
    { id: 'f2', fra: ATH ? 'Íþróttafélagið Vaskur' : 'Fataverslunin Lín', efni: ATH ? 'Fyrirlestur fyrir yngri flokkana' : 'Vorlína, tvö reels', dags: dagar(-2), stada: 'ny' },
    { id: 'f3', fra: 'Gleraugnaverslunin Sjón', efni: 'Samningur til eins árs', dags: dagar(-6), stada: 'vidraedur' },
    { id: 'f4', fra: 'Tryggingafélagið Skjól', efni: 'Auglýsing í sjónvarpi', dags: dagar(-12), stada: 'samningur' },
    { id: 'f5', fra: 'Bakaríið Kornið', efni: 'Ein færsla í desember', dags: dagar(-15), stada: 'hafnad' }
  ];
  const dagskra = ATH ? [
    { d: dagar(3), t: 'Æfingabúðir í Kaupmannahöfn', teg: 'Æfingar' },
    { d: dagar(9), t: 'Mót í Reykjavík', teg: 'Keppni' },
    { d: dagar(16), t: 'Kynning í verslun Spretts', teg: 'Styrktaraðili' },
    { d: dagar(45), t: 'Norðurlandamótið', teg: 'Keppni' }
  ] : [
    { d: dagar(2), t: 'Tökudagur fyrir Glóa', teg: 'Tökur' },
    { d: dagar(6), t: 'Opnun á Horninu', teg: 'Viðburður' },
    { d: dagar(13), t: 'Tökudagur, jólaefni', teg: 'Tökur' },
    { d: dagar(30), t: 'Áramótamyndband', teg: 'Efni' }
  ];
  const faerslur = [
    { id: 'p1', d: dagar(-2), t: ATH ? 'Æfing vikunnar' : 'Morgunrútínan', midill: 'Instagram', teg: 'Reel', styrkt: 's1', stada: 'birt' },
    { id: 'p2', d: dagar(1), t: ATH ? 'Undirbúningur fyrir mótið' : 'Nýju vörurnar frá Glóa', midill: ATH ? 'Instagram' : 'TikTok', teg: 'Reel', styrkt: ATH ? 's2' : 's1', stada: 'bidur' },
    { id: 'p3', d: dagar(2), t: 'Spurningar og svör', midill: 'Instagram', teg: 'Saga', styrkt: null, stada: 'samthykkt' },
    { id: 'p4', d: dagar(4), t: ATH ? 'Bíllinn á leið á æfingu' : 'Jólakaffið á Horninu', midill: 'Instagram', teg: 'Færsla', styrkt: ATH ? 's3' : 's2', stada: 'drog' },
    { id: 'p5', d: dagar(8), t: ATH ? 'Mótsdagurinn' : 'Gjafaleikur', midill: 'TikTok', teg: 'Myndband', styrkt: ATH ? null : 's2', stada: 'drog' },
    { id: 'p6', d: dagar(11), t: ATH ? 'Takk fyrir stuðninginn' : 'Uppáhaldsvörurnar', midill: 'Instagram', teg: 'Hringekja', styrkt: 's1', stada: 'drog' }
  ];
  const beidnir = [
    { id: 'b1', t: ATH ? 'Klippa mótið í reel' : 'Klippa tökudaginn í þrjú reels', teg: 'Myndband', skil: dagar(4), stada: 'vinnslu', dags: dagar(-2) },
    { id: 'b2', t: ATH ? 'Myndir fyrir Kraft' : 'Myndir fyrir Hornið', teg: 'Myndir', skil: dagar(7), stada: 'send', dags: dagar(0) },
    { id: 'b3', t: 'Laga textann á síðustu færslu', teg: 'Breyting', skil: dagar(-1), stada: 'tilbuid', dags: dagar(-4) }
  ];
  const tolur = { fylgjendur: ATH ? 18400 : 42700, nyir: ATH ? 612 : 1380, ahorf: ATH ? 214000 : 690000 };
  return { teg: ATH ? 'ithrottir' : 'ahrif', samningar, fyrirspurnir, dagskra, faerslur, beidnir, tolur };
}
let G;
try { G = JSON.parse(localStorage.getItem(LYKILL) || 'null'); } catch (e) { G = null; }
/* Eldri gögn vantar 'teg'. Glói er bara í gögnum áhrifavalda, svo þannig má sjá
   hvort vistuðu gögnin eiga við þann sem skoðar núna. */
if (G && G.samningar && !G.teg) G.teg = G.samningar.some((s) => s.nafn === 'Snyrtivörur Glói') ? 'ahrif' : 'ithrottir';
if (!G || !Array.isArray(G.samningar) || G.teg !== (ATH ? 'ithrottir' : 'ahrif')) G = nyGogn();
{
  /* Fylla í það sem eldri gögn vantar */
  const D = nyGogn();
  for (const k of ['fyrirspurnir', 'dagskra', 'faerslur', 'beidnir']) if (!Array.isArray(G[k])) G[k] = D[k];
  if (!G.tolur) G.tolur = D.tolur;
  for (const s of G.samningar) {
    if (typeof s.upphaed !== 'number') s.upphaed = Number(s.ar) || 0;
    if (s.grunnur !== 'ar' && s.grunnur !== 'herferd') s.grunnur = (!ATH && s.nafn === 'Kaffihúsið Hornið') ? 'herferd' : 'ar';
    if (!Array.isArray(s.skil)) s.skil = [];
  }
}
const vista = () => { try { localStorage.setItem(LYKILL, JSON.stringify(G)); } catch (e) { /* lokað */ } };
const samningur = (id) => G.samningar.find((s) => s.id === id);

/* ---------------- Smáhlutar ---------------- */
const merkiStafur = (s, staerd) => el('span', { class: 'ps-stafur' + (staerd ? ' ps-stafur--' + staerd : ''), style: '--l:' + s.litur, texti: s.stafur });
const STOD_FAERSLU = { drog: ['Drög', 'grar'], bidur: ['Bíður samþykkis', 'gul'], samthykkt: ['Samþykkt', 'blar'], birt: ['Birt', 'graen'] };
const STOD_BEIDNI = { send: ['Send', 'gul'], vinnslu: ['Í vinnslu', 'blar'], tilbuid: ['Tilbúið', 'graen'] };
const STOD_FYRIR = { ny: 'Ný', vidraedur: 'Í viðræðum', samningur: 'Samningur', hafnad: 'Hafnað' };
const pill = (texti, litur) => el('span', { class: 'ps-pilla ps-pilla--' + litur, texti });
const siduHaus = (h1, lysing, auka) => el('div', { class: 'ps-haus' }, [
  el('div', {}, [el('h1', { texti: h1 }), lysing ? el('p', { class: 'ps-lysing', texti: lysing }) : null]), auka || null]);
/* Samningur er virkur frá upphafsdegi til lokadags */
const virkur = (s) => eftir(s.fra) <= 0 && eftir(s.til) >= 0;
/* Lengd herferðar í mánuðum, minnst einn */
const lengdMan = (s) => Math.max(1, Math.round((new Date(s.til + 'T12:00:00') - new Date(s.fra + 'T12:00:00')) / 864e5 / 30.44));
/* Ársamningur: upphæðin deilt á tólf mánuði. Herferð: upphæðin deilt á mánuðina sem hún stendur. */
const aManudi = (s) => (s.grunnur === 'herferd' ? s.upphaed / lengdMan(s) : s.upphaed / 12);
const tekjurManadar = () => G.samningar.filter(virkur).reduce((n, s) => n + aManudi(s), 0);
const fjoldiSamninga = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? ' samningur' : ' samningar');
const endar = (s) => (s.grunnur === 'herferd' ? 'herferðin endar eftir ' : 'samningurinn rennur út eftir ') + eftir(s.til) + (eftir(s.til) === 1 ? ' dag' : ' daga');
const skilOpin = () => G.samningar.flatMap((s) => s.skil.filter((k) => k.buid < k.af).map((k) => ({ s, k })));
const framvinda = (buid, af) => el('span', { class: 'ps-stika', 'aria-hidden': 'true' }, [el('i', { style: 'width:' + Math.round(100 * Math.min(buid, af) / af) + '%' })]);

/* ==================================================================
   Síðurnar
   ================================================================== */
function byrja() {
  const sida = (location.pathname.split('/').pop() || 'mitt.html').replace('.html', '');
  const HEITI = { mitt: 'Yfirlit', samstarfsadilar: 'Samstarfsaðilar', efnisplan: 'Efnisplan', beidnir: 'Beiðnir' };
  teiknaHaus(ek, HEITI[sida] || 'Yfirlit');
  const svid = document.getElementById('innihald');
  /* Síða sem var ekki valin er ekki í valmyndinni. Ef einhver kemur beint á hana
     fær hann stutta skýringu og leið aftur á Yfirlit. */
  const OPID = { samstarfsadilar: VALID.samstarf, efnisplan: VALID.efnisplan, beidnir: VALID.beidnir };
  const SIDUR = { samstarfsadilar: siduSamstarf, efnisplan: siduEfnisplan, beidnir: siduBeidnir };
  const teikna = () => fylla(svid, SIDUR[sida]
    ? (OPID[sida] ? SIDUR[sida](teikna) : siduLokud(HEITI[sida]))
    : siduYfirlit(teikna));
  teikna();
}

function siduLokud(heiti) {
  return el('div', { class: 'ps' }, [smidi(),
    siduHaus(heiti, lokudTexti(heiti)),
    el('div', { class: 'ps-takkar' }, [
      el('a', { class: 'btn ps-blokk__hn', href: 'mitt.html', texti: 'Aftur á Yfirlit' }),
      el('a', { class: 'btn ps-blokk__hn', href: '../byggja.html?breyta=1', texti: 'Breyta vali' })])]);
}
const lokudTexti = (heiti) => heiti === 'Beiðnir'
  ? 'Þú valdir að vinna án stofu. Beiðnirnar birtast hér ef þú tengir stofu seinna.'
  : 'Þú valdir þennan hluta ekki. Smelltu á Breyta vali til að bæta honum við.';

/* ---------------- Yfirlit ---------------- */
/* Bara það sem var valið. Mest fjórar tölur efst, svo þeir kassar sem eiga við.
   Neðst: vanti eitthvað er hægt að breyta valinu eða biðja um það. */
function siduYfirlit(teikna) {
  const naest = G.dagskra.filter((x) => eftir(x.d) >= 0).sort((a, b) => a.d.localeCompare(b.d));
  const fyrsta = ATH ? (naest.find((x) => x.teg === 'Keppni') || naest[0]) : naest[0];
  const opin = skilOpin();
  const nyjar = G.fyrirspurnir.filter((f) => f.stada === 'ny');
  const rennur = G.samningar.filter((s) => eftir(s.til) >= 0 && eftir(s.til) <= 30);
  const virkir = G.samningar.filter(virkur);
  const naestaFaersla = G.faerslur.filter((p) => p.stada !== 'birt' && eftir(p.d) >= 0).sort((a, b) => a.d.localeCompare(b.d))[0];
  const beidnirOpnar = G.beidnir.filter((b) => b.stada !== 'tilbuid');
  const kpi = (h, tala, undir, href) => el(href ? 'a' : 'div', { class: 'card ps-kpi', href }, [
    el('span', { class: 'ps-kpi__h', texti: h }), el('strong', { class: 'ps-kpi__tala', texti: tala }), undir ? el('span', { class: 'ps-kpi__undir', texti: undir }) : null]);

  /* Tölurnar efst, í forgangsröð */
  const kpir = [
    VALID.tekjur ? kpi('Tekjur í mánuðinum', kr(tekjurManadar()), fjoldiSamninga(virkir.length) + ' í gangi', VALID.samstarf ? 'samstarfsadilar.html' : null) : null,
    VALID.samstarf ? kpi('Þarf að skila', String(opin.reduce((n, x) => n + (x.k.af - x.k.buid), 0)),
      opin.length ? 'til ' + new Set(opin.map((x) => x.s.id)).size + ' ' + ORD.ft : 'Allt komið', 'samstarfsadilar.html') : null,
    VALID.dagskra ? kpi(ATH ? 'Næsta keppni' : 'Næst á dagskrá', fyrsta ? dg(fyrsta.d) : 'Ekkert', fyrsta ? fyrsta.t : null) : null,
    VALID.samstarf ? kpi('Nýjar fyrirspurnir', String(nyjar.length), nyjar[0] ? 'Síðast: ' + nyjar[0].fra : 'Engar nýjar', 'samstarfsadilar.html?f=fyrirspurnir') : null,
    VALID.efnisplan ? kpi('Næsta færsla', naestaFaersla ? dg(naestaFaersla.d) : 'Engin', naestaFaersla ? naestaFaersla.t : null, 'efnisplan.html') : null,
    VALID.beidnir ? kpi('Beiðnir í vinnslu', String(beidnirOpnar.length), 'hjá ' + (STOFA || 'stofunni þinni'), 'beidnir.html') : null
  ].filter(Boolean).slice(0, 4);

  /* Kassarnir */
  const dagskraBlokk = (tilVara) => el('section', { class: 'card ps-blokk' }, [
    el('h2', { texti: ATH ? 'Keppnir og viðburðir' : 'Á dagskrá' }),
    naest.length ? el('ul', { class: 'ps-listi' }, naest.slice(0, 4).map((x) => el('li', {}, [
      el('span', { class: 'ps-dags' }, [el('b', { texti: String(new Date(x.d + 'T12:00:00').getDate()) }), document.createTextNode(MAN[new Date(x.d + 'T12:00:00').getMonth()])]),
      el('span', { class: 'ps-listi__t' }, [el('strong', { texti: x.t }), el('span', { texti: eftir(x.d) === 0 ? 'Í dag' : 'Eftir ' + eftir(x.d) + (eftir(x.d) === 1 ? ' dag' : ' daga') })]),
      pill(x.teg, x.teg === 'Keppni' ? 'blar' : x.teg === 'Styrktaraðili' ? 'graen' : 'grar')]))) : el('p', { class: 'ps-tomt', texti: 'Ekkert á dagskrá.' }),
    tilVara ? el('p', { class: 'ps-smatt ps-blokk__hn', texti: 'Þú valdir fáa hluta, svo hér er dagskráin. Það sem þú bætir við birtist hér.' }) : null
  ]);
  const skilBlokk = () => el('section', { class: 'card ps-blokk' }, [
    el('h2', { texti: 'Þarf að skila' }),
    opin.length ? el('ul', { class: 'ps-listi' }, opin.slice(0, 5).map(({ s, k }) => el('li', {}, [
      merkiStafur(s),
      el('span', { class: 'ps-listi__t' }, [el('strong', { texti: k.t }), el('span', { texti: s.nafn + ', ' + k.buid + ' af ' + k.af + ' ' + k.tima })]),
      el('button', { type: 'button', class: 'btn btn--litill', texti: 'Skilað',
        onclick: () => { k.buid += 1; vista(); tilkynna(k.t + ' merkt skilað fyrir ' + s.nafn); teikna(); } })]))) : el('p', { class: 'ps-tomt', texti: 'Allt komið. Vel gert.' })
  ]);
  const tolurBlokk = () => el('section', { class: 'card ps-blokk' }, [
    el('h2', { texti: 'Samfélagsmiðlarnir' }),
    el('div', { class: 'ps-tolur' }, [
      el('div', {}, [el('span', { texti: 'Fylgjendur' }), el('strong', { texti: G.tolur.fylgjendur.toLocaleString('de-DE') })]),
      el('div', {}, [el('span', { texti: 'Nýir í mánuðinum' }), el('strong', { texti: '+' + G.tolur.nyir.toLocaleString('de-DE') })]),
      el('div', {}, [el('span', { texti: 'Áhorf í mánuðinum' }), el('strong', { texti: G.tolur.ahorf.toLocaleString('de-DE') })])
    ]),
    el('p', { class: 'ps-smatt', texti: 'Tölurnar koma af Instagram og Facebook á hverjum morgni þegar miðlarnir eru tengdir.' })
  ]);
  const beidnirBlokk = () => el('section', { class: 'card ps-blokk' }, [
    el('h2', { texti: 'Beiðnir til ' + TIL_STOFU }),
    el('ul', { class: 'ps-listi' }, G.beidnir.slice(0, 3).map((b) => el('li', {}, [
      el('span', { class: 'ps-listi__t' }, [el('strong', { texti: b.t }), el('span', { texti: b.teg + ', skil ' + dg(b.skil) })]),
      pill(STOD_BEIDNI[b.stada][0], STOD_BEIDNI[b.stada][1])]))),
    el('a', { class: 'btn btn--litill ps-blokk__hn', href: 'beidnir.html', texti: 'Ný beiðni' })
  ]);
  const efnisBlokk = () => el('section', { class: 'card ps-blokk' }, [
    el('h2', { texti: 'Efnisplanið' }),
    el('ul', { class: 'ps-listi' }, G.faerslur.filter((p) => p.stada !== 'birt').sort((a, b) => a.d.localeCompare(b.d)).slice(0, 3).map((p) => el('li', {}, [
      el('span', { class: 'ps-listi__t' }, [el('strong', { texti: p.t }), el('span', { texti: dgLangt(p.d) + ', ' + p.midill })]),
      pill(STOD_FAERSLU[p.stada][0], STOD_FAERSLU[p.stada][1])]))),
    el('a', { class: 'btn btn--litill ps-blokk__hn', href: 'efnisplan.html', texti: 'Opna efnisplanið' })
  ]);
  const blokkir = [
    VALID.samstarf ? skilBlokk() : null,
    VALID.dagskra ? dagskraBlokk(false) : null,
    VALID.efnisplan ? efnisBlokk() : null,
    VALID.beidnir ? beidnirBlokk() : null,
    VALID.tolfraedi ? tolurBlokk() : null
  ].filter(Boolean);
  /* Eitthvað gagnlegt þótt fátt hafi verið valið */
  if (!blokkir.length) blokkir.push(dagskraBlokk(true));

  /* Vantar eitthvað: breyta valinu eða biðja um það með umsókninni */
  const fleiri = el('div', { class: 'card ps-vantar' }, [
    el('div', {}, [el('strong', { texti: 'Vantar eitthvað?' }),
      el('span', { class: 'ps-smatt', texti: 'Breyttu valinu, eða skrifaðu það í umsóknina og við athugum það.' })]),
    el('div', { class: 'ps-takkar' }, [
      el('a', { class: 'btn btn--litill', href: '../byggja.html?breyta=1', texti: 'Breyta vali' }),
      el('a', { class: 'btn btn--litill', href: '../index.html#kynning', texti: 'Sækja um aðgang' })])
  ]);

  return el('div', { class: 'ps' }, [
    smidi(),
    siduHaus(NAFN === 'Glerhúsið mitt' ? 'Góðan dag.' : 'Góðan dag, ' + NAFN.split(' ')[0] + '.', 'Þetta er það sem skiptir máli núna.'),
    kpir.length ? el('div', { class: 'ps-kpir ps-kpir--' + kpir.length }, kpir) : null,
    VALID.samstarf && rennur.length ? el('div', { class: 'card ps-vidvorun' }, [
      el('span', { class: 'ps-vidvorun__takn', 'aria-hidden': 'true', texti: '!' }),
      el('span', { texti: rennur.map((s) => s.nafn + ': ' + endar(s)).join('. ') + '.' }),
      el('a', { class: 'btn btn--litill', href: 'samstarfsadilar.html', texti: 'Skoða' })]) : null,
    el('div', { class: 'ps-tvo' }, blokkir),
    fleiri
  ]);
}

/* ---------------- Samstarfsaðilar ---------------- */
function siduSamstarf(teikna) {
  const flipi = new URLSearchParams(location.search).get('f') === 'fyrirspurnir' ? 'fyrirspurnir' : 'samningar';
  const skipta = (f) => { history.replaceState(null, '', 'samstarfsadilar.html' + (f === 'fyrirspurnir' ? '?f=fyrirspurnir' : '')); teikna(); };
  const flipar = el('div', { class: 'ps-flipar', role: 'tablist' }, [
    el('button', { type: 'button', role: 'tab', 'aria-selected': String(flipi === 'samningar'), texti: 'Samningar', onclick: () => skipta('samningar') }),
    el('button', { type: 'button', role: 'tab', 'aria-selected': String(flipi === 'fyrirspurnir'), onclick: () => skipta('fyrirspurnir') }, [
      document.createTextNode('Fyrirspurnir'),
      G.fyrirspurnir.some((f) => f.stada === 'ny') ? el('span', { class: 'ps-merki', texti: String(G.fyrirspurnir.filter((f) => f.stada === 'ny').length) }) : null])
  ]);
  const haus = siduHaus('Samstarfsaðilar', flipi === 'samningar'
    ? 'Hver samningur, hvað á að skila og hvað er búið.' : 'Fyrirspurnir úr póstinum og af samstarfsforminu.', flipar);

  if (flipi === 'fyrirspurnir') {
    const DALKAR = ['ny', 'vidraedur', 'samningur', 'hafnad'];
    const naesta = { ny: 'vidraedur', vidraedur: 'samningur' };
    return el('div', { class: 'ps' }, [smidi(), haus,
      el('div', { class: 'ps-tafla' }, DALKAR.map((d) => el('section', { class: 'ps-dalkur' }, [
        el('h2', {}, [document.createTextNode(STOD_FYRIR[d] + ' '), el('span', { texti: String(G.fyrirspurnir.filter((f) => f.stada === d).length) })]),
        ...G.fyrirspurnir.filter((f) => f.stada === d).map((f) => el('article', { class: 'card ps-fyrir' }, [
          el('strong', { texti: f.fra }), el('p', { texti: f.efni }), el('span', { class: 'ps-smatt', texti: dg(f.dags) }),
          naesta[d] ? el('div', { class: 'ps-fyrir__hn' }, [
            el('button', { type: 'button', class: 'btn btn--litill', texti: d === 'ny' ? 'Svara og ræða' : 'Samningur í höfn',
              onclick: () => {
                f.stada = naesta[d]; vista();
                tilkynna(d === 'ny' ? 'Í alvöru kerfinu svarar þú beint héðan' : f.fra + ': samningur í höfn');
                teikna();
              } }),
            el('button', { type: 'button', class: 'ps-texti-hn', texti: 'Hafna', onclick: () => { f.stada = 'hafnad'; vista(); teikna(); } })]) : null
        ]))
      ])))
    ]);
  }

  return el('div', { class: 'ps' }, [smidi(), haus,
    el('div', { class: 'ps-samningar' }, G.samningar.map((s) => {
      const dagarEftir = eftir(s.til);
      const herferd = s.grunnur === 'herferd';
      return el('article', { class: 'card ps-samn' }, [
        el('div', { class: 'ps-samn__haus' }, [merkiStafur(s, 'stor'),
          el('div', {}, [el('h2', { texti: s.nafn }), el('span', { class: 'ps-smatt', texti: manAr(s.fra) + ' til ' + manAr(s.til) + ', ' + s.tengilidur })]),
          el('div', { class: 'ps-samn__upph' }, [el('strong', { texti: kr(s.upphaed) }), el('span', { texti: herferd ? 'fyrir herferðina' : 'á ári' })])]),
        dagarEftir < 0 ? el('div', { class: 'ps-samn__vid' }, [pill(herferd ? 'Herferðinni er lokið' : 'Samningurinn er runninn út', 'grar')])
        : dagarEftir <= 30 ? el('div', { class: 'ps-samn__vid' }, [
          pill((herferd ? 'Herferðin endar eftir ' : 'Rennur út eftir ') + dagarEftir + (dagarEftir === 1 ? ' dag' : ' daga'), 'gul'),
          el('button', { type: 'button', class: 'ps-texti-hn', texti: herferd ? 'Bjóða næstu herferð' : 'Biðja um endurnýjun',
            onclick: () => tilkynna(s.tengilidur + (herferd ? ' fær póst um næstu herferð' : ' fær póst um endurnýjun')) })]) : null,
        el('ul', { class: 'ps-skil' }, s.skil.map((k) => el('li', {}, [
          el('span', { class: 'ps-skil__t' }, [el('strong', { texti: k.t }), el('span', { texti: k.buid + ' af ' + k.af + ' ' + k.tima })]),
          framvinda(k.buid, k.af),
          k.buid < k.af ? el('button', { type: 'button', class: 'btn btn--litill', texti: 'Skilað',
            onclick: () => { k.buid += 1; vista(); teikna(); } }) : el('span', { class: 'ps-hak', 'aria-label': 'Búið', texti: '✓' })]))),
        el('div', { class: 'ps-samn__fot' }, [
          el('button', { type: 'button', class: 'btn', texti: 'Senda skýrslu',
            onclick: () => tilkynna(s.tengilidur + ' fær skýrsluna með hlekkjum á færslurnar') }),
          el('span', { class: 'ps-smatt', texti: ORD.ak + ' fær yfirlit yfir allt sem búið er að skila.' })])
      ]);
    }))
  ]);
}

/* ---------------- Efnisplan ---------------- */
function siduEfnisplan(teikna) {
  const naesta = { drog: ['bidur', 'Senda til samþykkis'], bidur: ['samthykkt', 'Samþykkt'], samthykkt: ['birt', 'Merkja birt'] };
  const rodud = G.faerslur.slice().sort((a, b) => a.d.localeCompare(b.d));
  const nyr = el('form', { class: 'card ps-nyr' + (VALID.samstarf ? '' : ' ps-nyr--an'), onsubmit: (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const t = f.t.value.trim(); if (!t) { f.t.focus(); return; }
    G.faerslur.push({ id: 'p' + Date.now(), d: f.d.value || dagar(3), t, midill: f.midill.value, teg: f.teg.value, styrkt: (f.styrkt && f.styrkt.value) || null, stada: 'drog' });
    vista(); tilkynna('Færslan er komin í planið'); teikna();
  } }, [
    el('input', { name: 't', placeholder: ATH ? 'Ný færsla, til dæmis Æfing vikunnar' : 'Ný færsla, til dæmis Nýju vörurnar frá Glóa', 'aria-label': 'Heiti færslunnar', maxlength: '80' }),
    el('input', { name: 'd', type: 'date', value: dagar(3), 'aria-label': 'Dagsetning' }),
    el('select', { name: 'midill', 'aria-label': 'Miðill' }, ['Instagram', 'TikTok', 'YouTube', 'Facebook'].map((m) => el('option', { texti: m }))),
    el('select', { name: 'teg', 'aria-label': 'Tegund' }, ['Reel', 'Færsla', 'Saga', 'Myndband', 'Hringekja'].map((m) => el('option', { texti: m }))),
    VALID.samstarf ? el('select', { name: 'styrkt', 'aria-label': ATH ? 'Styrktaraðili' : 'Samstarfsaðili' }, [el('option', { value: '', texti: ORD.enginn }), ...G.samningar.map((s) => el('option', { value: s.id, texti: s.nafn }))]) : null,
    el('button', { type: 'submit', class: 'btn btn--gull', texti: 'Bæta við' })
  ]);
  return el('div', { class: 'ps' }, [
    smidi(),
    siduHaus('Efnisplan', 'Hvað fer út, hvenær og hver þarf að samþykkja.'),
    nyr,
    el('ol', { class: 'ps-plan' }, rodud.map((p) => {
      const s = VALID.samstarf && p.styrkt ? samningur(p.styrkt) : null;
      const [st, litur] = STOD_FAERSLU[p.stada];
      return el('li', { class: 'card ps-plan__lina' + (eftir(p.d) < 0 ? ' er-lidin' : '') }, [
        el('span', { class: 'ps-dags' }, [el('b', { texti: String(new Date(p.d + 'T12:00:00').getDate()) }), document.createTextNode(MAN[new Date(p.d + 'T12:00:00').getMonth()])]),
        el('span', { class: 'ps-listi__t' }, [el('strong', { texti: p.t }), el('span', { texti: p.midill + ', ' + p.teg.toLowerCase() + (s ? ', fyrir ' + s.nafn : '') })]),
        s ? merkiStafur(s) : null,
        pill(st, litur),
        naesta[p.stada] ? el('button', { type: 'button', class: 'btn btn--litill', texti: naesta[p.stada][1],
          onclick: () => {
            p.stada = naesta[p.stada][0]; vista();
            if (p.stada === 'bidur') tilkynna(s ? s.tengilidur + ' fær hlekk til að samþykkja' : 'Send til samþykkis');
            teikna();
          } }) : el('span', { class: 'ps-hak', 'aria-label': 'Birt', texti: '✓' })
      ]);
    })),
    VALID.samstarf ? el('p', { class: 'ps-smatt', texti: ORD.ak + ' samþykkir í gegnum hlekk, án þess að skrá sig inn.' }) : null
  ]);
}

/* ---------------- Beiðnir til stofunnar ---------------- */
function siduBeidnir(teikna) {
  const form = el('form', { class: 'card ps-nyr ps-nyr--beidni', onsubmit: (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const t = f.t.value.trim(); if (!t) { f.t.focus(); return; }
    G.beidnir.unshift({ id: 'b' + Date.now(), t, teg: f.teg.value, skil: f.skil.value || dagar(5), stada: 'send', dags: dagar(0) });
    vista(); tilkynna(STOFAN + ' fékk beiðnina'); teikna();
  } }, [
    el('input', { name: 't', placeholder: ATH ? 'Hvað viltu? Til dæmis Klippa mótið í reel' : 'Hvað viltu? Til dæmis Klippa tökudaginn í reels', 'aria-label': 'Beiðnin', maxlength: '100' }),
    el('select', { name: 'teg', 'aria-label': 'Tegund' }, ['Myndband', 'Færsla', 'Myndir', 'Breyting', 'Annað'].map((m) => el('option', { texti: m }))),
    el('input', { name: 'skil', type: 'date', value: dagar(5), 'aria-label': 'Skiladagur' }),
    el('button', { type: 'submit', class: 'btn btn--gull', texti: STOFA ? 'Senda á ' + STOFA : 'Senda beiðnina' })
  ]);
  return el('div', { class: 'ps' }, [
    smidi(),
    siduHaus('Beiðnir til ' + TIL_STOFU, 'Biddu um myndband, færslu eða breytingu. Þú sérð hvar það er statt og færð póst þegar það er tilbúið.'),
    form,
    el('ul', { class: 'ps-plan' }, G.beidnir.map((b) => el('li', { class: 'card ps-plan__lina' }, [
      el('span', { class: 'ps-listi__t' }, [el('strong', { texti: b.t }), el('span', { texti: b.teg + ', send ' + dg(b.dags) + ', skil ' + dg(b.skil) })]),
      pill(STOD_BEIDNI[b.stada][0], STOD_BEIDNI[b.stada][1]),
      b.stada === 'tilbuid' ? el('button', { type: 'button', class: 'btn btn--litill', texti: 'Sækja', onclick: () => tilkynna('Í alvöru kerfinu sækir þú skrána hér') })
        : el('span', { class: 'ps-smatt', texti: b.stada === 'send' ? STOFAN + ' hefur fengið hana' : STOFAN + ' er að vinna í henni' })
    ]))),
    el('p', { class: 'ps-smatt', texti: STOFAN + ' sér bara beiðnirnar sem þú sendir. Samningarnir og tekjurnar þínar eru bara þínar.' })
  ]);
}

/* Ræsing: neðst, svo öll gögn og föll séu til */
const ek = await vardaHlid({ krefstAdmin: true });
if (ek) {
  if (!erPersona()) location.replace('stjornbord.html');
  else byrja();
}
