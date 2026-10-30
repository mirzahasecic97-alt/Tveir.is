/* ==========================================================================
   Tveir vinnusvæði — sameiginlegt
   ========================================================================== */

import { gogn, STODUR_TASK, STODUR_VERK, FORGANGUR } from './gogn.js';
import { stillingar } from './stillingar.js';

/* ------------------------------------------------------------------
   Smáhjálp
   ------------------------------------------------------------------ */
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

/* 250000 -> "250.000 kr." Handvirkt af sömu ástæðu og mánuðirnir. */
export function kronur(gildi) {
  if (gildi === null || gildi === undefined || gildi === '') return null;
  const tala = Math.round(Number(gildi));
  if (isNaN(tala)) return null;
  return String(tala).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' kr.';
}

/* "250.000" eða "250000" -> 250000 */
export function lesaTolu(texti) {
  const hreint = String(texti == null ? '' : texti).replace(/[^0-9]/g, '');
  return hreint ? Number(hreint) : null;
}

/* Hversu langt síðan, í orðum */
export function sidan(gildi) {
  if (!gildi) return '';
  const min = Math.round((Date.now() - new Date(gildi)) / 60000);
  if (min < 2) return 'núna';
  if (min < 60) return min + ' mín.';
  const klst = Math.round(min / 60);
  if (klst < 24) return klst + (klst === 1 ? ' klst.' : ' klst.');
  const dagar = Math.round(klst / 24);
  if (dagar < 8) return dagar === 1 ? 'í gær' : dagar + ' dagar';
  return dags(gildi);
}

/* 1536000 -> "1,5 MB" */
export function staerd(bitar) {
  if (!bitar && bitar !== 0) return '';
  if (bitar < 1024) return bitar + ' B';
  if (bitar < 1024 * 1024) return Math.round(bitar / 1024) + ' KB';
  return String(Math.round(bitar / 1024 / 102.4) / 10).replace('.', ',') + ' MB';
}

/* Er skiladagur liðinn */
export function erSeint(dagsetning) {
  if (!dagsetning) return false;
  const i_dag = new Date(); i_dag.setHours(0, 0, 0, 0);
  return new Date(dagsetning) < i_dag;
}

export function pilla(stada, tafla) {
  const s = (tafla === 'verk' ? STODUR_VERK : STODUR_TASK)[stada];
  if (!s) return el('span', { class: 'pstat pstat--nytt', texti: stada });
  return el('span', { class: 'pstat pstat--' + s.litur, texti: s.heiti });
}

/* ------------------------------------------------------------------
   Innskráningarvörður
   Skilar notandanum eða sendir á innskráningu.
   ------------------------------------------------------------------ */
export async function vardaHlid({ krefstAdmin, badir } = {}) {
  const g = await gogn();
  const ek = await g.eg();

  if (!ek) { location.replace('./'); return null; }

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

/* Kallað eftir að tillaga er afgreidd svo talan í hausnum sé rétt */
export function uppfaeraMerki() {
  if (!hausMerki) return;
  gogn()
    .then((g) => g.verkefni())
    .then((listi) => {
      const fjoldi = listi.filter((v) => v.stada === 'tillaga').length;
      hausMerki.textContent = String(fjoldi);
      hausMerki.hidden = fjoldi === 0;
    })
    .catch(() => { /* merkið bíður bara */ });
}

export function teiknaHaus(ek, heiti) {
  const haus = document.getElementById('phead');
  if (!haus) return;

  const admin = ek.hlutverk === 'admin';

  /* Merkið á Tillögur fyllist þar sem talan liggur ekki fyrir strax */
  const merki = admin ? el('span', { class: 'phead__merki', hidden: true }) : null;
  hausMerki = merki;
  uppfaeraMerki();

  const nuna = location.pathname.split('/').pop() || 'stjornbord.html';

  fylla(haus, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'phead__inn' }, [
        el('a', { class: 'phead__logo', href: admin ? 'stjornbord.html' : 'yfirlit.html',
                  'aria-label': 'Vinnusvæði Tveir' }, [
          /* Í appinu stærir tvisturinn sig, á vefnum er orðmerkið */
          erUppsett()
            ? el('img', { class: 'phead__tvistur', src: 'assets/tvistur.png',
                          alt: 'Tveir', width: '22', height: '28' })
            : el('img', { src: '../assets/img/tveir-logo.png', alt: 'Tveir',
                          width: '70', height: '18' })
        ]),
        el('span', { class: 'phead__skil', 'aria-hidden': 'true' }),

        admin
          ? el('nav', { class: 'phead__nav', 'aria-label': 'Vinnusvæði' }, [
              el('a', { href: 'stjornbord.html', texti: 'Stjórnborð',
                        'aria-current': nuna === 'stjornbord.html' ? 'page' : null }),
              el('a', { href: 'tillogur.html',
                        'aria-current': nuna === 'tillogur.html' ? 'page' : null }, [
                document.createTextNode('Tillögur'), merki
              ])
            ])
          : el('div', { class: 'phead__heiti' }, [
              document.createTextNode(heiti ? heiti + ' ' : ''),
              ek.fyrirtaeki ? el('strong', { texti: ek.fyrirtaeki.nafn }) : null
            ]),
        el('div', { class: 'phead__hnappar' }, [
          el('div', { class: 'phead__notandi' }, [
            el('strong', { texti: ek.nafn }),
            document.createTextNode(admin ? 'Tveir' : ek.netfang)
          ]),
          el('button', {
            type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Út',
            onclick: async () => { const g = await gogn(); await g.utskra(); location.replace('./'); }
          })
        ])
      ])
    ])
  ]);
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
      el('h2', { texti: 'Vinnusvæðið í símann' }),
      el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                     onclick: () => d.close() })
    ]),

    el('div', { class: 'uppsetning__haus' }, [
      el('img', { src: 'assets/takn-192.png', alt: '', width: '56', height: '56' }),
      el('div', {}, [
        el('strong', { texti: 'Tveir' }),
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
                ? 'Appið heldur sinni eigin innskráningu, svo þú slærð netfangið inn einu '
                  + 'sinni í viðbót þegar þú opnar það í fyrsta sinn.'
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
   Taskspjald
   ------------------------------------------------------------------ */
let spjald = null;

function byggjaSpjald() {
  if (spjald) return spjald;
  spjald = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort', id: 'spjald-kort' })]);
  spjald.addEventListener('click', (e) => { if (e.target === spjald) spjald.close(); });
  document.body.append(spjald);
  return spjald;
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
      texti: n.nafn + (n.hlutverk === 'admin' ? ' (Tveir)' : '')
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
      el('li', {}, [el('span', { texti: 'Ábyrgð' }), el('span', {}, [velAbyrgd])]),
      el('li', {}, [el('span', { texti: 'Skiladagur' }), el('span', {
        class: erSeint(t.skiladagur) && t.stada !== 'lokid' ? 'seint' : '',
        texti: dags(t.skiladagur, true) || 'Enginn'
      })]),
      t.verkefni ? el('li', {}, [el('span', { texti: 'Verkefni' }), el('span', { texti: t.verkefni.titill })]) : null,
      el('li', {}, [el('span', { texti: 'Stofnað' }), el('span', { texti: dags(t.stofnad, true) })])
    ]),

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
   Tasklína
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
        t.verkefni ? el('span', { texti: t.verkefni.titill }) : null,
        t.skiladagur ? el('span', {
          class: erSeint(t.skiladagur) && !lokid ? 'seint' : '',
          texti: (erSeint(t.skiladagur) && !lokid ? 'Rann út ' : 'Skil ') + dags(t.skiladagur)
        }) : null,
        t.abyrgd_notandi ? el('span', { texti: t.abyrgd_notandi.nafn }) : null
      ])
    ]),
    el('div', { class: 'task__hofn' }, [
      t.forgangur === 'hatt' && !lokid ? el('span', { class: 'pforg', texti: 'Hátt' }) : null,
      pilla(t.stada, 'task')
    ])
  ])]);
}

export { gogn, STODUR_TASK, STODUR_VERK, FORGANGUR, stillingar };
