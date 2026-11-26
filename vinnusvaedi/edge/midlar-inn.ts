// ==========================================================================
// Supabase Edge Function: midlar-inn (Messenger og Instagram skilaboð frá Zernio)
//
// Zernio á samþykkt Meta app og sendir hingað hvert skilaboð sem kemur á
// Facebook síðu eða Instagram stofu (message.received), og hvert svar sem er
// sent (message.sent). Vefkrókurinn er skráður hjá Zernio með:
//   - sérhaus Authorization: Bearer <anon lykill>, því Verify JWT er á,
//   - leyndarmáli sem er líka í ZERNIO_LEYNDARMAL hér (Edge Function Secrets).
// Undirskriftin X-Zernio-Signature er HMAC-SHA256 (hex) af hráa meginmálinu.
//
// Prófíll Zernio segir hvaða stofu skilaboðin eiga (midla_profilar).
// Óþekktur prófíll eða atburður: 200 og ekkert gert, svo Zernio reyni ekki aftur.
// Sama skilaboð tvisvar: seinna skiptið gerir ekkert (id er lykillinn).
// Svarað innan 5 sekúndna, annars reynir Zernio aftur.
// ==========================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const svara = (gogn: unknown, stada = 200) =>
  new Response(JSON.stringify(gogn), { status: stada, headers: { 'Content-Type': 'application/json' } });

const RASIR = ['facebook', 'instagram'];
const str = (x: unknown, max: number) => (typeof x === 'string' && x.length ? x.slice(0, max) : null);

async function hmacHex(leyndarmal: string, texti: string) {
  const lykill = await crypto.subtle.importKey('raw', new TextEncoder().encode(leyndarmal),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', lykill, new TextEncoder().encode(texti));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Samanburður sem tekur alltaf jafn langan tíma
function eins(a: string, b: string) {
  if (a.length !== b.length) return false;
  let m = 0;
  for (let i = 0; i < a.length; i++) m |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return m === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return svara({ ok: false, svar: 'Bara POST' }, 405);

  const leyndarmal = Deno.env.get('ZERNIO_LEYNDARMAL') || '';
  if (leyndarmal.length < 32) { console.error('ZERNIO_LEYNDARMAL vantar'); return svara({ ok: false, svar: 'Ekki uppsett' }, 503); }

  const hratt = await req.text();
  if (hratt.length > 512 * 1024) return svara({ ok: false, svar: 'Of stórt' }, 413);
  const undirskrift = (req.headers.get('X-Zernio-Signature') || '').trim().toLowerCase();
  if (!eins(undirskrift, await hmacHex(leyndarmal, hratt))) return svara({ ok: false, svar: 'Röng undirskrift' }, 401);

  let a: any;
  try { a = JSON.parse(hratt); } catch { return svara({ ok: false, svar: 'Ógilt JSON' }, 400); }
  const atburdur = String(a && a.event || req.headers.get('X-Zernio-Event') || '');
  if (atburdur === 'webhook.test') return svara({ ok: true, prufa: true });
  if (atburdur !== 'message.received' && atburdur !== 'message.sent') return svara({ ok: true, hunsad: atburdur });

  const m = a.message || {};
  const samtal = a.conversation || {};
  const reikn = a.account || {};
  const ras = String(m.platform || samtal.platform || reikn.platform || '').toLowerCase();
  if (!RASIR.includes(ras)) return svara({ ok: true, hunsad: 'rás ' + ras });

  const profill = str(reikn.profileId, 100);
  const samtalId = str(m.conversationId || samtal.id || samtal._id, 100);
  const skilabodId = str(m.id || m._id || a.id, 200);
  if (!profill || !samtalId || !skilabodId) return svara({ ok: true, hunsad: 'vantar auðkenni' });

  const bak = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: p, error: pVilla } = await bak.from('midla_profilar').select('stofa_id').eq('zernio_profill', profill).maybeSingle();
  if (pVilla) { console.error('midla_profilar', pVilla); return svara({ ok: false, svar: 'Gagnagrunnur' }, 500); }
  if (!p) return svara({ ok: true, hunsad: 'óþekktur prófíll' });
  const stofa = p.stofa_id;

  const fraOkkur = atburdur === 'message.sent' || m.direction === 'outgoing';
  const sendandi = m.sender || {};
  // Hin manneskjan í samtalinu: sendandinn ef það er hún, annars það sem samtalið segir
  const hinn = fraOkkur ? (samtal.participant || samtal.contact || {}) : sendandi;
  const nafn = str(hinn.name || hinn.displayName || samtal.participantName || samtal.name, 200);
  const notandanafn = str(hinn.username || samtal.participantUsername, 200);
  const texti = typeof m.text === 'string' ? m.text.slice(0, 20000) : '';
  const vidhengi = Array.isArray(m.attachments)
    ? m.attachments.slice(0, 20).map((x: any) => ({ tegund: str(x && x.type, 30), slod: str(x && x.url, 2000) }))
    : [];
  const dags = (() => { const d = new Date(m.sentAt || a.timestamp || Date.now()); return isNaN(+d) ? new Date() : d; })();
  const stutt = (texti || (vidhengi.length ? (vidhengi[0].tegund === 'image' ? 'Mynd' : 'Viðhengi') : '')).slice(0, 300);

  // Samtalið: til eða uppfært. Nafn og notandanafn yfirskrifast ekki með tómu.
  const { data: fyrir } = await bak.from('midla_samtol').select('id, sidast, nafn, notandanafn, stofa_id').eq('id', samtalId).maybeSingle();
  if (fyrir && fyrir.stofa_id !== stofa) return svara({ ok: true, hunsad: 'samtal annarrar stofu' });
  const nyrra = !fyrir || new Date(fyrir.sidast) <= dags;
  const lina: Record<string, unknown> = {
    id: samtalId, stofa_id: stofa, ras, zernio_profill: profill,
    reikningur: str(reikn.accountId, 100), sida_id: str(reikn.pageId, 100),
    vidmaelandi: fraOkkur ? str(hinn.id, 100) : str(sendandi.id, 100),
    nafn: nafn || (fyrir && fyrir.nafn) || null,
    notandanafn: notandanafn || (fyrir && fyrir.notandanafn) || null
  };
  if (nyrra) Object.assign(lina, { sidast: dags.toISOString(), sidasti_texti: stutt, fra_theim: !fraOkkur });
  if (fyrir && !lina.vidmaelandi) delete lina.vidmaelandi;
  const { error: sVilla } = await bak.from('midla_samtol').upsert(lina, { onConflict: 'id' });
  if (sVilla) { console.error('midla_samtol', sVilla); return svara({ ok: false, svar: 'Gagnagrunnur' }, 500); }

  const { error: mVilla } = await bak.from('midla_skilabod').upsert({
    id: skilabodId, samtal_id: samtalId, stofa_id: stofa, fra_okkur: fraOkkur,
    nafn: fraOkkur ? null : nafn, texti, vidhengi, dags: dags.toISOString()
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (mVilla) { console.error('midla_skilabod', mVilla); return svara({ ok: false, svar: 'Gagnagrunnur' }, 500); }

  return svara({ ok: true });
});
