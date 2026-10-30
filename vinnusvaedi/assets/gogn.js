/* ==========================================================================
   Tveir vinnusvæði — gagnalag
   Sama viðmót hvort gögnin koma úr Supabase eða úr prufudæmum.
   ========================================================================== */

import { stillingar } from './stillingar.js';

/* ------------------------------------------------------------------
   Orðalag
   ------------------------------------------------------------------ */
export const STODUR_VERK = {
  tillaga:   { heiti: 'Bíður samþykkis', litur: 'bid' },
  samthykkt: { heiti: 'Samþykkt',        litur: 'ok'  },
  i_vinnslu: { heiti: 'Í vinnslu',       litur: 'vinnsla' },
  bid_svar:  { heiti: 'Bíður þín',       litur: 'bid' },
  lokid:     { heiti: 'Lokið',           litur: 'lokid' },
  hafnad:    { heiti: 'Ekki tekið',      litur: 'hafnad' }
};

export const STODUR_TASK = {
  nytt:              { heiti: 'Nýtt',       litur: 'nytt' },
  i_vinnslu:         { heiti: 'Í vinnslu',  litur: 'vinnsla' },
  bid_vidskiptavinar:{ heiti: 'Bíður þín',  litur: 'bid' },
  lokid:             { heiti: 'Lokið',      litur: 'lokid' }
};

export const FORGANGUR = {
  lagt:      'Lágt',
  venjulegt: 'Venjulegt',
  hatt:      'Hátt'
};

/* ==========================================================================
   Supabase
   ========================================================================== */

async function supabaseBakendi() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  const sb = createClient(stillingar.supabaseUrl, stillingar.supabaseAnonKey);

  /* Munum hver notandinn er innan síðuhleðslunnar */
  let minn = null;

  async function eg() {
    if (minn) return minn;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb
      .from('notendur')
      .select('id, nafn, netfang, hlutverk, fyrirtaeki_id, fyrirtaeki(id, nafn, merki_url)')
      .eq('id', user.id)
      .single();
    minn = data || null;
    return minn;
  }

  function kasta({ error }) { if (error) throw new Error(error.message); }

  return {
    prufa: false,

    async innskra(netfang) {
      const { error } = await sb.auth.signInWithOtp({
        email: netfang.trim().toLowerCase(),
        options: { shouldCreateUser: false, emailRedirectTo: stillingar.slod + 'yfirlit.html' }
      });
      if (error) throw new Error(error.message);
    },

    async utskra() { minn = null; await sb.auth.signOut(); },

    eg,

    async verkefni(fyrirtaeki_id) {
      let q = sb.from('verkefni')
        .select('*, fyrirtaeki(nafn)')
        .order('stofnad', { ascending: false });
      if (fyrirtaeki_id) q = q.eq('fyrirtaeki_id', fyrirtaeki_id);
      const svar = await q; kasta(svar); return svar.data;
    },

    async verkefniEitt(id) {
      const svar = await sb.from('verkefni').select('*, fyrirtaeki(nafn)').eq('id', id).single();
      kasta(svar); return svar.data;
    },

    async nyVerkefnatillaga({ titill, lysing, skiladagur }) {
      const ek = await eg();
      const svar = await sb.from('verkefni').insert({
        fyrirtaeki_id: ek.fyrirtaeki_id,
        titill, lysing, skiladagur: skiladagur || null,
        stada: 'tillaga', hofundur: ek.id
      }).select().single();
      kasta(svar); return svar.data;
    },

    async uppfaeraVerkefni(id, breytingar) {
      const svar = await sb.from('verkefni').update(breytingar).eq('id', id).select().single();
      kasta(svar); return svar.data;
    },

    async taskar({ fyrirtaeki_id, verkefni_id } = {}) {
      let q = sb.from('taskar')
        .select('*, fyrirtaeki(nafn), verkefni(titill), abyrgd_notandi:abyrgd(nafn)')
        .order('stofnad', { ascending: false });
      if (fyrirtaeki_id) q = q.eq('fyrirtaeki_id', fyrirtaeki_id);
      if (verkefni_id) q = q.eq('verkefni_id', verkefni_id);
      const svar = await q; kasta(svar); return svar.data;
    },

    async nyrTask(task) {
      const ek = await eg();
      const svar = await sb.from('taskar').insert({
        ...task,
        fyrirtaeki_id: task.fyrirtaeki_id || ek.fyrirtaeki_id,
        hofundur: ek.id
      }).select().single();
      kasta(svar); return svar.data;
    },

    async uppfaeraTask(id, breytingar) {
      const svar = await sb.from('taskar').update(breytingar).eq('id', id).select().single();
      kasta(svar); return svar.data;
    },

    async athugasemdir(task_id) {
      const svar = await sb.from('athugasemdir')
        .select('*, notandi:hofundur(nafn, hlutverk)')
        .eq('task_id', task_id).order('stofnad');
      kasta(svar); return svar.data;
    },

    async nyAthugasemd(task_id, texti) {
      const ek = await eg();
      const svar = await sb.from('athugasemdir')
        .insert({ task_id, texti, hofundur: ek.id })
        .select('*, notandi:hofundur(nafn, hlutverk)').single();
      kasta(svar); return svar.data;
    },

    async fyrirtaeki() {
      const svar = await sb.from('fyrirtaeki').select('*').order('nafn');
      kasta(svar); return svar.data;
    },

    async nyttFyrirtaeki(nafn, askrift) {
      const svar = await sb.from('fyrirtaeki').insert({ nafn, askrift }).select().single();
      kasta(svar); return svar.data;
    },

    async notendur() {
      const svar = await sb.from('notendur')
        .select('*, fyrirtaeki(nafn)').order('stofnad', { ascending: false });
      kasta(svar); return svar.data;
    },

    async tengjaNotanda(id, fyrirtaeki_id) {
      const svar = await sb.from('notendur').update({ fyrirtaeki_id }).eq('id', id).select().single();
      kasta(svar); return svar.data;
    }
  };
}

/* ==========================================================================
   Prufudæmi — lifir í localStorage svo breytingar haldast milli endurhleðslna
   ========================================================================== */

function prufuBakendi() {
  const LYKILL = 'tveir-vinnusvaedi-prufa';

  const sjalfgefid = () => {
    const nu = Date.now();
    const dagur = 86400000;
    const dags = (n) => new Date(nu + n * dagur).toISOString();
    const dagsetning = (n) => new Date(nu + n * dagur).toISOString().slice(0, 10);

    const fyr = [
      { id: 'f1', nafn: 'Krónan',      askrift: 'Efni og samfélagsmiðlar' },
      { id: 'f2', nafn: 'HAF Vítamín', askrift: 'Vefsíða í áskrift' },
      { id: 'f3', nafn: 'Epicbet',     askrift: 'Sölutækifæri' }
    ];

    const notendur = [
      { id: 'u-mirza', nafn: 'Mirza Hasecic', netfang: 'mirza@tveir.is', hlutverk: 'admin', fyrirtaeki_id: null },
      { id: 'u-oskar', nafn: 'Óskar Hákonar', netfang: 'oskar@tveir.is', hlutverk: 'admin', fyrirtaeki_id: null },
      { id: 'u-haf',   nafn: 'Anna Jónsdóttir', netfang: 'anna@hafvitamin.is', hlutverk: 'vidskiptavinur', fyrirtaeki_id: 'f2' },
      { id: 'u-kron',  nafn: 'Páll Guðmundsson', netfang: 'pall@kronan.is', hlutverk: 'vidskiptavinur', fyrirtaeki_id: 'f1' }
    ];

    const verkefni = [
      { id: 'v1', fyrirtaeki_id: 'f2', titill: 'Ný vefsíða',
        lysing: 'Fimm undirsíður, vöruyfirlit og form fyrir fyrirspurnir.',
        stada: 'i_vinnslu', framvinda: 65, skiladagur: dagsetning(12),
        hofundur: 'u-mirza', svar_admin: null, stofnad: dags(-24), uppfaert: dags(-2) },
      { id: 'v2', fyrirtaeki_id: 'f2', titill: 'Reels fyrir desember',
        lysing: 'Fjögur reels, tökudagur í stúdíói.',
        stada: 'bid_svar', framvinda: 30, skiladagur: dagsetning(20),
        hofundur: 'u-oskar', svar_admin: null, stofnad: dags(-9), uppfaert: dags(-1) },
      { id: 'v3', fyrirtaeki_id: 'f2', titill: 'Jólakynning á póstlista',
        lysing: 'Við viljum þrjá sölupósta fyrir jólin, fyrsti út 1. desember.',
        stada: 'tillaga', framvinda: 0, skiladagur: dagsetning(30),
        hofundur: 'u-haf', svar_admin: null, stofnad: dags(-1), uppfaert: dags(-1) },
      { id: 'v4', fyrirtaeki_id: 'f1', titill: 'Nýtt merki á sendibíla',
        lysing: 'Þarf skilaskrár fyrir prentsmiðju.',
        stada: 'tillaga', framvinda: 0, skiladagur: null,
        hofundur: 'u-kron', svar_admin: null, stofnad: dags(-3), uppfaert: dags(-3) },
      { id: 'v5', fyrirtaeki_id: 'f1', titill: 'Efnispakki nóvember',
        lysing: 'Tólf færslur og tvö reels.',
        stada: 'lokid', framvinda: 100, skiladagur: dagsetning(-4),
        hofundur: 'u-mirza', svar_admin: null, stofnad: dags(-40), uppfaert: dags(-4) }
    ];

    const taskar = [
      { id: 't1', fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Senda logo í vektor',
        lysing: 'Við þurfum .ai eða .svg skrá, png dugar ekki í prentun.',
        stada: 'bid_vidskiptavinar', forgangur: 'hatt', abyrgd: 'u-haf', hofundur: 'u-mirza',
        skiladagur: dagsetning(2), lokid_dags: null, stofnad: dags(-5), uppfaert: dags(-5) },
      { id: 't2', fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Skrifa texta á Um okkur',
        lysing: 'Stutt, fjórar til fimm línur. Við getum skrifað hann ef þú vilt.',
        stada: 'bid_vidskiptavinar', forgangur: 'venjulegt', abyrgd: 'u-haf', hofundur: 'u-oskar',
        skiladagur: dagsetning(5), lokid_dags: null, stofnad: dags(-5), uppfaert: dags(-5) },
      { id: 't3', fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Setja upp vöruyfirlit',
        lysing: null, stada: 'i_vinnslu', forgangur: 'venjulegt', abyrgd: 'u-mirza', hofundur: 'u-mirza',
        skiladagur: dagsetning(4), lokid_dags: null, stofnad: dags(-6), uppfaert: dags(-1) },
      { id: 't4', fyrirtaeki_id: 'f2', verkefni_id: 'v2', titill: 'Velja tökudag',
        lysing: 'Við erum laus 11. eða 13. Hvor dagur passar betur?',
        stada: 'bid_vidskiptavinar', forgangur: 'hatt', abyrgd: 'u-haf', hofundur: 'u-oskar',
        skiladagur: dagsetning(1), lokid_dags: null, stofnad: dags(-2), uppfaert: dags(-2) },
      { id: 't5', fyrirtaeki_id: 'f2', verkefni_id: null, titill: 'Breyta opnunartíma á síðunni',
        lysing: 'Við lokum kl. 16 á föstudögum frá og með næstu viku.',
        stada: 'nytt', forgangur: 'venjulegt', abyrgd: 'u-mirza', hofundur: 'u-haf',
        skiladagur: null, lokid_dags: null, stofnad: dags(-1), uppfaert: dags(-1) },
      { id: 't6', fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Tengja domain við Vercel',
        lysing: null, stada: 'lokid', forgangur: 'venjulegt', abyrgd: 'u-mirza', hofundur: 'u-mirza',
        skiladagur: dagsetning(-3), lokid_dags: dags(-3), stofnad: dags(-14), uppfaert: dags(-3) },
      { id: 't7', fyrirtaeki_id: 'f1', verkefni_id: 'v5', titill: 'Samþykkja færslur fyrir nóvember',
        lysing: null, stada: 'lokid', forgangur: 'venjulegt', abyrgd: 'u-kron', hofundur: 'u-mirza',
        skiladagur: dagsetning(-20), lokid_dags: dags(-18), stofnad: dags(-30), uppfaert: dags(-18) },
      { id: 't8', fyrirtaeki_id: 'f1', verkefni_id: null, titill: 'Uppfæra verð í auglýsingum',
        lysing: 'Verðið á kjúklingi fór úr 1.890 í 2.090.',
        stada: 'nytt', forgangur: 'hatt', abyrgd: 'u-oskar', hofundur: 'u-kron',
        skiladagur: dagsetning(1), lokid_dags: null, stofnad: dags(0), uppfaert: dags(0) }
    ];

    const athugasemdir = [
      { id: 'a1', task_id: 't1', hofundur: 'u-mirza', texti: 'Ef þú finnur hana ekki getum við teiknað merkið upp aftur, það tekur okkur klukkutíma.', stofnad: dags(-4) },
      { id: 'a2', task_id: 't1', hofundur: 'u-haf', texti: 'Ég spyr hönnuðinn sem gerði það og heyri í þér á morgun.', stofnad: dags(-3) },
      { id: 'a3', task_id: 't4', hofundur: 'u-haf', texti: 'Þrettándi passar betur okkar fólki.', stofnad: dags(-1) }
    ];

    return { fyrirtaeki: fyr, notendur, verkefni, taskar, athugasemdir, innskradur: null };
  };

  function les() {
    try {
      const h = localStorage.getItem(LYKILL);
      if (h) return JSON.parse(h);
    } catch (e) { /* localStorage getur verið lokað */ }
    return sjalfgefid();
  }

  let g = les();

  function vista() {
    try { localStorage.setItem(LYKILL, JSON.stringify(g)); } catch (e) { /* sleppum */ }
  }

  const finna = (listi, id) => listi.find((x) => x.id === id) || null;
  const fyrNafn = (id) => { const f = finna(g.fyrirtaeki, id); return f ? { nafn: f.nafn } : null; };
  const nyttId = () => 'x' + Math.random().toString(36).slice(2, 10);

  function skreyta(t) {
    return {
      ...t,
      fyrirtaeki: fyrNafn(t.fyrirtaeki_id),
      verkefni: t.verkefni_id ? { titill: (finna(g.verkefni, t.verkefni_id) || {}).titill } : null,
      abyrgd_notandi: t.abyrgd ? { nafn: (finna(g.notendur, t.abyrgd) || {}).nafn } : null
    };
  }

  const nyjast = (a, b) => new Date(b.stofnad) - new Date(a.stofnad);

  return {
    prufa: true,

    async innskra(netfang) {
      const n = g.notendur.find((x) => x.netfang.toLowerCase() === netfang.trim().toLowerCase());
      if (!n) throw new Error('Þetta netfang er ekki á prufulistanum. Prófaðu mirza@tveir.is eða anna@hafvitamin.is.');
      g.innskradur = n.id; vista();
    },

    async utskra() { g.innskradur = null; vista(); },

    async eg() {
      if (!g.innskradur) return null;
      const n = finna(g.notendur, g.innskradur);
      if (!n) return null;
      return { ...n, fyrirtaeki: n.fyrirtaeki_id ? finna(g.fyrirtaeki, n.fyrirtaeki_id) : null };
    },

    async verkefni(fyrirtaeki_id) {
      return g.verkefni
        .filter((v) => !fyrirtaeki_id || v.fyrirtaeki_id === fyrirtaeki_id)
        .map((v) => ({ ...v, fyrirtaeki: fyrNafn(v.fyrirtaeki_id) }))
        .sort(nyjast);
    },

    async verkefniEitt(id) {
      const v = finna(g.verkefni, id);
      return v ? { ...v, fyrirtaeki: fyrNafn(v.fyrirtaeki_id) } : null;
    },

    async nyVerkefnatillaga({ titill, lysing, skiladagur }) {
      const ek = await this.eg();
      const v = {
        id: nyttId(), fyrirtaeki_id: ek.fyrirtaeki_id, titill, lysing,
        skiladagur: skiladagur || null, stada: 'tillaga', framvinda: 0,
        hofundur: ek.id, svar_admin: null,
        stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
      };
      g.verkefni.unshift(v); vista(); return v;
    },

    async uppfaeraVerkefni(id, breytingar) {
      const v = finna(g.verkefni, id);
      Object.assign(v, breytingar, { uppfaert: new Date().toISOString() });
      vista(); return v;
    },

    async taskar({ fyrirtaeki_id, verkefni_id } = {}) {
      return g.taskar
        .filter((t) => (!fyrirtaeki_id || t.fyrirtaeki_id === fyrirtaeki_id)
                    && (!verkefni_id || t.verkefni_id === verkefni_id))
        .map(skreyta).sort(nyjast);
    },

    async nyrTask(task) {
      const ek = await this.eg();
      const t = {
        id: nyttId(), lysing: null, stada: 'nytt', forgangur: 'venjulegt',
        verkefni_id: null, abyrgd: null, skiladagur: null, lokid_dags: null,
        ...task,
        fyrirtaeki_id: task.fyrirtaeki_id || ek.fyrirtaeki_id,
        hofundur: ek.id,
        stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
      };
      g.taskar.unshift(t); vista(); return skreyta(t);
    },

    async uppfaeraTask(id, breytingar) {
      const t = finna(g.taskar, id);
      Object.assign(t, breytingar, { uppfaert: new Date().toISOString() });
      if (breytingar.stada === 'lokid') t.lokid_dags = new Date().toISOString();
      if (breytingar.stada && breytingar.stada !== 'lokid') t.lokid_dags = null;
      vista(); return skreyta(t);
    },

    async athugasemdir(task_id) {
      return g.athugasemdir
        .filter((a) => a.task_id === task_id)
        .map((a) => ({ ...a, notandi: finna(g.notendur, a.hofundur) }))
        .sort((a, b) => new Date(a.stofnad) - new Date(b.stofnad));
    },

    async nyAthugasemd(task_id, texti) {
      const ek = await this.eg();
      const a = { id: nyttId(), task_id, texti, hofundur: ek.id, stofnad: new Date().toISOString() };
      g.athugasemdir.push(a); vista();
      return { ...a, notandi: finna(g.notendur, ek.id) };
    },

    async fyrirtaeki() { return [...g.fyrirtaeki].sort((a, b) => a.nafn.localeCompare(b.nafn, 'is')); },

    async nyttFyrirtaeki(nafn, askrift) {
      const f = { id: nyttId(), nafn, askrift, merki_url: null, stofnad: new Date().toISOString() };
      g.fyrirtaeki.push(f); vista(); return f;
    },

    async notendur() {
      return g.notendur.map((n) => ({ ...n, fyrirtaeki: fyrNafn(n.fyrirtaeki_id) }));
    },

    async tengjaNotanda(id, fyrirtaeki_id) {
      const n = finna(g.notendur, id);
      n.fyrirtaeki_id = fyrirtaeki_id; vista(); return n;
    },

    /* Bara í prufu: byrja upp á nýtt */
    hreinsa() { g = sjalfgefid(); vista(); }
  };
}

/* ========================================================================== */

let bakendi = null;

export async function gogn() {
  if (!bakendi) {
    bakendi = stillingar.prufa || !stillingar.supabaseUrl
      ? prufuBakendi()
      : await supabaseBakendi();
  }
  return bakendi;
}
