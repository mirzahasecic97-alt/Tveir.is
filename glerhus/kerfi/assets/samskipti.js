/* ==========================================================================
   Samskipti > Pósthólf: Gmail pósthólfið á vinnusvæðinu
   Apps Script (postholf.gs) afritar pósthólfið hingað á 5 mínútna fresti.
   Hér má lesa þræðina, sjá hvaða viðskiptavin þeir varða og svara. Svarið
   fer frá netfangi stofunnar í sama þræði. Bara stjórnendur.

   Pósthólfið er bara hjá stofum með postholf (Tveir). Aðrar stofur sjá
   hér Verkpóst: póst á verk-netfangið frá netföngum sem eru ekki skráð á
   viðskiptavin. Úr honum má búa til verk eða bjóða sendandanum inn. Svör
   við honum fara úr pósthólfi stjórnandans sjálfs, héðan fer enginn póstur.

   Gervigreind stofunnar (Claude eða ChatGPT) skrifar drög og samantektir
   ef hún er tengd. Það eru alltaf drög sem manneskja les yfir.
   ========================================================================== */

import { gogn, el, fylla, vardaHlid, teiknaHaus, uppfaeraMerki, samskiptaFlipar, postOlesinn, tilkynna, opnaBodGlugga } from './portal.js';
import { undirskriftTexti, undirskriftHtml, svarHtml, sjalfgefinUndirskrift, opnaUndirskriftGlugga } from './undirskrift.js';

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
/* ------------------------------------------------------------------
   Flokkun: sjálfvirk, út frá sendanda og efni. Viðskiptavinur vinnur alltaf.
   ------------------------------------------------------------------ */
const FLOKKAR = [['vidskiptavinir', 'Viðskiptavinir'], ['reikningar', 'Reikningar'], ['tilkynningar', 'Tilkynningar'], ['annad', 'Annað']];
const KERFI = /(^|[.@-])(no-?reply|do-?not-?reply|notifications?|notify|mailer|mailer-daemon|newsletter|news|updates?|alerts?|support|hello|team)@|@([a-z0-9-]+\.)*(facebookmail|facebook|meta|instagram|google|youtube|linkedin|github|vercel|supabase|stripe|paypal|apple|microsoft|slack|notion|canva|shopify|mailchimp|hubspot|zapier|make|tiktok|anthropic|openai|figma|dropbox|wetransfer)\.[a-z.]+$/i;
const REIKNINGAR = /reikning|invoice|kvittun|receipt|greiðsl|greidsl|payment|faktura|innheimt|gjalddag|uppgjör|bókhald|bokhald/i;
function flokkur(t) {
  if (t.fyrirtaeki_id) return 'vidskiptavinir';
  if (REIKNINGAR.test(t.efni || '') || REIKNINGAR.test(t.snid || '')) return 'reikningar';
  if (KERFI.test(t.fra_netfang || '')) return 'tilkynningar';
  return 'annad';
}


async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Samskipti');
  document.body.classList.add('sk-sida');
  const innihald = document.getElementById('innihald');

  /* Stofan: Tveir (eða gagnagrunnur án stofa) heldur sínu pósthólfi og netfangi */
  const stofa = ek.stofa || null;
  const postholf = !stofa || stofa.postholf !== false;
  const fraNetfang = !stofa || stofa.slug === 'tveir' ? 'tveir@tveir.is' : (stofa.netfang || 'netfangi stofunnar');
  const fraTexti = 'Fer frá ' + fraNetfang;

  /* Gervigreind stofunnar. Í sýnidæminu svarar hún alltaf með sýnitexta. */
  let gervigreind = !!g.prufa;
  if (!gervigreind) {
    try { const t = g.tengingarStada ? await g.tengingarStada() : null; gervigreind = !!(t && (t.claude || t.chatgpt)); }
    catch (e) { gervigreind = false; }
  }
  /* Drög og samantektir frá gervigreindinni, á hvern þráð, meðan síðan er opin */
  const ggDrog = {};
  const samantektir = {};

  /* Undirskriftin: vistuð í gagnagrunninum, annars sjálfgefin */
  const SJALFGEFIN = sjalfgefinUndirskrift(g, ek);
  let undirskrift = { ...SJALFGEFIN };
  try { const u = await g.undirskrift(); if (u) undirskrift = { ...SJALFGEFIN, ...u }; } catch (e) { /* sjálfgefin dugar */ }

  let thraedir = [];
  let villa = null;
  let sia = 'allt';
  let leit = '';
  let opinn = new URLSearchParams(location.search).get('t');
  let opinnGogn = null;
  const uppkost = {};   /* svör í smíðum, svo endurnýjun á mínútu fresti þurrki þau ekki út */

  const listiSvid = el('div', { class: 'sk-listi', role: 'list' });
  const thradurSvid = el('section', { class: 'sk-thradur', 'aria-live': 'polite' });
  const grind = el('div', { class: 'sk-grind' }, [listiSvid, thradurSvid]);
  const siuHnappar = el('div', { class: 'sk-siur', role: 'group', 'aria-label': 'Sía' });
  const leitReitur = el('input', { type: 'search', class: 'sk-leit', placeholder: 'Leita í pósti', 'aria-label': 'Leita í pósti',
    oninput: (e) => { leit = e.target.value.trim().toLowerCase(); teiknaLista(); } });

  fylla(innihald, [
    samskiptaFlipar('postholf'),
    el('div', { class: 'page-head sk-haus', style: 'padding-top:0' }, [
      el('div', { class: 'sk-haus__efst' }, [
        el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: postholf ? 'Pósthólf' : 'Verkpóstur' }),
        el('div', { class: 'sk-haus__hn' }, [
          el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Undirskrift', onclick: () => opnaUndirskrift() }),
          postholf ? el('button', { type: 'submit', class: 'btn', texti: '+ Nýr póstur', onclick: () => opnaNyjanPost() }) : null
        ])
      ]),
      postholf ? null : el('p', { class: 'lead', style: 'margin-top:6px', texti: 'Póstur á '
        + ((stofa && stofa.verk) || 'verk-netfangið') + ' frá netföngum sem eru ekki skráð á viðskiptavin. Búðu til verk úr honum eða bjóddu sendandanum inn.' }),
      el('div', { class: 'sk-tol' }, [leitReitur, siuHnappar])
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
    const valkostir = [['allt', 'Allt', thraedir.length], ['olesid', 'Ólesið', olesnir]]
      .concat(FLOKKAR.map(([k, h]) => [k, h, thraedir.filter((t) => flokkur(t) === k).length]));
    fylla(siuHnappar, valkostir.map(([k, h, n]) =>
      el('button', { type: 'button', class: 'filter', 'aria-pressed': String(sia === k), onclick: () => { sia = k; teiknaTolur(); teiknaLista(); } },
        [document.createTextNode(h), n ? el('span', { class: 'sk-siur__tala', texti: String(n) }) : null])));
  }

  function sidir() {
    return thraedir.filter((t) => (sia === 'allt' ? true : sia === 'olesid' ? postOlesinn(t) : flokkur(t) === sia))
      .filter((t) => !leit || [t.efni, t.fra_nafn, t.fra_netfang, t.snid, t.fyr && t.fyr.nafn].join(' ').toLowerCase().includes(leit));
  }

  function teiknaLista() {
    if (villa) { fylla(listiSvid, [el('p', { class: 'tomt', texti: villa.message || 'Náði ekki í pósthólfið.' })]); return; }
    const syndir = sidir();
    if (!thraedir.length) {
      fylla(listiSvid, [el('div', { class: 'sk-tomt' }, [
        el('strong', { texti: 'Ekkert hér ennþá' }),
        el('p', { texti: g.prufa ? 'Engir sýniþræðir.' : postholf
          ? 'Pósthólfið fyllist innan 5 mínútna eftir að postholf.gs er komin inn í Apps Script.'
          : 'Hingað kemur póstur á verk-netfangið frá netföngum sem eru ekki skráð á viðskiptavin. Póstur frá skráðum viðskiptavinum verður beint að verkum.' })
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
          t.fyr && t.fyr.nafn ? el('span', { class: 'sk-merki', texti: t.fyr.nafn })
            : flokkur(t) !== 'annad' && sia === 'allt' ? el('span', { class: 'sk-merki sk-merki--' + flokkur(t), texti: (FLOKKAR.find(([k]) => k === flokkur(t)) || [])[1] }) : null
        ])
      ]);
    }));
  }

  function teiknaTomtThrad() {
    grind.classList.remove('er-opid');
    document.body.classList.remove('sk-les');
    fylla(thradurSvid, [el('div', { class: 'sk-tomt sk-tomt--thradur' }, [
      el('strong', { texti: 'Veldu þráð' }),
      el('p', { texti: g.prufa ? 'Svar sem þú skrifar hér fer hvergi í prufu.'
        : postholf ? 'Svar sem þú skrifar hér fer frá ' + fraNetfang + ' í sama þræði.'
          : 'Héðan fer enginn póstur. Svör fara úr þínu eigin pósthólfi.' })
    ])]);
  }

  async function opna(id, hljodlaust) {
    const t = thraedir.find((x) => x.id === id);
    if (!t) { opinn = null; teiknaTomtThrad(); return; }
    opinn = id;
    if (!hljodlaust) history.replaceState(null, '', '?t=' + encodeURIComponent(id));
    const varOpid = grind.classList.contains('er-opid');
    grind.classList.add('er-opid');
    document.body.classList.add('sk-les');
    if (!hljodlaust && !varOpid) window.scrollTo({ top: 0 });
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
    const verkThradur = t.uppruni === 'verk' || !postholf;
    const svarReitur = el('textarea', { class: 'sk-svar__texti', rows: '5', maxlength: '10000',
      placeholder: (postholf ? 'Skrifaðu svar til ' : 'Drög að svari til ') + (t.fra_nafn ? t.fra_nafn.split(' ')[0] : t.fra_netfang || 'viðtakanda') + '…', 'aria-label': 'Svar',
      oninput: (e) => { uppkost[t.id] = e.target.value; merkjaDrog(); } });
    svarReitur.value = uppkost[t.id] || '';
    const stada = el('p', { class: 'sk-svar__stada', role: 'status' });
    const sendaHn = el('button', { type: 'submit', class: 'btn', texti: 'Senda svar' });
    const medUndirskrift = el('input', { type: 'checkbox', checked: undirskrift.virk !== false ? true : null,
      onchange: () => { undirsk.hidden = !medUndirskrift.checked; } });
    const undirsk = el('div', { class: 'sk-undirsk', html: undirskriftHtml({ ...undirskrift, virk: true }) || '<p class="skyring">Engin undirskrift ennþá.</p>' });
    undirsk.hidden = undirskrift.virk === false;

    /* Merki yfir svarinu meðan textinn er óbreyttur frá gervigreindinni */
    const drogMerki = el('span', { class: 'sk-sb__drog', style: 'align-self:flex-start; width:max-content', texti: 'Drög frá gervigreind' });
    /* Stíll merkisins setur display, svo hidden dugar ekki */
    function merkjaDrog() { drogMerki.style.display = ggDrog[t.id] && svarReitur.value === ggDrog[t.id] ? '' : 'none'; }
    merkjaDrog();

    /* Drög að svari: spurt áður en skrifað er yfir texta sem manneskja skrifaði */
    const ggHn = gervigreind ? el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Drög með gervigreind',
      onclick: async () => {
        const nu = svarReitur.value.trim();
        if (nu && svarReitur.value !== ggDrog[t.id] && !confirm('Skrifa yfir það sem stendur í svarinu?')) return;
        ggHn.disabled = true; ggHn.textContent = 'Gervigreindin skrifar';
        stada.className = 'sk-svar__stada'; stada.textContent = '';
        try {
          const svar = await g.gervigreind('svar_thradur', t.id);
          const texti = String(svar.texti || '').trim();
          if (texti) {
            ggDrog[t.id] = texti; uppkost[t.id] = texti; svarReitur.value = texti;
            stada.textContent = svar.synidaemi ? 'Sýnidæmi: þetta eru ekki alvöru drög.' : 'Lestu drögin yfir og breyttu áður en þú sendir.';
          }
        } catch (villa) {
          stada.textContent = villa.message || 'Þetta gekk ekki.'; stada.className = 'sk-svar__stada er-villa';
        }
        ggHn.disabled = false; ggHn.textContent = 'Drög með gervigreind';
        merkjaDrog();
        svarReitur.focus();
      } }) : null;

    /* Samantekt þráðarins: sést bara hér, er ekki vistuð */
    const samantektSvid = el('div', { 'aria-live': 'polite' });
    const teiknaSamantekt = () => {
      const s = samantektir[t.id];
      fylla(samantektSvid, s ? [el('div', { class: 'ath', style: 'margin:0 0 16px' }, [
        el('div', { class: 'ath__haus' }, [
          el('strong', { texti: 'Samantekt frá gervigreind' }),
          el('span', { texti: s.synidaemi ? 'Sýnidæmi' : 'Ekki vistuð' }),
          el('button', { type: 'button', class: 'sk-tengill', style: 'margin-left:auto', texti: 'Fela',
            onclick: () => { delete samantektir[t.id]; teiknaSamantekt(); } })
        ]),
        el('div', { class: 'ath__texti', style: 'white-space:pre-wrap', texti: s.texti })
      ])] : []);
    };
    teiknaSamantekt();
    const samantektHn = gervigreind ? el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Samantekt',
      onclick: async () => {
        samantektHn.disabled = true; samantektHn.textContent = 'Les þráðinn';
        try {
          const svar = await g.gervigreind('samantekt_thradur', t.id);
          samantektir[t.id] = { texti: String(svar.texti || '').trim(), synidaemi: !!svar.synidaemi };
        } catch (villa) {
          samantektir[t.id] = null;
          fylla(samantektSvid, [el('p', { class: 'sk-svar__stada er-villa', style: 'margin:0 0 12px', texti: villa.message || 'Þetta gekk ekki.' })]);
          samantektHn.disabled = false; samantektHn.textContent = 'Samantekt';
          return;
        }
        samantektHn.disabled = false; samantektHn.textContent = 'Samantekt';
        teiknaSamantekt();
      } }) : null;

    /* Verkpóstur: verk úr þræðinum, eða boð til sendandans */
    const verkHn = verkThradur || g.prufa ? el('button', { type: 'button', class: 'btn btn--sm', texti: 'Búa til verk',
      onclick: () => opnaVerkUrThraedi(t) }) : null;
    const bodHn = (verkThradur || g.prufa) && !t.fyrirtaeki_id && t.fra_netfang
      ? el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Bjóða sem notanda', onclick: () => opnaBod(t) }) : null;

    /* Svarið: sent héðan í pósthólfi stofunnar, annars bara drög sem
       eru afrituð eða opnuð í póstforritinu */
    const svarSvaedi = postholf ? el('form', { class: 'sk-svar', onsubmit: async (e) => {
        e.preventDefault();
        const texti = svarReitur.value.trim();
        if (!texti) { svarReitur.focus(); return; }
        sendaHn.disabled = true; sendaHn.textContent = 'Sendi…';
        try {
          const u = medUndirskrift.checked ? { ...undirskrift, virk: true } : null;
          const lokaTexti = u && undirskriftTexti(u) ? texti + '\n\n' + undirskriftTexti(u) : texti;
          const nytt = await g.svaraPosti(t.id, lokaTexti, svarHtml(texti, u));
          delete uppkost[t.id]; delete ggDrog[t.id];
          opinnGogn.svor = (opinnGogn.svor || []).concat([nytt]);
          teiknaThrad(t);
        } catch (villa) {
          stada.textContent = villa.message || 'Svarið fór ekki. Reyndu aftur.';
          stada.className = 'sk-svar__stada er-villa';
          sendaHn.disabled = false; sendaHn.textContent = 'Senda svar';
        }
      } }, [
        drogMerki,
        svarReitur,
        undirsk,
        el('div', { class: 'sk-svar__fot' }, [
          el('span', { class: 'sk-svar__undir' }, [
            el('label', { class: 'sk-svar__val' }, [medUndirskrift, document.createTextNode('Með undirskrift')]),
            el('button', { type: 'button', class: 'sk-tengill', texti: 'Breyta undirskrift', onclick: () => opnaUndirskrift(() => teiknaThrad(t)) })
          ]),
          ggHn,
          el('span', { class: 'skyring', texti: g.prufa ? 'Í prufu fer ekkert út.' : fraTexti + ', sem svar í þessum þræði.' }),
          sendaHn
        ]),
        stada
      ])
      : el('div', { class: 'sk-svar' }, [
        drogMerki,
        svarReitur,
        el('div', { class: 'sk-svar__fot' }, [
          ggHn,
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Afrita',
            onclick: async () => {
              const texti = lokaDrog();
              if (!texti) { svarReitur.focus(); return; }
              try { await navigator.clipboard.writeText(texti); tilkynna('Afritað'); }
              catch (e) { svarReitur.select(); tilkynna('Náði ekki að afrita. Textinn er valinn, afritaðu hann.'); }
            } }),
          t.fra_netfang ? el('button', { type: 'button', class: 'btn btn--sm', texti: 'Opna í pósti',
            onclick: () => {
              const texti = lokaDrog();
              location.href = 'mailto:' + encodeURIComponent(t.fra_netfang).replace(/%40/g, '@')
                + '?subject=' + encodeURIComponent('Re: ' + (t.efni || '')) + '&body=' + encodeURIComponent(texti.slice(0, 1800));
            } }) : null,
          el('span', { class: 'skyring', texti: 'Héðan fer enginn póstur. Svaraðu úr þínu eigin pósthólfi.' })
        ]),
        stada
      ]);
    function lokaDrog() {
      const texti = svarReitur.value.trim();
      const u = undirskrift.virk !== false ? undirskriftTexti({ ...undirskrift, virk: true }) : '';
      return texti && u ? texti + '\n\n' + u : texti;
    }

    fylla(thradurSvid, [
      el('button', { type: 'button', class: 'sk-tilbaka', texti: postholf ? '← Pósthólf' : '← Verkpóstur', onclick: () => {
        opinn = null; history.replaceState(null, '', location.pathname); teiknaLista(); teiknaTomtThrad(); window.scrollTo({ top: 0 }); } }),
      el('header', { class: 'sk-thradur__haus' }, [
        el('h2', { texti: t.efni || '(ekkert efni)' }),
        el('div', { class: 'sk-thradur__undir' }, [
          el('span', { texti: (t.fra_nafn ? t.fra_nafn + ' · ' : '') + (t.fra_netfang || '') }),
          t.fyr && t.fyr.nafn ? el('a', { class: 'sk-merki', href: 'tolfraedi.html?f=' + encodeURIComponent(t.fyrirtaeki_id), texti: t.fyr.nafn }) : null,
          el('span', { class: 'sk-thradur__hn' }, [
            verkHn, bodHn, samantektHn,
            gmail ? el('a', { class: 'btn btn--sm btn--ghost', href: gmail, target: '_blank', rel: 'noopener noreferrer', texti: 'Opna í Gmail' }) : null
          ])
        ])
      ]),
      samantektSvid,
      el('ol', { class: 'sk-skilabod' }, skilabod.map((m) => el('li', { class: 'sk-sb' + (m.fra_okkur ? ' sk-sb--okkar' : '') + (m.drog ? ' sk-sb--drog' : '') }, [
        el('div', { class: 'sk-sb__haus' }, [
          el('strong', {}, [
            m.drog ? el('span', { class: 'sk-sb__drog', texti: 'Drög' }) : null,
            document.createTextNode(m.drog ? 'Ekki sent' : m.fra_okkur ? 'Við' + (m.fra_nafn ? ' (' + m.fra_nafn + ')' : '') : m.fra_nafn || m.fra_netfang || 'Óþekktur')
          ]),
          el('span', { texti: (m.drog ? 'Vistað ' : '') + hvenaer(m.dags, true) })
        ]),
        el('div', { class: 'sk-sb__texti', texti: m.texti || (postholf ? '(enginn texti, opnaðu í Gmail)' : '(enginn texti)') }),
        m.vidhengi ? el('p', { class: 'sk-sb__vidhengi', texti: (m.vidhengi === 1 ? '1 viðhengi' : m.vidhengi + ' viðhengi')
          + (postholf ? ', opnaðu þráðinn í Gmail til að sjá ' + (m.vidhengi === 1 ? 'það' : 'þau') + '.' : '.') }) : null
      ])).concat(svor.filter((s) => s.stada !== 'send' || !skilabod.some((m) => m.fra_okkur && !m.drog && new Date(m.dags) >= new Date(s.stofnad))).map((s) =>
        el('li', { class: 'sk-sb sk-sb--okkar sk-sb--svar' }, [
          el('div', { class: 'sk-sb__haus' }, [
            el('strong', { texti: 'Svarið þitt' }),
            el('span', { class: 'sk-svarstada sk-svarstada--' + s.stada, texti: s.stada === 'send' ? 'Sent ' + hvenaer(s.sent_dags || s.stofnad, true)
              : s.stada === 'villa' ? 'Fór ekki: ' + (s.villa || 'villa') : 'Á leiðinni, fer innan 5 mínútna' })
          ]),
          el('div', { class: 'sk-sb__texti', texti: s.texti })
        ])))),
      svarSvaedi
    ]);
  }

  /* Verkpóstur: verk úr þræðinum hjá fyrirtæki sem er valið */
  async function opnaVerkUrThraedi(t) {
    let fyrirtaekin = [];
    try { fyrirtaekin = (await g.fyrirtaeki()) || []; } catch (e) { fyrirtaekin = []; }
    const val = el('select', { required: true }, [el('option', { value: '', texti: 'Veldu fyrirtæki' })].concat(
      fyrirtaekin.map((f) => el('option', { value: f.id, selected: f.id === t.fyrirtaeki_id, texti: f.nafn }))));
    const stadan = el('div', { class: 'form-status', role: 'status', hidden: true });
    const buaHn = el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Búa til verk' });
    let buid = false;
    const d = gluggi('Búa til verk', [
      el('p', { class: 'skyring', style: 'margin-top:8px', texti: 'Verkin verða til hjá fyrirtækinu úr síðasta pósti sendandans í þræðinum: eitt verk á hverja línu í lista, annars eitt verk úr efninu.' }),
      fyrirtaekin.length ? null : el('p', { class: 'form-status form-status--err', texti: 'Ekkert fyrirtæki er til. Stofnaðu það á Stjórnborði fyrst.' }),
      el('label', { class: 'field' }, [el('span', { texti: 'Fyrirtæki' }), val]),
      stadan,
      el('div', { class: 'spjald__fot' }, [buaHn])
    ], async () => {
      if (buid) { d.close(); return; }
      if (!val.value) { val.focus(); return; }
      buaHn.disabled = true;
      try {
        const svar = await g.verkUrThraedi(t.id, val.value);
        const titlar = Array.isArray(svar.titlar) ? svar.titlar : [];
        stadan.className = 'form-status form-status--ok';
        stadan.textContent = svar.texti || svar.svar
          || (Number(svar.fjoldi) === 1 ? '1 verk var búið til.' : (Number(svar.fjoldi) || titlar.length) + ' verk voru búin til.');
        stadan.hidden = false;
        if (titlar.length) stadan.append(el('ul', { style: 'margin:8px 0 0 18px' }, titlar.map((x) => el('li', { texti: x }))));
        buid = true; val.disabled = true;
        buaHn.textContent = 'Loka';
        buaHn.disabled = false;
      } catch (villa) {
        stadan.className = 'form-status form-status--err';
        stadan.textContent = villa.message || 'Þetta gekk ekki.';
        stadan.hidden = false;
        buaHn.disabled = false;
      }
    });
  }

  /* Boð til sendandans: sami gluggi og á Stjórnborði, með nafni og netfangi úr þræðinum */
  function opnaBod(t) {
    return opnaBodGlugga({ hlutverk: 'vidskiptavinur', netfang: t.fra_netfang || '', nafn: t.fra_nafn || '',
      fyrirtaeki_id: t.fyrirtaeki_id || '' });
  }

  /* Einfaldur gluggi með formi. vista keyrir þegar formið er sent. */
  function gluggi(titill, born, vista) {
    const d = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort' }, [
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { texti: titill }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
      ]),
      el('form', { style: 'margin-top:12px; display:flex; flex-direction:column; gap:14px', novalidate: true,
        onsubmit: (e) => { e.preventDefault(); vista(); } }, born)
    ])]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
    return d;
  }

  /* Nýr póstur: til, efni, texti og undirskrift. Fer frá netfangi stofunnar innan 5 mínútna. */
  let nyrUppkast = { til: '', efni: '', texti: '' };
  async function opnaNyjanPost(forfyllt) {
    if (forfyllt) nyrUppkast = { ...nyrUppkast, ...forfyllt };
    const kort = el('div', { class: 'pdialog__kort sk-np' });
    const d = el('dialog', { class: 'pdialog sk-us-gluggi', 'aria-labelledby': 'sk-np-h' }, [kort]);
    d.addEventListener('close', () => d.remove());

    /* Tillögur að viðtakendum: viðskiptavinir fyrst, svo þeir sem hafa skrifað okkur */
    const tillogur = new Map();
    try {
      for (const n of (await g.notendur()) || []) {
        if (n.netfang && n.hlutverk === 'vidskiptavinur') tillogur.set(n.netfang.toLowerCase(), (n.nafn || n.netfang) + (n.fyrirtaeki && n.fyrirtaeki.nafn ? ' · ' + n.fyrirtaeki.nafn : ''));
      }
    } catch (e) { /* bara tillögur */ }
    for (const t of thraedir) {
      if (t.fra_netfang && !tillogur.has(t.fra_netfang) && flokkur(t) !== 'tilkynningar') tillogur.set(t.fra_netfang, t.fra_nafn || t.fra_netfang);
    }
    const listiId = 'sk-np-netfong';
    const datalist = el('datalist', { id: listiId }, [...tillogur].slice(0, 200).map(([n, h]) => el('option', { value: n, label: h })));

    const til = el('input', { type: 'text', class: 'sk-np__til', list: listiId, value: nyrUppkast.til, autocomplete: 'off', inputmode: 'email',
      placeholder: 'netfang@fyrirtaeki.is, fleiri með kommu', 'aria-label': 'Til', oninput: (e) => { nyrUppkast.til = e.target.value; } });
    const efni = el('input', { type: 'text', maxlength: '200', value: nyrUppkast.efni, placeholder: 'Efni', 'aria-label': 'Efni',
      oninput: (e) => { nyrUppkast.efni = e.target.value; } });
    const texti = el('textarea', { class: 'sk-np__texti', rows: '12', maxlength: '10000', placeholder: 'Skrifaðu póstinn…', 'aria-label': 'Texti' ,
      oninput: (e) => { nyrUppkast.texti = e.target.value; } });
    texti.value = nyrUppkast.texti;
    const medU = el('input', { type: 'checkbox', checked: undirskrift.virk !== false ? true : null, onchange: () => { forsyn.hidden = !medU.checked; } });
    const forsyn = el('div', { class: 'sk-undirsk', html: undirskriftHtml({ ...undirskrift, virk: true }) || '<p class="skyring">Engin undirskrift ennþá.</p>' });
    forsyn.hidden = undirskrift.virk === false;
    const villa = el('p', { class: 'sk-svar__stada er-villa', role: 'alert', hidden: true });
    const sendaHn = el('button', { type: 'submit', class: 'btn', texti: 'Senda póst' });
    sendaHn.addEventListener('click', async () => {
      const netfong = til.value.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
      const rangt = netfong.find((n) => !/^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$/i.test(n));
      const villuBod = !netfong.length ? 'Hverjum á pósturinn að fara?' : netfong.length > 10 ? 'Mest 10 viðtakendur.'
        : rangt ? 'Netfangið ' + rangt + ' er ekki rétt.' : !efni.value.trim() ? 'Efnið vantar.' : !texti.value.trim() ? 'Skrifaðu eitthvað fyrst.' : null;
      if (villuBod) { villa.textContent = villuBod; villa.hidden = false; return; }
      villa.hidden = true; sendaHn.disabled = true; sendaHn.textContent = 'Sendi…';
      const u = medU.checked ? { ...undirskrift, virk: true } : null;
      const lokaTexti = u && undirskriftTexti(u) ? texti.value.trim() + '\n\n' + undirskriftTexti(u) : texti.value.trim();
      try {
        await g.nyrPostur({ til: netfong.join(','), efni: efni.value.trim(), texti: lokaTexti, html: svarHtml(texti.value.trim(), u) });
        nyrUppkast = { til: '', efni: '', texti: '' };
        fylla(kort, [el('div', { class: 'ts-sent' }, [
          el('span', { class: 'ts-sent__hak', 'aria-hidden': 'true', texti: '✓' }),
          el('h2', { texti: 'Pósturinn er á leiðinni' }),
          el('p', { texti: 'Til ' + netfong.join(', ') + (g.prufa ? '. Í prufu fer ekkert út.' : '. Hann fer frá ' + fraNetfang + ' innan 5 mínútna.') }),
          el('button', { type: 'button', class: 'btn', texti: 'Loka', onclick: () => d.close() })
        ])]);
      } catch (e) {
        villa.textContent = e.message || 'Pósturinn fór ekki. Reyndu aftur.'; villa.hidden = false;
        sendaHn.disabled = false; sendaHn.textContent = 'Senda póst';
      }
    });

    fylla(kort, [
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { id: 'sk-np-h', texti: 'Nýr póstur' }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
      ]),
      el('div', { class: 'sk-np__reitir' }, [
        el('label', { class: 'sk-np__lina' }, [el('span', { texti: 'Til' }), til]),
        el('label', { class: 'sk-np__lina' }, [el('span', { texti: 'Efni' }), efni]),
        datalist
      ]),
      texti,
      forsyn,
      villa,
      el('div', { class: 'sk-svar__fot' }, [
        el('span', { class: 'sk-svar__undir' }, [
          el('label', { class: 'sk-svar__val' }, [medU, document.createTextNode('Með undirskrift')]),
          el('span', { class: 'skyring', texti: g.prufa ? 'Í prufu fer ekkert út.' : fraTexti })
        ]),
        sendaHn
      ])
    ]);
    document.body.append(d);
    d.showModal();
    setTimeout(() => (nyrUppkast.til ? (nyrUppkast.efni ? texti : efni) : til).focus(), 50);
  }

  /* Undirskriftin: glugginn er í undirskrift.js, sá sami og á Stillingum */
  async function opnaUndirskrift(eftir) {
    const ny = await opnaUndirskriftGlugga({ g, u: undirskrift, sjalfgefin: SJALFGEFIN });
    if (!ny) return;
    undirskrift = ny;
    if (eftir) eftir();
    else { const opid = opinn && thraedir.find((x) => x.id === opinn); if (opid && opinnGogn) teiknaThrad(opid); }
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
