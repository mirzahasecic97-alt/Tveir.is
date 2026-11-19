/* ==========================================================================
   Dagatal: fundirnir úr Google Calendar og skiladagar úr kerfinu á einum
   stað. Mánuður eða listi. Bara stjórnendur.
   ========================================================================== */

import { gogn, el, fylla, vardaHlid, teiknaHaus, geymt, geyma } from './portal.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

const MAN = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
const DAGAR = ['Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau', 'Sun'];
const DAGAR_LANGT = ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const kl = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
const oruggSlod = (s) => (/^https:\/\/[^\s"'<>]+$/.test(String(s || '')) ? s : null);

/* Flokkarnir og litirnir þeirra */
const FLOKKAR = {
  fundur: { heiti: 'Fundir', litur: '#5b93f0' },
  verkefni: { heiti: 'Verkefni', litur: '#1c3050' },
  taskur: { heiti: 'Taskar viðskiptavina', litur: '#e0a21b' },
  innri: { heiti: 'Innri verk', litur: '#2e9e5b' }
};

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Dagatal');
  const innihald = document.getElementById('innihald');

  let syn = geymt('dagatal-syn') === 'listi' ? 'listi' : 'manudur';
  let virkir = new Set(Object.keys(FLOKKAR));
  const nu = new Date();
  let manudur = new Date(nu.getFullYear(), nu.getMonth(), 1);
  let atridi = [];
  let villa = null;
  let dagatalTengt = true;

  const svid = el('div', { class: 'dg-svid' });
  const haus = el('div', { class: 'page-head dg-haus', style: 'padding-top:0' });
  fylla(innihald, [haus, svid]);

  /* Allt sótt einu sinni og breytt í sama form: { flokkur, titill, byrjar, endar, allan, ... } */
  async function hlada() {
    fylla(svid, [el('p', { class: 'tomt', texti: 'Sæki dagatalið' })]);
    const [fundir, verkefni, taskar, innri] = await Promise.all([
      g.dagatal ? g.dagatal().catch((e) => { villa = e; return []; }) : [],
      g.verkefni().catch(() => []), g.taskar({}).catch(() => []), g.innriTaskar().catch(() => [])
    ]);
    dagatalTengt = fundir !== null;
    const dagur = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); };
    atridi = [
      ...(fundir || []).map((f) => ({ flokkur: 'fundur', titill: f.titill || '(enginn titill)', byrjar: new Date(f.byrjar), endar: new Date(f.endar),
        allan: f.allan_daginn, stadur: f.stadur, fundarhlekkur: oruggSlod(f.fundarhlekkur), tengill: oruggSlod(f.tengill), gestir: f.gestir, lysing: f.lysing })),
      ...(verkefni || []).filter((v) => v.skiladagur && !['lokid', 'hafnad', 'tillaga'].includes(v.stada)).map((v) => ({
        flokkur: 'verkefni', titill: v.titill, byrjar: dagur(v.skiladagur), allan: true, undir: v.fyrirtaeki && v.fyrirtaeki.nafn, slod: 'stjornbord.html' })),
      ...(taskar || []).filter((t) => t.skiladagur && t.stada !== 'lokid').map((t) => ({
        flokkur: 'taskur', titill: t.titill, byrjar: dagur(t.skiladagur), allan: true, undir: t.fyrirtaeki && t.fyrirtaeki.nafn, slod: 'stjornbord.html#taskar' })),
      ...(innri || []).filter((t) => t.skiladagur && t.stada !== 'lokid').map((t) => ({
        flokkur: 'innri', titill: t.titill, byrjar: dagur(t.skiladagur), allan: true, undir: t.abyrgd_notandi && t.abyrgd_notandi.nafn, slod: 'okkar.html' }))
    ].sort((a, b) => a.byrjar - b.byrjar);
    teikna();
  }

  function teiknaHausinn() {
    const titill = syn === 'manudur' ? capitalize(MAN[manudur.getMonth()]) + ' ' + manudur.getFullYear() : 'Næstu 30 dagar';
    fylla(haus, [
      el('div', { class: 'dg-haus__efst' }, [
        el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Dagatal' }),
        el('div', { class: 'dg-syn', role: 'group', 'aria-label': 'Sýn' }, [['manudur', 'Mánuður'], ['listi', 'Listi']].map(([k, h]) =>
          el('button', { type: 'button', class: 'filter', 'aria-pressed': String(syn === k), texti: h, onclick: () => { syn = k; geyma('dagatal-syn', k); teikna(); } })))
      ]),
      el('div', { class: 'dg-tol' }, [
        syn === 'manudur' ? el('div', { class: 'dg-fletta' }, [
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', 'aria-label': 'Fyrri mánuður', texti: '‹', onclick: () => { manudur = new Date(manudur.getFullYear(), manudur.getMonth() - 1, 1); teikna(); } }),
          el('strong', { class: 'dg-titill', texti: titill }),
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', 'aria-label': 'Næsti mánuður', texti: '›', onclick: () => { manudur = new Date(manudur.getFullYear(), manudur.getMonth() + 1, 1); teikna(); } }),
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Í dag', onclick: () => { manudur = new Date(nu.getFullYear(), nu.getMonth(), 1); teikna(); } })
        ]) : el('strong', { class: 'dg-titill', texti: titill }),
        el('div', { class: 'dg-flokkar' }, Object.entries(FLOKKAR).map(([k, f]) =>
          el('button', { type: 'button', class: 'dg-flokkur', 'aria-pressed': String(virkir.has(k)), style: '--l:' + f.litur,
            onclick: () => { virkir.has(k) ? virkir.delete(k) : virkir.add(k); teikna(); } }, [el('i', { 'aria-hidden': 'true' }), document.createTextNode(f.heiti)])))
      ]),
      !dagatalTengt ? el('p', { class: 'dg-athugid', texti: 'Google Calendar er ekki tengt ennþá. Skiladagarnir úr kerfinu sjást samt.' }) : null
    ]);
  }

  function teikna() {
    teiknaHausinn();
    const synileg = atridi.filter((a) => virkir.has(a.flokkur));
    if (syn === 'listi') teiknaLista(synileg); else teiknaManud(synileg);
  }

  const lina = (a, stutt) => el('button', { type: 'button', class: 'dg-atr dg-atr--' + a.flokkur + (stutt ? ' er-stutt' : ''), style: '--l:' + FLOKKAR[a.flokkur].litur,
    title: (a.allan ? '' : kl(a.byrjar) + ' ') + a.titill, onclick: (e) => { e.stopPropagation(); opna(a); } }, [
    a.allan ? null : el('span', { class: 'dg-atr__kl', texti: kl(a.byrjar) }),
    el('span', { class: 'dg-atr__titill', texti: a.titill })
  ]);

  function teiknaManud(listi) {
    const fyrsti = new Date(manudur);
    const upphaf = new Date(fyrsti); upphaf.setDate(1 - ((fyrsti.getDay() + 6) % 7));
    const dagar = [];
    for (let i = 0; i < 42; i++) { const d = new Date(upphaf); d.setDate(upphaf.getDate() + i); dagar.push(d); }
    const vikur = dagar[35].getMonth() !== manudur.getMonth() ? 5 : 6;
    const eftirDegi = new Map();
    for (const a of listi) { const k = ymd(a.byrjar); if (!eftirDegi.has(k)) eftirDegi.set(k, []); eftirDegi.get(k).push(a); }
    fylla(svid, [el('div', { class: 'dg-manudur card' }, [
      el('div', { class: 'dg-vikudagar' }, DAGAR.map((d) => el('span', { texti: d }))),
      el('div', { class: 'dg-grind', style: '--vikur:' + vikur }, dagar.slice(0, vikur * 7).map((d) => {
        const hans = (eftirDegi.get(ymd(d)) || []).sort((a, b) => (a.allan === b.allan ? a.byrjar - b.byrjar : a.allan ? -1 : 1));
        const iDag = ymd(d) === ymd(nu);
        return el('div', { class: 'dg-dagur' + (d.getMonth() !== manudur.getMonth() ? ' er-utan' : '') + (iDag ? ' er-i-dag' : '') + ((d.getDay() + 6) % 7 > 4 ? ' er-helgi' : '') }, [
          el('span', { class: 'dg-dagur__nr', texti: String(d.getDate()) }),
          ...hans.slice(0, 3).map((a) => lina(a, true)),
          hans.length > 3 ? el('button', { type: 'button', class: 'dg-fleiri', texti: '+' + (hans.length - 3) + ' í viðbót',
            onclick: () => opnaDag(d, hans) }) : null
        ]);
      }))
    ])]);
  }

  function teiknaLista(listi) {
    const fra = new Date(nu); fra.setHours(0, 0, 0, 0);
    const til = new Date(fra); til.setDate(til.getDate() + 30);
    const naest = listi.filter((a) => a.byrjar >= fra && a.byrjar < til);
    const seint = listi.filter((a) => a.flokkur !== 'fundur' && a.byrjar < fra);
    const hopar = new Map();
    for (const a of naest) { const k = ymd(a.byrjar); if (!hopar.has(k)) hopar.set(k, []); hopar.get(k).push(a); }
    fylla(svid, [
      seint.length ? el('section', { class: 'card dg-listi dg-listi--seint' }, [
        el('h2', { texti: 'Komið fram yfir skiladag' }),
        el('ul', {}, seint.map((a) => el('li', {}, [lina(a), el('span', { class: 'dg-listi__undir', texti: dagsTexti(a.byrjar) + (a.undir ? ' · ' + a.undir : '') })])))
      ]) : null,
      hopar.size ? el('section', { class: 'card dg-listi' }, [...hopar].map(([k, l]) => {
        const d = l[0].byrjar;
        return el('div', { class: 'dg-listi__dagur' + (k === ymd(nu) ? ' er-i-dag' : '') }, [
          el('h3', {}, [el('strong', { texti: k === ymd(nu) ? 'Í dag' : capitalize(DAGAR_LANGT[d.getDay()]) }), document.createTextNode(' ' + d.getDate() + '. ' + MAN[d.getMonth()])]),
          el('ul', {}, l.map((a) => el('li', {}, [lina(a), a.undir || a.stadur ? el('span', { class: 'dg-listi__undir', texti: a.undir || a.stadur }) : null])))
        ]);
      })) : el('div', { class: 'card pblokk' }, [el('p', { class: 'tomt', texti: 'Ekkert á dagskrá næstu 30 daga.' })])
    ]);
  }

  const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const dagsTexti = (d) => d.getDate() + '. ' + MAN[d.getMonth()];

  function opnaDag(d, listi) {
    spjald(capitalize(DAGAR_LANGT[d.getDay()]) + ' ' + dagsTexti(d), [el('ul', { class: 'dg-dagspjald' }, listi.map((a) => el('li', {}, [lina(a)])))]);
  }

  function opna(a) {
    const f = FLOKKAR[a.flokkur];
    const timi = a.allan ? dagsTexti(a.byrjar) + (a.endar && (a.endar - a.byrjar) > 864e5 ? ' til ' + dagsTexti(new Date(a.endar.getTime() - 1)) : '') + ', allan daginn'
      : dagsTexti(a.byrjar) + ', kl. ' + kl(a.byrjar) + (a.endar ? ' til ' + kl(a.endar) : '');
    spjald(a.titill, [
      el('p', { class: 'dg-spjald__flokkur', style: '--l:' + f.litur }, [el('i', { 'aria-hidden': 'true' }), document.createTextNode({ fundur: 'Fundur', verkefni: 'Skiladagur verkefnis', taskur: 'Skiladagur tasks', innri: 'Innra verk' }[a.flokkur])]),
      el('dl', { class: 'dg-spjald__upp' }, [
        el('div', {}, [el('dt', { texti: a.flokkur === 'fundur' ? 'Hvenær' : 'Skiladagur' }), el('dd', { texti: timi })]),
        a.undir ? el('div', {}, [el('dt', { texti: a.flokkur === 'innri' ? 'Á ábyrgð' : 'Fyrirtæki' }), el('dd', { texti: a.undir })]) : null,
        a.stadur ? el('div', {}, [el('dt', { texti: 'Staður' }), el('dd', { texti: a.stadur })]) : null,
        a.gestir ? el('div', {}, [el('dt', { texti: 'Gestir' }), el('dd', { texti: String(a.gestir) })]) : null,
        a.lysing ? el('div', {}, [el('dt', { texti: 'Lýsing' }), el('dd', { texti: a.lysing })]) : null
      ]),
      el('div', { class: 'spjald__fot' }, [
        a.fundarhlekkur ? el('a', { class: 'btn', href: a.fundarhlekkur, target: '_blank', rel: 'noopener noreferrer', texti: 'Opna fundinn' }) : null,
        a.tengill ? el('a', { class: 'btn btn--ghost', href: a.tengill, target: '_blank', rel: 'noopener noreferrer', texti: 'Opna í Google Calendar' }) : null,
        a.slod ? el('a', { class: 'btn', href: a.slod, texti: 'Opna' }) : null
      ])
    ]);
  }

  function spjald(titill, born) {
    const kort = el('div', { class: 'pdialog__kort' });
    const d = el('dialog', { class: 'pdialog' }, [kort]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    fylla(kort, [el('div', { class: 'pdialog__haus' }, [el('h2', { texti: titill }),
      el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })])].concat(born));
    document.body.append(d);
    d.showModal();
  }

  await hlada();
}
