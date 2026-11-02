/* ==========================================================================
   Tveir vinnusvæði — okkar eigin listi
   Taskar milli okkar tveggja. Viðskiptavinur kemur hér aldrei nálægt,
   gögnin liggja í sérstakri töflu með stefnu sem hleypir bara admin inn.
   ========================================================================== */

import {
  gogn, el, fylla, dags, erSeint, pilla, vardaHlid, teiknaHaus,
  uppfaeraMerki, STODUR_INNRI, FORGANGUR
} from './portal.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

const fyrstaNafn = (nafn) => String(nafn || '').trim().split(' ')[0];

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Okkar');

  const innihald = document.getElementById('innihald');

  /* Hver listinn er stilltur á mig, því það er það sem ég opna síðuna til
     að sjá. Hitt er í einu smelli. */
  let hver = ek.id;
  let syna = 'opid';

  /* Flýtilínan heldur sínu vali milli teikninga, annars þyrfti að velja
     sama manninn upp á nýtt fyrir hvern task. */
  let flytiA = ek.id;

  async function teikna() {
    const [allir, notendur, fyrirtaeki] = await Promise.all([
      g.innriTaskar(), g.notendur(), g.fyrirtaeki()
    ]);

    const vid = notendur.filter((n) => n.hlutverk === 'admin');
    const opid = allir.filter((t) => t.stada !== 'lokid');

    const minir = (listi, hvern) => hvern === 'allir'
      ? listi
      : listi.filter((t) => (t.abyrgd || 'oradid') === hvern);

    const eftirManni = minir(allir, hver);
    const syndir = (syna === 'lokid' ? eftirManni.filter((t) => t.stada === 'lokid')
                  : syna === 'allt'  ? eftirManni
                  : eftirManni.filter((t) => t.stada !== 'lokid'))
      .sort(syna === 'lokid' ? nyjastLokid : eftirSkiladegi);

    const aMig = opid.filter((t) => t.abyrgd === ek.id);
    const seinir = aMig.filter((t) => erSeint(t.skiladagur));

    fylla(innihald, [
      el('div', { class: 'page-head', style: 'padding-top:0' }, [
        el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Taskarnir okkar' }),
        el('p', { class: 'lead', texti: lysing(aMig.length, seinir.length) })
      ]),

      el('section', { class: 'card pblokk', style: 'margin-top:4px' }, [

        /* ---------- skrifa inn nýjan ---------- */
        (() => {
          const titill = el('input', {
            type: 'text', required: true, maxlength: '140',
            placeholder: 'Hvað þarf að gera?', 'aria-label': 'Nýr taskur'
          });
          const aHvern = el('select', { 'aria-label': 'Á hvern' },
            [el('option', { value: '', texti: 'Óráðið' })].concat(
              vid.map((n) => el('option', {
                value: n.id, selected: flytiA === n.id,
                texti: n.id === ek.id ? 'Á mig' : 'Á ' + fyrstaNafn(n.nafn)
              }))));
          const dagur = el('input', { type: 'date', 'aria-label': 'Skiladagur' });
          const hnappur = el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Setja inn' });

          return el('form', {
            class: 'flyti', novalidate: true,
            onsubmit: async (e) => {
              e.preventDefault();
              const texti = titill.value.trim();
              if (!texti) { titill.focus(); return; }
              hnappur.disabled = true;
              flytiA = aHvern.value;
              try {
                await g.nyrInnriTask({
                  titill: texti,
                  abyrgd: aHvern.value || null,
                  skiladagur: dagur.value || null
                });
                uppfaeraMerki();
                await teikna();
                /* Setja bendilinn aftur í reitinn svo hægt sé að skrifa
                   næsta task beint á eftir. */
                const nyr = innihald.querySelector('.flyti input[type="text"]');
                if (nyr) nyr.focus();
              } catch (villa) {
                hnappur.disabled = false;
                hnappur.textContent = 'Gekk ekki';
                hnappur.title = villa.message || '';
              }
            }
          }, [titill, aHvern, dagur, hnappur]);
        })(),

        /* ---------- hver og hvað ---------- */
        el('div', { class: 'okkar__sia' }, [
          el('div', { class: 'pflipar', style: 'margin-bottom:0' }, [].concat(
            vid.map((n) => flipi(n.id, n.id === ek.id ? 'Á mig' : fyrstaNafn(n.nafn),
                                minir(opid, n.id).length)),
            [
              flipi('oradid', 'Óráðið', minir(opid, 'oradid').length),
              flipi('allir', 'Allir', opid.length)
            ]
          )),
          el('select', {
            'aria-label': 'Hvað á að sýna',
            onchange: (e) => { syna = e.target.value; teikna(); }
          }, [
            el('option', { value: 'opid',  selected: syna === 'opid',  texti: 'Opið' }),
            el('option', { value: 'lokid', selected: syna === 'lokid', texti: 'Lokið' }),
            el('option', { value: 'allt',  selected: syna === 'allt',  texti: 'Allt' })
          ])
        ]),

        syndir.length
          ? el('ul', { class: 'tasklisti' }, syndir.map(lina))
          : el('p', { class: 'tomt', texti: syna === 'lokid'
              ? 'Ekkert hakað af hér enn.'
              : 'Ekkert opið hér. Skrifaðu fyrsta taskinn hér fyrir ofan.' })
      ]),

      g.prufa ? el('div', { class: 'prufubanner', style: 'margin-top:18px' }, [
        el('strong', { texti: 'Prufustilling. ' }),
        document.createTextNode('Gögnin eru sýnidæmi í þessum vafra og fara ekki út á netið.')
      ]) : null
    ]);

    /* ------------------------------------------------------------------
       Hlutar
       ------------------------------------------------------------------ */

    function flipi(gildi, heiti, fjoldi) {
      return el('button', {
        type: 'button', class: 'pflipi', 'aria-pressed': String(hver === gildi),
        onclick: () => { hver = gildi; teikna(); }
      }, [document.createTextNode(heiti + ' '), el('b', { texti: String(fjoldi) })]);
    }

    function lina(t) {
      const lokid = t.stada === 'lokid';

      return el('li', {}, [el('div', { class: 'task' + (lokid ? ' task--lokid' : '') }, [
        el('button', {
          type: 'button', class: 'hak', 'aria-pressed': String(lokid),
          'aria-label': lokid ? 'Taka úr lokið' : 'Haka í lokið',
          onclick: async () => {
            await g.uppfaeraInnriTask(t.id, { stada: lokid ? 'i_vinnslu' : 'lokid' });
            uppfaeraMerki();
            teikna();
          }
        }),
        el('div', { class: 'task__mid' }, [
          el('button', { type: 'button', class: 'task__titill', texti: t.titill,
                         onclick: () => opna(t) }),
          el('div', { class: 'task__undir' }, [
            el('span', { texti: t.abyrgd_notandi ? fyrstaNafn(t.abyrgd_notandi.nafn) : 'Óráðið' }),
            t.fyrirtaeki ? el('span', { texti: t.fyrirtaeki.nafn }) : null,
            t.skiladagur ? el('span', {
              class: erSeint(t.skiladagur) && !lokid ? 'seint' : '',
              texti: (erSeint(t.skiladagur) && !lokid ? 'Rann út ' : 'Skil ') + dags(t.skiladagur)
            }) : null
          ])
        ]),
        el('div', { class: 'task__hofn' }, [
          t.forgangur === 'hatt' && !lokid ? el('span', { class: 'pforg', texti: 'Hátt' }) : null,
          pilla(t.stada, 'innri')
        ])
      ])]);
    }

    /* ------------------------------------------------------------------
       Spjaldið
       ------------------------------------------------------------------ */

    function opna(t) {
      const titill = el('input', { type: 'text', value: t.titill, maxlength: '140',
                                   required: true });
      const lysingin = el('textarea', { rows: '3', placeholder: 'Nóta, ef hún þarf' },
                          [t.lysing || '']);
      const stada = el('select', {}, Object.keys(STODUR_INNRI).map((s) =>
        el('option', { value: s, selected: t.stada === s, texti: STODUR_INNRI[s].heiti })));
      const abyrgd = el('select', {}, [el('option', { value: '', texti: 'Óráðið' })].concat(
        vid.map((n) => el('option', {
          value: n.id, selected: t.abyrgd === n.id,
          texti: n.id === ek.id ? fyrstaNafn(n.nafn) + ' (ég)' : fyrstaNafn(n.nafn)
        }))));
      const forgangur = el('select', {}, Object.keys(FORGANGUR).map((f) =>
        el('option', { value: f, selected: t.forgangur === f, texti: FORGANGUR[f] })));
      const skiladagur = el('input', { type: 'date', value: t.skiladagur || '' });
      const fyrirtaekid = el('select', {}, [el('option', { value: '', texti: 'Ekkert sérstakt' })]
        .concat(fyrirtaeki.map((f) => el('option', {
          value: f.id, selected: t.fyrirtaeki_id === f.id, texti: f.nafn }))));

      const stadan = el('div', { class: 'form-status', hidden: true });

      /* Eyðing í tveimur ýtingum. Hér er ekkert afturkalla. */
      let staðfest = false;
      const eyda = el('button', { type: 'button', class: 'spjald__eyda', texti: 'Eyða',
        onclick: async (e) => {
          if (!staðfest) {
            staðfest = true;
            e.currentTarget.textContent = 'Ýttu aftur til að eyða';
            e.currentTarget.classList.add('er-vis');
            setTimeout(() => {
              staðfest = false;
              if (!eyda.isConnected) return;
              eyda.textContent = 'Eyða';
              eyda.classList.remove('er-vis');
            }, 4000);
            return;
          }
          await g.eydaInnriTask(t.id);
          uppfaeraMerki();
          d.close();
          teikna();
        } });

      const d = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort' }, [
        el('div', { class: 'pdialog__haus' }, [
          el('h2', { texti: 'Taskur' }),
          el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                         onclick: () => d.close() })
        ]),

        el('form', {
          style: 'margin-top:18px; display:flex; flex-direction:column; gap:16px',
          novalidate: true,
          onsubmit: async (e) => {
            e.preventDefault();
            const texti = titill.value.trim();
            if (!texti) { titill.focus(); return; }
            try {
              await g.uppfaeraInnriTask(t.id, {
                titill: texti,
                lysing: lysingin.value.trim() || null,
                stada: stada.value,
                abyrgd: abyrgd.value || null,
                forgangur: forgangur.value,
                skiladagur: skiladagur.value || null,
                fyrirtaeki_id: fyrirtaekid.value || null
              });
              uppfaeraMerki();
              d.close();
              teikna();
            } catch (villa) {
              stadan.hidden = false;
              stadan.className = 'form-status form-status--err';
              stadan.textContent = villa.message || 'Þetta gekk ekki.';
            }
          }
        }, [
          el('label', { class: 'field' }, [el('span', { texti: 'Titill' }), titill]),
          el('label', { class: 'field' }, [el('span', { texti: 'Nóta' }), lysingin]),
          el('div', { class: 'field-row' }, [
            el('label', { class: 'field' }, [el('span', { texti: 'Staða' }), stada]),
            el('label', { class: 'field' }, [el('span', { texti: 'Á hvern' }), abyrgd])
          ]),
          el('div', { class: 'field-row' }, [
            el('label', { class: 'field' }, [el('span', { texti: 'Forgangur' }), forgangur]),
            el('label', { class: 'field' }, [el('span', { texti: 'Skiladagur' }), skiladagur])
          ]),
          el('label', { class: 'field' }, [el('span', { texti: 'Fyrirtæki' }), fyrirtaekid]),
          stadan,
          el('div', { class: 'spjald__fot' }, [
            el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Vista' }),
            eyda
          ]),
          el('p', { class: 'skyring',
                    texti: 'Stofnað ' + dags(t.stofnad, true)
                      + (t.lokid_dags ? ', lokið ' + dags(t.lokid_dags, true) : '') })
        ])
      ])]);

      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
      d.addEventListener('close', () => d.remove());
      document.body.append(d);
      d.showModal();
    }
  }

  teikna();
}

/* ------------------------------------------------------------------
   Röðun og orðalag
   ------------------------------------------------------------------ */

/* Skiladagur ræður. Það sem engan dag hefur fer aftast, þá hátt forgang
   og loks nýjast efst. */
function eftirSkiladegi(a, b) {
  const da = a.skiladagur ? new Date(a.skiladagur).getTime() : Infinity;
  const db = b.skiladagur ? new Date(b.skiladagur).getTime() : Infinity;
  if (da !== db) return da - db;
  const vigt = { hatt: 0, venjulegt: 1, lagt: 2 };
  if (vigt[a.forgangur] !== vigt[b.forgangur]) return vigt[a.forgangur] - vigt[b.forgangur];
  return new Date(b.stofnad) - new Date(a.stofnad);
}

function nyjastLokid(a, b) {
  return new Date(b.lokid_dags || b.uppfaert) - new Date(a.lokid_dags || a.uppfaert);
}

function lysing(aMig, seinir) {
  if (!aMig) return 'Ekkert liggur á þér núna.';
  const upphaf = aMig === 1 ? 'Einn taskur liggur á þér' : aMig + ' taskar liggja á þér';
  if (!seinir) return upphaf + '.';
  return upphaf + ', ' + (seinir === 1 ? 'einn er kominn fram úr skiladegi.'
                                       : seinir + ' eru komnir fram úr skiladegi.');
}
