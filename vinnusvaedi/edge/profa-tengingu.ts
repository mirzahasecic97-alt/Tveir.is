// ==========================================================================
// Supabase Edge Function: profa-tengingu
//
// Stillingar síðan kallar á þetta strax eftir að lykill er vistaður.
// Fallið les lykilinn úr Vault (bara hér, með service_role sem Supabase
// setur sjálft inn), prófar hann hjá veitunni og skráir niðurstöðuna.
// Lykillinn fer aldrei aftur út á síðuna.
//
// Uppsetning: Supabase -> Edge Functions -> Deploy a new function -> Via
// Editor, nafn profa-tengingu, líma þessa skrá inn. Engin leyndarmál þarf
// að setja inn: SUPABASE_URL, SUPABASE_ANON_KEY og SUPABASE_SERVICE_ROLE_KEY
// eru alltaf til staðar í Edge Functions.
// ==========================================================================

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const svara = (gogn: unknown, stada = 200) =>
  new Response(JSON.stringify(gogn), { status: stada, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Lyklar = Record<string, string>;
type Nidurstada = { ok: boolean; svar: string };

const BID = 12000;
const saekja = (slod: string, valkostir: RequestInit = {}) => fetch(slod, { ...valkostir, signal: AbortSignal.timeout(BID) });

/* Algeng svör frá veitunum þýdd á mannamál */
function villa(stada: number, heiti: string): Nidurstada {
  if (stada === 401) return { ok: false, svar: heiti + ' tók ekki við lyklinum. Athugaðu að hann sé rétt afritaður og ekki útrunninn.' };
  if (stada === 403) return { ok: false, svar: 'Lykillinn virkar en hefur ekki aðgang. Athugaðu réttindin hjá ' + heiti + '.' };
  if (stada === 404) return { ok: false, svar: heiti + ' fann ekki aðganginn. Athugaðu slóðina eða auðkennið.' };
  if (stada === 429) return { ok: false, svar: heiti + ' bað okkur að bíða. Prófaðu aftur eftir smá stund.' };
  if (stada >= 500) return { ok: false, svar: heiti + ' svarar ekki núna. Prófaðu aftur eftir smá stund.' };
  return { ok: false, svar: heiti + ' svaraði með villu ' + stada + '.' };
}

const PROF: Record<string, (k: Lyklar, s: Record<string, string>) => Promise<Nidurstada>> = {
  async claude(k) {
    const r = await saekja('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': k.lykill || '', 'anthropic-version': '2026-10-21' }
    });
    return r.ok ? { ok: true, svar: 'Claude tók við lyklinum' } : villa(r.status, 'Claude');
  },

  async chatgpt(k) {
    const r = await saekja('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + (k.lykill || '') } });
    return r.ok ? { ok: true, svar: 'OpenAI tók við lyklinum' } : villa(r.status, 'OpenAI');
  },

  async payday(k) {
    const r = await saekja('https://api.payday.is/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Version': 'alpha' },
      body: JSON.stringify({ clientId: k.clientId || '', clientSecret: k.clientSecret || '' })
    });
    if (r.status === 400 || r.status === 401) return { ok: false, svar: 'Payday þekkir ekki Client ID og Client Secret. Afritaðu þau aftur úr Payday.' };
    return r.ok ? { ok: true, svar: 'Payday tók við lyklunum' } : villa(r.status, 'Payday');
  },

  async dk(k) {
    const r = await saekja('https://api.dkplus.is/api/v1/company', { headers: { Authorization: 'Bearer ' + (k.token || '') } });
    if (!r.ok) return villa(r.status, 'DK');
    const d = await r.json().catch(() => null);
    const nafn = d && d.Information && d.Information.Company && d.Information.Company.Name;
    return { ok: true, svar: nafn ? 'Tengt við ' + nafn : 'DK tók við lyklinum' };
  },

  async shopify(k, s) {
    const verslun = String(s.verslun || '');
    if (!/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/.test(verslun)) return { ok: false, svar: 'Slóð verslunarinnar á að vera á forminu nafn.myshopify.com' };
    const t = await saekja('https://' + verslun + '/admin/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: k.clientId || '', client_secret: k.clientSecret || '' })
    });
    if (!t.ok) {
      const texti = await t.text().catch(() => '');
      if (/cannot be found|not_found|invalid_client/i.test(texti)) return { ok: false, svar: 'Shopify þekkir ekki Client ID og Client secret. Athugaðu að appið sé sett upp á þessari verslun.' };
      if (/shop_not_permitted/i.test(texti)) return { ok: false, svar: 'Appið þarf að vera búið til með sama Shopify aðgangi og verslunin sjálf.' };
      return villa(t.status, 'Shopify');
    }
    const { access_token: tokinn, scope = '' } = await t.json();
    const vantar = ['read_products', 'read_inventory', 'read_orders'].filter((x) => !String(scope).split(',').includes(x));
    const q = await saekja('https://' + verslun + '/admin/api/2026-07/graphql.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': tokinn },
      body: JSON.stringify({ query: '{ shop { name } }' })
    });
    if (!q.ok) return villa(q.status, 'Shopify');
    const d = await q.json().catch(() => null);
    const nafn = d && d.data && d.data.shop && d.data.shop.name;
    if (vantar.length) return { ok: false, svar: 'Tengt við ' + (nafn || verslun) + ', en appið vantar aðganginn ' + vantar.join(', ') + '. Bættu honum við og gefðu út nýja útgáfu.' };
    return { ok: true, svar: 'Tengt við ' + (nafn || verslun) };
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return svara({ ok: false, svar: 'Bara POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const notandi = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } }
  });
  const { data: admin } = await notandi.rpc('er_admin');
  if (admin !== true) return svara({ ok: false, svar: 'Bara stjórnendur geta prófað tengingar' }, 403);

  const { veita } = await req.json().catch(() => ({ veita: '' }));
  const prof = PROF[String(veita)];
  if (!prof) return svara({ ok: false, svar: 'Óþekkt tenging' }, 400);

  const bak = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const [{ data: lyklar }, { data: lina }] = await Promise.all([
    bak.rpc('tenging_lykill', { p_veita: veita }),
    bak.from('tengingar').select('stillingar').eq('veita', veita).maybeSingle()
  ]);
  if (!lyklar) return svara({ ok: false, svar: 'Enginn lykill vistaður fyrir þessa tengingu' }, 404);

  let n: Nidurstada;
  try { n = await prof(lyklar as Lyklar, ((lina && lina.stillingar) || {}) as Record<string, string>); }
  catch (e) {
    n = { ok: false, svar: (e as Error).name === 'TimeoutError' ? 'Veitan svaraði ekki innan 12 sekúndna. Prófaðu aftur.' : 'Náði ekki sambandi við veituna.' };
  }
  await bak.rpc('skra_tengingarprufu', { p_veita: veita, p_svar: (n.ok ? 'OK: ' : '') + n.svar });
  return svara(n);
});
