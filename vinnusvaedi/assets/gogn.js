/* ==========================================================================
   Tveir vinnusvæði: gagnalag
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

/* ==========================================================================
   Supabase
   ========================================================================== */

/* Villur frá Supabase innskráningu koma á ensku. Hér verða þær að íslensku
   sem segir fólki hvað það getur gert. */
function innskraningarvilla(error) {
  const kodi = String((error && error.code) || '');
  const bod = String((error && error.message) || '');
  const stada = error && error.status;

  if ((typeof navigator !== 'undefined' && navigator.onLine === false) || stada === 0
      || /failed to fetch|networkerror|load failed|network request failed/i.test(bod)) {
    return 'Náði ekki sambandi. Athugaðu netið og prófaðu aftur.';
  }
  if (stada === 429 || /rate_limit/.test(kodi) || /rate limit|security purposes|too many/i.test(bod)) {
    return 'Of margar tilraunir í röð. Bíddu í smá stund og prófaðu svo aftur.';
  }
  if (kodi === 'invalid_credentials' || /invalid login credentials/i.test(bod)) {
    return 'Netfang eða lykilorð er ekki rétt. Ef þú hefur ekki valið lykilorð ennþá, notaðu Senda mér hlekk.';
  }
  if (kodi === 'email_not_confirmed' || /not confirmed/i.test(bod)) {
    return 'Netfangið er ekki staðfest ennþá. Notaðu Senda mér hlekk í staðinn.';
  }
  if (kodi === 'same_password' || /different from the old/i.test(bod)) {
    return 'Nýja lykilorðið má ekki vera það sama og það gamla.';
  }
  if (kodi === 'weak_password' || /password should/i.test(bod)) {
    if (error.reasons && error.reasons.includes('pwned')) {
      return 'Þetta lykilorð hefur komið fram í gagnaleka annars staðar. Veldu annað.';
    }
    return 'Lykilorðið er of veikt. Hafðu það minnst 10 stafi, til dæmis nokkur orð saman.';
  }
  if (kodi === 'reauthentication_needed' || /reauthenticat/i.test(bod)) {
    return 'Af öryggisástæðum þarftu að skrá þig út og inn aftur með hlekk áður en þú breytir lykilorðinu.';
  }
  if (kodi === 'session_not_found' || /session missing|session.*expired/i.test(bod)) {
    return 'Innskráningin er runnin út. Skráðu þig inn aftur.';
  }
  return 'Þetta gekk ekki. Prófaðu aftur eða sendu okkur línu.';
}

/* Villur í undirverkum: Supabase svarar á ensku, fólkið les íslensku.
   Okkar eigin villur úr gagnagrunninum eru þegar á íslensku og fara óbreyttar. */
function undirverkVilla(error) {
  const bod = String((error && error.message) || '');
  const stada = error && (error.status || error.statusCode);
  if ((typeof navigator !== 'undefined' && navigator.onLine === false)
      || /failed to fetch|networkerror|load failed|network request failed/i.test(bod)) {
    return 'Náði ekki sambandi. Athugaðu netið og prófaðu aftur.';
  }
  if (/[þðæöáéíóúý]/i.test(bod) || /^Taskurinn fannst ekki/.test(bod)) return bod;
  if (/jwt|session|token.*expired|not authenticated/i.test(bod) || String(stada) === '401') {
    return 'Innskráningin er runnin út. Skráðu þig inn aftur.';
  }
  if (/exceeded|too large|maximum allowed size|payload/i.test(bod) || String(stada) === '413') {
    return 'Skráin er of stór fyrir geymsluna. Settu hana á WeTransfer eða Google Drive og límdu hlekkinn.';
  }
  if (/row-level security|permission denied|unauthorized|forbidden/i.test(bod) || String(stada) === '403') {
    return 'Þú hefur ekki aðgang að þessu.';
  }
  if (/tengill|check constraint/i.test(bod)) return 'Hlekkurinn þarf að byrja á https:// og vera án bila.';
  if (/already exists|duplicate/i.test(bod)) return 'Skrá með þessu nafni er þegar til. Prófaðu aftur.';
  if (/not found|does not exist/i.test(bod)) return 'Fannst ekki. Endurhlaðaðu síðuna og prófaðu aftur.';
  return 'Þetta gekk ekki. Prófaðu aftur.';
}

/* Villur í tölfræðinni, sama hugsun og undirverkVilla */
function tolfraediVilla(error) {
  const bod = String((error && error.message) || '');
  const kodi = String((error && error.code) || '');
  if ((typeof navigator !== 'undefined' && navigator.onLine === false)
      || /failed to fetch|networkerror|load failed|network request failed/i.test(bod)) {
    return 'Náði ekki sambandi. Athugaðu netið og prófaðu aftur.';
  }
  if (/[þðæöáéíóúý]/i.test(bod)) return bod;
  if (kodi === '42P01' || /relation .* does not exist|could not find the table|schema cache/i.test(bod)) {
    return 'Tölfræðitöflurnar eru ekki komnar í gagnagrunninn. Keyrðu migrations/2026-11-18-tolfraedi.sql í Supabase.';
  }
  if (/jwt|session|token.*expired|not authenticated/i.test(bod)) {
    return 'Innskráningin er runnin út. Skráðu þig inn aftur.';
  }
  if (kodi === '23505' || /duplicate|already exists/i.test(bod)) {
    return 'Þessi miðill er þegar skráður hjá fyrirtækinu.';
  }
  if (kodi === '23514' || /check constraint/i.test(bod)) {
    return 'Eitthvað stenst ekki: slóðir byrja á https://, nafn er 1 til 120 stafir og tölur mega ekki vera neikvæðar.';
  }
  if (/row-level security|permission denied|unauthorized|forbidden/i.test(bod)) {
    return 'Þú hefur ekki aðgang að þessu.';
  }
  return 'Þetta gekk ekki. Prófaðu aftur.';
}

/* Tölurnar sem dagleg mæling getur haft */
const MAELITOLUR = ['fylgjendur', 'ahorf', 'nadir', 'samskipti', 'heimsoknir', 'faerslur'];

/* Ein mæling hreinsuð: tóm gildi detta út svo þau skrifi aldrei yfir
   tölu sem er til fyrir. Skilar null ef línan er ónothæf. */
function hreinMaeling(r) {
  if (!r || !r.midill_id || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.dags || ''))) return null;
  const lina = {
    midill_id: r.midill_id, dags: String(r.dags),
    uppruni: r.uppruni === 'innflutt' ? 'innflutt' : 'handvirkt'
  };
  let tolur = 0;
  for (const k of MAELITOLUR) {
    const v = r[k];
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) { lina[k] = Math.round(n); tolur++; }
  }
  /* Lína án talna myndi bara breyta upprunanum og læsa deginum */
  return tolur ? lina : null;
}

async function supabaseBakendi() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  /* Lotan er geymd í vafranum og endurnýjast sjálf, svo fólk helst inni á
     sama tæki þar til það skráir sig út. Þetta eru sjálfgefin gildi, skrifuð
     hér svo enginn breyti þeim óvart. */
  const sb = createClient(stillingar.supabaseUrl, stillingar.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  /* Hlekkur til að velja nýtt lykilorð skráir fólk inn og Supabase lætur
     vita með PASSWORD_RECOVERY. Hlustað strax, áður en slóðin er lesin. */
  let endurstilling = false;
  sb.auth.onAuthStateChange((atburdur) => {
    if (atburdur === 'PASSWORD_RECOVERY') endurstilling = true;
  });

  /* Hver er innskráður. Lotan liggur í vafranum, svo hér er ekki farið á
     netið við hverja síðu. Prófíllinn er geymdur meðan flipinn er opinn.
     Þetta stýrir bara hvað er teiknað: gagnagrunnurinn sjálfur (RLS)
     ákveður hvað hver má sjá, sama hvað stendur hér. */
  let minn = null;
  const LYKILL_EG = 'tveir-eg';

  async function eg() {
    if (minn) return minn;
    const { data: { session } } = await sb.auth.getSession();
    const user = session && session.user;
    if (!user) return null;
    try {
      const geymt = JSON.parse(sessionStorage.getItem(LYKILL_EG) || 'null');
      if (geymt && geymt.id === user.id) { minn = geymt; return minn; }
    } catch (e) { /* ekkert geymt */ }
    const { data } = await sb
      .from('notendur')
      .select('id, nafn, netfang, hlutverk, fyrirtaeki_id, fyrirtaeki(id, nafn, merki_url, er_askrift, askrift_verd)')
      .eq('id', user.id)
      .single();
    minn = data || null;
    if (minn) { try { sessionStorage.setItem(LYKILL_EG, JSON.stringify(minn)); } catch (e) { /* lokað */ } }
    return minn;
  }

  function kasta({ error }) { if (error) throw new Error(error.message); }
  function kastaUv({ error }) { if (error) throw new Error(undirverkVilla(error)); }

  return {
    prufa: false,

    async innskra(netfang) {
      const { error } = await sb.auth.signInWithOtp({
        email: netfang.trim().toLowerCase(),
        options: { shouldCreateUser: false, emailRedirectTo: stillingar.slod + 'yfirlit.html' }
      });
      /* Netfang sem er ekki með aðgang fær sama svar og hin, svo enginn geti
         prófað sig áfram og fundið hverjir eru í kerfinu. */
      if (error && (error.code === 'otp_disabled' || /signups not allowed/i.test(error.message || ''))) return;
      if (error) throw new Error(innskraningarvilla(error));
    },

    async innskraLykilord(netfang, lykilord) {
      const { error } = await sb.auth.signInWithPassword({
        email: netfang.trim().toLowerCase(),
        password: lykilord
      });
      if (error) throw new Error(innskraningarvilla(error));
      minn = null;
    },

    /* Supabase segir ekki hvort netfangið er til, og það gerum við ekki heldur */
    async sendaEndurstillingu(netfang) {
      const { error } = await sb.auth.resetPasswordForEmail(netfang.trim().toLowerCase(), {
        redirectTo: stillingar.slod + '?endurstilla=1'
      });
      if (error) throw new Error(innskraningarvilla(error));
    },

    /* Merkið lykilord_sett í user_metadata segir okkur bara hvort við eigum
       að bjóða fólki að velja lykilorð. Það stýrir engum réttindum. */
    async setjaLykilord(lykilord) {
      const { error } = await sb.auth.updateUser({ password: lykilord, data: { lykilord_sett: true } });
      if (error) throw new Error(innskraningarvilla(error));
      endurstilling = false;
    },

    async vantarLykilord() {
      const { data: { session } } = await sb.auth.getSession();
      const user = session && session.user;
      return !!user && !(user.user_metadata && user.user_metadata.lykilord_sett);
    },

    erEndurstilling() { return endurstilling; },

    async utskra() {
      minn = null;
      try {
        Object.keys(sessionStorage).filter((k) => k.startsWith('tveir-')).forEach((k) => sessionStorage.removeItem(k));
      } catch (e) { /* lokað */ }
      await sb.auth.signOut();
    },

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
      const grunnur = '*, fyrirtaeki(nafn), verkefni(titill), abyrgd_notandi:abyrgd(nafn), hofundur_notandi:hofundur(nafn, hlutverk)';
      const saekja = (dalkar) => {
        let q = sb.from('taskar').select(dalkar);
        if (fyrirtaeki_id) q = q.eq('fyrirtaeki_id', fyrirtaeki_id);
        if (verkefni_id) q = q.eq('verkefni_id', verkefni_id);
        /* Innan verkefnis ræður röðin, annars nýjast efst */
        return verkefni_id
          ? q.order('rod').order('stofnad')
          : q.order('stofnad', { ascending: false });
      };
      /* Undirverkin fylgja með svo spjöldin sýni "2 af 4 lokið". Sé taflan
         ekki komin í gagnagrunninn virkar listinn samt, bara án þeirra. */
      let svar = await saekja(grunnur + ', undirverk(id, lokid)');
      if (svar.error && /undirverk/i.test(svar.error.message || '')) svar = await saekja(grunnur);
      kasta(svar); return svar.data;
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

    /* ---------- Undirverk ----------
       Bara við bætum við, breytum og eyðum (RLS). Viðskiptavinur les.
       fyrirtaeki_id er sett í gagnagrunninum úr taskinum.
       Villur koma á ensku frá Supabase og verða íslenskar í kastaUv. */

    async undirverk(task_id) {
      const svar = await sb.from('undirverk').select('*')
        .eq('task_id', task_id).order('rod').order('stofnad');
      kastaUv(svar); return svar.data;
    },

    async nyUndirverk(task_id, titlar) {
      const sidast = await sb.from('undirverk').select('rod')
        .eq('task_id', task_id).order('rod', { ascending: false }).limit(1);
      kastaUv(sidast);
      const fra = sidast.data && sidast.data[0] ? Number(sidast.data[0].rod) + 1 : 1;
      const svar = await sb.from('undirverk')
        .insert(titlar.map((titill, i) => ({ task_id, titill: String(titill).slice(0, 200), rod: fra + i })))
        .select();
      kastaUv(svar); return svar.data;
    },

    async uppfaeraUndirverk(id, breytingar) {
      const svar = await sb.from('undirverk').update(breytingar).eq('id', id).select().single();
      kastaUv(svar); return svar.data;
    },

    async eydaUndirverk(u) {
      if (u.skra_slod) await sb.storage.from('vidhengi').remove([u.skra_slod]);
      const svar = await sb.from('undirverk').delete().eq('id', u.id);
      kastaUv(svar);
    },

    /* Slóðin er <fyrirtaeki>/undirverk/<task>/<undirverk>/<nafn>. Gagnagrunnurinn
       hafnar annarri slóð, og fyrirtækið er tekið úr undirverkinu sjálfu. */
    async skraAUndirverk(u, fyrirtaeki_id, skra) {
      const hreintNafn = skra.name.replace(/[^\w.\- ]+/g, '_').slice(-120) || 'skra';
      const slod = (u.fyrirtaeki_id || fyrirtaeki_id) + '/undirverk/' + u.task_id + '/' + u.id + '/'
        + Date.now() + '-' + hreintNafn;
      const upp = await sb.storage.from('vidhengi')
        .upload(slod, skra, { upsert: false, contentType: skra.type || undefined });
      if (upp.error) throw new Error(undirverkVilla(upp.error));
      const svar = await sb.from('undirverk').update({
        skra_slod: slod, skra_nafn: skra.name.slice(0, 300), skra_staerd: skra.size
      }).eq('id', u.id).select().single();
      if (svar.error) {
        await sb.storage.from('vidhengi').remove([slod]);
        kastaUv(svar);
      }
      /* Gamla skráin fer þegar ný kemur í staðinn */
      if (u.skra_slod && u.skra_slod !== slod) await sb.storage.from('vidhengi').remove([u.skra_slod]);
      return svar.data;
    },

    /* Hlekkurinn gildir í eina mínútu, bara til að opna skrána núna */
    async slodAUndirverki(u) {
      const svar = await sb.storage.from('vidhengi').createSignedUrl(u.skra_slod, 60);
      if (svar.error) throw new Error(undirverkVilla(svar.error));
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

    /* ---------- Bókhald: samningar, aukaverkefni, taxtar ---------- */

    async bokhald(tafla) {
      const svar = await sb.from(tafla).select('*');
      kasta(svar); return svar.data;
    },

    async vistaBokhald(tafla, rod) {
      const svar = rod.id
        ? await sb.from(tafla).update(rod).eq('id', rod.id).select().single()
        : await sb.from(tafla).insert(rod).select().single();
      kasta(svar); return svar.data;
    },

    async eydaBokhald(tafla, id) {
      const svar = await sb.from(tafla).delete().eq('id', id);
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
    },

    /* ---------- Tölfræði ----------
       Bara við skrifum (RLS). Viðskiptavinur les sitt fyrirtæki og sér
       bara sendar skýrslur. fyrirtaeki_id á mælingum og færslum er sett í
       gagnagrunninum úr miðlinum, sama hvað við sendum. */

    async midlar(fyrirtaeki_id) {
      const svar = await sb.from('midlar').select('*')
        .eq('fyrirtaeki_id', fyrirtaeki_id).order('midill').order('nafn');
      kastaTf(svar); return svar.data;
    },

    async nyrMidill(m) {
      const svar = await sb.from('midlar').insert({
        fyrirtaeki_id: m.fyrirtaeki_id, midill: m.midill,
        nafn: String(m.nafn || '').trim().slice(0, 120),
        ytra_id: m.ytra_id ? String(m.ytra_id).trim().slice(0, 100) : null,
        slod: m.slod ? String(m.slod).trim().slice(0, 500) : null,
        virkt: m.virkt !== false
      }).select().single();
      kastaTf(svar); return svar.data;
    },

    async uppfaeraMidil(id, breytingar) {
      const svar = await sb.from('midlar').update(breytingar).eq('id', id).select().single();
      kastaTf(svar); return svar.data;
    },

    async eydaMidli(id) {
      const svar = await sb.from('midlar').delete().eq('id', id);
      kastaTf(svar);
    },

    /* Allar mælingar fyrirtækisins á bilinu [fra, til]. Supabase skilar
       mest 1000 línum í einu, svo sótt er í skömmtum. */
    async maelingar(fyrirtaeki_id, fra, til) {
      return allarLinur(() => sb.from('maelingar').select('*')
        .eq('fyrirtaeki_id', fyrirtaeki_id).gte('dags', fra).lte('dags', til)
        .order('dags').order('midill_id'));
    },

    /* Skrifar mælingar, ný lína eða uppfærð. Línur eru flokkaðar eftir
       hvaða tölur þær hafa, svo tómur reitur skrifi aldrei yfir gamla tölu. */
    async vistaMaelingar(rows) {
      const hopar = new Map();
      for (const r of rows || []) {
        const lina = hreinMaeling(r);
        if (!lina) continue;
        lina.uppfaert = new Date().toISOString();
        const lykill = Object.keys(lina).sort().join(',');
        if (!hopar.has(lykill)) hopar.set(lykill, []);
        hopar.get(lykill).push(lina);
      }
      let skrifad = 0;
      for (const hopur of hopar.values()) {
        for (let i = 0; i < hopur.length; i += 500) {
          const skammtur = hopur.slice(i, i + 500);
          const svar = await sb.from('maelingar').upsert(skammtur, { onConflict: 'midill_id,dags' });
          kastaTf(svar);
          skrifad += skammtur.length;
        }
      }
      return skrifad;
    },

    /* Færslur birtar á bilinu, mest skoðuðu fyrst */
    async midlaFaerslur(fyrirtaeki_id, fra, til) {
      const eftir = new Date(til + 'T00:00:00Z');
      eftir.setUTCDate(eftir.getUTCDate() + 1);
      const svar = await sb.from('midla_faerslur').select('*')
        .eq('fyrirtaeki_id', fyrirtaeki_id)
        .gte('birt', fra + 'T00:00:00Z').lt('birt', eftir.toISOString())
        .order('ahorf', { ascending: false, nullsFirst: false })
        .limit(300);
      kastaTf(svar); return svar.data;
    },

    async skyrslur(fyrirtaeki_id) {
      const svar = await sb.from('skyrslur').select('*')
        .eq('fyrirtaeki_id', fyrirtaeki_id).order('manudur', { ascending: false });
      kastaTf(svar); return svar.data;
    },

    async uppfaeraSkyrslu(id, breytingar) {
      const svar = await sb.from('skyrslur').update(breytingar).eq('id', id).select().single();
      kastaTf(svar); return svar.data;
    }
  };

  function kastaTf({ error }) { if (error) throw new Error(tolfraediVilla(error)); }

  async function allarLinur(smidur) {
    const SKAMMTUR = 1000;
    const ut = [];
    for (let fra = 0; fra < 50000; fra += SKAMMTUR) {
      const svar = await smidur().range(fra, fra + SKAMMTUR - 1);
      kastaTf(svar);
      ut.push(...(svar.data || []));
      if (!svar.data || svar.data.length < SKAMMTUR) break;
    }
    return ut;
  }
}

/* ==========================================================================
   Prufudæmi: lifir í localStorage svo breytingar haldast milli endurhleðslna
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
        skiladagur: dagsetning(1), lokid_dags: null, stofnad: dags(0), uppfaert: dags(0) },
      { id: 't9', rod: 2, fyrirtaeki_id: 'f2', verkefni_id: 'v2', titill: 'Klippa fjögur reels',
        lysing: 'Eitt reel á viku í desember. Hvert fer til ykkar um leið og það er klárt.',
        stada: 'i_vinnslu', forgangur: 'venjulegt', abyrgd: 'u-oskar', hofundur: 'u-oskar',
        skiladagur: dagsetning(14), lokid_dags: null, stofnad: dags(-3), uppfaert: dags(-1) }
    ];

    /* Undirverk: mörg skil innan eins tasks */
    const undirverk = [
      { id: 'uv1', task_id: 't9', fyrirtaeki_id: 'f2', rod: 1, titill: 'Reel 1: Opnunartilboð',
        lokid: true, lokid_dags: dags(-2), skra_slod: null, skra_nafn: null, skra_staerd: null,
        tengill: 'https://we.tl/t-sYnIdAEmI1', senda: true, sent_dags: dags(-2), stofnad: dags(-3) },
      { id: 'uv2', task_id: 't9', fyrirtaeki_id: 'f2', rod: 2, titill: 'Reel 2: Á bak við tjöldin',
        lokid: true, lokid_dags: dags(-1), skra_slod: 'prufa', skra_nafn: 'reel-2-bak-vid-tjoldin.mp4',
        skra_staerd: 38200000, tengill: null, senda: true, sent_dags: null, stofnad: dags(-3) },
      { id: 'uv3', task_id: 't9', fyrirtaeki_id: 'f2', rod: 3, titill: 'Reel 3: Starfsfólkið',
        lokid: false, lokid_dags: null, skra_slod: null, skra_nafn: null, skra_staerd: null,
        tengill: null, senda: true, sent_dags: null, stofnad: dags(-3) },
      { id: 'uv4', task_id: 't9', fyrirtaeki_id: 'f2', rod: 4, titill: 'Reel 4: Jólakveðja',
        lokid: false, lokid_dags: null, skra_slod: null, skra_nafn: null, skra_staerd: null,
        tengill: null, senda: true, sent_dags: null, stofnad: dags(-3) }
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

    /* Bókhaldið. Upphæðir án VSK nema vsklaust sé merkt. Vinna í mánuði
       greiðist 1. dag næsta mánaðar. */
    const man = (n) => {
      const d = new Date(nu); d.setDate(1); d.setMonth(d.getMonth() + n);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    };
    const samningar = [
      { id: 's1', vidskiptavinur: 'Hlíðarkaup', thjonusta: 'Efni og samfélagsmiðlar',
        upphaed: 290000, vsklaust: false, hefst: man(-5), lykur: null },
      { id: 's2', vidskiptavinur: 'Steinvík ehf.', thjonusta: 'Vefsíða í áskrift',
        upphaed: 45000, vsklaust: false, hefst: man(-2), lykur: null },
      { id: 's3', vidskiptavinur: 'Íþróttafélagið Hekla', thjonusta: 'Samfélagsmiðlar',
        upphaed: 150000, vsklaust: true, hefst: man(-3), lykur: null },
      { id: 's4', vidskiptavinur: 'Fossberg ehf.', thjonusta: 'Auglýsingar',
        upphaed: 120000, vsklaust: false, hefst: man(1), lykur: null }
    ];
    const aukaverkefni = [
      { id: 'a1', heiti: 'Tökudagur', vidskiptavinur: 'Steinvík ehf.', upphaed: 180000,
        vsklaust: false, dags: man(0) + '-12', stada: 'stadfest', greitt: false },
      { id: 'a2', heiti: '3 vidjó', vidskiptavinur: 'Hlíðarkaup', upphaed: 90000,
        vsklaust: false, dags: man(0) + '-20', stada: 'stadfest', greitt: false },
      { id: 'a3', heiti: 'Jólaherferð', vidskiptavinur: 'Hlíðarkaup', upphaed: 250000,
        vsklaust: false, dags: man(1) + '-05', stada: 'kannski', greitt: false },
      { id: 'a4', heiti: 'Lendingarsíða', vidskiptavinur: 'Fossberg ehf.', upphaed: 420000,
        vsklaust: false, dags: man(-1) + '-18', stada: 'stadfest', greitt: true },
      { id: 'a5', heiti: 'Myndataka', vidskiptavinur: 'Steinvík ehf.', upphaed: 150000,
        vsklaust: false, dags: man(-3) + '-09', stada: 'stadfest', greitt: true }
    ];
    const taxtar = [
      { id: 'x1', vidskiptavinur: 'Hlíðarkaup', heiti: 'Vidjó', eining: 'vidjó',
        upphaed: 30000, vsklaust: false },
      { id: 'x2', vidskiptavinur: 'Steinvík ehf.', heiti: 'Tökudagur', eining: 'dagur',
        upphaed: 180000, vsklaust: false }
    ];

    /* Tölfræði: miðlar, skýrslur og það sem er skráð í höndunum. Daglegu
       tölurnar sjálfar eru reiknaðar í prufuRodir og ekki geymdar. */
    const tfMidlar = prufuMidlar();
    const tf = { midlar: tfMidlar, handvirkt: {}, skyrslur: prufuSkyrslur(fyr, tfMidlar) };

    return { fyrirtaeki: fyr, notendur, verkefni, taskar, athugasemdir,
             innri, timaskraning, snid, vidhengi: [], innri_taskar, undirverk,
             fyrirspurnir, samningar, aukaverkefni, taxtar, tf, innskradur: null };
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
      abyrgd_notandi: t.abyrgd ? { nafn: (finna(g.notendur, t.abyrgd) || {}).nafn } : null,
      hofundur_notandi: t.hofundur ? (({ nafn, hlutverk }) => ({ nafn, hlutverk }))(finna(g.notendur, t.hofundur) || {}) : null,
      undirverk: (g.undirverk || []).filter((u) => u.task_id === t.id)
        .map((u) => ({ id: u.id, lokid: u.lokid }))
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

    /* Í prufu dugar hvaða lykilorð sem er, það er ekkert til að verja */
    async innskraLykilord(netfang, lykilord) {
      if (!lykilord) throw new Error('Lykilorðið vantar.');
      await this.innskra(netfang);
    },

    async sendaEndurstillingu() { /* enginn póstur fer út í prufu */ },

    async setjaLykilord() {
      g.lykilordSett = { ...(g.lykilordSett || {}), [g.innskradur]: true };
      vista();
    },

    async vantarLykilord() {
      return !!g.innskradur && !(g.lykilordSett && g.lykilordSett[g.innskradur]);
    },

    erEndurstilling() { return false; },

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

    /* ---------- Undirverk ----------
       Skrárnar sjálfar lifa bara í minni, eins og viðhengin. */

    async undirverk(task_id) {
      return (g.undirverk || []).filter((u) => u.task_id === task_id)
        .sort((a, b) => (a.rod - b.rod) || (new Date(a.stofnad) - new Date(b.stofnad)))
        .map((u) => ({ ...u }));
    },

    async nyUndirverk(task_id, titlar) {
      const t = finna(g.taskar, task_id);
      g.undirverk = g.undirverk || [];
      const minir = g.undirverk.filter((u) => u.task_id === task_id);
      const fra = minir.length ? Math.max(...minir.map((u) => Number(u.rod) || 0)) + 1 : 1;
      const nyjir = titlar.map((titill, i) => ({
        id: nyttId(), task_id, fyrirtaeki_id: t ? t.fyrirtaeki_id : null, rod: fra + i, titill,
        lokid: false, lokid_dags: null, skra_slod: null, skra_nafn: null, skra_staerd: null,
        tengill: null, senda: true, sent_dags: null, stofnad: new Date().toISOString()
      }));
      g.undirverk.push(...nyjir);
      vista(); return nyjir;
    },

    async uppfaeraUndirverk(id, breytingar) {
      const u = finna(g.undirverk || [], id);
      if (!u) return null;
      const varLokid = u.lokid;
      Object.assign(u, breytingar);
      if (u.lokid && !varLokid) u.lokid_dags = new Date().toISOString();
      if (!u.lokid) u.lokid_dags = null;
      vista(); return { ...u };
    },

    async eydaUndirverk(u) {
      g.undirverk = (g.undirverk || []).filter((x) => x.id !== u.id);
      BLOB.delete(u.id);
      vista();
    },

    async skraAUndirverk(u, fyrirtaeki_id, skra) {
      BLOB.set(u.id, skra);
      return this.uppfaeraUndirverk(u.id, {
        skra_slod: 'prufa', skra_nafn: skra.name, skra_staerd: skra.size
      });
    },

    async slodAUndirverki(u) {
      const skra = BLOB.get(u.id);
      if (!skra) throw new Error('Í prufustillingu lifa skrár bara meðan síðan er opin.');
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

    /* ---------- Bókhald: samningar, aukaverkefni, taxtar ---------- */

    async bokhald(tafla) {
      return (g[tafla] || []).map((r) => ({ ...r }));
    },

    async vistaBokhald(tafla, rod) {
      g[tafla] = g[tafla] || [];
      if (rod.id) {
        const r = finna(g[tafla], rod.id);
        if (r) Object.assign(r, rod);
      } else {
        rod = { ...rod, id: nyttId() };
        g[tafla].push(rod);
      }
      vista(); return { ...rod };
    },

    async eydaBokhald(tafla, id) {
      g[tafla] = (g[tafla] || []).filter((x) => x.id !== id);
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

    /* ---------- Tölfræði ----------
       Sömu reglur og RLS: viðskiptavinur les bara sitt fyrirtæki og sér
       bara sendar skýrslur, bara við skrifum. */

    async midlar(fyrirtaeki_id) {
      if (!maSja(fyrirtaeki_id)) return [];
      return g.tf.midlar.filter((m) => m.fyrirtaeki_id === fyrirtaeki_id)
        .map((m) => ({ ...m }))
        .sort((a, b) => a.midill.localeCompare(b.midill) || a.nafn.localeCompare(b.nafn, 'is'));
    },

    async nyrMidill(m) {
      krefjastAdmin();
      const midill = String(m.midill || '');
      const nafn = String(m.nafn || '').trim();
      const slod = m.slod ? String(m.slod).trim() : null;
      if (!['instagram', 'facebook', 'tiktok'].includes(midill)) throw new Error('Veldu miðil.');
      if (!nafn || nafn.length > 120) throw new Error('Nafnið þarf að vera 1 til 120 stafir.');
      if (slod && (!/^https:\/\/\S+$/.test(slod) || slod.length > 500)) throw new Error('Slóðin þarf að byrja á https:// og vera án bila.');
      if (g.tf.midlar.some((x) => x.fyrirtaeki_id === m.fyrirtaeki_id && x.midill === midill && x.nafn === nafn)) {
        throw new Error('Þessi miðill er þegar skráður hjá fyrirtækinu.');
      }
      const nyr = {
        id: nyttId(), fyrirtaeki_id: m.fyrirtaeki_id, midill, nafn,
        ytra_id: m.ytra_id ? String(m.ytra_id).trim().slice(0, 100) : null,
        slod, virkt: m.virkt !== false, stofnad: new Date().toISOString()
      };
      g.tf.midlar.push(nyr); vista(); return { ...nyr };
    },

    async uppfaeraMidil(id, breytingar) {
      krefjastAdmin();
      const m = finna(g.tf.midlar, id);
      if (!m) throw new Error('Miðillinn fannst ekki.');
      const leyft = ['midill', 'nafn', 'ytra_id', 'slod', 'virkt'];
      for (const k of leyft) if (breytingar[k] !== undefined) m[k] = breytingar[k];
      vista(); return { ...m };
    },

    async eydaMidli(id) {
      krefjastAdmin();
      g.tf.midlar = g.tf.midlar.filter((m) => m.id !== id);
      for (const k of Object.keys(g.tf.handvirkt)) if (k.split('|')[0] === id) delete g.tf.handvirkt[k];
      vista();
    },

    async maelingar(fyrirtaeki_id, fra, til) {
      if (!maSja(fyrirtaeki_id)) return [];
      const ut = [];
      for (const m of g.tf.midlar.filter((x) => x.fyrirtaeki_id === fyrirtaeki_id)) {
        const kort = new Map(prufuRodir(m.id).maelingar
          .filter((r) => r.dags >= fra && r.dags <= til)
          .map((r) => [r.dags, { ...r }]));
        for (const [k, h] of Object.entries(g.tf.handvirkt)) {
          const [mid, d] = k.split('|');
          if (mid !== m.id || d < fra || d > til) continue;
          const lina = kort.get(d) || { midill_id: m.id, fyrirtaeki_id, dags: d };
          for (const t of MAELITOLUR) if (h[t] !== undefined && h[t] !== null) lina[t] = h[t];
          lina.uppruni = h.uppruni; lina.uppfaert = h.uppfaert;
          kort.set(d, lina);
        }
        ut.push(...kort.values());
      }
      return ut.sort((a, b) => a.dags.localeCompare(b.dags));
    },

    async vistaMaelingar(rows) {
      krefjastAdmin();
      let skrifad = 0;
      for (const r of rows || []) {
        const lina = hreinMaeling(r);
        if (!lina || !finna(g.tf.midlar, lina.midill_id)) continue;
        const k = lina.midill_id + '|' + lina.dags;
        g.tf.handvirkt[k] = { ...(g.tf.handvirkt[k] || {}), ...lina, uppfaert: new Date().toISOString() };
        skrifad++;
      }
      vista(); return skrifad;
    },

    async midlaFaerslur(fyrirtaeki_id, fra, til) {
      if (!maSja(fyrirtaeki_id)) return [];
      const ut = [];
      for (const m of g.tf.midlar.filter((x) => x.fyrirtaeki_id === fyrirtaeki_id)) {
        ut.push(...prufuRodir(m.id).faerslur.filter((p) => {
          const d = p.birt.slice(0, 10);
          return d >= fra && d <= til;
        }).map((p) => ({ ...p })));
      }
      return ut.sort((a, b) => (b.ahorf || 0) - (a.ahorf || 0)).slice(0, 300);
    },

    async skyrslur(fyrirtaeki_id) {
      if (!maSja(fyrirtaeki_id)) return [];
      /* Pósturinn í Apps Script sendir samþykkta skýrslu innan fárra
         sekúndna. Hér er það leikið eftir. */
      let breytt = false;
      for (const s of g.tf.skyrslur) {
        if (s.stada === 'samthykkt' && !s.sent_dags
            && Date.now() - new Date(s.samthykkt_dags).getTime() > 4000) {
          s.stada = 'send'; s.sent_dags = new Date().toISOString(); breytt = true;
        }
      }
      if (breytt) vista();
      const admin = erAdminPrufa();
      return g.tf.skyrslur
        .filter((s) => s.fyrirtaeki_id === fyrirtaeki_id && (admin || s.stada === 'send'))
        .map((s) => JSON.parse(JSON.stringify(s)))
        .sort((a, b) => b.manudur.localeCompare(a.manudur));
    },

    async uppfaeraSkyrslu(id, breytingar) {
      krefjastAdmin();
      const s = finna(g.tf.skyrslur, id);
      if (!s) throw new Error('Skýrslan fannst ekki.');
      if (s.stada === 'send') throw new Error('Skýrslan er þegar send og breytist ekki.');
      if (breytingar.samantekt !== undefined) {
        s.samantekt = String(breytingar.samantekt || '').slice(0, 4000) || null;
      }
      if (breytingar.stada === 'samthykkt' && s.stada === 'drog') {
        s.stada = 'samthykkt'; s.samthykkt_dags = new Date().toISOString();
      }
      vista(); return JSON.parse(JSON.stringify(s));
    },

    /* Bara í prufu: byrja upp á nýtt */
    hreinsa() { g = sjalfgefid(); BLOB.clear(); vista(); }
  };

  function innskradurPrufa() { return g.innskradur ? finna(g.notendur, g.innskradur) : null; }
  function erAdminPrufa() { const n = innskradurPrufa(); return !!n && n.hlutverk === 'admin'; }
  function maSja(fyrirtaeki_id) {
    const n = innskradurPrufa();
    return !!n && (n.hlutverk === 'admin' || n.fyrirtaeki_id === fyrirtaeki_id);
  }
  function krefjastAdmin() { if (!erAdminPrufa()) throw new Error('Þú hefur ekki aðgang að þessu.'); }
}

/* ==========================================================================
   Tölfræði í prufu
   Daglegu tölurnar eru reiknaðar út frá föstu fræi í hvert sinn, svo
   localStorage fyllist ekki og sömu dagar gefa alltaf sömu tölur.
   ========================================================================== */

function ymdStadur(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function prufuMidlar() {
  const t = new Date(Date.now() - 400 * 86400000).toISOString();
  return [
    { id: 'm1', fyrirtaeki_id: 'f1', midill: 'instagram', nafn: 'hlidarkaup', ytra_id: '17841400000000001',
      slod: null, virkt: true, stofnad: t },
    { id: 'm2', fyrirtaeki_id: 'f1', midill: 'facebook', nafn: 'Hlíðarkaup', ytra_id: '100000000000001',
      slod: null, virkt: true, stofnad: t },
    { id: 'm3', fyrirtaeki_id: 'f2', midill: 'instagram', nafn: 'steinvik', ytra_id: '17841400000000002',
      slod: null, virkt: true, stofnad: t },
    { id: 'm4', fyrirtaeki_id: 'f2', midill: 'tiktok', nafn: 'steinvik.ehf', ytra_id: null,
      slod: null, virkt: true, stofnad: t }
  ];
}

const TEXTAR_HLIDARKAUP = [
  'Ný sending af ávöxtum komin í hús', 'Tilboð helgarinnar: grillkjöt á góðu verði',
  'Opið til 21 öll kvöld vikunnar', 'Á bak við tjöldin í bakaríinu',
  'Starfsfólk vikunnar kynnir sig', 'Uppskrift vikunnar: fiskréttur fyrir fjóra',
  'Nýtt í kælinum', 'Takk fyrir frábæra viku'
];
const TEXTAR_STEINVIK = [
  'Nýtt verkefni að klárast', 'Fyrir og eftir: pallur í Garðabæ', 'Hópurinn á verkstað í morgun',
  'Svona leggjum við hellur', 'Við erum að ráða smið', 'Vika í vinnu á 30 sekúndum',
  'Spurt og svarað: hvað tekur pallur langan tíma'
];

function prufuSnid(id) {
  return ({
    m1: { f: 'f1', fylg: 4200, voxtur: 3.2, ahorf: 2600, faerslur: 3.2, fraeid: 11,
          tegundir: ['reel', 'karusell', 'mynd', 'reel'], textar: TEXTAR_HLIDARKAUP },
    m2: { f: 'f1', fylg: 6800, voxtur: 1.1, ahorf: 1500, faerslur: 2.4, fraeid: 23, eydur: 0.012,
          tegundir: ['mynd', 'myndband', 'annad'], textar: TEXTAR_HLIDARKAUP },
    m3: { f: 'f2', fylg: 1850, voxtur: 2.0, ahorf: 900, faerslur: 2.6, fraeid: 37,
          tegundir: ['reel', 'mynd', 'karusell'], textar: TEXTAR_STEINVIK },
    m4: { f: 'f2', fylg: 950, voxtur: 6.0, ahorf: 3200, faerslur: 3.0, fraeid: 41, toppar: 0.03,
          tegundir: ['myndband'], textar: TEXTAR_STEINVIK }
  })[id] || null;
}

/* Lítill slembigjafi með fræi (mulberry32) */
function slembir(fraeid) {
  let a = fraeid >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRUFA_MINNI = new Map();

/* Daglegar tölur og færslur eins miðils, frá 1. júní 2025 (eða 400
   dögum aftur) til gærdagsins. Hægur vöxtur, vikutaktur og nokkrir toppar. */
function prufuRodir(id) {
  const snid = prufuSnid(id);
  if (!snid) return { maelingar: [], faerslur: [] };
  const igaer = new Date(); igaer.setHours(12, 0, 0, 0); igaer.setDate(igaer.getDate() - 1);
  const lykill = id + '|' + ymdStadur(igaer);
  if (PRUFA_MINNI.has(lykill)) return PRUFA_MINNI.get(lykill);

  const r = slembir(snid.fraeid);
  const d = new Date(2025, 5, 1, 12);
  const fyrst = new Date(igaer); fyrst.setDate(fyrst.getDate() - 400);
  if (fyrst < d) d.setTime(fyrst.getTime());
  const VIKA = [0.86, 1.04, 1.08, 1.0, 1.06, 1.18, 0.92];
  const maelingar = [];
  const faerslur = [];
  let fylg = snid.fylg;
  let i = 0;
  while (d <= igaer) {
    const dags = ymdStadur(d);
    const vidgangur = 1 + i / 900;
    const fjoldi = r() < snid.faerslur / 7 ? (r() < 0.12 ? 2 : 1) : 0;
    const toppur = r() < (snid.toppar || 0.012) ? 2.6 + r() * 2.4 : 1;
    const ahorf = Math.round(snid.ahorf * vidgangur * VIKA[d.getDay()] * (0.82 + r() * 0.36)
      * (fjoldi ? 1.35 : 1) * toppur);
    fylg += snid.voxtur * (0.4 + r() * 1.2) + (toppur > 1 ? snid.voxtur * 6 * toppur : 0)
      - (r() < 0.05 ? snid.voxtur * 2 : 0);
    const vantar = snid.eydur ? r() < snid.eydur : false;
    if (!vantar) {
      maelingar.push({
        midill_id: id, fyrirtaeki_id: snid.f, dags, fylgjendur: Math.round(fylg), ahorf,
        nadir: Math.round(ahorf * (0.55 + r() * 0.15)),
        samskipti: Math.round(ahorf * (0.03 + r() * 0.03)),
        heimsoknir: Math.round(ahorf * (0.015 + r() * 0.015)),
        faerslur: fjoldi, uppruni: 'sjalfvirkt', uppfaert: dags + 'T06:00:00Z'
      });
    }
    for (let k = 0; k < fjoldi; k++) {
      const tegund = snid.tegundir[Math.floor(r() * snid.tegundir.length)];
      const pa = Math.round(snid.ahorf * vidgangur * (0.6 + r() * 1.6) * toppur
        * (tegund === 'reel' || tegund === 'myndband' ? 1.5 : 1));
      const ytra = id + '-' + i + '-' + k;
      faerslur.push({
        id: 'p-' + ytra, midill_id: id, fyrirtaeki_id: snid.f, ytra_id: ytra,
        birt: dags + 'T' + String(9 + Math.floor(r() * 11)).padStart(2, '0') + ':'
          + String(Math.floor(r() * 60)).padStart(2, '0') + ':00Z',
        tegund, texti: snid.textar[Math.floor(r() * snid.textar.length)],
        slod: 'https://example.com/faersla/' + ytra, mynd_slod: null,
        ahorf: pa, nadir: Math.round(pa * (0.6 + r() * 0.2)),
        likes: Math.round(pa * (0.02 + r() * 0.04)),
        athugasemdir: Math.round(pa * (0.002 + r() * 0.004)),
        deilingar: Math.round(pa * (0.001 + r() * 0.004)),
        vistanir: Math.round(pa * (0.001 + r() * 0.006)),
        uppfaert: dags + 'T06:00:00Z'
      });
    }
    d.setDate(d.getDate() + 1);
    i++;
  }
  const ut = { maelingar, faerslur };
  PRUFA_MINNI.set(lykill, ut);
  return ut;
}

/* Sama lögun og manadar_tolur skilar úr gagnagrunninum, fyrir eitt fyrirtæki */
function prufuManadarTolur(fyr, midlar, manudur) {
  const [ar, man] = manudur.split('-').map(Number);
  const lok = ymdStadur(new Date(ar, man, 0, 12));
  const fyrriFra = ymdStadur(new Date(ar, man - 2, 1, 12));
  const fyrriLok = ymdStadur(new Date(ar, man - 1, 0, 12));
  const summa = (radir, k) => {
    const med = radir.filter((x) => x[k] !== null && x[k] !== undefined);
    return med.length ? med.reduce((a, x) => a + x[k], 0) : null;
  };
  const midlarUt = midlar.map((md) => {
    const { maelingar, faerslur } = prufuRodir(md.id);
    const iMan = maelingar.filter((x) => x.dags >= manudur && x.dags <= lok);
    const iFyrri = maelingar.filter((x) => x.dags >= fyrriFra && x.dags <= fyrriLok);
    const fyrir = maelingar.filter((x) => x.dags < manudur && x.fylgjendur !== null);
    const iManF = iMan.filter((x) => x.fylgjendur !== null);
    const upphaf = fyrir.length ? fyrir[fyrir.length - 1].fylgjendur : (iManF.length ? iManF[0].fylgjendur : null);
    const lokF = iManF.length ? iManF[iManF.length - 1].fylgjendur : null;
    return {
      midill_id: md.id, midill: md.midill, nafn: md.nafn,
      fylgjendur_upphaf: upphaf, fylgjendur_lok: lokF,
      fylgjendur_breyting: upphaf !== null && lokF !== null ? lokF - upphaf : null,
      ahorf: summa(iMan, 'ahorf'), ahorf_fyrri: summa(iFyrri, 'ahorf'),
      nadir: summa(iMan, 'nadir'), nadir_fyrri: summa(iFyrri, 'nadir'),
      samskipti: summa(iMan, 'samskipti'), samskipti_fyrri: summa(iFyrri, 'samskipti'),
      faerslur: summa(iMan, 'faerslur'),
      dagar_med_gognum: new Set(iMan.map((x) => x.dags)).size,
      bestu_faerslur: faerslur
        .filter((p) => p.birt.slice(0, 10) >= manudur && p.birt.slice(0, 10) <= lok)
        .sort((a, b) => (b.ahorf || 0) - (a.ahorf || 0)).slice(0, 3)
        .map((p) => ({ texti: p.texti, slod: p.slod, mynd_slod: p.mynd_slod, tegund: p.tegund,
                       birt: p.birt, ahorf: p.ahorf, nadir: p.nadir, likes: p.likes,
                       athugasemdir: p.athugasemdir }))
    };
  });
  const s = (k) => summa(midlarUt, k);
  return {
    fyrirtaeki_id: fyr.id, fyrirtaeki: fyr.nafn, manudur, midlar: midlarUt,
    samtals: {
      fylgjendur_lok: s('fylgjendur_lok'), fylgjendur_breyting: s('fylgjendur_breyting'),
      ahorf: s('ahorf'), ahorf_fyrri: s('ahorf_fyrri'), nadir: s('nadir'), nadir_fyrri: s('nadir_fyrri'),
      samskipti: s('samskipti'), samskipti_fyrri: s('samskipti_fyrri'), faerslur: s('faerslur')
    }
  };
}

const MAN_NOFN = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí',
                  'ágúst', 'september', 'október', 'nóvember', 'desember'];

/* Einfaldur texti eins og sniðmátið í Apps Script býr til */
function prufuSamantekt(t) {
  const s = t.samtals || {};
  const [ar, man] = t.manudur.split('-').map(Number);
  const nu = MAN_NOFN[man - 1];
  const fyrri = MAN_NOFN[(man + 10) % 12];
  const tala = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const setn = [];
  if (s.fylgjendur_breyting !== null && s.fylgjendur_lok !== null) {
    if (s.fylgjendur_breyting > 0) {
      setn.push('Fylgjendum fjölgaði um ' + tala(s.fylgjendur_breyting) + ' í ' + nu + ' og eru nú ' + tala(s.fylgjendur_lok) + '.');
    } else if (s.fylgjendur_breyting < 0) {
      setn.push('Fylgjendum fækkaði um ' + tala(s.fylgjendur_breyting) + ' í ' + nu + ' og eru nú ' + tala(s.fylgjendur_lok) + '.');
    } else {
      setn.push('Fjöldi fylgjenda stóð í stað í ' + nu + ', ' + tala(s.fylgjendur_lok) + ' talsins.');
    }
  }
  if (s.ahorf !== null && s.ahorf_fyrri) {
    const p = Math.round((s.ahorf - s.ahorf_fyrri) / s.ahorf_fyrri * 100);
    setn.push('Áhorf voru ' + tala(s.ahorf) + ', '
      + (p > 0 ? p + '% fleiri en' : p < 0 ? (-p) + '% færri en' : 'jafn mörg og') + ' í ' + fyrri + '.');
  }
  if (s.faerslur !== null) {
    const ein = s.faerslur % 10 === 1 && s.faerslur % 100 !== 11;
    setn.push(s.faerslur + (ein ? ' færsla fór út.' : ' færslur fóru út.'));
  }
  return setn.join(' ') || null;
}

/* Ein drög fyrir síðasta mánuð og sendar skýrslur fyrir mánuðina á undan */
function prufuSkyrslur(fyr, midlar) {
  const ut = [];
  const nu = new Date(); nu.setDate(1); nu.setHours(12, 0, 0, 0);
  for (const f of fyr.filter((x) => midlar.some((m) => m.fyrirtaeki_id === x.id))) {
    const hans = midlar.filter((m) => m.fyrirtaeki_id === f.id);
    for (let k = 1; k <= 4; k++) {
      const manudur = ymdStadur(new Date(nu.getFullYear(), nu.getMonth() - k, 1, 12));
      const naesti = ymdStadur(new Date(nu.getFullYear(), nu.getMonth() - k + 1, 1, 12));
      const tolur = prufuManadarTolur(f, hans, manudur);
      const sent = k > 1;
      ut.push({
        id: 's-' + f.id + '-' + manudur, fyrirtaeki_id: f.id, manudur, tolur,
        samantekt: prufuSamantekt(tolur), stada: sent ? 'send' : 'drog',
        samthykkt_dags: sent ? naesti + 'T09:12:00Z' : null,
        sent_dags: sent ? naesti + 'T09:14:00Z' : null,
        stofnad: naesti + 'T06:05:00Z'
      });
    }
  }
  return ut;
}

/* ========================================================================== */

let bakendi = null;

/* ?prufa=1 keyrir sýnidæmin, en BARA á localhost svo enginn geti kveikt á
   því á tveir.is. Það helst í flipanum svo hægt sé að skrá sig inn og
   smella sig um. ?prufa=0 slekkur aftur. */
function prufaUmSlod() {
  try {
    if (typeof location === 'undefined') return false;
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return false;
    const leit = new URLSearchParams(location.search).get('prufa');
    try {
      if (leit === '1') sessionStorage.setItem('tveir-prufa', 'ja');
      if (leit === '0') sessionStorage.removeItem('tveir-prufa');
      if (sessionStorage.getItem('tveir-prufa') === 'ja') return true;
    } catch (e) { /* lokað sessionStorage, þá gildir slóðin ein */ }
    return leit === '1';
  } catch (e) { return false; }
}

export async function gogn() {
  if (!bakendi) {
    bakendi = stillingar.prufa || !stillingar.supabaseUrl || prufaUmSlod()
      ? prufuBakendi()
      : await supabaseBakendi();
  }
  return bakendi;
}
