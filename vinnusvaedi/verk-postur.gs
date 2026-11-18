/* ==========================================================================
   Tveir: verk@tveir.is -> taskar á vinnusvæðinu
   Keyrir í Google reikningnum tveir@tveir.is (script.google.com), á 5 mínútna
   fresti. Les póst sem berst á verk@tveir.is og sendir hann á fallið
   taskur_ur_posti í Supabase. Listi í póstinum verður einn taskur á hvern lið.

   Sendandinn verður að vera skráður notandi hjá viðskiptavini á vinnusvæðinu.
   Annars verður enginn taskur til og pósturinn fær merkið Verk/Othekkt í
   Gmail, svo við sjáum hann.

   Þegar task frá viðskiptavini er hakaður í lokið fær sá sem bað um hann
   póst um það, í sama póstþræði ef hann kom með pósti.

   Undirverk: þegar við hökum í eitt (til dæmis myndband 2 af 4) fær
   viðskiptavinurinn póst með hlekknum eða skránni. Sjá tilkynnaUndirverk_.

   Póstur um lokið fer strax: gagnagrunnurinn kallar á doPost um leið og
   hakað er. 5 mínútna vaktin sendir það sem kallið náði ekki.

   Tölfræði og mánaðarskýrslur eru í tolfraedi.gs, annarri skrá í sama
   verkefni. tilkynna_ sendir líka samþykktar skýrslur.

   LYKILL hér að neðan er skilinn eftir auður í þessu afriti. Raunverulegi
   lykillinn liggur bara í skriftunni í Google og í töflunni stillingar_innri.
   ========================================================================== */

const SUPABASE = 'https://wusqvolbwjysnjrfahjy.supabase.co';
const GRUNNUR = SUPABASE + '/rest/v1/rpc/';
const VINNUSVAEDI = 'https://tveir.is/vinnusvaedi/yfirlit.html';
const ANON = 'SETTU_ANON_LYKILINN_HER';
const LYKILL = 'SETTU_POSTUR_LYKILINN_HER';
const NETFANG = 'verk@tveir.is';
/* Hækka í hvert sinn sem kóðanum er breytt. Vefappið keyrir útgáfuna sem var
   birt síðast, en 5 mínútna vaktin keyrir alltaf nýjasta kóðann. Passi
   útgáfurnar ekki saman sendir vefappið ekkert, vaktin tekur við og
   tveir@tveir.is fær einn póst um að birta nýja útgáfu. */
const UTGAFA = '2026-11-19-1';

/* Keyrt einu sinni með höndunum: setur upp 5 mínútna vaktina. Eyðir bara
   gömlum lesaVerk vöktum, svo daglega tölfræðisöfnunin (setjaTolfraedi í
   tolfraedi.gs) lifir af. */
function setja() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'lesaVerk')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('lesaVerk').timeBased().everyMinutes(5).create();
  lesaVerk();
}

function lesaVerk() {
  PropertiesService.getScriptProperties().setProperty('utgafa', UTGAFA);
  const skrad = merki_('Verk/Skrad');
  const othekkt = merki_('Verk/Othekkt');
  const eiginlegir = PropertiesService.getScriptProperties();
  let buid = JSON.parse(eiginlegir.getProperty('buid') || '[]');

  const thraedir = GmailApp.search('to:' + NETFANG + ' newer_than:3d', 0, 40);
  thraedir.forEach((thradur) => {
    thradur.getMessages().forEach((p) => {
      const id = p.getId();
      if (buid.indexOf(id) !== -1) return;
      const fra = netfangUr_(p.getFrom());
      const til = (p.getTo() + ',' + p.getCc()).toLowerCase();
      /* Bara póstur sem fór á verk@, og ekki svörin okkar sjálfra */
      if (til.indexOf(NETFANG) === -1 || /@tveir\.is$/.test(fra)) { buid.push(id); return; }

      const svar = kalla_('taskur_ur_posti', { p_fra: fra, p_efni: p.getSubject(),
        p_texti: hreinsa_(p.getPlainBody()), p_thradur: thradur.getId() });
      if (!svar) return; /* netið datt út, reynum aftur eftir 5 mín */

      buid.push(id);
      if (svar.ok) {
        thradur.addLabel(skrad);
        const titlar = svar.titlar || [];
        const inngangur = svar.fjoldi > 1
          ? 'Takk, ' + svar.fjoldi + ' verk eru komin á verklistann hjá Tveir:'
          : 'Takk, þetta er komið á verklistann hjá Tveir:';
        p.reply(inngangur + '\n\n' + titlar.map((t) => '- ' + t).join('\n')
          + '\n\nÞú getur fylgst með stöðunni á https://tveir.is/vinnusvaedi\n\nKveðja,\nTveir',
          { name: 'Tveir' });
      } else if (svar.villa === 'othekktur') {
        thradur.addLabel(othekkt);
      }
    });
  });

  if (buid.length > 500) buid = buid.slice(-500);
  eiginlegir.setProperty('buid', JSON.stringify(buid));

  tilkynna_();
}

/* Vefapp: gagnagrunnurinn kallar hingað um leið og hakað er í lokið
   (stofnun vefapps: sjá LESTU-MIG.md, kaflann Póstur strax). Kallið þarf
   að bera lykilinn, annars gerist ekkert. */
function doPost(e) {
  let gogn = {};
  try {
    gogn = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (villa) {
    gogn = {};
  }
  if (!gogn || typeof gogn.lykill !== 'string' || gogn.lykill !== LYKILL) {
    return ContentService.createTextOutput('nei');
  }
  const eiginlegir = PropertiesService.getScriptProperties();
  const nyjust = eiginlegir.getProperty('utgafa');
  if (nyjust && nyjust !== UTGAFA) {
    /* Gamla útgáfan: sendum ekkert, vaktin sendir með nýja kóðanum */
    if (eiginlegir.getProperty('utgafa_vidvorun') !== nyjust) {
      eiginlegir.setProperty('utgafa_vidvorun', nyjust);
      try {
        GmailApp.sendEmail('tveir@tveir.is', 'Vinnusvæðið: birta þarf nýja útgáfu af skriftunni',
          'Kóðinn í verk-postur var uppfærður en vefappið keyrir enn gömlu útgáfuna (' + UTGAFA + ').\n'
          + 'Póstur um lokin verk fer því á 5 mínútna fresti en ekki strax.\n\n'
          + 'Lagfæring í script.google.com: Deploy > Manage deployments > blýanturinn > '
          + 'Version: New version > Deploy.', { name: 'Vinnusvæðið' });
      } catch (villa) {
        /* skiptir ekki máli */
      }
    }
    return ContentService.createTextOutput('gamalt');
  }
  tilkynna_();
  return ContentService.createTextOutput('ok');
}

/* Bara ein umferð í einu. Kemur kall á meðan vaktin er að senda bíður það
   eftir henni og sendir svo það sem bættist við, svo ekkert fari tvisvar. */
function tilkynna_() {
  const las = LockService.getScriptLock();
  if (!las.tryLock(60000)) return; /* vaktin eftir 5 mín nær þessu */
  try {
    tilkynnaLokid_();
    tilkynnaUndirverk_();
    /* Samþykktar mánaðarskýrslur (tolfraedi.gs). Skráin er kannski ekki komin inn. */
    if (typeof sendaSkyrslur_ === 'function') sendaSkyrslur_();
    /* Tölfræði send beint úr kerfinu */
    if (typeof sendaTolfraediSendingar_ === 'function') sendaTolfraediSendingar_();
  } finally {
    las.releaseLock();
  }
}

/* Taskar frá viðskiptavinum sem við hökuðum í lokið: segjum þeim það.
   Kom taskurinn með pósti fer svarið í sama póstþráð, annars nýr póstur.
   Margir taskar til sama manns í sama þræði fara í einum pósti. */
function tilkynnaLokid_() {
  const listi = kalla_('lokid_otilkynnt', {});
  if (!Array.isArray(listi) || !listi.length) return;

  const hopar = {};
  listi.forEach((t) => {
    const k = t.netfang + '|' + (t.thradur || '');
    (hopar[k] = hopar[k] || []).push(t);
  });

  const sent = [];
  Object.keys(hopar).forEach((k) => {
    const taskar = hopar[k];
    const fyrsti = taskar[0];
    const fornafn = String(fyrsti.nafn || '').split(' ')[0];
    const texti = (fornafn ? 'Hæ ' + fornafn + ',\n\n' : '')
      + (taskar.length > 1 ? 'Þessi verk eru klár:' : 'Þetta er klárt:')
      + '\n\n' + taskar.map((t) => '- ' + t.titill).join('\n')
      + '\n\nÞú sérð stöðuna á https://tveir.is/vinnusvaedi\n\nKveðja,\nTveir';
    const html = postHtml_({
      fornafn: fornafn,
      fyrirsogn: taskar.length > 1 ? 'Verkin eru klár' : 'Verkið er klárt',
      inngangur: taskar.length > 1 ? 'Þessi verk eru klár:' : 'Þetta er klárt:',
      atridi: taskar.map((t) => ({ titill: t.titill }))
    });
    try {
      const thradur = fyrsti.thradur ? GmailApp.getThreadById(fyrsti.thradur) : null;
      /* Svarað á upprunalega póstinn frá þeim, ekki okkar eigið svar */
      const upphaf = thradur ? thradur.getMessages().find((m) => netfangUr_(m.getFrom()) === String(fyrsti.netfang).toLowerCase()) : null;
      if (upphaf) {
        upphaf.reply(texti, { name: 'Tveir', htmlBody: html });
      } else {
        const efni = (taskar.length > 1 ? 'Klárt: ' + taskar.length + ' verk' : 'Klárt: ' + fyrsti.titill)
          .replace(/[\r\n]+/g, ' ').slice(0, 200);
        GmailApp.sendEmail(fyrsti.netfang, efni, texti, { name: 'Tveir', htmlBody: html });
      }
      taskar.forEach((t) => sent.push(t.id));
    } catch (e) {
      /* reynum aftur eftir 5 mínútur */
    }
  });

  if (sent.length) kalla_('merkja_tilkynnt', { p_ids: sent });
}

/* Undirverk sem við hökuðum í lokið: viðskiptavinurinn fær hlekkinn.
   Undirverk sama tasks sem klárast í sömu umferð fara í einum pósti.

   Hlekkur (WeTransfer, Drive) fer eins og hann er. Skrá í geymslunni
   fær hlekk sem gildir í 7 daga, en bara ef afhendingarnotandinn er
   settur upp (Script Properties AFHENDING_NETFANG og AFHENDING_LYKILORD,
   sjá LESTU-MIG.md). Annars fær viðskiptavinurinn hlekk á vinnusvæðið og
   sækir skrána þar. */
function tilkynnaUndirverk_() {
  const listi = kalla_('undirverk_otilkynnt', {});
  if (!Array.isArray(listi) || !listi.length) return;

  const hopar = {};
  listi.forEach((u) => {
    const k = u.task_id + '|' + (u.netfong || []).join(',');
    (hopar[k] = hopar[k] || []).push(u);
  });

  let tokn = null; /* sótt einu sinni, bara ef einhver skrá er í pósti */
  const sent = [];

  Object.keys(hopar).forEach((k) => {
    const hopur = hopar[k];
    const fyrsti = hopur[0];
    const netfong = (fyrsti.netfong || []).filter(Boolean);
    if (!netfong.length) return;

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
        if (tokn === null) tokn = afhendingartokn_() || '';
        /* Takist ekki að búa til hlekk fer hlekkur á vinnusvæðið í staðinn */
        const slod = tokn ? undirritud_(tokn, u.skra_slod) : null;
        linur.push(slod
          ? 'Sækja ' + (u.skra_nafn || 'skrána') + ' (hlekkurinn gildir í 7 daga):\n' + slod
          : 'Skráin bíður þín á vinnusvæðinu: ' + VINNUSVAEDI);
        if (slod && oruggSlod_(slod)) {
          a.hlekkir.push({ texti: 'Sækja ' + (u.skra_nafn || 'skrána'), slod: slod });
          a.athugasemd = 'Hlekkurinn gildir í 7 daga.';
        } else {
          a.athugasemd = 'Skráin bíður þín á vinnusvæðinu.';
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
      + 'Staðan: ' + stada + ' lokið. Þú sérð allt á ' + VINNUSVAEDI + '\n\nKveðja,\nTveir';

    const html = postHtml_({
      fornafn: fornafn,
      fyrirsogn: hopur.length > 1 ? 'Þetta er tilbúið' : fyrsti.titill + ' er tilbúið',
      inngangur: 'Úr verkinu ' + fyrsti.task_titill + ':',
      atridi: atridi,
      lokin: fyrsti.lokin,
      fjoldi: fyrsti.fjoldi
    });

    try {
      const thradur = fyrsti.thradur ? GmailApp.getThreadById(fyrsti.thradur) : null;
      const upphaf = thradur && netfong.length === 1
        ? thradur.getMessages().find((m) => netfangUr_(m.getFrom()) === String(netfong[0]).toLowerCase())
        : null;
      if (upphaf) {
        upphaf.reply(texti, { name: 'Tveir', htmlBody: html });
      } else {
        GmailApp.sendEmail(netfong.join(','), efni, texti, { name: 'Tveir', htmlBody: html });
      }
      hopur.forEach((u) => sent.push(u.id));
    } catch (e) {
      /* reynum aftur eftir 5 mínútur */
    }
  });

  if (sent.length) kalla_('merkja_undirverk_sent', { p_ids: sent });
}

/* ==========================================================================
   Póstur í Tveir útliti
   Venjulegi textinn fer alltaf með, svo póstforrit sem sýna ekki HTML
   fá hann. Allt sem kemur frá viðskiptavini eða úr gagnagrunninum
   (titlar, nöfn, hlekkir) fer í gegnum esc_ áður en það lendir í HTML.
   Töflur og stílar í línu, því Gmail og Outlook hunsa flest annað.
   ========================================================================== */

const MERKI = 'https://tveir.is/assets/img/tveir-logo-3d.png';

function esc_(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Bara https hlekkir fara í hnapp, annars ekkert */
function oruggSlod_(slod) {
  const s = String(slod || '').trim();
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : null;
}

function takki_(texti, slod, adal) {
  const bg = adal ? '#5b93f0' : '#e7f0fd';
  const lit = adal ? '#ffffff' : '#2c62c4';
  const pad = adal ? '15px 28px' : '9px 16px';
  const st = adal ? '16px' : '14px';
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;max-width:100%;"><tr>'
    + '<td bgcolor="' + bg + '" style="background:' + bg + ';border-radius:999px;">'
    + '<a href="' + esc_(slod) + '" target="_blank" style="display:inline-block;padding:' + pad + ';font-family:Inter,-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;font-size:' + st + ';font-weight:600;line-height:1.3;text-align:center;word-break:break-word;overflow-wrap:anywhere;color:' + lit + ';text-decoration:none;border-radius:999px;">'
    + esc_(texti) + '</a></td></tr></table>';
}

/* v: { fornafn, fyrirsogn, inngangur, atridi: [{ titill, hlekkir: [{ texti, slod }], athugasemd }],
        lokin, fjoldi }   lokin og fjoldi bara fyrir undirverk */
function postHtml_(v) {
  const letur = "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;";
  const fyrirsagnaletur = "font-family:Fraunces,Georgia,'Times New Roman',serif;";
  const lokin = Number(v.lokin) || 0;
  const fjoldi = Number(v.fjoldi) || 0;
  const hlutfall = fjoldi > 0 ? Math.max(0, Math.min(100, Math.round(lokin / fjoldi * 100))) : 0;

  const listi = (v.atridi || []).map((a) => {
    const hnappar = (a.hlekkir || []).map((h) => {
      const s = oruggSlod_(h.slod);
      return s
        ? '<div style="padding-top:10px;">' + takki_(h.texti, s, false) + '</div>'
        : '<div style="' + letur + 'font-size:13px;line-height:1.5;color:#7189ac;padding-top:6px;">Hlekkurinn bíður þín á vinnusvæðinu.</div>';
    }).join('');
    const ath = a.athugasemd
      ? '<div style="' + letur + 'font-size:13px;line-height:1.5;color:#7189ac;padding-top:6px;">' + esc_(a.athugasemd) + '</div>'
      : '';
    return '<tr><td style="padding:0 0 12px 0;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#f2f8fe;border-radius:14px;">'
      + '<tr><td width="44" valign="top" style="padding:16px 0 16px 16px;">'
      + '<div style="width:28px;height:28px;line-height:28px;border-radius:999px;background:#e6f4ea;color:#1e6b34;text-align:center;' + letur + 'font-size:15px;font-weight:700;">&#10003;</div>'
      + '</td><td valign="top" style="padding:16px 16px 16px 12px;">'
      + '<div style="' + letur + 'font-size:16px;line-height:1.4;font-weight:600;color:#1c3050;padding-top:3px;word-break:break-word;overflow-wrap:anywhere;">' + esc_(a.titill) + '</div>'
      + ath + hnappar
      + '</td></tr></table></td></tr>';
  }).join('');

  const framvinda = fjoldi > 0
    ? '<tr><td style="padding:8px 0 4px 0;">'
      + '<div style="' + letur + 'font-size:14px;line-height:1.4;color:#1c3050;font-weight:600;padding-bottom:8px;">'
      + esc_(lokin + ' af ' + fjoldi + ' lokið') + '</div>'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#e7f0fd;border-radius:999px;">'
      + '<tr>' + (hlutfall > 0 ? '<td width="' + hlutfall + '%" height="10" bgcolor="#5b93f0" style="background:#5b93f0;border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>' : '')
      + (hlutfall < 100 ? '<td height="10" style="font-size:0;line-height:0;">&nbsp;</td>' : '')
      + '</tr></table></td></tr>'
    : '';

  const kvedja = v.fornafn ? 'Hæ ' + v.fornafn + ',' : 'Hæ,';

  return '<!doctype html><html lang="is"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">'
    + '<title>' + esc_(v.fyrirsogn) + '</title></head>'
    + '<body style="margin:0;padding:0;background:#f2f8fe;">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc_(v.fyrirsogn) + '</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f8fe" style="background:#f2f8fe;">'
    + '<tr><td align="center" style="padding:32px 16px;">'
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">'
    + '<tr><td align="center" style="padding:0 0 22px 0;">'
    + '<a href="https://tveir.is" target="_blank" style="text-decoration:none;"><img src="' + MERKI + '" width="132" alt="TVEIR" style="display:block;width:132px;height:auto;border:0;' + letur + 'font-size:24px;font-weight:800;color:#5b93f0;"></a>'
    + '</td></tr>'
    + '<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:20px;padding:32px 28px;box-shadow:0 12px 30px rgba(28,48,80,.10);">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + '<tr><td style="padding:0 0 14px 0;"><span style="display:inline-block;background:#e6f4ea;color:#1e6b34;border-radius:999px;padding:6px 12px;' + letur + 'font-size:12.5px;font-weight:600;letter-spacing:.02em;">&#10003;&nbsp; Verk lokið</span></td></tr>'
    + '<tr><td style="padding:0 0 8px 0;' + fyrirsagnaletur + 'font-size:28px;line-height:1.2;font-weight:600;color:#1c3050;word-break:break-word;overflow-wrap:anywhere;">' + esc_(v.fyrirsogn) + '</td></tr>'
    + '<tr><td style="padding:0 0 20px 0;' + letur + 'font-size:16px;line-height:1.55;color:#4a5f80;word-break:break-word;overflow-wrap:anywhere;">' + esc_(kvedja) + '<br>' + esc_(v.inngangur) + '</td></tr>'
    + listi + framvinda
    + '<tr><td align="center" style="padding:24px 0 6px 0;">' + takki_('Smelltu hér til að sjá stöðuna á þínum verkefnum', VINNUSVAEDI, true) + '</td></tr>'
    + '</table></td></tr>'
    + '<tr><td align="center" style="padding:22px 12px 0 12px;' + letur + 'font-size:13px;line-height:1.6;color:#7189ac;">'
    + 'Kveðja, Tveir<br><a href="https://tveir.is" target="_blank" style="color:#5b93f0;text-decoration:none;">tveir.is</a>'
    + '</td></tr>'
    + '</table></td></tr></table></body></html>';
}

/* Skráir afhendingarnotandann inn. Hann má bara lesa skrár undirverka sem
   er lokið, ekkert annað (stefnan vidhengi_afhending). Lykilorðið liggur
   bara í Script Properties, aldrei í kóðanum. */
function afhendingartokn_() {
  const e = PropertiesService.getScriptProperties();
  const netfang = e.getProperty('AFHENDING_NETFANG');
  const lykilord = e.getProperty('AFHENDING_LYKILORD');
  if (!netfang || !lykilord) return null;
  try {
    const r = UrlFetchApp.fetch(SUPABASE + '/auth/v1/token?grant_type=password', {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: ANON },
      payload: JSON.stringify({ email: netfang, password: lykilord }),
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) return null;
    return JSON.parse(r.getContentText()).access_token || null;
  } catch (villa) {
    return null;
  }
}

/* Undirrituð slóð á skrá í lokuðu geymslunni, gildir í 7 daga */
function undirritud_(tokn, slod) {
  try {
    const leid = String(slod).split('/').map(encodeURIComponent).join('/');
    const r = UrlFetchApp.fetch(SUPABASE + '/storage/v1/object/sign/vidhengi/' + leid, {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: ANON, Authorization: 'Bearer ' + tokn },
      payload: JSON.stringify({ expiresIn: 7 * 24 * 60 * 60 }),
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) return null;
    const svar = JSON.parse(r.getContentText());
    const hluti = svar.signedURL || svar.signedUrl;
    /* Supabase skilar slóðinni óumritaðri, svo bil í skráarnafni brjóta hlekkinn */
    return hluti ? SUPABASE + '/storage/v1' + encodeURI(hluti) : null;
  } catch (villa) {
    return null;
  }
}

function kalla_(fall, gogn) {
  try {
    const r = UrlFetchApp.fetch(GRUNNUR + fall, {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON },
      payload: JSON.stringify(Object.assign({ p_lykill: LYKILL }, gogn)),
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) return null;
    return JSON.parse(r.getContentText());
  } catch (e) {
    return null;
  }
}

/* "Jón Jónsson <jon@breidablik.is>" -> jon@breidablik.is */
function netfangUr_(fra) {
  const m = String(fra).match(/<([^>]+)>/);
  return (m ? m[1] : String(fra)).trim().toLowerCase();
}

/* Sker burt tilvitnaða eldri pósta og undirskrift, svo bara nýi textinn fari inn */
function hreinsa_(texti) {
  const linur = String(texti || '').split(/\r?\n/);
  const ut = [];
  for (let i = 0; i < linur.length; i++) {
    const l = linur[i];
    const tvaer = l.trim() + ' ' + String(linur[i + 1] || '').trim();
    if (/^(On .+wrote:|Þann .+skrifaði|Den .+skrev:|-----Original Message-----|From: |Frá: |Sent from my |Sent (úr|frá) |Sendur (úr|frá) |Get Outlook|Sækja Outlook)/.test(l.trim())) break;
    if (/^(On .+wrote:|Þann .+skrifaði)/.test(tvaer)) break;  /* Gmail brýtur þessa línu stundum í tvennt */
    if (/^_{5,}$/.test(l.trim())) break;                       /* Outlook setur strik á undan eldri pósti */
    if (/^-- ?$/.test(l)) break;
    if (/^>/.test(l)) continue;
    ut.push(l);
  }
  return ut.join('\n').trim();
}

function merki_(nafn) {
  return GmailApp.getUserLabelByName(nafn) || GmailApp.createLabel(nafn);
}
