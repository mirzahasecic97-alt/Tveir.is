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
   ========================================================================== */

import { el, fylla, vardaHlid, teiknaHaus, tilkynna, sersnid, erPersona } from './portal.js';


/* ---------------- Hjálp ---------------- */
const LYKILL = 'glerhusid-personan-v1';
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
const STOFA = sersnid && sersnid.stofa && sersnid.stofa !== 'enginn'
  ? (sersnid.stofa === 'tveir' ? 'Tveir' : (String(sersnid.stofaNafn || '').trim() || 'Stofan þín')) : null;
const NAFN = (sersnid && String(sersnid.nafn || '').trim()) || 'Glerhúsið mitt';

/* ---------------- Sýnigögnin ---------------- */
function nyGogn() {
  const samningar = ATH ? [
    { id: 's1', nafn: 'Sprettur sportvörur', stafur: 'S', litur: '#2f8f6f', ar: 1200000, fra: dagar(-320), til: dagar(41), tengilidur: 'Anna hjá Spretti',
      skil: [{ id: 'a', t: 'Færslur á Instagram', af: 4, buid: 3, tima: 'í mánuðinum' }, { id: 'b', t: 'Merkið á keppnisfötunum', af: 1, buid: 1, tima: 'á árinu' }, { id: 'c', t: 'Viðburðir í versluninni', af: 2, buid: 1, tima: 'á árinu' }] },
    { id: 's2', nafn: 'Kraftur orkudrykkur', stafur: 'K', litur: '#c8643b', ar: 600000, fra: dagar(-260), til: dagar(105), tengilidur: 'Gunnar hjá Krafti',
      skil: [{ id: 'a', t: 'Reels', af: 2, buid: 1, tima: 'í mánuðinum' }, { id: 'b', t: 'Sögur', af: 4, buid: 4, tima: 'í mánuðinum' }] },
    { id: 's3', nafn: 'Bílasalan Hraði', stafur: 'B', litur: '#5662b4', ar: 360000, fra: dagar(-350), til: dagar(15), tengilidur: 'Sigrún hjá Hraða',
      skil: [{ id: 'a', t: 'Færsla með bílnum', af: 1, buid: 1, tima: 'í mánuðinum' }, { id: 'b', t: 'Myndataka', af: 1, buid: 0, tima: 'á árinu' }] }
  ] : [
    { id: 's1', nafn: 'Snyrtivörur Glói', stafur: 'G', litur: '#c8643b', ar: 900000, fra: dagar(-200), til: dagar(165), tengilidur: 'Lilja hjá Glóa',
      skil: [{ id: 'a', t: 'Reels', af: 3, buid: 2, tima: 'í mánuðinum' }, { id: 'b', t: 'Sögur með hlekk', af: 6, buid: 4, tima: 'í mánuðinum' }] },
    { id: 's2', nafn: 'Kaffihúsið Hornið', stafur: 'H', litur: '#8a5a3c', ar: 300000, fra: dagar(-40), til: dagar(20), tengilidur: 'Óli hjá Horninu',
      skil: [{ id: 'a', t: 'Jólaherferð, færslur', af: 3, buid: 1, tima: 'í herferðinni' }, { id: 'b', t: 'Gjafaleikur', af: 1, buid: 0, tima: 'í herferðinni' }] },
    { id: 's3', nafn: 'Sprettur sportvörur', stafur: 'S', litur: '#2f8f6f', ar: 480000, fra: dagar(-300), til: dagar(65), tengilidur: 'Anna hjá Spretti',
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
  return { samningar, fyrirspurnir, dagskra, faerslur, beidnir, tolur };
}
let G;
try { G = JSON.parse(localStorage.getItem(LYKILL) || 'null'); } catch (e) { G = null; }
if (!G || !G.samningar) G = nyGogn();
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
const tekjurManadar = () => G.samningar.filter((s) => eftir(s.til) >= 0).reduce((n, s) => n + s.ar / 12, 0);
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
  const teikna = () => fylla(svid, ({ samstarfsadilar: siduSamstarf, efnisplan: siduEfnisplan, beidnir: siduBeidnir })[sida]?.(teikna) || siduYfirlit(teikna));
  teikna();
}

/* ---------------- Yfirlit ---------------- */
function siduYfirlit(teikna) {
  const naest = G.dagskra.filter((x) => eftir(x.d) >= 0).sort((a, b) => a.d.localeCompare(b.d));
  const fyrsta = ATH ? (naest.find((x) => x.teg === 'Keppni') || naest[0]) : naest[0];
  const opin = skilOpin();
  const nyjar = G.fyrirspurnir.filter((f) => f.stada === 'ny');
  const rennur = G.samningar.filter((s) => eftir(s.til) >= 0 && eftir(s.til) <= 30);
  const kpi = (h, tala, undir, href) => el(href ? 'a' : 'div', { class: 'card ps-kpi', href }, [
    el('span', { class: 'ps-kpi__h', texti: h }), el('strong', { class: 'ps-kpi__tala', texti: tala }), undir ? el('span', { class: 'ps-kpi__undir', texti: undir }) : null]);
  return el('div', { class: 'ps' }, [
    siduHaus('Góðan dag, ' + NAFN.split(' ')[0] + '.', 'Þetta er það sem skiptir máli núna.'),
    el('div', { class: 'ps-kpir' }, [
      kpi('Tekjur í mánuðinum', kr(tekjurManadar()), G.samningar.length + ' samningar', 'samstarfsadilar.html'),
      kpi('Þarf að skila', String(opin.reduce((n, x) => n + (x.k.af - x.k.buid), 0)), 'til ' + new Set(opin.map((x) => x.s.id)).size + ' samstarfsaðila', 'samstarfsadilar.html'),
      kpi(ATH ? 'Næsta keppni' : 'Næst á dagskrá', fyrsta ? dg(fyrsta.d) : 'Ekkert', fyrsta ? fyrsta.t : null),
      kpi('Nýjar fyrirspurnir', String(nyjar.length), nyjar[0] ? 'Síðast: ' + nyjar[0].fra : 'Engar nýjar', 'samstarfsadilar.html?f=fyrirspurnir')
    ]),
    rennur.length ? el('div', { class: 'card ps-vidvorun' }, [
      el('span', { class: 'ps-vidvorun__takn', 'aria-hidden': 'true', texti: '!' }),
      el('span', { texti: rennur.map((s) => s.nafn + ': samningurinn rennur út eftir ' + eftir(s.til) + ' daga').join('. ') + '.' }),
      el('a', { class: 'btn btn--litill', href: 'samstarfsadilar.html', texti: 'Skoða' })]) : null,
    el('div', { class: 'ps-tvo' }, [
      el('section', { class: 'card ps-blokk' }, [
        el('h2', { texti: ATH ? 'Keppnir og viðburðir' : 'Á dagskrá' }),
        el('ul', { class: 'ps-listi' }, naest.slice(0, 4).map((x) => el('li', {}, [
          el('span', { class: 'ps-dags' }, [el('b', { texti: String(new Date(x.d + 'T12:00:00').getDate()) }), document.createTextNode(MAN[new Date(x.d + 'T12:00:00').getMonth()])]),
          el('span', { class: 'ps-listi__t' }, [el('strong', { texti: x.t }), el('span', { texti: eftir(x.d) === 0 ? 'Í dag' : 'Eftir ' + eftir(x.d) + ' daga' })]),
          pill(x.teg, x.teg === 'Keppni' ? 'blar' : x.teg === 'Styrktaraðili' ? 'graen' : 'grar')])))
      ]),
      el('section', { class: 'card ps-blokk' }, [
        el('h2', { texti: 'Þarf að skila' }),
        opin.length ? el('ul', { class: 'ps-listi' }, opin.slice(0, 5).map(({ s, k }) => el('li', {}, [
          merkiStafur(s),
          el('span', { class: 'ps-listi__t' }, [el('strong', { texti: k.t }), el('span', { texti: s.nafn + ', ' + k.buid + ' af ' + k.af + ' ' + k.tima })]),
          el('button', { type: 'button', class: 'btn btn--litill', texti: 'Skilað',
            onclick: () => { k.buid += 1; vista(); tilkynna(k.t + ' merkt skilað fyrir ' + s.nafn); teikna(); } })]))) : el('p', { class: 'ps-tomt', texti: 'Allt komið. Vel gert.' })
      ])
    ]),
    el('div', { class: 'ps-tvo' }, [
      el('section', { class: 'card ps-blokk' }, [
        el('h2', { texti: 'Samfélagsmiðlarnir' }),
        el('div', { class: 'ps-tolur' }, [
          el('div', {}, [el('span', { texti: 'Fylgjendur' }), el('strong', { texti: G.tolur.fylgjendur.toLocaleString('de-DE') })]),
          el('div', {}, [el('span', { texti: 'Nýir í mánuðinum' }), el('strong', { texti: '+' + G.tolur.nyir.toLocaleString('de-DE') })]),
          el('div', {}, [el('span', { texti: 'Áhorf í mánuðinum' }), el('strong', { texti: G.tolur.ahorf.toLocaleString('de-DE') })])
        ]),
        el('p', { class: 'ps-smatt', texti: 'Tölurnar koma af Instagram og Facebook á hverjum morgni þegar miðlarnir eru tengdir.' })
      ]),
      STOFA ? el('section', { class: 'card ps-blokk' }, [
        el('h2', { texti: 'Beiðnir til ' + (STOFA === 'Tveir' ? 'Tveir' : 'stofunnar') }),
        el('ul', { class: 'ps-listi' }, G.beidnir.slice(0, 3).map((b) => el('li', {}, [
          el('span', { class: 'ps-listi__t' }, [el('strong', { texti: b.t }), el('span', { texti: b.teg + ', skil ' + dg(b.skil) })]),
          pill(STOD_BEIDNI[b.stada][0], STOD_BEIDNI[b.stada][1])]))),
        el('a', { class: 'btn btn--litill ps-blokk__hn', href: 'beidnir.html', texti: 'Ný beiðni' })
      ]) : el('section', { class: 'card ps-blokk' }, [
        el('h2', { texti: 'Efnisplanið' }),
        el('ul', { class: 'ps-listi' }, G.faerslur.filter((p) => p.stada !== 'birt').slice(0, 3).map((p) => el('li', {}, [
          el('span', { class: 'ps-listi__t' }, [el('strong', { texti: p.t }), el('span', { texti: dgLangt(p.d) + ', ' + p.midill })]),
          pill(STOD_FAERSLU[p.stada][0], STOD_FAERSLU[p.stada][1])]))),
        el('a', { class: 'btn btn--litill ps-blokk__hn', href: 'efnisplan.html', texti: 'Opna efnisplanið' })
      ])
    ])
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
    ? 'Hver samningur, hvað á að skila og hvað er búið.' : 'Fyrirspurnir af vefnum þínum og úr póstinum.', flipar);

  if (flipi === 'fyrirspurnir') {
    const DALKAR = ['ny', 'vidraedur', 'samningur', 'hafnad'];
    const naesta = { ny: 'vidraedur', vidraedur: 'samningur' };
    return el('div', { class: 'ps' }, [haus,
      el('div', { class: 'ps-tafla' }, DALKAR.map((d) => el('section', { class: 'ps-dalkur' }, [
        el('h2', {}, [document.createTextNode(STOD_FYRIR[d] + ' '), el('span', { texti: String(G.fyrirspurnir.filter((f) => f.stada === d).length) })]),
        ...G.fyrirspurnir.filter((f) => f.stada === d).map((f) => el('article', { class: 'card ps-fyrir' }, [
          el('strong', { texti: f.fra }), el('p', { texti: f.efni }), el('span', { class: 'ps-smatt', texti: dg(f.dags) }),
          naesta[d] ? el('div', { class: 'ps-fyrir__hn' }, [
            el('button', { type: 'button', class: 'btn btn--litill', texti: d === 'ny' ? 'Svara' : 'Samningur í höfn',
              onclick: () => { f.stada = naesta[d]; vista(); tilkynna(f.fra + ': ' + STOD_FYRIR[f.stada].toLowerCase()); teikna(); } }),
            el('button', { type: 'button', class: 'ps-texti-hn', texti: 'Hafna', onclick: () => { f.stada = 'hafnad'; vista(); teikna(); } })]) : null
        ]))
      ]))),
      el('p', { class: 'ps-smatt', texti: 'Samstarfsformið á vefnum þínum sendir fyrirspurnirnar beint hingað.' })
    ]);
  }

  return el('div', { class: 'ps' }, [haus,
    el('div', { class: 'ps-samningar' }, G.samningar.map((s) => {
      const dagarEftir = eftir(s.til);
      return el('article', { class: 'card ps-samn' }, [
        el('div', { class: 'ps-samn__haus' }, [merkiStafur(s, 'stor'),
          el('div', {}, [el('h2', { texti: s.nafn }), el('span', { class: 'ps-smatt', texti: manAr(s.fra) + ' til ' + manAr(s.til) + ', ' + s.tengilidur })]),
          el('div', { class: 'ps-samn__upph' }, [el('strong', { texti: kr(s.ar) }), el('span', { texti: 'á ári' })])]),
        dagarEftir <= 30 ? el('div', { class: 'ps-samn__vid' }, [pill('Rennur út eftir ' + dagarEftir + ' daga', 'gul'),
          el('button', { type: 'button', class: 'ps-texti-hn', texti: 'Biðja um endurnýjun', onclick: () => tilkynna('Póstur um endurnýjun fer á ' + s.tengilidur) })]) : null,
        el('ul', { class: 'ps-skil' }, s.skil.map((k) => el('li', {}, [
          el('span', { class: 'ps-skil__t' }, [el('strong', { texti: k.t }), el('span', { texti: k.buid + ' af ' + k.af + ' ' + k.tima })]),
          framvinda(k.buid, k.af),
          k.buid < k.af ? el('button', { type: 'button', class: 'btn btn--litill', texti: 'Skilað',
            onclick: () => { k.buid += 1; vista(); teikna(); } }) : el('span', { class: 'ps-hak', 'aria-label': 'Búið', texti: '✓' })]))),
        el('div', { class: 'ps-samn__fot' }, [
          el('button', { type: 'button', class: 'btn', texti: 'Senda skýrslu',
            onclick: () => tilkynna('Skýrsla um skilin fer á ' + s.tengilidur + ' með hlekkjum á færslurnar') }),
          el('span', { class: 'ps-smatt', texti: 'Styrktaraðilinn fær yfirlit yfir allt sem búið er að skila.' })])
      ]);
    }))
  ]);
}

/* ---------------- Efnisplan ---------------- */
function siduEfnisplan(teikna) {
  const naesta = { drog: ['bidur', 'Senda til samþykkis'], bidur: ['samthykkt', 'Samþykkt'], samthykkt: ['birt', 'Merkja birt'] };
  const rodud = G.faerslur.slice().sort((a, b) => a.d.localeCompare(b.d));
  const nyr = el('form', { class: 'card ps-nyr', onsubmit: (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const t = f.t.value.trim(); if (!t) { f.t.focus(); return; }
    G.faerslur.push({ id: 'p' + Date.now(), d: f.d.value || dagar(3), t, midill: f.midill.value, teg: f.teg.value, styrkt: f.styrkt.value || null, stada: 'drog' });
    vista(); tilkynna('Færslan er komin í planið'); teikna();
  } }, [
    el('input', { name: 't', placeholder: 'Ný færsla, til dæmis Æfing vikunnar', 'aria-label': 'Heiti færslunnar', maxlength: '80' }),
    el('input', { name: 'd', type: 'date', value: dagar(3), 'aria-label': 'Dagsetning' }),
    el('select', { name: 'midill', 'aria-label': 'Miðill' }, ['Instagram', 'TikTok', 'YouTube', 'Facebook'].map((m) => el('option', { texti: m }))),
    el('select', { name: 'teg', 'aria-label': 'Tegund' }, ['Reel', 'Færsla', 'Saga', 'Myndband', 'Hringekja'].map((m) => el('option', { texti: m }))),
    el('select', { name: 'styrkt', 'aria-label': 'Styrktaraðili' }, [el('option', { value: '', texti: 'Enginn styrktaraðili' }), ...G.samningar.map((s) => el('option', { value: s.id, texti: s.nafn }))]),
    el('button', { type: 'submit', class: 'btn btn--gull', texti: 'Bæta við' })
  ]);
  return el('div', { class: 'ps' }, [
    siduHaus('Efnisplan', 'Hvað fer út, hvenær og hver þarf að samþykkja.'),
    nyr,
    el('ol', { class: 'ps-plan' }, rodud.map((p) => {
      const s = p.styrkt && samningur(p.styrkt);
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
    el('p', { class: 'ps-smatt', texti: 'Styrktaraðilinn samþykkir í gegnum hlekk, án þess að skrá sig inn.' })
  ]);
}

/* ---------------- Beiðnir til stofunnar ---------------- */
function siduBeidnir(teikna) {
  if (!STOFA) return el('div', { class: 'ps' }, [siduHaus('Beiðnir', 'Þú valdir að vinna án stofu. Hér koma beiðnirnar ef þú tengir stofu seinna.')]);
  const form = el('form', { class: 'card ps-nyr ps-nyr--beidni', onsubmit: (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const t = f.t.value.trim(); if (!t) { f.t.focus(); return; }
    G.beidnir.unshift({ id: 'b' + Date.now(), t, teg: f.teg.value, skil: f.skil.value || dagar(5), stada: 'send', dags: dagar(0) });
    vista(); tilkynna(STOFA + ' fékk beiðnina'); teikna();
  } }, [
    el('input', { name: 't', placeholder: 'Hvað viltu? Til dæmis Klippa mótið í reel', 'aria-label': 'Beiðnin', maxlength: '100' }),
    el('select', { name: 'teg', 'aria-label': 'Tegund' }, ['Myndband', 'Færsla', 'Myndir', 'Breyting', 'Annað'].map((m) => el('option', { texti: m }))),
    el('input', { name: 'skil', type: 'date', value: dagar(5), 'aria-label': 'Skiladagur' }),
    el('button', { type: 'submit', class: 'btn btn--gull', texti: 'Senda á ' + STOFA })
  ]);
  return el('div', { class: 'ps' }, [
    siduHaus('Beiðnir til ' + (STOFA === 'Tveir' ? 'Tveir' : 'stofunnar'), 'Biddu um myndband, færslu eða breytingu. Þú sérð hvar það er statt og færð póst þegar það er tilbúið.'),
    form,
    el('ul', { class: 'ps-plan' }, G.beidnir.map((b) => el('li', { class: 'card ps-plan__lina' }, [
      el('span', { class: 'ps-listi__t' }, [el('strong', { texti: b.t }), el('span', { texti: b.teg + ', send ' + dg(b.dags) + ', skil ' + dg(b.skil) })]),
      pill(STOD_BEIDNI[b.stada][0], STOD_BEIDNI[b.stada][1]),
      b.stada === 'tilbuid' ? el('button', { type: 'button', class: 'btn btn--litill', texti: 'Sækja', onclick: () => tilkynna('Í alvöru kerfinu sækir þú skrána hér') })
        : el('span', { class: 'ps-smatt', texti: b.stada === 'send' ? STOFA + ' hefur fengið hana' : STOFA + ' er að vinna í henni' })
    ]))),
    el('p', { class: 'ps-smatt', texti: STOFA + ' sér bara beiðnirnar sem þú sendir. Samningarnir og tekjurnar þínar eru bara þínar.' })
  ]);
}

/* Ræsing: neðst, svo öll gögn og föll séu til */
const ek = await vardaHlid({ krefstAdmin: true });
if (ek) {
  if (!erPersona()) location.replace('stjornbord.html');
  else byrja();
}
