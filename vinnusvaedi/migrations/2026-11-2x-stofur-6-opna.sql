-- ==========================================================================
-- Stofur, skref 6: lyklunum snúið og opnað (spec kafli 2 skref 6, kafli 5.4,
-- 5.5 og eigandaskref D og E í kafla 10).
--
-- Keyrt á undan fyrstu stofunni utan Tveir, sama kvöld og eigandinn setur upp
-- verkefnið Glerhúsið verk (skref D) og límir nýja lykilinn í Tveir skriftina
-- (skref E). Þangað til nýi lykillinn er kominn í Script Properties Tveir
-- skriftarinnar (LYKILL) hafnar gagnagrunnurinn köllum hennar.
--
--   1. Lykli Tveir skriftarinnar snúið: nýtt gildi á stillingar_innri.postur_lykill
--      og nýtt tætigildi á vel_lyklar "Tveir skrift". Bara í fyrstu keyrslu
--      (merkt með stillingar_innri.postur_lykill_snuid). Að snúa aftur: eyðið
--      þeirri línu og keyrið skrána aftur.
--   2. Lykill vélarinnar Glerhúsið verk (vel_lyklar, allar = true, umfang
--      postur_inn, postur_ut, skyrslur). Gildið birtist BARA í keyrslunni sem
--      býr hann til; aðeins tætigildið er geymt. Týnist hann: update vel_lyklar
--      set virkur = false where heiti = 'Glerhúsið verk'; og keyrið aftur.
--   3. verk_vefkrokur_lykill (sem gagnagrunnurinn sendir á doPost vélarinnar),
--      búinn til einu sinni.
--   4. verk_vefkrokur: /exec slóð vefapps vélarinnar (ekki leyndarmál). Fyrsta
--      keyrsla: v_vefkrokur tómt. Þegar eigandinn hefur sent slóðina (skref D4):
--      setjið hana í v_vefkrokur hér neðar í SQL Editor og keyrið aftur.
--   5. skraning_opin helst 'nei' (skráningar bíða samþykkis). Eigandinn opnar
--      á rekstrarsíðunni þegar T5 og T6 hafa staðist með profun-stofa.
--
-- Síðasta setningin sýnir gildin sem fara í Script Properties: afritið hvert
-- hólf beint þangað (aldrei í spjall, póst eða skrá). Engin leyndarmál eru í
-- þessari skrá; þau verða til þegar hún er keyrð.
--
-- Krefst skrefs 5 (veggirnir á, vörðurinn stenst). Ein færsla. Má keyra aftur.
-- Afturköllun: engin á skemanu eftir þetta skref. Ef eitthvað fer úrskeiðis:
--   update stofur set stada = 'lokud' where slug <> 'tveir';
-- og R5 (2026-11-23-stofur-5-afturkalla.sql) ef veggirnir eiga að fara af.
-- R5 neitar meðan aðrar stofur eiga gögn (stjórnendur Tveir sæju þau án
-- veggjanna) nema v_leyfa_gogn_annarra sé sett true í henni.
-- ==========================================================================

do $opna$
declare
  -- Slóð vefapps Glerhúsið verk (Deploy > Web app > /exec). Tómt í fyrstu keyrslu.
  v_vefkrokur text := '';
  v_tveir uuid := tveir_stofa();
  v_nyr text;
  v_stada text;
begin
  -- ---------------------------------------------------------------- forsendur
  if v_tveir is null then raise exception 'tveir_stofa vantar: keyrið skref 1 til 5 fyrst.'; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and policyname = 'stofa_vegg' and permissive = 'RESTRICTIVE') <> 30
     or exists (select 1 from stillingar_innri where lykill = 'stofa_vara')
     or not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'stofa_skrar') then
    raise exception 'Veggirnir (skref 5) eru ekki á: keyrið 2026-11-23-stofur-5-veggir.sql fyrst.';
  end if;

  -- ---------------------------------------------------------------- 1. lykill Tveir
  if not exists (select 1 from stillingar_innri where lykill = 'postur_lykill_snuid') then
    v_nyr := encode(extensions.gen_random_bytes(32), 'hex');
    update stillingar_innri set gildi = v_nyr where lykill = 'postur_lykill';
    if not found then raise exception 'stillingar_innri.postur_lykill vantar'; end if;
    update vel_lyklar set lykill_hash = extensions.digest(v_nyr, 'sha256')
     where heiti = 'Tveir skrift' and stofa_id = v_tveir and not allar;
    if not found then raise exception 'vel_lyklar vantar línuna Tveir skrift'; end if;
    insert into stillingar_innri (lykill, gildi) values ('postur_lykill_snuid', now()::text);
    raise notice 'Lykli Tveir skriftarinnar snúið. Setjið nýja gildið í LYKILL í Script Properties hennar (skref E).';
  end if;

  -- ---------------------------------------------------------------- 3. lykill vefkróks vélarinnar
  insert into stillingar_innri (lykill, gildi)
  values ('verk_vefkrokur_lykill', encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (lykill) do nothing;

  -- ---------------------------------------------------------------- 4. slóð vefapps vélarinnar
  v_vefkrokur := btrim(coalesce(v_vefkrokur, ''));
  if v_vefkrokur <> '' then
    if v_vefkrokur !~ '^https://script\.google\.com/(a/macros/[a-z0-9.-]+|macros)/s/[A-Za-z0-9_-]+/exec$' then
      raise exception 'Slóðin á að vera /exec slóð Google vefapps (https://script.google.com/.../exec), ekki %', v_vefkrokur;
    end if;
    insert into stillingar_innri (lykill, gildi) values ('verk_vefkrokur', v_vefkrokur)
    on conflict (lykill) do update set gildi = excluded.gildi;
  end if;

  -- ---------------------------------------------------------------- 5. skráning bíður samþykkis
  insert into stillingar_innri (lykill, gildi) values ('skraning_opin', 'nei') on conflict (lykill) do nothing;
  select gildi into v_stada from stillingar_innri where lykill = 'skraning_opin';
  if v_stada <> 'nei' then
    raise notice 'skraning_opin er %: skráningar fara beint í gegn án samþykkis.', v_stada;
  end if;
end $opna$;

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

-- 2. Lykill vélarinnar, búinn til bara ef enginn virkur er til (birtist einu sinni),
-- og gildin sem fara í Script Properties
with nyr as (
  select ny_vel_lykill('Glerhúsið verk', null, true, array['postur_inn', 'postur_ut', 'skyrslur']) lykill
   where not exists (select 1 from vel_lyklar where heiti = 'Glerhúsið verk' and allar and virkur)
)
select (select gildi from stillingar_innri where lykill = 'postur_lykill') as "Tveir skriftin: LYKILL",
       coalesce((select lykill from nyr), 'Þegar til: birtist bara þegar hann var búinn til') as "Glerhúsið verk: LYKILL",
       (select gildi from stillingar_innri where lykill = 'verk_vefkrokur_lykill') as "Glerhúsið verk: VEFKROKUR_LYKILL",
       coalesce((select gildi from stillingar_innri where lykill = 'verk_vefkrokur'),
                'Vantar: setjið /exec slóðina í v_vefkrokur og keyrið aftur') as verk_vefkrokur,
       (select gildi from stillingar_innri where lykill = 'skraning_opin') as skraning_opin;
