/* ==========================================================================
   Glerhúsið fyrir verktaka og lítil fyrirtæki (sýnidæmi)

   Þrjár síður: Tilboð og verkbeiðnir (tilbod.html), Myndir úr verkinu
   (myndir.html) og Yfirlit fyrir lítil fyrirtæki (fyrirtaeki.html).
   Síðan er lesin úr slóðinni. Gögnin eru sýnidæmi í vafranum
   (localStorage), dagsetningar reiknaðar frá deginum í dag. Myndir sem
   eru settar inn eru minnkaðar og geymdar bara í þessum vafra.

   Hver hópur sér bara sínar síður: verktakar Tilboð og Myndir, lítil
   fyrirtæki Yfirlit og Tilboð. Annað er sent á rétta síðu.
   ========================================================================== */

import { el, fylla, vardaHlid, teiknaHaus, tilkynna, sersnid, erVerktaki, ervalid, gestNafn } from './portal.js';

const LYKILL = 'glerhus-tveir-verktaki-v2';
const IDAG = new Date(); IDAG.setHours(12, 0, 0, 0);
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dagar = (n) => { const d = new Date(IDAG); d.setDate(d.getDate() + n); return iso(d); };
/* Dagur fyrr í þessum mánuði, aldrei fyrir þann fyrsta */
const iMan = (n) => { const d = new Date(IDAG); d.setDate(Math.max(1, d.getDate() - n)); return iso(d); };
const MAN = ['jan.', 'feb.', 'mars', 'apr.', 'maí', 'jún.', 'júl.', 'ágú.', 'sep.', 'okt.', 'nóv.', 'des.'];
const MAN_LANGT = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
const dg = (s) => { const d = new Date(s + 'T12:00:00'); return d.getDate() + '. ' + MAN[d.getMonth()]; };
const kr = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' kr.';
const iThessumMan = (s) => !!s && s.slice(0, 7) === iso(IDAG).slice(0, 7);

const GREIN = sersnid ? sersnid.grein : null;
const VERKTAKI = GREIN === 'verktaki';
const FYRIRTAEKI = GREIN === 'fyrirtaeki';
const SIDA = (location.pathname.split('/').pop() || 'tilbod.html').replace('.html', '') || 'tilbod';
const NAFN = gestNafn() || (VERKTAKI ? 'Smíðaverk' : 'Kaffihúsið');
const SMIDI = 'Sýnidæmi með tilbúnum gögnum. Þessi hluti er í smíðum og kemur í alvöru aðganginn fljótlega.';

/* Hvert á gesturinn að fara ef hann á ekki heima á þessari síðu.
   Aldrei vísað á stjórnborðið nema hópurinn sé ekki verktakar eða lítil
   fyrirtæki, svo engin hringrás myndist á milli síðna. */
function rettSida() {
  if (!erVerktaki()) return 'stjornbord.html';
  if (FYRIRTAEKI) {
    if (SIDA === 'myndir') return 'fyrirtaeki.html';
    if (SIDA === 'tilbod' && !ervalid('tilbod')) return 'fyrirtaeki.html';
    return null;
  }
  if (SIDA === 'fyrirtaeki') return ervalid('tilbod') || !ervalid('myndir') ? 'tilbod.html' : 'myndir.html';
  if (SIDA === 'tilbod' && !ervalid('tilbod') && ervalid('myndir')) return 'myndir.html';
  if (SIDA === 'myndir' && !ervalid('myndir') && ervalid('tilbod')) return 'tilbod.html';
  return null;
}

function nyGogn() {
  const beidnir = [
    { id: 'v1', fra: 'Helga, Hlíðarvegur 12', efni: VERKTAKI ? 'Skipta um þakrennur og laga niðurfall' : 'Veisla fyrir 40 manns í desember', dags: dagar(-1), stada: 'ny' },
    { id: 'v2', fra: 'Húsfélagið Lindargötu 5', efni: VERKTAKI ? 'Mála stigaganginn, þrjár hæðir' : 'Jólagjafir fyrir starfsfólkið', dags: dagar(-3), stada: 'ny' },
    { id: 'v3', fra: 'Bjarni, Sumarbústaður í Grímsnesi', efni: VERKTAKI ? 'Nýr pallur, um 30 fermetrar' : 'Áskrift að vörum í hverjum mánuði', dags: dagar(-6), stada: 'tilbod' }
  ];
  /* Upphæðirnar eru án VSK */
  const tilbod = VERKTAKI ? [
    { id: 't1', kunni: 'Bjarni, Sumarbústaður í Grímsnesi', titill: 'Nýr pallur', dags: dagar(-4), stada: 'sent',
      linur: [{ t: 'Efni, gagnvarið timbur', u: 480000 }, { t: 'Vinna, 3 dagar', u: 540000 }, { t: 'Akstur', u: 35000 }] },
    { id: 't2', kunni: 'Sigrún, Ásgarður 4', titill: 'Laga þakið eftir storminn', dags: dagar(-12), stada: 'samthykkt', sam: dagar(-10),
      linur: [{ t: 'Þakplötur og festingar', u: 210000 }, { t: 'Vinna, 2 dagar', u: 360000 }] },
    { id: 't3', kunni: 'Kaffihúsið Hornið', titill: 'Nýr bar og hillur', dags: dagar(-20), stada: 'hafnad',
      linur: [{ t: 'Smíði og efni', u: 1250000 }] }
  ] : [
    { id: 't1', kunni: 'Bjarni, Grímsnesi', titill: 'Vörur í áskrift', dags: dagar(-4), stada: 'sent',
      linur: [{ t: 'Pakki á mánuði', u: 24000 }, { t: 'Sending', u: 2500 }] },
    { id: 't2', kunni: 'Fyrirtækið Skjól', titill: 'Jólagjafir, 25 pakkar', dags: dagar(-10), stada: 'samthykkt', sam: iMan(6),
      linur: [{ t: 'Gjafapakkar', u: 225000 }, { t: 'Merkt kort', u: 15000 }] }
  ];
  const verk = [
    { id: 'm1', titill: VERKTAKI ? 'Þakið í Ásgarði 4' : 'Jólagluggi verslunarinnar', kunni: VERKTAKI ? 'Sigrún' : 'Verslunin', naest: 'eftir', myndir: [
      { id: 'a', hvenaer: 'fyrir', texti: VERKTAKI ? 'Skemmdin eftir storminn' : 'Glugginn áður', d: dagar(-9) },
      { id: 'c', hvenaer: 'medan', texti: VERKTAKI ? 'Gömlu plöturnar farnar' : 'Uppsetningin', d: dagar(-5) },
      { id: 'b', hvenaer: 'eftir', texti: VERKTAKI ? 'Nýjar plötur komnar á' : 'Jólaglugginn tilbúinn', d: dagar(-2) }] },
    { id: 'm2', titill: VERKTAKI ? 'Pallurinn í Grímsnesi' : 'Nýja vörulínan', kunni: 'Bjarni', naest: 'medan', myndir: [
      { id: 'a', hvenaer: 'fyrir', texti: VERKTAKI ? 'Svæðið áður en byrjað er' : 'Vörurnar fyrir myndatöku', d: dagar(-1) }] }
  ];
  /* Lítið fyrirtæki: kaffihús og búð með sex starfsmenn */
  const fy = {
    folk: [
      { id: 'f1', nafn: 'Anna', litur: '#3f7fd9', verk: [
        { id: 'a1', t: 'Opna og kveikja á kaffivélunum', b: true }, { id: 'a2', t: 'Taka á móti mjólkursendingunni', b: true }, { id: 'a3', t: 'Panta kaffibaunir fyrir næstu viku', b: false }] },
      { id: 'f2', nafn: 'Gunnar', litur: '#2e9e5b', verk: [
        { id: 'g1', t: 'Baka snúða og kanilsnúða', b: true }, { id: 'g2', t: 'Gera tertuna fyrir afmælið kl. 15', b: false }] },
      { id: 'f3', nafn: 'Sólveig', litur: '#c2703d', verk: [
        { id: 's1', t: 'Setja upp jólaskreytingar í glugganum', b: false }, { id: 's2', t: 'Skrifa nýja töflu með réttum dagsins', b: true }] },
      { id: 'f4', nafn: 'Kári', litur: '#7a5cc8', verk: [
        { id: 'k1', t: 'Telja lagerinn í búðinni', b: false }, { id: 'k2', t: 'Fylla á kæliskápinn', b: true }, { id: 'k3', t: 'Fara með flöskurnar í endurvinnslu', b: false }] },
      { id: 'f5', nafn: 'Elín', litur: '#d14d72', verk: [
        { id: 'e1', t: 'Vaktaplanið fyrir desember', b: false }, { id: 'e2', t: 'Svara umsóknum um helgarvinnu', b: false }] },
      { id: 'f6', nafn: 'Tómas', litur: '#1f8a8a', verk: [
        { id: 'o1', t: 'Þrífa ofninn eftir lokun', b: false }, { id: 'o2', t: 'Loka kassanum og ganga frá', b: false }] }
    ],
    postur: [
      { id: 'p1', fra: 'Katrín Jónsdóttir', efni: 'Veislupöntun: kaffi og kökur fyrir 30 manns á laugardaginn', verk: 'Staðfesta veisluna og senda verð', hja: null },
      { id: 'p2', fra: 'Ólafur Pétursson', efni: 'Fyrirspurn um opnunartíma um jól og áramót', verk: 'Svara með opnunartíma yfir hátíðirnar', hja: null },
      { id: 'p3', fra: 'Skrifstofan Skjól', efni: 'Getið þið komið með morgunmat á fund á fimmtudaginn?', verk: 'Gera tilboð í morgunmat fyrir 12', hja: null },
      { id: 'p4', fra: 'Rakel', efni: 'Gleymdi trefli hjá ykkur í gær', verk: 'Athuga óskilamunina og svara', hja: 'f3' }
    ],
    pantanir: [
      { id: 'o1', kunni: 'Katrín Jónsdóttir', efni: 'Afmælisterta, 20 manns', dags: iMan(1), upph: 18500, stada: 'stadfest' },
      { id: 'o2', kunni: 'Leikskólinn Lundur', efni: 'Snúðar fyrir jólaball', dags: iMan(4), upph: 32000, stada: 'afhent' },
      { id: 'o3', kunni: 'Hárstofan Hlín', efni: 'Kaffi og meðlæti, föstudagur', dags: iMan(8), upph: 14200, stada: 'afhent' }
    ],
    samningar: [
      { id: 's1', kunni: 'Skrifstofan Skjól', efni: 'Kaffi og meðlæti tvisvar í viku', upph: 85000 }
    ]
  };
  /* Rakel er á lista hjá Sólveigu, svo verkið er þar líka */
  fy.folk[2].verk.push({ id: 's3', t: 'Athuga óskilamunina og svara', b: false });
  return { grein: GREIN, beidnir, tilbod, verk, fy };
}
let G;
try { G = JSON.parse(localStorage.getItem(LYKILL) || 'null'); } catch (e) { G = null; }
if (!G || !G.tilbod || !G.fy || G.grein !== GREIN) G = nyGogn();
try { localStorage.removeItem('glerhus-tveir-verktaki-v1'); } catch (e) { /* lokað */ }
const vista = () => { try { localStorage.setItem(LYKILL, JSON.stringify(G)); return true; } catch (e) { return false; } };

const pill = (texti, litur) => el('span', { class: 'ps-pilla ps-pilla--' + litur, texti });
const smidi = () => el('p', { class: 'ps-smidi', texti: SMIDI });
const STOD_TILB = { drog: ['Drög', 'grar'], sent: ['Bíður svars', 'gul'], samthykkt: ['Samþykkt', 'graen'], hafnad: ['Hafnað', 'grar'] };
const STOD_BEID = { ny: ['Ný', 'blar'], tilbod: ['Tilboð gert', 'gul'], hafnad: ['Hafnað', 'grar'] };
const HVENAER = { fyrir: ['Fyrir', 'grar'], medan: ['Á meðan', 'gul'], eftir: ['Eftir', 'graen'] };
const anVsk = (t) => t.linur.reduce((n, l) => n + (+l.u || 0), 0);
const vsk = (n) => Math.round(n * 0.24);
const siduHaus = (h1, lysing, auka) => el('div', { class: 'ps-haus' }, [
  el('div', {}, [el('h1', { texti: h1 }), lysing ? el('p', { class: 'ps-lysing', texti: lysing }) : null]), auka || null]);

/* Án VSK, VSK 24% og samtals með VSK */
function summur(an, stor) {
  const lina = (h, upph, adal) => el('div', { class: 'vt-summur__lina' + (adal ? ' vt-summur__lina--adal' : '') }, [
    el('dt', { texti: h }), el('dd', { texti: kr(upph) })]);
  return el('dl', { class: 'vt-summur' + (stor ? ' vt-summur--stor' : '') }, [
    lina('Án VSK', an), lina('VSK 24%', vsk(an)), lina('Samtals með VSK', an + vsk(an), true)]);
}

/* ---------------- Tilboðið eins og viðskiptavinurinn sér það ---------------- */
function synaKunna(t, eftir) {
  const an = anVsk(t);
  const svara = (samthykkt) => {
    if (samthykkt) {
      t.stada = 'samthykkt'; t.sam = dagar(0);
      /* Verktaki: verkið fer á listann í Myndum, án mynda til að byrja með */
      if (VERKTAKI && !G.verk.some((v) => v.tilbod === t.id)) {
        G.verk.unshift({ id: 'm' + Date.now(), tilbod: t.id, titill: t.titill, kunni: t.kunni, naest: 'fyrir', myndir: [] });
      }
    } else {
      t.stada = 'hafnad';
    }
    vista(); d.close();
    tilkynna(samthykkt
      ? (VERKTAKI ? 'Tilboðið var samþykkt. Verkið er komið á listann.' : 'Tilboðið var samþykkt. Það sést á yfirlitinu.')
      : 'Tilboðinu var hafnað.');
    eftir();
  };
  const d = el('dialog', { class: 'pdialog vt-syn', 'aria-label': 'Tilboðið eins og viðskiptavinurinn sér það' }, [
    el('div', { class: 'pdialog__kort' }, [
      el('div', { class: 'pdialog__haus' }, [
        el('p', { class: 'vt-syn__merki', texti: 'Svona sér ' + t.kunni.split(',')[0] + ' tilboðið' }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '×', onclick: () => d.close() })]),
      el('div', { class: 'vt-syn__blad' }, [
        el('div', { class: 'vt-syn__fra' }, [
          el('span', { class: 'ps-stafur ps-stafur--stor', style: '--l: var(--acc)', 'aria-hidden': 'true', texti: NAFN.charAt(0).toUpperCase() }),
          el('div', {}, [el('strong', { texti: NAFN }), el('span', { texti: 'Tilboð, ' + dg(t.dags) })])]),
        el('h2', { class: 'vt-syn__titill', texti: t.titill }),
        el('p', { class: 'ps-smatt', texti: 'Til ' + t.kunni }),
        el('ul', { class: 'vt-lidir' }, t.linur.map((l) => el('li', {}, [el('span', { texti: l.t }), el('span', { texti: kr(+l.u || 0) })]))),
        summur(an, true),
        el('div', { class: 'vt-syn__hn' }, [
          el('button', { type: 'button', class: 'btn', texti: 'Hafna', onclick: () => svara(false) }),
          el('button', { type: 'button', class: 'btn btn--gull', texti: 'Samþykkja', onclick: () => svara(true) })])
      ]),
      el('p', { class: 'ps-smatt vt-syn__ath', texti: 'Í sýnidæminu svarar þú fyrir hönd viðskiptavinarins.' })
    ])
  ]);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  document.body.appendChild(d);
  d.showModal();
}

/* ---------------- Tilboð og verkbeiðnir ---------------- */
function siduTilbod(teikna) {
  let opid = null;   /* tilboðið sem er verið að búa til */
  const nyttTilbod = (b) => {
    opid = { id: 't' + Date.now(), kunni: b ? b.fra : '', titill: b ? b.efni : '', dags: dagar(0), stada: 'drog',
      linur: VERKTAKI ? [{ t: 'Efni', u: '' }, { t: 'Vinna', u: '' }] : [{ t: '', u: '' }], beidni: b ? b.id : null };
    syna();
  };
  const ritill = el('div');
  function syna() {
    if (!opid) { fylla(ritill, []); return; }
    const linur = el('div', { class: 'vt-linur' });
    const summuSvid = el('div');
    const uppf = () => { fylla(summuSvid, [summur(anVsk(opid))]); };
    const teiknaLinur = () => {
      fylla(linur, [
        el('div', { class: 'vt-lina vt-lina--haus', 'aria-hidden': 'true' }, [el('span', { texti: 'Liður' }), el('span', { texti: 'Upphæð án VSK' }), el('span')]),
        ...opid.linur.map((l, i) => el('div', { class: 'vt-lina' }, [
          el('input', { value: l.t, 'aria-label': 'Liður', placeholder: 'Liður', oninput: (e) => { l.t = e.target.value; } }),
          el('input', { value: l.u, inputmode: 'numeric', 'aria-label': 'Upphæð án VSK', placeholder: 'Upphæð án VSK',
            oninput: (e) => { l.u = e.target.value.replace(/[^\d]/g, ''); e.target.value = l.u; uppf(); } }),
          el('button', { type: 'button', class: 'ps-texti-hn', 'aria-label': 'Fjarlægja lið', texti: 'Taka út',
            onclick: () => { opid.linur.splice(i, 1); teiknaLinur(); uppf(); } })]))]);
    };
    teiknaLinur(); uppf();
    fylla(ritill, [el('div', { class: 'card vt-ritill' }, [
      el('h2', { texti: 'Nýtt tilboð' }),
      el('div', { class: 'vt-reitir' }, [
        el('input', { value: opid.kunni, placeholder: 'Fyrir hvern', 'aria-label': 'Viðskiptavinur', oninput: (e) => { opid.kunni = e.target.value; } }),
        el('input', { value: opid.titill, placeholder: VERKTAKI ? 'Hvað er verkið' : 'Hvað er pantað', 'aria-label': VERKTAKI ? 'Verkið' : 'Pöntunin', oninput: (e) => { opid.titill = e.target.value; } })]),
      linur,
      el('button', { type: 'button', class: 'ps-texti-hn vt-baeta', texti: '+ Bæta við lið', onclick: () => { opid.linur.push({ t: '', u: '' }); teiknaLinur(); } }),
      summuSvid,
      el('div', { class: 'vt-fot' }, [
        el('button', { type: 'button', class: 'btn', texti: 'Hætta við', onclick: () => { opid = null; syna(); } }),
        el('button', { type: 'button', class: 'btn btn--gull', texti: 'Vista tilboðið', onclick: () => {
          if (!opid.kunni.trim() || !opid.titill.trim() || !anVsk(opid)) { tilkynna('Settu inn viðskiptavin, verkið og upphæð'); return; }
          opid.stada = 'sent'; opid.linur = opid.linur.filter((l) => l.t || l.u);
          G.tilbod.unshift(opid);
          const b = G.beidnir.find((x) => x.id === opid.beidni); if (b) b.stada = 'tilbod';
          vista(); tilkynna('Tilboðið er komið á listann. Smelltu á Sjá eins og viðskiptavinur til að prófa.'); opid = null; teikna();
        } })])
    ])]);
    const fyrsti = ritill.querySelector('input'); if (fyrsti) fyrsti.focus();
  }

  /* Eftir samþykki: verktaki fer í myndirnar, lítið fyrirtæki á yfirlitið */
  const eftirSamthykki = () => (VERKTAKI
    ? (ervalid('myndir') ? el('a', { class: 'btn btn--litill', href: 'myndir.html', texti: 'Myndir úr verkinu' }) : null)
    : el('a', { class: 'btn btn--litill', href: 'fyrirtaeki.html', texti: 'Sjá á yfirlitinu' }));

  const nyjar = G.beidnir.filter((b) => b.stada === 'ny');
  return el('div', { class: 'ps' }, [
    siduHaus('Tilboð og verkbeiðnir', 'Gerðu tilboð úr beiðni. Viðskiptavinurinn samþykkir með einum smelli.',
      el('button', { type: 'button', class: 'btn btn--gull', texti: 'Nýtt tilboð', onclick: () => nyttTilbod(null) })),
    smidi(),
    ritill,
    el('section', { class: 'card ps-blokk' }, [
      el('h2', { texti: 'Verkbeiðnir' + (nyjar.length ? ' (' + nyjar.length + ' nýjar)' : '') }),
      el('p', { class: 'ps-smatt vt-undir', texti: 'Beiðnir úr forminu á vefnum þínum eða úr póstinum.' }),
      el('ul', { class: 'ps-listi' }, G.beidnir.map((b) => el('li', {}, [
        el('span', { class: 'ps-listi__t' }, [el('strong', { texti: b.efni }), el('span', { texti: b.fra + ', ' + dg(b.dags) })]),
        pill(STOD_BEID[b.stada][0], STOD_BEID[b.stada][1]),
        b.stada === 'ny' ? el('button', { type: 'button', class: 'btn btn--litill', texti: 'Gera tilboð', onclick: () => nyttTilbod(b) }) : null])))
    ]),
    el('div', { class: 'vt-tilbod' }, G.tilbod.map((t) => {
      const fot = t.stada === 'sent'
        ? el('button', { type: 'button', class: 'btn btn--litill', texti: 'Sjá eins og viðskiptavinur', onclick: () => synaKunna(t, teikna) })
        : t.stada === 'samthykkt' ? eftirSamthykki() : null;
      return el('article', { class: 'card vt-kort' }, [
        el('div', { class: 'vt-kort__haus' }, [
          el('div', {}, [el('h2', { texti: t.titill }), el('span', { class: 'ps-smatt', texti: t.kunni + ', ' + dg(t.dags) })]),
          pill(STOD_TILB[t.stada][0], STOD_TILB[t.stada][1])]),
        el('ul', { class: 'vt-lidir' }, t.linur.map((l) => el('li', {}, [el('span', { texti: l.t }), el('span', { texti: kr(+l.u || 0) })]))),
        summur(anVsk(t)),
        fot ? el('div', { class: 'vt-kort__fot' }, [fot]) : null
      ]);
    }))
  ]);
}

/* ---------------- Myndir úr verkinu ---------------- */
function lesaMynd(skra) {
  return new Promise((leysa, hafna) => {
    if (!skra || !/^image\//.test(skra.type)) { hafna(new Error('tegund')); return; }
    const fr = new FileReader();
    fr.onerror = () => hafna(new Error('lesa'));
    fr.onload = () => {
      const m = new Image();
      m.onerror = () => hafna(new Error('mynd'));
      m.onload = () => {
        const k = Math.min(1, 900 / Math.max(m.width, m.height));
        const c = document.createElement('canvas');
        c.width = Math.round(m.width * k); c.height = Math.round(m.height * k);
        c.getContext('2d').drawImage(m, 0, 0, c.width, c.height);
        leysa(c.toDataURL('image/jpeg', .78));
      };
      m.src = fr.result;
    };
    fr.readAsDataURL(skra);
  });
}
function siduMyndir(teikna) {
  const mynd = (x) => {
    const h = HVENAER[x.hvenaer] || HVENAER.fyrir;
    return el('figure', { class: 'vt-mynd' }, [
      x.src ? el('img', { src: x.src, alt: x.texti, loading: 'lazy' })
        : el('div', { class: 'vt-mynd__tom vt-mynd__tom--' + x.hvenaer, 'aria-hidden': 'true',
            html: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5"/></svg>' }),
      el('figcaption', {}, [pill(h[0], h[1]), el('span', { texti: x.texti + ', ' + dg(x.d) })])
    ]);
  };

  /* Nýtt verk: lítið form efst */
  const nyttSvid = el('div');
  const opnaNytt = () => {
    const titill = el('input', { placeholder: 'Hvað er verkið', 'aria-label': 'Verkið' });
    const kunni = el('input', { placeholder: 'Fyrir hvern', 'aria-label': 'Viðskiptavinur' });
    fylla(nyttSvid, [el('form', { class: 'card vt-ritill', onsubmit: (e) => {
      e.preventDefault();
      if (!titill.value.trim()) { tilkynna('Settu inn hvað verkið er'); titill.focus(); return; }
      G.verk.unshift({ id: 'm' + Date.now(), titill: titill.value.trim(), kunni: kunni.value.trim() || 'Viðskiptavinur', naest: 'fyrir', myndir: [] });
      vista(); tilkynna('Verkið er komið á listann'); teikna();
    } }, [
      el('h2', { texti: 'Nýtt verk' }),
      el('div', { class: 'vt-reitir' }, [titill, kunni]),
      el('div', { class: 'vt-fot' }, [
        el('button', { type: 'button', class: 'btn', texti: 'Hætta við', onclick: () => fylla(nyttSvid, []) }),
        el('button', { type: 'submit', class: 'btn btn--gull', texti: 'Búa til verkið' })])
    ])]);
    titill.focus();
  };

  return el('div', { class: 'ps' }, [
    siduHaus('Myndir úr verkinu', 'Fyrir, á meðan og eftir. Allar myndirnar á einum stað fyrir hvert verk.',
      el('button', { type: 'button', class: 'btn btn--gull', texti: 'Nýtt verk', onclick: opnaNytt })),
    smidi(),
    nyttSvid,
    ...G.verk.map((v) => {
      if (!HVENAER[v.naest]) v.naest = v.myndir.length ? 'eftir' : 'fyrir';
      const skra = el('input', { type: 'file', accept: 'image/*', class: 'vt-skra', 'aria-label': 'Velja mynd',
        onchange: async (e) => {
          const f = e.target.files && e.target.files[0]; e.target.value = '';
          if (!f) return;
          try {
            const src = await lesaMynd(f);
            v.myndir.push({ id: 'm' + Date.now(), hvenaer: v.naest, texti: 'Ný mynd', d: dagar(0), src });
            if (!vista()) { v.myndir.pop(); tilkynna('Vafrinn hefur ekki pláss fyrir fleiri myndir í sýnidæminu'); return; }
            tilkynna('Myndin er komin á verkið'); teikna();
          } catch (villa) { tilkynna('Þessi mynd gekk ekki. Prófaðu aðra.'); }
        } });
      const val = el('select', { class: 'vt-hvenaer', 'aria-label': 'Næsta mynd er',
        onchange: (e) => { v.naest = e.target.value; vista(); } },
        Object.entries(HVENAER).map(([k, h]) => el('option', { value: k, selected: v.naest === k, texti: h[0] })));
      return el('section', { class: 'card ps-blokk' }, [
        el('div', { class: 'vt-verk__haus' }, [
          el('div', {}, [el('h2', { texti: v.titill }), el('span', { class: 'ps-smatt', texti: v.kunni + ', ' + v.myndir.length + (v.myndir.length === 1 ? ' mynd' : ' myndir') })]),
          el('div', { class: 'vt-verk__hn' }, [
            el('label', { class: 'vt-hvenaer__merki' }, [el('span', { texti: 'Næsta mynd' }), val]),
            el('button', { type: 'button', class: 'btn btn--litill', texti: 'Bæta við mynd', onclick: () => skra.click() }), skra])]),
        v.myndir.length
          ? el('div', { class: 'vt-myndir' }, v.myndir.map(mynd))
          : el('p', { class: 'ps-tomt', texti: 'Engar myndir enn. Byrjaðu á mynd fyrir verkið.' })
      ]);
    }),
    el('p', { class: 'ps-smatt', texti: 'Í sýnidæminu eru myndirnar bara geymdar í þessum vafra.' })
  ]);
}

/* ---------------- Yfirlit fyrir lítil fyrirtæki ---------------- */
function siduFyrirtaeki(teikna) {
  const F = G.fy;
  const folk = (id) => F.folk.find((f) => f.id === id) || F.folk[0];
  const stafur = (f) => el('span', { class: 'ps-stafur', style: '--l:' + f.litur, 'aria-hidden': 'true', texti: f.nafn.charAt(0) });
  const folkVal = (merki) => el('select', { 'aria-label': merki }, F.folk.map((f) => el('option', { value: f.id, texti: f.nafn })));

  /* (a) Verk dagsins hjá hverjum og einum */
  const nyttVerk = el('input', { placeholder: 'Nýtt verk', 'aria-label': 'Nýtt verk' });
  const hverNytt = folkVal('Hver tekur verkið');
  const verkDagsins = el('section', { class: 'card ps-blokk' }, [
    el('h2', { texti: 'Verk dagsins' }),
    el('form', { class: 'fy-nytt', onsubmit: (e) => {
      e.preventDefault();
      const t = nyttVerk.value.trim(); if (!t) { nyttVerk.focus(); return; }
      const f = folk(hverNytt.value); f.verk.push({ id: 'n' + Date.now(), t, b: false });
      vista(); tilkynna('Verkið er komið á listann hjá ' + f.nafn); teikna();
    } }, [nyttVerk, hverNytt, el('button', { type: 'submit', class: 'btn btn--litill', texti: 'Bæta við' })]),
    el('div', { class: 'fy-folk' }, F.folk.map((f) => {
      const buin = f.verk.filter((v) => v.b).length;
      return el('div', { class: 'fy-manneskja' }, [
        el('div', { class: 'fy-manneskja__haus' }, [stafur(f),
          el('div', {}, [el('strong', { texti: f.nafn }), el('span', { texti: f.verk.length ? buin + ' af ' + f.verk.length + ' búin' : 'Ekkert í dag' })])]),
        el('ul', { class: 'fy-hak' }, f.verk.map((v) => el('li', { class: v.b ? 'er-buid' : null }, [
          el('label', {}, [
            el('input', { type: 'checkbox', checked: v.b, onchange: (e) => { v.b = e.target.checked; vista(); teikna(); } }),
            el('span', { texti: v.t })])])))
      ]);
    }))
  ]);

  /* (b) Nýtt úr póstinum: póstur viðskiptavina verður að verkum */
  const postur = ervalid('postur_verk') || ervalid('postur') ? el('section', { class: 'card ps-blokk' }, [
    el('h2', { texti: 'Nýtt úr póstinum' }),
    el('p', { class: 'ps-smatt vt-undir', texti: 'Póstur frá viðskiptavinum verður að verki. Veldu hver tekur það.' }),
    el('ul', { class: 'ps-listi' }, F.postur.map((p) => {
      const hja = p.hja && F.folk.find((f) => f.id === p.hja);
      const val = hja ? null : folkVal('Hver tekur verkið');
      return el('li', { class: 'fy-postur' }, [
        el('span', { class: 'ps-listi__t' }, [el('strong', { texti: p.verk }), el('span', { texti: p.fra + ': ' + p.efni })]),
        hja ? pill('Á lista hjá ' + hja.nafn, 'graen') : el('span', { class: 'fy-postur__hn' }, [val,
          el('button', { type: 'button', class: 'btn btn--litill', texti: 'Setja á lista', onclick: () => {
            const f = folk(val.value); p.hja = f.id; f.verk.push({ id: 'p' + Date.now(), t: p.verk, b: false });
            vista(); tilkynna('Verkið er komið á listann hjá ' + f.nafn); teikna();
          } })])
      ]);
    }))
  ]) : null;

  /* (c) Tilboð og pantanir */
  const medTilbod = ervalid('tilbod');
  const bida = G.tilbod.filter((t) => t.stada === 'sent');
  const samth = G.tilbod.filter((t) => t.stada === 'samthykkt' && iThessumMan(t.sam || t.dags));
  const STOD_PANT = { stadfest: ['Staðfest', 'blar'], afhent: ['Afhent', 'graen'] };
  const tilbodOgPant = el('section', { class: 'card ps-blokk' }, [
    el('h2', { texti: medTilbod ? 'Tilboð og pantanir' : 'Pantanir' }),
    medTilbod ? el('div', { class: 'ps-tolur fy-tolur' }, [
      el('div', {}, [el('span', { texti: 'Tilboð bíða svars' }), el('strong', { texti: String(bida.length) })]),
      el('div', {}, [el('span', { texti: 'Samþykkt í ' + MAN_LANGT[IDAG.getMonth()] }), el('strong', { texti: String(samth.length) })]),
      el('div', {}, [el('span', { texti: 'Pantanir' }), el('strong', { texti: String(F.pantanir.length) })])]) : null,
    el('ul', { class: 'ps-listi' }, [
      ...(medTilbod ? bida.map((t) => el('li', {}, [
        el('span', { class: 'ps-listi__t' }, [el('strong', { texti: t.titill }), el('span', { texti: 'Tilboð til ' + t.kunni + ', ' + kr(anVsk(t)) + ' án VSK' })]),
        pill('Bíður svars', 'gul')])) : []),
      ...F.pantanir.map((o) => el('li', {}, [
        el('span', { class: 'ps-listi__t' }, [el('strong', { texti: o.efni }), el('span', { texti: o.kunni + ', ' + dg(o.dags) })]),
        pill(STOD_PANT[o.stada][0], STOD_PANT[o.stada][1])]))]),
    medTilbod ? el('a', { class: 'btn btn--litill ps-blokk__hn', href: 'tilbod.html', texti: 'Opna tilboðin' }) : null
  ]);

  /* (d) Tekjur: bara pantanir, tilboð og samningar, ekki kassinn */
  let tekjur = null;
  if (ervalid('tekjur')) {
    const pant = F.pantanir.filter((o) => iThessumMan(o.dags)).reduce((n, o) => n + o.upph, 0);
    const tilb = samth.reduce((n, t) => n + anVsk(t), 0);
    const samn = F.samningar.reduce((n, s) => n + s.upph, 0);
    tekjur = el('section', { class: 'card ps-blokk' }, [
      el('h2', { texti: 'Tekjur í ' + MAN_LANGT[IDAG.getMonth()] }),
      el('div', { class: 'ps-tolur fy-tolur' }, [
        el('div', {}, [el('span', { texti: 'Pantanir' }), el('strong', { texti: kr(pant) })]),
        el('div', {}, [el('span', { texti: 'Samþykkt tilboð' }), el('strong', { texti: kr(tilb) })]),
        el('div', {}, [el('span', { texti: 'Samningar' }), el('strong', { texti: kr(samn) })])]),
      el('p', { class: 'fy-samtals' }, [el('span', { texti: 'Samtals án VSK' }), el('strong', { texti: kr(pant + tilb + samn) })]),
      el('p', { class: 'ps-smatt', texti: 'Sala í kassa er ekki með. Hér eru pantanir, tilboð og samningar.' })
    ]);
  }

  const opin = F.folk.reduce((n, f) => n + f.verk.filter((v) => !v.b).length, 0);
  const rod = postur
    ? [el('div', { class: 'ps-tvo' }, [postur, tilbodOgPant]), tekjur]
    : tekjur ? [el('div', { class: 'ps-tvo' }, [tilbodOgPant, tekjur])] : [tilbodOgPant];
  return el('div', { class: 'ps' }, [
    siduHaus('Yfirlit', opin ? opin + (opin === 1 ? ' verk er eftir í dag.' : ' verk eru eftir í dag.') : 'Öll verk dagsins eru búin.'),
    smidi(),
    verkDagsins,
    ...rod
  ]);
}

function byrja() {
  const heiti = SIDA === 'myndir' ? 'Myndir' : SIDA === 'fyrirtaeki' ? 'Yfirlit' : 'Tilboð';
  teiknaHaus(ek, heiti);
  const svid = document.getElementById('innihald');
  const sida = SIDA === 'myndir' ? siduMyndir : SIDA === 'fyrirtaeki' ? siduFyrirtaeki : siduTilbod;
  const teikna = () => fylla(svid, sida(teikna));
  teikna();
}

/* Ræsing: neðst, svo öll gögn og föll séu til. Rangur hópur fer annað. */
const annad = rettSida();
const ek = annad ? null : await vardaHlid({ krefstAdmin: true });
if (annad) location.replace(annad + location.search);
else if (ek) byrja();
