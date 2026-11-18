/* ==========================================================================
   Tölfræði send á viðskiptavin beint úr kerfinu.
   Hnappurinn er efst í horninu á Tölfræði hvers fyrirtækis. Stjórnandi velur
   viðtakendur, getur bætt við persónulegum orðum og sér póstinn nákvæmlega
   eins og hann fer. Pósturinn fer í töfluna tolfraedi_sendingar og Apps
   Script (tolfraedi.gs) sendir hann frá tveir@tveir.is.
   Útlitið er það sama og í mánaðarskýrslunni (skyrsluHtml_ í tolfraedi.gs).
   ========================================================================== */
import { el, fylla } from './portal.js';

const MERKI = 'https://tveir.is/assets/img/tveir-logo-3d.png';
const TOLFRAEDI = 'https://tveir.is/vinnusvaedi/tolfraedi.html';
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
export function postHtml({ fyrirtaeki, nofn, merkiTexti, inngangur, fyrriHeiti, tolur, ord, myndbond }) {
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
  const reitir = '<tr>' + reitur('Áhorf', tala(t.ahorf), breyting(t.ahorf, t.ahorf_fyrri, fyrriHeiti))
    + reitur('Náð', tala(t.nadir), breyting(t.nadir, t.nadir_fyrri, fyrriHeiti)) + '</tr><tr>'
    + reitur('Samskipti', tala(t.samskipti), breyting(t.samskipti, t.samskipti_fyrri, fyrriHeiti))
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
  const sulur = sulurLina('Áhorf', t.ahorf, t.ahorf_fyrri) + sulurLina('Náð', t.nadir, t.nadir_fyrri) + sulurLina('Samskipti', t.samskipti, t.samskipti_fyrri);
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
  const mbListi = (myndbond || []).filter((m) => erTala(m.ahorf));
  const mbHaest = Math.max(1, ...mbListi.map((m) => Number(m.ahorf)));
  const myndbondPosts = mbListi.length ? kafli('Myndböndin') + mbListi.map((m) => {
    const slod = oruggSlod(m.slod);
    const lysing = [MIDLAR_HEITI[m.midill] || (m.midill === 'youtube' ? 'YouTube' : ''), m.birt ? 'birt ' + dagsTexti(m.birt) : ''].filter(Boolean).join(' · ');
    const aukatolur = [erTala(m.likes) ? tala(m.likes) + ' líkar' : '', erTala(m.heild) && Number(m.heild) !== Number(m.ahorf) ? tala(m.heild) + ' áhorf alls' : ''].filter(Boolean).join(' · ');
    return '<tr><td style="padding:0 0 12px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#f2f8fe;border-radius:14px;"><tr><td style="padding:14px 16px;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      + '<td valign="top" style="' + L + 'font-size:15px;line-height:1.4;font-weight:600;color:#1c3050;word-break:break-word;">' + esc(m.titill) + '</td>'
      + '<td align="right" valign="top" style="' + H + 'font-size:18px;line-height:1.3;font-weight:700;color:#1c3050;white-space:nowrap;padding-left:10px;">' + esc(tala(m.ahorf)) + '</td>'
      + '</tr><tr><td style="' + L + 'font-size:12.5px;line-height:1.4;color:#7189ac;padding-top:2px;">' + esc(lysing) + '</td>'
      + '<td align="right" style="' + L + 'font-size:12.5px;color:#7189ac;padding-top:2px;white-space:nowrap;">áhorf</td></tr></table>'
      + '<div style="padding-top:10px;">' + sula(m.ahorf, mbHaest, '#5b93f0') + '</div>'
      + (aukatolur ? '<div style="' + L + 'font-size:13px;line-height:1.5;color:#4a5f80;padding-top:8px;">' + esc(aukatolur) + '</div>' : '')
      + (slod ? '<div style="padding-top:10px;">' + takki('Horfa á myndbandið', slod, false) + '</div>' : '')
      + '</td></tr></table></td></tr>';
  }).join('') : '';
  const nofnin = (nofn || []).map((x) => String(x || '').trim().split(' ')[0]).filter(Boolean);
  const kvedja = !nofnin.length || nofnin.length > 3 ? 'Hæ,' : nofnin.length === 1 ? 'Hæ ' + nofnin[0] + ',' : 'Hæ ' + nofnin.slice(0, -1).join(', ') + ' og ' + nofnin[nofnin.length - 1] + ',';
  const ordin = ord ? '<tr><td style="padding:16px 0 4px 0;' + L + 'font-size:16px;line-height:1.6;color:#1c3050;word-break:break-word;">' + esc(ord).replace(/\r?\n/g, '<br>') + '</td></tr>' : '';

  return '<!doctype html><html lang="is"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>' + esc('Tölfræði ' + fyrirtaeki) + '</title></head>'
    + '<body style="margin:0;padding:0;background:#f2f8fe;">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc('Tölurnar ykkar ' + inngangur) + '</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f8fe" style="background:#f2f8fe;"><tr><td align="center" style="padding:32px 12px;">'
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">'
    + '<tr><td align="center" style="padding:0 0 22px 0;"><a href="https://tveir.is" target="_blank" style="text-decoration:none;"><img src="' + MERKI + '" width="132" alt="TVEIR" style="display:block;width:132px;height:auto;border:0;' + L + 'font-size:24px;font-weight:800;color:#5b93f0;"></a></td></tr>'
    + '<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:20px;padding:30px 22px;box-shadow:0 12px 30px rgba(28,48,80,.10);">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + '<tr><td style="padding:0 6px 14px 6px;"><span style="display:inline-block;background:#e7f0fd;color:#2c62c4;border-radius:999px;padding:6px 12px;' + L + 'font-size:12.5px;font-weight:600;">' + esc(merkiTexti) + '</span></td></tr>'
    + '<tr><td style="padding:0 6px 8px 6px;' + H + 'font-size:30px;line-height:1.15;font-weight:700;color:#1c3050;word-break:break-word;">' + esc(fyrirtaeki) + '</td></tr>'
    + '<tr><td style="padding:0 6px 14px 6px;' + L + 'font-size:16px;line-height:1.55;color:#4a5f80;">' + esc(kvedja) + '<br>' + esc('Hér eru tölurnar af samfélagsmiðlunum ykkar ' + inngangur + '.') + '</td></tr>'
    + '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + reitir + '</table></td></tr>'
    + '<tr><td style="padding:0 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + ordin + sulurit + myndbondPosts + midlar + (faerslur ? kafli('Bestu færslurnar') + faerslur : '')
    + '<tr><td align="center" style="padding:24px 0 6px 0;">' + takki('Sjá alla tölfræðina', TOLFRAEDI, true) + '</td></tr>'
    + '</table></td></tr></table></td></tr>'
    + '<tr><td align="center" style="padding:22px 12px 0 12px;' + L + 'font-size:13px;line-height:1.6;color:#7189ac;">Kveðja, Tveir<br><a href="https://tveir.is" target="_blank" style="color:#5b93f0;text-decoration:none;">tveir.is</a></td></tr>'
    + '</table></td></tr></table></body></html>';
}

export function postTexti({ fyrirtaeki, nofn, inngangur, fyrriHeiti, tolur, ord, myndbond }) {
  const t = tolur.samtals;
  const lina = (h, nu, fyrr) => { const b = breyting(nu, fyrr, fyrriHeiti); return h + ': ' + (tala(nu) || 'engin gögn') + (b ? ' (' + b.texti + ')' : ''); };
  const n = (nofn || []).filter(Boolean);
  return [n.length === 1 ? 'Hæ ' + n[0] + ',' : 'Hæ,', '', 'Tölfræði ' + fyrirtaeki + ' ' + inngangur + ':', '',
    lina('Áhorf', t.ahorf, t.ahorf_fyrri), lina('Náð', t.nadir, t.nadir_fyrri), lina('Samskipti', t.samskipti, t.samskipti_fyrri),
    'Fylgjendur: ' + (tala(t.fylgjendur_lok) || 'engin gögn'),
    ...((myndbond || []).filter((m) => erTala(m.ahorf)).length ? ['', 'Myndböndin:'].concat((myndbond || []).filter((m) => erTala(m.ahorf)).map((m) => '- ' + m.titill + ': ' + tala(m.ahorf) + ' áhorf')) : []),
    ord ? '\n' + ord : '', '', 'Sjá alla tölfræðina: ' + TOLFRAEDI, '', 'Kveðja,', 'Tveir'].join('\n');
}

/* ------------------------------------------------------------------
   Glugginn: velja viðtakendur, sjá póstinn og senda
   ------------------------------------------------------------------ */
export async function opnaSendingu({ g, ek, fid, fyrirtaeki, midlar, maelingar, tb, timabilHeiti, fyrriHeiti, myndbond }) {
  fyrriHeiti = fyrriHeiti || 'tímabilið á undan';
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

  const ordReitur = el('textarea', { class: 'ts-ord', rows: '3', maxlength: '1200', placeholder: 'Nokkur orð frá ykkur (valfrjálst)' });
  ordReitur.value = sjalfgefinOrd(tolur, fyrriHeiti);
  const forsyn = el('iframe', { class: 'ts-forsyn', title: 'Forsýn á póstinum', sandbox: '', loading: 'eager' });
  const villa = el('p', { class: 'ts-villa', role: 'alert', hidden: true });
  const sendaHn = el('button', { type: 'button', class: 'btn', texti: 'Senda núna' });

  const nofnValdra = () => vidskiptavinir.filter((n) => valdir.has(n.netfang)).map((n) => n.nafn || '');
  const efni = () => ('Tölfræðin ykkar ' + inngangur + ': ' + fyrirtaeki).replace(/[\r\n]+/g, ' ').slice(0, 200);
  const gogn = () => ({ fyrirtaeki, nofn: nofnValdra(), merkiTexti, inngangur, fyrriHeiti, tolur, ord: ordReitur.value.trim(), myndbond: medMyndbond ? mbTilbuin : [] });
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
    : el('p', { class: 'skyring', texti: 'Enginn viðskiptavinur er skráður hjá ' + fyrirtaeki + '. Bættu honum við á stjórnborðinu, eða sendu afrit á þig til að sjá póstinn.' });

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
        mbTilbuin.length ? el('label', { class: 'ts-afrit' }, [
          el('input', { type: 'checkbox', checked: true, onchange: (e) => { medMyndbond = e.target.checked; uppfaera(); } }),
          document.createTextNode('Hafa myndböndin með (' + mbTilbuin.length + ')')
        ]) : null,
        el('label', { class: 'ts-hluti' }, [el('span', { class: 'ts-midi', texti: 'Orð frá ykkur' }), ordReitur]),
        villa,
        el('div', { class: 'ts-hnappar' }, [el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Hætta við', onclick: () => d.close() }), sendaHn])
      ]),
      el('div', { class: 'ts-forsyn-svid' }, [el('span', { class: 'ts-midi', texti: 'Svona lítur pósturinn út' }), forsyn])
    ])
  ]);
  ordReitur.addEventListener('input', uppfaera);
  uppfaera();

  sendaHn.addEventListener('click', async () => {
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
        el('p', { texti: (hverjum.length ? 'Til ' + hverjum.join(', ') : 'Til ' + netfong.join(', ')) + '. Hann fer frá tveir@tveir.is.' }),
        el('button', { type: 'button', class: 'btn', texti: 'Loka', onclick: () => d.close() })
      ])]);
    } catch (e) {
      villa.textContent = e.message || 'Pósturinn fór ekki. Reyndu aftur.'; villa.hidden = false;
      uppfaera();
    }
  });
}
