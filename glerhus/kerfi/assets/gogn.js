/* ==========================================================================
   Glerhúsið: gagnalag
   Sama viðmót hvort gögnin koma úr Supabase eða úr prufudæmum.
   ========================================================================== */

import { stillingar } from './stillingar.js';

/* ------------------------------------------------------------------
   Orðalag
   ------------------------------------------------------------------ */

/* Myndband: hreinsað áður en það fer í gagnagrunninn */
const MYNDBANDA_MIDLAR = ['instagram', 'facebook', 'tiktok', 'youtube', 'annad'];
function hreintMyndband(m) {
  const slod = String(m.slod || '').trim();
  const birt = String(m.birt || '').slice(0, 10);
  return {
    titill: String(m.titill || '').trim().slice(0, 120) || 'Myndband',
    midill: MYNDBANDA_MIDLAR.includes(m.midill) ? m.midill : 'annad',
    slod: /^https:\/\/\S+$/.test(slod) ? slod.slice(0, 2000) : null,
    birt: /^\d{4}-\d{2}-\d{2}$/.test(birt) ? birt : null,
    faersla_id: m.faersla_id || null
  };
}
function hreinMyndbandstala(r) {
  if (!r || !r.myndband_id || !/^\d{4}-\d{2}-01$/.test(String(r.manudur || ''))) return null;
  const t = (v) => (v === '' || v === null || v === undefined || !isFinite(Number(v)) || Number(v) < 0 ? null : Math.round(Number(v)));
  return { myndband_id: r.myndband_id, manudur: r.manudur, ahorf: t(r.ahorf), likes: t(r.likes),
           athugasemdir: t(r.athugasemdir), deilingar: t(r.deilingar), vistanir: t(r.vistanir), uppruni: 'handvirkt' };
}

export const STODUR_VERK = {
  tillaga:   { heiti: 'Bíður samþykkis', litur: 'bid' },
  samthykkt: { heiti: 'Samþykkt',        litur: 'ok'  },
  i_vinnslu: { heiti: 'Í vinnslu',       litur: 'vinnsla' },
  bid_svar:  { heiti: 'Bíður þín',       litur: 'bid' },
  lokid:     { heiti: 'Lokið',           litur: 'lokid' },
  hafnad:    { heiti: 'Ekki tekið',      litur: 'hafnad' }
};

export const STODUR_TASK = {
  nytt:              { heiti: 'Nýtt',       litur: 'nytt' },
  i_vinnslu:         { heiti: 'Í vinnslu',  litur: 'vinnsla' },
  bid_vidskiptavinar:{ heiti: 'Bíður þín',  litur: 'bid' },
  lokid:             { heiti: 'Lokið',      litur: 'lokid' }
};

/* Okkar eigin listi hefur sínar stöður. "Bíður annars" er þegar
   taskurinn liggur hjá þriðja aðila og við getum ekkert gert í honum. */
export const STODUR_INNRI = {
  nytt:      { heiti: 'Ekki byrjað',  litur: 'nytt' },
  i_vinnslu: { heiti: 'Í vinnslu',    litur: 'vinnsla' },
  bid:       { heiti: 'Bíður annars', litur: 'bid' },
  lokid:     { heiti: 'Lokið',        litur: 'lokid' }
};

export const FORGANGUR = {
  lagt:      'Lágt',
  venjulegt: 'Venjulegt',
  hatt:      'Hátt'
};

/* Fyrirspurnir af vefnum fara í gegnum þessi stig. */
export const STODUR_FYRIRSPURN = {
  ny:           { heiti: 'Ný',            litur: 'nytt' },
  haft_samband: { heiti: 'Haft samband',  litur: 'vinnsla' },
  fundur:       { heiti: 'Fundur',        litur: 'vinnsla' },
  tilbod:       { heiti: 'Tilboð sent',   litur: 'bid' },
  unnid:        { heiti: 'Unnið',         litur: 'ok' },
  tapad:        { heiti: 'Tapað',         litur: 'hafnad' }
};

/* Hvaðan fólkið kom. Rakningin á vefnum skilar einu af þessum. */
export const UPPRUNI = {
  facebook:   'Facebook',
  instagram:  'Instagram',
  google_ads: 'Google auglýsing',
  google:     'Google leit',
  linkedin:   'LinkedIn',
  tiktok:     'TikTok',
  postur:     'Tölvupóstur',
  beint:      'Beint',
  annad:      'Annar vefur'
};

/* ==========================================================================
   Supabase
   ========================================================================== */

/* Villur frá Supabase innskráningu koma á ensku. Hér verða þær að íslensku
   sem segir fólki hvað það getur gert. */
function innskraningarvilla(error) {
  const kodi = String((error && error.code) || '');
  const bod = String((error && error.message) || '');
  const stada = error && error.status;

  if ((typeof navigator !== 'undefined' && navigator.onLine === false) || stada === 0
      || /failed to fetch|networkerror|load failed|network request failed/i.test(bod)) {
    return 'Náði ekki sambandi. Athugaðu netið og prófaðu aftur.';
  }
  if (stada === 429 || /rate_limit/.test(kodi) || /rate limit|security purposes|too many/i.test(bod)) {
    return 'Of margar tilraunir í röð. Bíddu í smá stund og prófaðu svo aftur.';
  }
  if (kodi === 'invalid_credentials' || /invalid login credentials/i.test(bod)) {
    return 'Netfang eða lykilorð er ekki rétt. Ef þú hefur ekki valið lykilorð ennþá, notaðu Senda mér hlekk.';
  }
  if (kodi === 'email_not_confirmed' || /not confirmed/i.test(bod)) {
    return 'Netfangið er ekki staðfest ennþá. Notaðu Senda mér hlekk í staðinn.';
  }
  if (kodi === 'same_password' || /different from the old/i.test(bod)) {
    return 'Nýja lykilorðið má ekki vera það sama og það gamla.';
  }
  if (kodi === 'weak_password' || /password should/i.test(bod)) {
    if (error.reasons && error.reasons.includes('pwned')) {
      return 'Þetta lykilorð hefur komið fram í gagnaleka annars staðar. Veldu annað.';
    }
    return 'Lykilorðið er of veikt. Hafðu það minnst 10 stafi, til dæmis nokkur orð saman.';
  }
  if (kodi === 'reauthentication_needed' || /reauthenticat/i.test(bod)) {
    return 'Af öryggisástæðum þarftu að skrá þig út og inn aftur með hlekk áður en þú breytir lykilorðinu.';
  }
  if (kodi === 'session_not_found' || /session missing|session.*expired/i.test(bod)) {
    return 'Innskráningin er runnin út. Skráðu þig inn aftur.';
  }
  return 'Þetta gekk ekki. Prófaðu aftur eða sendu okkur línu.';
}

/* Villur í undirverkum: Supabase svarar á ensku, fólkið les íslensku.
   Okkar eigin villur úr gagnagrunninum eru þegar á íslensku og fara óbreyttar. */
function undirverkVilla(error) {
  const bod = String((error && error.message) || '');
  const stada = error && (error.status || error.statusCode);
  if ((typeof navigator !== 'undefined' && navigator.onLine === false)
      || /failed to fetch|networkerror|load failed|network request failed/i.test(bod)) {
    return 'Náði ekki sambandi. Athugaðu netið og prófaðu aftur.';
  }
  if (/[þðæöáéíóúý]/i.test(bod) || /^Taskurinn fannst ekki/.test(bod)) return bod;
  if (/jwt|session|token.*expired|not authenticated/i.test(bod) || String(stada) === '401') {
    return 'Innskráningin er runnin út. Skráðu þig inn aftur.';
  }
  if (/exceeded|too large|maximum allowed size|payload/i.test(bod) || String(stada) === '413') {
    return 'Skráin er of stór fyrir geymsluna. Settu hana á WeTransfer eða Google Drive og límdu hlekkinn.';
  }
  if (/row-level security|permission denied|unauthorized|forbidden/i.test(bod) || String(stada) === '403') {
    return 'Þú hefur ekki aðgang að þessu.';
  }
  if (/'dags' column|column [^ ]*\.?dags /i.test(bod)) return 'Dagatalið vantar eina breytingu í gagnagrunninum: keyrðu migrations/2026-11-20-dagatal-plan.sql.';
  if (/tengill|check constraint/i.test(bod)) return 'Hlekkurinn þarf að byrja á https:// og vera án bila.';
  if (/already exists|duplicate/i.test(bod)) return 'Skrá með þessu nafni er þegar til. Prófaðu aftur.';
  if (/not found|does not exist/i.test(bod)) return 'Fannst ekki. Endurhlaðaðu síðuna og prófaðu aftur.';
  return 'Þetta gekk ekki. Prófaðu aftur.';
}

/* Villur í tölfræðinni, sama hugsun og undirverkVilla */
function tolfraediVilla(error) {
  const bod = String((error && error.message) || '');
  const kodi = String((error && error.code) || '');
  if ((typeof navigator !== 'undefined' && navigator.onLine === false)
      || /failed to fetch|networkerror|load failed|network request failed/i.test(bod)) {
    return 'Náði ekki sambandi. Athugaðu netið og prófaðu aftur.';
  }
  if (/[þðæöáéíóúý]/i.test(bod)) return bod;
  if (kodi === '42P01' || /relation .* does not exist|could not find the table|schema cache/i.test(bod)) {
    return 'Tölfræðitöflurnar eru ekki komnar í gagnagrunninn. Keyrðu migrations/2026-11-18-tolfraedi.sql í Supabase.';
  }
  if (/jwt|session|token.*expired|not authenticated/i.test(bod)) {
    return 'Innskráningin er runnin út. Skráðu þig inn aftur.';
  }
  if (kodi === '23505' || /duplicate|already exists/i.test(bod)) {
    return 'Þessi miðill er þegar skráður hjá fyrirtækinu.';
  }
  if (kodi === '23514' || /check constraint/i.test(bod)) {
    return 'Eitthvað stenst ekki: slóðir byrja á https://, nafn er 1 til 120 stafir og tölur mega ekki vera neikvæðar.';
  }
  if (/row-level security|permission denied|unauthorized|forbidden/i.test(bod)) {
    return 'Þú hefur ekki aðgang að þessu.';
  }
  return 'Þetta gekk ekki. Prófaðu aftur.';
}

/* Tölurnar sem dagleg mæling getur haft */
const MAELITOLUR = ['fylgjendur', 'ahorf', 'nadir', 'samskipti', 'heimsoknir', 'faerslur'];

/* Ein mæling hreinsuð: tóm gildi detta út svo þau skrifi aldrei yfir
   tölu sem er til fyrir. Skilar null ef línan er ónothæf. */
function hreinMaeling(r) {
  if (!r || !r.midill_id || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.dags || ''))) return null;
  const lina = {
    midill_id: r.midill_id, dags: String(r.dags),
    uppruni: r.uppruni === 'innflutt' ? 'innflutt' : 'handvirkt'
  };
  let tolur = 0;
  for (const k of MAELITOLUR) {
    const v = r[k];
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) { lina[k] = Math.round(n); tolur++; }
  }
  /* Lína án talna myndi bara breyta upprunanum og læsa deginum */
  return tolur ? lina : null;
}

/* Sýnidæmið: lykillinn er ekki sendur neitt, bara athugað hvort hann líti
   út eins og lykill frá þessari veitu. */
function synidaemiPrufa(veita, l) {
  const HEITI = { claude: 'Claude', chatgpt: 'OpenAI', payday: 'Payday', dk: 'DK', shopify: 'Shopify' };
  const REGLUR = {
    claude: () => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(l.lykill || '') || 'Claude lykill byrjar á sk-ant-',
    chatgpt: () => (/^sk-[A-Za-z0-9_-]{20,}$/.test(l.lykill || '') && !/^sk-ant-/.test(l.lykill)) || 'OpenAI lykill byrjar á sk- (ekki sk-ant-, það er Claude lykill)',
    payday: () => (String(l.clientId || '').length >= 8 && String(l.clientSecret || '').length >= 8) || 'Client ID og Client Secret eru of stutt',
    dk: () => String(l.token || '').length >= 20 || 'API tokeninn er of stuttur',
    shopify: () => (String(l.clientId || '').length >= 16 && String(l.clientSecret || '').length >= 16) || 'Client ID og Client secret eru of stutt'
  };
  const nidur = REGLUR[veita] ? REGLUR[veita]() : true;
  return { prufa_svar: nidur === true ? 'OK: Sýnidæmi: lykillinn lítur rétt út. Í alvöru aðgangi er hann prófaður hjá ' + (HEITI[veita] || 'veitunni') : nidur };
}

/* ==================================================================
   Stofur: hvert Glerhús er sín stofa í sama gagnagrunni.
   Vafrinn sendir ALDREI stofa_id. Gagnagrunnurinn setur það sjálfur á
   hverja línu og veggurinn (RLS) sýnir bara línur eigin stofu.
   ================================================================== */

const VERK_LEN = '@verk.tveir.is';
const NETFANG = /^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$/i;
const MANUDUR = /^\d{4}-(0[1-9]|1[0-2])$/;
const STOFU_REITIR = ['nafn', 'netfang', 'merki_url', 'litur', 'vefur', 'einingar', 'stillingar', 'uppsetning'];
const VEITUR_OAUTH = ['google', 'meta', 'tiktok', 'shopify'];
/* Gerðirnar sem merki fatan tekur við (skref 5) og endingin sem fylgir */
const MERKI_GERDIR = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const SHOPIFY_VERK = ['yfirlit', 'pantanir', 'vorur', 'lager'];
const GERVIGREIND_VERK = ['svar_thradur', 'svar_fyrirspurn', 'samantekt_thradur', 'samantekt_task',
                          'samantekt_verkefni', 'samantekt_skyrsla'];

/* Síðasta stofa sem sást í þessum flipa. Gerir stofuLykill samstilltan. */
let sidastaStofa = null;
try {
  const x = JSON.parse(sessionStorage.getItem('glerhus-tveir-eg-2') || 'null');
  if (x && x.stofa_id) sidastaStofa = x.stofa_id;
} catch (e) { /* lokað sessionStorage */ }

/* Lykill í localStorage fyrir stillingar eins notanda (þema, síur,
   felldir kaflar), með stofuna aftast svo tvær stofur í sama vafra
   blandist aldrei: nafn + ':' + stofa_id, eða ':gestur' áður en vitað er. */
export function stofuLykill(nafn, ek) {
  const s = (ek && ek.stofa_id) || sidastaStofa || 'gestur';
  return String(nafn) + ':' + s;
}

const hlutur = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

/* stofa_id fer aldrei með úr vafranum, jafnvel þótt línan hafi verið lesin með því */
function utanStofu(o) {
  if (Array.isArray(o)) return o.map(utanStofu);
  if (!o || typeof o !== 'object') return o;
  const { stofa_id, ...rest } = o; // eslint-disable-line no-unused-vars
  return rest;
}

/* Svar min_stada(): ein lína eða engin */
function hreinMinStada(d) {
  const r = Array.isArray(d) ? d[0] : d;
  if (!r || typeof r !== 'object') return null;
  return {
    stofa_id: r.stofa_id || null, stada: r.stada || null, slug: r.slug || null, nafn: r.nafn || null,
    er_admin: !!r.er_admin, er_eigandi: !!r.er_eigandi, postholf: !!r.postholf,
    google_tilbuid: !!r.google_tilbuid, meta_tilbuid: !!r.meta_tilbuid, tiktok_tilbuid: !!r.tiktok_tilbuid,
    er_rekstraradili: !!r.er_rekstraradili
  };
}

/* Stofan í einni lögun, hvort sem hún kom úr stofur eða bara úr min_stada
   (lokuð stofa sést ekki í stofur, en min_stada segir samt hvað hún heitir). */
function hreinStofa(s, ms) {
  if (!s && !(ms && ms.stofa_id)) return null;
  const x = s || {};
  const slug = x.slug || (ms && ms.slug) || null;
  const netfong = (Array.isArray(x.verk_netfong) ? x.verk_netfong : [])
    .map((r) => (r && typeof r === 'object' ? r.netfang : r)).filter(Boolean);
  const vaent = slug ? (slug === 'tveir' ? 'verk@tveir.is' : slug + VERK_LEN) : null;
  return {
    id: x.id || (ms && ms.stofa_id) || null,
    nafn: x.nafn || (ms && ms.nafn) || '',
    slug,
    stada: x.stada || (ms && ms.stada) || null,
    netfang: x.netfang || null,
    merki_url: x.merki_url || null,
    litur: x.litur || null,
    vefur: x.vefur || null,
    postholf: x.postholf !== undefined && x.postholf !== null ? !!x.postholf : !!(ms && ms.postholf),
    sendir_fra: x.sendir_fra || null,
    einingar: Array.isArray(x.einingar) ? x.einingar : [],
    stillingar: hlutur(x.stillingar),
    uppsetning: hlutur(x.uppsetning),
    verk: netfong.find((n) => n === vaent) || netfong[0] || vaent,
    verk_netfong: netfong.length ? netfong : (vaent ? [vaent] : [])
  };
}

/* Breyting á stofunni hreinsuð. Óþekktir reitir detta út (slug, stada og
   slíkt læsir gagnagrunnurinn hvort sem er). stillingar og uppsetning
   leggjast ofan á það sem er til, svo eitt skref skrifi ekki yfir annað. */
function hreinStofubreyting(b, nuverandi, { gagnaslod = false, merkiSlodir = null } = {}) {
  const ut = {};
  for (const k of STOFU_REITIR) {
    if (!b || b[k] === undefined) continue;
    let v = b[k];
    if (k === 'nafn') {
      v = String(v || '').trim();
      if (!v || v.length > 120) throw new Error('Nafn stofunnar þarf að vera 1 til 120 stafir.');
    } else if (k === 'netfang') {
      v = String(v || '').trim().toLowerCase() || null;
      if (v && !NETFANG.test(v)) throw new Error('Netfangið fyrir svör er ekki rétt.');
    } else if (k === 'merki_url') {
      v = v ? String(v).trim() : null;
      const ok = !v || (/^https:\/\/\S+$/.test(v) && (!merkiSlodir || merkiSlodir.some((f) => v.startsWith(f))))
        || (gagnaslod && /^data:image\/(png|jpeg|webp);base64,/.test(v));
      if (!ok) throw new Error(merkiSlodir ? 'Hladdu merkinu upp sem mynd (png, jpg eða webp).' : 'Slóð merkisins þarf að byrja á https://.');
    } else if (k === 'litur') {
      v = v ? String(v).trim() : null;
      if (v && !/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error('Liturinn á að vera á forminu #1a2b3c.');
    } else if (k === 'vefur') {
      v = String(v || '').trim() || null;
      if (v && !/^https?:\/\//i.test(v) && /^[^\s/]+\.[^\s]+$/.test(v)) v = 'https://' + v;
      if (v && (!/^https:\/\/\S+$/.test(v) || v.length > 200)) throw new Error('Vefurinn þarf að byrja á https:// og vera mest 200 stafir.');
    } else if (k === 'einingar') {
      if (!Array.isArray(v)) throw new Error('Einingarnar eru ekki á réttu formi.');
      v = [...new Set(v.map((x) => String(x)).filter((x) => /^[a-z0-9_]{1,40}$/.test(x)))].slice(0, 50);
    } else {
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Stillingarnar eru ekki á réttu formi.');
      v = { ...hlutur(nuverandi && nuverandi[k]), ...v };
      if (k === 'stillingar' && JSON.stringify(v).length > 4000) throw new Error('Of mikið af stillingum.');
    }
    ut[k] = v;
  }
  if (!Object.keys(ut).length) throw new Error('Ekkert til að vista.');
  return ut;
}

/* Kennitala og netfang fyrir reikninga á fyrirtæki */
function hreintFyrirtaeki(f) {
  const ut = utanStofu(f || {});
  if ('kennitala' in ut) {
    const k = String(ut.kennitala || '').replace(/[\s-]/g, '');
    if (k && !/^\d{10}$/.test(k)) throw new Error('Kennitala er 10 tölustafir.');
    ut.kennitala = k || null;
  }
  if ('reikningsnetfang' in ut) {
    const n = String(ut.reikningsnetfang || '').trim().toLowerCase();
    if (n && !NETFANG.test(n)) throw new Error('Netfang fyrir reikninga er ekki rétt.');
    ut.reikningsnetfang = n || null;
  }
  return ut;
}

/* Boð: sama athugun í sýnidæmi og í alvöru */
function hreintBod({ netfang, nafn, hlutverk, fyrirtaeki_id } = {}) {
  const n = String(netfang || '').trim().toLowerCase();
  if (!NETFANG.test(n)) throw new Error('Netfangið er ekki rétt.');
  if (!['admin', 'vidskiptavinur'].includes(hlutverk)) throw new Error('Veldu Stjórnandi eða Viðskiptavinur.');
  if (hlutverk === 'vidskiptavinur' && !fyrirtaeki_id) throw new Error('Veldu fyrirtæki fyrir viðskiptavininn.');
  const nf = String(nafn || '').trim().slice(0, 120);
  return { netfang: n, nafn: nf || null, hlutverk, fyrirtaeki_id: hlutverk === 'vidskiptavinur' ? fyrirtaeki_id : null };
}

/* Reikningsdrög: sama athugun í sýnidæmi og í alvöru */
function hreinDrog({ veita, uppruni, id, manudur, linur } = {}) {
  if (!['payday', 'dk'].includes(veita)) throw new Error('Veldu Payday eða DK.');
  if (!['verkefni', 'samningur', 'aukaverkefni'].includes(uppruni)) throw new Error('Óþekkt tegund reiknings.');
  if (!id) throw new Error('Það vantar hvað á að rukka fyrir.');
  const ut = { veita, uppruni, id: String(id) };
  if (manudur) {
    if (!MANUDUR.test(String(manudur))) throw new Error('Mánuðurinn á að vera á forminu 2026-11.');
    ut.manudur = String(manudur);
  }
  if (uppruni === 'samningur' && !ut.manudur) throw new Error('Veldu mánuð fyrir samninginn.');
  if (linur !== undefined && linur !== null) {
    if (!Array.isArray(linur) || !linur.length || linur.length > 50) throw new Error('Reikningurinn þarf 1 til 50 línur.');
    ut.linur = linur.map((l) => {
      const texti = String((l && l.texti) || '').trim().slice(0, 200);
      const upphaed = Math.round(Number(l && l.upphaed));
      if (!texti) throw new Error('Hver lína þarf texta.');
      if (!Number.isFinite(upphaed) || upphaed < 0) throw new Error('Upphæð á línu má ekki vera neikvæð.');
      return { texti, upphaed };
    });
  }
  return ut;
}

/* Frambjóðendur í reikninga í einni lögun: { efni: [{ uppruni, id, ... }] } */
function hreintReikningsefni(d, manudur) {
  const x = hlutur(d);
  let efni = Array.isArray(x.efni) ? x.efni : null;
  if (!efni) {
    efni = [];
    for (const [k, uppruni] of [['verkefni', 'verkefni'], ['samningar', 'samningur'], ['aukaverkefni', 'aukaverkefni']]) {
      (Array.isArray(x[k]) ? x[k] : []).forEach((r) => efni.push({ uppruni, ...r }));
    }
  }
  return { ...x, ok: true, manudur: x.manudur || manudur, efni };
}

/* Gamalt skema (fyrir stofur): dálkurinn eða tengingin er ekki til */
function gamaltSkema(error) {
  const kodi = String((error && error.code) || '');
  const bod = String((error && error.message) || '');
  return kodi === '42703' || kodi === 'PGRST200' || kodi === '42P01' || kodi === 'PGRST205'
    || /does not exist|could not find|schema cache/i.test(bod);
}
function vantarToflu(error) {
  const kodi = String((error && error.code) || '');
  const bod = String((error && error.message) || '');
  return kodi === '42P01' || kodi === 'PGRST205' || /relation .* does not exist|could not find the (table|function)|schema cache/i.test(bod);
}

/* Villur í stofu, boðum og reikningum. Okkar eigin villur úr gagnagrunninum
   eru þegar á íslensku og fara óbreyttar. */
function stofuVilla(error) {
  const bod = String((error && error.message) || '');
  const kodi = String((error && error.code) || '');
  if ((typeof navigator !== 'undefined' && navigator.onLine === false)
      || /failed to fetch|networkerror|load failed|network request failed/i.test(bod)) {
    return 'Náði ekki sambandi. Athugaðu netið og prófaðu aftur.';
  }
  if (/[þðæöáéíóúý]/i.test(bod)) return bod;
  if (vantarToflu(error)) return 'Þessi hluti kerfisins er ekki kominn í gagnagrunninn ennþá.';
  if (/jwt|session|token.*expired|not authenticated/i.test(bod)) return 'Innskráningin er runnin út. Skráðu þig inn aftur.';
  /* Regla gagnagrunnsins á nafni stofunnar (skref 1): engar vefslóðir, lén eða HTML */
  if (/stofur_nafn_oruggt/.test(bod)) return 'Nafn stofunnar má ekki innihalda vefslóð, lén eða HTML.';
  if (kodi === '23514' || /check constraint/i.test(bod)) return 'Eitthvað stenst ekki. Athugaðu reitina og prófaðu aftur.';
  if (kodi === '23505' || /duplicate|already exists/i.test(bod)) return 'Þetta er þegar til.';
  if (kodi === '42501' || /row-level security|permission denied|unauthorized|forbidden/i.test(bod)) return 'Þú hefur ekki aðgang að þessu.';
  return 'Þetta gekk ekki. Prófaðu aftur.';
}

/* Villa með aukaupplýsingum frá Edge Function: kodi og http stada */
function fallVilla(texti, aukalega) {
  const v = new Error(texti);
  v.ok = false;
  v.svar = texti;
  Object.assign(v, aukalega || {});
  return v;
}

async function supabaseBakendi() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  /* Lotan er geymd í vafranum og endurnýjast sjálf, svo fólk helst inni á
     sama tæki þar til það skráir sig út. Þetta eru sjálfgefin gildi, skrifuð
     hér svo enginn breyti þeim óvart. */
  /* Embed með vísbendingu um dálk: eftir skref 2 eru tveir lyklar á milli
     sömu taflna (einn dálkur og (stofa_id, dálkur)) og PostgREST þarf að vita
     hvorn á að nota. Ef gagnagrunnurinn þekkir ekki vísbendinguna (t.d. ef
     einfaldi lykillinn var tekinn út og bara samsetti lykillinn er eftir)
     svarar PostgREST PGRST200 áður en nokkuð er keyrt eða skrifað. Þá er sama
     beiðni send aftur án vísbendinga og þeim sleppt það sem eftir er í
     flipanum. Skilgreint fyrir createClient svo fetch geti lesið það strax. */
  /* Munað í vafranum: þegar ljóst er að gagnagrunnurinn þekkir ekki
     vísbendingarnar er þeim sleppt strax við næstu síðu, svo hver listi
     fari ekki tvisvar. Ef tengingin verður tvíræð án vísbendinga (PGRST201)
     er minnið hreinsað og þær notaðar aftur frá næstu síðu. */
  const VISBENDING_MINNI = 'glerhus-tveir-visbendingar';
  let visbendingar = true;
  try { visbendingar = localStorage.getItem(VISBENDING_MINNI) !== 'nei'; } catch (e) { /* lokað */ }
  function munaVisbendingar(nota) {
    visbendingar = nota;
    try {
      if (nota) localStorage.removeItem(VISBENDING_MINNI);
      else localStorage.setItem(VISBENDING_MINNI, 'nei');
    } catch (e) { /* lokað */ }
  }
  const VISBENDING = /!(fyrirtaeki_id|verkefni_id|task_id|snid_id|myndband_id|stofa_id)(?=\()/;
  const VISBENDINGAR = new RegExp(VISBENDING.source, 'g');
  async function saekjaMedVara(input, init) {
    const svar = await fetch(input, init);
    if (svar.status === 300 && !visbendingar) {
      /* Tvíræð tenging án vísbendinga: nota þær aftur frá næstu síðu */
      try { const v = await svar.clone().json(); if (v && v.code === 'PGRST201') munaVisbendingar(true); } catch (e) { /* ekki json */ }
      return svar;
    }
    if (svar.status !== 400) return svar;
    const slod = typeof input === 'string' ? input : String((input && input.url) || input || '');
    if (slod.indexOf('/rest/v1/') < 0) return svar;
    let u;
    try { u = new URL(slod); } catch (e) { return svar; }
    const val = u.searchParams.get('select');
    if (!val || !VISBENDING.test(val)) return svar;
    let villa = null;
    try { villa = await svar.clone().json(); } catch (e) { return svar; }
    if (!villa || villa.code !== 'PGRST200') return svar;
    u.searchParams.set('select', val.replace(VISBENDINGAR, ''));
    const aftur = await fetch(u.toString(), init);
    if (aftur.ok) munaVisbendingar(false);
    return aftur;
  }

  const sb = createClient(stillingar.supabaseUrl, stillingar.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { fetch: (input, init) => saekjaMedVara(input, init) }
  });

  /* Hver er innskráður. Lotan liggur í vafranum, svo hér er ekki farið á
     netið við hverja síðu. Prófíllinn er geymdur meðan flipinn er opinn.
     Þetta stýrir bara hvað er teiknað: gagnagrunnurinn sjálfur (RLS)
     ákveður hvað hver má sjá, sama hvað stendur hér. */
  let minn = null;
  let iGangi = null;
  const LYKILL_EG = 'glerhus-tveir-eg-2';
  const GAMLIR_LYKLAR = ['tveir-eg'];

  /* Geymt efni lotunnar: prófíllinn og síðuminnið (tveir-sida-*). Fer þegar
     annar notandi skráir sig inn í sama flipa, svo stofa sjái aldrei
     afrit af gögnum annarrar stofu. */
  function hreinsaLotu() {
    try {
      Object.keys(sessionStorage)
        .filter((k) => k === LYKILL_EG || GAMLIR_LYKLAR.includes(k) || k.startsWith('tveir-sida-') || k === 'glerhus-tveir-gjald-lotu')
        .forEach((k) => sessionStorage.removeItem(k));
    } catch (e) { /* lokað */ }
  }
  function geymaEg(m) { try { sessionStorage.setItem(LYKILL_EG, JSON.stringify(m)); } catch (e) { /* lokað */ } }

  /* Hlekkur til að velja nýtt lykilorð skráir fólk inn og Supabase lætur
     vita með PASSWORD_RECOVERY. Hlustað strax, áður en slóðin er lesin.
     Engin Supabase köll hér inni, bara minnið hreinsað. */
  let endurstilling = false;
  sb.auth.onAuthStateChange((atburdur, lota) => {
    if (atburdur === 'PASSWORD_RECOVERY') endurstilling = true;
    if (atburdur === 'SIGNED_OUT') { minn = null; sidastaStofa = null; hreinsaLotu(); return; }
    const id = lota && lota.user && lota.user.id;
    if (id && minn && minn.id !== id) { minn = null; sidastaStofa = null; hreinsaLotu(); }
    /* Ný síða: geymdi prófíllinn í flipanum getur verið annars notanda */
    if (id && !minn) {
      try {
        const x = JSON.parse(sessionStorage.getItem(LYKILL_EG) || 'null');
        if (x && x.id !== id) { sidastaStofa = null; hreinsaLotu(); }
      } catch (e) { /* lokað */ }
    }
  });

  /* Vísbending um dálk í embed (sjá visbendingar efst) */
  const fk = (tafla, dalkur = 'fyrirtaeki_id') => (visbendingar ? tafla + '!' + dalkur : tafla);

  const STOFA_DALKAR = 'id, nafn, slug, stada, netfang, merki_url, litur, vefur, postholf, sendir_fra, einingar, stillingar, uppsetning, verk_netfong(netfang, stofnad)';
  const EG_GAMALT = 'id, nafn, netfang, hlutverk, fyrirtaeki_id, fyrirtaeki(id, nafn, merki_url, er_askrift, askrift_verd)';
  const egDalkar = () => 'id, nafn, netfang, hlutverk, fyrirtaeki_id, stofa_id, er_eigandi, '
    + fk('fyrirtaeki') + '(id, nafn, merki_url, er_askrift, askrift_verd), stofa:' + fk('stofur', 'stofa_id') + '(' + STOFA_DALKAR + ')';

  async function saekjaEg(id) {
    const [prof, stada] = await Promise.all([
      sb.from('notendur').select(egDalkar()).eq('id', id).maybeSingle(),
      sb.rpc('min_stada')
    ]);
    let svar = prof;
    if (svar.error && gamaltSkema(svar.error)) {
      /* Gagnagrunnurinn er ekki kominn með stofur, eða þekkir ekki
         vísbendinguna. Gamla fyrirspurnin virkar þá eins og áður. */
      const umFyrirtaeki = /'fyrirtaeki'/.test(String(svar.error.message || ''));
      svar = await sb.from('notendur').select(EG_GAMALT).eq('id', id).maybeSingle();
      if (!svar.error && umFyrirtaeki) munaVisbendingar(false);
    }
    if (svar.error || !svar.data) return null;
    const min_stada = stada.error ? null : hreinMinStada(stada.data);
    const d = svar.data;
    const { stofa: s, ...rest } = d;
    return {
      ...rest,
      stofa_id: d.stofa_id || (min_stada && min_stada.stofa_id) || null,
      er_eigandi: !!(d.er_eigandi || (min_stada && min_stada.er_eigandi)),
      stofa: hreinStofa(s, min_stada),
      min_stada
    };
  }

  /* eg({ ferskt: true }) sækir prófílinn aftur, t.d. eftir að stofunni var breytt */
  async function eg(valkostir) {
    const ferskt = !!(valkostir && valkostir.ferskt);
    const { data: { session } } = await sb.auth.getSession();
    const user = session && session.user;
    if (!user) { if (minn) { minn = null; hreinsaLotu(); } return null; }
    if (minn && minn.id !== user.id) { minn = null; hreinsaLotu(); }
    if (minn && !ferskt) return minn;
    if (!ferskt) {
      try {
        const geymt = JSON.parse(sessionStorage.getItem(LYKILL_EG) || 'null');
        if (geymt && geymt.id === user.id) { minn = geymt; sidastaStofa = minn.stofa_id || null; return minn; }
        if (geymt) hreinsaLotu();
      } catch (e) { /* ekkert geymt */ }
    }
    /* Margar einingar spyrja í einu þegar síðan opnast: ein fyrirspurn dugar */
    if (!iGangi || iGangi.id !== user.id || ferskt) {
      const verk = { id: user.id, lof: null };
      verk.lof = saekjaEg(user.id).then((m) => {
        if (iGangi === verk) iGangi = null;
        minn = m;
        sidastaStofa = (m && m.stofa_id) || null;
        if (m) geymaEg(m);
        return m;
      }, (villa) => { if (iGangi === verk) iGangi = null; throw villa; });
      iGangi = verk;
    }
    return iGangi.lof;
  }

  function kasta({ error }) { if (error) throw new Error(error.message); }
  function kastaUv({ error }) { if (error) throw new Error(undirverkVilla(error)); }
  function kastaSt({ error }) { if (error) throw new Error(stofuVilla(error)); }

  /* Edge Function kölluð með lotu notandans. Skilar gögnunum ef ok, kastar
     annars Error með íslenskum texta (og .svar, .kodi, .stada). */
  async function kallaFall(nafn, body) {
    const { data, error } = await sb.functions.invoke(nafn, { body: body || {} });
    if (!error) {
      if (data && data.ok === false) throw fallVilla(data.svar || 'Þetta gekk ekki. Prófaðu aftur.', { kodi: data.kodi || null, stada: 200, gogn: data });
      return data || { ok: true };
    }
    const stada = error.context && typeof error.context.status === 'number' ? error.context.status : 0;
    let svar = null;
    try { if (error.context && typeof error.context.json === 'function') svar = await error.context.json(); } catch (e) { /* ekki JSON */ }
    if (svar && svar.svar) throw fallVilla(svar.svar, { kodi: svar.kodi || null, stada, gogn: svar });
    if (!stada || /fetch|network/i.test(String(error.message || ''))) {
      throw fallVilla('Náði ekki sambandi. Athugaðu netið og prófaðu aftur.', { kodi: 'samband', stada });
    }
    if (stada === 401) throw fallVilla('Innskráningin er runnin út. Skráðu þig inn aftur.', { kodi: 'innskraning', stada });
    if (stada === 403) throw fallVilla('Þú hefur ekki aðgang að þessu.', { kodi: 'adgangur', stada });
    if (stada === 404) throw fallVilla('Þessi hluti kerfisins er ekki kominn upp ennþá.', { kodi: 'vantar', stada });
    if (stada === 429) throw fallVilla('Of mörg köll í röð. Bíddu í smá stund og prófaðu aftur.', { kodi: 'hamark', stada });
    throw fallVilla('Þetta gekk ekki. Prófaðu aftur eftir smá stund.', { kodi: 'villa', stada });
  }

  /* Lesið úr nýrri töflu: tómur listi ef hún er ekki komin */
  async function lesaNytt(fyrirspurn) {
    const svar = await fyrirspurn;
    if (svar.error) { if (vantarToflu(svar.error)) return []; kastaSt(svar); }
    return svar.data || [];
  }

  /* Fyrra merki stofunnar fer úr geymslunni þegar nýtt kemur eða því er
     hent, svo skrárnar safnist ekki upp. Bara skrár í möppu eigin stofu,
     og það má mistakast (merkið sjálft er þegar vistað). */
  async function hendaGomluMerki(slod, stofaId) {
    const grunnur = sb.storage.from('merki').getPublicUrl('x').data.publicUrl.replace(/x$/, '');
    const mappa = 'stofa-' + stofaId + '/';
    if (!slod || !stofaId || !String(slod).startsWith(grunnur + mappa)) return;
    const leid = decodeURIComponent(String(slod).slice(grunnur.length).split('?')[0]);
    if (!leid.startsWith(mappa) || leid.includes('..')) return;
    try { await sb.storage.from('merki').remove([leid]); } catch (e) { /* skiptir ekki máli */ }
  }

  async function minStofaId() {
    const ek = await eg();
    if (!ek || !ek.stofa_id) throw new Error('Aðgangurinn er ekki tengdur neinu Glerhúsi.');
    return ek;
  }

  return {
    prufa: false,

    async innskra(netfang) {
      const { error } = await sb.auth.signInWithOtp({
        email: netfang.trim().toLowerCase(),
        options: { shouldCreateUser: false, emailRedirectTo: stillingar.slod + 'yfirlit.html' }
      });
      /* Netfang sem er ekki með aðgang fær sama svar og hin, svo enginn geti
         prófað sig áfram og fundið hverjir eru í kerfinu. */
      if (error && (error.code === 'otp_disabled' || /signups not allowed/i.test(error.message || ''))) return;
      if (error) throw new Error(innskraningarvilla(error));
    },

    async innskraLykilord(netfang, lykilord) {
      const { error } = await sb.auth.signInWithPassword({
        email: netfang.trim().toLowerCase(),
        password: lykilord
      });
      if (error) throw new Error(innskraningarvilla(error));
      minn = null;
    },

    /* Supabase segir ekki hvort netfangið er til, og það gerum við ekki heldur */
    async sendaEndurstillingu(netfang) {
      const { error } = await sb.auth.resetPasswordForEmail(netfang.trim().toLowerCase(), {
        redirectTo: stillingar.slod + '?endurstilla=1'
      });
      if (error) throw new Error(innskraningarvilla(error));
    },

    /* Merkið lykilord_sett í user_metadata segir okkur bara hvort við eigum
       að bjóða fólki að velja lykilorð. Það stýrir engum réttindum. */
    async setjaLykilord(lykilord) {
      const { error } = await sb.auth.updateUser({ password: lykilord, data: { lykilord_sett: true } });
      if (error) throw new Error(innskraningarvilla(error));
      endurstilling = false;
    },

    async vantarLykilord() {
      const { data: { session } } = await sb.auth.getSession();
      const user = session && session.user;
      return !!user && !(user.user_metadata && user.user_metadata.lykilord_sett);
    },

    erEndurstilling() { return endurstilling; },

    async utskra() {
      minn = null;
      sidastaStofa = null;
      try {
        Object.keys(sessionStorage).filter((k) => /^(tveir-|glerhus)/.test(k)).forEach((k) => sessionStorage.removeItem(k));
      } catch (e) { /* lokað */ }
      await sb.auth.signOut();
    },

    eg,

    /* Harvey þarf að sanna fyrir fallinu á Vercel að við séum innskráð */
    async adgangstokinn() {
      const { data } = await sb.auth.getSession();
      return data && data.session ? data.session.access_token : null;
    },

    async verkefni(fyrirtaeki_id) {
      let q = sb.from('verkefni')
        .select('*, ' + fk('fyrirtaeki') + '(nafn)')
        .order('stofnad', { ascending: false });
      if (fyrirtaeki_id) q = q.eq('fyrirtaeki_id', fyrirtaeki_id);
      const svar = await q; kasta(svar); return svar.data;
    },

    async verkefniEitt(id) {
      const svar = await sb.from('verkefni').select('*, ' + fk('fyrirtaeki') + '(nafn)').eq('id', id).single();
      kasta(svar); return svar.data;
    },

    async nyVerkefnatillaga({ titill, lysing, skiladagur, budget, innan_samnings }) {
      const ek = await eg();
      const svar = await sb.from('verkefni').insert({
        fyrirtaeki_id: ek.fyrirtaeki_id,
        titill, lysing, skiladagur: skiladagur || null,
        budget: innan_samnings ? null : budget,
        innan_samnings: !!innan_samnings,
        stada: 'tillaga', hofundur: ek.id
      }).select().single();
      kasta(svar); return svar.data;
    },

    async uppfaeraVerkefni(id, breytingar) {
      const svar = await sb.from('verkefni').update(utanStofu(breytingar)).eq('id', id).select().single();
      kasta(svar); return svar.data;
    },

    async taskar({ fyrirtaeki_id, verkefni_id } = {}) {
      const grunnur = '*, ' + fk('fyrirtaeki') + '(nafn), ' + fk('verkefni', 'verkefni_id') + '(titill), abyrgd_notandi:abyrgd(nafn), hofundur_notandi:hofundur(nafn, hlutverk)';
      const saekja = (dalkar) => {
        let q = sb.from('taskar').select(dalkar);
        if (fyrirtaeki_id) q = q.eq('fyrirtaeki_id', fyrirtaeki_id);
        if (verkefni_id) q = q.eq('verkefni_id', verkefni_id);
        /* Innan verkefnis ræður röðin, annars nýjast efst */
        return verkefni_id
          ? q.order('rod').order('stofnad')
          : q.order('stofnad', { ascending: false });
      };
      /* Undirverkin fylgja með svo spjöldin sýni "2 af 4 lokið". Sé taflan
         ekki komin í gagnagrunninn virkar listinn samt, bara án þeirra. */
      let svar = await saekja(grunnur + ', ' + fk('undirverk', 'task_id') + '(id, lokid)');
      if (svar.error && /undirverk/i.test(svar.error.message || '')) svar = await saekja(grunnur);
      kasta(svar); return svar.data;
    },

    async nyrTask(task) {
      const ek = await eg();
      const svar = await sb.from('taskar').insert({
        ...utanStofu(task),
        rod: task.rod !== undefined ? task.rod : await this.naestaRod(task.verkefni_id),
        fyrirtaeki_id: task.fyrirtaeki_id || ek.fyrirtaeki_id,
        hofundur: ek.id
      }).select().single();
      kasta(svar); return svar.data;
    },

    /* Nýr taskur fer aftast í tímalínuna */
    async naestaRod(verkefni_id) {
      if (!verkefni_id) return 0;
      const svar = await sb.from('taskar').select('rod')
        .eq('verkefni_id', verkefni_id).order('rod', { ascending: false }).limit(1);
      kasta(svar);
      return svar.data && svar.data[0] ? Number(svar.data[0].rod) + 1 : 1;
    },

    async uppfaeraTask(id, breytingar) {
      const svar = await sb.from('taskar').update(utanStofu(breytingar)).eq('id', id).select().single();
      kasta(svar); return svar.data;
    },

    async athugasemdir(task_id) {
      const svar = await sb.from('athugasemdir')
        .select('*, notandi:hofundur(nafn, hlutverk)')
        .eq('task_id', task_id).order('stofnad');
      kasta(svar); return svar.data;
    },

    async nyAthugasemd(task_id, texti) {
      const ek = await eg();
      const svar = await sb.from('athugasemdir')
        .insert({ task_id, texti, hofundur: ek.id })
        .select('*, notandi:hofundur(nafn, hlutverk)').single();
      kasta(svar); return svar.data;
    },

    async fyrirtaeki() {
      const svar = await sb.from('fyrirtaeki').select('*').order('nafn');
      kasta(svar); return svar.data;
    },

    /* kennitala og reikningsnetfang mega fylgja með (reikningsdrög) */
    async nyttFyrirtaeki(fyrirtaeki) {
      const svar = await sb.from('fyrirtaeki').insert(hreintFyrirtaeki(fyrirtaeki)).select().single();
      kasta(svar); return svar.data;
    },

    async uppfaeraFyrirtaeki(id, breytingar) {
      const svar = await sb.from('fyrirtaeki').update(hreintFyrirtaeki(breytingar)).eq('id', id).select().single();
      kastaSt(svar);
      if (minn && minn.fyrirtaeki && minn.fyrirtaeki.id === id && svar.data) {
        minn.fyrirtaeki = { ...minn.fyrirtaeki, nafn: svar.data.nafn, merki_url: svar.data.merki_url };
        geymaEg(minn);
      }
      return svar.data;
    },

    async notendur() {
      const svar = await sb.from('notendur')
        .select('*, ' + fk('fyrirtaeki') + '(nafn)').order('stofnad', { ascending: false });
      kasta(svar); return svar.data;
    },

    async tengjaNotanda(id, fyrirtaeki_id) {
      const svar = await sb.from('notendur').update({ fyrirtaeki_id }).eq('id', id).select().single();
      kasta(svar); return svar.data;
    },

    /* ---------- Innri: tímar og reikningur, bara við ---------- */

    async innri(verkefni_id) {
      let q = sb.from('verkefni_innri').select('*');
      if (verkefni_id) {
        const svar = await q.eq('verkefni_id', verkefni_id).maybeSingle();
        kasta(svar); return svar.data || { verkefni_id, klst: 0, reikningur: 'ekki_rukkad' };
      }
      const svar = await q; kasta(svar); return svar.data;
    },

    async skraTima(verkefni_id, klst, nota) {
      const ek = await eg();
      const svar = await sb.from('timar')
        .insert({ verkefni_id, klst, nota: nota || null, notandi: ek.id })
        .select('*, notandi_nafn:notandi(nafn)').single();
      kasta(svar); return svar.data;
    },

    async timaskraning(verkefni_id) {
      const svar = await sb.from('timar')
        .select('*, notandi_nafn:notandi(nafn)')
        .eq('verkefni_id', verkefni_id).order('stofnad', { ascending: false });
      kasta(svar); return svar.data;
    },

    async eydaTima(id) {
      const svar = await sb.from('timar').delete().eq('id', id);
      kasta(svar);
    },

    async setjaReikning(verkefni_id, reikningur) {
      const svar = await sb.from('verkefni_innri').upsert({
        verkefni_id, reikningur,
        reikningur_dags: reikningur === 'ekki_rukkad' ? null : new Date().toISOString().slice(0, 10),
        uppfaert: new Date().toISOString()
      }).select().single();
      kasta(svar); return svar.data;
    },

    /* ---------- Snið ---------- */

    async snid() {
      const svar = await sb.from('snid').select('*, ' + fk('snid_taskar', 'snid_id') + '(*)').order('nafn');
      kasta(svar);
      return (svar.data || []).map((s) => ({
        ...s, taskar: (s.snid_taskar || []).sort((a, b) => a.rod - b.rod)
      }));
    },

    async nyttVerkefniAdmin({ fyrirtaeki_id, titill, lysing, skiladagur, verd_okkar, innan_samnings, snid_id }) {
      const ek = await eg();
      const svar = await sb.from('verkefni').insert({
        fyrirtaeki_id, titill, lysing: lysing || null, skiladagur: skiladagur || null,
        stada: 'i_vinnslu', hofundur: ek.id, budget: null,
        innan_samnings: !!innan_samnings,
        verd_okkar: innan_samnings ? null : (verd_okkar || null)
      }).select().single();
      kasta(svar);
      if (snid_id) await this.beitaSnidi(svar.data, snid_id);
      return svar.data;
    },

    async beitaSnidi(v, snid_id) {
      const ek = await eg();
      const sn = await sb.from('snid_taskar').select('*').eq('snid_id', snid_id).order('rod');
      kasta(sn);
      if (!sn.data || !sn.data.length) return;
      const kunni = await sb.from('notendur').select('id')
        .eq('fyrirtaeki_id', v.fyrirtaeki_id).neq('hlutverk', 'admin').limit(1);
      const theirra = kunni.data && kunni.data[0] ? kunni.data[0].id : null;
      const svar = await sb.from('taskar').insert(sn.data.map((t, i) => ({
        fyrirtaeki_id: v.fyrirtaeki_id, verkefni_id: v.id, rod: t.rod || (i + 1),
        titill: t.titill, lysing: t.lysing, forgangur: t.forgangur,
        stada: t.a_hverjum === 'vidskiptavinur' ? 'bid_vidskiptavinar' : 'nytt',
        abyrgd: t.a_hverjum === 'vidskiptavinur' ? theirra : ek.id,
        hofundur: ek.id
      })));
      kasta(svar);
    },

    /* ---------- Viðhengi ---------- */

    async vidhengi(task_id) {
      const svar = await sb.from('vidhengi')
        .select('*, notandi:hofundur(nafn)').eq('task_id', task_id).order('stofnad');
      kasta(svar); return svar.data;
    },

    async nyttVidhengi(task_id, fyrirtaeki_id, skra) {
      const ek = await eg();
      const hreintNafn = skra.name.replace(/[^\w.\- ]+/g, '_');
      const slod = fyrirtaeki_id + '/' + task_id + '/' + Date.now() + '-' + hreintNafn;
      const upp = await sb.storage.from('vidhengi').upload(slod, skra, { upsert: false });
      if (upp.error) throw new Error(upp.error.message);
      const svar = await sb.from('vidhengi').insert({
        task_id, slod, nafn: skra.name, staerd: skra.size, hofundur: ek.id
      }).select('*, notandi:hofundur(nafn)').single();
      kasta(svar); return svar.data;
    },

    async slodAVidhengi(v) {
      const svar = await sb.storage.from('vidhengi').createSignedUrl(v.slod, 60);
      if (svar.error) throw new Error(svar.error.message);
      return svar.data.signedUrl;
    },

    /* ---------- Undirverk ----------
       Bara við bætum við, breytum og eyðum (RLS). Viðskiptavinur les.
       fyrirtaeki_id er sett í gagnagrunninum úr taskinum.
       Villur koma á ensku frá Supabase og verða íslenskar í kastaUv. */

    async undirverk(task_id) {
      const svar = await sb.from('undirverk').select('*')
        .eq('task_id', task_id).order('rod').order('stofnad');
      kastaUv(svar); return svar.data;
    },

    async nyUndirverk(task_id, titlar) {
      const sidast = await sb.from('undirverk').select('rod')
        .eq('task_id', task_id).order('rod', { ascending: false }).limit(1);
      kastaUv(sidast);
      const fra = sidast.data && sidast.data[0] ? Number(sidast.data[0].rod) + 1 : 1;
      /* titlar: texti, eða { titill, dags } þegar undirverkið fær dag á dagatalinu */
      const svar = await sb.from('undirverk')
        .insert(titlar.map((x, i) => {
          const lina = { task_id, titill: String(typeof x === 'object' ? x.titill : x).slice(0, 200), rod: fra + i };
          if (x && typeof x === 'object' && x.dags) lina.dags = x.dags;
          return lina;
        }))
        .select();
      kastaUv(svar); return svar.data;
    },

    /* Fundir sem eru skráðir í kerfinu (ekki úr Google Calendar). Tómur listi
       ef taflan er ekki komin (migrations/2026-11-20-fundir.sql). */
    async fundir() {
      const fra = new Date(Date.now() - 60 * 864e5).toISOString();
      const svar = await sb.from('fundir').select('*, ' + fk('fyrirtaeki') + '(nafn)').gte('byrjar', fra).order('byrjar').limit(2000);
      if (svar.error) {
        if (/fundir|does not exist|schema cache|could not find/i.test(String(svar.error.message))) return [];
        kasta(svar);
      }
      return svar.data || [];
    },
    async nyrFundur(f) {
      const ek = await eg();
      const svar = await sb.from('fundir').insert({ ...utanStofu(f), hofundur: ek.id }).select('*, ' + fk('fyrirtaeki') + '(nafn)').single();
      if (svar.error && /fundir|schema cache|could not find/i.test(String(svar.error.message))) throw new Error('Fundirnir eru ekki komnir í gagnagrunninn. Keyrðu migrations/2026-11-20-fundir.sql.');
      kasta(svar); return svar.data;
    },
    async uppfaeraFund(id, breytingar) {
      const svar = await sb.from('fundir').update(utanStofu(breytingar)).eq('id', id).select('*, ' + fk('fyrirtaeki') + '(nafn)').single();
      kasta(svar); return svar.data;
    },
    async eydaFundi(id) {
      const svar = await sb.from('fundir').delete().eq('id', id);
      kasta(svar);
    },

    /* Undirverk með dag, fyrir Dagatalið. Tómur listi ef dálkurinn er ekki
       kominn (migrations/2026-11-20-dagatal-plan.sql). */
    async undirverkADagatali() {
      /* Sama gluggi og fundirnir: 60 dagar aftur, allt fram í tímann */
      const fra = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
      const svar = await sb.from('undirverk')
        .select('id, task_id, titill, dags, lokid, ' + fk('fyrirtaeki') + '(nafn), ' + fk('taskar', 'task_id') + '(titill, stada)')
        .gte('dags', fra).order('dags').limit(2000);
      if (svar.error) {
        if (/'dags' column|column [^ ]*\.?dags |undirverk\.dags/i.test(String(svar.error.message))) return [];
        kastaUv(svar);
      }
      return svar.data || [];
    },

    async uppfaeraUndirverk(id, breytingar) {
      const svar = await sb.from('undirverk').update(utanStofu(breytingar)).eq('id', id).select().single();
      kastaUv(svar); return svar.data;
    },

    async eydaUndirverk(u) {
      if (u.skra_slod) await sb.storage.from('vidhengi').remove([u.skra_slod]);
      const svar = await sb.from('undirverk').delete().eq('id', u.id);
      kastaUv(svar);
    },

    /* Slóðin er <fyrirtaeki>/undirverk/<task>/<undirverk>/<nafn>. Gagnagrunnurinn
       hafnar annarri slóð, og fyrirtækið er tekið úr undirverkinu sjálfu. */
    async skraAUndirverk(u, fyrirtaeki_id, skra) {
      const hreintNafn = skra.name.replace(/[^\w.\- ]+/g, '_').slice(-120) || 'skra';
      const slod = (u.fyrirtaeki_id || fyrirtaeki_id) + '/undirverk/' + u.task_id + '/' + u.id + '/'
        + Date.now() + '-' + hreintNafn;
      const upp = await sb.storage.from('vidhengi')
        .upload(slod, skra, { upsert: false, contentType: skra.type || undefined });
      if (upp.error) throw new Error(undirverkVilla(upp.error));
      const svar = await sb.from('undirverk').update({
        skra_slod: slod, skra_nafn: skra.name.slice(0, 300), skra_staerd: skra.size
      }).eq('id', u.id).select().single();
      if (svar.error) {
        await sb.storage.from('vidhengi').remove([slod]);
        kastaUv(svar);
      }
      /* Gamla skráin fer þegar ný kemur í staðinn */
      if (u.skra_slod && u.skra_slod !== slod) await sb.storage.from('vidhengi').remove([u.skra_slod]);
      return svar.data;
    },

    /* Hlekkurinn gildir í eina mínútu, bara til að opna skrána núna */
    async slodAUndirverki(u) {
      const svar = await sb.storage.from('vidhengi').createSignedUrl(u.skra_slod, 60);
      if (svar.error) throw new Error(undirverkVilla(svar.error));
      return svar.data.signedUrl;
    },

    /* ---------- Okkar eigin listi ---------- */

    async innriTaskar() {
      const svar = await sb.from('innri_taskar')
        .select('*, abyrgd_notandi:abyrgd(nafn), ' + fk('fyrirtaeki') + '(nafn)')
        .order('stofnad', { ascending: false });
      kasta(svar); return svar.data;
    },

    async nyrInnriTask(task) {
      const ek = await eg();
      const svar = await sb.from('innri_taskar').insert({
        titill: task.titill,
        lysing: task.lysing || null,
        stada: task.stada || 'nytt',
        forgangur: task.forgangur || 'venjulegt',
        abyrgd: task.abyrgd || null,
        fyrirtaeki_id: task.fyrirtaeki_id || null,
        skiladagur: task.skiladagur || null,
        hofundur: ek.id
      }).select('*, abyrgd_notandi:abyrgd(nafn), ' + fk('fyrirtaeki') + '(nafn)').single();
      kasta(svar); return svar.data;
    },

    async uppfaeraInnriTask(id, breytingar) {
      const svar = await sb.from('innri_taskar').update(utanStofu(breytingar)).eq('id', id)
        .select('*, abyrgd_notandi:abyrgd(nafn), ' + fk('fyrirtaeki') + '(nafn)').single();
      kasta(svar); return svar.data;
    },

    async eydaInnriTask(id) {
      const svar = await sb.from('innri_taskar').delete().eq('id', id);
      kasta(svar);
    },

    /* ---------- Fyrirspurnir af vefnum ---------- */

    async fyrirspurnir() {
      const svar = await sb.from('fyrirspurnir')
        .select('*, abyrgd_notandi:abyrgd(nafn)')
        .order('stofnad', { ascending: false });
      kasta(svar); return svar.data;
    },

    async uppfaeraFyrirspurn(id, breytingar) {
      const svar = await sb.from('fyrirspurnir').update(utanStofu(breytingar)).eq('id', id)
        .select('*, abyrgd_notandi:abyrgd(nafn)').single();
      kasta(svar); return svar.data;
    },

    async eydaFyrirspurn(id) {
      const svar = await sb.from('fyrirspurnir').delete().eq('id', id);
      kasta(svar);
    },

    /* ---------- Bókhald: samningar, aukaverkefni, taxtar ---------- */

    async bokhald(tafla) {
      const svar = await sb.from(tafla).select('*');
      kasta(svar); return svar.data;
    },

    /* samningar og aukaverkefni taka líka fyrirtaeki_id (reikningsdrög) */
    async vistaBokhald(tafla, rod) {
      const hrein = utanStofu(rod);
      const svar = hrein.id
        ? await sb.from(tafla).update(hrein).eq('id', hrein.id).select().single()
        : await sb.from(tafla).insert(hrein).select().single();
      kasta(svar); return svar.data;
    },

    async eydaBokhald(tafla, id) {
      const svar = await sb.from(tafla).delete().eq('id', id);
      kasta(svar);
    },

    /* ---------- Merki viðskiptavinarins ---------- */

    async setjaMerki(fyrirtaeki_id, skra) {
      /* Sömu gerðir og merki fatan tekur við (skref 5): png, jpg og webp */
      const endir = MERKI_GERDIR[skra && skra.type];
      if (!endir) throw new Error('Merkið þarf að vera png, jpg eða webp mynd.');
      const slod = fyrirtaeki_id + '/merki-' + Date.now() + '.' + endir;

      const upp = await sb.storage.from('merki')
        .upload(slod, skra, { upsert: true, contentType: skra.type || undefined });
      if (upp.error) throw new Error(upp.error.message);

      const { data: opin } = sb.storage.from('merki').getPublicUrl(slod);
      const svar = await sb.from('fyrirtaeki')
        .update({ merki_url: opin.publicUrl }).eq('id', fyrirtaeki_id).select().single();
      kasta(svar);

      /* Hausinn les úr minninu, svo það þarf að fylgja með */
      if (minn && minn.fyrirtaeki && minn.fyrirtaeki.id === fyrirtaeki_id) {
        minn.fyrirtaeki.merki_url = opin.publicUrl;
      }
      return svar.data;
    },

    async hendaMerki(fyrirtaeki_id) {
      const svar = await sb.from('fyrirtaeki')
        .update({ merki_url: null }).eq('id', fyrirtaeki_id).select().single();
      kasta(svar);
      if (minn && minn.fyrirtaeki && minn.fyrirtaeki.id === fyrirtaeki_id) {
        minn.fyrirtaeki.merki_url = null;
      }
      return svar.data;
    },

    /* ---------- Tölfræði ----------
       Bara við skrifum (RLS). Viðskiptavinur les sitt fyrirtæki og sér
       bara sendar skýrslur. fyrirtaeki_id á mælingum og færslum er sett í
       gagnagrunninum úr miðlinum, sama hvað við sendum. */

    async midlar(fyrirtaeki_id) {
      const svar = await sb.from('midlar').select('*')
        .eq('fyrirtaeki_id', fyrirtaeki_id).order('midill').order('nafn');
      kastaTf(svar); return svar.data;
    },

    async nyrMidill(m) {
      const svar = await sb.from('midlar').insert({
        fyrirtaeki_id: m.fyrirtaeki_id, midill: m.midill,
        nafn: String(m.nafn || '').trim().slice(0, 120),
        ytra_id: m.ytra_id ? String(m.ytra_id).trim().slice(0, 100) : null,
        slod: m.slod ? String(m.slod).trim().slice(0, 500) : null,
        virkt: m.virkt !== false
      }).select().single();
      kastaTf(svar); return svar.data;
    },

    /* Facebook og Instagram í gegnum Zernio: slóð á innskráningu, og
       samstilling sem gerir tengda reikninga að miðlum (Edge fallið zernio) */
    async zernioTengja(fyrirtaeki_id, midill) {
      const svar = await kallaFall('zernio', { verk: 'tengja', fyrirtaeki_id, midill });
      if (!svar || typeof svar.slod !== 'string' || !/^https:\/\//.test(svar.slod)) throw fallVilla('Tengingin gekk ekki. Prófaðu aftur.', { kodi: 'villa' });
      return svar.slod;
    },
    async zernioSamstilla(fyrirtaeki_id) {
      const svar = await kallaFall('zernio', { verk: 'samstilla', fyrirtaeki_id });
      return Array.isArray(svar && svar.midlar) ? svar.midlar : [];
    },

    async uppfaeraMidil(id, breytingar) {
      const svar = await sb.from('midlar').update(utanStofu(breytingar)).eq('id', id).select().single();
      kastaTf(svar); return svar.data;
    },

    async eydaMidli(id) {
      const svar = await sb.from('midlar').delete().eq('id', id);
      kastaTf(svar);
    },

    /* Allar mælingar fyrirtækisins á bilinu [fra, til]. Supabase skilar
       mest 1000 línum í einu, svo sótt er í skömmtum. */
    async maelingar(fyrirtaeki_id, fra, til) {
      return allarLinur(() => sb.from('maelingar').select('*')
        .eq('fyrirtaeki_id', fyrirtaeki_id).gte('dags', fra).lte('dags', til)
        .order('dags').order('midill_id'));
    },

    /* Skrifar mælingar, ný lína eða uppfærð. Línur eru flokkaðar eftir
       hvaða tölur þær hafa, svo tómur reitur skrifi aldrei yfir gamla tölu. */
    async vistaMaelingar(rows) {
      const hopar = new Map();
      for (const r of rows || []) {
        const lina = hreinMaeling(r);
        if (!lina) continue;
        lina.uppfaert = new Date().toISOString();
        const lykill = Object.keys(lina).sort().join(',');
        if (!hopar.has(lykill)) hopar.set(lykill, []);
        hopar.get(lykill).push(lina);
      }
      let skrifad = 0;
      for (const hopur of hopar.values()) {
        for (let i = 0; i < hopur.length; i += 500) {
          const skammtur = hopur.slice(i, i + 500);
          const svar = await sb.from('maelingar').upsert(skammtur, { onConflict: 'midill_id,dags' });
          kastaTf(svar);
          skrifad += skammtur.length;
        }
      }
      return skrifad;
    },

    /* Færslur birtar á bilinu, mest skoðuðu fyrst */
    async midlaFaerslur(fyrirtaeki_id, fra, til) {
      const eftir = new Date(til + 'T00:00:00Z');
      eftir.setUTCDate(eftir.getUTCDate() + 1);
      const svar = await sb.from('midla_faerslur').select('*')
        .eq('fyrirtaeki_id', fyrirtaeki_id)
        .gte('birt', fra + 'T00:00:00Z').lt('birt', eftir.toISOString())
        .order('ahorf', { ascending: false, nullsFirst: false })
        .limit(300);
      kastaTf(svar); return svar.data;
    },

    async skyrslur(fyrirtaeki_id) {
      const svar = await sb.from('skyrslur').select('*')
        .eq('fyrirtaeki_id', fyrirtaeki_id).order('manudur', { ascending: false });
      kastaTf(svar); return svar.data;
    },

    async uppfaeraSkyrslu(id, breytingar) {
      const svar = await sb.from('skyrslur').update(utanStofu(breytingar)).eq('id', id).select().single();
      kastaTf(svar); return svar.data;
    },

    async sendaTolfraedi(rod) {
      const svar = await sb.from('tolfraedi_sendingar').insert(utanStofu(rod)).select('id, stada').single();
      kastaTf(svar); return svar.data;
    },

    /* ---------- Myndböndin (kafli 23) ----------
       Hvert myndband með tölum á mánuði. Tengt færslu frá Meta fyllast
       tölurnar sjálfkrafa í gagnagrunninum, annars skráðar í höndunum. */
    async myndbond(fyrirtaeki_id) {
      const svar = await sb.from('myndbond').select('*, tolur:' + fk('myndband_tolur', 'myndband_id') + '(*)')
        .eq('fyrirtaeki_id', fyrirtaeki_id)
        .order('birt', { ascending: false, nullsFirst: false }).order('stofnad', { ascending: false });
      kastaTf(svar); return svar.data;
    },

    async nyttMyndband(m) {
      const svar = await sb.from('myndbond').insert({ fyrirtaeki_id: m.fyrirtaeki_id, ...hreintMyndband(m) })
        .select('*, tolur:' + fk('myndband_tolur', 'myndband_id') + '(*)').single();
      kastaTf(svar); return svar.data;
    },

    async uppfaeraMyndband(id, m) {
      const svar = await sb.from('myndbond').update(hreintMyndband(m)).eq('id', id)
        .select('*, tolur:' + fk('myndband_tolur', 'myndband_id') + '(*)').single();
      kastaTf(svar); return svar.data;
    },

    async eydaMyndbandi(id) {
      const svar = await sb.from('myndbond').delete().eq('id', id);
      kastaTf(svar);
    },

    /* Tölur á mánuði skráðar í höndunum. Handvirk lína stendur þótt Meta uppfærist. */
    async vistaMyndbandstolur(rows) {
      const linur = (rows || []).map(hreinMyndbandstala).filter(Boolean);
      if (!linur.length) return 0;
      const svar = await sb.from('myndband_tolur').upsert(linur, { onConflict: 'myndband_id,manudur' });
      kastaTf(svar); return linur.length;
    },

    async eydaMyndbandstolu(myndband_id, manudur) {
      const svar = await sb.from('myndband_tolur').delete().eq('myndband_id', myndband_id).eq('manudur', manudur);
      kastaTf(svar);
    },

    /* ---------- Samskipti: Gmail pósthólfið (kafli 24) ----------
       Apps Script afritar pósthólfið hingað á 5 mínútna fresti. Bara
       stjórnendur sjá það. Svar bíður í postholf_svor og fer frá tveir@tveir.is. */
    /* uppruni: 'gmail' (pósthólf Tveir) eða 'verk' (Verkpóstur annarra stofa) */
    async postholf() {
      const dalkar = 'id, efni, fra_nafn, fra_netfang, snid, sidast, fjoldi, olesid_gmail, lesid_kerfi, tengill, fyrirtaeki_id, fyr:' + fk('fyrirtaeki') + '(nafn)';
      const saekja = (d) => sb.from('postholf_thraedir').select(d).order('sidast', { ascending: false }).limit(200);
      let svar = await saekja(dalkar + ', uppruni');
      if (svar.error && /uppruni/.test(String(svar.error.message || ''))) svar = await saekja(dalkar);
      kastaPost(svar);
      return (svar.data || []).map((t) => ({ ...t, uppruni: t.uppruni || 'gmail' }));
    },

    async postholfThradur(id) {
      const [skilabod, svor] = await Promise.all([
        sb.from('postholf_skilabod').select('*').eq('thradur_id', id).order('dags'),
        sb.from('postholf_svor').select('id, texti, stada, villa, stofnad, sent_dags').eq('thradur_id', id).order('stofnad')
      ]);
      kastaPost(skilabod); kastaPost(svor);
      return { skilabod: skilabod.data, svor: svor.data };
    },

    async merkjaPostLesinn(id) {
      const svar = await sb.from('postholf_thraedir').update({ lesid_kerfi: new Date().toISOString() }).eq('id', id);
      kastaPost(svar);
    },

    async svaraPosti(thradur_id, texti, html) {
      const svar = await sb.from('postholf_svor').insert({ thradur_id, texti: String(texti || '').slice(0, 10000),
        html: html ? String(html).slice(0, 60000) : null })
        .select('id, texti, stada, villa, stofnad, sent_dags').single();
      kastaPost(svar); return svar.data;
    },

    /* Nýr póstur frá tveir@tveir.is (kafli 26). Netföngin eru athuguð í gagnagrunninum. */
    async nyrPostur({ til, efni, texti, html }) {
      const svar = await sb.from('postholf_svor').insert({ til: String(til || '').slice(0, 2000), efni: String(efni || '').slice(0, 200),
        texti: String(texti || '').slice(0, 10000), html: html ? String(html).slice(0, 60000) : null })
        .select('id, stada').single();
      kastaPost(svar); return svar.data;
    },

    /* Google Calendar fundirnir (kafli 27), frá 45 dögum aftur */
    async dagatal() {
      const fra = new Date(Date.now() - 45 * 864e5).toISOString();
      const svar = await sb.from('dagatal_atburdir').select('*').gte('byrjar', fra).order('byrjar').limit(1500);
      if (svar.error && /does not exist|schema cache/i.test(String(svar.error.message))) return null;
      kastaPost(svar); return svar.data;
    },

    /* Undirskrift stjórnandans, fylgir á milli tækja (kafli 25) */
    async undirskrift() {
      const svar = await sb.from('undirskriftir').select('gogn').maybeSingle();
      if (svar.error) { if (/does not exist|schema cache/i.test(String(svar.error.message))) return null; kastaPost(svar); }
      return svar.data ? svar.data.gogn : null;
    },

    async vistaUndirskrift(gogn) {
      const notandi = minn && minn.id;
      const svar = await sb.from('undirskriftir').upsert({ notandi_id: notandi, gogn, uppfaert: new Date().toISOString() }, { onConflict: 'notandi_id' });
      kastaPost(svar);
    },

    /* Tengingar með API lykli (kafli 28). Lykillinn fer í Supabase Vault og
       kemur aldrei aftur út: hér sést bara hvort tengt sé og síðustu 4 stafirnir. */
    async tengingarStada() {
      const svar = await sb.rpc('tengingar_stada');
      if (svar.error) { if (/does not exist|could not find|schema cache/i.test(String(svar.error.message))) return null; kasta(svar); }
      const ut = {}; (svar.data || []).forEach((r) => { ut[r.veita] = r; }); return ut;
    },
    async vistaTengingu(veita, stillingar, leyndo) {
      const svar = await sb.rpc('vista_tengingu', { p_veita: veita, p_stillingar: stillingar || {}, p_leyndo: leyndo || null });
      if (svar.error && /could not find|schema cache/i.test(String(svar.error.message))) throw new Error('Tengingarnar eru ekki komnar í gagnagrunninn. Keyrðu migrations/2026-11-19-tengingar.sql í Supabase.');
      kasta(svar);
    },
    async eydaTengingu(veita) { kasta(await sb.rpc('eyda_tengingu', { p_veita: veita })); },
    /* Stillingar sem gilda fyrir allt kerfið, t.d. gjaldmiðill bókhaldsins */
    async kerfisstillingar() {
      const svar = await sb.from('kerfisstillingar').select('lykill, gildi');
      if (svar.error) return null;
      const ut = {}; (svar.data || []).forEach((r) => { ut[r.lykill] = r.gildi; }); return ut;
    },
    async vistaKerfisstillingu(lykill, gildi) {
      const svar = await sb.from('kerfisstillingar').upsert({ lykill, gildi, uppfaert: new Date().toISOString() });
      if (svar.error && /does not exist|could not find|schema cache/i.test(String(svar.error.message))) throw new Error('Kerfisstillingarnar eru ekki komnar í gagnagrunninn. Keyrðu migrations/2026-11-20-kerfisstillingar.sql í Supabase.');
      kastaSt(svar);
    },
    /* Prófar vistaða lykilinn hjá veitunni (Edge Function profa-tengingu).
       Lykillinn er lesinn úr Vault á þjóninum og kemur aldrei hingað. */
    async profaTengingu(veita) {
      const { data, error } = await sb.functions.invoke('profa-tengingu', { body: { veita } });
      if (!error) return data || { ok: false, svar: 'Ekkert svar frá prófuninni' };
      try { const svar = await error.context.json(); if (svar && svar.svar) return svar; } catch (e) { /* ekki JSON */ }
      return { ok: false, svar: 'Lykillinn er vistaður, en prófunin náði ekki sambandi. Ýttu á Prófa aftur eftir smá stund.' };
    },

    /* ==================================================================
       Stofan (kafli 8.1). Allt hér fylgir innskráðum notanda: gagnagrunnurinn
       finnur stofuna út frá lotunni og stofa_id er aldrei sent.
       ================================================================== */

    /* Stofan úr prófílnum: { id, nafn, slug, stada, netfang, merki_url, litur,
       vefur, postholf, sendir_fra, einingar, stillingar, uppsetning, verk,
       verk_netfong }. null ef notandinn er ekki í neinni stofu. */
    async stofa() {
      const ek = await eg();
      return (ek && ek.stofa) || null;
    },

    /* Fersk staða úr min_stada(): stofa_id, stada, er_admin, er_eigandi, slug,
       nafn, postholf, google_tilbuid, meta_tilbuid, tiktok_tilbuid,
       er_rekstraradili. null ef fallið er ekki til eða enginn er inni. */
    async minStada() {
      const svar = await sb.rpc('min_stada');
      if (svar.error) return null;
      const ms = hreinMinStada(svar.data);
      if (minn) { minn = { ...minn, min_stada: ms }; geymaEg(minn); }
      return ms;
    },

    /* Bara stjórnendur stofunnar (RLS). Skilar uppfærðri stofu. */
    async vistaStofu(breytingar) {
      let ek = await minStofaId();
      /* stillingar og uppsetning leggjast ofan á það sem er til: lesið ferskt
         svo annar stjórnandi (eða annar flipi) missi ekki sitt */
      if (breytingar && (breytingar.stillingar !== undefined || breytingar.uppsetning !== undefined)) {
        const ferskt = await eg({ ferskt: true });
        if (ferskt && ferskt.stofa_id === ek.stofa_id) ek = ferskt;
      }
      /* Sama regla og merki_url í gagnagrunninum: bara okkar eigin merkjageymsla */
      const merkiSlodir = [sb.storage.from('merki').getPublicUrl('x').data.publicUrl.replace(/x$/, ''),
                           'https://tveir.is/assets/img/'];
      const hrein = hreinStofubreyting(breytingar, ek.stofa, { merkiSlodir });
      const svar = await sb.from('stofur').update(hrein).eq('id', ek.stofa_id)
        .select(STOFA_DALKAR).maybeSingle();
      kastaSt(svar);
      if (!svar.data) throw new Error('Bara stjórnendur stofunnar geta breytt henni.');
      const stofa = hreinStofa(svar.data, ek.min_stada);
      if (minn && minn.id === ek.id) { minn = { ...minn, stofa }; geymaEg(minn); }
      return stofa;
    },

    /* Merki stofunnar: merki/stofa-<id>/merki-<tími>.<endir>, png, jpg eða webp, mest 2 MB */
    async setjaStofuMerki(skra) {
      const ek = await minStofaId();
      const GERDIR = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
      if (!skra || !GERDIR[skra.type]) throw new Error('Merkið þarf að vera png, jpg eða webp mynd.');
      if (skra.size > 2 * 1024 * 1024) throw new Error('Merkið má vera mest 2 MB.');
      const slod = 'stofa-' + ek.stofa_id + '/merki-' + Date.now() + '.' + GERDIR[skra.type];
      const upp = await sb.storage.from('merki').upload(slod, skra, { upsert: false, contentType: skra.type });
      if (upp.error) throw new Error(stofuVilla(upp.error));
      const { data: opin } = sb.storage.from('merki').getPublicUrl(slod);
      const gamalt = ek.stofa && ek.stofa.merki_url;
      let stofa;
      try {
        stofa = await this.vistaStofu({ merki_url: opin.publicUrl });
      } catch (villa) {
        await sb.storage.from('merki').remove([slod]);
        throw villa;
      }
      await hendaGomluMerki(gamalt, ek.stofa_id);
      return stofa;
    },

    async hendaStofuMerki() {
      const ek = await minStofaId();
      const gamalt = ek.stofa && ek.stofa.merki_url;
      const stofa = await this.vistaStofu({ merki_url: null });
      await hendaGomluMerki(gamalt, ek.stofa_id);
      return stofa;
    },

    /* [{ netfang, stofnad }], aðalnetfangið <slug>@verk.tveir.is fyrst */
    async verkNetfong() {
      const listi = await lesaNytt(sb.from('verk_netfong').select('netfang, stofnad').order('stofnad'));
      const ek = await eg();
      const adal = ek && ek.stofa && ek.stofa.verk;
      return listi.sort((a, b) => (b.netfang === adal) - (a.netfang === adal));
    },

    /* Síðustu 20 ákvarðanir vélarinnar um innkominn verkpóst:
       [{ dags, nidurstada, fjoldi, stadfesting_slod }]. Bara stjórnendur. */
    async verkpostStada() {
      return lesaNytt(sb.from('postur_inn_log')
        .select('dags, nidurstada, fjoldi, stadfesting_slod')
        .order('dags', { ascending: false }).limit(20));
    },

    /* Edge Function bjoda-notanda. Skilar { ok: true, texti } eða kastar
       (t.d. 409: ekki hægt að bjóða netfanginu, 429: hámark boða á dag). */
    async bjodaNotanda(bod) {
      const hreint = hreintBod(bod);
      const svar = await kallaFall('bjoda-notanda', hreint);
      return { ...svar, ok: true, texti: svar.texti || svar.svar || ('Boð fór á ' + hreint.netfang + '.') };
    },

    /* Ónotuð boð stofunnar, nýjast fyrst. runnid_ut segir hvort boðið gildir enn. */
    async bod() {
      const listi = await lesaNytt(sb.from('bod')
        .select('id, netfang, nafn, hlutverk, fyrirtaeki_id, er_eigandi, stofnad, utrunnid, notad, fyrirtaeki:' + fk('fyrirtaeki') + '(nafn)')
        .is('notad', null).order('stofnad', { ascending: false }).limit(200));
      const nu = Date.now();
      return listi.map((b) => ({ ...b, runnid_ut: new Date(b.utrunnid).getTime() < nu }));
    },

    async eydaBodi(id) {
      kastaSt(await sb.from('bod').delete().eq('id', id));
    },

    /* Verkpóstsþráður verður að verkum hjá fyrirtæki. Skilar svari fallsins,
       t.d. { ok: true, fjoldi, titlar }. */
    async verkUrThraedi(thradur_id, fyrirtaeki_id) {
      if (!thradur_id) throw new Error('Þráðinn vantar.');
      if (!fyrirtaeki_id) throw new Error('Veldu fyrirtæki fyrst.');
      const svar = await sb.rpc('verk_ur_thraedi', { p_thradur_id: thradur_id, p_fyrirtaeki_id: fyrirtaeki_id });
      kastaSt(svar);
      const d = hlutur(svar.data);
      if (d.ok === false) throw fallVilla(d.svar || 'Þetta gekk ekki. Prófaðu aftur.', { kodi: d.villa || null });
      return { ok: true, ...d };
    },

    /* Það sem má rukka í mánuðinum (YYYY-MM): { ok, manudur, efni: [{ uppruni,
       id, heiti, fyrirtaeki_id, fyrirtaeki, kennitala, upphaed, vsklaust, ... }] } */
    async reikningsefni(manudur) {
      const m = manudur || new Date().toISOString().slice(0, 7);
      if (!MANUDUR.test(m)) throw new Error('Mánuðurinn á að vera á forminu 2026-11.');
      return hreintReikningsefni(await kallaFall('reikningar', { verk: 'tilbuid', manudur: m }), m);
    },

    /* Býr til DRÖG í Payday eða DK. Ekkert er bókað eða sent á viðskiptavin.
       Skilar { ok, drog, texti, svar, adur? } eða kastar. Fallið svarar með
       svar, texti er sama setning svo síðurnar lesi alltaf texti. Ef drög eru
       þegar til hjá hinni veitunni fylgja þau villunni í villa.gogn.drog. */
    async reikningsdrog(beidni) {
      const svar = await kallaFall('reikningar', hreinDrog(beidni));
      const texti = svar.texti || svar.svar || 'Drögin eru tilbúin.';
      return { ...svar, ok: true, texti, svar: svar.svar || texti };
    },

    /* Drög stofunnar, nýjast fyrst. Valfrjálst: { manudur: 'YYYY-MM', uppruni, uppruni_id }. */
    async reikningar(sia) {
      const s = hlutur(sia);
      let q = sb.from('reikningsdrog')
        .select('id, veita, uppruni, uppruni_id, manudur, fyrirtaeki_id, linur, upphaed, stada, ytra_id, ytra_numer, ytri_slod, villa, stofnad, uppfaert, fyrirtaeki:' + fk('fyrirtaeki') + '(nafn)')
        .order('stofnad', { ascending: false }).limit(500);
      if (s.manudur && MANUDUR.test(s.manudur)) q = q.eq('manudur', s.manudur + '-01');
      if (s.uppruni) q = q.eq('uppruni', s.uppruni);
      if (s.uppruni_id) q = q.eq('uppruni_id', s.uppruni_id);
      return lesaNytt(q);
    },

    /* Shopify, bara lestur. verk: yfirlit, pantanir, vorur, lager. eftir: bendill
       á næstu síðu (svarið segir meira og eftir). */
    async shopify(verk, eftir) {
      if (!SHOPIFY_VERK.includes(verk)) throw new Error('Óþekkt aðgerð í versluninni.');
      return kallaFall('shopify', eftir ? { verk, eftir: String(eftir) } : { verk });
    },

    /* Drög eða samantekt frá gervigreind stofunnar. Ekkert er sent sjálfkrafa.
       Skilar { ok, texti, ... } eða kastar. */
    async gervigreind(verk, id) {
      if (!GERVIGREIND_VERK.includes(verk)) throw new Error('Óþekkt aðgerð.');
      if (!id) throw new Error('Það vantar hvað á að vinna með.');
      return kallaFall('gervigreind', { verk, id: String(id) });
    },

    /* Tölur lesnar úr skjáskotum af tölfræði (Edge Function greina-skjaskot).
       myndir: [{ gerd: 'image/jpeg', gogn: '<base64>' }]. Myndirnar eru ekki
       vistaðar neins staðar. Skilar { midlar, faerslur, timabil, samantekt, oljost }. */
    async greinaSkjaskot(fyrirtaeki_id, myndir, lysing) {
      if (!fyrirtaeki_id) throw new Error('Veldu fyrirtæki fyrst.');
      if (!Array.isArray(myndir) || !myndir.length) throw new Error('Settu inn að minnsta kosti eitt skjáskot.');
      return kallaFall('greina-skjaskot', { fyrirtaeki_id, myndir, lysing: String(lysing || '').slice(0, 300) });
    },

    /* Rekstraraðili Glerhússins. Allt fer í Edge Function rekstur sem
       { adgerd, ...gogn }: yfirlit, samthykkja, loka, opna, skraning, postur,
       utflutningur, eyda.
       'yfirlit' skilar lista af stofum (stofur_yfirlit: bara lýsigögn og fjöldi)
       sem ber líka .stofur, .an_stofu (notendur án stofu) og .skraning_opin.
       Sé fallið ekki komið upp er lesið beint úr stofur_yfirlit (þá er
       an_stofu tómt og skraning_opin null). */
    async rekstur(adgerd, gogn) {
      if (adgerd === 'yfirlit') {
        let d;
        try {
          d = await kallaFall('rekstur', { adgerd: 'yfirlit' });
        } catch (villa) {
          if (villa.kodi !== 'vantar') throw villa;
          const svar = await sb.rpc('stofur_yfirlit');
          kastaSt(svar);
          d = { stofur: svar.data || [], an_stofu: [], skraning_opin: null };
        }
        const stofur = Array.isArray(d.stofur) ? d.stofur : [];
        return Object.assign([...stofur], {
          ok: true, stofur,
          an_stofu: Array.isArray(d.an_stofu) ? d.an_stofu : [],
          skraning_opin: typeof d.skraning_opin === 'boolean' ? d.skraning_opin : null
        });
      }
      if (!/^[a-z_]{2,30}$/.test(String(adgerd || ''))) throw new Error('Óþekkt aðgerð.');
      return kallaFall('rekstur', { ...utanStofu(hlutur(gogn)), adgerd });
    },

    /* OAuth tenging (google, meta, tiktok, shopify). Skilar { ok, slod }: síðan
       sendir notandann á slod. Bíður samþykkis hjá Google, Meta og TikTok. */
    async oauthByrja(veita) {
      if (!VEITUR_OAUTH.includes(veita)) throw new Error('Óþekkt tenging.');
      const svar = await kallaFall('oauth?skref=byrja&veita=' + encodeURIComponent(veita), { veita });
      const slod = svar.slod || svar.url;
      if (!/^https:\/\/\S+$/.test(String(slod || ''))) throw new Error('Tengingin skilaði ekki slóð. Prófaðu aftur.');
      return { ...svar, ok: true, slod };
    }
  };

  function kastaPost({ error }) {
    if (!error) return;
    const bod = String(error.message || '');
    if (error.code === '42P01' || /does not exist|could not find the table|schema cache/i.test(bod)) {
      throw new Error('Pósthólfið er ekki komið í gagnagrunninn. Keyrðu migrations/2026-11-19-samskipti.sql í Supabase.');
    }
    if (/[þðæöáéíóúý]/i.test(bod)) throw new Error(bod);
    if (/row-level security|permission denied/i.test(bod)) throw new Error('Þú hefur ekki aðgang að pósthólfinu.');
    throw new Error('Þetta gekk ekki. Prófaðu aftur.');
  }

  function kastaTf({ error }) { if (error) throw new Error(tolfraediVilla(error)); }

  async function allarLinur(smidur) {
    const SKAMMTUR = 1000;
    const ut = [];
    for (let fra = 0; fra < 50000; fra += SKAMMTUR) {
      const svar = await smidur().range(fra, fra + SKAMMTUR - 1);
      kastaTf(svar);
      ut.push(...(svar.data || []));
      if (!svar.data || svar.data.length < SKAMMTUR) break;
    }
    return ut;
  }
}

/* ==========================================================================
   Prufudæmi: lifir í localStorage svo breytingar haldast milli endurhleðslna
   ========================================================================== */

function prufuBakendi() {
  const LYKILL = 'tveir-vinnusvaedi-prufa';

  const sjalfgefid = () => {
    const nu = Date.now();
    const dagur = 86400000;
    const dags = (n) => new Date(nu + n * dagur).toISOString();
    const dagsetning = (n) => new Date(nu + n * dagur).toISOString().slice(0, 10);

    const fyr = [
      { id: 'f1', nafn: 'Hlíðarkaup',      askrift: 'Efni og samfélagsmiðlar',
        er_askrift: true,  askrift_verd: 290000, merki_url: null,
        kennitala: '5501069990', reikningsnetfang: 'bokhald@hlidarkaup.is' },
      { id: 'f2', nafn: 'Steinvík ehf.', askrift: 'Vefsíða í áskrift',
        er_askrift: true,  askrift_verd: 45000, merki_url: null,
        kennitala: '6602119990', reikningsnetfang: null },
      { id: 'f3', nafn: 'Fossberg ehf.',     askrift: 'Sölutækifæri',
        er_askrift: false, askrift_verd: null, merki_url: null,
        kennitala: null, reikningsnetfang: null }
    ];

    const notendur = [
      { id: 'u-mirza', nafn: 'Sara Jónsdóttir', netfang: 'sara@nordurljos.is', hlutverk: 'admin', fyrirtaeki_id: null },
      { id: 'u-oskar', nafn: 'Baldur Einarsson', netfang: 'baldur@nordurljos.is', hlutverk: 'admin', fyrirtaeki_id: null },
      { id: 'u-haf',   nafn: 'Anna Jónsdóttir', netfang: 'anna@steinvik.is', hlutverk: 'vidskiptavinur', fyrirtaeki_id: 'f2' },
      { id: 'u-kron',  nafn: 'Páll Guðmundsson', netfang: 'pall@hlidarkaup.is', hlutverk: 'vidskiptavinur', fyrirtaeki_id: 'f1' }
    ];

    const verkefni = [
      { id: 'v1', fyrirtaeki_id: 'f2', titill: 'Ný vefsíða',
        lysing: 'Fimm undirsíður, vöruyfirlit og form fyrir fyrirspurnir.',
        stada: 'i_vinnslu', framvinda: 65, skiladagur: dagsetning(12),
        budget: 900000, innan_samnings: false, verd_okkar: 850000,
        hofundur: 'u-mirza', svar_admin: null, stofnad: dags(-24), uppfaert: dags(-2) },
      { id: 'v2', fyrirtaeki_id: 'f2', titill: 'Reels fyrir desember',
        lysing: 'Fjögur reels, tökudagur í stúdíói.',
        stada: 'bid_svar', framvinda: 30, skiladagur: dagsetning(20),
        budget: 350000, innan_samnings: false, verd_okkar: 320000,
        hofundur: 'u-oskar', svar_admin: null, stofnad: dags(-9), uppfaert: dags(-1) },
      { id: 'v3', fyrirtaeki_id: 'f2', titill: 'Jólakynning á póstlista',
        lysing: 'Við viljum þrjá sölupósta fyrir jólin, fyrsti út 1. desember.',
        stada: 'tillaga', framvinda: 0, skiladagur: dagsetning(30),
        budget: 250000, innan_samnings: false, verd_okkar: null,
        hofundur: 'u-haf', svar_admin: null, stofnad: dags(-1), uppfaert: dags(-1) },
      { id: 'v4', fyrirtaeki_id: 'f1', titill: 'Nýtt merki á sendibíla',
        lysing: 'Þarf skilaskrár fyrir prentsmiðju.',
        stada: 'tillaga', framvinda: 0, skiladagur: null,
        budget: null, innan_samnings: true, verd_okkar: null,
        hofundur: 'u-kron', svar_admin: null, stofnad: dags(-3), uppfaert: dags(-3) },
      { id: 'v5', fyrirtaeki_id: 'f1', titill: 'Efnispakki nóvember',
        lysing: 'Tólf færslur og tvö reels.',
        stada: 'lokid', framvinda: 100, skiladagur: dagsetning(-4),
        budget: null, innan_samnings: true, verd_okkar: null,
        hofundur: 'u-mirza', svar_admin: null, stofnad: dags(-40), uppfaert: dags(-4) },
      { id: 'v6', fyrirtaeki_id: 'f3', titill: 'Lendingarsíða og auglýsingar',
        lysing: 'Ein síða, þremur auglýsingum og eftirfylgni í pósti.',
        stada: 'lokid', framvinda: 100, skiladagur: dagsetning(-11),
        budget: 400000, innan_samnings: false, verd_okkar: 420000,
        hofundur: 'u-mirza', svar_admin: null, stofnad: dags(-52), uppfaert: dags(-11) }
    ];

    const taskar = [
      { id: 't1', rod: 2, fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Senda logo í vektor',
        lysing: 'Við þurfum .ai eða .svg skrá, png dugar ekki í prentun.',
        stada: 'bid_vidskiptavinar', forgangur: 'hatt', abyrgd: 'u-haf', hofundur: 'u-mirza',
        skiladagur: dagsetning(2), lokid_dags: null, stofnad: dags(-5), uppfaert: dags(-5) },
      { id: 't2', rod: 3, fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Skrifa texta á Um okkur',
        lysing: 'Stutt, fjórar til fimm línur. Við getum skrifað hann ef þú vilt.',
        stada: 'bid_vidskiptavinar', forgangur: 'venjulegt', abyrgd: 'u-haf', hofundur: 'u-oskar',
        skiladagur: dagsetning(5), lokid_dags: null, stofnad: dags(-5), uppfaert: dags(-5) },
      { id: 't3', rod: 4, fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Setja upp vöruyfirlit',
        lysing: null, stada: 'i_vinnslu', forgangur: 'venjulegt', abyrgd: 'u-mirza', hofundur: 'u-mirza',
        skiladagur: dagsetning(4), lokid_dags: null, stofnad: dags(-6), uppfaert: dags(-1) },
      { id: 't4', rod: 1, fyrirtaeki_id: 'f2', verkefni_id: 'v2', titill: 'Velja tökudag',
        lysing: 'Við erum laus 11. eða 13. Hvor dagur passar betur?',
        stada: 'bid_vidskiptavinar', forgangur: 'hatt', abyrgd: 'u-haf', hofundur: 'u-oskar',
        skiladagur: dagsetning(1), lokid_dags: null, stofnad: dags(-2), uppfaert: dags(-2) },
      { id: 't5', rod: 0, fyrirtaeki_id: 'f2', verkefni_id: null, titill: 'Breyta opnunartíma á síðunni',
        lysing: 'Við lokum kl. 16 á föstudögum frá og með næstu viku.',
        stada: 'nytt', forgangur: 'venjulegt', abyrgd: 'u-mirza', hofundur: 'u-haf',
        skiladagur: null, lokid_dags: null, stofnad: dags(-1), uppfaert: dags(-1) },
      { id: 't6', rod: 1, fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Tengja domain við Vercel',
        lysing: null, stada: 'lokid', forgangur: 'venjulegt', abyrgd: 'u-mirza', hofundur: 'u-mirza',
        skiladagur: dagsetning(-3), lokid_dags: dags(-3), stofnad: dags(-14), uppfaert: dags(-3) },
      { id: 't7', rod: 1, fyrirtaeki_id: 'f1', verkefni_id: 'v5', titill: 'Samþykkja færslur fyrir nóvember',
        lysing: null, stada: 'lokid', forgangur: 'venjulegt', abyrgd: 'u-kron', hofundur: 'u-mirza',
        skiladagur: dagsetning(-20), lokid_dags: dags(-18), stofnad: dags(-30), uppfaert: dags(-18) },
      { id: 't8', rod: 0, fyrirtaeki_id: 'f1', verkefni_id: null, titill: 'Uppfæra verð í auglýsingum',
        lysing: 'Verðið á kjúklingi fór úr 1.890 í 2.090.',
        stada: 'nytt', forgangur: 'hatt', abyrgd: 'u-oskar', hofundur: 'u-kron',
        skiladagur: dagsetning(1), lokid_dags: null, stofnad: dags(0), uppfaert: dags(0) },
      { id: 't9', rod: 2, fyrirtaeki_id: 'f2', verkefni_id: 'v2', titill: 'Klippa fjögur reels',
        lysing: 'Eitt reel á viku í desember. Hvert fer til ykkar um leið og það er klárt.',
        stada: 'i_vinnslu', forgangur: 'venjulegt', abyrgd: 'u-oskar', hofundur: 'u-oskar',
        skiladagur: dagsetning(14), lokid_dags: null, stofnad: dags(-3), uppfaert: dags(-1) }
    ];

    /* Undirverk: mörg skil innan eins tasks */
    const undirverk = [
      { id: 'uv1', task_id: 't9', fyrirtaeki_id: 'f2', rod: 1, titill: 'Reel 1: Opnunartilboð',
        lokid: true, lokid_dags: dags(-2), skra_slod: null, skra_nafn: null, skra_staerd: null,
        tengill: 'https://we.tl/t-sYnIdAEmI1', senda: true, sent_dags: dags(-2), stofnad: dags(-3) },
      { id: 'uv2', task_id: 't9', fyrirtaeki_id: 'f2', rod: 2, titill: 'Reel 2: Á bak við tjöldin',
        lokid: true, lokid_dags: dags(-1), skra_slod: 'prufa', skra_nafn: 'reel-2-bak-vid-tjoldin.mp4',
        skra_staerd: 38200000, tengill: null, senda: true, sent_dags: null, stofnad: dags(-3) },
      { id: 'uv3', task_id: 't9', fyrirtaeki_id: 'f2', rod: 3, titill: 'Reel 3: Starfsfólkið',
        lokid: false, lokid_dags: null, skra_slod: null, skra_nafn: null, skra_staerd: null,
        tengill: null, senda: true, sent_dags: null, stofnad: dags(-3) },
      { id: 'uv4', task_id: 't9', fyrirtaeki_id: 'f2', rod: 4, titill: 'Reel 4: Jólakveðja',
        lokid: false, lokid_dags: null, skra_slod: null, skra_nafn: null, skra_staerd: null,
        tengill: null, senda: true, sent_dags: null, stofnad: dags(-3) }
    ];

    /* Okkar eigin listi. Enginn viðskiptavinur kemur nálægt þessu. */
    const innri_taskar = [
      { id: 'i1', titill: 'Senda tilboðið á Fossberg',
        lysing: 'Lendingarsíða, þrjár auglýsingar og eftirfylgni. Verðið liggur fyrir.',
        stada: 'nytt', forgangur: 'hatt', abyrgd: 'u-mirza', hofundur: 'u-oskar',
        fyrirtaeki_id: 'f3', skiladagur: dagsetning(1), lokid_dags: null,
        stofnad: dags(-1), uppfaert: dags(-1) },
      { id: 'i2', titill: 'Klippa reels fyrir Steinvík',
        lysing: 'Fjögur stykki, efnið er á drifinu.',
        stada: 'i_vinnslu', forgangur: 'venjulegt', abyrgd: 'u-oskar', hofundur: 'u-oskar',
        fyrirtaeki_id: 'f2', skiladagur: dagsetning(3), lokid_dags: null,
        stofnad: dags(-4), uppfaert: dags(-1) },
      { id: 'i3', titill: 'Fara yfir bókhaldið fyrir mánuðinn',
        lysing: null, stada: 'nytt', forgangur: 'venjulegt', abyrgd: null, hofundur: 'u-mirza',
        fyrirtaeki_id: null, skiladagur: dagsetning(6), lokid_dags: null,
        stofnad: dags(-2), uppfaert: dags(-2) },
      { id: 'i4', titill: 'Bíður svars um lénið',
        lysing: 'Sendum fyrirspurn, heyrum ekkert fyrr en þeir svara.',
        stada: 'bid', forgangur: 'lagt', abyrgd: 'u-mirza', hofundur: 'u-mirza',
        fyrirtaeki_id: 'f1', skiladagur: null, lokid_dags: null,
        stofnad: dags(-7), uppfaert: dags(-5) },
      { id: 'i5', titill: 'Setja nýju verkefnin inn á vefinn',
        lysing: null, stada: 'lokid', forgangur: 'venjulegt', abyrgd: 'u-mirza', hofundur: 'u-oskar',
        fyrirtaeki_id: null, skiladagur: dagsetning(-3), lokid_dags: dags(-2),
        stofnad: dags(-12), uppfaert: dags(-2) }
    ];

    const athugasemdir = [
      { id: 'a1', task_id: 't1', hofundur: 'u-mirza', texti: 'Ef þú finnur hana ekki getum við teiknað merkið upp aftur, það tekur okkur klukkutíma.', stofnad: dags(-4) },
      { id: 'a2', task_id: 't1', hofundur: 'u-haf', texti: 'Ég spyr hönnuðinn sem gerði það og heyri í þér á morgun.', stofnad: dags(-3) },
      { id: 'a3', task_id: 't4', hofundur: 'u-haf', texti: 'Þrettándi passar betur okkar fólki.', stofnad: dags(-1) }
    ];

    const innri = {
      v1: { verkefni_id: 'v1', klst: 31,   reikningur: 'ekki_rukkad', reikningur_dags: null },
      v2: { verkefni_id: 'v2', klst: 9.5,  reikningur: 'ekki_rukkad', reikningur_dags: null },
      v3: { verkefni_id: 'v3', klst: 0,    reikningur: 'ekki_rukkad', reikningur_dags: null },
      v4: { verkefni_id: 'v4', klst: 0,    reikningur: 'ekki_rukkad', reikningur_dags: null },
      v5: { verkefni_id: 'v5', klst: 22,   reikningur: 'rukkad', reikningur_dags: dagsetning(-3) },
      v6: { verkefni_id: 'v6', klst: 38,   reikningur: 'ekki_rukkad', reikningur_dags: null }
    };

    const timaskraning = [
      { id: 'k1', verkefni_id: 'v1', notandi: 'u-mirza', klst: 8,   nota: 'Grunnur og útlit',   stofnad: dags(-14) },
      { id: 'k2', verkefni_id: 'v1', notandi: 'u-mirza', klst: 12,  nota: 'Undirsíður',         stofnad: dags(-8) },
      { id: 'k3', verkefni_id: 'v1', notandi: 'u-oskar', klst: 11,  nota: 'Myndir og efni',    stofnad: dags(-4) },
      { id: 'k4', verkefni_id: 'v2', notandi: 'u-oskar', klst: 9.5, nota: 'Undirbúningur',      stofnad: dags(-3) },
      { id: 'k5', verkefni_id: 'v5', notandi: 'u-oskar', klst: 22,  nota: null,                stofnad: dags(-10) },
      { id: 'k6', verkefni_id: 'v6', notandi: 'u-mirza', klst: 21,  nota: 'Síða og form',     stofnad: dags(-30) },
      { id: 'k7', verkefni_id: 'v6', notandi: 'u-oskar', klst: 17,  nota: 'Auglýsingar',      stofnad: dags(-20) }
    ];

    const snid = [
      { id: 's1', nafn: 'Ný vefsíða', lysing: 'Fimm undirsíður, form og tenging við lén', taskar: [
        { titill: 'Senda logo í vektor', lysing: 'Við þurfum .ai eða .svg skrá, png dugar ekki í prentun.', a_hverjum: 'vidskiptavinur', forgangur: 'hatt' },
        { titill: 'Senda myndir af vörum eða starfsemi', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'venjulegt' },
        { titill: 'Skrifa texta á Um okkur', lysing: 'Fjórar til fimm línur. Við getum skrifað hann ef þú vilt.', a_hverjum: 'vidskiptavinur', forgangur: 'venjulegt' },
        { titill: 'Setja upp grunn og útlit', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Undirsíður og efni', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Form og tenging við póst', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Leitarvélar, sitemap og lýsingar', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Yfirferð með viðskiptavin', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'hatt' },
        { titill: 'Tengja lén og setja í loftið', lysing: null, a_hverjum: 'tveir', forgangur: 'hatt' }
      ] },
      { id: 's2', nafn: 'Efnispakki mánaðar', lysing: 'Tökudagur, klipping og færslur', taskar: [
        { titill: 'Velja tökudag', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'hatt' },
        { titill: 'Senda okkur áherslur mánaðarins', lysing: 'Tilboð, nýjar vörur eða viðburðir sem við eigum að ýta á.', a_hverjum: 'vidskiptavinur', forgangur: 'venjulegt' },
        { titill: 'Tökur', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Klipping', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Yfirferð á efni', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'venjulegt' },
        { titill: 'Birting', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' }
      ] },
      { id: 's3', nafn: 'Vörumerki', lysing: 'Merki, litir, letur og leiðbeiningar', taskar: [
        { titill: 'Samtal um hvað vörumerkið á að segja', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'hatt' },
        { titill: 'Senda okkur það sem er til nú þegar', lysing: 'Gamalt merki, litir, myndir, hvað sem er.', a_hverjum: 'vidskiptavinur', forgangur: 'venjulegt' },
        { titill: 'Fyrstu tillögur', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Val á leið', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'hatt' },
        { titill: 'Fullvinnsla og skilaskrár', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Leiðbeiningar til að fara eftir', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' }
      ] }
    ];

    /* Fyrirspurnir af vefnum, eins og þær kæmu úr formunum */
    const klst = (n) => new Date(nu - n * 3600000).toISOString();
    const fyrirspurnir = [
      { id: 'q1', nafn: 'Guðrún Sigurðardóttir', netfang: 'gudrun@bakarigudrunar.is', simi: '899 1234',
        fyrirtaeki_nafn: 'Bakarí Guðrúnar', thjonusta: 'Samfélagsmiðlar, Auglýsingar',
        skilabod: 'Við erum að opna nýtt útibú í febrúar og viljum fá fólk inn frá fyrsta degi.',
        form: 'Hafa samband', gogn: null,
        uppruni: 'facebook', sidasti_uppruni: 'facebook', utm_source: 'facebook', utm_medium: 'paid',
        utm_campaign: 'uttekt-nov', tilvisun: 'm.facebook.com', lendingarsida: '/herferd.html',
        fyrsta_heimsokn: klst(5), stada: 'ny', abyrgd: null, verdmaeti: null, nota: null,
        stofnad: klst(3), uppfaert: klst(3) },
      { id: 'q2', nafn: 'Jón Ólafsson', netfang: null, simi: '777 4321',
        fyrirtaeki_nafn: null, thjonusta: 'Vefsíða, Google',
        skilabod: null, form: 'Markaðsúttekt (herferð)', gogn: { slod: 'olafssonverk.is' },
        uppruni: 'facebook', sidasti_uppruni: 'facebook', utm_source: 'facebook', utm_medium: 'paid',
        utm_campaign: 'uttekt-nov', tilvisun: 'l.facebook.com', lendingarsida: '/herferd.html',
        fyrsta_heimsokn: klst(27), stada: 'ny', abyrgd: null, verdmaeti: null, nota: null,
        stofnad: klst(26), uppfaert: klst(26) },
      { id: 'q3', nafn: 'Sara Björk', netfang: 'sara@studiosara.is', simi: null,
        fyrirtaeki_nafn: 'Stúdíó Sara', thjonusta: 'Vefsíða í áskrift',
        skilabod: 'Hvað kostar að halda síðunni við mánaðarlega?', form: 'Vefsíða í áskrift', gogn: null,
        uppruni: 'google', sidasti_uppruni: 'google', utm_source: null, utm_medium: null,
        utm_campaign: null, tilvisun: 'www.google.com', lendingarsida: '/vefsida-askrift.html',
        fyrsta_heimsokn: dags(-6), stada: 'haft_samband', abyrgd: 'u-oskar', verdmaeti: 45000,
        nota: 'Hringdi, vill sjá dæmi um síður.', stofnad: dags(-4), uppfaert: dags(-3) },
      { id: 'q4', nafn: 'Einar Þór Einarsson', netfang: 'einar@nordurvelar.is', simi: '862 5500',
        fyrirtaeki_nafn: 'Norðurvélar ehf.', thjonusta: 'Auglýsingar, Sölutækifæri',
        skilabod: 'Viljum fleiri fyrirspurnir frá verktökum.', form: 'Hafa samband', gogn: null,
        uppruni: 'beint', sidasti_uppruni: 'linkedin', utm_source: 'linkedin', utm_medium: 'social',
        utm_campaign: null, tilvisun: null, lendingarsida: '/',
        fyrsta_heimsokn: dags(-14), stada: 'fundur', abyrgd: 'u-mirza', verdmaeti: 450000,
        nota: 'Fundur á fimmtudag kl. 10.', stofnad: dags(-6), uppfaert: dags(-2) },
      { id: 'q5', nafn: 'Helga Rún Pálsdóttir', netfang: 'helga@hotelfjordur.is', simi: null,
        fyrirtaeki_nafn: 'Hótel Fjörður', thjonusta: 'Sölutækifæri',
        skilabod: 'Við viljum ná til fyrirtækja sem halda árshátíðir.', form: 'Sölutækifæri', gogn: null,
        uppruni: 'linkedin', sidasti_uppruni: 'linkedin', utm_source: 'linkedin', utm_medium: 'social',
        utm_campaign: null, tilvisun: 'www.linkedin.com', lendingarsida: '/solutaekifaeri.html',
        fyrsta_heimsokn: dags(-12), stada: 'tilbod', abyrgd: 'u-mirza', verdmaeti: 890000,
        nota: 'Tilboð sent, bíður svars.', stofnad: dags(-10), uppfaert: dags(-5) },
      { id: 'q6', nafn: 'Kristján Fossberg', netfang: 'kristjan@fossberg.is', simi: null,
        fyrirtaeki_nafn: 'Fossberg ehf.', thjonusta: 'Vefsíða, Auglýsingar',
        skilabod: 'Lendingarsíða og auglýsingar fyrir nýja vöru.', form: 'Hafa samband', gogn: null,
        uppruni: 'google', sidasti_uppruni: 'google', utm_source: null, utm_medium: null,
        utm_campaign: null, tilvisun: 'www.google.com', lendingarsida: '/',
        fyrsta_heimsokn: dags(-28), stada: 'unnid', abyrgd: 'u-oskar', verdmaeti: 420000,
        nota: null, stofnad: dags(-25), uppfaert: dags(-20) },
      { id: 'q7', nafn: 'Arna Kristinsdóttir', netfang: 'arna@kaffikrokur.is', simi: null,
        fyrirtaeki_nafn: 'Kaffi Krókur', thjonusta: 'Samfélagsmiðlar',
        skilabod: null, form: 'Efni', gogn: null,
        uppruni: 'instagram', sidasti_uppruni: 'instagram', utm_source: 'instagram', utm_medium: 'social',
        utm_campaign: null, tilvisun: 'l.instagram.com', lendingarsida: '/efni.html',
        fyrsta_heimsokn: dags(-31), stada: 'tapad', abyrgd: 'u-oskar', verdmaeti: null,
        nota: 'Of dýrt í bili, heyrum í þeim í vor.', stofnad: dags(-30), uppfaert: dags(-22) }
    ];

    /* Bókhaldið. Upphæðir án VSK nema vsklaust sé merkt. Vinna í mánuði
       greiðist 1. dag næsta mánaðar. */
    const man = (n) => {
      const d = new Date(nu); d.setDate(1); d.setMonth(d.getMonth() + n);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    };
    const samningar = [
      { id: 's1', vidskiptavinur: 'Hlíðarkaup', fyrirtaeki_id: 'f1', thjonusta: 'Efni og samfélagsmiðlar',
        upphaed: 290000, vsklaust: false, hefst: man(-5), lykur: null },
      { id: 's2', vidskiptavinur: 'Steinvík ehf.', fyrirtaeki_id: 'f2', thjonusta: 'Vefsíða í áskrift',
        upphaed: 45000, vsklaust: false, hefst: man(-2), lykur: null },
      { id: 's3', vidskiptavinur: 'Íþróttafélagið Hekla', fyrirtaeki_id: null, thjonusta: 'Samfélagsmiðlar',
        upphaed: 150000, vsklaust: true, hefst: man(-3), lykur: null },
      { id: 's4', vidskiptavinur: 'Fossberg ehf.', fyrirtaeki_id: 'f3', thjonusta: 'Auglýsingar',
        upphaed: 120000, vsklaust: false, hefst: man(1), lykur: null }
    ];
    const aukaverkefni = [
      { id: 'a1', heiti: 'Tökudagur', vidskiptavinur: 'Steinvík ehf.', fyrirtaeki_id: 'f2', upphaed: 180000,
        vsklaust: false, dags: man(0) + '-12', stada: 'stadfest', greitt: false },
      { id: 'a2', heiti: '3 vidjó', vidskiptavinur: 'Hlíðarkaup', fyrirtaeki_id: 'f1', upphaed: 90000,
        vsklaust: false, dags: man(0) + '-20', stada: 'stadfest', greitt: false },
      { id: 'a3', heiti: 'Jólaherferð', vidskiptavinur: 'Hlíðarkaup', fyrirtaeki_id: 'f1', upphaed: 250000,
        vsklaust: false, dags: man(1) + '-05', stada: 'kannski', greitt: false },
      { id: 'a4', heiti: 'Lendingarsíða', vidskiptavinur: 'Fossberg ehf.', fyrirtaeki_id: 'f3', upphaed: 420000,
        vsklaust: false, dags: man(-1) + '-18', stada: 'stadfest', greitt: true },
      { id: 'a5', heiti: 'Myndataka', vidskiptavinur: 'Steinvík ehf.', fyrirtaeki_id: 'f2', upphaed: 150000,
        vsklaust: false, dags: man(-3) + '-09', stada: 'stadfest', greitt: true }
    ];
    const taxtar = [
      { id: 'x1', vidskiptavinur: 'Hlíðarkaup', heiti: 'Vidjó', eining: 'vidjó',
        upphaed: 30000, vsklaust: false },
      { id: 'x2', vidskiptavinur: 'Steinvík ehf.', heiti: 'Tökudagur', eining: 'dagur',
        upphaed: 180000, vsklaust: false }
    ];

    /* Tölfræði: miðlar, skýrslur og það sem er skráð í höndunum. Daglegu
       tölurnar sjálfar eru reiknaðar í prufuRodir og ekki geymdar. */
    const tfMidlar = prufuMidlar();
    const tf = { midlar: tfMidlar, handvirkt: {}, skyrslur: prufuSkyrslur(fyr, tfMidlar) };

    /* Stofan í sýnidæminu. Nafn, litur, merki og einingar koma úr
       "Settu saman" (glerhusid-byggja) nema þeim sé breytt í Stillingum. */
    const stofa = { nafn: null, netfang: 'sara@nordurljos.is', merki_url: null, litur: null, vefur: null,
                    einingar: null, stillingar: {}, uppsetning: { lokid: true } };

    /* Boð sem bíður, drög í Payday og það sem verkpósturinn hefur séð */
    const bod = [
      { id: 'b1', netfang: 'jon@fossberg.is', nafn: 'Jón Kristjánsson', hlutverk: 'vidskiptavinur',
        fyrirtaeki_id: 'f3', er_eigandi: false, stofnad: dags(-2), utrunnid: dags(12), notad: null }
    ];
    const fyrriMan = man(-1);
    const reikningsdrog = [
      { id: 'rd1', veita: 'payday', uppruni: 'samningur', uppruni_id: 's2', manudur: fyrriMan + '-01',
        fyrirtaeki_id: 'f2', linur: [{ texti: 'Vefsíða í áskrift', upphaed: 45000 }], upphaed: 45000,
        stada: 'drog', ytra_id: 'synidaemi-1', ytra_numer: '1042', ytri_slod: null, villa: null,
        stofnad: dags(-20), uppfaert: dags(-20) },
      { id: 'rd2', veita: 'payday', uppruni: 'aukaverkefni', uppruni_id: 'a4', manudur: null,
        fyrirtaeki_id: 'f3', linur: [{ texti: 'Lendingarsíða', upphaed: 420000 }], upphaed: 420000,
        stada: 'villa', ytra_id: null, ytra_numer: null, ytri_slod: null,
        villa: 'Settu kennitölu á fyrirtækið fyrst', stofnad: dags(-9), uppfaert: dags(-9) }
    ];
    const verkpostur = [
      { dags: dags(-2), nidurstada: 'taskur', fjoldi: 3, stadfesting_slod: null },
      { dags: dags(-3), nidurstada: 'othekktur', fjoldi: 0, stadfesting_slod: null },
      { dags: dags(-5), nidurstada: 'athugasemd', fjoldi: 1, stadfesting_slod: null }
    ];

    return { fyrirtaeki: fyr, notendur, verkefni, taskar, athugasemdir,
             innri, timaskraning, snid, vidhengi: [], innri_taskar, undirverk,
             fyrirspurnir, samningar, aukaverkefni, taxtar, tf, innskradur: null,
             stofa, bod, reikningsdrog, verkpostur };
  };

  function les() {
    try {
      const h = localStorage.getItem(LYKILL);
      if (h) {
        /* Eldri vistun getur vantað hluti sem bættust við síðar */
        const vistað = JSON.parse(h);
        const sjalf = sjalfgefid();
        for (const lykill of Object.keys(sjalf)) {
          if (vistað[lykill] === undefined) vistað[lykill] = sjalf[lykill];
        }
        /* mirza@vefnum er ekki til. Eldri vistun hafði það. */
        (vistað.notendur || []).forEach((n) => {
          if (n.netfang === 'mirza@tveir.is' || n.netfang === 'tveir@tveir.is') n.netfang = 'sara@nordurljos.is';
        });
        return vistað;
      }
    } catch (e) { /* localStorage getur verið lokað */ }
    return sjalfgefid();
  }

  let g = les();
  /* Kemur gesturinn beint úr "Settu saman ykkar kerfi" er hann skráður inn sem stjórnandi */
  try {
    if (localStorage.getItem('glerhus-tveir-innskra')) {
      localStorage.removeItem('glerhus-tveir-innskra');
      g.innskradur = 'u-mirza';
      g.lykilordSett = { ...(g.lykilordSett || {}), 'u-mirza': true };
      localStorage.setItem(LYKILL, JSON.stringify(g));
    }
  } catch (e) { /* lokað */ }

  function vista() {
    try { localStorage.setItem(LYKILL, JSON.stringify(g)); } catch (e) { /* sleppum */ }
  }

  /* Skrárnar sjálfar, bara í minni meðan síðan er opin */
  const BLOB = new Map();
  /* Stórt merki stofunnar (data-slóð) lifir bara í minni: localStorage
     fylltist annars og ekkert annað í sýnidæminu vistaðist eftir það */
  let stortStofuMerki = null;

  /* Framvinda verkefnis kemur úr töskunum, ekki úr renniborda. */
  function reiknaFramvindu(verkefni_id) {
    if (!verkefni_id) return;
    const v = g.verkefni.find((x) => x.id === verkefni_id);
    if (!v) return;
    const minir = g.taskar.filter((t) => t.verkefni_id === verkefni_id);
    const lokin = minir.filter((t) => t.stada === 'lokid').length;
    v.framvinda = minir.length ? Math.round(lokin * 100 / minir.length) : 0;
    if (v.framvinda > 0 && v.stada === 'samthykkt') v.stada = 'i_vinnslu';
    v.uppfaert = new Date().toISOString();
  }

  function naestaRod(verkefni_id) {
    if (!verkefni_id) return 0;
    const minir = g.taskar.filter((t) => t.verkefni_id === verkefni_id);
    return minir.length ? Math.max(...minir.map((t) => Number(t.rod) || 0)) + 1 : 1;
  }

  function reiknaKlst(verkefni_id) {
    const alls = g.timaskraning
      .filter((t) => t.verkefni_id === verkefni_id)
      .reduce((a, t) => a + Number(t.klst), 0);
    if (!g.innri[verkefni_id]) {
      g.innri[verkefni_id] = { verkefni_id, klst: 0, reikningur: 'ekki_rukkad', reikningur_dags: null };
    }
    g.innri[verkefni_id].klst = Math.round(alls * 10) / 10;
  }

  const finna = (listi, id) => listi.find((x) => x.id === id) || null;
  const fyrNafn = (id) => { const f = finna(g.fyrirtaeki, id); return f ? { nafn: f.nafn } : null; };
  const nyttId = () => 'x' + Math.random().toString(36).slice(2, 10);

  /* Framvindan getur verið úreltt í eldri vistun. Reikna hana einu sinni. */
  g.verkefni.forEach((v) => reiknaFramvindu(v.id));

  function skreyta(t) {
    return {
      ...t,
      fyrirtaeki: fyrNafn(t.fyrirtaeki_id),
      verkefni: t.verkefni_id ? { titill: (finna(g.verkefni, t.verkefni_id) || {}).titill } : null,
      abyrgd_notandi: t.abyrgd ? { nafn: (finna(g.notendur, t.abyrgd) || {}).nafn } : null,
      hofundur_notandi: t.hofundur ? (({ nafn, hlutverk }) => ({ nafn, hlutverk }))(finna(g.notendur, t.hofundur) || {}) : null,
      undirverk: (g.undirverk || []).filter((u) => u.task_id === t.id)
        .map((u) => ({ id: u.id, lokid: u.lokid }))
    };
  }

  function skreytaInnri(t) {
    return {
      ...t,
      fyrirtaeki: t.fyrirtaeki_id ? fyrNafn(t.fyrirtaeki_id) : null,
      abyrgd_notandi: t.abyrgd ? { nafn: (finna(g.notendur, t.abyrgd) || {}).nafn } : null
    };
  }

  function skreytaFyrirspurn(f) {
    return {
      ...f,
      abyrgd_notandi: f.abyrgd ? { nafn: (finna(g.notendur, f.abyrgd) || {}).nafn } : null
    };
  }

  const nyjast = (a, b) => new Date(b.stofnad) - new Date(a.stofnad);

  return {
    prufa: true,

    async innskra(netfang) {
      const n = g.notendur.find((x) => x.netfang.toLowerCase() === netfang.trim().toLowerCase());
      if (!n) throw new Error('Þetta netfang er ekki á prufulistanum. Prófaðu sara@nordurljos.is eða anna@steinvik.is.');
      g.innskradur = n.id; vista();
    },

    /* Í prufu dugar hvaða lykilorð sem er, það er ekkert til að verja */
    async innskraLykilord(netfang, lykilord) {
      if (!lykilord) throw new Error('Lykilorðið vantar.');
      await this.innskra(netfang);
    },

    async sendaEndurstillingu() { /* enginn póstur fer út í prufu */ },

    async setjaLykilord() {
      g.lykilordSett = { ...(g.lykilordSett || {}), [g.innskradur]: true };
      vista();
    },

    async vantarLykilord() {
      return !!g.innskradur && !(g.lykilordSett && g.lykilordSett[g.innskradur]);
    },

    erEndurstilling() { return false; },

    async utskra() { g.innskradur = null; vista(); },

    /* Í prufu er engin Supabase lota og því ekkert tákn. Harvey notar
       aðgangskóðann úr Vercel í staðinn. */
    async adgangstokinn() { return null; },

    async eg() {
      if (!g.innskradur) return null;
      const n = finna(g.notendur, g.innskradur);
      if (!n) return null;
      sidastaStofa = PRUFA_STOFA_ID;
      return {
        ...n, fyrirtaeki: n.fyrirtaeki_id ? finna(g.fyrirtaeki, n.fyrirtaeki_id) : null,
        stofa_id: PRUFA_STOFA_ID, er_eigandi: n.id === 'u-mirza',
        stofa: prufuStofa(), min_stada: prufuMinStada(n)
      };
    },

    async verkefni(fyrirtaeki_id) {
      return g.verkefni
        .filter((v) => !fyrirtaeki_id || v.fyrirtaeki_id === fyrirtaeki_id)
        .map((v) => ({ ...v, fyrirtaeki: fyrNafn(v.fyrirtaeki_id) }))
        .sort(nyjast);
    },

    async verkefniEitt(id) {
      const v = finna(g.verkefni, id);
      return v ? { ...v, fyrirtaeki: fyrNafn(v.fyrirtaeki_id) } : null;
    },

    async nyVerkefnatillaga({ titill, lysing, skiladagur, budget, innan_samnings }) {
      const ek = await this.eg();
      const fyr = finna(g.fyrirtaeki, ek.fyrirtaeki_id);
      const innan = !!innan_samnings && !!(fyr && fyr.er_askrift);
      if (!innan && !budget) throw new Error('Budget vantar.');
      const v = {
        id: nyttId(), fyrirtaeki_id: ek.fyrirtaeki_id, titill, lysing,
        skiladagur: skiladagur || null, stada: 'tillaga', framvinda: 0,
        hofundur: ek.id, svar_admin: null,
        budget: innan ? null : Number(budget), innan_samnings: innan, verd_okkar: null,
        stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
      };
      g.verkefni.unshift(v); vista(); return v;
    },

    async uppfaeraVerkefni(id, breytingar) {
      const v = finna(g.verkefni, id);
      Object.assign(v, breytingar, { uppfaert: new Date().toISOString() });
      vista(); return v;
    },

    async taskar({ fyrirtaeki_id, verkefni_id } = {}) {
      const listi = g.taskar
        .filter((t) => (!fyrirtaeki_id || t.fyrirtaeki_id === fyrirtaeki_id)
                    && (!verkefni_id || t.verkefni_id === verkefni_id))
        .map(skreyta);
      return verkefni_id
        ? listi.sort((a, b) => (Number(a.rod) || 0) - (Number(b.rod) || 0)
                            || new Date(a.stofnad) - new Date(b.stofnad))
        : listi.sort(nyjast);
    },

    async nyrTask(task) {
      const ek = await this.eg();
      const t = {
        id: nyttId(), lysing: null, stada: 'nytt', forgangur: 'venjulegt',
        verkefni_id: null, abyrgd: null, skiladagur: null, lokid_dags: null,
        ...task,
        rod: task.rod !== undefined ? task.rod : naestaRod(task.verkefni_id),
        fyrirtaeki_id: task.fyrirtaeki_id || ek.fyrirtaeki_id,
        hofundur: ek.id,
        stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
      };
      g.taskar.unshift(t);
      reiknaFramvindu(t.verkefni_id);
      vista(); return skreyta(t);
    },

    async uppfaeraTask(id, breytingar) {
      const t = finna(g.taskar, id);
      Object.assign(t, breytingar, { uppfaert: new Date().toISOString() });
      if (breytingar.stada === 'lokid') t.lokid_dags = new Date().toISOString();
      if (breytingar.stada && breytingar.stada !== 'lokid') t.lokid_dags = null;
      reiknaFramvindu(t.verkefni_id);
      vista(); return skreyta(t);
    },

    async athugasemdir(task_id) {
      return g.athugasemdir
        .filter((a) => a.task_id === task_id)
        .map((a) => ({ ...a, notandi: finna(g.notendur, a.hofundur) }))
        .sort((a, b) => new Date(a.stofnad) - new Date(b.stofnad));
    },

    async nyAthugasemd(task_id, texti) {
      const ek = await this.eg();
      const a = { id: nyttId(), task_id, texti, hofundur: ek.id, stofnad: new Date().toISOString() };
      g.athugasemdir.push(a); vista();
      return { ...a, notandi: finna(g.notendur, ek.id) };
    },

    async fyrirtaeki() { return [...g.fyrirtaeki].sort((a, b) => a.nafn.localeCompare(b.nafn, 'is')); },

    async nyttFyrirtaeki(fyrirtaeki) {
      const f = {
        id: nyttId(), merki_url: null, er_askrift: false, askrift_verd: null, kennitala: null, reikningsnetfang: null,
        ...hreintFyrirtaeki(fyrirtaeki), stofnad: new Date().toISOString()
      };
      g.fyrirtaeki.push(f); vista(); return f;
    },

    async uppfaeraFyrirtaeki(id, breytingar) {
      krefjastAdmin();
      const f = finna(g.fyrirtaeki, id);
      if (!f) throw new Error('Fyrirtækið fannst ekki.');
      Object.assign(f, hreintFyrirtaeki(breytingar), { id });
      vista(); return { ...f };
    },

    async notendur() {
      return g.notendur.map((n) => ({ ...n, fyrirtaeki: fyrNafn(n.fyrirtaeki_id) }));
    },

    async tengjaNotanda(id, fyrirtaeki_id) {
      const n = finna(g.notendur, id);
      n.fyrirtaeki_id = fyrirtaeki_id; vista(); return n;
    },

    /* ---------- Innri: tímar og reikningur ---------- */

    async innri(verkefni_id) {
      if (verkefni_id) {
        return g.innri[verkefni_id]
          || { verkefni_id, klst: 0, reikningur: 'ekki_rukkad', reikningur_dags: null };
      }
      return Object.values(g.innri);
    },

    async skraTima(verkefni_id, klst, nota) {
      const ek = await this.eg();
      const t = {
        id: nyttId(), verkefni_id, notandi: ek.id, klst: Number(klst),
        nota: nota || null, stofnad: new Date().toISOString()
      };
      g.timaskraning.unshift(t);
      reiknaKlst(verkefni_id);
      vista();
      return { ...t, notandi_nafn: { nafn: ek.nafn } };
    },

    async timaskraning(verkefni_id) {
      return g.timaskraning
        .filter((t) => t.verkefni_id === verkefni_id)
        .map((t) => ({ ...t, notandi_nafn: { nafn: (finna(g.notendur, t.notandi) || {}).nafn } }))
        .sort(nyjast);
    },

    async eydaTima(id) {
      const t = finna(g.timaskraning, id);
      if (!t) return;
      g.timaskraning = g.timaskraning.filter((x) => x.id !== id);
      reiknaKlst(t.verkefni_id);
      vista();
    },

    async setjaReikning(verkefni_id, reikningur) {
      if (!g.innri[verkefni_id]) {
        g.innri[verkefni_id] = { verkefni_id, klst: 0, reikningur: 'ekki_rukkad', reikningur_dags: null };
      }
      g.innri[verkefni_id].reikningur = reikningur;
      g.innri[verkefni_id].reikningur_dags =
        reikningur === 'ekki_rukkad' ? null : new Date().toISOString().slice(0, 10);
      vista();
      return g.innri[verkefni_id];
    },

    /* ---------- Snið ---------- */

    async snid() { return g.snid; },

    async nyttVerkefniAdmin({ fyrirtaeki_id, titill, lysing, skiladagur, verd_okkar, innan_samnings, snid_id }) {
      const ek = await this.eg();
      const v = {
        id: nyttId(), fyrirtaeki_id, titill, lysing: lysing || null,
        skiladagur: skiladagur || null, stada: 'i_vinnslu', framvinda: 0,
        hofundur: ek.id, svar_admin: null, budget: null,
        innan_samnings: !!innan_samnings,
        verd_okkar: innan_samnings ? null : (verd_okkar || null),
        stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
      };
      g.verkefni.unshift(v);
      g.innri[v.id] = { verkefni_id: v.id, klst: 0, reikningur: 'ekki_rukkad', reikningur_dags: null };
      if (snid_id) await this.beitaSnidi(v, snid_id);
      vista();
      return v;
    },

    async beitaSnidi(v, snid_id) {
      const ek = await this.eg();
      const sn = finna(g.snid, snid_id);
      if (!sn) return;
      const theirra = (g.notendur.find((n) => n.fyrirtaeki_id === v.fyrirtaeki_id
                                           && n.hlutverk !== 'admin') || {}).id || null;
      sn.taskar.forEach((t, i) => {
        g.taskar.unshift({
          id: nyttId(), fyrirtaeki_id: v.fyrirtaeki_id, verkefni_id: v.id, rod: i + 1,
          titill: t.titill, lysing: t.lysing, forgangur: t.forgangur,
          stada: t.a_hverjum === 'vidskiptavinur' ? 'bid_vidskiptavinar' : 'nytt',
          abyrgd: t.a_hverjum === 'vidskiptavinur' ? theirra : ek.id,
          hofundur: ek.id, skiladagur: null, lokid_dags: null,
          stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
        });
      });
      reiknaFramvindu(v.id);
      vista();
    },

    /* ---------- Viðhengi ----------
       Í prufu lifa skrárnar sjálfar bara í minni, því localStorage þolir
       ekki myndir. Nafn og stærð haldast, hlekkurinn deyr við endurhleðslu. */

    async vidhengi(task_id) {
      return g.vidhengi
        .filter((v) => v.task_id === task_id)
        .map((v) => ({ ...v, notandi: finna(g.notendur, v.hofundur), lifandi: BLOB.has(v.id) }));
    },

    async nyttVidhengi(task_id, fyrirtaeki_id, skra) {
      const ek = await this.eg();
      const v = {
        id: nyttId(), task_id, slod: null, nafn: skra.name, staerd: skra.size,
        hofundur: ek.id, stofnad: new Date().toISOString()
      };
      BLOB.set(v.id, skra);
      g.vidhengi.push(v);
      vista();
      return { ...v, notandi: finna(g.notendur, ek.id), lifandi: true };
    },

    async slodAVidhengi(v) {
      const skra = BLOB.get(v.id);
      if (!skra) throw new Error('Skráin er horfin. Í prufustillingu lifa viðhengi bara þá '
        + 'lötu sem síðan er opin.');
      return URL.createObjectURL(skra);
    },

    /* ---------- Undirverk ----------
       Skrárnar sjálfar lifa bara í minni, eins og viðhengin. */

    async undirverk(task_id) {
      return (g.undirverk || []).filter((u) => u.task_id === task_id)
        .sort((a, b) => (a.rod - b.rod) || (new Date(a.stofnad) - new Date(b.stofnad)))
        .map((u) => ({ ...u }));
    },

    async nyUndirverk(task_id, titlar) {
      const t = finna(g.taskar, task_id);
      g.undirverk = g.undirverk || [];
      const minir = g.undirverk.filter((u) => u.task_id === task_id);
      const fra = minir.length ? Math.max(...minir.map((u) => Number(u.rod) || 0)) + 1 : 1;
      const nyjir = titlar.map((x, i) => ({
        id: nyttId(), task_id, fyrirtaeki_id: t ? t.fyrirtaeki_id : null, rod: fra + i,
        titill: String(x && typeof x === 'object' ? x.titill : x).slice(0, 200),
        dags: (x && typeof x === 'object' && x.dags) || null,
        lokid: false, lokid_dags: null, skra_slod: null, skra_nafn: null, skra_staerd: null,
        tengill: null, senda: true, sent_dags: null, stofnad: new Date().toISOString()
      }));
      g.undirverk.push(...nyjir);
      vista(); return nyjir;
    },

    async uppfaeraUndirverk(id, breytingar) {
      const u = finna(g.undirverk || [], id);
      if (!u) return null;
      const varLokid = u.lokid;
      Object.assign(u, breytingar);
      if (u.lokid && !varLokid) u.lokid_dags = new Date().toISOString();
      if (!u.lokid) u.lokid_dags = null;
      vista(); return { ...u };
    },

    async fundir() {
      return (g.fundir || []).map((f) => ({ ...f, fyrirtaeki: fyrNafn(f.fyrirtaeki_id) })).sort((a, b) => new Date(a.byrjar) - new Date(b.byrjar));
    },
    async nyrFundur(f) {
      krefjastAdmin();
      if (!String(f.titill || '').trim()) throw new Error('Titill vantar.');
      const nyr = { id: nyttId(), stadur: null, lysing: null, fyrirtaeki_id: null, allan_daginn: false, google_id: null, ...f, stofnad: new Date().toISOString() };
      g.fundir = [...(g.fundir || []), nyr]; vista();
      return { ...nyr, fyrirtaeki: fyrNafn(nyr.fyrirtaeki_id) };
    },
    async uppfaeraFund(id, breytingar) {
      krefjastAdmin();
      const f = finna(g.fundir || [], id); if (!f) return null;
      Object.assign(f, breytingar); vista(); return { ...f, fyrirtaeki: fyrNafn(f.fyrirtaeki_id) };
    },
    async eydaFundi(id) { krefjastAdmin(); g.fundir = (g.fundir || []).filter((f) => f.id !== id); vista(); },
    async undirverkADagatali() {
      return (g.undirverk || []).filter((u) => u.dags).map((u) => {
        const t = finna(g.taskar, u.task_id);
        return { ...u, fyrirtaeki: fyrNafn(u.fyrirtaeki_id), taskar: t ? { titill: t.titill, stada: t.stada } : null };
      });
    },

    async eydaUndirverk(u) {
      g.undirverk = (g.undirverk || []).filter((x) => x.id !== u.id);
      BLOB.delete(u.id);
      vista();
    },

    async skraAUndirverk(u, fyrirtaeki_id, skra) {
      BLOB.set(u.id, skra);
      return this.uppfaeraUndirverk(u.id, {
        skra_slod: 'prufa', skra_nafn: skra.name, skra_staerd: skra.size
      });
    },

    async slodAUndirverki(u) {
      const skra = BLOB.get(u.id);
      if (!skra) throw new Error('Í prufustillingu lifa skrár bara meðan síðan er opin.');
      return URL.createObjectURL(skra);
    },

    /* ---------- Okkar eigin listi ---------- */

    async innriTaskar() {
      return g.innri_taskar.map(skreytaInnri).sort(nyjast);
    },

    async nyrInnriTask(task) {
      const ek = await this.eg();
      const t = {
        id: nyttId(), lysing: null, stada: 'nytt', forgangur: 'venjulegt',
        abyrgd: null, fyrirtaeki_id: null, skiladagur: null, lokid_dags: null,
        ...task, hofundur: ek.id,
        stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
      };
      g.innri_taskar.unshift(t); vista(); return skreytaInnri(t);
    },

    async uppfaeraInnriTask(id, breytingar) {
      const t = finna(g.innri_taskar, id);
      if (!t) return null;
      Object.assign(t, breytingar, { uppfaert: new Date().toISOString() });
      if (breytingar.stada === 'lokid') t.lokid_dags = new Date().toISOString();
      if (breytingar.stada && breytingar.stada !== 'lokid') t.lokid_dags = null;
      vista(); return skreytaInnri(t);
    },

    async eydaInnriTask(id) {
      g.innri_taskar = g.innri_taskar.filter((x) => x.id !== id);
      vista();
    },

    /* ---------- Fyrirspurnir af vefnum ---------- */

    async fyrirspurnir() {
      return g.fyrirspurnir.map(skreytaFyrirspurn).sort(nyjast);
    },

    async uppfaeraFyrirspurn(id, breytingar) {
      const f = finna(g.fyrirspurnir, id);
      if (!f) return null;
      Object.assign(f, breytingar, { uppfaert: new Date().toISOString() });
      vista(); return skreytaFyrirspurn(f);
    },

    async eydaFyrirspurn(id) {
      g.fyrirspurnir = g.fyrirspurnir.filter((x) => x.id !== id);
      vista();
    },

    /* ---------- Bókhald: samningar, aukaverkefni, taxtar ---------- */

    async bokhald(tafla) {
      return (g[tafla] || []).map((r) => ({ ...r }));
    },

    async vistaBokhald(tafla, rod) {
      g[tafla] = g[tafla] || [];
      if (rod.id) {
        const r = finna(g[tafla], rod.id);
        if (r) Object.assign(r, rod);
      } else {
        rod = { ...rod, id: nyttId() };
        g[tafla].push(rod);
      }
      vista(); return { ...rod };
    },

    async eydaBokhald(tafla, id) {
      g[tafla] = (g[tafla] || []).filter((x) => x.id !== id);
      vista();
    },

    /* ---------- Merki viðskiptavinarins ----------
       Í prufu er myndin geymd sem data-slóð svo hún lifi endurhleðslu. */

    async setjaMerki(fyrirtaeki_id, skra) {
      const f = finna(g.fyrirtaeki, fyrirtaeki_id);
      if (!f) throw new Error('Fyrirtækið fannst ekki.');
      if (!MERKI_GERDIR[skra && skra.type]) throw new Error('Merkið þarf að vera png, jpg eða webp mynd.');

      const slod = await new Promise((skila, hafna) => {
        const lesari = new FileReader();
        lesari.onload = () => skila(lesari.result);
        lesari.onerror = () => hafna(new Error('Náði ekki að lesa skrána.'));
        lesari.readAsDataURL(skra);
      });

      f.merki_url = slod;
      vista();
      return f;
    },

    async hendaMerki(fyrirtaeki_id) {
      const f = finna(g.fyrirtaeki, fyrirtaeki_id);
      if (f) { f.merki_url = null; vista(); }
      return f;
    },

    /* ---------- Tölfræði ----------
       Sömu reglur og RLS: viðskiptavinur les bara sitt fyrirtæki og sér
       bara sendar skýrslur, bara við skrifum. */

    async midlar(fyrirtaeki_id) {
      if (!maSja(fyrirtaeki_id)) return [];
      return g.tf.midlar.filter((m) => m.fyrirtaeki_id === fyrirtaeki_id)
        .map((m) => ({ ...m }))
        .sort((a, b) => a.midill.localeCompare(b.midill) || a.nafn.localeCompare(b.nafn, 'is'));
    },

    async nyrMidill(m) {
      krefjastAdmin();
      const midill = String(m.midill || '');
      const nafn = String(m.nafn || '').trim();
      const slod = m.slod ? String(m.slod).trim() : null;
      if (!['instagram', 'facebook', 'tiktok'].includes(midill)) throw new Error('Veldu miðil.');
      if (!nafn || nafn.length > 120) throw new Error('Nafnið þarf að vera 1 til 120 stafir.');
      if (slod && (!/^https:\/\/\S+$/.test(slod) || slod.length > 500)) throw new Error('Slóðin þarf að byrja á https:// og vera án bila.');
      if (g.tf.midlar.some((x) => x.fyrirtaeki_id === m.fyrirtaeki_id && x.midill === midill && x.nafn === nafn)) {
        throw new Error('Þessi miðill er þegar skráður hjá fyrirtækinu.');
      }
      const nyr = {
        id: nyttId(), fyrirtaeki_id: m.fyrirtaeki_id, midill, nafn,
        ytra_id: m.ytra_id ? String(m.ytra_id).trim().slice(0, 100) : null,
        slod, virkt: m.virkt !== false, stofnad: new Date().toISOString()
      };
      g.tf.midlar.push(nyr); vista(); return { ...nyr };
    },

    async zernioTengja() { throw new Error('Í sýnidæminu tengist enginn miðill. Í alvöru Glerhúsi opnast Facebook innskráning hér.'); },
    async zernioSamstilla() { return []; },

    async uppfaeraMidil(id, breytingar) {
      krefjastAdmin();
      const m = finna(g.tf.midlar, id);
      if (!m) throw new Error('Miðillinn fannst ekki.');
      const leyft = ['midill', 'nafn', 'ytra_id', 'slod', 'virkt'];
      for (const k of leyft) if (breytingar[k] !== undefined) m[k] = breytingar[k];
      vista(); return { ...m };
    },

    async eydaMidli(id) {
      krefjastAdmin();
      g.tf.midlar = g.tf.midlar.filter((m) => m.id !== id);
      for (const k of Object.keys(g.tf.handvirkt)) if (k.split('|')[0] === id) delete g.tf.handvirkt[k];
      vista();
    },

    async maelingar(fyrirtaeki_id, fra, til) {
      if (!maSja(fyrirtaeki_id)) return [];
      const ut = [];
      for (const m of g.tf.midlar.filter((x) => x.fyrirtaeki_id === fyrirtaeki_id)) {
        const kort = new Map(prufuRodir(m.id).maelingar
          .filter((r) => r.dags >= fra && r.dags <= til)
          .map((r) => [r.dags, { ...r }]));
        for (const [k, h] of Object.entries(g.tf.handvirkt)) {
          const [mid, d] = k.split('|');
          if (mid !== m.id || d < fra || d > til) continue;
          const lina = kort.get(d) || { midill_id: m.id, fyrirtaeki_id, dags: d };
          for (const t of MAELITOLUR) if (h[t] !== undefined && h[t] !== null) lina[t] = h[t];
          lina.uppruni = h.uppruni; lina.uppfaert = h.uppfaert;
          kort.set(d, lina);
        }
        ut.push(...kort.values());
      }
      return ut.sort((a, b) => a.dags.localeCompare(b.dags));
    },

    async vistaMaelingar(rows) {
      krefjastAdmin();
      let skrifad = 0;
      for (const r of rows || []) {
        const lina = hreinMaeling(r);
        if (!lina || !finna(g.tf.midlar, lina.midill_id)) continue;
        const k = lina.midill_id + '|' + lina.dags;
        g.tf.handvirkt[k] = { ...(g.tf.handvirkt[k] || {}), ...lina, uppfaert: new Date().toISOString() };
        skrifad++;
      }
      vista(); return skrifad;
    },

    async midlaFaerslur(fyrirtaeki_id, fra, til) {
      if (!maSja(fyrirtaeki_id)) return [];
      const ut = [];
      for (const m of g.tf.midlar.filter((x) => x.fyrirtaeki_id === fyrirtaeki_id)) {
        ut.push(...prufuRodir(m.id).faerslur.filter((p) => {
          const d = p.birt.slice(0, 10);
          return d >= fra && d <= til;
        }).map((p) => ({ ...p })));
      }
      return ut.sort((a, b) => (b.ahorf || 0) - (a.ahorf || 0)).slice(0, 300);
    },

    async skyrslur(fyrirtaeki_id) {
      if (!maSja(fyrirtaeki_id)) return [];
      /* Pósturinn í Apps Script sendir samþykkta skýrslu innan fárra
         sekúndna. Hér er það leikið eftir. */
      let breytt = false;
      for (const s of g.tf.skyrslur) {
        if (s.stada === 'samthykkt' && !s.sent_dags
            && Date.now() - new Date(s.samthykkt_dags).getTime() > 4000) {
          s.stada = 'send'; s.sent_dags = new Date().toISOString(); breytt = true;
        }
      }
      if (breytt) vista();
      const admin = erAdminPrufa();
      return g.tf.skyrslur
        .filter((s) => s.fyrirtaeki_id === fyrirtaeki_id && (admin || s.stada === 'send'))
        .map((s) => JSON.parse(JSON.stringify(s)))
        .sort((a, b) => b.manudur.localeCompare(a.manudur));
    },

    async uppfaeraSkyrslu(id, breytingar) {
      krefjastAdmin();
      const s = finna(g.tf.skyrslur, id);
      if (!s) throw new Error('Skýrslan fannst ekki.');
      if (s.stada === 'send') throw new Error('Skýrslan er þegar send og breytist ekki.');
      if (breytingar.samantekt !== undefined) {
        s.samantekt = String(breytingar.samantekt || '').slice(0, 4000) || null;
      }
      if (breytingar.stada === 'samthykkt' && s.stada === 'drog') {
        s.stada = 'samthykkt'; s.samthykkt_dags = new Date().toISOString();
      }
      vista(); return JSON.parse(JSON.stringify(s));
    },

    /* ---------- Myndböndin í prufu: sýnidæmi fyrsta fyrirtækisins ---------- */
    async myndbond(fyrirtaeki_id) {
      if (!maSja(fyrirtaeki_id)) return [];
      prufuMyndbond();
      return JSON.parse(JSON.stringify(g.tf.myndbond.filter((m) => m.fyrirtaeki_id === fyrirtaeki_id)))
        .sort((a, b) => String(b.birt || '').localeCompare(String(a.birt || '')));
    },
    async nyttMyndband(m) {
      krefjastAdmin(); prufuMyndbond();
      const nytt = { id: 'mb' + Date.now(), fyrirtaeki_id: m.fyrirtaeki_id, ...hreintMyndband(m), stofnad: new Date().toISOString(), tolur: [] };
      g.tf.myndbond.push(nytt); vista(); return JSON.parse(JSON.stringify(nytt));
    },
    async uppfaeraMyndband(id, m) {
      krefjastAdmin(); prufuMyndbond();
      const x = finna(g.tf.myndbond, id);
      if (!x) throw new Error('Myndbandið fannst ekki.');
      Object.assign(x, hreintMyndband(m)); vista(); return JSON.parse(JSON.stringify(x));
    },
    async eydaMyndbandi(id) {
      krefjastAdmin(); prufuMyndbond();
      g.tf.myndbond = g.tf.myndbond.filter((m) => m.id !== id); vista();
    },
    async vistaMyndbandstolur(rows) {
      krefjastAdmin(); prufuMyndbond();
      let n = 0;
      for (const r of rows || []) {
        const lina = hreinMyndbandstala(r);
        const m = lina && finna(g.tf.myndbond, lina.myndband_id);
        if (!m) continue;
        m.tolur = (m.tolur || []).filter((t) => t.manudur !== lina.manudur).concat([{ ...lina, fyrirtaeki_id: m.fyrirtaeki_id, uppfaert: new Date().toISOString() }]);
        n++;
      }
      vista(); return n;
    },
    async eydaMyndbandstolu(myndband_id, manudur) {
      krefjastAdmin(); prufuMyndbond();
      const m = finna(g.tf.myndbond, myndband_id);
      if (m) { m.tolur = (m.tolur || []).filter((t) => t.manudur !== manudur); vista(); }
    },

    /* ---------- Pósthólfið í prufu: sýnidæmi, ekkert fer út ---------- */
    async postholf() {
      krefjastAdmin(); prufuPostholf();
      for (const s of g.postholf.svor) {
        if (s.stada === 'bidur' && Date.now() - new Date(s.stofnad).getTime() > 4000) { s.stada = 'send'; s.sent_dags = new Date().toISOString(); }
      }
      return JSON.parse(JSON.stringify(g.postholf.thraedir)).map((t) => ({ ...t, fyr: t.fyrirtaeki_id ? { nafn: (finna(g.fyrirtaeki, t.fyrirtaeki_id) || {}).nafn } : null }))
        .sort((a, b) => b.sidast.localeCompare(a.sidast));
    },
    async postholfThradur(id) {
      krefjastAdmin(); prufuPostholf();
      return { skilabod: JSON.parse(JSON.stringify(g.postholf.skilabod.filter((m) => m.thradur_id === id))).sort((a, b) => a.dags.localeCompare(b.dags)),
               svor: JSON.parse(JSON.stringify(g.postholf.svor.filter((s) => s.thradur_id === id))) };
    },
    async merkjaPostLesinn(id) {
      krefjastAdmin(); prufuPostholf();
      const t = finna(g.postholf.thraedir, id); if (t) { t.lesid_kerfi = new Date().toISOString(); vista(); }
    },
    async undirskrift() { krefjastAdmin(); return g.undirskrift || null; },
    /* Sýnifundir í prufu, reiknaðir út frá deginum í dag */
    async dagatal() {
      krefjastAdmin();
      const d = (dagar, kl, min = 0) => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + dagar); x.setHours(kl, min); return x; };
      const fyr = (g.fyrirtaeki || []).map((f) => f.nafn);
      const listi = [
        [0, 10, 60, 'Vikufundur', 'https://meet.google.com/abc-defg-hij'], [1, 13, 45, 'Tökudagur: ' + (fyr[0] || 'viðskiptavinur'), null, 'Reykjavík'],
        [2, 9, 30, 'Símtal við ' + (fyr[1] || 'nýjan viðskiptavin'), 'https://meet.google.com/xyz-abcd-efg'], [3, 15, 60, 'Kynning á Glerhúsinu', null],
        [6, 11, 90, 'Mánaðarskýrslur yfirfarnar', null], [8, 14, 60, 'Fundur: jólaherferð ' + (fyr[2] || ''), 'https://meet.google.com/jol-herf-erd'],
        [-2, 10, 60, 'Upptaka hlaðvarps', null], [12, 10, 120, 'Vinnustofa með ' + (fyr[0] || 'viðskiptavini'), null], [15, 9, 30, 'Vikufundur', 'https://meet.google.com/abc-defg-hij']
      ];
      return listi.map(([dagar, kl, lengd, titill, hlekkur, stadur], i) => {
        const b = d(dagar, kl); const e = new Date(b.getTime() + lengd * 60000);
        return { id: 'pd' + i, titill, byrjar: b.toISOString(), endar: e.toISOString(), allan_daginn: false, fundarhlekkur: hlekkur, stadur: stadur || null, tengill: null, gestir: i % 3 };
      }).concat([{ id: 'pd-allan', titill: 'Frídagur', byrjar: d(20, 0).toISOString(), endar: d(21, 0).toISOString(), allan_daginn: true, gestir: 0 }]);
    },
    async nyrPostur({ til, efni, texti }) {
      krefjastAdmin(); prufuPostholf();
      const netfong = String(til || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (!netfong.length || netfong.length > 10) throw new Error('Settu inn 1 til 10 viðtakendur');
      const rangt = netfong.find((n) => !/^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$/i.test(n));
      if (rangt) throw new Error('Netfangið ' + rangt + ' er ekki rétt');
      if (!String(efni || '').trim()) throw new Error('Efnið vantar');
      if (!String(texti || '').trim()) throw new Error('Skrifaðu eitthvað fyrst.');
      g.postholf.svor.push({ id: 'np' + Date.now(), thradur_id: null, til: netfong.join(','), efni, texti, stada: 'bidur', stofnad: new Date().toISOString() });
      vista(); return { id: 'np' + Date.now(), stada: 'bidur' };
    },
    async vistaUndirskrift(gogn) { krefjastAdmin(); g.undirskrift = gogn; vista(); },
    async tengingarStada() { krefjastAdmin(); return { ...(g.tengingar || {}) }; },
    async vistaTengingu(veita, stillingar, leyndo) {
      krefjastAdmin();
      const fyrri = (g.tengingar || {})[veita];
      const gildi = leyndo ? Object.values(leyndo).filter(Boolean) : [];
      if (!gildi.length && !fyrri) throw new Error('Það vantar lykilinn');
      if (gildi.some((v) => String(v).length < 4 || /\s/.test(v))) throw new Error('Lykillinn er ekki á réttu formi');
      if (veita === 'shopify' && !/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/.test((stillingar || {}).verslun || '')) throw new Error('Verslunin á að vera á forminu nafn.myshopify.com');
      const adal = leyndo && (leyndo.lykill || leyndo.clientSecret || leyndo.token || gildi[0]);
      /* Í sýnidæminu fer lykillinn hvergi: bara athugað hvort hann líti rétt út */
      const prufa = gildi.length ? synidaemiPrufa(veita, leyndo) : fyrri ? { prufa_svar: fyrri.prufa_svar } : { prufa_svar: null };
      g.tengingar = { ...(g.tengingar || {}), [veita]: { veita, stillingar: stillingar || {}, sidustu4: adal ? String(adal).slice(-4) : (fyrri && fyrri.sidustu4) || null, uppfaert: new Date().toISOString(), prufad: null, prufa_svar: prufa.prufa_svar } };
      vista();
    },
    async eydaTengingu(veita) { krefjastAdmin(); const t = { ...(g.tengingar || {}) }; delete t[veita]; g.tengingar = t; vista(); },
    async kerfisstillingar() { return { ...(g.kerfisstillingar || {}) }; },
    async vistaKerfisstillingu(lykill, gildi) { krefjastAdmin(); g.kerfisstillingar = { ...(g.kerfisstillingar || {}), [lykill]: gildi }; vista(); },
    async profaTengingu(veita) {
      krefjastAdmin();
      const t = (g.tengingar || {})[veita];
      if (!t) return { ok: false, svar: 'Enginn lykill vistaður fyrir þessa tengingu' };
      const ok = /^ok/i.test(t.prufa_svar || '');
      g.tengingar = { ...g.tengingar, [veita]: { ...t, prufad: new Date().toISOString() } };
      vista();
      return { ok, svar: String(t.prufa_svar || 'Lykillinn lítur ekki rétt út').replace(/^ok:?\s*/i, '') };
    },
    async svaraPosti(thradur_id, texti) {
      krefjastAdmin(); prufuPostholf();
      if (!String(texti || '').trim()) throw new Error('Skrifaðu eitthvað fyrst.');
      const s = { id: 'sv' + Date.now(), thradur_id, texti: String(texti).slice(0, 10000), stada: 'bidur', villa: null, stofnad: new Date().toISOString(), sent_dags: null };
      g.postholf.svor.push(s); vista(); return { ...s };
    },

    async sendaTolfraedi(rod) {
      if (!erAdminPrufa()) throw new Error('Bara stjórnendur senda tölfræði');
      if (!rod.netfong || !rod.netfong.length) throw new Error('Veldu 1 til 10 viðtakendur');
      g.tf.sendingar = (g.tf.sendingar || []).concat([{ ...rod, id: 'ts' + Date.now(), stada: 'send', stofnad: new Date().toISOString() }]).slice(-20);
      vista(); return { id: 'ts' + Date.now(), stada: 'send' };
    },

    /* Stofan í sýnidæminu.
       Ekkert fer út á netið. Hvert nýtt fall svarar með "Sýnidæmi" og segir
       aldrei að eitthvað hafi verið sent eða búið til. */

    async stofa() { return g.innskradur ? prufuStofa() : null; },

    async minStada() { const n = innskradurPrufa(); return n ? prufuMinStada(n) : null; },

    async vistaStofu(breytingar) {
      krefjastAdmin();
      const nu = prufuStofa();
      const hrein = hreinStofubreyting(breytingar, nu, { gagnaslod: true });
      if ('merki_url' in hrein) {
        stortStofuMerki = null;
        if (hrein.merki_url === null) hrein.merki_url = '';              /* fjarlægt: ekki aftur í merki úr "Settu saman" */
        else if (hrein.merki_url.length > 300000) { stortStofuMerki = hrein.merki_url; hrein.merki_url = ''; }
      }
      g.stofa = { ...(g.stofa || {}), ...hrein };
      vista(); return prufuStofa();
    },

    async setjaStofuMerki(skra) {
      krefjastAdmin();
      if (!skra || !['image/png', 'image/jpeg', 'image/webp'].includes(skra.type)) throw new Error('Merkið þarf að vera png, jpg eða webp mynd.');
      if (skra.size > 2 * 1024 * 1024) throw new Error('Merkið má vera mest 2 MB.');
      const slod = await new Promise((skila, hafna) => {
        const lesari = new FileReader();
        lesari.onload = () => skila(lesari.result);
        lesari.onerror = () => hafna(new Error('Náði ekki að lesa skrána.'));
        lesari.readAsDataURL(skra);
      });
      return this.vistaStofu({ merki_url: slod });
    },

    async hendaStofuMerki() { return this.vistaStofu({ merki_url: null }); },

    async verkNetfong() {
      if (!g.innskradur) return [];
      return [{ netfang: PRUFA_VERK, stofnad: new Date(Date.now() - 30 * 864e5).toISOString() }];
    },

    async verkpostStada() {
      krefjastAdmin();
      return JSON.parse(JSON.stringify(g.verkpostur || []));
    },

    async bjodaNotanda(bod) {
      krefjastAdmin();
      const hreint = hreintBod(bod);
      if (hreint.fyrirtaeki_id && !finna(g.fyrirtaeki, hreint.fyrirtaeki_id)) throw new Error('Fyrirtækið fannst ekki.');
      return { ok: true, synidaemi: true, texti: 'Sýnidæmi: ekkert boð fór út.', svar: 'Sýnidæmi: ekkert boð fór út.' };
    },

    async bod() {
      krefjastAdmin();
      const nu = Date.now();
      return (g.bod || []).filter((b) => !b.notad)
        .map((b) => ({ ...b, fyrirtaeki: b.fyrirtaeki_id ? fyrNafn(b.fyrirtaeki_id) : null, runnid_ut: new Date(b.utrunnid).getTime() < nu }))
        .sort(nyjast);
    },

    async eydaBodi(id) { krefjastAdmin(); g.bod = (g.bod || []).filter((b) => b.id !== id); vista(); },

    /* Sýnir hvaða verk yrðu til úr þræðinum, en býr ekkert til */
    async verkUrThraedi(thradur_id, fyrirtaeki_id) {
      krefjastAdmin(); prufuPostholf();
      if (!thradur_id) throw new Error('Þráðinn vantar.');
      if (!fyrirtaeki_id || !finna(g.fyrirtaeki, fyrirtaeki_id)) throw new Error('Veldu fyrirtæki fyrst.');
      const t = finna(g.postholf.thraedir, thradur_id);
      const sidast = g.postholf.skilabod.filter((m) => m.thradur_id === thradur_id && !m.fra_okkur).pop();
      const linur = String((sidast && sidast.texti) || '').split('\n')
        .map((l) => l.trim()).filter((l) => /^([-*\u2022]|\d+[.)])\s+\S/.test(l))
        .map((l) => l.replace(/^([-*\u2022]|\d+[.)])\s+/, '').slice(0, 200));
      const titlar = (linur.length ? linur : [(t && t.efni) || 'Verk úr pósti']).slice(0, 30);
      return { ok: true, synidaemi: true, fjoldi: 0, titlar,
               texti: 'Sýnidæmi: þetta yrðu ' + titlar.length + ' verk. Ekkert var búið til.' };
    },

    async reikningsefni(manudur) {
      krefjastAdmin();
      const m = manudur || new Date().toISOString().slice(0, 7);
      if (!MANUDUR.test(m)) throw new Error('Mánuðurinn á að vera á forminu 2026-11.');
      return { ok: true, synidaemi: true, manudur: m, efni: prufuReikningsefni(m) };
    },

    async reikningsdrog(beidni) {
      krefjastAdmin();
      hreinDrog(beidni);
      return { ok: true, synidaemi: true, drog: null, texti: 'Sýnidæmi: engin drög voru búin til.', svar: 'Sýnidæmi: engin drög voru búin til.' };
    },

    async reikningar(sia) {
      krefjastAdmin();
      const s = hlutur(sia);
      return (g.reikningsdrog || [])
        .filter((r) => (!s.manudur || String(r.manudur || '').slice(0, 7) === s.manudur)
                    && (!s.uppruni || r.uppruni === s.uppruni)
                    && (!s.uppruni_id || r.uppruni_id === s.uppruni_id))
        .map((r) => ({ ...JSON.parse(JSON.stringify(r)), fyrirtaeki: fyrNafn(r.fyrirtaeki_id) }))
        .sort(nyjast);
    },

    async shopify(verk, eftir) {
      krefjastAdmin();
      if (!SHOPIFY_VERK.includes(verk)) throw new Error('Óþekkt aðgerð í versluninni.');
      return prufuShopify(verk, eftir, Number((g.kerfisstillingar || {}).lager_vidvorun) || 5);
    },

    async gervigreind(verk, id) {
      krefjastAdmin();
      if (!GERVIGREIND_VERK.includes(verk)) throw new Error('Óþekkt aðgerð.');
      if (!id) throw new Error('Það vantar hvað á að vinna með.');
      const nafn = prufuStofa().nafn;
      const texti = verk.startsWith('svar')
        ? 'Sýnidæmi: svona líta drög frá gervigreindinni út.\n\nSæl og takk fyrir póstinn.\n\nVið förum yfir þetta og svörum þér fljótlega með nánari upplýsingum.\n\nKveðja,\n' + nafn
        : 'Sýnidæmi: hér kæmi stutt samantekt frá gervigreindinni. Í alvöru Glerhúsi les hún gögnin og dregur saman það helsta í nokkrum setningum, sem þú ferð yfir áður en nokkur sér hana.';
      return { ok: true, synidaemi: true, verk, texti, styttist: false };
    },

    async greinaSkjaskot(fyrirtaeki_id, myndir) {
      krefjastAdmin();
      if (!Array.isArray(myndir) || !myndir.length) throw new Error('Settu inn að minnsta kosti eitt skjáskot.');
      await new Promise((r) => setTimeout(r, 900));
      return {
        ok: true, synidaemi: true, veita: 'claude', timabil: '22. til 23. nóvember',
        midlar: [{ midill: 'instagram', reikningur: null, ahorf: 48200, ahorf_breyting_pr: 212, nadir: 19400, nadir_breyting_pr: 145,
          samskipti: 3150, samskipti_breyting_pr: 98, fylgjendur: 8420, fylgjendur_breyting: 236, likes: 2710, athugasemdir: 184,
          deilingar: 410, vistanir: 96, heimsoknir: 1320, faerslur: 4 }],
        faerslur: [
          { titill: 'Markið í lokin og fagnið', midill: 'instagram', tegund: 'reel', birt: null, ahorf: 31200, likes: 1840, athugasemdir: 96, deilingar: 290 },
          { titill: 'Upphitun og stemningin í stúkunni', midill: 'instagram', tegund: 'reel', birt: null, ahorf: 11800, likes: 620, athugasemdir: 41, deilingar: 77 }
        ],
        samantekt: 'Helgin skilaði 48.200 áhorfum og efnið náði til 19.400 reikninga. Fylgjendum fjölgaði um 236.',
        oljost: null
      };
    },

    async rekstur() { throw new Error('Rekstur er ekki í boði í sýnidæminu.'); },

    async oauthByrja() { throw new Error('Sýnidæmi: þessi tenging er ekki í boði hér.'); },

    /* Bara í prufu: byrja upp á nýtt */
    hreinsa() { g = sjalfgefid(); BLOB.clear(); vista(); }
  };

  /* Það sem "Settu saman" vistaði, eða null */
  function byggja() {
    try { const x = JSON.parse(localStorage.getItem('glerhus-tveir-byggja') || 'null'); return x && x.buid ? x : null; } catch (e) { return null; }
  }

  function prufuStofa() {
    const b = byggja();
    const s = g.stofa || {};
    const merkiB = b && typeof b.merki === 'string'
      && (/^https:\/\//.test(b.merki) || /^data:image\/(png|jpeg|webp);base64,/.test(b.merki)) ? b.merki : null;
    const liturB = b && /^#[0-9a-f]{6}$/i.test(b.litur || '') ? b.litur : null;
    const leturB = b && /^[A-Za-z0-9 ]{2,40}$/.test(b.letur || '') ? b.letur.trim() : null;
    return {
      id: PRUFA_STOFA_ID,
      nafn: s.nafn || (b && b.nafn) || 'Norðurljós',
      slug: 'synidaemi',
      stada: 'virk',
      netfang: s.netfang !== undefined ? s.netfang : 'sara@nordurljos.is',
      merki_url: stortStofuMerki || (s.merki_url !== undefined && s.merki_url !== null ? (s.merki_url || null) : merkiB),
      litur: s.litur || liturB,
      vefur: s.vefur || null,
      postholf: true,
      sendir_fra: 'verk',
      einingar: Array.isArray(s.einingar) ? s.einingar : (b && Array.isArray(b.einingar) ? b.einingar : []),
      stillingar: { ...(leturB ? { letur: leturB } : {}), ...(b && b.grein ? { grein: b.grein } : {}), ...hlutur(s.stillingar) },
      uppsetning: { lokid: true, ...hlutur(s.uppsetning) },
      verk: PRUFA_VERK,
      verk_netfong: [PRUFA_VERK]
    };
  }

  function prufuMinStada(n) {
    return {
      stofa_id: PRUFA_STOFA_ID, stada: 'virk', slug: 'synidaemi', nafn: prufuStofa().nafn,
      er_admin: n.hlutverk === 'admin', er_eigandi: n.id === 'u-mirza', postholf: true,
      google_tilbuid: false, meta_tilbuid: false, tiktok_tilbuid: false, er_rekstraradili: false
    };
  }

  /* Sama rökfræði og reikningar.ts: lokin verkefni sem eru ekki rukkuð,
     samningar virkir í mánuðinum og staðfest ógreidd aukaverkefni, hvert
     án draga fyrir. */
  function prufuReikningsefni(m) {
    const fyrirtaekiAf = (r) => finna(g.fyrirtaeki, r.fyrirtaeki_id)
      || g.fyrirtaeki.find((f) => String(f.nafn).toLowerCase() === String(r.vidskiptavinur || '').toLowerCase()) || null;
    const hefurDrog = (uppruni, id, manudur) => (g.reikningsdrog || []).some((d) => d.uppruni === uppruni && d.uppruni_id === id
      && d.stada !== 'villa' && (!manudur || String(d.manudur || '').slice(0, 7) === manudur));
    const vskStofu = [0, 11, 24].includes(Number((g.kerfisstillingar || {}).vsk_hlutfall))
      ? Number(g.kerfisstillingar.vsk_hlutfall) : 24;
    const lina = (uppruni, r, heiti, upphaed, vsklaust, f) => ({
      uppruni, id: r.id, heiti, upphaed: Number(upphaed) || 0, vsklaust: !!vsklaust,
      vsk: vsklaust ? 0 : vskStofu,
      linur: [{ texti: heiti, upphaed: Number(upphaed) || 0 }],
      fyrirtaeki_id: f ? f.id : null, fyrirtaeki: f ? f.nafn : (r.vidskiptavinur || null),
      kennitala: !!(f && f.kennitala), reikningsnetfang: !!(f && f.reikningsnetfang),
      manudur: uppruni === 'samningur' ? m : null
    });
    const ut = [];
    for (const v of g.verkefni) {
      const i = g.innri[v.id] || {};
      if (v.stada === 'lokid' && !v.innan_samnings && v.verd_okkar !== null && v.verd_okkar !== undefined
          && (i.reikningur || 'ekki_rukkad') === 'ekki_rukkad' && !hefurDrog('verkefni', v.id)) {
        ut.push(lina('verkefni', v, v.titill, v.verd_okkar, false, finna(g.fyrirtaeki, v.fyrirtaeki_id)));
      }
    }
    const manNafn = MAN_NOFN[Number(m.slice(5, 7)) - 1];
    for (const s of g.samningar || []) {
      const hefst = String(s.hefst || '').slice(0, 7), lykur = s.lykur ? String(s.lykur).slice(0, 7) : null;
      if (hefst && hefst <= m && (!lykur || lykur >= m) && !hefurDrog('samningur', s.id, m)) {
        ut.push(lina('samningur', s, (s.thjonusta || 'Þjónusta') + ' ' + manNafn, s.upphaed, s.vsklaust, fyrirtaekiAf(s)));
      }
    }
    for (const a of g.aukaverkefni || []) {
      if (a.stada === 'stadfest' && !a.greitt && !hefurDrog('aukaverkefni', a.id)) {
        ut.push(lina('aukaverkefni', a, a.heiti, a.upphaed, a.vsklaust, fyrirtaekiAf(a)));
      }
    }
    return ut;
  }

  function innskradurPrufa() { return g.innskradur ? finna(g.notendur, g.innskradur) : null; }
  /* Fjögur sýnimyndbönd á hvert fyrirtæki sem á miðil, með tölum síðustu mánaða */
  function prufuMyndbond() {
    if (Array.isArray(g.tf.myndbond)) return;
    const fyrirtaekin = [...new Set(g.tf.midlar.map((m) => m.fyrirtaeki_id))];
    const nu = new Date();
    const man = (k) => { const d = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() - k, 1)); return d.toISOString().slice(0, 10); };
    const dagur = (k, d) => man(k).slice(0, 8) + String(d).padStart(2, '0');
    const smida = (fid, i, titill, midill, birtK, tolur, tengt) => ({
      id: 'mb-' + fid + '-' + i, fyrirtaeki_id: fid, titill, midill, slod: null, birt: dagur(birtK, 6 + i * 3), faersla_id: tengt ? 'sjalfvirkt' : null,
      stofnad: new Date().toISOString(),
      tolur: tolur.map((a, k) => ({ myndband_id: 'mb-' + fid + '-' + i, fyrirtaeki_id: fid, manudur: man(birtK - k), ahorf: a,
        likes: Math.round(a * 0.06), athugasemdir: Math.round(a * 0.004), deilingar: Math.round(a * 0.011), vistanir: Math.round(a * 0.009),
        uppruni: tengt ? 'sjalfvirkt' : 'handvirkt' })).filter((t) => t.manudur <= man(0))
    });
    g.tf.myndbond = fyrirtaekin.flatMap((fid, n) => [
      smida(fid, 1, 'Nýja línan kynnt', 'instagram', 2, [8400, 3100, 1200].map((x) => Math.round(x * (1 - n * 0.2))), true),
      smida(fid, 2, 'Dagur á bak við tjöldin', 'tiktok', 2, [14200, 5200, 2100].map((x) => Math.round(x * (1 - n * 0.2))), false),
      smida(fid, 3, 'Viðtal við eigandann', 'facebook', 1, [3900, 1600].map((x) => Math.round(x * (1 - n * 0.2))), false),
      smida(fid, 4, 'Jólatilboðin', 'instagram', 0, [2650].map((x) => Math.round(x * (1 - n * 0.2))), false)
    ]);
    vista();
  }

  /* Nokkrir sýniþræðir: tveir frá viðskiptavinum, einn nýr og einn gamall */
  function prufuPostholf() {
    if (g.postholf) return;
    const kl = (dagar, klst) => new Date(Date.now() - dagar * 864e5 - klst * 36e5).toISOString();
    const vid = (g.notendur || []).filter((n) => n.hlutverk === 'vidskiptavinur' && n.fyrirtaeki_id);
    const a = vid[0] || { nafn: 'Anna Sigurðardóttir', netfang: 'anna@hlidarkaup.is', fyrirtaeki_id: null };
    const b = vid[1] || { nafn: 'Jón Steinsson', netfang: 'jon@steinvik.is', fyrirtaeki_id: null };
    const thraedir = [
      { id: 'p1', efni: 'Myndböndin fyrir desember', fra_nafn: a.nafn, fra_netfang: a.netfang, fyrirtaeki_id: a.fyrirtaeki_id, sidast: kl(0, 1), fjoldi: 2, olesid_gmail: true, lesid_kerfi: null, tengill: null },
      { id: 'p2', efni: 'Reikningur fyrir nóvember', fra_nafn: b.nafn, fra_netfang: b.netfang, fyrirtaeki_id: b.fyrirtaeki_id, sidast: kl(0, 5), fjoldi: 1, olesid_gmail: true, lesid_kerfi: null, tengill: null },
      { id: 'p3', efni: 'Fyrirspurn um vefsíðu', fra_nafn: 'Guðrún Pálsdóttir', fra_netfang: 'gudrun@bakaribaer.is', fyrirtaeki_id: null, sidast: kl(1, 2), fjoldi: 1, olesid_gmail: false, lesid_kerfi: null, tengill: null },
      { id: 'p4', efni: 'Takk fyrir fundinn', fra_nafn: 'Einar Már', fra_netfang: 'einar@fjallakofinn.is', fyrirtaeki_id: null, sidast: kl(3, 4), fjoldi: 3, olesid_gmail: false, lesid_kerfi: kl(3, 1), tengill: null }
    ];
    const stofa = (g.notendur || []).find((n) => n.hlutverk === 'admin') || { nafn: 'Við', netfang: 'stofan@demo.is' };
    const skilabod = [
      { id: 'pm1', thradur_id: 'p1', fra_nafn: stofa.nafn, fra_netfang: stofa.netfang, dags: kl(1, 3), fra_okkur: true, vidhengi: 0, texti: 'Hæ ' + String(a.nafn).split(' ')[0] + ',\n\nHér eru drögin að fjórum myndböndum fyrir desember. Segðu mér hvað þér finnst.\n\nKveðja' },
      { id: 'pm2', thradur_id: 'p1', fra_nafn: a.nafn, fra_netfang: a.netfang, dags: kl(0, 1), fra_okkur: false, vidhengi: 0, texti: 'Þetta lítur vel út! Getið þið bætt við einu myndbandi um jólatilboðin?\n\nKveðja,\n' + a.nafn },
      { id: 'pm3', thradur_id: 'p2', fra_nafn: b.nafn, fra_netfang: b.netfang, dags: kl(0, 5), fra_okkur: false, vidhengi: 1, texti: 'Sæl,\n\nGætuð þið sent reikninginn fyrir nóvember á bokhald@? Hann kom ekki til okkar.\n\nTakk,\n' + b.nafn },
      { id: 'pm4', thradur_id: 'p3', fra_nafn: 'Guðrún Pálsdóttir', fra_netfang: 'gudrun@bakaribaer.is', dags: kl(1, 2), fra_okkur: false, vidhengi: 0, texti: 'Góðan dag,\n\nVið erum lítið bakarí og okkur vantar nýja vefsíðu. Hvað myndi það kosta?\n\nBestu kveðjur,\nGuðrún' },
      { id: 'pm5', thradur_id: 'p4', fra_nafn: stofa.nafn, fra_netfang: stofa.netfang, dags: kl(4, 2), fra_okkur: true, vidhengi: 0, texti: 'Takk fyrir góðan fund í dag. Við sendum tillögu fyrir föstudag.' },
      { id: 'pm6', thradur_id: 'p4', fra_nafn: 'Einar Már', fra_netfang: 'einar@fjallakofinn.is', dags: kl(3, 4), fra_okkur: false, vidhengi: 0, texti: 'Sömuleiðis, hlakka til.' }
    ];
    thraedir.forEach((t) => { const s = skilabod.filter((m) => m.thradur_id === t.id); t.snid = s.length ? s[s.length - 1].texti.replace(/\s+/g, ' ').slice(0, 160) : ''; });
    g.postholf = { thraedir, skilabod, svor: [] };
    vista();
  }

  function erAdminPrufa() { const n = innskradurPrufa(); return !!n && n.hlutverk === 'admin'; }
  function maSja(fyrirtaeki_id) {
    const n = innskradurPrufa();
    return !!n && (n.hlutverk === 'admin' || n.fyrirtaeki_id === fyrirtaeki_id);
  }
  function krefjastAdmin() { if (!erAdminPrufa()) throw new Error('Þú hefur ekki aðgang að þessu.'); }
}

/* ==========================================================================
   Tölfræði í prufu
   Daglegu tölurnar eru reiknaðar út frá föstu fræi í hvert sinn, svo
   localStorage fyllist ekki og sömu dagar gefa alltaf sömu tölur.
   ========================================================================== */

function ymdStadur(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function prufuMidlar() {
  const t = new Date(Date.now() - 400 * 86400000).toISOString();
  return [
    { id: 'm1', fyrirtaeki_id: 'f1', midill: 'instagram', nafn: 'hlidarkaup', ytra_id: '17841400000000001',
      slod: null, virkt: true, stofnad: t },
    { id: 'm2', fyrirtaeki_id: 'f1', midill: 'facebook', nafn: 'Hlíðarkaup', ytra_id: '100000000000001',
      slod: null, virkt: true, stofnad: t },
    { id: 'm3', fyrirtaeki_id: 'f2', midill: 'instagram', nafn: 'steinvik', ytra_id: '17841400000000002',
      slod: null, virkt: true, stofnad: t },
    { id: 'm4', fyrirtaeki_id: 'f2', midill: 'tiktok', nafn: 'steinvik.ehf', ytra_id: null,
      slod: null, virkt: true, stofnad: t }
  ];
}

const TEXTAR_HLIDARKAUP = [
  'Ný sending af ávöxtum komin í hús', 'Tilboð helgarinnar: grillkjöt á góðu verði',
  'Opið til 21 öll kvöld vikunnar', 'Á bak við tjöldin í bakaríinu',
  'Starfsfólk vikunnar kynnir sig', 'Uppskrift vikunnar: fiskréttur fyrir fjóra',
  'Nýtt í kælinum', 'Takk fyrir frábæra viku'
];
const TEXTAR_STEINVIK = [
  'Nýtt verkefni að klárast', 'Fyrir og eftir: pallur í Garðabæ', 'Hópurinn á verkstað í morgun',
  'Svona leggjum við hellur', 'Við erum að ráða smið', 'Vika í vinnu á 30 sekúndum',
  'Spurt og svarað: hvað tekur pallur langan tíma'
];

function prufuSnid(id) {
  return ({
    m1: { f: 'f1', fylg: 4200, voxtur: 3.2, ahorf: 2600, faerslur: 3.2, fraeid: 11,
          tegundir: ['reel', 'karusell', 'mynd', 'reel'], textar: TEXTAR_HLIDARKAUP },
    m2: { f: 'f1', fylg: 6800, voxtur: 1.1, ahorf: 1500, faerslur: 2.4, fraeid: 23, eydur: 0.012,
          tegundir: ['mynd', 'myndband', 'annad'], textar: TEXTAR_HLIDARKAUP },
    m3: { f: 'f2', fylg: 1850, voxtur: 2.0, ahorf: 900, faerslur: 2.6, fraeid: 37,
          tegundir: ['reel', 'mynd', 'karusell'], textar: TEXTAR_STEINVIK },
    m4: { f: 'f2', fylg: 950, voxtur: 6.0, ahorf: 3200, faerslur: 3.0, fraeid: 41, toppar: 0.03,
          tegundir: ['myndband'], textar: TEXTAR_STEINVIK }
  })[id] || null;
}

/* Lítill slembigjafi með fræi (mulberry32) */
function slembir(fraeid) {
  let a = fraeid >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRUFA_MINNI = new Map();

/* Daglegar tölur og færslur eins miðils, frá 1. júní 2025 (eða 400
   dögum aftur) til gærdagsins. Hægur vöxtur, vikutaktur og nokkrir toppar. */
function prufuRodir(id) {
  const snid = prufuSnid(id);
  if (!snid) return { maelingar: [], faerslur: [] };
  const igaer = new Date(); igaer.setHours(12, 0, 0, 0); igaer.setDate(igaer.getDate() - 1);
  const lykill = id + '|' + ymdStadur(igaer);
  if (PRUFA_MINNI.has(lykill)) return PRUFA_MINNI.get(lykill);

  const r = slembir(snid.fraeid);
  const d = new Date(2025, 5, 1, 12);
  const fyrst = new Date(igaer); fyrst.setDate(fyrst.getDate() - 400);
  if (fyrst < d) d.setTime(fyrst.getTime());
  const VIKA = [0.86, 1.04, 1.08, 1.0, 1.06, 1.18, 0.92];
  const maelingar = [];
  const faerslur = [];
  let fylg = snid.fylg;
  let i = 0;
  while (d <= igaer) {
    const dags = ymdStadur(d);
    const vidgangur = 1 + i / 900;
    const fjoldi = r() < snid.faerslur / 7 ? (r() < 0.12 ? 2 : 1) : 0;
    const toppur = r() < (snid.toppar || 0.012) ? 2.6 + r() * 2.4 : 1;
    const ahorf = Math.round(snid.ahorf * vidgangur * VIKA[d.getDay()] * (0.82 + r() * 0.36)
      * (fjoldi ? 1.35 : 1) * toppur);
    fylg += snid.voxtur * (0.4 + r() * 1.2) + (toppur > 1 ? snid.voxtur * 6 * toppur : 0)
      - (r() < 0.05 ? snid.voxtur * 2 : 0);
    const vantar = snid.eydur ? r() < snid.eydur : false;
    if (!vantar) {
      maelingar.push({
        midill_id: id, fyrirtaeki_id: snid.f, dags, fylgjendur: Math.round(fylg), ahorf,
        nadir: Math.round(ahorf * (0.55 + r() * 0.15)),
        samskipti: Math.round(ahorf * (0.03 + r() * 0.03)),
        heimsoknir: Math.round(ahorf * (0.015 + r() * 0.015)),
        faerslur: fjoldi, uppruni: 'sjalfvirkt', uppfaert: dags + 'T06:00:00Z'
      });
    }
    for (let k = 0; k < fjoldi; k++) {
      const tegund = snid.tegundir[Math.floor(r() * snid.tegundir.length)];
      const pa = Math.round(snid.ahorf * vidgangur * (0.6 + r() * 1.6) * toppur
        * (tegund === 'reel' || tegund === 'myndband' ? 1.5 : 1));
      const ytra = id + '-' + i + '-' + k;
      faerslur.push({
        id: 'p-' + ytra, midill_id: id, fyrirtaeki_id: snid.f, ytra_id: ytra,
        birt: dags + 'T' + String(9 + Math.floor(r() * 11)).padStart(2, '0') + ':'
          + String(Math.floor(r() * 60)).padStart(2, '0') + ':00Z',
        tegund, texti: snid.textar[Math.floor(r() * snid.textar.length)],
        slod: 'https://example.com/faersla/' + ytra, mynd_slod: null,
        ahorf: pa, nadir: Math.round(pa * (0.6 + r() * 0.2)),
        likes: Math.round(pa * (0.02 + r() * 0.04)),
        athugasemdir: Math.round(pa * (0.002 + r() * 0.004)),
        deilingar: Math.round(pa * (0.001 + r() * 0.004)),
        vistanir: Math.round(pa * (0.001 + r() * 0.006)),
        uppfaert: dags + 'T06:00:00Z'
      });
    }
    d.setDate(d.getDate() + 1);
    i++;
  }
  const ut = { maelingar, faerslur };
  PRUFA_MINNI.set(lykill, ut);
  return ut;
}

/* Sama lögun og manadar_tolur skilar úr gagnagrunninum, fyrir eitt fyrirtæki */
function prufuManadarTolur(fyr, midlar, manudur) {
  const [ar, man] = manudur.split('-').map(Number);
  const lok = ymdStadur(new Date(ar, man, 0, 12));
  const fyrriFra = ymdStadur(new Date(ar, man - 2, 1, 12));
  const fyrriLok = ymdStadur(new Date(ar, man - 1, 0, 12));
  const summa = (radir, k) => {
    const med = radir.filter((x) => x[k] !== null && x[k] !== undefined);
    return med.length ? med.reduce((a, x) => a + x[k], 0) : null;
  };
  const midlarUt = midlar.map((md) => {
    const { maelingar, faerslur } = prufuRodir(md.id);
    const iMan = maelingar.filter((x) => x.dags >= manudur && x.dags <= lok);
    const iFyrri = maelingar.filter((x) => x.dags >= fyrriFra && x.dags <= fyrriLok);
    const fyrir = maelingar.filter((x) => x.dags < manudur && x.fylgjendur !== null);
    const iManF = iMan.filter((x) => x.fylgjendur !== null);
    const upphaf = fyrir.length ? fyrir[fyrir.length - 1].fylgjendur : (iManF.length ? iManF[0].fylgjendur : null);
    const lokF = iManF.length ? iManF[iManF.length - 1].fylgjendur : null;
    return {
      midill_id: md.id, midill: md.midill, nafn: md.nafn,
      fylgjendur_upphaf: upphaf, fylgjendur_lok: lokF,
      fylgjendur_breyting: upphaf !== null && lokF !== null ? lokF - upphaf : null,
      ahorf: summa(iMan, 'ahorf'), ahorf_fyrri: summa(iFyrri, 'ahorf'),
      nadir: summa(iMan, 'nadir'), nadir_fyrri: summa(iFyrri, 'nadir'),
      samskipti: summa(iMan, 'samskipti'), samskipti_fyrri: summa(iFyrri, 'samskipti'),
      faerslur: summa(iMan, 'faerslur'),
      dagar_med_gognum: new Set(iMan.map((x) => x.dags)).size,
      bestu_faerslur: faerslur
        .filter((p) => p.birt.slice(0, 10) >= manudur && p.birt.slice(0, 10) <= lok)
        .sort((a, b) => (b.ahorf || 0) - (a.ahorf || 0)).slice(0, 3)
        .map((p) => ({ texti: p.texti, slod: p.slod, mynd_slod: p.mynd_slod, tegund: p.tegund,
                       birt: p.birt, ahorf: p.ahorf, nadir: p.nadir, likes: p.likes,
                       athugasemdir: p.athugasemdir }))
    };
  });
  const s = (k) => summa(midlarUt, k);
  return {
    fyrirtaeki_id: fyr.id, fyrirtaeki: fyr.nafn, manudur, midlar: midlarUt,
    samtals: {
      fylgjendur_lok: s('fylgjendur_lok'), fylgjendur_breyting: s('fylgjendur_breyting'),
      ahorf: s('ahorf'), ahorf_fyrri: s('ahorf_fyrri'), nadir: s('nadir'), nadir_fyrri: s('nadir_fyrri'),
      samskipti: s('samskipti'), samskipti_fyrri: s('samskipti_fyrri'), faerslur: s('faerslur')
    }
  };
}

const MAN_NOFN = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí',
                  'ágúst', 'september', 'október', 'nóvember', 'desember'];

/* Einfaldur texti eins og sniðmátið í Apps Script býr til */
function prufuSamantekt(t) {
  const s = t.samtals || {};
  const [ar, man] = t.manudur.split('-').map(Number);
  const nu = MAN_NOFN[man - 1];
  const fyrri = MAN_NOFN[(man + 10) % 12];
  const tala = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const setn = [];
  if (s.fylgjendur_breyting !== null && s.fylgjendur_lok !== null) {
    if (s.fylgjendur_breyting > 0) {
      setn.push('Fylgjendum fjölgaði um ' + tala(s.fylgjendur_breyting) + ' í ' + nu + ' og eru nú ' + tala(s.fylgjendur_lok) + '.');
    } else if (s.fylgjendur_breyting < 0) {
      setn.push('Fylgjendum fækkaði um ' + tala(s.fylgjendur_breyting) + ' í ' + nu + ' og eru nú ' + tala(s.fylgjendur_lok) + '.');
    } else {
      setn.push('Fjöldi fylgjenda stóð í stað í ' + nu + ', ' + tala(s.fylgjendur_lok) + ' talsins.');
    }
  }
  if (s.ahorf !== null && s.ahorf_fyrri) {
    const p = Math.round((s.ahorf - s.ahorf_fyrri) / s.ahorf_fyrri * 100);
    setn.push('Áhorf voru ' + tala(s.ahorf) + ', '
      + (p > 0 ? p + '% fleiri en' : p < 0 ? (-p) + '% færri en' : 'jafn mörg og') + ' í ' + fyrri + '.');
  }
  if (s.faerslur !== null) {
    const ein = s.faerslur % 10 === 1 && s.faerslur % 100 !== 11;
    setn.push(s.faerslur + (ein ? ' færsla fór út.' : ' færslur fóru út.'));
  }
  return setn.join(' ') || null;
}

/* Ein drög fyrir síðasta mánuð og sendar skýrslur fyrir mánuðina á undan */
function prufuSkyrslur(fyr, midlar) {
  const ut = [];
  const nu = new Date(); nu.setDate(1); nu.setHours(12, 0, 0, 0);
  for (const f of fyr.filter((x) => midlar.some((m) => m.fyrirtaeki_id === x.id))) {
    const hans = midlar.filter((m) => m.fyrirtaeki_id === f.id);
    for (let k = 1; k <= 4; k++) {
      const manudur = ymdStadur(new Date(nu.getFullYear(), nu.getMonth() - k, 1, 12));
      const naesti = ymdStadur(new Date(nu.getFullYear(), nu.getMonth() - k + 1, 1, 12));
      const tolur = prufuManadarTolur(f, hans, manudur);
      const sent = k > 1;
      ut.push({
        id: 's-' + f.id + '-' + manudur, fyrirtaeki_id: f.id, manudur, tolur,
        samantekt: prufuSamantekt(tolur), stada: sent ? 'send' : 'drog',
        samthykkt_dags: sent ? naesti + 'T09:12:00Z' : null,
        sent_dags: sent ? naesti + 'T09:14:00Z' : null,
        stofnad: naesti + 'T06:05:00Z'
      });
    }
  }
  return ut;
}

/* ==========================================================================
   Stofan og verslunin í sýnidæminu
   ========================================================================== */

const PRUFA_STOFA_ID = 'stofa-synidaemi';
const PRUFA_VERK = 'synidaemi' + VERK_LEN;

/* Sama lögun og Edge Function shopify skilar:
   pantanir: { pantanir: [{ id, nafn, stofnad, greidsla, afgreidsla, upphaed, gjaldmidill, linur: [{ titill, magn }], slod }], meira, eftir }
   vorur og lager: { vorur: [{ id, titill, stada, birgdir, mynd, afbrigdi: [{ sku, titill, verd, birgdir }], slod }], meira, eftir, hamark? }
   yfirlit: { nafn, gjaldmidill, fra, samtals30, fjoldi30, takmarkad } */
function prufuShopify(verk, eftir, hamark) {
  const grunnur = { ok: true, synidaemi: true, verk, verslun: 'synidaemi.myshopify.com' };
  const VORUR = [
    ['Ullarpeysa, grá', 18990, 14], ['Ullarvettlingar', 4990, 3], ['Lopahúfa', 5990, 0],
    ['Kertastjaki úr steypu', 7490, 22], ['Kaffibolli, svartur', 3490, 41], ['Ilmkerti, birki', 4290, 5],
    ['Taupoki með merki', 2990, 60], ['Teppi, ljóst', 15990, 2], ['Gjafakort', 5000, null], ['Sápa, lavender', 1890, 9]
  ];
  const vorur = VORUR.map(([titill, verd, birgdir], i) => ({
    id: 'gid://shopify/Product/synidaemi-' + (i + 1), titill, stada: 'ACTIVE', birgdir, mynd: null,
    afbrigdi: [{ sku: 'SYN-' + String(i + 1).padStart(3, '0'), titill: 'Default Title', verd, birgdir }], slod: null
  }));
  if (verk === 'vorur') return { ...grunnur, vorur, meira: false, eftir: null };
  if (verk === 'lager') {
    return { ...grunnur, vorur: vorur.filter((v) => v.birgdir !== null && v.birgdir <= hamark)
      .sort((a, b) => a.birgdir - b.birgdir), meira: false, eftir: null, hamark };
  }
  const STODUR = [['PAID', 'FULFILLED'], ['PAID', 'UNFULFILLED'], ['PENDING', 'UNFULFILLED'], ['REFUNDED', 'FULFILLED']];
  const nu = Date.now();
  const pantanir = Array.from({ length: 18 }, (_, i) => {
    const a = VORUR[(i * 3) % VORUR.length], b = VORUR[(i * 7 + 2) % VORUR.length];
    const magn = 1 + (i % 3);
    const [greidsla, afgreidsla] = STODUR[i % 7 === 3 ? 3 : i % 5 === 1 ? 2 : i < 4 ? 1 : 0];
    return {
      id: 'gid://shopify/Order/synidaemi-' + (1100 - i), nafn: '#' + (1100 - i),
      stofnad: new Date(nu - (i * 1.7 + 0.2) * 864e5).toISOString(), greidsla, afgreidsla,
      upphaed: a[1] * magn + b[1], gjaldmidill: 'ISK',
      linur: [{ titill: a[0], magn }, { titill: b[0], magn: 1 }], slod: null
    };
  });
  if (verk === 'pantanir') {
    const sida = eftir === 'synidaemi-2' ? 1 : 0;
    const hluti = pantanir.slice(sida * 12, sida * 12 + 12);
    return { ...grunnur, pantanir: hluti, meira: sida === 0, eftir: sida === 0 ? 'synidaemi-2' : null };
  }
  const iGildi = pantanir.filter((p) => p.greidsla !== 'REFUNDED');
  return {
    ...grunnur, nafn: 'Sýnidæmi verslun', gjaldmidill: 'ISK',
    fra: new Date(nu - 30 * 864e5).toISOString().slice(0, 10),
    samtals30: iGildi.reduce((s, p) => s + p.upphaed, 0), fjoldi30: iGildi.length, takmarkad: false
  };
}

/* ========================================================================== */

let bakendi = null;

/* ?prufa=1 keyrir sýnidæmin, en BARA á localhost svo enginn geti kveikt á
   því á vefnum. Það helst í flipanum svo hægt sé að skrá sig inn og
   smella sig um. ?prufa=0 slekkur aftur. */
function prufaUmSlod() {
  try {
    if (typeof location === 'undefined') return false;
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return false;
    const leit = new URLSearchParams(location.search).get('prufa');
    try {
      if (leit === '1') sessionStorage.setItem('tveir-prufa', 'ja');
      if (leit === '0') sessionStorage.removeItem('tveir-prufa');
      if (sessionStorage.getItem('tveir-prufa') === 'ja') return true;
    } catch (e) { /* lokað sessionStorage, þá gildir slóðin ein */ }
    return leit === '1';
  } catch (e) { return false; }
}

export async function gogn() {
  if (!bakendi) {
    bakendi = stillingar.prufa || !stillingar.supabaseUrl || prufaUmSlod()
      ? prufuBakendi()
      : await supabaseBakendi();
  }
  return bakendi;
}
