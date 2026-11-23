// ==========================================================================
// Supabase Edge Function: rekstur (bara rekstraraðili Glerhússins)
//
// POST {adgerd, ...}. Rekstraraðilar eru notendaauðkenni í
// stillingar_innri.rekstraradilar; min_stada().er_rekstraradili segir til.
// Aðgerðirnar sjá bara lýsigögn stofa og fjölda, aldrei gögn stofanna
// sjálfra (nema útflutningur, sem er gerður fyrir eiganda stofunnar).
// Rekstrarföllin í gagnagrunninum skrá sig sjálf í rekstur_log; það sem
// gerist bara hér (boð, útflutningur, eyðing) er skráð hér.
//
//   yfirlit                       stofur_yfirlit + notendur án stofu + skráning opin?
//   samthykkja  {slug}            samthykkja_stofu, svo boð eigandans sem beið
//   senda_bod   {slug}            sendir boð eigandans aftur (virk stofa, ónotað boð)
//   loka        {slug, astaeda}   loka_stofu
//   opna        {slug}            opna_stofu
//   skraning    {opin}            stilla_skraningu
//   postur      {slug, virkt}     postur_ut
//   utflutningur {slug}           JSON í einkafötuna utflutningur, 24 klst hlekkur
//   eyda        {slug, stadfesting, eyda_utflutningi?}
//                                 bara lokuð stofa í 7 daga og slóðin slegin inn:
//                                 skrár, svo eyda_stofu_gogn, svo notendur
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
  return ek || null;
}

const KERFI = 'https://tveir.is/glerhus/kerfi/';
const SLOD = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const FATA = 'utflutningur';
const DAGUR = 24 * 3600 * 1000;

const villa = (e: any, sjalfgefid: string) => String((e && e.message) || sjalfgefid).slice(0, 300);

/* Nafn stofunnar fer inn í boðspóstinn ({{ .Data.stofa_nafn }}): sama regla og í stofna-stofu og bjoda-notanda */
const oruggtNafn = (t: string) => !/[<>{}]|:\/\/|www\.|\b[a-z0-9-]+\.(is|com|net|org|io|co|info|xyz|ru|top)\b/i.test(t);

/* Allar skrár undir möppu í fötu (endurkvæmt) */
async function allarSkrar(bak: any, fata: string, mappa: string): Promise<string[]> {
  const ut: string[] = [];
  for (let byrja = 0; ; byrja += 1000) {
    const { data, error } = await bak.storage.from(fata).list(mappa, { limit: 1000, offset: byrja });
    if (error || !data || !data.length) break;
    for (const x of data) {
      const slod = mappa + '/' + x.name;
      if (x.id === null || x.id === undefined) ut.push(...await allarSkrar(bak, fata, slod));   // mappa
      else ut.push(slod);
    }
    if (data.length < 1000) break;
  }
  return ut;
}

async function eydaSkram(bak: any, fata: string, slodir: string[]): Promise<number> {
  let fjoldi = 0;
  for (let i = 0; i < slodir.length; i += 100) {
    const hluti = slodir.slice(i, i + 100);
    const { error } = await bak.storage.from(fata).remove(hluti);
    if (error) throw new Error('Skrár í ' + fata + ': ' + error.message);
    fjoldi += hluti.length;
  }
  return fjoldi;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return svara(req, { ok: false, svar: 'Bara POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const jwt = req.headers.get('Authorization') || '';
  const notandi = createClient(url, anon, { global: { headers: { Authorization: jwt } }, auth: { persistSession: false } });
  const ek = await hverErEg(notandi);
  if (!ek || ek.er_rekstraradili !== true) return svara(req, { ok: false, svar: 'Bara rekstraraðili Glerhússins hefur aðgang hér.' }, 403);

  const bak = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: { user: eg } } = await bak.auth.getUser(jwt.replace(/^Bearer\s+/i, ''));
  if (!eg) return svara(req, { ok: false, svar: 'Innskráningin er útrunnin. Skráðu þig inn aftur.' }, 401);

  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return svara(req, { ok: false, svar: 'Ógild beiðni.' }, 400);
  const adgerd = String(b.adgerd || '');
  const slug = String(b.slug || '').trim().toLowerCase();

  const skra = (a: string, stofaId: string | null, gogn: Record<string, unknown>) =>
    bak.from('rekstur_log').insert({ notandi: eg.id, adgerd: a, stofa_id: stofaId, gogn })
      .then(({ error }: any) => { if (error) console.error('rekstur_log', error); });

  const stofaUrSlod = async () => {
    if (!SLOD.test(slug)) return null;
    const { data } = await bak.from('stofur').select('id, nafn, slug, stada, netfang, stofnad').eq('slug', slug).maybeSingle();
    return data || null;
  };

  const innri = async (lykill: string) => {
    const { data } = await bak.from('stillingar_innri').select('gildi').eq('lykill', lykill).maybeSingle();
    return data ? String(data.gildi) : null;
  };

  /* Boð eiganda sem beið samþykkis */
  const sendaEigandabod = async (stofa: any) => {
    const { data: bod } = await bak.from('bod').select('id, netfang, nafn, utrunnid')
      .eq('stofa_id', stofa.id).eq('er_eigandi', true).is('notad', null)
      .order('stofnad', { ascending: false }).limit(1).maybeSingle();
    if (!bod) return { ok: false, svar: 'Ekkert ónotað boð eiganda fannst fyrir þessa stofu.' };
    if (!oruggtNafn(String(stofa.nafn || ''))) {
      return { ok: false, svar: 'Nafn stofunnar inniheldur vefslóð eða sérstök tákn, svo boðið var ekki sent. Lagaðu nafnið fyrst.' };
    }
    // Rekstraraðili getur verið seinn að samþykkja: boðið fær 14 nýja daga
    if (new Date(bod.utrunnid).getTime() < Date.now() + DAGUR) {
      await bak.from('bod').update({ utrunnid: new Date(Date.now() + 14 * DAGUR).toISOString() }).eq('id', bod.id);
    }
    const { data: tilData, error: tilVilla } = await bak.rpc('notandi_til', { p_netfang: bod.netfang });
    if (tilVilla) { console.error('notandi_til', tilVilla); return { ok: false, svar: 'Náði ekki að athuga netfang eigandans. Reyndu aftur með Senda boð.' }; }
    const til = (Array.isArray(tilData) ? tilData[0] : tilData) || null;
    if (til && til.id) {
      if (til.stofa_id && til.stofa_id !== stofa.id) return { ok: false, svar: 'Netfang eigandans er þegar með aðgang að öðru Glerhúsi.' };
      if (!til.stofa_id) {
        const { error } = await bak.rpc('tengja_notanda_stofu', { p_notandi: til.id, p_stofa: stofa.id, p_hlutverk: 'admin', p_fyrirtaeki: null });
        if (error) return { ok: false, svar: villa(error, 'Það tókst ekki að tengja eigandann.') };
      }
      await bak.from('notendur').update({ er_eigandi: true }).eq('id', til.id).eq('stofa_id', stofa.id);
      await bak.from('bod').update({ notad: new Date().toISOString() }).eq('id', bod.id);
      const gestur = createClient(url, anon, { auth: { persistSession: false } });
      const { error: otp } = await gestur.auth.signInWithOtp({ email: bod.netfang, options: { shouldCreateUser: false, emailRedirectTo: KERFI + 'byrja.html' } });
      await skra('bod_eiganda', stofa.id, { leid: 'innskraningarhlekkur', tokst: !otp });
      return otp ? { ok: false, svar: 'Eigandinn var tengdur en hlekkurinn fór ekki út.' } : { ok: true, svar: 'Eigandinn var tengdur og fékk innskráningarhlekk.' };
    }
    const { error } = await bak.auth.admin.inviteUserByEmail(bod.netfang, {
      redirectTo: KERFI + 'byrja.html',
      data: { nafn: bod.nafn || '', stofa_nafn: stofa.nafn }
    });
    await skra('bod_eiganda', stofa.id, { leid: 'bod', tokst: !error });
    if (error) { console.error('inviteUserByEmail', error); return { ok: false, svar: 'Stofan er virk en boðið fór ekki út: ' + villa(error, 'óþekkt villa') + '. Reyndu aftur með Senda boð.' }; }
    return { ok: true, svar: 'Stofan er virk og boðið er farið til ' + bod.netfang + '.' };
  };

  try {
    switch (adgerd) {
      case 'yfirlit': {
        const [yf, an, opin] = await Promise.all([
          notandi.rpc('stofur_yfirlit'),
          bak.from('notendur').select('id, netfang, nafn, stofnad').is('stofa_id', null).order('stofnad', { ascending: false }).limit(200),
          innri('skraning_opin')
        ]);
        if (yf.error) return svara(req, { ok: false, svar: villa(yf.error, 'Yfirlitið náðist ekki.') }, 400);
        await skra('notendur_an_stofu', null, { fjoldi: (an.data || []).length });
        return svara(req, { ok: true, stofur: yf.data || [], an_stofu: an.data || [], skraning_opin: opin === 'ja' });
      }

      case 'samthykkja': {
        const stofa = await stofaUrSlod();
        if (!stofa) return svara(req, { ok: false, svar: 'Stofan fannst ekki.' }, 404);
        if (stofa.stada !== 'bidur') return svara(req, { ok: false, svar: 'Stofan bíður ekki samþykkis.' }, 409);
        const { error } = await notandi.rpc('samthykkja_stofu', { p_slug: slug });
        if (error) return svara(req, { ok: false, svar: villa(error, 'Það tókst ekki að samþykkja.') }, 400);
        const n = await sendaEigandabod(stofa);
        return svara(req, n, n.ok ? 200 : 502);
      }

      case 'senda_bod': {
        const stofa = await stofaUrSlod();
        if (!stofa) return svara(req, { ok: false, svar: 'Stofan fannst ekki.' }, 404);
        if (stofa.stada !== 'virk') return svara(req, { ok: false, svar: 'Stofan þarf að vera virk.' }, 409);
        const n = await sendaEigandabod(stofa);
        return svara(req, n, n.ok ? 200 : 502);
      }

      case 'loka': {
        const astaeda = typeof b.astaeda === 'string' ? b.astaeda.trim().slice(0, 500) : '';
        const { error } = await notandi.rpc('loka_stofu', { p_slug: slug, p_astaeda: astaeda || null });
        if (error) return svara(req, { ok: false, svar: villa(error, 'Það tókst ekki að loka.') }, 400);
        return svara(req, { ok: true, svar: 'Stofunni var lokað.' });
      }

      case 'opna': {
        const { error } = await notandi.rpc('opna_stofu', { p_slug: slug });
        if (error) return svara(req, { ok: false, svar: villa(error, 'Það tókst ekki að opna.') }, 400);
        return svara(req, { ok: true, svar: 'Stofan er opin aftur.' });
      }

      case 'skraning': {
        if (typeof b.opin !== 'boolean') return svara(req, { ok: false, svar: 'Segðu til um opin eða lokuð.' }, 400);
        const { error } = await notandi.rpc('stilla_skraningu', { p_opin: b.opin });
        if (error) return svara(req, { ok: false, svar: villa(error, 'Það tókst ekki að breyta skráningunni.') }, 400);
        return svara(req, { ok: true, svar: b.opin ? 'Skráning er opin.' : 'Skráningar bíða samþykkis.' });
      }

      case 'postur': {
        if (typeof b.virkt !== 'boolean') return svara(req, { ok: false, svar: 'Segðu til um virkt eða stöðvað.' }, 400);
        const { error } = await notandi.rpc('postur_ut', { p_slug: slug, p_virkt: b.virkt });
        if (error) return svara(req, { ok: false, svar: villa(error, 'Það tókst ekki að breyta póstinum.') }, 400);
        return svara(req, { ok: true, svar: b.virkt ? 'Póstur frá stofunni er virkur.' : 'Póstur frá stofunni er stöðvaður.' });
      }

      case 'utflutningur': {
        const stofa = await stofaUrSlod();
        if (!stofa) return svara(req, { ok: false, svar: 'Stofan fannst ekki.' }, 404);
        const { data: gogn, error } = await bak.rpc('utflutningur_stofu', { p_stofa: stofa.id });
        if (error) return svara(req, { ok: false, svar: villa(error, 'Útflutningurinn tókst ekki.') }, 500);
        const { error: fVilla } = await bak.storage.getBucket(FATA);
        if (fVilla) {
          const { error: nVilla } = await bak.storage.createBucket(FATA, { public: false });
          if (nVilla && !/already exists/i.test(nVilla.message)) throw new Error('Fatan utflutningur: ' + nVilla.message);
        }
        const timi = new Date().toISOString().replace(/[:.]/g, '-');
        const slod = stofa.id + '/' + timi + '.json';
        const innihald = JSON.stringify({ stofa: { id: stofa.id, slug: stofa.slug, nafn: stofa.nafn }, flutt_ut: new Date().toISOString(), gogn });
        const { error: uVilla } = await bak.storage.from(FATA).upload(slod, new Blob([innihald], { type: 'application/json' }), { contentType: 'application/json', upsert: false });
        if (uVilla) throw new Error('Upphal: ' + uVilla.message);
        const { data: hlekkur, error: sVilla } = await bak.storage.from(FATA).createSignedUrl(slod, 86400, { download: stofa.slug + '-' + timi.slice(0, 10) + '.json' });
        if (sVilla || !hlekkur) throw new Error('Hlekkur: ' + (sVilla ? sVilla.message : 'enginn'));
        await skra('utflutningur', stofa.id, { skra: slod, baeti: innihald.length });
        return svara(req, { ok: true, slod: hlekkur.signedUrl, skra: slod, svar: 'Hlekkurinn gildir í sólarhring.' });
      }

      case 'eyda': {
        const stofa = await stofaUrSlod();
        if (!stofa) return svara(req, { ok: false, svar: 'Stofan fannst ekki.' }, 404);
        if (String(b.stadfesting || '').trim().toLowerCase() !== stofa.slug) return svara(req, { ok: false, svar: 'Sláðu inn slóð stofunnar til að staðfesta.' }, 400);
        const tveir = await innri('tveir_stofa');
        if (stofa.slug === 'tveir' || stofa.id === tveir) return svara(req, { ok: false, svar: 'Stofu Tveir er aldrei eytt.' }, 403);
        if (stofa.stada !== 'lokud') return svara(req, { ok: false, svar: 'Lokaðu stofunni fyrst. Henni má eyða 7 dögum eftir lokun.' }, 409);
        const { data: lokun } = await bak.from('rekstur_log').select('dags')
          .eq('stofa_id', stofa.id).in('adgerd', ['loka', 'loka_stofu'])
          .order('dags', { ascending: false }).limit(1).maybeSingle();
        if (!lokun) return svara(req, { ok: false, svar: 'Fann ekki hvenær stofunni var lokað.' }, 409);
        const dagar = (Date.now() - new Date(lokun.dags).getTime()) / DAGUR;
        if (dagar < 7) return svara(req, { ok: false, svar: 'Stofunni var lokað fyrir ' + Math.floor(dagar) + ' dögum. Henni má eyða eftir 7 daga.' }, 409);

        // Notendur stofunnar lesnir áður en línurnar fara (rekstraraðilar aldrei)
        const [{ data: folk }, { data: fyrirtaeki }, rekstur] = await Promise.all([
          bak.from('notendur').select('id').eq('stofa_id', stofa.id),
          bak.from('fyrirtaeki').select('id').eq('stofa_id', stofa.id),
          innri('rekstraradilar')
        ]);
        let verndadir: string[] = [];
        try { verndadir = JSON.parse(rekstur || '[]'); } catch { verndadir = []; }
        const notendur = (folk || []).map((x: any) => x.id).filter((id: string) => !verndadir.includes(id) && id !== eg.id);

        // 1. Skrár: möppur fyrirtækjanna í vidhengi og merki, og stofa-<id> í merki
        const moppur = [...(fyrirtaeki || []).map((x: any) => x.id), 'stofa-' + stofa.id];
        let skrar = 0;
        for (const fata of ['vidhengi', 'merki']) {
          for (const m of moppur) skrar += await eydaSkram(bak, fata, await allarSkrar(bak, fata, m));
        }
        if (b.eyda_utflutningi === true) skrar += await eydaSkram(bak, FATA, await allarSkrar(bak, FATA, stofa.id));

        // 2. Línur, Vault leyndarmál og verk netföng
        const { error } = await bak.rpc('eyda_stofu_gogn', { p_stofa: stofa.id });
        if (error) return svara(req, { ok: false, svar: 'Skránum var eytt en gögnunum ekki: ' + villa(error, 'óþekkt villa') }, 500);

        // 3. Innskráningar notendanna
        let eyddir = 0;
        const eftir: string[] = [];
        for (const id of notendur) {
          const { error: e } = await bak.auth.admin.deleteUser(id);
          if (e) { console.error('deleteUser', id, e); eftir.push(id); } else eyddir++;
        }
        await skra('eyda', null, { stofa_id: stofa.id, slug: stofa.slug, nafn: stofa.nafn, skrar, notendur: eyddir, eftir, utflutningi_eytt: b.eyda_utflutningi === true });
        return svara(req, {
          ok: eftir.length === 0, skrar, notendur: eyddir,
          svar: eftir.length ? 'Stofunni var eytt en ' + eftir.length + ' innskráningar urðu eftir. Reyndu aftur eða eyddu þeim í Supabase.' : 'Stofunni og öllum gögnum hennar var eytt.'
        });
      }

      default:
        return svara(req, { ok: false, svar: 'Óþekkt aðgerð' }, 400);
    }
  } catch (e) {
    console.error(adgerd, e);
    return svara(req, { ok: false, svar: villa(e, 'Eitthvað fór úrskeiðis.') }, 500);
  }
});
