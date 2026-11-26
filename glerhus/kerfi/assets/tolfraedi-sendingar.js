/* ==========================================================================
   Senda skýrslu: einn staður á Tölfræði fyrirtækis fyrir allt sem er sent.
   Þaðan er sent úr tölunum (opnaSendingu) eða úr skjáskoti (opnaSkjaskot),
   þar sést fólkið sem hefur fengið skýrslu og allar skýrslur sem hafa farið,
   nákvæmlega eins og þær fóru (taflan tolfraedi_sendingar geymir póstinn).
   Hverja skýrslu má opna og senda aftur, á sama fólk eða annað.
   ========================================================================== */
import { el, fylla } from './portal.js';
import { netfangaReitur } from './tolfraedi-senda.js';

const MAN = ['jan.', 'feb.', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'sept.', 'okt.', 'nóv.', 'des.'];
const dags = (s) => {
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.getDate() + '. ' + MAN[d.getMonth()] + ' ' + d.getFullYear() + ', kl. ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};
const STADA = { send: ['Sent', 'tf-ss--send'], bidur: ['Á leiðinni', 'tf-ss--bidur'], villa: ['Fór ekki', 'tf-ss--villa'] };

/* Netföngin sem hafa fengið skýrslu, nýjust fyrst, hvert einu sinni */
export function fyrriNetfong(listi) {
  const ut = [];
  (listi || []).forEach((s) => (s.netfong || []).forEach((n) => {
    const x = String(n || '').trim().toLowerCase();
    if (x && !ut.includes(x)) ut.push(x);
  }));
  return ut;
}

/* Hlutinn á síðunni. listi: sendingar fyrirtækisins (nýjust fyrst) eða null meðan sótt er. */
export function sendingarHluti({ g, ek, fid, fyrirtaeki, listi, villa, urTolunum, urSkjaskoti, endurhlada }) {
  const folk = fyrriNetfong(listi);
  const syna = 8;
  const fleiri = listi && listi.length > syna;
  const radaListi = el('ul', { class: 'tf-ss-listi' });
  const teiknaRadir = (allt) => fylla(radaListi, (listi || []).slice(0, allt ? listi.length : syna).map((s) => {
    const [heiti, klasi] = STADA[s.stada] || STADA.bidur;
    return el('li', { class: 'tf-ss' }, [
      el('div', { class: 'tf-ss__texti' }, [
        el('strong', { texti: s.efni || 'Skýrsla' }),
        el('small', { texti: dags(s.stofnad) + ' · til ' + (s.netfong || []).join(', ') }),
        s.stada === 'villa' && s.villa ? el('small', { class: 'tf-ss__villa', texti: s.villa }) : null
      ]),
      el('span', { class: 'tf-ss__merki ' + klasi, texti: heiti }),
      el('button', { type: 'button', class: 'btn btn--ghost tf-ss__hn', texti: 'Opna',
        onclick: () => opnaSendingu({ g, ek, fid, fyrirtaeki, id: s.id, folk, eftir: endurhlada }) })
    ]);
  }));
  teiknaRadir(false);

  return el('section', { class: 'card pblokk tf-blokk', id: 'senda-skyrslu' }, [
    el('div', { class: 'pyfir' }, [el('h2', { texti: 'Senda skýrslu' })]),
    el('p', { class: 'skyring', style: 'margin:-6px 0 14px', texti: 'Sendu tölurnar á hvern sem er: viðskiptavininn, styrktaraðila eða þjálfara. '
      + 'Allt sem er sent geymist hér, og hverja skýrslu má opna og senda aftur.' }),
    el('div', { class: 'tf-ss-hnappar' }, [
      el('button', { type: 'button', class: 'tf-ss-val', onclick: () => urTolunum(folk) }, [
        el('span', { class: 'tf-ss-val__takn', 'aria-hidden': 'true', texti: '✉' }),
        el('strong', { texti: 'Úr tölunum' }),
        el('small', { texti: 'Tímabilið sem er valið á síðunni, með gröfum og bestu færslunum.' })
      ]),
      el('button', { type: 'button', class: 'tf-ss-val', onclick: () => urSkjaskoti(folk) }, [
        el('span', { class: 'tf-ss-val__takn', 'aria-hidden': 'true', texti: '📷' }),
        el('strong', { texti: 'Úr skjáskoti' }),
        el('small', { texti: 'Gervigreindin les tölurnar af skjáskotum, til dæmis eftir helgi sem var tekin upp.' })
      ])
    ]),
    folk.length ? el('div', { class: 'tf-ss-hluti' }, [
      el('h3', { class: 'ts-midi', texti: 'Hafa fengið skýrslu' }),
      el('p', { class: 'tf-ss-folk', texti: folk.join(', ') }),
      el('p', { class: 'skyring', texti: 'Þau birtast sem tillögur þegar þú sendir næst.' })
    ]) : null,
    el('div', { class: 'tf-ss-hluti' }, [
      el('h3', { class: 'ts-midi', texti: 'Sendar skýrslur' }),
      villa ? el('p', { class: 'tomt', texti: villa.message || 'Sendingarnar komu ekki.' })
        : !listi ? el('p', { class: 'tomt', texti: 'Sæki sendingarnar' })
          : listi.length ? radaListi : el('p', { class: 'tomt', texti: 'Engin skýrsla hefur verið send á ' + fyrirtaeki + ' ennþá.' }),
      fleiri ? el('button', { type: 'button', class: 'sk-tengill', style: 'font-size:13.5px;margin-top:8px', texti: 'Sýna allar (' + listi.length + ')',
        onclick: (e) => { teiknaRadir(true); e.target.remove(); } }) : null
    ])
  ]);
}

/* Ein skýrsla opnuð: pósturinn eins og hann fór, og Senda aftur */
async function opnaSendingu({ g, ek, fid, fyrirtaeki, id, folk, eftir }) {
  const d = el('dialog', { class: 'pdialog ts-gluggi', 'aria-labelledby': 'tfss-h' });
  const kort = el('div', { class: 'pdialog__kort ts-kort' }, [el('p', { class: 'tomt', texti: 'Sæki skýrsluna' })]);
  d.appendChild(kort);
  document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();

  let s;
  try { s = await g.tolfraediSending(id); } catch (villa) {
    fylla(kort, [el('p', { class: 'tomt', texti: villa.message || 'Náði ekki í skýrsluna.' }), el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Loka', onclick: () => d.close() })]);
    return;
  }
  const valdir = new Set((s.netfong || []).map((n) => String(n).toLowerCase()));
  const allir = [...new Set([...(s.netfong || []).map((n) => String(n).toLowerCase()), ...(folk || [])])];
  let afrit = false;
  const sendaHn = el('button', { type: 'button', class: 'btn' });
  const villa = el('p', { class: 'ts-villa', role: 'alert', hidden: true });
  let sendir = false;
  const uppfaera = () => {
    if (sendir) return;
    const n = valdir.size + (afrit ? 1 : 0);
    sendaHn.disabled = n === 0;
    sendaHn.textContent = n ? 'Senda aftur á ' + (n === 1 ? '1 viðtakanda' : n + ' viðtakendur') : 'Veldu viðtakanda';
  };
  const annad = netfangaReitur(valdir, uppfaera);
  const forsyn = el('iframe', { class: 'ts-forsyn', title: 'Skýrslan eins og hún fór', sandbox: '', loading: 'eager' });
  forsyn.srcdoc = s.html || '';

  fylla(kort, [
    el('div', { class: 'pdialog__haus' }, [
      el('h2', { id: 'tfss-h', texti: s.efni || 'Skýrsla' }),
      el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
    ]),
    el('div', { class: 'ts-grind' }, [
      el('div', { class: 'ts-val' }, [
        el('div', { class: 'ts-hluti' }, [el('span', { class: 'ts-midi', texti: 'Sent' }), el('p', { texti: dags(s.stofnad) + ' til ' + (s.netfong || []).join(', ') })]),
        el('div', { class: 'ts-hluti' }, [el('span', { class: 'ts-midi', texti: 'Senda aftur á' }),
          el('ul', { class: 'ts-vidtakendur' }, allir.map((n) => el('li', {}, [el('label', {}, [
            el('input', { type: 'checkbox', checked: valdir.has(n), onchange: (e) => { e.target.checked ? valdir.add(n) : valdir.delete(n); uppfaera(); } }),
            el('span', {}, [el('strong', { texti: n })])
          ])]))),
          ek && ek.netfang ? el('label', { class: 'ts-afrit' }, [
            el('input', { type: 'checkbox', onchange: (e) => { afrit = e.target.checked; uppfaera(); } }),
            document.createTextNode('Senda afrit á mig (' + ek.netfang + ')')
          ]) : null]),
        annad.reitur,
        el('p', { class: 'skyring', texti: 'Pósturinn fer óbreyttur, með sömu kveðju og síðast.' }),
        villa,
        el('div', { class: 'ts-hnappar' }, [el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Loka', onclick: () => d.close() }), sendaHn])
      ]),
      el('div', { class: 'ts-forsyn-svid' }, [el('span', { class: 'ts-midi', texti: 'Svona fór pósturinn' }), forsyn])
    ])
  ]);
  uppfaera();

  sendaHn.addEventListener('click', async () => {
    if (sendir || !annad.baetaInnslaetti()) return;
    const netfong = [...valdir];
    if (afrit && ek && ek.netfang && !netfong.includes(ek.netfang)) netfong.push(ek.netfang);
    if (!netfong.length) return;
    sendir = true; sendaHn.disabled = true; sendaHn.textContent = 'Sendi…'; villa.hidden = true;
    try {
      await g.sendaTolfraedi({ fyrirtaeki_id: fid, netfong, efni: String(s.efni || 'Tölfræðin ykkar · ' + fyrirtaeki).slice(0, 200), html: s.html, texti: s.texti || '' });
      fylla(kort, [el('div', { class: 'ts-sent' }, [
        el('span', { class: 'ts-sent__hak', 'aria-hidden': 'true', texti: '✓' }),
        el('h2', { texti: 'Pósturinn er á leiðinni' }),
        el('p', { texti: 'Til ' + netfong.join(', ') + '.' + (g.prufa ? ' Í sýnidæminu fer ekkert út.' : '') }),
        el('button', { type: 'button', class: 'btn', texti: 'Loka', onclick: () => d.close() })
      ])]);
      if (eftir) eftir();
    } catch (e) {
      sendir = false;
      villa.textContent = e.message || 'Pósturinn fór ekki. Reyndu aftur.'; villa.hidden = false;
      uppfaera();
    }
  });
}
