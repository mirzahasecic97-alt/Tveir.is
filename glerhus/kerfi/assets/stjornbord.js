/* ==========================================================================
   Glerhúsið: stjórnborð okkar
   ========================================================================== */

import {
  gogn, el, tom, fylla, dags, erSeint, pilla, taskLina, kronur, lesaTolu,
  vardaHlid, teiknaHaus, STODUR_VERK,
  geymt, geyma, ervalid, bokhaldskerfi, tengingaSpjald, tilkynna
} from './portal.js';
import { NU_MAN, manHeiti, NAESTI, naestiMan, MAN, pPlus, pAn, pMed, lesaMedVsk, reiknivel } from './bokreikningur.js';

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Stjórnborð');

  const innihald = document.getElementById('innihald');
  let flipi = 'opid';
  let fyrirtaekiSia = '';

  /* Útlitið á stjórnborðinu: hver notandi ræður röð spjaldanna, breidd,
     hvaða spjöld sjást og hvaða kaflar. Geymt í vafranum. */
  const LYKILL_UTLIT = 'glerhusid-stjornbord-' + (ek.id || 'gestur');
  const SJALFGEFID_UTLIT = { rod: ['greidist', 'opnir', 'fast', 'orukkad'], breidd: {}, kaflar: { tilkynningar: true, listar: true } };
  let utlit = (() => {
    try {
      const u = JSON.parse(localStorage.getItem(LYKILL_UTLIT));
      if (u && Array.isArray(u.rod)) return { rod: u.rod, breidd: u.breidd || {}, kaflar: Object.assign({}, SJALFGEFID_UTLIT.kaflar, u.kaflar) };
    } catch (villa) { /* ekkert vistað */ }
    return JSON.parse(JSON.stringify(SJALFGEFID_UTLIT));
  })();
  function vistaUtlit() {
    try { localStorage.setItem(LYKILL_UTLIT, JSON.stringify(utlit)); } catch (villa) { /* lokaður gluggi */ }
  }
  let breyta = false;
  let dregid = null;

  /* Gögnin eru sótt einu sinni. Flipar og síur teikna bara upp á nýtt
     úr því sem er komið, það er það sem gerði flipana hæga. */
  let hlad = null;
  async function teikna(adeinsBirta) {
    if (!adeinsBirta || !hlad) {
      hlad = await Promise.all([
      g.verkefni(), g.taskar({}), g.fyrirtaeki(), g.notendur(), g.innri(), g.snid(),
      g.innriTaskar(), g.fyrirspurnir().catch(() => []),
      g.bokhald('samningar').catch(() => []), g.bokhald('aukaverkefni').catch(() => [])
    ]);
      geyma('stjornbord', hlad);
    }
    const [verkefni, taskar, fyrirtaeki, notendur, innriOll, snidin, okkar, fyrirspurnir,
           samningar, aukaverkefni] = hlad;

    /* Bókhaldið: sömu tölur og efst á bókhaldssíðunni, með sama VSK rofa */
    const { virkurI, fastI, aukaI } = reiknivel(samningar, aukaverkefni);
    const medVsk = lesaMedVsk();
    const fastNu = fastI(NU_MAN);
    const greidslaNu = pPlus(fastNu, aukaI(NU_MAN));
    const virkir = samningar.filter((s) => virkurI(s, NU_MAN)).length;
    const bokTala = (p) => kronur(Math.round(medVsk ? pMed(p) : pAn(p))) || '0 kr.';
    const bokAnnad = (p) => (!p[0] ? (p[1] ? 'ekkert VSK' : '')
      : kronur(Math.round(medVsk ? pAn(p) : pMed(p))) + (medVsk ? ' án VSK' : ' með VSK'));
    const nyjarFyrirspurnir = fyrirspurnir.filter((f) => f.stada === 'ny');
    const innri = {};
    (innriOll || []).forEach((i) => { innri[i.verkefni_id] = i; });

    const tillogur = verkefni.filter((v) => v.stada === 'tillaga');
    const otengdir = notendur.filter((n) => n.hlutverk !== 'admin' && !n.fyrirtaeki_id);

    const lifandi = verkefni.filter((v) => ['samthykkt', 'i_vinnslu', 'bid_svar'].includes(v.stada));
    const ivinnslu = lifandi
      .filter((v) => !v.innan_samnings)
      .reduce((a, v) => a + (Number(v.verd_okkar) || 0), 0);
    const oinnheimt = verkefni.filter((v) =>
      v.stada === 'lokid' && !v.innan_samnings
      && (innri[v.id] || {}).reikningur === 'ekki_rukkad' && v.verd_okkar);
    const oinnheimtAlls = oinnheimt.reduce((a, v) => a + Number(v.verd_okkar), 0);

    /* Af okkar eigin lista nefnum við bara það sem er ósnert eða komið fram
       úr skiladegi. Annars stæði borðinn þarna alla daga og hætti að segja
       nokkuð. */
    const okkarAMig = okkar.filter((t) => t.abyrgd === ek.id && t.stada !== 'lokid'
                                       && (t.stada === 'nytt' || erSeint(t.skiladagur)));

    const siad = taskar.filter((t) => !fyrirtaekiSia || t.fyrirtaeki_id === fyrirtaekiSia);
    const opin = siad.filter((t) => t.stada !== 'lokid');
    const nyir = siad.filter((t) => t.stada === 'nytt');
    const seinir = siad.filter((t) => t.stada !== 'lokid' && erSeint(t.skiladagur));

    const syndir = flipi === 'allt' ? siad
      : flipi === 'nytt' ? nyir
      : flipi === 'seint' ? seinir
      : flipi === 'lokid' ? siad.filter((t) => t.stada === 'lokid')
      : opin;

    /* Glerspjöld eins og í fyrirmyndinni: miði, stór tala, gullör, og eitt af
       súluriti, framvindustiku, stöðupillu eða fólki fyrir neðan */
    function glerkort(k) {
      return el('a', { class: 'gk' + (k.vidvorun ? ' gk--vidvorun' : '') + (k.dokkt ? ' gk--dokkt' : ''), href: k.slod }, [
        el('span', { class: 'gk__or', 'aria-hidden': 'true', texti: '↗' }),
        el('span', { class: 'gk__midi', texti: k.midi }),
        el('strong', { class: 'gk__tala', texti: k.tala }),
        k.mynd || null,
        k.stada ? el('span', { class: 'gk__pilla gk__pilla--' + k.stada[1] }, [
          el('i', { 'aria-hidden': 'true' }), document.createTextNode(k.stada[0])
        ]) : null,
        k.folk || null,
        k.framvinda || null,
        k.undir ? el('span', { class: 'gk__undir', texti: k.undir }) : null
      ]);
    }
    function framvinda(hlutfall, vinstri, haegri, litur) {
      return el('span', { class: 'gk__stika gk__stika--' + litur, style: '--p:' + Math.max(6, Math.min(100, hlutfall)) + '%' }, [
        el('span', { texti: vinstri }), el('span', { texti: haegri })
      ]);
    }
    /* Greiðslur síðustu 12 mánaða og næstu 6, ein súla á mánuð */
    /* 755.000 kr. -> "755 þ." í bólunni yfir súlu mánaðarins */
    const stutt = (v) => (v >= 1e6 ? (Math.round(v / 1e5) / 10).toString().replace('.', ',') + ' m.' : Math.round(v / 1000) + ' þ.');
    function sulur() {
      const manudir = [];
      for (let i = -11; i <= 6; i++) manudir.push(naestiMan(NU_MAN, i));
      const gildi = manudir.map((m) => pAn(pPlus(fastI(m), aukaI(m))));
      const mest = Math.max(1, ...gildi);
      return el('span', { class: 'gk__sulur', 'aria-hidden': 'true' },
        gildi.map((v, i) => el('i', {
          class: i > 11 ? 'framtid' : i === 11 ? 'nu' : '',
          'data-v': i === 11 ? stutt(v) : null,
          style: 'height:' + Math.max(10, Math.round(v / mest * 100)) + '%',
          title: MAN[Number(manudir[i].slice(5, 7)) - 1] + ': ' + (kronur(Math.round(v)) || '0 kr.')
        })));
    }
    /* Fólkið sem er með opna taska, upphafsstafir í glerhringjum */
    function folkid() {
      const ids = [...new Set(opin.map((t) => t.abyrgd || t.abyrgdarmadur || t.notandi_id).filter(Boolean))];
      const folk = (ids.length ? ids.map((id) => notendur.find((n) => n.id === id)).filter(Boolean)
                                : notendur).filter((n) => n && (n.nafn || n.netfang));
      const syna = folk.slice(0, 5);
      const stafir = (n) => (n.nafn || n.netfang).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');
      return el('span', { class: 'gk__folk' }, [
        ...syna.map((n, i) => el('span', { class: 'gk__haus gk__haus--' + (i % 5), title: n.nafn || n.netfang, texti: stafir(n) })),
        folk.length > 5 ? el('span', { class: 'gk__haus gk__haus--fleiri', texti: '+' + (folk.length - 5) }) : null
      ]);
    }

    /* ---------- öll spjöldin sem hægt er að hafa á stjórnborðinu ---------- */
    const fjoldiTaska = (n) => n + (n === 1 ? ' taskur' : ' taskar');
    const SPJOLD = {
      greidist: { heiti: 'Greiðist í næsta mánuði', tekjur: true, smida: () => glerkort({
        midi: 'Greiðist í ' + manHeiti(NAESTI), tala: bokTala(greidslaNu), slod: 'bokhald.html',
        mynd: sulur(), framvinda: framvinda(
          pAn(greidslaNu) ? Math.round(pAn(fastNu) / pAn(greidslaNu) * 100) : 0,
          'Fast ' + (pAn(greidslaNu) ? Math.round(pAn(fastNu) / pAn(greidslaNu) * 100) : 0) + '%',
          bokTala(aukaI(NU_MAN)) + ' í aukaverkum', 'graent')
      }) },
      opnir: { heiti: 'Opnir taskar', smida: () => glerkort({ dokkt: true,
        midi: 'Opnir taskar', tala: fjoldiTaska(opin.length), slod: '#taskar',
        stada: seinir.length ? [seinir.length + ' komnir fram yfir', 'raudt']
               : nyir.length ? [nyir.length + (nyir.length === 1 ? ' nýr' : ' nýir'), 'gult']
               : ['Allt á áætlun', 'graent'],
        folk: folkid()
      }) },
      fast: { heiti: 'Fast á mánuði', tekjur: true, smida: () => glerkort({
        midi: 'Fast á mánuði', tala: bokTala(fastNu), slod: 'bokhald.html',
        framvinda: framvinda(
          Math.min(100, Math.round((virkir / Math.max(virkir, fyrirtaeki.length || 1)) * 100)),
          virkir === 1 ? '1 samningur' : virkir + ' samningar', fyrirtaeki.length + ' fyrirtæki', 'hlytt')
      }) },
      orukkad: { heiti: 'Lokið en órukkað', tekjur: true, smida: () => glerkort({
        midi: 'Lokið en órukkað', tala: kronur(oinnheimtAlls) || '0 kr.', slod: 'bokhald.html',
        vidvorun: !!oinnheimtAlls,
        stada: oinnheimt.length
          ? [oinnheimt.length + (oinnheimt.length === 1 ? ' verk bíður reiknings' : ' verk bíða reiknings'), 'raudt']
          : ['Allt rukkað', 'graent'],
        undir: bokhaldskerfi() ? 'Fer í ' + bokhaldskerfi() + ' með einum smelli' : 'Í vinnslu ' + (kronur(ivinnslu) || '0 kr.')
      }) },
      seint: { heiti: 'Á eftir áætlun', smida: () => glerkort({
        midi: 'Komið fram yfir skiladag', tala: fjoldiTaska(seinir.length), slod: '#taskar',
        vidvorun: !!seinir.length,
        stada: seinir.length ? ['Þarf að klára', 'raudt'] : ['Ekkert á eftir', 'graent'],
        undir: seinir.slice(0, 3).map((t) => t.titill).join(', ') || null
      }) },
      tillogur: { heiti: 'Tillögur', skilyrdi: ervalid('tillogur'), smida: () => glerkort({
        midi: 'Tillögur sem bíða', tala: tillogur.length + (tillogur.length === 1 ? ' tillaga' : ' tillögur'), slod: 'tillogur.html',
        stada: tillogur.length ? ['Bíða samþykkis', 'gult'] : ['Engin bíður', 'graent'],
        undir: tillogur.slice(0, 3).map((v) => v.titill).join(', ') || null
      }) },
      fyrirspurnir: { heiti: 'Fyrirspurnir', smida: () => glerkort({
        midi: 'Nýjar fyrirspurnir', tala: String(nyjarFyrirspurnir.length), slod: 'fyrirspurnir.html',
        stada: nyjarFyrirspurnir.length ? ['Af vefnum', 'gult'] : ['Ekkert nýtt', 'graent'],
        undir: nyjarFyrirspurnir.slice(0, 3).map((f) => f.fyrirtaeki_nafn || f.nafn || f.netfang).join(', ') || null
      }) },
      vinnsla: { heiti: 'Í vinnslu', tekjur: true, smida: () => glerkort({
        midi: 'Verkefni í vinnslu', tala: kronur(ivinnslu) || '0 kr.', slod: 'bokhald.html',
        undir: lifandi.length + (lifandi.length === 1 ? ' verkefni í gangi' : ' verkefni í gangi')
      }) }
    };
    const leyft = (id) => SPJOLD[id] && (!SPJOLD[id].tekjur || ervalid('tekjur')) && SPJOLD[id].skilyrdi !== false;
    const synd = utlit.rod.filter(leyft);
    const falin = Object.keys(SPJOLD).filter((id) => leyft(id) && !synd.includes(id));

    function faera(id, skref) {
      const r = utlit.rod.filter(leyft), i = r.indexOf(id), j = i + skref;
      if (i < 0 || j < 0 || j >= r.length) return;
      [r[i], r[j]] = [r[j], r[i]];
      utlit.rod = r; vistaUtlit(); teikna(true);
    }

    function spjaldaGrind() {
      const reitir = synd.map((id, i) => {
        const kort = SPJOLD[id].smida();
        const breitt = utlit.breidd[id] === 2;
        if (breyta) kort.addEventListener('click', (e) => e.preventDefault());
        return el('div', {
          class: 'gk-reitur' + (breitt ? ' gk-reitur--breitt' : ''), 'data-id': id,
          draggable: breyta ? 'true' : null,
          ondragstart: breyta ? (e) => { dregid = id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); e.currentTarget.classList.add('er-dregid'); } : null,
          ondragend: breyta ? (e) => { e.currentTarget.classList.remove('er-dregid'); } : null,
          ondragover: breyta ? (e) => { e.preventDefault(); e.currentTarget.classList.add('er-yfir'); } : null,
          ondragleave: breyta ? (e) => { e.currentTarget.classList.remove('er-yfir'); } : null,
          ondrop: breyta ? (e) => {
            e.preventDefault();
            const fra = dregid || e.dataTransfer.getData('text/plain');
            if (!fra || fra === id) return;
            const r = utlit.rod.filter((x) => leyft(x) && x !== fra);
            r.splice(r.indexOf(id) + (synd.indexOf(fra) < synd.indexOf(id) ? 1 : 0), 0, fra);
            utlit.rod = r; dregid = null; vistaUtlit(); teikna(true);
          } : null
        }, [
          kort,
          breyta ? el('div', { class: 'gk-tol' }, [
            el('button', { type: 'button', class: 'gk-tol__hn', 'aria-label': 'Færa framar', title: 'Færa framar',
                           disabled: i === 0 ? true : null, texti: '←', onclick: () => faera(id, -1) }),
            el('button', { type: 'button', class: 'gk-tol__hn', 'aria-label': 'Færa aftar', title: 'Færa aftar',
                           disabled: i === synd.length - 1 ? true : null, texti: '→', onclick: () => faera(id, 1) }),
            el('button', { type: 'button', class: 'gk-tol__hn gk-tol__hn--texti', texti: breitt ? 'Mjórra' : 'Breiðara',
                           onclick: () => { if (breitt) delete utlit.breidd[id]; else utlit.breidd[id] = 2; vistaUtlit(); teikna(true); } }),
            el('button', { type: 'button', class: 'gk-tol__hn', 'aria-label': 'Fela spjaldið', title: 'Fela', texti: '×',
                           onclick: () => { utlit.rod = utlit.rod.filter((x) => x !== id); vistaUtlit(); teikna(true); } })
          ]) : null
        ]);
      });
      return el('div', { class: 'gk-grind' + (synd.length === 1 ? ' gk-grind--eitt' : '') + (breyta ? ' er-breytt' : '') }, reitir);
    }

    function breytiBordi() {
      if (!breyta) return null;
      const rofi = (lykill, heiti) => el('label', { class: 'sb-rofi' }, [
        el('input', { type: 'checkbox', checked: utlit.kaflar[lykill] !== false ? true : null,
                      onchange: (e) => { utlit.kaflar[lykill] = e.target.checked; vistaUtlit(); teikna(true); } }),
        document.createTextNode(heiti)
      ]);
      return el('div', { class: 'card sb-breyta' }, [
        el('div', { class: 'sb-breyta__lina' }, [
          el('strong', { texti: 'Bæta við spjaldi' }),
          falin.length
            ? el('div', { class: 'sb-breyta__spjold' }, falin.map((id) => el('button', {
                type: 'button', class: 'sb-baeta', texti: '+ ' + SPJOLD[id].heiti,
                onclick: () => { utlit.rod = utlit.rod.filter(leyft).concat(id); vistaUtlit(); teikna(true); } })))
            : el('span', { class: 'skyring', texti: 'Öll spjöldin eru á borðinu.' })
        ]),
        el('div', { class: 'sb-breyta__lina' }, [
          el('strong', { texti: 'Kaflar' }),
          el('div', { class: 'sb-breyta__spjold' }, [
            rofi('tilkynningar', 'Ábendingar (tillögur, fyrirspurnir)'),
            rofi('listar', 'Taskar og verkefni')
          ])
        ]),
        el('p', { class: 'skyring', texti: 'Dragðu spjöldin til eða notaðu örvarnar. Útlitið vistast strax.' }),
        el('div', { class: 'sb-breyta__lina sb-breyta__lina--hn' }, [
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', texti: 'Upphafsstilla',
                         onclick: () => { utlit = JSON.parse(JSON.stringify(SJALFGEFID_UTLIT)); vistaUtlit(); teikna(true); } }),
          el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Klárt',
                         onclick: () => { breyta = false; teikna(true); } })
        ])
      ]);
    }

    fylla(innihald, [
      el('div', { class: 'page-head sb-haus', style: 'padding-top:0' }, [
        el('div', {}, [
          el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Stjórnborð' }),
          el('p', { class: 'lead',
            texti: nyir.length
              ? nyir.length + (nyir.length === 1 ? ' nýr taskur bíður okkar.' : ' nýir taskar bíða okkar.')
              : 'Ekkert nýtt hefur komið inn.' })
        ]),
        /* Smátölur við hlið fyrirsagnarinnar, eins og í fyrirmyndinni */
        el('div', { class: 'sb-kpi' }, [
          el('span', { class: 'sb-kpi__lidur' }, [el('i', { 'aria-hidden': 'true', texti: '✓' }), el('b', { texti: String(opin.length) }), el('small', { texti: 'opnir taskar' })]),
          el('span', { class: 'sb-kpi__lidur' }, [el('i', { 'aria-hidden': 'true', texti: '+' }), el('b', { texti: String(nyir.length) }), el('small', { texti: nyir.length === 1 ? 'nýr' : 'nýir' })]),
          el('span', { class: 'sb-kpi__lidur' + (seinir.length ? ' er-rautt' : '') }, [el('i', { 'aria-hidden': 'true', texti: '!' }), el('b', { texti: String(seinir.length) }), el('small', { texti: 'á eftir' })]),
          breyta ? null : el('button', { type: 'button', class: 'btn btn--ghost btn--sm sb-breyta-hn', texti: 'Breyta útliti',
                                         onclick: () => { breyta = true; teikna(true); } })
        ])
      ]),

      breytiBordi(),

      /* ---------- glerspjöldin, í þeirri röð og breidd sem notandinn valdi ---------- */
      synd.length ? spjaldaGrind() : null,

      /* ---------- tillögur eiga sína eigin síðu, hér er bara ábending ---------- */
      utlit.kaflar.tilkynningar !== false && tillogur.length && ervalid('tillogur') ? el('a', { class: 'tilkynning', href: 'tillogur.html',
                                  style: 'margin-top:20px' }, [
        el('div', { class: 'tilkynning__inn' }, [
          el('strong', { texti: tillogur.length === 1
            ? 'Ein tillaga bíður samþykkis'
            : tillogur.length + ' tillögur bíða samþykkis' }),
          el('span', { class: 'undir', texti: tillogur.map((v) => v.titill).join(', ') })
        ]),
        el('span', { class: 'tilkynning__or', 'aria-hidden': 'true', texti: '→' })
      ]) : null,

      /* ---------- nýjar fyrirspurnir af vefnum ---------- */
      utlit.kaflar.tilkynningar !== false && nyjarFyrirspurnir.length ? el('a', { class: 'tilkynning', href: 'fyrirspurnir.html',
                                           style: 'margin-top:20px' }, [
        el('div', { class: 'tilkynning__inn' }, [
          el('strong', { texti: nyjarFyrirspurnir.length === 1
            ? 'Ein ný fyrirspurn af vefnum'
            : nyjarFyrirspurnir.length + ' nýjar fyrirspurnir af vefnum' }),
          el('span', { class: 'undir', texti: nyjarFyrirspurnir
            .map((f) => f.fyrirtaeki_nafn || f.nafn || f.netfang).join(', ') })
        ]),
        el('span', { class: 'tilkynning__or', 'aria-hidden': 'true', texti: '→' })
      ]) : null,

      /* ---------- okkar eigin listi á sinni eigin síðu ---------- */
      utlit.kaflar.tilkynningar !== false && okkarAMig.length ? el('a', { class: 'tilkynning', href: 'okkar.html',
                                   style: 'margin-top:14px' }, [
        el('div', { class: 'tilkynning__inn' }, [
          el('strong', { texti: okkarAMig.length === 1
            ? 'Einn taskur liggur á þér'
            : okkarAMig.length + ' taskar liggja á þér' }),
          el('span', { class: 'undir', texti: okkarAMig.map((t) => t.titill).join(', ') })
        ]),
        el('span', { class: 'tilkynning__or', 'aria-hidden': 'true', texti: '→' })
      ]) : null,

      utlit.kaflar.listar !== false && el('div', { class: 'pgrid', style: 'margin-top:clamp(18px,2.2vw,26px)' }, [

        /* ---------- samantekt, efst í síma ---------- */
        el('div', { class: 'psum' }, [seintKort(seinir)]),

        /* ---------- taskar ---------- */
        el('div', { class: 'pmain' }, [
          el('section', { class: 'card pblokk' }, [
            el('div', { class: 'pyfir' }, [
              el('h2', { id: 'taskar', texti: 'Taskar' }),
              el('select', {
                'aria-label': 'Fyrirtæki',
                onchange: (e) => { fyrirtaekiSia = e.target.value; teikna(true); }
              }, [el('option', { value: '', texti: 'Öll fyrirtæki' })].concat(
                fyrirtaeki.map((f) => el('option', {
                  value: f.id, selected: fyrirtaekiSia === f.id, texti: f.nafn }))))
            ]),
            el('div', { class: 'pflipar' }, [
              flipiHnappur('opid',  'Opið',  opin.length),
              flipiHnappur('nytt',  'Nýtt',  nyir.length),
              flipiHnappur('seint', 'Á eftir', seinir.length),
              flipiHnappur('lokid', 'Lokið', siad.length - opin.length),
              flipiHnappur('allt',  'Allt',  siad.length)
            ]),
            syndir.length
              ? el('ul', { class: 'tasklisti' }, syndir.map((t) => taskLina(t, { admin: true, eftir: teikna })))
              : el('p', { class: 'tomt', texti: 'Ekkert hér.' })
          ]),

          /* ---------- verkefni í gangi ---------- */
          el('section', { class: 'card pblokk' }, [
            el('div', { class: 'pyfir' }, [
              el('h2', { texti: 'Verkefni í gangi' }),
              el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Nýtt verkefni',
                             onclick: () => nyttVerkefniForm(fyrirtaeki, snidin) })
            ]),
            (() => {
              const synileg = lifandi.filter((v) => !fyrirtaekiSia || v.fyrirtaeki_id === fyrirtaekiSia);
              return synileg.length
                ? el('div', { class: 'verk-listi' }, synileg.map((v) =>
                    el('a', { class: 'verk', href: 'verk.html?id=' + encodeURIComponent(v.id) }, [
                      el('div', { class: 'verk__linaein' }, [
                        el('span', { class: 'verk__titill', texti: v.titill }),
                        el('span', { class: 'verk__fyr', texti: v.fyrirtaeki ? v.fyrirtaeki.nafn : '' }),
                        pilla(v.stada, 'verk')
                      ]),
                      el('div', { class: 'verk__fot' }, [
                        el('span', { class: 'framvinda' }, [el('span', { style: 'width:' + v.framvinda + '%' })]),
                        el('span', { texti: v.framvinda + '%' }),
                        v.skiladagur ? el('span', {
                          class: erSeint(v.skiladagur) ? 'seint' : '',
                          texti: 'Skil ' + dags(v.skiladagur) }) : null
                      ])
                    ])))
                : el('p', { class: 'tomt', texti: 'Ekkert verkefni í gangi.' });
            })()
          ])
        ]),

        /* ---------- hægri ---------- */
        el('aside', { class: 'pside' }, [
          tengingaSpjald(),

          /* lokið en órukkað */
          oinnheimt.length ? el('div', { class: 'card pblokk' }, [
            el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500',
                       texti: 'Bíður reiknings' }),
            el('p', { class: 'lead', style: 'font-size:14px; margin-top:8px',
                      texti: 'Búið og órukkað. Þetta er það sem gleymist.' }),
            el('ul', { class: 'rukkun' }, oinnheimt.map((v) => el('li', {}, [
              el('span', { class: 'nafn' }, [
                el('a', { href: 'verk.html?id=' + encodeURIComponent(v.id),
                          style: 'color:inherit; text-decoration:none', texti: v.titill })
              ]),
              el('span', { class: 'upph', texti: kronur(v.verd_okkar) }),
              el('button', { type: 'button', texti: bokhaldskerfi() ? 'Senda í ' + bokhaldskerfi() : 'Rukkað', onclick: async () => {
                await g.setjaReikning(v.id, 'rukkad');
                if (bokhaldskerfi()) tilkynna('Reikningur fyrir ' + v.titill + ' (' + kronur(v.verd_okkar) + ') kominn í ' + bokhaldskerfi());
                teikna();
              } })
            ])))
          ]) : null,

          /* fyrirtæki */
          el('div', { class: 'card pblokk' }, [
            el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500',
                       texti: 'Fyrirtæki' }),
            el('div', { class: 'ptafla-skrun', style: 'margin-top:12px' }, [
              el('table', { class: 'ptafla' }, [
                el('tbody', {}, fyrirtaeki.map((f) => {
                  const op = taskar.filter((t) => t.fyrirtaeki_id === f.id && t.stada !== 'lokid').length;
                  return el('tr', {}, [
                    el('td', {}, [
                      el('div', { class: 'nafn', texti: f.nafn }),
                      f.er_askrift
                        ? el('div', { style: 'font-size:12.5px; color:var(--soft)',
                                      texti: 'Áskrift' + (f.askrift_verd ? ' · ' + kronur(f.askrift_verd) : '') })
                        : null
                    ]),
                    el('td', { style: 'color:var(--soft); text-align:right; white-space:nowrap',
                               texti: op + ' opið' })
                  ]);
                }))
              ])
            ]),
            el('button', { type: 'button', class: 'btn btn--block btn--sm btn--ghost',
                           style: 'margin-top:14px', texti: 'Nýtt fyrirtæki',
                           onclick: () => nyttFyrirtaekiForm() })
          ]),

          /* notendur sem þarf að tengja */
          otengdir.length ? el('div', { class: 'card pblokk' }, [
            el('h2', { style: 'font-size:17px; font-family:var(--f-body); font-weight:500',
                       texti: 'Óteng notendur' }),
            el('p', { class: 'lead', style: 'font-size:14px; margin-top:8px',
                      texti: 'Þessi aðgangur sér ekkert fyrr en hann er tengdur fyrirtæki.' }),
            el('div', { style: 'margin-top:14px; display:flex; flex-direction:column; gap:14px' },
              otengdir.map((n) => el('div', {}, [
                el('div', { style: 'font-size:14.5px; font-weight:500', texti: n.nafn }),
                el('div', { style: 'font-size:13px; color:var(--soft)', texti: n.netfang }),
                el('select', {
                  style: 'margin-top:8px; width:100%',
                  'aria-label': 'Tengja ' + n.nafn + ' við fyrirtæki',
                  onchange: async (e) => {
                    if (!e.target.value) return;
                    await g.tengjaNotanda(n.id, e.target.value);
                    teikna();
                  }
                }, [el('option', { value: '', texti: 'Velja fyrirtæki' })].concat(
                  fyrirtaeki.map((f) => el('option', { value: f.id, texti: f.nafn }))))
              ])))
          ]) : null,

          g.prufa ? el('div', { class: 'prufubanner', style: 'margin:0' }, [
            el('strong', { texti: 'Prufustilling. ' }),
            document.createTextNode('Gögnin eru sýnidæmi í þessum vafra. '),
            el('a', { href: '#', style: 'color:inherit; text-decoration:underline',
                      texti: 'Byrja upp á nýtt', onclick: (e) => {
              e.preventDefault(); g.hreinsa(); location.reload();
            } })
          ]) : null
        ])
      ])
    ]);
  }

  /* ------------------------------------------------------------------
     Hlutar
     ------------------------------------------------------------------ */

  function seintKort(seinir) {
    return el('div', { class: 'card card--navy bidur' + (seinir.length ? '' : ' bidur--tomt') }, [
      el('h2', { texti: 'Á eftir áætlun' }),
      el('div', { class: 'bidur__tala', texti: seinir.length ? String(seinir.length) : 'Ekkert' }),
      el('p', { class: 'bidur__texti',
        texti: seinir.length
          ? 'Skiladagurinn er liðinn á þessu.'
          : 'Allt er innan skiladags.' }),
      seinir.length ? el('ul', { class: 'bidur__listi' }, seinir.slice(0, 6).map((t) =>
        el('li', {}, [el('a', { href: '#', onclick: (e) => {
          e.preventDefault();
          import('./portal.js').then((m) => m.opnaTask(t.id, { admin: true, eftir: teikna }));
        } }, [
          document.createTextNode(t.titill),
          el('span', { class: 'dags', texti: t.fyrirtaeki ? t.fyrirtaeki.nafn : '' })
        ])]))) : null
    ]);
  }

  function flipiHnappur(gildi, heiti, fjoldi) {
    return el('button', {
      type: 'button', class: 'pflipi', 'aria-pressed': String(flipi === gildi),
      onclick: () => { flipi = gildi; teikna(true); }
    }, [document.createTextNode(heiti), el('b', { texti: String(fjoldi) })]);
  }

  /* ------------------------------------------------------------------
     Nýtt verkefni frá okkur, með eða án sniðs
     ------------------------------------------------------------------ */
  function nyttVerkefniForm(fyrirtaeki, snidin) {
    const titill = el('input', { type: 'text', required: true, placeholder: 'Hvað heitir verkefnið' });
    const lysing = el('textarea', { rows: '3' });
    const dagur  = el('input', { type: 'date' });
    const villa  = el('div', { class: 'form-status form-status--err', hidden: true });

    const fyrVal = el('select', { 'aria-label': 'Fyrirtæki' },
      [el('option', { value: '', texti: 'Velja fyrirtæki' })].concat(
        fyrirtaeki.map((f) => el('option', { value: f.id, texti: f.nafn }))));

    const snidVal = el('select', { 'aria-label': 'Snið',
      onchange: () => {
        const sn = snidin.find((x) => x.id === snidVal.value);
        if (sn && !titill.value.trim()) titill.value = sn.nafn;
        fjoldi.textContent = sn ? sn.taskar.length + ' taskar fylgja' : '';
      } },
      [el('option', { value: '', texti: 'Ekkert snið, tómt verkefni' })].concat(
        snidin.map((sn) => el('option', { value: sn.id, texti: sn.nafn }))));
    const fjoldi = el('p', { class: 'skyring', texti: '' });

    const verd = el('input', {
      type: 'text', inputmode: 'numeric', placeholder: 'Verð okkar', 'aria-label': 'Verð okkar',
      onblur: () => {
        const t = lesaTolu(verd.value);
        verd.value = t ? kronur(t).replace(' kr.', '') : '';
      }
    });
    const verdReitur = el('div', { class: 'field' }, [el('span', { texti: 'Verð okkar' }), verd]);

    const greidsla = el('select', { 'aria-label': 'Hvernig þetta er greitt',
      onchange: () => { verdReitur.hidden = greidsla.value === 'innan'; } }, [
      el('option', { value: 'ser',   texti: 'Sér verkefni, greitt sérstaklega' }),
      el('option', { value: 'innan', texti: 'Innan áskriftarinnar' })
    ]);

    const d = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort' }, [
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { texti: 'Nýtt verkefni' }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                       onclick: () => d.close() })
      ]),
      el('form', { class: 'form-grid', style: 'margin-top:18px', onsubmit: async (e) => {
        e.preventDefault();
        if (!fyrVal.value) { villa.textContent = 'Veldu fyrirtæki.'; villa.hidden = false; return; }
        if (!titill.value.trim()) { villa.textContent = 'Titill vantar.'; villa.hidden = false; return; }
        try {
          await g.nyttVerkefniAdmin({
            fyrirtaeki_id: fyrVal.value,
            titill: titill.value.trim(),
            lysing: lysing.value.trim() || null,
            skiladagur: dagur.value || null,
            innan_samnings: greidsla.value === 'innan',
            verd_okkar: lesaTolu(verd.value),
            snid_id: snidVal.value || null
          });
          d.close(); teikna();
        } catch (f) { villa.textContent = f.message; villa.hidden = false; }
      } }, [
        el('div', { class: 'field' }, [el('span', { texti: 'Fyrirtæki' }), fyrVal]),
        el('div', { class: 'field' }, [el('span', { texti: 'Snið' }), snidVal, fjoldi]),
        el('label', { class: 'field' }, [el('span', { texti: 'Titill' }), titill]),
        el('label', { class: 'field' }, [el('span', { texti: 'Lýsing' }), lysing]),
        el('div', { class: 'field' }, [el('span', { texti: 'Greiðsla' }), greidsla]),
        verdReitur,
        el('label', { class: 'field' }, [el('span', { texti: 'Skiladagur' }), dagur]),
        villa,
        el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Búa til' })
      ])
    ])]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
    fyrVal.focus();
  }

  function nyttFyrirtaekiForm() {
    const nafn = el('input', { type: 'text', required: true, placeholder: 'Nafn fyrirtækis' });
    const askrift = el('input', { type: 'text', placeholder: 'Til dæmis: vefsíða í áskrift' });
    const villa = el('div', { class: 'form-status form-status--err', hidden: true });

    const verd = el('input', {
      type: 'text', inputmode: 'numeric', placeholder: 'Mánaðargjald',
      'aria-label': 'Mánaðargjald',
      onblur: () => {
        const t = lesaTolu(verd.value);
        verd.value = t ? kronur(t).replace(' kr.', '') : '';
      }
    });
    const verdReitur = el('div', { class: 'field' }, [
      el('span', { texti: 'Mánaðargjald' }), verd
    ]);
    verdReitur.hidden = true;

    const erAskrift = el('select', {
      'aria-label': 'Er í áskrift',
      onchange: () => { verdReitur.hidden = erAskrift.value !== 'ja'; }
    }, [
      el('option', { value: 'nei', texti: 'Stakt verkefni, rukkað fyrir hvert' }),
      el('option', { value: 'ja',  texti: 'Í áskrift, borgar mánaðarlega' })
    ]);

    const d = el('dialog', { class: 'pdialog' }, [el('div', { class: 'pdialog__kort' }, [
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { texti: 'Nýtt fyrirtæki' }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕',
                       onclick: () => d.close() })
      ]),
      el('form', { class: 'form-grid', style: 'margin-top:18px', onsubmit: async (e) => {
        e.preventDefault();
        if (!nafn.value.trim()) { villa.textContent = 'Nafn vantar.'; villa.hidden = false; return; }
        try {
          await g.nyttFyrirtaeki({
            nafn: nafn.value.trim(),
            askrift: askrift.value.trim() || null,
            er_askrift: erAskrift.value === 'ja',
            askrift_verd: erAskrift.value === 'ja' ? lesaTolu(verd.value) : null
          });
          d.close(); teikna();
        } catch (f) { villa.textContent = f.message; villa.hidden = false; }
      } }, [
        el('label', { class: 'field' }, [el('span', { texti: 'Nafn' }), nafn]),
        el('label', { class: 'field' }, [el('span', { texti: 'Hvað gerum við fyrir þau' }), askrift]),
        el('div', { class: 'field' }, [el('span', { texti: 'Greitt' }), erAskrift]),
        verdReitur,
        el('p', { class: 'skyring',
                  texti: 'Fyrirtæki í áskrift getur sent verkefni án budgets ef það rúmast innan samningsins. Öll önnur þurfa að setja budget.' }),
        villa,
        el('button', { type: 'submit', class: 'btn btn--sm', texti: 'Búa til' })
      ])
    ])]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
    nafn.focus();
  }

  hlad = geymt('stjornbord');
  if (hlad) teikna(true);
  teikna();
}
