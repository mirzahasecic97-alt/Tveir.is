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

   LYKILL hér að neðan er skilinn eftir auður í þessu afriti. Raunverulegi
   lykillinn liggur bara í skriftunni í Google og í töflunni stillingar_innri.
   ========================================================================== */

const GRUNNUR = 'https://wusqvolbwjysnjrfahjy.supabase.co/rest/v1/rpc/';
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
