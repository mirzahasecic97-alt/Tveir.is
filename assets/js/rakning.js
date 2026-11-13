/* ==========================================================================
   Tveir — rakning
   Man hvaðan gesturinn kom (auglýsing, Google, Instagram...) og hvar hann
   lenti fyrst. Þegar hann sendir form fer þetta með: í póstinn frá
   Formspree og inn í Fyrirspurnir á vinnusvæðinu.

   Engar vafrakökur og ekkert sent út fyrr en formið er sent. Bara ein
   færsla í localStorage á þessu léni.
   ========================================================================== */
(function () {
  'use strict';

  var LYKILL = 'tveir-uppruni';
  var LIFTIMI = 90 * 86400000;

  function lesa() {
    try { return JSON.parse(localStorage.getItem(LYKILL) || 'null'); } catch (e) { return null; }
  }
  function vista(g) {
    try { localStorage.setItem(LYKILL, JSON.stringify(g)); } catch (e) { /* lokað */ }
  }

  function flokka(p, tilvisun) {
    var src = (p.get('utm_source') || '').toLowerCase();
    var med = (p.get('utm_medium') || '').toLowerCase();
    if (p.get('gclid') || p.get('gbraid') || p.get('wbraid')) return 'google_ads';
    if (src) {
      if (/^(ig|instagram)/.test(src)) return 'instagram';
      if (/^(fb|facebook|meta)/.test(src)) return 'facebook';
      if (/google/.test(src)) return med === 'cpc' || med === 'paid' ? 'google_ads' : 'google';
      if (/linkedin/.test(src)) return 'linkedin';
      if (/tiktok/.test(src)) return 'tiktok';
      if (/mail|newsletter|postur/.test(src) || med === 'email') return 'postur';
      return 'annad';
    }
    if (p.get('fbclid')) return /instagram/.test(tilvisun) ? 'instagram' : 'facebook';
    if (!tilvisun) return 'beint';
    if (/instagram\./.test(tilvisun)) return 'instagram';
    if (/facebook\.|fb\.me|messenger\./.test(tilvisun)) return 'facebook';
    if (/google\./.test(tilvisun)) return 'google';
    if (/linkedin\.|lnkd\.in/.test(tilvisun)) return 'linkedin';
    if (/tiktok\./.test(tilvisun)) return 'tiktok';
    if (/mail\.|outlook\./.test(tilvisun)) return 'postur';
    return 'annad';
  }

  /* ------------------------------------------------------------------
     Skrá heimsóknina
     ------------------------------------------------------------------ */
  var p = new URLSearchParams(location.search);
  var tilvisun = '';
  try {
    var r = document.referrer ? new URL(document.referrer) : null;
    if (r && r.hostname !== location.hostname && !/(^|\.)tveir\.is$/.test(r.hostname)) tilvisun = r.hostname;
  } catch (e) { /* ógild slóð */ }

  var nyHeimsokn = !!(tilvisun || p.get('utm_source') || p.get('gclid') || p.get('fbclid'));
  var nu = Date.now();
  var g = lesa();

  if (!g || !g.fyrst || nu - g.fyrst.t > LIFTIMI) {
    g = { fyrst: null, sidast: null };
  }

  var heimsokn = {
    t: nu,
    uppruni: flokka(p, tilvisun),
    utm_source: p.get('utm_source') || null,
    utm_medium: p.get('utm_medium') || null,
    utm_campaign: p.get('utm_campaign') || null,
    tilvisun: tilvisun || null,
    lendingarsida: location.pathname
  };

  if (!g.fyrst) { g.fyrst = heimsokn; g.sidast = heimsokn; vista(g); }
  else if (nyHeimsokn) { g.sidast = heimsokn; vista(g); }

  /* ------------------------------------------------------------------
     Senda fyrirspurnina inn á vinnusvæðið
     Stillingarnar eru sóttar úr sömu skrá og vinnusvæðið notar, svo
     lyklarnir eru bara á einum stað. Í prufustillingu gerist ekkert.
     ------------------------------------------------------------------ */
  var REITIR = {
    nafn: 'nafn', netfang: 'netfang', simi: 'simi', fyrirtaeki: 'fyrirtaeki_nafn',
    skilabod: 'skilabod', thjonusta: 'thjonusta'
  };
  var SLEPPA = { _gotcha: 1, _subject: 1, uppruni: 1 };

  function skra(gogn, formHeiti) {
    var lina = {
      form: formHeiti || document.title.split('|')[0].trim(),
      uppruni: g.fyrst.uppruni,
      sidasti_uppruni: g.sidast ? g.sidast.uppruni : null,
      utm_source: g.fyrst.utm_source || (g.sidast && g.sidast.utm_source) || null,
      utm_medium: g.fyrst.utm_medium || (g.sidast && g.sidast.utm_medium) || null,
      utm_campaign: g.fyrst.utm_campaign || (g.sidast && g.sidast.utm_campaign) || null,
      tilvisun: g.fyrst.tilvisun,
      lendingarsida: g.fyrst.lendingarsida,
      fyrsta_heimsokn: new Date(g.fyrst.t).toISOString()
    };
    var auka = {};
    gogn.forEach(function (gildi, nafn) {
      if (SLEPPA[nafn] || typeof gildi !== 'string' || !gildi.trim()) return;
      var v = gildi.trim().slice(0, 2000);
      if (REITIR[nafn]) lina[REITIR[nafn]] = v;
      else auka[nafn] = v;
    });
    /* Herferðarformið spyr um "samband": netfang eða síma */
    if (auka.samband) {
      if (auka.samband.indexOf('@') > 0) lina.netfang = auka.samband; else lina.simi = auka.samband;
      delete auka.samband;
    }
    if (Object.keys(auka).length) lina.gogn = auka;

    return import('/vinnusvaedi/assets/stillingar.js').then(function (m) {
      var s = m.stillingar;
      if (!s || s.prufa || !s.supabaseUrl || !s.supabaseAnonKey) return;
      return fetch(s.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/fyrirspurnir', {
        method: 'POST',
        headers: {
          apikey: s.supabaseAnonKey,
          Authorization: 'Bearer ' + s.supabaseAnonKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(lina),
        keepalive: true
      });
    }).catch(function () { /* Formspree pósturinn fer samt, ekkert tapast */ });
  }

  /* Ein lína í póstinn frá Formspree, svo uppruninn sjáist þar líka */
  function lysing() {
    var heiti = {
      facebook: 'Facebook', instagram: 'Instagram', google_ads: 'Google auglýsing',
      google: 'Google leit', linkedin: 'LinkedIn', tiktok: 'TikTok', postur: 'Tölvupóstur',
      beint: 'Beint', annad: 'Annar vefur'
    };
    var f = g.fyrst;
    var hlutar = [heiti[f.uppruni] || f.uppruni];
    if (f.utm_campaign) hlutar.push('herferð ' + f.utm_campaign);
    if (f.tilvisun) hlutar.push('af ' + f.tilvisun);
    hlutar.push('lenti á ' + f.lendingarsida);
    return hlutar.join(', ');
  }

  window.tveirRakning = { skra: skra, lysing: lysing };
})();
