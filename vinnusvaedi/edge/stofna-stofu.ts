// ==========================================================================
// Supabase Edge Function: stofna-stofu (opin skráning af vefnum)
//
// Skráningarformið á tveir.is/glerhusid/#kynning sendir JSON hingað með
// anon lyklinum sem bearer. Fallið:
//   1. hafnar hljóðlaust ef gildran (_gotcha) er fyllt út,
//   2. takmarkar: 3 á klukkutíma frá sömu IP tölu, 1 á dag á hvert netfang,
//      30 nýjar stofur á dag samtals (töflurnar skraningar og stofur),
//   3. býr til slóð (slug) úr nafni stofunnar,
//   4. sendir ekkert ef netfangið er þegar til (sama svar og venjulega),
//   5. stofnar stofuna: 'bidur' meðan skraning_opin = 'nei', annars 'virk',
//   6. sendir boðið strax ef stofan er virk (annars samþykkir rekstraraðili
//      hana í Rekstri og þá fer boðið),
//   7. skráir fyrirspurn hjá Tveir svo hver skráning sjáist í Samskiptum.
//
// Leyndarmál (valfrjálst): SALT í Edge Functions -> Secrets. Vanti það er
// service_role lykillinn notaður sem salt, svo IP tölur eru aldrei geymdar.
// Verify JWT stendur á (anon lykillinn er JWT).
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

const KERFI = 'https://tveir.is/glerhus/kerfi/';
const TEXTI_VIRK = 'Takk! Hlekkur inn í Glerhúsið er á leiðinni í pósthólfið þitt.';
const TEXTI_BIDUR = 'Takk! Við förum yfir skráninguna og sendum þér hlekk fljótlega.';
const VILLA_ALMENN = 'Skráningin tókst ekki núna. Prófaðu aftur eftir smá stund eða sendu póst á tveir@tveir.is.';

const NETFANG = /^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$/i;   // sama og stofur.netfang
const SLOD = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;              // sama og stofur.slug
// Sama listi og er_fratekid_slug() í gagnagrunninum
const FRATEKID = new Set(['tveir', 'verk', 'postur', 'admin', 'postmaster', 'abuse', 'noreply', 'no-reply', 'hjalp',
  'support', 'info', 'glerhusid', 'glerhus', 'kerfi', 'api', 'www', 'mail', 'test', 'prufa', 'rekstur']);

const KLST = 3600 * 1000;
const DAGUR = 24 * KLST;

/* Hreinn texti: stýritákn burt, klippt í hámarkslengd */
function texti(v: unknown, hamark: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, hamark);
}

/* Listi af auðkennum, kemur annaðhvort sem fylki eða "a, b, c" */
function audkenni(v: unknown, hamark = 30): string[] {
  const hrar = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  const ut: string[] = [];
  for (const x of hrar) {
    const s = typeof x === 'string' ? x.trim().toLowerCase() : '';
    if (/^[a-z0-9_]{1,40}$/.test(s) && !ut.includes(s)) ut.push(s);
    if (ut.length >= hamark) break;
  }
  return ut;
}

/* Nöfn fara inn í boðspóstinn ({{ .Data.stofa_nafn }}), svo engar slóðir eða HTML */
const oruggtNafn = (t: string) => !/[<>{}]|:\/\/|www\.|\b[a-z0-9-]+\.(is|com|net|org|io|co|info|xyz|ru|top)\b/i.test(t);

async function hakka(t: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
}

/* Slóð úr nafni: þ->th, ð->d, æ->ae, sérhljóðar án kommu, annað -> '-' */
function buaTilSlod(t: string): string {
  const STAFIR: Record<string, string> = { 'þ': 'th', 'ð': 'd', 'æ': 'ae', 'ö': 'o', 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ý': 'y' };
  let s = t.toLowerCase().replace(/[þðæöáéíóúý]/g, (c) => STAFIR[c]);
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
  if (s.length < 3) s = ((s ? s + '-' : '') + 'stofa').slice(0, 30);
  return s;
}

/* Möguleg slóð: grunnur, grunnur-2, grunnur-3 ... alltaf mest 30 stafir */
function frambod(grunnur: string): string[] {
  const ut: string[] = [];
  for (let i = 1; i <= 25; i++) {
    const s = i === 1 ? grunnur : grunnur.slice(0, 30 - String(i).length - 1).replace(/-+$/, '') + '-' + i;
    if (SLOD.test(s) && !FRATEKID.has(s) && !ut.includes(s)) ut.push(s);
  }
  return ut;
}

async function innri(bak: any, lyklar: string[]): Promise<Record<string, string>> {
  const { data, error } = await bak.from('stillingar_innri').select('lykill, gildi').in('lykill', lyklar);
  if (error) throw new Error('stillingar_innri: ' + error.message);
  return Object.fromEntries((data || []).map((r: any) => [r.lykill, r.gildi]));
}

const fyrstaRod = (d: any) => (Array.isArray(d) ? d[0] : d) || null;
const audkenniUr = (d: any): string | null => {
  const r = fyrstaRod(d);
  if (typeof r === 'string') return r;
  return r && (r.stofa_id || r.id || r.stofna_stofu) || null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return svara(req, { ok: false, svar: 'Bara POST' }, 405);
  // Bara vefsíðurnar okkar. Vafri sendir alltaf Origin með POST á milli léna.
  if (!LEYFT.includes(req.headers.get('Origin') || '')) return svara(req, { ok: false, svar: 'Skráning er bara opin á vefnum okkar.' }, 403);

  const hratt = await req.text().catch(() => '');
  if (hratt.length > 20000) return svara(req, { ok: false, svar: 'Of mikill texti.' }, 413);
  let b: any;
  try { b = JSON.parse(hratt); } catch { b = null; }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return svara(req, { ok: false, svar: 'Ógild beiðni.' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const thjonusta = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const bak = createClient(url, thjonusta, { auth: { persistSession: false } });

  let stillingar: Record<string, string>;
  try { stillingar = await innri(bak, ['skraning_opin', 'skilmalar_utgafa', 'tveir_stofa']); }
  catch (e) { console.error(e); return svara(req, { ok: false, svar: VILLA_ALMENN }, 500); }
  const opin = stillingar.skraning_opin === 'ja';
  const takk = { ok: true, texti: opin ? TEXTI_VIRK : TEXTI_BIDUR };

  // 1. Gildran: sama svar, ekkert gert
  if (texti(b._gotcha, 200)) return svara(req, takk);

  if (b.samthykki !== true) return svara(req, { ok: false, svar: 'Þú þarft að samþykkja skilmálana og persónuverndarstefnuna.' }, 400);
  const nafn = texti(b.nafn, 120);
  const netfang = texti(b.netfang ?? b.email, 200).toLowerCase();
  const stofuNafn = texti(b.stofa ?? b.fyrirtaeki, 120);
  const simi = texti(b.simi, 60);
  const skilabod = texti(b.skilabod, 5000);
  const hopur = texti(b.hopur, 200);
  const grein = /^[a-z]{2,30}$/.test(String(b.val_hopur_id || '')) ? String(b.val_hopur_id) : '';
  const einingar = audkenni(b.val_einingar);
  const tengingar = audkenni(b.val_tengingar);
  const oskir = texti(b.val_oskir, 2000);
  const litur = typeof b.litur === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.litur) ? b.litur : null;
  if (!nafn) return svara(req, { ok: false, svar: 'Nafnið vantar.' }, 400);
  if (!NETFANG.test(netfang)) return svara(req, { ok: false, svar: 'Netfangið lítur ekki rétt út.' }, 400);
  if (!stofuNafn) return svara(req, { ok: false, svar: 'Nafn stofunnar eða fyrirtækisins vantar.' }, 400);
  if (!oruggtNafn(nafn) || !oruggtNafn(stofuNafn)) return svara(req, { ok: false, svar: 'Nöfnin mega ekki innihalda vefslóðir eða sérstök tákn.' }, 400);
  const oskSlod = texti(b.slug, 60);
  if (oskSlod && !/^[a-zA-Z0-9þðæöáéíóúýÞÐÆÖÁÉÍÓÚÝ -]+$/.test(oskSlod)) return svara(req, { ok: false, svar: 'Slóðin má bara innihalda stafi, tölur og bandstrik.' }, 400);

  // 2. Takmarkanir
  const salt = Deno.env.get('SALT') || thjonusta;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'othekkt';
  const [ipHash, netfangHash] = await Promise.all([hakka(ip + salt), hakka(netfang + salt)]);
  const nu = Date.now();
  const [afIp, afNetfangi, alls] = await Promise.all([
    bak.from('skraningar').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('dags', new Date(nu - KLST).toISOString()),
    bak.from('skraningar').select('*', { count: 'exact', head: true }).eq('netfang_hash', netfangHash).gte('dags', new Date(nu - DAGUR).toISOString()),
    bak.from('stofur').select('*', { count: 'exact', head: true }).gte('stofnad', new Date(nu - DAGUR).toISOString())
  ]);
  if (afIp.error || afNetfangi.error || alls.error) {
    console.error(afIp.error || afNetfangi.error || alls.error);
    return svara(req, { ok: false, svar: VILLA_ALMENN }, 500);
  }
  const { error: skrVilla } = await bak.from('skraningar').insert({ ip_hash: ipHash, netfang_hash: netfangHash });
  if (skrVilla) { console.error(skrVilla); return svara(req, { ok: false, svar: VILLA_ALMENN }, 500); }
  if ((afIp.count || 0) >= 3 || (afNetfangi.count || 0) >= 1 || (alls.count || 0) >= 30) return svara(req, takk);
  // Ef skráningin strandar hjá okkur (ekki hjá notandanum) fer línan hans burt, svo hann
  // fái ekki "Takk" án þess að neitt gerist þegar hann reynir aftur
  const afturkalla = () => bak.from('skraningar').delete().eq('ip_hash', ipHash).eq('netfang_hash', netfangHash)
    .gte('dags', new Date(nu - 10 * 60 * 1000).toISOString())
    .then(({ error }: any) => { if (error) console.error('skraningar afturkalla', error); });
  const mistokst = async (svar: string, stadaKodi: number) => { await afturkalla(); return svara(req, { ok: false, svar }, stadaKodi); };

  const tveir = stillingar.tveir_stofa || null;
  const fyrirspurn = (skyring: string, auka: Record<string, unknown>) =>
    bak.from('fyrirspurnir').insert({
      ...(tveir ? { stofa_id: tveir } : {}),
      nafn, netfang, simi: simi || null, fyrirtaeki_nafn: stofuNafn,
      skilabod: ((skyring ? skyring + '\n\n' : '') + skilabod).slice(0, 5000) || null,
      thjonusta: hopur || null, form: 'glerhusid-skraning',
      gogn: { val_hopur_id: grein || null, val_einingar: einingar, val_tengingar: tengingar, val_oskir: oskir || null, ...auka }
    }).then(({ error }: any) => { if (error) console.error('fyrirspurn', error); });

  // 4. Netfang sem er þegar til, eða opið boð annars staðar: sama svar, ekkert sent
  const { data: tilData, error: tilVilla } = await bak.rpc('notandi_til', { p_netfang: netfang });
  if (tilVilla) { console.error(tilVilla); return mistokst(VILLA_ALMENN, 500); }
  const til = fyrstaRod(tilData);
  if (til && (typeof til === 'string' || til.id)) {
    await fyrirspurn('Skráning með netfangi sem er til', { stada: 'til' });
    return svara(req, takk);
  }
  const { data: opinBod, error: bodVilla } = await bak.from('bod').select('id, utrunnid, er_eigandi, stofa_id').eq('netfang', netfang).is('notad', null);
  if (bodVilla) { console.error('bod', bodVilla); return mistokst(VILLA_ALMENN, 500); }
  // Útrunnið boð eiganda stofu sem bíður samþykkis telst enn opið: rekstraraðili
  // framlengir það þegar hann samþykkir, svo því má ekki eyða hér
  const bidurIds = (opinBod || []).filter((x: any) => x.er_eigandi).map((x: any) => x.stofa_id);
  let bidandi = new Set<string>();
  if (bidurIds.length) {
    const { data: bs } = await bak.from('stofur').select('id').in('id', bidurIds).eq('stada', 'bidur');
    bidandi = new Set((bs || []).map((r: any) => r.id));
  }
  if ((opinBod || []).some((x: any) => new Date(x.utrunnid).getTime() > nu || (x.er_eigandi && bidandi.has(x.stofa_id)))) {
    await fyrirspurn('Skráning með netfangi sem á opið boð', { stada: 'opid_bod' });
    return svara(req, takk);
  }
  // Útrunnin ónotuð boð standa í vegi fyrir nýju boði (einkvæmur lykill á netfangi), þau mega fara
  const utrunnin = (opinBod || []).map((x: any) => x.id);
  if (utrunnin.length) await bak.from('bod').delete().in('id', utrunnin).is('notad', null).lt('utrunnid', new Date(nu).toISOString());

  // 3. Slóð: frátekin eða tekin fær -2, -3 ...
  const listi = frambod(buaTilSlod(oskSlod || stofuNafn));
  const [{ data: teknar }, { data: netfongTekin }] = await Promise.all([
    bak.from('stofur').select('slug').in('slug', listi),
    bak.from('verk_netfong').select('netfang').in('netfang', listi.map((s) => s + '@verk.tveir.is'))
  ]);
  const tekid = new Set<string>([
    ...(teknar || []).map((r: any) => r.slug),
    ...(netfongTekin || []).map((r: any) => String(r.netfang).split('@')[0])
  ]);
  const lausar = listi.filter((s) => !tekid.has(s));
  if (!lausar.length) return mistokst('Veldu aðra slóð, þessi er þegar í notkun.', 409);

  // 5. Stofna stofuna (reynt aftur með næstu slóð ef önnur skráning var á undan)
  const stada = opin ? 'virk' : 'bidur';
  let stofaId: string | null = null;
  let slug = '';
  for (const s of lausar.slice(0, 3)) {
    const { data, error } = await bak.rpc('stofna_stofu', {
      p_nafn: stofuNafn, p_slug: s, p_netfang: netfang, p_nafn_eiganda: nafn,
      p_stillingar: { ...(grein ? { grein } : {}), tengingar },
      p_stada: stada, p_skilmalar: stillingar.skilmalar_utgafa || null
    });
    if (!error) { stofaId = audkenniUr(data); slug = s; break; }
    // 23505 á bod_virkt: önnur skráning með sama netfangi var á undan, sama svar og venjulega
    if (error.code === '23505' && /bod_virkt/.test(String(error.message || ''))) return svara(req, takk);
    if (error.code !== '23505') { console.error('stofna_stofu', error); return mistokst(VILLA_ALMENN, 500); }
  }
  if (!stofaId) return mistokst(VILLA_ALMENN, 500);

  // Val úr "Settu saman" (einingar og litur) fer beint á stofuna
  const uppfaera: Record<string, unknown> = {};
  if (einingar.length) uppfaera.einingar = einingar;
  if (litur) uppfaera.litur = litur;
  if (Object.keys(uppfaera).length) {
    const { error } = await bak.from('stofur').update(uppfaera).eq('id', stofaId);
    if (error) console.error('stofur val', error);
  }

  // 6. Boðið strax ef skráning er opin
  if (stada === 'virk') {
    const { error } = await bak.auth.admin.inviteUserByEmail(netfang, {
      redirectTo: KERFI + 'byrja.html',
      data: { nafn, stofa_nafn: stofuNafn }
    });
    if (error) {
      console.error('bod', error);
      const { error: eyda } = await bak.rpc('eyda_stofu_gogn', { p_stofa: stofaId });
      if (eyda) console.error('eyda_stofu_gogn', eyda);
      return mistokst('Það tókst ekki að senda hlekkinn. Prófaðu aftur eftir smá stund eða sendu póst á tveir@tveir.is.', 502);
    }
  }

  // 7. Hver skráning sést í Samskiptum > Fyrirspurnir hjá Tveir
  await fyrirspurn('', { slug, stada, verk: slug + '@verk.tveir.is' });

  return svara(req, { ok: true, texti: stada === 'virk' ? TEXTI_VIRK : TEXTI_BIDUR });
});
