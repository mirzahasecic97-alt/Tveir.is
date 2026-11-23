-- ==========================================================================
-- Stofur, skref 5: veggirnir (spec kafli 2 skref 5, kafli 3.1 og kafli 4).
--
-- Einangrun stofa. Ein RESTRICTIVE regla, stofa_vegg, á hverri af 30 töflunum
-- með stofa_id. Postgres setur hana saman (AND) við reglurnar sem eru fyrir, og
-- þær eru óbreyttar: er_admin() verður "stjórnandi í minni stofu" án þess að
-- endurskrifa um 60 reglur. notendur fær vegg sem sýnir alltaf eigin línu.
-- Í geymslunni: RESTRICTIVE reglan stofa_skrar, merki_les bara fyrir innskráða
-- (fatan er áfram opin, opinberar slóðir þurfa enga reglu) og takmörk á merki
-- fötunni (png, jpeg, webp, mest 2 MB). Varaleiðin stofa_vara hverfur: lína sem
-- fær ekki stofu frá foreldri, innskráðum notanda eða definer falli er stöðvuð.
-- Eina undantekningin: fyrirspurn sem þjónustan (service_role: Make, stofna-stofu)
-- skráir án stofa_id fer til Tveir (erfa_stofu, regla d). SQL Editor verður því að
-- gefa stofa_id í innsetningu héðan í frá. Nýr notandi án boðs fær enga stofu
-- (frá skrefi 3, nyr_notandi).
--
-- WITH CHECK keyrir á eftir BEFORE gikkjunum (zstofa_*): innsetning án stofa_id
-- gengur, innsetning sem vísar í foreldri annarrar stofu er stöðvuð. Notandi sem
-- á enga stofu, eða lokaða eða bíðandi, sér ekkert nema eigin notendalínu.
--
-- Á undan: skref 0, 1, 2, 3 (og 3b) og prof-stofur.sql (skref 4) sem stóðst á live.
-- Keyrt sem postgres í SQL Editor, ein færsla, á kvöldin. Má keyra aftur.
-- Fyrsta keyrsla skráir stöðuna á undan í afrit_20261123.skref5_* (merki_les,
-- takmörk fatnanna, stofa_vara) svo afturköllunin skili henni nákvæmlega.
-- Afturköllun: 2026-11-23-stofur-5-afturkalla.sql (tekur sekúndu).
--
-- Á eftir: T1 sem stjórnandi Tveir og sem viðskiptavinur Tveir, og prof-stofur.sql
-- aftur (nú á móti raunverulegu veggjunum). Síðasta setningin skilar stöðunni.
--
-- Kubburinn milli VEGGIR BYRJA og VEGGIR ENDA er orðrétt sá sami og í
-- prof-stofur.sql, og vörðurinn sá sami og í kanna-stofur.sql.
-- ==========================================================================

-- VEGGIR BYRJA
do $veggir$
declare
  t text;
  -- Töflurnar 30 með stofa_id (kafli 1.4) nema notendur, sem fær sinn eigin vegg
  toflur text[] := array['athugasemdir', 'aukaverkefni', 'dagatal_atburdir', 'fundir', 'fyrirspurnir',
    'fyrirtaeki', 'innri_taskar', 'kerfisstillingar', 'maelingar', 'midla_faerslur', 'midlar', 'myndband_tolur',
    'myndbond', 'postholf_skilabod', 'postholf_svor', 'postholf_thraedir', 'samningar', 'skyrslur',
    'snid', 'snid_taskar', 'taskar', 'taxtar', 'tengingar', 'timar', 'tolfraedi_sendingar', 'undirverk',
    'verkefni', 'verkefni_innri', 'vidhengi'];
begin
  -- Reglurnar þurfa einkalæsingu á 30 töflum og storage.objects. Ef löng fyrirspurn
  -- heldur læsingu biðu allar beiðnir Tveir (líka skrár) í röð á eftir þessari færslu.
  -- Í staðinn gefst hún upp eftir 5 sekúndur, engu er breytt og má keyra aftur.
  perform set_config('lock_timeout', '5s', true);

  -- ---------------------------------------------------------------- forsendur
  if to_regclass('public.stofur') is null or to_regprocedure('public.min_stofa()') is null then
    raise exception 'Keyrið 2026-11-23-stofur-1-grunnur.sql fyrst.';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.taskar'::regclass
                   and conname = 'taskar_fyrirtaeki_id_stofa_fk' and convalidated) then
    raise exception 'Keyrið 2026-11-23-stofur-2-lyklar.sql fyrst.';
  end if;
  -- Skref 3: er_admin og mitt_fyrirtaeki krefjast virkrar stofu, og föllin sem bara það skref býr til
  if to_regprocedure('public.stofa_blokk(uuid)') is null
     or to_regprocedure('public.postur_inn(text,text,text,text,text,text,text,boolean,text)') is null
     or (select prosrc from pg_proc where oid = 'public.er_admin()'::regprocedure) !~ 'stada' then
    raise exception 'Keyrið 2026-11-23-stofur-3-foll.sql fyrst.';
  end if;

  -- ---------------------------------------------------------------- skyndimynd
  -- Staðan á undan, bara í fyrstu keyrslu (afturköllunin fellir hana)
  if to_regnamespace('afrit_20261123') is not null and to_regclass('afrit_20261123.skref5_reglur') is null then
    create table afrit_20261123.skref5_reglur as
      select * from pg_policies
       where (schemaname = 'storage' and tablename = 'objects' and policyname in ('merki_les', 'stofa_skrar'))
          or (schemaname = 'public' and policyname = 'stofa_vegg');
    create table afrit_20261123.skref5_fotur as
      select id, public, file_size_limit, allowed_mime_types from storage.buckets where id in ('merki', 'vidhengi');
    create table afrit_20261123.skref5_stillingar as
      select lykill, gildi from public.stillingar_innri where lykill = 'stofa_vara';
    revoke all on afrit_20261123.skref5_reglur, afrit_20261123.skref5_fotur, afrit_20261123.skref5_stillingar
      from public, anon, authenticated, service_role;
  end if;

  -- ---------------------------------------------------------------- veggirnir
  foreach t in array toflur loop
    execute format('drop policy if exists stofa_vegg on public.%I', t);
    execute format('create policy stofa_vegg on public.%I as restrictive for all to authenticated
                      using (stofa_id = (select min_stofa()))
                      with check (stofa_id = (select min_stofa()))', t);
  end loop;
  -- notendur: eigin lína alltaf sýnileg (líka án stofu eða í lokaðri stofu).
  -- Hér eru föllin kölluð beint, ekki sem (select ...): reglan not_eigid er með
  -- undirfyrirspurn á notendur, og ef veggur notenda er líka með undirfyrirspurn
  -- stöðvar Postgres hverja uppfærslu á notendur með "infinite recursion detected
  -- in policy". notendur er lítil tafla, svo kall á hverja línu skiptir engu.
  drop policy if exists stofa_vegg on public.notendur;
  create policy stofa_vegg on public.notendur as restrictive for all to authenticated
    using (stofa_id = min_stofa() or id = auth.uid())
    with check (stofa_id = min_stofa() or id = auth.uid());

  -- ---------------------------------------------------------------- geymslan (kafli 4)
  -- Möppur fyrirtækja minnar stofu og stofa-<mín stofa>; afhending@tveir.is les áfram skrár Tveir
  drop policy if exists stofa_skrar on storage.objects;
  create policy stofa_skrar on storage.objects as restrictive for all to authenticated
    using (
      bucket_id not in ('vidhengi', 'merki')
      or fyrirtaeki_i_stofu((storage.foldername(name))[1])
      or (storage.foldername(name))[1] = 'stofa-' || (select min_stofa())::text
      or (bucket_id = 'vidhengi' and afhending_ma_lesa(name))
    )
    with check (
      bucket_id not in ('vidhengi', 'merki')
      or fyrirtaeki_i_stofu((storage.foldername(name))[1])
      or ((storage.foldername(name))[1] = 'stofa-' || (select min_stofa())::text and (select er_admin()))
    );

  -- Fatan er áfram opin (opinberar slóðir þurfa enga reglu); listun krefst innskráningar og veggjarins
  drop policy if exists merki_les on storage.objects;
  create policy merki_les on storage.objects for select to authenticated
    using (bucket_id = 'merki');

  update storage.buckets
     set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'],
         file_size_limit = 2097152
   where id = 'merki';

  -- ---------------------------------------------------------------- varaleiðin hverfur
  delete from public.stillingar_innri where lykill = 'stofa_vara';
end $veggir$;
-- VEGGIR ENDA

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

-- Staðan: 30 veggir, stofa_skrar, merki_les fyrir innskráða, takmörk merki fötunnar,
-- stofa_vara horfin og notendur án stofu (0 í dag; þeir sjá bara eigin línu eftir þetta)
select (select count(*) from pg_policies where schemaname = 'public' and policyname = 'stofa_vegg'
          and permissive = 'RESTRICTIVE') veggir,
       exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'stofa_skrar' and permissive = 'RESTRICTIVE') stofa_skrar,
       (select roles::text from pg_policies where schemaname = 'storage' and tablename = 'objects'
          and policyname = 'merki_les') merki_les,
       (select file_size_limit || ' ' || array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'merki') merki_fatan,
       not exists (select 1 from stillingar_innri where lykill = 'stofa_vara') stofa_vara_horfin,
       (select count(*) from notendur where stofa_id is null) notendur_an_stofu;
