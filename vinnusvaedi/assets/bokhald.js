/* ==========================================================================
   Tveir vinnusvæði — bókhald
   Sama og gamla Yfirlit síðan: samningar, aukaverkefni og taxtar, með
   súluriti yfir tekjur eftir mánuðum. Vinna í mánuði greiðist 1. dag
   næsta mánaðar, svo nóvembervinna greiðist í desember.

   Upphæðir eru geymdar án VSK nema færslan sé merkt vsklaus, þá er talan
   endanleg og rofinn má ekki bæta 24% ofan á hana. Því fer allur
   reikningur fram í pari: [VSK-skylt, VSK-laust].
   ========================================================================== */

import { gogn, el, fylla, kronur, lesaTolu, vardaHlid, teiknaHaus, geymt, geyma } from './portal.js';
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
  const kr = (p) => kronur(Math.round(syna(Array.isArray(p) ? p : [p, 0]))) || '0 kr.';
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
  async function teikna(adeinsBirta) {
    if (!adeinsBirta || !hlad) {
      hlad = await Promise.all([
      g.bokhald('samningar'), g.bokhald('aukaverkefni'), g.bokhald('taxtar')
    ]);
      geyma('bokhald', hlad);
    }
    const [sam, auka, tax] = hlad;

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
            title: MAN_LANGT[r.i] + ' ' + synaAr + ': ' + kronur(Math.round(alls))
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
  function stytt(v) {
    if (v >= 1e6) return String(Math.round(v / 1e4) / 100).replace('.', ',') + ' m';
    return Math.round(v / 1000) + ' þ.';
  }

  /* Upphæðarreitur með eigin vali: talan er án VSK, með VSK eða vsklaus.
     Í grunninn er alltaf geymt án VSK, nema vsklaust, þá er talan endanleg. */
  function upphaedReitur(merki, r) {
    const tala = Number(r.upphaed) || 0;
    let hamur = r.vsklaust ? 'ekkert' : (medVsk ? 'med' : 'an');
    const punktar = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const birt = tala ? Math.round(hamur === 'med' ? tala * (1 + VSK) : tala) : '';
    const inn = el('input', { type: 'text', inputmode: 'numeric', required: true, placeholder: '0',
      value: birt ? punktar(birt) : '' });
    inn.addEventListener('blur', () => { const t = lesaTolu(inn.value); if (t) inn.value = punktar(t); });
    const lina = el('p', { class: 'skyring bok__vsklina' });
    const hnappar = {};
    const uppfaera = () => {
      Object.keys(hnappar).forEach((k) => hnappar[k].setAttribute('aria-pressed', String(k === hamur)));
      const t = lesaTolu(inn.value) || 0;
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
        const t = lesaTolu(inn.value) || 0;
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

  function opnaSamning(s) {
    const vid = el('input', { type: 'text', value: s.vidskiptavinur || '', required: true });
    const thj = el('input', { type: 'text', value: s.thjonusta || '', placeholder: 'Samfélagsmiðlar' });
    const upp = upphaedReitur('Kr. á mánuði', s);
    const hefst = el('input', { type: 'month', value: s.hefst || NU_MAN });
    const lykur = el('input', { type: 'month', value: s.lykur || '' });
    spjald(s.id ? 'Samningur' : 'Nýr samningur', [
      reitur('Viðskiptavinur', vid), reitur('Þjónusta', thj),
      upp.node,
      el('div', { class: 'field-row' }, [reitur('Hefst', hefst), reitur('Lýkur (valfrjálst)', lykur)])
    ], async () => {
      if (!vid.value.trim()) { vid.focus(); return false; }
      const { upphaed: u, vsklaust } = upp.ut();
      if (!u) { upp.inn.focus(); return false; }
      await g.vistaBokhald('samningar', {
        ...(s.id ? { id: s.id } : {}), vidskiptavinur: vid.value.trim(), thjonusta: thj.value.trim() || null,
        upphaed: u, vsklaust, hefst: hefst.value || NU_MAN, lykur: lykur.value || null
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
    spjald(a.id ? 'Aukaverkefni' : 'Nýtt aukaverkefni', [
      reitur('Verkefni', heiti), reitur('Viðskiptavinur', vid),
      upp.node,
      el('div', { class: 'field-row' }, [reitur('Dagsetning', dags), reitur('Staða', stada)]),
      tikk('Greitt', greitt)
    ], async () => {
      if (!heiti.value.trim()) { heiti.focus(); return false; }
      const { upphaed: u, vsklaust } = upp.ut();
      if (!u) { upp.inn.focus(); return false; }
      await g.vistaBokhald('aukaverkefni', {
        ...(a.id ? { id: a.id } : {}), heiti: heiti.value.trim(), vidskiptavinur: vid.value.trim() || null,
        upphaed: u, vsklaust, dags: dags.value || idag(), stada: stada.value, greitt: greitt.checked
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

  hlad = geymt('bokhald');
  if (hlad) teikna(true);
  teikna();
}
