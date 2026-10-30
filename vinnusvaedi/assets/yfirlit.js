/* ==========================================================================
   Tveir vinnusvæði — yfirlit viðskiptavinar
   ========================================================================== */

import {
  gogn, el, tom, fylla, dags, erSeint, pilla, taskLina, kronur, lesaTolu,
  vardaHlid, teiknaHaus, erUppsett, opnaUppsetningu, STODUR_VERK
} from './portal.js';

const ek = await vardaHlid({});
if (ek) start();

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Vinnusvæði');

  const innihald = document.getElementById('innihald');
  let flipi = 'opid';

  async function teikna() {
    const [verkefni, taskar] = await Promise.all([
      g.verkefni(ek.fyrirtaeki_id),
      g.taskar({ fyrirtaeki_id: ek.fyrirtaeki_id })
    ]);

    const bidurMin = taskar.filter((t) => t.stada === 'bid_vidskiptavinar');
    const opin = taskar.filter((t) => t.stada !== 'lokid');

    const syndir = flipi === 'allt' ? taskar
      : flipi === 'bidur' ? bidurMin
      : flipi === 'lokid' ? taskar.filter((t) => t.stada === 'lokid')
      : opin;

    const lifandiVerk = verkefni.filter((v) => !['lokid', 'hafnad'].includes(v.stada));
    const lokinVerk = verkefni.filter((v) => ['lokid', 'hafnad'].includes(v.stada));

    fylla(innihald, [
      el('div', { class: 'page-head', style: 'padding-top:0' }, [
        el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)',
                   texti: 'Hæ ' + ek.nafn.split(' ')[0] }),
        el('p', { class: 'lead',
          texti: opin.length
            ? 'Hér er staðan á öllu sem við erum með í höndunum fyrir þig.'
            : 'Það er ekkert opið hjá okkur fyrir þig núna. Sendu okkur verkefni ef eitthvað er á döfinni.' })
      ]),

      el('div', { class: 'pgrid', style: 'margin-top:clamp(22px,2.6vw,32px)' }, [

        /* ---------- samantekt, efst í síma ---------- */
        el('div', { class: 'psum' }, [bidurKort(bidurMin)]),

        /* ---------- vinstri ---------- */
        el('div', { class: 'pmain' }, [

          el('section', { class: 'card pblokk' }, [
            el('div', { class: 'pyfir' }, [
              el('h2', { texti: 'Verkefni' }),
              el('span', { class: 'pyfir__telja',
                           texti: lifandiVerk.length + (lifandiVerk.length === 1 ? ' í gangi' : ' í gangi') })
            ]),
            lifandiVerk.length
              ? el('div', { class: 'verk-listi' }, lifandiVerk.map(verkKort))
              : el('p', { class: 'tomt', texti: 'Ekkert verkefni í gangi.' }),

            lokinVerk.length
              ? el('details', { style: 'margin-top:16px' }, [
                  el('summary', { class: 'sodull', style: 'cursor:pointer',
                                  texti: lokinVerk.length + ' eldri verkefni' }),
                  el('div', { class: 'verk-listi', style: 'margin-top:12px' }, lokinVerk.map(verkKort))
                ])
              : null
          ]),

          el('section', { class: 'card pblokk' }, [
            el('div', { class: 'pyfir' }, [el('h2', { texti: 'Taskar' })]),
            el('div', { class: 'pflipar' }, [
              flipiHnappur('opid',  'Opið',      opin.length),
              flipiHnappur('bidur', 'Bíður þín', bidurMin.length),
              flipiHnappur('lokid', 'Lokið',     taskar.length - opin.length),
              flipiHnappur('allt',  'Allt',      taskar.length)
            ]),
            syndir.length
              ? el('ul', { class: 'tasklisti' }, syndir.map((t) => taskLina(t, { admin: false, eftir: teikna })))
              : el('p', { class: 'tomt', texti: 'Ekkert hér.' })
          ])
        ]),

        /* ---------- hægri ---------- */
        el('aside', { class: 'pside' }, [
          el('div', { class: 'card pblokk' }, [
            el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500',
                       texti: 'Senda okkur eitthvað' }),
            el('p', { class: 'lead', style: 'font-size:14px; margin-top:8px',
                      texti: 'Lítil breyting fer sem taskur. Eitthvað stærra fer sem verkefni sem við skoðum og samþykkjum.' }),
            el('button', { type: 'button', class: 'btn btn--block btn--sm', style: 'margin-top:16px',
                           texti: 'Nýr taskur', onclick: () => opnaTaskForm(lifandiVerk) }),
            el('button', { type: 'button', class: 'btn btn--block btn--sm btn--ghost', style: 'margin-top:8px',
                           texti: 'Senda verkefni', onclick: () => opnaVerkForm() })
          ]),

          simaKort(),

          el('div', { class: 'card pblokk' }, [
            el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500',
                       texti: 'Þarftu okkur strax' }),
            el('p', { class: 'lead', style: 'font-size:14px; margin-top:8px',
                      texti: 'Ef eitthvað er brotið eða brennur má alltaf hringja.' }),
            el('p', { style: 'margin-top:12px; font-size:14.5px' }, [
              el('a', { href: 'tel:+3548572319', texti: '857-2319' }),
              document.createTextNode('  ·  '),
              el('a', { href: 'mailto:tveir@tveir.is', texti: 'tveir@tveir.is' })
            ])
          ])
        ])
      ])
    ]);
  }

  /* ------------------------------------------------------------------
     Hlutar
     ------------------------------------------------------------------ */

  function flipiHnappur(gildi, heiti, fjoldi) {
    return el('button', {
      type: 'button', class: 'pflipi', 'aria-pressed': String(flipi === gildi),
      onclick: () => { flipi = gildi; teikna(); }
    }, [document.createTextNode(heiti), el('b', { texti: String(fjoldi) })]);
  }

  /* Minnir á heimaskjáinn þangað til það er gert eða felið */
  const SIMALYKILL = 'tveir-simakort-falid';

  function simaKort() {
    if (erUppsett()) return null;
    try {
      if (localStorage.getItem(SIMALYKILL) === 'ja') return null;
    } catch (e) { /* lokað localStorage, sýnum þá bara kortið */ }

    const kort = el('div', { class: 'card simakort' }, [
      el('div', { class: 'simakort__haus' }, [
        el('img', { src: 'assets/takn-192.png', alt: '', width: '40', height: '40' }),
        el('h2', { texti: 'Hafðu þetta við höndina' }),
        el('button', {
          type: 'button', class: 'simakort__loka', 'aria-label': 'Fela þessa ábendingu',
          texti: '✕',
          onclick: () => {
            try { localStorage.setItem(SIMALYKILL, 'ja'); } catch (e) { /* sleppum */ }
            kort.remove();
          }
        })
      ]),
      el('p', { class: 'lead', style: 'font-size:14px; margin-top:10px',
                texti: 'Settu vinnusvæðið á heimaskjáinn. Þá opnast það eins og app og '
                     + 'þú þarft ekki að leita að hlekknum í póstinum.' }),
      el('button', { type: 'button', class: 'btn btn--block btn--sm', style: 'margin-top:14px',
                     texti: 'Sýna mér hvernig', onclick: () => opnaUppsetningu() })
    ]);
    return kort;
  }

  function verkKort(v) {
    return el('a', { class: 'verk', href: 'verk.html?id=' + encodeURIComponent(v.id) }, [
      el('div', { class: 'verk__linaein' }, [
        el('span', { class: 'verk__titill', texti: v.titill }),
        pilla(v.stada, 'verk')
      ]),
      v.lysing ? el('p', { class: 'verk__lysing', texti: v.lysing }) : null,
      el('div', { class: 'verk__fot' }, [
        v.stada === 'tillaga' || v.stada === 'hafnad' ? null : el('span', { class: 'framvinda' }, [
          el('span', { style: 'width:' + v.framvinda + '%' })
        ]),
        v.stada === 'tillaga' || v.stada === 'hafnad' ? null : el('span', { texti: v.framvinda + '%' }),
        v.skiladagur ? el('span', {
          class: erSeint(v.skiladagur) && v.stada !== 'lokid' ? 'seint' : '',
          texti: 'Skil ' + dags(v.skiladagur)
        }) : null,
        verdMerki(v)
      ])
    ]);
  }

  /* Græna merðið er það sem við höfum samþykkt, hitt er það sem þú baust. */
  function verdMerki(v) {
    if (v.innan_samnings) return el('span', { class: 'verd verd--innan', texti: 'Í áskrift' });
    if (v.verd_okkar) return el('span', { class: 'verd', texti: kronur(v.verd_okkar) });
    if (v.budget) return el('span', { class: 'verd verd--innan',
                                      texti: 'Budget ' + kronur(v.budget) });
    return null;
  }

  function bidurKort(listi) {
    const tomt = listi.length === 0;
    return el('div', { class: 'card card--navy bidur' + (tomt ? ' bidur--tomt' : '') }, [
      el('h2', { texti: 'Bíður þín' }),
      el('div', { class: 'bidur__tala', texti: tomt ? 'Ekkert' : String(listi.length) }),
      el('p', { class: 'bidur__texti',
        texti: tomt
          ? 'Við bíðum ekki á neinu frá þér. Boltinn er hjá okkur.'
          : listi.length === 1
            ? 'Við bíðum á einu frá þér til að halda áfram.'
            : 'Við bíðum á þessu frá þér til að halda áfram.' }),
      tomt ? null : el('ul', { class: 'bidur__listi' }, listi.slice(0, 6).map((t) =>
        el('li', {}, [el('a', { href: '#', onclick: (e) => {
          e.preventDefault();
          import('./portal.js').then((m) => m.opnaTask(t.id, { admin: false, eftir: teikna }));
        } }, [
          document.createTextNode(t.titill),
          /* Sami titill getur verið í tveimur verkefnum, verkefnisnafnið skilur á milli */
          erSeint(t.skiladagur)
            ? el('span', { class: 'dags', style: 'color:#ffb4ae',
                           texti: 'Rann út ' + dags(t.skiladagur) })
            : t.verkefni
              ? el('span', { class: 'dags', texti: t.verkefni.titill })
              : t.skiladagur
                ? el('span', { class: 'dags', texti: dags(t.skiladagur) })
                : null
        ])])))
    ]);
  }

  /* ------------------------------------------------------------------
     Form
     ------------------------------------------------------------------ */

  function spjald(innihaldBorn) {
    const d = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort' }, innihaldBorn)]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
    const fyrsta = d.querySelector('input, textarea, select');
    if (fyrsta) fyrsta.focus();
    return d;
  }

  async function opnaTaskForm(verkefniListi) {
    const notendur = await g.notendur();
    const tveir = notendur.filter((n) => n.hlutverk === 'admin');

    const titill = el('input', { type: 'text', required: true, placeholder: 'Hvað þarf að gerast' });
    const lysing = el('textarea', { rows: '4', placeholder: 'Nánari lýsing ef þarf' });
    const dagur  = el('input', { type: 'date' });
    const verkVal = el('select', {}, [el('option', { value: '', texti: 'Stakt, ekki hluti af verkefni' })]
      .concat(verkefniListi.map((v) => el('option', { value: v.id, texti: v.titill }))));
    const abyrgdVal = el('select', {}, [el('option', { value: '', texti: 'Annaðhvort okkar' })]
      .concat(tveir.map((n) => el('option', { value: n.id, texti: n.nafn }))));
    const forgVal = el('select', {}, [
      el('option', { value: 'venjulegt', texti: 'Venjulegt' }),
      el('option', { value: 'hatt', texti: 'Hátt, þetta liggur á' })
    ]);
    const villa = el('div', { class: 'form-status form-status--err', hidden: true });

    const d = spjald([
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { texti: 'Nýr taskur' }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                       onclick: () => d.close() })
      ]),
      el('p', { class: 'lead', style: 'font-size:14.5px; margin-top:6px',
                texti: 'Við fáum póst um leið og þú sendir.' }),
      el('form', { class: 'form-grid', style: 'margin-top:20px', onsubmit: async (e) => {
        e.preventDefault();
        if (!titill.value.trim()) { villa.textContent = 'Titill vantar.'; villa.hidden = false; return; }
        try {
          await g.nyrTask({
            titill: titill.value.trim(),
            lysing: lysing.value.trim() || null,
            verkefni_id: verkVal.value || null,
            abyrgd: abyrgdVal.value || null,
            forgangur: forgVal.value,
            skiladagur: dagur.value || null,
            stada: 'nytt'
          });
          d.close(); teikna();
        } catch (v) { villa.textContent = v.message; villa.hidden = false; }
      } }, [
        el('label', { class: 'field' }, [el('span', { texti: 'Titill' }), titill]),
        el('label', { class: 'field' }, [el('span', { texti: 'Lýsing' }), lysing]),
        el('label', { class: 'field' }, [el('span', { texti: 'Tilheyrir verkefni' }), verkVal]),
        el('div', { class: 'field-row' }, [
          el('label', { class: 'field' }, [el('span', { texti: 'Á hvorn' }), abyrgdVal]),
          el('label', { class: 'field' }, [el('span', { texti: 'Forgangur' }), forgVal])
        ]),
        el('label', { class: 'field' }, [el('span', { texti: 'Þarf að vera komið' }), dagur]),
        villa,
        el('button', { type: 'submit', class: 'btn', style: 'margin-top:4px', texti: 'Senda taskinn' })
      ])
    ]);
  }

  function opnaVerkForm() {
    const askrift = !!(ek.fyrirtaeki && ek.fyrirtaeki.er_askrift);

    const titill = el('input', { type: 'text', required: true, placeholder: 'Til dæmis: ný vefsíða' });
    const lysing = el('textarea', { rows: '5', placeholder: 'Hvað viltu að við gerðum og hvers vegna' });
    const dagur  = el('input', { type: 'date' });
    const villa  = el('div', { class: 'form-status form-status--err', hidden: true });

    const budget = el('input', {
      type: 'text', inputmode: 'numeric', placeholder: 'Til dæmis 250.000',
      'aria-label': 'Budget í krónum',
      onblur: () => {
        const t = lesaTolu(budget.value);
        budget.value = t ? kronur(t).replace(' kr.', '') : '';
      }
    });

    const flytir = el('div', { class: 'budgetflyt' },
      [150000, 300000, 500000, 1000000].map((n) => el('button', {
        type: 'button', texti: kronur(n),
        onclick: () => { budget.value = kronur(n).replace(' kr.', ''); budget.focus(); }
      })));

    const budgetReitur = el('div', { class: 'field' }, [
      el('span', { texti: 'Budget í krónum' }),
      budget,
      el('p', { class: 'skyring',
                texti: 'Gróft mat dugar. Við svörum með raunverði og þú ræður hvort þú heldur áfram.' }),
      flytir
    ]);

    const greidsla = askrift ? el('select', {
      'aria-label': 'Hvernig er þetta greitt',
      onchange: () => { budgetReitur.hidden = greidsla.value === 'innan'; }
    }, [
      el('option', { value: 'innan', texti: 'Innan áskriftarinnar' }),
      el('option', { value: 'ser',   texti: 'Sér verkefni, greitt sérstaklega' })
    ]) : null;

    if (askrift) budgetReitur.hidden = true;

    const d = spjald([
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { texti: 'Senda okkur verkefni' }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                       onclick: () => d.close() })
      ]),
      el('p', { class: 'lead', style: 'font-size:14.5px; margin-top:6px',
        texti: askrift
          ? 'Við skoðum þetta og svörum með verði og tímalínu áður en við byrjum. Ef það rúmast ekki innan áskriftarinnar þarf budget að fylgja.'
          : 'Við skoðum þetta og svörum með verði og tímalínu áður en við byrjum. Budget þarf að fylgja svo við vitum hvað við erum að vinna með.' }),
      el('form', { class: 'form-grid', style: 'margin-top:20px', onsubmit: async (e) => {
        e.preventDefault();
        const innan = askrift && greidsla.value === 'innan';
        const upphaed = lesaTolu(budget.value);

        if (!titill.value.trim()) {
          villa.textContent = 'Titill vantar.'; villa.hidden = false; return;
        }
        if (!innan && !upphaed) {
          villa.textContent = 'Budget vantar. Við þurfum að vita hvað verkefnið má kosta '
            + 'áður en við svörum.';
          villa.hidden = false; budget.focus(); return;
        }
        try {
          await g.nyVerkefnatillaga({
            titill: titill.value.trim(),
            lysing: lysing.value.trim() || null,
            skiladagur: dagur.value || null,
            budget: innan ? null : upphaed,
            innan_samnings: innan
          });
          d.close(); teikna();
        } catch (v) { villa.textContent = v.message; villa.hidden = false; }
      } }, [
        el('label', { class: 'field' }, [el('span', { texti: 'Hvað er verkefnið' }), titill]),
        el('label', { class: 'field' }, [el('span', { texti: 'Lýsing' }), lysing]),
        askrift ? el('div', { class: 'field' }, [
          el('span', { texti: 'Hvernig er þetta greitt' }), greidsla
        ]) : null,
        budgetReitur,
        el('label', { class: 'field' }, [el('span', { texti: 'Hvenær þarf það að vera komið' }), dagur]),
        villa,
        el('button', { type: 'submit', class: 'btn', style: 'margin-top:4px', texti: 'Senda til samþykkis' })
      ])
    ]);
  }

  teikna();
}
