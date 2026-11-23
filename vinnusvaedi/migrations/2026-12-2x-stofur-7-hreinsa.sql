-- ==========================================================================
-- Stofur, skref 7: hreinsun, í fyrsta lagi 30 dögum eftir skref 0
-- (23. desember 2026). Spec kafli 2 skref 7.
--
--   1. Afritið afrit_20261123 fellt (gögn, reglur, föll og skyndimyndir
--      skrefa 3 og 5). Óafturkræft: flytjið fyrst út það sem á að geyma
--      (Table Editor > schema afrit_20261123 > Export > CSV) og breytið svo
--      v_eyda_afriti hér neðar í true. Annars stendur afritið og hitt er gert.
--      Eftir þetta gilda R1, R2 og R3 ekki lengur (þær lesa afritið); R5 virkar
--      áfram (merki_les fær þá skilgreininguna úr gagnagrunnur.sql).
--   2. Eins dálks erlendir lyklar sem samsettur lykill (stofa_id, dálkur) nær
--      alveg yfir felldir: sama foreldri, sömu aðgerðir og hvorug fossar eða
--      setur null (þeir sem fossa eða setja null halda eyðingarhegðuninni og
--      standa). Eftir skref 2 eru engir slíkir eftir, svo yfirleitt gerist ekkert.
--      Setningarnar sem búa þá til aftur eru skráðar í rekstur_log
--      (adgerd = 'skref7_lyklar').
--   3. Gamla línan stillingar_innri.postur_lykill felld, en bara ef ekkert fall
--      notar hana lengur (í dag sendir vekja_postinn hana á vefapp Tveir, svo
--      hún stendur þar til vefkrókur Tveir fær sinn eigin lykil).
--   4. Vörðurinn.
--
-- Krefst skrefs 5 (veggirnir á). Ein færsla. Má keyra aftur. Síðasta setningin
-- skilar stöðunni.
-- ==========================================================================

do $hreinsa$
declare
  -- Breytið í true þegar afritið hefur verið flutt út (eða þess er ekki óskað)
  v_eyda_afriti boolean := false;
  r record;
  v_endurgera text[] := '{}';
  t text;
begin
  -- Að fella lykil læsir töflunni og foreldrinu: gefst upp eftir 5 sekúndur í stað þess að stöðva umferð
  perform set_config('lock_timeout', '5s', true);

  -- ---------------------------------------------------------------- forsendur
  if current_date < date '2026-12-23' then
    raise exception 'Skref 7 er í fyrsta lagi 30 dögum eftir skref 0, 23. desember 2026 (í dag er %).', current_date;
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and policyname = 'stofa_vegg' and permissive = 'RESTRICTIVE') <> 30
     or exists (select 1 from stillingar_innri where lykill = 'stofa_vara') then
    raise exception 'Veggirnir (skref 5) eru ekki á: skref 7 bíður.';
  end if;
  if not exists (select 1 from stillingar_innri where lykill = 'postur_lykill_snuid')
     and not exists (select 1 from vel_lyklar where heiti = 'Glerhúsið verk') then
    raise notice 'Skref 6 virðist ekki keyrt (lyklinum ekki snúið, enginn lykill vélarinnar).';
  end if;

  -- ---------------------------------------------------------------- 1. afritið
  if to_regnamespace('afrit_20261123') is not null then
    if v_eyda_afriti then
      drop schema afrit_20261123 cascade;
      raise notice 'afrit_20261123 fellt.';
    else
      raise notice 'afrit_20261123 stendur (v_eyda_afriti er false).';
    end if;
  end if;

  -- ---------------------------------------------------------------- 2. eins dálks lyklar
  for r in
    select c.oid, c.conrelid::regclass::text tafla, c.conname, pg_get_constraintdef(c.oid) skilgreining
      from pg_constraint c
     where c.connamespace = 'public'::regnamespace and c.contype = 'f' and array_length(c.conkey, 1) = 1
       and c.confdeltype in ('a', 'r') and c.confupdtype in ('a', 'r')
       and exists (select 1 from pg_attribute a where a.attrelid = c.conrelid and a.attname = 'stofa_id' and a.attnotnull)
       and exists (select 1 from pg_constraint k
                    where k.conrelid = c.conrelid and k.contype = 'f' and k.confrelid = c.confrelid and k.convalidated
                      and array_length(k.conkey, 1) = 2
                      and k.conkey[1] = (select a.attnum from pg_attribute a where a.attrelid = c.conrelid and a.attname = 'stofa_id')
                      and k.conkey[2] = c.conkey[1]
                      and k.confkey[2] = c.confkey[1]
                      and k.confkey[1] = (select a.attnum from pg_attribute a where a.attrelid = c.confrelid and a.attname = 'stofa_id')
                      and k.confdeltype = c.confdeltype and k.confupdtype = c.confupdtype)
     order by 2, 3
  loop
    v_endurgera := v_endurgera || format('alter table %s add constraint %I %s;', r.tafla, r.conname, r.skilgreining);
    execute format('alter table %s drop constraint %I', r.tafla, r.conname);
  end loop;
  if coalesce(array_length(v_endurgera, 1), 0) > 0 then
    insert into rekstur_log (notandi, adgerd, stofa_id, gogn)
    values (null, 'skref7_lyklar', null, jsonb_build_object('endurgera', to_jsonb(v_endurgera)));
    raise notice 'Felldir lyklar (endurgerð í rekstur_log): %', array_to_string(v_endurgera, ' ');
  end if;

  -- ---------------------------------------------------------------- 3. gamli lykillinn
  select string_agg(p.oid::regprocedure::text, ', ' order by 1) into t
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosrc ~ 'postur_lykill\M';
  if t is not null then
    raise notice 'stillingar_innri.postur_lykill stendur: % les hana enn.', t;
  else
    delete from stillingar_innri where lykill = 'postur_lykill';
  end if;
end $hreinsa$;

-- VORDUR BYRJAR
do $kanna$
declare
  villur text[] := '{}';
  r record;
  t text;
  eftir5 boolean;
  -- Töflurnar 30 með stofa_id (kafli 1.4)
  stofutoflur text[] := array['athugasemdir', 'aukaverkefni', 'dagatal_atburdir', 'fundir', 'fyrirspurnir',
    'fyrirtaeki', 'innri_taskar', 'kerfisstillingar', 'maelingar', 'midla_faerslur', 'midlar', 'myndband_tolur',
    'myndbond', 'notendur', 'postholf_skilabod', 'postholf_svor', 'postholf_thraedir', 'samningar', 'skyrslur',
    'snid', 'snid_taskar', 'taskar', 'taxtar', 'tengingar', 'timar', 'tolfraedi_sendingar', 'undirverk',
    'verkefni', 'verkefni_innri', 'vidhengi'];
  -- Töflur án stofa_id (atriði 1)
  utan text[] := array['stofur', 'vel_lyklar', 'stillingar_innri', 'midlar_innri', 'undirskriftir', 'verk_netfong',
    'skraningar', 'oauth_stada', 'rekstur_log', 'notkun', 'postur_inn_log', 'bod', 'reikningsdrog'];
  -- Föll sem anon má kalla (atriði 4): lyklaföllin í kafla 5.2 og þrjú ný
  anon_leyft text[] := array['taskur_ur_posti', 'lokid_otilkynnt', 'merkja_tilkynnt', 'undirverk_otilkynnt',
    'merkja_undirverk_sent', 'midlar_til_soefnunar', 'skra_maelingar', 'skra_faerslur', 'manadar_tolur',
    'vista_skyrslu', 'skyrslur_til_sendingar', 'merkja_skyrslu_senda', 'tolfraedi_sendingar_til',
    'merkja_tolfraedi_sendingu', 'postholf_skra', 'postholf_svor_til', 'merkja_postholf_svar', 'dagatal_skra',
    'postur_inn', 'skra_fyrirspurn', 'afhending_slod_heimild'];
  -- Orð sem sýna að definer fall er bundið stofu (atriði 5); föllin sjálf teljast líka bundin
  ordfaeri text[] := array['min_stofa', 'tveir_stofa', 'stofa_heimild', 'er_admin', 'mitt_fyrirtaeki',
    'er_rekstraradili', 'p_stofa'];
  -- Yfirfarin definer föll sem nota ekkert orðanna (atriði 5)
  yfirfarin text[] := array['reikna_framvindu', 'myndband_ur_faerslu', 'tolu_gildi', 'rls_auto_enable',
    'er_fratekid_slug', 'afhending_ma_lesa', 'undirverk_skra_opin', 'notandi_til', 'utflutningur_stofu',
    'eyda_stofu_gogn', 'ny_vel_lykill', 'skra_notkun',
    'stofna_stofu',      -- service_role: býr stofuna til, á enga stofu fyrir
    'skra_fyrirspurn'];  -- anon: stofan kemur úr vefform_lykill, ekki frá þeim sem kallar
begin
  -- Skref 5 (veggirnir) er á ef einhver stofa_vegg regla er til eða varaleiðin stofa_vara er horfin
  eftir5 := exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'stofa_vegg')
            or not exists (select 1 from stillingar_innri where lykill = 'stofa_vara');

  -- 1. Grunntafla án NOT NULL stofa_id (notendur má vera null)
  for r in
    select c.relname from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
       and not (c.relname = any (utan))
       and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'stofa_id'
                        and not a.attisdropped and (a.attnotnull or c.relname = 'notendur'))
     order by 1
  loop
    villur := villur || format('1. %s: vantar stofa_id (not null)', r.relname);
  end loop;

  -- 2. (eftir skref 5) stofa_vegg sem RESTRICTIVE á öllum 30 töflunum
  if eftir5 then
    foreach t in array stofutoflur loop
      if not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t
                       and p.policyname = 'stofa_vegg' and p.permissive = 'RESTRICTIVE') then
        villur := villur || format('2. %s: vantar RESTRICTIVE regluna stofa_vegg', t);
      end if;
    end loop;
  end if;

  -- 3. Tafla án RLS
  for r in
    select c.relname from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
     order by 1
  loop
    villur := villur || format('3. %s: RLS er ekki á', r.relname);
  end loop;

  -- 4. Fall sem anon má kalla en er ekki á listanum. Gikkjaföll eru ekki talin:
  --    þau verða ekki kölluð beint og réttur til að keyra þau er ekki athugaður í gikk.
  for r in
    select p.oid::regprocedure::text heiti from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
       and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
       and has_function_privilege('anon', p.oid, 'execute')
       and not (p.proname = any (anon_leyft))
     order by 1
  loop
    villur := villur || format('4. %s: anon má kalla það', r.heiti);
  end loop;

  -- 5. Definer fall (ekki gikkur) sem nefnir ekkert orðanna og er ekki yfirfarið
  for r in
    select p.oid::regprocedure::text heiti from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prosecdef
       and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
       and not (p.proname = any (yfirfarin)) and not (p.proname = any (ordfaeri))
       and not exists (select 1 from unnest(ordfaeri) o where p.prosrc ~ ('\m' || o || '\M'))
     order by 1
  loop
    villur := villur || format('5. %s: security definer án stofu', r.heiti);
  end loop;

  -- 6. Engin tafla í Realtime án yfirferðar
  if (select count(*) from pg_publication_tables where pubname = 'supabase_realtime') > 0 then
    villur := villur || format('6. supabase_realtime: %s', (select string_agg(schemaname || '.' || tablename, ', ')
                                                           from pg_publication_tables where pubname = 'supabase_realtime'));
  end if;

  -- 7. (eftir skref 5) varaleiðin stofa_vara á að vera horfin
  if eftir5 and exists (select 1 from stillingar_innri where lykill = 'stofa_vara') then
    villur := villur || '7. stillingar_innri: stofa_vara er enn til'::text;
  end if;

  if coalesce(array_length(villur, 1), 0) > 0 then
    raise exception 'Vörðurinn stenst ekki (% atriði):%', array_length(villur, 1), e'\n' || array_to_string(villur, e'\n');
  end if;
  raise notice 'Vörðurinn stenst (%).', case when eftir5 then 'eftir skref 5' else 'fyrir skref 5' end;
end $kanna$;
-- VORDUR ENDAR

select to_regnamespace('afrit_20261123') is not null as afrit_stendur,
       (select count(*) from rekstur_log where adgerd = 'skref7_lyklar') as skrad_lyklar,
       exists (select 1 from stillingar_innri where lykill = 'postur_lykill') as postur_lykill_stendur;
