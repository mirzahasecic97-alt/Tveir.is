/* ==========================================================================
   Glerhúsið verk: móttaka á <slug>@verk.tveir.is
   Keyrir í pósthólfinu postur@verk.tveir.is á 5 mínútna fresti (setja setur
   vaktina upp). Leiðarreglan í Google Workspace breytir viðtakanda hvers
   pósts á *@verk.tveir.is í postur@verk.tveir.is og setur upprunalega
   netfangið í hausinn X-Gm-Original-To. Bara sá haus segir hvaða stofa á
   póstinn, aldrei To eða Cc, sem sendandinn ræður.

   Fyrir hvert verk-netfang í póstinum fer eitt kall á postur_inn í Supabase.
   Gagnagrunnurinn ræður öllu: hvaða stofa á netfangið, hvort sendandinn er
   viðskiptavinur hennar, hvort svarið verður athugasemd. Skriftan segir bara
   hvort pósturinn stóðst DMARC, SPF eða DKIM (audkennt_).

   Afgreiddir þræðir fá merkið Verk/Afgreitt og fara úr innhólfinu. Komi
   nýtt svar í þráðinn fer hann aftur í innhólfið og nýja svarið er lesið.
   Þræðir eru settir í ruslið eftir 30 daga.
   ========================================================================== */

const MOTTAKA_LEIT = 'in:inbox newer_than:3d';
const MOTTAKA_THRAEDIR = 50;               /* þræðir í hverri umferð */
const MOTTAKA_TIMAMORK = 4 * 60 * 1000;    /* Google stöðvar skriftuna eftir 6 mínútur */
const MOTTAKA_ALDUR = 3 * 864e5;           /* eldri skilaboð í þræði eru aldrei lesin aftur */
const MOTTAKA_NETFONG = 5;                 /* hámark verk-netfanga í einum pósti */
const BUID_HLUTAR = 4;                     /* Script Properties: hvert gildi má vera um 9 KB */
const BUID_STAERD = 8000;

/* Keyrt einu sinni með höndunum: athugar Script Properties, setur upp 5
   mínútna vaktina og keyrir einu sinni. Eyðir bara gömlum lesaVerkpost
   vöktum. */
function setja() {
  athugaEiginleika_();
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'lesaVerkpost')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('lesaVerkpost').timeBased().everyMinutes(5).create();
  merki_('Verk/Afgreitt');
  merki_('Verk/Rangt');
  lesaVerkpost();
}

function lesaVerkpost() {
  skraUtgafu_();
  if (!ANON || !LYKILL) {
    vidvorunLykill_('Það vantar ANON eða LYKILL í Script Properties. Ekkert er lesið á meðan.');
    console.log('Vantar ANON eða LYKILL í Script Properties. Ekkert lesið.');
    return;
  }
  /* Bara ein móttaka í einu. Án lássins gætu tvær umferðir lesið sama póstinn
     ef ein dregst á langinn, og þá yrði svarið athugasemd í annað sinn. */
  const las = LockService.getScriptLock();
  if (las.tryLock(30000)) {
    try {
      lesaInnholf_();
    } catch (villa) {
      console.log('Móttaka: ' + villa);
    } finally {
      las.releaseLock();
    }
  } else {
    console.log('Önnur umferð er í gangi. Móttakan bíður næstu umferðar.');
  }

  try { hreinsa30_(); } catch (villa) { console.log('Hreinsun: ' + villa); }
  tilkynna_();
}

function lesaInnholf_() {
  const byrjun = Date.now();
  const afgreitt = merki_('Verk/Afgreitt');
  const rangt = merki_('Verk/Rangt');
  const buid = lesaBuid_();

  const thraedir = GmailApp.search(MOTTAKA_LEIT, 0, MOTTAKA_THRAEDIR);
  for (let i = 0; i < thraedir.length; i++) {
    if (Date.now() - byrjun > MOTTAKA_TIMAMORK) break; /* restin fer í næstu umferð */
    try {
      lesaThrad_(thraedir[i], buid, afgreitt, rangt);
    } catch (villa) {
      console.log('Þráður ' + thraedir[i].getId() + ': ' + villa); /* reynt aftur eftir 5 mín */
    }
    /* Vistað eftir hvern þráð með nýjum skilaboðum (svör úr postur_inn
       eru vistuð um leið og þau koma) */
    if (buid.breytt()) vistaBuid_(buid);
  }
  if (buid.breytt()) vistaBuid_(buid);
}

function lesaThrad_(th, buid, afgreitt, rangt) {
  let klarad = true;
  let ekkertNetfang = false;

  th.getMessages().forEach((p) => {
    if (p.isDraft()) return;
    const id = p.getId();
    if (buid.has(id)) return;

    const fra = netfangUr_(p.getFrom());
    /* Okkar eigin svör, og gömul skilaboð í þræði sem kom aftur í innhólfið */
    if (erOkkar_(fra) || p.getDate().getTime() < Date.now() - MOTTAKA_ALDUR) { buid.add(id); return; }

    let hausar;
    try {
      hausar = hausar_(p.getRawContent());
    } catch (villa) {
      console.log('Náði ekki í hausa: ' + villa);
      klarad = false;
      return;
    }
    /* Sjálfvirk svör (fjarvera, villupóstar) verða aldrei að verkum né athugasemdum */
    if (sjalfvirkur_(hausar, fra)) { buid.add(id); return; }

    const til = verkNetfong_(hausar);
    if (!til.length) { ekkertNetfang = true; buid.add(id); return; }

    const audkennt = audkennt_(hausar, fra);
    const meginmal = p.getPlainBody();
    /* Hlekkurinn er bara sendur ef pósturinn kom sannanlega frá Google, svo
       falsaður "staðfestingarpóstur" geti ekki sett hlekk í Stillingar */
    const stadfesting = fra === 'forwarding-noreply@google.com' && audkennt ? stadfestingarSlod_(meginmal) : null;
    const texti = hreinsa_(meginmal).slice(0, 5000);
    const efni = String(p.getSubject() || '').replace(/[\r\n]+/g, ' ').slice(0, 300);
    let allt = true;

    til.forEach((netfang) => {
      const hluti = til.length > 1 ? id + '|' + netfang : id;
      if (buid.has(hluti)) return;
      const svar = kalla_('postur_inn', {
        p_til: netfang, p_fra: fra, p_fra_nafn: nafnUr_(p.getFrom()),
        p_efni: efni, p_texti: texti, p_thradur: th.getId(),
        p_audkennt: audkennt, p_stadfesting: stadfesting
      });
      if (svar === null) { allt = false; return; } /* netið datt út, reynum aftur eftir 5 mín */
      /* Rangur eða útrunninn lykill: pósturinn má ekki týnast, hann bíður
         þar til lykillinn er lagaður (í 3 daga) */
      if (svar && svar.villa === 'lykill') {
        console.log('postur_inn hafnaði lyklinum. Athugaðu LYKILL í Script Properties.');
        vidvorunLykill_('Gagnagrunnurinn hafnar LYKLI vélarinnar. Póstur á verk-netföngin bíður og verður að verkum þegar réttur lykill er kominn.');
        allt = false;
        return;
      }
      /* Merkt og vistað strax: verði keyrslan stöðvuð verður þessi póstur
         aldrei sendur aftur í gagnagrunninn */
      buid.add(hluti);
      vistaBuid_(buid);
      if (svar && svar.ok && svar.tegund === 'verk') {
        try {
          svaraVerk_(p, svar, netfang);
        } catch (villa) {
          console.log('Staðfesting fór ekki: ' + villa);
        }
      }
    });

    if (allt) buid.add(id);
    else klarad = false;
  });

  if (ekkertNetfang) th.addLabel(rangt);
  if (klarad) {
    th.addLabel(afgreitt);
    th.moveToArchive();
  }
}

/* Póstur frá okkur sjálfum (postur@ og öll *@verk.tveir.is) */
function erOkkar_(fra) {
  const len = String(fra).split('@')[1] || '';
  return VERK_LEN.indexOf(len) !== -1;
}

/* ==========================================================================
   Hausar póstsins
   Bara hausarnir eru lesnir, aldrei viðhengi. Línur sem halda áfram (byrja
   á bili) eru sameinaðar fyrri línu.
   ========================================================================== */

function hausar_(hrar) {
  const s = String(hrar || '');
  const lok = s.search(/\r?\n\r?\n/);
  const haus = (lok === -1 ? s : s.slice(0, lok)).replace(/\r?\n[ \t]+/g, ' ');
  const ut = [];
  haus.split(/\r?\n/).forEach((l) => {
    const i = l.indexOf(':');
    if (i <= 0) return;
    ut.push({ nafn: l.slice(0, i).trim().toLowerCase(), gildi: l.slice(i + 1).trim() });
  });
  return ut;
}

/* Öll gildi hauss, í sömu röð og í póstinum (efst fyrst) */
function allirHausar_(hausar, nafn) {
  const n = String(nafn).toLowerCase();
  return hausar.filter((h) => h.nafn === n).map((h) => h.gildi);
}

/* Verk-netföngin í X-Gm-Original-To, lágstafir, hvert einu sinni */
function verkNetfong_(hausar) {
  const len = VERK_LEN.map((l) => l.replace(/\./g, '\\.')).join('|');
  const snid = new RegExp('^[a-z0-9-]{3,30}@(' + len + ')$');
  const ut = [];
  allirHausar_(hausar, 'X-Gm-Original-To').forEach((g) => {
    String(g).split(',').forEach((hluti) => {
      const a = netfangUr_(hluti);
      if (snid.test(a) && a.split('@')[0] !== 'postur' && ut.indexOf(a) === -1) ut.push(a);
    });
  });
  return ut.slice(0, MOTTAKA_NETFONG);
}

/* Fjarvera, sjálfvirk svör og villupóstar. Staðfesting Gmail á áframsendingu
   er undantekning: hún á að berast. */
function sjalfvirkur_(hausar, fra) {
  if (fra === 'forwarding-noreply@google.com') return false;
  if (/^(mailer-daemon|postmaster)@/.test(fra)) return true;
  const sjalfvirkt = allirHausar_(hausar, 'Auto-Submitted')
    .some((g) => String(g).trim().toLowerCase().split(/[\s;(]/)[0] !== 'no');
  if (sjalfvirkt) return true;
  if (allirHausar_(hausar, 'Precedence').some((g) => /^(bulk|junk|auto_reply)\b/i.test(String(g).trim()))) return true;
  return allirHausar_(hausar, 'X-Autoreply').length > 0 || allirHausar_(hausar, 'X-Autorespond').length > 0;
}

/* ==========================================================================
   Auðkenning sendanda
   Lesinn er bara efsti Authentication-Results hausinn, og hann verður að
   vera frá mx.google.com (Gmail setur sinn haus efst; hausar sem
   sendandinn bjó til sjálfur eru neðar og eru hunsaðir). Satt ef:
     dmarc=pass og header.from er lén sendandans, eða
     spf=pass og lén smtp.mailfrom er sama og lén sendandans, eða
     dkim=pass og header.d (eða lén header.i) er lén sendandans eða
     yfirlén þess.
   ========================================================================== */

function audkennt_(hausar, fra) {
  const fraLen = String(fra || '').split('@')[1] || '';
  if (!fraLen || String(fra).split('@').length !== 2) return false;

  /* Bara efsti hausinn, og hann verður að vera frá mx.google.com. Vanti
     haus Google er pósturinn óauðkenndur, svo haus sem sendandinn setti
     sjálfur neðar í póstinn er aldrei lesinn. */
  const ar = allirHausar_(hausar, 'Authentication-Results')[0];
  if (!ar || !/^\s*mx\.google\.com\s*;/i.test(ar)) return false;

  /* Athugasemdir í svigum burt (þær geta innihaldið = og ;) */
  let hreint = String(ar);
  for (let i = 0; i < 5 && /\([^()]*\)/.test(hreint); i++) hreint = hreint.replace(/\([^()]*\)/g, ' ');

  const hlutar = hreint.split(';').slice(1);
  for (let i = 0; i < hlutar.length; i++) {
    const m = hlutar[i].trim().match(/^(dmarc|spf|dkim)\s*=\s*([a-z]+)/i);
    if (!m || m[2].toLowerCase() !== 'pass') continue;
    const adferd = m[1].toLowerCase();
    const eig = {};
    const par = /([a-z][a-z0-9._-]*)\s*=\s*"?([^\s";]+)"?/gi;
    let x;
    while ((x = par.exec(hlutar[i])) !== null) eig[x[1].toLowerCase()] = x[2].toLowerCase();

    if (adferd === 'dmarc') {
      if (eig['header.from'] === fraLen) return true;
    } else if (adferd === 'spf') {
      const mf = eig['smtp.mailfrom'] || '';
      const mfLen = mf.indexOf('@') !== -1 ? mf.split('@').pop() : mf;
      if (mfLen && mfLen === fraLen) return true;
    } else if (adferd === 'dkim') {
      const d = eig['header.d'] || String(eig['header.i'] || '').split('@').pop();
      if (d && d.indexOf('.') !== -1 && (fraLen === d || fraLen.slice(-(d.length + 1)) === '.' + d)) return true;
    }
  }
  return false;
}

/* Staðfestingarhlekkur Gmail á áframsendingu (sést í Stillingar > Verk-netfangið) */
function stadfestingarSlod_(texti) {
  const m = String(texti || '').match(/https:\/\/mail(?:-settings)?\.google\.com\/[^\s<>"')\]]+/);
  return m ? m[0].slice(0, 1000) : null;
}

/* ==========================================================================
   Staðfesting til viðskiptavinarins
   Svar í sama þræði, frá "<stofa> í Glerhúsinu". Reply-To er verk-netfangið
   (svo svar í þræðinum verði athugasemd) og netfang stofunnar.
   ========================================================================== */

function svaraVerk_(p, svar, netfang) {
  const st = stofa_(svar.stofa);
  const titlar = (Array.isArray(svar.titlar) ? svar.titlar : [])
    .map((t) => String(t == null ? '' : t).replace(/[\r\n]+/g, ' ').trim())
    .filter(Boolean).slice(0, 30);
  const fjoldi = Number(svar.fjoldi) || titlar.length;
  const inngangur = fjoldi > 1
    ? 'Takk, ' + fjoldi + ' verk eru komin á verklistann hjá ' + st.nafn + ':'
    : 'Takk, þetta er komið á verklistann hjá ' + st.nafn + ':';
  const texti = inngangur + '\n\n' + titlar.map((t) => '- ' + t).join('\n')
    + '\n\nÞú getur fylgst með stöðunni á ' + st.kerfi + '\n\n' + kvedjaTexti_(st);
  const html = postHtml_(st, {
    fornafn: nafnUr_(p.getFrom()).split(' ')[0],
    fyrirsogn: fjoldi > 1 ? 'Verkin eru komin á listann' : 'Verkið er komið á listann',
    inngangur: inngangur,
    merki: 'skrad',
    atridi: titlar.map((t) => ({ titill: t })),
    takki: 'Smelltu hér til að fylgjast með stöðunni',
    slod: st.kerfi
  });
  p.reply(texti, postValkostir_(st, html, netfang));
}

/* ==========================================================================
   Skilaboð sem eru búin
   Sami listi og í verk-postur.gs (síðustu skilaboðin í Script Properties),
   en dreift á nokkur gildi svo listinn rúmist. Elstu detta út fyrst.
   ========================================================================== */

function lesaBuid_() {
  const allt = EIGINLEGIR.getProperties();
  const listi = [];
  for (let i = 0; i < BUID_HLUTAR; i++) {
    const g = allt['buid_' + i];
    if (g) g.split(',').forEach((x) => { if (x) listi.push(x); });
  }
  const sett = {};
  listi.forEach((x) => { sett[x] = true; });
  let breytt = false;
  return {
    listi: listi,
    has: (x) => sett[x] === true,
    add: (x) => { if (!sett[x]) { sett[x] = true; listi.push(x); breytt = true; } },
    breytt: () => breytt,
    vistad: () => { breytt = false; }
  };
}

function vistaBuid_(buid) {
  /* Nýjustu fyrst inn í hlutana, svo það elsta detti út */
  const hlutar = [];
  let nu = [];
  let lengd = 0;
  for (let i = buid.listi.length - 1; i >= 0 && hlutar.length < BUID_HLUTAR; i--) {
    const x = buid.listi[i];
    if (lengd + x.length + 1 > BUID_STAERD) {
      hlutar.push(nu.reverse().join(','));
      nu = [];
      lengd = 0;
      if (hlutar.length >= BUID_HLUTAR) break;
    }
    nu.push(x);
    lengd += x.length + 1;
  }
  if (nu.length && hlutar.length < BUID_HLUTAR) hlutar.push(nu.reverse().join(','));
  hlutar.reverse();
  const ut = {};
  for (let i = 0; i < BUID_HLUTAR; i++) ut['buid_' + i] = hlutar[i] || '';
  EIGINLEGIR.setProperties(ut);
  if (buid.vistad) buid.vistad();
}

/* Þræðir eldri en 30 daga fara í ruslið (Gmail eyðir þeim þaðan eftir aðra
   30 daga). Pósthólfið er bara fyrir vélina, svo þetta á líka við þræði sem
   festust í innhólfinu. */
function hreinsa30_() {
  const mork = Date.now() - 30 * 864e5;
  ['label:verk-afgreitt older_than:30d', 'label:verk-rangt older_than:30d', 'in:inbox older_than:30d'].forEach((leit) => {
    const gamlir = GmailApp.search(leit, 0, 100).filter((th) => th.getLastMessageDate().getTime() < mork);
    if (gamlir.length) GmailApp.moveThreadsToTrash(gamlir);
  });
}
