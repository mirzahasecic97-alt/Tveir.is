/* ==========================================================================
   Stillingar: aðgangurinn, undirskriftin og tengingarnar á einum stað.
   Viðskiptavinur sér bara aðganginn sinn.
   ========================================================================== */

import { gogn, el, fylla, vardaHlid, teiknaHaus, opnaLykilord, sersnid, stofuNafn, gestNafn, tungumal, setjaTungumal, gjaldmidill, setjaGjaldmidil, gengid, virkurGjaldmidill, erEnska } from './portal.js';
import { lesaUndirskrift, sjalfgefinUndirskrift, undirskriftHtml, opnaUndirskriftGlugga } from './undirskrift.js';

/* Sýnidæmi úr Settu saman: enginn prufuaðgangur sýndur, engin tæknimál.
   Venjulega kerfið (án sersnid) er óbreytt. */
const SYNID = !!sersnid;
const EINFALT = 'Tveir setur tenginguna upp með þér.';
/* Í sýnidæminu kemur einföld skýring í stað skrefanna með lyklum */
const synidSpjald = (t, tharf) => (SYNID ? { ...t, veita: null, tharf: tharf || EINFALT } : t);
/* Nánari leiðbeiningar fyrir hverja tengingu, skref fyrir skref */
const LEIDBEININGAR = 'https://tveir.is/glerhusid/leidbeiningar.html';

const ek = await vardaHlid({ badir: true });
if (ek) start();

/* Tengingar með API lykli. reitir: leynt: false fer í stillingar (sést aftur), annað í Vault.
   Allar fimm eru í smíðum: lykillinn er vistaður og prófaður, en ekkert í kerfinu
   notar hann ennþá. kemur: hvað vantar, sagt beint á spjaldinu. */
const LYKLAR = {
  payday: { veita: 'payday', lb: 'payday', heiti: 'Payday', merki: 'payday.png', litur: '#52bb62', fyllt: true,
    hvad: 'Lokin verk og samningar verða að reikningum', opna: ['Opna Payday', 'https://app.payday.is'],
    kemur: 'Reikningar fara ekki í Payday ennþá.',
    skref: ['Skráðu þig inn á app.payday.is hjá fyrirtækinu sem gefur út reikningana.', 'Opnaðu stillingar fyrirtækisins og finndu API.', 'Búðu til nýtt forrit og kallaðu það Glerhúsið.', 'Afritaðu Client ID og Client Secret og límdu þá hér fyrir neðan.'],
    reitir: [{ nafn: 'clientId', heiti: 'Client ID' }, { nafn: 'clientSecret', heiti: 'Client Secret' }] },
  dk: { veita: 'dk', lb: 'dk', heiti: 'DK', merki: 'dk.png', litur: '#4743f7',
    hvad: 'Lokin verk og samningar verða að reikningum', opna: ['Opna dkPlus', 'https://dkplus.is'],
    kemur: 'Reikningar fara ekki í DK ennþá.',
    skref: ['Skráðu þig inn á dkPlus með aðgangi fyrirtækisins.', 'Opnaðu stillingar notandans og veldu Auðkenningar tákn.', 'Búðu til nýjan token, kallaðu hann Glerhúsið og veldu fyrirtækið. Tokeninn hefur sama aðgang og notandinn, svo notandinn þarf aðgang að viðskiptamönnum og sölu.', 'Límdu tokeninn hér fyrir neðan.'],
    athugid: 'Er fyrirtækið ekki með dkPlus API (vefþjónustu dkPlus)? Hafðu samband við dk hugbúnað og biddu um aðgang. dk segir þér hvað hann kostar. Finnurðu ekki Auðkenningar tákn er aðgangurinn líklega ekki kominn.',
    reitir: [{ nafn: 'token', heiti: 'API token' }] },
  shopify: { veita: 'shopify', lb: 'shopify', heiti: 'Shopify', merki: 'shopify.svg', litur: '#5E8E3E',
    hvad: 'Lagerstaða og pantanir úr vefversluninni', opna: ['Opna Shopify Dev Dashboard', 'https://dev.shopify.com/dashboard'],
    kemur: 'Pantanir og lagerstaða birtast ekki í kerfinu ennþá.',
    skref: ['Í stjórnborði verslunarinnar (admin.shopify.com): Settings, Apps, Develop apps og svo Build apps in Dev Dashboard. Þá lendir appið hjá sömu verslun og það á að tengjast.', 'Í Dev Dashboard: smelltu á Create app, veldu Start from Dev Dashboard, kallaðu appið Glerhúsið og smelltu á Create.', 'Í Versions: láttu App URL vera eins og það er, settu read_products, read_inventory og read_orders í Scopes og smelltu á Release.', 'Á spjaldinu Installs: smelltu á Install app, veldu verslunina, smelltu á Install og samþykktu aðganginn.', 'Opnaðu Settings í appinu, afritaðu Client ID og Client secret af spjaldinu Credentials og límdu hér, ásamt slóð verslunarinnar.'],
    athugid: 'Sérðu ekki Develop apps eða Create app? Eigandi verslunarinnar þarf að gefa þér heimild til að búa til öpp (App developer). Slóðin admin.shopify.com/store/NAFN þýðir að verslunin er NAFN.myshopify.com. Lykill sem byrjar á shpat_ er gamla gerðin af appi og virkar ekki hér.',
    reitir: [{ nafn: 'verslun', heiti: 'Slóð verslunarinnar', daemi: 'nafn.myshopify.com', leynt: false }, { nafn: 'clientId', heiti: 'Client ID' }, { nafn: 'clientSecret', heiti: 'Client secret' }] },
  claude: { veita: 'claude', lb: 'claude', heiti: 'Claude', merki: 'claude.svg', litur: '#D97757',
    hvad: 'Gervigreind sem skrifar drög að svörum og samantektum', opna: ['Opna Claude Console', 'https://platform.claude.com/settings/keys'],
    kemur: 'Drög að svörum og samantektir eru ekki tilbúin ennþá.',
    skref: ['Skráðu þig inn á Claude Console (platform.claude.com).', 'Keyptu inneign undir Billing. Hver notkun kostar smá.', 'Viltu hámark á mánuði: opnaðu Limits í stillingunum og settu það þar.', 'Farðu í API keys, smelltu á Create key og kallaðu hann Glerhúsið.', 'Afritaðu lykilinn strax (hann sést bara einu sinni) og límdu hér.'],
    athugid: 'Claude áskrift (Pro eða Max) gefur ekki API lykil. API notkun er rukkuð sér hjá Anthropic.',
    reitir: [{ nafn: 'lykill', heiti: 'API lykill', daemi: 'sk-ant-...' }] },
  chatgpt: { veita: 'chatgpt', lb: 'chatgpt', heiti: 'ChatGPT', merki: 'openai.svg', litur: '#000000',
    hvad: 'Gervigreind sem skrifar drög að svörum og samantektum', opna: ['Opna OpenAI Platform', 'https://platform.openai.com/api-keys'],
    kemur: 'Drög að svörum og samantektir eru ekki tilbúin ennþá.',
    skref: ['Skráðu þig inn á OpenAI Platform (platform.openai.com).', 'Settu inn greiðslukort og inneign undir Billing. Hver notkun kostar smá.', 'Settu mánaðarhámark undir Limits.', 'Farðu í API keys, smelltu á Create new secret key og kallaðu hann Glerhúsið.', 'Afritaðu lykilinn strax (hann sést bara einu sinni) og límdu hér.'],
    athugid: 'ChatGPT Plus áskrift gefur ekki API lykil. API notkun er rukkuð sér hjá OpenAI.',
    reitir: [{ nafn: 'lykill', heiti: 'API lykill', daemi: 'sk-...' }] }
};

/* Slóð Shopify verslunar á forminu nafn.myshopify.com. Tekur líka við slóðinni
   úr vafranum (admin.shopify.com/store/nafn) og nafninu einu. */
function verslunarSlod(v) {
  const x = String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '');
  const admin = /^admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/.exec(x);
  if (admin) return admin[1] + '.myshopify.com';
  const hrein = x.replace(/[/?#].*$/, '');
  return /^[a-z0-9][a-z0-9-]*$/.test(hrein) ? hrein + '.myshopify.com' : hrein;
}

const MAN = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
const pad = (n) => String(n).padStart(2, '0');
const hvenaer = (s) => { const d = new Date(s); return d.getDate() + '. ' + MAN[d.getMonth()] + ' kl. ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };

async function start() {
  const g = await gogn();
  const admin = ek.hlutverk === 'admin';
  let sidastaStada = null;
  teiknaHaus(ek, 'Stillingar');
  const innihald = document.getElementById('innihald');

  const kafli = (titill, lysing, born) => el('section', { class: 'card pblokk st-kafli' }, [
    el('div', { class: 'st-kafli__haus' }, [el('h2', { texti: titill }), lysing ? el('p', { class: 'skyring', texti: lysing }) : null]),
    ...born
  ]);

  /* ---------- Aðgangurinn ---------- */
  /* Í sýnidæmi: nafnið úr Settu saman í stað prufuaðgangsins */
  const ekSynt = SYNID ? { ...ek, nafn: gestNafn() || stofuNafn(), netfang: '' } : ek;
  const adgangur = kafli('Aðgangurinn þinn', null, [
    el('dl', { class: 'st-upplysingar' }, [
      el('div', {}, [el('dt', { texti: 'Nafn' }), el('dd', { texti: ekSynt.nafn || '' })]),
      el('div', {}, [el('dt', { texti: 'Netfang' }), el('dd', { texti: SYNID ? 'Sýnidæmi' : ek.netfang || '' })]),
      el('div', {}, [el('dt', { texti: 'Hlutverk' }), el('dd', { texti: admin ? 'Stjórnandi' : 'Viðskiptavinur' + (ek.fyrirtaeki ? ' hjá ' + ek.fyrirtaeki.nafn : '') })])
    ]),
    SYNID
      ? el('div', { class: 'st-hnappar' }, [
          el('a', { class: 'btn btn--ghost', href: 'https://tveir.is/glerhusid/index.html', texti: 'Loka sýnidæmi' })
        ])
      : el('div', { class: 'st-hnappar' }, [
          el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Breyta lykilorði',
            onclick: () => opnaLykilord({ heiti: 'Breyta lykilorði', netfang: ek.netfang }) }),
          el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Skrá út',
            onclick: async () => { await g.utskra(); location.replace('./'); } })
        ])
  ]);

  /* ---------- Tungumál og gjaldmiðill ---------- */
  /* Tungumálið fylgir vafranum, gjaldmiðillinn gildir fyrir allt kerfið */
  const tungaVal = el('select', { class: 'st-val', 'aria-label': 'Tungumál' }, [
    el('option', { value: 'is', texti: 'Íslenska', 'data-ekki-thyda': '' }), el('option', { value: 'en', texti: 'English', 'data-ekki-thyda': '' })]);
  tungaVal.value = tungumal();
  tungaVal.addEventListener('change', () => { setjaTungumal(tungaVal.value); location.reload(); });
  const gjaldVal = el('select', { class: 'st-val', 'aria-label': 'Gjaldmiðill' }, [
    el('option', { value: 'ISK', texti: 'Íslenskar krónur (ISK)' }), el('option', { value: 'EUR', texti: 'Evrur (EUR)' }), el('option', { value: 'USD', texti: 'Dollarar (USD)' })]);
  gjaldVal.value = gjaldmidill();
  const gjaldSvar = el('p', { class: 'skyring st-val__svar', role: 'status' });
  gjaldVal.addEventListener('change', async () => {
    const fyrra = gjaldmidill();
    gjaldVal.disabled = true; gjaldSvar.textContent = 'Vistar';
    try {
      await g.vistaKerfisstillingu('gjaldmidill', gjaldVal.value);
      setjaGjaldmidil(gjaldVal.value); location.reload();
    } catch (e) {
      gjaldVal.value = fyrra; gjaldVal.disabled = false; gjaldSvar.textContent = e.message || 'Tókst ekki að vista';
    }
  });
  const synid = el('div', { class: 'st-val__lina' }, [
    el('label', { class: 'st-val__reitur' }, [el('span', { texti: 'Tungumál' }), tungaVal]),
    admin ? el('label', { class: 'st-val__reitur' }, [el('span', { texti: 'Gjaldmiðill í bókhaldi' }), gjaldVal]) : null
  ]);
  /* Gengið sem upphæðirnar eru umreiknaðar á */
  const gg = gengid(), vg = virkurGjaldmidill();
  const kommu = (n) => (erEnska() ? String(n) : String(n).replace('.', ','));
  const gengiLina = !admin || gjaldmidill() === 'ISK' ? null
    : vg === 'ISK'
      ? el('p', { class: 'skyring', texti: 'Gengið náðist ekki, svo upphæðir eru sýndar í krónum þar til það næst.' })
      : el('p', { class: 'skyring' }, [
          document.createTextNode('Gengi'),
          document.createTextNode(': 1 ' + (vg === 'EUR' ? '€' : '$') + ' = ' + kommu(Math.round(1 / gg[vg] * 100) / 100) + (erEnska() ? ' ISK' : ' kr.')),
          gg.dags ? document.createTextNode(' (' + gg.dags.split('-').reverse().join('.') + ')') : null,
          document.createTextNode('. '),
          document.createTextNode('Viðmiðunargengi Seðlabanka Evrópu, uppfært daglega.')]);
  const synKafli = kafli('Tungumál og gjaldmiðill',
    admin ? 'Tungumálið gildir í þessum vafra. Gjaldmiðillinn gildir fyrir allt kerfið. Allar upphæðir eru geymdar í krónum og umreiknaðar á gengi dagsins. Tengingin við Payday og DK er í smíðum. Þegar hún kemur verða reikningar þar í krónum.' : 'Tungumálið gildir í þessum vafra.',
    [synid, gengiLina, admin ? gjaldSvar : null]);

  if (!admin) { fylla(innihald, [siduHaus(), adgangur, synKafli]); return; }

  /* ---------- Undirskriftin ---------- */
  let undirskrift = await lesaUndirskrift(g, ekSynt);
  const usForsyn = el('div', { class: 'sk-undirsk st-undirsk' });
  const teiknaUs = () => { usForsyn.innerHTML = undirskriftHtml({ ...undirskrift, virk: true }) || '<p class="skyring">Engin undirskrift ennþá.</p>'; };
  teiknaUs();
  const undirskriftKafli = kafli('Undirskrift í pósti', 'Fer neðst í póstana sem þú sendir úr Pósthólfinu. Fylgir aðganginum þínum á milli tækja.', [
    usForsyn,
    el('div', { class: 'st-hnappar' }, [
      el('button', { type: 'button', class: 'btn', texti: 'Breyta undirskrift', onclick: async () => {
        const ny = await opnaUndirskriftGlugga({ g, u: undirskrift, sjalfgefin: sjalfgefinUndirskrift(g, ekSynt) });
        if (ny) { undirskrift = ny; teiknaUs(); }
      } })
    ])
  ]);

  /* ---------- Tengingarnar ---------- */
  const tengingarSvid = el('div', { class: 'st-teng-svid' }, [el('p', { class: 'tomt', texti: 'Athuga tengingarnar' })]);
  const tengingarKafli = kafli('Tengingar', 'Öppin sem kerfið talar við. Ýttu á Tengja eða Nánar til að sjá hvað hver tenging gerir og hvað þarf til.', [tengingarSvid]);

  fylla(innihald, [siduHaus(), adgangur, synKafli, undirskriftKafli, tengingarKafli]);
  teiknaTengingar(await stadaTenginga());

  function siduHaus() {
    return el('div', { class: 'page-head', style: 'padding-top:0' }, [
      el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Stillingar' }),
      el('p', { class: 'lead', texti: admin ? 'Aðgangurinn, undirskriftin og öppin sem kerfið er tengt.' : 'Aðgangurinn þinn.' })
    ]);
  }

  /* Staðan sótt úr gögnunum sjálfum, ekki skrifuð inn: breytist þegar tenging kemst á */
  async function stadaTenginga() {
    const s = {};
    /* Gmail: pósthólfið hefur verið samstillt */
    try {
      const thraedir = (g.postholf ? await g.postholf() : []) || [];
      const nyjast = thraedir.reduce((a, t) => (!a || t.sidast > a ? t.sidast : a), null);
      s.gmail = thraedir.length ? ['tengt', thraedir.length + ' þræðir, nýjasti ' + hvenaer(nyjast)] : ['bidur', 'Engir þræðir hafa komið inn ennþá'];
    } catch (e) { s.gmail = ['ekki', 'Pósthólfið er ekki komið upp']; }

    /* Google Calendar: fundir hafa komið inn. dagatal() sækir líka 45 daga aftur,
       svo fjöldinn í textanum telur bara fundi sem eru framundan. */
    try {
      const atb = (g.dagatal ? await g.dagatal() : null);
      const nuna = Date.now();
      const framundan = atb ? atb.filter((a) => new Date(a.byrjar).getTime() >= nuna).length : 0;
      s.dagatal = atb === null ? ['ekki', 'Dagatalið er ekki komið upp']
        : atb.length ? ['tengt', framundan ? framundan + (framundan === 1 ? ' fundur framundan' : ' fundir framundan') : 'Fundir hafa komið inn, enginn framundan']
        : ['bidur', 'Bíður eftir fyrstu samstillingu'];
    } catch (e) { s.dagatal = ['ekki', 'Dagatalið er ekki komið upp']; }

    /* Meta: Instagram og Facebook hvort fyrir sig. Hver miðill með auðkenni telst
       tengdur ef sjálfvirkar tölur hafa komið síðustu 3 daga. */
    try {
      const fyrirtaeki = (await g.fyrirtaeki()) || [];
      const nu = new Date(), fra = new Date(nu.getTime() - 3 * 864e5);
      const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const fj = { instagram: [0, 0], facebook: [0, 0] };
      let tiktok = 0;
      for (const f of fyrirtaeki) {
        const midlar = (await g.midlar(f.id).catch(() => [])) || [];
        const meta = midlar.filter((m) => fj[m.midill] && m.ytra_id && m.virkt !== false);
        tiktok += midlar.filter((m) => m.midill === 'tiktok').length;
        if (!meta.length) continue;
        const ma = (await g.maelingar(f.id, ymd(fra), ymd(nu)).catch(() => [])) || [];
        for (const m of meta) {
          fj[m.midill][0]++;
          if (ma.some((r) => r.uppruni === 'sjalfvirkt' && r.midill_id === m.id)) fj[m.midill][1]++;
        }
      }
      const metaStada = ([n, sj], o) => sj && sj === n ? ['tengt', 'Tölurnar koma sjálfkrafa á hverjum morgni']
        : sj ? ['bidur', sj + ' af ' + n + ' ' + o.thgf + (sj === 1 ? ' fær' : ' fá') + ' tölurnar sjálfkrafa. ' + (n - sj === 1 ? o.hin1 : o.hin) + '.']
        : n ? ['bidur', n + (n === 1 ? ' ' + o.et + ' hefur' : ' ' + o.ft + ' hafa') + ' auðkenni, en engar sjálfvirkar tölur ennþá']
        : ['ekki', o.enginn];
      s.instagram = metaStada(fj.instagram, { et: 'reikningur', ft: 'reikningar', thgf: 'reikningum', hin: 'Hinir bíða', hin1: 'Hinn bíður', enginn: 'Enginn Instagram reikningur með auðkenni' });
      s.facebook = metaStada(fj.facebook, { et: 'síða', ft: 'síður', thgf: 'síðum', hin: 'Hinar bíða', hin1: 'Hin bíður', enginn: 'Engin Facebook síða með auðkenni' });
      s.tiktok = ['handvirkt', tiktok ? tiktok + (tiktok === 1 ? ' TikTok reikningur, tölurnar skráðar í höndunum' : ' TikTok reikningar, tölurnar skráðar í höndunum') : 'Tölurnar eru skráðar í höndunum'];
    } catch (e) {
      s.instagram = s.facebook = ['ekki', 'Náði ekki í miðlana'];
      s.tiktok = ['handvirkt', 'Tölurnar eru skráðar í höndunum'];
    }
    /* API lyklarnir (kafli 28): null ef taflan er ekki komin */
    try { s.lyklar = g.tengingarStada ? await g.tengingarStada() : null; } catch (e) { s.lyklar = null; }
    return s;
  }

  /* Villutexti prófunar. Sumar villur segja að lykillinn sjálfur virki
     ("Tengt við X, en appið vantar aðganginn"): þá ekkert á undan. Aðrar eru
     tímamörk eða sambandsleysi, svo forskeytið segir bara að prófunin tókst ekki. */
  function prufuVilla(svar) {
    const x = String(svar || 'óþekkt villa').trim();
    const texti = /^(Tengt við|Lykillinn virkar en)/i.test(x) ? x : 'Prófunin tókst ekki: ' + x;
    return /[.!?]$/.test(texti) ? texti : texti + '.';
  }

  /* Staða tengingar sem notar API lykil. Allar eru í smíðum, svo spjaldið er
     aldrei Tengt: textinn segir hvernig lykillinn stendur og hvað vantar. */
  function lykilStada(s, t) {
    const smidi = 'Í smíðum. ' + t.kemur;
    const r = s.lyklar ? s.lyklar[t.veita] : null;
    if (!r) return ['kemur', smidi];
    if (r.prufad) return /^ok/i.test(r.prufa_svar || '')
      ? ['kemur', (String(r.prufa_svar).replace(/^ok:?\s*/i, '') || 'Lykillinn virkar') + '. Prófað ' + hvenaer(r.prufad) + '. ' + smidi]
      : ['kemur', prufuVilla(r.prufa_svar) + ' ' + smidi];
    return ['kemur', 'Lykill vistaður (endar á ' + (r.sidustu4 || '????') + ') en ekki prófaður ennþá. ' + smidi];
  }

  function teiknaTengingar(s) {
    sidastaStada = s;
    const POSTUR = g.prufa ? 'pósthólfi stofunnar' : 'tveir@tveir.is';
    const VERK = g.prufa ? 'verk-netfang stofunnar' : 'verk@tveir.is';
    const DEILA = g.prufa ? 'netfangi stofunnar' : 'tveir@tveir.is';
    const STOFA = g.prufa ? stofuNafn() : 'Tveir';
    /* Sama orðalag og á vefnum: Í smíðum */
    const PILLUR = { tengt: 'Tengt', bidur: 'Bíður', ekki: 'Ekki tengt', handvirkt: 'Handvirkt', kemur: 'Í smíðum' };
    const SMIDI_TVEIR = 'Í smíðum. Þegar þetta er tilbúið setur Tveir tenginguna upp með þér.';
    const KEMUR = ['kemur', ''];
    const EKKI = ['ekki', ''];
    /* Tengingar með lykli: alltaf Í smíðum. Í alvöru aðgangi má samt vista og prófa lykilinn. */
    const lykilSpjald = (t) => (SYNID
      ? synidSpjald({ ...t, stada: ['kemur', 'Í smíðum. ' + t.kemur], smidum: true }, SMIDI_TVEIR)
      : { ...t, stada: lykilStada(s, t), smidum: true });
    /* merki: skrá í assets/tengingar. litur: bakgrunnur flísarinnar. ljos: merkið er í lit á hvítu, annars hvítt á lit.
       utan: telst ekki með í "X af Y tengt". pilla: '' þýðir engin pilla. */
    const HOPAR = [
      ['Póstur og dagatal', [
        { heiti: 'Gmail', lb: 'gmail', merki: 'gmail.svg', litur: '#EA4335', hvad: 'Pósthólfið á Samskiptum og póstar úr kerfinu', stada: s.gmail, slod: 'samskipti.html',
          tharf: SYNID ? EINFALT + ' Pósturinn uppfærist á 5 mínútna fresti.' : 'Pósturinn er sóttur með Apps Script skrift á ' + POSTUR + ', á 5 mínútna fresti.' },
        /* Engin staða til í gögnunum fyrir verk-netfangið, svo spjaldið segir hvernig það virkar en ekki hvort það sé tengt */
        { heiti: 'Verk-netfangið', lb: 'gmail', stafur: '@', litur: '#1c3050', hvad: 'Póstur á ' + VERK + ' verður að verkum', utan: true, pilla: '',
          stada: ['handvirkt', g.prufa ? 'Sýnidæmi' : 'Póstur frá skráðum notanda verður að verki innan 5 mínútna'],
          dTexti: 'Hér þarf enga tengingu. Verk sem koma með pósti birtast á Stjórnborðinu.',
          tharf: 'Viðskiptavinur sendir póst á ' + VERK + ', eða setur ' + VERK + ' í CC, frá netfanginu sem er skráð á notanda hjá fyrirtækinu. Verkið birtist á Stjórnborðinu innan 5 mínútna. Póstur frá öðru netfangi verður ekki að verki, og sjálfvirk áframsending virkar ekki.' },
        { heiti: 'Google Calendar', lb: 'googlecalendar', merki: 'googlecalendar.svg', litur: '#4285F4', hvad: 'Fundirnir þínir á Dagatalinu, við hlið skiladaga', stada: s.dagatal, slod: 'dagatal.html',
          tharf: SYNID ? EINFALT + ' Dagatalið uppfærist á 5 mínútna fresti.'
            : 'Deildu dagatalinu þínu með ' + DEILA + '. Í Google Calendar í tölvu: Settings and sharing við dagatalið, Shared with vinstra megin og svo Add people and groups. Bættu ' + DEILA + ' við, veldu See event details (sums staðar See all event details) og smelltu á Send. '
              + 'Láttu ' + STOFA + ' vita. ' + STOFA + ' samþykkir deilinguna og eftir það koma fundirnir inn á 5 mínútna fresti. Á vinnuaðgangi gæti Google stjórnandinn þurft að leyfa deilingu út fyrir fyrirtækið fyrst.' }
      ]],
      ['Samfélagsmiðlar', [
        { heiti: 'Instagram', lb: 'instagram', merki: 'instagram.svg', litur: '#E4405F', hvad: 'Fylgjendur, áhorf og færslur á Tölfræði', stada: s.instagram, slod: 'tolfraedi.html',
          tharf: SYNID ? EINFALT + ' Þú gefur okkur aðgang að efni og tölfræði Instagram reikningsins.'
            : 'Þarf Meta app og System User token (META_TOKEN) í Apps Script, og auðkenni reikningsins á Tölfræði. Reikningnum er deilt með Business ID ' + STOFA + ' sem samstarfsaðila (Partners), með aðgangi að bæði efni (Content) og tölfræði (Insights).' },
        { heiti: 'Facebook', lb: 'facebook', merki: 'facebook.svg', litur: '#0866FF', hvad: 'Áhorf og fylgjendur síðunnar á Tölfræði', stada: s.facebook, slod: 'tolfraedi.html',
          tharf: SYNID ? EINFALT + ' Þú gefur okkur aðgang að efni og tölfræði Facebook síðunnar.'
            : 'Sama Meta app og Instagram. Page ID síðunnar fer á Tölfræði. Síðunni er deilt með Business ID ' + STOFA + ' sem samstarfsaðila (Partners), með aðgangi að bæði efni (Content) og tölfræði (Insights). Tölfræðin ein dugar ekki.' },
        { heiti: 'TikTok', lb: 'tiktok', merki: 'tiktok.svg', litur: '#000000', hvad: 'Tölur á Tölfræði', stada: s.tiktok, slod: 'tolfraedi.html#tiktok', utan: true,
          tharf: SYNID ? 'Sjálfvirk söfnun frá TikTok er ekki komin í Glerhúsið ennþá. Tölurnar eru skráðar í höndunum.' : 'Sjálfvirk söfnun frá TikTok er ekki komin í Glerhúsið ennþá. Tölurnar eru skráðar í höndunum á Tölfræði eða fluttar inn úr CSV.' },
        { heiti: 'Messenger', merki: 'messenger.svg', litur: '#00B2FF', hvad: 'Skilaboð inn í Samskipti', stada: KEMUR, smidum: true,
          tharf: SYNID ? 'Í smíðum. Skilaboðin koma ekki inn í Samskipti ennþá. ' + EINFALT : 'Í smíðum. Skilaboðin koma ekki inn í Samskipti ennþá. Þetta þarf Meta appið og leyfi Meta fyrir skilaboðum (App Review).' },
        { heiti: 'Instagram skilaboð', merki: 'instagram.svg', litur: '#C13584', hvad: 'DM inn í Samskipti', stada: KEMUR, smidum: true,
          tharf: SYNID ? 'Í smíðum. Skilaboðin koma ekki inn í Samskipti ennþá. ' + EINFALT : 'Í smíðum. Þetta þarf sama Meta app og leyfi og Messenger.' }
      ]],
      ['Bókhald', [lykilSpjald(LYKLAR.payday), lykilSpjald(LYKLAR.dk)]],
      ['Verslun', [lykilSpjald(LYKLAR.shopify)]],
      ['Gervigreind', [lykilSpjald(LYKLAR.claude), lykilSpjald(LYKLAR.chatgpt)]],
      ['Vefur og skrár', [
        { heiti: 'Google Analytics', lb: 'googleanalytics', merki: 'googleanalytics.svg', litur: '#E37400', hvad: 'Heimsóknir á vef viðskiptavinarins á Tölfræði', smidum: true,
          stada: ['kemur', 'Í smíðum. Engar tölur úr Google Analytics birtast ennþá.'],
          tharf: SYNID ? SMIDI_TVEIR : 'Í smíðum. Engar tölur úr Google Analytics birtast ennþá, svo ekki þarf að gefa neinn aðgang strax.' },
        { heiti: 'WeTransfer', lb: 'wetransfer', merki: 'wetransfer.svg', litur: '#409FFF', hvad: 'Hlekkir á undirverkum', utan: true, pilla: 'Engin uppsetning',
          stada: ['handvirkt', 'Hlekkir virka beint á undirverkum'], dTexti: 'Hér þarf enga tengingu.',
          tharf: 'Engin tenging þarf: límdu WeTransfer hlekkinn á undirverkið og viðskiptavinurinn fær hann í pósti.' }
      ]]
    ];

    const takn = (t) => el('span', { class: 'st-teng__takn' + (t.ljos ? ' er-ljos' : '') + (t.fyllt ? ' er-fyllt' : ''), style: 'background:' + t.litur, 'aria-hidden': 'true' },
      [t.merki ? el('img', { src: 'assets/tengingar/' + t.merki, alt: '', loading: 'lazy' }) : document.createTextNode(t.stafur || t.heiti[0])]);

    /* Bara tengingar sem geta verið tengdar núna teljast með. Í smíðum, handvirkt og
       engin uppsetning standa utan við. */
    const oll = HOPAR.flatMap(([, l]) => l);
    const telst = oll.filter((t) => !t.smidum && !t.utan);
    const tengd = telst.filter((t) => (t.stada || [])[0] === 'tengt').length;
    const smidi = oll.filter((t) => t.smidum).length;
    fylla(tengingarSvid, [
      el('p', { class: 'st-teng-yfirlit', texti: tengd + ' af ' + telst.length + ' tengt' + (smidi ? ', ' + smidi + ' í smíðum' : '') }),
      ...HOPAR.map(([heiti, listi]) => el('div', { class: 'st-teng-hopur' }, [
        el('h3', { texti: heiti }),
        el('div', { class: 'st-tengingar' }, listi.map((t) => {
          const [stada, undir] = t.stada || EKKI;
          const pilla = t.pilla === '' ? null : t.pilla || PILLUR[stada];
          /* Tengja bara þar sem eitthvað er hægt að tengja núna, annars Nánar */
          const tengja = !t.smidum && !t.utan && (stada === 'ekki' || stada === 'bidur');
          return el('article', { class: 'st-teng st-teng--' + stada }, [
            el('div', { class: 'st-teng__efst' }, [
              takn(t),
              el('div', { class: 'st-teng__nafn' }, [el('strong', { texti: t.heiti }), el('span', { texti: t.hvad })]),
              pilla ? el('span', { class: 'st-pilla st-pilla--' + stada, texti: pilla }) : null
            ]),
            undir ? el('p', { class: 'st-teng__stada', texti: undir }) : null,
            el('div', { class: 'st-teng__fot' }, [
              stada === 'tengt' && t.slod
                ? el('a', { class: 'btn btn--sm btn--ghost', href: t.slod, texti: 'Opna' })
                : el('button', { type: 'button', class: 'btn btn--sm' + (tengja ? '' : ' btn--ghost'), texti: tengja ? 'Tengja' : 'Nánar',
                    onclick: () => opnaTengingu(t, stada, takn) })
            ])
          ]);
        }))
      ]))
    ]);
  }

  /* Tengja: hvað tengingin gerir, staðan og hvað þarf til */
  function opnaTengingu(t, stada, takn) {
    const kort = el('div', { class: 'pdialog__kort' });
    const d = el('dialog', { class: 'pdialog', 'aria-labelledby': 'st-t-h' }, [kort]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    const TEXTI = {
      tengt: 'Þetta er tengt og virkar.',
      bidur: 'Tengingin er hálfnuð og bíður eftir einu skrefi.',
      handvirkt: 'Hér eru tölurnar skráðar í höndunum.',
      ekki: 'Þetta er ekki tengt ennþá.',
      kemur: 'Þessi tenging er á listanum og kemur seinna.'
    };
    fylla(kort, [
      el('div', { class: 'pdialog__haus' }, [
        el('div', { class: 'st-t__haus' }, [takn(t), el('h2', { id: 'st-t-h', texti: t.heiti })]),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
      ]),
      el('p', { class: 'st-t__hvad', texti: t.hvad + '.' }),
      el('p', { class: 'st-t__stada st-t__stada--' + stada, texti: t.dTexti || (t.smidum
        ? (t.veita ? 'Þetta er í smíðum. ' + t.kemur + ' Þú getur samt vistað lykilinn og prófað hann núna.' : 'Þetta er í smíðum og ekki tilbúið ennþá.')
        : TEXTI[stada] || '') }),
      t.veita ? lykilForm(t, stada, d) : el('div', { class: 'st-t__tharf' }, [el('strong', { texti: 'Hvað þarf til' }), el('p', { texti: t.tharf }),
        t.lb ? el('a', { class: 'st-t__lb', href: LEIDBEININGAR + '#' + t.lb, target: '_blank', rel: 'noopener', texti: 'Nánari leiðbeiningar' }) : null]),
      t.veita ? null : el('div', { class: 'spjald__fot' }, [
        t.slod ? el('a', { class: 'btn', href: t.slod, texti: 'Opna' }) : null,
        el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Loka', onclick: () => d.close() })
      ])
    ]);
    document.body.append(d);
    d.showModal();
  }

  /* Leiðbeiningar skref fyrir skref, reitirnir og Vista. Lykillinn fer beint
     í gagnagrunninn og er aldrei sýndur aftur. */
  function lykilForm(t, stada, d) {
    let r = (sidastaStada && sidastaStada.lyklar && sidastaStada.lyklar[t.veita]) || null;
    const villa = el('p', { class: 'villa', role: 'alert', hidden: true });
    const tokst = el('p', { class: 'st-t__tokst', role: 'status', hidden: true });
    const syna = (ok, texti) => { villa.hidden = tokst.hidden = true; const x = ok ? tokst : villa; x.textContent = texti; x.hidden = false; };
    const fleiri = (t.reitir || []).filter((f) => f.leynt !== false).length > 1;
    /* Prófar lykilinn strax hjá veitunni. Tekst það: glugginn lokast og spjaldið
       segir að lykillinn virki en tengingin sé í smíðum. Tekst það ekki: glugginn
       helst opinn með skýringunni, Prófa aftur og Aftengja. */
    async function profa(hnappur, venjulegt) {
      hnappur.disabled = true; hnappur.textContent = 'Prófa lykilinn';
      let n;
      try { n = await g.profaTengingu(t.veita); }
      catch (er) { n = { ok: false, svar: er.message || 'Ekki tókst að prófa.' }; }
      teiknaTengingar(await stadaTenginga());
      r = (sidastaStada && sidastaStada.lyklar && sidastaStada.lyklar[t.veita]) || r;
      synaStjorn();
      hnappur.disabled = false; hnappur.textContent = venjulegt;
      if (n && n.ok) {
        const svar = String(n.svar || '').replace(/\.$/, '');
        const virkar = g.prufa ? '' : (fleiri ? 'Lyklarnir virka' : 'Lykillinn virkar') + ' og ' + (fleiri ? 'eru vistaðir' : 'er vistaður') + ', en tengingin sjálf er í smíðum. ';
        syna(true, (svar ? svar + '. ' : '') + (g.prufa ? 'Tengingin sjálf er í smíðum. ' : virkar) + t.kemur);
        setTimeout(() => { if (d.open) d.close(); }, 3500);
      } else syna(false, (n && n.svar) || 'Lykillinn virkar ekki.');
      return n;
    }
    const reitir = (t.reitir || []).map((f) => {
      const inn = el('input', { type: f.leynt === false ? 'text' : 'password', name: f.nafn, autocomplete: 'off', spellcheck: 'false',
        autocapitalize: 'off', placeholder: f.daemi || '', value: f.leynt === false && r && r.stillingar ? (r.stillingar[f.nafn] || '') : '' });
      const vistad = f.leynt !== false ? el('small', { texti: 'Vistað. Skildu eftir autt til að halda núverandi lykli.' }) : null;
      return { f, inn, vistad, svid: el('label', { class: 'st-t__reitur' }, [el('span', { texti: f.heiti }), inn, r ? vistad : null]) };
    });
    const vistaTexti = () => (r ? 'Vista breytingar' : 'Vista og tengja');
    const vista = el('button', { type: 'submit', class: 'btn', texti: vistaTexti() });
    const aftur = el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Prófa aftur', onclick: () => profa(aftur, 'Prófa aftur') });
    const aftengja = el('button', { type: 'button', class: 'btn btn--ghost btn--danger', texti: 'Aftengja', onclick: async () => {
      if (!confirm('Aftengja ' + t.heiti + '? Lykillinn er þurrkaður út.')) return;
      try { await g.eydaTengingu(t.veita); d.close(); teiknaTengingar(await stadaTenginga()); }
      catch (er) { syna(false, er.message || 'Ekki tókst að aftengja.'); }
    } });
    const fot = el('div', { class: 'spjald__fot' }, [
      vista,
      t.opna ? el('a', { class: 'btn btn--ghost', href: t.opna[1], target: '_blank', rel: 'noopener', texti: t.opna[0] }) : null
    ]);
    /* Prófa aftur og Aftengja birtast um leið og lykill er vistaður, líka ef
       fyrsta prófunin mistókst og glugginn er enn opinn */
    function synaStjorn() {
      if (!r) return;
      if (!aftur.isConnected) vista.after(aftur);
      if (!aftengja.isConnected) fot.append(aftengja);
      reitir.forEach(({ inn, vistad }) => { if (vistad && !vistad.isConnected) inn.after(vistad); });
    }
    synaStjorn();
    const form = el('form', { class: 'st-t__form', onsubmit: async (e) => {
      e.preventDefault(); villa.hidden = tokst.hidden = true;
      const stillingar = { ...(t.fastar || {}) }, leyndo = {};
      for (const { f, inn } of reitir) {
        const v = inn.value.trim();
        if (f.leynt === false) {
          const hreint = f.nafn === 'verslun' ? verslunarSlod(v) : v.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          stillingar[f.nafn] = hreint; inn.value = hreint;
        } else if (v) leyndo[f.nafn] = v;
      }
      const leyndirReitir = reitir.filter(({ f }) => f.leynt !== false);
      if (Object.keys(leyndo).length && Object.keys(leyndo).length < leyndirReitir.length) { villa.textContent = 'Fylltu út alla lyklareitina.'; villa.hidden = false; return; }
      vista.disabled = true; vista.textContent = 'Vista';
      try {
        await g.vistaTengingu(t.veita, stillingar, Object.keys(leyndo).length ? leyndo : null);
        reitir.forEach(({ inn }) => { if (inn.type === 'password') inn.value = ''; });
      } catch (er) {
        syna(false, er.message || 'Ekki tókst að vista.');
        vista.disabled = false; vista.textContent = vistaTexti();
        return;
      }
      r = r || { veita: t.veita };
      synaStjorn();
      await profa(vista, 'Vista breytingar');
    } }, [
      ...reitir.map((x) => x.svid),
      villa,
      tokst,
      fot
    ]);
    return el('div', { class: 'st-t__lykill' }, [
      el('div', { class: 'st-t__tharf' }, [el('strong', { texti: 'Svona tengirðu' }),
        el('ol', { class: 'st-t__skref' }, t.skref.map((x) => el('li', { texti: x })))]),
      t.athugid ? el('p', { class: 'skyring', texti: t.athugid }) : null,
      t.lb ? el('a', { class: 'st-t__lb', href: LEIDBEININGAR + '#' + t.lb, target: '_blank', rel: 'noopener', texti: 'Nánari leiðbeiningar og algeng vandamál' }) : null,
      form,
      el('p', { class: 'skyring st-t__oruggt', texti: 'Lykillinn er prófaður um leið og þú vistar. Hann er geymdur dulkóðaður og sést aldrei aftur á þessari síðu, ekki heldur hjá þér.' })
    ]);
  }
}
