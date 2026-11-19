/* ==========================================================================
   Stillingar: aðgangurinn, undirskriftin og tengingarnar á einum stað.
   Viðskiptavinur sér bara aðganginn sinn.
   ========================================================================== */

import { gogn, el, fylla, vardaHlid, teiknaHaus, opnaLykilord } from './portal.js';
import { lesaUndirskrift, sjalfgefinUndirskrift, undirskriftHtml, opnaUndirskriftGlugga } from './undirskrift.js';

const ek = await vardaHlid({ badir: true });
if (ek) start();

const MAN = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
const pad = (n) => String(n).padStart(2, '0');
const hvenaer = (s) => { const d = new Date(s); return d.getDate() + '. ' + MAN[d.getMonth()] + ' kl. ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };

async function start() {
  const g = await gogn();
  const admin = ek.hlutverk === 'admin';
  teiknaHaus(ek, 'Stillingar');
  const innihald = document.getElementById('innihald');

  const kafli = (titill, lysing, born) => el('section', { class: 'card pblokk st-kafli' }, [
    el('div', { class: 'st-kafli__haus' }, [el('h2', { texti: titill }), lysing ? el('p', { class: 'skyring', texti: lysing }) : null]),
    ...born
  ]);

  /* ---------- Aðgangurinn ---------- */
  const adgangur = kafli('Aðgangurinn þinn', null, [
    el('dl', { class: 'st-upplysingar' }, [
      el('div', {}, [el('dt', { texti: 'Nafn' }), el('dd', { texti: ek.nafn || '' })]),
      el('div', {}, [el('dt', { texti: 'Netfang' }), el('dd', { texti: ek.netfang || '' })]),
      el('div', {}, [el('dt', { texti: 'Hlutverk' }), el('dd', { texti: admin ? 'Stjórnandi' : 'Viðskiptavinur' + (ek.fyrirtaeki ? ' hjá ' + ek.fyrirtaeki.nafn : '') })])
    ]),
    el('div', { class: 'st-hnappar' }, [
      el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Breyta lykilorði',
        onclick: () => opnaLykilord({ heiti: 'Breyta lykilorði', netfang: ek.netfang }) }),
      el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Skrá út',
        onclick: async () => { await g.utskra(); location.replace('./'); } })
    ])
  ]);

  if (!admin) { fylla(innihald, [siduHaus(), adgangur]); return; }

  /* ---------- Undirskriftin ---------- */
  let undirskrift = await lesaUndirskrift(g, ek);
  const usForsyn = el('div', { class: 'sk-undirsk st-undirsk' });
  const teiknaUs = () => { usForsyn.innerHTML = undirskriftHtml({ ...undirskrift, virk: true }) || '<p class="skyring">Engin undirskrift ennþá.</p>'; };
  teiknaUs();
  const undirskriftKafli = kafli('Undirskrift í pósti', 'Fer neðst í póstana sem þú sendir úr Pósthólfinu. Fylgir aðganginum þínum á milli tækja.', [
    usForsyn,
    el('div', { class: 'st-hnappar' }, [
      el('button', { type: 'button', class: 'btn', texti: 'Breyta undirskrift', onclick: async () => {
        const ny = await opnaUndirskriftGlugga({ g, u: undirskrift, sjalfgefin: sjalfgefinUndirskrift(g, ek) });
        if (ny) { undirskrift = ny; teiknaUs(); }
      } })
    ])
  ]);

  /* ---------- Tengingarnar ---------- */
  const tengingarSvid = el('div', { class: 'st-tengingar' }, [el('p', { class: 'tomt', texti: 'Athuga tengingarnar' })]);
  const tengingarKafli = kafli('Tengingar', 'Öppin sem kerfið talar við. Grænt er tengt og virkar, gult bíður eftir einhverju, grátt kemur seinna.', [tengingarSvid]);

  fylla(innihald, [siduHaus(), adgangur, undirskriftKafli, tengingarKafli]);
  teiknaTengingar(await stadaTenginga());

  function siduHaus() {
    return el('div', { class: 'page-head', style: 'padding-top:0' }, [
      el('h1', { style: 'font-size:clamp(28px,24px+1.3vw,40px)', texti: 'Stillingar' }),
      el('p', { class: 'lead', texti: admin ? 'Aðgangurinn, undirskriftin og öppin sem kerfið er tengt.' : 'Aðgangurinn þinn.' })
    ]);
  }

  /* Staðan sótt úr gögnunum sjálfum, ekki skrifuð inn: breytist þegar tenging kemst á */
  async function stadaTenginga() {
    const s = {};
    /* Gmail: pósthólfið hefur verið samstillt */
    try {
      const thraedir = (g.postholf ? await g.postholf() : []) || [];
      const nyjast = thraedir.reduce((a, t) => (!a || t.sidast > a ? t.sidast : a), null);
      s.gmail = thraedir.length ? ['tengt', thraedir.length + ' þræðir, nýjasti ' + hvenaer(nyjast)] : ['bidur', 'Engir þræðir hafa komið inn ennþá'];
    } catch (e) { s.gmail = ['ekki', 'Pósthólfið er ekki komið upp']; }

    /* Meta: miðlar með auðkenni og hvort sjálfvirkar tölur hafa komið síðustu 3 daga */
    try {
      const fyrirtaeki = (await g.fyrirtaeki()) || [];
      const nu = new Date(), fra = new Date(nu.getTime() - 3 * 864e5);
      const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      let medAudkenni = 0, sjalfvirkt = 0, tiktok = 0;
      for (const f of fyrirtaeki) {
        const midlar = (await g.midlar(f.id).catch(() => [])) || [];
        const meta = midlar.filter((m) => m.midill !== 'tiktok' && m.ytra_id && m.virkt !== false);
        tiktok += midlar.filter((m) => m.midill === 'tiktok').length;
        medAudkenni += meta.length;
        if (meta.length) {
          const ma = (await g.maelingar(f.id, ymd(fra), ymd(nu)).catch(() => [])) || [];
          if (ma.some((r) => r.uppruni === 'sjalfvirkt' && meta.some((m) => m.id === r.midill_id))) sjalfvirkt++;
        }
      }
      s.meta = sjalfvirkt ? ['tengt', 'Tölurnar koma sjálfkrafa á hverjum morgni']
        : medAudkenni ? ['bidur', medAudkenni + (medAudkenni === 1 ? ' miðill hefur' : ' miðlar hafa') + ' auðkenni, en engar sjálfvirkar tölur ennþá']
        : ['ekki', 'Enginn miðill með auðkenni frá Meta'];
      s.tiktok = ['handvirkt', tiktok ? tiktok + (tiktok === 1 ? ' TikTok reikningur, tölurnar skráðar í höndunum' : ' TikTok reikningar, tölurnar skráðar í höndunum') : 'Tölurnar eru skráðar í höndunum'];
    } catch (e) {
      s.meta = ['ekki', 'Náði ekki í miðlana'];
      s.tiktok = ['handvirkt', 'Tölurnar eru skráðar í höndunum'];
    }
    return s;
  }

  function teiknaTengingar(s) {
    const POSTUR = g.prufa ? 'pósthólfi stofunnar' : 'tveir@tveir.is';
    const VERK = g.prufa ? 'verk-netfang stofunnar' : 'verk@tveir.is';
    const PILLUR = { tengt: 'Tengt', bidur: 'Bíður', ekki: 'Ekki tengt', handvirkt: 'Handvirkt', kemur: 'Kemur' };
    const TENGINGAR = [
      { id: 'gmail', heiti: 'Gmail', stafur: 'G', hvad: 'Pósthólfið á Samskiptum og póstar sem fara úr kerfinu',
        stada: s.gmail, slod: 'samskipti.html', slodTexti: 'Opna pósthólfið',
        tharf: 'Tengt í gegnum Apps Script á ' + POSTUR + '. Pósthólfið uppfærist á 5 mínútna fresti og svör fara innan 5 mínútna.' },
      { id: 'verk', heiti: 'Verk-netfangið', stafur: '@', hvad: 'Póstur á ' + VERK + ' verður að verkum á vinnusvæðinu',
        stada: g.prufa ? ['handvirkt', 'Sýnidæmi'] : ['tengt', VERK], tharf: 'Viðskiptavinur sendir póst á ' + VERK + ' og verkið birtist á Stjórnborðinu innan 5 mínútna.' },
      { id: 'meta', heiti: 'Instagram og Facebook', stafur: 'M', hvad: 'Fylgjendur, áhorf og færslur á Tölfræði',
        stada: s.meta, slod: 'tolfraedi.html', slodTexti: 'Opna Tölfræði',
        tharf: 'Þarf Meta app og System User token (META_TOKEN) í Apps Script, og auðkenni hvers miðils á Tölfræði. Þá koma tölurnar sjálfkrafa á hverjum morgni.' },
      { id: 'tiktok', heiti: 'TikTok', stafur: 'T', hvad: 'Tölur á Tölfræði', stada: s.tiktok, slod: 'tolfraedi.html', slodTexti: 'Opna Tölfræði',
        tharf: 'TikTok býður ekki upp á sjálfvirka söfnun fyrir okkur ennþá. Tölurnar eru skráðar í höndunum eða fluttar inn úr CSV.' },
      { id: 'skilabod', heiti: 'Messenger og Instagram skilaboð', stafur: '✉', hvad: 'Skilaboð inn í Samskipti, við hlið Gmail',
        stada: ['kemur', 'Þegar Meta appið er tilbúið'], tharf: 'Þarf sama Meta app og tölfræðin, auk leyfis frá Meta fyrir skilaboðum (App Review, nokkrar vikur).' },
      { id: 'payday', heiti: 'Payday', stafur: 'P', hvad: 'Lokin verk og samningar verða að reikningum',
        stada: g.prufa && bokhaldsKerfi() === 'Payday' ? ['tengt', 'Sýnidæmi'] : ['ekki', 'Ekki tengt'], tharf: 'Þarf API lykil frá Payday (Stillingar > API í Payday). Þá fara reikningar beint úr Bókhaldi.' },
      { id: 'dk', heiti: 'DK', stafur: 'DK', hvad: 'Lokin verk og samningar verða að reikningum',
        stada: g.prufa && bokhaldsKerfi() === 'DK' ? ['tengt', 'Sýnidæmi'] : ['ekki', 'Ekki tengt'], tharf: 'Þarf aðgang að DK vefþjónustunni frá DK hugbúnaði.' },
      { id: 'dagatal', heiti: 'Google Calendar', stafur: '31', hvad: 'Fundir og skiladagar í dagatalinu',
        stada: ['kemur', 'Seinna'], tharf: 'Má tengja í gegnum Apps Script á sama hátt og Gmail, án nýs leyfis frá Google.' }
    ];
    fylla(tengingarSvid, TENGINGAR.map((t) => {
      const [stada, undir] = t.stada || ['ekki', ''];
      const nanar = el('p', { class: 'st-teng__tharf', hidden: true, texti: t.tharf });
      return el('article', { class: 'st-teng st-teng--' + stada }, [
        el('div', { class: 'st-teng__efst' }, [
          el('span', { class: 'st-teng__takn', 'aria-hidden': 'true', texti: t.stafur }),
          el('div', { class: 'st-teng__nafn' }, [el('strong', { texti: t.heiti }), el('span', { texti: t.hvad })]),
          el('span', { class: 'st-pilla st-pilla--' + stada, texti: PILLUR[stada] })
        ]),
        undir ? el('p', { class: 'st-teng__stada', texti: undir }) : null,
        nanar,
        el('div', { class: 'st-teng__fot' }, [
          el('button', { type: 'button', class: 'sk-tengill', texti: 'Hvað þarf?', 'aria-expanded': 'false',
            onclick: (e) => { nanar.hidden = !nanar.hidden; e.currentTarget.setAttribute('aria-expanded', String(!nanar.hidden)); } }),
          t.slod ? el('a', { class: 'btn btn--sm btn--ghost', href: t.slod, texti: t.slodTexti }) : null
        ])
      ]);
    }));
  }

  /* Í Glerhúsinu: bókhaldskerfið sem var valið í "Settu saman" */
  function bokhaldsKerfi() {
    try { const x = JSON.parse(localStorage.getItem('glerhusid-byggja') || 'null'); const t = (x && x.tengingar) || []; return t.includes('payday') ? 'Payday' : t.includes('dk') ? 'DK' : null; }
    catch (e) { return null; }
  }
}
