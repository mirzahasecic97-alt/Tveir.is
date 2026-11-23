/* ==========================================================================
   Glerhúsið verk: póstur út frá stofunum
   tilkynna_ keyrir í lok hverrar 5 mínútna umferðar (lesaVerkpost) og
   strax þegar gagnagrunnurinn kallar á doPost. Bara ein umferð í einu.

     tilkynnaLokid_            taskar frá viðskiptavinum sem stofan hakaði í lokið
     tilkynnaUndirverk_        undirverk með hlekk eða skrá (skrár: afhending-slod)
     sendaSkyrslur_            samþykktar mánaðarskýrslur
     sendaTolfraediSendingar_  tölfræði send beint úr kerfinu
     manadarDrog_              drög að mánaðarskýrslum, 2. hvers mánaðar

   Sama rökfræði og í verk-postur.gs og tolfraedi.gs hjá Tveir, en hvert
   atriði ber sína stofu: pósturinn er merktur henni, sendandinn heitir
   "<stofa> í Glerhúsinu" og svör fara á netfang stofunnar (Reply-To).
   Lykillinn sér bara stofur með sendir_fra = 'verk', aldrei Tveir.
   ========================================================================== */

const TOLF_MANUDIR = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí',
  'ágúst', 'september', 'október', 'nóvember', 'desember'];
const TOLF_MIDLAR = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
const TOLF_TEGUNDIR = { mynd: 'Mynd', myndband: 'Myndband', reel: 'Reel', karusell: 'Hringekja',
  saga: 'Saga', annad: 'Færsla' };
const POSTKVOTI_VARA = 20; /* póstar sem eru alltaf skildir eftir af daglega kvótanum */

function tilkynna_() {
  const las = LockService.getScriptLock();
  if (!las.tryLock(60000)) return; /* vaktin eftir 5 mín nær þessu */
  try {
    keyra_('Lokið', tilkynnaLokid_);
    keyra_('Undirverk', tilkynnaUndirverk_);
    keyra_('Skýrslur', sendaSkyrslur_);
    keyra_('Tölfræði', sendaTolfraediSendingar_);
    keyra_('Mánaðarskýrslur', manadarDrog_);
  } finally {
    las.releaseLock();
  }
}

/* Villa í einum hluta stöðvar aldrei hina */
function keyra_(heiti, fall) {
  try {
    fall();
  } catch (villa) {
    console.log(heiti + ': ' + villaTexti_(villa));
  }
}

function villaTexti_(villa) {
  return String((villa && villa.message) || villa).slice(0, 400);
}

/* Er nóg eftir af daglega póstkvóta Google, og af tíma keyrslunnar? Þegar
   tíminn er búinn bíður restin næstu umferðar, og það sem fór er merkt sent. */
function kvotiEftir_(fjoldi) {
  if (!timiEftir_()) return false;
  try {
    return MailApp.getRemainingDailyQuota() - (fjoldi || 1) >= POSTKVOTI_VARA;
  } catch (villa) {
    return true;
  }
}

/* Þráður í þessu pósthólfi, eða null ef hann er horfinn eða í ruslinu */
function thradur_(id) {
  if (!id) return null;
  try {
    const th = GmailApp.getThreadById(String(id));
    return th && !th.isInTrash() ? th : null;
  } catch (villa) {
    return null;
  }
}

/* Verk-netfang stofunnar, svo svar í verkþræði verði athugasemd */
function verkNetfangStofu_(st) {
  return st.slug ? st.slug + '@' + VERK_LEN[0] : null;
}

function kerfiSlod_(st, sida) {
  return st.kerfi.replace(/\/?$/, '/') + (sida || '');
}

/* ==========================================================================
   Lokin verk
   Kom taskurinn með pósti fer svarið í sama póstþráð, annars nýr póstur.
   Margir taskar til sama manns í sama þræði fara í einum pósti.
   ========================================================================== */

function tilkynnaLokid_() {
  const listi = kalla_('lokid_otilkynnt', {});
  if (!Array.isArray(listi) || !listi.length) return;

  const hopar = {};
  const sent = [];
  listi.forEach((t) => {
    if (!t) return;
    if (!erNetfang_(t.netfang)) { sent.push(t.id); return; } /* aldrei hægt að senda: merkt svo það endurtaki sig ekki */
    const st = stofa_(t.stofa);
    const k = st.slug + '|' + String(t.netfang).toLowerCase() + '|' + (t.thradur || '');
    (hopar[k] = hopar[k] || []).push(t);
  });

  Object.keys(hopar).forEach((k) => {
    if (!kvotiEftir_(1)) return;
    const taskar = hopar[k];
    const fyrsti = taskar[0];
    const st = stofa_(fyrsti.stofa);
    const netfang = String(fyrsti.netfang).trim().toLowerCase();
    const fornafn = String(fyrsti.nafn || '').split(' ')[0];
    const inngangur = taskar.length > 1 ? 'Þessi verk eru klár:' : 'Þetta er klárt:';
    const texti = (fornafn ? 'Hæ ' + fornafn + ',\n\n' : '')
      + inngangur + '\n\n' + taskar.map((t) => '- ' + t.titill).join('\n')
      + '\n\nÞú sérð stöðuna á ' + st.kerfi + '\n\n' + kvedjaTexti_(st);
    const html = postHtml_(st, {
      fornafn: fornafn,
      fyrirsogn: taskar.length > 1 ? 'Verkin eru klár' : 'Verkið er klárt',
      inngangur: inngangur,
      atridi: taskar.map((t) => ({ titill: t.titill }))
    });
    try {
      const th = thradur_(fyrsti.thradur);
      /* Svarað á upprunalega póstinn frá þeim, ekki okkar eigið svar */
      const upphaf = th ? th.getMessages().find((m) => netfangUr_(m.getFrom()) === netfang) : null;
      if (upphaf) {
        upphaf.reply(texti, postValkostir_(st, html, verkNetfangStofu_(st)));
      } else {
        const efni = (taskar.length > 1 ? 'Klárt: ' + taskar.length + ' verk' : 'Klárt: ' + fyrsti.titill)
          .replace(/[\r\n]+/g, ' ').slice(0, 200);
        GmailApp.sendEmail(netfang, efni, texti, postValkostir_(st, html));
      }
      taskar.forEach((t) => sent.push(t.id));
    } catch (villa) {
      console.log('Lokið til ' + st.slug + ': ' + villaTexti_(villa)); /* reynum aftur eftir 5 mínútur */
    }
  });

  if (sent.length) kalla_('merkja_tilkynnt', { p_ids: sent });
}

/* ==========================================================================
   Undirverk
   Hlekkur (WeTransfer, Drive) fer eins og hann er. Skrá í geymslunni fær
   hlekk sem gildir í 7 daga úr Edge Function afhending-slod (enginn
   afhendingarnotandi hjá öðrum stofum en Tveir). Takist það ekki fær
   viðskiptavinurinn hlekk á kerfið og sækir skrána þar.
   ========================================================================== */

function tilkynnaUndirverk_() {
  const listi = kalla_('undirverk_otilkynnt', {});
  if (!Array.isArray(listi) || !listi.length) return;

  const hopar = {};
  listi.forEach((u) => {
    if (!u) return;
    const k = u.task_id + '|' + (u.netfong || []).join(',');
    (hopar[k] = hopar[k] || []).push(u);
  });

  const sent = [];
  Object.keys(hopar).forEach((k) => {
    const hopur = hopar[k];
    const fyrsti = hopur[0];
    const st = stofa_(fyrsti.stofa);
    const kerfi = st.kerfi;
    const netfong = (fyrsti.netfong || []).map((n) => String(n || '').trim().toLowerCase()).filter(erNetfang_);
    if (!netfong.length) return;
    if (!kvotiEftir_(netfong.length)) return;

    const linur = [];
    const atridi = [];
    hopur.forEach((u) => {
      const a = { titill: u.titill, hlekkir: [] };
      linur.push(u.titill);
      if (u.tengill) {
        linur.push(u.tengill);
        a.hlekkir.push({ texti: 'Opna hlekkinn', slod: u.tengill });
      }
      if (u.skra_slod) {
        const slod = afhendingSlod_(u.id);
        linur.push(slod
          ? 'Sækja ' + (u.skra_nafn || 'skrána') + ' (hlekkurinn gildir í 7 daga):\n' + slod
          : 'Skráin bíður þín í kerfinu: ' + kerfi);
        if (slod) {
          a.hlekkir.push({ texti: 'Sækja ' + (u.skra_nafn || 'skrána'), slod: slod });
          a.athugasemd = 'Hlekkurinn gildir í 7 daga.';
        } else {
          a.athugasemd = 'Skráin bíður þín í kerfinu.';
        }
      }
      linur.push('');
      atridi.push(a);
    });

    const fornafn = String(fyrsti.nafn || '').split(' ')[0];
    const stada = fyrsti.lokin + ' af ' + fyrsti.fjoldi;
    /* Titill tasksins getur komið frá viðskiptavini: engar línubreytingar í efnislínunni */
    const efni = (hopur.length > 1
      ? fyrsti.task_titill + ': ' + hopur.length + ' tilbúin (' + stada + ')'
      : fyrsti.task_titill + ': ' + fyrsti.titill + ' er tilbúið (' + stada + ')')
      .replace(/[\r\n]+/g, ' ').slice(0, 200);
    const texti = (fornafn ? 'Hæ ' + fornafn + ',\n\n' : 'Hæ,\n\n')
      + 'Þetta er tilbúið í ' + fyrsti.task_titill + ':\n\n'
      + linur.join('\n') + '\n'
      + 'Staðan: ' + stada + ' lokið. Þú sérð allt á ' + kerfi + '\n\n' + kvedjaTexti_(st);

    const html = postHtml_(st, {
      fornafn: fornafn,
      fyrirsogn: hopur.length > 1 ? 'Þetta er tilbúið' : fyrsti.titill + ' er tilbúið',
      inngangur: 'Úr verkinu ' + fyrsti.task_titill + ':',
      atridi: atridi,
      lokin: fyrsti.lokin,
      fjoldi: fyrsti.fjoldi
    });

    try {
      const th = netfong.length === 1 ? thradur_(fyrsti.thradur) : null;
      const upphaf = th ? th.getMessages().find((m) => netfangUr_(m.getFrom()) === netfong[0]) : null;
      if (upphaf) {
        upphaf.reply(texti, postValkostir_(st, html, verkNetfangStofu_(st)));
      } else {
        GmailApp.sendEmail(netfong.join(','), efni, texti, postValkostir_(st, html));
      }
      hopur.forEach((u) => sent.push(u.id));
    } catch (villa) {
      console.log('Undirverk til ' + st.slug + ': ' + villaTexti_(villa)); /* reynum aftur eftir 5 mínútur */
    }
  });

  if (sent.length) kalla_('merkja_undirverk_sent', { p_ids: sent });
}

/* Undirrituð slóð á skrá undirverks, 7 daga, úr Edge Function afhending-slod.
   Fallið athugar sjálft að undirverkið sé lokið, eigi að sendast og sé hjá
   stofu sem lykillinn nær til. Skilar null ef eitthvað klikkar. */
function afhendingSlod_(undirverkId) {
  if (!undirverkId || !ANON || !LYKILL) return null;
  try {
    const r = UrlFetchApp.fetch(SUPABASE + '/functions/v1/afhending-slod', {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON },
      payload: JSON.stringify({ lykill: LYKILL, undirverk_id: undirverkId }),
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) return null;
    const svar = JSON.parse(r.getContentText());
    return svar && svar.ok ? oruggSlod_(svar.slod) : null;
  } catch (villa) {
    return null;
  }
}

/* ==========================================================================
   Mánaðarskýrslur
   2. hvers mánaðar verða til drög fyrir hvert fyrirtæki verk stofanna, með
   samantekt úr föstu sniðmáti (engin gervigreind hér). Stjórnendur hverrar
   stofu fá einn póst um að drögin bíði. Stjórnandinn getur smellt á
   "Skrifa samantekt" í Tölfræði ef stofan hefur tengt gervigreind.
   ========================================================================== */

function manadarDrog_() {
  const nu = new Date();
  const dagur = Number(Utilities.formatDate(nu, 'Atlantic/Reykjavik', 'd'));
  if (dagur < 2 || dagur > 6) return;
  const fyrri = fyrriManudur_(nu);
  if (EIGINLEGIR.getProperty('skyrslur_manudur') === fyrri) return;
  /* Mistakist eitthvað er reynt aftur eftir klukkutíma, ekki á 5 mínútna fresti */
  const sidast = Number(EIGINLEGIR.getProperty('skyrslur_tilraun') || 0);
  if (Date.now() - sidast < 3600e3) return;
  EIGINLEGIR.setProperty('skyrslur_tilraun', String(Date.now()));
  buaTilSkyrslur_(fyrri);
}

/* Fyrsti dagur síðasta mánaðar, 'YYYY-MM-01'. Ísland er á UTC allt árið. */
function fyrriManudur_(nu) {
  return new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
}

/* Samþykktar og sendar skýrslur breytast ekki (vista_skyrslu sér um það).
   Skilar true ef allt fór inn. */
function buaTilSkyrslur_(manudur) {
  const listi = kalla_('manadar_tolur', { p_manudur: manudur });
  if (!Array.isArray(listi)) {
    console.log('Mánaðarskýrslur: náði ekki í tölur mánaðarins, reynt aftur seinna');
    return false;
  }

  const hopar = {};
  let villur = 0;
  listi.forEach((f) => {
    if (!timiEftir_()) { villur++; return; } /* restin eftir klukkutíma */
    try {
      const texti = samantektSnidmat_(f);
      const id = kalla_('vista_skyrslu', {
        p_fyrirtaeki_id: f.fyrirtaeki_id, p_manudur: manudur, p_tolur: f,
        p_samantekt: texti.slice(0, 4000)
      });
      if (!id) { villur++; console.log('Mánaðarskýrslur: skýrsla fyrir ' + f.fyrirtaeki_id + ' vistaðist ekki'); return; }
      const st = stofa_(f.stofa);
      const h = hopar[st.slug] = hopar[st.slug] || { stofa: st, netfong: f.stofa_netfong, nofn: [] };
      h.nofn.push(String(f.fyrirtaeki || '').replace(/[\r\n]+/g, ' '));
    } catch (villa) {
      villur++;
      console.log('Mánaðarskýrslur: ' + f.fyrirtaeki_id + ': ' + villaTexti_(villa));
    }
  });
  if (!villur) EIGINLEGIR.setProperty('skyrslur_manudur', manudur);

  /* Hver stofa fær bara einn póst á mánuð, líka þegar reynt er aftur */
  let tilkynnt = {};
  try { tilkynnt = JSON.parse(EIGINLEGIR.getProperty('skyrslur_tilkynnt') || '{}'); } catch (e) { tilkynnt = {}; }
  if (tilkynnt.manudur !== manudur) tilkynnt = { manudur: manudur, stofur: [] };

  const m = manadarNafn_(manudur);
  Object.keys(hopar).forEach((slug) => {
    if (!slug || tilkynnt.stofur.indexOf(slug) !== -1) return;
    const h = hopar[slug];
    const netfong = (Array.isArray(h.netfong) ? h.netfong : [])
      .map((n) => String(n || '').trim().toLowerCase()).filter(erNetfang_).slice(0, 20);
    if (!netfong.length || !kvotiEftir_(netfong.length)) return;
    try {
      GmailApp.sendEmail(netfong.join(','), 'Mánaðarskýrslur ' + m.nafn + ' ' + m.ar + ' bíða yfirferðar',
        'Drög að mánaðarskýrslum fyrir ' + m.nafn + ' ' + m.ar + ' eru tilbúin hjá ' + h.stofa.nafn + ':\n\n'
        + h.nofn.map((n) => '- ' + n).join('\n')
        + '\n\nLestu þær yfir, lagaðu samantektina ef þarf og smelltu á Samþykkja og senda:\n'
        + kerfiSlod_(h.stofa, 'tolfraedi.html')
        + '\n\nEf gervigreind er tengd getur þú líka smellt á Skrifa samantekt.'
        + '\nViðskiptavinurinn fær ekkert fyrr en þú samþykkir.\n\nKveðja,\nGlerhúsið',
        { name: 'Glerhúsið' });
      tilkynnt.stofur.push(slug);
    } catch (villa) {
      console.log('Mánaðarskýrslur: póstur til ' + slug + ' fór ekki: ' + villaTexti_(villa));
    }
  });
  EIGINLEGIR.setProperty('skyrslur_tilkynnt', JSON.stringify(tilkynnt));
  return !villur;
}

/* Samþykktar skýrslur fara á viðskiptavininn, merktar stofunni */
function sendaSkyrslur_() {
  const listi = kalla_('skyrslur_til_sendingar', {});
  if (!Array.isArray(listi) || !listi.length) return;
  const sent = [];
  listi.forEach((s) => {
    const netfong = (s.netfong || []).map((n) => String(n || '').trim()).filter(erNetfang_);
    if (!netfong.length || !kvotiEftir_(netfong.length)) return;
    const st = stofa_(s.stofa);
    const m = manadarNafn_(s.manudur);
    const efni = ('Mánaðarskýrsla ' + m.nafn + ' ' + m.ar + ': ' + (s.fyrirtaeki || ''))
      .replace(/[\r\n]+/g, ' ').slice(0, 200);
    try {
      GmailApp.sendEmail(netfong.join(','), efni, skyrsluTexti_(s, st), postValkostir_(st, skyrsluHtml_(s, st)));
      sent.push(s.id);
    } catch (villa) {
      console.log('Mánaðarskýrslur: skýrsla ' + s.id + ' fór ekki: ' + villaTexti_(villa));
    }
  });
  if (sent.length && kalla_('merkja_skyrslu_senda', { p_ids: sent }) === null) {
    console.log('Mánaðarskýrslur: náði ekki að merkja skýrslur sendar: ' + sent.join(','));
  }
}

/* Tölfræði sem stjórnandi sendi beint úr kerfinu. Pósturinn var smíðaður í
   vafranum og er sendur eins og hann er, frá "<stofa> í Glerhúsinu". */
function sendaTolfraediSendingar_() {
  const listi = kalla_('tolfraedi_sendingar_til', {});
  if (!Array.isArray(listi) || !listi.length) return;
  listi.forEach((s) => {
    const netfong = (s.netfong || []).map((n) => String(n || '').trim()).filter(erNetfang_);
    if (!netfong.length) { kalla_('merkja_tolfraedi_sendingu', { p_id: s.id, p_villa: 'Ekkert gilt netfang' }); return; }
    if (!kvotiEftir_(netfong.length)) return;
    const st = stofa_(s.stofa);
    const efni = String(s.efni || 'Tölfræðin ykkar').replace(/[\r\n]+/g, ' ').slice(0, 200);
    try {
      GmailApp.sendEmail(netfong.join(','), efni, String(s.texti || ''), postValkostir_(st, String(s.html || '')));
      kalla_('merkja_tolfraedi_sendingu', { p_id: s.id });
    } catch (villa) {
      console.log('Tölfræði: sending ' + s.id + ' fór ekki: ' + villaTexti_(villa));
      kalla_('merkja_tolfraedi_sendingu', { p_id: s.id, p_villa: villaTexti_(villa) });
    }
  });
}

/* ==========================================================================
   Tölur og texti, afrituð úr tolfraedi.gs
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

function stytta_(t, n) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
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

/* ==========================================================================
   Skýrslupósturinn, merktur stofunni. Sama útlit og skyrsluHtml_ í
   tolfraedi.gs hjá Tveir. Allt úr gagnagrunninum fer í gegnum esc_,
   hlekkir bara í gegnum oruggSlod_.
   ========================================================================== */

function skyrsluHtml_(s, st) {
  const letur = LETUR;
  const fyrirsagnaletur = FYRIRSAGNALETUR;
  const f = s.tolur || {};
  const t = f.samtals || {};
  const m = manadarNafn_(s.manudur || f.manudur);
  const manudur = m.nafn + ' ' + m.ar;
  const tolfraedi = kerfiSlod_(st, 'tolfraedi.html');

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
    + '<tr><td align="center" style="padding:0 0 22px 0;">' + merkiHtml_(st) + '</td></tr>'
    + '<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:20px;padding:30px 22px;box-shadow:0 12px 30px rgba(28,48,80,.10);">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + '<tr><td style="padding:0 6px 14px 6px;"><span style="display:inline-block;background:#e7f0fd;color:#2c62c4;border-radius:999px;padding:6px 12px;' + letur + 'font-size:12.5px;font-weight:600;letter-spacing:.02em;">Mánaðarskýrsla &middot; ' + esc_(manudur) + '</span></td></tr>'
    + '<tr><td style="padding:0 6px 8px 6px;' + fyrirsagnaletur + 'font-size:28px;line-height:1.2;font-weight:600;color:#1c3050;word-break:break-word;overflow-wrap:anywhere;">' + esc_(s.fyrirtaeki || f.fyrirtaeki || '') + '</td></tr>'
    + '<tr><td style="padding:0 6px 14px 6px;' + letur + 'font-size:16px;line-height:1.55;color:#4a5f80;">' + esc_(kvedja_(s.nofn)) + '<br>'
    + esc_('Hér eru tölurnar af samfélagsmiðlunum ykkar í ' + m.nafn + '.') + '</td></tr>'
    + '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + reitir + '</table></td></tr>'
    + '<tr><td style="padding:0 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + samantekt + sulurit + midlaTafla + faerslaKafli
    + '<tr><td align="center" style="padding:24px 0 6px 0;">' + takki_('Sjá alla tölfræðina', tolfraedi, true) + '</td></tr>'
    + '</table></td></tr>'
    + '</table></td></tr>'
    + fotur_(st)
    + '</table></td></tr></table></body></html>';
}

/* Venjulegi textinn, fyrir póstforrit sem sýna ekki HTML */
function skyrsluTexti_(s, st) {
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
  linur.push('', 'Sjá alla tölfræðina: ' + kerfiSlod_(st, 'tolfraedi.html'), '', kvedjaTexti_(st));
  return linur.join('\n');
}
