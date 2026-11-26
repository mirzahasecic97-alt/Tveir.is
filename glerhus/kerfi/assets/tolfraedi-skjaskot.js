/* ==========================================================================
   Tölfræði úr skjáskoti, send á viðskiptavin.
   Stjórnandi hleður inn skjáskotum af tölfræði (til dæmis Instagram Insights
   eftir helgi sem var tekin upp), gervigreind stofunnar les tölurnar
   (Edge Function greina-skjaskot), stjórnandinn fer yfir þær og lagar, og
   pósturinn fer á viðskiptavininn í sama útliti og "Senda á viðskiptavin"
   (postHtml í tolfraedi-senda.js). Myndirnar eru minnkaðar í vafranum og
   aldrei vistaðar. Ekkert fer út fyrr en ýtt er á Senda.
   ========================================================================== */
import { el, fylla } from './portal.js';
import { postHtml, postTexti, stofuSnid } from './tolfraedi-senda.js';

const MEST_MYNDIR = 8;
const LENGD = 2400;          // lengsta hlið eftir minnkun, í dílum
const DILAR = 2_000_000;     // mest díla í mynd, svo há skjáskot haldist læsileg
const MAN = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
const GAEDI = 0.86;
const MIDLAR_HEITI = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', annad: 'Annar miðill' };
const ADAL = [['ahorf', 'Áhorf'], ['nadir', 'Náð'], ['samskipti', 'Samskipti'], ['fylgjendur', 'Fylgjendur'], ['fylgjendur_breyting', 'Nýir fylgjendur']];
const PROSENTUR = [['ahorf_breyting_pr', 'Áhorf, breyting %'], ['nadir_breyting_pr', 'Náð, breyting %'], ['samskipti_breyting_pr', 'Samskipti, breyting %']];
const AUKA = [['likes', 'Líkar'], ['athugasemdir', 'Athugasemdir'], ['deilingar', 'Deilingar'], ['vistanir', 'Vistanir'], ['heimsoknir', 'Heimsóknir á prófíl'], ['faerslur', 'Færslur']];

const erTala = (n) => n !== null && n !== undefined && n !== '' && isFinite(Number(n));
/* "12.300", "12 300" eða "12300" úr reit verður 12300. Tómt verður null. */
/* undefined þýðir að eitthvað stendur í reitnum sem er ekki tala */
const lesaTolu = (v, maNeikvaett) => {
  const s = String(v == null ? '' : v).trim().replace(/\u2212/g, '-').replace(/[\s.]/g, '').replace(',', '.').replace(/^\+/, '');
  if (!s) return null;
  const n = Number(s);
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(s) || !isFinite(n) || (!maNeikvaett && n < 0)) return undefined;
  return n;
};
/* Prósenta: "12,5", "12.5", "+34", "-12" eða "−12%" */
const lesaProsentu = (v) => {
  const s = String(v == null ? '' : v).trim().replace(/\u2212/g, '-').replace(/[%\s]/g, '').replace(',', '.').replace(/^\+/, '');
  if (!s) return null;
  return /^-?[0-9]+(\.[0-9]+)?$/.test(s) ? Number(s) : undefined;
};
const synaTolu = (n) => (erTala(n) ? Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');
const summa = (listi, k) => listi.reduce((a, x) => (erTala(x[k]) ? (a === null ? 0 : a) + Number(x[k]) : a), null);

/* Mynd minnkuð og breytt í JPEG í vafranum, skilar { gerd, gogn, slod } */
async function undirbua(skra) {
  if (!skra || !/^image\//.test(skra.type || 'image/')) throw new Error(skra && skra.name ? skra.name + ' er ekki mynd.' : 'Þetta er ekki mynd.');
  let mynd;
  try { mynd = await createImageBitmap(skra); }
  catch (e) { throw new Error((skra.name || 'Myndin') + ' opnaðist ekki. Notaðu PNG eða JPG (skjáskot af síma eru yfirleitt PNG).'); }
  const hlutfall = Math.min(1, LENGD / Math.max(mynd.width, mynd.height), Math.sqrt(DILAR / (mynd.width * mynd.height)));
  const b = Math.max(1, Math.round(mynd.width * hlutfall)), h = Math.max(1, Math.round(mynd.height * hlutfall));
  const striga = document.createElement('canvas');
  striga.width = b; striga.height = h;
  const ctx = striga.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, b, h);
  ctx.drawImage(mynd, 0, 0, b, h);
  if (mynd.close) mynd.close();
  const gogn = striga.toDataURL('image/jpeg', GAEDI);
  /* Blob slóð til að sýna og opna myndina (data: slóðir opnast ekki í nýjum flipa) */
  const blob = await new Promise((r) => striga.toBlob(r, 'image/jpeg', GAEDI));
  const slod = blob ? URL.createObjectURL(blob) : gogn;
  return { gerd: 'image/jpeg', gogn: gogn.slice(gogn.indexOf(',') + 1), slod };
}

export async function opnaSkjaskot({ g, ek, fid, fyrirtaeki }) {
  const stofa = (ek && ek.stofa) || null;
  const snid = stofuSnid(stofa);

  const d = el('dialog', { class: 'pdialog ts-gluggi sk-gluggi', 'aria-labelledby': 'sk-h' });
  const kort = el('div', { class: 'pdialog__kort ts-kort' });
  d.appendChild(kort);
  document.body.appendChild(d);
  d.addEventListener('close', () => {
    d.remove();
    document.removeEventListener('paste', aLima);
    myndir.forEach((m) => { if (/^blob:/.test(m.slod)) URL.revokeObjectURL(m.slod); });
  });
  d.showModal();

  const myndir = [];          // { gerd, gogn, slod, nafn }
  let lysing = '';
  let nidurstada = null;
  let lesiNu = false;         // gervigreindin er að lesa: engu bætt við eða breytt á meðan

  /* Skjáskot límt inn með Cmd+V meðan glugginn er opinn */
  async function aLima(e) {
    if (!d.open || nidurstada || lesiNu) return;
    const skrar = [...((e.clipboardData && e.clipboardData.files) || [])].filter((f) => /^image\//.test(f.type));
    if (!skrar.length) return;
    e.preventDefault();
    await baetaVid(skrar);
  }
  document.addEventListener('paste', aLima);

  let villaSkref1 = null, myndalisti = null, lesaHn = null;
  async function baetaVid(skrar) {
    if (lesiNu) return;
    villaSkref1.hidden = true;
    const plass = MEST_MYNDIR - myndir.length;
    if (skrar.length > plass) { villaSkref1.textContent = 'Mest ' + MEST_MYNDIR + ' skjáskot í einu.'; villaSkref1.hidden = false; }
    for (const f of [...skrar].slice(0, Math.max(0, plass))) {
      try { myndir.push({ ...(await undirbua(f)), nafn: f.name || 'Skjáskot' }); }
      catch (e) { villaSkref1.textContent = e.message; villaSkref1.hidden = false; }
    }
    teiknaMyndir();
  }

  function teiknaMyndir() {
    fylla(myndalisti, myndir.map((m, i) => el('li', { class: 'sk-mynd' }, [
      el('img', { src: m.slod, alt: m.nafn }),
      lesiNu ? null : el('button', { type: 'button', class: 'sk-mynd__burt', 'aria-label': 'Taka út ' + m.nafn, texti: '✕',
        onclick: () => { const [burt] = myndir.splice(i, 1); if (burt && /^blob:/.test(burt.slod)) URL.revokeObjectURL(burt.slod); teiknaMyndir(); } })
    ])));
    lesaHn.disabled = lesiNu || !myndir.length;
    if (lesiNu) return;
    lesaHn.textContent = myndir.length ? 'Lesa tölurnar (' + myndir.length + (myndir.length === 1 ? ' mynd)' : ' myndir)') : 'Settu inn skjáskot';
  }

  /* ------------------------------------------------------------------
     Skref 1: skjáskotin
     ------------------------------------------------------------------ */
  function skref1() {
    nidurstada = null;
    const lysingReitur = el('input', { id: 'sk-lysing', type: 'text', class: 'ts-ord', maxlength: '120',
      placeholder: 'Til dæmis: helgin 22. til 23. nóvember, leikurinn við KR' });
    lysingReitur.value = lysing;
    lysingReitur.addEventListener('input', () => { lysing = lysingReitur.value; });
    const inntak = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/heic,image/heif', multiple: true, class: 'sr-only', id: 'sk-skrar' });
    inntak.addEventListener('change', async () => { await baetaVid([...inntak.files]); inntak.value = ''; });
    const svaedi = el('label', { class: 'sk-svaedi', for: 'sk-skrar' }, [
      el('span', { class: 'sk-svaedi__takn', 'aria-hidden': 'true', texti: '＋' }),
      el('strong', { texti: 'Veldu skjáskot eða dragðu þau hingað' }),
      el('small', { texti: 'Mest ' + MEST_MYNDIR + ' myndir. Þú getur líka límt inn skjáskot með Cmd+V.' })
    ]);
    ['dragenter', 'dragover'].forEach((t) => svaedi.addEventListener(t, (e) => { e.preventDefault(); svaedi.classList.add('er-yfir'); }));
    ['dragleave', 'drop'].forEach((t) => svaedi.addEventListener(t, () => svaedi.classList.remove('er-yfir')));
    svaedi.addEventListener('drop', async (e) => { e.preventDefault(); await baetaVid([...((e.dataTransfer && e.dataTransfer.files) || [])]); });

    myndalisti = el('ul', { class: 'sk-myndir' });
    villaSkref1 = el('p', { class: 'ts-villa', role: 'alert', hidden: true });
    const stada = el('p', { class: 'skyring', role: 'status', hidden: true });
    lesaHn = el('button', { type: 'button', class: 'btn' });
    lesaHn.addEventListener('click', async () => {
      if (!myndir.length || lesiNu) return;
      lesiNu = true; teiknaMyndir();
      lesaHn.textContent = 'Les tölurnar…'; villaSkref1.hidden = true;
      stada.hidden = false; stada.textContent = 'Gervigreindin les tölurnar. Þetta tekur yfirleitt 20 til 60 sekúndur.';
      try {
        const svar = await g.greinaSkjaskot(fid, myndir.map((m) => ({ gerd: m.gerd, gogn: m.gogn })), lysing);
        lesiNu = false;
        if (d.open) skref2(svar);
      } catch (e) {
        lesiNu = false;
        stada.hidden = true;
        villaSkref1.textContent = e.message || 'Þetta gekk ekki. Prófaðu aftur.';
        villaSkref1.hidden = false;
        teiknaMyndir();
      }
    });

    fylla(kort, [
      haus('Tölfræði úr skjáskoti'),
      el('div', { class: 'sk-skref1' }, [
        el('p', { class: 'skyring', texti: 'Settu inn skjáskot af tölfræðinni, til dæmis úr Instagram Insights eftir helgi sem þið tókuð upp. '
          + 'Gervigreindin les tölurnar, þú ferð yfir þær og sendir svo póst á ' + fyrirtaeki + ' í ykkar útliti.' }),
        el('div', { class: 'ts-hluti' }, [el('label', { class: 'ts-midi', for: 'sk-lysing', texti: 'Um hvað eru tölurnar? (valfrjálst)' }), lysingReitur]),
        inntak, svaedi, myndalisti, villaSkref1, stada,
        el('p', { class: 'skyring', texti: 'Myndirnar fara bara til gervigreindarinnar sem þið tengduð og eru ekki vistaðar.' }),
        el('div', { class: 'ts-hnappar' }, [el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Hætta við', onclick: () => d.close() }), lesaHn])
      ])
    ]);
    teiknaMyndir();
  }

  function haus(titill) {
    return el('div', { class: 'pdialog__haus' }, [
      el('h2', { id: 'sk-h', texti: titill }),
      el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
    ]);
  }

  /* ------------------------------------------------------------------
     Skref 2: fara yfir tölurnar, sjá póstinn og senda
     ------------------------------------------------------------------ */
  async function skref2(svar) {
    nidurstada = svar;
    fylla(kort, [haus('Farðu yfir tölurnar'), el('p', { class: 'tomt', texti: 'Sæki viðtakendur' })]);
    let notendur = [], notendaVilla = null;
    try { notendur = await g.notendur(); } catch (e) { notendur = []; notendaVilla = e.message || 'Náði ekki í viðtakendur.'; }
    const vidskiptavinir = (notendur || []).filter((n) => n.fyrirtaeki_id === fid && n.hlutverk === 'vidskiptavinur' && n.netfang);
    const valdir = new Set(vidskiptavinir.map((n) => n.netfang));
    let afrit = false;

    /* Tölurnar sem stjórnandinn getur breytt */
    const midlar = (svar.midlar || []).map((m) => ({ ...m }));
    /* Engar heildartölur lesnar (bara færslur): einn auður miðill svo hægt sé að skrifa þær inn */
    if (!midlar.length) midlar.push({ midill: ((svar.faerslur || [])[0] || {}).midill || 'instagram', reikningur: null });
    const faerslur = (svar.faerslur || []).map((p) => ({ ...p, med: true }));
    let medFaerslur = faerslur.length > 0;
    const titillTexti = (lysing || '').trim();
    const timabil = String(svar.timabil || '').trim();

    const reitur = (id, merki, gildi, vid, attr) => {
      const inp = el('input', { id, type: 'text', inputmode: 'numeric', class: 'sk-tala', autocomplete: 'off', ...(attr || {}) });
      inp.value = erTala(gildi) ? (attr && attr['data-pr'] ? String(gildi).replace('.', ',') : synaTolu(gildi)) : '';
      inp.addEventListener('input', () => {
        const ogilt = vid(inp.value) === undefined;
        inp.classList.toggle('er-villa', ogilt);
        if (ogilt) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
        uppfaera();
      });
      return el('label', { class: 'sk-reitur', for: id }, [el('span', { texti: merki }), inp]);
    };
    const midlaBlokkir = midlar.map((m, i) => el('fieldset', { class: 'sk-midill' }, [
      el('legend', { texti: (MIDLAR_HEITI[m.midill] || 'Miðill') + (m.reikningur ? ' ' + m.reikningur : '') }),
      el('div', { class: 'sk-reitir' }, ADAL.map(([k, h]) => reitur('sk-' + i + '-' + k, h, m[k], (v) => {
        const n = lesaTolu(v, k === 'fylgjendur_breyting'); m[k] = n === undefined ? null : n; return n;
      }, k === 'fylgjendur_breyting' ? { inputmode: 'text' } : null))),
      midlar.length === 1 ? el('div', { class: 'sk-reitir' }, PROSENTUR.map(([k, h]) => reitur('sk-' + i + '-' + k, h, m[k],
        (v) => { const n = lesaProsentu(v); m[k] = n === undefined ? null : n; return n; }, { 'data-pr': '1', inputmode: 'text' }))) : null,
      el('details', { class: 'sk-meira' }, [
        el('summary', { texti: 'Fleiri tölur' }),
        el('div', { class: 'sk-reitir' }, AUKA.map(([k, h]) => reitur('sk-' + i + '-' + k, h, m[k], (v) => {
          const n = lesaTolu(v); m[k] = n === undefined ? null : n; return n;
        })))
      ])
    ]));

    const faerslulisti = faerslur.length ? el('div', { class: 'ts-hluti' }, [
      el('label', { class: 'ts-afrit' }, [
        el('input', { type: 'checkbox', checked: true, onchange: (e) => { medFaerslur = e.target.checked; uppfaera(); } }),
        document.createTextNode('Hafa færslurnar með (' + faerslur.length + ')')
      ]),
      el('ul', { class: 'sk-faerslur' }, faerslur.map((p, i) => {
        const titill = el('input', { type: 'text', class: 'sk-faersla__titill', maxlength: '140', 'aria-label': 'Lýsing á færslu ' + (i + 1) });
        titill.value = p.titill || '';
        titill.addEventListener('input', () => { p.titill = titill.value; uppfaera(); });
        const ahorf = el('input', { type: 'text', inputmode: 'numeric', class: 'sk-tala', 'aria-label': 'Áhorf á færslu ' + (i + 1), placeholder: 'Áhorf' });
        ahorf.value = synaTolu(p.ahorf);
        ahorf.addEventListener('input', () => {
          const n = lesaTolu(ahorf.value); p.ahorf = n === undefined ? null : n;
          ahorf.classList.toggle('er-villa', n === undefined); uppfaera();
        });
        const li = el('li', { class: 'sk-faersla' }, [
          titill, ahorf,
          el('button', { type: 'button', class: 'sk-mynd__burt sk-faersla__burt', 'aria-label': 'Taka færslu ' + (i + 1) + ' út', texti: '✕',
            onclick: () => { p.med = !p.med; li.classList.toggle('er-uti', !p.med); uppfaera(); } })
        ]);
        return li;
      }))
    ]) : null;

    const allarMyndbond = faerslur.length && faerslur.every((p) => p.tegund === 'reel' || p.tegund === 'myndband');
    const fyrirsognFaerslna = allarMyndbond ? 'Myndböndin' : 'Færslurnar';

    const merkiReitur = el('input', { id: 'sk-merki', type: 'text', class: 'ts-ord', maxlength: '80' });
    const nu = new Date();
    merkiReitur.value = 'Tölfræði · ' + (timabil || titillTexti || nu.getDate() + '. ' + MAN[nu.getMonth()]);
    const inngangsReitur = el('textarea', { id: 'sk-inngangur', class: 'ts-ord', rows: '2', maxlength: '300' });
    inngangsReitur.value = timabil
      ? 'Hér eru tölurnar af samfélagsmiðlunum ykkar frá ' + timabil + '.'
      : titillTexti ? 'Hér eru tölurnar af samfélagsmiðlunum ykkar: ' + titillTexti + '.' : 'Hér eru nýjustu tölurnar af samfélagsmiðlunum ykkar.';
    const ordReitur = el('textarea', { id: 'sk-ord', class: 'ts-ord', rows: '4', maxlength: '1200', placeholder: 'Nokkur orð frá ykkur (valfrjálst)' });
    ordReitur.value = String(svar.samantekt || '');
    const efnisReitur = el('input', { id: 'sk-efni', type: 'text', class: 'ts-ord', maxlength: '200' });
    efnisReitur.value = (titillTexti ? 'Tölurnar: ' + titillTexti : 'Tölfræðin ykkar' + (timabil ? ' ' + timabil : '')) + ' · ' + fyrirtaeki;
    [merkiReitur, inngangsReitur, ordReitur, efnisReitur].forEach((x) => x.addEventListener('input', () => uppfaera()));

    const forsyn = el('iframe', { class: 'ts-forsyn', title: 'Forsýn á póstinum', sandbox: '', loading: 'eager' });
    const villa = el('p', { class: 'ts-villa', role: 'alert', hidden: true });
    const sendaHn = el('button', { type: 'button', class: 'btn' });

    const nofnValdra = () => vidskiptavinir.filter((n) => valdir.has(n.netfang)).map((n) => n.nafn || '');
    const gogn = () => {
      const listi = midlar.map((m) => ({
        midill: m.midill, nafn: MIDLAR_HEITI[m.midill] || '', ahorf: m.ahorf, nadir: m.nadir, samskipti: m.samskipti,
        fylgjendur_lok: m.fylgjendur, fylgjendur_breyting: m.fylgjendur_breyting, faerslur: m.faerslur, bestu_faerslur: []
      }));
      const samtals = {};
      ['ahorf', 'nadir', 'samskipti', 'fylgjendur_lok', 'fylgjendur_breyting', 'faerslur'].forEach((k) => { samtals[k] = summa(listi, k); });
      const breytingarPr = midlar.length === 1
        ? { ahorf: midlar[0].ahorf_breyting_pr, nadir: midlar[0].nadir_breyting_pr, samskipti: midlar[0].samskipti_breyting_pr } : {};
      const aukatolur = AUKA.map(([k, h]) => ({ heiti: h, gildi: summa(midlar, k) })).filter((x) => erTala(x.gildi));
      const mb = medFaerslur ? faerslur.filter((p) => p.med && String(p.titill || '').trim()).map((p) => ({
        titill: String(p.titill).trim(), midill: p.midill, birt: p.birt, ahorf: p.ahorf, likes: p.likes,
        athugasemdir: p.athugasemdir, deilingar: p.deilingar, slod: null
      })).filter((p) => erTala(p.ahorf) || erTala(p.likes) || erTala(p.athugasemdir) || erTala(p.deilingar))
        .sort((a, b) => (Number(b.ahorf) || 0) - (Number(a.ahorf) || 0) || (Number(b.likes) || 0) - (Number(a.likes) || 0)) : [];
      return {
        fyrirtaeki, nofn: nofnValdra(), merkiTexti: merkiReitur.value.trim() || 'Tölfræði', inngangur: '',
        inngangsTexti: inngangsReitur.value.trim() || 'Hér eru nýjustu tölurnar af samfélagsmiðlunum ykkar.',
        fyrriHeiti: 'tímabilið á undan', tolur: { midlar: listi, samtals }, ord: ordReitur.value.trim(),
        myndbond: mb, myndbondTitill: fyrirsognFaerslna, breytingarPr, aukatolur, snid, samanburdur: false
      };
    };

    let bid, sendir = false;
    const uppfaera = () => {
      clearTimeout(bid);
      bid = setTimeout(() => { forsyn.srcdoc = postHtml(gogn()); }, 150);
      if (sendir) return;
      const fjoldi = valdir.size + (afrit ? 1 : 0);
      sendaHn.disabled = fjoldi === 0;
      sendaHn.textContent = fjoldi ? 'Senda á ' + (fjoldi === 1 ? '1 viðtakanda' : fjoldi + ' viðtakendur') : 'Veldu viðtakanda';
    };

    const vidtakendur = vidskiptavinir.length
      ? el('ul', { class: 'ts-vidtakendur' }, vidskiptavinir.map((n) => el('li', {}, [
          el('label', {}, [
            el('input', { type: 'checkbox', checked: true, onchange: (e) => { e.target.checked ? valdir.add(n.netfang) : valdir.delete(n.netfang); uppfaera(); } }),
            el('span', {}, [el('strong', { texti: n.nafn || n.netfang }), el('small', { texti: n.netfang })])
          ])
        ])))
      : notendaVilla
        ? el('p', { class: 'ts-villa', texti: 'Náði ekki í viðtakendur (' + notendaVilla + '). Lokaðu glugganum og prófaðu aftur, eða sendu afrit á þig.' })
        : el('p', { class: 'skyring', texti: 'Enginn viðskiptavinur er skráður hjá ' + fyrirtaeki + '. Bættu honum við á stjórnborðinu, eða sendu afrit á þig til að sjá póstinn.' });

    const athugid = [
      'Lesið af ' + (myndir.length === 1 ? '1 skjáskoti' : myndir.length + ' skjáskotum') + '. Gervigreind getur lesið vitlaust, berðu tölurnar saman við myndirnar áður en þú sendir.',
      svar.oljost ? String(svar.oljost) : '',
      svar.synidaemi ? 'Sýnidæmi: þetta eru tilbúnar tölur, ekki lesnar af myndunum.' : ''
    ].filter(Boolean).join(' ');

    fylla(kort, [
      haus('Farðu yfir tölurnar'),
      el('div', { class: 'ts-grind' }, [
        el('div', { class: 'ts-val' }, [
          el('p', { class: 'sk-athugid', texti: athugid }),
          el('ul', { class: 'sk-myndir sk-myndir--litlar' }, myndir.map((m) => el('li', { class: 'sk-mynd' }, [
            el('a', { href: m.slod, target: '_blank', rel: 'noopener', title: 'Opna myndina' }, [el('img', { src: m.slod, alt: m.nafn })])
          ]))),
          ...midlaBlokkir,
          faerslulisti,
          el('div', { class: 'ts-hluti' }, [el('label', { class: 'ts-midi', for: 'sk-merki', texti: 'Merkið efst' }), merkiReitur]),
          el('div', { class: 'ts-hluti' }, [el('label', { class: 'ts-midi', for: 'sk-inngangur', texti: 'Inngangur' }), inngangsReitur]),
          el('div', { class: 'ts-hluti' }, [el('label', { class: 'ts-midi', for: 'sk-ord', texti: 'Orð frá ykkur' }), ordReitur,
            el('p', { class: 'skyring', texti: 'Drög frá gervigreind. Lestu þau yfir og breyttu áður en þú sendir.' })]),
          el('div', { class: 'ts-hluti' }, [el('label', { class: 'ts-midi', for: 'sk-efni', texti: 'Efni póstsins' }), efnisReitur]),
          el('div', { class: 'ts-hluti' }, [el('span', { class: 'ts-midi', texti: 'Til' }), vidtakendur,
            ek && ek.netfang ? el('label', { class: 'ts-afrit' }, [
              el('input', { type: 'checkbox', onchange: (e) => { afrit = e.target.checked; uppfaera(); } }),
              document.createTextNode('Senda afrit á mig (' + ek.netfang + ')')
            ]) : null]),
          villa,
          el('div', { class: 'ts-hnappar' }, [
            el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Til baka', onclick: () => skref1() }),
            sendaHn
          ])
        ]),
        el('div', { class: 'ts-forsyn-svid' }, [el('span', { class: 'ts-midi', texti: 'Svona lítur pósturinn út' }), forsyn])
      ])
    ]);
    uppfaera();

    sendaHn.addEventListener('click', async () => {
      const netfong = [...valdir];
      if (afrit && ek && ek.netfang && !netfong.includes(ek.netfang)) netfong.push(ek.netfang);
      if (!netfong.length || sendir) return;
      sendir = true;
      sendaHn.disabled = true; sendaHn.textContent = 'Sendi…'; villa.hidden = true;
      try {
        const dd = gogn();
        const efni = (efnisReitur.value.trim() || 'Tölfræðin ykkar · ' + fyrirtaeki).replace(/[\r\n]+/g, ' ').slice(0, 200);
        await g.sendaTolfraedi({ fyrirtaeki_id: fid, netfong, efni, html: postHtml(dd), texti: postTexti(dd) });
        const hverjum = nofnValdra().map((n) => n.split(' ')[0]).filter(Boolean);
        fylla(kort, [el('div', { class: 'ts-sent' }, [
          el('span', { class: 'ts-sent__hak', 'aria-hidden': 'true', texti: '✓' }),
          el('h2', { texti: 'Pósturinn er á leiðinni' }),
          el('p', { texti: (hverjum.length ? 'Til ' + hverjum.join(', ') : 'Til ' + netfong.join(', ')) + '. '
            + (g.prufa ? 'Í sýnidæminu fer ekkert út.'
              : snid.erTveir ? 'Hann fer frá tveir@tveir.is.'
                : 'Hann fer í nafni ' + snid.nafn + (stofa && stofa.netfang ? ' og svör berast á ' + stofa.netfang : '') + '.') }),
          el('button', { type: 'button', class: 'btn', texti: 'Loka', onclick: () => d.close() })
        ])]);
      } catch (e) {
        sendir = false;
        villa.textContent = e.message || 'Pósturinn fór ekki. Reyndu aftur.'; villa.hidden = false;
        uppfaera();
      }
    });
  }

  skref1();
}
