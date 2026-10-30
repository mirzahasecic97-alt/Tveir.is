/* ==========================================================================
   Tveir vinnusvæði — eitt verkefni
   ========================================================================== */

import {
  gogn, el, tom, fylla, dags, sidan, erSeint, pilla, taskLina, kronur, lesaTolu,
  vardaHlid, teiknaHaus, STODUR_VERK, stillingar
} from './portal.js';

const ek = await vardaHlid({ badir: true });
if (ek) start();

async function start() {
  const g = await gogn();
  const admin = ek.hlutverk === 'admin';
  teiknaHaus(ek, admin ? 'Stjórnborð' : 'Vinnusvæði');

  const innihald = document.getElementById('innihald');
  const id = new URLSearchParams(location.search).get('id');

  async function teikna() {
    const v = id ? await g.verkefniEitt(id) : null;

    if (!v) {
      fylla(innihald, [el('div', { class: 'card pblokk' }, [
        el('h1', { style: 'font-size:26px', texti: 'Verkefnið fannst ekki' }),
        el('p', { class: 'lead', style: 'margin-top:10px',
                  texti: 'Hlekkurinn er líklega úr gildi fallinn.' }),
        el('a', { class: 'btn btn--sm', style: 'margin-top:18px',
                  href: admin ? 'stjornbord.html' : 'yfirlit.html', texti: 'Til baka' })
      ])]);
      return;
    }

    const taskar = await g.taskar({ verkefni_id: v.id });
    const innri = admin ? await g.innri(v.id) : null;
    const timalog = admin ? await g.timaskraning(v.id) : [];
    const opin = taskar.filter((t) => t.stada !== 'lokid');
    const lokin = taskar.filter((t) => t.stada === 'lokid');
    const tillaga = v.stada === 'tillaga';

    fylla(innihald, [
      el('a', { class: 'sodull', href: admin ? 'stjornbord.html' : 'yfirlit.html',
                style: 'text-decoration:none', texti: '← Til baka' }),

      el('div', { class: 'page-head', style: 'padding-top:14px' }, [
        el('div', { class: 'verk__linaein' }, [
          pilla(v.stada, 'verk'),
          admin && v.fyrirtaeki ? el('span', { class: 'verk__fyr', texti: v.fyrirtaeki.nafn }) : null
        ]),
        el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,42px); margin-top:12px', texti: v.titill }),
        v.lysing ? el('p', { class: 'lead', style: 'max-width:620px', texti: v.lysing }) : null
      ]),

      el('div', { class: 'pgrid', style: 'margin-top:clamp(22px,2.6vw,32px)' }, [

        el('section', { class: 'card pblokk' }, [
          el('div', { class: 'pyfir' }, [
            el('h2', { texti: 'Taskar í þessu verkefni' }),
            el('span', { class: 'pyfir__telja', texti: opin.length + ' opið' })
          ]),
          opin.length
            ? el('ul', { class: 'tasklisti' }, opin.map((t) => taskLina(t, { admin, eftir: teikna })))
            : el('p', { class: 'tomt',
                        texti: tillaga ? 'Taskar koma þegar verkefnið er samþykkt.' : 'Ekkert opið.' }),
          lokin.length
            ? el('details', { style: 'margin-top:14px' }, [
                el('summary', { class: 'sodull', style: 'cursor:pointer',
                                texti: lokin.length + ' lokið' }),
                el('ul', { class: 'tasklisti', style: 'margin-top:8px' },
                   lokin.map((t) => taskLina(t, { admin, eftir: teikna })))
              ])
            : null
        ]),

        el('aside', {}, [
          el('div', { class: 'card pblokk' }, [
            el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500',
                       texti: 'Staðan' }),

            tillaga ? null : el('div', { style: 'margin-top:16px' }, [
              el('div', { class: 'framvinda', style: 'flex:none; width:100%' }, [
                el('span', { style: 'width:' + v.framvinda + '%' })
              ]),
              el('p', { style: 'margin-top:8px; font-size:14px; color:var(--soft)',
                        texti: v.framvinda + '% búið' })
            ]),

            el('div', { style: 'margin-top:16px' }, [
              v.innan_samnings
                ? el('div', { class: 'verdlina' }, [
                    el('span', { texti: 'Greiðsla' }),
                    el('strong', { texti: 'Innan áskriftarinnar' })
                  ])
                : null,
              !v.innan_samnings && v.budget
                ? el('div', { class: 'verdlina' }, [
                    el('span', { texti: admin ? 'Þeirra budget' : 'Þitt budget' }),
                    el('strong', { texti: kronur(v.budget) })
                  ])
                : null,
              !v.innan_samnings && v.verd_okkar
                ? el('div', { class: 'verdlina verdlina--okkar' }, [
                    el('span', { texti: admin ? 'Verð okkar' : 'Verð' }),
                    el('strong', { texti: kronur(v.verd_okkar) })
                  ])
                : null
            ]),

            el('ul', { class: 'pmeta' }, [
              el('li', {}, [el('span', { texti: 'Staða' }),
                            el('span', { texti: (STODUR_VERK[v.stada] || {}).heiti || v.stada })]),
              el('li', {}, [el('span', { texti: 'Skiladagur' }), el('span', {
                class: erSeint(v.skiladagur) && v.stada !== 'lokid' ? 'seint' : '',
                texti: dags(v.skiladagur, true) || 'Óráðinn' })]),
              el('li', {}, [el('span', { texti: 'Stofnað' }), el('span', { texti: dags(v.stofnad, true) })])
            ]),

            v.svar_admin ? el('div', { class: 'ath ath--tveir', style: 'margin-top:16px' }, [
              el('div', { class: 'ath__haus' }, [el('strong', { texti: 'Svar frá Tveir' })]),
              el('div', { class: 'ath__texti', texti: v.svar_admin })
            ]) : null,

            admin ? adminStjorn(v) : null,
          ]),

          admin ? timaKort(v, innri, timalog) : null,


          !admin && !tillaga && v.stada !== 'lokid' && v.stada !== 'hafnad'
            ? el('div', { class: 'card pblokk', style: 'margin-top:clamp(16px,2vw,22px)' }, [
                el('button', { type: 'button', class: 'btn btn--block btn--sm btn--ghost',
                               texti: 'Nýr taskur í þetta',
                               onclick: () => nyrTaskIVerk(v) })
              ])
            : null
        ])
      ])
    ]);
  }

  /* ------------------------------------------------------------------
     Tímar og rukkun. Bara við sjáum þetta, það býr í sértöflu með
     sinni eigin stefnu svo viðskiptavinur nái ekki framlegðinni.
     ------------------------------------------------------------------ */
  function timaKort(v, innri, timalog) {
    const klst = Number(innri.klst) || 0;
    const aTimann = klst > 0 && v.verd_okkar ? Math.round(v.verd_okkar / klst) : null;
    const lagt = aTimann !== null && aTimann < (stillingar.timagjald || 0);

    async function baeta(n) {
      await g.skraTima(v.id, n, null);
      teikna();
    }

    const reikningur = el('select', {
      'aria-label': 'Reikningsstaða',
      onchange: async (e) => { await g.setjaReikning(v.id, e.target.value); teikna(); }
    }, [
      el('option', { value: 'ekki_rukkad', selected: innri.reikningur === 'ekki_rukkad',
                     texti: 'Ekki rukkað' }),
      el('option', { value: 'rukkad', selected: innri.reikningur === 'rukkad',
                     texti: 'Reikningur sendur' }),
      el('option', { value: 'greitt', selected: innri.reikningur === 'greitt',
                     texti: 'Greitt' })
    ]);

    return el('div', { class: 'card pblokk', style: 'margin-top:clamp(16px,2vw,22px)' }, [
      el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500',
                 texti: 'Tímar og rukkun' }),

      el('div', { class: 'timar__tala', style: 'margin-top:14px',
                  texti: String(klst).replace('.', ',') + ' klst.' }),

      v.innan_samnings
        ? el('p', { class: 'timar__hja', texti: 'Innan áskriftarinnar' })
        : aTimann !== null
          ? el('p', { class: 'timar__hja' + (lagt ? ' er-lagt' : '') }, [
              el('strong', { texti: kronur(aTimann) }),
              document.createTextNode(' á tímann')
            ])
          : el('p', { class: 'timar__hja',
                      texti: v.verd_okkar ? 'Engir tímar skráðir' : 'Ekkert verð sett' }),

      el('div', { class: 'timar__hnappar' },
        [1, 2, 4, 8].map((n) => el('button', {
          type: 'button', texti: '+' + n, 'aria-label': 'Bæta við ' + n + ' tímum',
          onclick: () => baeta(n)
        }))),

      timalog.length
        ? el('ul', { class: 'timalog' }, timalog.slice(0, 8).map((t) => el('li', {}, [
            el('b', { texti: String(t.klst).replace('.', ',') + ' klst.' }),
            el('span', { class: 'nota',
                         texti: (t.notandi_nafn ? t.notandi_nafn.nafn.split(' ')[0] : '')
                                + (t.nota ? ', ' + t.nota : '') }),
            el('span', { style: 'flex:none', texti: sidan(t.stofnad) }),
            el('button', {
              type: 'button', texti: '✕', 'aria-label': 'Eyða skráningu',
              onclick: async () => { await g.eydaTima(t.id); teikna(); }
            })
          ])))
        : null,

      v.innan_samnings ? null : el('div', { class: 'field', style: 'margin-top:18px' }, [
        el('span', { texti: 'Reikningur' }), reikningur
      ])
    ]);
  }

  /* ------------------------------------------------------------------
     Stjórn okkar
     ------------------------------------------------------------------ */
  function adminStjorn(v) {
    const stadaVal = el('select', { 'aria-label': 'Staða verkefnis' },
      Object.keys(STODUR_VERK).map((s) =>
        el('option', { value: s, selected: v.stada === s, texti: STODUR_VERK[s].heiti })));

    const framVal = el('input', {
      type: 'range', min: '0', max: '100', step: '5', value: String(v.framvinda),
      'aria-label': 'Framvinda', style: 'width:100%'
    });
    const framTala = el('span', { style: 'font-size:14px; color:var(--soft)', texti: v.framvinda + '%' });
    framVal.addEventListener('input', () => { framTala.textContent = framVal.value + '%'; });

    const dagurVal = el('input', { type: 'date', value: v.skiladagur || '' });

    const verdVal = el('input', {
      type: 'text', inputmode: 'numeric', 'aria-label': 'Verð okkar',
      placeholder: v.innan_samnings ? 'Innan áskriftar' : 'Verð okkar',
      value: v.verd_okkar ? kronur(v.verd_okkar).replace(' kr.', '') : '',
      onblur: () => {
        const t = lesaTolu(verdVal.value);
        verdVal.value = t ? kronur(t).replace(' kr.', '') : '';
      }
    });
    const svarVal = el('textarea', { rows: '3', placeholder: 'Svar til viðskiptavinar' });
    svarVal.value = v.svar_admin || '';

    return el('div', { style: 'margin-top:20px; border-top:1px solid var(--line); padding-top:18px' }, [
      el('h3', { style: 'font-family:var(--f-body); font-weight:500; font-size:15px',
                 texti: 'Við stillum' }),
      el('form', { class: 'form-grid', style: 'margin-top:14px', onsubmit: async (e) => {
        e.preventDefault();
        await g.uppfaeraVerkefni(v.id, {
          stada: stadaVal.value,
          framvinda: Number(framVal.value),
          skiladagur: dagurVal.value || null,
          svar_admin: svarVal.value.trim() || null,
          verd_okkar: v.innan_samnings ? null : lesaTolu(verdVal.value)
        });
        teikna();
      } }, [
        el('label', { class: 'field' }, [el('span', { texti: 'Staða' }), stadaVal]),
        el('label', { class: 'field' }, [
          el('span', {}, [document.createTextNode('Framvinda  '), framTala]), framVal
        ]),
        el('label', { class: 'field' }, [el('span', { texti: 'Skiladagur' }), dagurVal]),
        v.innan_samnings ? null
          : el('label', { class: 'field' }, [el('span', { texti: 'Verð okkar' }), verdVal]),
        el('label', { class: 'field' }, [el('span', { texti: 'Svar til viðskiptavinar' }), svarVal]),
        el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Vista' })
      ])
    ]);
  }

  function nyrTaskIVerk(v) {
    const titill = el('input', { type: 'text', required: true, placeholder: 'Hvað þarf að gerast' });
    const lysing = el('textarea', { rows: '3' });
    const villa = el('div', { class: 'form-status form-status--err', hidden: true });

    const d = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort' }, [
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { texti: 'Nýr taskur' }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                       onclick: () => d.close() })
      ]),
      el('p', { class: 'lead', style: 'font-size:14.5px; margin-top:6px', texti: v.titill }),
      el('form', { class: 'form-grid', style: 'margin-top:18px', onsubmit: async (e) => {
        e.preventDefault();
        if (!titill.value.trim()) { villa.textContent = 'Titill vantar.'; villa.hidden = false; return; }
        try {
          await g.nyrTask({
            titill: titill.value.trim(), lysing: lysing.value.trim() || null,
            verkefni_id: v.id, fyrirtaeki_id: v.fyrirtaeki_id, stada: 'nytt'
          });
          d.close(); teikna();
        } catch (f) { villa.textContent = f.message; villa.hidden = false; }
      } }, [
        el('label', { class: 'field' }, [el('span', { texti: 'Titill' }), titill]),
        el('label', { class: 'field' }, [el('span', { texti: 'Lýsing' }), lysing]),
        villa,
        el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Senda' })
      ])
    ])]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
    titill.focus();
  }

  teikna();
}
