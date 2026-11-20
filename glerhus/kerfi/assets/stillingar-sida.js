/* ==========================================================================
   Stillingar: aðgangurinn, undirskriftin og tengingarnar á einum stað.
   Viðskiptavinur sér bara aðganginn sinn.
   ========================================================================== */

import { gogn, el, fylla, vardaHlid, teiknaHaus, opnaLykilord, sersnid, stofuNafn, gestNafn } from './portal.js';
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

/* Tengingar með API lykli. reitir: leynt: false fer í stillingar (sést aftur), annað í Vault. */
const LYKLAR = {
  payday: { veita: 'payday', lb: 'payday', heiti: 'Payday', merki: 'payday.png', litur: '#52bb62', fyllt: true,
    hvad: 'Lokin verk og samningar verða að reikningum', opna: ['Opna Payday', 'https://app.payday.is'],
    skref: ['Skráðu þig inn á Payday.', 'Farðu í Stillingar og opnaðu API (undir fyrirtækinu).', 'Búðu til nýtt forrit og kallaðu það Glerhúsið.', 'Afritaðu Client ID og Client Secret og límdu þá hér fyrir neðan.'],
    reitir: [{ nafn: 'clientId', heiti: 'Client ID' }, { nafn: 'clientSecret', heiti: 'Client Secret' }] },
  dk: { veita: 'dk', lb: 'dk', heiti: 'DK', merki: 'dk.png', litur: '#4743f7',
    hvad: 'Lokin verk og samningar verða að reikningum', opna: ['Opna dkPlus', 'https://dkplus.is'],
    skref: ['Skráðu þig inn á dkPlus með aðgangi fyrirtækisins.', 'Búðu til API token (aðgangslykil) fyrir Glerhúsið í stillingunum.', 'Gefðu honum aðgang að viðskiptavinum og sölureikningum.', 'Límdu tokeninn hér fyrir neðan.'],
    athugid: 'Finnurðu ekki API token í dkPlus? Biddu dk hugbúnað um aðgang að dkPlus API fyrir fyrirtækið.',
    reitir: [{ nafn: 'token', heiti: 'API token' }] },
  shopify: { veita: 'shopify', lb: 'shopify', heiti: 'Shopify', merki: 'shopify.svg', litur: '#5E8E3E',
    hvad: 'Lagerstaða og pantanir úr vefversluninni', opna: ['Opna Shopify Dev Dashboard', 'https://dev.shopify.com/dashboard'],
    skref: ['Opnaðu Shopify Dev Dashboard með sama aðgangi og verslunin.', 'Smelltu á Create app og kallaðu það Glerhúsið.', 'Veldu aðganginn read_products, read_inventory og read_orders og settu appið upp á versluninni.', 'Afritaðu Client ID og Client secret úr stillingum appsins og límdu hér, ásamt slóð verslunarinnar.'],
    reitir: [{ nafn: 'verslun', heiti: 'Slóð verslunarinnar', daemi: 'nafn.myshopify.com', leynt: false }, { nafn: 'clientId', heiti: 'Client ID' }, { nafn: 'clientSecret', heiti: 'Client secret' }] },
  claude: { veita: 'claude', lb: 'claude', heiti: 'Claude', merki: 'claude.svg', litur: '#D97757',
    hvad: 'Gervigreind sem skrifar drög að svörum og samantektir', opna: ['Opna Claude Console', 'https://platform.claude.com/settings/keys'],
    skref: ['Skráðu þig inn á Claude Console (platform.claude.com).', 'Keyptu inneign undir Billing og settu hámark. Hver notkun kostar smá.', 'Farðu í API Keys, smelltu á Create Key og kallaðu hann Glerhúsið.', 'Afritaðu lykilinn strax (hann sést bara einu sinni) og límdu hér.'],
    athugid: 'Claude áskrift (Pro eða Max) gefur ekki API lykil. API notkun er rukkuð sér hjá Anthropic.',
    reitir: [{ nafn: 'lykill', heiti: 'API lykill', daemi: 'sk-ant-...' }] },
  chatgpt: { veita: 'chatgpt', lb: 'chatgpt', heiti: 'ChatGPT', merki: 'openai.svg', litur: '#000000',
    hvad: 'Gervigreind sem skrifar drög að svörum og samantektir', opna: ['Opna OpenAI Platform', 'https://platform.openai.com/api-keys'],
    skref: ['Skráðu þig inn á OpenAI Platform (platform.openai.com).', 'Settu upp greiðslu og mánaðarhámark undir Billing. Hver notkun kostar smá.', 'Farðu í API keys, smelltu á Create new secret key og kallaðu hann Glerhúsið.', 'Afritaðu lykilinn strax (hann sést bara einu sinni) og límdu hér.'],
    athugid: 'ChatGPT Plus áskrift gefur ekki API lykil. API notkun er rukkuð sér hjá OpenAI.',
    reitir: [{ nafn: 'lykill', heiti: 'API lykill', daemi: 'sk-...' }] }
};

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
          el('a', { class: 'btn btn--ghost', href: '../index.html', texti: 'Loka sýnidæmi' })
        ])
      : el('div', { class: 'st-hnappar' }, [
          el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Breyta lykilorði',
            onclick: () => opnaLykilord({ heiti: 'Breyta lykilorði', netfang: ek.netfang }) }),
          el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Skrá út',
            onclick: async () => { await g.utskra(); location.replace('./'); } })
        ])
  ]);

  if (!admin) { fylla(innihald, [siduHaus(), adgangur]); return; }

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
  const tengingarKafli = kafli('Tengingar', 'Öppin sem kerfið talar við. Ýttu á Tengja til að sjá hvað hver tenging gerir og hvað þarf til.', [tengingarSvid]);

  fylla(innihald, [siduHaus(), adgangur, undirskriftKafli, tengingarKafli]);
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

    /* Google Calendar: fundir hafa komið inn */
    try {
      const atb = (g.dagatal ? await g.dagatal() : null);
      s.dagatal = atb === null ? ['ekki', 'Dagatalið er ekki komið upp']
        : atb.length ? ['tengt', atb.length + (atb.length === 1 ? ' fundur' : ' fundir') + ' á næstu vikum'] : ['bidur', 'Bíður eftir fyrstu samstillingu'];
    } catch (e) { s.dagatal = ['ekki', 'Dagatalið er ekki komið upp']; }

    /* Meta: miðlar með auðkenni og hvort sjálfvirkar tölur hafa komið síðustu 3 daga */
    try {
      const fyrirtaeki = (await g.fyrirtaeki()) || [];
      const nu = new Date(), fra = new Date(nu.getTime() - 3 * 864e5);
      const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      let medAudkenni = 0, sjalfvirkt = 0, tiktok = 0;
      for (const f of fyrirtaeki) {
        const midlar = (await g.midlar(f.id).catch(() => [])) || [];
        const meta = midlar.filter((m) => m.midill !== 'tiktok' && m.ytra_id && m.virkt !== false);
        tiktok += midlar.filter((m) => m.midill === 'tiktok').length;
        medAudkenni += meta.length;
        if (meta.length) {
          const ma = (await g.maelingar(f.id, ymd(fra), ymd(nu)).catch(() => [])) || [];
          if (ma.some((r) => r.uppruni === 'sjalfvirkt' && meta.some((m) => m.id === r.midill_id))) sjalfvirkt++;
        }
      }
      s.meta = sjalfvirkt ? ['tengt', 'Tölurnar koma sjálfkrafa á hverjum morgni']
        : medAudkenni ? ['bidur', medAudkenni + (medAudkenni === 1 ? ' miðill hefur' : ' miðlar hafa') + ' auðkenni, en engar sjálfvirkar tölur ennþá']
        : ['ekki', 'Enginn miðill með auðkenni frá Meta'];
      s.tiktok = ['handvirkt', tiktok ? tiktok + (tiktok === 1 ? ' TikTok reikningur, tölurnar skráðar í höndunum' : ' TikTok reikningar, tölurnar skráðar í höndunum') : 'Tölurnar eru skráðar í höndunum'];
    } catch (e) {
      s.meta = ['ekki', 'Náði ekki í miðlana'];
      s.tiktok = ['handvirkt', 'Tölurnar eru skráðar í höndunum'];
    }
    /* API lyklarnir (kafli 28): null ef taflan er ekki komin */
    try { s.lyklar = g.tengingarStada ? await g.tengingarStada() : null; } catch (e) { s.lyklar = null; }
    return s;
  }

  /* Staða tengingar sem notar API lykil */
  function lykilStada(s, veita, synidaemi) {
    if (s.lyklar === null) return ['ekki', 'Tengingarnar eru ekki komnar í gagnagrunninn'];
    const r = s.lyklar[veita];
    if (!r) return synidaemi ? ['tengt', 'Sýnidæmi'] : ['ekki', ''];
    if (r.prufad) return /^ok/i.test(r.prufa_svar || '')
      ? ['tengt', (String(r.prufa_svar).replace(/^ok:?\s*/i, '') || 'Lykillinn virkar') + '. Prófað ' + hvenaer(r.prufad)]
      : ['ekki', 'Lykillinn virkar ekki: ' + (r.prufa_svar || 'óþekkt villa')];
    return ['bidur', 'Lykill vistaður (endar á ' + (r.sidustu4 || '????') + ') en ekki prófaður ennþá'];
  }

  function teiknaTengingar(s) {
    sidastaStada = s;
    const POSTUR = g.prufa ? 'pósthólfi stofunnar' : 'tveir@tveir.is';
    const VERK = g.prufa ? 'verk-netfang stofunnar' : 'verk@tveir.is';
    const PILLUR = { tengt: 'Tengt', bidur: 'Bíður', ekki: 'Ekki tengt', handvirkt: 'Handvirkt', kemur: 'Kemur' };
    /* Gervigreindin er í smíðum. Í sýnidæminu segjum við það beint. */
    const SMIDUM = ['kemur', 'Í smíðum. Drög að svörum og samantektir eru ekki tilbúin ennþá.'];
    const KEMUR = ['kemur', ''];
    const EKKI = ['ekki', ''];
    const bok = bokhaldsKerfi();
    /* merki: skrá í assets/tengingar. litur: bakgrunnur flísarinnar. ljos: merkið er í lit á hvítu, annars hvítt á lit */
    const HOPAR = [
      ['Póstur og dagatal', [
        { heiti: 'Gmail', lb: 'gmail', merki: 'gmail.svg', litur: '#EA4335', hvad: 'Pósthólfið á Samskiptum og póstar úr kerfinu', stada: s.gmail, slod: 'samskipti.html',
          tharf: SYNID ? EINFALT + ' Pósturinn uppfærist á 5 mínútna fresti.' : 'Tengt í gegnum Apps Script á ' + POSTUR + '. Uppfærist á 5 mínútna fresti.' },
        { heiti: 'Verk-netfangið', lb: 'gmail', stafur: '@', litur: '#1c3050', hvad: 'Póstur á ' + VERK + ' verður að verkum', stada: g.prufa ? ['handvirkt', 'Sýnidæmi'] : ['tengt', VERK],
          tharf: 'Viðskiptavinur sendir póst á ' + VERK + ' og verkið birtist á Stjórnborðinu innan 5 mínútna.' },
        { heiti: 'Google Calendar', lb: 'googlecalendar', merki: 'googlecalendar.svg', litur: '#4285F4', hvad: 'Fundirnir þínir á Dagatalinu, við hlið skiladaga', stada: s.dagatal, slod: 'dagatal.html',
          tharf: SYNID ? EINFALT + ' Dagatalið uppfærist á 5 mínútna fresti.' : 'Tengt í gegnum sömu Apps Script skrift og Gmail. Dagatalið uppfærist á 5 mínútna fresti.' }
      ]],
      ['Samfélagsmiðlar', [
        { heiti: 'Instagram', lb: 'instagram', merki: 'instagram.svg', litur: '#E4405F', hvad: 'Fylgjendur, áhorf og færslur á Tölfræði', stada: s.meta, slod: 'tolfraedi.html',
          tharf: SYNID ? EINFALT + ' Þú gefur okkur aðgang að Instagram reikningnum.' : 'Þarf Meta app og System User token (META_TOKEN) í Apps Script, og auðkenni reikningsins á Tölfræði.' },
        { heiti: 'Facebook', lb: 'facebook', merki: 'facebook.svg', litur: '#0866FF', hvad: 'Áhorf og fylgjendur síðunnar á Tölfræði', stada: s.meta, slod: 'tolfraedi.html',
          tharf: SYNID ? EINFALT + ' Þú gefur okkur aðgang að Facebook síðunni.' : 'Sama Meta app og Instagram. Page ID síðunnar fer á Tölfræði.' },
        { heiti: 'TikTok', lb: 'tiktok', merki: 'tiktok.svg', litur: '#000000', hvad: 'Tölur á Tölfræði', stada: s.tiktok, slod: 'tolfraedi.html',
          tharf: SYNID ? 'TikTok leyfir ekki sjálfvirka söfnun ennþá. Tölurnar eru skráðar í höndunum.' : 'TikTok leyfir ekki sjálfvirka söfnun fyrir okkur ennþá. Tölurnar eru skráðar í höndunum eða úr CSV.' },
        { heiti: 'Messenger', merki: 'messenger.svg', litur: '#00B2FF', hvad: 'Skilaboð inn í Samskipti', stada: KEMUR, tharf: SYNID ? 'Bíður eftir leyfi frá Meta, það tekur nokkrar vikur. ' + EINFALT : 'Sama Meta app, auk leyfis Meta fyrir skilaboðum (App Review, nokkrar vikur).' },
        { heiti: 'Instagram skilaboð', merki: 'instagram.svg', litur: '#C13584', hvad: 'DM inn í Samskipti', stada: KEMUR, tharf: SYNID ? 'Bíður eftir sama leyfi frá Meta og Messenger. ' + EINFALT : 'Sama Meta app og leyfi og Messenger.' }
      ]],
      ['Bókhald', [
        synidSpjald({ ...LYKLAR.payday, stada: lykilStada(s, 'payday', g.prufa && bok === 'Payday') }),
        synidSpjald({ ...LYKLAR.dk, stada: lykilStada(s, 'dk', g.prufa && bok === 'DK') })
      ]],
      ['Verslun', [
        synidSpjald({ ...LYKLAR.shopify, stada: lykilStada(s, 'shopify') })
      ]],
      ['Gervigreind', [
        SYNID ? synidSpjald({ ...LYKLAR.claude, stada: SMIDUM, pilla: 'Í smíðum', smidum: true }, 'Í smíðum. Þegar þetta er tilbúið setur Tveir tenginguna upp með þér.')
          : { ...LYKLAR.claude, stada: lykilStada(s, 'claude') },
        SYNID ? synidSpjald({ ...LYKLAR.chatgpt, stada: SMIDUM, pilla: 'Í smíðum', smidum: true }, 'Í smíðum. Þegar þetta er tilbúið setur Tveir tenginguna upp með þér.')
          : { ...LYKLAR.chatgpt, stada: lykilStada(s, 'chatgpt') }
      ]],
      ['Vefur og skrár', [
        { heiti: 'Google Analytics', lb: 'googleanalytics', merki: 'googleanalytics.svg', litur: '#E37400', hvad: 'Heimsóknir á vef viðskiptavinarins á Tölfræði', stada: KEMUR, tharf: SYNID ? 'Viðskiptavinurinn gefur okkur lesaðgang að sínu Google Analytics. ' + EINFALT : 'Má tengja í gegnum Google. Viðskiptavinurinn gefur okkur lesaðgang að sínu Analytics.' },
        { heiti: 'WeTransfer', lb: 'wetransfer', merki: 'wetransfer.svg', litur: '#409FFF', hvad: 'Hlekkir á undirverkum', stada: ['tengt', 'Hlekkir virka beint á undirverkum'], tharf: 'Engin tenging þarf: límdu WeTransfer hlekkinn á undirverkið og viðskiptavinurinn fær hann í pósti.' }
      ]]
    ];

    const takn = (t) => el('span', { class: 'st-teng__takn' + (t.ljos ? ' er-ljos' : '') + (t.fyllt ? ' er-fyllt' : ''), style: 'background:' + t.litur, 'aria-hidden': 'true' },
      [t.merki ? el('img', { src: 'assets/tengingar/' + t.merki, alt: '', loading: 'lazy' }) : document.createTextNode(t.stafur || t.heiti[0])]);

    const fjoldi = HOPAR.reduce((a, [, l]) => a + l.length, 0);
    const tengd = HOPAR.reduce((a, [, l]) => a + l.filter((t) => (t.stada || [])[0] === 'tengt').length, 0);
    fylla(tengingarSvid, [
      el('p', { class: 'st-teng-yfirlit', texti: tengd + ' af ' + fjoldi + ' tengt' }),
      ...HOPAR.map(([heiti, listi]) => el('div', { class: 'st-teng-hopur' }, [
        el('h3', { texti: heiti }),
        el('div', { class: 'st-tengingar' }, listi.map((t) => {
          const [stada, undir] = t.stada || EKKI;
          return el('article', { class: 'st-teng st-teng--' + stada }, [
            el('div', { class: 'st-teng__efst' }, [
              takn(t),
              el('div', { class: 'st-teng__nafn' }, [el('strong', { texti: t.heiti }), el('span', { texti: t.hvad })]),
              el('span', { class: 'st-pilla st-pilla--' + stada, texti: t.pilla || PILLUR[stada] })
            ]),
            undir ? el('p', { class: 'st-teng__stada', texti: undir }) : null,
            el('div', { class: 'st-teng__fot' }, [
              stada === 'tengt' && t.slod
                ? el('a', { class: 'btn btn--sm btn--ghost', href: t.slod, texti: 'Opna' })
                : el('button', { type: 'button', class: 'btn btn--sm' + (stada === 'tengt' ? ' btn--ghost' : ''), texti: stada === 'tengt' || t.smidum ? 'Nánar' : 'Tengja',
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
      el('p', { class: 'st-t__stada st-t__stada--' + stada, texti: t.smidum ? 'Þetta er í smíðum og ekki tilbúið ennþá.' : TEXTI[stada] || '' }),
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
    const r = (sidastaStada && sidastaStada.lyklar && sidastaStada.lyklar[t.veita]) || null;
    const villa = el('p', { class: 'villa', role: 'alert', hidden: true });
    const tokst = el('p', { class: 'st-t__tokst', role: 'status', hidden: true });
    const syna = (ok, texti) => { villa.hidden = tokst.hidden = true; const x = ok ? tokst : villa; x.textContent = texti; x.hidden = false; };
    /* Prófar lykilinn strax hjá veitunni. Tekst það: glugginn lokast og spjaldið
       sýnir Tengt. Tekst það ekki: glugginn helst opinn með skýringunni. */
    async function profa(hnappur, venjulegt) {
      hnappur.disabled = true; hnappur.textContent = 'Prófa lykilinn';
      let n;
      try { n = await g.profaTengingu(t.veita); }
      catch (er) { n = { ok: false, svar: er.message || 'Ekki tókst að prófa.' }; }
      teiknaTengingar(await stadaTenginga());
      hnappur.disabled = false; hnappur.textContent = venjulegt;
      if (n && n.ok) {
        syna(true, String(n.svar || 'Lykillinn virkar').replace(/\.$/, '') + (g.prufa ? '.' : '. Tengingin er komin á.'));
        setTimeout(() => { if (d.open) d.close(); }, 1600);
      } else syna(false, (n && n.svar) || 'Lykillinn virkar ekki.');
      return n;
    }
    const reitir = (t.reitir || []).map((f) => {
      const inn = el('input', { type: f.leynt === false ? 'text' : 'password', name: f.nafn, autocomplete: 'off', spellcheck: 'false',
        autocapitalize: 'off', placeholder: f.daemi || '', value: f.leynt === false && r && r.stillingar ? (r.stillingar[f.nafn] || '') : '' });
      return { f, inn, svid: el('label', { class: 'st-t__reitur' }, [el('span', { texti: f.heiti }), inn,
        f.leynt !== false && r ? el('small', { texti: 'Vistað. Skildu eftir autt til að halda núverandi lykli.' }) : null]) };
    });
    const vista = el('button', { type: 'submit', class: 'btn', texti: r ? 'Vista breytingar' : 'Vista og tengja' });
    const aftur = r ? el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Prófa aftur', onclick: () => profa(aftur, 'Prófa aftur') }) : null;
    const form = el('form', { class: 'st-t__form', onsubmit: async (e) => {
      e.preventDefault(); villa.hidden = tokst.hidden = true;
      const stillingar = { ...(t.fastar || {}) }, leyndo = {};
      for (const { f, inn } of reitir) {
        const v = inn.value.trim();
        if (f.leynt === false) stillingar[f.nafn] = v.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        else if (v) leyndo[f.nafn] = v;
      }
      const leyndirReitir = reitir.filter(({ f }) => f.leynt !== false);
      if (Object.keys(leyndo).length && Object.keys(leyndo).length < leyndirReitir.length) { villa.textContent = 'Fylltu út alla lyklareitina.'; villa.hidden = false; return; }
      vista.disabled = true; vista.textContent = 'Vista';
      try {
        await g.vistaTengingu(t.veita, stillingar, Object.keys(leyndo).length ? leyndo : null);
        reitir.forEach(({ inn }) => { if (inn.type === 'password') inn.value = ''; });
      } catch (er) {
        syna(false, er.message || 'Ekki tókst að vista.');
        vista.disabled = false; vista.textContent = r ? 'Vista breytingar' : 'Vista og tengja';
        return;
      }
      await profa(vista, 'Vista breytingar');
    } }, [
      ...reitir.map((x) => x.svid),
      villa,
      tokst,
      el('div', { class: 'spjald__fot' }, [
        vista,
        aftur,
        t.opna ? el('a', { class: 'btn btn--ghost', href: t.opna[1], target: '_blank', rel: 'noopener', texti: t.opna[0] }) : null,
        r ? el('button', { type: 'button', class: 'btn btn--ghost btn--danger', texti: 'Aftengja', onclick: async () => {
          if (!confirm('Aftengja ' + t.heiti + '? Lykillinn er þurrkaður út.')) return;
          try { await g.eydaTengingu(t.veita); d.close(); teiknaTengingar(await stadaTenginga()); }
          catch (er) { syna(false, er.message || 'Ekki tókst að aftengja.'); }
        } }) : null
      ])
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

  /* Í Glerhúsinu: bókhaldskerfið sem var valið í "Settu saman" */
  function bokhaldsKerfi() {
    try { const x = JSON.parse(localStorage.getItem('glerhus-tveir-byggja') || 'null'); const t = (x && x.tengingar) || []; return t.includes('payday') ? 'Payday' : t.includes('dk') ? 'DK' : null; }
    catch (e) { return null; }
  }
}
