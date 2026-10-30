/* ==========================================================================
   Tveir vinnusvæði — stjórnborð okkar
   ========================================================================== */

import {
  gogn, el, tom, dags, erSeint, pilla, taskLina,
  vardaHlid, teiknaHaus, STODUR_VERK
} from './portal.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Stjórnborð');

  const innihald = document.getElementById('innihald');
  let flipi = 'opid';
  let fyrirtaekiSia = '';

  async function teikna() {
    const [verkefni, taskar, fyrirtaeki, notendur] = await Promise.all([
      g.verkefni(), g.taskar({}), g.fyrirtaeki(), g.notendur()
    ]);

    const tillogur = verkefni.filter((v) => v.stada === 'tillaga');
    const otengdir = notendur.filter((n) => n.hlutverk !== 'admin' && !n.fyrirtaeki_id);

    const siad = taskar.filter((t) => !fyrirtaekiSia || t.fyrirtaeki_id === fyrirtaekiSia);
    const opin = siad.filter((t) => t.stada !== 'lokid');
    const nyir = siad.filter((t) => t.stada === 'nytt');
    const seinir = siad.filter((t) => t.stada !== 'lokid' && erSeint(t.skiladagur));

    const syndir = flipi === 'allt' ? siad
      : flipi === 'nytt' ? nyir
      : flipi === 'seint' ? seinir
      : flipi === 'lokid' ? siad.filter((t) => t.stada === 'lokid')
      : opin;

    tom(innihald).append(
      el('div', { class: 'page-head', style: 'padding-top:0' }, [
        el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Stjórnborð' }),
        el('p', { class: 'lead',
          texti: nyir.length
            ? nyir.length + (nyir.length === 1 ? ' nýr taskur bíður okkar.' : ' nýir taskar bíða okkar.')
            : 'Ekkert nýtt hefur komið inn.' })
      ]),

      /* ---------- tillögur ---------- */
      tillogur.length ? el('section', { class: 'card pblokk', style: 'margin-top:26px' }, [
        el('div', { class: 'pyfir' }, [
          el('h2', { texti: 'Bíður samþykkis' }),
          el('span', { class: 'pyfir__telja', texti: tillogur.length + (tillogur.length === 1 ? ' tillaga' : ' tillögur') })
        ]),
        el('div', {}, tillogur.map(tillagaKort))
      ]) : null,

      el('div', { class: 'pgrid', style: 'margin-top:clamp(18px,2.2vw,26px)' }, [

        /* ---------- samantekt, efst í síma ---------- */
        el('div', { class: 'psum' }, [seintKort(seinir)]),

        /* ---------- taskar ---------- */
        el('div', { class: 'pmain' }, [
          el('section', { class: 'card pblokk' }, [
            el('div', { class: 'pyfir' }, [
              el('h2', { texti: 'Taskar' }),
              el('select', {
                'aria-label': 'Fyrirtæki',
                onchange: (e) => { fyrirtaekiSia = e.target.value; teikna(); }
              }, [el('option', { value: '', texti: 'Öll fyrirtæki' })].concat(
                fyrirtaeki.map((f) => el('option', {
                  value: f.id, selected: fyrirtaekiSia === f.id, texti: f.nafn }))))
            ]),
            el('div', { class: 'pflipar' }, [
              flipiHnappur('opid',  'Opið',  opin.length),
              flipiHnappur('nytt',  'Nýtt',  nyir.length),
              flipiHnappur('seint', 'Á eftir', seinir.length),
              flipiHnappur('lokid', 'Lokið', siad.length - opin.length),
              flipiHnappur('allt',  'Allt',  siad.length)
            ]),
            syndir.length
              ? el('ul', { class: 'tasklisti' }, syndir.map((t) => taskLina(t, { admin: true, eftir: teikna })))
              : el('p', { class: 'tomt', texti: 'Ekkert hér.' })
          ]),

          /* ---------- verkefni í gangi ---------- */
          el('section', { class: 'card pblokk' }, [
            el('div', { class: 'pyfir' }, [el('h2', { texti: 'Verkefni í gangi' })]),
            (() => {
              const lifandi = verkefni.filter((v) => ['samthykkt', 'i_vinnslu', 'bid_svar'].includes(v.stada)
                && (!fyrirtaekiSia || v.fyrirtaeki_id === fyrirtaekiSia));
              return lifandi.length
                ? el('div', { class: 'verk-listi' }, lifandi.map((v) =>
                    el('a', { class: 'verk', href: 'verk.html?id=' + encodeURIComponent(v.id) }, [
                      el('div', { class: 'verk__linaein' }, [
                        el('span', { class: 'verk__titill', texti: v.titill }),
                        el('span', { class: 'verk__fyr', texti: v.fyrirtaeki ? v.fyrirtaeki.nafn : '' }),
                        pilla(v.stada, 'verk')
                      ]),
                      el('div', { class: 'verk__fot' }, [
                        el('span', { class: 'framvinda' }, [el('span', { style: 'width:' + v.framvinda + '%' })]),
                        el('span', { texti: v.framvinda + '%' }),
                        v.skiladagur ? el('span', {
                          class: erSeint(v.skiladagur) ? 'seint' : '',
                          texti: 'Skil ' + dags(v.skiladagur) }) : null
                      ])
                    ])))
                : el('p', { class: 'tomt', texti: 'Ekkert verkefni í gangi.' });
            })()
          ])
        ]),

        /* ---------- hægri ---------- */
        el('aside', { class: 'pside' }, [

          /* fyrirtæki */
          el('div', { class: 'card pblokk' }, [
            el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500',
                       texti: 'Fyrirtæki' }),
            el('div', { class: 'ptafla-skrun', style: 'margin-top:12px' }, [
              el('table', { class: 'ptafla' }, [
                el('tbody', {}, fyrirtaeki.map((f) => {
                  const op = taskar.filter((t) => t.fyrirtaeki_id === f.id && t.stada !== 'lokid').length;
                  return el('tr', {}, [
                    el('td', { class: 'nafn', texti: f.nafn }),
                    el('td', { style: 'color:var(--soft); text-align:right',
                               texti: op + ' opið' })
                  ]);
                }))
              ])
            ]),
            el('button', { type: 'button', class: 'btn btn--block btn--sm btn--ghost',
                           style: 'margin-top:14px', texti: 'Nýtt fyrirtæki',
                           onclick: () => nyttFyrirtaekiForm() })
          ]),

          /* notendur sem þarf að tengja */
          otengdir.length ? el('div', { class: 'card pblokk' }, [
            el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500',
                       texti: 'Óteng notendur' }),
            el('p', { class: 'lead', style: 'font-size:14px; margin-top:8px',
                      texti: 'Þessi aðgangur sér ekkert fyrr en hann er tengdur fyrirtæki.' }),
            el('div', { style: 'margin-top:14px; display:flex; flex-direction:column; gap:14px' },
              otengdir.map((n) => el('div', {}, [
                el('div', { style: 'font-size:14.5px; font-weight:500', texti: n.nafn }),
                el('div', { style: 'font-size:13px; color:var(--soft)', texti: n.netfang }),
                el('select', {
                  style: 'margin-top:8px; width:100%',
                  'aria-label': 'Tengja ' + n.nafn + ' við fyrirtæki',
                  onchange: async (e) => {
                    if (!e.target.value) return;
                    await g.tengjaNotanda(n.id, e.target.value);
                    teikna();
                  }
                }, [el('option', { value: '', texti: 'Velja fyrirtæki' })].concat(
                  fyrirtaeki.map((f) => el('option', { value: f.id, texti: f.nafn }))))
              ])))
          ]) : null,

          g.prufa ? el('div', { class: 'prufubanner', style: 'margin:0' }, [
            el('strong', { texti: 'Prufustilling. ' }),
            document.createTextNode('Gögnin eru sýnidæmi í þessum vafra. '),
            el('a', { href: '#', style: 'color:inherit; text-decoration:underline',
                      texti: 'Byrja upp á nýtt', onclick: (e) => {
              e.preventDefault(); g.hreinsa(); location.reload();
            } })
          ]) : null
        ])
      ])
    );
  }

  /* ------------------------------------------------------------------
     Hlutar
     ------------------------------------------------------------------ */

  function seintKort(seinir) {
    return el('div', { class: 'card card--navy bidur' + (seinir.length ? '' : ' bidur--tomt') }, [
      el('h2', { texti: 'Á eftir áætlun' }),
      el('div', { class: 'bidur__tala', texti: seinir.length ? String(seinir.length) : 'Ekkert' }),
      el('p', { class: 'bidur__texti',
        texti: seinir.length
          ? 'Skiladagurinn er liðinn á þessu.'
          : 'Allt er innan skiladags.' }),
      seinir.length ? el('ul', { class: 'bidur__listi' }, seinir.slice(0, 6).map((t) =>
        el('li', {}, [el('a', { href: '#', onclick: (e) => {
          e.preventDefault();
          import('./portal.js').then((m) => m.opnaTask(t.id, { admin: true, eftir: teikna }));
        } }, [
          document.createTextNode(t.titill),
          el('span', { class: 'dags', texti: t.fyrirtaeki ? t.fyrirtaeki.nafn : '' })
        ])]))) : null
    ]);
  }

  function flipiHnappur(gildi, heiti, fjoldi) {
    return el('button', {
      type: 'button', class: 'pflipi', 'aria-pressed': String(flipi === gildi),
      onclick: () => { flipi = gildi; teikna(); }
    }, [document.createTextNode(heiti), el('b', { texti: String(fjoldi) })]);
  }

  function tillagaKort(v) {
    const svar = el('textarea', { rows: '2', placeholder: 'Svar til viðskiptavinar, verð eða tímalína' });
    const dagur = el('input', { type: 'date', value: v.skiladagur || '' });

    return el('div', { class: 'tillaga' }, [
      el('div', { class: 'verk__linaein' }, [
        el('span', { class: 'verk__titill', texti: v.titill }),
        el('span', { class: 'verk__fyr', texti: v.fyrirtaeki ? v.fyrirtaeki.nafn : '' }),
        el('span', { class: 'sodull', style: 'margin-left:auto', texti: dags(v.stofnad) })
      ]),
      v.lysing ? el('p', { class: 'lead', style: 'font-size:14.5px; margin-top:8px', texti: v.lysing }) : null,
      v.skiladagur ? el('p', { style: 'font-size:13.5px; color:var(--soft); margin-top:8px',
                               texti: 'Þau vilja það fyrir ' + dags(v.skiladagur, true) }) : null,

      el('div', { class: 'field', style: 'margin-top:14px' }, [el('span', { texti: 'Svar' }), svar]),
      el('div', { class: 'field', style: 'margin-top:12px' }, [
        el('span', { texti: 'Skiladagur sem við lofum' }), dagur
      ]),

      el('div', { class: 'tillaga__hnappar' }, [
        el('button', { type: 'button', class: 'btn btn--sm', texti: 'Samþykkja', onclick: async () => {
          await g.uppfaeraVerkefni(v.id, {
            stada: 'samthykkt',
            svar_admin: svar.value.trim() || null,
            skiladagur: dagur.value || null
          });
          teikna();
        } }),
        el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Ekki taka', onclick: async () => {
          await g.uppfaeraVerkefni(v.id, {
            stada: 'hafnad',
            svar_admin: svar.value.trim() || null
          });
          teikna();
        } }),
        el('a', { class: 'sodull', style: 'margin-left:auto; text-decoration:none',
                  href: 'verk.html?id=' + encodeURIComponent(v.id), texti: 'Opna →' })
      ])
    ]);
  }

  function nyttFyrirtaekiForm() {
    const nafn = el('input', { type: 'text', required: true, placeholder: 'Nafn fyrirtækis' });
    const askrift = el('input', { type: 'text', placeholder: 'Til dæmis: vefsíða í áskrift' });
    const villa = el('div', { class: 'form-status form-status--err', hidden: true });

    const d = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort' }, [
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { texti: 'Nýtt fyrirtæki' }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                       onclick: () => d.close() })
      ]),
      el('form', { class: 'form-grid', style: 'margin-top:18px', onsubmit: async (e) => {
        e.preventDefault();
        if (!nafn.value.trim()) { villa.textContent = 'Nafn vantar.'; villa.hidden = false; return; }
        try {
          await g.nyttFyrirtaeki(nafn.value.trim(), askrift.value.trim() || null);
          d.close(); teikna();
        } catch (f) { villa.textContent = f.message; villa.hidden = false; }
      } }, [
        el('label', { class: 'field' }, [el('span', { texti: 'Nafn' }), nafn]),
        el('label', { class: 'field' }, [el('span', { texti: 'Áskrift' }), askrift]),
        villa,
        el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Búa til' })
      ])
    ])]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
    nafn.focus();
  }

  teikna();
}
