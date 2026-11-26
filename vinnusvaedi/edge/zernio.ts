// ==========================================================================
// Supabase Edge Function: zernio (Facebook og Instagram tengd í gegnum Zernio)
//
// Zernio (zernio.com) á samþykkt Meta app. Hvert fyrirtæki (viðskiptavinur
// stofunnar) fær sinn Zernio prófíl, með externalId = fyrirtaeki.id. Lykillinn
// ZERNIO_API_KEY er í Edge Function Secrets, aldrei í vafranum.
//
// Bara stjórnandi stofunnar sem á fyrirtækið kemst hér í gegn: fyrirtækið er
// lesið með JWT þess sem kallar, svo veggur stofunnar (RLS) gildir.
//
// verk:
//   tengja     {fyrirtaeki_id, midill: 'facebook' | 'instagram', aftur?}
//              -> {ok, slod}: Zernio slóð sem opnar Facebook innskráningu.
//              Beðið er bara um tölfræði (scopes=analytics), ekki auglýsingar.
//   samstilla  {fyrirtaeki_id}
//              -> {ok, midlar: [...]}: tengdir reikningar fyrirtækisins verða
//              miðlar á Tölfræði (ytra_id 'zernio:<accountId>'). Apps Script
//              sækir tölurnar og söguna eftir það.
// Svar: {ok:true, ...} eða {ok:false, svar}.
// ==========================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

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
const ZERNIO = 'https://zernio.com/api/v1/';
const MIDLAR = ['facebook', 'instagram'];
/* Slóðin sem Zernio sendir notandann á eftir innskráningu: Tölfræði fyrirtækisins */
const TIL_BAKA: Record<string, string> = {
  'https://tveir.is': 'https://tveir.is/glerhus/kerfi/tolfraedi.html',
  'https://www.tveir.is': 'https://tveir.is/glerhus/kerfi/tolfraedi.html',
  'https://glerhusid.vercel.app': 'https://glerhusid.vercel.app/kerfi/tolfraedi.html'
};

async function zernio(leid: string, lykill: string, init: RequestInit = {}) {
  const r = await fetch(ZERNIO + leid, {
    ...init,
    headers: { Authorization: 'Bearer ' + lykill, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  let gogn: any = null;
  try { gogn = await r.json(); } catch { gogn = null; }
  if (!r.ok) {
    console.error('zernio', leid.split('?')[0], r.status, JSON.stringify(gogn).slice(0, 300));
    const e: any = new Error('zernio ' + r.status);
    e.stada = r.status;
    throw e;
  }
  return gogn;
}

/* Prófíll fyrirtækisins hjá Zernio, búinn til ef hann er ekki til */
async function profill(f: { id: string; nafn: string }, lykill: string, buaTil: boolean) {
  // Leitað eftir externalId hjá Zernio sjálfu, svo listinn megi verða eins langur og vill
  const g = await zernio('profiles?externalId=' + encodeURIComponent(f.id), lykill);
  const til = (g.profiles || []).find((p: any) => p.externalId === f.id);
  if (til || !buaTil) return til || null;
  const nafn = String(f.nafn || 'Fyrirtæki').slice(0, 60);
  const ny = await zernio('profiles', lykill, { method: 'POST', body: JSON.stringify({ name: nafn }) });
  const id = ny.profile && ny.profile._id;
  if (!id) throw new Error('Zernio bjó ekki til prófíl');
  await zernio('profiles/' + encodeURIComponent(id), lykill, { method: 'PUT', body: JSON.stringify({ externalId: f.id }) });
  return { ...ny.profile, externalId: f.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return svara(req, { ok: false, svar: 'Bara POST' }, 405);

  const lykill = Deno.env.get('ZERNIO_API_KEY') || '';
  if (lykill.length < 20) return svara(req, { ok: false, svar: 'Zernio lykillinn er ekki kominn í Supabase.', kodi: 'vantar_lykil' }, 503);

  const b = await req.json().catch(() => null);
  const verk = b && typeof b.verk === 'string' ? b.verk : '';
  const fid = b && typeof b.fyrirtaeki_id === 'string' ? b.fyrirtaeki_id : '';
  if (!UUID.test(fid) || !['tengja', 'samstilla'].includes(verk)) return svara(req, { ok: false, svar: 'Ógild beiðni' }, 400);

  // Sá sem kallar: JWT hans, svo veggur stofunnar ráði hvaða fyrirtæki hann sér
  const url = Deno.env.get('SUPABASE_URL')!;
  const auth = req.headers.get('Authorization') || '';
  const notandi = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false }, global: { headers: { Authorization: auth } }
  });
  const { data: admin, error: aVilla } = await notandi.rpc('er_admin');
  if (aVilla || admin !== true) return svara(req, { ok: false, svar: 'Bara stjórnendur tengja miðla.' }, 403);
  const { data: f, error: fVilla } = await notandi.from('fyrirtaeki').select('id, nafn, stofa_id').eq('id', fid).maybeSingle();
  if (fVilla) { console.error('fyrirtaeki', fVilla); return svara(req, { ok: false, svar: 'Náði ekki í fyrirtækið' }, 500); }
  if (!f) return svara(req, { ok: false, svar: 'Fyrirtækið fannst ekki' }, 404);
  // Veggurinn ræður nú þegar, en við athugum stofuna líka beint
  const { data: minStofa } = await notandi.rpc('min_stofa');
  if (!minStofa || minStofa !== f.stofa_id) return svara(req, { ok: false, svar: 'Þú hefur ekki aðgang að þessu fyrirtæki.' }, 403);

  try {
    if (verk === 'tengja') {
      const midill = typeof b.midill === 'string' ? b.midill : '';
      if (!MIDLAR.includes(midill)) return svara(req, { ok: false, svar: 'Veldu Facebook eða Instagram' }, 400);
      const p = await profill(f, lykill, true);
      const uppruni = req.headers.get('Origin') || '';
      const aftur = (TIL_BAKA[uppruni] || TIL_BAKA['https://tveir.is']) + '?f=' + encodeURIComponent(f.id) + '&zernio=1';
      const q = new URLSearchParams({
        profileId: p._id, redirect_url: aftur, scopes: 'analytics',
        welcome: 'true', brandName: 'Glerhúsið'
      });
      // Instagram með Facebook innskráningu: ein innskráning dugar fyrir síðu og Instagram
      if (midill === 'instagram') q.set('loginMethod', 'facebook_login');
      const svar = await zernio('connect/' + midill + '?' + q.toString(), lykill);
      let hysill = '';
      try { hysill = new URL(String(svar && svar.authUrl)).hostname; } catch { hysill = ''; }
      const LEYFDIR = ['zernio.com', 'www.facebook.com', 'facebook.com', 'm.facebook.com', 'www.instagram.com', 'api.instagram.com'];
      if (!/^https:\/\//.test(String(svar && svar.authUrl)) || !LEYFDIR.includes(hysill)) throw new Error('óvænt authUrl');
      return svara(req, { ok: true, slod: svar.authUrl });
    }

    // samstilla
    const p = await profill(f, lykill, false);
    if (!p) return svara(req, { ok: true, midlar: [] });
    const g = await zernio('accounts?profileId=' + encodeURIComponent(p._id), lykill);
    const reikningar = (g.accounts || []).filter((a: any) => MIDLAR.includes(a.platform) && /^[A-Za-z0-9]{8,64}$/.test(String(a._id || '')));
    const { data: til, error: tVilla } = await notandi.from('midlar').select('id, midill, nafn, ytra_id, virkt').eq('fyrirtaeki_id', f.id);
    if (tVilla) throw tVilla;
    const ut: any[] = [];
    for (const a of reikningar) {
      const ytra = 'zernio:' + a._id;
      const nafn = String((a.platform === 'instagram' ? (a.username || a.displayName) : (a.displayName || a.username)) || a.platform).slice(0, 120);
      const notandanafn = String(a.username || '').replace(/[^A-Za-z0-9._-]/g, '');
      const slod = a.platform === 'instagram'
        ? (notandanafn ? 'https://www.instagram.com/' + notandanafn + '/' : null)
        : (notandanafn ? 'https://www.facebook.com/' + notandanafn : null);
      const sami = (til || []).find((m: any) => m.ytra_id === ytra)
        || (til || []).find((m: any) => m.midill === a.platform && String(m.nafn).toLowerCase() === nafn.toLowerCase());
      if (sami) {
        const { error } = await notandi.from('midlar').update({ ytra_id: ytra, virkt: true, ...(slod ? { slod } : {}) }).eq('id', sami.id);
        if (error) throw error;
        ut.push({ id: sami.id, midill: a.platform, nafn: sami.nafn, nytt: false });
      } else {
        const { data: ny, error } = await notandi.from('midlar')
          .insert({ fyrirtaeki_id: f.id, midill: a.platform, nafn, ytra_id: ytra, slod, virkt: true })
          .select('id').single();
        if (error) throw error;
        ut.push({ id: ny.id, midill: a.platform, nafn, nytt: true });
      }
    }
    return svara(req, { ok: true, midlar: ut });
  } catch (e: any) {
    console.error('zernio fall', verk, e && (e.message || e));
    const stada = e && e.stada;
    return svara(req, { ok: false, svar: stada === 401 ? 'Zernio lykillinn virkar ekki.' : stada === 429 ? 'Zernio biður um smá hlé. Prófaðu aftur eftir mínútu.' : 'Tengingin við Zernio gekk ekki. Prófaðu aftur.' }, 502);
  }
});
