// ==========================================================================
// Supabase Edge Function: bjoda-notanda (stjórnandi stofu býður notanda)
//
// POST {netfang, nafn, hlutverk: 'admin'|'vidskiptavinur', fyrirtaeki_id}
// Stofan kemur úr rpc('min_stada') með JWT stjórnandans, aldrei úr
// beiðninni. Fyrirtækið er lesið með JWT stjórnandans, svo RLS sannar að það
// sé í hans stofu.
//
//   * Netfang með aðgang að öðru Glerhúsi eða opið boð þangað: 409 með
//     almennum texta sem segir ekki að önnur stofa sé til, ekkert sent.
//   * Notandi til en ekki í neinni stofu: tengdur við stofuna og fær
//     innskráningarhlekk (signInWithOtp, enginn nýr notandi búinn til).
//   * Annars: boð í töfluna bod (skra_bod) og boðspóstur frá Supabase með
//     nafni stofunnar ({{ .Data.stofa_nafn }} í sniðmátinu).
// Hámark 50 tilraunir á dag á stofu (notkun 'bod'), talið áður en netfangið
// er athugað, svo ekki sé hægt að fletta upp netföngum annarra stofa.
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

type Stada = { stofa_id: string; stada: string; er_admin: boolean; er_eigandi: boolean; slug: string; nafn: string; er_rekstraradili: boolean };
async function hverErEg(notandi: any): Promise<Stada | null> {
  const { data, error } = await notandi.rpc('min_stada');
  if (error) return null;
  const ek = Array.isArray(data) ? data[0] : data;
  return ek && ek.stofa_id ? ek as Stada : null;
}

const KERFI = 'https://tveir.is/glerhus/kerfi/';
const NETFANG = /^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOD_HAMARK = 50;
/* Sami texti hvort sem netfangið er í annarri stofu, á opið boð þangað eða
   lenti í kapphlaupi við annað boð: segir ekki hvort önnur stofa sé til */
const EKKI_HAEGT = 'Ekki er hægt að bjóða þessu netfangi. Ef viðkomandi á að fá aðgang, hafið samband við tveir@tveir.is.';
const HAMARK_TEXTI = 'Hámarkinu er náð: ' + BOD_HAMARK + ' boð á dag. Prófaðu aftur á morgun.';

function texti(v: unknown, hamark: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, hamark);
}

/* Nafnið fer inn í boðspóstinn, svo engar slóðir eða HTML */
const oruggtNafn = (t: string) => !/[<>{}]|:\/\/|www\.|\b[a-z0-9-]+\.(is|com|net|org|io|co|info|xyz|ru|top)\b/i.test(t);

/* Villutexti úr gagnagrunninum: bara okkar eigin (raise á íslensku), aldrei innri villur Postgres */
function dbTexti(e: any, sjalfgefid: string): string {
  const kodi = String((e && e.code) || '');
  const m = String((e && e.message) || '');
  return (kodi === 'P0001' || kodi === '42501') && m && m.length <= 200 ? m : sjalfgefid;
}

/* Póstvillur frá Supabase Auth á mannamáli */
function postVilla(e: any): string {
  const m = String((e && e.message) || '');
  if (/rate limit|too many/i.test(m)) return 'Of mörg boð í einu. Prófaðu aftur eftir smá stund.';
  if (/already been registered|already exists/i.test(m)) return EKKI_HAEGT;
  return 'Það tókst ekki að senda boðið. Prófaðu aftur eftir smá stund.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return svara(req, { ok: false, svar: 'Bara POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const jwt = req.headers.get('Authorization') || '';
  const notandi = createClient(url, anon, { global: { headers: { Authorization: jwt } }, auth: { persistSession: false } });
  const ek = await hverErEg(notandi);
  if (!ek || ek.stada !== 'virk' || ek.er_admin !== true) return svara(req, { ok: false, svar: 'Bara stjórnendur geta boðið notendum' }, 403);

  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return svara(req, { ok: false, svar: 'Ógild beiðni.' }, 400);
  const netfang = texti(b.netfang, 200).toLowerCase();
  const nafn = texti(b.nafn, 120);
  const hlutverk = b.hlutverk === 'admin' ? 'admin' : b.hlutverk === 'vidskiptavinur' ? 'vidskiptavinur' : '';
  const fyrirtaekiId = hlutverk === 'vidskiptavinur' ? String(b.fyrirtaeki_id || '') : '';
  if (!NETFANG.test(netfang)) return svara(req, { ok: false, svar: 'Netfangið lítur ekki rétt út.' }, 400);
  if (nafn && !oruggtNafn(nafn)) return svara(req, { ok: false, svar: 'Nafnið má ekki innihalda vefslóð eða sérstök tákn.' }, 400);
  if (!hlutverk) return svara(req, { ok: false, svar: 'Veldu hvort notandinn er stjórnandi eða viðskiptavinur.' }, 400);
  if (hlutverk === 'vidskiptavinur' && !UUID.test(fyrirtaekiId)) return svara(req, { ok: false, svar: 'Veldu fyrirtæki fyrir viðskiptavininn.' }, 400);
  // Nafn stofunnar fer inn í boðspóstinn ({{ .Data.stofa_nafn }}): sama regla og við skráningu
  if (!oruggtNafn(String(ek.nafn || ''))) {
    return svara(req, { ok: false, svar: 'Nafn stofunnar má ekki innihalda vefslóð eða sérstök tákn. Breyttu því í Stillingum og reyndu aftur.' }, 400);
  }

  // RLS sannar að fyrirtækið sé í stofu stjórnandans
  if (fyrirtaekiId) {
    const { data: f } = await notandi.from('fyrirtaeki').select('id').eq('id', fyrirtaekiId).maybeSingle();
    if (!f) return svara(req, { ok: false, svar: 'Fyrirtækið fannst ekki.' }, 404);
  }

  const bak = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // Annað lag: fyrirtækið er í stofu stjórnandans, líka áður en veggurinn (skref 5) er kominn
  if (fyrirtaekiId) {
    const { data: fs } = await bak.from('fyrirtaeki').select('stofa_id').eq('id', fyrirtaekiId).maybeSingle();
    if (!fs || fs.stofa_id !== ek.stofa_id) return svara(req, { ok: false, svar: 'Fyrirtækið fannst ekki.' }, 404);
  }
  const { data: { user: eg } } = await bak.auth.getUser(jwt.replace(/^Bearer\s+/i, ''));
  if (!eg) return svara(req, { ok: false, svar: 'Innskráningin er útrunnin. Skráðu þig inn aftur.' }, 401);

  // Hámark á dag, talið á undan öllu sem segir eitthvað um netfangið (líka þegar boð er sent aftur)
  const { data: innan, error: notkunVilla } = await bak.rpc('skra_notkun', { p_stofa: ek.stofa_id, p_tegund: 'bod', p_hamark: BOD_HAMARK });
  if (notkunVilla) { console.error('skra_notkun', notkunVilla); return svara(req, { ok: false, svar: 'Það tókst ekki að senda boðið. Prófaðu aftur eftir smá stund.' }, 500); }
  if (innan === false) return svara(req, { ok: false, svar: HAMARK_TEXTI }, 429);

  const { data: tilData, error: tilVilla } = await bak.rpc('notandi_til', { p_netfang: netfang });
  if (tilVilla) { console.error('notandi_til', tilVilla); return svara(req, { ok: false, svar: 'Það tókst ekki að senda boðið. Prófaðu aftur eftir smá stund.' }, 500); }
  const til = (Array.isArray(tilData) ? tilData[0] : tilData) || null;
  if (til && til.id && til.stofa_id && til.stofa_id !== ek.stofa_id) return svara(req, { ok: false, svar: EKKI_HAEGT }, 409);
  if (til && til.id && til.stofa_id === ek.stofa_id) return svara(req, { ok: false, svar: 'Þessi notandi er þegar með aðgang að Glerhúsinu ykkar.' }, 409);

  // Opið boð í annað Glerhús stöðvar. Útrunnið boð eiganda stofu sem bíður samþykkis
  // telst líka opið (rekstraraðili framlengir það við samþykki, sama regla og í
  // stofna-stofu), svo því er aldrei eytt hér. Gamalt boð í okkar stofu, eða
  // útrunnið boð annars staðar, víkur fyrir nýju (einkvæmur lykill á netfangi).
  const nu = Date.now();
  const { data: opin, error: opinVilla } = await bak.from('bod').select('id, stofa_id, utrunnid, er_eigandi, hlutverk').eq('netfang', netfang).is('notad', null);
  if (opinVilla) { console.error('bod', opinVilla); return svara(req, { ok: false, svar: 'Það tókst ekki að senda boðið. Prófaðu aftur eftir smá stund.' }, 500); }
  const eigendurAnnars = [...new Set((opin || []).filter((x: any) => x.stofa_id !== ek.stofa_id && x.er_eigandi).map((x: any) => String(x.stofa_id)))];
  let bidandi = new Set<string>();
  if (eigendurAnnars.length) {
    const { data: bs, error: bsVilla } = await bak.from('stofur').select('id').in('id', eigendurAnnars).eq('stada', 'bidur');
    if (bsVilla) { console.error('stofur', bsVilla); return svara(req, { ok: false, svar: 'Það tókst ekki að senda boðið. Prófaðu aftur eftir smá stund.' }, 500); }
    bidandi = new Set((bs || []).map((r: any) => String(r.id)));
  }
  if ((opin || []).some((x: any) => x.stofa_id !== ek.stofa_id
      && (new Date(x.utrunnid).getTime() > nu || (x.er_eigandi && bidandi.has(String(x.stofa_id)))))) {
    return svara(req, { ok: false, svar: EKKI_HAEGT }, 409);
  }

  // Notandi til en ekki í neinni stofu: tengja og senda innskráningarhlekk
  if (til && til.id && !til.stofa_id) {
    const { error } = await bak.rpc('tengja_notanda_stofu', {
      p_notandi: til.id, p_stofa: ek.stofa_id, p_hlutverk: hlutverk, p_fyrirtaeki: fyrirtaekiId || null
    });
    if (error) { console.error('tengja_notanda_stofu', error); return svara(req, { ok: false, svar: dbTexti(error, 'Það tókst ekki að tengja notandann.') }, 400); }
    const gestur = createClient(url, anon, { auth: { persistSession: false } });
    const { error: otp } = await gestur.auth.signInWithOtp({ email: netfang, options: { shouldCreateUser: false, emailRedirectTo: KERFI + 'yfirlit.html' } });
    if (otp) {
      console.error('otp', otp);
      return svara(req, { ok: true, tengt: true, svar: 'Notandinn var tengdur en hlekkurinn fór ekki út. Hann getur skráð sig inn á ' + KERFI + ' með netfanginu sínu.' });
    }
    return svara(req, { ok: true, tengt: true, svar: 'Notandinn var tengdur við Glerhúsið og fékk innskráningarhlekk í pósti.' });
  }

  // Nýr notandi: boð í töfluna, svo boðspóstur
  const gomul = (opin || []).map((x: any) => x.id);
  // Boð eiganda sem er sent aftur heldur eigandamerkinu
  const eigandi = hlutverk === 'admin' && (opin || []).some((x: any) => x.stofa_id === ek.stofa_id && x.er_eigandi === true);
  if (gomul.length) await bak.from('bod').delete().in('id', gomul).is('notad', null);
  const { error: bodVilla } = await bak.rpc('skra_bod', {
    p_stofa: ek.stofa_id, p_netfang: netfang, p_nafn: nafn || null, p_hlutverk: hlutverk,
    p_fyrirtaeki: fyrirtaekiId || null, p_bodid_af: eg.id, p_eigandi: eigandi
  });
  if (bodVilla) {
    console.error('skra_bod', bodVilla);
    // 23505: annað boð á sama netfang varð til á meðan (kannski í annarri stofu)
    if (bodVilla.code === '23505') return svara(req, { ok: false, svar: EKKI_HAEGT }, 409);
    // 54000: þak skra_bod (50 boð í stofunni síðasta sólarhring)
    if (bodVilla.code === '54000') return svara(req, { ok: false, svar: HAMARK_TEXTI }, 429);
    return svara(req, { ok: false, svar: dbTexti(bodVilla, 'Það tókst ekki að skrá boðið.') }, 400);
  }

  const { error: postur } = await bak.auth.admin.inviteUserByEmail(netfang, {
    redirectTo: KERFI + 'yfirlit.html',
    data: { nafn, stofa_nafn: ek.nafn }
  });
  if (postur) {
    console.error('inviteUserByEmail', postur);
    await bak.from('bod').delete().eq('stofa_id', ek.stofa_id).eq('netfang', netfang).is('notad', null);
    return svara(req, { ok: false, svar: postVilla(postur) }, 502);
  }
  return svara(req, { ok: true, svar: 'Boðið er farið til ' + netfang + '.' });
});
