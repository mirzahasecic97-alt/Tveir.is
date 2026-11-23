-- ==========================================================================
-- Stofur, skref 3b: gömlu tengingafallin út (spec kafli 2, "Deploy between
-- step 3 and step 4").
--
-- Keyrt EFTIR að nýja profa-tengingu (og hinar Edge Functions) eru komnar út:
-- þær kalla tenging_lykill(p_stofa, p_veita) og
-- skra_tengingarprufu(p_stofa, p_veita, p_svar). Gamla live profa-tengingu kallar
-- tenging_lykill(p_veita) og skra_tengingarprufu(p_veita, p_svar), sem hverfa hér.
-- Prófið "Prófa aftur" á Stillingar > Tengingar strax á eftir.
--
-- Ein færsla. Má keyra aftur. Afturköllun: 2026-11-23-stofur-3-afturkalla.sql
-- (R3) býr umbúðirnar til aftur eins og þær voru fyrir skref 3. Að setja bara
-- umbúðirnar aftur: keyrið kafla 4 í 2026-11-23-stofur-3-foll.sql.
-- ==========================================================================

do $$
begin
  if to_regprocedure('public.tenging_lykill(uuid,text)') is null
     or to_regprocedure('public.skra_tengingarprufu(uuid,text,text)') is null then
    raise exception 'Skref 3 er ekki á: keyrið 2026-11-23-stofur-3-foll.sql fyrst (annars hverfa einu tengingaföllin).';
  end if;
end $$;

drop function if exists tenging_lykill(text);
drop function if exists skra_tengingarprufu(text, text);

notify pgrst, 'reload schema';

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

-- Það sem eftir er (á að vera tvær línur, báðar með p_stofa)
select p.oid::regprocedure::text fall from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname in ('tenging_lykill', 'skra_tengingarprufu')
 order by 1;
