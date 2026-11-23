/* ==========================================================================
   Glerhúsið: bókhald
   Sama og gamla Yfirlit síðan: samningar, aukaverkefni og taxtar, með
   súluriti yfir tekjur eftir mánuðum. Vinna í mánuði greiðist 1. dag
   næsta mánaðar, svo nóvembervinna greiðist í desember.

   Upphæðir eru geymdar án VSK nema færslan sé merkt vsklaus, þá er talan
   endanleg og rofinn má ekki bæta 24% ofan á hana. Því fer allur
   reikningur fram í pari: [VSK-skylt, VSK-laust].
   ========================================================================== */

import { gogn, el, fylla, kronur, tolu, erEnska, lesaTolu, vardaHlid, teiknaHaus, geymt, geyma, bokhaldskerfi, tilkynna, setjaUpphaed, lesaUpphaed, snyrtaUpphaed, umreikna, virkurGjaldmidill, synaGjaldmidil, syntTala, upphaedInntak, sidan } from './portal.js';
import {
  MAN, MAN_LANGT, VSK, LYKILL_VSK, P, pPlus, pAf, pAn, pMed,
  mk, NU_AR, NU_MAN, naestiMan, NAESTI, manHeiti, lesaMedVsk, reiknivel
} from './bokreikningur.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

const manStutt = (m) => m ? MAN[Number(m.slice(5, 7)) - 1].toLowerCase() + '. ' + m.slice(0, 4) : '';
const idag = () => {
  const d = new Date();
  return mk(d.getFullYear(), d.getMonth()) + '-' + String(d.getDate()).padStart(2, '0');
};

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Bókhald');
  const innihald = document.getElementById('innihald');

  let medVsk = lesaMedVsk();
  let synaAr = NU_AR;
  let aukaSia = 'framundan';

  const syna = (p) => (medVsk ? pMed(p) : pAn(p));
  const kr = (p) => kronur(Math.round(syna(Array.isArray(p) ? p : [p, 0]))) || kronur(0);
  const vskOrd = () => (medVsk ? 'með VSK' : 'án VSK');
  /* Hin talan, smátt undir: með VSK þegar sýnt er án, og öfugt.
     Vsklausar upphæðir eru eins í báðum og fá því bara athugasemd. */
  const annad = (p) => {
    p = Array.isArray(p) ? p : [p, 0];
    if (!p[0]) return p[1] ? 'ekkert VSK' : '';
    return kronur(Math.round(medVsk ? pAn(p) : pMed(p))) + ' ' + (medVsk ? 'án VSK' : 'með VSK');
  };
  const upphaedBox = (p, vidbot) => el('span', { class: 'bok__upph' }, [
    document.createTextNode(kr(p) + (vidbot || '')),
    annad(p) ? el('small', { class: 'bok__alt', texti: annad(p) }) : null
  ]);

  /* Gögnin eru sótt einu sinni. Flipar og síur teikna bara upp á nýtt
     úr því sem er komið, það er það sem gerði flipana hæga. */
  let hlad = null;
  let fyrirtaekin = [];
  /* Reikningsdrögin teiknast í sitt eigið svæði, svo þau sækist ekki
     aftur í hvert sinn sem skipt er um VSK eða ár */
  const reikningaSvid = el('div');
  async function teikna(adeinsBirta) {
    if (!adeinsBirta || !hlad) {
      hlad = await Promise.all([
        g.bokhald('samningar'), g.bokhald('aukaverkefni'), g.bokhald('taxtar'),
        g.fyrirtaeki().catch(() => [])
      ]);
      geyma('bokhald', hlad);
    }
    const [sam, auka, tax] = hlad;
    fyrirtaekin = hlad[3] || [];
    /* Samningur eða aukaverkefni breyttist: það sem má rukka gæti hafa breyst líka */
    if (!adeinsBirta) hladaReikningum();

    const { virkurI, fastI, aukaI } = reiknivel(sam, auka);

    /* ---------- tölurnar efst ---------- */
    const fastNu = fastI(NU_MAN);
    const aukaNu = aukaI(NU_MAN);
    const kannskiNu = aukaI(NU_MAN, true);
    const fastNaest = fastI(NAESTI);
    const aukaNaest = aukaI(NAESTI);
    const kannskiNaest = aukaI(NAESTI, true);
    const virkir = sam.filter((s) => virkurI(s, NU_MAN)).length;

    let komid = P(); let spa = P();
    for (let i = 0; i < 12; i++) {
      const m = mk(NU_AR, i);
      const t = pPlus(fastI(m), aukaI(m));
      if (m <= NU_MAN) komid = pPlus(komid, t);
      spa = pPlus(spa, t);
    }

    const greidslaNu = pPlus(fastNu, aukaNu);
    const greidslaNaest = pPlus(fastNaest, aukaNaest);

    /* ---------- súluritið ---------- */
    const radir = [];
    let mest = 0;
    for (let i = 0; i < 12; i++) {
      const m = mk(synaAr, i);
      const f = syna(fastI(m)); const a = syna(aukaI(m));
      radir.push({ m, i, f, a });
      mest = Math.max(mest, f + a);
    }

    const opidAuka = (a) => String(a.dags).slice(0, 7) >= NU_MAN || (!a.greitt && a.stada !== 'kannski');

    fylla(innihald, [
      el('div', { class: 'page-head bok__haus', style: 'padding-top:0' }, [
        el('div', {}, [
          el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Bókhald' }),
          el('p', { class: 'lead', texti: 'Samningar, föst mánaðartekjur og aukaverkefni.' })
        ]),
        el('div', { class: 'pflipar', style: 'margin:0', role: 'group', 'aria-label': 'Sýna upphæðir' }, [
          vskHnappur(false, 'Án VSK'), vskHnappur(true, 'Með VSK')
        ])
      ]),

      el('dl', { class: 'tekjur bok__tolur', style: 'margin-top:4px' }, [
        tala('adal', 'Greiðist í ' + manHeiti(NAESTI), greidslaNu,
          'fyrir ' + manHeiti(NU_MAN) + ': samningar ' + kr(fastNu) + ', aukaverkefni ' + kr(aukaNu)
          + (pAn(kannskiNu) ? ', ' + kr(kannskiNu) + ' í kannski' : '')),
        tala('', 'Greiðist í ' + manHeiti(naestiMan(NU_MAN, 2)), greidslaNaest,
          'fyrir ' + manHeiti(NAESTI)
          + (pAn(kannskiNaest) ? ', ' + kr(kannskiNaest) + ' í kannski til viðbótar' : ', ekkert kannski skráð')),
        tala('', 'Fast á mánuði', fastNu,
          (virkir === 1 ? '1 samningur í gildi' : virkir + ' samningar í gildi') + ', '
          + kr([fastNu[0] * 12, fastNu[1] * 12]) + ' á ári'),
        tala('', 'Komið inn ' + NU_AR, komid, 'spá fyrir árið: ' + kr(spa))
      ]),
      el('p', { class: 'skyring', style: 'margin-top:10px',
        texti: 'Allar tölur ' + vskOrd() + '. Vsklausir samningar eru eins í báðum.' }),

      /* ---------- súlurit ---------- */
      el('section', { class: 'card pblokk', style: 'margin-top:clamp(18px,2.2vw,26px)' }, [
        el('div', { class: 'pyfir' }, [
          el('h2', { texti: 'Tekjur eftir mánuðum ' + synaAr }),
          el('div', { class: 'bok__skyring' }, [
            el('span', {}, [el('i', { class: 'bok__lit bok__lit--fast' }), document.createTextNode('Samningar')]),
            el('span', {}, [el('i', { class: 'bok__lit bok__lit--auka' }), document.createTextNode('Aukaverkefni')]),
            el('span', { class: 'bok__ar' }, [
              el('button', { type: 'button', class: 'loka', 'aria-label': 'Fyrra ár', texti: '‹',
                             onclick: () => { synaAr--; teikna(true); } }),
              el('b', { texti: String(synaAr) }),
              el('button', { type: 'button', class: 'loka', 'aria-label': 'Næsta ár', texti: '›',
                             onclick: () => { synaAr++; teikna(true); } })
            ])
          ])
        ]),
        el('div', { class: 'bok__sulur' }, radir.map((r) => {
          const alls = r.f + r.a;
          const h = (v) => (mest > 0 && v > 0 ? Math.max(2, (v / mest) * 100) + '%' : '0');
          return el('div', {
            class: 'bok__sula' + (r.m > NU_MAN ? ' er-framtid' : '') + (r.m === NU_MAN ? ' er-nu' : ''),
            title: MAN_LANGT[r.i] + ' ' + synaAr + ': ' + synaGjaldmidil(syntTala(r.f) + syntTala(r.a))
              + (r.a ? ' (samningar ' + kronur(Math.round(r.f)) + ', aukaverkefni ' + kronur(Math.round(r.a)) + ')' : '')
          }, [
            el('span', { class: 'bok__sulutala', texti: alls ? stytt(alls) : '' }),
            el('div', { class: 'bok__sulubox' }, [
              r.a ? el('div', { class: 'bok__hluti bok__hluti--auka', style: 'height:' + h(r.a) }) : null,
              r.f ? el('div', { class: 'bok__hluti bok__hluti--fast' + (r.a ? ' er-undir' : ''), style: 'height:' + h(r.f) }) : null
            ]),
            el('span', { class: 'bok__man', texti: MAN[r.i] })
          ]);
        }))
      ]),

      /* Reikningsdrög */
      reikningaSvid,

      /* ---------- samningar ---------- */
      el('section', { class: 'card pblokk', style: 'margin-top:clamp(16px,2vw,22px)' }, [
        el('div', { class: 'pyfir' }, [
          el('h2', { texti: 'Samningar' }),
          el('button', { type: 'button', class: 'btn btn--sm', texti: 'Nýr samningur',
                         onclick: () => opnaSamning({}) })
        ]),
        sam.length
          ? el('ul', { class: 'tasklisti' }, [...sam]
              .sort((a, b) => String(b.hefst || '').localeCompare(String(a.hefst || '')))
              .map((s) => {
                const st = s.hefst > NU_MAN ? ['bid', 'Væntanlegur']
                  : s.lykur && s.lykur < NU_MAN ? ['hafnad', 'Lokið'] : ['ok', 'Virkur'];
                return el('li', {}, [el('div', { class: 'task' + (st[1] === 'Lokið' ? ' task--lokid' : '') }, [
                  el('div', { class: 'task__mid' }, [
                    el('button', { type: 'button', class: 'task__titill', texti: s.vidskiptavinur,
                                   onclick: () => opnaSamning(s) }),
                    el('div', { class: 'task__undir' }, [
                      s.thjonusta ? el('span', { texti: s.thjonusta }) : null,
                      el('span', { texti: 'frá ' + manStutt(s.hefst) + (s.lykur ? ' til ' + manStutt(s.lykur) : '') }),
                      s.vsklaust ? el('span', { texti: 'Ekkert VSK' }) : null
                    ])
                  ]),
                  el('div', { class: 'task__hofn' }, [
                    upphaedBox(pAf(s), ' á mán.'),
                    el('span', { class: 'pstat pstat--' + st[0], texti: st[1] })
                  ])
                ])]);
              }))
          : el('p', { class: 'tomt', texti: 'Engir samningar skráðir. Fastir samningar reiknast inn í mánaðartekjurnar frá upphafsmánuðinum.' })
      ]),

      /* ---------- aukaverkefni ---------- */
      (() => {
        const rodud = [...auka].sort((a, b) => String(b.dags || '').localeCompare(String(a.dags || '')));
        const opin = rodud.filter(opidAuka);
        const syndar = aukaSia === 'framundan' ? opin : rodud;
        return el('section', { class: 'card pblokk', style: 'margin-top:clamp(16px,2vw,22px)' }, [
          el('div', { class: 'pyfir' }, [
            el('h2', { texti: 'Aukaverkefni' }),
            el('button', { type: 'button', class: 'btn btn--sm', texti: 'Nýtt aukaverkefni',
                           onclick: () => opnaAuka({}) })
          ]),
          el('div', { class: 'pflipar' }, [
            el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(aukaSia === 'framundan'),
              onclick: () => { aukaSia = 'framundan'; teikna(true); } },
              [document.createTextNode('Opið og framundan '), el('b', { texti: String(opin.length) })]),
            el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(aukaSia === 'allt'),
              onclick: () => { aukaSia = 'allt'; teikna(true); } },
              [document.createTextNode('Allt '), el('b', { texti: String(auka.length) })])
          ]),
          syndar.length
            ? el('ul', { class: 'tasklisti' }, syndar.map((a) => el('li', {}, [
                el('div', { class: 'task' + (a.stada === 'kannski' ? ' bok--kannski' : '') }, [
                  el('div', { class: 'task__mid' }, [
                    el('button', { type: 'button', class: 'task__titill', texti: a.heiti,
                                   onclick: () => opnaAuka(a) }),
                    el('div', { class: 'task__undir' }, [
                      a.vidskiptavinur ? el('span', { texti: a.vidskiptavinur }) : null,
                      el('span', { texti: manHeiti(String(a.dags).slice(0, 7)) + ' ' + String(a.dags).slice(0, 4)
                        + ', greiðist í ' + manHeiti(naestiMan(String(a.dags).slice(0, 7), 1)) }),
                      a.vsklaust ? el('span', { texti: 'Ekkert VSK' }) : null
                    ])
                  ]),
                  el('div', { class: 'task__hofn' }, [
                    upphaedBox(pAf(a)),
                    a.stada === 'kannski'
                      ? el('span', { class: 'pstat pstat--nytt', texti: 'Kannski' })
                      : el('button', {
                          type: 'button', class: 'pstat pstat--' + (a.greitt ? 'ok' : 'bid') + ' bok__greitt',
                          title: a.greitt ? 'Merkja ógreitt' : 'Merkja greitt',
                          texti: a.greitt ? 'Greitt' : 'Ógreitt',
                          onclick: async () => {
                            await g.vistaBokhald('aukaverkefni', { id: a.id, greitt: !a.greitt });
                            teikna();
                          }
                        })
                  ])
                ])
              ])))
            : el('p', { class: 'tomt', texti: 'Ekkert opið. Allt utan fastra samninga fer hér: tökudagur, lendingarsíða, ein herferð.' })
        ]);
      })(),

      /* ---------- taxtar ---------- */
      el('section', { class: 'card pblokk', style: 'margin-top:clamp(16px,2vw,22px)' }, [
        el('div', { class: 'pyfir' }, [
          el('h2', { texti: 'Taxtar' }),
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Nýr taxti',
                         onclick: () => opnaTaxta({}) })
        ]),
        el('p', { class: 'skyring', style: 'margin:-6px 0 8px',
          texti: 'Fast verð á einingu. Skrá býr til aukaverkefni á þeim taxta.' }),
        tax.length
          ? el('ul', { class: 'tasklisti' }, tax.map((t) => el('li', {}, [el('div', { class: 'task' }, [
              el('div', { class: 'task__mid' }, [
                el('button', { type: 'button', class: 'task__titill',
                               texti: (t.vidskiptavinur ? t.vidskiptavinur + ', ' : '') + t.heiti,
                               onclick: () => opnaTaxta(t) }),
                el('div', { class: 'task__undir' }, [
                  el('span', { texti: kr(pAf(t)) + ' á ' + (t.eining || 'einingu') })
                ])
              ]),
              el('div', { class: 'task__hofn' }, [
                el('button', { type: 'button', class: 'btn btn--sm', texti: 'Skrá',
                               onclick: () => skraATaxta(t) })
              ])
            ])])))
          : el('p', { class: 'tomt', texti: 'Engir taxtar skráðir.' })
      ]),

      el('p', { class: 'skyring', style: 'margin-top:18px',
        texti: 'Tölur eru skráðar á þann mánuð sem unnið er. Greiðsla berst um mánaðamótin á eftir, '
          + 'svo nóvembervinna greiðist í desember. Súluritið sýnir vinnumánuði, ekki greiðsludaga.' }),

      g.prufa ? el('div', { class: 'prufubanner', style: 'margin-top:14px' }, [
        el('strong', { texti: 'Prufustilling. ' }),
        document.createTextNode('Þetta eru sýnidæmi. Alvöru tölurnar úr gamla Yfirlitinu koma hingað þegar Supabase er tengt.')
      ]) : null
    ]);
  }

  /* ------------------------------------------------------------------
     Hlutar
     ------------------------------------------------------------------ */
  function vskHnappur(gildi, heiti) {
    return el('button', {
      type: 'button', class: 'pflipi', 'aria-pressed': String(medVsk === gildi), texti: heiti,
      onclick: () => {
        medVsk = gildi;
        try { localStorage.setItem(LYKILL_VSK, gildi ? '1' : '0'); } catch (e) { /* lokað */ }
        teikna(true);
      }
    });
  }

  function tala(klasi, merki, p, undir) {
    return el('div', { class: klasi }, [
      el('dt', { texti: merki }),
      el('dd', { texti: kr(p) }),
      annad(p) ? el('p', { class: 'bok__alt bok__alt--stor', texti: annad(p) }) : null,
      el('p', { class: 'bok__undir', texti: undir })
    ]);
  }

  /* 1.147.500 -> "1,15 m", 400.000 -> "400 þ." */
  function stytt(isk) {
    const v = umreikna(isk);
    if (virkurGjaldmidill() !== 'ISK' && v < 1e4) return tolu(v);
    if (v >= 1e6) return erEnska() ? String(Math.round(v / 1e4) / 100) + 'M' : String(Math.round(v / 1e4) / 100).replace('.', ',') + ' m';
    return Math.round(v / 1000) + (erEnska() ? 'k' : ' þ.');
  }

  /* Upphæðarreitur með eigin vali: talan er án VSK, með VSK eða vsklaus.
     Í grunninn er alltaf geymt án VSK, nema vsklaust, þá er talan endanleg. */
  function upphaedReitur(merki, r) {
    const tala = Number(r.upphaed) || 0;
    let hamur = r.vsklaust ? 'ekkert' : (medVsk ? 'med' : 'an');
    const hamurUpphaf = hamur;
    /* Sýnt í völdum gjaldmiðli, alltaf geymt í krónum */
    const birtIsk = tala ? Math.round(hamur === 'med' ? tala * (1 + VSK) : tala) : '';
    const inn = el('input', { type: 'text', inputmode: upphaedInntak(), required: true, placeholder: '0' });
    setjaUpphaed(inn, birtIsk);
    inn.addEventListener('blur', () => snyrtaUpphaed(inn));
    const lina = el('p', { class: 'skyring bok__vsklina' });
    const hnappar = {};
    const uppfaera = () => {
      Object.keys(hnappar).forEach((k) => hnappar[k].setAttribute('aria-pressed', String(k === hamur)));
      const t = lesaUpphaed(inn) || 0;
      if (!t) { lina.textContent = hamur === 'ekkert' ? 'Ekkert VSK lagt ofan á.' : ''; return; }
      if (hamur === 'an') lina.textContent = '= ' + kronur(Math.round(t * (1 + VSK))) + ' með VSK';
      else if (hamur === 'med') lina.textContent = '= ' + kronur(Math.round(t / (1 + VSK))) + ' án VSK';
      else lina.textContent = 'Ekkert VSK lagt ofan á.';
    };
    [['an', 'Án VSK'], ['med', 'Með VSK'], ['ekkert', 'Ekkert VSK']].forEach(([k, heiti]) => {
      hnappar[k] = el('button', { type: 'button', class: 'pflipi', texti: heiti,
        onclick: () => { hamur = k; uppfaera(); } });
    });
    inn.addEventListener('input', uppfaera);
    uppfaera();
    return {
      node: el('div', { class: 'field' }, [
        el('span', { texti: merki }), inn,
        el('div', { class: 'pflipar bok__vskval' }, Object.values(hnappar)), lina
      ]),
      inn,
      ut() {
        /* Ekkert snert: upphaflega krónutalan, óháð genginu */
        if (hamur === hamurUpphaf && inn.value.trim() === inn.dataset.birt && inn.dataset.isk) return { upphaed: tala, vsklaust: hamur === 'ekkert' };
        const t = lesaUpphaed(inn) || 0;
        return { upphaed: hamur === 'med' ? Math.round(t / (1 + VSK)) : t, vsklaust: hamur === 'ekkert' };
      }
    };
  }

  function spjald(titill, reitir, vista, eyda) {
    const stadan = el('div', { class: 'form-status', hidden: true });
    let stadfest = false;
    const eydaHn = eyda ? el('button', { type: 'button', class: 'spjald__eyda', texti: 'Eyða',
      onclick: async (e) => {
        if (!stadfest) {
          stadfest = true;
          e.currentTarget.textContent = 'Ýttu aftur til að eyða';
          setTimeout(() => { stadfest = false; if (eydaHn.isConnected) eydaHn.textContent = 'Eyða'; }, 4000);
          return;
        }
        await eyda(); d.close(); teikna();
      } }) : null;

    const d = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort' }, [
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { texti: titill }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
      ]),
      el('form', {
        style: 'margin-top:18px; display:flex; flex-direction:column; gap:16px', novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          try {
            const ok = await vista();
            if (ok === false) return;
            d.close(); teikna();
          } catch (villa) {
            stadan.hidden = false;
            stadan.className = 'form-status form-status--err';
            stadan.textContent = villa.message || 'Þetta gekk ekki.';
          }
        }
      }, reitir.concat([
        stadan,
        el('div', { class: 'spjald__fot' }, [el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Vista' }), eydaHn])
      ]))
    ])]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
  }

  const reitur = (merki, inntak) => el('label', { class: 'field' }, [el('span', { texti: merki }), inntak]);
  const tikk = (merki, inntak) => el('label', { class: 'bok__tikk' }, [inntak, el('span', { texti: merki })]);
  const hak = (gildi) => { const i = el('input', { type: 'checkbox' }); i.checked = !!gildi; return i; };

  /* Fyrirtækið í kerfinu sem samningurinn eða aukaverkefnið tilheyrir.
     Þarf til að búa til reikningsdrög (kennitala og netfang fyrir reikninga). */
  function fyrirtaekisVal(r, vid) {
    const val = el('select', {}, [el('option', { value: '', texti: 'Ekki tengt' })].concat(
      [...fyrirtaekin].sort((a, b) => String(a.nafn).localeCompare(String(b.nafn), 'is'))
        .map((f) => el('option', { value: f.id, selected: f.id === r.fyrirtaeki_id, texti: f.nafn }))));
    val.addEventListener('change', () => {
      const f = fyrirtaekin.find((x) => x.id === val.value);
      if (f && !vid.value.trim()) vid.value = f.nafn;
    });
    return {
      node: el('label', { class: 'field' }, [
        el('span', { texti: 'Fyrirtæki í kerfinu' }), val,
        el('span', { class: 'skyring', texti: 'Þarf til að búa til reikningsdrög.' })
      ]),
      /* Bara sent ef því var breytt, svo eldri gagnagrunnur án dálksins virki áfram */
      ut() { const v = val.value || null; return v === (r.fyrirtaeki_id || null) ? {} : { fyrirtaeki_id: v }; }
    };
  }

  function opnaSamning(s) {
    const vid = el('input', { type: 'text', value: s.vidskiptavinur || '', required: true });
    const thj = el('input', { type: 'text', value: s.thjonusta || '', placeholder: 'Samfélagsmiðlar' });
    const upp = upphaedReitur('Upphæð á mánuði', s);
    const hefst = el('input', { type: 'month', value: s.hefst || NU_MAN });
    const lykur = el('input', { type: 'month', value: s.lykur || '' });
    const fyr = fyrirtaekisVal(s, vid);
    spjald(s.id ? 'Samningur' : 'Nýr samningur', [
      reitur('Viðskiptavinur', vid), fyrirtaekin.length ? fyr.node : null, reitur('Þjónusta', thj),
      upp.node,
      el('div', { class: 'field-row' }, [reitur('Hefst', hefst), reitur('Lýkur (valfrjálst)', lykur)])
    ], async () => {
      if (!vid.value.trim()) { vid.focus(); return false; }
      const { upphaed: u, vsklaust } = upp.ut();
      if (!u) { upp.inn.focus(); return false; }
      await g.vistaBokhald('samningar', {
        ...(s.id ? { id: s.id } : {}), vidskiptavinur: vid.value.trim(), thjonusta: thj.value.trim() || null,
        upphaed: u, vsklaust, hefst: hefst.value || NU_MAN, lykur: lykur.value || null, ...fyr.ut()
      });
    }, s.id ? () => g.eydaBokhald('samningar', s.id) : null);
  }

  function opnaAuka(a) {
    const heiti = el('input', { type: 'text', value: a.heiti || '', required: true, placeholder: 'Tökudagur' });
    const vid = el('input', { type: 'text', value: a.vidskiptavinur || '' });
    const upp = upphaedReitur('Upphæð', a);
    const dags = el('input', { type: 'date', value: a.dags || idag() });
    const stada = el('select', {}, [
      el('option', { value: 'stadfest', selected: a.stada !== 'kannski', texti: 'Staðfest' }),
      el('option', { value: 'kannski', selected: a.stada === 'kannski', texti: 'Kannski' })
    ]);
    const greitt = hak(a.greitt);
    const fyr = fyrirtaekisVal(a, vid);
    spjald(a.id ? 'Aukaverkefni' : 'Nýtt aukaverkefni', [
      reitur('Verkefni', heiti), reitur('Viðskiptavinur', vid), fyrirtaekin.length ? fyr.node : null,
      upp.node,
      el('div', { class: 'field-row' }, [reitur('Dagsetning', dags), reitur('Staða', stada)]),
      tikk('Greitt', greitt)
    ], async () => {
      if (!heiti.value.trim()) { heiti.focus(); return false; }
      const { upphaed: u, vsklaust } = upp.ut();
      if (!u) { upp.inn.focus(); return false; }
      await g.vistaBokhald('aukaverkefni', {
        ...(a.id ? { id: a.id } : {}), heiti: heiti.value.trim(), vidskiptavinur: vid.value.trim() || null,
        upphaed: u, vsklaust, dags: dags.value || idag(), stada: stada.value, greitt: greitt.checked, ...fyr.ut()
      });
    }, a.id ? () => g.eydaBokhald('aukaverkefni', a.id) : null);
  }

  function opnaTaxta(t) {
    const vid = el('input', { type: 'text', value: t.vidskiptavinur || '' });
    const heiti = el('input', { type: 'text', value: t.heiti || '', required: true, placeholder: 'Vidjó' });
    const eining = el('input', { type: 'text', value: t.eining || '', placeholder: 'vidjó' });
    const upp = upphaedReitur('Verð á einingu', t);
    spjald(t.id ? 'Taxti' : 'Nýr taxti', [
      reitur('Viðskiptavinur', vid),
      el('div', { class: 'field-row' }, [reitur('Verk', heiti), reitur('Eining', eining)]),
      upp.node
    ], async () => {
      if (!heiti.value.trim()) { heiti.focus(); return false; }
      const { upphaed: u, vsklaust } = upp.ut();
      if (!u) { upp.inn.focus(); return false; }
      await g.vistaBokhald('taxtar', {
        ...(t.id ? { id: t.id } : {}), vidskiptavinur: vid.value.trim() || null, heiti: heiti.value.trim(),
        eining: eining.value.trim() || null, upphaed: u, vsklaust
      });
    }, t.id ? () => g.eydaBokhald('taxtar', t.id) : null);
  }

  /* Skrá á taxta: spyr um fjölda og býr til aukaverkefni */
  function skraATaxta(t) {
    const fjoldi = el('input', { type: 'number', min: '1', step: '1', value: '1', required: true });
    const dags = el('input', { type: 'date', value: idag() });
    const lina = el('p', { class: 'skyring' });
    const uppfaera = () => {
      const n = Math.max(1, Number(fjoldi.value) || 1);
      lina.textContent = n + ' × ' + kr(pAf(t)) + ' = ' + kr(pAf({ ...t, upphaed: t.upphaed * n }));
    };
    fjoldi.addEventListener('input', uppfaera); uppfaera();
    spjald('Skrá: ' + (t.vidskiptavinur ? t.vidskiptavinur + ', ' : '') + t.heiti, [
      el('div', { class: 'field-row' }, [reitur('Fjöldi', fjoldi), reitur('Dagsetning', dags)]), lina
    ], async () => {
      const n = Math.max(1, Number(fjoldi.value) || 1);
      await g.vistaBokhald('aukaverkefni', {
        heiti: n + ' ' + (t.eining || t.heiti), vidskiptavinur: t.vidskiptavinur || null,
        upphaed: Number(t.upphaed) * n, vsklaust: !!t.vsklaust, dags: dags.value || idag(),
        stada: 'stadfest', greitt: false
      });
    }, null);
  }

  /* Reikningsdrög í Payday eða DK (Edge Function reikningar).
     Það sem má rukka kemur frá þjóninum. Línurnar eru yfirfarnar í
     glugga áður en nokkuð er búið til, og drögin eru alltaf DRÖG:
     ekkert er bókað og ekkert fer til viðskiptavinar héðan. */
  const VEITA_HEITI = { payday: 'Payday', dk: 'DK' };
  const UPPRUNA_HEITI = { verkefni: 'Verkefni', samningur: 'Samningur', aukaverkefni: 'Aukaverkefni' };
  const STOD_I_VINNSLU = 5 * 60 * 1000;
  const reikn = {
    manudur: NU_MAN, veitur: null, efni: [], efniVilla: null, drog: [], drogVilla: null,
    hledst: false, valin: new Set(), sia: 'manudur', opnaSidar: null
  };
  {
    const ur = new URLSearchParams(location.search).get('drog');
    if (ur && /^(verkefni|samningur|aukaverkefni):[\w-]{1,64}$/.test(ur)) reikn.opnaSidar = ur;
  }
  const lykillEfnis = (e) => e.uppruni + ':' + e.id + ':' + (e.manudur || '');
  const manTexti = (m) => (m ? manHeiti(String(m).slice(0, 7)) + ' ' + String(m).slice(0, 4) : '');
  const krAn = (isk) => kronur(Math.round(Number(isk) || 0)) || kronur(0);

  /* Tengdar veitur. Í sýnidæminu: sú sem var valin í Settu saman, annars Payday. */
  async function finnaVeitur() {
    let t = null;
    try { t = g.tengingarStada ? await g.tengingarStada() : null; } catch (e) { t = null; }
    const tengdar = ['payday', 'dk'].filter((v) => t && t[v]);
    if (tengdar.length || !g.prufa) return tengdar;
    return [bokhaldskerfi() === 'DK' ? 'dk' : 'payday'];
  }

  async function hladaReikningum() {
    if (reikn.hledst) return;
    reikn.hledst = true;
    teiknaReikninga();
    if (!reikn.veitur) reikn.veitur = await finnaVeitur();
    if (reikn.veitur.length) {
      const [efni, drog] = await Promise.allSettled([g.reikningsefni(reikn.manudur), g.reikningar()]);
      if (efni.status === 'fulfilled') {
        reikn.efni = (efni.value && efni.value.efni) || [];
        reikn.efniVilla = null;
        const til = new Set(reikn.efni.map(lykillEfnis));
        [...reikn.valin].forEach((k) => { if (!til.has(k)) reikn.valin.delete(k); });
      } else { reikn.efni = []; reikn.efniVilla = efni.reason; }
      if (drog.status === 'fulfilled') { reikn.drog = drog.value || []; reikn.drogVilla = null; }
      else { reikn.drog = []; reikn.drogVilla = drog.reason; }
    }
    reikn.hledst = false;
    teiknaReikninga();
    /* Komið af verkefnasíðunni: opna gluggann fyrir það verkefni */
    if (reikn.opnaSidar && !reikn.efniVilla) {
      const [uppruni, id] = reikn.opnaSidar.split(':');
      reikn.opnaSidar = null;
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* skiptir ekki máli */ }
      const e = reikn.efni.find((x) => x.uppruni === uppruni && String(x.id) === id);
      const h = e && hindrun(e);
      if (h) tilkynna(hindrunTexti(e, h));
      else if (e && reikn.veitur.length) opnaDrog([e]);
      else if (reikn.veitur.length) tilkynna('Þetta er ekki á listanum yfir það sem má rukka. Verkefnið þarf að vera lokið, með verð og ekki komið í reikning.');
    }
  }

  function teiknaReikninga() {
    const veitur = reikn.veitur || [];
    const nafn = veitur.map((v) => VEITA_HEITI[v]).join(' eða ') || 'Payday eða DK';
    const haus = el('div', { class: 'pyfir' }, [
      el('h2', { texti: 'Reikningsdrög' }),
      veitur.length ? el('label', { style: 'display:flex; align-items:center; gap:8px; font-size:14px; color:var(--soft)' }, [
        document.createTextNode('Mánuður'),
        el('input', { type: 'month', value: reikn.manudur, 'aria-label': 'Mánuður reikninga',
          style: 'min-height:44px; border:1px solid var(--line); border-radius:var(--r-input); padding:8px 10px; font:inherit; color:var(--ink); background:#fff',
          onchange: (e) => {
            if (!/^\d{4}-\d{2}$/.test(e.target.value)) return;
            reikn.manudur = e.target.value; reikn.valin.clear(); hladaReikningum();
          } })
      ]) : null
    ]);

    if (reikn.veitur && !veitur.length) {
      fylla(reikningaSvid, [el('section', { class: 'card pblokk', style: 'margin-top:clamp(16px,2vw,22px)' }, [
        haus,
        el('p', { class: 'lead', style: 'font-size:15px', texti: 'Tengdu Payday eða DK í Stillingum. Þá verða lokin verkefni, samningar mánaðarins og aukaverkefni að reikningsdrögum hér.' }),
        el('a', { class: 'btn btn--sm', style: 'margin-top:14px', href: 'stillingar.html', texti: 'Opna Stillingar' })
      ])]);
      return;
    }

    const born = [
      haus,
      el('p', { class: 'skyring', style: 'margin:-6px 0 12px', texti: 'Það sem má rukka fyrir ' + manTexti(reikn.manudur)
        + '. Drögin verða til í ' + nafn + '. Ekkert er bókað og ekkert fer til viðskiptavinar fyrr en þú sendir það þaðan.' })
    ];

    if (!reikn.veitur || (reikn.hledst && !reikn.efni.length && !reikn.drog.length)) {
      born.push(el('p', { class: 'tomt', texti: 'Sæki það sem má rukka' }));
    } else {
      born.push(...efnisListi(), ...drogaListi());
    }
    fylla(reikningaSvid, [el('section', { class: 'card pblokk', style: 'margin-top:clamp(16px,2vw,22px)' }, born)]);
  }

  /* Hvað á að laga, í orðum, eftir því hvað vantar og hvaðan línan kemur */
  function hindrunTexti(e, h) {
    if (h === 'Vantar kennitölu') return 'Settu kennitölu á fyrirtækið á Stjórnborði fyrst.';
    return 'Tengdu ' + (e.uppruni === 'samningur' ? 'samninginn' : e.uppruni === 'aukaverkefni' ? 'aukaverkefnið' : 'verkefnið') + ' við fyrirtæki fyrst.';
  }

  /* Hvað vantar svo hægt sé að búa til drög */
  function hindrun(e) {
    if (!e.fyrirtaeki_id) return 'Ekki tengt fyrirtæki';
    if (!e.kennitala) return 'Vantar kennitölu';
    return null;
  }

  function efnisListi() {
    if (reikn.efniVilla) return [el('p', { class: 'form-status form-status--err', texti: reikn.efniVilla.message || 'Náði ekki í það sem má rukka.' })];
    const efni = reikn.efni;
    if (!efni.length) return [el('p', { class: 'tomt', style: 'padding:20px 0', texti: 'Ekkert bíður reiknings í ' + manTexti(reikn.manudur) + '.' })];
    const tilbuin = efni.filter((e) => !hindrun(e));
    const valin = () => tilbuin.filter((e) => reikn.valin.has(lykillEfnis(e)));
    const haka = [];
    /* Hak breytir bara hnöppunum neðst, listinn teiknast ekki upp á nýtt */
    const alltHn = tilbuin.length > 1 ? el('button', { type: 'button', class: 'btn btn--sm btn--ghost',
      onclick: () => {
        const allt = valin().length === tilbuin.length;
        tilbuin.forEach((e) => (allt ? reikn.valin.delete(lykillEfnis(e)) : reikn.valin.add(lykillEfnis(e))));
        haka.forEach(([h, lykill]) => { h.checked = reikn.valin.has(lykill); });
        uppfaeraVal();
      } }) : null;
    const faraHn = el('button', { type: 'button', class: 'btn btn--sm', onclick: () => opnaDrog(valin()) });
    function uppfaeraVal() {
      const n = valin().length;
      if (alltHn) alltHn.textContent = n === tilbuin.length ? 'Afvelja allt' : 'Velja allt';
      faraHn.disabled = !n;
      faraHn.textContent = n ? 'Fara yfir ' + (n === 1 ? '1 reikning' : n + ' reikninga') : 'Hakaðu við það sem á að rukka';
    }
    uppfaeraVal();
    return [
      el('ul', { class: 'tasklisti' }, efni.map((e) => {
        const lykill = lykillEfnis(e);
        const h = hindrun(e);
        const hak = el('input', { type: 'checkbox', 'aria-label': 'Velja ' + e.heiti, disabled: h ? true : null,
          style: 'width:20px; height:20px; margin-top:2px; flex:none; accent-color:var(--acc)',
          onchange: (ev) => { ev.target.checked ? reikn.valin.add(lykill) : reikn.valin.delete(lykill); uppfaeraVal(); } });
        hak.checked = !h && reikn.valin.has(lykill);
        if (!h) haka.push([hak, lykill]);
        const lagfaera = h === 'Ekki tengt fyrirtæki' && e.uppruni !== 'verkefni' ? () => {
          const listi = e.uppruni === 'samningur' ? hlad[0] : hlad[1];
          const r = (listi || []).find((x) => String(x.id) === String(e.id));
          if (r) (e.uppruni === 'samningur' ? opnaSamning : opnaAuka)(r);
        } : null;
        return el('li', {}, [el('div', { class: 'task' }, [
          hak,
          el('div', { class: 'task__mid' }, [
            el('button', { type: 'button', class: 'task__titill', texti: e.heiti || UPPRUNA_HEITI[e.uppruni],
              onclick: () => (h ? (lagfaera ? lagfaera() : tilkynna(hindrunTexti(e, h))) : opnaDrog([e])) }),
            el('div', { class: 'task__undir' }, [
              el('span', { texti: UPPRUNA_HEITI[e.uppruni] || e.uppruni }),
              e.fyrirtaeki ? el('span', { texti: e.fyrirtaeki }) : null,
              e.vsklaust ? el('span', { texti: 'Ekkert VSK' }) : null,
              h ? el('span', { class: 'seint', texti: h }) : null,
              h === 'Vantar kennitölu' ? el('a', { href: 'stjornbord.html', texti: 'Setja á Stjórnborði' }) : null,
              lagfaera ? el('button', { type: 'button', class: 'sk-tengill', style: 'font-size:13px', texti: 'Tengja', onclick: lagfaera }) : null
            ])
          ]),
          el('div', { class: 'task__hofn' }, [
            el('span', { class: 'bok__upph', texti: krAn(e.upphaed) }),
            h ? null : el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Skoða', onclick: () => opnaDrog([e]) })
          ])
        ])]);
      })),
      el('div', { class: 'tf-hnappar', style: 'margin-top:14px' }, [alltHn, faraHn])
    ];
  }

  /* Drögin sem eru til. Villa sem var lagfærð síðar hverfur úr listanum. */
  function drogaListi() {
    const sama = (a, b) => a.uppruni === b.uppruni && String(a.uppruni_id) === String(b.uppruni_id) && String(a.manudur || '') === String(b.manudur || '');
    const oll = reikn.drog.filter((d) => d.stada !== 'villa' || !reikn.drog.some((x) => x !== d && x.stada !== 'villa' && sama(x, d)));
    const iManudi = (d) => String(d.manudur || d.stofnad || '').slice(0, 7) === reikn.manudur;
    const manadar = oll.filter(iManudi);
    const syndar = reikn.sia === 'manudur' ? manadar : oll;
    const hnappur = (k, heiti, n) => el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(reikn.sia === k),
      onclick: () => { reikn.sia = k; teiknaReikninga(); } }, [document.createTextNode(heiti + ' '), el('b', { texti: String(n) })]);
    return [
      el('h3', { style: 'font-family:var(--f-body); font-weight:500; font-size:16px; margin:22px 0 12px', texti: 'Drög sem eru til' }),
      reikn.drogVilla ? el('p', { class: 'form-status form-status--err', texti: reikn.drogVilla.message || 'Náði ekki í drögin.' }) : null,
      oll.length ? el('div', { class: 'pflipar', style: 'margin-bottom:6px' }, [
        hnappur('manudur', 'Drög mánaðarins', manadar.length), hnappur('allt', 'Öll drög', oll.length)
      ]) : null,
      syndar.length
        ? el('ul', { class: 'tasklisti' }, syndar.map(drogLina))
        : reikn.drogVilla ? null : el('p', { class: 'tomt', style: 'padding:16px 0', texti: oll.length ? 'Engin drög í ' + manTexti(reikn.manudur) + '.' : 'Engin drög ennþá.' })
    ];
  }

  function drogLina(d) {
    const linur = Array.isArray(d.linur) ? d.linur : [];
    const heiti = (linur[0] && linur[0].texti) || UPPRUNA_HEITI[d.uppruni] || 'Reikningur';
    const veita = VEITA_HEITI[d.veita] || d.veita;
    const stoppad = d.stada === 'i_vinnslu' && Date.now() - new Date(d.uppfaert || d.stofnad).getTime() > STOD_I_VINNSLU;
    const slod = /^https:\/\/\S+$/.test(String(d.ytri_slod || '')) ? d.ytri_slod : null;
    const pilla = d.stada === 'drog'
      ? el('span', { class: 'pstat pstat--ok', texti: 'Drög í ' + veita + (d.ytra_numer ? ' nr ' + d.ytra_numer : '') })
      : d.stada === 'villa'
        ? el('span', { class: 'pstat pstat--hafnad', texti: 'Villa' })
        : el('span', { class: 'pstat pstat--' + (stoppad ? 'bid' : 'vinnsla'), texti: stoppad ? 'Stóð á sér' : 'Í vinnslu' });
    const stadan = el('span', { role: 'status' });
    return el('li', {}, [el('div', { class: 'task' }, [
      el('div', { class: 'task__mid' }, [
        el('span', { class: 'task__titill', style: 'cursor:default', texti: heiti + (linur.length > 1 ? ' og ' + (linur.length - 1) + (linur.length === 2 ? ' lína í viðbót' : ' línur í viðbót') : '') }),
        el('div', { class: 'task__undir' }, [
          d.fyrirtaeki && d.fyrirtaeki.nafn ? el('span', { texti: d.fyrirtaeki.nafn }) : null,
          el('span', { texti: UPPRUNA_HEITI[d.uppruni] || d.uppruni }),
          d.manudur ? el('span', { texti: manTexti(d.manudur) }) : null,
          el('span', { texti: sidan(d.stofnad) }),
          slod ? el('a', { href: slod, target: '_blank', rel: 'noopener noreferrer', texti: 'Opna í ' + veita }) : null,
          d.stada === 'drog' && !slod ? el('span', { texti: 'Finndu drögin í ' + veita + ' undir sölureikningum' }) : null
        ]),
        d.stada === 'villa' && d.villa ? el('p', { class: 'skyring', style: 'margin-top:6px; color:#a3312a', texti: 'Villa: ' + d.villa }) : null,
        d.stada === 'i_vinnslu' && !stoppad ? el('p', { class: 'skyring', style: 'margin-top:6px', texti: 'Verið er að búa drögin til hjá ' + veita + '.' }) : null,
        stoppad ? el('p', { class: 'skyring', style: 'margin-top:6px', texti: 'Óvíst hvort ' + veita + ' bjó drögin til.'
          + (d.villa ? ' ' + d.villa : '') + ' Reyndu aftur: fyrst er athugað hvort þau séu til, svo ekkert verður tvítekið.' }) : null,
        stadan
      ]),
      el('div', { class: 'task__hofn' }, [
        el('span', { class: 'bok__upph', texti: krAn(d.upphaed) }),
        pilla,
        d.stada === 'villa' ? el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Reyna aftur',
          onclick: () => opnaDrog([{
            uppruni: d.uppruni, id: d.uppruni_id, heiti, manudur: d.manudur ? String(d.manudur).slice(0, 7) : null,
            fyrirtaeki: d.fyrirtaeki && d.fyrirtaeki.nafn, vsk: linur[0] && isFinite(Number(linur[0].vsk)) ? Number(linur[0].vsk) : null,
            linur: linur.map((l) => ({ texti: l.texti, upphaed: l.upphaed }))
          }], d.veita) }) : null,
        stoppad || (d.stada === 'i_vinnslu' && !stoppad) ? el('button', { type: 'button', class: 'btn btn--sm btn--ghost',
          texti: stoppad ? 'Reyna aftur' : 'Uppfæra',
          onclick: async (ev) => {
            if (!stoppad) { hladaReikningum(); return; }
            ev.currentTarget.disabled = true;
            stadan.textContent = 'Reyni aftur';
            try {
              const svar = await g.reikningsdrog({ veita: d.veita, uppruni: d.uppruni, id: d.uppruni_id,
                manudur: d.manudur ? String(d.manudur).slice(0, 7) : undefined,
                linur: linur.map((l) => ({ texti: l.texti, upphaed: l.upphaed })) });
              tilkynna(svar.texti);
            } catch (villa) {
              tilkynna(villa.message || 'Þetta gekk ekki. Prófaðu aftur.');
            }
            hladaReikningum();
          } }) : null
      ])
    ])]);
  }

  /* Glugginn: línur hvers reiknings, upphæðir án VSK, og hvert drögin fara.
     Ekkert er búið til fyrr en ýtt er á hnappinn neðst. */
  function opnaDrog(atridi, fostVeita) {
    const veitur = fostVeita ? [fostVeita] : (reikn.veitur || []);
    if (!atridi.length || !veitur.length) return;
    let veita = veitur[0];
    const hlutar = atridi.map((a) => {
      const linur = (Array.isArray(a.linur) && a.linur.length ? a.linur : [{ texti: a.heiti, upphaed: a.upphaed }])
        .map((l) => ({ texti: String(l.texti || ''), upphaed: Math.round(Number(l.upphaed) || 0) }));
      /* VSK hlutfallið kemur frá þjóninum (stillingar stofunnar), annars 24% */
      const vsk = a.vsklaust ? 0 : a.vsk !== null && a.vsk !== undefined && isFinite(Number(a.vsk)) ? Number(a.vsk) : Math.round(VSK * 100);
      return { a, linur, vsk, reitir: [], stada: el('p', { class: 'skyring', role: 'status', style: 'margin-top:8px' }), samtals: el('p', { class: 'skyring', style: 'margin-top:8px' }), svid: el('div'), buid: false };
    });
    const alls = el('p', { style: 'font-weight:500; margin-top:4px' });
    const villa = el('div', { class: 'form-status form-status--err', role: 'alert', hidden: true });
    const buaHn = el('button', { type: 'submit', class: 'btn btn--sm' });
    const haettaHn = el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Hætta við', onclick: () => d.close() });
    let breytt = false;

    const upphaedLinu = (r) => lesaUpphaed(r.upp) || 0;
    function reikna() {
      let heild = 0;
      for (const h of hlutar) {
        const an = h.reitir.reduce((s, r) => s + upphaedLinu(r), 0);
        heild += an;
        h.samtals.textContent = h.vsk
          ? 'Samtals ' + krAn(an) + ' án VSK, ' + krAn(Math.round(an * (1 + h.vsk / 100))) + ' með ' + h.vsk + '% VSK'
          : 'Samtals ' + krAn(an) + ', ekkert VSK';
      }
      alls.textContent = hlutar.length > 1 ? 'Alls ' + krAn(heild) + ' án VSK' : '';
      const eftir = hlutar.filter((h) => !h.buid).length;
      buaHn.textContent = eftir === 0 ? 'Búið' : 'Búa til ' + (eftir === 1 ? 'drög' : eftir + ' drög') + ' í ' + VEITA_HEITI[veita];
    }

    function teiknaHluta(h) {
      const lina = (l) => {
        const texti = el('input', { type: 'text', value: l.texti, maxlength: '200', 'aria-label': 'Texti á reikningi', placeholder: 'Texti á reikningi', required: true });
        const upp = el('input', { type: 'text', inputmode: upphaedInntak(), 'aria-label': 'Upphæð án VSK', placeholder: 'Án VSK',
          style: 'text-align:right' });
        setjaUpphaed(upp, l.upphaed);
        upp.addEventListener('blur', () => snyrtaUpphaed(upp));
        upp.addEventListener('input', reikna);
        const r = { texti, upp };
        const fjarlaegja = el('button', { type: 'button', class: 'loka', 'aria-label': 'Fjarlægja línu', texti: '✕',
          onclick: () => { if (h.reitir.length < 2) return; h.reitir = h.reitir.filter((x) => x !== r); r.node.remove(); reikna(); } });
        /* Texti og upphæð í einni línu, eða texti fyrir ofan í síma */
        r.node = el('div', { style: 'display:flex; flex-wrap:wrap; gap:8px; align-items:center' }, [
          el('div', { class: 'field', style: 'flex:1 1 220px; min-width:0' }, [texti]),
          el('div', { class: 'field', style: 'flex:1 0 110px; max-width:150px' }, [upp]), fjarlaegja]);
        return r;
      };
      h.reitir = h.linur.map(lina);
      const linurSvid = el('div', { style: 'display:flex; flex-direction:column; gap:8px; margin-top:10px' }, h.reitir.map((r) => r.node));
      fylla(h.svid, [el('div', { style: 'border-top:1px solid var(--line); padding-top:14px' }, [
        el('strong', { style: 'font-weight:500', texti: h.a.heiti || UPPRUNA_HEITI[h.a.uppruni] }),
        el('div', { class: 'task__undir', style: 'margin-top:4px' }, [
          el('span', { texti: UPPRUNA_HEITI[h.a.uppruni] || '' }),
          h.a.fyrirtaeki ? el('span', { texti: h.a.fyrirtaeki }) : null,
          h.a.manudur ? el('span', { texti: manTexti(h.a.manudur) }) : null
        ]),
        linurSvid,
        el('button', { type: 'button', class: 'sk-tengill', style: 'margin-top:10px; font-size:13.5px', texti: 'Bæta við línu',
          onclick: () => { const r = lina({ texti: '', upphaed: 0 }); h.reitir.push(r); linurSvid.append(r.node); r.texti.focus(); reikna(); } }),
        h.samtals, h.stada
      ])]);
    }
    hlutar.forEach(teiknaHluta);

    const veituVal = veitur.length > 1 ? el('label', { class: 'field' }, [
      el('span', { texti: 'Hvert fara drögin' }),
      el('select', { onchange: (e) => { veita = e.target.value; reikna(); } },
        veitur.map((v) => el('option', { value: v, texti: VEITA_HEITI[v] })))
    ]) : null;

    async function bua(e) {
      e.preventDefault();
      if (hlutar.every((h) => h.buid)) { d.close(); return; }
      villa.hidden = true;
      /* Allt athugað fyrst, svo ekkert fari af stað hálfklárað */
      const beidnir = [];
      for (const h of hlutar.filter((x) => !x.buid)) {
        const linur = h.reitir.map((r) => ({ texti: r.texti.value.trim(), upphaed: upphaedLinu(r) }));
        const tom = h.reitir.find((r) => !r.texti.value.trim());
        if (tom) { villa.textContent = 'Hver lína þarf texta.'; villa.hidden = false; tom.texti.focus(); return; }
        if (!linur.reduce((s, l) => s + l.upphaed, 0)) { villa.textContent = 'Upphæðin er 0 á ' + (h.a.heiti || 'reikningi') + '. Settu verð á línurnar.'; villa.hidden = false; return; }
        beidnir.push([h, linur]);
      }
      buaHn.disabled = true; haettaHn.disabled = true;
      if (veituVal) veituVal.querySelector('select').disabled = true;
      for (const [h, linur] of beidnir) {
        h.stada.className = 'skyring'; h.stada.textContent = 'Bý til drög í ' + VEITA_HEITI[veita];
        try {
          const svar = await g.reikningsdrog({ veita, uppruni: h.a.uppruni, id: h.a.id, manudur: h.a.manudur || undefined, linur });
          h.buid = true; breytt = true;
          h.stada.className = 'form-status form-status--ok';
          h.stada.textContent = svar.texti;
          h.reitir.forEach((r) => { r.texti.disabled = true; r.upp.disabled = true; });
          reikn.valin.delete(lykillEfnis(h.a));
        } catch (villa2) {
          h.stada.className = 'form-status form-status--err';
          h.stada.textContent = villa2.message || 'Þetta gekk ekki. Prófaðu aftur.';
          if (villa2.gogn && villa2.gogn.drog) breytt = true;
        }
      }
      buaHn.disabled = false; haettaHn.disabled = false;
      if (veituVal && !hlutar.every((h) => h.buid)) veituVal.querySelector('select').disabled = false;
      reikna();
      if (hlutar.every((h) => h.buid)) { buaHn.textContent = 'Loka'; haettaHn.style.display = 'none'; }
    }

    const d = el('dialog', { class: 'pdialog', 'aria-labelledby': 'bok-drog-h' }, [el('div', { class: 'pdialog__kort' }, [
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { id: 'bok-drog-h', texti: atridi.length === 1 ? 'Reikningsdrög' : atridi.length + ' reikningsdrög' }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
      ]),
      el('p', { class: 'skyring', style: 'margin-top:8px', texti: 'Farðu yfir línurnar. Upphæðir eru án VSK. Drögin verða til í '
        + (veitur.length > 1 ? 'kerfinu sem þú velur' : VEITA_HEITI[veita]) + ', ekkert er bókað og ekkert fer til viðskiptavinar héðan.'
        + (virkurGjaldmidill() !== 'ISK' ? ' Drögin sjálf eru í krónum.' : '')
        + (g.prufa ? ' Í sýnidæminu verða engin drög til.' : '') }),
      el('form', { style: 'margin-top:14px; display:flex; flex-direction:column; gap:16px', novalidate: true, onsubmit: bua }, [
        veituVal,
        ...hlutar.map((h) => h.svid),
        alls,
        villa,
        el('div', { class: 'spjald__fot' }, [buaHn, haettaHn])
      ])
    ])]);
    d.addEventListener('click', (e) => { if (e.target === d && !buaHn.disabled) d.close(); });
    d.addEventListener('cancel', (e) => { if (buaHn.disabled) e.preventDefault(); });
    d.addEventListener('close', () => { d.remove(); if (breytt) hladaReikningum(); else teiknaReikninga(); });
    document.body.append(d);
    reikna();
    d.showModal();
  }

  hlad = geymt('bokhald');
  if (hlad) teikna(true);
  teikna();
}
