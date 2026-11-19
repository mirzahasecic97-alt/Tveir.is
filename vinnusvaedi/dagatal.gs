/* ==========================================================================
   Tveir: Google Calendar á vinnusvæðinu (Dagatal)
   Fjórða skráin í Apps Script verkefninu á tveir@tveir.is. Notar kalla_ úr
   verk-postur.gs.

   samstillaDagatal_  keyrir með lesaVerk á 5 mínútna fresti. Sendir fundina
                      í aðaldagatalinu, frá 14 dögum aftur til 90 daga fram.
   samstillaDagatal   sama, til að keyra einu sinni í ritlinum. Þá biður
                      Google um leyfi fyrir dagatalinu.
   ========================================================================== */

const DAGATAL_AFTUR = 14;
const DAGATAL_FRAM = 90;
const DAGATAL_HLEKKUR = /https:\/\/(meet\.google\.com|[a-z0-9.-]*zoom\.us|teams\.microsoft\.com|teams\.live\.com)\/[^\s"'<>)]+/i;

function samstillaDagatal() {
  return samstillaDagatal_();
}

function samstillaDagatal_() {
  const nu = Date.now();
  const fra = new Date(nu - DAGATAL_AFTUR * 864e5);
  const til = new Date(nu + DAGATAL_FRAM * 864e5);
  const dagatal = CalendarApp.getDefaultCalendar();
  const dagatalId = dagatal.getId();

  const atburdir = dagatal.getEvents(fra, til).slice(0, 1000).map((e) => {
    const allan = e.isAllDayEvent();
    const byrjar = allan ? e.getAllDayStartDate() : e.getStartTime();
    const endar = allan ? e.getAllDayEndDate() : e.getEndTime();
    const lysing = String(e.getDescription() || '');
    const stadur = String(e.getLocation() || '');
    const fundur = (lysing + ' ' + stadur).match(DAGATAL_HLEKKUR);
    /* Endurteknir fundir deila auðkenni, því fylgir upphafstíminn */
    const grunnId = String(e.getId()).replace(/@google\.com$/, '');
    let tengill = null;
    try {
      tengill = 'https://calendar.google.com/calendar/event?eid='
        + Utilities.base64EncodeWebSafe(grunnId + ' ' + dagatalId).replace(/=+$/, '');
    } catch (villa) { tengill = null; }
    let gestir = 0;
    try { gestir = e.getGuestList().length; } catch (villa) { gestir = 0; }
    return {
      id: (grunnId + '|' + byrjar.getTime()).slice(0, 300),
      titill: String(e.getTitle() || '(enginn titill)').slice(0, 300),
      lysing: lysing.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) || null,
      stadur: stadur.slice(0, 300) || null,
      byrjar: byrjar.toISOString(),
      endar: endar.toISOString(),
      allan_daginn: allan,
      tengill: tengill,
      fundarhlekkur: fundur ? fundur[0].slice(0, 1000) : null,
      gestir: gestir
    };
  });

  const svar = kalla_('dagatal_skra', { p_gogn: atburdir, p_fra: fra.toISOString(), p_til: til.toISOString() });
  console.log('Dagatal: ' + atburdir.length + ' fundir, svar ' + svar);
  return svar;
}
