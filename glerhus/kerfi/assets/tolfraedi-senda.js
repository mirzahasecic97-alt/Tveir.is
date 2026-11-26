/* ==========================================================================
   Tölfræði send á viðskiptavin beint úr kerfinu.
   Hnappurinn er efst í horninu á Tölfræði hvers fyrirtækis. Stjórnandi velur
   viðtakendur, getur bætt við persónulegum orðum og sér póstinn nákvæmlega
   eins og hann fer. Pósturinn fer í töfluna tolfraedi_sendingar og Apps
   Script sendir hann: tolfraedi.gs frá tveir@tveir.is fyrir Tveir, vélin
   Glerhúsið verk í nafni stofunnar fyrir aðrar stofur.
   Útlitið er það sama og í mánaðarskýrslunni (skyrsluHtml_ í tolfraedi.gs),
   með merki, nafni og vef stofunnar.
   ========================================================================== */
import { el, fylla, stillingar } from './portal.js';

/* Tveir heldur sínu merki og slóð. Aðrar stofur: þeirra merki, annars
   nafnið þeirra í texta, og tengill á tölfræðina í kerfinu. */
const TVEIR = { nafn: 'Tveir', merki: 'https://tveir.is/assets/img/tveir-logo-3d.png', merkiAlt: 'TVEIR',
                vefur: 'https://tveir.is', tolfraedi: 'https://tveir.is/vinnusvaedi/tolfraedi.html' };
/* Slóð kerfisins úr stillingum (a-tveir.sh setur https://tveir.is/glerhus/kerfi/).
   Í sýnidæminu er hún tóm: þá vísar pósturinn á kerfið sem hann var skrifaður í. */
const KERFI = (() => {
  const s = String(stillingar.slod || '');
  if (/^https:\/\/[^\s"'<>]+$/.test(s)) return s.replace(/\/?$/, '/');
  try { if (location.protocol === 'https:') return new URL('./', location.href).href; } catch (e) { /* engin slóð */ }
  return 'https://tveir.is/glerhus/kerfi/';
})();
const MIDLAR_HEITI = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
const TEGUNDIR = { mynd: 'Mynd', myndband: 'Myndband', reel: 'Reel', karusell: 'Hringekja', saga: 'Saga', annad: 'Færsla' };
const MAN = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];

const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const oruggSlod = (s) => { s = String(s || '').trim(); return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : null; };
const erTala = (n) => n !== null && n !== undefined && n !== '' && isFinite(Number(n));
const tala = (n) => {
  if (!erTala(n)) return '';
  const t = Math.round(Math.abs(Number(n))).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (Number(n) < 0 ? '-' : '') + t;
};
const dagsTexti = (d) => { const x = new Date(String(d).slice(0, 10) + 'T12:00:00Z'); return x.getUTCDate() + '. ' + MAN[x.getUTCMonth()]; };

/* Útlit og nafn stofunnar í póstinum. Gagnagrunnur án stofa er Tveir. */
export function stofuSnid(stofa) {
  if (!stofa || stofa.slug === 'tveir') return { ...TVEIR, erTveir: true };
  const nafn = String(stofa.nafn || '').trim() || 'Glerhúsið';
  const vefur = oruggSlod(stofa.vefur);
  return {
    nafn, erTveir: false,
    merki: oruggSlod(stofa.merki_url),
    merkiAlt: nafn,
    vefur: vefur || KERFI,
    vefurTexti: vefur ? vefur.replace(/^https:\/\//, '').replace(/\/$/, '') : '',
    tolfraedi: KERFI + 'tolfraedi.html'
  };
}

/* ------------------------------------------------------------------
   Tölurnar úr gögnunum sem síðan er þegar með
   ------------------------------------------------------------------ */
export function reiknaTolur({ midlar, maelingar, tb, faerslur }) {
  const iBili = (r, fra, til) => { const d = String(r.dags).slice(0, 10); return d >= fra && d <= til; };
  const summa = (radir, svid, fra, til) => {
    let s = 0, n = 0;
    for (const r of radir) if (iBili(r, fra, til) && erTala(r[svid])) { s += Number(r[svid]); n++; }
    return n ? s : null;
  };
  const plus = (a, b) => (a === null ? b : b === null ? a : a + b);
  const ut = { midlar: [], samtals: { ahorf: null, ahorf_fyrri: null, nadir: null, nadir_fyrri: null, samskipti: null, samskipti_fyrri: null, fylgjendur_lok: null, fylgjendur_breyting: null, faerslur: null } };
  for (const m of midlar) {
    const radir = maelingar.filter((r) => r.midill_id === m.id);
    const fylg = radir.filter((r) => erTala(r.fylgjendur));
    const iTb = fylg.filter((r) => iBili(r, tb.fra, tb.til));
    const fyrir = fylg.filter((r) => String(r.dags).slice(0, 10) < tb.fra);
    const lok = iTb.length ? Number(iTb[iTb.length - 1].fylgjendur) : null;
    const upphaf = iTb.length ? Number(fyrir.length ? fyrir[fyrir.length - 1].fylgjendur : iTb[0].fylgjendur) : null;
    const hans = (faerslur || []).filter((p) => p.midill_id === m.id);
    const x = {
      midill: m.midill, nafn: m.nafn,
      ahorf: summa(radir, 'ahorf', tb.fra, tb.til), ahorf_fyrri: summa(radir, 'ahorf', tb.fyrriFra, tb.fyrriTil),
      nadir: summa(radir, 'nadir', tb.fra, tb.til), nadir_fyrri: summa(radir, 'nadir', tb.fyrriFra, tb.fyrriTil),
      samskipti: summa(radir, 'samskipti', tb.fra, tb.til), samskipti_fyrri: summa(radir, 'samskipti', tb.fyrriFra, tb.fyrriTil),
      fylgjendur_lok: lok, fylgjendur_breyting: lok !== null && upphaf !== null ? lok - upphaf : null,
      faerslur: summa(radir, 'faerslur', tb.fra, tb.til) ?? (hans.length || null),
      bestu_faerslur: hans.slice().sort((a, b) => (Number(b.ahorf) || 0) - (Number(a.ahorf) || 0)).slice(0, 3)
    };
    ut.midlar.push(x);
    for (const k of Object.keys(ut.samtals)) ut.samtals[k] = plus(ut.samtals[k], erTala(x[k]) ? Number(x[k]) : null);
  }
  return ut;
}

/* Breyting í prósentum, eða null ef ekki er hægt að bera saman */
function hlutfall(nu, fyrr) {
  if (!erTala(nu) || !erTala(fyrr) || Number(fyrr) <= 0) return null;
  return Math.round((Number(nu) - Number(fyrr)) / Number(fyrr) * 100);
}
function breyting(nu, fyrr, fyrriHeiti) {
  const p = hlutfall(nu, fyrr);
  if (p === null) return null;
  if (p === 0) return { texti: 'Svipað og ' + fyrriHeiti, upp: null };
  return { texti: Math.abs(p) + '% ' + (p > 0 ? 'meira' : 'minna') + ' en ' + fyrriHeiti, upp: p > 0 };
}

/* Myndband eða færsla sem fer í póstinn: titill og að minnsta kosti ein tala.
   Mánaðarsendingin sendir bara myndbönd með áhorfum, svo hún breytist ekki. */
const mbMed = (m) => !!(m && String(m.titill || '').trim()
  && (erTala(m.ahorf) || erTala(m.likes) || erTala(m.athugasemdir) || erTala(m.deilingar)));

/* Breyting sem stóð á skjáskoti, í prósentum */
function breytingUrPr(p, fyrriHeiti) {
  const r = Math.round(p);
  if (r === 0) return { texti: 'Svipað og ' + fyrriHeiti, upp: null };
  return { texti: Math.abs(r) + '% ' + (r > 0 ? 'meira' : 'minna') + ' en ' + fyrriHeiti, upp: r > 0 };
}

/* Ein eða tvær setningar sem segja bara það sem tölurnar segja */
export function sjalfgefinOrd(tolur, fyrriHeiti) {
  const t = tolur.samtals, s = [];
  const a = hlutfall(t.ahorf, t.ahorf_fyrri);
  if (a !== null && a !== 0) s.push('Áhorfin voru ' + Math.abs(a) + '% ' + (a > 0 ? 'meiri' : 'minni') + ' en ' + fyrriHeiti + '.');
  else if (erTala(t.ahorf)) s.push('Færslurnar fengu ' + tala(t.ahorf) + ' áhorf á tímabilinu.');
  if (erTala(t.fylgjendur_breyting) && Number(t.fylgjendur_breyting) > 0) s.push('Fylgjendum fjölgaði um ' + tala(t.fylgjendur_breyting) + '.');
  return s.join(' ');
}

/* ------------------------------------------------------------------
   Pósturinn í Tveir útliti. Töflur og stílar í línu fyrir Gmail og Outlook.
   ------------------------------------------------------------------ */
/* Aukalega fyrir póst úr skjáskoti (tolfraedi-skjaskot.js):
   inngangsTexti kemur í stað "Hér eru tölurnar ...", breytingarPr eru
   prósentur sem stóðu á skjáskotinu, aukatolur bætast við í töflu og
   myndbondTitill er fyrirsögnin yfir myndböndunum eða færslunum. */
export function postHtml({ fyrirtaeki, nofn, merkiTexti, inngangur, fyrriHeiti, tolur, ord, myndbond, snid, inngangsTexti, breytingarPr, aukatolur, myndbondTitill, samanburdur }) {
  const st = snid || stofuSnid(null);
  const L = "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;";
  const H = "font-family:'Inter Tight',Inter,-apple-system,'Segoe UI',Arial,sans-serif;letter-spacing:-.02em;";
  const t = tolur.samtals;
  const takki = (texti, slod, adal) => {
    const bg = adal ? '#5b93f0' : '#e7f0fd', lit = adal ? '#ffffff' : '#2c62c4';
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td bgcolor="' + bg + '" style="background:' + bg + ';border-radius:999px;">'
      + '<a href="' + esc(slod) + '" target="_blank" style="display:inline-block;padding:' + (adal ? '15px 28px' : '9px 16px') + ';' + L + 'font-size:' + (adal ? '16px' : '14px') + ';font-weight:600;color:' + lit + ';text-decoration:none;border-radius:999px;">' + esc(texti) + '</a></td></tr></table>';
  };
  const merki = (b) => {
    if (!b) return '';
    const bg = b.upp === true ? '#e6f4ea' : b.upp === false ? '#fdecec' : '#eef2f7';
    const lit = b.upp === true ? '#1e6b34' : b.upp === false ? '#b42318' : '#4a5f80';
    const or = b.upp === true ? '&#9650;&nbsp;' : b.upp === false ? '&#9660;&nbsp;' : '';
    return '<div style="padding-top:8px;"><span style="display:inline-block;background:' + bg + ';color:' + lit + ';border-radius:999px;padding:4px 10px;' + L + 'font-size:12px;font-weight:600;line-height:1.4;">' + or + esc(b.texti) + '</span></div>';
  };
  const reitur = (heiti, gildi, b) => '<td width="50%" valign="top" style="padding:6px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#f2f8fe;border-radius:14px;"><tr><td style="padding:16px;">'
    + '<div style="' + L + 'font-size:13px;line-height:1.4;color:#4a5f80;">' + esc(heiti) + '</div>'
    + (gildi ? '<div style="' + H + 'font-size:26px;line-height:1.2;font-weight:700;color:#1c3050;padding-top:4px;">' + esc(gildi) + '</div>'
             : '<div style="' + L + 'font-size:15px;line-height:1.4;color:#7189ac;padding-top:8px;">Engin gögn</div>')
    + merki(b) + '</td></tr></table></td>';
  let fb = null;
  if (erTala(t.fylgjendur_breyting)) {
    const b = Number(t.fylgjendur_breyting);
    fb = b === 0 ? { texti: 'Óbreytt á tímabilinu', upp: null } : { texti: tala(Math.abs(b)) + (b > 0 ? ' fleiri' : ' færri') + ' á tímabilinu', upp: b > 0 };
  }
  const bPr = breytingarPr || {};
  const b2 = (k) => (erTala(t[k]) && erTala(bPr[k]) ? breytingUrPr(Number(bPr[k]), fyrriHeiti) : breyting(t[k], t[k + '_fyrri'], fyrriHeiti));
  const reitir = '<tr>' + reitur('Áhorf', tala(t.ahorf), b2('ahorf'))
    + reitur('Náð', tala(t.nadir), b2('nadir')) + '</tr><tr>'
    + reitur('Samskipti', tala(t.samskipti), b2('samskipti'))
    + reitur('Fylgjendur', tala(t.fylgjendur_lok), fb) + '</tr>';

  const sula = (gildi, haest, litur) => {
    const v = erTala(gildi) ? Number(gildi) : 0;
    const w = haest > 0 && v > 0 ? Math.max(2, Math.min(100, Math.round(v / haest * 100))) : 0;
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>'
      + (w > 0 ? '<td width="' + w + '%" height="12" bgcolor="' + litur + '" style="background:' + litur + ';border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>' : '')
      + (w < 100 ? '<td height="12" style="font-size:0;line-height:0;">&nbsp;</td>' : '') + '</tr></table>';
  };
  const sulurLina = (heiti, nu, fyrr) => {
    if (!erTala(nu) && !erTala(fyrr)) return '';
    const haest = Math.max(Number(nu) || 0, Number(fyrr) || 0);
    return '<tr><td style="padding:0 0 16px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      + '<td style="' + L + 'font-size:14px;font-weight:600;color:#1c3050;padding-bottom:6px;">' + esc(heiti) + '</td>'
      + '<td align="right" style="' + L + 'font-size:13px;color:#4a5f80;padding-bottom:6px;">' + esc(tala(nu) || 'Engin gögn') + ' <span style="color:#7189ac;">/ ' + esc(tala(fyrr) || 'engin gögn') + '</span></td>'
      + '</tr></table>' + sula(nu, haest, '#5b93f0') + '<div style="height:4px;line-height:4px;font-size:0;">&nbsp;</div>' + sula(fyrr, haest, '#c9dcf8') + '</td></tr>';
  };
  /* Skjáskot hafa engar tölur fyrra tímabils, þá sleppur samanburðurinn */
  const sulur = samanburdur === false ? '' : sulurLina('Áhorf', t.ahorf, t.ahorf_fyrri) + sulurLina('Náð', t.nadir, t.nadir_fyrri) + sulurLina('Samskipti', t.samskipti, t.samskipti_fyrri);
  const kafli = (texti) => '<tr><td style="padding:22px 0 10px 0;' + H + 'font-size:20px;font-weight:700;color:#1c3050;">' + esc(texti) + '</td></tr>';
  const sulurit = sulur ? kafli('Miðað við ' + fyrriHeiti)
    + '<tr><td style="padding:0 0 14px 0;' + L + 'font-size:13px;color:#4a5f80;"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#5b93f0;"></span>&nbsp;Þetta tímabil&nbsp;&nbsp;&nbsp;<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#c9dcf8;"></span>&nbsp;Tímabilið á undan</td></tr>' + sulur : '';
  const hs = L + 'font-size:12px;color:#7189ac;font-weight:600;padding:0 8px 6px 8px;';
  const ms = L + 'font-size:14px;color:#1c3050;padding:10px 8px;border-top:1px solid #e3ecf8;';
  const midlar = tolur.midlar.length > 1 ? kafli('Eftir miðlum') + '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + '<tr><td style="' + hs + 'padding-left:0;">Miðill</td><td align="right" style="' + hs + '">Fylgjendur</td><td align="right" style="' + hs + '">Áhorf</td><td align="right" style="' + hs + 'padding-right:0;">Færslur</td></tr>'
    + tolur.midlar.map((x) => '<tr><td style="' + ms + 'font-weight:600;padding-left:0;">' + esc(MIDLAR_HEITI[x.midill] || x.nafn || '') + '</td><td align="right" style="' + ms + '">' + esc(tala(x.fylgjendur_lok) || '-') + '</td><td align="right" style="' + ms + '">' + esc(tala(x.ahorf) || '-') + '</td><td align="right" style="' + ms + 'padding-right:0;">' + esc(tala(x.faerslur) || '-') + '</td></tr>').join('')
    + '</table></td></tr>' : '';
  const bestu = [];
  tolur.midlar.forEach((m) => (m.bestu_faerslur || []).forEach((p) => bestu.push({ ...p, midill: m.midill })));
  const faerslur = bestu.sort((a, b) => (Number(b.ahorf) || 0) - (Number(a.ahorf) || 0)).slice(0, 3).map((p) => {
    const mynd = oruggSlod(p.mynd_slod), slod = oruggSlod(p.slod);
    const lysing = [MIDLAR_HEITI[p.midill] || '', TEGUNDIR[p.tegund] || '', p.birt ? dagsTexti(p.birt) : ''].filter(Boolean).join(' · ');
    const tt = [erTala(p.ahorf) ? tala(p.ahorf) + ' áhorf' : '', erTala(p.nadir) ? tala(p.nadir) + ' náð' : '', erTala(p.likes) ? tala(p.likes) + ' líkar' : '', erTala(p.athugasemdir) ? tala(p.athugasemdir) + ' athugasemdir' : ''].filter(Boolean).join(' · ');
    const texti = String(p.texti || '').trim();
    return '<tr><td style="padding:0 0 12px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#f2f8fe;border-radius:14px;"><tr>'
      + (mynd ? '<td width="80" valign="top" style="padding:14px 0 14px 14px;"><img src="' + esc(mynd) + '" width="66" height="66" alt="" style="display:block;width:66px;height:66px;object-fit:cover;border:0;border-radius:10px;background:#dfe9f7;"></td>' : '')
      + '<td valign="top" style="padding:14px 14px 14px ' + (mynd ? '12' : '16') + 'px;">'
      + '<div style="' + L + 'font-size:12.5px;line-height:1.4;color:#7189ac;font-weight:600;">' + esc(lysing) + '</div>'
      + (texti ? '<div style="' + L + 'font-size:14.5px;line-height:1.45;color:#1c3050;padding-top:4px;word-break:break-word;">' + esc(texti.length > 140 ? texti.slice(0, 139) + '…' : texti) + '</div>' : '')
      + (tt ? '<div style="' + L + 'font-size:13px;line-height:1.5;color:#4a5f80;padding-top:6px;">' + esc(tt) + '</div>' : '')
      + (slod ? '<div style="padding-top:10px;">' + takki('Skoða færsluna', slod, false) + '</div>' : '')
      + '</td></tr></table></td></tr>';
  }).join('');
  /* Myndböndin sem við gerðum: áhorf hvers og eins á tímabilinu */
  const mbListi = (myndbond || []).filter(mbMed);
  const mbHaest = Math.max(1, ...mbListi.map((m) => Number(m.ahorf) || 0));
  const myndbondPosts = mbListi.length ? kafli(myndbondTitill || 'Myndböndin') + mbListi.map((m) => {
    const slod = oruggSlod(m.slod);
    const lysing = [MIDLAR_HEITI[m.midill] || (m.midill === 'youtube' ? 'YouTube' : ''), m.birt ? 'birt ' + dagsTexti(m.birt) : ''].filter(Boolean).join(' · ');
    const aukatolur = [erTala(m.likes) ? tala(m.likes) + ' líkar' : '', erTala(m.athugasemdir) ? tala(m.athugasemdir) + ' athugasemdir' : '',
      erTala(m.deilingar) ? tala(m.deilingar) + ' deilingar' : '', erTala(m.heild) && Number(m.heild) !== Number(m.ahorf) ? tala(m.heild) + ' áhorf alls' : ''].filter(Boolean).join(' · ');
    return '<tr><td style="padding:0 0 12px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#f2f8fe;border-radius:14px;"><tr><td style="padding:14px 16px;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      + '<td valign="top" style="' + L + 'font-size:15px;line-height:1.4;font-weight:600;color:#1c3050;word-break:break-word;">' + esc(m.titill) + '</td>'
      + '<td align="right" valign="top" style="' + H + 'font-size:18px;line-height:1.3;font-weight:700;color:#1c3050;white-space:nowrap;padding-left:10px;">' + esc(tala(m.ahorf)) + '</td>'
      + '</tr><tr><td style="' + L + 'font-size:12.5px;line-height:1.4;color:#7189ac;padding-top:2px;">' + esc(lysing) + '</td>'
      + '<td align="right" style="' + L + 'font-size:12.5px;color:#7189ac;padding-top:2px;white-space:nowrap;">' + (erTala(m.ahorf) ? 'áhorf' : '') + '</td></tr></table>'
      + (erTala(m.ahorf) ? '<div style="padding-top:10px;">' + sula(m.ahorf, mbHaest, '#5b93f0') + '</div>' : '')
      + (aukatolur ? '<div style="' + L + 'font-size:13px;line-height:1.5;color:#4a5f80;padding-top:8px;">' + esc(aukatolur) + '</div>' : '')
      + (slod ? '<div style="padding-top:10px;">' + takki('Horfa á myndbandið', slod, false) + '</div>' : '')
      + '</td></tr></table></td></tr>';
  }).join('') : '';
  const aukaListi = (aukatolur || []).filter((x) => x && x.heiti && erTala(x.gildi));
  const aukaTafla = aukaListi.length ? kafli('Fleiri tölur') + '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + aukaListi.map((x, i) => '<tr><td style="' + ms + 'padding-left:0;' + (i ? '' : 'border-top:0;') + '">' + esc(x.heiti) + '</td>'
      + '<td align="right" style="' + ms + 'font-weight:600;padding-right:0;' + (i ? '' : 'border-top:0;') + '">' + esc(tala(x.gildi)) + '</td></tr>').join('')
    + '</table></td></tr>' : '';
  const nofnin = (nofn || []).map((x) => String(x || '').trim().split(' ')[0]).filter(Boolean);
  const kvedja = !nofnin.length || nofnin.length > 3 ? 'Hæ,' : nofnin.length === 1 ? 'Hæ ' + nofnin[0] + ',' : 'Hæ ' + nofnin.slice(0, -1).join(', ') + ' og ' + nofnin[nofnin.length - 1] + ',';
  const ordin = ord ? '<tr><td style="padding:16px 0 4px 0;' + L + 'font-size:16px;line-height:1.6;color:#1c3050;word-break:break-word;">' + esc(ord).replace(/\r?\n/g, '<br>') + '</td></tr>' : '';

  return '<!doctype html><html lang="is"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>' + esc('Tölfræði ' + fyrirtaeki) + '</title></head>'
    + '<body style="margin:0;padding:0;background:#f2f8fe;">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc(inngangsTexti || ('Tölurnar ykkar ' + inngangur)) + '</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f8fe" style="background:#f2f8fe;"><tr><td align="center" style="padding:32px 12px;">'
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">'
    + '<tr><td align="center" style="padding:0 0 22px 0;"><a href="' + esc(st.vefur) + '" target="_blank" style="text-decoration:none;">'
    + (st.merki
      ? '<img src="' + esc(st.merki) + '" width="132" alt="' + esc(st.merkiAlt) + '" style="display:block;width:132px;height:auto;border:0;' + L + 'font-size:24px;font-weight:800;color:#5b93f0;">'
      : '<span style="' + H + 'font-size:24px;font-weight:700;color:#1c3050;">' + esc(st.nafn) + '</span>')
    + '</a></td></tr>'
    + '<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:20px;padding:30px 22px;box-shadow:0 12px 30px rgba(28,48,80,.10);">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + '<tr><td style="padding:0 6px 14px 6px;"><span style="display:inline-block;background:#e7f0fd;color:#2c62c4;border-radius:999px;padding:6px 12px;' + L + 'font-size:12.5px;font-weight:600;">' + esc(merkiTexti) + '</span></td></tr>'
    + '<tr><td style="padding:0 6px 8px 6px;' + H + 'font-size:30px;line-height:1.15;font-weight:700;color:#1c3050;word-break:break-word;">' + esc(fyrirtaeki) + '</td></tr>'
    + '<tr><td style="padding:0 6px 14px 6px;' + L + 'font-size:16px;line-height:1.55;color:#4a5f80;word-break:break-word;">' + esc(kvedja) + '<br>' + esc(inngangsTexti || ('Hér eru tölurnar af samfélagsmiðlunum ykkar ' + inngangur + '.')) + '</td></tr>'
    + '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + reitir + '</table></td></tr>'
    + '<tr><td style="padding:0 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + ordin + sulurit + myndbondPosts + midlar + aukaTafla + (faerslur ? kafli('Bestu færslurnar') + faerslur : '')
    + '<tr><td align="center" style="padding:24px 0 6px 0;">' + takki('Sjá alla tölfræðina', st.tolfraedi, true) + '</td></tr>'
    + '</table></td></tr></table></td></tr>'
    + '<tr><td align="center" style="padding:22px 12px 0 12px;' + L + 'font-size:13px;line-height:1.6;color:#7189ac;">Kveðja, ' + esc(st.nafn)
    + (st.erTveir ? '<br><a href="https://tveir.is" target="_blank" style="color:#5b93f0;text-decoration:none;">tveir.is</a>'
      : st.vefurTexti ? '<br><a href="' + esc(st.vefur) + '" target="_blank" style="color:#5b93f0;text-decoration:none;">' + esc(st.vefurTexti) + '</a>' : '')
    + '</td></tr>'
    + '</table></td></tr></table></body></html>';
}

export function postTexti({ fyrirtaeki, nofn, inngangur, fyrriHeiti, tolur, ord, myndbond, snid, inngangsTexti, breytingarPr, aukatolur, myndbondTitill }) {
  const st = snid || stofuSnid(null);
  const t = tolur.samtals;
  const bPr = breytingarPr || {};
  const lina = (h, k) => {
    const b = erTala(t[k]) && erTala(bPr[k]) ? breytingUrPr(Number(bPr[k]), fyrriHeiti) : breyting(t[k], t[k + '_fyrri'], fyrriHeiti);
    return h + ': ' + (tala(t[k]) || 'engin gögn') + (b ? ' (' + b.texti + ')' : '');
  };
  const n = (nofn || []).filter(Boolean);
  const mb = (myndbond || []).filter(mbMed);
  return [n.length === 1 ? 'Hæ ' + n[0] + ',' : 'Hæ,', '', inngangsTexti || ('Tölfræði ' + fyrirtaeki + ' ' + inngangur + ':'), '',
    lina('Áhorf', 'ahorf'), lina('Náð', 'nadir'), lina('Samskipti', 'samskipti'),
    'Fylgjendur: ' + (tala(t.fylgjendur_lok) || 'engin gögn'),
    ...((aukatolur || []).filter((x) => x && x.heiti && erTala(x.gildi)).map((x) => x.heiti + ': ' + tala(x.gildi))),
    ...(mb.length ? ['', (myndbondTitill || 'Myndböndin') + ':'].concat(mb.map((m) => '• ' + m.titill + (erTala(m.ahorf) ? ': ' + tala(m.ahorf) + ' áhorf' : ''))) : []),
    ord ? '\n' + ord : '', '', 'Sjá alla tölfræðina: ' + st.tolfraedi, '', 'Kveðja,', st.nafn].join('\n');
}

/* ------------------------------------------------------------------
   Önnur netföng: hvaða netfang sem er má skrifa inn (líka fleiri í einu,
   aðskilin með kommu eða bili). Þau bætast í valdir. Skilar { reitur,
   baetaInnslaetti }: baetaInnslaetti() bætir við því sem stendur enn í
   reitnum og skilar false ef það er ekki gilt netfang.
   ------------------------------------------------------------------ */
const NETFANG = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']+$/;
export function netfangaReitur(valdir, uppfaera, hamark = 10) {
  const aukalega = [];
  const inn = el('input', { type: 'email', class: 'ts-ord ts-netfang', placeholder: 'netfang@daemi.is', autocomplete: 'off',
    'aria-label': 'Bæta við netfangi', maxlength: '500' });
  const villa = el('p', { class: 'ts-villa', role: 'alert', hidden: true });
  const listi = el('ul', { class: 'ts-vidtakendur ts-aukanetfong' });
  const teikna = () => fylla(listi, aukalega.map((n) => el('li', {}, [
    el('div', { class: 'ts-aukanetfang' }, [
      el('span', { texti: n }),
      el('button', { type: 'button', class: 'loka', 'aria-label': 'Taka ' + n + ' út', texti: '✕', onclick: () => {
        aukalega.splice(aukalega.indexOf(n), 1); valdir.delete(n); teikna(); uppfaera();
      } })
    ])
  ])));
  const baetaInnslaetti = () => {
    villa.hidden = true;
    const hlutar = inn.value.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!hlutar.length) return true;
    const ogild = hlutar.filter((x) => !NETFANG.test(x) || x.length > 254);
    if (ogild.length) {
      villa.textContent = ogild.join(', ') + (ogild.length === 1 ? ' er ekki gilt netfang.' : ' eru ekki gild netföng.');
      villa.hidden = false; return false;
    }
    const ny = [...new Set(hlutar)].filter((x) => !valdir.has(x));
    if (valdir.size + ny.length > hamark) { villa.textContent = 'Mest ' + hamark + ' viðtakendur í einu.'; villa.hidden = false; return false; }
    ny.forEach((x) => { valdir.add(x); if (!aukalega.includes(x)) aukalega.push(x); });
    inn.value = '';
    teikna(); uppfaera();
    return true;
  };
  inn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); baetaInnslaetti(); } });
  const reitur = el('div', { class: 'ts-hluti' }, [
    el('span', { class: 'ts-midi', texti: 'Annað netfang' }),
    el('div', { class: 'ts-netfang-lina' }, [inn, el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Bæta við', onclick: () => baetaInnslaetti() })]),
    villa, listi
  ]);
  return { reitur, baetaInnslaetti };
}

/* ------------------------------------------------------------------
   Glugginn: velja viðtakendur, sjá póstinn og senda
   ------------------------------------------------------------------ */
/* skyrsla: drög að mánaðarskýrslu sama mánaðar, ef til. Þá má láta
   gervigreindina skrifa orðin (hún vistar þau líka á drögin, og
   eftirSamantekt(skyrsla) lætur síðuna vita). */
export async function opnaSendingu({ g, ek, fid, fyrirtaeki, midlar, maelingar, tb, timabilHeiti, fyrriHeiti, myndbond, skyrsla, eftirSamantekt }) {
  fyrriHeiti = fyrriHeiti || 'tímabilið á undan';
  const stofa = (ek && ek.stofa) || null;
  const snid = stofuSnid(stofa);
  const merkiTexti = 'Tölfræði · ' + dagsTexti(tb.fra) + ' til ' + dagsTexti(tb.til);
  const inngangur = timabilHeiti;

  const d = el('dialog', { class: 'pdialog ts-gluggi', 'aria-labelledby': 'ts-h' });
  const kort = el('div', { class: 'pdialog__kort ts-kort' }, [el('p', { class: 'tomt', texti: 'Sæki tölurnar' })]);
  d.appendChild(kort);
  document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();

  let faerslur = [], notendur = [];
  try {
    [faerslur, notendur] = await Promise.all([g.midlaFaerslur(fid, tb.fra, tb.til).catch(() => []), g.notendur()]);
  } catch (villa) {
    fylla(kort, [el('p', { class: 'tomt', texti: villa.message || 'Náði ekki í gögnin.' }), el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Loka', onclick: () => d.close() })]);
    return;
  }
  const tolur = reiknaTolur({ midlar, maelingar, tb, faerslur });
  /* Myndböndin: áhorf mánaðanna sem tímabilið nær yfir, mest skoðuðu fyrst */
  const mbFra = String(tb.fra).slice(0, 8) + '01', mbTil = String(tb.til).slice(0, 8) + '01';
  const mbSumma = (m, fra, til, k) => (m.tolur || []).reduce((a, t) => (t.manudur >= fra && t.manudur <= til && erTala(t[k]) ? (a || 0) + Number(t[k]) : a), null);
  const mbTilbuin = (myndbond || []).map((m) => ({ titill: m.titill, midill: m.midill, birt: m.birt, slod: m.slod,
    ahorf: mbSumma(m, mbFra, mbTil, 'ahorf'), likes: mbSumma(m, mbFra, mbTil, 'likes'), heild: mbSumma(m, '0000-01-01', '9999-12-31', 'ahorf') }))
    .filter((m) => erTala(m.ahorf)).sort((a, b) => Number(b.ahorf) - Number(a.ahorf)).slice(0, 8);
  let medMyndbond = mbTilbuin.length > 0;
  const vidskiptavinir = (notendur || []).filter((n) => n.fyrirtaeki_id === fid && n.hlutverk === 'vidskiptavinur' && n.netfang);
  const valdir = new Set(vidskiptavinir.map((n) => n.netfang));
  let afrit = false;

  const ordReitur = el('textarea', { id: 'ts-ord', class: 'ts-ord', rows: '3', maxlength: '1200', placeholder: 'Nokkur orð frá ykkur (valfrjálst)' });
  const sjalfgefid = sjalfgefinOrd(tolur, fyrriHeiti);
  ordReitur.value = sjalfgefid;
  const forsyn = el('iframe', { class: 'ts-forsyn', title: 'Forsýn á póstinum', sandbox: '', loading: 'eager' });
  const villa = el('p', { class: 'ts-villa', role: 'alert', hidden: true });
  const sendaHn = el('button', { type: 'button', class: 'btn', texti: 'Senda núna' });

  const nofnValdra = () => vidskiptavinir.filter((n) => valdir.has(n.netfang)).map((n) => n.nafn || '');
  const efni = () => ('Tölfræðin ykkar ' + inngangur + ': ' + fyrirtaeki).replace(/[\r\n]+/g, ' ').slice(0, 200);
  const gogn = () => ({ fyrirtaeki, nofn: nofnValdra(), merkiTexti, inngangur, fyrriHeiti, tolur, ord: ordReitur.value.trim(), myndbond: medMyndbond ? mbTilbuin : [], snid });

  /* Gervigreindin skrifar orðin út frá tölum mánaðarskýrslunnar. Hafi
     einhver skrifað í reitinn, eða samantekt sé á skýrslunni, er spurt fyrst. */
  const ggStada = el('p', { class: 'skyring', role: 'status', hidden: true });
  const ggHn = skyrsla && skyrsla.id ? el('button', { type: 'button', class: 'sk-tengill', style: 'font-size:13.5px', texti: 'Skrifa með gervigreind' }) : null;
  if (ggHn) {
    ggHn.addEventListener('click', async () => {
      const manudur = MAN[Number(String(skyrsla.manudur).slice(5, 7)) - 1] || 'mánuðinn';
      const skrifad = ordReitur.value.trim() && ordReitur.value.trim() !== sjalfgefid.trim();
      const samantekt = String(skyrsla.samantekt || '').trim();
      if ((skrifad || samantekt) && !confirm('Gervigreindin skrifar ný orð. Þau koma í reitinn og í samantekt mánaðarskýrslunnar fyrir '
          + manudur + ', í stað þess sem stendur þar núna. Halda áfram?')) return;
      ggHn.disabled = true; sendaHn.disabled = true;
      ggStada.hidden = false; ggStada.style.color = ''; ggStada.textContent = 'Gervigreindin skrifar';
      try {
        const svar = await g.gervigreind('samantekt_skyrsla', skyrsla.id);
        const texti = String(svar.texti || '').trim();
        if (texti.length > 1200) ordReitur.maxLength = 4000;
        if (texti) ordReitur.value = texti;
        if (svar.vistad) { skyrsla.samantekt = texti; if (eftirSamantekt) eftirSamantekt(skyrsla); }
        ggStada.textContent = svar.synidaemi
          ? 'Sýnidæmi: svona líta drög frá gervigreindinni út. Ekkert var vistað.'
          : 'Drög frá gervigreind. Lestu þau yfir og breyttu áður en þú sendir.'
            + (svar.vistad ? ' Þau eru líka vistuð á mánaðarskýrsluna.' : svar.athugasemd ? ' ' + String(svar.athugasemd).replace(/ sjálf\(ur\)/g, '') : '');
      } catch (villa2) {
        ggStada.textContent = villa2.message || 'Þetta gekk ekki.';
        ggStada.style.color = '#a3312a';
      }
      ggHn.disabled = false;
      uppfaera();
    });
  }
  let bid;
  const uppfaera = () => {
    clearTimeout(bid);
    bid = setTimeout(() => { forsyn.srcdoc = postHtml(gogn()); }, 120);
    const fjoldi = valdir.size + (afrit ? 1 : 0);
    sendaHn.disabled = fjoldi === 0;
    sendaHn.textContent = fjoldi ? 'Senda á ' + (fjoldi === 1 ? '1 viðtakanda' : fjoldi + ' viðtakendur') : 'Veldu viðtakanda';
  };

  const listi = vidskiptavinir.length
    ? el('ul', { class: 'ts-vidtakendur' }, vidskiptavinir.map((n) => el('li', {}, [
        el('label', {}, [
          el('input', { type: 'checkbox', checked: true, onchange: (e) => { e.target.checked ? valdir.add(n.netfang) : valdir.delete(n.netfang); uppfaera(); } }),
          el('span', {}, [el('strong', { texti: n.nafn || n.netfang }), el('small', { texti: n.netfang })])
        ])
      ])))
    : el('p', { class: 'skyring', texti: 'Enginn viðskiptavinur er skráður hjá ' + fyrirtaeki + '. Skrifaðu netfang hér fyrir neðan, eða sendu afrit á þig til að sjá póstinn.' });
  const annad = netfangaReitur(valdir, () => uppfaera());

  fylla(kort, [
    el('div', { class: 'pdialog__haus' }, [
      el('h2', { id: 'ts-h', texti: 'Senda tölfræði' }),
      el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
    ]),
    el('div', { class: 'ts-grind' }, [
      el('div', { class: 'ts-val' }, [
        el('div', { class: 'ts-hluti' }, [el('span', { class: 'ts-midi', texti: 'Tímabil' }), el('p', { class: 'ts-timabil', texti: merkiTexti.replace('Tölfræði · ', '') }),
          el('p', { class: 'skyring', texti: 'Sama tímabil og á síðunni. Skiptu um það þar ef þú vilt annað.' })]),
        el('div', { class: 'ts-hluti' }, [el('span', { class: 'ts-midi', texti: 'Til' }), listi,
          ek && ek.netfang ? el('label', { class: 'ts-afrit' }, [
            el('input', { type: 'checkbox', onchange: (e) => { afrit = e.target.checked; uppfaera(); } }),
            document.createTextNode('Senda afrit á mig (' + ek.netfang + ')')
          ]) : null]),
        annad.reitur,
        mbTilbuin.length ? el('label', { class: 'ts-afrit' }, [
          el('input', { type: 'checkbox', checked: true, onchange: (e) => { medMyndbond = e.target.checked; uppfaera(); } }),
          document.createTextNode('Hafa myndböndin með (' + mbTilbuin.length + ')')
        ]) : null,
        el('div', { class: 'ts-hluti' }, [
          el('label', { class: 'ts-midi', for: 'ts-ord', texti: 'Orð frá ykkur' }),
          ordReitur,
          ggHn ? el('div', { style: 'margin-top:8px' }, [ggHn]) : null,
          ggStada
        ]),
        villa,
        el('div', { class: 'ts-hnappar' }, [el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Hætta við', onclick: () => d.close() }), sendaHn])
      ]),
      el('div', { class: 'ts-forsyn-svid' }, [el('span', { class: 'ts-midi', texti: 'Svona lítur pósturinn út' }), forsyn])
    ])
  ]);
  ordReitur.addEventListener('input', uppfaera);
  uppfaera();

  sendaHn.addEventListener('click', async () => {
    if (!annad.baetaInnslaetti()) return;
    const netfong = [...valdir];
    if (afrit && ek && ek.netfang && !netfong.includes(ek.netfang)) netfong.push(ek.netfang);
    if (!netfong.length) return;
    sendaHn.disabled = true; sendaHn.textContent = 'Sendi…'; villa.hidden = true;
    try {
      const dd = gogn();
      await g.sendaTolfraedi({ fyrirtaeki_id: fid, netfong, efni: efni(), html: postHtml(dd), texti: postTexti(dd) });
      const hverjum = nofnValdra().map((n) => n.split(' ')[0]).filter(Boolean);
      fylla(kort, [el('div', { class: 'ts-sent' }, [
        el('span', { class: 'ts-sent__hak', 'aria-hidden': 'true', texti: '✓' }),
        el('h2', { texti: 'Pósturinn er á leiðinni' }),
        el('p', { texti: 'Til ' + (hverjum.length ? hverjum.concat(netfong.filter((x) => !vidskiptavinir.some((v) => v.netfang === x))).join(', ') : netfong.join(', ')) + '. '
          + (g.prufa ? 'Í sýnidæminu fer ekkert út.'
            : snid.erTveir ? 'Hann fer frá tveir@tveir.is.'
              : 'Hann fer í nafni ' + snid.nafn + (stofa && stofa.netfang ? ' og svör berast á ' + stofa.netfang : '') + '.') }),
        el('button', { type: 'button', class: 'btn', texti: 'Loka', onclick: () => d.close() })
      ])]);
    } catch (e) {
      villa.textContent = e.message || 'Pósturinn fór ekki. Reyndu aftur.'; villa.hidden = false;
      uppfaera();
    }
  });
}
