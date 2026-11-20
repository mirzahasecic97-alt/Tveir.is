/* ==========================================================================
   Glerhúsið fyrir verktaka og lítil fyrirtæki (sýnidæmi)

   Tvær síður: Tilboð og verkbeiðnir (tilbod.html) og Myndir úr verkinu
   (myndir.html). Síðan er lesin úr slóðinni. Gögnin eru sýnidæmi í
   vafranum (localStorage), dagsetningar reiknaðar frá deginum í dag.
   Myndir sem eru settar inn eru minnkaðar og geymdar bara í þessum vafra.
   ========================================================================== */

import { el, fylla, vardaHlid, teiknaHaus, tilkynna, sersnid } from './portal.js';

const LYKILL = 'glerhusid-verktaki-v1';
const IDAG = new Date(); IDAG.setHours(12, 0, 0, 0);
const dagar = (n) => { const d = new Date(IDAG); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const MAN = ['jan.', 'feb.', 'mars', 'apr.', 'maí', 'jún.', 'júl.', 'ágú.', 'sep.', 'okt.', 'nóv.', 'des.'];
const dg = (s) => { const d = new Date(s + 'T12:00:00'); return d.getDate() + '. ' + MAN[d.getMonth()]; };
const kr = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' kr.';
const VERKTAKI = !!sersnid && sersnid.grein === 'verktaki';

function nyGogn() {
  const beidnir = [
    { id: 'v1', fra: 'Helga, Hlíðarvegur 12', efni: VERKTAKI ? 'Skipta um þakrennur og laga niðurfall' : 'Veisla fyrir 40 manns í desember', dags: dagar(-1), stada: 'ny' },
    { id: 'v2', fra: 'Húsfélagið Lindargötu 5', efni: VERKTAKI ? 'Mála stigaganginn, þrjár hæðir' : 'Jólagjafir fyrir starfsfólkið', dags: dagar(-3), stada: 'ny' },
    { id: 'v3', fra: 'Bjarni, Sumarbústaður í Grímsnesi', efni: VERKTAKI ? 'Nýr pallur, um 30 fermetrar' : 'Áskrift að vörum í hverjum mánuði', dags: dagar(-6), stada: 'tilbod' }
  ];
  const tilbod = VERKTAKI ? [
    { id: 't1', kunni: 'Bjarni, Sumarbústaður í Grímsnesi', titill: 'Nýr pallur', dags: dagar(-4), stada: 'sent',
      linur: [{ t: 'Efni, gagnvarið timbur', u: 480000 }, { t: 'Vinna, 3 dagar', u: 540000 }, { t: 'Akstur', u: 35000 }] },
    { id: 't2', kunni: 'Sigrún, Ásgarður 4', titill: 'Laga þakið eftir storminn', dags: dagar(-12), stada: 'samthykkt',
      linur: [{ t: 'Þakplötur og festingar', u: 210000 }, { t: 'Vinna, 2 dagar', u: 360000 }] },
    { id: 't3', kunni: 'Kaffihúsið Hornið', titill: 'Nýr bar og hillur', dags: dagar(-20), stada: 'hafnad',
      linur: [{ t: 'Smíði og efni', u: 1250000 }] }
  ] : [
    { id: 't1', kunni: 'Bjarni, Grímsnesi', titill: 'Vörur í áskrift', dags: dagar(-4), stada: 'sent',
      linur: [{ t: 'Pakki á mánuði', u: 24000 }, { t: 'Sending', u: 2500 }] },
    { id: 't2', kunni: 'Fyrirtækið Skjól', titill: 'Jólagjafir, 25 pakkar', dags: dagar(-10), stada: 'samthykkt',
      linur: [{ t: 'Gjafapakkar', u: 225000 }, { t: 'Merkt kort', u: 15000 }] }
  ];
  const verk = [
    { id: 'm1', titill: VERKTAKI ? 'Þakið í Ásgarði 4' : 'Jólagluggi verslunarinnar', kunni: VERKTAKI ? 'Sigrún' : 'Verslunin', myndir: [
      { id: 'a', hvenaer: 'fyrir', texti: VERKTAKI ? 'Skemmdin eftir storminn' : 'Glugginn áður', d: dagar(-9) },
      { id: 'b', hvenaer: 'eftir', texti: VERKTAKI ? 'Nýjar plötur komnar á' : 'Jólaglugginn tilbúinn', d: dagar(-2) }] },
    { id: 'm2', titill: VERKTAKI ? 'Pallurinn í Grímsnesi' : 'Nýja vörulínan', kunni: 'Bjarni', myndir: [
      { id: 'a', hvenaer: 'fyrir', texti: VERKTAKI ? 'Svæðið áður en byrjað er' : 'Vörurnar fyrir myndatöku', d: dagar(-1) }] }
  ];
  return { beidnir, tilbod, verk };
}
let G;
try { G = JSON.parse(localStorage.getItem(LYKILL) || 'null'); } catch (e) { G = null; }
if (!G || !G.tilbod) G = nyGogn();
const vista = () => { try { localStorage.setItem(LYKILL, JSON.stringify(G)); return true; } catch (e) { return false; } };

const pill = (texti, litur) => el('span', { class: 'ps-pilla ps-pilla--' + litur, texti });
const STOD_TILB = { drog: ['Drög', 'grar'], sent: ['Sent, bíður svars', 'gul'], samthykkt: ['Samþykkt', 'graen'], hafnad: ['Hafnað', 'grar'] };
const STOD_BEID = { ny: ['Ný', 'blar'], tilbod: ['Tilboð sent', 'gul'], hafnad: ['Hafnað', 'grar'] };
const samtals = (t) => t.linur.reduce((n, l) => n + (+l.u || 0), 0);
const siduHaus = (h1, lysing, auka) => el('div', { class: 'ps-haus' }, [
  el('div', {}, [el('h1', { texti: h1 }), lysing ? el('p', { class: 'ps-lysing', texti: lysing }) : null]), auka || null]);

/* ---------------- Tilboð og verkbeiðnir ---------------- */
function siduTilbod(teikna) {
  let opid = null;   /* tilboðið sem er verið að búa til */
  const nyttTilbod = (b) => {
    opid = { id: 't' + Date.now(), kunni: b ? b.fra : '', titill: b ? b.efni : '', dags: dagar(0), stada: 'drog', linur: [{ t: 'Efni', u: '' }, { t: 'Vinna', u: '' }], beidni: b ? b.id : null };
    syna();
  };
  const ritill = el('div');
  function syna() {
    if (!opid) { fylla(ritill, []); return; }
    const linur = el('div', { class: 'vt-linur' });
    const summa = el('strong', { class: 'vt-summa' });
    const uppf = () => { summa.textContent = 'Samtals ' + kr(samtals(opid)) + ' með VSK'; };
    const teiknaLinur = () => {
      fylla(linur, opid.linur.map((l, i) => el('div', { class: 'vt-lina' }, [
        el('input', { value: l.t, 'aria-label': 'Liður', placeholder: 'Liður', oninput: (e) => { l.t = e.target.value; } }),
        el('input', { value: l.u, inputmode: 'numeric', 'aria-label': 'Upphæð', placeholder: 'Upphæð',
          oninput: (e) => { l.u = e.target.value.replace(/[^\d]/g, ''); e.target.value = l.u; uppf(); } }),
        el('button', { type: 'button', class: 'ps-texti-hn', 'aria-label': 'Fjarlægja lið', texti: 'Taka út',
          onclick: () => { opid.linur.splice(i, 1); teiknaLinur(); uppf(); } })])));
    };
    teiknaLinur(); uppf();
    fylla(ritill, [el('div', { class: 'card vt-ritill' }, [
      el('h2', { texti: 'Nýtt tilboð' }),
      el('div', { class: 'vt-reitir' }, [
        el('input', { value: opid.kunni, placeholder: 'Fyrir hvern', 'aria-label': 'Viðskiptavinur', oninput: (e) => { opid.kunni = e.target.value; } }),
        el('input', { value: opid.titill, placeholder: 'Hvað er verkið', 'aria-label': 'Verkið', oninput: (e) => { opid.titill = e.target.value; } })]),
      linur,
      el('button', { type: 'button', class: 'ps-texti-hn', texti: '+ Bæta við lið', onclick: () => { opid.linur.push({ t: '', u: '' }); teiknaLinur(); } }),
      el('div', { class: 'vt-fot' }, [summa,
        el('button', { type: 'button', class: 'btn', texti: 'Hætta við', onclick: () => { opid = null; syna(); } }),
        el('button', { type: 'button', class: 'btn btn--gull', texti: 'Senda tilboðið', onclick: () => {
          if (!opid.kunni.trim() || !opid.titill.trim() || !samtals(opid)) { tilkynna('Settu inn viðskiptavin, verkið og upphæð'); return; }
          opid.stada = 'sent'; opid.linur = opid.linur.filter((l) => l.t || l.u);
          G.tilbod.unshift(opid);
          const b = G.beidnir.find((x) => x.id === opid.beidni); if (b) b.stada = 'tilbod';
          vista(); tilkynna(opid.kunni + ' fær tilboðið með hnappi til að samþykkja'); opid = null; teikna();
        } })])
    ])]);
    const fyrsti = ritill.querySelector('input'); if (fyrsti) fyrsti.focus();
  }

  const nyjar = G.beidnir.filter((b) => b.stada === 'ny');
  return el('div', { class: 'ps' }, [
    siduHaus('Tilboð og verkbeiðnir', 'Beiðnir af vefnum verða að tilboðum. Viðskiptavinurinn samþykkir með einum smelli.',
      el('button', { type: 'button', class: 'btn btn--gull', texti: 'Nýtt tilboð', onclick: () => nyttTilbod(null) })),
    ritill,
    el('section', { class: 'card ps-blokk' }, [
      el('h2', { texti: 'Verkbeiðnir' + (nyjar.length ? ' (' + nyjar.length + ' nýjar)' : '') }),
      el('ul', { class: 'ps-listi' }, G.beidnir.map((b) => el('li', {}, [
        el('span', { class: 'ps-listi__t' }, [el('strong', { texti: b.efni }), el('span', { texti: b.fra + ', ' + dg(b.dags) })]),
        pill(STOD_BEID[b.stada][0], STOD_BEID[b.stada][1]),
        b.stada === 'ny' ? el('button', { type: 'button', class: 'btn btn--litill', texti: 'Gera tilboð', onclick: () => nyttTilbod(b) }) : null]))),
      el('p', { class: 'ps-smatt', texti: 'Formið á vefnum þínum sendir beiðnirnar beint hingað.' })
    ]),
    el('div', { class: 'vt-tilbod' }, G.tilbod.map((t) => el('article', { class: 'card vt-kort' }, [
      el('div', { class: 'vt-kort__haus' }, [
        el('div', {}, [el('h2', { texti: t.titill }), el('span', { class: 'ps-smatt', texti: t.kunni + ', ' + dg(t.dags) })]),
        pill(STOD_TILB[t.stada][0], STOD_TILB[t.stada][1])]),
      el('ul', { class: 'vt-lidir' }, t.linur.map((l) => el('li', {}, [el('span', { texti: l.t }), el('span', { texti: kr(+l.u || 0) })]))),
      el('div', { class: 'vt-kort__fot' }, [el('strong', { texti: kr(samtals(t)) }),
        t.stada === 'sent' ? el('button', { type: 'button', class: 'btn btn--litill', texti: 'Sjá eins og viðskiptavinur',
          onclick: () => {
            if (confirm(t.kunni + ' sér tilboðið og hnapp til að samþykkja. Samþykkja fyrir hönd viðskiptavinarins í sýnidæminu?')) {
              t.stada = 'samthykkt'; vista(); tilkynna('Tilboðið var samþykkt. Verkið er komið á listann.'); teikna();
            }
          } }) : null,
        t.stada === 'samthykkt' ? el('a', { class: 'btn btn--litill', href: 'myndir.html', texti: 'Myndir úr verkinu' }) : null])
    ])))
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
  const mynd = (v, x) => el('figure', { class: 'vt-mynd' }, [
    x.src ? el('img', { src: x.src, alt: x.texti, loading: 'lazy' })
      : el('div', { class: 'vt-mynd__tom vt-mynd__tom--' + x.hvenaer, 'aria-hidden': 'true',
          html: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5"/></svg>' }),
    el('figcaption', {}, [pill(x.hvenaer === 'fyrir' ? 'Fyrir' : 'Eftir', x.hvenaer === 'fyrir' ? 'grar' : 'graen'), el('span', { texti: x.texti + ', ' + dg(x.d) })])
  ]);
  return el('div', { class: 'ps' }, [
    siduHaus('Myndir úr verkinu', 'Fyrir og eftir, beint úr símanum. Viðskiptavinurinn sér þær á verkinu.'),
    ...G.verk.map((v) => {
      const skra = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'vt-skra', 'aria-label': 'Taka eða velja mynd',
        onchange: async (e) => {
          const f = e.target.files && e.target.files[0]; e.target.value = '';
          try {
            const src = await lesaMynd(f);
            v.myndir.push({ id: 'm' + Date.now(), hvenaer: v.myndir.some((m) => m.hvenaer === 'eftir') || v.myndir.length ? 'eftir' : 'fyrir', texti: 'Ný mynd', d: dagar(0), src });
            if (!vista()) { v.myndir.pop(); tilkynna('Vafrinn hefur ekki pláss fyrir fleiri myndir í sýnidæminu'); return; }
            tilkynna('Myndin er komin á verkið'); teikna();
          } catch (villa) { tilkynna('Þessi mynd gekk ekki. Prófaðu aðra.'); }
        } });
      return el('section', { class: 'card ps-blokk' }, [
        el('div', { class: 'vt-verk__haus' }, [
          el('div', {}, [el('h2', { texti: v.titill }), el('span', { class: 'ps-smatt', texti: v.kunni + ', ' + v.myndir.length + (v.myndir.length === 1 ? ' mynd' : ' myndir') })]),
          el('button', { type: 'button', class: 'btn btn--litill', texti: 'Taka mynd', onclick: () => skra.click() }), skra]),
        el('div', { class: 'vt-myndir' }, v.myndir.map((x) => mynd(v, x)))
      ]);
    }),
    el('p', { class: 'ps-smatt', texti: 'Í sýnidæminu eru myndirnar bara geymdar í þessum vafra.' })
  ]);
}

function byrja() {
  const sida = (location.pathname.split('/').pop() || 'tilbod.html').replace('.html', '');
  teiknaHaus(ek, sida === 'myndir' ? 'Myndir' : 'Tilboð');
  const svid = document.getElementById('innihald');
  const teikna = () => fylla(svid, sida === 'myndir' ? siduMyndir(teikna) : siduTilbod(teikna));
  teikna();
}

/* Ræsing: neðst, svo öll gögn og föll séu til */
const ek = await vardaHlid({ krefstAdmin: true });
if (ek) byrja();
