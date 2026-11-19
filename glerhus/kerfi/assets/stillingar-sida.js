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
  const tengingarSvid = el('div', { class: 'st-teng-svid' }, [el('p', { class: 'tomt', texti: 'Athuga tengingarnar' })]);
  const tengingarKafli = kafli('Tengingar', 'Öppin sem kerfið talar við. Ýttu á Tengja til að sjá hvað hver tenging gerir og hvað þarf til.', [tengingarSvid]);

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

    /* Google Calendar: fundir hafa komið inn */
    try {
      const atb = (g.dagatal ? await g.dagatal() : null);
      s.dagatal = atb === null ? ['ekki', 'Dagatalið er ekki komið upp']
        : atb.length ? ['tengt', atb.length + (atb.length === 1 ? ' fundur' : ' fundir') + ' á næstu vikum'] : ['bidur', 'Bíður eftir fyrstu samstillingu'];
    } catch (e) { s.dagatal = ['ekki', 'Dagatalið er ekki komið upp']; }

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
    const KEMUR = ['kemur', ''];
    const EKKI = ['ekki', ''];
    const bok = bokhaldsKerfi();
    /* merki: skrá í assets/tengingar. litur: bakgrunnur flísarinnar. ljos: merkið er í lit á hvítu, annars hvítt á lit */
    const HOPAR = [
      ['Póstur og dagatal', [
        { heiti: 'Gmail', merki: 'gmail.svg', litur: '#EA4335', hvad: 'Pósthólfið á Samskiptum og póstar úr kerfinu', stada: s.gmail, slod: 'samskipti.html',
          tharf: 'Tengt í gegnum Apps Script á ' + POSTUR + '. Uppfærist á 5 mínútna fresti.' },
        { heiti: 'Verk-netfangið', stafur: '@', litur: '#1c3050', hvad: 'Póstur á ' + VERK + ' verður að verkum', stada: g.prufa ? ['handvirkt', 'Sýnidæmi'] : ['tengt', VERK],
          tharf: 'Viðskiptavinur sendir póst á ' + VERK + ' og verkið birtist á Stjórnborðinu innan 5 mínútna.' },
        { heiti: 'Google Calendar', merki: 'googlecalendar.svg', litur: '#4285F4', hvad: 'Fundirnir þínir á Dagatalinu, við hlið skiladaga', stada: s.dagatal, slod: 'dagatal.html',
          tharf: 'Tengt í gegnum sömu Apps Script skrift og Gmail. Dagatalið uppfærist á 5 mínútna fresti.' }
      ]],
      ['Samfélagsmiðlar', [
        { heiti: 'Instagram', merki: 'instagram.svg', litur: '#E4405F', hvad: 'Fylgjendur, áhorf og færslur á Tölfræði', stada: s.meta, slod: 'tolfraedi.html',
          tharf: 'Þarf Meta app og System User token (META_TOKEN) í Apps Script, og auðkenni reikningsins á Tölfræði.' },
        { heiti: 'Facebook', merki: 'facebook.svg', litur: '#0866FF', hvad: 'Áhorf og fylgjendur síðunnar á Tölfræði', stada: s.meta, slod: 'tolfraedi.html',
          tharf: 'Sama Meta app og Instagram. Page ID síðunnar fer á Tölfræði.' },
        { heiti: 'TikTok', merki: 'tiktok.svg', litur: '#000000', hvad: 'Tölur á Tölfræði', stada: s.tiktok, slod: 'tolfraedi.html',
          tharf: 'TikTok leyfir ekki sjálfvirka söfnun fyrir okkur ennþá. Tölurnar eru skráðar í höndunum eða úr CSV.' },
        { heiti: 'Messenger', merki: 'messenger.svg', litur: '#00B2FF', hvad: 'Skilaboð inn í Samskipti', stada: KEMUR, tharf: 'Sama Meta app, auk leyfis Meta fyrir skilaboðum (App Review, nokkrar vikur).' },
        { heiti: 'Instagram skilaboð', merki: 'instagram.svg', litur: '#C13584', hvad: 'DM inn í Samskipti', stada: KEMUR, tharf: 'Sama Meta app og leyfi og Messenger.' }
      ]],
      ['Bókhald', [
        { heiti: 'Payday', merki: 'payday.svg', litur: '#ffffff', ljos: true, hvad: 'Lokin verk og samningar verða að reikningum',
          stada: g.prufa && bok === 'Payday' ? ['tengt', 'Sýnidæmi'] : EKKI, tharf: 'Þarf API lykil úr Payday (Stillingar > API). Þá fara reikningar beint úr Bókhaldi.' },
        { heiti: 'DK', merki: 'dk.png', litur: '#4743f7', hvad: 'Lokin verk og samningar verða að reikningum',
          stada: g.prufa && bok === 'DK' ? ['tengt', 'Sýnidæmi'] : EKKI, tharf: 'Þarf aðgang að vefþjónustu DK frá dk hugbúnaði.' }
      ]],
      ['Vefur og skrár', [
        { heiti: 'Google Analytics', merki: 'googleanalytics.svg', litur: '#E37400', hvad: 'Heimsóknir á vef viðskiptavinarins á Tölfræði', stada: KEMUR, tharf: 'Má tengja í gegnum Google. Viðskiptavinurinn gefur okkur lesaðgang að sínu Analytics.' },
        { heiti: 'WeTransfer', merki: 'wetransfer.svg', litur: '#409FFF', hvad: 'Hlekkir á undirverkum', stada: ['tengt', 'Hlekkir virka beint á undirverkum'], tharf: 'Engin tenging þarf: límdu WeTransfer hlekkinn á undirverkið og viðskiptavinurinn fær hann í pósti.' }
      ]]
    ];

    const takn = (t) => el('span', { class: 'st-teng__takn' + (t.ljos ? ' er-ljos' : ''), style: 'background:' + t.litur, 'aria-hidden': 'true' },
      [t.merki ? el('img', { src: 'assets/tengingar/' + t.merki, alt: '', loading: 'lazy' }) : document.createTextNode(t.stafur || t.heiti[0])]);

    const fjoldi = HOPAR.reduce((a, [, l]) => a + l.length, 0);
    const tengd = HOPAR.reduce((a, [, l]) => a + l.filter((t) => (t.stada || [])[0] === 'tengt').length, 0);
    fylla(tengingarSvid, [
      el('p', { class: 'st-teng-yfirlit', texti: tengd + ' af ' + fjoldi + ' tengt' }),
      ...HOPAR.map(([heiti, listi]) => el('div', { class: 'st-teng-hopur' }, [
        el('h3', { texti: heiti }),
        el('div', { class: 'st-tengingar' }, listi.map((t) => {
          const [stada, undir] = t.stada || EKKI;
          return el('article', { class: 'st-teng st-teng--' + stada }, [
            el('div', { class: 'st-teng__efst' }, [
              takn(t),
              el('div', { class: 'st-teng__nafn' }, [el('strong', { texti: t.heiti }), el('span', { texti: t.hvad })]),
              el('span', { class: 'st-pilla st-pilla--' + stada, texti: PILLUR[stada] })
            ]),
            undir ? el('p', { class: 'st-teng__stada', texti: undir }) : null,
            el('div', { class: 'st-teng__fot' }, [
              stada === 'tengt' && t.slod
                ? el('a', { class: 'btn btn--sm btn--ghost', href: t.slod, texti: 'Opna' })
                : el('button', { type: 'button', class: 'btn btn--sm' + (stada === 'tengt' ? ' btn--ghost' : ''), texti: stada === 'tengt' ? 'Nánar' : 'Tengja',
                    onclick: () => opnaTengingu(t, stada, takn) })
            ])
          ]);
        }))
      ]))
    ]);
  }

  /* Tengja: hvað tengingin gerir, staðan og hvað þarf til */
  function opnaTengingu(t, stada, takn) {
    const kort = el('div', { class: 'pdialog__kort' });
    const d = el('dialog', { class: 'pdialog', 'aria-labelledby': 'st-t-h' }, [kort]);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => d.remove());
    const TEXTI = {
      tengt: 'Þetta er tengt og virkar.',
      bidur: 'Tengingin er hálfnuð og bíður eftir einu skrefi.',
      handvirkt: 'Hér eru tölurnar skráðar í höndunum.',
      ekki: 'Þetta er ekki tengt ennþá.',
      kemur: 'Þessi tenging er á listanum og kemur seinna.'
    };
    fylla(kort, [
      el('div', { class: 'pdialog__haus' }, [
        el('div', { class: 'st-t__haus' }, [takn(t), el('h2', { id: 'st-t-h', texti: t.heiti })]),
        el('button', { type: 'button', class: 'loka', 'aria-label': 'Loka', texti: '✕', onclick: () => d.close() })
      ]),
      el('p', { class: 'st-t__hvad', texti: t.hvad + '.' }),
      el('p', { class: 'st-t__stada st-t__stada--' + stada, texti: TEXTI[stada] || '' }),
      el('div', { class: 'st-t__tharf' }, [el('strong', { texti: 'Hvað þarf til' }), el('p', { texti: t.tharf })]),
      el('div', { class: 'spjald__fot' }, [
        t.slod ? el('a', { class: 'btn', href: t.slod, texti: 'Opna' }) : null,
        el('button', { type: 'button', class: 'btn btn--ghost', texti: 'Loka', onclick: () => d.close() })
      ])
    ]);
    document.body.append(d);
    d.showModal();
  }

  /* Í Glerhúsinu: bókhaldskerfið sem var valið í "Settu saman" */
  function bokhaldsKerfi() {
    try { const x = JSON.parse(localStorage.getItem('glerhusid-byggja') || 'null'); const t = (x && x.tengingar) || []; return t.includes('payday') ? 'Payday' : t.includes('dk') ? 'DK' : null; }
    catch (e) { return null; }
  }
}
