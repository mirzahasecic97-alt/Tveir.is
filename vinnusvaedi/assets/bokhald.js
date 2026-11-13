/* ==========================================================================
   Tveir vinnusvæði — bókhald
   Sama og gamla Yfirlit síðan: samningar, aukaverkefni og taxtar, með
   súluriti yfir tekjur eftir mánuðum. Vinna í mánuði greiðist 1. dag
   næsta mánaðar, svo nóvembervinna greiðist 1. desember.

   Upphæðir eru geymdar án VSK nema færslan sé merkt vsklaus, þá er talan
   endanleg og rofinn má ekki bæta 24% ofan á hana. Því fer allur
   reikningur fram í pari: [VSK-skylt, VSK-laust].
   ========================================================================== */

import { gogn, el, fylla, kronur, lesaTolu, vardaHlid, teiknaHaus } from './portal.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

const MAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Maí', 'Jún', 'Júl', 'Ágú', 'Sep', 'Okt', 'Nóv', 'Des'];
const MAN_LANGT = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí',
                   'ágúst', 'september', 'október', 'nóvember', 'desember'];
const VSK = 0.24;
const LYKILL_VSK = 'tveir-vsk';

/* ---------- pörin ---------- */
const P = (a, b) => [a || 0, b || 0];
const pPlus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const pAf = (r) => (r && r.vsklaust ? [0, Number(r.upphaed) || 0] : [Number(r && r.upphaed) || 0, 0]);
const pAn = (p) => p[0] + p[1];
const pMed = (p) => p[0] * (1 + VSK) + p[1];

/* ---------- mánuðir ---------- */
const mk = (ar, i) => ar + '-' + String(i + 1).padStart(2, '0');
const nuDags = new Date();
const NU_AR = nuDags.getFullYear();
const NU_MAN = mk(NU_AR, nuDags.getMonth());
const naestiMan = (m, n) => {
  const [a, mm] = m.split('-').map(Number);
  const d = new Date(a, mm - 1 + n, 1);
  return mk(d.getFullYear(), d.getMonth());
};
const NAESTI = naestiMan(NU_MAN, 1);
const manHeiti = (m) => MAN_LANGT[Number(m.slice(5, 7)) - 1];
const manStutt = (m) => m ? MAN[Number(m.slice(5, 7)) - 1].toLowerCase() + '. ' + m.slice(0, 4) : '';
const idag = () => {
  const d = new Date();
  return mk(d.getFullYear(), d.getMonth()) + '-' + String(d.getDate()).padStart(2, '0');
};

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Bókhald');
  const innihald = document.getElementById('innihald');

  let medVsk = false;
  try { medVsk = localStorage.getItem(LYKILL_VSK) === '1'; } catch (e) { /* lokað */ }
  let synaAr = NU_AR;
  let aukaSia = 'framundan';

  const syna = (p) => (medVsk ? pMed(p) : pAn(p));
  const kr = (p) => kronur(Math.round(syna(Array.isArray(p) ? p : [p, 0]))) || '0 kr.';
  const vskOrd = () => (medVsk ? 'með VSK' : 'án VSK');

  async function teikna() {
    const [sam, auka, tax] = await Promise.all([
      g.bokhald('samningar'), g.bokhald('aukaverkefni'), g.bokhald('taxtar')
    ]);

    const virkurI = (s, m) => s.hefst && s.hefst <= m && (!s.lykur || s.lykur >= m);
    const fastI = (m) => sam.reduce((t, s) => (virkurI(s, m) ? pPlus(t, pAf(s)) : t), P());
    const aukaI = (m, kannski) => auka.reduce((t, a) =>
      (String(a.dags || '').slice(0, 7) === m && (a.stada === 'kannski') === !!kannski
        ? pPlus(t, pAf(a)) : t), P());

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
        tala('adal', 'Greiðist 1. ' + manHeiti(NAESTI), kr(greidslaNu),
          'fyrir ' + manHeiti(NU_MAN) + ': samningar ' + kr(fastNu) + ', aukaverkefni ' + kr(aukaNu)
          + (pAn(kannskiNu) ? ', ' + kr(kannskiNu) + ' í kannski' : '')),
        tala('', 'Greiðist 1. ' + manHeiti(naestiMan(NU_MAN, 2)), kr(greidslaNaest),
          'fyrir ' + manHeiti(NAESTI)
          + (pAn(kannskiNaest) ? ', ' + kr(kannskiNaest) + ' í kannski til viðbótar' : ', ekkert kannski skráð')),
        tala('', 'Fast á mánuði', kr(fastNu),
          (virkir === 1 ? '1 samningur í gildi' : virkir + ' samningar í gildi') + ', '
          + kr([fastNu[0] * 12, fastNu[1] * 12]) + ' á ári'),
        tala('', 'Komið inn ' + NU_AR, kr(komid), 'spá fyrir árið: ' + kr(spa))
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
                             onclick: () => { synaAr--; teikna(); } }),
              el('b', { texti: String(synaAr) }),
              el('button', { type: 'button', class: 'loka', 'aria-label': 'Næsta ár', texti: '›',
                             onclick: () => { synaAr++; teikna(); } })
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
                    el('span', { class: 'bok__upph', texti: kr(pAf(s)) + ' á mán.' }),
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
              onclick: () => { aukaSia = 'framundan'; teikna(); } },
              [document.createTextNode('Opið og framundan '), el('b', { texti: String(opin.length) })]),
            el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(aukaSia === 'allt'),
              onclick: () => { aukaSia = 'allt'; teikna(); } },
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
                        + ', greiðist 1. ' + manHeiti(naestiMan(String(a.dags).slice(0, 7), 1)) }),
                      a.vsklaust ? el('span', { texti: 'Ekkert VSK' }) : null
                    ])
                  ]),
                  el('div', { class: 'task__hofn' }, [
                    el('span', { class: 'bok__upph', texti: kr(pAf(a)) }),
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
          + 'svo nóvembervinna greiðist 1. desember. Súluritið sýnir vinnumánuði, ekki greiðsludaga.' }),

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
        teikna();
      }
    });
  }

  function tala(klasi, merki, gildi, undir) {
    return el('div', { class: klasi }, [
      el('dt', { texti: merki }),
      el('dd', { texti: gildi }),
      el('p', { class: 'bok__undir', texti: undir })
    ]);
  }

  /* 1.147.500 -> "1,15 m", 400.000 -> "400 þ." */
  function stytt(v) {
    if (v >= 1e6) return String(Math.round(v / 1e4) / 100).replace('.', ',') + ' m';
    return Math.round(v / 1000) + ' þ.';
  }

  /* Upphæðarreitur sem fylgir VSK rofanum. Vsklaus tala er alltaf endanleg. */
  function upphaedInn(r) {
    const tala = Number(r.upphaed) || 0;
    const birt = tala ? Math.round(r.vsklaust || !medVsk ? tala : tala * (1 + VSK)) : '';
    return el('input', { type: 'text', inputmode: 'numeric', required: true, placeholder: '0',
      value: birt ? String(birt).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '' });
  }
  function upphaedUt(reitur, vsklaust) {
    const t = lesaTolu(reitur.value) || 0;
    return medVsk && !vsklaust ? Math.round(t / (1 + VSK)) : t;
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
        el('p', { class: 'skyring', style: 'margin-top:-6px', texti: 'Upphæðin er ' + vskOrd() + ', eins og rofinn efst.' }),
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
  const upphaedRod = (merki, upp, laust) => el('div', { class: 'bok__upphaedrod' }, [reitur(merki, upp), tikk('Ekkert VSK', laust)]);

  function opnaSamning(s) {
    const vid = el('input', { type: 'text', value: s.vidskiptavinur || '', required: true });
    const thj = el('input', { type: 'text', value: s.thjonusta || '', placeholder: 'Samfélagsmiðlar' });
    const upp = upphaedInn(s);
    const laust = hak(s.vsklaust);
    const hefst = el('input', { type: 'month', value: s.hefst || NU_MAN });
    const lykur = el('input', { type: 'month', value: s.lykur || '' });
    spjald(s.id ? 'Samningur' : 'Nýr samningur', [
      reitur('Viðskiptavinur', vid), reitur('Þjónusta', thj),
      upphaedRod('Kr. á mánuði', upp, laust),
      el('div', { class: 'field-row' }, [reitur('Hefst', hefst), reitur('Lýkur (valfrjálst)', lykur)])
    ], async () => {
      if (!vid.value.trim()) { vid.focus(); return false; }
      const u = upphaedUt(upp, laust.checked);
      if (!u) { upp.focus(); return false; }
      await g.vistaBokhald('samningar', {
        ...(s.id ? { id: s.id } : {}), vidskiptavinur: vid.value.trim(), thjonusta: thj.value.trim() || null,
        upphaed: u, vsklaust: laust.checked, hefst: hefst.value || NU_MAN, lykur: lykur.value || null
      });
    }, s.id ? () => g.eydaBokhald('samningar', s.id) : null);
  }

  function opnaAuka(a) {
    const heiti = el('input', { type: 'text', value: a.heiti || '', required: true, placeholder: 'Tökudagur' });
    const vid = el('input', { type: 'text', value: a.vidskiptavinur || '' });
    const upp = upphaedInn(a);
    const laust = hak(a.vsklaust);
    const dags = el('input', { type: 'date', value: a.dags || idag() });
    const stada = el('select', {}, [
      el('option', { value: 'stadfest', selected: a.stada !== 'kannski', texti: 'Staðfest' }),
      el('option', { value: 'kannski', selected: a.stada === 'kannski', texti: 'Kannski' })
    ]);
    const greitt = hak(a.greitt);
    spjald(a.id ? 'Aukaverkefni' : 'Nýtt aukaverkefni', [
      reitur('Verkefni', heiti), reitur('Viðskiptavinur', vid),
      upphaedRod('Upphæð', upp, laust),
      el('div', { class: 'field-row' }, [reitur('Dagsetning', dags), reitur('Staða', stada)]),
      tikk('Greitt', greitt)
    ], async () => {
      if (!heiti.value.trim()) { heiti.focus(); return false; }
      const u = upphaedUt(upp, laust.checked);
      if (!u) { upp.focus(); return false; }
      await g.vistaBokhald('aukaverkefni', {
        ...(a.id ? { id: a.id } : {}), heiti: heiti.value.trim(), vidskiptavinur: vid.value.trim() || null,
        upphaed: u, vsklaust: laust.checked, dags: dags.value || idag(), stada: stada.value, greitt: greitt.checked
      });
    }, a.id ? () => g.eydaBokhald('aukaverkefni', a.id) : null);
  }

  function opnaTaxta(t) {
    const vid = el('input', { type: 'text', value: t.vidskiptavinur || '' });
    const heiti = el('input', { type: 'text', value: t.heiti || '', required: true, placeholder: 'Vidjó' });
    const eining = el('input', { type: 'text', value: t.eining || '', placeholder: 'vidjó' });
    const upp = upphaedInn(t);
    const laust = hak(t.vsklaust);
    spjald(t.id ? 'Taxti' : 'Nýr taxti', [
      reitur('Viðskiptavinur', vid),
      el('div', { class: 'field-row' }, [reitur('Verk', heiti), reitur('Eining', eining)]),
      upphaedRod('Verð á einingu', upp, laust)
    ], async () => {
      if (!heiti.value.trim()) { heiti.focus(); return false; }
      const u = upphaedUt(upp, laust.checked);
      if (!u) { upp.focus(); return false; }
      await g.vistaBokhald('taxtar', {
        ...(t.id ? { id: t.id } : {}), vidskiptavinur: vid.value.trim() || null, heiti: heiti.value.trim(),
        eining: eining.value.trim() || null, upphaed: u, vsklaust: laust.checked
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

  teikna();
}
