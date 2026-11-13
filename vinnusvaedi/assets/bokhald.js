/* ==========================================================================
   Tveir vinnusvæði — bókhald
   Tekjur og gjöld á einum stað. Upphæðir eru geymdar án VSK og
   prósentan við hliðina, svo VSK uppgjörið fyrir hvert tveggja mánaða
   tímabil reiknast beint. Rukkuð verkefni og áskriftir mánaðarins
   færast inn með einni ýtingu. Bókarinn fær CSV.
   ========================================================================== */

import {
  gogn, el, fylla, dags, kronur, lesaTolu, vardaHlid, teiknaHaus
} from './portal.js';
import { FLOKKAR } from './gogn.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

const MANUDIR = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí',
                 'ágúst', 'september', 'október', 'nóvember', 'desember'];

const idag = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
};
const manudurNu = () => idag().slice(0, 7);
const vskAf = (f) => Math.round(Number(f.upphaed) * Number(f.vsk) / 100);
const flokkHeiti = (f) => (FLOKKAR[f.tegund] || {})[f.flokkur] || null;

/* Tímabilin á Íslandi eru tveir mánuðir. Gjalddagi er 5. dagur annars
   mánaðar eftir að tímabilinu lýkur. */
function timabilAf(dagsetning) {
  const d = new Date(dagsetning);
  return { ar: d.getFullYear(), nr: Math.floor(d.getMonth() / 2) };
}
function timabilHeiti(t) {
  const heiti = MANUDIR[t.nr * 2] + ' og ' + MANUDIR[t.nr * 2 + 1] + ' ' + t.ar;
  return heiti.charAt(0).toUpperCase() + heiti.slice(1);
}
function vskGjalddagi(t) {
  return new Date(t.ar, t.nr * 2 + 3, 5);
}
function iTimabili(f, t, heiltAr) {
  const d = new Date(f.dags);
  if (d.getFullYear() !== t.ar) return false;
  return heiltAr || Math.floor(d.getMonth() / 2) === t.nr;
}

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Bókhald');

  const innihald = document.getElementById('innihald');
  let timabil = timabilAf(new Date());
  let heiltAr = false;
  let syna = 'allt';

  async function teikna() {
    const [faerslur, verkefni, innri, fyrirtaeki] = await Promise.all([
      g.faerslur(), g.verkefni(), g.innri(), g.fyrirtaeki()
    ]);

    const iTimab = faerslur.filter((f) => iTimabili(f, timabil, heiltAr));
    const tekjur = iTimab.filter((f) => f.tegund === 'tekjur');
    const gjold = iTimab.filter((f) => f.tegund === 'gjold');
    const summa = (l) => l.reduce((a, f) => a + Number(f.upphaed), 0);
    const tekjurAlls = summa(tekjur);
    const gjoldAlls = summa(gjold);
    const utskattur = tekjur.reduce((a, f) => a + vskAf(f), 0);
    const innskattur = gjold.reduce((a, f) => a + vskAf(f), 0);
    const vskTilGreidslu = utskattur - innskattur;

    /* Rukkað á verkefnasíðunni en ekki komið í bókhaldið */
    const innriEftirId = {};
    (innri || []).forEach((i) => { innriEftirId[i.verkefni_id] = i; });
    const faerdVerkefni = new Set(faerslur.filter((f) => f.verkefni_id).map((f) => f.verkefni_id));
    const ofaerd = verkefni.filter((v) => {
      const i = innriEftirId[v.id];
      return i && i.reikningur !== 'ekki_rukkad' && Number(v.verd_okkar) > 0 && !faerdVerkefni.has(v.id);
    });

    /* Áskriftir þessa mánaðar sem eru ekki færðar */
    const man = manudurNu();
    const faerdarAskriftir = new Set(faerslur.filter((f) => f.askrift_manudur === man)
      .map((f) => f.fyrirtaeki_id));
    const askriftirEftir = fyrirtaeki.filter((f) =>
      f.er_askrift && Number(f.askrift_verd) > 0 && !faerdarAskriftir.has(f.id));

    /* Útistandandi: tekjur sem eru ekki greiddar, óháð tímabili */
    const utistandandi = faerslur.filter((f) => f.tegund === 'tekjur' && !f.greitt)
      .sort((a, b) => (a.dags || '').localeCompare(b.dags || ''));
    const utistandandiAlls = utistandandi.reduce((a, f) => a + Number(f.upphaed) + vskAf(f), 0);

    const syndar = syna === 'allt' ? iTimab : iTimab.filter((f) => f.tegund === syna);

    const gjalddagi = vskGjalddagi(timabil);

    fylla(innihald, [
      el('div', { class: 'page-head', style: 'padding-top:0' }, [
        el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Bókhald' }),
        el('p', { class: 'lead', texti: 'Allar upphæðir eru án VSK nema annað sé tekið fram.' })
      ]),

      /* ---------- tímabilið ---------- */
      el('div', { class: 'bok__timabil' }, [
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Fyrra tímabil', texti: '‹',
          onclick: () => {
            if (heiltAr) timabil = { ar: timabil.ar - 1, nr: timabil.nr };
            else timabil = timabil.nr === 0 ? { ar: timabil.ar - 1, nr: 5 } : { ar: timabil.ar, nr: timabil.nr - 1 };
            teikna();
          } }),
        el('strong', { texti: heiltAr ? 'Allt árið ' + timabil.ar : timabilHeiti(timabil) }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Næsta tímabil', texti: '›',
          onclick: () => {
            if (heiltAr) timabil = { ar: timabil.ar + 1, nr: timabil.nr };
            else timabil = timabil.nr === 5 ? { ar: timabil.ar + 1, nr: 0 } : { ar: timabil.ar, nr: timabil.nr + 1 };
            teikna();
          } }),
        el('div', { class: 'pflipar', style: 'margin:0 0 0 auto' }, [
          el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(!heiltAr), texti: 'VSK tímabil',
                         onclick: () => { heiltAr = false; teikna(); } }),
          el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(heiltAr), texti: 'Allt árið',
                         onclick: () => { heiltAr = true; teikna(); } })
        ])
      ]),

      el('dl', { class: 'tekjur', style: 'margin-top:14px' }, [
        el('div', { class: 'adal' }, [el('dt', { texti: 'Tekjur' }), el('dd', { texti: kronur(tekjurAlls) })]),
        el('div', {}, [el('dt', { texti: 'Gjöld' }), el('dd', { texti: kronur(gjoldAlls) })]),
        el('div', { class: tekjurAlls - gjoldAlls < 0 ? 'vidvorun' : '' }, [
          el('dt', { texti: 'Afkoma' }), el('dd', { texti: kronur(tekjurAlls - gjoldAlls) })
        ]),
        el('div', {}, [
          el('dt', { texti: heiltAr ? 'VSK á árinu' : 'VSK til greiðslu ' + dags(gjalddagi) }),
          el('dd', { texti: kronur(vskTilGreidslu) })
        ])
      ]),
      el('p', { class: 'skyring', style: 'margin-top:10px',
        texti: 'Útskattur ' + kronur(utskattur) + ', innskattur ' + kronur(innskattur) }),

      /* ---------- það sem á eftir að færa ---------- */
      ofaerd.length ? el('div', { class: 'tilkynning', style: 'margin-top:20px' }, [
        el('div', { class: 'tilkynning__inn' }, [
          el('strong', { texti: ofaerd.length === 1
            ? 'Eitt rukkað verkefni er ekki komið í bókhaldið'
            : ofaerd.length + ' rukkuð verkefni eru ekki komin í bókhaldið' }),
          el('ul', { class: 'rukkun', style: 'margin-top:6px' }, ofaerd.map((v) => el('li', {}, [
            el('span', { class: 'nafn', texti: v.titill + (v.fyrirtaeki ? ', ' + v.fyrirtaeki.nafn : '') }),
            el('span', { class: 'upph', texti: kronur(v.verd_okkar) }),
            el('button', { type: 'button', texti: 'Færa', onclick: async (e) => {
              e.currentTarget.disabled = true;
              const i = innriEftirId[v.id];
              await g.nyFaersla({
                tegund: 'tekjur', dags: i.reikningur_dags || idag(), lysing: v.titill,
                flokkur: 'verkefni', upphaed: Number(v.verd_okkar), vsk: 24,
                fyrirtaeki_id: v.fyrirtaeki_id, verkefni_id: v.id,
                greitt: i.reikningur === 'greitt',
                greitt_dags: i.reikningur === 'greitt' ? idag() : null
              });
              teikna();
            } })
          ])))
        ])
      ]) : null,

      askriftirEftir.length ? el('div', { class: 'tilkynning', style: 'margin-top:14px' }, [
        el('div', { class: 'tilkynning__inn' }, [
          el('strong', { texti: 'Áskriftir fyrir ' + MANUDIR[new Date().getMonth()] + ' eru ekki færðar' }),
          el('span', { class: 'undir', texti: askriftirEftir.map((f) => f.nafn + ' ' + kronur(f.askrift_verd)).join(', ') })
        ]),
        el('button', { type: 'button', class: 'btn btn--sm', texti: askriftirEftir.length === 1 ? 'Færa' : 'Færa allar',
          onclick: async (e) => {
            e.currentTarget.disabled = true;
            for (const f of askriftirEftir) {
              await g.nyFaersla({
                tegund: 'tekjur', dags: man + '-01', lysing: 'Áskrift: ' + (f.askrift || f.nafn),
                flokkur: 'askrift', upphaed: Number(f.askrift_verd), vsk: 24,
                fyrirtaeki_id: f.id, askrift_manudur: man
              });
            }
            teikna();
          } })
      ]) : null,

      el('div', { class: 'pgrid', style: 'margin-top:clamp(18px,2.2vw,26px)' }, [
        el('div', { class: 'pmain' }, [
          el('section', { class: 'card pblokk' }, [
            el('div', { class: 'pyfir' }, [
              el('h2', { texti: 'Færslur' }),
              el('div', { class: 'bok__hnappar' }, [
                el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Skrá gjöld',
                               onclick: () => opna({ tegund: 'gjold' }) }),
                el('button', { type: 'button', class: 'btn btn--sm', texti: 'Skrá tekjur',
                               onclick: () => opna({ tegund: 'tekjur' }) })
              ])
            ]),
            el('div', { class: 'okkar__sia', style: 'margin-top:0' }, [
              el('div', { class: 'pflipar', style: 'margin-bottom:0' }, [
                flipi('allt', 'Allt', iTimab.length),
                flipi('tekjur', 'Tekjur', tekjur.length),
                flipi('gjold', 'Gjöld', gjold.length)
              ]),
              el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Sækja CSV',
                             disabled: !iTimab.length, onclick: () => saekjaCsv(iTimab) })
            ]),
            syndar.length
              ? el('ul', { class: 'tasklisti' }, syndar.map(lina))
              : el('p', { class: 'tomt', texti: 'Ekkert fært á þessu tímabili.' })
          ])
        ]),

        el('aside', { class: 'pside' }, [
          el('div', { class: 'card pblokk' }, [
            el('div', { class: 'pyfir', style: 'margin-bottom:6px' }, [
              el('h2', { texti: 'Útistandandi' }),
              el('span', { class: 'pyfir__telja', texti: kronur(utistandandiAlls) + ' með VSK' })
            ]),
            utistandandi.length
              ? el('ul', { class: 'rukkun' }, utistandandi.map((f) => el('li', {}, [
                  el('span', { class: 'nafn' }, [
                    document.createTextNode(f.fyrirtaeki ? f.fyrirtaeki.nafn : f.lysing),
                    el('span', { class: 'bok__smatt',
                      texti: (f.reikningsnr ? 'Nr. ' + f.reikningsnr + ', ' : '') + dags(f.dags)
                        + (f.gjalddagi && new Date(f.gjalddagi) < new Date() ? ', komið fram yfir' : '') })
                  ]),
                  el('span', { class: 'upph', texti: kronur(Number(f.upphaed) + vskAf(f)) }),
                  el('button', { type: 'button', texti: 'Greitt', onclick: async (e) => {
                    e.currentTarget.disabled = true;
                    await g.uppfaeraFaerslu(f.id, { greitt: true, greitt_dags: idag() });
                    teikna();
                  } })
                ])))
              : el('p', { class: 'tomt', style: 'padding:20px 0', texti: 'Allt greitt.' })
          ]),
          g.prufa ? el('div', { class: 'prufubanner', style: 'margin:0' }, [
            el('strong', { texti: 'Prufustilling. ' }),
            document.createTextNode('Þetta eru sýnidæmi í þessum vafra.')
          ]) : null
        ])
      ])
    ]);

    function flipi(gildi, heiti, fjoldi) {
      return el('button', {
        type: 'button', class: 'pflipi', 'aria-pressed': String(syna === gildi),
        onclick: () => { syna = gildi; teikna(); }
      }, [document.createTextNode(heiti + ' '), el('b', { texti: String(fjoldi) })]);
    }

    function lina(f) {
      const tekj = f.tegund === 'tekjur';
      return el('li', {}, [el('div', { class: 'task' }, [
        el('span', { class: 'bok__merki bok__merki--' + f.tegund, 'aria-hidden': 'true', texti: tekj ? '+' : '−' }),
        el('div', { class: 'task__mid' }, [
          el('button', { type: 'button', class: 'task__titill', texti: f.lysing, onclick: () => opna(f) }),
          el('div', { class: 'task__undir' }, [
            el('span', { texti: dags(f.dags) }),
            flokkHeiti(f) ? el('span', { texti: flokkHeiti(f) }) : null,
            f.fyrirtaeki ? el('span', { texti: f.fyrirtaeki.nafn }) : null,
            el('span', { texti: 'VSK ' + String(f.vsk).replace('.0', '') + '%' })
          ])
        ]),
        el('div', { class: 'task__hofn' }, [
          el('span', { class: 'bok__upph' + (tekj ? ' er-tekjur' : ''), texti: (tekj ? '' : '−') + kronur(f.upphaed) }),
          tekj ? el('span', { class: 'pstat pstat--' + (f.greitt ? 'ok' : 'bid'), texti: f.greitt ? 'Greitt' : 'Ógreitt' }) : null
        ])
      ])]);
    }

    /* ------------------------------------------------------------------
       Spjaldið: ný færsla eða breyting
       ------------------------------------------------------------------ */
    function opna(f) {
      const ny = !f.id;
      const tegund = el('select', {}, [
        el('option', { value: 'tekjur', selected: f.tegund === 'tekjur', texti: 'Tekjur' }),
        el('option', { value: 'gjold', selected: f.tegund === 'gjold', texti: 'Gjöld' })
      ]);
      const flokkur = el('select', {});
      const fyllaFlokka = () => {
        fylla(flokkur, Object.entries(FLOKKAR[tegund.value]).map(([k, h]) =>
          el('option', { value: k, selected: f.flokkur === k, texti: h })));
      };
      fyllaFlokka();

      const dagsetning = el('input', { type: 'date', value: f.dags || idag(), required: true });
      const lysing = el('input', { type: 'text', value: f.lysing || '', maxlength: '200', required: true,
                                   placeholder: f.tegund === 'gjold' ? 'T.d. Adobe, leiga, auglýsingar' : 'T.d. Vefsíða fyrir Fossberg' });
      const upphaed = el('input', { type: 'text', inputmode: 'numeric', required: true, placeholder: '0',
                                    value: f.upphaed ? String(f.upphaed).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '' });
      const medVsk = el('select', { 'aria-label': 'Er upphæðin með eða án VSK' }, [
        el('option', { value: 'an', texti: 'án VSK' }),
        el('option', { value: 'med', selected: ny && f.tegund === 'gjold', texti: 'með VSK' })
      ]);
      const vsk = el('select', {}, [24, 11, 0].map((p) =>
        el('option', { value: String(p), selected: Number(f.vsk ?? 24) === p, texti: p + '%' })));
      const reikningur = el('input', { type: 'text', value: f.reikningsnr || '', maxlength: '40' });
      const gjalddagi = el('input', { type: 'date', value: f.gjalddagi || '' });
      const fyrVal = el('select', {}, [el('option', { value: '', texti: 'Ekkert' })].concat(
        fyrirtaeki.map((x) => el('option', { value: x.id, selected: f.fyrirtaeki_id === x.id, texti: x.nafn }))));
      const greitt = el('input', { type: 'checkbox' });
      greitt.checked = ny ? f.tegund === 'gjold' : !!f.greitt;
      const nota = el('textarea', { rows: '2' }, [f.nota || '']);
      const reikningsLina = el('p', { class: 'skyring', style: 'margin-top:-6px' });
      const stadan = el('div', { class: 'form-status', hidden: true });

      function reikna() {
        const tala = lesaTolu(upphaed.value) || 0;
        const p = Number(vsk.value);
        const an = medVsk.value === 'med' ? Math.round(tala / (1 + p / 100)) : tala;
        const skattur = Math.round(an * p / 100);
        reikningsLina.textContent = 'Án VSK ' + kronur(an) + ', VSK ' + kronur(skattur)
          + ', alls ' + kronur(an + skattur);
        return an;
      }
      [upphaed, vsk, medVsk].forEach((n) => n.addEventListener('input', reikna));
      [vsk, medVsk].forEach((n) => n.addEventListener('change', reikna));
      tegund.addEventListener('change', () => { f.flokkur = null; fyllaFlokka(); });
      reikna();

      let stadfest = false;
      const eyda = ny ? null : el('button', { type: 'button', class: 'spjald__eyda', texti: 'Eyða',
        onclick: async (e) => {
          if (!stadfest) {
            stadfest = true;
            e.currentTarget.textContent = 'Ýttu aftur til að eyða';
            e.currentTarget.classList.add('er-vis');
            setTimeout(() => {
              stadfest = false;
              if (!eyda.isConnected) return;
              eyda.textContent = 'Eyða'; eyda.classList.remove('er-vis');
            }, 4000);
            return;
          }
          await g.eydaFaerslu(f.id);
          d.close(); teikna();
        } });

      const d = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort' }, [
        el('div', { class: 'pdialog__haus' }, [
          el('h2', { texti: ny ? (f.tegund === 'gjold' ? 'Skrá gjöld' : 'Skrá tekjur') : 'Færsla' }),
          el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
        ]),
        el('form', {
          style: 'margin-top:18px; display:flex; flex-direction:column; gap:16px',
          novalidate: true,
          onsubmit: async (e) => {
            e.preventDefault();
            const an = reikna();
            if (!lysing.value.trim()) { lysing.focus(); return; }
            if (!an) { upphaed.focus(); return; }
            const faersla = {
              tegund: tegund.value, dags: dagsetning.value || idag(), lysing: lysing.value.trim(),
              flokkur: flokkur.value || null, upphaed: an, vsk: Number(vsk.value),
              reikningsnr: reikningur.value.trim() || null, gjalddagi: gjalddagi.value || null,
              fyrirtaeki_id: fyrVal.value || null, greitt: greitt.checked,
              greitt_dags: greitt.checked ? (f.greitt_dags || idag()) : null,
              nota: nota.value.trim() || null
            };
            try {
              if (ny) await g.nyFaersla(faersla); else await g.uppfaeraFaerslu(f.id, faersla);
              d.close(); teikna();
            } catch (villa) {
              stadan.hidden = false;
              stadan.className = 'form-status form-status--err';
              stadan.textContent = villa.message || 'Þetta gekk ekki.';
            }
          }
        }, [
          el('div', { class: 'field-row' }, [
            el('label', { class: 'field' }, [el('span', { texti: 'Tegund' }), tegund]),
            el('label', { class: 'field' }, [el('span', { texti: 'Dagsetning' }), dagsetning])
          ]),
          el('label', { class: 'field' }, [el('span', { texti: 'Lýsing' }), lysing]),
          el('div', { class: 'field-row' }, [
            el('label', { class: 'field' }, [el('span', { texti: 'Upphæð' }),
              el('div', { class: 'bok__upphaed' }, [upphaed, medVsk])]),
            el('label', { class: 'field' }, [el('span', { texti: 'VSK' }), vsk])
          ]),
          reikningsLina,
          el('div', { class: 'field-row' }, [
            el('label', { class: 'field' }, [el('span', { texti: 'Flokkur' }), flokkur]),
            el('label', { class: 'field' }, [el('span', { texti: 'Fyrirtæki' }), fyrVal])
          ]),
          el('div', { class: 'field-row' }, [
            el('label', { class: 'field' }, [el('span', { texti: 'Reikningsnúmer' }), reikningur]),
            el('label', { class: 'field' }, [el('span', { texti: 'Gjalddagi' }), gjalddagi])
          ]),
          el('label', { class: 'bok__tikk' }, [greitt, el('span', { texti: 'Greitt' })]),
          el('label', { class: 'field' }, [el('span', { texti: 'Nóta' }), nota]),
          stadan,
          el('div', { class: 'spjald__fot' }, [
            el('button', { type: 'submit', class: 'btn btn--sm', texti: ny ? 'Skrá' : 'Vista' }),
            eyda
          ])
        ])
      ])]);

      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
      d.addEventListener('close', () => d.remove());
      document.body.append(d);
      d.showModal();
      if (ny) lysing.focus();
    }
  }

  /* CSV fyrir bókarann. Semíkomma og BOM svo Excel opni íslensku stafina rétt. */
  function saekjaCsv(listi) {
    const hreinsa = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const linur = [['Dagsetning', 'Tegund', 'Lýsing', 'Flokkur', 'Fyrirtæki', 'Reikningsnr.',
                    'Án VSK', 'VSK %', 'VSK', 'Með VSK', 'Greitt', 'Nóta']];
    [...listi].sort((a, b) => (a.dags || '').localeCompare(b.dags || '')).forEach((f) => {
      const s = vskAf(f);
      linur.push([f.dags, f.tegund === 'tekjur' ? 'Tekjur' : 'Gjöld', f.lysing, flokkHeiti(f) || '',
                  f.fyrirtaeki ? f.fyrirtaeki.nafn : '', f.reikningsnr || '',
                  f.upphaed, String(f.vsk).replace('.0', ''), s, Number(f.upphaed) + s,
                  f.greitt ? 'Já' : 'Nei', f.nota || '']);
    });
    const texti = '﻿' + linur.map((l) => l.map(hreinsa).join(';')).join('\r\n');
    const slod = URL.createObjectURL(new Blob([texti], { type: 'text/csv;charset=utf-8' }));
    const heiti = heiltAr ? 'bokhald-' + timabil.ar : 'bokhald-' + timabil.ar + '-'
      + String(timabil.nr * 2 + 1).padStart(2, '0') + '-' + String(timabil.nr * 2 + 2).padStart(2, '0');
    const a = el('a', { href: slod, download: heiti + '.csv' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(slod), 2000);
  }

  teikna();
}
