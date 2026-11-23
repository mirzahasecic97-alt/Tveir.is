/* ==========================================================================
   Glerhúsið: eitt verkefni
   ========================================================================== */

import {
  gogn, el, tom, fylla, dags, sidan, erSeint, pilla, opnaTask, kronur, lesaTolu,
  vardaHlid, teiknaHaus, uppfaeraMerki, STODUR_VERK, stillingar, undirverkTala
, tolu, erEnska, setjaUpphaed, lesaUpphaed, snyrtaUpphaed, upphaedInntak, ertengt, tilkynna } from './portal.js';

const ek = await vardaHlid({ badir: true });
if (ek) start();

const VEITA_HEITI = { payday: 'Payday', dk: 'DK' };

/* Hvaða tengingar stofan hefur: bókhaldskerfi og gervigreind. Í
   sýnidæminu er allt sýnt (Payday ef ekkert bókhaldskerfi var valið). */
async function tengingar(g) {
  let t = null;
  try { t = g.tengingarStada ? await g.tengingarStada() : null; } catch (e) { t = null; }
  const veitur = ['payday', 'dk'].filter((v) => t && t[v]);
  if (g.prufa && !veitur.length) veitur.push(ertengt('dk') && !ertengt('payday') ? 'dk' : 'payday');
  return { veitur, gervigreind: g.prufa || !!(t && (t.claude || t.chatgpt)) };
}

async function start() {
  const g = await gogn();
  const admin = ek.hlutverk === 'admin';
  teiknaHaus(ek, admin ? 'Stjórnborð' : 'Vinnusvæði');

  const innihald = document.getElementById('innihald');
  const id = new URLSearchParams(location.search).get('id');
  const teng = admin ? await tengingar(g) : { veitur: [], gervigreind: false };
  /* Samantektin lifir meðan síðan er opin, svo hún hverfi ekki þegar
     eitthvað annað á síðunni teiknast upp á nýtt */
  let samantekt = null;

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
    const drogin = admin && teng.veitur.length && !v.innan_samnings
      ? await g.reikningar({ uppruni: 'verkefni', uppruni_id: v.id }).catch(() => []) : [];
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
            el('h2', { texti: 'Tímalína' }),
            taskar.length
              ? el('span', { class: 'pyfir__telja',
                             texti: lokin.length + ' af ' + taskar.length + ' búnum' })
              : null
          ]),

          taskar.length ? el('div', { class: 'framvinda framvinda--breid' }, [
            el('span', { style: 'width:' + v.framvinda + '%' })
          ]) : null,

          taskar.length
            ? el('ol', { class: 'timalina' }, taskar.map((t, i) => skref(t, i, taskar)))
            : el('p', { class: 'tomt',
                        texti: tillaga
                          ? 'Skrefin koma þegar verkefnið er samþykkt.'
                          : 'Engin skref enn.' }),

          admin && !tillaga
            ? el('button', { type: 'button', class: 'btn btn--sm btn--ghost',
                             style: 'margin-top:18px', texti: 'Bæta við skrefi',
                             onclick: () => nyrTaskIVerk(v) })
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
                        texti: taskar.length
                          ? v.framvinda + '% búið, ' + lokin.length + ' af ' + taskar.length + ' skrefum'
                          : 'Engin skref enn' })
            ]),

            /* Öll skref búin en verkefnið enn opið */
            admin && taskar.length && v.framvinda === 100 && v.stada !== 'lokid'
              ? el('button', {
                  type: 'button', class: 'btn btn--block btn--sm', style: 'margin-top:16px',
                  texti: 'Öll skref búin, loka verkefninu',
                  onclick: async () => { await g.uppfaeraVerkefni(v.id, { stada: 'lokid' }); teikna(); }
                })
              : null,

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
              el('div', { class: 'ath__haus' }, [el('strong', { texti: 'Svar frá stofunni' })]),
              el('div', { class: 'ath__texti', texti: v.svar_admin })
            ]) : null,

            admin ? adminStjorn(v) : null,
          ]),

          admin ? timaKort(v, innri, timalog, drogin) : null,

          admin && teng.gervigreind ? samantektKort(v) : null,


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

    uppfaeraMerki();
  }

  /* ------------------------------------------------------------------
     Eitt skref í tímalínunni
     ------------------------------------------------------------------ */
  function skref(t, i, allir) {
    const lokid = t.stada === 'lokid';
    const fyrstaOpna = allir.findIndex((x) => x.stada !== 'lokid');
    const nuna = !lokid && i === fyrstaOpna;

    async function faera(att) {
      const nagranni = allir[i + att];
      if (!nagranni) return;
      const minRod = Number(t.rod) || i + 1;
      const hinRod = Number(nagranni.rod) || i + 1 + att;
      await g.uppfaeraTask(t.id, { rod: hinRod });
      await g.uppfaeraTask(nagranni.id, { rod: minRod });
      teikna();
    }

    return el('li', {
      class: 'skref' + (lokid ? ' skref--lokid' : '') + (nuna ? ' skref--nuna' : '')
    }, [
      el('button', {
        type: 'button', class: 'skref__hak', 'aria-pressed': String(lokid),
        'aria-label': lokid ? 'Taka úr lokið' : 'Haka í lokið',
        disabled: !admin, title: admin ? '' : 'Við hökum í lokið',
        texti: String(i + 1),
        onclick: async () => {
          await g.uppfaeraTask(t.id, { stada: lokid ? 'i_vinnslu' : 'lokid' });
          teikna();
        }
      }),

      el('div', { class: 'skref__inn' }, [
        el('button', { type: 'button', class: 'skref__titill', texti: t.titill,
                       onclick: () => opnaTask(t.id, { admin, eftir: teikna }) }),
        el('div', { class: 'task__undir' }, [
          lokid ? null : pilla(t.stada, 'task'),
          t.forgangur === 'hatt' && !lokid ? el('span', { class: 'pforg', texti: 'Hátt' }) : null,
          t.abyrgd_notandi ? el('span', { texti: t.abyrgd_notandi.nafn }) : null,
          t.skiladagur ? el('span', {
            class: erSeint(t.skiladagur) && !lokid ? 'seint' : '',
            texti: (erSeint(t.skiladagur) && !lokid ? 'Rann út ' : 'Skil ') + dags(t.skiladagur)
          }) : null,
          lokid && t.lokid_dags ? el('span', { texti: 'Lokið ' + dags(t.lokid_dags) }) : null,
          undirverkTala(t)
        ])
      ]),

      admin ? el('div', { class: 'skref__fera' }, [
        el('button', { type: 'button', texti: '↑', 'aria-label': 'Færa ofar',
                       disabled: i === 0, onclick: () => faera(-1) }),
        el('button', { type: 'button', texti: '↓', 'aria-label': 'Færa neðar',
                       disabled: i === allir.length - 1, onclick: () => faera(1) })
      ]) : null
    ]);
  }

  /* ------------------------------------------------------------------
     Tímar og rukkun. Bara við sjáum þetta, það býr í sértöflu með
     sinni eigin stefnu svo viðskiptavinur nái ekki framlegðinni.
     ------------------------------------------------------------------ */
  function timaKort(v, innri, timalog, drogin) {
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
                     texti: 'Greitt' }),
      /* Sett af reikningsdrögunum (Payday eða DK), ekki valið hér */
      innri.reikningur === 'drog'
        ? el('option', { value: 'drog', selected: true, texti: 'Drög í bókhaldskerfi' }) : null
    ]);

    return el('div', { class: 'card pblokk', style: 'margin-top:clamp(16px,2vw,22px)' }, [
      el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500',
                 texti: 'Tímar og rukkun' }),

      el('div', { class: 'timar__tala', style: 'margin-top:14px',
                  texti: (erEnska() ? String(klst) : String(klst).replace('.', ',')) + ' klst.' }),

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
            el('b', { texti: (erEnska() ? String(t.klst) : String(t.klst).replace('.', ',')) + ' klst.' }),
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
      ]),

      v.innan_samnings ? null : reikningsdrog(v, innri, drogin)
    ]);
  }

  /* Reikningsdrög í Payday eða DK. Glugginn sjálfur er á Bókhaldi, þar
     sem farið er yfir línurnar áður en nokkuð er búið til. */
  function reikningsdrog(v, innri, drogin) {
    if (!teng.veitur.length) return null;
    const gild = drogin.filter((d) => d.stada !== 'villa');
    const d = gild[0] || drogin[0] || null;
    const slodBokhalds = 'bokhald.html?drog=' + encodeURIComponent('verkefni:' + v.id);
    const nafn = teng.veitur.map((x) => VEITA_HEITI[x]).join(' eða ');
    const born = [];

    if (d) {
      const veita = VEITA_HEITI[d.veita] || d.veita;
      const slod = /^https:\/\/\S+$/.test(String(d.ytri_slod || '')) ? d.ytri_slod : null;
      if (d.stada === 'drog') {
        born.push(el('span', { class: 'pstat pstat--ok', texti: 'Drög í ' + veita + (d.ytra_numer ? ' nr ' + d.ytra_numer : '') }));
        born.push(slod
          ? el('a', { class: 'btn btn--sm btn--ghost', href: slod, target: '_blank', rel: 'noopener noreferrer', texti: 'Opna í ' + veita })
          : el('p', { class: 'skyring', texti: 'Finndu drögin í ' + veita + ' undir sölureikningum og sendu þaðan.' }));
      } else if (d.stada === 'i_vinnslu') {
        born.push(el('span', { class: 'pstat pstat--vinnsla', texti: 'Drögin eru í vinnslu' }));
        born.push(el('a', { class: 'btn btn--sm btn--ghost', href: 'bokhald.html', texti: 'Sjá á Bókhaldi' }));
      } else {
        born.push(el('p', { class: 'skyring', style: 'color:#a3312a', texti: 'Drögin urðu ekki til: ' + (d.villa || 'villa') }));
      }
    }

    const tilbuid = v.stada === 'lokid' && (innri.reikningur || 'ekki_rukkad') === 'ekki_rukkad' && !gild.length;
    if (tilbuid && v.verd_okkar) {
      born.push(el('a', { class: 'btn btn--sm btn--block', href: slodBokhalds,
        texti: (d && d.stada === 'villa' ? 'Reyna aftur í ' : 'Búa til reikningsdrög í ') + nafn }));
      born.push(el('p', { class: 'skyring', texti: 'Þú ferð yfir línurnar á Bókhaldi áður en nokkuð er búið til.' }));
    } else if (tilbuid) {
      born.push(el('p', { class: 'skyring', texti: 'Settu verð á verkefnið til að búa til reikningsdrög í ' + nafn + '.' }));
    }
    if (!born.length) return null;
    return el('div', { style: 'margin-top:16px; display:flex; flex-direction:column; gap:10px; align-items:flex-start' }, [
      el('span', { style: 'font-size:13px; color:var(--soft)', texti: 'Reikningsdrög' }), ...born
    ]);
  }

  /* Samantekt frá gervigreind stofunnar. Ekki vistuð og ekki send neinum. */
  function samantektKort(v) {
    const svid = el('div', { 'aria-live': 'polite' });
    const hn = el('button', { type: 'button', class: 'btn btn--sm btn--ghost btn--block', texti: samantekt ? 'Skrifa nýja samantekt' : 'Samantekt með gervigreind' });
    const synaTexta = () => {
      if (!samantekt) { fylla(svid, []); return; }
      fylla(svid, [el('div', { class: 'ath', style: 'margin-top:14px' }, [
        el('div', { class: 'ath__haus' }, [el('strong', { texti: 'Drög frá gervigreind' }), el('span', { texti: 'Lestu yfir, ekkert var vistað' })]),
        el('div', { class: 'ath__texti', style: 'white-space:pre-wrap', texti: samantekt }),
        el('button', { type: 'button', class: 'sk-tengill', style: 'margin-top:10px', texti: 'Afrita',
          onclick: async () => {
            try { await navigator.clipboard.writeText(samantekt); tilkynna('Afritað'); }
            catch (e) { tilkynna('Náði ekki að afrita. Veldu textann og afritaðu hann.'); }
          } })
      ])]);
    };
    hn.addEventListener('click', async () => {
      hn.disabled = true; hn.textContent = 'Gervigreindin les verkefnið';
      try {
        const svar = await g.gervigreind('samantekt_verkefni', v.id);
        samantekt = String(svar.texti || '').trim() || null;
      } catch (villa) {
        fylla(svid, [el('p', { class: 'form-status form-status--err', style: 'margin-top:12px', texti: villa.message || 'Þetta gekk ekki.' })]);
        hn.disabled = false; hn.textContent = 'Samantekt með gervigreind';
        return;
      }
      hn.disabled = false; hn.textContent = 'Skrifa nýja samantekt';
      synaTexta();
    });
    synaTexta();
    return el('div', { class: 'card pblokk', style: 'margin-top:clamp(16px,2vw,22px)' }, [
      el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500', texti: 'Samantekt' }),
      el('p', { class: 'skyring', style: 'margin:8px 0 12px', texti: 'Gervigreindin les skrefin og nýjustu athugasemdirnar og dregur saman stöðuna. Hún sést bara hér.' }),
      hn, svid
    ]);
  }

  /* ------------------------------------------------------------------
     Stjórn okkar
     ------------------------------------------------------------------ */
  function adminStjorn(v) {
    const stadaVal = el('select', { 'aria-label': 'Staða verkefnis' },
      Object.keys(STODUR_VERK).map((s) =>
        el('option', { value: s, selected: v.stada === s, texti: STODUR_VERK[s].heiti })));

    const dagurVal = el('input', { type: 'date', value: v.skiladagur || '' });

    const verdVal = el('input', {
      type: 'text', inputmode: upphaedInntak(), 'aria-label': 'Verð okkar',
      placeholder: v.innan_samnings ? 'Innan áskriftar' : 'Verð okkar',
      onblur: () => snyrtaUpphaed(verdVal)
    });
    setjaUpphaed(verdVal, v.verd_okkar);
    const svarVal = el('textarea', { rows: '3', placeholder: 'Svar til viðskiptavinar' });
    svarVal.value = v.svar_admin || '';

    return el('div', { style: 'margin-top:20px; border-top:1px solid var(--line); padding-top:18px' }, [
      el('h3', { style: 'font-family:var(--f-body); font-weight:500; font-size:15px',
                 texti: 'Við stillum' }),
      el('form', { class: 'form-grid', style: 'margin-top:14px', onsubmit: async (e) => {
        e.preventDefault();
        await g.uppfaeraVerkefni(v.id, {
          stada: stadaVal.value,
          skiladagur: dagurVal.value || null,
          svar_admin: svarVal.value.trim() || null,
          verd_okkar: v.innan_samnings ? null : lesaUpphaed(verdVal)
        });
        teikna();
      } }, [
        el('label', { class: 'field' }, [el('span', { texti: 'Staða' }), stadaVal]),
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
    /* Bara við: skipta taskinum í undirverk strax, eitt í línu */
    const undir = admin ? el('textarea', { rows: '4', placeholder: 'Myndband 1\nMyndband 2\nMyndband 3\nMyndband 4' }) : null;
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
          const nyr = await g.nyrTask({
            titill: titill.value.trim(), lysing: lysing.value.trim() || null,
            verkefni_id: v.id, fyrirtaeki_id: v.fyrirtaeki_id, stada: 'nytt'
          });
          const titlar = undir
            ? undir.value.split(/\r?\n/).map((l) => l.trim().slice(0, 200)).filter(Boolean).slice(0, 30)
            : [];
          if (titlar.length) await g.nyUndirverk(nyr.id, titlar);
          d.close(); teikna();
        } catch (f) { villa.textContent = f.message; villa.hidden = false; }
      } }, [
        el('label', { class: 'field' }, [el('span', { texti: 'Titill' }), titill]),
        el('label', { class: 'field' }, [el('span', { texti: 'Lýsing' }), lysing]),
        undir ? el('label', { class: 'field' }, [
          el('span', { texti: 'Undirverk, eitt í línu (valkvætt)' }), undir,
          el('span', { class: 'skyring', texti: 'Til dæmis fjögur myndbönd. Þegar þú hakar í eitt og setur skrána eða hlekkinn með fær viðskiptavinurinn póst.' })
        ]) : null,
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
