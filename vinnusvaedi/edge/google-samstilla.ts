// ==========================================================================
// Supabase Edge Function: google-samstilla
//
// Seinna: les Google dagatöl og Google Analytics (GA4) hjá hverri stofu sem
// hefur tengt Google með oauth fallinu. Gerir EKKERT fyrr en
// stillingar_innri.google_tilbuid = 'ja' og GOOGLE_CLIENT_ID og
// GOOGLE_CLIENT_SECRET eru í Edge secrets. Þangað til svarar það bara
// { ok: true, virkt: false }.
//
// Hver kallar: pg_cron á 10 mínútna fresti með net.http_post, haus x-vakt
// með gildinu úr stillingar_innri.vakt_lykill, borið saman við Edge secret
// VAKT_LYKILL. Verify JWT: ON, svo cron sendir líka
// Authorization: Bearer <anon key>. Annað en rétt x-vakt fær 401.
//
// Fyrir hverja google línu í tengingar (stofa virk):
//   1. Nýr access token úr refresh_token í Vault (tenging_lykill).
//      invalid_grant: skra_tengingarprufu segir stjórnandanum að tengja aftur.
//   2. Valin dagatöl (stillingar.dagatol, autt = primary), 14 dögum aftur og
//      90 fram. Línum stofunnar í dagatal_atburdir með uppruni = 'google' er
//      skipt út: upsert fyrst, svo eytt þeim sem komu ekki aftur. Línur úr
//      Apps Script (uppruni apps_script) eru aldrei snertar.
//   3. GA4: daglegar heimsóknir (sessions) síðustu 14 daga í
//      maelingar.heimsoknir fyrir hverja midlar línu stofunnar með
//      midill = 'vefur' (ytra_id = GA4 property id).
// Svar: { ok: true, virkt: true, stofur: n, atburdir: n, maelingar: n, villur: n }
//
// Uppsetning (seinna, þegar Google hefur samþykkt): Deploy með nafninu
// google-samstilla, setja VAKT_LYKILL í Edge secrets og sama gildi í
// stillingar_innri.vakt_lykill, og pg_cron verkið (lead skrifar SQL).
// ==========================================================================

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const BID = 20000;
const AFTUR = 14, FRAM = 90;
const MEST_DAGATOL = 10, MEST_ATBURDIR = 2000, MEST_STOFUR = 200;
const HLEKKUR = /https:\/\/(meet\.google\.com|[a-z0-9.-]*zoom\.us|teams\.microsoft\.com|teams\.live\.com)\/[^\s"'<>)]+/i;
const saekja = (slod: string, valkostir: RequestInit = {}) => fetch(slod, { ...valkostir, signal: AbortSignal.timeout(BID) });
const env = (nafn: string) => Deno.env.get(nafn) || '';
const svara = (gogn: Record<string, unknown>, stada = 200) =>
  new Response(JSON.stringify(gogn), { status: stada, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function jafnt(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let munur = 0;
  for (let i = 0; i < a.length; i++) munur |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return munur === 0;
}
const hex8 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).slice(0, 4), (x) => x.toString(16).padStart(2, '0')).join('');
const https = (x: unknown, n: number) => (typeof x === 'string' && /^https:\/\/\S+$/.test(x) && x.length <= n ? x : null);

class Utrunnid extends Error {}

async function adgangstoken(refresh: string): Promise<string> {
  const r = await saekja('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), refresh_token: refresh, grant_type: 'refresh_token' })
  });
  const d = await r.json().catch(() => ({})) as { access_token?: string; error?: string };
  if (d.error === 'invalid_grant' || d.error === 'unauthorized_client') throw new Utrunnid();
  if (!r.ok || !d.access_token) throw new Error('token ' + r.status);
  return d.access_token;
}

type Atburdur = Record<string, unknown>;

async function dagatal(tokinn: string, dagatalId: string, fra: Date, til: Date): Promise<Atburdur[]> {
  const h = await hex8(dagatalId);
  const ut: Atburdur[] = [];
  let sida = '';
  for (let i = 0; i < 8 && ut.length < MEST_ATBURDIR; i++) {
    const p = new URLSearchParams({
      timeMin: fra.toISOString(), timeMax: til.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
      fields: 'nextPageToken,items(id,status,summary,description,location,start,end,htmlLink,hangoutLink,attendees(email),conferenceData(entryPoints(uri,entryPointType)))'
    });
    if (sida) p.set('pageToken', sida);
    const r = await saekja('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(dagatalId) + '/events?' + p, {
      headers: { Authorization: 'Bearer ' + tokinn }
    });
    if (r.status === 401) throw new Utrunnid();
    if (!r.ok) throw new Error('dagatal ' + r.status);
    const d = await r.json() as { items?: any[]; nextPageToken?: string };
    for (const e of d.items || []) {
      if (!e || !e.id || e.status === 'cancelled') continue;
      const allan = !!(e.start && e.start.date && !e.start.dateTime);
      const byrjar = allan ? e.start.date + 'T00:00:00Z' : e.start && e.start.dateTime;
      const endar = allan ? (e.end && e.end.date ? e.end.date + 'T00:00:00Z' : byrjar) : (e.end && e.end.dateTime) || byrjar;
      if (!byrjar || isNaN(Date.parse(byrjar)) || isNaN(Date.parse(endar))) continue;
      const lysing = String(e.description || '');
      const stadur = String(e.location || '');
      const radstefna = e.conferenceData && Array.isArray(e.conferenceData.entryPoints)
        ? (e.conferenceData.entryPoints.find((x: any) => x && x.entryPointType === 'video') || {}).uri : null;
      const fundur = https(e.hangoutLink, 1000) || https(radstefna, 1000) || (((lysing + ' ' + stadur).match(HLEKKUR) || [])[0] || '').slice(0, 1000) || null;
      ut.push({
        id: ('g:' + h + ':' + e.id).slice(0, 300),
        titill: String(e.summary || '(enginn titill)').slice(0, 300),
        lysing: lysing.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) || null,
        stadur: stadur.slice(0, 300) || null,
        byrjar: new Date(byrjar).toISOString(),
        endar: new Date(endar).toISOString(),
        allan_daginn: allan,
        tengill: https(e.htmlLink, 1000),
        fundarhlekkur: fundur,
        gestir: Array.isArray(e.attendees) ? e.attendees.length : 0,
        dagatal_id: dagatalId.slice(0, 300)
      });
    }
    sida = d.nextPageToken || '';
    if (!sida) break;
  }
  return ut;
}

async function heimsoknir(tokinn: string, eign: string): Promise<{ dags: string; heimsoknir: number }[]> {
  const r = await saekja('https://analyticsdata.googleapis.com/v1beta/properties/' + eign + ':runReport', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokinn, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateRanges: [{ startDate: AFTUR + 'daysAgo', endDate: 'today' }], dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }], limit: 100 })
  });
  if (r.status === 401) throw new Utrunnid();
  if (!r.ok) throw new Error('ga4 ' + r.status);
  const d = await r.json() as { rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[] };
  return (d.rows || []).map((row) => {
    const s = String((row.dimensionValues && row.dimensionValues[0] && row.dimensionValues[0].value) || '');
    const n = Number((row.metricValues && row.metricValues[0] && row.metricValues[0].value) || 0);
    return /^\d{8}$/.test(s) && Number.isFinite(n) && n >= 0
      ? { dags: s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8), heimsoknir: Math.round(n) }
      : null;
  }).filter((x): x is { dags: string; heimsoknir: number } => x !== null);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return svara({ ok: false, svar: 'Bara POST' }, 405);

  // Bara cron með rétta vaktlykilinn
  const vakt = env('VAKT_LYKILL');
  if (vakt.length < 24 || !jafnt(req.headers.get('x-vakt') || '', vakt)) return svara({ ok: false, svar: 'Óheimilt' }, 401);

  const bak = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

  // Slökkt þar til Google hefur samþykkt appið. Lokað ef ekki tekst að lesa.
  const { data: rofi, error: rofaVilla } = await bak.from('stillingar_innri').select('gildi').eq('lykill', 'google_tilbuid').maybeSingle();
  const virkt = !rofaVilla && !!rofi && rofi.gildi === 'ja' && !!env('GOOGLE_CLIENT_ID') && !!env('GOOGLE_CLIENT_SECRET');
  if (!virkt) return svara({ ok: true, virkt: false, svar: 'Google samstilling er ekki komin í gang' });

  const { data: linur, error } = await bak.from('tengingar').select('stofa_id, stillingar').eq('veita', 'google').limit(MEST_STOFUR);
  if (error) { console.error('tengingar', error.message); return svara({ ok: false, svar: 'Náði ekki að lesa tengingar' }, 500); }
  const ids = (linur || []).map((l: any) => l.stofa_id);
  const { data: virkar } = ids.length
    ? await bak.from('stofur').select('id').in('id', ids).eq('stada', 'virk')
    : { data: [] as { id: string }[] };
  const opnar = new Set((virkar || []).map((s: any) => s.id));

  const nu = Date.now();
  const fra = new Date(nu - AFTUR * 864e5), til = new Date(nu + FRAM * 864e5);
  let stofur = 0, atburdir = 0, maelingar = 0, villur = 0;

  for (const lina of linur || []) {
    const stofa = String((lina as any).stofa_id);
    if (!opnar.has(stofa)) continue;
    const st = ((lina as any).stillingar || {}) as Record<string, unknown>;
    const hlaup = new Date().toISOString();
    try {
      const { data: lyklar } = await bak.rpc('tenging_lykill', { p_stofa: stofa, p_veita: 'google' });
      const refresh = lyklar && (lyklar as Record<string, string>).refresh_token;
      if (!refresh) continue;
      const tokinn = await adgangstoken(refresh);
      stofur++;

      // Dagatöl
      if (st.dagatal_leyft !== false) {
        const valin = (Array.isArray(st.dagatol) ? st.dagatol : [])
          .map((x) => String(x)).filter((x) => /^[A-Za-z0-9._@#%+-]{1,200}$/.test(x)).slice(0, MEST_DAGATOL);
        const dagatol = valin.length ? valin : ['primary'];
        const allir: Atburdur[] = [];
        const sed = new Set<string>();
        for (const d of dagatol) {
          for (const a of await dagatal(tokinn, d, fra, til)) {
            if (sed.has(a.id as string)) continue;
            sed.add(a.id as string);
            allir.push({ ...a, stofa_id: stofa, uppruni: 'google', uppfaert: hlaup });
          }
        }
        // Öll dagatöl lásust: upsert, svo út það sem kom ekki aftur
        for (let i = 0; i < allir.length && i < MEST_ATBURDIR; i += 500) {
          const { error: e } = await bak.from('dagatal_atburdir').upsert(allir.slice(i, Math.min(i + 500, MEST_ATBURDIR)), { onConflict: 'stofa_id,id' });
          if (e) throw new Error('dagatal_atburdir ' + e.message);
        }
        await bak.from('dagatal_atburdir').delete().eq('stofa_id', stofa).eq('uppruni', 'google').lt('uppfaert', hlaup);
        atburdir += Math.min(allir.length, MEST_ATBURDIR);
      }

      // GA4 heimsóknir á vefina
      if (st.greining_leyft !== false) {
        const { data: vefir } = await bak.from('midlar').select('id, fyrirtaeki_id, ytra_id')
          .eq('stofa_id', stofa).eq('midill', 'vefur').eq('virkt', true).limit(20);
        for (const v of vefir || []) {
          const eign = String((v as any).ytra_id || '');
          if (!/^[0-9]{4,15}$/.test(eign)) continue;
          const dagar = await heimsoknir(tokinn, eign);
          if (!dagar.length) continue;
          const { error: e } = await bak.from('maelingar').upsert(dagar.map((d) => ({
            midill_id: (v as any).id, fyrirtaeki_id: (v as any).fyrirtaeki_id, dags: d.dags,
            heimsoknir: d.heimsoknir, uppruni: 'sjalfvirkt', uppfaert: hlaup
          })), { onConflict: 'midill_id,dags' });
          if (e) throw new Error('maelingar ' + e.message);
          maelingar += dagar.length;
        }
      }
    } catch (e) {
      villur++;
      if (e instanceof Utrunnid) {
        await bak.rpc('skra_tengingarprufu', { p_stofa: stofa, p_veita: 'google',
          p_svar: 'Google tengingin er útrunnin eða var afturkölluð. Tengdu Google aftur í Stillingum.' });
      } else {
        console.error('google-samstilla', stofa, (e as Error).message);
      }
    }
  }

  return svara({ ok: true, virkt: true, stofur, atburdir, maelingar, villur });
});
