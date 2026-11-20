/* ==========================================================================
   Glerhúsið: undirverk
   Mörg skil innan eins tasks, til dæmis fjögur myndbönd. Við hökum í eitt,
   setjum skrána eða hlekkinn með, og verk-postur.gs sendir viðskiptavininum
   póst innan 5 mínútna. Viðskiptavinur sér listann en breytir engu.
   ========================================================================== */

import { el, fylla, dags, staerd } from './portal.js';
import { stillingar } from './stillingar.js';

const HAMARK_MB = Number(stillingar.undirverkHamarkMb) || 50;

/* "2 af 4 lokið" á spjöldum. Ekkert ef taskurinn hefur engin undirverk. */
export function undirverkTala(t) {
  const listi = (t && t.undirverk) || [];
  if (!listi.length) return null;
  const lokin = listi.filter((u) => u.lokid).length;
  return el('span', {
    class: 'uvtala' + (lokin === listi.length ? ' uvtala--buid' : ''),
    texti: lokin + ' af ' + listi.length + ' lokið'
  });
}

/* Bara https hlekkir. Annað (javascript:, data:, http) kemst ekki inn. */
export function lesaTengil(texti) {
  const hreint = String(texti || '').trim();
  if (!hreint) return null;
  let slod;
  try { slod = new URL(hreint); } catch (e) { return false; }
  if (slod.protocol !== 'https:' || /\s/.test(hreint) || hreint.length > 2000) return false;
  return slod.href;
}

function lenAf(tengill) {
  try { return new URL(tengill).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

/* Hlutinn í taskspjaldinu. teiknaAftur() opnar spjaldið upp á nýtt
   með nýjum gögnum, eftir() uppfærir listann á bak við. */
export function undirverkHluti({ t, listi, admin, g, teiknaAftur, eftir }) {
  if (!admin && !listi.length) return null;

  const lokin = listi.filter((u) => u.lokid).length;
  let opidSpjald = null;

  async function eftirBreytingu() {
    if (eftir) eftir();
    await teiknaAftur();
  }

  /* Villa í hakinu, nafninu, röðinni eða eyðingu birtist hér, á íslensku,
     í stað þess að týnast í console. */
  const villuReitur = el('div', { class: 'form-status form-status--err', role: 'alert', hidden: true });
  async function reyna(verk) {
    villuReitur.hidden = true;
    try {
      await verk();
    } catch (villa) {
      villuReitur.textContent = (villa && villa.message) || 'Þetta gekk ekki. Prófaðu aftur.';
      villuReitur.hidden = false;
    }
  }

  /* ---------- ein lína ---------- */
  function lina(u, i) {
    const afhending = el('div', { class: 'uv__afhending', hidden: true });

    const hak = el('button', {
      type: 'button', class: 'hak', 'aria-pressed': String(u.lokid),
      'aria-label': u.lokid ? 'Taka úr lokið' : 'Haka í lokið',
      disabled: !admin, title: admin ? '' : 'Við hökum í lokið',
      onclick: async () => {
        if (u.lokid) {
          await reyna(async () => {
            await g.uppfaeraUndirverk(u.id, { lokid: false });
            await eftirBreytingu();
          });
          return;
        }
        opnaAfhendingu(u, afhending);
      }
    });

    let titill;
    if (admin) {
      titill = el('button', {
        type: 'button', class: 'uv__titill', texti: u.titill, title: 'Smelltu til að breyta nafninu',
        onclick: () => {
          const inntak = el('input', { type: 'text', class: 'uv__inntak', value: u.titill,
                                       maxlength: '200', 'aria-label': 'Nafn undirverks' });
          let buid = false;
          const vista = async () => {
            if (buid) return; buid = true;
            const nytt = inntak.value.trim();
            if (nytt && nytt !== u.titill) {
              await reyna(async () => {
                try {
                  await g.uppfaeraUndirverk(u.id, { titill: nytt.slice(0, 200) });
                } catch (villa) {
                  inntak.replaceWith(titill);
                  throw villa;
                }
                await eftirBreytingu();
              });
            } else {
              inntak.replaceWith(titill);
            }
          };
          inntak.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); vista(); }
            if (e.key === 'Escape') { e.preventDefault(); buid = true; inntak.replaceWith(titill); }
          });
          inntak.addEventListener('blur', vista);
          titill.replaceWith(inntak);
          inntak.focus(); inntak.select();
        }
      });
    } else {
      titill = el('span', { class: 'uv__titill', texti: u.titill });
    }

    /* Skráin eða hlekkurinn. Viðskiptavinur sér það bara þegar lokið er. */
    const synaSkil = admin || u.lokid;
    const skil = [];
    if (synaSkil && u.tengill) {
      skil.push(el('a', { class: 'uv__skil', href: u.tengill, target: '_blank',
                          rel: 'noopener noreferrer', texti: lenAf(u.tengill) ? 'Opna hlekk (' + lenAf(u.tengill) + ')' : 'Opna hlekk' }));
    }
    if (synaSkil && u.skra_slod) {
      skil.push(el('button', {
        type: 'button', class: 'uv__skil uv__skil--hnappur',
        onclick: async (e) => {
          const hnappur = e.currentTarget;
          hnappur.disabled = true;
          try {
            const slod = await g.slodAUndirverki(u);
            window.open(slod, '_blank', 'noopener');
          } catch (villa) {
            hnappur.title = villa.message;
            hnappur.textContent = 'Skráin fannst ekki';
          } finally {
            hnappur.disabled = false;
          }
        }
      }, [
        admin ? null : document.createTextNode('Hlaða niður: '),
        el('span', { 'data-ekki-thyda': '', texti: u.skra_nafn }),
        u.skra_staerd ? document.createTextNode(' (' + staerd(u.skra_staerd) + ')') : null
      ]));
    }

    let postur = null;
    if (admin && u.lokid) {
      postur = !u.senda
        ? el('span', { texti: 'Enginn póstur' })
        : u.sent_dags && (!u.lokid_dags || new Date(u.sent_dags) >= new Date(u.lokid_dags))
          ? el('span', { class: 'uv__sent', texti: 'Sent ' + dags(u.sent_dags) })
          : el('span', { class: 'uv__bidur', texti: 'Póstur fer innan 5 mín.' });
    }

    /* Dagurinn á dagatalinu. Stjórnandi breytir honum hér, viðskiptavinur sér hann. */
    let dagsHluti = null;
    if (admin) {
      const reitur = el('input', { type: 'date', class: 'uv__dags', value: u.dags || '', 'aria-label': 'Dagur fyrir ' + u.titill,
        title: 'Dagur á dagatalinu' });
      /* Vistað þegar farið er úr reitnum eða ýtt á Enter, ekki í miðjum
         innslætti. Fari dagurinn fram yfir skiladag tasksins færist hann með. */
      /* Bara heill dagur vistast. Hálfskrifaður reitur (tómur) þurrkar aldrei út
         daginn; hann er tekinn af á Dagatalinu. */
      let sidast = reitur.value;
      let ibid = false;
      const gildur = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000 && Number(v.slice(0, 4)) <= 2100;
      const vista = () => {
        const v = reitur.value;
        if (ibid || v === sidast || !gildur(v)) return;
        ibid = true;
        reyna(async () => {
          try {
            await g.uppfaeraUndirverk(u.id, { dags: v });
            sidast = v;
            const skil = t && t.skiladagur ? String(t.skiladagur).slice(0, 10) : null;
            if (t && (!skil || v > skil)) { await g.uppfaeraTask(t.id, { skiladagur: v }); t.skiladagur = v; }
          } finally { ibid = false; }
          /* Lokaði fólk glugganum á meðan: bara uppfæra listann á bak við */
          const gluggi = reitur.closest('dialog');
          if (gluggi && !gluggi.open) { if (eftir) eftir(); return; }
          await eftirBreytingu();
        });
      };
      reitur.addEventListener('blur', vista);
      reitur.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); vista(); } });
      dagsHluti = reitur;
    } else if (u.dags && !u.lokid) {
      dagsHluti = el('span', { class: 'uv__aaetlad', texti: 'Áætlað ' + dags(String(u.dags).slice(0, 10) + 'T12:00:00') });
    }

    async function faera(att) {
      const nagranni = listi[i + att];
      if (!nagranni) return;
      const minRod = Number(u.rod) || i + 1;
      const hinRod = Number(nagranni.rod) || i + 1 + att;
      await reyna(async () => {
        await g.uppfaeraUndirverk(u.id, { rod: minRod === hinRod ? hinRod + att : hinRod });
        await g.uppfaeraUndirverk(nagranni.id, { rod: minRod });
        await eftirBreytingu();
      });
    }

    let eydaSmellt = false;
    const eyda = admin ? el('button', {
      type: 'button', class: 'uv__eyda', texti: 'Eyða',
      onclick: async (e) => {
        if (!eydaSmellt) {
          eydaSmellt = true;
          e.currentTarget.textContent = 'Viss?';
          e.currentTarget.classList.add('er-viss');
          return;
        }
        await reyna(async () => {
          await g.eydaUndirverk(u);
          await eftirBreytingu();
        });
      }
    }) : null;

    return el('li', { class: 'uv' + (u.lokid ? ' uv--lokid' : '') }, [
      el('div', { class: 'uv__rod' }, [
        hak,
        el('div', { class: 'uv__mid' }, [
          titill,
          skil.length || postur || dagsHluti || (admin && u.lokid && u.lokid_dags)
            ? el('div', { class: 'task__undir uv__undir' }, [
                dagsHluti,
                ...skil,
                admin && u.lokid && u.lokid_dags ? el('span', { texti: 'Lokið ' + dags(u.lokid_dags) }) : null,
                postur
              ])
            : null
        ]),
        admin ? el('div', { class: 'uv__tol' }, [
          u.lokid ? null : el('button', {
            type: 'button', class: 'uv__festa', texti: u.tengill || u.skra_slod ? 'Breyta skilum' : 'Skrá eða hlekkur',
            onclick: () => opnaAfhendingu(u, afhending, { anLokid: true })
          }),
          el('div', { class: 'skref__fera' }, [
            el('button', { type: 'button', texti: '↑', 'aria-label': 'Færa ofar',
                           disabled: i === 0, onclick: () => faera(-1) }),
            el('button', { type: 'button', texti: '↓', 'aria-label': 'Færa neðar',
                           disabled: i === listi.length - 1, onclick: () => faera(1) })
          ]),
          eyda
        ]) : null
      ]),
      afhending
    ]);
  }

  /* ---------- skila: skrá, hlekkur eða án skrár ----------
     anLokid: bara setja skrána eða hlekkinn, ekki haka í lokið. */
  function opnaAfhendingu(u, stadur, { anLokid } = {}) {
    if (opidSpjald && opidSpjald !== stadur) { opidSpjald.hidden = true; fylla(opidSpjald, []); }
    opidSpjald = stadur;

    let valinSkra = null;
    const stada = el('div', { class: 'form-status', role: 'status', hidden: true });
    const segja = (texti, tegund) => {
      stada.textContent = texti;
      stada.className = 'form-status form-status--' + tegund;
      stada.hidden = false;
    };

    const skraNafn = el('span', { class: 'uv__valin',
      texti: u.skra_nafn ? 'Núna: ' + u.skra_nafn : 'Engin skrá valin' });
    const skraInntak = el('input', {
      type: 'file', style: 'display:none',
      onchange: (e) => {
        const sk = (e.target.files || [])[0];
        if (!sk) return;
        if (sk.size > HAMARK_MB * 1024 * 1024) {
          valinSkra = null;
          e.target.value = '';
          skraNafn.textContent = u.skra_nafn ? 'Núna: ' + u.skra_nafn : 'Engin skrá valin';
          segja('Skráin er ' + staerd(sk.size) + ' en hámarkið er ' + HAMARK_MB + ' MB. '
            + 'Settu hana á WeTransfer eða Google Drive og límdu hlekkinn hér fyrir neðan.', 'err');
          return;
        }
        valinSkra = sk;
        skraNafn.textContent = sk.name + ' (' + staerd(sk.size) + ')';
        stada.hidden = true;
      }
    });
    const tengill = el('input', { type: 'url', inputmode: 'url', placeholder: 'https://we.tl/...',
                                  value: u.tengill || '', 'aria-label': 'Hlekkur á skilin' });
    const anSkrar = el('input', { type: 'checkbox' });
    const sendaPost = el('input', { type: 'checkbox', checked: u.senda !== false });
    const vistaHnappur = el('button', { type: 'submit', class: 'btn btn--sm',
                                        texti: anLokid ? 'Vista' : 'Merkja lokið' });

    const form = el('form', {
      class: 'uv__form', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const hlekkur = lesaTengil(tengill.value);
        if (hlekkur === false) {
          segja('Hlekkurinn þarf að byrja á https://', 'err'); tengill.focus(); return;
        }
        const erSkil = !!(valinSkra || hlekkur || u.skra_slod);
        if (!anLokid && !erSkil && !anSkrar.checked) {
          segja('Settu inn skrá eða hlekk, eða hakaðu í Senda án skrár.', 'err'); return;
        }
        if (anLokid && !valinSkra && hlekkur === (u.tengill || null)) {
          stadur.hidden = true; fylla(stadur, []); return;
        }

        vistaHnappur.disabled = true;
        try {
          if (valinSkra) {
            segja('Hleð upp ' + valinSkra.name + '. Ekki loka glugganum.', 'ok');
            vistaHnappur.textContent = 'Hleð upp';
            await g.skraAUndirverk(u, t.fyrirtaeki_id, valinSkra);
          }
          const breytingar = { tengill: hlekkur };
          if (!anLokid) {
            breytingar.lokid = true;
            breytingar.senda = sendaPost.checked;
          }
          await g.uppfaeraUndirverk(u.id, breytingar);
          /* Fyrsta hakið setur taskinn í vinnslu */
          if (!anLokid && t.stada === 'nytt') await g.uppfaeraTask(t.id, { stada: 'i_vinnslu' });
          await eftirBreytingu();
        } catch (villa) {
          segja(/exceeded|too large|maximum/i.test(villa.message || '')
            ? 'Skráin er of stór fyrir geymsluna. Settu hana á WeTransfer eða Google Drive og límdu hlekkinn.'
            : (villa.message || 'Þetta gekk ekki. Prófaðu aftur.'), 'err');
          vistaHnappur.disabled = false;
          vistaHnappur.textContent = anLokid ? 'Vista' : 'Merkja lokið';
        }
      }
    }, [
      el('div', { class: 'uv__skraval' }, [
        el('label', { class: 'btn btn--sm btn--ghost' }, [
          el('span', { texti: u.skra_slod ? 'Skipta um skrá' : 'Velja skrá' }), skraInntak
        ]),
        skraNafn
      ]),
      el('p', { class: 'skyring' }, [document.createTextNode('Hámark ' + HAMARK_MB + ' MB.'), document.createTextNode(' Stærri myndbönd: settu þau á WeTransfer eða Google Drive og límdu hlekkinn.')]),
      el('label', { class: 'field uv__hlekkur' }, [el('span', { texti: 'Eða hlekkur' }), tengill]),
      anLokid ? null : el('label', { class: 'uv__val' }, [anSkrar, document.createTextNode(' Senda án skrár eða hlekks')]),
      anLokid ? null : el('label', { class: 'uv__val' }, [sendaPost, document.createTextNode(' Senda viðskiptavininum póst')]),
      stada,
      el('div', { class: 'uv__hnappar' }, [
        vistaHnappur,
        el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Hætta við',
                       onclick: () => { stadur.hidden = true; fylla(stadur, []); opidSpjald = null; } })
      ])
    ]);

    fylla(stadur, [form]);
    stadur.hidden = false;
    (u.tengill || u.skra_slod ? vistaHnappur : tengill).focus({ preventScroll: true });
    stadur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ---------- nýtt undirverk ---------- */
  const nyttHeiti = el('input', { type: 'text', placeholder: 'Til dæmis Myndband', maxlength: '190',
                                  'aria-label': 'Nafn á nýju undirverki' });
  const fjoldi = el('input', { type: 'number', min: '1', max: '30', value: '1', inputmode: 'numeric',
                               'aria-label': 'Fjöldi', class: 'uv__fjoldi' });
  const nyttVilla = el('div', { class: 'form-status form-status--err', hidden: true });

  const nyttForm = admin ? el('form', {
    class: 'uv__nytt',
    onsubmit: async (e) => {
      e.preventDefault();
      const heiti = nyttHeiti.value.trim();
      const n = Math.max(1, Math.min(30, parseInt(fjoldi.value, 10) || 1));
      if (!heiti) { nyttHeiti.focus(); return; }
      /* "Myndband" sinnum 4 verður Myndband 1, Myndband 2 ... */
      const titlar = n === 1 ? [heiti] : Array.from({ length: n }, (_, k) => heiti + ' ' + (k + 1));
      try {
        await g.nyUndirverk(t.id, titlar);
        await eftirBreytingu();
      } catch (villa) {
        nyttVilla.textContent = villa.message;
        nyttVilla.hidden = false;
      }
    }
  }, [
    nyttHeiti,
    el('span', { class: 'uv__sinnum', 'aria-hidden': 'true', texti: '×' }),
    fjoldi,
    el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Bæta við' })
  ]) : null;

  const allarBunar = listi.length > 0 && lokin === listi.length;

  return el('section', { class: 'uvhluti' }, [
    el('div', { class: 'uvhluti__haus' }, [
      el('h3', { texti: 'Undirverk' }),
      listi.length ? el('span', { class: 'uvtala' + (allarBunar ? ' uvtala--buid' : ''),
                                  texti: lokin + ' af ' + listi.length + ' lokið' }) : null
    ]),
    villuReitur,
    listi.length
      ? el('div', { class: 'uvhluti__mael', 'aria-hidden': 'true' }, [
          el('span', { style: 'width:' + Math.round(lokin * 100 / listi.length) + '%' })
        ])
      : null,
    listi.length
      ? el('ul', { class: 'uvlisti' }, listi.map(lina))
      : el('p', { class: 'skyring', texti: 'Skiptu verkinu í hluta, til dæmis fjögur myndbönd. '
          + 'Þegar þú hakar í eitt og setur skrána eða hlekkinn með fær viðskiptavinurinn póst.' }),
    nyttForm,
    nyttVilla,
    admin && allarBunar && t.stada !== 'lokid'
      ? el('div', { class: 'uv__allt' }, [
          el('span', { texti: 'Öll undirverkin eru búin.' }),
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Merkja taskinn lokið',
                         onclick: () => reyna(async () => {
                           await g.uppfaeraTask(t.id, { stada: 'lokid' });
                           await eftirBreytingu();
                         }) })
        ])
      : null
  ]);
}
