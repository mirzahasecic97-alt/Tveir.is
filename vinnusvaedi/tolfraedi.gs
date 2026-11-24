/* ==========================================================================
   Tveir: tölfræði af samfélagsmiðlum viðskiptavina
   Önnur skrá í sama Apps Script verkefni og verk-postur.gs. Hún notar því
   SUPABASE, ANON, LYKILL, kalla_, esc_, oruggSlod_, takki_ og MERKI þaðan.
   Ekkert af því er skilgreint aftur hér.

   safnaTolfraedi keyrir einu sinni á dag um kl. 6 (setjaTolfraedi setur það
   upp). Það sækir tölur síðustu þriggja daga, fjölda fylgjenda og nýjustu
   færslurnar af Instagram og Facebook í gegnum Meta Graph API og skrifar
   þær í Supabase. Meta lagfærir tölur í allt að 48 tíma eftir á, þess vegna
   þrír dagar í hvert sinn. Tölur sem við slógum inn sjálf ganga alltaf fyrir.

   Fyrsta hvers mánaðar verða til drög að mánaðarskýrslu fyrir hvert
   fyrirtæki, og tveir@tveir.is fær póst um að þau bíði. Þegar skýrsla er
   samþykkt á vinnusvæðinu sendir sendaSkyrslur_ hana á viðskiptavininn.
   tilkynna_ í verk-postur.gs kallar á það, svo samþykki fer strax.

   Leyndarmál liggja bara í Script Properties, aldrei í kóðanum:
     META_TOKEN          langlífur System User lykill úr Meta Business
     META_APP_SECRET     valkvætt: þá fylgir appsecret_proof hverju kalli
     ANTHROPIC_API_KEY   valkvætt: þá skrifar Claude samantektina
     ZERNIO_API_KEY      fyrir miðla sem eru tengdir í gegnum Zernio

   Zernio: miðill með ytra_id 'zernio:<accountId>' er sóttur í gegnum
   Zernio (zernio.com), sem á samþykkt Meta app. Þá þarf engan META_TOKEN.
   zernioSaga() sækir síðustu 30 daga einu sinni, eftir að miðill er tengdur.

   TikTok: ekkert API enn. Tölurnar eru slegnar inn á vinnusvæðinu þar til
   TikTok samþykkir aðganginn okkar. Uppsetning: LESTU-MIG.md, kaflinn
   Tölfræði.
   ========================================================================== */

const TOLFRAEDI = 'https://tveir.is/glerhus/kerfi/tolfraedi.html';
/* Meta styður hverja útgáfu í um tvö ár. Hækka þegar Meta varar við. */
const META_GRAPH = 'https://graph.facebook.com/v26.0/';
const TOLF_DAGAR = 3;          /* hve marga liðna daga við sækjum í hvert sinn */
const TOLF_FAERSLUR = 20;      /* nýjustu færslur hvers miðils */
const TOLF_TIMAMORK = 5 * 60 * 1000; /* Google stöðvar skriftuna eftir 6 mínútur */
const TOLF_MANUDIR = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí',
  'ágúst', 'september', 'október', 'nóvember', 'desember'];
const TOLF_MIDLAR = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
const TOLF_TEGUNDIR = { mynd: 'Mynd', myndband: 'Myndband', reel: 'Reel', karusell: 'Hringekja',
  saga: 'Saga', annad: 'Færsla' };

/* Keyrt einu sinni með höndunum: setur upp daglegu söfnunina kl. 6.
   Snertir ekki 5 mínútna vaktina hans lesaVerk. */
function setjaTolfraedi() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'safnaTolfraedi')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('safnaTolfraedi').timeBased().everyDays(1).atHour(6)
    .inTimezone('Atlantic/Reykjavik').create();
  safnaTolfraedi();
  /* Eldri saga Instagram í gegnum Zernio, ef hún er ekki þegar sett af stað */
  if (!PropertiesService.getScriptProperties().getProperty('zernio_saga_bil')) setjaZernioSogu();
}

/* Daglega söfnunin. Kastar aldrei villu: hver miðill fær sína tilraun og
   það sem klikkar fer í Executions loggið. nu er bara fyrir prófanir
   (tímagildran sendir annars atburð sem fyrsta viðfang). */
function safnaTolfraedi(nu) {
  const byrjun = Date.now();
  nu = nu && typeof nu.getUTCDate === 'function' ? nu : new Date();
  const eiginlegir = PropertiesService.getScriptProperties();

  try {
    const tokn = eiginlegir.getProperty('META_TOKEN');
    const zlykill = eiginlegir.getProperty('ZERNIO_API_KEY');
    const midlar = kalla_('midlar_til_soefnunar', {});
    if (!Array.isArray(midlar)) {
      console.log('Tölfræði: náði ekki í listann yfir miðla úr Supabase');
    } else {
      const dagar = tolfDagar_(nu);
      let vantarMeta = false, vantarZernio = false;
      midlar.forEach((m) => {
        if (m.midill !== 'instagram' && m.midill !== 'facebook') return; /* TikTok: handvirkt */
        const zernio = erZernio_(m);
        if (zernio && !zlykill) { vantarZernio = true; return; }
        if (!zernio && !tokn) { vantarMeta = true; return; }
        if (Date.now() - byrjun > TOLF_TIMAMORK) {
          console.log('Tölfræði: tíminn búinn, ' + m.midill + ' ' + m.nafn + ' bíður til morguns');
          return;
        }
        try {
          const ut = zernio ? safnaZernio_(m, zlykill, dagar)
            : m.midill === 'instagram'
            ? safnaInstagram_(m, tokn, dagar)
            : safnaFacebook_(m, tokn, dagar);
          if (ut.maelingar.length && kalla_('skra_maelingar', { p_gogn: ut.maelingar }) === null) {
            console.log('Tölfræði: Supabase tók ekki við mælingum fyrir ' + m.midill + ' ' + m.nafn);
          }
          if (ut.faerslur.length && kalla_('skra_faerslur', { p_gogn: ut.faerslur }) === null) {
            console.log('Tölfræði: Supabase tók ekki við færslum fyrir ' + m.midill + ' ' + m.nafn);
          }
        } catch (villa) {
          console.log('Tölfræði: ' + m.midill + ' ' + m.nafn + ': ' + villaTexti_(villa));
        }
      });
      if (vantarMeta) console.log('Tölfræði: META_TOKEN vantar í Script Properties, Meta miðlum ekki safnað');
      if (vantarZernio) console.log('Tölfræði: ZERNIO_API_KEY vantar í Script Properties, Zernio miðlum ekki safnað');
    }
  } catch (villa) {
    console.log('Tölfræði: söfnun stöðvaðist: ' + villaTexti_(villa));
  }

  /* Mánaðarskýrslur: fyrsta dag mánaðarins. Klikki það er reynt aftur
     annan og þriðja daginn, en aldrei tvisvar fyrir sama mánuð. */
  try {
    const fyrri = fyrriManudur_(nu);
    if (nu.getUTCDate() <= 3 && eiginlegir.getProperty('skyrslur_manudur') !== fyrri) {
      buaTilSkyrslur_(fyrri);
    }
  } catch (villa) {
    console.log('Tölfræði: skýrslugerð stöðvaðist: ' + villaTexti_(villa));
  }
}

/* ==========================================================================
   Dagsetningar. Ísland er á UTC allt árið, svo UTC dagur er íslenskur dagur.
   ========================================================================== */

function tolfDags_(d) {
  return d.toISOString().slice(0, 10);
}

/* Liðnu dagarnir sem við sækjum, elsti fyrst: [fyrradag..., í gær] */
function tolfDagar_(nu) {
  const i0 = Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate());
  const dagar = [];
  for (let i = TOLF_DAGAR; i >= 1; i--) dagar.push(tolfDags_(new Date(i0 - i * 864e5)));
  return dagar;
}

function unix_(dags) {
  return Math.floor(Date.parse(dags + 'T00:00:00Z') / 1000);
}

function naestiDagur_(dags) {
  return tolfDags_(new Date(Date.parse(dags + 'T00:00:00Z') + 864e5));
}

/* Fyrsti dagur síðasta mánaðar, 'YYYY-MM-01' */
function fyrriManudur_(nu) {
  return tolfDags_(new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() - 1, 1)));
}

/* Meta skrifar '2026-11-14T18:22:05+0000'. Gerum úr því venjulegan ISO tíma. */
function metaTimi_(t) {
  const s = String(t || '').replace(/([+-]\d\d)(\d\d)$/, '$1:$2');
  const ms = Date.parse(s);
  return isNaN(ms) ? null : new Date(ms).toISOString();
}

/* ==========================================================================
   Meta Graph API
   Lykillinn fer sem access_token í slóðinni, eins og Meta sýnir í öllum
   dæmum. Slóðir eru því aldrei skrifaðar í loggið, bara villuboð Meta.
   ========================================================================== */

function metaSlod_(leid, tokn) {
  let slod = META_GRAPH + leid + (leid.indexOf('?') === -1 ? '?' : '&')
    + 'access_token=' + encodeURIComponent(tokn);
  const leyni = PropertiesService.getScriptProperties().getProperty('META_APP_SECRET');
  if (leyni) {
    const baeti = Utilities.computeHmacSha256Signature(tokn, leyni);
    slod += '&appsecret_proof=' + baeti.map((b) => ('0' + (b & 255).toString(16)).slice(-2)).join('');
  }
  return slod;
}

/* Les svar frá Meta. Kastar villu með kóða Meta (villa.kodi) ef eitthvað er að. */
function metaSvar_(r) {
  let gogn = null;
  try {
    gogn = JSON.parse(r.getContentText());
  } catch (e) {
    gogn = null;
  }
  if (r.getResponseCode() !== 200 || !gogn || gogn.error) {
    const v = (gogn && gogn.error) || {};
    const villa = new Error('Meta svaraði ' + r.getResponseCode() + ' (kóði ' + (v.code || '?') + '): '
      + String(v.message || 'ekkert svar').slice(0, 300));
    villa.kodi = v.code;
    throw villa;
  }
  return gogn;
}

function metaSaekja_(leid, tokn) {
  return metaSvar_(UrlFetchApp.fetch(metaSlod_(leid, tokn), { method: 'get', muteHttpExceptions: true }));
}

/* Mörg köll í einu (færslur), hvert svar sér: villa í einu stöðvar ekki hin */
function metaSaekjaMorg_(leidir, tokn) {
  if (!leidir.length) return [];
  const svor = UrlFetchApp.fetchAll(leidir.map((l) => ({
    url: metaSlod_(l, tokn), method: 'get', muteHttpExceptions: true
  })));
  return svor.map((r) => {
    try {
      return metaSvar_(r);
    } catch (villa) {
      return null;
    }
  });
}

/* Sækir innsýnartölur. Hafni Meta einni mælingu (kóði 100, gerist þegar
   Meta hættir með mælingu) sækjum við hinar eina og eina, svo ein úrelt
   mæling eyði ekki öllum hinum. */
function metaInnsyn_(hlutur, metrar, aukalega, tokn) {
  const leid = (m) => hlutur + '/insights?metric=' + m.join(',') + aukalega;
  try {
    return metaSaekja_(leid(metrar), tokn).data || [];
  } catch (villa) {
    if (villa.kodi !== 100 || metrar.length < 2) throw villa;
    let ut = [];
    metrar.forEach((m) => {
      try {
        ut = ut.concat(metaSaekja_(leid([m]), tokn).data || []);
      } catch (v) {
        console.log('Tölfræði: Meta hafnar mælingunni ' + m + ': ' + villaTexti_(v));
      }
    });
    return ut;
  }
}

/* Tala úr gildi Meta. Hlutur eins og { like: 3, love: 1 } leggst saman. */
function metaTala_(g) {
  if (g === null || g === undefined) return null;
  if (typeof g === 'object') {
    let s = 0;
    let fannst = false;
    Object.keys(g).forEach((k) => {
      const n = Number(g[k]);
      if (isFinite(n)) { s += n; fannst = true; }
    });
    return fannst ? s : null;
  }
  const n = Number(g);
  return isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/* metric_type=total_value: { views: 1234, reach: 800 } */
function lesaHeildir_(data) {
  const ut = {};
  (data || []).forEach((d) => {
    if (!d || !d.name) return;
    const g = d.total_value ? d.total_value.value
      : (Array.isArray(d.values) && d.values.length ? d.values[d.values.length - 1].value : null);
    ut[d.name] = metaTala_(g);
  });
  return ut;
}

/* period=day: { '2026-11-15': { page_media_view: 1234 } }
   Dagur Meta endar á end_time (miðnætti í Kaliforníu), svo dagurinn
   sjálfur er sólarhringnum á undan. */
function lesaDaga_(data) {
  const ut = {};
  (data || []).forEach((d) => {
    if (!d || !d.name || !Array.isArray(d.values)) return;
    d.values.forEach((v) => {
      const lok = Date.parse(metaTimi_(v.end_time) || '');
      if (isNaN(lok)) return;
      const dags = tolfDags_(new Date(lok - 864e5));
      (ut[dags] = ut[dags] || {})[d.name] = metaTala_(v.value);
    });
  });
  return ut;
}

/* Hve margar færslur fóru út hvern dag. null ef listinn nær ekki aftur til dagsins. */
function faerslurADag_(faerslur, dagar) {
  const ut = {};
  const fullur = faerslur.length >= TOLF_FAERSLUR;
  const elst = faerslur.reduce((a, f) => (f.birt && (!a || f.birt < a) ? f.birt : a), null);
  dagar.forEach((d) => {
    if (fullur && (!elst || elst.slice(0, 10) > d)) { ut[d] = null; return; }
    ut[d] = faerslur.filter((f) => f.birt && f.birt.slice(0, 10) === d).length;
  });
  return ut;
}

function stytta_(t, n) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
}

/* ==========================================================================
   Instagram (Instagram Graph API með Facebook innskráningu)
   Daglegar tölur: views, reach, total_interactions (metric_type=total_value,
   einn dagur í senn, því bara reach styður time_series). profile_views er
   sótt sér, því Meta hefur verið að hætta með það. impressions, plays og
   video_views eru horfin síðan 2025: views kemur í staðinn.
   ========================================================================== */

function safnaInstagram_(m, tokn, dagar) {
  const id = encodeURIComponent(m.ytra_id);
  const notandi = metaSaekja_(id + '?fields=followers_count,media_count', tokn);

  const maelingar = dagar.map((d) => {
    const bil = '&period=day&metric_type=total_value&since=' + unix_(d) + '&until=' + unix_(naestiDagur_(d));
    const h = lesaHeildir_(metaInnsyn_(id, ['views', 'reach', 'total_interactions'], bil, tokn));
    let heimsoknir = null;
    try {
      heimsoknir = lesaHeildir_(metaSaekja_(id + '/insights?metric=profile_views' + bil, tokn).data).profile_views;
    } catch (villa) {
      heimsoknir = null; /* ekki lengur í boði hjá Meta: skiptir ekki máli */
    }
    return {
      midill_id: m.id, dags: d, fylgjendur: null,
      ahorf: h.views === undefined ? null : h.views,
      nadir: h.reach === undefined ? null : h.reach,
      samskipti: h.total_interactions === undefined ? null : h.total_interactions,
      heimsoknir: heimsoknir === undefined ? null : heimsoknir,
      faerslur: null
    };
  });
  /* Fjöldinn núna, um kl. 6, er staðan í lok gærdagsins */
  maelingar[maelingar.length - 1].fylgjendur = metaTala_(notandi.followers_count);

  const listi = metaSaekja_(id + '/media?limit=' + TOLF_FAERSLUR + '&fields='
    + encodeURIComponent('id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count'),
    tokn).data || [];
  const innsyn = metaSaekjaMorg_(listi.map((f) => encodeURIComponent(f.id)
    + '/insights?metric=views,reach,likes,comments,shares,saved'), tokn);
  const faerslur = listi.map((f, i) => igFaersla_(f, m.id, innsyn[i]));

  const aDag = faerslurADag_(faerslur, dagar);
  maelingar.forEach((r) => { r.faerslur = aDag[r.dags]; });
  return { maelingar: maelingar, faerslur: faerslur };
}

function igTegund_(f) {
  if (f.media_product_type === 'REELS') return 'reel';
  if (f.media_product_type === 'STORY') return 'saga';
  if (f.media_type === 'CAROUSEL_ALBUM') return 'karusell';
  if (f.media_type === 'VIDEO') return 'myndband';
  if (f.media_type === 'IMAGE') return 'mynd';
  return 'annad';
}

/* Ein færsla í sniði midla_faerslur. innsyn er null ef Meta gaf engar
   innsýnartölur (til dæmis gömul færsla): þá líkar og athugasemdir úr listanum. */
function igFaersla_(f, midillId, innsyn) {
  const h = innsyn ? lesaHeildir_(innsyn.data) : {};
  const tala = (a, b) => (h[a] !== undefined && h[a] !== null ? h[a] : (b === undefined ? null : metaTala_(b)));
  const tegund = igTegund_(f);
  return {
    midill_id: midillId,
    ytra_id: String(f.id).slice(0, 100),
    birt: metaTimi_(f.timestamp),
    tegund: tegund,
    texti: stytta_(f.caption, 500) || null,
    slod: oruggSlod_(f.permalink),
    mynd_slod: oruggSlod_(tegund === 'myndband' || tegund === 'reel' ? f.thumbnail_url : (f.media_url || f.thumbnail_url)),
    ahorf: tala('views'),
    nadir: tala('reach'),
    likes: tala('likes', f.like_count),
    athugasemdir: tala('comments', f.comments_count),
    deilingar: tala('shares'),
    vistanir: tala('saved')
  };
}

/* ==========================================================================
   Facebook síður (Pages API)
   Síðulykill er sóttur með System User lyklinum. Daglegar tölur eftir
   breytingar Meta í nóvember 2025 og v25: page_media_view (áhorf),
   page_total_media_view_unique (náð), page_post_engagements (samskipti),
   page_views_total (heimsóknir). Fylgjendur úr followers_count á síðunni.
   ========================================================================== */

function safnaFacebook_(m, tokn, dagar) {
  const id = encodeURIComponent(m.ytra_id);
  const sida = metaSaekja_(id + '?fields=access_token,followers_count', tokn);
  if (!sida.access_token) {
    throw new Error('enginn síðulykill: kerfisnotandinn hefur ekki aðgang að síðunni ' + m.ytra_id);
  }
  const s = sida.access_token;

  const bil = '&period=day&since=' + unix_(dagar[0]) + '&until=' + unix_(naestiDagur_(dagar[dagar.length - 1]));
  const dagtolur = lesaDaga_(metaInnsyn_(id,
    ['page_media_view', 'page_total_media_view_unique', 'page_post_engagements', 'page_views_total'], bil, s));

  const maelingar = dagar.map((d) => {
    const t = dagtolur[d] || {};
    const g = (k) => (t[k] === undefined ? null : t[k]);
    return {
      midill_id: m.id, dags: d, fylgjendur: null,
      ahorf: g('page_media_view'),
      nadir: g('page_total_media_view_unique'),
      samskipti: g('page_post_engagements'),
      heimsoknir: g('page_views_total'),
      faerslur: null
    };
  });
  maelingar[maelingar.length - 1].fylgjendur = metaTala_(sida.followers_count);

  const listi = metaSaekja_(id + '/posts?limit=' + TOLF_FAERSLUR + '&fields='
    + encodeURIComponent('id,message,created_time,permalink_url,full_picture,status_type,shares,'
      + 'reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)'), s).data || [];
  const innsyn = metaSaekjaMorg_(listi.map((f) => encodeURIComponent(f.id)
    + '/insights?metric=post_media_view,post_total_media_view_unique'), s);
  const faerslur = listi.map((f, i) => fbFaersla_(f, m.id, innsyn[i]));

  const aDag = faerslurADag_(faerslur, dagar);
  maelingar.forEach((r) => { r.faerslur = aDag[r.dags]; });
  return { maelingar: maelingar, faerslur: faerslur };
}

function fbFaersla_(f, midillId, innsyn) {
  const h = innsyn ? lesaHeildir_(innsyn.data) : {};
  const summa = (x) => (x && x.summary ? metaTala_(x.summary.total_count) : null);
  const tegund = f.status_type === 'added_video' ? 'myndband'
    : (f.status_type === 'added_photos' ? 'mynd' : 'annad');
  return {
    midill_id: midillId,
    ytra_id: String(f.id).slice(0, 100),
    birt: metaTimi_(f.created_time),
    tegund: tegund,
    texti: stytta_(f.message, 500) || null,
    slod: oruggSlod_(f.permalink_url),
    mynd_slod: oruggSlod_(f.full_picture),
    ahorf: h.post_media_view === undefined ? null : h.post_media_view,
    nadir: h.post_total_media_view_unique === undefined ? null : h.post_total_media_view_unique,
    likes: summa(f.reactions),
    athugasemdir: summa(f.comments),
    deilingar: f.shares ? metaTala_(f.shares.count) : null,
    vistanir: null
  };
}

/* ==========================================================================
   Zernio (zernio.com): Facebook síður og Instagram í gegnum samþykkt Meta
   app Zernio. ytra_id miðilsins er 'zernio:<accountId>'. Sömu tölur og hér
   að ofan, sama snið á mælingunum:
     Facebook: page_media_view, page_total_media_view_unique,
       page_post_engagements, page_views_total og page_follows, daglega.
       Meta merkir hvern dag með lokum hans, svo dagur X í svarinu er X-1.
     Instagram: views, reach, total_interactions, profile_views, einn dagur
       í senn (bara reach styður daglegar raðir). Fylgjendur úr reikningnum.
   Færslur: nýjustu 50 daglega (zernioSaga tekur 100), með tölum frá Zernio.
   ========================================================================== */

const ZERNIO = 'https://zernio.com/api/v1/';

function erZernio_(m) {
  return /^zernio:[A-Za-z0-9]{8,64}$/.test(String(m.ytra_id || ''));
}

function zernioSaekja_(leid, lykill) {
  const r = UrlFetchApp.fetch(ZERNIO + leid, {
    method: 'get', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + lykill }
  });
  const kodi = r.getResponseCode();
  let gogn = null;
  try { gogn = JSON.parse(r.getContentText()); } catch (villa) { gogn = null; }
  if (kodi !== 200 || !gogn) {
    const skilabod = gogn && (gogn.error || gogn.message) ? String(gogn.error || gogn.message) : 'svar ' + kodi;
    throw new Error('Zernio ' + kodi + ': ' + skilabod.slice(0, 200));
  }
  return gogn;
}

function zernioTala_(x) {
  return typeof x === 'number' && isFinite(x) && x >= 0 ? Math.round(x) : null;
}

/* Fylgjendur núna, úr reikningnum sjálfum */
function zernioFylgjendur_(reikningur, lykill) {
  const g = zernioSaekja_('accounts', lykill);
  const a = (g.accounts || []).filter((x) => x._id === reikningur)[0];
  return a ? zernioTala_(a.followersCount) : null;
}

function safnaZernio_(m, lykill, dagar) {
  const reikn = String(m.ytra_id).slice('zernio:'.length);
  const id = encodeURIComponent(reikn);
  let maelingar;

  if (m.midill === 'facebook') {
    /* Einn dag aftur og fram, því Meta merkir daginn með lokum hans */
    const fra = dagar[0];
    const til = naestiDagur_(dagar[dagar.length - 1]);
    const g = zernioSaekja_('analytics/facebook/page-insights?accountId=' + id
      + '&metrics=page_media_view,page_total_media_view_unique,page_post_engagements,page_views_total,page_follows'
      + '&metricType=time_series&fromDate=' + fra + '&toDate=' + til, lykill);
    const aDag = {};
    Object.keys(g.metrics || {}).forEach((k) => {
      ((g.metrics[k] || {}).values || []).forEach((v) => {
        if (!v || !/^\d{4}-\d{2}-\d{2}/.test(String(v.date))) return;
        const d = tolfDags_(new Date(Date.parse(String(v.date).slice(0, 10) + 'T00:00:00Z') - 864e5));
        (aDag[d] = aDag[d] || {})[k] = zernioTala_(v.value);
      });
    });
    maelingar = dagar.map((d) => {
      const t = aDag[d] || {};
      const k = (n) => (t[n] === undefined ? null : t[n]);
      return {
        midill_id: m.id, dags: d, fylgjendur: k('page_follows'),
        ahorf: k('page_media_view'), nadir: k('page_total_media_view_unique'),
        samskipti: k('page_post_engagements'), heimsoknir: k('page_views_total'),
        faerslur: null
      };
    });
  } else {
    maelingar = dagar.map((d) => {
      const g = zernioSaekja_('analytics/instagram/account-insights?accountId=' + id
        + '&metrics=views,reach,total_interactions,profile_views&fromDate=' + d + '&toDate=' + d, lykill);
      const t = g.metrics || {};
      const k = (n) => (t[n] ? zernioTala_(t[n].total) : null);
      return {
        midill_id: m.id, dags: d, fylgjendur: null,
        ahorf: k('views'), nadir: k('reach'), samskipti: k('total_interactions'),
        heimsoknir: k('profile_views'), faerslur: null
      };
    });
    /* Fjöldinn núna er staðan í lok gærdagsins */
    if (naestiDagur_(dagar[dagar.length - 1]) === tolfDags_(new Date())) {
      maelingar[maelingar.length - 1].fylgjendur = zernioFylgjendur_(reikn, lykill);
    }
  }
  const faerslur = zernioFaerslur_(m, reikn, lykill, 50);
  const aDag = faerslurADag_(faerslur, dagar);
  maelingar.forEach((r) => { r.faerslur = aDag[r.dags]; });
  return { maelingar: maelingar, faerslur: faerslur };
}

/* Nýjustu færslurnar með tölum, í sniði midla_faerslur */
function zernioFaerslur_(m, reikn, lykill, fjoldi) {
  const g = zernioSaekja_('analytics?accountId=' + encodeURIComponent(reikn) + '&limit=' + fjoldi + '&source=all', lykill);
  return (g.posts || []).map((p) => {
    const pl = (p.platforms || [])[0] || {};
    const a = pl.analytics || p.analytics || {};
    const mp = String(p.mediaProductType || '').toUpperCase();
    const mt = String(p.mediaType || '').toLowerCase();
    const tegund = mp === 'REELS' ? 'reel' : mp === 'STORY' ? 'saga' : mt.indexOf('carousel') >= 0 ? 'karusell'
      : mt === 'video' ? 'myndband' : mt === 'image' ? 'mynd' : 'annad';
    return {
      midill_id: m.id,
      ytra_id: String(pl.platformPostId || p._id).slice(0, 100),
      birt: p.publishedAt || null,
      tegund: tegund,
      texti: stytta_(p.content, 500) || null,
      slod: oruggSlod_(pl.platformPostUrl || p.platformPostUrl),
      mynd_slod: oruggSlod_(p.thumbnailUrl),
      ahorf: zernioTala_(a.views), nadir: zernioTala_(a.reach), likes: zernioTala_(a.likes),
      athugasemdir: zernioTala_(a.comments), deilingar: zernioTala_(a.shares), vistanir: zernioTala_(a.saves)
    };
  }).filter((f) => f.birt);
}

/* Eldri saga Instagram í gegnum Zernio, einn dagur í senn. Zernio leyfir um
   120 köll á klukkustund á Instagram reikning, svo þetta keyrir á 10 mínútna
   fresti og tekur 15 daga í hvert sinn, nýjasta dag fyrst. Bilin sem eftir eru
   liggja í Script Property zernio_saga_bil sem [[fra, til], ...]. Þegar öll
   bilin eru búin eyðir fallið eigin gikk. Facebook þarf þetta ekki: þar koma
   allt að 89 dagar í einu kalli. */
const ZERNIO_SAGA_DAGAR = 15;

function setjaZernioSogu() {
  const eig = PropertiesService.getScriptProperties();
  eig.setProperty('zernio_saga_bil', JSON.stringify([['2026-05-05', '2026-11-07'], ['2025-01-01', '2025-11-23']]));
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'zernioSagaAfram')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('zernioSagaAfram').timeBased().everyMinutes(10).create();
  zernioSagaAfram();
}

function zernioSagaAfram() {
  const eig = PropertiesService.getScriptProperties();
  const lykill = eig.getProperty('ZERNIO_API_KEY');
  let bil = [];
  try { bil = JSON.parse(eig.getProperty('zernio_saga_bil') || '[]'); } catch (villa) { bil = []; }
  const haetta = () => ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'zernioSagaAfram')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  if (!bil.length) { haetta(); console.log('Zernio saga: allt komið'); return; }
  if (!lykill) { console.log('Zernio saga: ZERNIO_API_KEY vantar'); return; }
  const midlar = kalla_('midlar_til_soefnunar', {});
  if (!Array.isArray(midlar)) { console.log('Zernio saga: náði ekki í miðlana'); return; }
  const ig = midlar.filter((m) => erZernio_(m) && m.midill === 'instagram');
  if (!ig.length) { console.log('Zernio saga: enginn Instagram miðill á Zernio'); return; }

  /* Dagarnir í þessari umferð: aftast úr fyrsta bilinu, nýjast fyrst */
  const dagar = [];
  while (bil.length && dagar.length < ZERNIO_SAGA_DAGAR) {
    const [fra, til] = bil[0];
    if (til < fra) { bil.shift(); continue; }
    dagar.push(til);
    bil[0][1] = tolfDags_(new Date(Date.parse(til + 'T00:00:00Z') - 864e5));
  }
  const byrjun = Date.now();
  const lokid = [];
  for (const d of dagar) {
    if (Date.now() - byrjun > 4 * 60 * 1000) break;
    try {
      const radir = ig.map((m) => safnaZernio_(m, lykill, [d]).maelingar[0]);
      if (kalla_('skra_maelingar', { p_gogn: radir }) === null) throw new Error('Supabase tók ekki við');
      lokid.push(d);
    } catch (villa) {
      console.log('Zernio saga: ' + d + ': ' + villaTexti_(villa));
      break;   /* 429 eða annað: reynum aftur eftir 10 mínútur */
    }
  }
  /* Dagar sem náðust ekki fara aftur fremst í fyrsta bilið */
  const eftir = dagar.filter((d) => lokid.indexOf(d) < 0);
  if (eftir.length) {
    const nyjast = eftir[0];
    if (bil.length && bil[0][0] <= nyjast && tolfDags_(new Date(Date.parse(bil[0][1] + 'T00:00:00Z') + 864e5)) <= nyjast) bil[0][1] = nyjast;
    else bil.unshift([eftir[eftir.length - 1], nyjast]);
  }
  bil = bil.filter((b) => b[0] <= b[1]);
  eig.setProperty('zernio_saga_bil', JSON.stringify(bil));
  console.log('Zernio saga: ' + lokid.length + ' dagar skráðir (' + (lokid[0] || '-') + ' til ' + (lokid[lokid.length - 1] || '-') + '), bil eftir: ' + JSON.stringify(bil));
  if (!bil.length) haetta();
}

/* Bara færslurnar (100 nýjustu) á öllum Zernio miðlum, án dagtalnanna */
function zernioFaerslurNuna() {
  const lykill = PropertiesService.getScriptProperties().getProperty('ZERNIO_API_KEY');
  if (!lykill) { console.log('Tölfræði: ZERNIO_API_KEY vantar í Script Properties'); return; }
  const midlar = kalla_('midlar_til_soefnunar', {});
  if (!Array.isArray(midlar)) { console.log('Tölfræði: náði ekki í listann yfir miðla'); return; }
  midlar.filter(erZernio_).forEach((m) => {
    try {
      const faerslur = zernioFaerslur_(m, String(m.ytra_id).slice('zernio:'.length), lykill, 100);
      const svar = faerslur.length ? kalla_('skra_faerslur', { p_gogn: faerslur }) : 0;
      console.log('Zernio færslur: ' + m.fyrirtaeki + ' ' + m.midill + ': ' + (svar === null ? 'Supabase tók ekki við' : faerslur.length + ' færslur'));
    } catch (villa) {
      console.log('Zernio færslur: ' + m.fyrirtaeki + ' ' + m.midill + ': ' + villaTexti_(villa));
    }
  });
}

/* Keyrt einu sinni með höndunum eftir að miðill er tengdur í Zernio:
   síðustu 30 dagar (meira leyfir Instagram ekki með Facebook innskráningu). */
function zernioSaga() {
  const lykill = PropertiesService.getScriptProperties().getProperty('ZERNIO_API_KEY');
  if (!lykill) { console.log('Tölfræði: ZERNIO_API_KEY vantar í Script Properties'); return; }
  const midlar = kalla_('midlar_til_soefnunar', {});
  if (!Array.isArray(midlar)) { console.log('Tölfræði: náði ekki í listann yfir miðla'); return; }
  const nu = new Date();
  const i0 = Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate());
  const dagar = [];
  for (let i = 30; i >= 1; i--) dagar.push(tolfDags_(new Date(i0 - i * 864e5)));
  midlar.filter(erZernio_).forEach((m) => {
    try {
      const ut = safnaZernio_(m, lykill, dagar);
      const svar = kalla_('skra_maelingar', { p_gogn: ut.maelingar });
      const reikn = String(m.ytra_id).slice('zernio:'.length);
      const faerslur = zernioFaerslur_(m, reikn, lykill, 100);
      const fSvar = faerslur.length ? kalla_('skra_faerslur', { p_gogn: faerslur }) : 0;
      console.log('Zernio saga: ' + m.fyrirtaeki + ' ' + m.midill + ': ' + (svar === null ? 'Supabase tók ekki við' : ut.maelingar.length + ' dagar')
        + ', ' + (fSvar === null ? 'færslur ekki teknar' : faerslur.length + ' færslur'));
    } catch (villa) {
      console.log('Zernio saga: ' + m.fyrirtaeki + ' ' + m.midill + ': ' + villaTexti_(villa));
    }
  });
}

/* ==========================================================================
   Mánaðarskýrslur
   ========================================================================== */

/* manudur 'YYYY-MM-01' -> { nafn: 'nóvember', ar: 2026, fyrri: 'október' } */
function manadarNafn_(manudur) {
  const ar = Number(String(manudur).slice(0, 4));
  const m = Number(String(manudur).slice(5, 7)) - 1;
  return { nafn: TOLF_MANUDIR[m] || '', ar: ar, fyrri: TOLF_MANUDIR[(m + 11) % 12] || '' };
}

/* 48210 -> '48.210'. Tómt ef engin tala. */
function tolfTala_(n) {
  if (n === null || n === undefined || n === '' || !isFinite(Number(n))) return '';
  const t = Math.round(Math.abs(Number(n))).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (Number(n) < 0 ? '-' : '') + t;
}

function erTala_(n) {
  return n !== null && n !== undefined && n !== '' && isFinite(Number(n));
}

/* Breyting í heilum prósentum, null ef ekkert er til að bera saman við */
function hlutfall_(nu, fyrr) {
  if (!erTala_(nu) || !erTala_(fyrr) || Number(fyrr) <= 0) return null;
  return Math.round((Number(nu) - Number(fyrr)) / Number(fyrr) * 100);
}

/* Bestu færslur mánaðarins af öllum miðlum, flest áhorf fyrst */
function bestuFaerslur_(f, n) {
  const allar = [];
  (f.midlar || []).forEach((m) => (m.bestu_faerslur || []).forEach((p) => {
    allar.push(Object.assign({ midill: m.midill }, p));
  }));
  return allar.sort((a, b) => (Number(b.ahorf) || 0) - (Number(a.ahorf) || 0)).slice(0, n);
}

/* Samantekt úr föstu sniðmáti. Segir bara það sem tölurnar segja, aldrei
   ástæður. f er eitt fyrirtæki úr manadar_tolur. */
function samantektSnidmat_(f) {
  const s = f.samtals || {};
  const m = manadarNafn_(f.manudur);
  const setn = [];
  let fyrst = true;

  const samanburdur = (nu, fyrr) => {
    const p = hlutfall_(nu, fyrr);
    if (p === null) return '';
    if (Number(nu) === Number(fyrr)) return ' Það er jafn mikið og í ' + m.fyrri + '.';
    if (p === 0) return ' Það er nánast það sama og í ' + m.fyrri + '.';
    return ' Það er ' + Math.abs(p) + '% ' + (p > 0 ? 'meira' : 'minna') + ' en í ' + m.fyrri + '.';
  };
  /* Fyrsta setningin byrjar á mánuðinum: Í nóvember voru áhorf... */
  const tala = (heiti, sogn, nu, fyrr) => {
    if (!erTala_(nu)) return;
    const byrjun = fyrst
      ? 'Í ' + m.nafn + ' ' + sogn + ' ' + heiti.toLowerCase()
      : heiti + ' ' + sogn;
    fyrst = false;
    setn.push(byrjun + ' samtals ' + tolfTala_(nu) + '.' + samanburdur(nu, fyrr));
  };

  tala('Áhorf', 'voru', s.ahorf, s.ahorf_fyrri);
  tala('Náð', 'var', s.nadir, s.nadir_fyrri);
  tala('Samskipti', 'voru', s.samskipti, s.samskipti_fyrri);

  if (erTala_(s.fylgjendur_lok)) {
    const b = erTala_(s.fylgjendur_breyting) ? Number(s.fylgjendur_breyting) : null;
    const lok = tolfTala_(s.fylgjendur_lok);
    if (b === null) setn.push('Fylgjendur eru nú ' + lok + '.');
    else if (b > 0) setn.push('Fylgjendum fjölgaði um ' + tolfTala_(b) + ' og þeir eru nú ' + lok + '.');
    else if (b < 0) setn.push('Fylgjendum fækkaði um ' + tolfTala_(-b) + ' og þeir eru nú ' + lok + '.');
    else setn.push('Fjöldi fylgjenda stóð í stað í ' + lok + '.');
  }

  if (erTala_(s.faerslur)) {
    const n = Number(s.faerslur);
    if (n === 0) setn.push('Engin færsla var birt í mánuðinum.');
    else if (n % 10 === 1 && n % 100 !== 11) setn.push('Birt var ' + tolfTala_(n) + ' færsla.');
    else setn.push('Birtar voru ' + tolfTala_(n) + ' færslur.');
  }

  const besta = bestuFaerslur_(f, 1)[0];
  if (besta && erTala_(besta.ahorf) && Number(besta.ahorf) > 0) {
    setn.push('Færslan með flest áhorf var á ' + (TOLF_MIDLAR[besta.midill] || 'miðlinum')
      + ', með ' + tolfTala_(besta.ahorf) + ' áhorf.');
  }

  return setn.length ? setn.join(' ') : 'Engin gögn bárust fyrir ' + m.nafn + ' ' + m.ar + '.';
}

/* Tölurnar sem Claude fær. Bara tölur og nöfn miðla, enginn texti frá
   viðskiptavini (myndatextar fara ekki með), og tölurnar þegar skrifaðar
   á íslensku svo ekkert þurfi að reikna. */
function tolurFyrirClaude_(f) {
  const s = f.samtals || {};
  const m = manadarNafn_(f.manudur);
  const maeling = (nu, fyrr) => ({
    nu: tolfTala_(nu) || null,
    fyrri_manudur: tolfTala_(fyrr) || null,
    breyting_prosent: hlutfall_(nu, fyrr)
  });
  const besta = bestuFaerslur_(f, 1)[0];
  return {
    manudur: m.nafn + ' ' + m.ar,
    fyrri_manudur: m.fyrri,
    ahorf: maeling(s.ahorf, s.ahorf_fyrri),
    nad: maeling(s.nadir, s.nadir_fyrri),
    samskipti: maeling(s.samskipti, s.samskipti_fyrri),
    fylgjendur_i_lok_manadar: tolfTala_(s.fylgjendur_lok) || null,
    breyting_fylgjenda: erTala_(s.fylgjendur_breyting)
      ? (Number(s.fylgjendur_breyting) >= 0 ? 'fjölgaði um ' : 'fækkaði um ') + tolfTala_(Math.abs(s.fylgjendur_breyting))
      : null,
    faerslur_birtar: erTala_(s.faerslur) ? tolfTala_(s.faerslur) : null,
    midlar: (f.midlar || []).map((x) => ({
      midill: TOLF_MIDLAR[x.midill] || x.midill,
      fylgjendur: tolfTala_(x.fylgjendur_lok) || null,
      ahorf: tolfTala_(x.ahorf) || null,
      faerslur: erTala_(x.faerslur) ? tolfTala_(x.faerslur) : null
    })),
    faersla_med_flest_ahorf: besta && erTala_(besta.ahorf)
      ? { midill: TOLF_MIDLAR[besta.midill] || besta.midill, ahorf: tolfTala_(besta.ahorf) }
      : null
  };
}

/* Allar tölur sem mega standa í texta Claude: þær sem það fékk, og árið */
function leyfdarTolur_(hlutur, mengi) {
  mengi = mengi || {};
  if (hlutur === null || hlutur === undefined) return mengi;
  if (typeof hlutur === 'object') {
    Object.keys(hlutur).forEach((k) => leyfdarTolur_(hlutur[k], mengi));
  } else {
    (String(hlutur).match(/\d[\d.]*/g) || []).forEach((t) => { mengi[t.replace(/\.$/, '')] = true; });
    if (typeof hlutur === 'number') mengi[String(Math.abs(hlutur))] = true;
  }
  return mengi;
}

const TOLF_KERFISBOD = 'Þú skrifar stutta samantekt á íslensku í mánaðarskýrslu um samfélagsmiðla '
  + 'fyrirtækis. Notandinn sendir tölurnar sem JSON. Reglur: Notaðu bara tölurnar sem þar eru, '
  + 'skrifaðar nákvæmlega eins og þar (punktur sem þúsundaskil). Ekki reikna nýjar tölur. '
  + 'Ekki giska á ástæður, ekki gefa ráð og ekki hrósa. Slepptu mælingu sem er null. '
  + '3 til 5 stuttar setningar í einni málsgrein, einfalt mál, rétt íslensk málfræði. '
  + 'Engin fyrirsögn, engin upptalning, ekkert markdown, engin nöfn fólks eða fyrirtækja. '
  + 'Aldrei langt þankastrik eða miðlungsstrik: notaðu kommu eða punkt.';

/* Samantekt frá Claude, eða null ef eitthvað er að: þá notum við sniðmátið.
   Hrátt HTTPS kall á Messages API. Texti sem inniheldur tölu sem Claude
   fékk ekki er felldur, svo engin tala verði til úr lausu lofti. */
function samantektClaude_(f, lykill) {
  try {
    const tolur = tolurFyrirClaude_(f);
    const r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': lykill, 'anthropic-version': '2026-10-21' },
      payload: JSON.stringify({
        model: 'claude-opus-5-5',
        max_tokens: 600,
        output_config: { effort: 'low' }, /* stutt hugsun, svo textinn komist fyrir í 600 */
        system: TOLF_KERFISBOD,
        messages: [{ role: 'user', content: JSON.stringify(tolur) }]
      }),
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) {
      console.log('Tölfræði: Claude svaraði ' + r.getResponseCode() + ', sniðmátið notað');
      return null;
    }
    const svar = JSON.parse(r.getContentText());
    if (!svar || svar.stop_reason !== 'end_turn') {
      console.log('Tölfræði: Claude hætti með ' + (svar && svar.stop_reason) + ', sniðmátið notað');
      return null;
    }
    let texti = (svar.content || []).filter((b) => b && b.type === 'text')
      .map((b) => String(b.text || '')).join('').trim();
    texti = texti.replace(/\s*[\u2013\u2014]\s*/g, ', ').replace(/[*#_`]/g, '').replace(/\s+/g, ' ').trim();
    if (texti.length < 20 || texti.length > 1500) return null;
    const leyft = leyfdarTolur_(tolur);
    leyft[String(manadarNafn_(f.manudur).ar)] = true;
    const okunnar = (texti.match(/\d[\d.,]*/g) || [])
      .map((t) => t.replace(/[.,]+$/, ''))
      .filter((t) => !leyft[t]);
    if (okunnar.length) {
      console.log('Tölfræði: Claude nefndi tölur sem það fékk ekki (' + okunnar.join(' ') + '), sniðmátið notað');
      return null;
    }
    return texti;
  } catch (villa) {
    console.log('Tölfræði: Claude kall mistókst: ' + villaTexti_(villa));
    return null;
  }
}

/* Fyrsta hvers mánaðar: drög að skýrslu fyrir hvert fyrirtæki og einn
   póstur til okkar. Samþykktar og sendar skýrslur breytast ekki
   (vista_skyrslu sér um það). Skilar true ef allt fór inn. */
function buaTilSkyrslur_(manudur) {
  const eiginlegir = PropertiesService.getScriptProperties();
  const listi = kalla_('manadar_tolur', { p_manudur: manudur });
  if (!Array.isArray(listi)) {
    console.log('Tölfræði: náði ekki í tölur mánaðarins, reynt aftur á morgun');
    return false;
  }
  const lykill = eiginlegir.getProperty('ANTHROPIC_API_KEY');
  const tilbuin = [];
  let villur = 0;
  listi.forEach((f) => {
    try {
      const texti = (lykill ? samantektClaude_(f, lykill) : null) || samantektSnidmat_(f);
      const id = kalla_('vista_skyrslu', {
        p_fyrirtaeki_id: f.fyrirtaeki_id, p_manudur: manudur, p_tolur: f,
        p_samantekt: texti.slice(0, 4000)
      });
      if (id) tilbuin.push(String(f.fyrirtaeki || '').replace(/[\r\n]+/g, ' '));
      else { villur++; console.log('Tölfræði: skýrsla fyrir ' + f.fyrirtaeki + ' vistaðist ekki'); }
    } catch (villa) {
      villur++;
      console.log('Tölfræði: skýrsla fyrir ' + f.fyrirtaeki + ': ' + villaTexti_(villa));
    }
  });
  if (!villur) eiginlegir.setProperty('skyrslur_manudur', manudur);

  if (tilbuin.length) {
    const m = manadarNafn_(manudur);
    try {
      GmailApp.sendEmail('tveir@tveir.is', 'Mánaðarskýrslur ' + m.nafn + ' ' + m.ar + ' bíða yfirferðar',
        'Drög að mánaðarskýrslum fyrir ' + m.nafn + ' ' + m.ar + ' eru tilbúin:\n\n'
        + tilbuin.map((n) => '- ' + n).join('\n')
        + '\n\nLestu þær yfir, lagaðu samantektina ef þarf og smelltu á Samþykkja og senda:\n'
        + TOLFRAEDI + '\n\nViðskiptavinurinn fær ekkert fyrr en þú samþykkir.',
        { name: 'Vinnusvæðið' });
    } catch (villa) {
      console.log('Tölfræði: póstur um drögin fór ekki: ' + villaTexti_(villa));
    }
  }
  return !villur;
}

/* Samþykktar skýrslur fara á viðskiptavininn. Kallað úr tilkynna_ í
   verk-postur.gs (innan sama lás), svo samþykki fer strax og 5 mínútna
   vaktin er til vara. Kastar aldrei villu. */
function sendaSkyrslur_() {
  try {
    const listi = kalla_('skyrslur_til_sendingar', {});
    if (!Array.isArray(listi) || !listi.length) return;
    const sent = [];
    listi.forEach((s) => {
      const netfong = (s.netfong || []).map((n) => String(n || '').trim())
        .filter((n) => /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']+$/.test(n));
      if (!netfong.length) return;
      const m = manadarNafn_(s.manudur);
      const efni = ('Mánaðarskýrsla ' + m.nafn + ' ' + m.ar + ': ' + (s.fyrirtaeki || ''))
        .replace(/[\r\n]+/g, ' ').slice(0, 200);
      try {
        GmailApp.sendEmail(netfong.join(','), efni, skyrsluTexti_(s), { name: 'Tveir', htmlBody: skyrsluHtml_(s) });
        sent.push(s.id);
      } catch (villa) {
        console.log('Tölfræði: skýrsla til ' + s.fyrirtaeki + ' fór ekki: ' + villaTexti_(villa));
      }
    });
    if (sent.length && kalla_('merkja_skyrslu_senda', { p_ids: sent }) === null) {
      console.log('Tölfræði: náði ekki að merkja skýrslur sendar: ' + sent.join(','));
    }
  } catch (villa) {
    console.log('Tölfræði: sending skýrslna stöðvaðist: ' + villaTexti_(villa));
  }
}

/* Tölfræði sem stjórnandi sendi beint úr kerfinu (Tölfræði, "Senda á
   viðskiptavin"). Pósturinn var smíðaður í vafranum og er sendur eins og
   hann er, frá tveir@tveir.is. Kallað úr tilkynna_ í verk-postur.gs. */
function sendaTolfraediSendingar_() {
  try {
    const listi = kalla_('tolfraedi_sendingar_til', {});
    if (!Array.isArray(listi) || !listi.length) return;
    listi.forEach((s) => {
      const netfong = (s.netfong || []).map((n) => String(n || '').trim())
        .filter((n) => /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']+$/.test(n));
      if (!netfong.length) { kalla_('merkja_tolfraedi_sendingu', { p_id: s.id, p_villa: 'Ekkert gilt netfang' }); return; }
      const efni = String(s.efni || 'Tölfræðin ykkar').replace(/[\r\n]+/g, ' ').slice(0, 200);
      try {
        GmailApp.sendEmail(netfong.join(','), efni, String(s.texti || ''), { name: 'Tveir', htmlBody: String(s.html || '') });
        kalla_('merkja_tolfraedi_sendingu', { p_id: s.id });
      } catch (villa) {
        console.log('Tölfræði: sending ' + s.id + ' fór ekki: ' + villaTexti_(villa));
        kalla_('merkja_tolfraedi_sendingu', { p_id: s.id, p_villa: villaTexti_(villa) });
      }
    });
  } catch (villa) {
    console.log('Tölfræði: sendingar stöðvuðust: ' + villaTexti_(villa));
  }
}

function villaTexti_(villa) {
  return String((villa && villa.message) || villa).slice(0, 400);
}

/* ==========================================================================
   Skýrslupósturinn í Tveir útliti, eins og postHtml_ í verk-postur.gs.
   Allt úr gagnagrunninum fer í gegnum esc_, hlekkir bara í gegnum oruggSlod_.
   Töflur og stílar í línu, því Gmail og Outlook hunsa flest annað.
   ========================================================================== */

function kvedja_(nofn) {
  const n = (nofn || []).map((x) => String(x || '').trim().split(' ')[0]).filter(Boolean);
  if (!n.length || n.length > 3) return 'Hæ,';
  if (n.length === 1) return 'Hæ ' + n[0] + ',';
  return 'Hæ ' + n.slice(0, -1).join(', ') + ' og ' + n[n.length - 1] + ',';
}

function birtDags_(t) {
  const ms = Date.parse(t || '');
  if (isNaN(ms)) return '';
  const d = new Date(ms);
  return d.getUTCDate() + '. ' + TOLF_MANUDIR[d.getUTCMonth()];
}

/* Breyting sem texti, til dæmis { texti: '12% meira en í október', upp: true } */
function breytingTexti_(nu, fyrr, fyrriNafn) {
  const p = hlutfall_(nu, fyrr);
  if (p === null) return null;
  if (p === 0) return { texti: 'Svipað og í ' + fyrriNafn, upp: null };
  return { texti: Math.abs(p) + '% ' + (p > 0 ? 'meira' : 'minna') + ' en í ' + fyrriNafn, upp: p > 0 };
}

function skyrsluHtml_(s) {
  const letur = "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;";
  const fyrirsagnaletur = "font-family:Fraunces,Georgia,'Times New Roman',serif;";
  const f = s.tolur || {};
  const t = f.samtals || {};
  const m = manadarNafn_(s.manudur || f.manudur);
  const manudur = m.nafn + ' ' + m.ar;

  const merki = (b) => {
    if (!b) return '';
    const bg = b.upp === true ? '#e6f4ea' : (b.upp === false ? '#fdecec' : '#eef2f7');
    const lit = b.upp === true ? '#1e6b34' : (b.upp === false ? '#b42318' : '#4a5f80');
    const or = b.upp === true ? '&#9650;&nbsp;' : (b.upp === false ? '&#9660;&nbsp;' : '');
    return '<div style="padding-top:8px;"><span style="display:inline-block;background:' + bg + ';color:' + lit
      + ';border-radius:999px;padding:4px 10px;' + letur + 'font-size:12px;font-weight:600;line-height:1.4;">'
      + or + esc_(b.texti) + '</span></div>';
  };
  const reitur = (heiti, gildi, b) => '<td width="50%" valign="top" style="padding:6px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#f2f8fe;border-radius:14px;">'
    + '<tr><td style="padding:16px;">'
    + '<div style="' + letur + 'font-size:13px;line-height:1.4;color:#4a5f80;">' + esc_(heiti) + '</div>'
    + (gildi
      ? '<div style="' + letur + 'font-size:26px;line-height:1.2;font-weight:700;color:#1c3050;padding-top:4px;">' + esc_(gildi) + '</div>'
      : '<div style="' + letur + 'font-size:15px;line-height:1.4;color:#7189ac;padding-top:8px;">Engin gögn</div>')
    + merki(b)
    + '</td></tr></table></td>';

  let fylgjendaBreyting = null;
  if (erTala_(t.fylgjendur_breyting)) {
    const b = Number(t.fylgjendur_breyting);
    fylgjendaBreyting = b === 0 ? { texti: 'Óbreytt í mánuðinum', upp: null }
      : { texti: tolfTala_(Math.abs(b)) + (b > 0 ? ' fleiri' : ' færri') + ' í mánuðinum', upp: b > 0 };
  }

  const reitir = '<tr>'
    + reitur('Áhorf', tolfTala_(t.ahorf), breytingTexti_(t.ahorf, t.ahorf_fyrri, m.fyrri))
    + reitur('Náð', tolfTala_(t.nadir), breytingTexti_(t.nadir, t.nadir_fyrri, m.fyrri))
    + '</tr><tr>'
    + reitur('Samskipti', tolfTala_(t.samskipti), breytingTexti_(t.samskipti, t.samskipti_fyrri, m.fyrri))
    + reitur('Fylgjendur', tolfTala_(t.fylgjendur_lok), fylgjendaBreyting)
    + '</tr>';

  /* Súlurit úr töflureitum: þessi mánuður á móti síðasta */
  const sula = (gildi, haest, litur) => {
    const v = erTala_(gildi) ? Number(gildi) : 0;
    const w = haest > 0 && v > 0 ? Math.max(2, Math.min(100, Math.round(v / haest * 100))) : 0;
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>'
      + (w > 0 ? '<td width="' + w + '%" height="12" bgcolor="' + litur + '" style="background:' + litur + ';border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>' : '')
      + (w < 100 ? '<td height="12" style="font-size:0;line-height:0;">&nbsp;</td>' : '')
      + '</tr></table>';
  };
  const sulurLina = (heiti, nu, fyrr) => {
    if (!erTala_(nu) && !erTala_(fyrr)) return '';
    const haest = Math.max(Number(nu) || 0, Number(fyrr) || 0);
    return '<tr><td style="padding:0 0 16px 0;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      + '<td style="' + letur + 'font-size:14px;font-weight:600;color:#1c3050;padding-bottom:6px;">' + esc_(heiti) + '</td>'
      + '<td align="right" style="' + letur + 'font-size:13px;color:#4a5f80;padding-bottom:6px;">'
      + esc_(tolfTala_(nu) || 'Engin gögn') + ' <span style="color:#7189ac;">/ ' + esc_(tolfTala_(fyrr) || 'engin gögn') + '</span></td>'
      + '</tr></table>'
      + sula(nu, haest, '#5b93f0')
      + '<div style="height:4px;line-height:4px;font-size:0;">&nbsp;</div>'
      + sula(fyrr, haest, '#c9dcf8')
      + '</td></tr>';
  };
  const sulur = sulurLina('Áhorf', t.ahorf, t.ahorf_fyrri)
    + sulurLina('Náð', t.nadir, t.nadir_fyrri)
    + sulurLina('Samskipti', t.samskipti, t.samskipti_fyrri);
  const sulurit = sulur
    ? '<tr><td style="padding:22px 0 4px 0;' + fyrirsagnaletur + 'font-size:20px;font-weight:600;color:#1c3050;">Miðað við ' + esc_(m.fyrri) + '</td></tr>'
      + '<tr><td style="padding:0 0 14px 0;' + letur + 'font-size:13px;color:#4a5f80;">'
      + '<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#5b93f0;"></span>&nbsp;' + esc_(m.nafn)
      + '&nbsp;&nbsp;&nbsp;<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#c9dcf8;"></span>&nbsp;' + esc_(m.fyrri)
      + '</td></tr>' + sulur
    : '';

  /* Skipting eftir miðlum */
  const midlar = (f.midlar || []).map((x) => '<tr>'
    + '<td style="' + letur + 'font-size:14px;color:#1c3050;font-weight:600;padding:10px 8px 10px 0;border-top:1px solid #e3ecf8;">' + esc_(TOLF_MIDLAR[x.midill] || x.nafn || '') + '</td>'
    + '<td align="right" style="' + letur + 'font-size:14px;color:#1c3050;padding:10px 8px;border-top:1px solid #e3ecf8;">' + esc_(tolfTala_(x.fylgjendur_lok) || '-') + '</td>'
    + '<td align="right" style="' + letur + 'font-size:14px;color:#1c3050;padding:10px 8px;border-top:1px solid #e3ecf8;">' + esc_(tolfTala_(x.ahorf) || '-') + '</td>'
    + '<td align="right" style="' + letur + 'font-size:14px;color:#1c3050;padding:10px 0 10px 8px;border-top:1px solid #e3ecf8;">' + esc_(erTala_(x.faerslur) ? tolfTala_(x.faerslur) : '-') + '</td>'
    + '</tr>').join('');
  const hausStill = letur + 'font-size:12px;color:#7189ac;font-weight:600;padding:0 8px 6px 8px;';
  const midlaTafla = midlar
    ? '<tr><td style="padding:22px 0 8px 0;' + fyrirsagnaletur + 'font-size:20px;font-weight:600;color:#1c3050;">Eftir miðlum</td></tr>'
      + '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
      + '<tr><td style="' + hausStill + 'padding-left:0;">Miðill</td><td align="right" style="' + hausStill + '">Fylgjendur</td>'
      + '<td align="right" style="' + hausStill + '">Áhorf</td><td align="right" style="' + hausStill + 'padding-right:0;">Færslur</td></tr>'
      + midlar + '</table></td></tr>'
    : '';

  /* Bestu færslurnar */
  const faerslur = bestuFaerslur_(f, 3).map((p) => {
    const mynd = oruggSlod_(p.mynd_slod);
    const slod = oruggSlod_(p.slod);
    const lysing = [TOLF_MIDLAR[p.midill] || '', TOLF_TEGUNDIR[p.tegund] || '', birtDags_(p.birt)].filter(Boolean).join(' · ');
    const tolur = [
      erTala_(p.ahorf) ? tolfTala_(p.ahorf) + ' áhorf' : '',
      erTala_(p.nadir) ? tolfTala_(p.nadir) + ' náð' : '',
      erTala_(p.likes) ? tolfTala_(p.likes) + ' líkar' : '',
      erTala_(p.athugasemdir) ? tolfTala_(p.athugasemdir) + ' athugasemdir' : ''
    ].filter(Boolean).join(' · ');
    return '<tr><td style="padding:0 0 12px 0;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#f2f8fe;border-radius:14px;"><tr>'
      + (mynd
        ? '<td width="80" valign="top" style="padding:14px 0 14px 14px;"><img src="' + esc_(mynd) + '" width="66" height="66" alt="" style="display:block;width:66px;height:66px;object-fit:cover;border:0;border-radius:10px;background:#dfe9f7;"></td>'
        : '')
      + '<td valign="top" style="padding:14px 14px 14px ' + (mynd ? '12' : '16') + 'px;">'
      + '<div style="' + letur + 'font-size:12.5px;line-height:1.4;color:#7189ac;font-weight:600;">' + esc_(lysing) + '</div>'
      + (p.texti ? '<div style="' + letur + 'font-size:14.5px;line-height:1.45;color:#1c3050;padding-top:4px;word-break:break-word;overflow-wrap:anywhere;">' + esc_(stytta_(p.texti, 140)) + '</div>' : '')
      + (tolur ? '<div style="' + letur + 'font-size:13px;line-height:1.5;color:#4a5f80;padding-top:6px;">' + esc_(tolur) + '</div>' : '')
      + (slod ? '<div style="padding-top:10px;">' + takki_('Skoða færsluna', slod, false) + '</div>' : '')
      + '</td></tr></table></td></tr>';
  }).join('');
  const faerslaKafli = faerslur
    ? '<tr><td style="padding:22px 0 10px 0;' + fyrirsagnaletur + 'font-size:20px;font-weight:600;color:#1c3050;">Bestu færslurnar</td></tr>' + faerslur
    : '';

  const samantekt = s.samantekt
    ? '<tr><td style="padding:16px 0 4px 0;' + letur + 'font-size:16px;line-height:1.6;color:#1c3050;word-break:break-word;overflow-wrap:anywhere;">'
      + esc_(s.samantekt).replace(/\r?\n/g, '<br>') + '</td></tr>'
    : '';

  return '<!doctype html><html lang="is"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">'
    + '<title>' + esc_('Mánaðarskýrsla ' + manudur) + '</title></head>'
    + '<body style="margin:0;padding:0;background:#f2f8fe;">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc_('Tölurnar þínar fyrir ' + manudur) + '</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f8fe" style="background:#f2f8fe;">'
    + '<tr><td align="center" style="padding:32px 12px;">'
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">'
    + '<tr><td align="center" style="padding:0 0 22px 0;">'
    + '<a href="https://tveir.is" target="_blank" style="text-decoration:none;"><img src="' + MERKI + '" width="132" alt="TVEIR" style="display:block;width:132px;height:auto;border:0;' + letur + 'font-size:24px;font-weight:800;color:#5b93f0;"></a>'
    + '</td></tr>'
    + '<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:20px;padding:30px 22px;box-shadow:0 12px 30px rgba(28,48,80,.10);">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + '<tr><td style="padding:0 6px 14px 6px;"><span style="display:inline-block;background:#e7f0fd;color:#2c62c4;border-radius:999px;padding:6px 12px;' + letur + 'font-size:12.5px;font-weight:600;letter-spacing:.02em;">Mánaðarskýrsla &middot; ' + esc_(manudur) + '</span></td></tr>'
    + '<tr><td style="padding:0 6px 8px 6px;' + fyrirsagnaletur + 'font-size:28px;line-height:1.2;font-weight:600;color:#1c3050;word-break:break-word;overflow-wrap:anywhere;">' + esc_(s.fyrirtaeki || f.fyrirtaeki || '') + '</td></tr>'
    + '<tr><td style="padding:0 6px 14px 6px;' + letur + 'font-size:16px;line-height:1.55;color:#4a5f80;">' + esc_(kvedja_(s.nofn)) + '<br>'
    + esc_('Hér eru tölurnar af samfélagsmiðlunum ykkar í ' + m.nafn + '.') + '</td></tr>'
    + '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + reitir + '</table></td></tr>'
    + '<tr><td style="padding:0 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + samantekt + sulurit + midlaTafla + faerslaKafli
    + '<tr><td align="center" style="padding:24px 0 6px 0;">' + takki_('Sjá alla tölfræðina', TOLFRAEDI, true) + '</td></tr>'
    + '</table></td></tr>'
    + '</table></td></tr>'
    + '<tr><td align="center" style="padding:22px 12px 0 12px;' + letur + 'font-size:13px;line-height:1.6;color:#7189ac;">'
    + 'Kveðja, Tveir<br><a href="https://tveir.is" target="_blank" style="color:#5b93f0;text-decoration:none;">tveir.is</a>'
    + '</td></tr>'
    + '</table></td></tr></table></body></html>';
}

/* Venjulegi textinn, fyrir póstforrit sem sýna ekki HTML */
function skyrsluTexti_(s) {
  const f = s.tolur || {};
  const t = f.samtals || {};
  const m = manadarNafn_(s.manudur || f.manudur);
  const lina = (heiti, nu, fyrr) => {
    const b = breytingTexti_(nu, fyrr, m.fyrri);
    return heiti + ': ' + (tolfTala_(nu) || 'engin gögn') + (b ? ' (' + b.texti + ')' : '');
  };
  const linur = [
    kvedja_(s.nofn), '',
    'Mánaðarskýrsla ' + m.nafn + ' ' + m.ar + ': ' + String(s.fyrirtaeki || f.fyrirtaeki || '').replace(/[\r\n]+/g, ' '), '',
    lina('Áhorf', t.ahorf, t.ahorf_fyrri),
    lina('Náð', t.nadir, t.nadir_fyrri),
    lina('Samskipti', t.samskipti, t.samskipti_fyrri),
    'Fylgjendur: ' + (tolfTala_(t.fylgjendur_lok) || 'engin gögn')
      + (erTala_(t.fylgjendur_breyting) && Number(t.fylgjendur_breyting) !== 0
        ? ' (' + (Number(t.fylgjendur_breyting) > 0 ? '+' : '-') + tolfTala_(Math.abs(t.fylgjendur_breyting)) + ' í mánuðinum)' : ''),
    'Færslur: ' + (erTala_(t.faerslur) ? tolfTala_(t.faerslur) : 'engin gögn')
  ];
  if (s.samantekt) linur.push('', String(s.samantekt));
  const bestu = bestuFaerslur_(f, 3);
  if (bestu.length) {
    linur.push('', 'Bestu færslurnar:');
    bestu.forEach((p) => {
      const slod = oruggSlod_(p.slod);
      linur.push('- ' + (TOLF_MIDLAR[p.midill] || '') + ', ' + birtDags_(p.birt) + ': '
        + (erTala_(p.ahorf) ? tolfTala_(p.ahorf) + ' áhorf' : 'engin gögn') + (slod ? '\n  ' + slod : ''));
    });
  }
  linur.push('', 'Sjá alla tölfræðina: ' + TOLFRAEDI, '', 'Kveðja,', 'Tveir');
  return linur.join('\n');
}
