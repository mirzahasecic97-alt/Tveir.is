-- ==========================================================================
-- kanna-fyrir-stofur.sql: forathugun á live ÁÐUR en stofur skref 0 og 1 eru keyrð
-- (samtengingarlisti atriði 21 og 30). LES BARA: fyrsta setningin gerir færsluna
-- read only, svo engin setning hér getur breytt neinu (hún myndi stöðvast með villu).
-- Skrifar engin leyndarmál: bara hvort lyklar séu til, aldrei gildin.
--
-- Keyrt í Supabase SQL Editor (New query > líma > Run) sem postgres. Niðurstaðan
-- er ein tafla, raðað eftir rod: flokkur, atridi, stada og gildi.
--   OK     eins og flutningarnir gera ráð fyrir
--   ATH    lesið og metið (ekki endilega villa); skýringin er í gildi
--   STOPP  ekki keyra skref 0 og 1 fyrr en þetta er lagað eða skoðað
--   UPPL   upplýsingar til að geyma (fjöldi lína, viðbætur, stillingar)
-- Sækið niðurstöðuna sem CSV (Export) og geymið hana með afritinu.
--
-- Hvað er athugað:
--   1. Útgáfa Postgres (15 eða nýrri: security_invoker skoðanir, skip locked í
--      stofa_heimild) og hver keyrir.
--   2. Viðbætur: föll viðbóta í public stöðva vörðinn (atriði 4 og 5) og pgcrypto
--      verður að vera í schema extensions (extensions.digest, gen_random_bytes), og pg_net.
--   3. Rekstraraðili: notendur hefur línu fyrir tveir@tveir.is (stjórnandi), því skref 1
--      setur auðkenni hennar í stillingar_innri.rekstraradilar.
--   4. Föll í public: md5 af prosrc borið saman við væntu gildin úr repo (útgáfa A er
--      gagnagrunnur.sql; útgáfa B er eldri flutningar í nafnaröð, sjá LESTU.md í
--      æfingunni), og md5 af pg_get_functiondef fyrir hvert fall svo bera megi saman
--      við repo. Fall sem passar hvorugu fær skilgreininguna sína í gildi (til að diffa).
--      Eigandi annar en postgres: skref 3 og R3 geta ekki skipt fallinu út.
--   5. Geymslan: má postgres breyta reglum á storage.objects (eigandi) og fötunum
--      (skref 5), og eru reglurnar átta og föturnar tvær þær sem gert er ráð fyrir.
--   6. Vault: má postgres lesa, búa til, uppfæra og eyða leyndarmálum (föll skrefs 3
--      eru í eigu postgres), og eru öll leyndarmál tenginga til.
--   7. Stillingar og skema: lyklar Apps Script til (gildin ekki sýnd), skref 0 og 1
--      ekki þegar keyrð, nöfn skorðanna sem skref 3 skiptir út, RLS á öllum töflum,
--      engin tafla í Realtime, gikkurinn nyr_notandi á auth.users, langar færslur.
--   8. Fjöldi lína í hverri töflu í public (berið saman við afrit_20261123.fjoldi
--      eftir skref 0).
--
-- Væntu gildin í kafla 4 eru búin til af PGlite æfingunni
-- (scratchpad/pglite/stofur-samt/vaent-foll.mjs) úr gagnagrunnur.sql og migrations/.
-- Breytist fall þar þarf að búa þau til aftur.
-- ==========================================================================

set transaction read only;

with
vaent (heiti, fp_a, fp_b) as (values
-- VAENT BYRJAR
    ('afhending_ma_lesa(text)', '1eff5e6dec98f71236a9713a3550be3f', null),
    ('dagatal_skra(text,jsonb,timestamp with time zone,timestamp with time zone)', 'fb0d3e69cfc69bb1173ba88f1fe1d9c4', null),
    ('er_admin()', '839acca6d089ee839ae6e51ac1eff206', null),
    ('eyda_tengingu(text)', 'bb4e355e916b13d1e60556ec901247d6', null),
    ('faera_i_myndbond()', '989c90cf5d49b97c1965a885ed16a558', null),
    ('faera_maelingar()', '8989184a978e7c1f9441a19d87118063', null),
    ('faera_undirverk()', 'e01354ce7cc1c22c0a3e775e7065de32', null),
    ('lokid_otilkynnt(text)', '33461f7e2292a0f71b0b8d1801efe2d9', null),
    ('manadar_tolur(text,date)', 'e2a35b9e055ad9542a29e694f0aa1af0', null),
    ('merkja_postholf_svar(text,uuid,text)', 'bc74a79c85a4f15d529afd40220c053c', null),
    ('merkja_skyrslu_senda(text,uuid[])', '13144dd8a85e3277db37c4ba8f25fb95', null),
    ('merkja_tilkynnt(text,uuid[])', '36da0ffc340bd688c402e33a566e69e2', null),
    ('merkja_tolfraedi_sendingu(text,uuid,text)', '5e18008827dcb5fb83077d33eb95fb8d', null),
    ('merkja_undirverk_sent(text,uuid[])', '402469a9a4dfe9ff7bc3a5ea32fc43c1', null),
    ('midlar_til_soefnunar(text)', '4c4cc0704cacaedcdd22697c3e932e29', null),
    ('mitt_fyrirtaeki()', 'fde7131d679734233e4f30fbb1176c6e', null),
    ('myndband_ur_faerslu(uuid,uuid)', '1a15bdaca30919476f1234455c10d989', null),
    ('nyr_notandi()', '7924b07f4a26784b43bfaa8e04bc3e79', '7bd58590352c821675a6731386fa3db2'),
    ('nytt_verkefni_innri()', '41192ab4af4de54fd9e21b0f5c898b94', null),
    ('postholf_lykill_ok(text)', '91936b6a140b8c3342cdb84afca86769', null),
    ('postholf_skra(text,jsonb,timestamp with time zone)', '9fa7eb32e392b6ac2994cffab64984f6', 'f2b89769a99519e1f50be5426e0a530c'),
    ('postholf_svor_til(text)', '5cf79d7a9a80c2eabfb63a804359954b', '52f5d9157bc6c444701e0f4118e63dc4'),
    ('reikna_framvindu(uuid)', '880b2ad792eb766caf7f734cb7e2ee2d', '1697e0ff096824f68aa792af073b0ec9'), -- B: live 23. nóv, sama rökfræði án athugasemdar og auðrar línu
    ('rls_auto_enable()', '7a5cf6b0971b5915813c25eed06cce66', null),
    ('skra_faerslur(text,jsonb)', '0c66eb12df5281db35101143b3b2064f', null),
    ('skra_maelingar(text,jsonb)', 'bee386e446916dcb7de15dfd4b106c3f', null),
    ('skra_tengingarprufu(text,text)', 'fb49a33c178d41845b0f27b770d7a473', null),
    ('skyrslur_til_sendingar(text)', '130a3977b2c28c7f3dbdb396438eeed3', null),
    ('stilla_framvindu()', 'f70a0c396e4c659f1eb1f052453e9ab5', null),
    ('stilla_klst()', 'ddf1624dcc9d53347653eb28015de822', null),
    ('stilla_maelingu()', 'c4ab1b620da88d35cc9dd63fe0a81ca0', null),
    ('stilla_myndband()', '9a144e10b0c57e334b697b0b8065a049', null),
    ('stilla_myndbandstolu()', 'f97b2d645e6f25bd083880f4f171517f', null),
    ('stilla_postholf_svari()', 'a72d93edc3ddc5f3877335de365a664e', 'e57906408cfcb99fc4e8ed4c87b5b7c6'),
    ('stilla_skyrslu()', 'c5d53b11ff402d937a0f6aca08f77c86', null),
    ('stilla_tolfraedi_sendingu()', '2a58d64d82d33b27a1f63a2d375a6bd2', null),
    ('stilla_undirverk()', '4fd48b9f87673b9d75ddf6aab44b6dd1', null),
    ('stimpla()', 'f7ade6713bdaae745b123b727d800153', null),
    ('taskur_ur_posti(text,text,text,text,text)', 'c92232fbe01311b3df4899d18624561a', null),
    ('tenging_lykill(text)', '041535eb04559e19973554061b3ffada', null),
    ('tengingar_stada()', '502c67c0385990490d436c97232e8aa9', null),
    ('tengja_myndband()', 'c95db36bd15a909c8cd08599d767f2c3', null),
    ('tolfraedi_sendingar_til(text)', '13260aa74e628458c91cb591703b2a53', null),
    ('tolu_gildi(text)', 'f303faa6df591373b7c9721a1800453b', null),
    ('undirverk_otilkynnt(text)', '1557dc8382e2bf0de89f2e2e7be3cc3d', null),
    ('undirverk_skra_opin(text)', 'e77f6499d834c633141eb46dd11c6319', null),
    ('vekja_postinn()', '52498280cdf931ddf7617dc689fbd48e', null),
    ('verja_fyrirtaeki()', 'b7a3967481ae86ab50da287592d0c5de', null),
    ('vernda_notanda()', 'e16b979c7536a46c07d27cf205fdbe3a', null),
    ('vernda_postholf_thrad()', '62d0c95244a8d9f76af49f97d86e561d', null),
    ('vista_skyrslu(text,uuid,date,jsonb,text)', 'acb3d7e1fd738e1b1e493599aece6efd', null),
    ('vista_tengingu(text,jsonb,jsonb)', 'bdb4d8dfb1b0108d21266acdeb41e3a5', null)
    -- VAENT ENDAR
),
toflur_vaent (tafla) as (values
    ('athugasemdir'), ('aukaverkefni'), ('dagatal_atburdir'), ('fundir'), ('fyrirspurnir'), ('fyrirtaeki'),
    ('innri_taskar'), ('kerfisstillingar'), ('maelingar'), ('midla_faerslur'), ('midlar'), ('midlar_innri'),
    ('myndband_tolur'), ('myndbond'), ('notendur'), ('postholf_skilabod'), ('postholf_svor'),
    ('postholf_thraedir'), ('samningar'), ('skyrslur'), ('snid'), ('snid_taskar'), ('stillingar_innri'),
    ('taskar'), ('taxtar'), ('tengingar'), ('timar'), ('tolfraedi_sendingar'), ('undirskriftir'),
    ('undirverk'), ('verkefni'), ('verkefni_innri'), ('vidhengi')
),
reglur_vaent (regla) as (values
    ('merki_hent'), ('merki_les'), ('merki_sett'), ('merki_skipt'),
    ('vidhengi_afhending'), ('vidhengi_eytt'), ('vidhengi_les'), ('vidhengi_sett')
),
foll as (
  select p.oid, p.oid::regprocedure::text heiti, md5(p.prosrc) fp, md5(pg_get_functiondef(p.oid)) fp_def,
         p.prosecdef, pg_get_userbyid(p.proowner) eigandi,
         has_function_privilege('anon', p.oid, 'execute') anon
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
     and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
),
vidbaetur_foll as (
  select p.oid::regprocedure::text heiti, e.extname, p.prosecdef, has_function_privilege('anon', p.oid, 'execute') anon
    from pg_proc p
    join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
    join pg_extension e on e.oid = d.refobjid
   where p.pronamespace = 'public'::regnamespace
),
geymsla as (
  select c.relname, pg_get_userbyid(c.relowner) eigandi, pg_has_role(current_user, c.relowner, 'MEMBER') ma
    from pg_class c where c.oid in (to_regclass('storage.objects'), to_regclass('storage.buckets'))
),
nidurstodur (rod, flokkur, atridi, stada, gildi) as (
  -- 1. Útgáfa og hver keyrir
  select 100, '1 útgáfa', 'Postgres 15 eða nýrri',
         case when current_setting('server_version_num')::int >= 150000 then 'OK' else 'STOPP' end,
         version()
  union all
  select 101, '1 útgáfa', 'keyrt sem', case when current_user = 'postgres' then 'OK' else 'ATH' end,
         current_user || ' (flutningarnir eru keyrðir sem postgres)'

  -- 2. Viðbætur
  union all
  select 200, '2 viðbætur', 'föll viðbóta í public',
         case when not exists (select 1 from vidbaetur_foll) then 'OK'
              when exists (select 1 from vidbaetur_foll where anon or prosecdef) then 'STOPP' else 'ATH' end,
         coalesce((select count(*) || ' föll: ' || string_agg(distinct extname, ', ')
                     || '. Vörðurinn (atriði 4 og 5) telur þau með: færið viðbótina í schema extensions eða takið'
                     || ' rétt anon af áður en skref 3 er keyrt.'
                     from vidbaetur_foll having count(*) > 0), 'engin')
  union all
  select 201, '2 viðbætur', 'fall viðbótar í public: ' || v.heiti,
         case when v.anon or v.prosecdef then 'STOPP' else 'ATH' end,
         v.extname || case when v.anon then ', anon má kalla það' else '' end || case when v.prosecdef then ', security definer' else '' end
    from vidbaetur_foll v
  union all
  select 202, '2 viðbætur', 'viðbót ' || e.extname, 'UPPL', 'schema ' || e.extnamespace::regnamespace::text || ', útgáfa ' || e.extversion
    from pg_extension e where e.extname <> 'plpgsql'
  union all
  select 203, '2 viðbætur', 'extensions.digest og extensions.gen_random_bytes (pgcrypto)',
         case when to_regprocedure('extensions.digest(text,text)') is not null
               and to_regprocedure('extensions.gen_random_bytes(integer)') is not null then 'OK' else 'STOPP' end,
         'skref 1 og 3 kalla þau með schema nafni (vel_lyklar, vefform_lykill, postur_inn)'
  union all
  select 204, '2 viðbætur', 'net.http_post (pg_net)',
         case when to_regnamespace('net') is not null
               and exists (select 1 from pg_proc where proname = 'http_post' and pronamespace = to_regnamespace('net')) then 'OK' else 'STOPP' end,
         'vekja_postinn kallar net.http_post'

  -- 3. Rekstraraðili
  union all
  select 300, '3 rekstraraðili', 'notendur: tveir@tveir.is sem stjórnandi',
         case (select count(*) from public.notendur n where lower(n.netfang) = 'tveir@tveir.is' and n.hlutverk = 'admin')
              when 1 then 'OK' when 0 then 'STOPP' else 'ATH' end,
         coalesce((select string_agg(n.id::text || ' (' || n.hlutverk || ')', ', ' order by n.stofnad)
                     from public.notendur n where lower(n.netfang) = 'tveir@tveir.is'),
                  'engin lína: skref 1 setti rekstraradilar = [] og enginn kæmist í Rekstur')
  union all
  select 301, '3 rekstraraðili', 'notendur eftir hlutverki', 'UPPL',
         (select string_agg(x, ', ') from (
            select hlutverk || ': ' || count(*) || case when hlutverk = 'vidskiptavinur'
                     then ' (' || count(*) filter (where fyrirtaeki_id is null) || ' án fyrirtækis)' else '' end x
              from public.notendur group by hlutverk order by hlutverk) y)
  union all
  select 302, '3 rekstraraðili', 'auth.users án línu í notendur',
         case when (select count(*) from auth.users u where not exists (select 1 from public.notendur n where n.id = u.id)) = 0
              then 'OK' else 'ATH' end,
         (select count(*) from auth.users u where not exists (select 1 from public.notendur n where n.id = u.id))::text
         || ' (fá enga stofu í skrefi 1)'

  -- 4. Föll í public
  union all
  select 400, '4 föll', 'fjöldi falla í public', case when (select count(*) from foll) = (select count(*) from vaent) then 'OK' else 'ATH' end,
         (select count(*) from foll) || ' á live, ' || (select count(*) from vaent) || ' í repo'
  union all
  select 401, '4 föll', f.heiti,
         case when f.eigandi <> 'postgres' then 'STOPP'
              when v.heiti is null then 'STOPP'
              when v.heiti = 'rls_auto_enable()' then 'ATH'
              when f.fp = v.fp_a then 'OK'
              when f.fp = v.fp_b then 'ATH'
              else 'STOPP' end,
         case when f.eigandi <> 'postgres' then 'eigandi ' || f.eigandi || ': skref 3 og R3 geta ekki skipt því út. '
              else '' end
         || case when v.heiti is null then 'ekki í repo (vörðurinn í skrefi 3 skoðar það; bætið við repo eða fellið). '
                 when v.heiti = 'rls_auto_enable()' then 'Supabase fall, ekki borið saman. '
                 when f.fp = v.fp_a then 'eins og gagnagrunnur.sql. '
                 when f.fp = v.fp_b then 'eldri útgáfa B (flutningar í nafnaröð): skref 3 kemur í staðinn, R3 setur B aftur. '
                 else 'ANNAÐ en repo: berið saman, skref 3 skrifar yfir það. ' end
         || 'prosrc ' || f.fp || ', functiondef ' || f.fp_def
         || case when f.prosecdef then ', definer' else '' end || case when f.anon then ', anon' else '' end
         || case when v.heiti is not null and v.heiti <> 'rls_auto_enable()' and f.fp <> v.fp_a and f.fp is distinct from v.fp_b
                 then e'\n' || pg_get_functiondef(f.oid) else '' end
    from foll f left join vaent v on v.heiti = f.heiti
  union all
  select 402, '4 föll', v.heiti, 'STOPP', 'í repo en VANTAR á live'
    from vaent v where not exists (select 1 from foll f where f.heiti = v.heiti)

  -- 5. Geymslan
  union all
  select 500, '5 geymsla', 'eigandi ' || g.relname, case when g.ma then 'OK' else 'ATH' end,
         g.eigandi || case when g.ma then ': postgres má búa til og fella reglur'
           else ': postgres er ekki í hlutverkinu. Á Supabase leyfir supautils postgres samt að búa til og fella reglur á storage.objects'
             || ' (prófað á live 23. nóv 2026: create policy og drop policy í færslu sem var afturkölluð). Ef þetta er nýtt verkefni: prófið eins áður en skref 5 er keyrt' end
    from geymsla g
  union all
  select 501, '5 geymsla', 'má uppfæra storage.buckets (takmörk merki fötunnar í skrefi 5)',
         case when to_regclass('storage.buckets') is not null and has_table_privilege(current_user, 'storage.buckets', 'UPDATE') then 'OK' else 'STOPP' end, ''
  union all
  select 502, '5 geymsla', 'reglur á storage.objects',
         case when (select array_agg(policyname::text order by policyname) from pg_policies where schemaname = 'storage' and tablename = 'objects')
                   = (select array_agg(regla order by regla) from reglur_vaent) then 'OK' else 'ATH' end,
         coalesce((select string_agg(policyname || ' ' || cmd || ' ' || roles::text || ' ' || md5(coalesce(qual, '') || '|' || coalesce(with_check, '')), ', ' order by policyname)
                     from pg_policies where schemaname = 'storage' and tablename = 'objects'), 'engar')
  union all
  select 503, '5 geymsla', 'fötur vidhengi (lokuð) og merki (opin)',
         case when (select string_agg(id || ':' || public, ',' order by id) from storage.buckets where id in ('vidhengi', 'merki'))
                   = 'merki:true,vidhengi:false' then 'OK' else 'ATH' end,
         coalesce((select string_agg(id || ' public=' || public || ' limit=' || coalesce(file_size_limit::text, '-')
                                     || ' mime=' || coalesce(array_to_string(allowed_mime_types, ','), '-'), '; ' order by id)
                     from storage.buckets), 'engar')

  -- 6. Vault
  union all
  select 600, '6 vault', 'postgres: usage á vault, lesa, búa til, uppfæra og eyða',
         case when to_regnamespace('vault') is not null
               and has_schema_privilege(current_user, 'vault', 'USAGE')
               and has_table_privilege(current_user, 'vault.secrets', 'SELECT')
               and has_table_privilege(current_user, 'vault.secrets', 'DELETE')
               and has_table_privilege(current_user, 'vault.decrypted_secrets', 'SELECT')
               and exists (select 1 from pg_proc p where p.proname = 'create_secret' and p.pronamespace = to_regnamespace('vault')
                             and has_function_privilege(current_user, p.oid, 'EXECUTE'))
               and exists (select 1 from pg_proc p where p.proname = 'update_secret' and p.pronamespace = to_regnamespace('vault')
                             and has_function_privilege(current_user, p.oid, 'EXECUTE'))
              then 'OK' else 'STOPP' end,
         'vista_tengingu, eyda_tengingu, tenging_lykill og eyda_stofu_gogn eru í eigu postgres'
  union all
  select 601, '6 vault', 'leyndarmál tenginga til',
         case when (select count(*) from public.tengingar t where t.lykill_id is not null
                      and not exists (select 1 from vault.secrets s where s.id = t.lykill_id)) = 0 then 'OK' else 'ATH' end,
         (select count(*) from public.tengingar)::text || ' tengingar, '
         || (select count(*) from public.tengingar t where t.lykill_id is not null
               and not exists (select 1 from vault.secrets s where s.id = t.lykill_id))::text || ' án leyndarmáls, '
         || (select count(*) from vault.secrets s where s.name like 'glerhus\_tenging\_%')::text || ' leyndarmál glerhus_tenging_*'

  -- 7. Stillingar og skema
  union all
  select 700, '7 stillingar', 'stillingar_innri.' || k.lykill,
         case when exists (select 1 from public.stillingar_innri i where i.lykill = k.lykill and coalesce(i.gildi, '') <> '') then 'OK' else 'ATH' end,
         k.skyring || ' (gildið ekki sýnt)'
    from (values ('postur_lykill', 'lykill Tveir skriftarinnar: skref 1 skráir tætigildi hans í vel_lyklar'),
                 ('postur_vefkrokur', 'vefapp Tveir sem vekja_postinn kallar'),
                 ('afhending_notandi', 'afhending@tveir.is (afhending_ma_lesa)')) k (lykill, skyring)
  union all
  select 701, '7 stillingar', 'lyklar skrefs 1 ekki til', case when exists (select 1 from public.stillingar_innri
           where lykill in ('tveir_stofa', 'stofa_vara', 'skraning_opin', 'rekstraradilar')) then 'ATH' else 'OK' end,
         coalesce((select string_agg(lykill, ', ') from public.stillingar_innri
                    where lykill in ('tveir_stofa', 'stofa_vara', 'skraning_opin', 'rekstraradilar')), 'engir: skref 1 hefur ekki verið keyrt')
  union all
  select 702, '7 skema', 'afrit_20261123 ekki til (skref 0 ekki keyrt)', case when to_regnamespace('afrit_20261123') is null then 'OK' else 'ATH' end, ''
  union all
  select 703, '7 skema', 'public.stofur ekki til (skref 1 ekki keyrt)', case when to_regclass('public.stofur') is null then 'OK' else 'ATH' end, ''
  union all
  select 704, '7 skema', 'töflurnar 33 úr live-skema.md',
         case when (select array_agg(tablename::text order by tablename) from pg_tables where schemaname = 'public')
                   = (select array_agg(tafla order by tafla) from toflur_vaent) then 'OK' else 'ATH' end,
         coalesce('aukalega: ' || (select string_agg(tablename, ', ') from pg_tables t where schemaname = 'public'
                                     and not exists (select 1 from toflur_vaent v where v.tafla = t.tablename)), 'engin aukalega')
         || '; vantar: ' || coalesce((select string_agg(tafla, ', ') from toflur_vaent v
                                       where not exists (select 1 from pg_tables t where t.schemaname = 'public' and t.tablename = v.tafla)), 'engin')
  union all
  select 705, '7 skema', 'skorða ' || s.tafla || '.' || s.nafn,
         case when exists (select 1 from pg_constraint c where c.conrelid = to_regclass('public.' || s.tafla) and c.conname = s.nafn)
              then 'OK' else 'ATH' end,
         coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid = to_regclass('public.' || s.tafla) and c.conname = s.nafn),
                  'ekki til undir þessu nafni; til: ' || coalesce((select string_agg(c.conname || ' ' || pg_get_constraintdef(c.oid), '; ')
                     from pg_constraint c where c.conrelid = to_regclass('public.' || s.tafla) and c.contype in ('p', 'c')), 'ekkert'))
    from (values ('kerfisstillingar', 'kerfisstillingar_pkey'), ('kerfisstillingar', 'kerfisstillingar_lykill_check'),
                 ('kerfisstillingar', 'kerfisstillingar_check'), ('tengingar', 'tengingar_pkey'),
                 ('tengingar', 'tengingar_veita_check'), ('dagatal_atburdir', 'dagatal_atburdir_pkey')) s (tafla, nafn)
  union all
  select 706, '7 skema', 'RLS á öllum töflum í public',
         case when exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity)
              then 'STOPP' else 'OK' end,
         coalesce((select string_agg(c.relname, ', ') from pg_class c
                    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity), 'allar')
  union all
  select 707, '7 skema', 'engin tafla í supabase_realtime',
         case when exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime') then 'STOPP' else 'OK' end,
         coalesce((select string_agg(schemaname || '.' || tablename, ', ') from pg_publication_tables where pubname = 'supabase_realtime'), 'engin')
  union all
  select 708, '7 skema', 'gikkurinn nyr_notandi_trigger á auth.users',
         case when exists (select 1 from pg_trigger where tgrelid = to_regclass('auth.users') and tgname = 'nyr_notandi_trigger'
                             and tgfoid = to_regprocedure('public.nyr_notandi()')) then 'OK' else 'STOPP' end, ''
  union all
  select 709, '7 skema', 'gikkir í public', case when (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
            where not t.tgisinternal and c.relnamespace = 'public'::regnamespace) = 30 then 'OK' else 'ATH' end,
         (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
            where not t.tgisinternal and c.relnamespace = 'public'::regnamespace)::text || ' (30 í live-skema.md)'
  union all
  select 710, '7 skema', 'event trigger fyrir RLS á nýjum töflum', 'UPPL',
         coalesce((select string_agg(evtname || ' ' || evtevent || ' ' || evtfoid::regproc::text || ' ' || evtenabled::text, ', ') from pg_event_trigger), 'enginn')
  union all
  select 711, '7 skema', 'sjálfgefin réttindi á föllum í public', 'UPPL',
         coalesce((select string_agg(d.defaclrole::regrole::text || ': ' || array_to_string(d.defaclacl, ' '), '; ')
                     from pg_default_acl d where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'f'), 'engin')
  union all
  select 712, '7 skema', 'PostgREST schemas (authenticator)', 'UPPL',
         coalesce((select array_to_string(rolconfig, '; ') from pg_roles where rolname = 'authenticator'), 'engar stillingar á hlutverkinu')
         || ' (afrit_20261123 má aldrei vera í Exposed schemas)'
  union all
  select 713, '7 skema', 'færslur opnar lengur en 5 mínútur',
         case when exists (select 1 from pg_stat_activity where xact_start < now() - interval '5 minutes' and pid <> pg_backend_pid())
              then 'ATH' else 'OK' end,
         coalesce((select string_agg(coalesce(usename::text, '?') || ' ' || coalesce(application_name, '') || ' ' || state || ' síðan ' || xact_start::text, '; ')
                     from pg_stat_activity where xact_start < now() - interval '5 minutes' and pid <> pg_backend_pid()),
                  'engar (skref 5 bíður mest 5 sekúndur eftir læsingu)')

  -- 8. Fjöldi lína
  union all
  select 800, '8 fjöldi', t.tablename, 'UPPL',
         (xpath('/row/n/text()', query_to_xml(format('select count(*) n from public.%I', t.tablename), false, true, '')))[1]::text
    from pg_tables t where t.schemaname = 'public'
  union all
  select 801, '8 fjöldi', 'auth.users', 'UPPL', (select count(*) from auth.users)::text
  union all
  select 802, '8 fjöldi', 'storage.objects', 'UPPL',
         coalesce((select string_agg(bucket_id || ': ' || n, ', ') from (select bucket_id, count(*) n from storage.objects group by 1 order by 1) x), '0')
  union all
  select 803, '8 fjöldi', 'vault.secrets', 'UPPL', (select count(*) from vault.secrets)::text
)
select rod, flokkur, atridi, stada, gildi
  from nidurstodur
 order by rod, case stada when 'STOPP' then 0 when 'ATH' then 1 when 'OK' then 2 else 3 end, atridi;
