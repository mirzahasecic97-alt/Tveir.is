/* ==========================================================================
   Glerhúsið: uppsetning nýrrar stofu (byrja.html)
   Sex skref, öllum má sleppa. Framvindan er geymd í stofur.uppsetning
   ({ stofan, verk, vidskiptavinur, starfsfolk, tengingar, lokid }) svo hún
   fylgi stofunni en ekki vafranum. Klárt opnar Stjórnborðið.
   ========================================================================== */

import {
  gogn, el, fylla, vardaHlid, teiknaHaus, opnaLykilord, stofa, afrita, tilkynna, opnaBodGlugga
} from './portal.js';
import { skeraMerki } from './merki-skera.js';
import { LYKLAR, lykilStada, opnaLykilGlugga, tengingarTakn } from './stillingar-sida.js';

/* Kom með hlekk úr boðinu: lykilorðið er fyrsta skrefið hér, ekki gluggi ofan á síðunni */
try { sessionStorage.removeItem('tveir-kom-med-hlekk'); } catch (e) { /* lokað */ }

const ek = await vardaHlid({ krefstAdmin: true });
if (ek) start();

async function start() {
  const g = await gogn();
  teiknaHaus(ek, 'Uppsetning');
  const innihald = document.getElementById('innihald');

  const SKREF = [
    { k: 'lykilord', heiti: 'Veldu lykilorð' },
    { k: 'stofan', heiti: 'Stofan þín' },
    { k: 'verk', heiti: 'Verk-netfangið þitt' },
    { k: 'vidskiptavinur', heiti: 'Fyrsti viðskiptavinurinn' },
    { k: 'starfsfolk', heiti: 'Starfsfólk' },
    { k: 'tengingar', heiti: 'Tengingar' }
  ];
  let u = { ...((stofa() || {}).uppsetning || {}) };
  let lykilordKomid = !(g.vantarLykilord ? await g.vantarLykilord().catch(() => false) : false);
  const buid = (k) => (k === 'lykilord' ? lykilordKomid : u[k] === true);
  const fraSlod = SKREF.findIndex((s) => '#' + s.k === location.hash);
  let nuna = fraSlod >= 0 ? fraSlod : Math.max(0, SKREF.findIndex((s) => !buid(s.k) && u[s.k] !== 'sleppt'));
  if (nuna < 0) nuna = 0;
  /* Tímar sem verkpóstskrefið setur af stað, stöðvaðir þegar skipt er um skref */
  let vakt = null;

  /* Framvindan vistuð á stofuna. Mistakist það er haldið áfram, skrefið er bara ekki merkt. */
  async function merkja(k, gildi) {
    if (k === 'lykilord') return;
    u = { ...u, [k]: gildi };
    try {
      const ny = await g.vistaStofu({ uppsetning: { [k]: gildi } });
      if (ny) { ek.stofa = ny; u = { ...(ny.uppsetning || u) }; }
    } catch (villa) { tilkynna(villa.message || 'Framvindan vistaðist ekki.'); }
  }
  function fara(i) {
    if (vakt) { clearInterval(vakt); vakt = null; }
    nuna = Math.max(0, Math.min(SKREF.length - 1, i));
    try { history.replaceState(history.state, '', '#' + SKREF[nuna].k); } catch (e) { /* skiptir ekki */ }
    teikna();
    const h = document.getElementById('byrja-skref');
    if (h) h.focus({ preventScroll: true });
  }
  const afram = () => fara(nuna + 1);
  async function sleppa() { const k = SKREF[nuna].k; if (!buid(k)) await merkja(k, 'sleppt'); afram(); }

  async function klart(hnappur) {
    if (hnappur) { hnappur.disabled = true; hnappur.textContent = 'Augnablik'; }
    try {
      await g.vistaStofu({ uppsetning: { lokid: true } });
      location.href = 'stjornbord.html';
    } catch (villa) {
      tilkynna(villa.message || 'Það tókst ekki að vista. Prófaðu aftur.');
      if (hnappur) { hnappur.disabled = false; hnappur.textContent = 'Klárt'; }
    }
  }

  const hnappar = (born) => el('div', { style: 'display:flex; gap:10px; flex-wrap:wrap; margin-top:22px' }, born);
  const sleppaHn = () => el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Sleppa í bili', onclick: sleppa });
  const aframHn = (texti = 'Áfram') => el('button', { type: 'button', class: 'btn', texti, onclick: afram });
  const tilBaka = () => (nuna > 0 ? el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Til baka', onclick: () => fara(nuna - 1) }) : null);
  const stadaLina = () => el('div', { class: 'form-status', role: 'status', hidden: true });
  const segja = (n, texti, tegund) => { n.textContent = texti; n.className = 'form-status form-status--' + tegund; n.hidden = false; };
  const reitur = (heiti, inntak, skyring) => el('label', { class: 'field' }, [el('span', { texti: heiti }), inntak,
    skyring ? el('small', { class: 'skyring', texti: skyring }) : null]);

  function teikna() {
    const s = SKREF[nuna];
    const efni = el('section', { class: 'card pblokk' }, [
      el('span', { class: 'skyring', texti: 'Skref ' + (nuna + 1) + ' af ' + SKREF.length }),
      el('h2', { id: 'byrja-skref', tabindex: '-1', style: 'margin-top:6px', texti: s.heiti }),
      el('div', { id: 'byrja-efni' })
    ]);
    fylla(innihald, [
      el('div', { class: 'page-head', style: 'padding-top:0' }, [
        el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Settu upp Glerhúsið' }),
        el('p', { class: 'lead', texti: 'Sex stutt skref. Öllum má sleppa og klára seinna í Stillingum.' })
      ]),
      /* Í síma kemur skrefið sjálft fyrst og listinn á eftir; á skjá er listinn til hægri */
      el('div', { class: 'pgrid' }, [
        el('div', { class: 'pmain' }, [efni]),
        el('div', { class: 'psum' }, [skrefaListi()])
      ])
    ]);
    const svid = efni.querySelector('#byrja-efni');
    ({ lykilord: skrefLykilord, stofan: skrefStofan, verk: skrefVerk, vidskiptavinur: skrefVidskiptavinur,
       starfsfolk: skrefStarfsfolk, tengingar: skrefTengingar })[s.k](svid);
  }

  function skrefaListi() {
    return el('div', { class: 'card pblokk' }, [
      el('ol', { class: 'timalina', 'aria-label': 'Skrefin' }, SKREF.map((s, i) => el('li', {
        class: 'skref' + (buid(s.k) ? ' skref--lokid' : '') + (i === nuna ? ' skref--nuna' : '')
      }, [
        el('button', { type: 'button', class: 'skref__hak', texti: String(i + 1), 'aria-hidden': 'true', tabindex: '-1', onclick: () => fara(i) }),
        el('div', { class: 'skref__inn' }, [
          el('button', { type: 'button', class: 'skref__titill', texti: s.heiti, 'aria-current': i === nuna ? 'step' : null, onclick: () => fara(i) }),
          u[s.k] === 'sleppt' && !buid(s.k) ? el('span', { class: 'skyring', texti: 'Sleppt' }) : null
        ])
      ]))),
      el('button', { type: 'button', class: 'btn btn--block', style: 'margin-top:22px', texti: 'Klárt', onclick: (e) => klart(e.currentTarget) }),
      el('p', { class: 'skyring', style: 'margin-top:10px', texti: 'Klárt opnar Stjórnborðið. Það sem er eftir má gera í Stillingum.' })
    ]);
  }

  /* ---------- 1. Lykilorð ---------- */
  function skrefLykilord(svid) {
    fylla(svid, lykilordKomid
      ? [el('p', { class: 'lead', style: 'margin-top:10px', texti: 'Lykilorðið er komið. Næst skráirðu þig inn með netfanginu og lykilorðinu.' }),
         hnappar([aframHn()])]
      : [el('p', { class: 'lead', style: 'margin-top:10px', texti: 'Veldu lykilorð svo þú komist inn án þess að bíða eftir hlekk í pósti.' }),
         hnappar([
           el('button', { type: 'button', class: 'btn', texti: 'Velja lykilorð', onclick: () => opnaLykilord({
             netfang: ek.netfang,
             eftir: (vistad) => { if (vistad) { lykilordKomid = true; afram(); } }
           }) }),
           sleppaHn()
         ])]);
  }

  /* ---------- 2. Stofan ---------- */
  function skrefStofan(svid) {
    const st = stofa() || {};
    /* Valið úr "Settu saman" í þessum vafra, ef gesturinn byggði sýnidæmi fyrst */
    let byggt = null;
    try { const x = JSON.parse(localStorage.getItem('glerhusid-byggja') || 'null'); byggt = x && x.buid ? x : null; } catch (e) { byggt = null; }
    const SJALFGEFID = '#5b93f0';
    const upphafsLitur = st.litur || (byggt && /^#[0-9a-f]{6}$/i.test(byggt.litur || '') ? byggt.litur : null);
    let litur = upphafsLitur;
    const inNafn = el('input', { type: 'text', required: true, maxlength: '120',
      value: st.nafn || (byggt && typeof byggt.nafn === 'string' ? byggt.nafn.trim() : '') });
    const inLitur = el('input', { type: 'color', value: litur || SJALFGEFID, 'aria-label': 'Litur stofunnar',
      style: 'width:56px; height:44px; padding:2px; border-radius:10px' });
    const liturTexti = el('span', { class: 'skyring', texti: litur || 'Sjálfgefinn litur Glerhússins' });
    inLitur.addEventListener('input', () => { litur = inLitur.value; liturTexti.textContent = litur; });

    const merkiSyn = el('div', { class: 'merkikort__synd' });
    const merkiStada = el('p', { class: 'skyring', role: 'status' });
    const teiknaMerki = (url) => fylla(merkiSyn, [url
      ? el('img', { src: url, alt: 'Merki stofunnar', style: 'max-height:60px; max-width:220px; object-fit:contain', referrerpolicy: 'no-referrer' })
      : el('span', { class: 'skyring', texti: 'Ekkert merki. Nafnið birtist í staðinn.' })]);
    teiknaMerki(st.merki_url);
    async function hladaUpp(skra) {
      merkiStada.textContent = 'Hleð upp';
      try {
        const ny = await g.setjaStofuMerki(skra);
        ek.stofa = ny; teiknaHaus(ek, 'Uppsetning'); teiknaMerki(ny.merki_url); merkiStada.textContent = 'Merkið er komið.';
      } catch (villa) { merkiStada.textContent = villa.message || 'Merkið fór ekki upp.'; }
    }
    const skraInn = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', style: 'display:none', onchange: (e) => {
      const skra = e.target.files && e.target.files[0]; e.target.value = '';
      if (!skra) return;
      skeraMerki(skra).then((skorin) => { if (skorin) hladaUpp(skorin); },
        (villa) => { merkiStada.textContent = villa.message || 'Það tókst ekki að lesa myndina.'; });
    } });
    /* Merkið úr sýnidæminu er mynd í vafranum: hlaðið upp eins og hver önnur skrá */
    const byggtMerki = !st.merki_url && byggt && typeof byggt.merki === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(byggt.merki) ? byggt.merki : null;
    const notaByggt = byggtMerki ? el('button', { type: 'button', class: 'btn btn--sm btn--ghost', texti: 'Nota merkið úr sýnidæminu', onclick: async () => {
      try {
        const blob = await (await fetch(byggtMerki)).blob();
        await hladaUpp(new File([blob], 'merki.' + (blob.type.split('/')[1] || 'png'), { type: blob.type }));
      } catch (villa) { merkiStada.textContent = 'Merkið úr sýnidæminu fór ekki upp. Hladdu því upp sem skrá.'; }
    } }) : null;

    const stada = stadaLina();
    const vista = el('button', { type: 'submit', class: 'btn', texti: 'Vista og áfram' });
    fylla(svid, [
      el('p', { class: 'lead', style: 'margin-top:10px', texti: 'Nafnið, merkið og liturinn birtast í hausnum hjá öllum sem þú býður inn.' }),
      el('form', { class: 'form-grid', style: 'margin-top:18px', novalidate: true, onsubmit: async (e) => {
        e.preventDefault(); stada.hidden = true;
        vista.disabled = true; vista.textContent = 'Vistar';
        try {
          const ny = await g.vistaStofu({ nafn: inNafn.value, litur, uppsetning: { stofan: true } });
          ek.stofa = ny; u = { ...(ny.uppsetning || { ...u, stofan: true }) };
          teiknaHaus(ek, 'Uppsetning');
          afram();
        } catch (villa) {
          segja(stada, villa.message || 'Það tókst ekki að vista.', 'err');
          vista.disabled = false; vista.textContent = 'Vista og áfram';
        }
      } }, [
        reitur('Nafn stofunnar', inNafn),
        el('div', { class: 'field' }, [el('span', { texti: 'Merki' }), merkiSyn,
          el('div', { style: 'display:flex; gap:10px; flex-wrap:wrap; margin-top:10px' }, [
            el('label', { class: 'btn btn--sm btn--ghost' }, [document.createTextNode('Hlaða upp merki'), skraInn]),
            notaByggt
          ]),
          el('small', { class: 'skyring', texti: 'PNG, JPG eða WEBP, mest 2 MB.' }),
          merkiStada]),
        el('div', { class: 'field' }, [el('span', { texti: 'Litur' }),
          el('div', { style: 'display:flex; align-items:center; gap:12px; flex-wrap:wrap' }, [inLitur, liturTexti])]),
        stada,
        el('div', { style: 'display:flex; gap:10px; flex-wrap:wrap' }, [vista, sleppaHn(), tilBaka()])
      ])
    ]);
  }

  /* ---------- 3. Verk-netfangið ---------- */
  async function skrefVerk(svid) {
    const st = stofa() || {};
    const adal = st.verk || null;
    if (!adal) {
      fylla(svid, [el('p', { class: 'lead', style: 'margin-top:10px', texti: 'Verk-netfangið er ekki komið upp ennþá. Það birtist í Stillingum þegar það er tilbúið.' }),
        hnappar([aframHn(), tilBaka()])]);
      return;
    }
    const kom = el('div', { role: 'status', 'aria-live': 'polite' });
    const hn = hnappar([aframHn(buid('verk') ? 'Áfram' : 'Áfram án prufu'), tilBaka()]);
    const afritaHn = el('button', { type: 'button', class: 'btn btn--sm', texti: 'Afrita', onclick: (e) => afrita(adal, e.currentTarget) });
    fylla(svid, [
      el('p', { class: 'lead', style: 'margin-top:10px', texti: 'Viðskiptavinir senda póst á þetta netfang, eða setja það í CC, og hver lína verður að verki.' }),
      el('div', { style: 'display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:16px; padding:14px 16px; background:var(--bg); border-radius:var(--r-input)' }, [
        el('strong', { texti: adal, style: 'font-size:17px; word-break:break-all', 'data-ekki-thyda': '' }), afritaHn
      ]),
      el('p', { style: 'margin-top:16px', texti: 'Sendu prufupóst þangað núna úr netfanginu þínu.' }),
      el('p', { class: 'skyring', style: 'margin-top:8px', texti: 'Póstur frá þér verður ekki að verki, því verk verða bara til úr pósti frá skráðum viðskiptavinum. Hann birtist í staðinn í Samskiptum undir Verkpóstur, og þá veistu að netfangið virkar. Viltu sjá verk verða til: bjóddu öðru netfangi þínu inn sem viðskiptavini hjá prufufyrirtæki og sendu þaðan.' }),
      kom,
      hn
    ]);
    if (g.prufa) {
      fylla(kom, [el('p', { class: 'skyring', style: 'margin-top:14px', texti: 'Sýnidæmi: enginn póstur berst hingað. Í alvöru Glerhúsi birtist Pósturinn kom! hér um leið og prufupósturinn berst.' })]);
      return;
    }
    /* Beðið eftir póstinum: litið á stöðuna á 10 sekúndna fresti í 15 mínútur */
    const log = await g.verkpostStada().catch(() => []);
    const grunnur = log.length ? new Date(log[0].dags).getTime() : 0;
    let byrjad = Date.now();
    const bida = () => fylla(kom, [el('p', { class: 'skyring', style: 'margin-top:14px', texti: 'Bíð eftir póstinum. Hann kemur yfirleitt innan 5 mínútna.' })]);
    bida();
    /* Hvað varð um póstinn: [texti, slóð, texti á hnappi] eftir niðurstöðu vélarinnar */
    const NIDURSTADA = {
      taskur: ['Verk urðu til úr honum.', 'stjornbord.html', 'Sjá verkin'],
      athugasemd: ['Hann varð að athugasemd á verki.', 'stjornbord.html', 'Opna Stjórnborð'],
      othekktur: ['Hann er kominn í Samskipti undir Verkpóstur.', 'samskipti.html', 'Opna Verkpóst'],
      oaudkenndur: ['Netfangið virkar, en sendandinn stóðst ekki auðkenningu (SPF eða DKIM), svo pósturinn var ekki geymdur. Prófaðu að senda úr öðru netfangi.', null, null],
      hamark: ['Netfangið virkar, en hámarki verka á klukkustund er náð. Prófaðu aftur seinna.', null, null]
    };
    const lita = async () => {
      if (!svid.isConnected) { clearInterval(vakt); vakt = null; return; }
      const ny = await g.verkpostStada().catch(() => null);
      const kominn = ny && ny.find((r) => new Date(r.dags).getTime() > grunnur && r.nidurstada !== 'stadfesting');
      if (kominn) {
        clearInterval(vakt); vakt = null;
        await merkja('verk', true);
        const [texti, slod, hnappur] = NIDURSTADA[kominn.nidurstada] || ['Netfangið virkar.', null, null];
        fylla(kom, [el('div', { class: 'tilkynning', style: 'margin-top:16px' }, [
          el('div', { class: 'tilkynning__inn' }, [
            el('strong', { texti: 'Pósturinn kom!' }),
            el('span', { class: 'undir', texti })
          ]),
          slod ? el('a', { class: 'btn btn--sm', href: slod, texti: hnappur }) : null
        ])]);
        fylla(hn, [aframHn(), tilBaka()]);
        return;
      }
      if (Date.now() - byrjad > 15 * 60 * 1000) {
        clearInterval(vakt); vakt = null;
        fylla(kom, [el('p', { class: 'skyring', style: 'margin-top:14px', texti: 'Ekkert hefur borist ennþá. Athugaðu að netfangið sé rétt skrifað og prófaðu aftur.' }),
          el('button', { type: 'button', class: 'btn btn--sm btn--ghost', style: 'margin-top:8px', texti: 'Bíða aftur',
            onclick: () => { byrjad = Date.now(); bida(); if (vakt) clearInterval(vakt); vakt = setInterval(lita, 10000); } })]);
      }
    };
    vakt = setInterval(lita, 10000);
  }

  /* ---------- 4. Fyrsti viðskiptavinurinn ---------- */
  async function skrefVidskiptavinur(svid) {
    const til = await g.fyrirtaeki().catch(() => []);
    const inFyrirtaeki = el('input', { type: 'text', required: true, placeholder: 'Nafn fyrirtækisins' });
    const inKennitala = el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: '10 tölustafir' });
    const inNetfang = el('input', { type: 'email', autocomplete: 'off', placeholder: 'nafn@fyrirtaeki.is' });
    const inNafn = el('input', { type: 'text', autocomplete: 'off', placeholder: 'Fullt nafn' });
    const stada = stadaLina();
    const vista = el('button', { type: 'submit', class: 'btn', texti: 'Búa til og bjóða' });
    fylla(svid, [
      el('p', { class: 'lead', style: 'margin-top:10px', texti: 'Fyrirtækið sem þú vinnur fyrir og fyrsti notandinn þar. Viðkomandi sér bara verkefni síns fyrirtækis.' }),
      til.length ? el('p', { class: 'skyring', style: 'margin-top:10px', texti: ('Komið: ' + til.map((f) => f.nafn).join(', ')).replace(/\.?$/, '.') }) : null,
      el('form', { class: 'form-grid', style: 'margin-top:18px', novalidate: true, onsubmit: async (e) => {
        e.preventDefault(); stada.hidden = true;
        if (!inFyrirtaeki.value.trim()) { segja(stada, 'Nafn fyrirtækisins vantar.', 'err'); inFyrirtaeki.focus(); return; }
        vista.disabled = true; vista.textContent = 'Augnablik';
        try {
          const f = await g.nyttFyrirtaeki({ nafn: inFyrirtaeki.value.trim(),
            ...(inKennitala.value.trim() ? { kennitala: inKennitala.value } : {}) });
          let texti = f.nafn + ' er komið.';
          if (inNetfang.value.trim()) {
            try {
              const svar = await g.bjodaNotanda({ netfang: inNetfang.value, nafn: inNafn.value, hlutverk: 'vidskiptavinur', fyrirtaeki_id: f.id });
              texti += ' ' + (svar.texti || '');
            } catch (villa) { texti += ' Boðið fór ekki: ' + (villa.message || 'óþekkt villa'); }
          }
          await merkja('vidskiptavinur', true);
          segja(stada, texti.trim(), 'ok');
          inFyrirtaeki.value = inKennitala.value = inNetfang.value = inNafn.value = '';
          fylla(hnapparSvid, [aframHn(), tilBaka()]);
        } catch (villa) { segja(stada, villa.message || 'Það tókst ekki.', 'err'); }
        finally { vista.disabled = false; vista.textContent = 'Búa til og bjóða'; }
      } }, [
        reitur('Fyrirtæki', inFyrirtaeki),
        reitur('Kennitala', inKennitala, 'Valfrjálst. Reikningsdrög í Payday og DK þurfa hana.'),
        reitur('Netfang notandans', inNetfang, 'Valfrjálst. Viðkomandi fær hlekk í pósti.'),
        reitur('Nafn notandans', inNafn),
        stada,
        el('div', { style: 'display:flex; gap:10px; flex-wrap:wrap' }, [vista,
          til.length ? el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Bjóða hjá fyrirtæki sem er til',
            onclick: () => opnaBodGlugga({ fyrirtaeki: til, eftir: () => merkja('vidskiptavinur', true) }) }) : null])
      ])
    ]);
    const hnapparSvid = hnappar([buid('vidskiptavinur') ? aframHn() : sleppaHn(), tilBaka()]);
    svid.append(hnapparSvid);
  }

  /* ---------- 5. Starfsfólk ---------- */
  async function skrefStarfsfolk(svid) {
    const [notendur, bod] = await Promise.all([g.notendur().catch(() => []), g.bod ? g.bod().catch(() => []) : []]);
    const stjornendur = notendur.filter((n) => n.hlutverk === 'admin');
    const bidaAdmin = bod.filter((b) => b.hlutverk === 'admin');
    const inNetfang = el('input', { type: 'email', autocomplete: 'off', placeholder: 'nafn@stofan.is' });
    const inNafn = el('input', { type: 'text', autocomplete: 'off', placeholder: 'Fullt nafn' });
    const stada = stadaLina();
    const vista = el('button', { type: 'submit', class: 'btn', texti: 'Senda boð' });
    const listi = el('ul', { class: 'uppsetning', style: 'margin-top:12px' }, [
      ...stjornendur.map((n) => el('li', {}, [el('span', { texti: (n.nafn || n.netfang) + (n.id === ek.id ? ' (þú)' : '') })])),
      ...bidaAdmin.map((b) => el('li', {}, [el('span', { texti: (b.nafn || b.netfang) + ', boð bíður' })]))
    ]);
    fylla(svid, [
      el('p', { class: 'lead', style: 'margin-top:10px', texti: 'Bjóddu þeim sem vinna með þér. Stjórnendur sjá allt í Glerhúsinu og geta breytt öllu.' }),
      listi,
      el('form', { class: 'form-grid', style: 'margin-top:18px', novalidate: true, onsubmit: async (e) => {
        e.preventDefault(); stada.hidden = true;
        if (!inNetfang.value.trim()) { segja(stada, 'Netfangið vantar.', 'err'); inNetfang.focus(); return; }
        vista.disabled = true; vista.textContent = 'Sendi';
        try {
          const svar = await g.bjodaNotanda({ netfang: inNetfang.value, nafn: inNafn.value, hlutverk: 'admin' });
          listi.append(el('li', {}, [el('span', { texti: (inNafn.value.trim() || inNetfang.value.trim()) + ', boð bíður' })]));
          segja(stada, svar.texti || 'Boðið er farið.', 'ok');
          inNetfang.value = inNafn.value = '';
          await merkja('starfsfolk', true);
          fylla(hnapparSvid, [aframHn(), tilBaka()]);
        } catch (villa) { segja(stada, villa.message || 'Boðið fór ekki.', 'err'); }
        finally { vista.disabled = false; vista.textContent = 'Senda boð'; }
      } }, [
        reitur('Netfang', inNetfang),
        reitur('Nafn', inNafn),
        stada,
        el('div', {}, [vista])
      ])
    ]);
    const hnapparSvid = hnappar([buid('starfsfolk') ? aframHn() : sleppaHn(), tilBaka()]);
    svid.append(hnapparSvid);
  }

  /* Google, Meta og TikTok: hvað bíður samþykkis veitnanna (úr min_stada) */
  function oauthTexti() {
    const ms = ek.min_stada || {};
    const bida = [
      ...(ms.google_tilbuid ? [] : ['Google Calendar']),
      ...(ms.meta_tilbuid ? [] : ['Instagram', 'Facebook']),
      ...(ms.tiktok_tilbuid ? [] : ['TikTok'])
    ];
    if (!bida.length) return 'Google, Instagram, Facebook og TikTok tengirðu í Stillingum.';
    const listi = bida.length > 1 ? bida.slice(0, -1).join(', ') + ' og ' + bida[bida.length - 1] : bida[0];
    return bida.length > 1
      ? listi + ' bíða samþykkis veitnanna. Þær birtast í Stillingum þegar þær opnast.'
      : listi + ' bíður samþykkis. Tengingin birtist í Stillingum þegar hún opnast.';
  }

  /* ---------- 6. Tengingar ---------- */
  async function skrefTengingar(svid) {
    let lyklar = (g.tengingarStada ? await g.tengingarStada().catch(() => null) : null) || {};
    const PILLUR = { tengt: 'Tengt', bidur: 'Bíður', ekki: 'Ekki tengt' };
    const teiknaListi = () => fylla(listiSvid, Object.values(LYKLAR).map((t) => {
      const r = lyklar[t.veita] || null;
      const [stada, undir] = lykilStada(r, t);
      return el('article', { class: 'st-teng st-teng--' + stada }, [
        el('div', { class: 'st-teng__efst' }, [
          tengingarTakn(t),
          el('div', { class: 'st-teng__nafn' }, [el('strong', { texti: t.heiti }), el('span', { texti: t.hvad })]),
          el('span', { class: 'st-pilla st-pilla--' + stada, texti: PILLUR[stada] })
        ]),
        undir ? el('p', { class: 'st-teng__stada', texti: undir }) : null,
        el('div', { class: 'st-teng__fot' }, [
          el('button', { type: 'button', class: 'btn btn--sm' + (r ? ' btn--ghost' : ''), texti: r ? 'Breyta' : 'Tengja',
            onclick: () => opnaLykilGlugga({ g, veita: t.veita, r, eftir: async () => {
              lyklar = (await g.tengingarStada().catch(() => null)) || lyklar;
              teiknaListi();
              return lyklar;
            } }) })
        ])
      ]);
    }));
    const listiSvid = el('div', { class: 'st-tengingar', style: 'margin-top:18px' });
    teiknaListi();
    fylla(svid, [
      el('p', { class: 'lead', style: 'margin-top:10px', texti: 'Tengdu bókhaldið, vefverslunina og gervigreindina með ykkar eigin lyklum. Hver lykill er prófaður um leið og hann er vistaður.' }),
      listiSvid,
      el('p', { class: 'skyring', style: 'margin-top:14px', texti: oauthTexti() }),
      hnappar([
        el('button', { type: 'button', class: 'btn', texti: 'Klárt', onclick: async (e) => { await merkja('tengingar', true); klart(e.currentTarget); } }),
        tilBaka()
      ])
    ]);
  }

  teikna();
}
