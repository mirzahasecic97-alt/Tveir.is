/* ==========================================================================
   Tveir: Google Calendar á vinnusvæðinu (Dagatal)
   Fjórða skráin í Apps Script verkefninu á tveir@tveir.is. Notar kalla_ úr
   verk-postur.gs.

   samstillaDagatal_  keyrir með lesaVerk á 5 mínútna fresti. Sendir fundina
                      í öllum dagatölum sem tveir@tveir.is sér (eigin og deild,
                      ekki frídagar né afmæli), frá 14 dögum aftur til 90 fram.
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
  /* Öll dagatöl sem sjást, nema frídagar, afmæli og falin */
  const dagatol = CalendarApp.getAllCalendars().filter((c) => {
    const id = String(c.getId());
    return !c.isHidden() && !/#holiday@|#contacts@|addressbook#|#weeknum@/.test(id);
  });
  const sed = new Set();
  const allir = [];
  dagatol.forEach((c) => {
    c.getEvents(fra, til).forEach((e) => {
      const k = e.getId() + '|' + e.getStartTime().getTime();
      if (sed.has(k)) return;
      sed.add(k);
      allir.push({ e: e, dagatalId: c.getId() });
    });
  });

  const atburdir = allir.slice(0, 1000).map(({ e, dagatalId }) => {
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
  console.log('Dagatal: ' + dagatol.length + ' dagatöl, ' + atburdir.length + ' fundir, svar ' + svar);
  return svar;
}
