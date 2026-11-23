/* ==========================================================================
   Undirskriftin í pósti: venjulegur texti, HTML með merki og glugginn til
   að breyta henni. Notað á Pósthólfinu og á Stillingum.
   ========================================================================== */

import { el, fylla } from './portal.js';

const oruggSlod = (s) => { s = String(s || '').trim(); return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : null; };
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ------------------------------------------------------------------
   Undirskriftin: venjulegur texti og HTML með merki. Allt sem notandinn
   skrifar fer í gegnum esc, og bara https slóðir fara í myndir og tengla.
   ------------------------------------------------------------------ */
export function undirskriftTexti(u) {
  if (!u || u.virk === false) return '';
  return [u.kvedja, u.nafn, u.starf, [u.simi, u.netfang, u.vefur].filter(Boolean).join(' · ')].filter((x) => String(x || '').trim()).join('\n');
}
function vefSlod(v) {
  v = String(v || '').trim();
  if (!v) return null;
  return oruggSlod(/^https?:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : 'https://' + v);
}
export function undirskriftHtml(u) {
  if (!u || u.virk === false) return '';
  const L = "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;";
  const merki = oruggSlod(u.merki), vefur = vefSlod(u.vefur);
  const simi = String(u.simi || '').trim(), netfang = String(u.netfang || '').trim();
  const tengiliðir = [
    simi ? '<a href="tel:' + esc(simi.replace(/[^\d+]/g, '')) + '" style="color:#4a5f80;text-decoration:none;">' + esc(simi) + '</a>' : '',
    /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(netfang) ? '<a href="mailto:' + esc(netfang) + '" style="color:#4a5f80;text-decoration:none;">' + esc(netfang) + '</a>' : '',
    vefur ? '<a href="' + esc(vefur) + '" target="_blank" style="color:#5b93f0;text-decoration:none;font-weight:600;">' + esc(String(u.vefur).replace(/^https?:\/\//i, '').replace(/\/$/, '')) + '</a>' : ''
  ].filter(Boolean).join('<span style="color:#b8c6da;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>');
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;border-collapse:collapse;">'
    + (u.kvedja ? '<tr><td colspan="2" style="' + L + 'font-size:15px;color:#1c3050;padding:0 0 12px 0;">' + esc(u.kvedja) + '</td></tr>' : '')
    + '<tr>'
    + (merki ? '<td valign="middle" style="padding:0 16px 0 0;border-right:2px solid #e3ecf8;"><img src="' + esc(merki) + '" alt="" width="96" style="display:block;width:96px;max-width:96px;height:auto;border:0;"></td>' : '')
    + '<td valign="middle" style="padding:0 0 0 ' + (merki ? '16' : '0') + 'px;' + L + '">'
    + (u.nafn ? '<div style="font-size:15px;font-weight:700;color:#1c3050;line-height:1.3;">' + esc(u.nafn) + '</div>' : '')
    + (u.starf ? '<div style="font-size:13px;color:#7189ac;line-height:1.4;padding-top:1px;">' + esc(u.starf) + '</div>' : '')
    + (tengiliðir ? '<div style="font-size:13px;line-height:1.5;padding-top:6px;">' + tengiliðir + '</div>' : '')
    + '</td></tr></table>';
}
export function svarHtml(texti, u) {
  const L = "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;";
  return '<div style="' + L + 'font-size:15px;line-height:1.6;color:#1c3050;">' + esc(texti).replace(/\r?\n/g, '<br>') + '</div>' + undirskriftHtml(u);
}

/* Sjálfgefin undirskrift áður en notandinn vistar sína. Netfang, vefur og
   merki koma frá stofunni. Tveir (og gagnagrunnur án stofa) heldur sínu. */
export function sjalfgefinUndirskrift(g, ek) {
  const grunnur = { virk: true, kvedja: 'Kveðja,', nafn: ek.nafn || '', starf: '', simi: '' };
  if (g.prufa) return { ...grunnur, netfang: ek.netfang || '', vefur: '', merki: '' };
  const s = ek.stofa;
  if (!s || s.slug === 'tveir') {
    return { ...grunnur, netfang: 'tveir@tveir.is', vefur: 'tveir.is', merki: 'https://tveir.is/assets/img/tveir-logo-3d.png' };
  }
  return {
    ...grunnur,
    netfang: s.netfang || ek.netfang || '',
    vefur: String(s.vefur || '').replace(/^https:\/\//i, '').replace(/\/$/, ''),
    merki: oruggSlod(s.merki_url) || ''
  };
}

/* Undirskriftin sem er vistuð, eða sú sjálfgefna */
export async function lesaUndirskrift(g, ek) {
  const sjalfgefin = sjalfgefinUndirskrift(g, ek);
  try { const u = await g.undirskrift(); return u ? { ...sjalfgefin, ...u } : sjalfgefin; } catch (e) { return sjalfgefin; }
}

/* Glugginn: form með forsýn sem uppfærist um leið. Skilar nýju
   undirskriftinni þegar hún er vistuð, annars null. */
export function opnaUndirskriftGlugga({ g, u: upphaf, sjalfgefin }) {
  return new Promise((leysa) => {
  let vistad = null;
    const kort = el('div', { class: 'pdialog__kort sk-us' });
    const d = el('dialog', { class: 'pdialog sk-us-gluggi', 'aria-labelledby': 'sk-us-h' }, [kort]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => { d.remove(); leysa(vistad); });
    const u = { ...upphaf };
    const forsyn = el('div', { class: 'sk-us__forsyn', 'data-ekki-thyda': '' });
    const teikna = () => { forsyn.innerHTML = '<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#1c3050;">Hæ,<br><br>Takk fyrir póstinn, við skoðum þetta í dag.</div>' + undirskriftHtml({ ...u, virk: true }); };
    const reitur = (merki, lykill, eig = {}) => {
      const inn = el('input', { type: 'text', value: u[lykill] || '', maxlength: '160', autocomplete: 'off', ...eig,
        oninput: (e) => { u[lykill] = e.target.value; teikna(); } });
      return el('label', { class: 'field' }, [el('span', { texti: merki }), inn]);
    };
    const villa = el('p', { class: 'sk-svar__stada er-villa', role: 'alert', hidden: true });
    const vistaHn = el('button', { type: 'button', class: 'btn', texti: 'Vista undirskrift' });
    vistaHn.addEventListener('click', async () => {
      if (u.merki && !oruggSlod(u.merki)) { villa.textContent = 'Slóðin á merkið þarf að byrja á https://'; villa.hidden = false; return; }
      vistaHn.disabled = true; villa.hidden = true;
      const hreint = {};
      for (const k of ['kvedja', 'nafn', 'starf', 'simi', 'netfang', 'vefur', 'merki']) hreint[k] = String(u[k] || '').trim().slice(0, 160);
      hreint.virk = u.virk !== false;
      try {
        await g.vistaUndirskrift(hreint); vistad = { ...sjalfgefin, ...hreint }; d.close();
      }
      catch (e) { villa.textContent = e.message || 'Vistaðist ekki.'; villa.hidden = false; vistaHn.disabled = false; }
    });
    fylla(kort, [
      el('div', { class: 'pdialog__haus' }, [
        el('h2', { id: 'sk-us-h', texti: 'Undirskrift' }),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
      ]),
      el('p', { class: 'skyring', texti: 'Fer neðst í svörin þín. Vistast á aðganginum þínum, svo hún fylgir þér á milli tækja.' }),
      el('div', { class: 'sk-us__grind' }, [
        el('div', { class: 'sk-us__form' }, [
          reitur('Kveðja', 'kvedja', { placeholder: 'Kveðja,' }),
          el('div', { class: 'field-row' }, [reitur('Nafn', 'nafn'), reitur('Starfsheiti', 'starf', { placeholder: 'Til dæmis Markaðsstjóri' })]),
          el('div', { class: 'field-row' }, [reitur('Sími', 'simi', { inputmode: 'tel', placeholder: '+354 ...' }), reitur('Netfang', 'netfang', { inputmode: 'email' })]),
          reitur('Vefsíða', 'vefur', { placeholder: 'vefurinn.is' }),
          reitur('Slóð á merki (https)', 'merki', { inputmode: 'url', placeholder: 'https://' }),
          villa,
          el('div', { class: 'spjald__fot' }, [vistaHn])
        ]),
        el('div', { class: 'sk-us__forsyn-svid' }, [el('span', { class: 'ts-midi', texti: 'Svona lítur hún út' }), forsyn])
      ])
    ]);
    teikna();
    document.body.append(d);
    d.showModal();
  });
}
