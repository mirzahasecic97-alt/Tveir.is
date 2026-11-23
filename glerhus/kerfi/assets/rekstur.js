/* ==========================================================================
   Glerhúsið: rekstur (rekstur.html). Bara fyrir rekstraraðila Glerhússins.
   Stofurnar með stöðu og fjölda, samþykkja nýjar skráningar, loka, opna,
   stöðva póst og flytja út. Hér sjást aldrei gögn stofanna sjálfra.
   Allt fer í gegnum Edge Function rekstur, sem skráir hverja aðgerð.
   ========================================================================== */

import { gogn, el, fylla, vardaHlid, teiknaHaus, tilkynna, dags, staerd, erRekstraradili } from './portal.js';

const ek = await vardaHlid({ rekstur: true });
if (ek) start();

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Rekstur');
  const innihald = document.getElementById('innihald');
  const haus = el('div', { class: 'page-head', style: 'padding-top:0' }, [
    el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Rekstur' }),
    el('p', { class: 'lead', texti: 'Stofurnar í Glerhúsinu. Hér sést nafn, staða og fjöldi, aldrei gögn stofanna.' })
  ]);
  const bara = (texti) => fylla(innihald, [haus, el('div', { class: 'card pblokk' }, [el('p', { class: 'lead', texti })])]);

  if (g.prufa) { bara('Rekstur er ekki í boði í sýnidæminu.'); return; }
  /* Fersk staða: rekstraraðili getur hafa verið tekinn af listanum */
  const ms = (g.minStada ? await g.minStada().catch(() => null) : null) || ek.min_stada;
  if (!erRekstraradili({ min_stada: ms })) { bara('Bara rekstraraðili Glerhússins hefur aðgang hér.'); return; }

  const STODUR = { bidur: ['Bíður samþykkis', 'bid'], virk: ['Virk', 'ok'], lokud: ['Lokuð', 'hafnad'] };
  const LYSIGOGN = ['id', 'stofa_id', 'slug', 'nafn', 'stada', 'stofnad', 'netfang', 'sendir_fra', 'postholf', 'postur_ut_virkt', 'skraning', 'lokad'];
  const HEITI = { notendur: 'notendur', fyrirtaeki: 'fyrirtæki', taskar: 'verk', verkefni: 'verkefni', bod: 'boð', fyrirspurnir: 'fyrirspurnir' };
  let sia = 'allar';
  let gogn_ = null;
  const utflutt = {};

  async function saekja() {
    try { gogn_ = await g.rekstur('yfirlit'); }
    catch (villa) { bara(villa.message || 'Yfirlitið náðist ekki.'); return false; }
    return true;
  }

  /* Tölurnar úr stofur_yfirlit: allt sem er tala og ekki lýsigögn */
  function tolur(s) {
    const ut = [];
    for (const [k, v] of Object.entries(s)) {
      if (LYSIGOGN.includes(k) || typeof v !== 'number') continue;
      if (/baeti|staerd|geymsla/.test(k)) { ut.push(staerd(v) + ' í geymslu'); continue; }
      const lykill = k.replace(/^fjoldi_/, '').replace(/_fjoldi$/, '');
      ut.push(v + ' ' + (HEITI[lykill] || lykill.replace(/_/g, ' ')));
    }
    return ut.join(' · ');
  }

  async function gera(adgerd, gognin, hnappur, { stadfesta, eftir } = {}) {
    if (stadfesta && !confirm(stadfesta)) return;
    const fyrra = hnappur ? hnappur.textContent : '';
    if (hnappur) { hnappur.disabled = true; hnappur.textContent = 'Augnablik'; }
    try {
      const svar = await g.rekstur(adgerd, gognin);
      if (svar && svar.svar) tilkynna(svar.svar);
      if (eftir) eftir(svar);
      if (await saekja()) teikna();
    } catch (villa) {
      tilkynna(villa.message || 'Þetta gekk ekki.');
      if (hnappur) { hnappur.disabled = false; hnappur.textContent = fyrra; }
      /* Rofinn (opin skráning) sýnir aftur raunverulega stöðu */
      else teikna();
    }
  }

  function stofuLina(s) {
    const [heiti, litur] = STODUR[s.stada] || [s.stada || 'Óþekkt', 'nytt'];
    const tveir = s.slug === 'tveir';
    const hn = (texti, onclick, ghost = true) => el('button', { type: 'button', class: 'btn btn--sm' + (ghost ? ' btn--ghost' : ''), texti, onclick });
    const utf = utflutt[s.slug];
    return el('article', { class: 'card pblokk' }, [
      el('div', { style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap' }, [
        el('div', { style: 'min-width:0' }, [
          el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500', texti: s.nafn || s.slug }),
          el('div', { style: 'font-size:13.5px; color:var(--soft); margin-top:4px; word-break:break-all', 'data-ekki-thyda': '',
                      texti: (s.slug ? (tveir ? 'verk@tveir.is' : s.slug + '@verk.tveir.is') : '') + (s.netfang ? ', ' + s.netfang : '') }),
          el('div', { style: 'font-size:13.5px; color:var(--soft); margin-top:4px',
                      texti: (s.stofnad ? 'Skráð ' + dags(s.stofnad, true) : '') + (tolur(s) ? (s.stofnad ? '. ' : '') + tolur(s) : '') }),
          s.postur_ut_virkt === false ? el('div', { style: 'font-size:13.5px; color:#a3312a; margin-top:4px', texti: 'Póstur frá stofunni er stöðvaður.' }) : null
        ]),
        el('span', { class: 'pstat pstat--' + litur, texti: heiti })
      ]),
      el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; margin-top:14px' }, [
        s.stada === 'bidur' ? hn('Samþykkja', (e) => gera('samthykkja', { slug: s.slug }, e.currentTarget,
          { stadfesta: 'Samþykkja ' + (s.nafn || s.slug) + '? Eigandinn fær boð í pósti.' }), false) : null,
        s.stada === 'virk' && !tveir ? hn('Senda boð aftur', (e) => gera('senda_bod', { slug: s.slug }, e.currentTarget,
          { stadfesta: 'Senda eigandanum boðið aftur?' })) : null,
        s.stada !== 'lokud' && !tveir ? hn('Loka', (e) => {
          const astaeda = prompt('Af hverju er stofunni lokað? Þetta fer í skráninguna. Enginn kemst inn á meðan hún er lokuð.');
          if (astaeda === null) return;
          gera('loka', { slug: s.slug, astaeda }, e.currentTarget);
        }) : null,
        s.stada === 'lokud' ? hn('Opna', (e) => gera('opna', { slug: s.slug }, e.currentTarget,
          { stadfesta: 'Opna ' + (s.nafn || s.slug) + ' aftur?' })) : null,
        s.stada === 'virk' && !tveir ? hn(s.postur_ut_virkt === false ? 'Opna fyrir póst' : 'Stöðva póst', (e) => gera('postur',
          { slug: s.slug, virkt: s.postur_ut_virkt === false }, e.currentTarget,
          { stadfesta: s.postur_ut_virkt === false ? 'Leyfa póst frá stofunni aftur?' : 'Stöðva allan póst frá stofunni? Verk og athugasemdir halda áfram að virka.' })) : null,
        hn('Flytja út', (e) => gera('utflutningur', { slug: s.slug }, e.currentTarget, {
          stadfesta: 'Flytja öll gögn ' + (s.nafn || s.slug) + ' út í eina skrá? Það er skráð í rekstrarskrána.',
          eftir: (svar) => { if (svar && svar.slod) utflutt[s.slug] = svar.slod; }
        })),
        s.stada === 'lokud' && !tveir ? hn('Eyða', (e) => {
          const slod = prompt('Þetta eyðir stofunni, öllum gögnum hennar, skrám og innskráningum. Það er ekki hægt að taka til baka. Sláðu inn slóð stofunnar (' + s.slug + ') til að staðfesta.');
          if (slod === null) return;
          if (slod.trim().toLowerCase() !== s.slug) { tilkynna('Slóðin passar ekki. Engu var eytt.'); return; }
          gera('eyda', { slug: s.slug, stadfesting: slod.trim().toLowerCase() }, e.currentTarget);
        }) : null
      ]),
      utf ? el('div', { class: 'tilkynning', style: 'margin-top:14px' }, [
        el('div', { class: 'tilkynning__inn' }, [
          el('strong', { texti: 'Skráin er tilbúin' }),
          el('span', { class: 'undir', texti: 'Hlekkurinn gildir í sólarhring.' })
        ]),
        el('a', { class: 'btn btn--sm', href: utf, target: '_blank', rel: 'noopener noreferrer', texti: 'Sækja skrána' })
      ]) : null
    ]);
  }

  function teikna() {
    const stofur = (gogn_ && gogn_.stofur) || [];
    const anStofu = (gogn_ && gogn_.an_stofu) || [];
    const opin = gogn_ ? gogn_.skraning_opin : null;
    const fjoldi = (st) => stofur.filter((s) => s.stada === st).length;
    const synd = stofur.filter((s) => sia === 'allar' || s.stada === sia)
      .sort((a, b) => (a.stada === 'bidur' ? 0 : 1) - (b.stada === 'bidur' ? 0 : 1) || new Date(b.stofnad || 0) - new Date(a.stofnad || 0));
    const flipi = (gildi, heiti, n) => el('button', { type: 'button', class: 'pflipi', 'aria-pressed': String(sia === gildi),
      onclick: () => { sia = gildi; teikna(); } }, [document.createTextNode(heiti), el('b', { texti: String(n) })]);

    const rofi = el('input', { type: 'checkbox', checked: opin === true ? true : null, onchange: (e) => {
      const ny = e.target.checked;
      if (!confirm(ny ? 'Opna skráningu? Nýjar stofur fá boð strax, án þess að þú farir yfir þær.' : 'Láta nýjar skráningar bíða samþykkis?')) { e.target.checked = !ny; return; }
      gera('skraning', { opin: ny }, null);
    } });

    fylla(innihald, [
      haus,
      el('section', { class: 'card pblokk' }, [
        el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500', texti: 'Skráning af vefnum' }),
        el('label', { class: 'sb-rofi', style: 'margin-top:12px' }, [rofi, document.createTextNode('Opin skráning')]),
        el('p', { class: 'skyring', style: 'margin-top:8px', texti: opin === null
          ? 'Staða skráningarinnar náðist ekki.'
          : opin ? 'Nýjar stofur fá boð í pósti um leið og þær skrá sig.'
            : 'Nýjar stofur bíða hér þar til þú samþykkir þær. Þá fær eigandinn boð í pósti.' })
      ]),
      el('div', { class: 'pflipar', style: 'margin-top:20px' }, [
        flipi('allar', 'Allar', stofur.length),
        flipi('bidur', 'Bíða', fjoldi('bidur')),
        flipi('virk', 'Virkar', fjoldi('virk')),
        flipi('lokud', 'Lokaðar', fjoldi('lokud'))
      ]),
      el('div', { style: 'display:flex; flex-direction:column; gap:14px; margin-top:16px' },
        synd.length ? synd.map(stofuLina) : [el('p', { class: 'tomt', texti: 'Engin stofa hér.' })]),
      el('section', { class: 'card pblokk', style: 'margin-top:20px' }, [
        el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500', texti: 'Notendur án stofu' }),
        el('p', { class: 'skyring', style: 'margin-top:8px', texti: 'Aðgangar sem tilheyra engu Glerhúsi, til dæmis búnir til beint í Supabase. Þeir sjá ekkert. Bjóða notanda í Glerhúsinu tengir þá rétt.' }),
        anStofu.length
          ? el('div', { class: 'ptafla-skrun', style: 'margin-top:12px' }, [el('table', { class: 'ptafla' }, [el('tbody', {}, anStofu.map((n) => el('tr', {}, [
              el('td', {}, [el('div', { class: 'nafn', texti: n.nafn || n.netfang }), n.nafn ? el('div', { style: 'font-size:13px; color:var(--soft)', texti: n.netfang }) : null]),
              el('td', { style: 'color:var(--soft); text-align:right; white-space:nowrap', texti: n.stofnad ? dags(n.stofnad, true) : '' })
            ])))])])
          : el('p', { class: 'tomt', texti: 'Enginn.' })
      ])
    ]);
  }

  bara('Sæki stofurnar');
  if (await saekja()) teikna();
}
