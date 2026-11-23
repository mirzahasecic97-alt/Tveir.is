// ==========================================================================
// Supabase Edge Function: oauth
//
// Tengir Google, Meta, TikTok og (sem varaleið) Shopify við stofu með
// OAuth. Tilbúið en slökkt: Google, Meta og TikTok neita þar til
// stillingar_innri.google_tilbuid (meta_tilbuid, tiktok_tilbuid) = 'ja',
// sem min_stada skilar sem google_tilbuid o.s.frv. Shopify er alltaf leyft
// (varaleið fyrir verslanir þar sem client credentials skilar
// shop_not_permitted).
//
// Skref 1, byrja (JWT stjórnanda, POST eða GET):
//   oauth?skref=byrja&veita=google|meta|tiktok|shopify
//   -> { ok: true, slod: '<samþykkisslóð veitunnar>' }
//   Geymir sha256(state) og PKCE verifier í oauth_stada (10 mínútur, eitt skipti).
// Skref 2, til-baka (veitan sendir vafrann hingað, enginn JWT):
//   oauth?skref=til-baka&code=...&state=...
//   -> 302 á https://tveir.is/glerhus/kerfi/stillingar.html?tengt=<veita>
//      eða ?ekki_tengt=<veita>&astaeda=<kodi> ef eitthvað klikkaði.
//   Tokenarnir fara í Vault með vista_oauth_tengingu, aldrei á síðuna.
//
// Uppsetning: Supabase > Edge Functions > Deploy a new function > Via
// Editor, nafn oauth, líma þessa skrá inn. Details > Verify JWT: OFF (veitan
// kallar á til-baka án JWT; byrja sannar notandann sjálft með min_stada).
// Secrets (bara í Supabase, aldrei í skrá): GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, META_APP_ID, META_APP_SECRET, TIKTOK_CLIENT_KEY,
// TIKTOK_CLIENT_SECRET. Vantar secret: veitan neitar. Shopify notar Client
// ID og Client secret stofunnar sjálfrar úr Vault.
// Slóðin sem er skráð hjá Google, Meta og í "Allowed redirection URLs" í
// Shopify appinu: https://<verkefni>.supabase.co/functions/v1/oauth?skref=til-baka
// Hjá TikTok (leyfir ekki query breytur): https://<verkefni>.supabase.co/functions/v1/oauth
// ==========================================================================

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const LEYFT = ['https://tveir.is', 'https://www.tveir.is', 'https://glerhusid.vercel.app'];
const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': LEYFT.includes(req.headers.get('Origin') || '') ? req.headers.get('Origin')! : LEYFT[0],
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
});

const STILLINGAR = 'https://tveir.is/glerhus/kerfi/stillingar.html';
const BID = 15000;
const GILDISTIMI = 10 * 60 * 1000;
const VERSLUN = /^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/;
const META_UTGAFA = 'v23.0';
const saekja = (slod: string, valkostir: RequestInit = {}) => fetch(slod, { ...valkostir, signal: AbortSignal.timeout(BID) });

type Veita = 'google' | 'meta' | 'tiktok' | 'shopify';
const VEITUR: Veita[] = ['google', 'meta', 'tiktok', 'shopify'];
type Ek = { stofa_id: string; stada: string; er_admin: boolean; google_tilbuid: boolean; meta_tilbuid: boolean; tiktok_tilbuid: boolean };
type Lina = { state_hash: string; stofa_id: string; veita: Veita; notandi: string | null; pkce: string | null };
type Vista = { stillingar: Record<string, unknown>; leyndo: Record<string, string>; prufa?: string };

const SCOPE = {
  google: 'openid email https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/analytics.readonly',
  meta: 'pages_show_list,pages_read_engagement,read_insights,instagram_basic,instagram_manage_insights,business_management',
  tiktok: 'user.info.basic,user.info.stats,video.list',
  shopify: 'read_products,read_inventory,read_orders'
};

class Bod extends Error {
  kodi: string;
  constructor(svar: string, kodi: string) { super(svar); this.kodi = kodi; }
}

// ==== hjálparföll
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const handahof = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const env = (nafn: string) => Deno.env.get(nafn) || '';

/* Samanburður sem tekur alltaf jafn langan tíma (lengdin er ekki leyndarmál) */
function jafnt(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let munur = 0;
  for (let i = 0; i < a.length; i++) munur |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return munur === 0;
}

async function hmacHex(lykill: string, texti: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(lykill), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texti)));
}

/* Shopify: HMAC-SHA256 af röðuðum query breytum án hmac (og signature).
   Prófað bæði með og án skref breytunnar okkar, því hún er hluti af
   redirect_uri og ekki víst að Shopify telji hana með, og bæði með gildunum
   eins og þau koma og URL kóðuðum (host er base64 og getur innihaldið =).
   Allar útgáfurnar krefjast client secret stofunnar. */
async function shopifyHmacOk(params: URLSearchParams, leyndo: string): Promise<boolean> {
  const fengid = (params.get('hmac') || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(fengid)) return false;
  const radad = (an: string[]) => [...params.entries()]
    .filter(([k]) => !an.includes(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const utgafur = new Set<string>();
  for (const an of [['hmac', 'signature'], ['hmac', 'signature', 'skref']]) {
    const r = radad(an);
    utgafur.add(r.map(([k, v]) => k + '=' + v).join('&'));
    utgafur.add(new URLSearchParams(r).toString());
  }
  let ok = false;
  for (const u of utgafur) if (jafnt(await hmacHex(leyndo, u), fengid)) ok = true;
  return ok;
}

function jwtInnihald(jwt: string): Record<string, unknown> {
  try {
    const hluti = jwt.split('.')[1] || '';
    const s = atob(hluti.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((hluti.length + 3) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0))));
  } catch { return {}; }
}

/* Slóðin sem veitan sendir vafrann til baka á. TikTok leyfir engar query
   breytur í redirect_uri, svo þar er hún án ?skref=til-baka (til-baka þekkist
   þá á code eða error). Sama slóð er notuð í byrja og í skiptunum á kóða. */
const tilBaka = (veita: Veita) => env('SUPABASE_URL').replace(/\/+$/, '') + '/functions/v1/oauth' + (veita === 'tiktok' ? '' : '?skref=til-baka');

function aframsenda(veita: string, kodi: string | null): Response {
  const v = VEITUR.includes(veita as Veita) ? veita : 'oauth';
  const slod = kodi ? STILLINGAR + '?ekki_tengt=' + encodeURIComponent(v) + '&astaeda=' + encodeURIComponent(kodi)
                    : STILLINGAR + '?tengt=' + encodeURIComponent(v);
  return new Response(null, { status: 302, headers: { Location: slod, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

// ==== byrja
async function byrja(req: Request, veitaInn: string, bak: any, svara: (g: Record<string, unknown>, s?: number) => Response) {
  const notandi = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    auth: { persistSession: false }
  });
  const { data, error } = await notandi.rpc('min_stada');
  const ek = (Array.isArray(data) ? data[0] : data) as Ek | null;
  if (error || !ek || ek.stada !== 'virk' || ek.er_admin !== true || !ek.stofa_id) {
    return svara({ ok: false, svar: 'Bara stjórnendur geta tengt' }, 403);
  }
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await notandi.auth.getUser(jwt);
  if (!user) return svara({ ok: false, svar: 'Bara stjórnendur geta tengt' }, 403);

  if (!VEITUR.includes(veitaInn as Veita)) return svara({ ok: false, svar: 'Óþekkt tenging' }, 400);
  const veita = veitaInn as Veita;

  // Slökkt þar til samþykki veitunnar liggur fyrir
  const BIDUR = { google: 'Bíður samþykkis Google', meta: 'Bíður samþykkis Meta', tiktok: 'Bíður samþykkis TikTok' };
  if (veita === 'google' && (ek.google_tilbuid !== true || !env('GOOGLE_CLIENT_ID') || !env('GOOGLE_CLIENT_SECRET'))) return svara({ ok: false, svar: BIDUR.google }, 409);
  if (veita === 'meta' && (ek.meta_tilbuid !== true || !env('META_APP_ID') || !env('META_APP_SECRET'))) return svara({ ok: false, svar: BIDUR.meta }, 409);
  if (veita === 'tiktok' && (ek.tiktok_tilbuid !== true || !env('TIKTOK_CLIENT_KEY') || !env('TIKTOK_CLIENT_SECRET'))) return svara({ ok: false, svar: BIDUR.tiktok }, 409);

  let verslun = '', shopifyId = '';
  if (veita === 'shopify') {
    const [{ data: lyklar }, { data: lina }] = await Promise.all([
      bak.rpc('tenging_lykill', { p_stofa: ek.stofa_id, p_veita: 'shopify' }),
      bak.from('tengingar').select('stillingar').eq('stofa_id', ek.stofa_id).eq('veita', 'shopify').maybeSingle()
    ]);
    verslun = String((lina && lina.stillingar && lina.stillingar.verslun) || '');
    shopifyId = String((lyklar && lyklar.clientId) || '');
    if (!VERSLUN.test(verslun) || !shopifyId || !(lyklar && lyklar.clientSecret)) {
      return svara({ ok: false, svar: 'Vistaðu fyrst slóð verslunarinnar, Client ID og Client secret í Stillingum.' }, 400);
    }
  }

  const state = handahof(32);
  const stateHash = hex((await sha256(state)).buffer as ArrayBuffer);
  const verifier = veita === 'google' ? handahof(48) : null;

  // Gamlar línur út, svo ný
  await bak.from('oauth_stada').delete().lt('rennur_ut', new Date(Date.now() - 86400000).toISOString());
  const { error: villa } = await bak.from('oauth_stada').insert({
    state_hash: stateHash, stofa_id: ek.stofa_id, veita, notandi: user.id, pkce: verifier,
    rennur_ut: new Date(Date.now() + GILDISTIMI).toISOString(), notad: false
  });
  if (villa) { console.error('oauth_stada', villa.message); return svara({ ok: false, svar: 'Náði ekki að hefja tenginguna. Prófaðu aftur.' }, 500); }

  const p = new URLSearchParams();
  let slod = '';
  if (veita === 'google') {
    const askorun = b64url(await sha256(verifier!));
    p.set('client_id', env('GOOGLE_CLIENT_ID')); p.set('redirect_uri', tilBaka(veita)); p.set('response_type', 'code');
    p.set('scope', SCOPE.google); p.set('access_type', 'offline'); p.set('prompt', 'consent');
    p.set('include_granted_scopes', 'true'); p.set('state', state);
    p.set('code_challenge', askorun); p.set('code_challenge_method', 'S256');
    slod = 'https://accounts.google.com/o/oauth2/v2/auth?' + p;
  } else if (veita === 'meta') {
    p.set('client_id', env('META_APP_ID')); p.set('redirect_uri', tilBaka(veita)); p.set('response_type', 'code');
    p.set('scope', SCOPE.meta); p.set('state', state);
    slod = 'https://www.facebook.com/' + META_UTGAFA + '/dialog/oauth?' + p;
  } else if (veita === 'tiktok') {
    p.set('client_key', env('TIKTOK_CLIENT_KEY')); p.set('redirect_uri', tilBaka(veita)); p.set('response_type', 'code');
    p.set('scope', SCOPE.tiktok); p.set('state', state);
    slod = 'https://www.tiktok.com/v2/auth/authorize/?' + p;
  } else {
    p.set('client_id', shopifyId); p.set('scope', SCOPE.shopify); p.set('redirect_uri', tilBaka(veita)); p.set('state', state);
    slod = 'https://' + verslun + '/admin/oauth/authorize?' + p;
  }
  return svara({ ok: true, slod });
}

// ==== skipti á kóða
async function json(r: Response): Promise<Record<string, any>> {
  return (await r.json().catch(() => null)) || {};
}

async function google(code: string, lina: Lina, bak: any): Promise<Vista> {
  const r = await saekja('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'),
      redirect_uri: tilBaka('google'), grant_type: 'authorization_code', code_verifier: lina.pkce || ''
    })
  });
  const d = await json(r);
  if (!r.ok) throw new Bod('Google tók ekki við kóðanum', 'skipti');
  if (!d.refresh_token) throw new Bod('Google sendi ekki varanlegan aðgang', 'enginn_refresh');
  const umfang = String(d.scope || '').split(' ');
  const netfang = String(jwtInnihald(String(d.id_token || '')).email || '').toLowerCase();
  // Fyrri val á dagatölum og GA eign heldur sér ef tengt er aftur
  const { data: fyrri } = await bak.from('tengingar').select('stillingar').eq('stofa_id', lina.stofa_id).eq('veita', 'google').maybeSingle();
  const f = (fyrri && fyrri.stillingar) || {};
  return {
    stillingar: {
      netfang: /^[^@\s]+@[^@\s]+$/.test(netfang) ? netfang : null,
      dagatol: Array.isArray(f.dagatol) ? f.dagatol : [],
      ga_eign: f.ga_eign || null,
      dagatal_leyft: umfang.includes('https://www.googleapis.com/auth/calendar.readonly'),
      greining_leyft: umfang.includes('https://www.googleapis.com/auth/analytics.readonly')
    },
    leyndo: { refresh_token: String(d.refresh_token) },
    prufa: 'OK: Tengt við ' + (netfang || 'Google')
  };
}

async function meta(code: string): Promise<Vista> {
  const grunnur = 'https://graph.facebook.com/' + META_UTGAFA;
  const r = await saekja(grunnur + '/oauth/access_token?' + new URLSearchParams({
    client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), redirect_uri: tilBaka('meta'), code
  }));
  const d = await json(r);
  if (!r.ok || !d.access_token) throw new Bod('Meta tók ekki við kóðanum', 'skipti');
  // Skammtímatoken í langtímatoken (um 60 dagar, Meta gefur ekki refresh token)
  const l = await saekja(grunnur + '/oauth/access_token?' + new URLSearchParams({
    grant_type: 'fb_exchange_token', client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), fb_exchange_token: String(d.access_token)
  }));
  const ld = await json(l);
  const tokinn = String((l.ok && ld.access_token) || d.access_token);
  const sek = Number((l.ok && ld.expires_in) || d.expires_in) || 0;
  const eg = await json(await saekja(grunnur + '/me?fields=id,name', { headers: { Authorization: 'Bearer ' + tokinn } }));
  return {
    stillingar: {
      nafn: eg.name ? String(eg.name).slice(0, 120) : null,
      notandi_id: eg.id ? String(eg.id).slice(0, 60) : null,
      rennur_ut: sek > 0 ? new Date(Date.now() + sek * 1000).toISOString() : null
    },
    leyndo: { access_token: tokinn },
    prufa: 'OK: Tengt við ' + (eg.name ? String(eg.name).slice(0, 80) : 'Meta')
  };
}

async function tiktok(code: string): Promise<Vista> {
  const r = await saekja('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), code,
      grant_type: 'authorization_code', redirect_uri: tilBaka('tiktok')
    })
  });
  const d = await json(r);
  if (!r.ok || !d.access_token || !d.refresh_token) throw new Bod('TikTok tók ekki við kóðanum', 'skipti');
  return {
    stillingar: {
      open_id: d.open_id ? String(d.open_id).slice(0, 100) : null,
      umfang: String(d.scope || '').slice(0, 300),
      refresh_rennur_ut: Number(d.refresh_expires_in) > 0 ? new Date(Date.now() + Number(d.refresh_expires_in) * 1000).toISOString() : null
    },
    leyndo: { refresh_token: String(d.refresh_token), access_token: String(d.access_token) },
    prufa: 'OK: Tengt við TikTok'
  };
}

async function shopify(code: string, params: URLSearchParams, lina: Lina, bak: any): Promise<Vista> {
  const [{ data: lyklar }, { data: tl }] = await Promise.all([
    bak.rpc('tenging_lykill', { p_stofa: lina.stofa_id, p_veita: 'shopify' }),
    bak.from('tengingar').select('stillingar').eq('stofa_id', lina.stofa_id).eq('veita', 'shopify').maybeSingle()
  ]);
  const stillingar = ((tl && tl.stillingar) || {}) as Record<string, unknown>;
  const verslun = String(stillingar.verslun || '');
  const k = (lyklar || {}) as Record<string, string>;
  if (!VERSLUN.test(verslun) || !k.clientId || !k.clientSecret) throw new Bod('Shopify tengingin fannst ekki', 'ekki_tengt');
  // Verslunin í svarinu verður að vera sú sem stofan vistaði
  if (params.get('shop') !== verslun) throw new Bod('Röng verslun', 'verslun');
  const timi = Number(params.get('timestamp') || 0);
  if (!timi || Math.abs(Date.now() / 1000 - timi) > 86400) throw new Bod('Svarið frá Shopify er of gamalt', 'timi');
  if (!(await shopifyHmacOk(params, k.clientSecret))) throw new Bod('Undirskrift Shopify stóðst ekki', 'hmac');

  const r = await saekja('https://' + verslun + '/admin/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: k.clientId, client_secret: k.clientSecret, code })
  });
  const d = await json(r);
  if (!r.ok || !d.access_token) throw new Bod('Shopify tók ekki við kóðanum', 'skipti');
  const scope = String(d.scope || '');
  const vantar = SCOPE.shopify.split(',').filter((x) => !scope.split(',').includes(x));

  // Stutt prófun með nýja tokeninum svo Stillingar og Verslun sjái OK
  let nafn = '';
  try {
    const q = await saekja('https://' + verslun + '/admin/api/2026-07/graphql.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': String(d.access_token) },
      body: JSON.stringify({ query: '{ shop { name } }' })
    });
    const qd = await json(q);
    nafn = String((qd.data && qd.data.shop && qd.data.shop.name) || '');
  } catch { /* prófunin er bara til upplýsingar */ }

  return {
    // Gömlu stillingarnar (verslun o.fl.) halda sér, oauth bætist við
    stillingar: { ...stillingar, oauth: true, oauth_umfang: scope.slice(0, 200), oauth_dags: new Date().toISOString() },
    // Client ID og Client secret halda sér í sama leyndarmáli, tokeninn bætist við
    leyndo: { ...k, access_token: String(d.access_token) },
    prufa: vantar.length
      ? 'Tengt við ' + (nafn || verslun) + ', en appið vantar aðganginn ' + vantar.join(', ') + '.'
      : 'OK: Tengt við ' + (nafn || verslun)
  };
}

/* Er veitan enn opin? Lesið aftur í til-baka (enginn JWT þar). Lokað ef
   ekki tekst að lesa. */
async function tilbuid(bak: any, veita: Veita): Promise<boolean> {
  if (veita === 'shopify') return true;
  const leyndo = veita === 'google' ? ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
    : veita === 'meta' ? ['META_APP_ID', 'META_APP_SECRET'] : ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'];
  if (leyndo.some((n) => !env(n))) return false;
  const { data, error } = await bak.from('stillingar_innri').select('gildi').eq('lykill', veita + '_tilbuid').maybeSingle();
  return !error && !!data && data.gildi === 'ja';
}

async function tilBakaSkref(params: URLSearchParams, bak: any): Promise<Response> {
  const state = params.get('state') || '';
  const code = params.get('code') || '';
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(state)) return aframsenda('oauth', 'state');

  // Eitt skipti: línan er merkt notuð um leið og hún er lesin
  const stateHash = hex((await sha256(state)).buffer as ArrayBuffer);
  const { data: lina, error } = await bak.from('oauth_stada')
    .update({ notad: true })
    .eq('state_hash', stateHash).eq('notad', false).gt('rennur_ut', new Date().toISOString())
    .select('state_hash, stofa_id, veita, notandi, pkce').maybeSingle();
  if (error || !lina) return aframsenda('oauth', 'state');
  const l = lina as Lina;

  // Notandinn hætti við eða veitan neitaði
  if (params.get('error') || !code || code.length > 2000) return aframsenda(l.veita, 'haett_vid');

  // Stofan og stjórnandinn sem byrjaði verða að vera enn virk
  const [{ data: stofa }, { data: madur }] = await Promise.all([
    bak.from('stofur').select('id, stada').eq('id', l.stofa_id).maybeSingle(),
    bak.from('notendur').select('id, hlutverk, stofa_id').eq('id', l.notandi || '00000000-0000-0000-0000-000000000000').maybeSingle()
  ]);
  if (!stofa || stofa.stada !== 'virk' || !madur || madur.hlutverk !== 'admin' || madur.stofa_id !== l.stofa_id) {
    return aframsenda(l.veita, 'adgangur');
  }
  if (!(await tilbuid(bak, l.veita))) return aframsenda(l.veita, 'lokad');

  let v: Vista;
  try {
    if (l.veita === 'google') v = await google(code, l, bak);
    else if (l.veita === 'meta') v = await meta(code);
    else if (l.veita === 'tiktok') v = await tiktok(code);
    else v = await shopify(code, params, l, bak);
  } catch (e) {
    if (e instanceof Bod) { console.error('oauth', l.veita, e.kodi); return aframsenda(l.veita, e.kodi); }
    console.error('oauth', l.veita, (e as Error).name);
    return aframsenda(l.veita, (e as Error).name === 'TimeoutError' ? 'timi' : 'samband');
  }

  const { error: vVilla } = await bak.rpc('vista_oauth_tengingu', {
    p_stofa: l.stofa_id, p_veita: l.veita, p_stillingar: v.stillingar, p_leyndo: v.leyndo
  });
  if (vVilla) { console.error('vista_oauth_tengingu', vVilla.message); return aframsenda(l.veita, 'vista'); }
  if (v.prufa) await bak.rpc('skra_tengingarprufu', { p_stofa: l.stofa_id, p_veita: l.veita, p_svar: v.prufa });
  return aframsenda(l.veita, null);
}

// ==== þjónninn
Deno.serve(async (req) => {
  const CORS = cors(req);
  const svara = (gogn: Record<string, unknown>, stada = 200) =>
    new Response(JSON.stringify(gogn), { status: stada, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') return svara({ ok: false, svar: 'Óleyfileg aðferð' }, 405);

  const params = new URL(req.url).searchParams;
  const bak = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

  // Sumar veitur bæta sínum breytum aftan við redirect_uri; þekkjum til-baka
  // líka á code eða error ásamt state.
  const skref = params.get('skref') || (req.method === 'GET' && (params.get('code') || params.get('error') || params.get('state')) ? 'til-baka' : '');

  if (skref === 'til-baka') {
    if (req.method !== 'GET') return svara({ ok: false, svar: 'Óleyfileg aðferð' }, 405);
    try { return await tilBakaSkref(params, bak); }
    // Bara heiti villunnar: fetch villur geta innihaldið slóð með client_secret (Meta)
    catch (e) { console.error('oauth til-baka', (e as Error).name); return aframsenda('oauth', 'villa'); }
  }

  if (skref === 'byrja') {
    let veita = params.get('veita') || '';
    if (!veita && req.method === 'POST') {
      const inn = await req.json().catch(() => ({})) as { veita?: unknown };
      veita = String(inn.veita || '');
    }
    try { return await byrja(req, veita, bak, svara); }
    catch (e) { console.error('oauth byrja', (e as Error).name); return svara({ ok: false, svar: 'Náði ekki að hefja tenginguna. Prófaðu aftur.' }, 500); }
  }

  return svara({ ok: false, svar: 'Óþekkt skref' }, 400);
});
