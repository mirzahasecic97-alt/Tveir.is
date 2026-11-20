/* ==========================================================================
   Dagatal: fundirnir úr Google Calendar og öll verkin í kerfinu á einum
   stað. Mánuður eða listi. Bara stjórnendur.

   Hér er líka hægt að skipuleggja: Nýtt á dag (til dæmis fjögur myndbönd
   fyrir viðskiptavin, eitt í viku), draga verk á milli daga og setja dag á
   verk sem hafa engan.
   ========================================================================== */

import { gogn, el, fylla, vardaHlid, teiknaHaus, geymt, geyma, tilkynna, opnaTask } from './portal.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

const MAN = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
const DAGAR = ['Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau', 'Sun'];
const DAGAR_STUTT = ['sun', 'mán', 'þri', 'mið', 'fim', 'fös', 'lau'];
const DAGAR_LANGT = ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const kl = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
const oruggSlod = (s) => (/^https:\/\/[^\s"'<>]+$/.test(String(s || '')) ? s : null);
/* Dagsetning (YYYY-MM-DD) sem hádegi þess dags, svo tímabelti færi hana aldrei */
const dagur = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); };
const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const dagsTexti = (d) => d.getDate() + '. ' + MAN[d.getMonth()];

/* Flokkarnir og litirnir þeirra */
const FLOKKAR = {
  fundur: { heiti: 'Fundir', litur: '#5b93f0' },
  verkefni: { heiti: 'Verkefni', litur: '#1c3050' },
  taskur: { heiti: 'Taskar viðskiptavina', litur: '#e0a21b' },
  innri: { heiti: 'Innri verk', litur: '#2e9e5b' }
};
const TEGUND = { fundur: 'Fundur', verkefni: 'Skiladagur verkefnis', taskur: 'Skiladagur tasks', undirverk: 'Undirverk', innri: 'Innra verk' };

/* Bil á milli þegar mörg eru búin til í einu */
const BIL = [['0', 'Öll sama dag'], ['1', 'Eitt á dag'], ['2', 'Annan hvern dag'], ['3', 'Á þriggja daga fresti'], ['7', 'Eitt í viku'], ['14', 'Á tveggja vikna fresti']];

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Dagatal');
  const innihald = document.getElementById('innihald');

  let syn = geymt('dagatal-syn') === 'listi' ? 'listi' : 'manudur';
  const virkir = new Set(Object.keys(FLOKKAR));
  let synaLokid = geymt('dagatal-lokid') === '1';
  const nu = new Date();
  let manudur = new Date(nu.getFullYear(), nu.getMonth(), 1);
  let atridi = [];
  let anDags = [];
  let fyrirtaeki = [];
  /* Skiladagur hvers tasks, svo undirverk sem fer lengra færi skiladaginn með sér */
  let skiladagar = new Map();
  let dagatalTengt = true;
  /* Snertiskjár: ekkert dregið, ýtt á dag í staðinn */
  const snerting = window.matchMedia('(hover: none)').matches;

  const svid = el('div', { class: 'dg-svid' });
  const haus = el('div', { class: 'page-head dg-haus', style: 'padding-top:0' });
  const anDagsSvid = el('div', { class: 'dg-andags-svid' });
  fylla(innihald, [haus, svid, anDagsSvid]);

  /* Allt sótt og breytt í sama form:
     { flokkur, teg, id, titill, byrjar, endar, allan, lokid, undir, task_id, ... } */
  async function hlada({ hljodlaust } = {}) {
    if (!hljodlaust) fylla(svid, [el('p', { class: 'tomt', texti: 'Sæki dagatalið' })]);
    const [fundir, verkefni, taskar, innri, undirverk, fyr] = await Promise.all([
      g.dagatal ? g.dagatal().catch(() => []) : [],
      g.verkefni().catch(() => []), g.taskar({}).catch(() => []), g.innriTaskar().catch(() => []),
      g.undirverkADagatali ? g.undirverkADagatali().catch(() => []) : [],
      g.fyrirtaeki().catch(() => [])
    ]);
    dagatalTengt = fundir !== null;
    fyrirtaeki = (fyr || []).slice().sort((a, b) => String(a.nafn).localeCompare(String(b.nafn), 'is'));
    const nafn = (x) => (x && x.fyrirtaeki && x.fyrirtaeki.nafn) || null;
    const verkLokid = (v) => ['lokid', 'hafnad'].includes(v.stada);
    skiladagar = new Map((taskar || []).map((t) => [t.id, t.skiladagur || null]));
    /* Taskur með undirverk á dagatalinu sést í gegnum þau, ekki tvisvar */
    const medUndir = new Set((undirverk || []).map((u) => u.task_id));

    atridi = [
      ...(fundir || []).map((f) => ({ flokkur: 'fundur', teg: 'fundur', titill: f.titill || '(enginn titill)', byrjar: new Date(f.byrjar), endar: new Date(f.endar),
        allan: f.allan_daginn, stadur: f.stadur, fundarhlekkur: oruggSlod(f.fundarhlekkur), tengill: oruggSlod(f.tengill), gestir: f.gestir, lysing: f.lysing })),
      ...(verkefni || []).filter((v) => v.skiladagur && v.stada !== 'tillaga').map((v) => ({
        flokkur: 'verkefni', teg: 'verkefni', id: v.id, titill: v.titill, byrjar: dagur(v.skiladagur), allan: true, lokid: verkLokid(v), undir: nafn(v), slod: 'verk.html?id=' + encodeURIComponent(v.id) })),
      ...(taskar || []).filter((t) => t.skiladagur && !medUndir.has(t.id)).map((t) => ({
        flokkur: 'taskur', teg: 'taskur', id: t.id, task_id: t.id, titill: t.titill, byrjar: dagur(t.skiladagur), allan: true, lokid: t.stada === 'lokid', undir: nafn(t) })),
      ...(undirverk || []).map((u) => ({
        flokkur: 'taskur', teg: 'undirverk', id: u.id, task_id: u.task_id, titill: u.titill, byrjar: dagur(u.dags), allan: true, lokid: !!u.lokid || !!(u.taskar && u.taskar.stada === 'lokid'),
        undir: [nafn(u), u.taskar && u.taskar.titill].filter(Boolean).join(' · ') || null })),
      ...(innri || []).filter((t) => t.skiladagur).map((t) => ({
        flokkur: 'innri', teg: 'innri', id: t.id, titill: t.titill, byrjar: dagur(t.skiladagur), allan: true, lokid: t.stada === 'lokid',
        undir: (t.abyrgd_notandi && t.abyrgd_notandi.nafn) || nafn(t), slod: 'okkar.html' }))
    ].sort((a, b) => a.byrjar - b.byrjar);

    /* Opin verk sem hafa engan dag ennþá */
    anDags = [
      ...(taskar || []).filter((t) => !t.skiladagur && t.stada !== 'lokid' && !medUndir.has(t.id)).map((t) => ({ flokkur: 'taskur', teg: 'taskur', id: t.id, task_id: t.id, titill: t.titill, allan: true, undir: nafn(t) })),
      ...(innri || []).filter((t) => !t.skiladagur && t.stada !== 'lokid').map((t) => ({ flokkur: 'innri', teg: 'innri', id: t.id, titill: t.titill, allan: true, undir: nafn(t), slod: 'okkar.html' })),
      ...(verkefni || []).filter((v) => !v.skiladagur && ['samthykkt', 'i_vinnslu', 'bid_svar'].includes(v.stada)).map((v) => ({ flokkur: 'verkefni', teg: 'verkefni', id: v.id, titill: v.titill, allan: true, undir: nafn(v), slod: 'verk.html?id=' + encodeURIComponent(v.id) }))
    ];
    teikna();
  }

  /* ---------- Breyta degi: sama leið fyrir drátt, dagsreitinn og Án dags ---------- */
  async function setjaDag(a, nyr) {
    const gildi = nyr || null;
    if (a.teg === 'taskur') await g.uppfaeraTask(a.id, { skiladagur: gildi });
    else if (a.teg === 'innri') await g.uppfaeraInnriTask(a.id, { skiladagur: gildi });
    else if (a.teg === 'verkefni') await g.uppfaeraVerkefni(a.id, { skiladagur: gildi });
    else if (a.teg === 'undirverk') {
      await g.uppfaeraUndirverk(a.id, { dags: gildi });
      const skil = skiladagar.get(a.task_id);
      if (gildi && (!skil || gildi > String(skil).slice(0, 10))) {
        await g.uppfaeraTask(a.task_id, { skiladagur: gildi });
        skiladagar.set(a.task_id, gildi);
      }
    }
    else throw new Error('Fundir eru færðir í Google Calendar.');
  }
  const opnirGluggar = () => [...document.querySelectorAll('dialog.pdialog[open]')];
  /* Skilar true ef það tókst */
  async function flytja(a, nyr) {
    if (a.byrjar && ymd(a.byrjar) === nyr) return true;
    const opnir = opnirGluggar();
    try { await setjaDag(a, nyr); }
    catch (e) { tilkynna(e.message || 'Ekki tókst að færa.'); return false; }
    tilkynna(a.titill + ': ' + (nyr ? dagsTexti(dagur(nyr)) : 'enginn dagur'));
    await endurhlada(opnir);
    return true;
  }
  /* Eftir breytingu: gluggarnir sem voru opnir þegar breytingin hófst (t.d.
     dagurinn í síma) eru orðnir úreltir. Gluggi sem var opnaður á meðan fær að vera. */
  async function endurhlada(opnir) {
    (opnir || []).forEach((x) => { if (x.open) x.close(); });
    try { await hlada({ hljodlaust: true }); } catch (e) { tilkynna('Endurhlaðaðu síðuna til að sjá breytinguna.'); }
  }
  /* Dagsreitur: vistað þegar farið er úr reitnum eða ýtt á Enter, aldrei í
     miðjum innslætti (annars vistast t.d. árið 0002) */
  const gildurDagur = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && Number(v.slice(0, 4)) >= 2000 && Number(v.slice(0, 4)) <= 2100;
  function vistaVidLok(reitur, vista) {
    let sidast = reitur.value;
    let ibid = false;
    const prufa = async () => {
      const v = reitur.value;
      if (ibid || v === sidast || !gildurDagur(v)) return;
      ibid = true;
      try { if (await vista(v)) sidast = v; } finally { ibid = false; }
    };
    reitur.addEventListener('blur', prufa);
    reitur.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); prufa(); } });
  }

  function teiknaHausinn() {
    const titill = syn === 'manudur' ? capitalize(MAN[manudur.getMonth()]) + ' ' + manudur.getFullYear() : 'Næstu 30 dagar';
    fylla(haus, [
      el('div', { class: 'dg-haus__efst' }, [
        el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Dagatal' }),
        el('div', { class: 'dg-haus__hnappar' }, [
          el('div', { class: 'dg-syn', role: 'group', 'aria-label': 'Sýn' }, [['manudur', 'Mánuður'], ['listi', 'Listi']].map(([k, h]) =>
            el('button', { type: 'button', class: 'filter', 'aria-pressed': String(syn === k), texti: h, onclick: () => { syn = k; geyma('dagatal-syn', k); teikna(); } }))),
          el('button', { type: 'button', class: 'btn btn--sm', texti: '+ Nýtt',
            onclick: () => opnaNytt(syn === 'manudur' && (manudur.getMonth() !== nu.getMonth() || manudur.getFullYear() !== nu.getFullYear()) ? ymd(manudur) : ymd(nu)) })
        ])
      ]),
      el('div', { class: 'dg-tol' }, [
        syn === 'manudur' ? el('div', { class: 'dg-fletta' }, [
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', 'aria-label': 'Fyrri mánuður', texti: '‹', onclick: () => { manudur = new Date(manudur.getFullYear(), manudur.getMonth() - 1, 1); teikna(); } }),
          el('strong', { class: 'dg-titill', texti: titill }),
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', 'aria-label': 'Næsti mánuður', texti: '›', onclick: () => { manudur = new Date(manudur.getFullYear(), manudur.getMonth() + 1, 1); teikna(); } }),
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Í dag', onclick: () => { manudur = new Date(nu.getFullYear(), nu.getMonth(), 1); teikna(); } })
        ]) : el('strong', { class: 'dg-titill', texti: titill }),
        el('div', { class: 'dg-flokkar' }, [
          ...Object.entries(FLOKKAR).map(([k, f]) =>
            el('button', { type: 'button', class: 'dg-flokkur', 'aria-pressed': String(virkir.has(k)), style: '--l:' + f.litur,
              onclick: () => { virkir.has(k) ? virkir.delete(k) : virkir.add(k); teikna(); } }, [el('i', { 'aria-hidden': 'true' }), document.createTextNode(f.heiti)])),
          el('button', { type: 'button', class: 'dg-flokkur', 'aria-pressed': String(synaLokid), style: '--l:#8a97ab',
            onclick: () => { synaLokid = !synaLokid; geyma('dagatal-lokid', synaLokid ? '1' : '0'); teikna(); } }, [el('i', { 'aria-hidden': 'true' }), document.createTextNode('Lokið')])
        ])
      ]),
      !dagatalTengt ? el('p', { class: 'dg-athugid', texti: 'Google Calendar er ekki tengt ennþá. Verkin úr kerfinu sjást samt.' }) : null,
      el('p', { class: 'dg-hjalp', texti: snerting
        ? 'Ýttu á dag til að sjá hann og bæta við. Ýttu á verk til að breyta deginum.'
        : 'Smelltu á + í degi til að bæta við. Dragðu verk á annan dag til að færa það.' })
    ]);
  }

  function teikna() {
    teiknaHausinn();
    const synileg = atridi.filter((a) => virkir.has(a.flokkur) && (synaLokid || !a.lokid));
    if (syn === 'listi') teiknaLista(synileg); else teiknaManud(synileg);
    teiknaAnDags();
  }

  const lina = (a, stutt) => {
    const hnappur = el('button', { type: 'button', class: 'dg-atr dg-atr--' + a.flokkur + (stutt ? ' er-stutt' : '') + (a.lokid ? ' er-lokid' : '') + (a.teg === 'undirverk' ? ' er-undir' : ''),
      style: '--l:' + FLOKKAR[a.flokkur].litur, title: (a.allan || !a.byrjar ? '' : kl(a.byrjar) + ' ') + a.titill + (a.undir ? ' · ' + a.undir : ''),
      onclick: (e) => { e.stopPropagation(); opna(a); } }, [
      a.allan || !a.byrjar ? null : el('span', { class: 'dg-atr__kl', texti: kl(a.byrjar) }),
      el('span', { class: 'dg-atr__titill', texti: a.titill })
    ]);
    /* Allt nema fundir má draga á annan dag */
    if (!snerting && a.teg !== 'fundur') {
      hnappur.draggable = true;
      hnappur.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', a.teg + ':' + a.id);
        hnappur.classList.add('er-dreginn');
      });
      hnappur.addEventListener('dragend', () => hnappur.classList.remove('er-dreginn'));
    }
    return hnappur;
  };

  /* Dagur sem tekur við drætti */
  function takaVid(reitur, dagsetning) {
    if (snerting) return;
    reitur.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; reitur.classList.add('er-yfir'); });
    reitur.addEventListener('dragleave', (e) => { if (!reitur.contains(e.relatedTarget)) reitur.classList.remove('er-yfir'); });
    reitur.addEventListener('drop', (e) => {
      e.preventDefault(); reitur.classList.remove('er-yfir');
      const [teg, id] = String(e.dataTransfer.getData('text/plain')).split(':');
      const a = atridi.find((x) => x.teg === teg && x.id === id) || anDags.find((x) => x.teg === teg && x.id === id);
      if (a) flytja(a, dagsetning);
    });
  }

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
        const reitur = el('div', { class: 'dg-dagur' + (d.getMonth() !== manudur.getMonth() ? ' er-utan' : '') + (iDag ? ' er-i-dag' : '') + ((d.getDay() + 6) % 7 > 4 ? ' er-helgi' : '') }, [
          el('div', { class: 'dg-dagur__efst' }, [
            el('span', { class: 'dg-dagur__nr', texti: String(d.getDate()) }),
            snerting ? null : el('button', { type: 'button', class: 'dg-baeta', 'aria-label': 'Bæta við ' + dagsTexti(d), title: 'Bæta við ' + dagsTexti(d), texti: '+',
              onclick: (e) => { e.stopPropagation(); opnaNytt(ymd(d)); } })
          ]),
          ...hans.slice(0, 3).map((a) => lina(a, true)),
          hans.length > 3 ? el('button', { type: 'button', class: 'dg-fleiri', texti: '+' + (hans.length - 3) + ' í viðbót',
            onclick: (e) => { e.stopPropagation(); opnaDag(d, hans); } }) : null
        ]);
        /* Í síma opnast dagurinn allur við snertingu */
        if (snerting) reitur.addEventListener('click', () => opnaDag(d, hans));
        takaVid(reitur, ymd(d));
        return reitur;
      }))
    ])]);
  }

  function teiknaLista(listi) {
    const fra = new Date(nu); fra.setHours(0, 0, 0, 0);
    const til = new Date(fra); til.setDate(til.getDate() + 30);
    const naest = listi.filter((a) => a.byrjar >= fra && a.byrjar < til);
    const seint = listi.filter((a) => a.flokkur !== 'fundur' && !a.lokid && a.byrjar < fra);
    const hopar = new Map();
    for (const a of naest) { const k = ymd(a.byrjar); if (!hopar.has(k)) hopar.set(k, []); hopar.get(k).push(a); }
    fylla(svid, [
      seint.length ? el('section', { class: 'card dg-listi dg-listi--seint' }, [
        el('h2', { texti: 'Komið fram yfir skiladag' }),
        el('ul', {}, seint.map((a) => el('li', {}, [lina(a), el('span', { class: 'dg-listi__undir', texti: dagsTexti(a.byrjar) + (a.undir ? ' · ' + a.undir : '') })])))
      ]) : null,
      hopar.size ? el('section', { class: 'card dg-listi' }, [...hopar].map(([k, l]) => {
        const d = l[0].byrjar;
        const hluti = el('div', { class: 'dg-listi__dagur' + (k === ymd(nu) ? ' er-i-dag' : '') }, [
          el('h3', {}, [el('strong', { texti: k === ymd(nu) ? 'Í dag' : capitalize(DAGAR_LANGT[d.getDay()]) }), document.createTextNode(' ' + d.getDate() + '. ' + MAN[d.getMonth()])]),
          el('ul', {}, l.map((a) => el('li', {}, [lina(a), a.undir || a.stadur ? el('span', { class: 'dg-listi__undir', texti: a.undir || a.stadur }) : null])))
        ]);
        takaVid(hluti, k);
        return hluti;
      })) : el('div', { class: 'card pblokk' }, [el('p', { class: 'tomt', texti: 'Ekkert á dagskrá næstu 30 daga.' }),
        el('button', { type: 'button', class: 'btn btn--sm', style: 'margin-top:12px', texti: '+ Nýtt', onclick: () => opnaNytt(ymd(nu)) })])
    ]);
  }

  /* Verk án dags: setja dag með reitnum, eða draga á dagatalið */
  function teiknaAnDags() {
    const listi = anDags.filter((a) => virkir.has(a.flokkur));
    if (!listi.length) { fylla(anDagsSvid, []); return; }
    const det = el('details', { class: 'card dg-andags' }, [
      el('summary', {}, [el('strong', { texti: 'Án dagsetningar' }), el('span', { class: 'dg-andags__tala', texti: String(listi.length) }),
        el('span', { class: 'dg-andags__skyring', texti: snerting ? 'Veldu dag til að setja þau á dagatalið' : 'Veldu dag eða dragðu þau á dagatalið' })]),
      el('ul', {}, listi.map((a) => {
        const reitur = el('input', { type: 'date', 'aria-label': 'Dagur fyrir ' + a.titill });
        vistaVidLok(reitur, (v) => flytja(a, v));
        return el('li', {}, [lina(a), a.undir ? el('span', { class: 'dg-listi__undir', texti: a.undir }) : null, reitur]);
      }))
    ]);
    if (geymt('dagatal-andags') === '1') det.open = true;
    det.addEventListener('toggle', () => geyma('dagatal-andags', det.open ? '1' : '0'));
    fylla(anDagsSvid, [det]);
  }

  function opnaDag(d, listi) {
    const { d: dlg } = spjald(capitalize(DAGAR_LANGT[d.getDay()]) + ' ' + dagsTexti(d), [
      listi.length ? el('ul', { class: 'dg-dagspjald' }, listi.map((a) => el('li', {}, [lina(a), a.undir ? el('span', { class: 'dg-listi__undir', texti: a.undir }) : null])))
        : el('p', { class: 'tomt', style: 'margin-top:12px', texti: 'Ekkert á þessum degi.' }),
      el('div', { class: 'spjald__fot' }, [
        el('button', { type: 'button', class: 'btn', texti: '+ Bæta við þennan dag', onclick: () => { dlg.close(); opnaNytt(ymd(d)); } })
      ])
    ]);
  }

  function opna(a) {
    const f = FLOKKAR[a.flokkur];
    const timi = a.teg !== 'fundur' ? '' : a.allan ? dagsTexti(a.byrjar) + (a.endar && (a.endar - a.byrjar) > 864e5 ? ' til ' + dagsTexti(new Date(a.endar.getTime() - 1)) : '') + ', allan daginn'
      : dagsTexti(a.byrjar) + ', kl. ' + kl(a.byrjar) + (a.endar ? ' til ' + kl(a.endar) : '');
    const fundur = a.teg === 'fundur';
    const villa = el('p', { class: 'form-status form-status--err', role: 'alert', hidden: true });
    const dagReitur = fundur ? null : el('input', { type: 'date', value: a.byrjar ? ymd(a.byrjar) : '' });
    let dlg = null;
    const vistaDag = async (nyr) => {
      villa.hidden = true;
      const opnir = opnirGluggar();
      try { await setjaDag(a, nyr); }
      catch (e) { villa.textContent = e.message || 'Ekki tókst að vista.'; villa.hidden = false; return; }
      tilkynna(a.titill + ': ' + (nyr ? dagsTexti(dagur(nyr)) : 'tekið af dagatalinu'));
      await endurhlada(opnir);
    };
    ({ d: dlg } = spjald(a.titill, [
      el('p', { class: 'dg-spjald__flokkur', style: '--l:' + f.litur }, [el('i', { 'aria-hidden': 'true' }), document.createTextNode(TEGUND[a.teg] + (a.lokid ? ', lokið' : ''))]),
      el('dl', { class: 'dg-spjald__upp' }, [
        fundur ? el('div', {}, [el('dt', { texti: 'Hvenær' }), el('dd', { texti: timi })]) : null,
        a.undir ? el('div', {}, [el('dt', { texti: a.teg === 'innri' ? 'Á ábyrgð' : a.teg === 'undirverk' ? 'Fyrir' : 'Fyrirtæki' }), el('dd', { texti: a.undir })]) : null,
        a.stadur ? el('div', {}, [el('dt', { texti: 'Staður' }), el('dd', { texti: a.stadur })]) : null,
        a.gestir ? el('div', {}, [el('dt', { texti: 'Gestir' }), el('dd', { texti: String(a.gestir) })]) : null,
        a.lysing ? el('div', {}, [el('dt', { texti: 'Lýsing' }), el('dd', { texti: a.lysing })]) : null
      ]),
      dagReitur ? el('div', { class: 'dg-spjald__dagur' }, [
        el('label', { class: 'field' }, [el('span', { texti: a.teg === 'undirverk' ? 'Dagur' : 'Skiladagur' }), dagReitur]),
        el('div', { class: 'dg-spjald__dagur-hnappar' }, [
          el('button', { type: 'button', class: 'btn btn--sm', texti: 'Vista dag', onclick: () => {
            if (gildurDagur(dagReitur.value)) vistaDag(dagReitur.value);
            else { villa.textContent = 'Veldu dag.'; villa.hidden = false; dagReitur.focus(); }
          } }),
          a.byrjar ? el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Taka af dagatalinu', onclick: () => vistaDag(null) }) : null
        ])
      ]) : null,
      villa,
      el('div', { class: 'spjald__fot' }, [
        a.fundarhlekkur ? el('a', { class: 'btn', href: a.fundarhlekkur, target: '_blank', rel: 'noopener noreferrer', texti: 'Opna fundinn' }) : null,
        a.tengill ? el('a', { class: 'btn btn--ghost', href: a.tengill, target: '_blank', rel: 'noopener noreferrer', texti: 'Opna í Google Calendar' }) : null,
        a.task_id ? el('button', { type: 'button', class: 'btn btn--ghost', texti: a.teg === 'undirverk' ? 'Opna taskinn' : 'Opna',
          onclick: () => { opnirGluggar().forEach((x) => x.close()); opnaTask(a.task_id, { admin: true, eftir: () => hlada({ hljodlaust: true }).catch(() => {}) }); } }) : null,
        a.slod ? el('a', { class: 'btn btn--ghost', href: a.slod, texti: 'Opna' }) : null
      ])
    ]));
  }

  /* ---------- Nýtt: eitt verk eða mörg í röð (t.d. 4 myndbönd, eitt í viku) ---------- */
  function opnaNytt(dagsetning) {
    const NYR = '__nyr';
    const hver = el('select', {}, [
      el('option', { value: '', texti: 'Veldu' }),
      ...fyrirtaeki.map((f) => el('option', { value: f.id, texti: f.nafn })),
      el('option', { value: NYR, texti: '+ Nýr viðskiptavinur' }),
      el('option', { value: 'innri', texti: 'Innra verk (bara við)' })
    ]);
    const nyttNafn = el('input', { type: 'text', maxlength: '120', placeholder: 'Nafn fyrirtækisins', autocomplete: 'off' });
    const nyttSvid = el('label', { class: 'field', hidden: true }, [el('span', { texti: 'Nafn nýja viðskiptavinarins' }), nyttNafn]);
    const titill = el('input', { type: 'text', maxlength: '200', placeholder: 'T.d. Myndbönd í desember' });
    const fyrsti = el('input', { type: 'date', value: dagsetning });
    const fjoldi = el('input', { type: 'number', min: '1', max: '30', value: '1', inputmode: 'numeric' });
    const heiti = el('input', { type: 'text', maxlength: '120', value: 'Myndband' });
    const bil = el('select', {}, BIL.map(([v, h]) => el('option', { value: v, texti: h })));
    bil.value = '7';
    const morgSvid = el('div', { class: 'dg-nytt__tvo', hidden: true }, [
      el('label', { class: 'field' }, [el('span', { texti: 'Heiti hvers og eins' }), heiti]),
      el('label', { class: 'field' }, [el('span', { texti: 'Bil á milli' }), bil])
    ]);
    const forsyn = el('ol', { class: 'dg-nytt__forsyn', hidden: true });
    const skyring = el('p', { class: 'skyring' });
    const villa = el('p', { class: 'form-status form-status--err', role: 'alert', hidden: true });
    const senda = el('button', { type: 'submit', class: 'btn', texti: 'Setja á dagatalið' });

    const tala = () => Math.max(1, Math.min(30, Math.round(Number(fjoldi.value) || 1)));
    const dagarnir = () => {
      const n = tala(), skref = Number(bil.value) || 0;
      if (!fyrsti.value) return [];
      return Array.from({ length: n }, (_, i) => { const d = dagur(fyrsti.value); d.setDate(d.getDate() + i * skref); return ymd(d); });
    };
    const heitiNr = (i) => (heiti.value.trim() || 'Verk') + ' ' + (i + 1);

    function uppfaera() {
      const n = tala();
      nyttSvid.hidden = hver.value !== NYR;
      morgSvid.hidden = n < 2;
      const innri = hver.value === 'innri';
      if (n > 1) {
        fylla(forsyn, dagarnir().map((s, i) => { const d = dagur(s); return el('li', {}, [el('strong', { texti: heitiNr(i) }), document.createTextNode(' ' + DAGAR_STUTT[d.getDay()] + ' ' + dagsTexti(d))]); }));
        forsyn.hidden = false;
        skyring.textContent = innri
          ? n + ' innri verk, eitt á hverjum degi. Viðskiptavinir sjá þau ekki.'
          : 'Einn taskur með ' + n + ' undirverkum, hvert á sínum degi. Viðskiptavinurinn sér taskinn og fær póst þegar þú hakar í hvert og setur skrána eða hlekkinn með.';
        senda.textContent = 'Setja ' + n + ' á dagatalið';
      } else {
        fylla(forsyn, []); forsyn.hidden = true;
        skyring.textContent = innri ? 'Innra verk. Viðskiptavinir sjá það ekki.' : hver.value ? 'Taskur sem viðskiptavinurinn sér, með skiladag.' : '';
        senda.textContent = 'Setja á dagatalið';
      }
    }
    [hver, fjoldi, heiti, bil, fyrsti].forEach((x) => { x.addEventListener('input', uppfaera); x.addEventListener('change', uppfaera); });

    let ibid = false;
    let dlg = null;
    /* Það sem er þegar vistað, svo Prófa aftur búi ekki til tvennt */
    const buid = { fyrId: null, taskId: null, innri: 0, undir: false };
    const form = el('form', { class: 'form-grid dg-nytt', onsubmit: async (e) => {
      e.preventDefault();
      if (ibid) return;
      villa.hidden = true;
      const t = titill.value.trim();
      const synaVillu = (texti, reitur) => { villa.textContent = texti; villa.hidden = false; if (reitur) reitur.focus(); };
      if (!hver.value) return synaVillu('Veldu fyrir hvern þetta er.', hver);
      if (hver.value === NYR && !nyttNafn.value.trim()) return synaVillu('Skrifaðu nafn nýja viðskiptavinarins.', nyttNafn);
      if (!t) return synaVillu('Skrifaðu hvað á að gera.', titill);
      if (!gildurDagur(fyrsti.value)) return synaVillu('Veldu dag.', fyrsti);
      ibid = true; senda.disabled = true; senda.textContent = 'Set á dagatalið';
      try {
        const n = tala(), dagar = dagarnir();
        let fyrId = hver.value;
        if (fyrId === NYR) {
          if (!buid.fyrId) {
            const f = await g.nyttFyrirtaeki({ nafn: nyttNafn.value.trim().slice(0, 120) });
            buid.fyrId = f.id;
            /* Nýi viðskiptavinurinn verður valinn, svo ekkert tvítekst við Prófa aftur */
            hver.insertBefore(el('option', { value: f.id, texti: f.nafn }), hver.querySelector('option[value="' + NYR + '"]'));
            hver.value = f.id;
          }
          fyrId = buid.fyrId;
        }
        if (fyrId === 'innri') {
          for (let i = buid.innri; i < n; i++) {
            await g.nyrInnriTask({ titill: (n > 1 ? heitiNr(i) + ': ' + t : t).slice(0, 200), skiladagur: dagar[i], stada: 'nytt' });
            buid.innri = i + 1;
          }
        } else {
          if (!buid.taskId) {
            const task = await g.nyrTask({ titill: t.slice(0, 200), fyrirtaeki_id: fyrId, stada: 'nytt', skiladagur: dagar[dagar.length - 1] });
            buid.taskId = task.id;
          }
          if (n > 1 && !buid.undir) {
            await g.nyUndirverk(buid.taskId, dagar.map((s, i) => ({ titill: heitiNr(i).slice(0, 200), dags: s })));
            buid.undir = true;
          }
        }
        tilkynna(n > 1 ? n + ' komin á dagatalið' : t + ' er komið á dagatalið');
        const d1 = dagur(dagar[0]);
        if (syn === 'manudur') manudur = new Date(d1.getFullYear(), d1.getMonth(), 1);
      } catch (er) {
        /* Það sem tókst er geymt. Fjöldi og dagar mega ekki breytast á milli. */
        synaVillu((er.message || 'Ekki tókst að vista.') + (buid.taskId || buid.innri || buid.fyrId ? ' Það sem tókst er vistað. Ýttu aftur til að klára.' : ''));
        if (buid.taskId || buid.innri) [fjoldi, fyrsti, bil, heiti, titill, hver].forEach((x) => { x.disabled = true; });
        ibid = false; senda.disabled = false; uppfaera();
        return;
      }
      await endurhlada([dlg]);
    } }, [
      el('label', { class: 'field' }, [el('span', { texti: 'Fyrir hvern' }), hver]),
      nyttSvid,
      el('label', { class: 'field' }, [el('span', { texti: 'Hvað á að gera' }), titill]),
      el('div', { class: 'dg-nytt__tvo' }, [
        el('label', { class: 'field' }, [el('span', { texti: 'Fyrsti dagur' }), fyrsti]),
        el('label', { class: 'field' }, [el('span', { texti: 'Hversu mörg' }), fjoldi])
      ]),
      morgSvid,
      forsyn,
      skyring,
      villa,
      el('div', { class: 'spjald__fot' }, [senda, el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Hætta við', onclick: () => dlg.close() })])
    ]);
    ({ d: dlg } = spjald('Nýtt á dagatalið', [form]));
    uppfaera();
    setTimeout(() => hver.focus(), 50);
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
    return { d, kort };
  }

  await hlada();
}
