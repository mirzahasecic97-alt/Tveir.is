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

/* Okkar eigin listi hefur sínar stöður. "Bíður annars" er þegar
   taskurinn liggur hjá þriðja aðila og við getum ekkert gert í honum. */
export const STODUR_INNRI = {
  nytt:      { heiti: 'Ekki byrjað',  litur: 'nytt' },
  i_vinnslu: { heiti: 'Í vinnslu',    litur: 'vinnsla' },
  bid:       { heiti: 'Bíður annars', litur: 'bid' },
  lokid:     { heiti: 'Lokið',        litur: 'lokid' }
};

export const FORGANGUR = {
  lagt:      'Lágt',
  venjulegt: 'Venjulegt',
  hatt:      'Hátt'
};

/* Fyrirspurnir af vefnum fara í gegnum þessi stig. */
export const STODUR_FYRIRSPURN = {
  ny:           { heiti: 'Ný',            litur: 'nytt' },
  haft_samband: { heiti: 'Haft samband',  litur: 'vinnsla' },
  fundur:       { heiti: 'Fundur',        litur: 'vinnsla' },
  tilbod:       { heiti: 'Tilboð sent',   litur: 'bid' },
  unnid:        { heiti: 'Unnið',         litur: 'ok' },
  tapad:        { heiti: 'Tapað',         litur: 'hafnad' }
};

/* Hvaðan fólkið kom. Rakningin á vefnum skilar einu af þessum. */
export const UPPRUNI = {
  facebook:   'Facebook',
  instagram:  'Instagram',
  google_ads: 'Google auglýsing',
  google:     'Google leit',
  linkedin:   'LinkedIn',
  tiktok:     'TikTok',
  postur:     'Tölvupóstur',
  beint:      'Beint',
  annad:      'Annar vefur'
};

/* Bókhaldsflokkar */
export const FLOKKAR = {
  tekjur: {
    askrift:  'Áskrift',
    verkefni: 'Verkefni',
    annad:    'Annað'
  },
  gjold: {
    hugbunadur:  'Hugbúnaður',
    auglysingar: 'Auglýsingar',
    verktakar:   'Verktakar',
    husnaedi:    'Húsnæði',
    taeki:       'Tæki og búnaður',
    ferdir:      'Ferðir og bíll',
    fundir:      'Fundir og matur',
    annad:       'Annað'
  }
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
      .select('id, nafn, netfang, hlutverk, fyrirtaeki_id, fyrirtaeki(id, nafn, merki_url, er_askrift, askrift_verd)')
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

    /* Harvey þarf að sanna fyrir fallinu á Vercel að við séum innskráð */
    async adgangstokinn() {
      const { data } = await sb.auth.getSession();
      return data && data.session ? data.session.access_token : null;
    },

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

    async nyVerkefnatillaga({ titill, lysing, skiladagur, budget, innan_samnings }) {
      const ek = await eg();
      const svar = await sb.from('verkefni').insert({
        fyrirtaeki_id: ek.fyrirtaeki_id,
        titill, lysing, skiladagur: skiladagur || null,
        budget: innan_samnings ? null : budget,
        innan_samnings: !!innan_samnings,
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
        .select('*, fyrirtaeki(nafn), verkefni(titill), abyrgd_notandi:abyrgd(nafn)');
      if (fyrirtaeki_id) q = q.eq('fyrirtaeki_id', fyrirtaeki_id);
      if (verkefni_id) q = q.eq('verkefni_id', verkefni_id);
      /* Innan verkefnis ræður röðin, annars nýjast efst */
      q = verkefni_id
        ? q.order('rod').order('stofnad')
        : q.order('stofnad', { ascending: false });
      const svar = await q; kasta(svar); return svar.data;
    },

    async nyrTask(task) {
      const ek = await eg();
      const svar = await sb.from('taskar').insert({
        ...task,
        rod: task.rod !== undefined ? task.rod : await this.naestaRod(task.verkefni_id),
        fyrirtaeki_id: task.fyrirtaeki_id || ek.fyrirtaeki_id,
        hofundur: ek.id
      }).select().single();
      kasta(svar); return svar.data;
    },

    /* Nýr taskur fer aftast í tímalínuna */
    async naestaRod(verkefni_id) {
      if (!verkefni_id) return 0;
      const svar = await sb.from('taskar').select('rod')
        .eq('verkefni_id', verkefni_id).order('rod', { ascending: false }).limit(1);
      kasta(svar);
      return svar.data && svar.data[0] ? Number(svar.data[0].rod) + 1 : 1;
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

    async nyttFyrirtaeki(fyrirtaeki) {
      const svar = await sb.from('fyrirtaeki').insert(fyrirtaeki).select().single();
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
    },

    /* ---------- Innri: tímar og reikningur, bara við ---------- */

    async innri(verkefni_id) {
      let q = sb.from('verkefni_innri').select('*');
      if (verkefni_id) {
        const svar = await q.eq('verkefni_id', verkefni_id).maybeSingle();
        kasta(svar); return svar.data || { verkefni_id, klst: 0, reikningur: 'ekki_rukkad' };
      }
      const svar = await q; kasta(svar); return svar.data;
    },

    async skraTima(verkefni_id, klst, nota) {
      const ek = await eg();
      const svar = await sb.from('timar')
        .insert({ verkefni_id, klst, nota: nota || null, notandi: ek.id })
        .select('*, notandi_nafn:notandi(nafn)').single();
      kasta(svar); return svar.data;
    },

    async timaskraning(verkefni_id) {
      const svar = await sb.from('timar')
        .select('*, notandi_nafn:notandi(nafn)')
        .eq('verkefni_id', verkefni_id).order('stofnad', { ascending: false });
      kasta(svar); return svar.data;
    },

    async eydaTima(id) {
      const svar = await sb.from('timar').delete().eq('id', id);
      kasta(svar);
    },

    async setjaReikning(verkefni_id, reikningur) {
      const svar = await sb.from('verkefni_innri').upsert({
        verkefni_id, reikningur,
        reikningur_dags: reikningur === 'ekki_rukkad' ? null : new Date().toISOString().slice(0, 10),
        uppfaert: new Date().toISOString()
      }).select().single();
      kasta(svar); return svar.data;
    },

    /* ---------- Snið ---------- */

    async snid() {
      const svar = await sb.from('snid').select('*, snid_taskar(*)').order('nafn');
      kasta(svar);
      return (svar.data || []).map((s) => ({
        ...s, taskar: (s.snid_taskar || []).sort((a, b) => a.rod - b.rod)
      }));
    },

    async nyttVerkefniAdmin({ fyrirtaeki_id, titill, lysing, skiladagur, verd_okkar, innan_samnings, snid_id }) {
      const ek = await eg();
      const svar = await sb.from('verkefni').insert({
        fyrirtaeki_id, titill, lysing: lysing || null, skiladagur: skiladagur || null,
        stada: 'i_vinnslu', hofundur: ek.id, budget: null,
        innan_samnings: !!innan_samnings,
        verd_okkar: innan_samnings ? null : (verd_okkar || null)
      }).select().single();
      kasta(svar);
      if (snid_id) await this.beitaSnidi(svar.data, snid_id);
      return svar.data;
    },

    async beitaSnidi(v, snid_id) {
      const ek = await eg();
      const sn = await sb.from('snid_taskar').select('*').eq('snid_id', snid_id).order('rod');
      kasta(sn);
      if (!sn.data || !sn.data.length) return;
      const kunni = await sb.from('notendur').select('id')
        .eq('fyrirtaeki_id', v.fyrirtaeki_id).neq('hlutverk', 'admin').limit(1);
      const theirra = kunni.data && kunni.data[0] ? kunni.data[0].id : null;
      const svar = await sb.from('taskar').insert(sn.data.map((t, i) => ({
        fyrirtaeki_id: v.fyrirtaeki_id, verkefni_id: v.id, rod: t.rod || (i + 1),
        titill: t.titill, lysing: t.lysing, forgangur: t.forgangur,
        stada: t.a_hverjum === 'vidskiptavinur' ? 'bid_vidskiptavinar' : 'nytt',
        abyrgd: t.a_hverjum === 'vidskiptavinur' ? theirra : ek.id,
        hofundur: ek.id
      })));
      kasta(svar);
    },

    /* ---------- Viðhengi ---------- */

    async vidhengi(task_id) {
      const svar = await sb.from('vidhengi')
        .select('*, notandi:hofundur(nafn)').eq('task_id', task_id).order('stofnad');
      kasta(svar); return svar.data;
    },

    async nyttVidhengi(task_id, fyrirtaeki_id, skra) {
      const ek = await eg();
      const hreintNafn = skra.name.replace(/[^\w.\- ]+/g, '_');
      const slod = fyrirtaeki_id + '/' + task_id + '/' + Date.now() + '-' + hreintNafn;
      const upp = await sb.storage.from('vidhengi').upload(slod, skra, { upsert: false });
      if (upp.error) throw new Error(upp.error.message);
      const svar = await sb.from('vidhengi').insert({
        task_id, slod, nafn: skra.name, staerd: skra.size, hofundur: ek.id
      }).select('*, notandi:hofundur(nafn)').single();
      kasta(svar); return svar.data;
    },

    async slodAVidhengi(v) {
      const svar = await sb.storage.from('vidhengi').createSignedUrl(v.slod, 60);
      if (svar.error) throw new Error(svar.error.message);
      return svar.data.signedUrl;
    },

    /* ---------- Okkar eigin listi ---------- */

    async innriTaskar() {
      const svar = await sb.from('innri_taskar')
        .select('*, abyrgd_notandi:abyrgd(nafn), fyrirtaeki(nafn)')
        .order('stofnad', { ascending: false });
      kasta(svar); return svar.data;
    },

    async nyrInnriTask(task) {
      const ek = await eg();
      const svar = await sb.from('innri_taskar').insert({
        titill: task.titill,
        lysing: task.lysing || null,
        stada: task.stada || 'nytt',
        forgangur: task.forgangur || 'venjulegt',
        abyrgd: task.abyrgd || null,
        fyrirtaeki_id: task.fyrirtaeki_id || null,
        skiladagur: task.skiladagur || null,
        hofundur: ek.id
      }).select('*, abyrgd_notandi:abyrgd(nafn), fyrirtaeki(nafn)').single();
      kasta(svar); return svar.data;
    },

    async uppfaeraInnriTask(id, breytingar) {
      const svar = await sb.from('innri_taskar').update(breytingar).eq('id', id)
        .select('*, abyrgd_notandi:abyrgd(nafn), fyrirtaeki(nafn)').single();
      kasta(svar); return svar.data;
    },

    async eydaInnriTask(id) {
      const svar = await sb.from('innri_taskar').delete().eq('id', id);
      kasta(svar);
    },

    /* ---------- Fyrirspurnir af vefnum ---------- */

    async fyrirspurnir() {
      const svar = await sb.from('fyrirspurnir')
        .select('*, abyrgd_notandi:abyrgd(nafn)')
        .order('stofnad', { ascending: false });
      kasta(svar); return svar.data;
    },

    async uppfaeraFyrirspurn(id, breytingar) {
      const svar = await sb.from('fyrirspurnir').update(breytingar).eq('id', id)
        .select('*, abyrgd_notandi:abyrgd(nafn)').single();
      kasta(svar); return svar.data;
    },

    async eydaFyrirspurn(id) {
      const svar = await sb.from('fyrirspurnir').delete().eq('id', id);
      kasta(svar);
    },

    /* ---------- Bókhald ---------- */

    async faerslur() {
      const svar = await sb.from('faerslur')
        .select('*, fyrirtaeki(nafn)')
        .order('dags', { ascending: false });
      kasta(svar); return svar.data;
    },

    async nyFaersla(f) {
      const ek = await eg();
      const svar = await sb.from('faerslur').insert({ ...f, hofundur: ek.id })
        .select('*, fyrirtaeki(nafn)').single();
      kasta(svar); return svar.data;
    },

    async uppfaeraFaerslu(id, breytingar) {
      const svar = await sb.from('faerslur').update(breytingar).eq('id', id)
        .select('*, fyrirtaeki(nafn)').single();
      kasta(svar); return svar.data;
    },

    async eydaFaerslu(id) {
      const svar = await sb.from('faerslur').delete().eq('id', id);
      kasta(svar);
    },

    /* ---------- Merki viðskiptavinarins ---------- */

    async setjaMerki(fyrirtaeki_id, skra) {
      const endir = (skra.name.split('.').pop() || 'png').toLowerCase();
      const slod = fyrirtaeki_id + '/merki-' + Date.now() + '.' + endir;

      const upp = await sb.storage.from('merki')
        .upload(slod, skra, { upsert: true, contentType: skra.type || undefined });
      if (upp.error) throw new Error(upp.error.message);

      const { data: opin } = sb.storage.from('merki').getPublicUrl(slod);
      const svar = await sb.from('fyrirtaeki')
        .update({ merki_url: opin.publicUrl }).eq('id', fyrirtaeki_id).select().single();
      kasta(svar);

      /* Hausinn les úr minninu, svo það þarf að fylgja með */
      if (minn && minn.fyrirtaeki && minn.fyrirtaeki.id === fyrirtaeki_id) {
        minn.fyrirtaeki.merki_url = opin.publicUrl;
      }
      return svar.data;
    },

    async hendaMerki(fyrirtaeki_id) {
      const svar = await sb.from('fyrirtaeki')
        .update({ merki_url: null }).eq('id', fyrirtaeki_id).select().single();
      kasta(svar);
      if (minn && minn.fyrirtaeki && minn.fyrirtaeki.id === fyrirtaeki_id) {
        minn.fyrirtaeki.merki_url = null;
      }
      return svar.data;
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
      { id: 'f1', nafn: 'Hlíðarkaup',      askrift: 'Efni og samfélagsmiðlar',
        er_askrift: true,  askrift_verd: 290000, merki_url: null },
      { id: 'f2', nafn: 'Steinvík ehf.', askrift: 'Vefsíða í áskrift',
        er_askrift: true,  askrift_verd: 45000, merki_url: null },
      { id: 'f3', nafn: 'Fossberg ehf.',     askrift: 'Sölutækifæri',
        er_askrift: false, askrift_verd: null, merki_url: null }
    ];

    const notendur = [
      { id: 'u-mirza', nafn: 'Mirza Hasecic', netfang: 'tveir@tveir.is', hlutverk: 'admin', fyrirtaeki_id: null },
      { id: 'u-oskar', nafn: 'Óskar Hákonar', netfang: 'oskar@tveir.is', hlutverk: 'admin', fyrirtaeki_id: null },
      { id: 'u-haf',   nafn: 'Anna Jónsdóttir', netfang: 'anna@steinvik.is', hlutverk: 'vidskiptavinur', fyrirtaeki_id: 'f2' },
      { id: 'u-kron',  nafn: 'Páll Guðmundsson', netfang: 'pall@hlidarkaup.is', hlutverk: 'vidskiptavinur', fyrirtaeki_id: 'f1' }
    ];

    const verkefni = [
      { id: 'v1', fyrirtaeki_id: 'f2', titill: 'Ný vefsíða',
        lysing: 'Fimm undirsíður, vöruyfirlit og form fyrir fyrirspurnir.',
        stada: 'i_vinnslu', framvinda: 65, skiladagur: dagsetning(12),
        budget: 900000, innan_samnings: false, verd_okkar: 850000,
        hofundur: 'u-mirza', svar_admin: null, stofnad: dags(-24), uppfaert: dags(-2) },
      { id: 'v2', fyrirtaeki_id: 'f2', titill: 'Reels fyrir desember',
        lysing: 'Fjögur reels, tökudagur í stúdíói.',
        stada: 'bid_svar', framvinda: 30, skiladagur: dagsetning(20),
        budget: 350000, innan_samnings: false, verd_okkar: 320000,
        hofundur: 'u-oskar', svar_admin: null, stofnad: dags(-9), uppfaert: dags(-1) },
      { id: 'v3', fyrirtaeki_id: 'f2', titill: 'Jólakynning á póstlista',
        lysing: 'Við viljum þrjá sölupósta fyrir jólin, fyrsti út 1. desember.',
        stada: 'tillaga', framvinda: 0, skiladagur: dagsetning(30),
        budget: 250000, innan_samnings: false, verd_okkar: null,
        hofundur: 'u-haf', svar_admin: null, stofnad: dags(-1), uppfaert: dags(-1) },
      { id: 'v4', fyrirtaeki_id: 'f1', titill: 'Nýtt merki á sendibíla',
        lysing: 'Þarf skilaskrár fyrir prentsmiðju.',
        stada: 'tillaga', framvinda: 0, skiladagur: null,
        budget: null, innan_samnings: true, verd_okkar: null,
        hofundur: 'u-kron', svar_admin: null, stofnad: dags(-3), uppfaert: dags(-3) },
      { id: 'v5', fyrirtaeki_id: 'f1', titill: 'Efnispakki nóvember',
        lysing: 'Tólf færslur og tvö reels.',
        stada: 'lokid', framvinda: 100, skiladagur: dagsetning(-4),
        budget: null, innan_samnings: true, verd_okkar: null,
        hofundur: 'u-mirza', svar_admin: null, stofnad: dags(-40), uppfaert: dags(-4) },
      { id: 'v6', fyrirtaeki_id: 'f3', titill: 'Lendingarsíða og auglýsingar',
        lysing: 'Ein síða, þremur auglýsingum og eftirfylgni í pósti.',
        stada: 'lokid', framvinda: 100, skiladagur: dagsetning(-11),
        budget: 400000, innan_samnings: false, verd_okkar: 420000,
        hofundur: 'u-mirza', svar_admin: null, stofnad: dags(-52), uppfaert: dags(-11) }
    ];

    const taskar = [
      { id: 't1', rod: 2, fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Senda logo í vektor',
        lysing: 'Við þurfum .ai eða .svg skrá, png dugar ekki í prentun.',
        stada: 'bid_vidskiptavinar', forgangur: 'hatt', abyrgd: 'u-haf', hofundur: 'u-mirza',
        skiladagur: dagsetning(2), lokid_dags: null, stofnad: dags(-5), uppfaert: dags(-5) },
      { id: 't2', rod: 3, fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Skrifa texta á Um okkur',
        lysing: 'Stutt, fjórar til fimm línur. Við getum skrifað hann ef þú vilt.',
        stada: 'bid_vidskiptavinar', forgangur: 'venjulegt', abyrgd: 'u-haf', hofundur: 'u-oskar',
        skiladagur: dagsetning(5), lokid_dags: null, stofnad: dags(-5), uppfaert: dags(-5) },
      { id: 't3', rod: 4, fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Setja upp vöruyfirlit',
        lysing: null, stada: 'i_vinnslu', forgangur: 'venjulegt', abyrgd: 'u-mirza', hofundur: 'u-mirza',
        skiladagur: dagsetning(4), lokid_dags: null, stofnad: dags(-6), uppfaert: dags(-1) },
      { id: 't4', rod: 1, fyrirtaeki_id: 'f2', verkefni_id: 'v2', titill: 'Velja tökudag',
        lysing: 'Við erum laus 11. eða 13. Hvor dagur passar betur?',
        stada: 'bid_vidskiptavinar', forgangur: 'hatt', abyrgd: 'u-haf', hofundur: 'u-oskar',
        skiladagur: dagsetning(1), lokid_dags: null, stofnad: dags(-2), uppfaert: dags(-2) },
      { id: 't5', rod: 0, fyrirtaeki_id: 'f2', verkefni_id: null, titill: 'Breyta opnunartíma á síðunni',
        lysing: 'Við lokum kl. 16 á föstudögum frá og með næstu viku.',
        stada: 'nytt', forgangur: 'venjulegt', abyrgd: 'u-mirza', hofundur: 'u-haf',
        skiladagur: null, lokid_dags: null, stofnad: dags(-1), uppfaert: dags(-1) },
      { id: 't6', rod: 1, fyrirtaeki_id: 'f2', verkefni_id: 'v1', titill: 'Tengja domain við Vercel',
        lysing: null, stada: 'lokid', forgangur: 'venjulegt', abyrgd: 'u-mirza', hofundur: 'u-mirza',
        skiladagur: dagsetning(-3), lokid_dags: dags(-3), stofnad: dags(-14), uppfaert: dags(-3) },
      { id: 't7', rod: 1, fyrirtaeki_id: 'f1', verkefni_id: 'v5', titill: 'Samþykkja færslur fyrir nóvember',
        lysing: null, stada: 'lokid', forgangur: 'venjulegt', abyrgd: 'u-kron', hofundur: 'u-mirza',
        skiladagur: dagsetning(-20), lokid_dags: dags(-18), stofnad: dags(-30), uppfaert: dags(-18) },
      { id: 't8', rod: 0, fyrirtaeki_id: 'f1', verkefni_id: null, titill: 'Uppfæra verð í auglýsingum',
        lysing: 'Verðið á kjúklingi fór úr 1.890 í 2.090.',
        stada: 'nytt', forgangur: 'hatt', abyrgd: 'u-oskar', hofundur: 'u-kron',
        skiladagur: dagsetning(1), lokid_dags: null, stofnad: dags(0), uppfaert: dags(0) }
    ];

    /* Okkar eigin listi. Enginn viðskiptavinur kemur nálægt þessu. */
    const innri_taskar = [
      { id: 'i1', titill: 'Senda tilboðið á Fossberg',
        lysing: 'Lendingarsíða, þrjár auglýsingar og eftirfylgni. Verðið liggur fyrir.',
        stada: 'nytt', forgangur: 'hatt', abyrgd: 'u-mirza', hofundur: 'u-oskar',
        fyrirtaeki_id: 'f3', skiladagur: dagsetning(1), lokid_dags: null,
        stofnad: dags(-1), uppfaert: dags(-1) },
      { id: 'i2', titill: 'Klippa reels fyrir Steinvík',
        lysing: 'Fjögur stykki, efnið er á drifinu.',
        stada: 'i_vinnslu', forgangur: 'venjulegt', abyrgd: 'u-oskar', hofundur: 'u-oskar',
        fyrirtaeki_id: 'f2', skiladagur: dagsetning(3), lokid_dags: null,
        stofnad: dags(-4), uppfaert: dags(-1) },
      { id: 'i3', titill: 'Fara yfir bókhaldið fyrir mánuðinn',
        lysing: null, stada: 'nytt', forgangur: 'venjulegt', abyrgd: null, hofundur: 'u-mirza',
        fyrirtaeki_id: null, skiladagur: dagsetning(6), lokid_dags: null,
        stofnad: dags(-2), uppfaert: dags(-2) },
      { id: 'i4', titill: 'Bíður svars um lénið',
        lysing: 'Sendum fyrirspurn, heyrum ekkert fyrr en þeir svara.',
        stada: 'bid', forgangur: 'lagt', abyrgd: 'u-mirza', hofundur: 'u-mirza',
        fyrirtaeki_id: 'f1', skiladagur: null, lokid_dags: null,
        stofnad: dags(-7), uppfaert: dags(-5) },
      { id: 'i5', titill: 'Setja nýju verkefnin inn á vefinn',
        lysing: null, stada: 'lokid', forgangur: 'venjulegt', abyrgd: 'u-mirza', hofundur: 'u-oskar',
        fyrirtaeki_id: null, skiladagur: dagsetning(-3), lokid_dags: dags(-2),
        stofnad: dags(-12), uppfaert: dags(-2) }
    ];

    const athugasemdir = [
      { id: 'a1', task_id: 't1', hofundur: 'u-mirza', texti: 'Ef þú finnur hana ekki getum við teiknað merkið upp aftur, það tekur okkur klukkutíma.', stofnad: dags(-4) },
      { id: 'a2', task_id: 't1', hofundur: 'u-haf', texti: 'Ég spyr hönnuðinn sem gerði það og heyri í þér á morgun.', stofnad: dags(-3) },
      { id: 'a3', task_id: 't4', hofundur: 'u-haf', texti: 'Þrettándi passar betur okkar fólki.', stofnad: dags(-1) }
    ];

    const innri = {
      v1: { verkefni_id: 'v1', klst: 31,   reikningur: 'ekki_rukkad', reikningur_dags: null },
      v2: { verkefni_id: 'v2', klst: 9.5,  reikningur: 'ekki_rukkad', reikningur_dags: null },
      v3: { verkefni_id: 'v3', klst: 0,    reikningur: 'ekki_rukkad', reikningur_dags: null },
      v4: { verkefni_id: 'v4', klst: 0,    reikningur: 'ekki_rukkad', reikningur_dags: null },
      v5: { verkefni_id: 'v5', klst: 22,   reikningur: 'rukkad', reikningur_dags: dagsetning(-3) },
      v6: { verkefni_id: 'v6', klst: 38,   reikningur: 'ekki_rukkad', reikningur_dags: null }
    };

    const timaskraning = [
      { id: 'k1', verkefni_id: 'v1', notandi: 'u-mirza', klst: 8,   nota: 'Grunnur og útlit',   stofnad: dags(-14) },
      { id: 'k2', verkefni_id: 'v1', notandi: 'u-mirza', klst: 12,  nota: 'Undirsíður',         stofnad: dags(-8) },
      { id: 'k3', verkefni_id: 'v1', notandi: 'u-oskar', klst: 11,  nota: 'Myndir og efni',    stofnad: dags(-4) },
      { id: 'k4', verkefni_id: 'v2', notandi: 'u-oskar', klst: 9.5, nota: 'Undirbúningur',      stofnad: dags(-3) },
      { id: 'k5', verkefni_id: 'v5', notandi: 'u-oskar', klst: 22,  nota: null,                stofnad: dags(-10) },
      { id: 'k6', verkefni_id: 'v6', notandi: 'u-mirza', klst: 21,  nota: 'Síða og form',     stofnad: dags(-30) },
      { id: 'k7', verkefni_id: 'v6', notandi: 'u-oskar', klst: 17,  nota: 'Auglýsingar',      stofnad: dags(-20) }
    ];

    const snid = [
      { id: 's1', nafn: 'Ný vefsíða', lysing: 'Fimm undirsíður, form og tenging við lén', taskar: [
        { titill: 'Senda logo í vektor', lysing: 'Við þurfum .ai eða .svg skrá, png dugar ekki í prentun.', a_hverjum: 'vidskiptavinur', forgangur: 'hatt' },
        { titill: 'Senda myndir af vörum eða starfsemi', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'venjulegt' },
        { titill: 'Skrifa texta á Um okkur', lysing: 'Fjórar til fimm línur. Við getum skrifað hann ef þú vilt.', a_hverjum: 'vidskiptavinur', forgangur: 'venjulegt' },
        { titill: 'Setja upp grunn og útlit', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Undirsíður og efni', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Form og tenging við póst', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Leitarvélar, sitemap og lýsingar', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Yfirferð með viðskiptavin', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'hatt' },
        { titill: 'Tengja lén og setja í loftið', lysing: null, a_hverjum: 'tveir', forgangur: 'hatt' }
      ] },
      { id: 's2', nafn: 'Efnispakki mánaðar', lysing: 'Tökudagur, klipping og færslur', taskar: [
        { titill: 'Velja tökudag', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'hatt' },
        { titill: 'Senda okkur áherslur mánaðarins', lysing: 'Tilboð, nýjar vörur eða viðburðir sem við eigum að ýta á.', a_hverjum: 'vidskiptavinur', forgangur: 'venjulegt' },
        { titill: 'Tökur', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Klipping', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Yfirferð á efni', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'venjulegt' },
        { titill: 'Birting', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' }
      ] },
      { id: 's3', nafn: 'Vörumerki', lysing: 'Merki, litir, letur og leiðbeiningar', taskar: [
        { titill: 'Samtal um hvað vörumerkið á að segja', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'hatt' },
        { titill: 'Senda okkur það sem er til nú þegar', lysing: 'Gamalt merki, litir, myndir, hvað sem er.', a_hverjum: 'vidskiptavinur', forgangur: 'venjulegt' },
        { titill: 'Fyrstu tillögur', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Val á leið', lysing: null, a_hverjum: 'vidskiptavinur', forgangur: 'hatt' },
        { titill: 'Fullvinnsla og skilaskrár', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' },
        { titill: 'Leiðbeiningar til að fara eftir', lysing: null, a_hverjum: 'tveir', forgangur: 'venjulegt' }
      ] }
    ];

    /* Fyrirspurnir af vefnum, eins og þær kæmu úr formunum */
    const klst = (n) => new Date(nu - n * 3600000).toISOString();
    const fyrirspurnir = [
      { id: 'q1', nafn: 'Guðrún Sigurðardóttir', netfang: 'gudrun@bakarigudrunar.is', simi: '899 1234',
        fyrirtaeki_nafn: 'Bakarí Guðrúnar', thjonusta: 'Samfélagsmiðlar, Auglýsingar',
        skilabod: 'Við erum að opna nýtt útibú í febrúar og viljum fá fólk inn frá fyrsta degi.',
        form: 'Hafa samband', gogn: null,
        uppruni: 'facebook', sidasti_uppruni: 'facebook', utm_source: 'facebook', utm_medium: 'paid',
        utm_campaign: 'uttekt-nov', tilvisun: 'm.facebook.com', lendingarsida: '/herferd.html',
        fyrsta_heimsokn: klst(5), stada: 'ny', abyrgd: null, verdmaeti: null, nota: null,
        stofnad: klst(3), uppfaert: klst(3) },
      { id: 'q2', nafn: 'Jón Ólafsson', netfang: null, simi: '777 4321',
        fyrirtaeki_nafn: null, thjonusta: 'Vefsíða, Google',
        skilabod: null, form: 'Markaðsúttekt (herferð)', gogn: { slod: 'olafssonverk.is' },
        uppruni: 'facebook', sidasti_uppruni: 'facebook', utm_source: 'facebook', utm_medium: 'paid',
        utm_campaign: 'uttekt-nov', tilvisun: 'l.facebook.com', lendingarsida: '/herferd.html',
        fyrsta_heimsokn: klst(27), stada: 'ny', abyrgd: null, verdmaeti: null, nota: null,
        stofnad: klst(26), uppfaert: klst(26) },
      { id: 'q3', nafn: 'Sara Björk', netfang: 'sara@studiosara.is', simi: null,
        fyrirtaeki_nafn: 'Stúdíó Sara', thjonusta: 'Vefsíða í áskrift',
        skilabod: 'Hvað kostar að halda síðunni við mánaðarlega?', form: 'Vefsíða í áskrift', gogn: null,
        uppruni: 'google', sidasti_uppruni: 'google', utm_source: null, utm_medium: null,
        utm_campaign: null, tilvisun: 'www.google.com', lendingarsida: '/vefsida-askrift.html',
        fyrsta_heimsokn: dags(-6), stada: 'haft_samband', abyrgd: 'u-oskar', verdmaeti: 45000,
        nota: 'Hringdi, vill sjá dæmi um síður.', stofnad: dags(-4), uppfaert: dags(-3) },
      { id: 'q4', nafn: 'Einar Þór Einarsson', netfang: 'einar@nordurvelar.is', simi: '862 5500',
        fyrirtaeki_nafn: 'Norðurvélar ehf.', thjonusta: 'Auglýsingar, Sölutækifæri',
        skilabod: 'Viljum fleiri fyrirspurnir frá verktökum.', form: 'Hafa samband', gogn: null,
        uppruni: 'beint', sidasti_uppruni: 'linkedin', utm_source: 'linkedin', utm_medium: 'social',
        utm_campaign: null, tilvisun: null, lendingarsida: '/',
        fyrsta_heimsokn: dags(-14), stada: 'fundur', abyrgd: 'u-mirza', verdmaeti: 450000,
        nota: 'Fundur á fimmtudag kl. 10.', stofnad: dags(-6), uppfaert: dags(-2) },
      { id: 'q5', nafn: 'Helga Rún Pálsdóttir', netfang: 'helga@hotelfjordur.is', simi: null,
        fyrirtaeki_nafn: 'Hótel Fjörður', thjonusta: 'Sölutækifæri',
        skilabod: 'Við viljum ná til fyrirtækja sem halda árshátíðir.', form: 'Sölutækifæri', gogn: null,
        uppruni: 'linkedin', sidasti_uppruni: 'linkedin', utm_source: 'linkedin', utm_medium: 'social',
        utm_campaign: null, tilvisun: 'www.linkedin.com', lendingarsida: '/solutaekifaeri.html',
        fyrsta_heimsokn: dags(-12), stada: 'tilbod', abyrgd: 'u-mirza', verdmaeti: 890000,
        nota: 'Tilboð sent, bíður svars.', stofnad: dags(-10), uppfaert: dags(-5) },
      { id: 'q6', nafn: 'Kristján Fossberg', netfang: 'kristjan@fossberg.is', simi: null,
        fyrirtaeki_nafn: 'Fossberg ehf.', thjonusta: 'Vefsíða, Auglýsingar',
        skilabod: 'Lendingarsíða og auglýsingar fyrir nýja vöru.', form: 'Hafa samband', gogn: null,
        uppruni: 'google', sidasti_uppruni: 'google', utm_source: null, utm_medium: null,
        utm_campaign: null, tilvisun: 'www.google.com', lendingarsida: '/',
        fyrsta_heimsokn: dags(-28), stada: 'unnid', abyrgd: 'u-oskar', verdmaeti: 420000,
        nota: null, stofnad: dags(-25), uppfaert: dags(-20) },
      { id: 'q7', nafn: 'Arna Kristinsdóttir', netfang: 'arna@kaffikrokur.is', simi: null,
        fyrirtaeki_nafn: 'Kaffi Krókur', thjonusta: 'Samfélagsmiðlar',
        skilabod: null, form: 'Efni', gogn: null,
        uppruni: 'instagram', sidasti_uppruni: 'instagram', utm_source: 'instagram', utm_medium: 'social',
        utm_campaign: null, tilvisun: 'l.instagram.com', lendingarsida: '/efni.html',
        fyrsta_heimsokn: dags(-31), stada: 'tapad', abyrgd: 'u-oskar', verdmaeti: null,
        nota: 'Of dýrt í bili, heyrum í þeim í vor.', stofnad: dags(-30), uppfaert: dags(-22) }
    ];

    /* Bókhaldið. Upphæðir án VSK. */
    const manudur = (n) => {
      const d = new Date(nu); d.setDate(1); d.setMonth(d.getMonth() + n);
      return d.toISOString().slice(0, 10);
    };
    const faerslaD = (o) => ({
      flokkur: null, vsk: 24, greitt: false, greitt_dags: null, gjalddagi: null, reikningsnr: null,
      fyrirtaeki_id: null, verkefni_id: null, askrift_manudur: null, nota: null,
      hofundur: 'u-mirza', stofnad: dags(-1), uppfaert: dags(-1), ...o
    });
    const faerslur = [
      faerslaD({ id: 'b1', tegund: 'tekjur', dags: manudur(0), lysing: 'Áskrift: Efni og samfélagsmiðlar',
        flokkur: 'askrift', upphaed: 290000, fyrirtaeki_id: 'f1', askrift_manudur: manudur(0).slice(0, 7),
        greitt: true, greitt_dags: dagsetning(-2), reikningsnr: '1042' }),
      faerslaD({ id: 'b2', tegund: 'gjold', dags: dagsetning(-9), lysing: 'Adobe Creative Cloud',
        flokkur: 'hugbunadur', upphaed: 9900, greitt: true, greitt_dags: dagsetning(-9) }),
      faerslaD({ id: 'b3', tegund: 'gjold', dags: dagsetning(-6), lysing: 'Leiga á vinnustofu',
        flokkur: 'husnaedi', upphaed: 85000, greitt: true, greitt_dags: dagsetning(-6) }),
      faerslaD({ id: 'b4', tegund: 'gjold', dags: dagsetning(-4), lysing: 'Meta auglýsingar, herferð',
        flokkur: 'auglysingar', upphaed: 60000, vsk: 0, greitt: true, greitt_dags: dagsetning(-4),
        nota: 'Reikningur frá Írlandi, enginn VSK á honum.' }),
      faerslaD({ id: 'b5', tegund: 'tekjur', dags: manudur(-1), lysing: 'Áskrift: Efni og samfélagsmiðlar',
        flokkur: 'askrift', upphaed: 290000, fyrirtaeki_id: 'f1', askrift_manudur: manudur(-1).slice(0, 7),
        greitt: true, greitt_dags: manudur(-1), reikningsnr: '1038' }),
      faerslaD({ id: 'b6', tegund: 'tekjur', dags: manudur(-1), lysing: 'Áskrift: Vefsíða í áskrift',
        flokkur: 'askrift', upphaed: 45000, fyrirtaeki_id: 'f2', askrift_manudur: manudur(-1).slice(0, 7),
        greitt: false, reikningsnr: '1039', gjalddagi: dagsetning(-5) }),
      faerslaD({ id: 'b7', tegund: 'gjold', dags: manudur(-1), lysing: 'Adobe Creative Cloud',
        flokkur: 'hugbunadur', upphaed: 9900, greitt: true, greitt_dags: manudur(-1) })
    ];

    return { fyrirtaeki: fyr, notendur, verkefni, taskar, athugasemdir,
             innri, timaskraning, snid, vidhengi: [], innri_taskar,
             fyrirspurnir, faerslur, innskradur: null };
  };

  function les() {
    try {
      const h = localStorage.getItem(LYKILL);
      if (h) {
        /* Eldri vistun getur vantað hluti sem bættust við síðar */
        const vistað = JSON.parse(h);
        const sjalf = sjalfgefid();
        for (const lykill of Object.keys(sjalf)) {
          if (vistað[lykill] === undefined) vistað[lykill] = sjalf[lykill];
        }
        /* mirza@tveir.is er ekki til. Eldri vistun hafði það. */
        (vistað.notendur || []).forEach((n) => {
          if (n.netfang === 'mirza@tveir.is') n.netfang = 'tveir@tveir.is';
        });
        return vistað;
      }
    } catch (e) { /* localStorage getur verið lokað */ }
    return sjalfgefid();
  }

  let g = les();

  function vista() {
    try { localStorage.setItem(LYKILL, JSON.stringify(g)); } catch (e) { /* sleppum */ }
  }

  /* Skrárnar sjálfar, bara í minni meðan síðan er opin */
  const BLOB = new Map();

  /* Framvinda verkefnis kemur úr töskunum, ekki úr renniborda. */
  function reiknaFramvindu(verkefni_id) {
    if (!verkefni_id) return;
    const v = g.verkefni.find((x) => x.id === verkefni_id);
    if (!v) return;
    const minir = g.taskar.filter((t) => t.verkefni_id === verkefni_id);
    const lokin = minir.filter((t) => t.stada === 'lokid').length;
    v.framvinda = minir.length ? Math.round(lokin * 100 / minir.length) : 0;
    if (v.framvinda > 0 && v.stada === 'samthykkt') v.stada = 'i_vinnslu';
    v.uppfaert = new Date().toISOString();
  }

  function naestaRod(verkefni_id) {
    if (!verkefni_id) return 0;
    const minir = g.taskar.filter((t) => t.verkefni_id === verkefni_id);
    return minir.length ? Math.max(...minir.map((t) => Number(t.rod) || 0)) + 1 : 1;
  }

  function reiknaKlst(verkefni_id) {
    const alls = g.timaskraning
      .filter((t) => t.verkefni_id === verkefni_id)
      .reduce((a, t) => a + Number(t.klst), 0);
    if (!g.innri[verkefni_id]) {
      g.innri[verkefni_id] = { verkefni_id, klst: 0, reikningur: 'ekki_rukkad', reikningur_dags: null };
    }
    g.innri[verkefni_id].klst = Math.round(alls * 10) / 10;
  }

  const finna = (listi, id) => listi.find((x) => x.id === id) || null;
  const fyrNafn = (id) => { const f = finna(g.fyrirtaeki, id); return f ? { nafn: f.nafn } : null; };
  const nyttId = () => 'x' + Math.random().toString(36).slice(2, 10);

  /* Framvindan getur verið úreltt í eldri vistun. Reikna hana einu sinni. */
  g.verkefni.forEach((v) => reiknaFramvindu(v.id));

  function skreyta(t) {
    return {
      ...t,
      fyrirtaeki: fyrNafn(t.fyrirtaeki_id),
      verkefni: t.verkefni_id ? { titill: (finna(g.verkefni, t.verkefni_id) || {}).titill } : null,
      abyrgd_notandi: t.abyrgd ? { nafn: (finna(g.notendur, t.abyrgd) || {}).nafn } : null
    };
  }

  function skreytaInnri(t) {
    return {
      ...t,
      fyrirtaeki: t.fyrirtaeki_id ? fyrNafn(t.fyrirtaeki_id) : null,
      abyrgd_notandi: t.abyrgd ? { nafn: (finna(g.notendur, t.abyrgd) || {}).nafn } : null
    };
  }

  function skreytaFyrirspurn(f) {
    return {
      ...f,
      abyrgd_notandi: f.abyrgd ? { nafn: (finna(g.notendur, f.abyrgd) || {}).nafn } : null
    };
  }

  const nyjast = (a, b) => new Date(b.stofnad) - new Date(a.stofnad);

  return {
    prufa: true,

    async innskra(netfang) {
      const n = g.notendur.find((x) => x.netfang.toLowerCase() === netfang.trim().toLowerCase());
      if (!n) throw new Error('Þetta netfang er ekki á prufulistanum. Prófaðu tveir@tveir.is eða anna@steinvik.is.');
      g.innskradur = n.id; vista();
    },

    async utskra() { g.innskradur = null; vista(); },

    /* Í prufu er engin Supabase lota og því ekkert tákn. Harvey notar
       aðgangskóðann úr Vercel í staðinn. */
    async adgangstokinn() { return null; },

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

    async nyVerkefnatillaga({ titill, lysing, skiladagur, budget, innan_samnings }) {
      const ek = await this.eg();
      const fyr = finna(g.fyrirtaeki, ek.fyrirtaeki_id);
      const innan = !!innan_samnings && !!(fyr && fyr.er_askrift);
      if (!innan && !budget) throw new Error('Budget vantar.');
      const v = {
        id: nyttId(), fyrirtaeki_id: ek.fyrirtaeki_id, titill, lysing,
        skiladagur: skiladagur || null, stada: 'tillaga', framvinda: 0,
        hofundur: ek.id, svar_admin: null,
        budget: innan ? null : Number(budget), innan_samnings: innan, verd_okkar: null,
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
      const listi = g.taskar
        .filter((t) => (!fyrirtaeki_id || t.fyrirtaeki_id === fyrirtaeki_id)
                    && (!verkefni_id || t.verkefni_id === verkefni_id))
        .map(skreyta);
      return verkefni_id
        ? listi.sort((a, b) => (Number(a.rod) || 0) - (Number(b.rod) || 0)
                            || new Date(a.stofnad) - new Date(b.stofnad))
        : listi.sort(nyjast);
    },

    async nyrTask(task) {
      const ek = await this.eg();
      const t = {
        id: nyttId(), lysing: null, stada: 'nytt', forgangur: 'venjulegt',
        verkefni_id: null, abyrgd: null, skiladagur: null, lokid_dags: null,
        ...task,
        rod: task.rod !== undefined ? task.rod : naestaRod(task.verkefni_id),
        fyrirtaeki_id: task.fyrirtaeki_id || ek.fyrirtaeki_id,
        hofundur: ek.id,
        stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
      };
      g.taskar.unshift(t);
      reiknaFramvindu(t.verkefni_id);
      vista(); return skreyta(t);
    },

    async uppfaeraTask(id, breytingar) {
      const t = finna(g.taskar, id);
      Object.assign(t, breytingar, { uppfaert: new Date().toISOString() });
      if (breytingar.stada === 'lokid') t.lokid_dags = new Date().toISOString();
      if (breytingar.stada && breytingar.stada !== 'lokid') t.lokid_dags = null;
      reiknaFramvindu(t.verkefni_id);
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

    async nyttFyrirtaeki(fyrirtaeki) {
      const f = {
        id: nyttId(), merki_url: null, er_askrift: false, askrift_verd: null,
        ...fyrirtaeki, stofnad: new Date().toISOString()
      };
      g.fyrirtaeki.push(f); vista(); return f;
    },

    async notendur() {
      return g.notendur.map((n) => ({ ...n, fyrirtaeki: fyrNafn(n.fyrirtaeki_id) }));
    },

    async tengjaNotanda(id, fyrirtaeki_id) {
      const n = finna(g.notendur, id);
      n.fyrirtaeki_id = fyrirtaeki_id; vista(); return n;
    },

    /* ---------- Innri: tímar og reikningur ---------- */

    async innri(verkefni_id) {
      if (verkefni_id) {
        return g.innri[verkefni_id]
          || { verkefni_id, klst: 0, reikningur: 'ekki_rukkad', reikningur_dags: null };
      }
      return Object.values(g.innri);
    },

    async skraTima(verkefni_id, klst, nota) {
      const ek = await this.eg();
      const t = {
        id: nyttId(), verkefni_id, notandi: ek.id, klst: Number(klst),
        nota: nota || null, stofnad: new Date().toISOString()
      };
      g.timaskraning.unshift(t);
      reiknaKlst(verkefni_id);
      vista();
      return { ...t, notandi_nafn: { nafn: ek.nafn } };
    },

    async timaskraning(verkefni_id) {
      return g.timaskraning
        .filter((t) => t.verkefni_id === verkefni_id)
        .map((t) => ({ ...t, notandi_nafn: { nafn: (finna(g.notendur, t.notandi) || {}).nafn } }))
        .sort(nyjast);
    },

    async eydaTima(id) {
      const t = finna(g.timaskraning, id);
      if (!t) return;
      g.timaskraning = g.timaskraning.filter((x) => x.id !== id);
      reiknaKlst(t.verkefni_id);
      vista();
    },

    async setjaReikning(verkefni_id, reikningur) {
      if (!g.innri[verkefni_id]) {
        g.innri[verkefni_id] = { verkefni_id, klst: 0, reikningur: 'ekki_rukkad', reikningur_dags: null };
      }
      g.innri[verkefni_id].reikningur = reikningur;
      g.innri[verkefni_id].reikningur_dags =
        reikningur === 'ekki_rukkad' ? null : new Date().toISOString().slice(0, 10);
      vista();
      return g.innri[verkefni_id];
    },

    /* ---------- Snið ---------- */

    async snid() { return g.snid; },

    async nyttVerkefniAdmin({ fyrirtaeki_id, titill, lysing, skiladagur, verd_okkar, innan_samnings, snid_id }) {
      const ek = await this.eg();
      const v = {
        id: nyttId(), fyrirtaeki_id, titill, lysing: lysing || null,
        skiladagur: skiladagur || null, stada: 'i_vinnslu', framvinda: 0,
        hofundur: ek.id, svar_admin: null, budget: null,
        innan_samnings: !!innan_samnings,
        verd_okkar: innan_samnings ? null : (verd_okkar || null),
        stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
      };
      g.verkefni.unshift(v);
      g.innri[v.id] = { verkefni_id: v.id, klst: 0, reikningur: 'ekki_rukkad', reikningur_dags: null };
      if (snid_id) await this.beitaSnidi(v, snid_id);
      vista();
      return v;
    },

    async beitaSnidi(v, snid_id) {
      const ek = await this.eg();
      const sn = finna(g.snid, snid_id);
      if (!sn) return;
      const theirra = (g.notendur.find((n) => n.fyrirtaeki_id === v.fyrirtaeki_id
                                           && n.hlutverk !== 'admin') || {}).id || null;
      sn.taskar.forEach((t, i) => {
        g.taskar.unshift({
          id: nyttId(), fyrirtaeki_id: v.fyrirtaeki_id, verkefni_id: v.id, rod: i + 1,
          titill: t.titill, lysing: t.lysing, forgangur: t.forgangur,
          stada: t.a_hverjum === 'vidskiptavinur' ? 'bid_vidskiptavinar' : 'nytt',
          abyrgd: t.a_hverjum === 'vidskiptavinur' ? theirra : ek.id,
          hofundur: ek.id, skiladagur: null, lokid_dags: null,
          stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
        });
      });
      reiknaFramvindu(v.id);
      vista();
    },

    /* ---------- Viðhengi ----------
       Í prufu lifa skrárnar sjálfar bara í minni, því localStorage þolir
       ekki myndir. Nafn og stærð haldast, hlekkurinn deyr við endurhleðslu. */

    async vidhengi(task_id) {
      return g.vidhengi
        .filter((v) => v.task_id === task_id)
        .map((v) => ({ ...v, notandi: finna(g.notendur, v.hofundur), lifandi: BLOB.has(v.id) }));
    },

    async nyttVidhengi(task_id, fyrirtaeki_id, skra) {
      const ek = await this.eg();
      const v = {
        id: nyttId(), task_id, slod: null, nafn: skra.name, staerd: skra.size,
        hofundur: ek.id, stofnad: new Date().toISOString()
      };
      BLOB.set(v.id, skra);
      g.vidhengi.push(v);
      vista();
      return { ...v, notandi: finna(g.notendur, ek.id), lifandi: true };
    },

    async slodAVidhengi(v) {
      const skra = BLOB.get(v.id);
      if (!skra) throw new Error('Skráin er horfin. Í prufustillingu lifa viðhengi bara þá '
        + 'lötu sem síðan er opin.');
      return URL.createObjectURL(skra);
    },

    /* ---------- Okkar eigin listi ---------- */

    async innriTaskar() {
      return g.innri_taskar.map(skreytaInnri).sort(nyjast);
    },

    async nyrInnriTask(task) {
      const ek = await this.eg();
      const t = {
        id: nyttId(), lysing: null, stada: 'nytt', forgangur: 'venjulegt',
        abyrgd: null, fyrirtaeki_id: null, skiladagur: null, lokid_dags: null,
        ...task, hofundur: ek.id,
        stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
      };
      g.innri_taskar.unshift(t); vista(); return skreytaInnri(t);
    },

    async uppfaeraInnriTask(id, breytingar) {
      const t = finna(g.innri_taskar, id);
      if (!t) return null;
      Object.assign(t, breytingar, { uppfaert: new Date().toISOString() });
      if (breytingar.stada === 'lokid') t.lokid_dags = new Date().toISOString();
      if (breytingar.stada && breytingar.stada !== 'lokid') t.lokid_dags = null;
      vista(); return skreytaInnri(t);
    },

    async eydaInnriTask(id) {
      g.innri_taskar = g.innri_taskar.filter((x) => x.id !== id);
      vista();
    },

    /* ---------- Fyrirspurnir af vefnum ---------- */

    async fyrirspurnir() {
      return g.fyrirspurnir.map(skreytaFyrirspurn).sort(nyjast);
    },

    async uppfaeraFyrirspurn(id, breytingar) {
      const f = finna(g.fyrirspurnir, id);
      if (!f) return null;
      Object.assign(f, breytingar, { uppfaert: new Date().toISOString() });
      vista(); return skreytaFyrirspurn(f);
    },

    async eydaFyrirspurn(id) {
      g.fyrirspurnir = g.fyrirspurnir.filter((x) => x.id !== id);
      vista();
    },

    /* ---------- Bókhald ---------- */

    async faerslur() {
      return g.faerslur
        .map((f) => ({ ...f, fyrirtaeki: f.fyrirtaeki_id ? fyrNafn(f.fyrirtaeki_id) : null }))
        .sort((a, b) => (b.dags || '').localeCompare(a.dags || '') || nyjast(a, b));
    },

    async nyFaersla(f) {
      const ek = await this.eg();
      if (f.askrift_manudur && g.faerslur.some((x) =>
          x.askrift_manudur === f.askrift_manudur && x.fyrirtaeki_id === f.fyrirtaeki_id)) {
        throw new Error('Þessi áskrift er þegar færð fyrir þennan mánuð.');
      }
      const ny = {
        id: nyttId(), dags: new Date().toISOString().slice(0, 10), flokkur: null, vsk: 24,
        greitt: false, greitt_dags: null, gjalddagi: null, reikningsnr: null,
        fyrirtaeki_id: null, verkefni_id: null, askrift_manudur: null, nota: null,
        ...f, hofundur: ek.id,
        stofnad: new Date().toISOString(), uppfaert: new Date().toISOString()
      };
      g.faerslur.unshift(ny); vista();
      return { ...ny, fyrirtaeki: ny.fyrirtaeki_id ? fyrNafn(ny.fyrirtaeki_id) : null };
    },

    async uppfaeraFaerslu(id, breytingar) {
      const f = finna(g.faerslur, id);
      if (!f) return null;
      Object.assign(f, breytingar, { uppfaert: new Date().toISOString() });
      vista();
      return { ...f, fyrirtaeki: f.fyrirtaeki_id ? fyrNafn(f.fyrirtaeki_id) : null };
    },

    async eydaFaerslu(id) {
      g.faerslur = g.faerslur.filter((x) => x.id !== id);
      vista();
    },

    /* ---------- Merki viðskiptavinarins ----------
       Í prufu er myndin geymd sem data-slóð svo hún lifi endurhleðslu. */

    async setjaMerki(fyrirtaeki_id, skra) {
      const f = finna(g.fyrirtaeki, fyrirtaeki_id);
      if (!f) throw new Error('Fyrirtækið fannst ekki.');

      const slod = await new Promise((skila, hafna) => {
        const lesari = new FileReader();
        lesari.onload = () => skila(lesari.result);
        lesari.onerror = () => hafna(new Error('Náði ekki að lesa skrána.'));
        lesari.readAsDataURL(skra);
      });

      f.merki_url = slod;
      vista();
      return f;
    },

    async hendaMerki(fyrirtaeki_id) {
      const f = finna(g.fyrirtaeki, fyrirtaeki_id);
      if (f) { f.merki_url = null; vista(); }
      return f;
    },

    /* Bara í prufu: byrja upp á nýtt */
    hreinsa() { g = sjalfgefid(); BLOB.clear(); vista(); }
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
