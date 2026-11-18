/* ==========================================================================
   Samskipti > Pósthólf: Gmail pósthólfið á vinnusvæðinu
   Apps Script (postholf.gs) afritar pósthólfið hingað á 5 mínútna fresti.
   Hér má lesa þræðina, sjá hvaða viðskiptavin þeir varða og svara. Svarið
   fer frá tveir@tveir.is í sama þræði. Bara stjórnendur.
   ========================================================================== */

import { gogn, el, fylla, vardaHlid, teiknaHaus, uppfaeraMerki, samskiptaFlipar, postOlesinn } from './portal.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

const MAN = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
const pad = (n) => String(n).padStart(2, '0');
function hvenaer(s, langt) {
  const d = new Date(s), nu = new Date();
  const sami = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const igaer = new Date(nu); igaer.setDate(nu.getDate() - 1);
  const kl = pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (sami(d, nu)) return langt ? 'Í dag kl. ' + kl : kl;
  if (sami(d, igaer)) return langt ? 'Í gær kl. ' + kl : 'Í gær';
  return d.getDate() + '. ' + MAN[d.getMonth()] + (d.getFullYear() !== nu.getFullYear() ? ' ' + d.getFullYear() : '') + (langt ? ' kl. ' + kl : '');
}
const stafir = (t) => String(t || '?').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('') || '?';
const oruggGmail = (s) => (/^https:\/\/mail\.google\.com\/\S+$/.test(String(s || '')) ? s : null);
const oruggSlod = (s) => { s = String(s || '').trim(); return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : null; };
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ------------------------------------------------------------------
   Undirskriftin: venjulegur texti og HTML með merki. Allt sem notandinn
   skrifar fer í gegnum esc, og bara https slóðir fara í myndir og tengla.
   ------------------------------------------------------------------ */
function undirskriftTexti(u) {
  if (!u || u.virk === false) return '';
  return [u.kvedja, u.nafn, u.starf, [u.simi, u.netfang, u.vefur].filter(Boolean).join(' · ')].filter((x) => String(x || '').trim()).join('\n');
}
function vefSlod(v) {
  v = String(v || '').trim();
  if (!v) return null;
  return oruggSlod(/^https?:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : 'https://' + v);
}
function undirskriftHtml(u) {
  if (!u || u.virk === false) return '';
  const L = "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;";
  const merki = oruggSlod(u.merki), vefur = vefSlod(u.vefur);
  const simi = String(u.simi || '').trim(), netfang = String(u.netfang || '').trim();
  const tengiliðir = [
    simi ? '<a href="tel:' + esc(simi.replace(/[^\d+]/g, '')) + '" style="color:#4a5f80;text-decoration:none;">' + esc(simi) + '</a>' : '',
    /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(netfang) ? '<a href="mailto:' + esc(netfang) + '" style="color:#4a5f80;text-decoration:none;">' + esc(netfang) + '</a>' : '',
    vefur ? '<a href="' + esc(vefur) + '" target="_blank" style="color:#5b93f0;text-decoration:none;font-weight:600;">' + esc(String(u.vefur).replace(/^https?:\/\//i, '').replace(/\/$/, '')) + '</a>' : ''
  ].filter(Boolean).join('<span style="color:#b8c6da;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>');
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;border-collapse:collapse;">'
    + (u.kvedja ? '<tr><td colspan="2" style="' + L + 'font-size:15px;color:#1c3050;padding:0 0 12px 0;">' + esc(u.kvedja) + '</td></tr>' : '')
    + '<tr>'
    + (merki ? '<td valign="middle" style="padding:0 16px 0 0;border-right:2px solid #e3ecf8;"><img src="' + esc(merki) + '" alt="" width="96" style="display:block;width:96px;max-width:96px;height:auto;border:0;"></td>' : '')
    + '<td valign="middle" style="padding:0 0 0 ' + (merki ? '16' : '0') + 'px;' + L + '">'
    + (u.nafn ? '<div style="font-size:15px;font-weight:700;color:#1c3050;line-height:1.3;">' + esc(u.nafn) + '</div>' : '')
    + (u.starf ? '<div style="font-size:13px;color:#7189ac;line-height:1.4;padding-top:1px;">' + esc(u.starf) + '</div>' : '')
    + (tengiliðir ? '<div style="font-size:13px;line-height:1.5;padding-top:6px;">' + tengiliðir + '</div>' : '')
    + '</td></tr></table>';
}
function svarHtml(texti, u) {
  const L = "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;";
  return '<div style="' + L + 'font-size:15px;line-height:1.6;color:#1c3050;">' + esc(texti).replace(/\r?\n/g, '<br>') + '</div>' + undirskriftHtml(u);
}

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Samskipti');
  document.body.classList.add('sk-sida');
  const innihald = document.getElementById('innihald');

  /* Undirskriftin: vistuð í gagnagrunninum, annars sjálfgefin */
  const SJALFGEFIN = {
    virk: true, kvedja: 'Kveðja,', nafn: ek.nafn || '', starf: '', simi: '',
    netfang: g.prufa ? (ek.netfang || '') : 'tveir@tveir.is',
    vefur: g.prufa ? '' : 'tveir.is',
    merki: g.prufa ? '' : 'https://tveir.is/assets/img/tveir-logo-3d.png'
  };
  let undirskrift = { ...SJALFGEFIN };
  try { const u = await g.undirskrift(); if (u) undirskrift = { ...SJALFGEFIN, ...u }; } catch (e) { /* sjálfgefin dugar */ }
  let stort = false;
  try { stort = localStorage.getItem('sk-stort') === '1'; } catch (e) { /* ekkert */ }

  let thraedir = [];
  let villa = null;
  let sia = 'allt';
  let leit = '';
  let opinn = new URLSearchParams(location.search).get('t');
  let opinnGogn = null;
  const uppkost = {};   /* svör í smíðum, svo endurnýjun á mínútu fresti þurrki þau ekki út */

  const listiSvid = el('div', { class: 'sk-listi', role: 'list' });
  const thradurSvid = el('section', { class: 'sk-thradur', 'aria-live': 'polite' });
  const grind = el('div', { class: 'sk-grind' + (stort ? ' er-stort' : '') }, [listiSvid, thradurSvid]);
  const lysing = el('p', { class: 'lead' });
  const siuHnappar = el('div', { class: 'sk-siur', role: 'group', 'aria-label': 'Sía' });
  const leitReitur = el('input', { type: 'search', class: 'sk-leit', placeholder: 'Leita í pósti', 'aria-label': 'Leita í pósti',
    oninput: (e) => { leit = e.target.value.trim().toLowerCase(); teiknaLista(); } });

  fylla(innihald, [
    samskiptaFlipar('postholf'),
    el('div', { class: 'page-head sk-haus', style: 'padding-top:0' }, [
      el('div', {}, [el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Pósthólf' }), lysing]),
      el('div', { class: 'sk-tol' }, [leitReitur, siuHnappar,
        el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Undirskrift', onclick: () => opnaUndirskrift() })])
    ]),
    grind
  ]);

  async function hlada() {
    try { thraedir = await g.postholf() || []; villa = null; }
    catch (e) { thraedir = []; villa = e; }
    teiknaAllt();
  }

  function teiknaAllt() {
    teiknaTolur();
    teiknaLista();
    if (opinn) opna(opinn, true); else teiknaTomtThrad();
  }

  /* Lýsingin og síuhnapparnir, með fjölda ólesinna */
  function teiknaTolur() {
    const olesnir = thraedir.filter(postOlesinn).length;
    lysing.textContent = villa ? '' : thraedir.length
      ? (olesnir ? (olesnir === 1 ? 'Einn ólesinn þráður. ' : olesnir + ' ólesnir þræðir. ') : 'Allt lesið. ') + 'Pósthólfið síðustu 14 daga, uppfærist á 5 mínútna fresti.'
      : 'Pósthólfið síðustu 14 daga, uppfærist á 5 mínútna fresti.';
    const fjoldiVid = thraedir.filter((t) => t.fyrirtaeki_id).length;
    fylla(siuHnappar, [['allt', 'Allt', thraedir.length], ['olesid', 'Ólesið', olesnir], ['vidskiptavinir', 'Viðskiptavinir', fjoldiVid]].map(([k, h, n]) =>
      el('button', { type: 'button', class: 'filter', 'aria-pressed': String(sia === k), onclick: () => { sia = k; teiknaTolur(); teiknaLista(); } },
        [document.createTextNode(h), n ? el('span', { class: 'sk-siur__tala', texti: String(n) }) : null])));
  }

  function sidir() {
    return thraedir.filter((t) => (sia === 'olesid' ? postOlesinn(t) : sia === 'vidskiptavinir' ? !!t.fyrirtaeki_id : true))
      .filter((t) => !leit || [t.efni, t.fra_nafn, t.fra_netfang, t.snid, t.fyr && t.fyr.nafn].join(' ').toLowerCase().includes(leit));
  }

  function teiknaLista() {
    if (villa) { fylla(listiSvid, [el('p', { class: 'tomt', texti: villa.message || 'Náði ekki í pósthólfið.' })]); return; }
    const syndir = sidir();
    if (!thraedir.length) {
      fylla(listiSvid, [el('div', { class: 'sk-tomt' }, [
        el('strong', { texti: 'Ekkert hér ennþá' }),
        el('p', { texti: g.prufa ? 'Engir sýniþræðir.' : 'Pósthólfið fyllist innan 5 mínútna eftir að postholf.gs er komin inn í Apps Script.' })
      ])]);
      return;
    }
    if (!syndir.length) { fylla(listiSvid, [el('p', { class: 'tomt', texti: 'Ekkert passar við þetta.' })]); return; }
    fylla(listiSvid, syndir.map((t) => {
      const olesinn = postOlesinn(t);
      return el('button', { type: 'button', role: 'listitem', class: 'sk-lina' + (olesinn ? ' er-olesin' : '') + (t.id === opinn ? ' er-opin' : ''),
        'aria-current': t.id === opinn ? 'true' : null, onclick: () => opna(t.id) }, [
        el('span', { class: 'sk-lina__haus', 'aria-hidden': 'true', texti: stafir(t.fra_nafn || t.fra_netfang) }),
        el('span', { class: 'sk-lina__mid' }, [
          el('span', { class: 'sk-lina__efst' }, [
            el('strong', { class: 'sk-lina__fra', texti: t.fra_nafn || t.fra_netfang || 'Óþekktur' }),
            el('span', { class: 'sk-lina__timi', texti: hvenaer(t.sidast) })
          ]),
          el('span', { class: 'sk-lina__efni' }, [
            olesinn ? el('i', { class: 'sk-punktur', 'aria-label': 'Ólesið' }) : null,
            document.createTextNode(t.efni || '(ekkert efni)'),
            t.fjoldi > 1 ? el('span', { class: 'sk-lina__fjoldi', texti: String(t.fjoldi) }) : null
          ]),
          el('span', { class: 'sk-lina__snid', texti: t.snid || '' }),
          t.fyr && t.fyr.nafn ? el('span', { class: 'sk-merki', texti: t.fyr.nafn }) : null
        ])
      ]);
    }));
  }

  function teiknaTomtThrad() {
    grind.classList.remove('er-opid');
    fylla(thradurSvid, [el('div', { class: 'sk-tomt sk-tomt--thradur' }, [
      el('strong', { texti: 'Veldu þráð' }),
      el('p', { texti: 'Svar sem þú skrifar hér fer ' + (g.prufa ? 'hvergi í prufu.' : 'frá tveir@tveir.is í sama þræði.') })
    ])]);
  }

  async function opna(id, hljodlaust) {
    const t = thraedir.find((x) => x.id === id);
    if (!t) { opinn = null; teiknaTomtThrad(); return; }
    opinn = id;
    if (!hljodlaust) history.replaceState(null, '', '?t=' + encodeURIComponent(id));
    grind.classList.add('er-opid');
    teiknaLista();
    if (!opinnGogn || opinnGogn.id !== id) {
      fylla(thradurSvid, [el('p', { class: 'tomt', texti: 'Sæki þráðinn' })]);
      try { opinnGogn = { id, ...(await g.postholfThradur(id)) }; }
      catch (e) { fylla(thradurSvid, [el('p', { class: 'tomt', texti: e.message || 'Náði ekki í þráðinn.' })]); return; }
      if (opinn !== id) return;
    }
    teiknaThrad(t);
    if (postOlesinn(t)) {
      t.lesid_kerfi = new Date().toISOString();
      teiknaTolur(); teiknaLista();
      g.merkjaPostLesinn(id).then(() => uppfaeraMerki()).catch(() => { /* reynum næst */ });
    }
  }

  function teiknaThrad(t) {
    const { skilabod = [], svor = [] } = opinnGogn || {};
    const gmail = oruggGmail(t.tengill);
    const svarReitur = el('textarea', { class: 'sk-svar__texti', rows: '5', maxlength: '10000',
      placeholder: 'Skrifaðu svar til ' + (t.fra_nafn ? t.fra_nafn.split(' ')[0] : t.fra_netfang || 'viðtakanda') + '…', 'aria-label': 'Svar',
      oninput: (e) => { uppkost[t.id] = e.target.value; } });
    svarReitur.value = uppkost[t.id] || '';
    const stada = el('p', { class: 'sk-svar__stada', role: 'status' });
    const sendaHn = el('button', { type: 'submit', class: 'btn', texti: 'Senda svar' });
    const medUndirskrift = el('input', { type: 'checkbox', checked: undirskrift.virk !== false ? true : null,
      onchange: () => { undirsk.hidden = !medUndirskrift.checked; } });
    const undirsk = el('div', { class: 'sk-undirsk', html: undirskriftHtml({ ...undirskrift, virk: true }) || '<p class="skyring">Engin undirskrift ennþá.</p>' });
    undirsk.hidden = undirskrift.virk === false;

    fylla(thradurSvid, [
      el('button', { type: 'button', class: 'sk-tilbaka', texti: '← Pósthólf', onclick: () => {
        opinn = null; history.replaceState(null, '', location.pathname); teiknaLista(); teiknaTomtThrad(); } }),
      el('header', { class: 'sk-thradur__haus' }, [
        el('h2', { texti: t.efni || '(ekkert efni)' }),
        el('div', { class: 'sk-thradur__undir' }, [
          el('span', { texti: (t.fra_nafn ? t.fra_nafn + ' · ' : '') + (t.fra_netfang || '') }),
          t.fyr && t.fyr.nafn ? el('a', { class: 'sk-merki', href: 'tolfraedi.html?f=' + encodeURIComponent(t.fyrirtaeki_id), texti: t.fyr.nafn }) : null,
          el('span', { class: 'sk-thradur__hn' }, [
            el('button', { type: 'button', class: 'btn btn--sm btn--ghost sk-stort-hn', 'aria-pressed': String(stort),
              texti: stort ? 'Sýna listann' : 'Stærra', title: stort ? 'Sýna listann aftur' : 'Fela listann og lesa póstinn stærri',
              onclick: () => { stort = !stort; try { localStorage.setItem('sk-stort', stort ? '1' : '0'); } catch (e) { /* ekkert */ }
                grind.classList.toggle('er-stort', stort); teiknaThrad(t); } }),
            gmail ? el('a', { class: 'btn btn--sm btn--ghost', href: gmail, target: '_blank', rel: 'noopener noreferrer', texti: 'Opna í Gmail' }) : null
          ])
        ])
      ]),
      el('ol', { class: 'sk-skilabod' }, skilabod.map((m) => el('li', { class: 'sk-sb' + (m.fra_okkur ? ' sk-sb--okkar' : '') }, [
        el('div', { class: 'sk-sb__haus' }, [
          el('strong', { texti: m.fra_okkur ? 'Við' + (m.fra_nafn ? ' (' + m.fra_nafn + ')' : '') : m.fra_nafn || m.fra_netfang || 'Óþekktur' }),
          el('span', { texti: hvenaer(m.dags, true) })
        ]),
        el('div', { class: 'sk-sb__texti', texti: m.texti || '(enginn texti, opnaðu í Gmail)' }),
        m.vidhengi ? el('p', { class: 'sk-sb__vidhengi', texti: (m.vidhengi === 1 ? '1 viðhengi' : m.vidhengi + ' viðhengi') + ', opnaðu þráðinn í Gmail til að sjá ' + (m.vidhengi === 1 ? 'það' : 'þau') + '.' }) : null
      ])).concat(svor.filter((s) => s.stada !== 'send' || !skilabod.some((m) => m.fra_okkur && new Date(m.dags) >= new Date(s.stofnad))).map((s) =>
        el('li', { class: 'sk-sb sk-sb--okkar sk-sb--svar' }, [
          el('div', { class: 'sk-sb__haus' }, [
            el('strong', { texti: 'Svarið þitt' }),
            el('span', { class: 'sk-svarstada sk-svarstada--' + s.stada, texti: s.stada === 'send' ? 'Sent ' + hvenaer(s.sent_dags || s.stofnad, true)
              : s.stada === 'villa' ? 'Fór ekki: ' + (s.villa || 'villa') : 'Á leiðinni, fer innan 5 mínútna' })
          ]),
          el('div', { class: 'sk-sb__texti', texti: s.texti })
        ])))),
      el('form', { class: 'sk-svar', onsubmit: async (e) => {
        e.preventDefault();
        const texti = svarReitur.value.trim();
        if (!texti) { svarReitur.focus(); return; }
        sendaHn.disabled = true; sendaHn.textContent = 'Sendi…';
        try {
          const u = medUndirskrift.checked ? { ...undirskrift, virk: true } : null;
          const lokaTexti = u && undirskriftTexti(u) ? texti + '\n\n' + undirskriftTexti(u) : texti;
          const nytt = await g.svaraPosti(t.id, lokaTexti, svarHtml(texti, u));
          delete uppkost[t.id];
          opinnGogn.svor = (opinnGogn.svor || []).concat([nytt]);
          teiknaThrad(t);
        } catch (villa) {
          stada.textContent = villa.message || 'Svarið fór ekki. Reyndu aftur.';
          stada.className = 'sk-svar__stada er-villa';
          sendaHn.disabled = false; sendaHn.textContent = 'Senda svar';
        }
      } }, [
        svarReitur,
        undirsk,
        el('div', { class: 'sk-svar__fot' }, [
          el('span', { class: 'sk-svar__undir' }, [
            el('label', { class: 'sk-svar__val' }, [medUndirskrift, document.createTextNode('Með undirskrift')]),
            el('button', { type: 'button', class: 'sk-tengill', texti: 'Breyta undirskrift', onclick: () => opnaUndirskrift(() => teiknaThrad(t)) })
          ]),
          el('span', { class: 'skyring', texti: g.prufa ? 'Í prufu fer ekkert út.' : 'Fer frá tveir@tveir.is, sem svar í þessum þræði.' }),
          sendaHn
        ]),
        stada
      ])
    ]);
  }

  /* Undirskriftin: form með forsýn sem uppfærist um leið */
  function opnaUndirskrift(eftir) {
    const kort = el('div', { class: 'pdialog__kort sk-us' });
    const d = el('dialog', { class: 'pdialog sk-us-gluggi', 'aria-labelledby': 'sk-us-h' }, [kort]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    const u = { ...undirskrift };
    const forsyn = el('div', { class: 'sk-us__forsyn' });
    const teikna = () => { forsyn.innerHTML = '<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#1c3050;">Hæ,<br><br>Takk fyrir póstinn, við skoðum þetta í dag.</div>' + undirskriftHtml({ ...u, virk: true }); };
    const reitur = (merki, lykill, eig = {}) => {
      const inn = el('input', { type: 'text', value: u[lykill] || '', maxlength: '160', autocomplete: 'off', ...eig,
        oninput: (e) => { u[lykill] = e.target.value; teikna(); } });
      return el('label', { class: 'field' }, [el('span', { texti: merki }), inn]);
    };
    const villa = el('p', { class: 'sk-svar__stada er-villa', role: 'alert', hidden: true });
    const vistaHn = el('button', { type: 'button', class: 'btn', texti: 'Vista undirskrift' });
    vistaHn.addEventListener('click', async () => {
      if (u.merki && !oruggSlod(u.merki)) { villa.textContent = 'Slóðin á merkið þarf að byrja á https://'; villa.hidden = false; return; }
      vistaHn.disabled = true; villa.hidden = true;
      const hreint = {};
      for (const k of ['kvedja', 'nafn', 'starf', 'simi', 'netfang', 'vefur', 'merki']) hreint[k] = String(u[k] || '').trim().slice(0, 160);
      hreint.virk = u.virk !== false;
      try {
        await g.vistaUndirskrift(hreint); undirskrift = { ...SJALFGEFIN, ...hreint }; d.close();
        if (eftir) eftir();
        else { const opid = opinn && thraedir.find((x) => x.id === opinn); if (opid && opinnGogn) teiknaThrad(opid); }
      }
      catch (e) { villa.textContent = e.message || 'Vistaðist ekki.'; villa.hidden = false; vistaHn.disabled = false; }
    });
    fylla(kort, [
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { id: 'sk-us-h', texti: 'Undirskrift' }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
      ]),
      el('p', { class: 'skyring', texti: 'Fer neðst í svörin þín úr pósthólfinu. Vistast á aðganginum þínum, svo hún fylgir þér á milli tækja.' }),
      el('div', { class: 'sk-us__grind' }, [
        el('div', { class: 'sk-us__form' }, [
          reitur('Kveðja', 'kvedja', { placeholder: 'Kveðja,' }),
          el('div', { class: 'field-row' }, [reitur('Nafn', 'nafn'), reitur('Starfsheiti', 'starf', { placeholder: 'Til dæmis Markaðsstjóri' })]),
          el('div', { class: 'field-row' }, [reitur('Sími', 'simi', { inputmode: 'tel', placeholder: '+354 ...' }), reitur('Netfang', 'netfang', { inputmode: 'email' })]),
          reitur('Vefsíða', 'vefur', { placeholder: 'tveir.is' }),
          reitur('Slóð á merki (https)', 'merki', { inputmode: 'url', placeholder: 'https://' }),
          villa,
          el('div', { class: 'spjald__fot' }, [vistaHn])
        ]),
        el('div', { class: 'sk-us__forsyn-svid' }, [el('span', { class: 'ts-midi', texti: 'Svona lítur hún út' }), forsyn])
      ])
    ]);
    teikna();
    document.body.append(d);
    d.showModal();
  }

  await hlada();
  /* Nýr póstur kemur inn á 5 mínútna fresti: lesum aftur á mínútu fresti meðan síðan sést */
  setInterval(async () => {
    if (document.hidden) return;
    try {
      const nyir = await g.postholf() || [];
      const breytt = nyir.length !== thraedir.length || nyir.some((t, i) => !thraedir[i] || thraedir[i].id !== t.id || thraedir[i].sidast !== t.sidast);
      thraedir = nyir.map((t) => { const g0 = thraedir.find((x) => x.id === t.id); return g0 && g0.lesid_kerfi > (t.lesid_kerfi || '') ? { ...t, lesid_kerfi: g0.lesid_kerfi } : t; });
      if (breytt) { if (opinn) opinnGogn = null; teiknaAllt(); uppfaeraMerki(); }
    } catch (e) { /* reynum aftur eftir mínútu */ }
  }, 60000);
}
