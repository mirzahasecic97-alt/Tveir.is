// ==========================================================================
// Supabase Edge Function: afhending-slod (skrá undirverks til viðskiptavinar)
//
// Pósturinn "Glerhúsið verk" (Apps Script) kallar hingað með anon lyklinum
// sem bearer: POST {lykill, undirverk_id}. Lykillinn er skriftarlykill úr
// vel_lyklar með umfangið postur_ut. afhending_slod_heimild() skilar slóð
// skrárinnar bara ef undirverkinu er lokið, það á að senda og það er í
// stofu sem lykillinn má tala fyrir. Þá býr fallið til undirritaðan hlekk
// sem gildir í 7 daga. Enginn lykilorðsnotandi fyrir verk stofur.
//
// Svar: {ok:true, slod} eða {ok:false, svar}.
// ==========================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

/* Sameiginlegar reglur (eins í hverju falli) */
const LEYFT = ['https://tveir.is', 'https://www.tveir.is', 'https://glerhusid.vercel.app'];
const cors = (req: Request) => {
  const uppruni = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': LEYFT.includes(uppruni) ? uppruni : LEYFT[0],
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
};
const svara = (req: Request, gogn: unknown, stada = 200) =>
  new Response(JSON.stringify(gogn), { status: stada, headers: { ...cors(req), 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIKA = 7 * 24 * 3600;   // sekúndur, sama og hlekkirnir hjá Tveir

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return svara(req, { ok: false, svar: 'Bara POST' }, 405);

  const b = await req.json().catch(() => null);
  const lykill = b && typeof b.lykill === 'string' ? b.lykill : '';
  const undirverk = b && typeof b.undirverk_id === 'string' ? b.undirverk_id : '';
  if (lykill.length < 16 || lykill.length > 200 || !UUID.test(undirverk)) return svara(req, { ok: false, svar: 'Ógild beiðni' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  // Heimildin er veitt anon og athugar lykilinn sjálf, svo hún er kölluð sem anon
  const gestur = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await gestur.rpc('afhending_slod_heimild', { p_lykill: lykill, p_undirverk: undirverk });
  if (error) { console.error('afhending_slod_heimild', error); return svara(req, { ok: false, svar: 'Heimildin náðist ekki' }, 500); }
  const rod = Array.isArray(data) ? data[0] : data;
  const skraSlod = typeof rod === 'string' ? rod : rod && typeof rod.skra_slod === 'string' ? rod.skra_slod : null;
  if (!skraSlod) return svara(req, { ok: false, svar: 'Engin skrá til afhendingar' }, 404);
  // Sama mappa og stilla_undirverk() krefst: <fyrirtaeki>/undirverk/<task>/<þetta undirverk>/<skrá>
  const MAPPA = new RegExp('^[0-9a-f-]{36}/undirverk/[0-9a-f-]{36}/' + undirverk.toLowerCase() + '/[^/]+$');
  if (skraSlod.length > 600 || skraSlod.includes('..') || !MAPPA.test(skraSlod.toLowerCase())) return svara(req, { ok: false, svar: 'Ógild slóð' }, 400);

  // Bara hér er service_role notaður: undirritaður hlekkur á einkafötuna vidhengi
  const bak = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: hlekkur, error: hVilla } = await bak.storage.from('vidhengi').createSignedUrl(skraSlod, VIKA);
  if (hVilla || !hlekkur) { console.error('createSignedUrl', hVilla); return svara(req, { ok: false, svar: 'Skráin fannst ekki' }, 404); }
  return svara(req, { ok: true, slod: hlekkur.signedUrl });
});
