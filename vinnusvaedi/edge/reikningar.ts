// ==========================================================================
// Supabase Edge Function: reikningar
//
// Býr til reikningsdrög í Payday eða DK úr loknum verkefnum, samningum
// mánaðarins og aukaverkefnum. Drögin eru alltaf DRÖG: ekkert er bókað og
// ekkert fer til viðskiptavinarins héðan. Manneskja fer yfir drögin í
// Payday eða DK og sendir þau þaðan.
//
// Tvö köll (POST JSON, JWT stjórnanda í Authorization):
//   {verk: 'tilbuid', manudur?: 'YYYY-MM'}
//       -> {ok:true, manudur, efni:[...]} það sem má rukka
//   {veita: 'payday'|'dk', uppruni: 'verkefni'|'samningur'|'aukaverkefni',
//    id, manudur?: 'YYYY-MM', linur?: [{texti, upphaed}]}
//       -> {ok:true, svar, drog} eða {ok:false, svar, drog?}
//
// Sama verkefni, sami samningur í sama mánuði eða sama aukaverkefni fær
// aldrei tvenn drög:
//   1. Einkvæm vísitala reikningsdrog_eitt (stofa, veita, uppruni, id,
//      mánuður) þar sem stada <> 'villa'. Línan er tekin frá ÁÐUR en
//      veitan er kölluð, svo tvö samtímis köll búa ekki bæði til drög.
//   2. Ef drög eru til í hinni veitunni er neitað líka.
//   3. Tilvísunin (GH-...) er reiknuð út frá upprunanum, ekki af handahófi.
//      DK neitar tvítekinni tilvísun (UniqeReference=true, svar 409) og
//      Payday er leitað eftir tilvísuninni áður en reynt er aftur.
//   4. Ef ekki er víst hvort veitan bjó drögin til (tími rann út, 5xx)
//      stendur línan áfram sem 'i_vinnslu'. Eftir 5 mínútur má reyna aftur
//      og þá er fyrst athugað hjá veitunni hvort drögin séu til.
//
// Stofan kemur bara úr rpc('min_stada') með JWT notandans, aldrei úr
// beiðninni. Upprunalínur eru lesnar með notandabiðlinum svo RLS sanni
// aðganginn. Service role er bara notað fyrir lyklana í Vault og
// reikningsdrog töfluna (aðeins service role skrifar í hana).
//
// Uppsetning: Supabase -> Edge Functions -> Deploy a new function -> Via
// Editor, nafn reikningar, líma þessa skrá inn. Verify JWT stendur á ON.
// Engin leyndarmál þarf að setja inn: SUPABASE_URL, SUPABASE_ANON_KEY og
// SUPABASE_SERVICE_ROLE_KEY eru alltaf til staðar í Edge Functions.
// ==========================================================================

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

/* ========== sameiginlegt (7.1) ========== */

const LEYFT = ['https://tveir.is', 'https://www.tveir.is', 'https://glerhusid.vercel.app'];
const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': LEYFT.includes(req.headers.get('Origin') || '') ? req.headers.get('Origin')! : LEYFT[0],
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
});

type Hlutur = Record<string, unknown>;
// deno-lint-ignore no-explicit-any
type Bidlari = SupabaseClient<any, 'public', any>;
type Lina = { texti: string; upphaed: number; vsk: number };
type Lyklar = Record<string, string>;
type Uppruni = 'verkefni' | 'samningur' | 'aukaverkefni';
type Veita = 'payday' | 'dk';

const BID = 15000;
const saekja = (slod: string, valkostir: RequestInit = {}) => fetch(slod, { ...valkostir, signal: AbortSignal.timeout(BID) });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MANUDUR = /^\d{4}-(0[1-9]|1[0-2])$/;
const KENNITALA = /^[0-9]{10}$/;
const NETFANG = /^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$/i;
const VEITUR: Veita[] = ['payday', 'dk'];
const UPPRUNAR: Uppruni[] = ['verkefni', 'samningur', 'aukaverkefni'];
const HEITI: Record<Veita, string> = { payday: 'Payday', dk: 'DK' };
const MANADARHEITI = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst',
  'september', 'október', 'nóvember', 'desember'];

/* Lína í reikningsdrog sem er orðin of gömul til að vera enn í vinnslu */
const OF_GAMALT_MS = 5 * 60 * 1000;

const DROG_DALKAR = 'id, veita, uppruni, uppruni_id, manudur, fyrirtaeki_id, linur, upphaed, stada, ytra_id, ytra_numer, ytri_slod, villa, stofnad, uppfaert';

/* Villa sem veitan svaraði með. ovisst = ekki víst hvort drögin urðu til. */
class VeituVilla extends Error {
  constructor(public svar: string, public ovisst = false) { super(svar); }
}
/* Öryggisathugun brást: ekkert var sent til veitunnar */
class Oryggisvilla extends Error {}

/* ========== dagsetningar (Atlantic/Reykjavik) ========== */

function idag(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Atlantic/Reykjavik', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
}
function badaga(dags: string, dagar: number): string {
  const d = new Date(dags + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dagar);
  return d.toISOString().slice(0, 10);
}
function fyrstiNaestaManadar(dags: string): string {
  const d = new Date(dags.slice(0, 7) + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
const manadarTexti = (m: string) => MANADARHEITI[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4);

/* ========== villuboð á mannamáli ========== */

function villuTexti(stada: number, heiti: string): string {
  if (stada === 401) {
    return heiti === 'DK'
      ? 'DK tók ekki við tokeninum eða hann vantar réttindi. Athugaðu réttindi notandans í dkPlus.'
      : heiti + ' tók ekki við lyklinum. Athugaðu að hann sé rétt afritaður og ekki útrunninn.';
  }
  if (stada === 403) return 'Lykillinn virkar en hefur ekki aðgang. Athugaðu réttindin hjá ' + heiti + '.';
  if (stada === 404) return heiti + ' fann ekki það sem beðið var um.';
  if (stada === 429) return heiti + ' bað okkur að bíða. Prófaðu aftur eftir smá stund.';
  if (stada >= 500) return heiti + ' svarar ekki núna. Prófaðu aftur eftir smá stund.';
  return heiti + ' svaraði með villu ' + stada + '.';
}

/* Stutt lýsing veitunnar á villunni, án lína og ekki of löng */
async function veituLysing(r: Response): Promise<string> {
  const texti = await r.text().catch(() => '');
  let lysing = texti;
  try {
    const d = JSON.parse(texti);
    if (typeof d === 'string') lysing = d;
    else if (d && typeof d === 'object') {
      const o = d as Hlutur;
      lysing = String(o.message || o.Message || o.error_description || o.error || o.title || '') ||
        (Array.isArray(o.errors) ? o.errors.map((x) => (x && typeof x === 'object' ? (x as Hlutur).message : x)).join(' ') : '');
    }
  } catch { /* ekki JSON */ }
  return lysing.replace(/<[^>]*>/g, ' ').replace(/[\u2013\u2014]/g, ',').replace(/\s+/g, ' ').trim().slice(0, 200);
}

async function veituVilla(r: Response, heiti: string, ovisst = false): Promise<VeituVilla> {
  const lysing = await veituLysing(r);
  const grunnur = villuTexti(r.status, heiti);
  return new VeituVilla(lysing && r.status !== 401 ? grunnur + ' ' + heiti + ' sagði: ' + lysing : grunnur, ovisst);
}

/* ========== Payday ========== */

const PAYDAY = 'https://api.payday.is';
/* Token gildir í 24 klst. Geymt í 23 klst., eitt á hverja stofu og hvert Client ID. */
const paydayTokar = new Map<string, { tokinn: string; rennur: number }>();

async function paydayToken(stofa: string, k: Lyklar, nyr = false): Promise<string> {
  const lykill = stofa + ':' + (k.clientId || '');
  const til = paydayTokar.get(lykill);
  if (!nyr && til && til.rennur > Date.now()) return til.tokinn;
  const r = await saekja(PAYDAY + '/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Api-Version': 'alpha' },
    body: JSON.stringify({ clientId: k.clientId || '', clientSecret: k.clientSecret || '' })
  });
  if (r.status === 400 || r.status === 401) {
    throw new VeituVilla('Payday þekkir ekki Client ID og Client Secret. Afritaðu þau aftur úr Payday í Stillingum.');
  }
  if (!r.ok) throw await veituVilla(r, 'Payday');
  const d = await r.json().catch(() => null) as Hlutur | null;
  const tokinn = d && typeof d.accessToken === 'string' ? d.accessToken : '';
  if (!tokinn) throw new VeituVilla('Payday skilaði ekki aðgangstóka.');
  paydayTokar.set(lykill, { tokinn, rennur: Date.now() + 23 * 3600 * 1000 });
  return tokinn;
}

/* Kall á Payday með Api-Version: alpha. Nýr tóki einu sinni ef 401. */
async function payday(stofa: string, k: Lyklar, slod: string, valkostir: RequestInit = {}): Promise<Response> {
  for (let tilraun = 0; tilraun < 2; tilraun++) {
    const tokinn = await paydayToken(stofa, k, tilraun > 0);
    const r = await saekja(PAYDAY + slod, {
      ...valkostir,
      headers: {
        'Api-Version': 'alpha',
        'Authorization': 'Bearer ' + tokinn,
        ...(valkostir.body ? { 'Content-Type': 'application/json' } : {})
      }
    });
    if (r.status !== 401 || tilraun > 0) return r;
    paydayTokar.delete(stofa + ':' + (k.clientId || ''));
  }
  throw new VeituVilla('Payday tók ekki við tenginunni.');
}

const listi = (d: unknown, ...lyklar: string[]): Hlutur[] => {
  if (Array.isArray(d)) return d as Hlutur[];
  if (d && typeof d === 'object') {
    for (const l of lyklar) {
      const v = (d as Hlutur)[l];
      if (Array.isArray(v)) return v as Hlutur[];
    }
  }
  return [];
};

/* Viðskiptavinur í Payday: geymt auðkenni, annars leit á kennitölu, annars nýr */
async function paydayVidskiptavinur(stofa: string, k: Lyklar, f: Hlutur): Promise<{ id: string; nytt: boolean }> {
  const kt = String(f.kennitala);
  const geymt = ((f.ytri_numer || {}) as Hlutur).payday;
  if (typeof geymt === 'string' && UUID.test(geymt)) {
    const r = await payday(stofa, k, '/customers/' + encodeURIComponent(geymt));
    if (r.ok) {
      const d = await r.json().catch(() => null) as Hlutur | null;
      const ssn = d && String(d.ssn || '');
      if (!ssn || ssn === kt) return { id: geymt, nytt: false };
    } else if (r.status !== 404) {
      throw await veituVilla(r, 'Payday');
    }
    /* 404 eða önnur kennitala: líklega annar Payday aðgangur, finnum aftur */
  }

  const l = await payday(stofa, k, '/customers/search/?query=' + encodeURIComponent(kt));
  if (l.ok) {
    const d = await l.json().catch(() => null);
    const fundinn = listi(d, 'customers', 'data', 'items').find((c) => String(c.ssn || '') === kt && c.id);
    if (fundinn) return { id: String(fundinn.id), nytt: true };
  } else if (l.status !== 404) {
    throw await veituVilla(l, 'Payday');
  }

  const netfang = String(f.reikningsnetfang || '');
  const n = await payday(stofa, k, '/customers', {
    method: 'POST',
    body: JSON.stringify({
      ssn: kt,
      name: String(f.nafn || ''),
      language: 'is',
      ...(NETFANG.test(netfang) ? { email: netfang } : {})
    })
  });
  if (!n.ok) {
    const v = await veituVilla(n, 'Payday');
    if (n.status === 400) v.svar = 'Payday gat ekki stofnað viðskiptavininn. Athugaðu kennitöluna á fyrirtækinu. ' + v.svar;
    throw v;
  }
  const d = await n.json().catch(() => null) as Hlutur | null;
  const id = d && (d.id || (d.customer && (d.customer as Hlutur).id));
  if (!id) throw new VeituVilla('Payday stofnaði viðskiptavininn en skilaði ekki auðkenni. Prófaðu aftur.');
  return { id: String(id), nytt: true };
}

/* Er reikningur með þessari tilvísun þegar til hjá viðskiptavininum?
   GET /invoices/ með customerId og dateFrom (Payday Postman safnið), allar
   síður, svo nýju drögin finnist líka hjá viðskiptavini með langa sögu.
   null = fannst ekki, undefined = gat ekki athugað. */
async function paydayLeitaTilvisun(stofa: string, k: Lyklar, vidskiptavinur: string, tilvisun: string, fra: string): Promise<Hlutur | null | undefined> {
  for (let sida = 1; sida <= 20; sida++) {
    const r = await payday(stofa, k, '/invoices/?customerId=' + encodeURIComponent(vidskiptavinur) +
      '&dateFrom=' + fra + '&excludeStatus=CANCELLED&perpage=100&page=' + sida);
    if (!r.ok) return undefined;
    const d = await r.json().catch(() => undefined);
    if (d === undefined) return undefined;
    const reikningar = listi(d, 'invoices', 'data', 'items');
    if (!reikningar.length && !Array.isArray(d) && !(d && typeof d === 'object' && ('invoices' in d || 'total' in d))) return undefined;
    const fundinn = reikningar.find((x) => String(x.reference || '') === tilvisun && String(x.status || '') !== 'CANCELLED');
    if (fundinn) return fundinn;
    const sidur = d && typeof d === 'object' && !Array.isArray(d) ? Number((d as Hlutur).pages) : NaN;
    if (Array.isArray(d) || reikningar.length < 100 || (Number.isFinite(sidur) && sida >= sidur)) return null;
  }
  return undefined;
}

/* Eini staðurinn sem býr til reikning í Payday. Án status DRAFT bókar Payday
   reikninginn strax, svo þetta er athugað rétt áður en kallað er. */
async function sendaPaydayDrog(stofa: string, k: Lyklar, meginmal: Hlutur): Promise<Response> {
  if (meginmal.status !== 'DRAFT' || meginmal.sendEmail !== false || meginmal.createClaim !== false ||
      meginmal.createElectronicInvoice !== false) {
    throw new Oryggisvilla('Payday reikningur verður að vera DRAFT, án pósts, án kröfu og án rafræns reiknings');
  }
  return payday(stofa, k, '/invoices', { method: 'POST', body: JSON.stringify(meginmal) });
}

async function paydayDrog(stofa: string, k: Lyklar, f: Hlutur, gogn: Drogsgogn, endurtekid: boolean, leitFra: string) {
  const vv = await paydayVidskiptavinur(stofa, k, f);

  if (endurtekid) {
    const til = await paydayLeitaTilvisun(stofa, k, vv.id, gogn.tilvisun, leitFra);
    if (til === undefined) {
      throw new VeituVilla('Síðasta tilraun kláraðist ekki og ekki tókst að athuga hvort drögin urðu til. ' +
        'Athugaðu reikninga í Payday áður en þú reynir aftur.', false);
    }
    if (til) return { vv, id: String(til.id || ''), numer: til.number ? String(til.number) : null, adur: true };
  }

  const meginmal: Hlutur = {
    customer: { id: vv.id },
    status: 'DRAFT',
    description: gogn.lysing.slice(0, 1024),
    reference: gogn.tilvisun,
    invoiceDate: gogn.dags,
    dueDate: gogn.gjalddagi,
    finalDueDate: gogn.eindagi,
    currencyCode: 'ISK',
    createClaim: false,
    sendEmail: false,
    createElectronicInvoice: false,
    lines: gogn.linur.map((l) => ({
      description: l.texti,
      quantity: 1,
      unitPriceExcludingVat: l.upphaed,
      vatPercentage: l.vsk,
      discountPercentage: 0
    }))
  };

  let r: Response;
  try { r = await sendaPaydayDrog(stofa, k, meginmal); }
  catch (e) {
    if (e instanceof VeituVilla || e instanceof Oryggisvilla) throw e;
    throw new VeituVilla('Payday svaraði ekki í tæka tíð og óvíst er hvort drögin urðu til. ' +
      'Prófaðu aftur eftir 5 mínútur, þá athugum við það fyrst.', true);
  }
  if (!r.ok) throw await veituVilla(r, 'Payday', r.status >= 500);
  const d = await r.json().catch(() => null) as Hlutur | null;
  if (!d || !d.id) {
    throw new VeituVilla('Payday tók við drögunum en svarið var ólæsilegt. Athugaðu reikninga í Payday.', true);
  }
  return { vv, id: String(d.id), numer: d.number ? String(d.number) : null, adur: false };
}

/* ========== DK (dkPlus) ========== */

const DK = 'https://api.dkplus.is';
const dk = (k: Lyklar, slod: string, valkostir: RequestInit = {}) => saekja(DK + slod, {
  ...valkostir,
  headers: {
    'Authorization': 'Bearer ' + (k.token || ''),
    'Accept': 'application/json',
    ...(valkostir.body ? { 'Content-Type': 'application/json' } : {})
  }
});

/* Viðskiptamaður í DK: geymt númer, annars leit á kennitölu, annars nýr */
async function dkVidskiptavinur(k: Lyklar, f: Hlutur): Promise<{ numer: string; nytt: boolean }> {
  const kt = String(f.kennitala);
  const geymt = ((f.ytri_numer || {}) as Hlutur).dk;
  if (typeof geymt === 'string' && /^[A-Za-z0-9._-]{1,12}$/.test(geymt)) {
    const r = await dk(k, '/api/v1/Customer/' + encodeURIComponent(geymt));
    if (r.ok) {
      const d = await r.json().catch(() => null) as Hlutur | null;
      if (d && !d.Deleted && (!d.SSNumber || String(d.SSNumber) === kt)) return { numer: geymt, nytt: false };
    } else if (r.status !== 404) {
      throw await veituVilla(r, 'DK');
    }
  }

  const l = await dk(k, '/api/v1/Customer/search/' + encodeURIComponent(kt) + '/10');
  if (l.ok) {
    const d = await l.json().catch(() => null);
    const fundinn = listi(d).find((c) => String(c.SSNumber || '') === kt && !c.Deleted && c.Number);
    if (fundinn) return { numer: String(fundinn.Number), nytt: true };
  } else if (l.status !== 404) {
    throw await veituVilla(l, 'DK');
  }

  const netfang = String(f.reikningsnetfang || '');
  const n = await dk(k, '/api/v1/Customer', {
    method: 'POST',
    body: JSON.stringify({
      Number: kt,
      Name: String(f.nafn || ''),
      SSNumber: kt,
      ...(NETFANG.test(netfang) ? { Email: netfang } : {})
    })
  });
  /* 409: viðskiptamaður með þessu númeri er þegar til */
  if (n.ok || n.status === 409) return { numer: kt, nytt: true };
  throw await veituVilla(n, 'DK');
}

async function dkLeitaTilvisun(k: Lyklar, tilvisun: string): Promise<Hlutur | null> {
  const r = await dk(k, '/api/v1/sales/invoice/reference/' + encodeURIComponent(tilvisun) + '/1/1');
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  return listi(d)[0] || null;
}

/* Eini staðurinn sem býr til reikning í DK: alltaf post=false (óbókað) og
   UniqeReference=true (DK neitar sömu tilvísun tvisvar með 409). */
async function sendaDkDrog(k: Lyklar, meginmal: Hlutur): Promise<Response> {
  const slod = '/api/v1/sales/invoice?post=false&UniqeReference=true';
  if (!/[?&]post=false(&|$)/.test(slod) || !/UniqeReference=true/.test(slod)) throw new Oryggisvilla('DK reikningur verður að vera óbókaður');
  return dk(k, slod, { method: 'POST', body: JSON.stringify(meginmal) });
}

async function dkDrog(k: Lyklar, stillingar: Hlutur, f: Hlutur, gogn: Drogsgogn) {
  const vv = await dkVidskiptavinur(k, f);
  const vorunumer = String(stillingar.vorunumer || '');
  const vorunumerVsklaust = String(stillingar.vorunumer_vsklaust || '');
  const meginmal: Hlutur = {
    Customer: { Number: vv.numer, SSN: String(f.kennitala), Name: String(f.nafn || '') },
    SalesPerson: String(stillingar.solumadur || ''),
    Reference: gogn.tilvisun,
    Text1: gogn.lysing.slice(0, 200),
    Date: gogn.dags + 'T00:00:00',
    DueDate: gogn.gjalddagi + 'T00:00:00',
    Currency: 'ISK',
    Lines: gogn.linur.map((l) => ({
      ItemCode: l.vsk === 0 && /^[A-Za-z0-9._-]{1,30}$/.test(vorunumerVsklaust) ? vorunumerVsklaust : vorunumer,
      Text: l.texti,
      Quantity: 1,
      Price: l.upphaed,
      IncludingVAT: false
    }))
  };

  let r: Response;
  try { r = await sendaDkDrog(k, meginmal); }
  catch (e) {
    if (e instanceof Oryggisvilla) throw e;
    throw new VeituVilla('DK svaraði ekki í tæka tíð og óvíst er hvort drögin urðu til. ' +
      'Prófaðu aftur eftir 5 mínútur, þá athugum við það fyrst.', true);
  }
  if (r.status === 409) {
    const til = await dkLeitaTilvisun(k, gogn.tilvisun);
    return { vv, id: til ? String(til.RecordID ?? til.Number ?? '') || null : null, numer: til && til.Number ? String(til.Number) : null, adur: true };
  }
  if (!r.ok) {
    const v = await veituVilla(r, 'DK', r.status >= 500);
    if (r.status === 400) v.svar += ' Athugaðu vörunúmer og sölumann á DK tengingunni í Stillingum.';
    throw v;
  }
  const d = await r.json().catch(() => null) as Hlutur | null;
  return {
    vv,
    id: d ? String(d.RecordID ?? d.Number ?? '') || null : null,
    numer: d && d.Number ? String(d.Number) : null,
    adur: false
  };
}

/* ========== upprunar og línur ========== */

type Drogsgogn = {
  linur: Lina[];
  lysing: string;
  tilvisun: string;
  dags: string;
  gjalddagi: string;
  eindagi: string;
};

type Efni = {
  uppruni: Uppruni;
  id: string;
  heiti: string;
  manudur: string | null;
  fyrirtaeki_id: string | null;
  upphaed: number;
  vsklaust: boolean;
  linur: { texti: string; upphaed: number }[];
};

/* Tilvísun reiknuð úr upprunanum svo sama uppspretta fær alltaf sömu
   tilvísun. Samningar fá mánuðinn með, annars rækjust mánuðirnir á. */
function tilvisun(e: Efni): string {
  return 'GH-' + e.id.slice(0, 12) + (e.uppruni === 'samningur' && e.manudur ? '-' + e.manudur.replace('-', '') : '');
}

function efniVerkefnis(v: Hlutur): Efni {
  const titill = String(v.titill || 'Verkefni').slice(0, 200);
  const upphaed = Number(v.verd_okkar) || 0;
  return {
    uppruni: 'verkefni', id: String(v.id), heiti: titill, manudur: null,
    fyrirtaeki_id: (v.fyrirtaeki_id as string) || null, upphaed, vsklaust: false,
    linur: [{ texti: titill, upphaed }]
  };
}

function efniSamnings(s: Hlutur, manudur: string): Efni {
  const texti = ((String(s.thjonusta || '').trim() || 'Þjónusta') + ' ' + manadarTexti(manudur)).slice(0, 200);
  const upphaed = Number(s.upphaed) || 0;
  return {
    uppruni: 'samningur', id: String(s.id), heiti: texti, manudur,
    fyrirtaeki_id: (s.fyrirtaeki_id as string) || null, upphaed, vsklaust: !!s.vsklaust,
    linur: [{ texti, upphaed }]
  };
}

function efniAukaverkefnis(a: Hlutur): Efni {
  const heiti = String(a.heiti || 'Aukaverkefni').slice(0, 200);
  const upphaed = Number(a.upphaed) || 0;
  return {
    uppruni: 'aukaverkefni', id: String(a.id), heiti, manudur: null,
    fyrirtaeki_id: (a.fyrirtaeki_id as string) || null, upphaed, vsklaust: !!a.vsklaust,
    linur: [{ texti: heiti, upphaed }]
  };
}

const samningurIGildi = (s: Hlutur, m: string) =>
  String(s.hefst || '9999-99') <= m && (!s.lykur || String(s.lykur) >= m);

/* Línur úr glugganum: texti 1 til 200 stafir, upphæð heil tala >= 0 */
function lesaLinur(inn: unknown): { texti: string; upphaed: number }[] | string {
  if (!Array.isArray(inn) || !inn.length) return 'Drögin þurfa að minnsta kosti eina línu.';
  if (inn.length > 50) return 'Of margar línur, mest 50.';
  const ut: { texti: string; upphaed: number }[] = [];
  for (const l of inn) {
    if (!l || typeof l !== 'object') return 'Ein línan er ógild.';
    const texti = String((l as Hlutur).texti ?? '').replace(/[\u2013\u2014]/g, ',').replace(/\s+/g, ' ').trim();
    const upphaed = Number((l as Hlutur).upphaed);
    if (!texti || texti.length > 200) return 'Hver lína þarf texta, mest 200 stafi.';
    if (!Number.isFinite(upphaed) || upphaed < 0 || upphaed > 1e11 || Math.round(upphaed) !== upphaed) {
      return 'Upphæð á línu þarf að vera heil tala, 0 eða meira.';
    }
    ut.push({ texti, upphaed });
  }
  return ut;
}

/* ========== þjónninn ========== */

Deno.serve(async (req) => {
  const CORS = cors(req);
  const svara = (gogn: unknown, stada = 200) =>
    new Response(JSON.stringify(gogn), { status: stada, headers: { ...CORS, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return svara({ ok: false, svar: 'Bara POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const audkenni = req.headers.get('Authorization') || '';
  const notandi = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: audkenni } },
    auth: { persistSession: false }
  });

  const { data: stadaGogn } = await notandi.rpc('min_stada');
  const ek = (Array.isArray(stadaGogn) ? stadaGogn[0] : stadaGogn) as Hlutur | null;
  if (!ek || ek.stada !== 'virk' || ek.er_admin !== true || !ek.stofa_id) {
    return svara({ ok: false, svar: 'Bara stjórnendur geta búið til reikningsdrög' }, 403);
  }
  const stofa = String(ek.stofa_id);

  const inn = await req.json().catch(() => null) as Hlutur | null;
  if (!inn || typeof inn !== 'object') return svara({ ok: false, svar: 'Ógild beiðni' }, 400);

  const bak = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  /* Kerfisstillingar stofunnar: VSK og gjalddagi */
  async function stillingarStofu() {
    const { data } = await notandi.from('kerfisstillingar').select('lykill, gildi')
      .eq('stofa_id', stofa).in('lykill', ['vsk_hlutfall', 'gjalddagi_dagar']);
    const s: Record<string, string> = {};
    (data || []).forEach((r: Hlutur) => { s[String(r.lykill)] = String(r.gildi); });
    const vsk = ['0', '11', '24'].includes(s.vsk_hlutfall) ? Number(s.vsk_hlutfall) : 24;
    const dagar = /^[0-9]{1,4}$/.test(s.gjalddagi_dagar || '') ? Number(s.gjalddagi_dagar) : 14;
    return { vsk, dagar };
  }

  /* Fyrirtæki lesin sér (ekki embed), RLS sannar að þau séu í stofunni */
  async function fyrirtaekin(idir: string[]): Promise<Map<string, Hlutur>> {
    const kort = new Map<string, Hlutur>();
    const einstok = [...new Set(idir.filter(Boolean))];
    if (!einstok.length) return kort;
    const { data, error } = await notandi.from('fyrirtaeki')
      .select('id, nafn, kennitala, reikningsnetfang, ytri_numer').eq('stofa_id', stofa).in('id', einstok);
    if (error) throw error;
    (data || []).forEach((f: Hlutur) => kort.set(String(f.id), f));
    return kort;
  }

  /* Öll drög sem gilda (ekki villa) fyrir þessa uppruna */
  async function gildDrog(uppruni: Uppruni, idir: string[]): Promise<Hlutur[]> {
    if (!idir.length) return [];
    const { data, error } = await notandi.from('reikningsdrog').select(DROG_DALKAR)
      .eq('stofa_id', stofa).eq('uppruni', uppruni).in('uppruni_id', idir).neq('stada', 'villa');
    if (error) throw error;
    return (data || []) as Hlutur[];
  }

  try {
    /* ================= það sem má rukka ================= */
    if (inn.verk === 'tilbuid') {
      const manudur = inn.manudur == null || inn.manudur === '' ? idag().slice(0, 7) : String(inn.manudur);
      if (!MANUDUR.test(manudur)) return svara({ ok: false, svar: 'Mánuður á að vera á forminu ÁÁÁÁ-MM' }, 400);
      const manDags = manudur + '-01';

      const [vRes, sRes, aRes] = await Promise.all([
        notandi.from('verkefni').select('id, titill, fyrirtaeki_id, verd_okkar, stada, innan_samnings')
          .eq('stofa_id', stofa).eq('stada', 'lokid').eq('innan_samnings', false).not('verd_okkar', 'is', null),
        notandi.from('samningar').select('id, vidskiptavinur, thjonusta, upphaed, vsklaust, hefst, lykur, fyrirtaeki_id')
          .eq('stofa_id', stofa).lte('hefst', manudur),
        notandi.from('aukaverkefni').select('id, heiti, vidskiptavinur, upphaed, vsklaust, stada, greitt, fyrirtaeki_id, dags')
          .eq('stofa_id', stofa).eq('stada', 'stadfest').eq('greitt', false)
      ]);
      const villa = vRes.error || sRes.error || aRes.error;
      if (villa) throw villa;

      const verkefni = (vRes.data || []) as Hlutur[];
      const samningar = ((sRes.data || []) as Hlutur[]).filter((s) => samningurIGildi(s, manudur));
      const aukaverkefni = (aRes.data || []) as Hlutur[];

      const vIdir = verkefni.map((v) => String(v.id));
      const [innri, vDrog, sDrog, aDrog] = await Promise.all([
        vIdir.length
          ? notandi.from('verkefni_innri').select('verkefni_id, reikningur').eq('stofa_id', stofa).in('verkefni_id', vIdir)
          : Promise.resolve({ data: [], error: null }),
        gildDrog('verkefni', vIdir),
        gildDrog('samningur', samningar.map((s) => String(s.id))),
        gildDrog('aukaverkefni', aukaverkefni.map((a) => String(a.id)))
      ]);
      if (innri.error) throw innri.error;
      const rukkun = new Map<string, string>();
      ((innri.data || []) as Hlutur[]).forEach((i) => rukkun.set(String(i.verkefni_id), String(i.reikningur)));
      const medDrog = new Set<string>([
        ...vDrog.map((d) => 'verkefni:' + d.uppruni_id),
        ...sDrog.filter((d) => String(d.manudur || '') === manDags).map((d) => 'samningur:' + d.uppruni_id),
        ...aDrog.map((d) => 'aukaverkefni:' + d.uppruni_id)
      ]);

      const efni: (Efni & { vidskiptavinur?: string })[] = [
        ...verkefni.filter((v) => (rukkun.get(String(v.id)) || 'ekki_rukkad') === 'ekki_rukkad').map(efniVerkefnis),
        ...samningar.map((s) => ({ ...efniSamnings(s, manudur), vidskiptavinur: String(s.vidskiptavinur || '') })),
        ...aukaverkefni.map((a) => ({ ...efniAukaverkefnis(a), vidskiptavinur: String(a.vidskiptavinur || '') }))
      ].filter((e) => !medDrog.has(e.uppruni + ':' + e.id));

      const fyr = await fyrirtaekin(efni.map((e) => e.fyrirtaeki_id || ''));
      const { vsk } = await stillingarStofu();
      return svara({
        ok: true,
        manudur,
        efni: efni.map((e) => {
          const f = e.fyrirtaeki_id ? fyr.get(e.fyrirtaeki_id) : undefined;
          return {
            uppruni: e.uppruni,
            id: e.id,
            heiti: e.heiti,
            manudur: e.manudur,
            fyrirtaeki_id: f ? e.fyrirtaeki_id : null,
            fyrirtaeki: f ? String(f.nafn) : (e.vidskiptavinur || null),
            kennitala: !!(f && KENNITALA.test(String(f.kennitala || ''))),
            reikningsnetfang: !!(f && f.reikningsnetfang),
            upphaed: e.upphaed,
            vsklaust: e.vsklaust,
            vsk: e.vsklaust ? 0 : vsk,
            linur: e.linur
          };
        })
      });
    }

    /* ================= búa til drög ================= */
    const veita = String(inn.veita || '') as Veita;
    const uppruni = String(inn.uppruni || '') as Uppruni;
    const id = String(inn.id || '');
    if (!VEITUR.includes(veita)) return svara({ ok: false, svar: 'Veldu Payday eða DK' }, 400);
    if (!UPPRUNAR.includes(uppruni)) return svara({ ok: false, svar: 'Óþekkt tegund' }, 400);
    if (!UUID.test(id)) return svara({ ok: false, svar: 'Ógilt auðkenni' }, 400);
    let manudur: string | null = null;
    if (uppruni === 'samningur') {
      manudur = inn.manudur == null || inn.manudur === '' ? idag().slice(0, 7) : String(inn.manudur);
      if (!MANUDUR.test(manudur)) return svara({ ok: false, svar: 'Mánuður á að vera á forminu ÁÁÁÁ-MM' }, 400);
    }
    const heiti = HEITI[veita];

    /* 1. Uppsprettan, lesin með notandabiðlinum */
    let efni: Efni;
    if (uppruni === 'verkefni') {
      const { data: v, error } = await notandi.from('verkefni')
        .select('id, titill, fyrirtaeki_id, verd_okkar, stada, innan_samnings').eq('stofa_id', stofa).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!v) return svara({ ok: false, svar: 'Verkefnið fannst ekki' }, 404);
      if (v.stada !== 'lokid') return svara({ ok: false, svar: 'Verkefninu er ekki lokið' }, 400);
      if (v.innan_samnings) return svara({ ok: false, svar: 'Verkefnið er innan samnings og rukkast með honum' }, 400);
      const { data: i } = await notandi.from('verkefni_innri').select('reikningur').eq('stofa_id', stofa).eq('verkefni_id', id).maybeSingle();
      if (i && i.reikningur === 'rukkad') return svara({ ok: false, svar: 'Verkefnið er þegar rukkað' }, 400);
      if (i && i.reikningur === 'greitt') return svara({ ok: false, svar: 'Verkefnið er þegar greitt' }, 400);
      efni = efniVerkefnis(v as Hlutur);
      if (v.verd_okkar == null && inn.linur == null) return svara({ ok: false, svar: 'Settu verð á verkefnið fyrst' }, 400);
    } else if (uppruni === 'samningur') {
      const { data: s, error } = await notandi.from('samningar')
        .select('id, thjonusta, upphaed, vsklaust, hefst, lykur, fyrirtaeki_id').eq('stofa_id', stofa).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!s) return svara({ ok: false, svar: 'Samningurinn fannst ekki' }, 404);
      if (!samningurIGildi(s as Hlutur, manudur!)) return svara({ ok: false, svar: 'Samningurinn er ekki í gildi í ' + manadarTexti(manudur!) }, 400);
      efni = efniSamnings(s as Hlutur, manudur!);
    } else {
      const { data: a, error } = await notandi.from('aukaverkefni')
        .select('id, heiti, upphaed, vsklaust, stada, greitt, fyrirtaeki_id').eq('stofa_id', stofa).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!a) return svara({ ok: false, svar: 'Aukaverkefnið fannst ekki' }, 404);
      if (a.stada !== 'stadfest') return svara({ ok: false, svar: 'Aukaverkefnið er ekki staðfest' }, 400);
      if (a.greitt) return svara({ ok: false, svar: 'Aukaverkefnið er þegar greitt' }, 400);
      efni = efniAukaverkefnis(a as Hlutur);
    }

    if (!efni.fyrirtaeki_id) {
      const hvad = uppruni === 'verkefni' ? 'verkefnið' : uppruni === 'samningur' ? 'samninginn' : 'aukaverkefnið';
      return svara({ ok: false, svar: 'Tengdu ' + hvad + ' við fyrirtæki fyrst' }, 400);
    }
    const f = (await fyrirtaekin([efni.fyrirtaeki_id])).get(efni.fyrirtaeki_id);
    if (!f) return svara({ ok: false, svar: 'Fyrirtækið fannst ekki' }, 404);
    if (!KENNITALA.test(String(f.kennitala || ''))) return svara({ ok: false, svar: 'Settu kennitölu á fyrirtækið fyrst' }, 400);

    /* 2. Línur og VSK. Upphæðir án VSK. */
    const { vsk: vskStofu, dagar } = await stillingarStofu();
    const vsk = efni.vsklaust ? 0 : vskStofu;
    let grunnlinur = efni.linur;
    if (inn.linur != null) {
      const l = lesaLinur(inn.linur);
      if (typeof l === 'string') return svara({ ok: false, svar: l }, 400);
      grunnlinur = l;
    }
    const linur: Lina[] = grunnlinur.map((l) => ({ texti: l.texti, upphaed: l.upphaed, vsk }));
    const upphaed = linur.reduce((s, l) => s + l.upphaed, 0);
    if (upphaed <= 0) return svara({ ok: false, svar: 'Upphæðin er 0 kr. Settu verð á línurnar.' }, 400);

    /* Lyklar og stillingar tengingarinnar, athugað áður en lína er tekin frá */
    const [{ data: lyklar }, { data: tenging }] = await Promise.all([
      bak.rpc('tenging_lykill', { p_stofa: stofa, p_veita: veita }),
      bak.from('tengingar').select('stillingar').eq('stofa_id', stofa).eq('veita', veita).maybeSingle()
    ]);
    if (!lyklar) return svara({ ok: false, svar: heiti + ' er ekki tengt. Tengdu það í Stillingum.' }, 404);
    const stillingar = ((tenging && tenging.stillingar) || {}) as Hlutur;
    if (veita === 'dk' && (!/^[A-Za-z0-9._-]{1,30}$/.test(String(stillingar.vorunumer || '')) || !String(stillingar.solumadur || ''))) {
      return svara({ ok: false, svar: 'Settu vörunúmer og sölumann á DK tenginguna í Stillingum fyrst.' }, 400);
    }

    /* Drög í hinni veitunni? Þá ekki önnur. */
    const manDags = manudur ? manudur + '-01' : null;
    const allDrog = (await gildDrog(uppruni, [id])).filter((d) => String(d.manudur || '') === String(manDags || ''));
    const annad = allDrog.find((d) => d.veita !== veita);
    if (annad) {
      return svara({ ok: false, svar: 'Drög fyrir þetta eru þegar til í ' + HEITI[annad.veita as Veita] + '.', drog: annad });
    }

    /* 3. Taka línuna frá. Einkvæma vísitalan stoppar tvö drög. */
    const nu = new Date().toISOString();
    let drog: Hlutur | null = null;
    let endurtekid = false;
    const ny = await bak.from('reikningsdrog').insert({
      stofa_id: stofa, veita, uppruni, uppruni_id: id, manudur: manDags,
      fyrirtaeki_id: efni.fyrirtaeki_id, linur, upphaed, stada: 'i_vinnslu',
      stofnandi: await notandaId(notandi, audkenni)
    }).select(DROG_DALKAR).single();

    if (ny.error) {
      if (ny.error.code !== '23505') throw ny.error;
      let leit = bak.from('reikningsdrog').select(DROG_DALKAR)
        .eq('stofa_id', stofa).eq('veita', veita).eq('uppruni', uppruni).eq('uppruni_id', id).neq('stada', 'villa');
      leit = manDags ? leit.eq('manudur', manDags) : leit.is('manudur', null);
      const { data: til } = await leit.maybeSingle();
      /* kodi 'i_vinnslu': ekki villa, drögin eru í smíðum (listinn sýnir "Í vinnslu" og
         "Reyna aftur" þegar línan hefur staðið óbreytt í 5 mínútur, sama mörk og OF_GAMALT_MS) */
      if (!til) return svara({ ok: false, kodi: 'i_vinnslu', svar: 'Drögin eru í vinnslu. Prófaðu aftur eftir smá stund.' });
      if (til.stada === 'drog') return svara({ ok: true, adur: true, svar: 'Drögin eru þegar til', drog: til });

      /* i_vinnslu: annað kall er í gangi, eða síðasta kall kláraðist ekki */
      if (Date.now() - new Date(String(til.uppfaert)).getTime() < OF_GAMALT_MS) {
        return svara({ ok: false, kodi: 'i_vinnslu', svar: 'Verið er að búa drögin til. Prófaðu aftur eftir smá stund.', drog: til });
      }
      const { data: tekid } = await bak.from('reikningsdrog').update({ uppfaert: nu, villa: null })
        .eq('id', til.id).eq('stada', 'i_vinnslu').eq('uppfaert', til.uppfaert).select(DROG_DALKAR).maybeSingle();
      if (!tekid) return svara({ ok: false, kodi: 'i_vinnslu', svar: 'Verið er að búa drögin til. Prófaðu aftur eftir smá stund.', drog: til });
      drog = tekid as Hlutur;
      endurtekid = true;
    } else {
      drog = ny.data as Hlutur;
      /* Einkvæma vísitalan nær bara yfir eina veitu. Ef annað kall tók frá
         sama upprunann í hinni veitunni á sama tíma víkur þetta kall. */
      const samtimis = (await gildDrog(uppruni, [id]))
        .filter((d) => String(d.manudur || '') === String(manDags || '') && d.veita !== veita);
      if (samtimis.length) {
        await bak.from('reikningsdrog').delete().eq('id', String(drog.id)).eq('stofa_id', stofa).eq('stada', 'i_vinnslu');
        return svara({
          ok: false,
          svar: 'Drög fyrir þetta eru þegar til í ' + HEITI[samtimis[0].veita as Veita] + '.',
          drog: samtimis[0]
        });
      }
    }

    /* Ef reynt er aftur eru línurnar þær sem voru teknar frá fyrst, svo
       drögin sem kunna að vera til passi við línuna hér. */
    const notadarLinur = (endurtekid && Array.isArray(drog.linur) ? drog.linur : linur) as Lina[];

    /* 5. Dagsetningar */
    const dags = idag();
    const gjalddagi = uppruni === 'samningur' ? fyrstiNaestaManadar(dags) : badaga(dags, dagar);
    const gogn: Drogsgogn = {
      linur: notadarLinur,
      lysing: efni.heiti,
      tilvisun: tilvisun(efni),
      dags,
      gjalddagi,
      eindagi: badaga(gjalddagi, 14)
    };

    const klara = async (breyting: Hlutur) => {
      const { data } = await bak.from('reikningsdrog').update({ ...breyting, uppfaert: new Date().toISOString() })
        .eq('id', drog!.id).select(DROG_DALKAR).single();
      return (data || { ...drog, ...breyting }) as Hlutur;
    };

    /* 6. og 7. Veitan */
    let ytraId: string | null = null;
    let ytraNumer: string | null = null;
    let ytriSlod: string | null = null;
    let adur = false;
    try {
      if (veita === 'payday') {
        /* Fyrsta tilraun kann að vera frá deginum áður: leitað frá degi fyrir stofnun línunnar */
        const leitFra = badaga(String(drog.stofnad || nu).slice(0, 10), -1);
        const r = await paydayDrog(stofa, lyklar as Lyklar, f, gogn, endurtekid, leitFra);
        ytraId = r.id; ytraNumer = r.numer; adur = r.adur;
        ytriSlod = 'https://app.payday.is/invoices';
        if (r.vv.nytt) await geymaYtraNumer(notandi, stofa, f, 'payday', r.vv.id);
      } else {
        const r = await dkDrog(lyklar as Lyklar, stillingar, f, gogn);
        ytraId = r.id; ytraNumer = r.numer; adur = r.adur;
        if (r.vv.nytt) await geymaYtraNumer(notandi, stofa, f, 'dk', r.vv.numer);
      }
    } catch (e) {
      const v = e instanceof VeituVilla ? e
        : new VeituVilla((e as Error).name === 'TimeoutError'
          ? heiti + ' svaraði ekki innan 15 sekúndna. Prófaðu aftur.'
          : 'Náði ekki sambandi við ' + heiti + '.');
      /* Óvíst: línan stendur sem i_vinnslu svo næsta tilraun athugi veituna fyrst */
      const breytt = await klara(v.ovisst ? { villa: v.svar.slice(0, 500) } : { stada: 'villa', villa: v.svar.slice(0, 500) });
      return svara({ ok: false, svar: v.svar, drog: breytt });
    }

    /* 8. Tókst */
    const lokid = await klara({ stada: 'drog', ytra_id: ytraId, ytra_numer: ytraNumer, ytri_slod: ytriSlod, villa: null });
    if (uppruni === 'verkefni') {
      const { error } = await notandi.from('verkefni_innri').update({ reikningur: 'drog', reikningur_dags: dags }).eq('stofa_id', stofa).eq('verkefni_id', id);
      if (error) console.error('reikningar: verkefni_innri', error.message);
    }
    const svar = adur
      ? 'Drögin voru þegar til í ' + heiti + (ytraNumer ? ' nr ' + ytraNumer : '') + '. Ekkert nýtt var búið til.'
      : 'Drög búin til í ' + heiti + (ytraNumer ? ' nr ' + ytraNumer : '') + '. Farðu yfir þau og sendu þaðan.';
    return svara({
      ok: true,
      svar: veita === 'dk' && vsk === 0 && !stillingar.vorunumer_vsklaust
        ? svar + ' DK reiknar VSK eftir vörunúmerinu, athugaðu VSK á drögunum.'
        : svar,
      drog: lokid
    });
  } catch (e) {
    console.error('reikningar', e);
    return svara({ ok: false, svar: 'Eitthvað fór úrskeiðis. Prófaðu aftur.' }, 500);
  }
});

/* ========== hjálparföll ========== */

async function notandaId(notandi: Bidlari, audkenni: string): Promise<string | null> {
  const tokinn = audkenni.replace(/^Bearer\s+/i, '');
  if (!tokinn) return null;
  const { data } = await notandi.auth.getUser(tokinn).catch(() => ({ data: { user: null } }));
  return (data && data.user && data.user.id) || null;
}

/* Auðkenni viðskiptavinarins hjá veitunni geymt á fyrirtækinu. Skrifað með
   notandabiðlinum (stjórnandi stofunnar, RLS), því verja_fyrirtaeki festir
   ytri_numer þegar er_admin() er ekki satt, eins og undir service role. */
async function geymaYtraNumer(notandi: Bidlari, stofa: string, f: Hlutur, veita: Veita, gildi: string) {
  const ytri = { ...((f.ytri_numer || {}) as Hlutur), [veita]: gildi };
  const { error } = await notandi.from('fyrirtaeki').update({ ytri_numer: ytri }).eq('stofa_id', stofa).eq('id', String(f.id));
  if (error) console.error('reikningar: ytri_numer', error.message);
}
