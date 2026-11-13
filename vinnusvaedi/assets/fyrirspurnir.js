/* ==========================================================================
   Tveir vinnusvæði — fyrirspurnir
   Allt sem kemur inn um formin á tveir.is, og hvaðan fólkið kom.
   Vefurinn skrifar línuna, við færum hana áfram: ný, haft samband,
   fundur, tilboð, unnið eða tapað. Bara admin kemst hingað.
   ========================================================================== */

import {
  gogn, el, fylla, dags, sidan, kronur, lesaTolu, vardaHlid, teiknaHaus, uppfaeraMerki,
  geymt, geyma
} from './portal.js';
import { STODUR_FYRIRSPURN, UPPRUNI } from './gogn.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

const OPID = ['ny', 'haft_samband', 'fundur', 'tilbod'];
const fyrstaNafn = (nafn) => String(nafn || '').trim().split(' ')[0];
const upprunaHeiti = (u) => UPPRUNI[u] || UPPRUNI.beint;

function pillaF(stada) {
  const s = STODUR_FYRIRSPURN[stada] || STODUR_FYRIRSPURN.ny;
  return el('span', { class: 'pstat pstat--' + s.litur, texti: s.heiti });
}

function klukkan(gildi) {
  const d = new Date(gildi);
  if (isNaN(d)) return '';
  return dags(gildi, true) + ' kl. ' + String(d.getHours()).padStart(2, '0') + ':'
    + String(d.getMinutes()).padStart(2, '0');
}

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Fyrirspurnir');

  const innihald = document.getElementById('innihald');
  let flipi = 'opid';

  /* Gögnin eru sótt einu sinni. Flipar og síur teikna bara upp á nýtt
     úr því sem er komið, það er það sem gerði flipana hæga. */
  let hlad = null;
  async function teikna(adeinsBirta) {
    if (!adeinsBirta || !hlad) {
      hlad = await Promise.all([g.fyrirspurnir(), g.notendur()]);
      geyma('fyrirspurnir', hlad);
    }
    const [allar, notendur] = hlad;
    const vid = notendur.filter((n) => n.hlutverk === 'admin');

    const nyjar = allar.filter((f) => f.stada === 'ny');
    const iFerli = allar.filter((f) => ['haft_samband', 'fundur', 'tilbod'].includes(f.stada));
    const unnar = allar.filter((f) => f.stada === 'unnid');
    const tapadar = allar.filter((f) => f.stada === 'tapad');
    const lokadar = unnar.length + tapadar.length;
    const virdiIFerli = iFerli.reduce((a, f) => a + (Number(f.verdmaeti) || 0), 0);

    /* Hvaðan fólkið kemur, síðustu 90 daga */
    const nylegar = allar.filter((f) => Date.now() - new Date(f.stofnad) < 90 * 86400000);
    const eftirUppruna = {};
    nylegar.forEach((f) => {
      const u = UPPRUNI[f.uppruni] ? f.uppruni : 'beint';
      eftirUppruna[u] = eftirUppruna[u] || { fjoldi: 0, unnid: 0 };
      eftirUppruna[u].fjoldi += 1;
      if (f.stada === 'unnid') eftirUppruna[u].unnid += 1;
    });
    const upprunar = Object.entries(eftirUppruna).sort((a, b) => b[1].fjoldi - a[1].fjoldi);
    const mest = upprunar.length ? upprunar[0][1].fjoldi : 1;

    const syndar = flipi === 'opid' ? allar.filter((f) => OPID.includes(f.stada))
                 : flipi === 'allt' ? allar
                 : allar.filter((f) => f.stada === flipi);

    fylla(innihald, [
      el('div', { class: 'page-head', style: 'padding-top:0' }, [
        el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Fyrirspurnir' }),
        el('p', { class: 'lead', texti: nyjar.length
          ? (nyjar.length === 1 ? 'Ein ný fyrirspurn bíður svars.' : nyjar.length + ' nýjar fyrirspurnir bíða svars.')
          : 'Engin ný fyrirspurn bíður svars.' })
      ]),

      el('dl', { class: 'tekjur', style: 'margin-top:4px' }, [
        el('div', { class: 'adal' }, [el('dt', { texti: 'Nýjar' }), el('dd', { texti: String(nyjar.length) })]),
        el('div', {}, [el('dt', { texti: 'Í ferli' }), el('dd', { texti: String(iFerli.length) })]),
        el('div', {}, [el('dt', { texti: 'Virði í ferli' }), el('dd', { texti: kronur(virdiIFerli) || '0 kr.' })]),
        el('div', {}, [
          el('dt', { texti: 'Hlutfall unnið' }),
          el('dd', { texti: lokadar ? Math.round(unnar.length * 100 / lokadar) + '%' : 'Ekkert enn' })
        ])
      ]),

      el('div', { class: 'pgrid', style: 'margin-top:clamp(18px,2.2vw,26px)' }, [
        el('div', { class: 'pmain' }, [
          el('section', { class: 'card pblokk' }, [
            el('div', { class: 'pyfir' }, [
              el('h2', { texti: 'Listinn' }),
              el('span', { class: 'pyfir__telja', texti: allar.length + ' alls' })
            ]),
            el('div', { class: 'pflipar' }, [
              hnappur('opid', 'Opnar', allar.filter((f) => OPID.includes(f.stada)).length),
              hnappur('ny', 'Nýjar', nyjar.length),
              hnappur('fundur', 'Fundur', allar.filter((f) => f.stada === 'fundur').length),
              hnappur('tilbod', 'Tilboð', allar.filter((f) => f.stada === 'tilbod').length),
              hnappur('unnid', 'Unnið', unnar.length),
              hnappur('tapad', 'Tapað', tapadar.length),
              hnappur('allt', 'Allt', allar.length)
            ]),
            syndar.length
              ? el('ul', { class: 'tasklisti' }, syndar.map(lina))
              : el('p', { class: 'tomt', texti: allar.length
                  ? 'Ekkert hér.'
                  : 'Engin fyrirspurn komin enn. Þær birtast hér um leið og einhver fyllir út form á tveir.is.' })
          ])
        ]),

        el('aside', { class: 'pside' }, [
          el('div', { class: 'card pblokk' }, [
            el('div', { class: 'pyfir', style: 'margin-bottom:6px' }, [
              el('h2', { texti: 'Hvaðan þær koma' }),
              el('span', { class: 'pyfir__telja', texti: 'Síðustu 90 dagar' })
            ]),
            upprunar.length
              ? el('ul', { class: 'uppruni' }, upprunar.map(([u, t]) => el('li', {}, [
                  el('div', { class: 'uppruni__lina' }, [
                    el('span', { texti: upprunaHeiti(u) }),
                    el('b', { texti: t.fjoldi + (t.unnid ? ' · ' + t.unnid + ' unnið' : '') })
                  ]),
                  el('span', { class: 'uppruni__sula' }, [
                    el('span', { style: 'width:' + Math.max(6, Math.round(t.fjoldi * 100 / mest)) + '%' })
                  ])
                ])))
              : el('p', { class: 'tomt', style: 'padding:20px 0', texti: 'Ekkert enn.' }),
            el('p', { class: 'skyring', style: 'margin-top:14px',
              texti: 'Uppruninn er fyrsta heimsóknin. Komi einhver af Facebook auglýsingu og fylli út formið '
                + 'viku seinna telst hann samt af Facebook.' })
          ]),
          g.prufa ? el('div', { class: 'prufubanner', style: 'margin:0' }, [
            el('strong', { texti: 'Prufustilling. ' }),
            document.createTextNode('Þetta eru sýnidæmi. Alvöru fyrirspurnir koma hingað þegar Supabase er tengt.')
          ]) : null
        ])
      ])
    ]);

    function hnappur(gildi, heiti, fjoldi) {
      return el('button', {
        type: 'button', class: 'pflipi', 'aria-pressed': String(flipi === gildi),
        onclick: () => { flipi = gildi; teikna(true); }
      }, [document.createTextNode(heiti + ' '), el('b', { texti: String(fjoldi) })]);
    }

    function lina(f) {
      const lokid = f.stada === 'unnid' || f.stada === 'tapad';
      return el('li', {}, [el('div', { class: 'task' + (f.stada === 'tapad' ? ' task--lokid' : '') }, [
        el('span', { class: 'fsp__punktur' + (f.stada === 'ny' ? ' er-ny' : ''), 'aria-hidden': 'true' }),
        el('div', { class: 'task__mid' }, [
          el('button', { type: 'button', class: 'task__titill',
            texti: (f.nafn || f.netfang || f.simi || 'Nafnlaus')
              + (f.fyrirtaeki_nafn ? ', ' + f.fyrirtaeki_nafn : ''),
            onclick: () => opna(f) }),
          el('div', { class: 'task__undir' }, [
            el('span', { class: 'fsp__uppruni', texti: upprunaHeiti(f.uppruni) }),
            f.form ? el('span', { texti: f.form }) : null,
            el('span', { texti: sidan(f.stofnad) }),
            f.abyrgd_notandi ? el('span', { texti: fyrstaNafn(f.abyrgd_notandi.nafn) }) : null
          ])
        ]),
        el('div', { class: 'task__hofn' }, [
          f.verdmaeti && !lokid ? el('span', { class: 'fsp__virdi', texti: kronur(f.verdmaeti) }) : null,
          pillaF(f.stada)
        ])
      ])]);
    }

    /* ------------------------------------------------------------------
       Spjaldið
       ------------------------------------------------------------------ */
    function opna(f) {
      const stada = el('select', {}, Object.keys(STODUR_FYRIRSPURN).map((s) =>
        el('option', { value: s, selected: f.stada === s, texti: STODUR_FYRIRSPURN[s].heiti })));
      const abyrgd = el('select', {}, [el('option', { value: '', texti: 'Enginn' })].concat(
        vid.map((n) => el('option', { value: n.id, selected: f.abyrgd === n.id,
                                      texti: fyrstaNafn(n.nafn) + (n.id === ek.id ? ' (ég)' : '') }))));
      const virdi = el('input', { type: 'text', inputmode: 'numeric', placeholder: 'T.d. 250.000',
                                  value: f.verdmaeti ? String(f.verdmaeti).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '' });
      const nota = el('textarea', { rows: '3', placeholder: 'Hvað var sagt, hvað er næst' }, [f.nota || '']);
      const stadan = el('div', { class: 'form-status', hidden: true });

      const raun = (merki, gildi) => gildi ? el('li', {}, [el('span', { texti: merki }), gildi]) : null;
      const tengill = (href, texti) => el('a', { href, texti });

      const auka = f.gogn && typeof f.gogn === 'object'
        ? Object.entries(f.gogn).filter(([, v]) => v !== null && v !== '').map(([k, v]) =>
            raun(k.charAt(0).toUpperCase() + k.slice(1), String(v)))
        : [];

      const herferd = [f.utm_source, f.utm_medium, f.utm_campaign].filter(Boolean).join(' / ');

      let stadfest = false;
      const eyda = el('button', { type: 'button', class: 'spjald__eyda', texti: 'Eyða',
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
          await g.eydaFyrirspurn(f.id);
          uppfaeraMerki(); d.close(); teikna();
        } });

      const d = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort' }, [
        el('div', { class: 'pdialog__haus' }, [
          el('h2', { texti: f.nafn || 'Fyrirspurn' }),
          el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                         onclick: () => d.close() })
        ]),

        el('div', { class: 'fsp__takkar' }, [
          f.netfang ? el('a', { class: 'btn btn--sm', texti: 'Senda póst',
            href: 'mailto:' + f.netfang + '?subject=' + encodeURIComponent('Fyrirspurnin þín til Tveir') }) : null,
          f.simi ? el('a', { class: 'btn btn--sm btn--ghost', texti: 'Hringja í ' + f.simi,
            href: 'tel:' + String(f.simi).replace(/[^0-9+]/g, '') }) : null
        ]),

        el('ul', { class: 'pmeta' }, [
          raun('Netfang', f.netfang ? tengill('mailto:' + f.netfang, f.netfang) : null),
          raun('Sími', f.simi ? tengill('tel:' + String(f.simi).replace(/[^0-9+]/g, ''), f.simi) : null),
          raun('Fyrirtæki', f.fyrirtaeki_nafn),
          raun('Þjónusta', f.thjonusta),
          raun('Form', f.form),
          raun('Kom inn', klukkan(f.stofnad))
        ].concat(auka)),

        f.skilabod ? el('blockquote', { class: 'fsp__skilabod', texti: f.skilabod }) : null,

        el('h3', { class: 'fsp__undirfyrirsogn', texti: 'Hvaðan kom hún' }),
        el('ul', { class: 'pmeta', style: 'margin-top:6px' }, [
          raun('Uppruni', upprunaHeiti(f.uppruni)),
          f.sidasti_uppruni && f.sidasti_uppruni !== f.uppruni
            ? raun('Síðast frá', upprunaHeiti(f.sidasti_uppruni)) : null,
          raun('Herferð', herferd || null),
          raun('Kom af', f.tilvisun),
          raun('Lenti á', f.lendingarsida),
          raun('Fyrst á vefnum', f.fyrsta_heimsokn ? klukkan(f.fyrsta_heimsokn) : null)
        ]),

        el('form', {
          style: 'margin-top:22px; display:flex; flex-direction:column; gap:16px',
          novalidate: true,
          onsubmit: async (e) => {
            e.preventDefault();
            try {
              await g.uppfaeraFyrirspurn(f.id, {
                stada: stada.value,
                abyrgd: abyrgd.value || null,
                verdmaeti: lesaTolu(virdi.value),
                nota: nota.value.trim() || null
              });
              uppfaeraMerki(); d.close(); teikna();
            } catch (villa) {
              stadan.hidden = false;
              stadan.className = 'form-status form-status--err';
              stadan.textContent = villa.message || 'Þetta gekk ekki.';
            }
          }
        }, [
          el('div', { class: 'field-row' }, [
            el('label', { class: 'field' }, [el('span', { texti: 'Staða' }), stada]),
            el('label', { class: 'field' }, [el('span', { texti: 'Á hvern' }), abyrgd])
          ]),
          el('label', { class: 'field' }, [el('span', { texti: 'Virði (kr. án VSK)' }), virdi]),
          el('label', { class: 'field' }, [el('span', { texti: 'Nóta' }), nota]),
          stadan,
          el('div', { class: 'spjald__fot' }, [
            el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Vista' }),
            eyda
          ])
        ])
      ])]);

      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
      d.addEventListener('close', () => d.remove());
      document.body.append(d);
      d.showModal();
    }
  }

  hlad = geymt('fyrirspurnir');
  if (hlad) teikna(true);
  teikna();
}
