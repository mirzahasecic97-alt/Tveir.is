/* ==========================================================================
   Tveir: pósthólfið á vinnusvæðinu (Samskipti > Pósthólf)
   Þriðja skráin í Apps Script verkefninu á tveir@tveir.is, við hlið
   verk-postur.gs og tolfraedi.gs. Notar ANON, LYKILL, kalla_, netfangUr_ og
   hreinsa_ þaðan.

   samstillaPostholf_  keyrir með lesaVerk á 5 mínútna fresti. Afritar
                       þræði í pósthólfinu síðustu 14 daga (aðalflipinn, ekki
                       auglýsingar, samfélagsmiðlar né spjallþræðir) sem
                       venjulegan texta. Bara þræðir sem breyttust eru sendir.
   sendaPostholfSvor_  keyrir í tilkynna_: sendir svör sem voru skrifuð á
                       vinnusvæðinu, í sama póstþræði, frá tveir@tveir.is,
                       og nýjan póst (Nýr póstur) á þá sem voru valdir.
   ========================================================================== */

const POSTHOLF_LEIT = 'in:inbox newer_than:14d -category:promotions -category:social -category:forums';
const POSTHOLF_HAMARK = 60;          /* þræðir í hverri umferð */
const POSTHOLF_SKILABOD = 15;        /* nýjustu skilaboðin í hverjum þræði */

function samstillaPostholf_() {
  const eig = PropertiesService.getScriptProperties();
  let sidast = {};
  try { sidast = JSON.parse(eig.getProperty('postholf_sidast') || '{}'); } catch (e) { sidast = {}; }

  const thraedir = GmailApp.search(POSTHOLF_LEIT, 0, POSTHOLF_HAMARK);
  const nytt = {};
  const senda = [];

  thraedir.forEach((th) => {
    const id = th.getId();
    const lykill = th.getLastMessageDate().getTime() + (th.isUnread() ? 'u' : 'l');
    nytt[id] = lykill;
    if (sidast[id] === lykill) return;

    /* Drög sem Gmail vistar meðan skrifað er eru ekki send skilaboð: sleppa þeim */
    const oll = th.getMessages().filter((m) => !m.isDraft());
    if (!oll.length) return;
    const skilabod = oll.slice(-POSTHOLF_SKILABOD).map((m) => {
      const fra = String(m.getFrom() || '');
      const netfang = netfangUr_(fra);
      let vidhengi = 0;
      try { vidhengi = m.getAttachments({ includeInlineImages: false }).length; } catch (e) { vidhengi = 0; }
      return {
        id: m.getId(),
        fra_nafn: nafnUr_(fra),
        fra_netfang: netfang,
        til: String(m.getTo() || '').slice(0, 2000),
        dags: m.getDate().toISOString(),
        texti: hreinsa_(m.getPlainBody()).slice(0, 20000),
        fra_okkur: /@tveir\.is$/.test(netfang),
        vidhengi: vidhengi
      };
    });
    /* Sá sem þráðurinn er við: síðasti sendandi sem er ekki við */
    const theirra = skilabod.filter((s) => !s.fra_okkur);
    const vidmaelandi = theirra.length ? theirra[theirra.length - 1] : skilabod[0];
    const seinast = skilabod[skilabod.length - 1];
    let tengill = null;
    try { tengill = th.getPermalink(); } catch (e) { tengill = null; }

    senda.push({
      id: id,
      efni: String(th.getFirstMessageSubject() || '(ekkert efni)').slice(0, 300),
      fra_nafn: vidmaelandi ? vidmaelandi.fra_nafn : null,
      fra_netfang: vidmaelandi ? vidmaelandi.fra_netfang : null,
      snid: seinast ? seinast.texti.replace(/\s+/g, ' ').trim().slice(0, 200) : '',
      sidast: th.getLastMessageDate().toISOString(),
      fjoldi: oll.length,
      olesid: th.isUnread(),
      tengill: tengill,
      skilabod: skilabod
    });
  });

  /* 20 þræðir í einu kalli. Takist kall ekki er reynt aftur eftir 5 mínútur. */
  const eydaFyrir = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
  let tokst = true;
  for (let i = 0; i < senda.length; i += 20) {
    const hluti = senda.slice(i, i + 20);
    const svar = kalla_('postholf_skra', { p_gogn: hluti, p_eyda_fyrir: i === 0 ? eydaFyrir : null });
    if (typeof svar !== 'number' || svar < 0) {
      tokst = false;
      hluti.forEach((t) => { delete nytt[t.id]; });
    }
  }
  if (!senda.length) kalla_('postholf_skra', { p_gogn: [], p_eyda_fyrir: eydaFyrir });
  eig.setProperty('postholf_sidast', JSON.stringify(nytt));
  return tokst;
}

/* Svör af vinnusvæðinu: svarað síðasta skilaboði frá viðmælandanum, svo
   svarið fari á hann en ekki á okkur sjálf */
function sendaPostholfSvor_() {
  const listi = kalla_('postholf_svor_til', {});
  if (!Array.isArray(listi) || !listi.length) return;
  const eig = PropertiesService.getScriptProperties();
  let sidast = {};
  try { sidast = JSON.parse(eig.getProperty('postholf_sidast') || '{}'); } catch (e) { sidast = {}; }

  listi.forEach((s) => {
    try {
      const valkostir = { name: 'Tveir' };
      if (s.html && String(s.html).length <= 60000) valkostir.htmlBody = String(s.html);
      /* Nýr póstur (enginn þráður): til og efni koma af vinnusvæðinu, athuguð í gagnagrunninum */
      if (!s.thradur_id) {
        GmailApp.sendEmail(String(s.til), String(s.efni).replace(/[\r\n]+/g, ' ').slice(0, 200), String(s.texti), valkostir);
        kalla_('merkja_postholf_svar', { p_id: s.id });
        return;
      }
      const th = GmailApp.getThreadById(s.thradur_id);
      if (!th) { kalla_('merkja_postholf_svar', { p_id: s.id, p_villa: 'Þráðurinn fannst ekki í Gmail' }); return; }
      const skilabod = th.getMessages().filter((m) => !m.isDraft());
      const theirra = skilabod.filter((m) => !/@tveir\.is$/.test(netfangUr_(m.getFrom())));
      const svaraTil = theirra.length ? theirra[theirra.length - 1] : skilabod[skilabod.length - 1];
      /* HTML útgáfan (texti og undirskrift með merki) var smíðuð á vinnusvæðinu */
      svaraTil.reply(String(s.texti), valkostir);
      kalla_('merkja_postholf_svar', { p_id: s.id });
      delete sidast[s.thradur_id];   /* næsta umferð sækir þráðinn aftur, með svarinu */
    } catch (villa) {
      kalla_('merkja_postholf_svar', { p_id: s.id, p_villa: String(villa && villa.message || villa).slice(0, 300) });
    }
  });
  eig.setProperty('postholf_sidast', JSON.stringify(sidast));
}

/* "Jón Jónsson <jon@breidablik.is>" -> Jón Jónsson */
function nafnUr_(fra) {
  const m = String(fra).match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim().slice(0, 200) : null;
}
