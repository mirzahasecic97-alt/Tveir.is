// ==========================================================================
// Supabase Edge Function: shopify
//
// Verslunarsíðan (verslun.html) og spjaldið "Sala síðustu 30 daga" á
// yfirlitinu kalla á þetta. Fallið les Shopify lykla stofunnar úr Vault,
// sækir aðgangstoken og les pantanir, vörur og lagerstöðu úr Shopify Admin
// GraphQL. Bara lestur, aldrei skrifað í verslunina. Tokeninn fer aldrei út
// á síðuna.
//
// Hver kallar: bara stjórnandi í virkri stofu (min_stada með JWT notandans).
// stofa_id er aldrei lesið úr beiðninni.
//
// Beiðni (POST JSON):
//   { verk: 'yfirlit' | 'pantanir' | 'vorur' | 'lager', eftir?: <cursor> }
// Svör:
//   yfirlit:  { ok, verk, verslun, nafn, gjaldmidill, fra, samtals30, fjoldi30, takmarkad }
//   pantanir: { ok, verk, verslun, pantanir: [{ id, nafn, stofnad, greidsla, afgreidsla,
//               upphaed, gjaldmidill, linur: [{ titill, magn }], slod }], meira, eftir }
//   vorur / lager: { ok, verk, verslun, vorur: [{ id, titill, stada, birgdir, mynd,
//               afbrigdi: [{ sku, titill, verd, birgdir }], slod }], meira, eftir, hamark? }
//   villa:    { ok: false, svar: '<íslenska>', kodi?: 'adgangur' | 'pantanir' | 'vorur' |
//               'shop_not_permitted' | 'ekki_tengt' | 'bida' | 'samband' }
//
// Token: ef tengingar.stillingar.oauth er sett er notaður offline tokeninn
// (access_token í Vault, vistaður af oauth fallinu). Annars client
// credentials eins og í profa-tengingu.ts. Geymdur í Map lykluðu með
// stofa_id + ':' + verslun þar til 5 mínútum fyrir expires_in.
//
// Uppsetning: Supabase > Edge Functions > Deploy a new function > Via
// Editor, nafn shopify, líma þessa skrá inn. Verify JWT: ON. Engin
// leyndarmál þarf að setja inn.
// ==========================================================================

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const LEYFT = ['https://tveir.is', 'https://www.tveir.is', 'https://glerhusid.vercel.app'];
const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': LEYFT.includes(req.headers.get('Origin') || '') ? req.headers.get('Origin')! : LEYFT[0],
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
});

type Svar = Record<string, unknown>;
type Ek = { stofa_id: string; stada: string; er_admin: boolean };

const UTGAFA = '2026-07';
const BID = 15000;
const VERSLUN = /^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/;
const BENDILL = /^[A-Za-z0-9+/=_-]{1,600}$/;
const saekja = (slod: string, valkostir: RequestInit = {}) => fetch(slod, { ...valkostir, signal: AbortSignal.timeout(BID) });

/* Villa sem á að fara beint til notandans */
class Bod extends Error {
  kodi: string;
  constructor(svar: string, kodi = '') { super(svar); this.kodi = kodi; }
}

const TEXTI = {
  tenging: 'Shopify tók ekki við tengingunni. Prófaðu hana aftur í Stillingum.',
  pantanir: 'Appið vantar aðgang að pöntunum (read_orders og aðgang að viðskiptavinagögnum í Dev Dashboard).',
  vorur: 'Appið vantar aðgang að vörum og lager (read_products og read_inventory).',
  oauth: 'Appið þarf að vera búið til með sama Shopify aðgangi og verslunin sjálf.',
  bida: 'Shopify bað okkur að bíða. Prófaðu aftur eftir smá stund.',
  samband: 'Náði ekki sambandi við Shopify. Prófaðu aftur eftir smá stund.'
};

// ==== token cache
// Lykill: stofa_id + ':' + verslun. Aldrei ein breyta fyrir alla, aldrei
// sendur út. fingur = fyrstu stafir clientId, svo nýr lykill í Stillingum
// fær nýjan token strax.
type Geymdur = { tokinn: string; rennur: number; fingur: string };
const TOKNAR = new Map<string, Geymdur>();

function hreinsaToknar() {
  if (TOKNAR.size < 300) return;
  const nu = Date.now();
  for (const [k, v] of TOKNAR) if (v.rennur <= nu) TOKNAR.delete(k);
}

async function clientCredentials(stofa: string, verslun: string, lyklar: Record<string, string>): Promise<{ tokinn: string; ur_geymslu: boolean }> {
  const lykill = stofa + ':' + verslun;
  const fingur = String(lyklar.clientId || '').slice(0, 12);
  const til = TOKNAR.get(lykill);
  if (til && til.rennur > Date.now() && til.fingur === fingur) return { tokinn: til.tokinn, ur_geymslu: true };

  const t = await saekja('https://' + verslun + '/admin/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: lyklar.clientId || '', client_secret: lyklar.clientSecret || '' })
  });
  if (!t.ok) {
    const texti = await t.text().catch(() => '');
    if (/shop_not_permitted/i.test(texti)) throw new Bod(TEXTI.oauth, 'shop_not_permitted');
    if (t.status === 429) throw new Bod(TEXTI.bida, 'bida');
    if (t.status >= 500) throw new Bod(TEXTI.samband, 'samband');
    throw new Bod(TEXTI.tenging, 'adgangur');
  }
  const d = await t.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
  if (!d || !d.access_token) throw new Bod(TEXTI.tenging, 'adgangur');
  // expires_in í sekúndum (um 24 klst). 5 mínútna öryggisbil, minnst 1 mínúta.
  const sek = Number(d.expires_in) > 0 ? Number(d.expires_in) : 3600;
  hreinsaToknar();
  TOKNAR.set(lykill, { tokinn: d.access_token, rennur: Date.now() + Math.max(60, sek - 300) * 1000, fingur });
  return { tokinn: d.access_token, ur_geymslu: false };
}

// ==== svarcache
// Stutt geymsla á svörum (30 sekúndur) svo að flakk á milli flipa keyri ekki
// sömu fyrirspurn aftur og aftur. Lykluð með stofu, verslun, verki og bendli.
const SVOR = new Map<string, { rennur: number; svar: Svar }>();
const SVAR_TIMI = 30000;
function geymaSvar(lykill: string, svar: Svar) {
  if (SVOR.size > 300) {
    const nu = Date.now();
    for (const [k, v] of SVOR) if (v.rennur <= nu) SVOR.delete(k);
    if (SVOR.size > 300) SVOR.clear();
  }
  SVOR.set(lykill, { rennur: Date.now() + SVAR_TIMI, svar });
}

// ==== GraphQL
type Gql = { data?: Record<string, any>; errors?: { message?: string; extensions?: { code?: string } }[] };

async function gql(verslun: string, tokinn: string, query: string, variables: Record<string, unknown>, svid: 'pantanir' | 'vorur'): Promise<Record<string, any>> {
  const r = await saekja('https://' + verslun + '/admin/api/' + UTGAFA + '/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': tokinn },
    body: JSON.stringify({ query, variables })
  });
  if (r.status === 401 || r.status === 403) throw new Bod(TEXTI.tenging, 'adgangur');
  if (r.status === 429) throw new Bod(TEXTI.bida, 'bida');
  if (!r.ok) throw new Bod(TEXTI.samband, 'samband');
  const d = await r.json().catch(() => null) as Gql | null;
  if (!d) throw new Bod(TEXTI.samband, 'samband');
  if (d.errors && d.errors.length) {
    const kodar = d.errors.map((e) => String((e.extensions && e.extensions.code) || ''));
    const texti = d.errors.map((e) => String(e.message || '')).join(' ');
    if (kodar.includes('THROTTLED')) throw new Bod(TEXTI.bida, 'bida');
    if (kodar.includes('ACCESS_DENIED') || /access denied|not approved to access/i.test(texti)) {
      throw svid === 'pantanir' ? new Bod(TEXTI.pantanir, 'pantanir') : new Bod(TEXTI.vorur, 'vorur');
    }
    // Annað: ekki senda texta Shopify út, bara almenna villu
    console.error('shopify graphql', kodar.join(','), texti.slice(0, 300));
    throw new Bod('Shopify svaraði með villu. Prófaðu aftur eftir smá stund.', 'samband');
  }
  if (!d.data) throw new Bod(TEXTI.samband, 'samband');
  return d.data;
}

/* Fyrirspurnirnar, bara lestur. Engin viðskiptavinagögn í pöntunum. */
const Q_PANTANIR = `query Pantanir($eftir: String) {
  orders(first: 50, sortKey: CREATED_AT, reverse: true, after: $eftir) {
    nodes {
      id name createdAt displayFinancialStatus displayFulfillmentStatus
      totalPriceSet { shopMoney { amount currencyCode } }
      lineItems(first: 5) { nodes { title quantity } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

// 25 vörur í senn: 50 vörur með 20 afbrigðum fara yfir 1000 punkta
// kostnaðarþak Shopify á eina fyrirspurn.
const Q_VORUR = `query Vorur($eftir: String, $leit: String, $rodun: ProductSortKeys) {
  products(first: 25, after: $eftir, query: $leit, sortKey: $rodun) {
    nodes {
      id title status totalInventory tracksInventory
      featuredMedia { preview { image { url } } }
      variants(first: 20) { nodes { sku title price inventoryQuantity } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const Q_YFIRLIT = `query Yfirlit($eftir: String, $leit: String!) {
  shop { name currencyCode }
  orders(first: 250, after: $eftir, query: $leit) {
    nodes { cancelledAt totalPriceSet { shopMoney { amount } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const tala = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
const tolustafir = (gid: unknown) => { const m = /(\d+)$/.exec(String(gid || '')); return m ? m[1] : ''; };
const httpsEda = (x: unknown) => (typeof x === 'string' && /^https:\/\/\S+$/.test(x) ? x : null);

async function pantanir(verslun: string, tokinn: string, eftir: string | null): Promise<Svar> {
  const d = await gql(verslun, tokinn, Q_PANTANIR, { eftir }, 'pantanir');
  const tenging = d.orders || { nodes: [], pageInfo: {} };
  const verslunarHandfang = verslun.replace(/\.myshopify\.com$/, '');
  return {
    pantanir: (tenging.nodes || []).map((p: any) => ({
      id: String(p.id || ''),
      nafn: String(p.name || ''),
      stofnad: p.createdAt || null,
      greidsla: p.displayFinancialStatus || null,
      afgreidsla: p.displayFulfillmentStatus || null,
      upphaed: tala(p.totalPriceSet && p.totalPriceSet.shopMoney && p.totalPriceSet.shopMoney.amount),
      gjaldmidill: (p.totalPriceSet && p.totalPriceSet.shopMoney && p.totalPriceSet.shopMoney.currencyCode) || null,
      linur: ((p.lineItems && p.lineItems.nodes) || []).map((l: any) => ({ titill: String(l.title || ''), magn: tala(l.quantity) })),
      slod: tolustafir(p.id) ? 'https://admin.shopify.com/store/' + verslunarHandfang + '/orders/' + tolustafir(p.id) : null
    })),
    meira: !!(tenging.pageInfo && tenging.pageInfo.hasNextPage),
    eftir: (tenging.pageInfo && tenging.pageInfo.hasNextPage && tenging.pageInfo.endCursor) || null
  };
}

async function vorur(verslun: string, tokinn: string, eftir: string | null, hamark: number | null): Promise<Svar> {
  const breytur: Record<string, unknown> = { eftir, leit: null, rodun: null };
  // Lager: bara virkar vörur. Vörur sem fylgjast ekki með lager (þjónusta,
  // stafrænar vörur) sýna alltaf 0 og eru teknar út hér að neðan.
  if (hamark !== null) { breytur.leit = 'status:active AND inventory_total:<=' + hamark; breytur.rodun = 'INVENTORY_TOTAL'; }
  const d = await gql(verslun, tokinn, Q_VORUR, breytur, 'vorur');
  const tenging = d.products || { nodes: [], pageInfo: {} };
  const verslunarHandfang = verslun.replace(/\.myshopify\.com$/, '');
  const svar: Svar = {
    vorur: (tenging.nodes || []).filter((v: any) => hamark === null || v.tracksInventory !== false).map((v: any) => ({
      id: String(v.id || ''),
      titill: String(v.title || ''),
      stada: v.status || null,
      birgdir: v.totalInventory === null || v.totalInventory === undefined ? null : tala(v.totalInventory),
      mynd: httpsEda(v.featuredMedia && v.featuredMedia.preview && v.featuredMedia.preview.image && v.featuredMedia.preview.image.url),
      afbrigdi: ((v.variants && v.variants.nodes) || []).map((a: any) => ({
        sku: a.sku || null,
        titill: String(a.title || ''),
        verd: tala(a.price),
        birgdir: a.inventoryQuantity === null || a.inventoryQuantity === undefined ? null : tala(a.inventoryQuantity)
      })),
      slod: tolustafir(v.id) ? 'https://admin.shopify.com/store/' + verslunarHandfang + '/products/' + tolustafir(v.id) : null
    })),
    meira: !!(tenging.pageInfo && tenging.pageInfo.hasNextPage),
    eftir: (tenging.pageInfo && tenging.pageInfo.hasNextPage && tenging.pageInfo.endCursor) || null
  };
  if (hamark !== null) svar.hamark = hamark;
  return svar;
}

async function yfirlit(verslun: string, tokinn: string): Promise<Svar> {
  const fra = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  let eftir: string | null = null;
  let samtals = 0, fjoldi = 0, takmarkad = false, nafn = '', gjaldmidill = '';
  for (let sida = 0; sida < 4; sida++) {
    let d: Record<string, any>;
    try {
      d = await gql(verslun, tokinn, Q_YFIRLIT, { eftir, leit: 'created_at:>=' + fra }, 'pantanir');
    } catch (e) {
      // Shopify bað um hlé eftir fyrstu síðu: skila því sem komið er, merkt takmarkað
      if (sida > 0 && e instanceof Bod && e.kodi === 'bida') { takmarkad = true; break; }
      throw e;
    }
    if (d.shop) { nafn = String(d.shop.name || ''); gjaldmidill = String(d.shop.currencyCode || ''); }
    const t = d.orders || { nodes: [], pageInfo: {} };
    for (const p of t.nodes || []) {
      if (p.cancelledAt) continue;            // afpantaðar pantanir teljast ekki sem sala
      samtals += tala(p.totalPriceSet && p.totalPriceSet.shopMoney && p.totalPriceSet.shopMoney.amount);
      fjoldi += 1;
    }
    const meira = !!(t.pageInfo && t.pageInfo.hasNextPage);
    if (!meira) { takmarkad = false; break; }
    eftir = t.pageInfo.endCursor || null;
    takmarkad = true;
    if (!eftir) break;
  }
  return { nafn, gjaldmidill, fra, samtals30: Math.round(samtals * 100) / 100, fjoldi30: fjoldi, takmarkad };
}

// ==== þjónninn
Deno.serve(async (req) => {
  const CORS = cors(req);
  const svara = (gogn: Svar, stada = 200) =>
    new Response(JSON.stringify(gogn), { status: stada, headers: { ...CORS, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return svara({ ok: false, svar: 'Bara POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const notandi = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    auth: { persistSession: false }
  });
  const { data: stadaGogn, error: stadaVilla } = await notandi.rpc('min_stada');
  const ek = (Array.isArray(stadaGogn) ? stadaGogn[0] : stadaGogn) as Ek | null;
  if (stadaVilla || !ek || ek.stada !== 'virk' || ek.er_admin !== true || !ek.stofa_id) {
    return svara({ ok: false, svar: 'Bara stjórnendur geta skoðað verslunina' }, 403);
  }

  const inn = await req.json().catch(() => ({})) as { verk?: unknown; eftir?: unknown };
  const verk = String(inn.verk || 'yfirlit');
  if (!['yfirlit', 'pantanir', 'vorur', 'lager'].includes(verk)) return svara({ ok: false, svar: 'Óþekkt aðgerð' }, 400);
  let eftir: string | null = null;
  if (inn.eftir !== undefined && inn.eftir !== null && inn.eftir !== '') {
    if (typeof inn.eftir !== 'string' || !BENDILL.test(inn.eftir)) return svara({ ok: false, svar: 'Ógildur bendill' }, 400);
    eftir = verk === 'yfirlit' ? null : inn.eftir;
  }

  const bak = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const [{ data: lyklar, error: lVilla }, { data: lina, error: tVilla }, { data: ks }] = await Promise.all([
    bak.rpc('tenging_lykill', { p_stofa: ek.stofa_id, p_veita: 'shopify' }),
    bak.from('tengingar').select('stillingar').eq('stofa_id', ek.stofa_id).eq('veita', 'shopify').maybeSingle(),
    // Notendaklientinn: RLS sannar að línan sé stofunnar. eq á stofa_id líka,
    // því fyrir veggina (skref 5) les hver innskráður allar línur.
    verk === 'lager'
      ? notandi.from('kerfisstillingar').select('gildi').eq('stofa_id', ek.stofa_id).eq('lykill', 'lager_vidvorun').maybeSingle()
      : Promise.resolve({ data: null })
  ]);
  if (lVilla || tVilla) {
    // Ekki segja "ekki tengt" þegar lesturinn sjálfur klikkaði
    console.error('shopify lyklar', (lVilla && lVilla.message) || '', (tVilla && tVilla.message) || '');
    return svara({ ok: false, svar: 'Náði ekki að lesa Shopify tenginguna. Prófaðu aftur eftir smá stund.', kodi: 'samband' }, 500);
  }
  if (!lyklar || !lina) return svara({ ok: false, svar: 'Shopify er ekki tengt. Tengdu verslunina í Stillingum.', kodi: 'ekki_tengt' }, 404);

  const stillingar = ((lina as { stillingar?: Record<string, unknown> }).stillingar || {}) as Record<string, unknown>;
  const k = lyklar as Record<string, string>;
  const verslun = String(stillingar.verslun || '');
  if (!VERSLUN.test(verslun)) return svara({ ok: false, svar: 'Slóð verslunarinnar á að vera á forminu nafn.myshopify.com', kodi: 'ekki_tengt' }, 400);

  let hamark: number | null = null;
  if (verk === 'lager') {
    const g = String((ks && (ks as { gildi?: string }).gildi) || '');
    hamark = /^[0-9]{1,4}$/.test(g) ? Number(g) : 5;
  }

  const geymslulykill = [ek.stofa_id, verslun, verk, eftir || '', hamark === null ? '' : hamark].join('|');
  const geymt = SVOR.get(geymslulykill);
  if (geymt && geymt.rennur > Date.now()) return svara(geymt.svar);

  const oauth = !!stillingar.oauth;
  const keyra = async (tokinn: string): Promise<Svar> => {
    if (verk === 'pantanir') return await pantanir(verslun, tokinn, eftir);
    if (verk === 'vorur') return await vorur(verslun, tokinn, eftir, null);
    if (verk === 'lager') return await vorur(verslun, tokinn, eftir, hamark);
    return await yfirlit(verslun, tokinn);
  };

  try {
    let nidurstada: Svar;
    if (oauth) {
      if (!k.access_token) return svara({ ok: false, svar: TEXTI.tenging, kodi: 'adgangur' });
      nidurstada = await keyra(k.access_token);
    } else {
      const t = await clientCredentials(ek.stofa_id, verslun, k);
      try {
        nidurstada = await keyra(t.tokinn);
      } catch (e) {
        // Geymdur token sem Shopify hætti að taka við: henda honum og sækja
        // nýjan einu sinni. Nýsóttum token er ekki reynt aftur.
        if (!(e instanceof Bod) || e.kodi !== 'adgangur' || !t.ur_geymslu) throw e;
        TOKNAR.delete(ek.stofa_id + ':' + verslun);
        nidurstada = await keyra((await clientCredentials(ek.stofa_id, verslun, k)).tokinn);
      }
    }
    const svar: Svar = { ok: true, verk, verslun, ...nidurstada };
    geymaSvar(geymslulykill, svar);
    return svara(svar);
  } catch (e) {
    if (e instanceof Bod) return svara({ ok: false, svar: e.message, kodi: e.kodi });
    const timi = (e as Error).name === 'TimeoutError';
    if (!timi) console.error('shopify', (e as Error).message);
    return svara({ ok: false, svar: timi ? 'Shopify svaraði ekki innan 15 sekúndna. Prófaðu aftur.' : TEXTI.samband, kodi: 'samband' });
  }
});
