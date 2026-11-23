/* ==========================================================================
   Glerhúsið verk: sameiginlegt
   Apps Script verkefnið "Glerhúsið verk" keyrir í pósthólfinu
   postur@verk.tveir.is. Það þjónar öllum stofum nema Tveir: póstur á
   <slug>@verk.tveir.is verður að verkum (verk-mottaka.gs) og stofan og
   viðskiptavinir hennar fá póst um lokin verk, undirverk og skýrslur
   (verk-tilkynna.gs).

   Þrjár skrár í sama verkefni: sameiginlegt.gs (þessi), verk-mottaka.gs og
   verk-tilkynna.gs. Allar deila sama víðværa svæði. Fastar sem aðrar skrár
   nota eru bara skilgreindir hér, og hinar skrárnar nota þá aðeins inni í
   föllum (aldrei efst í skrá), svo röð skránna skiptir ekki máli.

   Leyndarmál liggja bara í Script Properties, aldrei í kóðanum:
     ANON               anon lykill Supabase (Settings > API)
     LYKILL             lykill vélarinnar úr vel_lyklar (allar stofur með
                        sendir_fra = 'verk', umfang postur_inn, postur_ut,
                        skyrslur). Sést aldrei Tveir gögn.
     VEFKROKUR_LYKILL   lykillinn sem gagnagrunnurinn sendir á doPost
                        (stillingar_innri.verk_vefkrokur_lykill)
   Valkvætt:
     REKSTUR_NETFANG    hvert viðvaranir um gamla útgáfu og lykla fara
                        (sjálfgefið tveir@tveir.is)

   Röðin við uppsetningu (skref D, eftir að skref 6 hefur búið lyklana til):
     1. Project Settings > Script Properties: ANON, LYKILL og VEFKROKUR_LYKILL
        (gildin úr síðustu setningu 2026-11-2x-stofur-6-opna.sql). Save.
     2. Skrárnar þrjár límdar inn og vistaðar.
     3. Keyra profaLykil. Executions sýnir "Lykillinn virkar" eða hvað vantar.
     4. Keyra setja (vaktin á 5 mínútna fresti).
     5. Deploy > New deployment > Web app (Execute as: Me, Who has access:
        Anyone). /exec slóðin fer í v_vefkrokur í skrefi 6, sem er keyrt aftur.
   Vanti lykil eða hafni gagnagrunnurinn honum fær REKSTUR_NETFANG einn póst
   á sólarhring, og póstur á verk-netföngin bíður (í 3 daga) þar til það er lagað.
   ========================================================================== */

const SUPABASE = 'https://wusqvolbwjysnjrfahjy.supabase.co';
const GRUNNUR = SUPABASE + '/rest/v1/rpc/';
const EIGINLEGIR = PropertiesService.getScriptProperties();
const ANON = EIGINLEGIR.getProperty('ANON') || '';
const LYKILL = EIGINLEGIR.getProperty('LYKILL') || '';
const VEFKROKUR_LYKILL = EIGINLEGIR.getProperty('VEFKROKUR_LYKILL') || '';
const REKSTUR_NETFANG = EIGINLEGIR.getProperty('REKSTUR_NETFANG') || 'tveir@tveir.is';

/* Lén sem vélin tekur við pósti á. Seinna lén (til dæmis verk.glerhusid.is)
   bætist hér við og í verk_netfong; gömlu netföngin virka áfram. */
const VERK_LEN = ['verk.tveir.is'];
const KERFI = 'https://tveir.is/glerhus/kerfi/';

/* Hækka í hvert sinn sem kóðanum er breytt. Vefappið keyrir útgáfuna sem var
   birt síðast, en 5 mínútna vaktin keyrir alltaf nýjasta kóðann. Passi
   útgáfurnar ekki saman sendir vefappið ekkert, vaktin tekur við og
   REKSTUR_NETFANG fær einn póst um að birta nýja útgáfu. */
const UTGAFA = '2026-11-24-1';

/* Google stöðvar hverja keyrslu eftir 6 mínútur. Efsti hluti skránna keyrir
   í upphafi hverrar keyrslu, svo hér er upphafstíminn. Póstur út hættir
   eftir KEYRSLA_HAMARK og það sem er sent er merkt sent áður en Google
   stöðvar keyrsluna (annars færi allt aftur í næstu umferð). */
const KEYRSLA_BYRJUN = Date.now();
const KEYRSLA_HAMARK = 5 * 60 * 1000;

function timiEftir_() {
  return Date.now() - KEYRSLA_BYRJUN < KEYRSLA_HAMARK;
}

/* Stöðvar keyrslu með skýrum skilaboðum ef leyndarmál vantar */
function athugaEiginleika_() {
  const vantar = [];
  if (!ANON) vantar.push('ANON');
  if (!LYKILL) vantar.push('LYKILL');
  if (!VEFKROKUR_LYKILL) vantar.push('VEFKROKUR_LYKILL');
  if (vantar.length) {
    throw new Error('Vantar í Script Properties: ' + vantar.join(', ')
      + '. Project Settings > Script Properties > Add script property.');
  }
}

/* Einn póstur á sólarhring til REKSTUR_NETFANG um að lykil vanti eða sé hafnað */
function vidvorunLykill_(texti) {
  const sidast = Number(EIGINLEGIR.getProperty('lykill_vidvorun') || 0);
  if (Date.now() - sidast < 24 * 3600e3) return;
  EIGINLEGIR.setProperty('lykill_vidvorun', String(Date.now()));
  try {
    GmailApp.sendEmail(REKSTUR_NETFANG, 'Glerhúsið verk: laga þarf lykil skriftarinnar',
      texti + '\n\nLagfæring í script.google.com (verkefnið Glerhúsið verk á postur@verk.tveir.is): '
      + 'Project Settings > Script Properties. Settu rétt gildi í ANON, LYKILL og VEFKROKUR_LYKILL, '
      + 'vistaðu og keyrðu svo profaLykil í ritlinum.',
      { name: 'Glerhúsið' });
  } catch (villa) {
    /* skiptir ekki máli, Executions loggið sýnir það líka */
  }
}

/* Keyrt með höndunum eftir að Script Properties eru sett eða lykli skipt
   út. Spyr um verk-netfang sem getur aldrei verið til (prufa er frátekið
   heiti): réttur lykill svarar "engin_stofa", rangur "lykill". Það eina
   sem verður til er ein lína í postur_inn_log án sendanda. */
function profaLykil() {
  athugaEiginleika_();
  const svar = kalla_('postur_inn', {
    p_til: 'prufa@' + VERK_LEN[0], p_fra: '', p_fra_nafn: '', p_efni: '', p_texti: '',
    p_thradur: '', p_audkennt: false, p_stadfesting: null
  });
  if (svar === null) throw new Error('Náði ekki í Supabase. Er ANON réttur?');
  if (svar.villa === 'lykill') throw new Error('Gagnagrunnurinn hafnar LYKLI. Settu lykil vélarinnar úr skrefi 6 í LYKILL í Script Properties.');
  EIGINLEGIR.deleteProperty('lykill_vidvorun');
  console.log('Lykillinn virkar.');
  return 'Lykillinn virkar.';
}

/* Kall á RPC í Supabase. Skilar svarinu, eða null ef netið eða fallið
   klikkaði (þá er reynt aftur í næstu umferð). Lykillinn fer alltaf með. */
function kalla_(fall, gogn) {
  if (!ANON || !LYKILL) {
    console.log('Vantar ANON eða LYKILL í Script Properties');
    return null;
  }
  try {
    const r = UrlFetchApp.fetch(GRUNNUR + fall, {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON },
      payload: JSON.stringify(Object.assign({ p_lykill: LYKILL }, gogn)),
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) {
      console.log(fall + ': ' + r.getResponseCode() + ' ' + String(r.getContentText()).slice(0, 300));
      return null;
    }
    return JSON.parse(r.getContentText());
  } catch (e) {
    console.log(fall + ': ' + e);
    return null;
  }
}

/* "Jón Jónsson <jon@breidablik.is>" -> jon@breidablik.is */
function netfangUr_(fra) {
  const m = String(fra).match(/<([^>]+)>/);
  return (m ? m[1] : String(fra)).trim().toLowerCase();
}

/* "Jón Jónsson <jon@breidablik.is>" -> Jón Jónsson */
function nafnUr_(fra) {
  const s = String(fra || '');
  const i = s.indexOf('<');
  if (i <= 0) return '';
  return s.slice(0, i).replace(/["\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
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

/* ==========================================================================
   Stofan sem sendir
   Hvert atriði úr gagnagrunninum ber stofa blokk:
   { nafn, slug, netfang, merki_url, litur, vefur, kerfi }
   Allt sem fer í haus pósts er hreinsað hér.
   ========================================================================== */

function erNetfang_(n) {
  return /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[a-z]{2,}$/i.test(String(n || '').trim());
}

/* Stofublokkin, með öruggum sjálfgefnum gildum ef eitthvað vantar */
function stofa_(s) {
  const st = s && typeof s === 'object' ? s : {};
  return {
    nafn: String(st.nafn || 'Glerhúsið').replace(/[\r\n"<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Glerhúsið',
    slug: /^[a-z0-9-]{3,30}$/.test(String(st.slug || '')) ? String(st.slug) : '',
    netfang: erNetfang_(st.netfang) ? String(st.netfang).trim().toLowerCase() : '',
    merki_url: oruggSlod_(st.merki_url),
    vefur: oruggSlod_(st.vefur),
    kerfi: oruggSlod_(st.kerfi) || KERFI
  };
}

/* Nafnið sem sést sem sendandi: "Prófun Stofa í Glerhúsinu" */
function sendandi_(stofa) {
  return stofa_(stofa).nafn + ' í Glerhúsinu';
}

/* Valkostir fyrir GmailApp: nafn sendanda, Reply-To stofunnar og HTML.
   aukaSvar er netfang sem á líka að fá svarið (til dæmis verk-netfangið,
   svo svar í þræðinum verði athugasemd). */
function postValkostir_(stofa, html, aukaSvar) {
  const st = stofa_(stofa);
  const svarTil = [];
  if (aukaSvar && erNetfang_(aukaSvar)) svarTil.push(String(aukaSvar).toLowerCase());
  if (st.netfang && svarTil.indexOf(st.netfang) === -1) svarTil.push(st.netfang);
  const v = { name: sendandi_(st) };
  if (svarTil.length) v.replyTo = svarTil.join(', ');
  if (html) v.htmlBody = html;
  return v;
}

/* Lína fyrir venjulega textann: "Kveðja,\nPrófun Stofa" */
function kvedjaTexti_(stofa) {
  return 'Kveðja,\n' + stofa_(stofa).nafn;
}

/* ==========================================================================
   Póstur í Glerhúsið útliti, með merki og nafni stofunnar
   Venjulegi textinn fer alltaf með, svo póstforrit sem sýna ekki HTML
   fá hann. Allt sem kemur frá viðskiptavini, stofunni eða úr
   gagnagrunninum (titlar, nöfn, hlekkir) fer í gegnum esc_ áður en það
   lendir í HTML. Töflur og stílar í línu, því Gmail og Outlook hunsa flest
   annað.
   ========================================================================== */

const LETUR = "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;";
const FYRIRSAGNALETUR = "font-family:Fraunces,Georgia,'Times New Roman',serif;";

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
    + '<a href="' + esc_(slod) + '" target="_blank" style="display:inline-block;padding:' + pad + ';' + LETUR + 'font-size:' + st + ';font-weight:600;line-height:1.3;text-align:center;word-break:break-word;overflow-wrap:anywhere;color:' + lit + ';text-decoration:none;border-radius:999px;">'
    + esc_(texti) + '</a></td></tr></table>';
}

/* Haus póstsins: merki stofunnar ef það er til, annars nafnið sem texti.
   (Merki Glerhússins er bara til sem SVG, sem Gmail sýnir ekki.) */
function merkiHtml_(stofa) {
  const st = stofa_(stofa);
  const slod = st.vefur || st.kerfi;
  const innihald = st.merki_url
    ? '<img src="' + esc_(st.merki_url) + '" width="132" alt="' + esc_(st.nafn) + '" style="display:block;width:132px;max-width:132px;height:auto;border:0;' + LETUR + 'font-size:22px;font-weight:800;color:#1c3050;">'
    : '<span style="' + FYRIRSAGNALETUR + 'font-size:24px;line-height:1.2;font-weight:600;color:#1c3050;">' + esc_(st.nafn) + '</span>';
  return '<a href="' + esc_(slod) + '" target="_blank" style="text-decoration:none;">' + innihald + '</a>';
}

/* Fótur póstsins: Kveðja, <stofa> og vefur stofunnar (eða kerfið) */
function fotur_(stofa) {
  const st = stofa_(stofa);
  const slod = st.vefur || st.kerfi;
  const synd = slod.replace(/^https:\/\//, '').replace(/\/$/, '');
  return '<tr><td align="center" style="padding:22px 12px 0 12px;' + LETUR + 'font-size:13px;line-height:1.6;color:#7189ac;">'
    + 'Kveðja, ' + esc_(st.nafn) + '<br><a href="' + esc_(slod) + '" target="_blank" style="color:#5b93f0;text-decoration:none;">' + esc_(synd) + '</a>'
    + '</td></tr>';
}

/* stofa: stofublokkin
   v: { fornafn, fyrirsogn, inngangur, merki ('lokid' eða 'skrad'),
        atridi: [{ titill, hlekkir: [{ texti, slod }], athugasemd }],
        lokin, fjoldi, takki, slod }   lokin og fjoldi bara fyrir undirverk */
function postHtml_(stofa, v) {
  const st = stofa_(stofa);
  const lokin = Number(v.lokin) || 0;
  const fjoldi = Number(v.fjoldi) || 0;
  const hlutfall = fjoldi > 0 ? Math.max(0, Math.min(100, Math.round(lokin / fjoldi * 100))) : 0;
  const skrad = v.merki === 'skrad';
  const hnappSlod = oruggSlod_(v.slod) || st.kerfi;

  const listi = (v.atridi || []).map((a) => {
    const hnappar = (a.hlekkir || []).map((h) => {
      const s = oruggSlod_(h.slod);
      return s
        ? '<div style="padding-top:10px;">' + takki_(h.texti, s, false) + '</div>'
        : '<div style="' + LETUR + 'font-size:13px;line-height:1.5;color:#7189ac;padding-top:6px;">Hlekkurinn bíður þín í kerfinu.</div>';
    }).join('');
    const ath = a.athugasemd
      ? '<div style="' + LETUR + 'font-size:13px;line-height:1.5;color:#7189ac;padding-top:6px;">' + esc_(a.athugasemd) + '</div>'
      : '';
    const takn = skrad
      ? '<div style="width:28px;height:28px;line-height:28px;border-radius:999px;background:#e7f0fd;color:#2c62c4;text-align:center;' + LETUR + 'font-size:15px;font-weight:700;">&#8226;</div>'
      : '<div style="width:28px;height:28px;line-height:28px;border-radius:999px;background:#e6f4ea;color:#1e6b34;text-align:center;' + LETUR + 'font-size:15px;font-weight:700;">&#10003;</div>';
    return '<tr><td style="padding:0 0 12px 0;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#f2f8fe;border-radius:14px;">'
      + '<tr><td width="44" valign="top" style="padding:16px 0 16px 16px;">' + takn
      + '</td><td valign="top" style="padding:16px 16px 16px 12px;">'
      + '<div style="' + LETUR + 'font-size:16px;line-height:1.4;font-weight:600;color:#1c3050;padding-top:3px;word-break:break-word;overflow-wrap:anywhere;">' + esc_(a.titill) + '</div>'
      + ath + hnappar
      + '</td></tr></table></td></tr>';
  }).join('');

  const framvinda = fjoldi > 0
    ? '<tr><td style="padding:8px 0 4px 0;">'
      + '<div style="' + LETUR + 'font-size:14px;line-height:1.4;color:#1c3050;font-weight:600;padding-bottom:8px;">'
      + esc_(lokin + ' af ' + fjoldi + ' lokið') + '</div>'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#e7f0fd;border-radius:999px;">'
      + '<tr>' + (hlutfall > 0 ? '<td width="' + hlutfall + '%" height="10" bgcolor="#5b93f0" style="background:#5b93f0;border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>' : '')
      + (hlutfall < 100 ? '<td height="10" style="font-size:0;line-height:0;">&nbsp;</td>' : '')
      + '</tr></table></td></tr>'
    : '';

  const kvedja = v.fornafn ? 'Hæ ' + v.fornafn + ',' : 'Hæ,';
  const merki = skrad
    ? '<span style="display:inline-block;background:#e7f0fd;color:#2c62c4;border-radius:999px;padding:6px 12px;' + LETUR + 'font-size:12.5px;font-weight:600;letter-spacing:.02em;">Komið á verklistann</span>'
    : '<span style="display:inline-block;background:#e6f4ea;color:#1e6b34;border-radius:999px;padding:6px 12px;' + LETUR + 'font-size:12.5px;font-weight:600;letter-spacing:.02em;">&#10003;&nbsp; Verk lokið</span>';

  return '<!doctype html><html lang="is"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">'
    + '<title>' + esc_(v.fyrirsogn) + '</title></head>'
    + '<body style="margin:0;padding:0;background:#f2f8fe;">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc_(v.fyrirsogn) + '</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f8fe" style="background:#f2f8fe;">'
    + '<tr><td align="center" style="padding:32px 16px;">'
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">'
    + '<tr><td align="center" style="padding:0 0 22px 0;">' + merkiHtml_(st) + '</td></tr>'
    + '<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:20px;padding:32px 28px;box-shadow:0 12px 30px rgba(28,48,80,.10);">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + '<tr><td style="padding:0 0 14px 0;">' + merki + '</td></tr>'
    + '<tr><td style="padding:0 0 8px 0;' + FYRIRSAGNALETUR + 'font-size:28px;line-height:1.2;font-weight:600;color:#1c3050;word-break:break-word;overflow-wrap:anywhere;">' + esc_(v.fyrirsogn) + '</td></tr>'
    + '<tr><td style="padding:0 0 20px 0;' + LETUR + 'font-size:16px;line-height:1.55;color:#4a5f80;word-break:break-word;overflow-wrap:anywhere;">' + esc_(kvedja) + '<br>' + esc_(v.inngangur) + '</td></tr>'
    + listi + framvinda
    + '<tr><td align="center" style="padding:24px 0 6px 0;">' + takki_(v.takki || 'Smelltu hér til að sjá stöðuna á þínum verkefnum', hnappSlod, true) + '</td></tr>'
    + '</table></td></tr>'
    + fotur_(st)
    + '</table></td></tr></table></body></html>';
}

/* ==========================================================================
   Útgáfuvörður og vefapp
   ========================================================================== */

/* Vefapp: gagnagrunnurinn (vekja_postinn) kallar hingað um leið og hakað er
   í lokið hjá stofu með sendir_fra = 'verk'. Kallið þarf að bera
   VEFKROKUR_LYKILL, annars gerist ekkert. */
function doPost(e) {
  let gogn = {};
  try {
    gogn = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (villa) {
    gogn = {};
  }
  if (!VEFKROKUR_LYKILL || !gogn || typeof gogn.lykill !== 'string' || !jafnir_(gogn.lykill, VEFKROKUR_LYKILL)) {
    return ContentService.createTextOutput('nei');
  }
  if (!utgafaRett_()) return ContentService.createTextOutput('gamalt');
  tilkynna_();
  return ContentService.createTextOutput('ok');
}

/* Ber saman tvo strengi án þess að tíminn segi til um hve mikið passaði */
function jafnir_(a, b) {
  const x = String(a);
  const y = String(b);
  if (!x.length || x.length !== y.length) return false;
  let munur = 0;
  for (let i = 0; i < x.length; i++) munur |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return munur === 0;
}

/* Vaktin skráir nýjustu útgáfuna. Keyri vefappið eldri kóða sendir það
   ekkert og REKSTUR_NETFANG fær einn póst um að birta nýja útgáfu. */
function skraUtgafu_() {
  EIGINLEGIR.setProperty('utgafa', UTGAFA);
}

function utgafaRett_() {
  const nyjust = EIGINLEGIR.getProperty('utgafa');
  if (!nyjust || nyjust === UTGAFA) return true;
  if (EIGINLEGIR.getProperty('utgafa_vidvorun') !== nyjust) {
    EIGINLEGIR.setProperty('utgafa_vidvorun', nyjust);
    try {
      GmailApp.sendEmail(REKSTUR_NETFANG, 'Glerhúsið verk: birta þarf nýja útgáfu af skriftunni',
        'Kóðinn í Glerhúsið verk (postur@verk.tveir.is) var uppfærður en vefappið keyrir enn gömlu útgáfuna (' + UTGAFA + ').\n'
        + 'Póstur um lokin verk fer því á 5 mínútna fresti en ekki strax.\n\n'
        + 'Lagfæring í script.google.com: Deploy > Manage deployments > blýanturinn > '
        + 'Version: New version > Deploy.', { name: 'Glerhúsið' });
    } catch (villa) {
      /* skiptir ekki máli */
    }
  }
  return false;
}
