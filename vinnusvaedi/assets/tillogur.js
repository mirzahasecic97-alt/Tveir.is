/* ==========================================================================
   Tveir vinnusvæði — verkefnatillögur sem bíða okkar
   ========================================================================== */

import {
  gogn, el, tom, fylla, dags, kronur, lesaTolu,
  vardaHlid, teiknaHaus, uppfaeraMerki
} from './portal.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Tillögur');

  const innihald = document.getElementById('innihald');

  async function teikna() {
    const verkefni = await g.verkefni();
    const tillogur = verkefni.filter((v) => v.stada === 'tillaga');
    const svarad = verkefni
      .filter((v) => v.stada === 'hafnad')
      .slice(0, 8);

    fylla(innihald, [
      el('div', { class: 'page-head', style: 'padding-top:0' }, [
        el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Tillögur' }),
        el('p', { class: 'lead', style: 'max-width:620px',
          texti: tillogur.length
            ? 'Verkefni sem viðskiptavinir hafa sent okkur. Við svörum með verði og tímalínu áður en nokkuð byrjar.'
            : 'Ekkert bíður okkar núna. Nýjar tillögur frá viðskiptavinum lenda hér.' })
      ]),

      tillogur.length
        ? el('div', { style: 'margin-top:clamp(22px,2.6vw,32px); display:flex; flex-direction:column; gap:14px' },
             tillogur.map(tillagaKort))
        : el('div', { class: 'card pblokk', style: 'margin-top:26px' }, [
            el('p', { class: 'tomt', texti: 'Engin tillaga bíður.' })
          ]),

      svarad.length
        ? el('section', { class: 'card pblokk', style: 'margin-top:clamp(18px,2.2vw,26px)' }, [
            el('div', { class: 'pyfir' }, [el('h2', { texti: 'Ekki tekið' })]),
            el('div', { class: 'verk-listi' }, svarad.map((v) =>
              el('a', { class: 'verk', href: 'verk.html?id=' + encodeURIComponent(v.id) }, [
                el('div', { class: 'verk__linaein' }, [
                  el('span', { class: 'verk__titill', texti: v.titill }),
                  el('span', { class: 'verk__fyr', texti: v.fyrirtaeki ? v.fyrirtaeki.nafn : '' })
                ]),
                v.svar_admin ? el('p', { class: 'verk__lysing', texti: v.svar_admin }) : null
              ])))
          ])
        : null
    ]);

    uppfaeraMerki();
  }

  /* ------------------------------------------------------------------
     Eitt svar
     ------------------------------------------------------------------ */
  function tillagaKort(v) {
    const svar = el('textarea', { rows: '2', placeholder: 'Svar til viðskiptavinar, verð eða tímalína' });
    const dagur = el('input', { type: 'date', value: v.skiladagur || '' });

    const verd = el('input', {
      type: 'text', inputmode: 'numeric', placeholder: 'Hvað ætlum við að taka',
      'aria-label': 'Verð okkar',
      value: v.budget ? kronur(v.budget).replace(' kr.', '') : '',
      onblur: () => {
        const t = lesaTolu(verd.value);
        verd.value = t ? kronur(t).replace(' kr.', '') : '';
      }
    });

    const verdReitur = el('div', { class: 'field', style: 'margin-top:12px' }, [
      el('span', { texti: 'Verð okkar' }), verd
    ]);

    const greidsla = el('select', {
      'aria-label': 'Hvernig þetta er greitt',
      onchange: () => { verdReitur.hidden = greidsla.value === 'innan'; }
    }, [
      el('option', { value: 'ser', selected: !v.innan_samnings,
                     texti: 'Sér verkefni, greitt sérstaklega' }),
      el('option', { value: 'innan', selected: v.innan_samnings,
                     texti: 'Innan áskriftarinnar' })
    ]);
    if (v.innan_samnings) verdReitur.hidden = true;

    async function svara(stada) {
      const innan = greidsla.value === 'innan';
      await g.uppfaeraVerkefni(v.id, {
        stada,
        svar_admin: svar.value.trim() || null,
        skiladagur: dagur.value || null,
        innan_samnings: innan,
        verd_okkar: innan ? null : lesaTolu(verd.value)
      });
      teikna();
    }

    return el('div', { class: 'tillaga' }, [
      el('div', { class: 'verk__linaein' }, [
        el('span', { class: 'verk__titill', texti: v.titill }),
        el('span', { class: 'verk__fyr', texti: v.fyrirtaeki ? v.fyrirtaeki.nafn : '' }),
        el('span', { class: 'sodull', style: 'margin-left:auto', texti: dags(v.stofnad) })
      ]),
      v.lysing ? el('p', { class: 'lead', style: 'font-size:14.5px; margin-top:8px', texti: v.lysing }) : null,

      el('div', { style: 'margin-top:12px' }, [
        el('div', { class: 'verdlina' }, [
          el('span', { texti: 'Þau sendu' }),
          v.innan_samnings
            ? el('strong', { texti: 'Innan áskriftarinnar, ekkert budget' })
            : el('strong', { texti: kronur(v.budget) || 'Ekkert budget' })
        ]),
        v.skiladagur ? el('div', { class: 'verdlina' }, [
          el('span', { texti: 'Þau vilja það fyrir' }),
          el('strong', { texti: dags(v.skiladagur, true) })
        ]) : null
      ]),

      el('div', { class: 'field', style: 'margin-top:14px' }, [
        el('span', { texti: 'Hvernig þetta er greitt' }), greidsla
      ]),
      verdReitur,
      el('div', { class: 'field', style: 'margin-top:12px' }, [el('span', { texti: 'Svar' }), svar]),
      el('div', { class: 'field', style: 'margin-top:12px' }, [
        el('span', { texti: 'Skiladagur sem við lofum' }), dagur
      ]),

      el('div', { class: 'tillaga__hnappar' }, [
        el('button', { type: 'button', class: 'btn btn--sm', texti: 'Samþykkja',
                       onclick: () => svara('samthykkt') }),
        el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Ekki taka',
                       onclick: () => svara('hafnad') })
      ])
    ]);
  }

  teikna();
}
