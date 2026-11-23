/* ==========================================================================
   Glerhúsið: verslun
   Pantanir, vörur og lagerstaða úr Shopify verslun stofunnar. Bara lestur:
   Edge Function shopify les lyklana úr Vault og ekkert er skrifað í
   verslunina. Bara stjórnendur.
   ========================================================================== */

import { gogn, el, fylla, dags, kronur, tolu, erEnska, vardaHlid, teiknaHaus } from './portal.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

const FLIPAR = [['pantanir', 'Pantanir'], ['vorur', 'Vörur'], ['lager', 'Lager']];

/* Staða greiðslu og afgreiðslu eins og Shopify skilar henni */
const GREIDSLA = {
  PAID: ['ok', 'Greitt'], PENDING: ['bid', 'Bíður greiðslu'], AUTHORIZED: ['vinnsla', 'Heimilað'],
  PARTIALLY_PAID: ['bid', 'Greitt að hluta'], PARTIALLY_REFUNDED: ['hafnad', 'Endurgreitt að hluta'],
  REFUNDED: ['hafnad', 'Endurgreitt'], VOIDED: ['hafnad', 'Ógilt'], EXPIRED: ['hafnad', 'Útrunnið']
};
const AFGREIDSLA = {
  FULFILLED: ['ok', 'Afgreitt'], UNFULFILLED: ['bid', 'Óafgreitt'], PARTIALLY_FULFILLED: ['vinnsla', 'Afgreitt að hluta'],
  IN_PROGRESS: ['vinnsla', 'Í vinnslu'], ON_HOLD: ['bid', 'Í bið'], SCHEDULED: ['nytt', 'Á áætlun'], OPEN: ['nytt', 'Opið'],
  PENDING_FULFILLMENT: ['bid', 'Bíður afgreiðslu'], RESTOCKED: ['hafnad', 'Skilað á lager'], REQUEST_DECLINED: ['hafnad', 'Hafnað']
};
const VORUSTADA = { ACTIVE: ['ok', 'Virk'], DRAFT: ['nytt', 'Drög'], ARCHIVED: ['hafnad', 'Í geymslu'], UNLISTED: ['nytt', 'Falin'] };

const httpsSlod = (s) => (/^https:\/\/\S+$/.test(String(s || '')) ? s : null);
function pillaUr(tafla, gildi) {
  if (!gildi) return null;
  const [litur, heiti] = tafla[gildi] || ['nytt', String(gildi).toLowerCase().replace(/_/g, ' ')];
  return el('span', { class: 'pstat pstat--' + litur, texti: heiti });
}

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Verslun');
  const innihald = document.getElementById('innihald');

  const fraSlod = location.hash.slice(1);
  let flipi = FLIPAR.some(([k]) => k === fraSlod) ? fraSlod : 'pantanir';
  let baraLitid = false;
  let hamark = 5;
  let gjaldmidill = 'ISK';

  /* Það sem er komið, á hvern flipa: { listi, meira, eftir, villa, hlada } */
  const flipaGogn = {};
  let yfirlit = null;
  let yfirlitVilla = null;

  const yfirlitSvid = el('div');
  const flipaSvid = el('div', { class: 'pflipar', role: 'group', 'aria-label': 'Sýna' });
  const listiSvid = el('div', { 'aria-live': 'polite' });

  /* Upphæð í gjaldmiðli verslunarinnar. Krónur fylgja vali kerfisins. */
  function upphaed(tala, mynt) {
    const m = mynt || gjaldmidill || 'ISK';
    if (tala === null || tala === undefined || !isFinite(Number(tala))) return '';
    if (m === 'ISK') return kronur(Math.round(Number(tala))) || kronur(0);
    const n = Number(tala);
    const heilt = tolu(Math.trunc(n));
    const aurar = Math.round(Math.abs(n % 1) * 100);
    return heilt + (aurar ? (erEnska() ? '.' : ',') + String(aurar).padStart(2, '0') : '') + ' ' + m;
  }

  /* Er Shopify tengt? Í sýnidæminu er alltaf sýnd sýniverslun. */
  async function erTengt() {
    if (g.prufa) return true;
    try {
      const t = g.tengingarStada ? await g.tengingarStada() : null;
      return t === null ? true : !!t.shopify;
    } catch (e) { return true; }
  }

  fylla(innihald, [
    el('div', { class: 'page-head', style: 'padding-top:0' }, [
      el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Verslun' }),
      el('p', { class: 'lead', texti: 'Pantanir, vörur og lager úr Shopify. Hér er bara lesið, engu er breytt í versluninni.' })
    ]),
    yfirlitSvid,
    el('section', { class: 'card pblokk', style: 'margin-top:clamp(16px,2vw,22px)' }, [flipaSvid, listiSvid]),
    g.prufa ? el('div', { class: 'prufubanner', style: 'margin-top:14px' }, [
      el('strong', { texti: 'Sýnidæmi. ' }),
      document.createTextNode('Þetta er tilbúin verslun. Ekkert er sótt í Shopify.')
    ]) : null
  ]);

  if (!(await erTengt())) {
    fylla(yfirlitSvid, []);
    fylla(flipaSvid, []);
    fylla(listiSvid, [el('div', { style: 'text-align:center; padding:18px 6px' }, [
      el('p', { class: 'lead', style: 'font-size:15.5px', texti: 'Shopify er ekki tengt ennþá. Tengdu verslunina í Stillingum og þá birtast pantanir, vörur og lager hér.' }),
      el('a', { class: 'btn btn--sm', style: 'margin-top:16px', href: 'stillingar.html', texti: 'Opna Stillingar' })
    ])]);
    return;
  }

  try {
    const ks = g.kerfisstillingar ? await g.kerfisstillingar() : null;
    const h = ks && /^[0-9]{1,4}$/.test(String(ks.lager_vidvorun || '')) ? Number(ks.lager_vidvorun) : null;
    if (h !== null) hamark = h;
  } catch (e) { /* sjálfgefið 5 */ }

  /* Sala síðustu 30 daga */
  async function hladaYfirliti() {
    fylla(yfirlitSvid, [el('p', { class: 'skyring', texti: 'Sæki stöðuna úr Shopify' })]);
    try {
      yfirlit = await g.shopify('yfirlit');
      yfirlitVilla = null;
      if (yfirlit && yfirlit.gjaldmidill) gjaldmidill = yfirlit.gjaldmidill;
    } catch (villa) {
      yfirlit = null; yfirlitVilla = villa;
    }
    teiknaYfirlit();
    /* Verð varanna er í gjaldmiðli verslunarinnar, sem kemur með yfirlitinu */
    if (flipaGogn[flipi] && flipaGogn[flipi].buid) teiknaLista();
  }

  function teiknaYfirlit() {
    if (yfirlitVilla) {
      fylla(yfirlitSvid, [el('p', { class: 'skyring', style: 'margin:4px 0 0' }, [
        document.createTextNode('Salan síðustu 30 daga kom ekki: ' + (yfirlitVilla.message || 'villa') + ' '),
        el('button', { type: 'button', class: 'sk-tengill', texti: 'Reyna aftur', onclick: hladaYfirliti })
      ])]);
      return;
    }
    if (!yfirlit) { fylla(yfirlitSvid, []); return; }
    const y = yfirlit;
    fylla(yfirlitSvid, [
      el('dl', { class: 'tekjur', style: 'margin-top:4px' }, [
        el('div', { class: 'adal' }, [
          el('dt', { texti: 'Sala síðustu 30 daga' }),
          el('dd', { texti: upphaed(y.samtals30, y.gjaldmidill) })
        ]),
        el('div', {}, [
          el('dt', { texti: 'Pantanir síðustu 30 daga' }),
          el('dd', { texti: String(Number(y.fjoldi30) || 0) })
        ]),
        el('div', {}, [
          el('dt', { texti: 'Verslunin' }),
          el('dd', { style: 'font-size:clamp(18px,16px+.6vw,22px)', texti: y.nafn || y.verslun || 'Shopify' })
        ])
      ]),
      el('p', { class: 'skyring', style: 'margin-top:10px', texti: (y.fra ? 'Frá ' + dags(y.fra, true) + '. ' : '')
        + 'Afpantanir teljast ekki með.'
        + (y.takmarkad ? ' Shopify skilaði ekki öllum pöntunum tímabilsins, svo talan gæti verið hærri.' : '') })
    ]);
  }

  /* Flipar og listar */
  function teiknaFlipa() {
    fylla(flipaSvid, FLIPAR.map(([k, heiti]) => el('button', {
      type: 'button', class: 'pflipi', 'aria-pressed': String(flipi === k), texti: heiti,
      onclick: () => {
        if (flipi === k) return;
        flipi = k;
        history.replaceState(null, '', '#' + k);
        teiknaFlipa();
        synaFlipa();
      }
    })));
  }

  function synaFlipa() {
    const f = flipaGogn[flipi];
    if (!f) { hladaFlipa(flipi); return; }
    teiknaLista();
  }

  async function hladaFlipa(verk, framhald) {
    const f = flipaGogn[verk] || (flipaGogn[verk] = { listi: [], meira: false, eftir: null, villa: null, hledst: false, buid: false });
    if (f.hledst) return;
    f.hledst = true; f.villa = null;
    if (verk === flipi) teiknaLista();
    try {
      const svar = await g.shopify(verk, framhald ? f.eftir : undefined);
      const nyjar = verk === 'pantanir' ? (svar.pantanir || []) : (svar.vorur || []);
      f.listi = framhald ? f.listi.concat(nyjar) : nyjar;
      f.meira = !!svar.meira;
      f.eftir = svar.eftir || null;
      if (verk === 'lager' && isFinite(Number(svar.hamark))) hamark = Number(svar.hamark);
      f.buid = true;
    } catch (villa) {
      f.villa = villa;
      /* Fyrsta síðan kom ekki: ekkert til að sýna nema villuna */
      if (!framhald) f.buid = false;
    }
    f.hledst = false;
    if (verk === flipi) teiknaLista();
  }

  function teiknaLista() {
    const f = flipaGogn[flipi];
    if (!f || (f.hledst && !f.listi.length)) {
      fylla(listiSvid, [el('p', { class: 'tomt', texti: 'Sæki gögnin úr Shopify' })]);
      return;
    }
    if (f.villa && !f.listi.length) {
      fylla(listiSvid, [villuSpjald(f.villa, () => hladaFlipa(flipi))]);
      return;
    }

    const born = [];
    if (flipi === 'pantanir') born.push(...pantanaListi(f.listi));
    else born.push(...voruListi(f.listi, flipi === 'lager'));

    /* Næsta síða, eða villa á henni: það sem komið er stendur */
    if (f.villa) {
      born.push(el('p', { class: 'form-status form-status--err', role: 'alert', style: 'margin-top:14px',
        texti: (f.villa.message || 'Þetta gekk ekki.') + ' Það sem komið er stendur.' }));
    }
    if (f.meira) {
      born.push(el('div', { style: 'margin-top:16px; text-align:center' }, [
        el('button', { type: 'button', class: 'btn btn--sm btn--ghost', disabled: f.hledst || null,
          texti: f.hledst ? 'Sæki' : f.villa ? 'Reyna aftur' : 'Sækja meira',
          onclick: () => hladaFlipa(flipi, true) })
      ]));
    }
    fylla(listiSvid, born);
  }

  /* Listarnir eru í sama formi og verkin, svo þeir virki líka í síma */
  const titill = (texti, slod) => (slod
    ? el('a', { class: 'task__titill', href: slod, target: '_blank', rel: 'noopener noreferrer', texti })
    : el('span', { class: 'task__titill', style: 'cursor:default', texti }));

  function pantanaListi(pantanir) {
    if (!pantanir.length) return [el('p', { class: 'tomt', texti: 'Engar pantanir ennþá.' })];
    return [el('ul', { class: 'tasklisti' }, pantanir.map((p) => {
      const linur = (p.linur || []).map((l) => (Number(l.magn) > 1 ? l.magn + ' × ' : '') + l.titill).join(', ');
      return el('li', {}, [el('div', { class: 'task' }, [
        el('div', { class: 'task__mid' }, [
          titill(p.nafn || 'Pöntun', httpsSlod(p.slod)),
          el('div', { class: 'task__undir' }, [
            el('span', { texti: dags(p.stofnad) }),
            linur ? el('span', { texti: linur }) : null
          ])
        ]),
        el('div', { class: 'task__hofn' }, [
          el('span', { class: 'bok__upph', texti: upphaed(p.upphaed, p.gjaldmidill) }),
          pillaUr(GREIDSLA, p.greidsla),
          pillaUr(AFGREIDSLA, p.afgreidsla)
        ])
      ])]);
    }))];
  }

  function voruListi(vorur, lager) {
    const litid = (v) => v.birgdir !== null && v.birgdir !== undefined && Number(v.birgdir) <= hamark;
    const syndar = !lager && baraLitid ? vorur.filter(litid) : vorur;
    const ut = [];
    if (lager) {
      ut.push(el('p', { class: 'skyring', style: 'margin:-6px 0 12px',
        texti: 'Virkar vörur með ' + hamark + ' stykki eða færri á lager, fæst fyrst.' }));
    } else {
      ut.push(el('div', { class: 'pflipar', style: 'margin:-4px 0 12px' }, [
        el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(!baraLitid), texti: 'Allar',
          onclick: () => { baraLitid = false; teiknaLista(); } }),
        el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(baraLitid),
          onclick: () => { baraLitid = true; teiknaLista(); } },
          [document.createTextNode('Lítil birgð '), el('b', { texti: String(vorur.filter(litid).length) })])
      ]));
    }
    if (!syndar.length) {
      ut.push(el('p', { class: 'tomt', texti: lager ? 'Engin vara er undir mörkunum.'
        : baraLitid ? 'Engin af vörunum sem komnar eru er með litla birgð.' : 'Engar vörur í versluninni.' }));
      return ut;
    }
    ut.push(el('ul', { class: 'tasklisti' }, syndar.map((v) => {
      const mynd = httpsSlod(v.mynd);
      const verd = (v.afbrigdi || []).map((a) => Number(a.verd)).filter((x) => isFinite(x));
      const minnst = verd.length ? Math.min(...verd) : null, mest = verd.length ? Math.max(...verd) : null;
      const afbrigdi = (v.afbrigdi || []).length;
      const stada = VORUSTADA[v.stada];
      return el('li', {}, [el('div', { class: 'task' }, [
        mynd ? el('img', { src: mynd, alt: '', width: '40', height: '40', loading: 'lazy', referrerpolicy: 'no-referrer',
          style: 'width:40px; height:40px; object-fit:cover; border-radius:10px; flex:none' }) : null,
        el('div', { class: 'task__mid' }, [
          titill(v.titill || 'Vara', httpsSlod(v.slod)),
          el('div', { class: 'task__undir' }, [
            minnst === null ? null : el('span', { texti: minnst === mest ? upphaed(minnst) : upphaed(minnst) + ' til ' + upphaed(mest) }),
            afbrigdi > 1 ? el('span', { texti: afbrigdi + ' afbrigði' }) : null,
            stada && v.stada !== 'ACTIVE' ? el('span', { texti: stada[1] }) : null
          ])
        ]),
        el('div', { class: 'task__hofn' }, [
          el('span', { class: 'bok__upph', texti: v.birgdir === null || v.birgdir === undefined ? 'Ekki talið' : v.birgdir + ' á lager' }),
          litid(v) ? el('span', { class: 'pstat pstat--bid', texti: Number(v.birgdir) <= 0 ? 'Uppselt' : 'Lítil birgð' }) : null
        ])
      ])]);
    })));
    return ut;
  }

  /* Villa frá Shopify fallinu: texti, og leið til að laga eða reyna aftur */
  function villuSpjald(villa, aftur) {
    const kodi = villa && villa.kodi;
    const iStillingum = ['ekki_tengt', 'adgangur', 'pantanir', 'vorur', 'shop_not_permitted'].includes(kodi);
    return el('div', { style: 'text-align:center; padding:22px 6px' }, [
      el('p', { class: 'lead', style: 'font-size:15.5px', texti: (villa && villa.message) || 'Náði ekki sambandi við Shopify.' }),
      el('div', { class: 'tf-hnappar', style: 'justify-content:center; margin-top:14px' }, [
        iStillingum ? el('a', { class: 'btn btn--sm', href: 'stillingar.html', texti: 'Opna Stillingar' }) : null,
        kodi === 'ekki_tengt' ? null : el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Reyna aftur', onclick: aftur })
      ])
    ]);
  }

  teiknaFlipa();
  await Promise.all([hladaYfirliti(), hladaFlipa(flipi)]);
}
