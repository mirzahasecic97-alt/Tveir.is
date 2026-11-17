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

   LYKILL hér að neðan er skilinn eftir auður í þessu afriti. Raunverulegi
   lykillinn liggur bara í skriftunni í Google og í töflunni stillingar_innri.
   ========================================================================== */

const SUPABASE = 'https://wusqvolbwjysnjrfahjy.supabase.co';
const GRUNNUR = SUPABASE + '/rest/v1/rpc/';
const VINNUSVAEDI = 'https://tveir.is/vinnusvaedi/yfirlit.html';
const ANON = 'SETTU_ANON_LYKILINN_HER';
const LYKILL = 'SETTU_POSTUR_LYKILINN_HER';
const NETFANG = 'verk@tveir.is';

/* Keyrt einu sinni með höndunum: setur upp 5 mínútna vaktina */
function setja() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('lesaVerk').timeBased().everyMinutes(5).create();
  lesaVerk();
}

function lesaVerk() {
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

  tilkynnaLokid_();
  tilkynnaUndirverk_();
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
    try {
      const thradur = fyrsti.thradur ? GmailApp.getThreadById(fyrsti.thradur) : null;
      /* Svarað á upprunalega póstinn frá þeim, ekki okkar eigið svar */
      const upphaf = thradur ? thradur.getMessages().find((m) => netfangUr_(m.getFrom()) === String(fyrsti.netfang).toLowerCase()) : null;
      if (upphaf) {
        upphaf.reply(texti, { name: 'Tveir' });
      } else {
        const efni = taskar.length > 1 ? 'Klárt: ' + taskar.length + ' verk' : 'Klárt: ' + fyrsti.titill;
        GmailApp.sendEmail(fyrsti.netfang, efni, texti, { name: 'Tveir' });
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
    hopur.forEach((u) => {
      linur.push(u.titill);
      if (u.tengill) linur.push(u.tengill);
      if (u.skra_slod) {
        if (tokn === null) tokn = afhendingartokn_() || '';
        /* Takist ekki að búa til hlekk fer hlekkur á vinnusvæðið í staðinn */
        const slod = tokn ? undirritud_(tokn, u.skra_slod) : null;
        linur.push(slod
          ? 'Sækja ' + (u.skra_nafn || 'skrána') + ' (hlekkurinn gildir í 7 daga):\n' + slod
          : 'Skráin bíður þín á vinnusvæðinu: ' + VINNUSVAEDI);
      }
      linur.push('');
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

    try {
      const thradur = fyrsti.thradur ? GmailApp.getThreadById(fyrsti.thradur) : null;
      const upphaf = thradur && netfong.length === 1
        ? thradur.getMessages().find((m) => netfangUr_(m.getFrom()) === String(netfong[0]).toLowerCase())
        : null;
      if (upphaf) {
        upphaf.reply(texti, { name: 'Tveir' });
      } else {
        GmailApp.sendEmail(netfong.join(','), efni, texti, { name: 'Tveir' });
      }
      hopur.forEach((u) => sent.push(u.id));
    } catch (e) {
      /* reynum aftur eftir 5 mínútur */
    }
  });

  if (sent.length) kalla_('merkja_undirverk_sent', { p_ids: sent });
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
    return hluti ? SUPABASE + '/storage/v1' + hluti : null;
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
    if (/^(On .+wrote:|Þann .+skrifaði|Den .+skrev:|-----Original Message-----|From: |Frá: |Sent from my )/.test(l.trim())) break;
    if (/^-- ?$/.test(l)) break;
    if (/^>/.test(l)) continue;
    ut.push(l);
  }
  return ut.join('\n').trim();
}

function merki_(nafn) {
  return GmailApp.getUserLabelByName(nafn) || GmailApp.createLabel(nafn);
}
