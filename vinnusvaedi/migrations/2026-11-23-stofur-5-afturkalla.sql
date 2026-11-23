-- ==========================================================================
-- Stofur, afturköllun R5: veggirnir af (tekur skref 5 til baka).
--
-- Fellir stofa_vegg á 30 töflunum og stofa_skrar í geymslunni, setur merki_les
-- og takmörk merki fötunnar aftur eins og þau voru rétt fyrir skref 5, og setur
-- varaleiðina stofa_vara aftur (Tveir). Staðan á undan kemur úr
-- afrit_20261123.skref5_* sem skref 5 skráði í fyrstu keyrslu; skyndimyndin er
-- felld í lokin svo næsta keyrsla skrefs 5 skrái hana upp á nýtt.
--
-- Virkar líka eftir skref 6 og 7 (þegar afritið er horfið): þá fær merki_les
-- skilgreininguna úr gagnagrunnur.sql (select fyrir public) og takmörk fötunnar
-- standa óbreytt (þau eru bara herðing).
--
-- Stöðvast og breytir engu meðan önnur stofa en Tveir er virk: án veggjanna
-- sæi stjórnandi Tveir gögn hennar og hún gögn Tveir. Lokið þeim fyrst:
--   update stofur set stada = 'lokud' where slug <> 'tveir';
-- Stöðvast líka meðan önnur stofa (líka lokuð eða bíðandi) á línur í töflunum 30:
-- lokun stöðvar bara notendur hennar, en án veggjanna sæju stjórnendur Tveir
-- línurnar og þær birtust í kerfi Tveir. Ef það er ásættanlegt (neyðartilvik):
-- setjið v_leyfa_gogn_annarra := true í kubbnum hér neðar og keyrið aftur.
--
-- Röð afturkallana: R5, R3, R2, R1. Ein færsla. Má keyra aftur (ef veggirnir
-- eru ekki á gerist ekkert). Kubburinn milli R5 BYRJAR og R5 ENDAR er orðrétt
-- sá sami og í prof-stofur.sql, og vörðurinn sá sami og í kanna-stofur.sql.
-- ==========================================================================

-- R5 BYRJAR
do $r5$
declare
  t text;
  r record;
  v_til boolean;
  v_rodd text;
  v_vara text;
  v_adrar text[] := '{}';
  v_slugs text[];
  -- Breytið í true BARA ef stjórnendur Tveir mega sjá gögn annarra stofa (sjá að neðan)
  v_leyfa_gogn_annarra boolean := false;
  -- Töflurnar 30 með stofa_id (kafli 1.4)
  toflur text[] := array['athugasemdir', 'aukaverkefni', 'dagatal_atburdir', 'fundir', 'fyrirspurnir',
    'fyrirtaeki', 'innri_taskar', 'kerfisstillingar', 'maelingar', 'midla_faerslur', 'midlar', 'myndband_tolur',
    'myndbond', 'notendur', 'postholf_skilabod', 'postholf_svor', 'postholf_thraedir', 'samningar', 'skyrslur',
    'snid', 'snid_taskar', 'taskar', 'taxtar', 'tengingar', 'timar', 'tolfraedi_sendingar', 'undirverk',
    'verkefni', 'verkefni_innri', 'vidhengi'];
begin
  v_til := to_regclass('afrit_20261123.skref5_reglur') is not null;
  if not v_til
     and not exists (select 1 from pg_policies where (schemaname = 'public' and policyname = 'stofa_vegg')
                                                 or (schemaname = 'storage' and policyname = 'stofa_skrar'))
     and exists (select 1 from public.stillingar_innri where lykill = 'stofa_vara') then
    raise notice 'Veggirnir (skref 5) eru ekki á. Engu breytt.';
    return;
  end if;

  -- ---------------------------------------------------------------- forsendur
  select string_agg(s.slug, ', ' order by s.slug) into t from public.stofur s where s.slug <> 'tveir' and s.stada = 'virk';
  if t is not null then
    raise exception 'Aðrar stofur en Tveir eru virkar (%): veggirnir fara ekki af meðan svo er. Lokið þeim fyrst: update stofur set stada = ''lokud'' where slug <> ''tveir'';', t;
  end if;
  -- Lokun stöðvar bara notendur hinna stofanna. Án veggjanna sér stjórnandi Tveir
  -- (er_admin) allar línur þeirra í öllum töflum og þær birtast í kerfi Tveir.
  -- Því neitar R5 meðan einhver önnur stofa á línur, nema v_leyfa_gogn_annarra sé true.
  if not v_leyfa_gogn_annarra then
    foreach t in array toflur loop
      execute format('select coalesce(array_agg(distinct s.slug), ''{}'') from public.%I x
                        join public.stofur s on s.id = x.stofa_id where s.slug <> ''tveir''', t) into v_slugs;
      v_adrar := v_adrar || v_slugs;
    end loop;
    if cardinality(v_adrar) > 0 then
      raise exception 'Aðrar stofur en Tveir eiga gögn (%): án veggjanna sæju stjórnendur Tveir þau. Engu breytt. Ef það er ásættanlegt: setjið v_leyfa_gogn_annarra := true efst í R5 og keyrið aftur.',
        (select string_agg(distinct x, ', ') from unnest(v_adrar) x);
    end if;
  end if;

  -- Einkalæsing á 30 töflum og storage.objects: gefst upp eftir 5 sekúndur í stað þess að stöðva umferð
  perform set_config('lock_timeout', '5s', true);

  -- ---------------------------------------------------------------- veggirnir
  foreach t in array toflur loop
    execute format('drop policy if exists stofa_vegg on public.%I', t);
  end loop;
  drop policy if exists stofa_skrar on storage.objects;

  -- ---------------------------------------------------------------- merki_les
  drop policy if exists merki_les on storage.objects;
  if v_til then
    -- Eins og hún var (eða engin, ef hún var ekki til)
    for r in execute 'select * from afrit_20261123.skref5_reglur
                       where schemaname = ''storage'' and tablename = ''objects'' and policyname = ''merki_les''' loop
      select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_rodd from unnest(r.roles) x;
      execute format('create policy merki_les on storage.objects as %s for %s to %s%s%s',
                     r.permissive, r.cmd, v_rodd,
                     case when r.qual is not null then ' using (' || r.qual || ')' else '' end,
                     case when r.with_check is not null then ' with check (' || r.with_check || ')' else '' end);
    end loop;
  else
    create policy merki_les on storage.objects for select to public using (bucket_id = 'merki');
  end if;

  -- ---------------------------------------------------------------- fötur
  if v_til then
    execute 'update storage.buckets b set file_size_limit = f.file_size_limit, allowed_mime_types = f.allowed_mime_types
               from afrit_20261123.skref5_fotur f where b.id = f.id';
  else
    raise notice 'Engin skyndimynd: takmörk merki fötunnar látin standa.';
  end if;

  -- ---------------------------------------------------------------- stofa_vara
  if v_til then
    execute 'select gildi from afrit_20261123.skref5_stillingar where lykill = ''stofa_vara''' into v_vara;
  end if;
  insert into public.stillingar_innri (lykill, gildi)
  values ('stofa_vara', coalesce(v_vara, (select gildi from public.stillingar_innri where lykill = 'tveir_stofa')))
  on conflict (lykill) do nothing;
  if not exists (select 1 from public.stillingar_innri where lykill = 'stofa_vara' and gildi is not null) then
    raise exception 'stofa_vara fannst ekki (tveir_stofa vantar í stillingar_innri)';
  end if;

  -- ---------------------------------------------------------------- skyndimyndin út
  if v_til then
    drop table afrit_20261123.skref5_reglur, afrit_20261123.skref5_fotur, afrit_20261123.skref5_stillingar;
  end if;
end $r5$;
-- R5 ENDAR

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

-- Staðan: 0 veggir, engin stofa_skrar, merki_les eins og fyrir skref 5, stofa_vara aftur
select (select count(*) from pg_policies where schemaname = 'public' and policyname = 'stofa_vegg') veggir,
       exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'stofa_skrar') stofa_skrar,
       (select roles::text from pg_policies where schemaname = 'storage' and tablename = 'objects'
          and policyname = 'merki_les') merki_les,
       (select coalesce(file_size_limit::text, 'engin') || ' ' || coalesce(array_to_string(allowed_mime_types, ','), 'engar')
          from storage.buckets where id = 'merki') merki_fatan,
       exists (select 1 from stillingar_innri where lykill = 'stofa_vara') stofa_vara;
