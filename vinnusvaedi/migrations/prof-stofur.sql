-- ==========================================================================
-- prof-stofur.sql: einangrunarprófið með annarri stofu (spec kafli 2 skref 4
-- og kafli 11.3, T2). Ekkert situr eftir.
--
-- Keyrt á live í SQL Editor (New query > líma > Run) sem postgres:
--   * skref 4: eftir skref 3 (og 3b), á undan skrefi 5. Prófið setur veggi
--     skrefs 5 á innan sinnar færslu (orðrétt kubburinn úr
--     2026-11-23-stofur-5-veggir.sql), prófar, keyrir afturköllun R5 (orðrétt
--     kubburinn úr 2026-11-23-stofur-5-afturkalla.sql) og ber reglurnar saman
--     við afrit_20261123.reglur.
--   * eftir skref 5, og eftir hvern flutning hér eftir: sama skrá. Þá eru
--     veggirnir á live prófaðir; prófið staðfestir fyrst að þeir séu nákvæmlega
--     þeir sem skref 5 skilgreinir.
--
-- Allt prófið er EITT do kubbur sem endar ALLTAF á villu, svo færslan er
-- afturkölluð og læsingar losna strax, hvað sem gerist (engin opin færsla eftir
-- í SQL Editor). Niðurstaðan er villuboðin:
--   PROF-STOFUR STÓÐST: <fjöldi> fullyrðingar ...   allt í lagi, ekkert vistað
--   PROF-STOFUR FALL: <atriði>                       eitthvað er að, ekkert vistað
-- Önnur villa (til dæmis setningafræði) þýðir líka að ekkert var vistað.
--
-- Hvað er búið til (allt afturkallað): stofan profun með stofna_stofu, tvö
-- fyrirtæki, þrír notendur í auth.users (stjórnandi B og viðskiptavinur B með
-- boði, U án boðs), lína í hverri af 30 töflunum, skrár í geymslunni (bara
-- línur í storage.objects), lykill Tveir og lykill vélarinnar (ny_vel_lykill),
-- Verkpóstur í gegnum postur_inn. Engum pósti er hleypt út: net.http_post
-- skráir köll í biðröð sem er afturkölluð með færslunni.
--
-- Leikendur: stjórnandi B, viðskiptavinur B, U (engin stofa), stjórnandi og
-- viðskiptavinur Tveir (fundnir í gögnunum), anon, service_role og
-- rekstraraðili. Hvert fall sem anon, authenticated eða service_role má kalla
-- er prófað; nýtt fall stöðvar prófið þar til það er sett í listann v_profud.
--
-- Hlutverk eru sett með set local role og request.jwt.claims (eins og
-- PostgREST gerir), ekkert úr schema prof (það er bara í æfingunni).
-- Engin þankastrik (em eða en) í texta.
-- ==========================================================================

-- Hjálparföll í pg_temp (bara þessi lota, aldrei í public)
create or replace function pg_temp.sem(p_uid uuid, p_hlutverk text default 'authenticated') returns void
language plpgsql as $f$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', p_hlutverk, 'aud', p_hlutverk,
                      'email', (select u.email from auth.users u where u.id = p_uid))::text, true);
  execute format('set local role %I', p_hlutverk);
end $f$;

create or replace function pg_temp.haetta() returns void
language plpgsql as $f$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $f$;

create or replace function pg_temp.buast(p_skilyrdi boolean, p_texti text) returns void
language plpgsql as $f$
begin
  if p_skilyrdi is distinct from true then
    raise exception 'PROF-STOFUR FALL: %', p_texti;
  end if;
  perform set_config('prof_stofur.fjoldi',
    (coalesce(nullif(current_setting('prof_stofur.fjoldi', true), ''), '0')::int + 1)::text, true);
  raise notice 'OK %', p_texti;
end $f$;

-- Setning sem á að mistakast. Villa í prófinu sjálfu (setningafræði, óþekkt nafn) stöðvar það.
create or replace function pg_temp.hafnad(p_sql text, p_texti text) returns text
language plpgsql as $f$
declare k text; v text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics k = returned_sqlstate, v = message_text;
    if k in ('42601', '42703', '42P01', '42883', '42P02', '42702', '42725') then
      raise exception 'PROF-STOFUR FALL: % (villa í prófinu sjálfu: % %)', p_texti, k, v;
    end if;
    perform pg_temp.buast(true, p_texti || ' [' || k || ': ' || left(v, 100) || ']');
    return k || ': ' || v;
  end;
  raise exception 'PROF-STOFUR FALL: % (átti að mistakast en gekk)', p_texti;
end $f$;

create or replace function pg_temp.radir(p_sql text) returns bigint
language plpgsql as $f$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $f$;

create or replace function pg_temp.tala(p_sql text) returns bigint
language plpgsql as $f$
declare n bigint;
begin
  execute p_sql into n;
  return n;
end $f$;

-- Fjöldi lína sem sá sem kallar sér í hverjum hlut (-1 = enginn aðgangur).
-- p_stofa: bara línur þeirrar stofu (hlutir með stofa_id). p_utan: möppur í
-- geymslunni sem eru ekki taldar (fyrirtæki og stofa-<id> annarra stofa).
create or replace function pg_temp.talning(p_hlutir text[], p_stofa uuid default null, p_utan text[] default null)
returns jsonb language plpgsql as $f$
declare h text; q text; n bigint; ut jsonb := '{}'::jsonb;
begin
  foreach h in array p_hlutir loop
    q := 'select count(*) from ' || h;
    if h = 'storage.objects' then
      q := q || ' where bucket_id in (''vidhengi'', ''merki'')';
      if p_utan is not null then
        q := q || ' and not coalesce((storage.foldername(name))[1] = any ($2), false)';
      end if;
    elsif p_stofa is not null and exists (select 1 from pg_attribute a where a.attrelid = to_regclass(h)
                                           and a.attname = 'stofa_id' and not a.attisdropped) then
      q := q || ' where stofa_id = $1';
    end if;
    begin
      execute q into n using p_stofa, p_utan;
    exception when insufficient_privilege then
      n := -1;
    end;
    ut := ut || jsonb_build_object(h, n);
  end loop;
  return ut;
end $f$;

-- Fingrafar af línum einnar stofu í hverri töflu
create or replace function pg_temp.fingur(p_toflur text[], p_stofa uuid) returns jsonb
language plpgsql as $f$
declare t text; v text; ut jsonb := '{}'::jsonb;
begin
  foreach t in array p_toflur loop
    execute format('select md5(coalesce(string_agg(x, ''|'' order by x), '''')) from (select to_jsonb(r)::text x from public.%I r where r.stofa_id = $1) y', t)
       into v using p_stofa;
    ut := ut || jsonb_build_object(t, v);
  end loop;
  return ut;
end $f$;

-- Munur á tveimur talningum, sem texti (null ef enginn)
create or replace function pg_temp.munur(a jsonb, b jsonb) returns text
language sql as $f$
  select string_agg(k || ' ' || coalesce(a ->> k, '?') || ' > ' || coalesce(b ->> k, '?'), ', ' order by k)
    from (select jsonb_object_keys(a) k union select jsonb_object_keys(b)) x
   where (a ->> k) is distinct from (b ->> k)
$f$;

do $prof$
declare
  -- Orðrétt úr 2026-11-23-stofur-5-veggir.sql
  v_veggir text := $prof_veggir$
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
$prof_veggir$;
  -- Orðrétt úr 2026-11-23-stofur-5-afturkalla.sql
  v_r5 text := $prof_r5$
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
$prof_r5$;
  -- Orðrétt úr kanna-stofur.sql
  v_vordur text := $prof_vordur$
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
$prof_vordur$;

  v_toflur text[] := array['athugasemdir', 'aukaverkefni', 'dagatal_atburdir', 'fundir', 'fyrirspurnir',
    'fyrirtaeki', 'innri_taskar', 'kerfisstillingar', 'maelingar', 'midla_faerslur', 'midlar', 'myndband_tolur',
    'myndbond', 'notendur', 'postholf_skilabod', 'postholf_svor', 'postholf_thraedir', 'samningar', 'skyrslur',
    'snid', 'snid_taskar', 'taskar', 'taxtar', 'tengingar', 'timar', 'tolfraedi_sendingar', 'undirverk',
    'verkefni', 'verkefni_innri', 'vidhengi'];
  v_skodanir text[] := array['public.bidur_vidskiptavina', 'public.olokid_rukkun', 'public.okkar_a_eftir',
    'public.fyrirspurnir_osvaradar'];
  v_nyjar text[] := array['public.stofur', 'public.verk_netfong', 'public.bod', 'public.reikningsdrog',
    'public.postur_inn_log', 'public.notkun'];
  v_lokadar text[] := array['public.vel_lyklar', 'public.skraningar', 'public.oauth_stada', 'public.rekstur_log'];
  v_hlutir text[];
  v_hlutir30 text[];

  -- Hvert fall sem anon, authenticated eða service_role má kalla, og þar með prófað hér
  v_profud text[] := array[
    'afhending_ma_lesa(text)', 'afhending_slod_heimild(text, uuid)',
    'dagatal_skra(text, jsonb, timestamp with time zone, timestamp with time zone)',
    'er_admin()', 'er_fratekid_slug(text)', 'er_rekstraradili()', 'eyda_stofu_gogn(uuid)', 'eyda_tengingu(text)',
    'fyrirtaeki_i_stofu(text)', 'loka_stofu(text, text)', 'lokid_otilkynnt(text)', 'manadar_tolur(text, date)',
    'merkja_postholf_svar(text, uuid, text)', 'merkja_skyrslu_senda(text, uuid[])', 'merkja_tilkynnt(text, uuid[])',
    'merkja_tolfraedi_sendingu(text, uuid, text)', 'merkja_undirverk_sent(text, uuid[])', 'midlar_til_soefnunar(text)',
    'min_stada()', 'min_stofa()', 'mitt_fyrirtaeki()', 'myndband_ur_faerslu(uuid, uuid)', 'notandi_til(text)',
    'opna_stofu(text)', 'postholf_lykill_ok(text)', 'postholf_skra(text, jsonb, timestamp with time zone)',
    'postholf_svor_til(text)', 'postur_inn(text, text, text, text, text, text, text, boolean, text)',
    'postur_ut(text, boolean)', 'reikna_framvindu(uuid)', 'samthykkja_stofu(text)',
    'skra_bod(uuid, text, text, text, uuid, uuid, boolean)', 'skra_faerslur(text, jsonb)', 'skra_fyrirspurn(text, jsonb)',
    'skra_maelingar(text, jsonb)', 'skra_notkun(uuid, text, integer, bigint, bigint)', 'skra_tengingarprufu(text, text)',
    'skra_tokn(uuid, text, bigint, bigint)',
    'skra_tengingarprufu(uuid, text, text)', 'skyrslur_til_sendingar(text)', 'stilla_skraningu(boolean)',
    'stofna_stofu(text, text, text, text, jsonb, text, text)', 'stofur_yfirlit()',
    'taskur_ur_posti(text, text, text, text, text)', 'tenging_lykill(text)', 'tenging_lykill(uuid, text)',
    'tengingar_stada()', 'tengja_notanda_stofu(uuid, uuid, text, uuid)', 'tolfraedi_sendingar_til(text)',
    'tolu_gildi(text)', 'tveir_stofa()', 'undirverk_otilkynnt(text)', 'undirverk_skra_opin(text)', 'utflutningur_stofu(uuid)',
    'verk_ur_thraedi(text, uuid)', 'vista_oauth_tengingu(uuid, text, jsonb, jsonb)',
    'vista_skyrslu(text, uuid, date, jsonb, text)', 'vista_tengingu(text, jsonb, jsonb)'];

  v_tveir uuid; v_profun uuid;
  -- Tveir (úr gögnunum)
  v_admin_t uuid; v_klient_t uuid; v_f_t uuid; v_task_t uuid; v_verk_t uuid; v_thradur_t text; v_midill_t uuid;
  v_faersla_t uuid; v_svar_t uuid; v_sending_t uuid; v_undirverk_t uuid; v_slod_t text; v_snid_t uuid;
  v_myndband_t uuid; v_netfang_admin_t text; v_netfang_klient_t text; v_rekstur_t boolean;
  v_lokid_t uuid[]; v_undirverk_t_oll uuid[]; v_samth_t uuid[];
  -- profun
  v_admin_b uuid; v_klient_b uuid; v_u uuid; v_f_b uuid; v_f_b2 uuid; v_verk_b uuid; v_verk_b_lokid uuid;
  v_task_b uuid; v_task_b_lokid uuid; v_task_b2 uuid; v_undirverk_b uuid; v_slod_b text; v_midill_b uuid;
  v_faersla_b uuid; v_myndband_b uuid; v_skyrsla_b_send uuid; v_skyrsla_b_samth uuid; v_sending_b uuid;
  v_svar_b uuid; v_thradur_b text; v_form_b text; v_moppur_b text[];
  -- lyklar (búnir til hér, afturkallaðir með færslunni)
  v_tk text; v_vk text; v_rk text;
  -- grunnur
  v_fingur jsonb; v_teng_t text; v_gjald_t text; v_utan text[];
  v_grunnur_admin jsonb; v_grunnur_klient jsonb; v_profun_fjoldi jsonb; v_teng_b jsonb;
  v_veggur_var boolean; v_veggur_fyrir text; v_veggur_eftir text; v_r5_merki text; v_r5_fotur text;
  v_merki text := md5(random()::text);
  -- vinnubreytur
  t text; t2 text; n bigint; n2 bigint; n3 bigint; j jsonb; j2 jsonb; j3 jsonb; j4 jsonb; j5 jsonb; j6 jsonb;
  j7 jsonb; j8 jsonb; j9 jsonb; j10 jsonb; j11 jsonb; j12 jsonb; j13 jsonb; b boolean; b2 boolean; u uuid; u2 uuid; s text; r record;
  v_villur text[];
begin
  perform set_config('prof_stofur.fjoldi', '0', true);
  -- Prófið tekur einkalæsingu á 30 töflum og storage.objects (reglur felldar og settar):
  -- gefst upp eftir 5 sekúndur í stað þess að láta beiðnir Tveir bíða í röð.
  perform set_config('lock_timeout', '5s', true);
  -- Supabase geymslan getur hafnað "delete from storage.objects" beint í SQL (gikkur
  -- sem vísar á Storage API). 5.46 prófar að RLS eyði engu utan profun, svo þeirri
  -- vörn er vikið til hliðar í þessari færslu einni (hún er alltaf afturkölluð).
  perform set_config('storage.allow_delete_query', 'true', true);
  v_hlutir30 :=array(select 'public.' || x from unnest(v_toflur) x);
  v_hlutir := v_hlutir30 || v_skodanir || v_nyjar
              || array['public.undirskriftir', 'public.stillingar_innri', 'public.midlar_innri'] || v_lokadar
              || array['storage.objects'];

  -- ======================================================================
  -- 0. Forsendur og föllin
  -- ======================================================================
  if to_regprocedure('public.stofna_stofu(text,text,text,text,jsonb,text,text)') is null
     or to_regprocedure('public.stofa_blokk(uuid)') is null then
    raise exception 'PROF-STOFUR FALL: skref 3 er ekki á (keyrið 2026-11-23-stofur-3-foll.sql fyrst)';
  end if;
  if exists (select 1 from stofur where slug = 'profun')
     or exists (select 1 from auth.users where lower(email) in ('admin-b@profun.example', 'klient-b@profun.example',
                                                                 'u-otengdur@profun.example', 'nyr@profun.example')) then
    raise exception 'PROF-STOFUR FALL: stofan profun eða prófnotandi er þegar til';
  end if;
  v_tveir := tveir_stofa();
  perform pg_temp.buast(v_tveir is not null and exists (select 1 from stofur where id = v_tveir and slug = 'tveir' and stada = 'virk'),
                        '0.1 stofan Tveir er til og virk');

  select string_agg(x, ', ' order by x) into t from (
    select p.proname || '(' || oidvectortypes(p.proargtypes) || ')' x from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
       and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
       and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
            or has_function_privilege('service_role', p.oid, 'execute'))) y
   where not (x = any (v_profud));
  perform pg_temp.buast(t is null, '0.2 hvert fall sem anon, authenticated eða service_role má kalla er prófað hér'
                                   || coalesce(' (ekki prófað: ' || t || ')', ''));

  -- Leikendur og línur Tveir
  select n.id, n.netfang into v_admin_t, v_netfang_admin_t from notendur n
   where n.stofa_id = v_tveir and n.hlutverk = 'admin'
   order by (n.id::text in (select jsonb_array_elements_text(i.gildi::jsonb) from stillingar_innri i where i.lykill = 'rekstraradilar')) desc,
            n.stofnad, n.id
   limit 1;
  perform pg_temp.buast(v_admin_t is not null, '0.3 stjórnandi í Tveir fannst');
  v_rekstur_t := v_admin_t::text in (select jsonb_array_elements_text(i.gildi::jsonb) from stillingar_innri i where i.lykill = 'rekstraradilar');
  select n.id, n.fyrirtaeki_id, n.netfang into v_klient_t, v_f_t, v_netfang_klient_t from notendur n
   where n.stofa_id = v_tveir and n.hlutverk = 'vidskiptavinur' and n.fyrirtaeki_id is not null
     and n.id::text is distinct from (select gildi from stillingar_innri where lykill = 'afhending_notandi')
   order by n.stofnad, n.id limit 1;
  if v_f_t is null then select f.id into v_f_t from fyrirtaeki f where f.stofa_id = v_tveir order by f.stofnad, f.id limit 1; end if;
  perform pg_temp.buast(v_f_t is not null, '0.4 fyrirtæki í Tveir fannst');
  select x.id into v_task_t from taskar x where x.stofa_id = v_tveir order by (x.fyrirtaeki_id = v_f_t) desc, x.stofnad limit 1;
  select x.id into v_verk_t from verkefni x where x.stofa_id = v_tveir order by x.stofnad limit 1;
  select x.id into v_thradur_t from postholf_thraedir x where x.stofa_id = v_tveir order by x.sidast desc limit 1;
  select x.id into v_midill_t from midlar x where x.stofa_id = v_tveir order by x.stofnad limit 1;
  select x.id into v_faersla_t from midla_faerslur x where x.stofa_id = v_tveir order by x.birt desc nulls last limit 1;
  select x.id into v_svar_t from postholf_svor x where x.stofa_id = v_tveir order by x.stofnad desc limit 1;
  select x.id into v_sending_t from tolfraedi_sendingar x where x.stofa_id = v_tveir order by x.stofnad desc limit 1;
  select x.id, x.skra_slod into v_undirverk_t, v_slod_t from undirverk x
   where x.stofa_id = v_tveir and x.skra_slod is not null order by x.lokid desc, x.stofnad desc limit 1;
  select x.id into v_snid_t from snid x where x.stofa_id = v_tveir order by x.stofnad limit 1;
  select x.id into v_myndband_t from myndbond x where x.stofa_id = v_tveir order by x.stofnad limit 1;
  v_lokid_t := array(select x.id from taskar x where x.stofa_id = v_tveir and x.stada = 'lokid');
  v_undirverk_t_oll := array(select x.id from undirverk x where x.stofa_id = v_tveir);
  v_samth_t := array(select x.id from skyrslur x where x.stofa_id = v_tveir and x.stada = 'samthykkt');

  -- Lyklar: einn sem talar fyrir Tveir (sömu umfang og Tveir skriftin), einn fyrir vélina, einn rangur
  v_tk := ny_vel_lykill('prof-stofur Tveir', v_tveir, false,
            coalesce((select v.umfang from vel_lyklar v where v.heiti = 'Tveir skrift' and v.stofa_id = v_tveir and v.virkur
                       order by v.stofnad limit 1),
                     array['postur_inn', 'postur_ut', 'postholf', 'dagatal', 'tolfraedi', 'skyrslur']));
  v_vk := ny_vel_lykill('prof-stofur vél', null, true, array['postur_inn', 'postur_ut', 'skyrslur']);
  v_rk := encode(extensions.gen_random_bytes(32), 'hex');

  -- ======================================================================
  -- 1. Grunnur: gögn Tveir og hvað leikendur Tveir sjá án veggjanna
  -- ======================================================================
  v_fingur := pg_temp.fingur(v_toflur, v_tveir);
  select md5(coalesce(string_agg(concat_ws('|', g.veita, g.lykill_id, g.sidustu4, g.stillingar, g.uppfaert, g.prufad,
                                           g.prufa_svar, md5(coalesce(d.decrypted_secret, ''))), ';' order by g.veita), ''))
    into v_teng_t
    from tengingar g left join vault.decrypted_secrets d on d.id = g.lykill_id where g.stofa_id = v_tveir;
  select k.gildi into v_gjald_t from kerfisstillingar k where k.stofa_id = v_tveir and k.lykill = 'gjaldmidill';
  -- Möppur annarra stofa í geymslunni (Tveir á allt annað, líka möppur sem eru ekki fyrirtæki)
  v_utan := array(select f.id::text from fyrirtaeki f where f.stofa_id <> v_tveir
                  union all select 'stofa-' || s2.id::text from stofur s2 where s2.id <> v_tveir);
  begin
    for t in select tablename from pg_policies where schemaname = 'public' and policyname = 'stofa_vegg' loop
      execute format('drop policy stofa_vegg on public.%I', t);
    end loop;
    drop policy if exists stofa_skrar on storage.objects;
    perform pg_temp.sem(v_admin_t);
    v_grunnur_admin := pg_temp.talning(v_hlutir, v_tveir, v_utan);
    if v_klient_t is not null then
      perform pg_temp.sem(v_klient_t);
      v_grunnur_klient := pg_temp.talning(v_hlutir, v_tveir, v_utan);
    end if;
    perform pg_temp.haetta();
    raise exception 'prof-stofur: grunnur';
  exception when raise_exception then
    if sqlerrm <> 'prof-stofur: grunnur' then raise; end if;
  end;
  perform pg_temp.buast(v_grunnur_admin is not null, '1.1 grunnur: hvað stjórnandi Tveir sér án veggjanna');
  -- Nýr notandi án boðs fær enga stofu, líka áður en stofa_vara hverfur í skrefi 5
  -- (annars yrði hann viðskiptavinur Tveir). Í undirfærslu sem er afturkölluð.
  b := false; s := null;
  begin
    insert into auth.users (id, email) values (gen_random_uuid(), 'nyr-anbods@profun.example') returning id into u;
    b := (select n.stofa_id is null and n.fyrirtaeki_id is null and n.hlutverk = 'vidskiptavinur' and not n.er_eigandi
            from notendur n where n.id = u);
    raise exception 'prof-stofur: anbods';
  exception when others then
    if sqlerrm <> 'prof-stofur: anbods' then b := false; s := sqlerrm; end if;
  end;
  perform pg_temp.buast(b, '1.2 nýr notandi án boðs fær enga stofu, líka meðan stofa_vara er til' || coalesce(' (' || s || ')', ''));

  -- ======================================================================
  -- 2. Veggirnir (skref 5) og vörðurinn
  -- ======================================================================
  v_veggur_var := exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'stofa_vegg');
  select md5(coalesce(string_agg(concat_ws('|', p.schemaname, p.tablename, p.policyname, p.permissive, p.roles::text, p.cmd,
                                           p.qual, p.with_check), ';' order by p.schemaname, p.tablename, p.policyname), '')
             || coalesce((select file_size_limit::text || array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'merki'), '')
             || exists (select 1 from stillingar_innri where lykill = 'stofa_vara')::text)
    into v_veggur_fyrir
    from pg_policies p where p.policyname in ('stofa_vegg', 'stofa_skrar', 'merki_les');
  execute v_veggir;
  select md5(coalesce(string_agg(concat_ws('|', p.schemaname, p.tablename, p.policyname, p.permissive, p.roles::text, p.cmd,
                                           p.qual, p.with_check), ';' order by p.schemaname, p.tablename, p.policyname), '')
             || coalesce((select file_size_limit::text || array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'merki'), '')
             || exists (select 1 from stillingar_innri where lykill = 'stofa_vara')::text)
    into v_veggur_eftir
    from pg_policies p where p.policyname in ('stofa_vegg', 'stofa_skrar', 'merki_les');
  if v_veggur_var then
    perform pg_temp.buast(v_veggur_eftir = v_veggur_fyrir, '2.1 veggirnir á live eru nákvæmlega þeir sem skref 5 skilgreinir');
  else
    perform pg_temp.buast(v_veggur_eftir <> v_veggur_fyrir, '2.1 veggir skrefs 5 settir á innan prófsins');
  end if;
  perform pg_temp.buast((select count(*) from pg_policies where schemaname = 'public' and policyname = 'stofa_vegg'
                           and permissive = 'RESTRICTIVE') = 30
                        and not exists (select 1 from stillingar_innri where lykill = 'stofa_vara'),
                        '2.2 30 veggir og stofa_vara horfin');
  execute v_vordur;
  perform pg_temp.buast(true, '2.3 vörðurinn stenst með veggjunum');

  -- ======================================================================
  -- 3. Stofan profun og lína í hverri töflu (sem postgres, eins og Edge Functions og föllin gera)
  -- ======================================================================
  v_profun := stofna_stofu('Prófun', 'profun', 'Admin-B@Profun.example', 'Admin B', '{"grein": "prof"}'::jsonb, 'virk', '2026-11-24');
  select s2.vefform_lykill into v_form_b from stofur s2 where s2.id = v_profun;
  insert into fyrirtaeki (stofa_id, nafn) values (v_profun, 'Prófun Viðskipti ehf') returning id into v_f_b;
  insert into fyrirtaeki (stofa_id, nafn) values (v_profun, 'Prófun Annað ehf') returning id into v_f_b2;
  perform skra_bod(v_profun, 'klient-b@profun.example', 'Client B', 'vidskiptavinur', v_f_b, null, false);
  insert into auth.users (id, email, raw_user_meta_data)
  values (gen_random_uuid(), 'admin-b@profun.example', '{"nafn": "Annað nafn", "hlutverk": "vidskiptavinur"}'::jsonb)
  returning id into v_admin_b;
  insert into auth.users (id, email, raw_user_meta_data)
  values (gen_random_uuid(), 'klient-b@profun.example', '{"hlutverk": "admin"}'::jsonb) returning id into v_klient_b;
  insert into auth.users (id, email, raw_user_meta_data)
  values (gen_random_uuid(), 'u-otengdur@profun.example', '{"hlutverk": "admin"}'::jsonb) returning id into v_u;
  perform pg_temp.buast((select n.stofa_id = v_profun and n.hlutverk = 'admin' and n.er_eigandi and n.fyrirtaeki_id is null
                           from notendur n where n.id = v_admin_b), '3.1 stjórnandi B kom inn með boði eigandans');
  perform pg_temp.buast((select n.stofa_id = v_profun and n.hlutverk = 'vidskiptavinur' and not n.er_eigandi and n.fyrirtaeki_id = v_f_b
                           from notendur n where n.id = v_klient_b), '3.2 viðskiptavinur B kom inn með boði á fyrirtæki profun');
  perform pg_temp.buast((select n.stofa_id is null and n.hlutverk = 'vidskiptavinur' and n.fyrirtaeki_id is null
                           from notendur n where n.id = v_u), '3.3 U án boðs fær enga stofu og ekkert hlutverk úr metadata');

  insert into verkefni (fyrirtaeki_id, titill, stada, hofundur, innan_samnings, verd_okkar)
  values (v_f_b, 'Prófun verkefni', 'i_vinnslu', v_admin_b, false, 100000) returning id into v_verk_b;
  insert into verkefni (fyrirtaeki_id, titill, stada, hofundur, innan_samnings, verd_okkar)
  values (v_f_b, 'Prófun lokið verkefni', 'lokid', v_admin_b, false, 50000) returning id into v_verk_b_lokid;
  insert into taskar (fyrirtaeki_id, verkefni_id, titill, stada, abyrgd, hofundur, postur_thradur)
  values (v_f_b, v_verk_b, 'Prófun bíður', 'bid_vidskiptavinar', v_admin_b, v_klient_b, 'prof-thr-verk') returning id into v_task_b;
  insert into taskar (fyrirtaeki_id, verkefni_id, titill, stada, hofundur, lokid_dags)
  values (v_f_b, v_verk_b, 'Prófun lokið', 'lokid', v_klient_b, now()) returning id into v_task_b_lokid;
  insert into taskar (fyrirtaeki_id, titill, stada, hofundur)
  values (v_f_b2, 'Prófun annað fyrirtæki', 'nytt', v_admin_b) returning id into v_task_b2;
  insert into athugasemdir (task_id, hofundur, texti) values (v_task_b, v_klient_b, 'Prófun athugasemd');
  insert into vidhengi (task_id, slod, nafn, staerd, hofundur)
  values (v_task_b, v_f_b || '/' || v_task_b || '/skjal.pdf', 'skjal.pdf', 100, v_klient_b);
  v_undirverk_b := gen_random_uuid();
  v_slod_b := v_f_b || '/undirverk/' || v_task_b_lokid || '/' || v_undirverk_b || '/skra.pdf';
  insert into undirverk (id, task_id, rod, titill, lokid, senda, skra_slod, skra_nafn, skra_staerd)
  values (v_undirverk_b, v_task_b_lokid, 1, 'Prófun skrá', true, true, v_slod_b, 'skra.pdf', 100);
  insert into timar (verkefni_id, notandi, klst, nota) values (v_verk_b, v_admin_b, 1.5, 'Prófun');
  insert into samningar (fyrirtaeki_id, vidskiptavinur, thjonusta, upphaed, vsklaust, hefst)
  values (v_f_b, 'Prófun Viðskipti ehf', 'Prófun', 10000, false, to_char(current_date, 'YYYY-MM'));
  insert into aukaverkefni (fyrirtaeki_id, heiti, vidskiptavinur, upphaed, dags, stada, greitt)
  values (v_f_b, 'Prófun aukaverk', 'Prófun Viðskipti ehf', 5000, current_date, 'stadfest', false);
  insert into taxtar (stofa_id, heiti, eining, upphaed) values (v_profun, 'Prófun tímagjald', 'klst', 10000);
  insert into innri_taskar (fyrirtaeki_id, titill, stada, forgangur, abyrgd, hofundur, skiladagur)
  values (v_f_b, 'Prófun innri', 'nytt', 'venjulegt', v_admin_b, v_admin_b, current_date - 3);
  insert into fundir (fyrirtaeki_id, titill, byrjar, endar, hofundur, tegund)
  values (v_f_b, 'Prófun fundur', now() + interval '1 day', now() + interval '1 day 1 hour', v_admin_b, 'fundur');
  insert into dagatal_atburdir (stofa_id, id, titill, byrjar, endar, uppruni) values
    (v_profun, 'prof-gcal-1990', 'Prófun 1990', '1990-04-01 10:00+00', '1990-04-01 11:00+00', 'apps_script'),
    (v_profun, 'prof-gcal-nu', 'Prófun nú', now(), now() + interval '1 hour', 'google');
  insert into fyrirspurnir (stofa_id, nafn, netfang, skilabod, stada, stofnad)
  values (v_profun, 'Prófun fyrirspurn', 'f@profun.example', 'Halló', 'ny', now() - interval '2 days');
  insert into midlar (fyrirtaeki_id, midill, nafn, ytra_id, slod)
  values (v_f_b, 'instagram', 'profun.is', 'prof-ig-1', 'https://www.instagram.com/profun') returning id into v_midill_b;
  insert into midlar_innri (midill_id, gogn) values (v_midill_b, '{"prof": true}'::jsonb);
  insert into maelingar (midill_id, dags, fylgjendur, ahorf, nadir, samskipti, faerslur)
  values (v_midill_b, current_date, 10, 100, 50, 5, 1);
  insert into midla_faerslur (midill_id, fyrirtaeki_id, ytra_id, birt, tegund, texti, slod, ahorf, likes)
  values (v_midill_b, v_f_b, 'prof-faersla-1', now(), 'reel', 'Prófun', 'https://www.instagram.com/reel/prof1', 5, 1)
  returning id into v_faersla_b;
  insert into myndbond (fyrirtaeki_id, titill, midill, slod, birt)
  values (v_f_b, 'Prófun myndband', 'instagram', 'https://www.instagram.com/reel/prof2', current_date) returning id into v_myndband_b;
  insert into myndband_tolur (myndband_id, manudur, ahorf, likes) values (v_myndband_b, date_trunc('month', current_date)::date, 3, 1);
  insert into skyrslur (fyrirtaeki_id, manudur, tolur, samantekt, stada)
  values (v_f_b, (date_trunc('month', current_date) - interval '1 month')::date, '{}'::jsonb, 'Send', 'send')
  returning id into v_skyrsla_b_send;
  insert into skyrslur (fyrirtaeki_id, manudur, tolur, samantekt, stada)
  values (v_f_b, date_trunc('month', current_date)::date, '{}'::jsonb, null, 'drog');
  insert into skyrslur (fyrirtaeki_id, manudur, tolur, samantekt, stada)
  values (v_f_b, (date_trunc('month', current_date) - interval '2 months')::date, '{}'::jsonb, 'Samþykkt', 'samthykkt')
  returning id into v_skyrsla_b_samth;
  insert into reikningsdrog (stofa_id, veita, uppruni, uppruni_id, fyrirtaeki_id, linur, upphaed, stada)
  values (v_profun, 'payday', 'verkefni', v_verk_b, v_f_b, '[]'::jsonb, 1000, 'drog');
  insert into oauth_stada (state_hash, stofa_id, veita, notandi, rennur_ut)
  values (md5(v_merki || 'oauth'), v_profun, 'google', v_admin_b, now() + interval '10 minutes');
  insert into rekstur_log (notandi, adgerd, stofa_id, gogn) values (v_admin_t, 'prof-stofur', v_profun, '{}'::jsonb);
  insert into undirskriftir (notandi_id, gogn) values (v_admin_b, '{"nafn": "Admin B"}'::jsonb);
  v_moppur_b := array[v_f_b::text, v_f_b2::text, 'stofa-' || v_profun::text];
  insert into storage.objects (bucket_id, name, metadata) values
    ('vidhengi', v_f_b || '/' || v_task_b || '/skjal.pdf', '{"size": 100}'::jsonb),
    ('vidhengi', v_slod_b, '{"size": 100}'::jsonb),
    ('merki', v_f_b || '/merki.png', '{"size": 100}'::jsonb),
    ('merki', 'stofa-' || v_profun || '/merki.png', '{"size": 100}'::jsonb);
  -- Óþekktur en auðkenndur sendandi: Verkpóstur (postholf_thraedir og postholf_skilabod)
  j := postur_inn(v_vk, 'profun@verk.tveir.is', 'okunnur@annad.example', 'Ókunnur', 'Fyrirspurn', 'Halló', 'prof-thr-1', true, null);
  v_thradur_b := 'v:profun:prof-thr-1';
  perform pg_temp.buast(j ->> 'villa' = 'othekktur'
                        and exists (select 1 from postholf_thraedir x where x.id = v_thradur_b and x.stofa_id = v_profun and x.uppruni = 'verk')
                        and exists (select 1 from postholf_skilabod x where x.thradur_id = v_thradur_b and x.stofa_id = v_profun),
                        '3.4 Verkpóstur frá óþekktum sendanda í profun');

  -- Það sem stjórnandi þarf að gera sjálfur: tengingar (Vault), tölfræðisending, svar í pósthólfi
  perform pg_temp.sem(v_admin_b);
  perform vista_tengingu('claude', '{}'::jsonb, '{"lykill": "sk-prof-profun-0000-QRST"}'::jsonb);
  perform vista_tengingu('payday', '{}'::jsonb, '{"clientId": "prof-b-client", "clientSecret": "prof-b-secret-WXYZ"}'::jsonb);
  insert into tolfraedi_sendingar (fyrirtaeki_id, netfong, efni, html, texti)
  values (v_f_b, array['klient-b@profun.example'], 'Prófun', '<p>x</p>', 'x') returning id into v_sending_b;
  perform pg_temp.haetta();
  update stofur set postholf = true where id = v_profun;          -- bara til að setja eitt svar í prófunargögnin
  perform pg_temp.sem(v_admin_b);
  insert into postholf_svor (thradur_id, texti) values (v_thradur_b, 'Prófun svar') returning id into v_svar_b;
  perform pg_temp.haetta();
  update stofur set postholf = false where id = v_profun;

  -- Hver af 30 töflunum á línu í profun (annars væru fullyrðingarnar tómar)
  v_profun_fjoldi := pg_temp.talning(v_hlutir30 || v_skodanir || v_nyjar, v_profun, null);
  select string_agg(x, ', ') into t from unnest(v_hlutir30) x where (v_profun_fjoldi ->> x)::bigint < 1;
  perform pg_temp.buast(t is null, '3.5 profun á línu í hverri af 30 töflunum' || coalesce(' (vantar: ' || t || ')', ''));
  select jsonb_agg(g.veita || ':' || g.sidustu4 order by g.veita) into v_teng_b from tengingar g where g.stofa_id = v_profun;
  perform pg_temp.buast((select count(*) from vault.secrets x where x.name = 'glerhus_tenging_' || v_profun || '_claude') = 1,
                        '3.6 leyndarmál profun heitir eftir stofunni (glerhus_tenging_<stofa>_<veita>)');
  -- Verkefni með tímum má eyða (stilla_klst bjó verkefni_innri áður til aftur og eyðingin féll)
  b := false; s := null;
  begin
    perform pg_temp.buast((select count(*) from timar where verkefni_id = v_verk_b) >= 1, '3.7 verkefni profun á tíma');
    delete from verkefni where id = v_verk_b;
    b := not exists (select 1 from verkefni_innri where verkefni_id = v_verk_b)
         and not exists (select 1 from timar where verkefni_id = v_verk_b);
    raise exception 'prof-stofur: eyda verkefni';
  exception when others then
    if sqlerrm <> 'prof-stofur: eyda verkefni' then b := false; s := sqlerrm; end if;
  end;
  perform pg_temp.buast(b, '3.8 verkefni með tímum eytt, verkefni_innri og tímar fóru með' || coalesce(' (' || s || ')', ''));

  -- ======================================================================
  -- 4. Tveir með veggjunum: nákvæmlega það sama og áður, ekkert úr profun
  -- ======================================================================
  perform pg_temp.sem(v_admin_t);
  j := pg_temp.talning(v_hlutir, null, null);
  perform pg_temp.buast(pg_temp.munur(v_grunnur_admin, j) is null,
                        '4.1 stjórnandi Tveir sér nákvæmlega sömu línur og án veggjanna' || coalesce(' (' || pg_temp.munur(v_grunnur_admin, j) || ')', ''));
  select string_agg(x, ', ') into t from unnest(v_hlutir30 || v_skodanir) x
   where pg_temp.tala(format('select count(*) from %s where stofa_id is distinct from %L', x, v_tveir)) <> 0;
  perform pg_temp.buast(t is null, '4.2 stjórnandi Tveir sér engar línur annarra stofa' || coalesce(' (' || t || ')', ''));
  perform pg_temp.buast(pg_temp.tala(format('select count(*) from storage.objects where (storage.foldername(name))[1] = any (%L::text[])', v_moppur_b)) = 0
                        and not exists (select 1 from stofur where id = v_profun),
                        '4.3 stjórnandi Tveir sér hvorki skrár né stofuröð profun');
  -- Uppfærsla á notendur með veggjunum (not_eigid og veggurinn mega ekki valda endurkvæmni)
  perform pg_temp.buast(pg_temp.radir(format('update notendur set nafn = nafn where id = %L', coalesce(v_klient_t, v_admin_t))) = 1
                        and pg_temp.radir(format('update notendur set nafn = nafn where id = %L', v_admin_t)) = 1,
                        '4.6 stjórnandi Tveir uppfærir notendur Tveir');
  if v_klient_t is not null then
    perform pg_temp.sem(v_klient_t);
    j := pg_temp.talning(v_hlutir, null, null);
    perform pg_temp.buast(pg_temp.munur(v_grunnur_klient, j) is null,
                          '4.4 viðskiptavinur Tveir sér nákvæmlega sömu línur og án veggjanna' || coalesce(' (' || pg_temp.munur(v_grunnur_klient, j) || ')', ''));
    select string_agg(x, ', ') into t from unnest(v_hlutir30 || v_skodanir) x
     where pg_temp.tala(format('select count(*) from %s where stofa_id is distinct from %L', x, v_tveir)) <> 0;
    perform pg_temp.buast(t is null, '4.5 viðskiptavinur Tveir sér engar línur annarra stofa' || coalesce(' (' || t || ')', ''));
    perform pg_temp.buast(pg_temp.radir(format('update notendur set nafn = nafn where id = %L', v_klient_t)) = 1,
                          '4.7 viðskiptavinur Tveir uppfærir eigin notendalínu (not_eigid)');
  end if;
  perform pg_temp.haetta();

  -- ======================================================================
  -- 5. Stjórnandi B (kafli 11.3 atriði 1 til 13)
  -- ======================================================================
  perform pg_temp.sem(v_admin_b);
  perform pg_temp.buast(min_stofa() = v_profun and er_admin() and mitt_fyrirtaeki() is null and not er_rekstraradili(),
                        '5.0 stjórnandi B: min_stofa, er_admin, mitt_fyrirtaeki, er_rekstraradili');
  select * into r from min_stada();
  perform pg_temp.buast(r.stofa_id = v_profun and r.stada = 'virk' and r.er_admin and r.er_eigandi and r.slug = 'profun'
                        and not r.postholf and not r.er_rekstraradili, '5.0 min_stada stjórnanda B');

  -- 1, 2, 11. Engin lína annarrar stofu; allt í profun sýnilegt (tengingar hafa engar reglur: 0)
  select string_agg(x, ', ') into t from unnest(v_hlutir30 || v_skodanir || v_nyjar) x
   where pg_temp.tala(format('select count(*) from %s where %s is distinct from %L', x,
                             case when x = 'public.stofur' then 'id' else 'stofa_id' end, v_profun)) <> 0;
  perform pg_temp.buast(t is null, '5.1 stjórnandi B sér engar línur annarra stofa (30 töflur, 4 skoðanir, nýju töflurnar)'
                                   || coalesce(' (' || t || ')', ''));
  j := pg_temp.talning(v_hlutir30 || v_nyjar, null, null);
  select string_agg(x || ' ' || (j ->> x) || '/' || (v_profun_fjoldi ->> x), ', ') into t
    from unnest(v_hlutir30 || v_nyjar) x
   where (j ->> x)::bigint <> case when x = 'public.tengingar' then 0
                                   when x = 'public.stofur' then 1
                                   else (v_profun_fjoldi ->> x)::bigint end;
  perform pg_temp.buast(t is null, '5.2 stjórnandi B sér allar línur profun og bara þær (notendur: 2)' || coalesce(' (' || t || ')', ''));
  perform pg_temp.buast((j ->> 'public.notendur')::bigint = 2, '5.2 notendur: bara notendur profun (stjórnendur Tveir ósýnilegir)');
  select string_agg(x, ', ') into t from unnest(v_skodanir) x
   where pg_temp.tala(format('select count(*) from %s', x)) < 1;
  perform pg_temp.buast(t is null, '5.3 skoðanirnar fjórar sýna línur profun' || coalesce(' (tómar: ' || t || ')', ''));
  select string_agg(x || ' ' || (pg_temp.talning(array[x]) ->> x), ', ') into t from unnest(v_lokadar) x
   where (pg_temp.talning(array[x]) ->> x)::bigint <> -1;
  perform pg_temp.buast(t is null, '5.4 vel_lyklar, skraningar, oauth_stada og rekstur_log lokaðar' || coalesce(' (' || t || ')', ''));
  perform pg_temp.buast(coalesce((pg_temp.talning(array['public.stillingar_innri']) ->> 'public.stillingar_innri')::bigint, 0) <= 0
                        and coalesce((pg_temp.talning(array['public.midlar_innri']) ->> 'public.midlar_innri')::bigint, 0) <= 0
                        and (select count(*) from undirskriftir) = 1
                        and (select count(*) from undirskriftir where notandi_id <> v_admin_b) = 0,
                        '5.5 stillingar_innri og midlar_innri lokaðar, undirskriftir bara eigin');

  -- 3. Tengingar
  select jsonb_agg(x.veita || ':' || x.sidustu4 order by x.veita) into j from tengingar_stada() x;
  perform pg_temp.buast(j = v_teng_b, '5.6 tengingar_stada sýnir bara tengingar profun');
  perform pg_temp.buast(eyda_tengingu('payday'), '5.7 eyda_tengingu payday (profun)');
  perform pg_temp.hafnad($$select vista_tengingu('google', '{}'::jsonb, '{"access_token": "prof-1234"}'::jsonb)$$,
                         '5.8 vista_tengingu neitar google (bara oauth)');

  -- 4. Innsetning sem vísar í Tveir
  perform pg_temp.hafnad(format('insert into taskar (fyrirtaeki_id, titill) values (%L, %L)', v_f_t, 'Prófun'),
                         '5.9 taskar með fyrirtæki Tveir');
  if v_task_t is not null then
    perform pg_temp.hafnad(format('insert into athugasemdir (task_id, hofundur, texti) values (%L, %L, %L)', v_task_t, v_admin_b, 'x'),
                           '5.10 athugasemd á verk Tveir');
    perform pg_temp.hafnad(format('insert into vidhengi (task_id, slod, nafn, hofundur) values (%L, %L, %L, %L)', v_task_t, 'x/y.pdf', 'y.pdf', v_admin_b),
                           '5.11 viðhengi á verk Tveir');
    perform pg_temp.hafnad(format('insert into undirverk (task_id, rod, titill) values (%L, 99, %L)', v_task_t, 'x'),
                           '5.12 undirverk á verk Tveir');
  end if;
  perform pg_temp.hafnad(format('insert into verkefni (fyrirtaeki_id, titill, hofundur) values (%L, %L, %L)', v_f_b, 'Prófun', v_admin_t),
                         '5.13 verkefni með höfund úr Tveir');
  perform pg_temp.hafnad(format('insert into taskar (fyrirtaeki_id, titill, abyrgd) values (%L, %L, %L)', v_f_b, 'Prófun', v_admin_t),
                         '5.14 verk með ábyrgðarmann úr Tveir');
  if v_verk_t is not null then
    perform pg_temp.hafnad(format('insert into timar (verkefni_id, notandi, klst) values (%L, %L, 1)', v_verk_t, v_admin_b),
                           '5.15 tími á verkefni Tveir');
  end if;
  if v_midill_t is not null then
    perform pg_temp.hafnad(format('insert into maelingar (midill_id, dags, fylgjendur) values (%L, current_date - 400, 1)', v_midill_t),
                           '5.16 mæling á miðil Tveir');
  end if;
  if v_thradur_t is not null then
    perform pg_temp.hafnad(format('insert into postholf_skilabod (id, thradur_id, dags, texti) values (%L, %L, now(), %L)', 'prof-' || v_merki, v_thradur_t, 'x'),
                           '5.17 skilaboð í þráð Tveir');
  end if;
  if v_myndband_t is not null then
    perform pg_temp.hafnad(format('insert into myndband_tolur (myndband_id, manudur, ahorf) values (%L, %L, 1)', v_myndband_t, '1990-01-01'),
                           '5.18 tölur á myndband Tveir');
  end if;
  if v_snid_t is not null then
    perform pg_temp.hafnad(format('insert into snid_taskar (snid_id, titill, rod, a_hverjum, forgangur) values (%L, %L, 1, %L, %L)', v_snid_t, 'x', 'tveir', 'venjulegt'),
                           '5.19 sniðverk í snið Tveir');
  end if;
  perform pg_temp.hafnad(format('insert into midlar (fyrirtaeki_id, midill, nafn) values (%L, %L, %L)', v_f_t, 'instagram', 'x'),
                         '5.20 miðill á fyrirtæki Tveir');
  perform pg_temp.hafnad(format('insert into skyrslur (fyrirtaeki_id, manudur, tolur) values (%L, %L, %L)', v_f_t, '1990-01-01', '{}'),
                         '5.21 skýrsla á fyrirtæki Tveir');
  perform pg_temp.hafnad(format('insert into samningar (fyrirtaeki_id, vidskiptavinur, thjonusta, upphaed, hefst) values (%L, %L, %L, 1, %L)', v_f_t, 'x', 'x', '1990-01'),
                         '5.22 samningur á fyrirtæki Tveir');
  perform pg_temp.hafnad(format('insert into aukaverkefni (fyrirtaeki_id, heiti, vidskiptavinur, upphaed, dags) values (%L, %L, %L, 1, current_date)', v_f_t, 'x', 'x'),
                         '5.23 aukaverk á fyrirtæki Tveir');
  perform pg_temp.hafnad(format('insert into innri_taskar (fyrirtaeki_id, titill) values (%L, %L)', v_f_t, 'x'),
                         '5.24 innra verk á fyrirtæki Tveir');
  perform pg_temp.hafnad(format('insert into notendur (id, netfang, nafn, fyrirtaeki_id) values (%L, %L, %L, %L)', gen_random_uuid(), 'x@x.example', 'x', v_f_t),
                         '5.25 notandi á fyrirtæki Tveir');
  -- stofa_id frá vafranum er hunsuð
  insert into fyrirtaeki (stofa_id, nafn) values (v_tveir, 'Prófun hunsað') returning id into u;
  perform pg_temp.buast((select x.stofa_id from fyrirtaeki x where x.id = u) = v_profun, '5.26 stofa_id frá vafranum hunsuð (fyrirtaeki)');
  insert into taskar (stofa_id, fyrirtaeki_id, titill) values (v_tveir, v_f_b, 'Prófun hunsað') returning id into u;
  perform pg_temp.buast((select x.stofa_id from taskar x where x.id = u) = v_profun, '5.27 stofa_id frá vafranum hunsuð (taskar)');
  -- Uppfærsla og eyðing lína annarra stofa: 0 línur
  select string_agg(x, ', ') into t from unnest(v_toflur) x
   where pg_temp.radir(format('update public.%I set stofa_id = stofa_id where stofa_id is distinct from %L', x, v_profun)) <> 0
      or pg_temp.radir(format('delete from public.%I where stofa_id is distinct from %L', x, v_profun)) <> 0;
  perform pg_temp.buast(t is null, '5.28 stjórnandi B uppfærir og eyðir engu utan profun' || coalesce(' (' || t || ')', ''));
  -- Lína færist ekki á milli stofa
  update taskar set stofa_id = v_tveir where id = v_task_b;
  perform pg_temp.buast((select x.stofa_id from taskar x where x.id = v_task_b) = v_profun, '5.29 verk færist ekki til Tveir (stofa_id fest)');
  update fyrirtaeki set stofa_id = v_tveir where id = v_f_b;
  perform pg_temp.buast((select x.stofa_id from fyrirtaeki x where x.id = v_f_b) = v_profun, '5.30 fyrirtæki færist ekki til Tveir');
  perform pg_temp.hafnad(format('update taskar set fyrirtaeki_id = %L where id = %L', v_f_t, v_task_b),
                         '5.31 verk fært á fyrirtæki Tveir');

  -- 5. notendur
  update notendur set stofa_id = v_tveir, er_eigandi = false where id = v_admin_b;
  perform pg_temp.buast((select x.stofa_id = v_profun and x.er_eigandi from notendur x where x.id = v_admin_b),
                        '5.32 eigin stofa og eigandi fest');
  perform pg_temp.buast(pg_temp.radir(format('update notendur set nafn = nafn where id = %L', v_admin_t)) = 0,
                        '5.33 uppfærsla notanda Tveir: 0 línur');
  perform pg_temp.buast(pg_temp.radir(format('update notendur set nafn = %L where id = %L', 'Admin B', v_admin_b)) = 1
                        and pg_temp.radir(format('update notendur set nafn = nafn where id = %L', v_klient_b)) = 1,
                        '5.33 stjórnandi B uppfærir notendur profun');
  perform pg_temp.hafnad(format('update notendur set fyrirtaeki_id = %L where id = %L', v_f_t, v_klient_b),
                         '5.34 viðskiptavinur B tengdur fyrirtæki Tveir');

  -- 6. kerfisstillingar (upsert eins og vefurinn, án onConflict)
  insert into kerfisstillingar (lykill, gildi) values ('gjaldmidill', 'EUR')
  on conflict (stofa_id, lykill) do update set gildi = excluded.gildi;
  insert into kerfisstillingar (stofa_id, lykill, gildi) values (v_tveir, 'lager_vidvorun', '5')
  on conflict (stofa_id, lykill) do update set gildi = excluded.gildi;

  -- 7. Pósthólfið er bara hjá Tveir
  t := pg_temp.hafnad($$insert into postholf_svor (til, efni, texti) values ('x@y.is', 'Prófun', 'x')$$, '5.35 nýr póstur úr pósthólfi');
  perform pg_temp.buast(t like '%Pósthólfið er bara hjá Tveir%', '5.35 villan er "Pósthólfið er bara hjá Tveir"');
  if v_thradur_t is not null then
    perform pg_temp.hafnad(format('insert into postholf_svor (thradur_id, texti) values (%L, %L)', v_thradur_t, 'x'), '5.36 svar í þráð Tveir');
  end if;
  perform pg_temp.hafnad(format('insert into postholf_svor (thradur_id, texti) values (%L, %L)', v_thradur_b, 'x'), '5.37 svar í Verkpóst (pósthólf ekki á)');

  -- 8. Tölfræðisending
  perform pg_temp.hafnad(format('insert into tolfraedi_sendingar (fyrirtaeki_id, netfong, efni) values (%L, array[%L], %L)', v_f_b, v_netfang_admin_t, 'x'),
                         '5.38 tölfræði send á stjórnanda Tveir');
  perform pg_temp.hafnad(format('insert into tolfraedi_sendingar (fyrirtaeki_id, netfong, efni) values (%L, array[%L], %L)', v_f_t, 'klient-b@profun.example', 'x'),
                         '5.39 tölfræði um fyrirtæki Tveir');

  -- 9. Fundir
  perform pg_temp.hafnad(format('insert into fundir (fyrirtaeki_id, titill, byrjar, endar, tegund) values (%L, %L, now(), now(), %L)', v_f_t, 'x', 'fundur'),
                         '5.40 fundur á fyrirtæki Tveir');

  -- 10. Geymslan
  perform pg_temp.buast(pg_temp.tala(format('select count(*) from storage.objects where (storage.foldername(name))[1] = %L', v_f_t)) = 0
                        and pg_temp.tala(format('select count(*) from storage.objects where not ((storage.foldername(name))[1] = any (%L::text[]))', v_moppur_b)) = 0
                        and pg_temp.tala('select count(*) from storage.objects') = 4,
                        '5.41 geymsla: bara skrár profun sýnilegar (4)');
  perform pg_temp.hafnad(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'vidhengi', v_f_t || '/prof.txt'),
                         '5.42 skrá í möppu fyrirtækis Tveir');
  perform pg_temp.hafnad(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'merki', 'stofa-' || v_tveir || '/x.png'),
                         '5.43 merki í möppu stofu Tveir');
  perform pg_temp.hafnad(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'merki', v_f_t || '/x.png'),
                         '5.44 merki fyrirtækis Tveir');
  perform pg_temp.buast(pg_temp.radir(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'merki', 'stofa-' || v_profun || '/x.png')) = 1,
                        '5.45 merki í möppu eigin stofu');
  perform pg_temp.buast(pg_temp.radir(format('update storage.objects set metadata = metadata where not ((storage.foldername(name))[1] = any (%L::text[]))', v_moppur_b)) = 0
                        and pg_temp.radir(format('delete from storage.objects where not ((storage.foldername(name))[1] = any (%L::text[]))', v_moppur_b)) = 0,
                        '5.46 geymsla: engu breytt eða eytt utan profun');

  -- 12. stofur
  update stofur set slug = 'annad', stada = 'lokud', sendir_fra = 'tveir', postholf = true, nafn = 'Prófun B' where id = v_profun;
  perform pg_temp.buast((select x.slug = 'profun' and x.stada = 'virk' and x.sendir_fra = 'verk' and not x.postholf and x.nafn = 'Prófun B'
                           from stofur x where x.id = v_profun), '5.47 stofur: nafn breytist, slug, stada, sendir_fra og postholf fest');
  perform pg_temp.buast(pg_temp.radir(format('update stofur set nafn = nafn where id = %L', v_tveir)) = 0, '5.48 stofa Tveir: 0 línur');
  -- Nafnið fer í boðspóstinn: engar slóðir, lén eða HTML (stofur_nafn_oruggt)
  perform pg_temp.hafnad(format('update stofur set nafn = %L where id = %L', 'Smelltu á www.svindl.example', v_profun), '5.66 nafn stofu með www');
  perform pg_temp.hafnad(format('update stofur set nafn = %L where id = %L', 'Tilboð á svindl.com núna', v_profun), '5.67 nafn stofu með léni');
  perform pg_temp.hafnad(format('update stofur set nafn = %L where id = %L', 'Prófun <b>B</b>', v_profun), '5.68 nafn stofu með HTML');
  perform pg_temp.hafnad(format('update stofur set nafn = %L where id = %L', 'https://svindl.example/x', v_profun), '5.69 nafn stofu með slóð');
  perform pg_temp.buast((select x.nafn = 'Prófun B' from stofur x where x.id = v_profun), '5.70 nafnið óbreytt eftir höfnun');

  -- 13. Föll rekstraraðila
  perform pg_temp.hafnad('select * from stofur_yfirlit()', '5.49 stofur_yfirlit');
  perform pg_temp.hafnad($$select samthykkja_stofu('profun')$$, '5.50 samthykkja_stofu');
  perform pg_temp.hafnad($$select loka_stofu('tveir', 'x')$$, '5.51 loka_stofu');
  perform pg_temp.hafnad($$select opna_stofu('profun')$$, '5.52 opna_stofu');
  perform pg_temp.hafnad('select stilla_skraningu(true)', '5.53 stilla_skraningu');
  perform pg_temp.hafnad($$select postur_ut('tveir', false)$$, '5.54 postur_ut');

  -- Önnur föll sem innskráðir kalla
  perform pg_temp.buast(not fyrirtaeki_i_stofu(v_f_t::text) and fyrirtaeki_i_stofu(v_f_b::text) and not fyrirtaeki_i_stofu('ekki-uuid'),
                        '5.55 fyrirtaeki_i_stofu');
  if v_slod_t is not null then
    perform pg_temp.buast(afhending_ma_lesa(v_slod_t) is not true and undirverk_skra_opin(v_slod_t) is not true, '5.56 afhending_ma_lesa og undirverk_skra_opin: skrá Tveir');
  end if;
  perform pg_temp.buast(er_fratekid_slug('tveir') and not er_fratekid_slug('profun') and tveir_stofa() = v_tveir,
                        '5.57 er_fratekid_slug; tveir_stofa skilar bara auðkenni Tveir');
  if v_thradur_t is not null then
    perform pg_temp.hafnad(format('select verk_ur_thraedi(%L, %L)', v_thradur_t, v_f_b), '5.58 verk_ur_thraedi úr þræði Tveir');
  end if;
  perform pg_temp.hafnad(format('select verk_ur_thraedi(%L, %L)', v_thradur_b, v_f_t), '5.59 verk_ur_thraedi á fyrirtæki Tveir');
  j := verk_ur_thraedi(v_thradur_b, v_f_b);
  perform pg_temp.buast((j ->> 'ok')::boolean and (j ->> 'fjoldi')::int >= 1, '5.60 verk_ur_thraedi í eigin stofu');
  perform pg_temp.buast(lokid_otilkynnt(v_rk) = '[]'::jsonb and postholf_skra(v_rk, '[]'::jsonb) = -1,
                        '5.61 lyklaföll með röngum lykli (innskráður)');
  perform pg_temp.haetta();

  -- Staðfest sem postgres
  perform pg_temp.buast((select md5(coalesce(string_agg(concat_ws('|', g.veita, g.lykill_id, g.sidustu4, g.stillingar, g.uppfaert, g.prufad,
                                                                  g.prufa_svar, md5(coalesce(d.decrypted_secret, ''))), ';' order by g.veita), ''))
                           from tengingar g left join vault.decrypted_secrets d on d.id = g.lykill_id where g.stofa_id = v_tveir) = v_teng_t,
                        '5.62 tengingar Tveir og Vault leyndarmál þeirra óbreytt (vista_tengingu og eyda_tengingu í profun)');
  perform pg_temp.buast(not exists (select 1 from tengingar where stofa_id = v_profun and veita = 'payday')
                        and not exists (select 1 from vault.secrets where name = 'glerhus_tenging_' || v_profun || '_payday'),
                        '5.63 eyda_tengingu felldi bara tengingu profun og leyndarmál hennar');
  perform pg_temp.buast((select gildi from kerfisstillingar where stofa_id = v_tveir and lykill = 'gjaldmidill') is not distinct from v_gjald_t
                        and (select gildi from kerfisstillingar where stofa_id = v_profun and lykill = 'gjaldmidill') = 'EUR'
                        and not exists (select 1 from kerfisstillingar where stofa_id = v_tveir and lykill = 'lager_vidvorun' and gildi = '5')
                        and exists (select 1 from kerfisstillingar where stofa_id = v_profun and lykill = 'lager_vidvorun'),
                        '5.64 kerfisstillingar: gildi Tveir óbreytt, upsert lenti í profun');
  perform pg_temp.buast((select count(*) from taskar where stofa_id = v_profun and postur_thradur = 'prof-thr-1') >= 1,
                        '5.65 verk úr Verkpósti lentu í profun');

  -- ======================================================================
  -- 6. Viðskiptavinur B
  -- ======================================================================
  perform pg_temp.sem(v_klient_b);
  perform pg_temp.buast(min_stofa() = v_profun and not er_admin() and mitt_fyrirtaeki() = v_f_b,
                        '6.0 viðskiptavinur B: min_stofa, ekki stjórnandi, eigið fyrirtæki');
  select * into r from min_stada();
  perform pg_temp.buast(r.stofa_id = v_profun and not r.er_admin and not r.er_eigandi, '6.0 min_stada viðskiptavinar B');
  select string_agg(x, ', ') into t from unnest(v_hlutir30 || v_skodanir || v_nyjar) x
   where pg_temp.tala(format('select count(*) from %s where %s is distinct from %L', x,
                             case when x = 'public.stofur' then 'id' else 'stofa_id' end, v_profun)) <> 0;
  perform pg_temp.buast(t is null, '6.1 viðskiptavinur B sér engar línur annarra stofa' || coalesce(' (' || t || ')', ''));
  perform pg_temp.haetta();
  select count(*) into n from verkefni where fyrirtaeki_id = v_f_b;
  select count(*) into n2 from taskar where fyrirtaeki_id = v_f_b;
  select count(*) into n3 from undirverk where fyrirtaeki_id = v_f_b;
  perform pg_temp.sem(v_klient_b);
  perform pg_temp.buast((select count(*) from verkefni) = n and (select count(*) from taskar) = n2 and (select count(*) from undirverk) = n3
                        and (select count(*) from taskar where id = v_task_b2) = 0,
                        '6.2 viðskiptavinur B sér verkefni, verk og undirverk eigin fyrirtækis og ekkert annað');
  perform pg_temp.buast((select count(*) from skyrslur) = 1 and (select count(*) from skyrslur where id = v_skyrsla_b_send) = 1,
                        '6.3 skýrslur: bara sendar');
  perform pg_temp.buast((select count(*) from bod) = 0 and (select count(*) from reikningsdrog) = 0
                        and (select count(*) from postur_inn_log) = 0 and (select count(*) from notkun) = 0
                        and (select count(*) from tengingar_stada()) = 0,
                        '6.4 boð, reikningsdrög, póstlogg, notkun og tengingar ósýnileg');
  perform pg_temp.buast((select count(*) from kerfisstillingar) = (v_profun_fjoldi ->> 'public.kerfisstillingar')::bigint + 1,
                        '6.5 kerfisstillingar: bara profun');
  perform pg_temp.buast(pg_temp.tala(format('select count(*) from storage.objects where not ((storage.foldername(name))[1] = any (%L::text[]))',
                                            array[v_f_b::text, 'stofa-' || v_profun::text])) = 0
                        and pg_temp.tala(format('select count(*) from storage.objects where (storage.foldername(name))[1] = %L', v_f_b)) >= 2,
                        '6.6 geymsla: bara eigið fyrirtæki og merki stofunnar');
  perform pg_temp.hafnad(format('insert into taskar (fyrirtaeki_id, titill) values (%L, %L)', v_f_t, 'x'), '6.7 verk á fyrirtæki Tveir');
  perform pg_temp.buast(pg_temp.radir(format('insert into taskar (fyrirtaeki_id, titill) values (%L, %L)', v_f_b, 'Prófun frá B')) = 1,
                        '6.8 verk á eigið fyrirtæki');
  -- Viðskiptavinur ræður ekki póstþræði, höfundi né tilkynningu (verja_task_vidskiptavinar)
  n := pg_temp.radir(format('insert into taskar (fyrirtaeki_id, titill, postur_thradur, hofundur, tilkynnt_lokid) values (%L, %L, %L, %L, now())',
                            v_f_b, 'Prófun þráður B', 'prof-thr-falsad', v_admin_b));
  perform pg_temp.buast(n = 1 and (select x.postur_thradur is null and x.hofundur = v_klient_b and x.tilkynnt_lokid is null
                                     from taskar x where x.titill = 'Prófun þráður B'),
                        '6.15 nýtt verk viðskiptavinar: postur_thradur og tilkynnt_lokid tóm, hofundur hann sjálfur');
  n := pg_temp.radir(format('update taskar set postur_thradur = %L, hofundur = %L, tilkynnt_lokid = now(), titill = %L where id = %L',
                            'prof-thr-falsad', v_admin_b, 'Prófun bíður B', v_task_b));
  perform pg_temp.buast(n = 1 and (select x.postur_thradur = 'prof-thr-verk' and x.hofundur = v_klient_b and x.tilkynnt_lokid is null
                                          and x.titill = 'Prófun bíður B'
                                     from taskar x where x.id = v_task_b),
                        '6.16 uppfærsla viðskiptavinar: titill breytist, postur_thradur, hofundur og tilkynnt_lokid fest');
  perform pg_temp.hafnad(format('insert into tolfraedi_sendingar (fyrirtaeki_id, netfong, efni) values (%L, array[%L], %L)', v_f_b, 'klient-b@profun.example', 'x'),
                         '6.9 tölfræðisending (ekki stjórnandi)');
  perform pg_temp.hafnad($$select vista_tengingu('claude', '{}'::jsonb, '{"lykill": "sk-prof-x-1234"}'::jsonb)$$, '6.10 vista_tengingu');
  perform pg_temp.hafnad($$select eyda_tengingu('claude')$$, '6.11 eyda_tengingu');
  perform pg_temp.hafnad(format('select verk_ur_thraedi(%L, %L)', v_thradur_b, v_f_b), '6.12 verk_ur_thraedi');
  perform pg_temp.buast(pg_temp.radir(format('update stofur set nafn = %L', 'x')) = 0 and (select count(*) from stofur) = 1,
                        '6.13 stofur: sér sína, breytir engu');
  perform pg_temp.buast(pg_temp.radir(format('update notendur set nafn = %L where id = %L', 'Client B', v_klient_b)) = 1
                        and pg_temp.radir(format('update notendur set nafn = nafn where id = %L', v_admin_b)) = 0,
                        '6.14 viðskiptavinur B uppfærir eigin línu (not_eigid), ekki annarra');
  perform pg_temp.haetta();

  -- ======================================================================
  -- 7. U: innskráður án stofu
  -- ======================================================================
  perform pg_temp.sem(v_u);
  perform pg_temp.buast(min_stofa() is null and not er_admin() and mitt_fyrirtaeki() is null
                        and (select x.stofa_id is null and not x.er_admin from min_stada() x),
                        '7.0 U: engin stofa');
  j := pg_temp.talning(v_hlutir, null, null);
  select string_agg(x || ' ' || (j ->> x), ', ') into t from unnest(v_hlutir) x
   where (j ->> x)::bigint > case when x = 'public.notendur' then 1 else 0 end;
  perform pg_temp.buast(t is null and (select count(*) from notendur where id = v_u) = 1,
                        '7.1 U sér bara eigin notendalínu' || coalesce(' (' || t || ')', ''));
  perform pg_temp.hafnad(format('insert into taskar (fyrirtaeki_id, titill) values (%L, %L)', v_f_t, 'x'), '7.2 U: verk á Tveir');
  perform pg_temp.hafnad($$insert into fyrirtaeki (nafn) values ('U ehf')$$, '7.3 U: fyrirtæki');
  perform pg_temp.hafnad($$insert into kerfisstillingar (lykill, gildi) values ('gjaldmidill', 'USD')$$, '7.4 U: kerfisstilling');
  perform pg_temp.haetta();

  -- ======================================================================
  -- 8. service_role (Edge Functions)
  -- ======================================================================
  perform pg_temp.sem(null, 'service_role');
  perform pg_temp.buast(min_stofa() is null and not er_admin(), '8.0 service_role á enga stofu');
  perform pg_temp.buast(has_function_privilege('service_role', 'public.min_stofa()', 'execute')
                        and has_function_privilege('service_role', 'public.tveir_stofa()', 'execute')
                        and has_function_privilege('authenticated', 'public.tveir_stofa()', 'execute')
                        and not has_function_privilege('anon', 'public.tveir_stofa()', 'execute'),
                        '8.0 min_stofa og tveir_stofa: service_role og authenticated (skoðanirnar), ekki anon');
  perform pg_temp.buast(tenging_lykill(v_profun, 'claude') ->> 'lykill' = 'sk-prof-profun-0000-QRST'
                        and tenging_lykill(v_profun, 'claude') is distinct from tenging_lykill(v_tveir, 'claude'),
                        '8.1 tenging_lykill(stofa, veita) skilar lykli profun, ekki Tveir');
  perform skra_tengingarprufu(v_profun, 'claude', 'prof ok');
  perform pg_temp.hafnad(format('select skra_bod(%L, %L, null, %L, %L, null, false)', v_profun, 'x@profun.example', 'vidskiptavinur', v_f_t),
                         '8.2 skra_bod á fyrirtæki Tveir');
  perform pg_temp.buast(skra_bod(v_profun, 'nyr@profun.example', 'Nýr', 'vidskiptavinur', v_f_b, v_admin_b, false) is not null,
                        '8.3 skra_bod í eigin stofu');
  perform pg_temp.hafnad(format('select tengja_notanda_stofu(%L, %L, %L, null)', v_admin_t, v_profun, 'admin'),
                         '8.4 tengja_notanda_stofu: notandi Tveir');
  perform pg_temp.hafnad(format('select tengja_notanda_stofu(%L, %L, %L, %L)', v_u, v_profun, 'vidskiptavinur', v_f_t),
                         '8.5 tengja_notanda_stofu á fyrirtæki Tveir');
  perform pg_temp.buast((select x.id = v_admin_b and x.stofa_id = v_profun from notandi_til('ADMIN-B@profun.example') x),
                        '8.6 notandi_til');
  perform pg_temp.buast(vista_oauth_tengingu(v_profun, 'google', '{}'::jsonb, '{"access_token": "prof-token-abcd1234"}'::jsonb),
                        '8.7 vista_oauth_tengingu (profun)');
  perform pg_temp.hafnad(format('select vista_oauth_tengingu(%L, %L, %L::jsonb, %L::jsonb)', v_profun, 'payday', '{}', '{"access_token": "x12345"}'),
                         '8.8 vista_oauth_tengingu neitar payday');
  perform pg_temp.buast(skra_notkun(v_profun, 'gervigreind', 1) and not skra_notkun(v_profun, 'gervigreind', 1), '8.9 skra_notkun og þakið');
  j := utflutningur_stofu(v_profun);
  perform pg_temp.buast(position(v_tveir::text in j::text) = 0 and position(v_f_t::text in j::text) = 0
                        and position(v_admin_t::text in j::text) = 0
                        and not exists (select 1 from jsonb_each(j) e
                                         cross join lateral jsonb_array_elements(case when jsonb_typeof(e.value) = 'array' then e.value else '[]'::jsonb end) x
                                         where x ? 'stofa_id' and x ->> 'stofa_id' <> v_profun::text)
                        and jsonb_array_length(j -> 'taskar') >= 3,
                        '8.10 utflutningur_stofu: bara profun');
  perform pg_temp.hafnad(format('select eyda_stofu_gogn(%L)', v_tveir), '8.11 eyda_stofu_gogn(Tveir)');
  perform pg_temp.hafnad($$select stofna_stofu('Tveir 2', 'tveir', 'x@tveir.example', null, '{}'::jsonb, 'virk', null)$$, '8.12 stofna_stofu með slóðinni tveir');
  -- myndband_ur_faerslu athugar ekki sjálft að færsla og myndband séu í sömu stofu
  -- (gikkirnir sem kalla það gera það): enginn í API nema service_role má kalla það
  perform pg_temp.buast(not has_function_privilege('anon', 'public.myndband_ur_faerslu(uuid,uuid)', 'execute')
                        and not has_function_privilege('authenticated', 'public.myndband_ur_faerslu(uuid,uuid)', 'execute')
                        and not has_function_privilege('service_role', 'public.myndband_ur_faerslu(uuid,uuid)', 'execute')
                        and not has_function_privilege('anon', 'public.reikna_framvindu(uuid)', 'execute')
                        and not has_function_privilege('authenticated', 'public.reikna_framvindu(uuid)', 'execute'),
                        '8.13 myndband_ur_faerslu: enginn í API; reikna_framvindu: hvorki anon né innskráðir');
  perform reikna_framvindu(v_verk_b);
  perform pg_temp.buast(tolu_gildi('12') = 12 and postholf_lykill_ok(v_tk) and not postholf_lykill_ok(v_vk) and not postholf_lykill_ok(v_rk),
                        '8.14 reikna_framvindu, tolu_gildi, postholf_lykill_ok');
  perform pg_temp.hafnad('select * from stofur_yfirlit()', '8.15 stofur_yfirlit (service_role er ekki rekstraraðili)');
  select string_agg(x, ', ') into t from unnest(v_skodanir) x
   where pg_temp.tala(format('select count(*) from %s where stofa_id is distinct from %L', x, v_tveir)) <> 0;
  perform pg_temp.buast(t is null, '8.16 skoðanirnar fyrir Make (service_role) sýna bara Tveir' || coalesce(' (' || t || ')', ''));
  perform pg_temp.buast(afhending_ma_lesa(v_slod_b) is not true and undirverk_skra_opin(v_slod_b) is not true, '8.17 afhending_ma_lesa og undirverk_skra_opin án notanda');
  -- Gömlu umbúðirnar (ef 3b er ekki keyrt): bara Tveir; prufan prófuð í undirfærslu sem er afturkölluð
  if to_regprocedure('public.tenging_lykill(text)') is not null then
    execute $$select tenging_lykill('claude')$$ into j;
    perform pg_temp.buast(j is not distinct from tenging_lykill(v_tveir, 'claude'), '8.18 tenging_lykill(text) skilar lykli Tveir');
  end if;
  if to_regprocedure('public.skra_tengingarprufu(text,text)') is not null then
    begin
      execute $$select skra_tengingarprufu('claude', 'prof-umbudir')$$;
      perform pg_temp.buast((select prufa_svar from tengingar where stofa_id = v_profun and veita = 'claude') = 'prof ok',
                            '8.19 skra_tengingarprufu(text,text) snertir ekki profun');
      raise exception 'prof-stofur: umbudir';
    exception when raise_exception then
      if sqlerrm <> 'prof-stofur: umbudir' then raise; end if;
    end;
  end if;
  -- Tákn gervigreindar lögð við í einni setningu (skra_tokn); telur ekki köll
  perform skra_tokn(v_profun, 'gervigreind', 100, 7);
  perform skra_tokn(v_profun, 'gervigreind', 50, 3);
  perform skra_tokn(v_profun, 'gervigreind', -5, null);
  perform skra_tokn(null, 'gervigreind', 1, 1);
  perform skra_tokn(gen_random_uuid(), 'gervigreind', 1, 1);
  perform pg_temp.buast((select k.tokn_inn = 150 and k.tokn_ut = 10 and k.fjoldi = 1 from notkun k
                          where k.stofa_id = v_profun and k.dags = current_date and k.tegund = 'gervigreind')
                        and not exists (select 1 from notkun k where k.stofa_id not in (select s2.id from stofur s2))
                        and not has_function_privilege('anon', 'public.skra_tokn(uuid,text,bigint,bigint)', 'execute')
                        and not has_function_privilege('authenticated', 'public.skra_tokn(uuid,text,bigint,bigint)', 'execute'),
                        '8.21 skra_tokn leggur tákn við (150 og 10), fjoldi óbreyttur, óþekkt stofa ekkert, bara service_role');
  -- Þjónustan án stofa_id: fyrirspurnir fara til Tveir (Make, stofna-stofu), aðrar töflur hafna
  b := false; s := null;
  begin
    insert into fyrirspurnir (nafn, netfang, skilabod, form) values ('Prófun þjónusta', 'thjonusta@profun.example', 'x', 'prof')
    returning stofa_id into u;
    b := u = v_tveir;
    raise exception 'prof-stofur: thjonusta';
  exception when others then
    if sqlerrm <> 'prof-stofur: thjonusta' then b := false; s := sqlerrm; end if;
  end;
  perform pg_temp.buast(b, '8.22 service_role: fyrirspurn án stofa_id fer til Tveir' || coalesce(' (' || s || ')', ''));
  s := pg_temp.hafnad($$insert into taxtar (heiti, eining, upphaed) values ('Prófun', 'klst', 1)$$, '8.23 service_role: taxti án stofa_id');
  perform pg_temp.buast(s like '%Línuna vantar stofu%', '8.24 taxti án stofa_id stöðvaður af erfa_stofu (' || left(s, 80) || ')');
  perform pg_temp.haetta();
  perform pg_temp.buast((select prufa_svar from tengingar where stofa_id = v_profun and veita = 'claude') = 'prof ok'
                        and (select md5(coalesce(string_agg(concat_ws('|', g.veita, g.lykill_id, g.sidustu4, g.stillingar, g.uppfaert, g.prufad,
                                                                      g.prufa_svar, md5(coalesce(d.decrypted_secret, ''))), ';' order by g.veita), ''))
                               from tengingar g left join vault.decrypted_secrets d on d.id = g.lykill_id where g.stofa_id = v_tveir) = v_teng_t
                        and exists (select 1 from tengingar where stofa_id = v_profun and veita = 'google'),
                        '8.20 tengingar Tveir óbreyttar eftir skra_tengingarprufu og vista_oauth_tengingu í profun');

  -- ======================================================================
  -- 9. Rekstraraðili (ef stjórnandi Tveir er það): lýsigögn, hver aðgerð í rekstur_log
  -- ======================================================================
  if v_rekstur_t then
    perform pg_temp.sem(v_admin_t);
    perform pg_temp.buast((select count(*) from stofur_yfirlit() x where x.slug = 'profun' and x.notendur = 2) = 1,
                          '9.1 stofur_yfirlit sýnir profun (bara lýsigögn og fjöldi)');
    perform pg_temp.buast(loka_stofu('profun', 'prof-stofur') and opna_stofu('profun')
                          and postur_ut('profun', false) and postur_ut('profun', true),
                          '9.2 loka_stofu, opna_stofu og postur_ut');
    perform pg_temp.hafnad($$select samthykkja_stofu('profun')$$, '9.3 samthykkja_stofu á virka stofu');
    perform pg_temp.hafnad($$select loka_stofu('tveir', 'x')$$, '9.4 loka_stofu(tveir)');
    perform pg_temp.haetta();
    s := (select gildi from stillingar_innri where lykill = 'skraning_opin');
    perform pg_temp.sem(v_admin_t);
    perform pg_temp.buast(stilla_skraningu(coalesce(s, 'nei') = 'ja'), '9.5 stilla_skraningu (sama gildi aftur)');
    perform pg_temp.haetta();
    perform pg_temp.buast((select count(*) from rekstur_log where stofa_id = v_profun and adgerd in ('loka_stofu', 'opna_stofu', 'postur_ut')) = 4
                          and (select stada from stofur where id = v_profun) = 'virk'
                          and (select gildi from stillingar_innri where lykill = 'skraning_opin') is not distinct from coalesce(s, 'nei'),
                          '9.6 aðgerðirnar skráðar í rekstur_log');
  else
    raise notice 'Enginn stjórnandi Tveir er rekstraraðili: kafli 9 sleppt (föllin prófuð sem stjórnandi B í 5.49 til 5.54)';
  end if;

  -- ======================================================================
  -- 10. Lyklar Apps Script (anon með lykil, kafli 11.3 atriði 14 til 16)
  -- ======================================================================
  -- 14. Lykill Tveir
  perform pg_temp.sem(null, 'anon');
  j := midlar_til_soefnunar(v_tk);
  n := skra_maelingar(v_tk, jsonb_build_array(jsonb_build_object('midill_id', v_midill_b, 'dags', current_date, 'fylgjendur', 999)));
  n2 := skra_faerslur(v_tk, jsonb_build_array(jsonb_build_object('midill_id', v_midill_b, 'ytra_id', 'prof-tveir-lykill')));
  j2 := taskur_ur_posti(v_tk, 'klient-b@profun.example', 'Prófun', 'Lína eitt');
  n3 := dagatal_skra(v_tk, '[]'::jsonb, '1990-03-01', '1990-06-01');
  j3 := lokid_otilkynnt(v_tk);
  j4 := undirverk_otilkynnt(v_tk);
  j5 := manadar_tolur(v_tk, current_date);
  u := vista_skyrslu(v_tk, v_f_b, (current_date - interval '3 months')::date, '{}'::jsonb, 'x');
  j6 := skyrslur_til_sendingar(v_tk);
  j7 := tolfraedi_sendingar_til(v_tk);
  j8 := postholf_svor_til(v_tk);
  b := merkja_postholf_svar(v_tk, v_svar_b, null) or merkja_tolfraedi_sendingu(v_tk, v_sending_b, null);
  t := afhending_slod_heimild(v_tk, v_undirverk_b);
  j9 := postur_inn(v_tk, 'profun@verk.tveir.is', 'klient-b@profun.example', 'B', 'x', 'y', 'prof-thr-2', true, null);
  perform pg_temp.buast(merkja_tilkynnt(v_tk, array[v_task_b_lokid]) = 0 and merkja_undirverk_sent(v_tk, array[v_undirverk_b]) = 0
                        and merkja_skyrslu_senda(v_tk, array[v_skyrsla_b_samth]) = 0
                        and postholf_skra(v_tk, jsonb_build_array(jsonb_build_object('id', v_thradur_b, 'sidast', now(), 'efni', 'Yfirtekið',
                                                                                     'fra_netfang', 'x@y.example'))) = 0,
                        '10.1 lykill Tveir merkir ekkert og skrifar ekkert í profun');
  perform pg_temp.haetta();
  perform pg_temp.buast(not exists (select 1 from jsonb_array_elements(j) x join midlar m on m.id = (x ->> 'id')::uuid where m.stofa_id <> v_tveir),
                        '10.2 lykill Tveir: midlar_til_soefnunar án annarra stofa');
  perform pg_temp.buast(n = 0 and n2 = 0 and not exists (select 1 from maelingar where midill_id = v_midill_b and fylgjendur = 999)
                        and not exists (select 1 from midla_faerslur where ytra_id = 'prof-tveir-lykill'),
                        '10.3 lykill Tveir: skra_maelingar og skra_faerslur á miðil profun skila 0');
  perform pg_temp.buast(j2 ->> 'villa' = 'othekktur', '10.4 lykill Tveir: taskur_ur_posti frá viðskiptavini B skilar othekktur');
  perform pg_temp.buast(n3 = 0 and exists (select 1 from dagatal_atburdir where stofa_id = v_profun and id = 'prof-gcal-1990'),
                        '10.5 lykill Tveir: dagatal_skra lætur atburði profun vera');
  perform pg_temp.buast(not exists (select 1 from jsonb_array_elements(j3) x join taskar k on k.id = (x ->> 'id')::uuid where k.stofa_id <> v_tveir)
                        and not exists (select 1 from jsonb_array_elements(j4) x join undirverk k on k.id = (x ->> 'id')::uuid where k.stofa_id <> v_tveir),
                        '10.6 lykill Tveir: lokid_otilkynnt og undirverk_otilkynnt án annarra stofa');
  perform pg_temp.buast(not exists (select 1 from jsonb_array_elements(j5) x join fyrirtaeki f on f.id = (x ->> 'fyrirtaeki_id')::uuid where f.stofa_id <> v_tveir)
                        and u is null,
                        '10.7 lykill Tveir: manadar_tolur án annarra stofa, vista_skyrslu á profun neitað');
  perform pg_temp.buast(not exists (select 1 from jsonb_array_elements(j6) x join skyrslur k on k.id = (x ->> 'id')::uuid where k.stofa_id <> v_tveir)
                        and not exists (select 1 from jsonb_array_elements(j7) x join tolfraedi_sendingar k on k.id = (x ->> 'id')::uuid where k.stofa_id <> v_tveir)
                        and not exists (select 1 from jsonb_array_elements(j8) x join postholf_svor k on k.id = (x ->> 'id')::uuid where k.stofa_id <> v_tveir)
                        and not b and t is null and j9 ->> 'villa' = 'lykill',
                        '10.8 lykill Tveir: skýrslur, sendingar, svör, afhending og postur_inn án profun');
  perform pg_temp.buast((select x.efni = 'Fyrirspurn' and x.stofa_id = v_profun from postholf_thraedir x where x.id = v_thradur_b)
                        and (select tilkynnt_lokid is null from taskar where id = v_task_b_lokid)
                        and (select sent_dags is null from undirverk where id = v_undirverk_b)
                        and (select stada = 'samthykkt' from skyrslur where id = v_skyrsla_b_samth)
                        and (select stada = 'bidur' from postholf_svor where id = v_svar_b),
                        '10.9 lykill Tveir: þráður, verk, undirverk, skýrsla og svar profun óbreytt');

  -- 15. Lykill vélarinnar (allar stofur með sendir_fra = verk, aldrei Tveir)
  perform pg_temp.sem(null, 'anon');
  n := postholf_skra(v_vk, '[]'::jsonb);
  n2 := dagatal_skra(v_vk, '[]'::jsonb, now() - interval '1 day', now());
  j := postholf_svor_til(v_vk);
  b := merkja_postholf_svar(v_vk, coalesce(v_svar_t, v_svar_b), null);
  j2 := lokid_otilkynnt(v_vk);
  j3 := undirverk_otilkynnt(v_vk);
  n3 := merkja_tilkynnt(v_vk, v_lokid_t) + merkja_undirverk_sent(v_vk, v_undirverk_t_oll) + merkja_skyrslu_senda(v_vk, v_samth_t);
  j4 := taskur_ur_posti(v_vk, coalesce(v_netfang_klient_t, 'enginn@tveir.example'), 'x', 'y');
  j5 := midlar_til_soefnunar(v_vk);
  j6 := manadar_tolur(v_vk, current_date);
  j7 := skyrslur_til_sendingar(v_vk);
  j8 := tolfraedi_sendingar_til(v_vk);
  u := vista_skyrslu(v_vk, v_f_t, (current_date - interval '3 months')::date, '{}'::jsonb, 'x');
  u2 := vista_skyrslu(v_vk, v_f_b, (current_date - interval '3 months')::date, '{}'::jsonb, 'Prófun vél');
  s := afhending_slod_heimild(v_vk, coalesce(v_undirverk_t, gen_random_uuid()));
  t := afhending_slod_heimild(v_vk, v_undirverk_b);
  b2 := (v_sending_t is not null and merkja_tolfraedi_sendingu(v_vk, v_sending_t, null))
        or (v_midill_t is not null and (skra_maelingar(v_vk, jsonb_build_array(jsonb_build_object('midill_id', v_midill_t, 'dags', current_date, 'fylgjendur', 1))) > 0
                                        or skra_faerslur(v_vk, jsonb_build_array(jsonb_build_object('midill_id', v_midill_t, 'ytra_id', 'prof-vel'))) > 0));
  j9 := postur_inn(v_vk, 'verk@tveir.is', 'klient-b@profun.example', 'B', 'Efni', 'Texti', 'prof-thr-3', true, null);
  j10 := postur_inn(v_vk, 'tveir@verk.tveir.is', 'klient-b@profun.example', 'B', 'Efni', 'Texti', 'prof-thr-3', true, null);
  j11 := postur_inn(v_vk, 'profun@verk.tveir.is', 'klient-b@profun.example', 'B', 'Verk úr pósti', 'Lína eitt', 'prof-thr-4', true, null);
  j12 := postur_inn(v_vk, 'profun@verk.tveir.is', 'klient-b@profun.example', 'B', 'x', 'y', 'prof-thr-5', false, null);
  j13 := postur_inn(v_vk, 'profun@verk.tveir.is', v_netfang_admin_t, 'T', 'Frá Tveir', 'Texti', 'prof-thr-6', true, null);
  perform pg_temp.haetta();
  perform pg_temp.buast(n = -1 and n2 = -1 and j = '[]'::jsonb and not b and j4 ->> 'villa' = 'lykill' and j5 = '[]'::jsonb and not b2,
                        '10.10 lykill vélarinnar: ekkert pósthólf, dagatal, tölfræði eða taskur_ur_posti');
  perform pg_temp.buast(exists (select 1 from jsonb_array_elements(j2) x where (x ->> 'id')::uuid = v_task_b_lokid)
                        and not exists (select 1 from jsonb_array_elements(j2) x join taskar k on k.id = (x ->> 'id')::uuid where k.stofa_id = v_tveir),
                        '10.11 lykill vélarinnar: lokid_otilkynnt með profun, án Tveir');
  perform pg_temp.buast(exists (select 1 from jsonb_array_elements(j3) x where (x ->> 'id')::uuid = v_undirverk_b)
                        and not exists (select 1 from jsonb_array_elements(j3) x join undirverk k on k.id = (x ->> 'id')::uuid where k.stofa_id = v_tveir),
                        '10.12 lykill vélarinnar: undirverk_otilkynnt með profun, án Tveir');
  perform pg_temp.buast(n3 = 0, '10.13 lykill vélarinnar merkir ekkert hjá Tveir');
  perform pg_temp.buast(exists (select 1 from jsonb_array_elements(j6) x where (x ->> 'fyrirtaeki_id')::uuid = v_f_b)
                        and not exists (select 1 from jsonb_array_elements(j6) x join fyrirtaeki f on f.id = (x ->> 'fyrirtaeki_id')::uuid where f.stofa_id = v_tveir),
                        '10.14 lykill vélarinnar: manadar_tolur með profun, án Tveir');
  perform pg_temp.buast(exists (select 1 from jsonb_array_elements(j7) x where (x ->> 'id')::uuid = v_skyrsla_b_samth)
                        and not exists (select 1 from jsonb_array_elements(j7) x join skyrslur k on k.id = (x ->> 'id')::uuid where k.stofa_id = v_tveir)
                        and exists (select 1 from jsonb_array_elements(j8) x where (x ->> 'id')::uuid = v_sending_b)
                        and not exists (select 1 from jsonb_array_elements(j8) x join tolfraedi_sendingar k on k.id = (x ->> 'id')::uuid where k.stofa_id = v_tveir),
                        '10.15 lykill vélarinnar: skýrslur og tölfræðisendingar profun, ekki Tveir');
  perform pg_temp.buast(u is null and u2 is not null and (select stofa_id from skyrslur where id = u2) = v_profun,
                        '10.16 lykill vélarinnar: vista_skyrslu á Tveir neitað, á profun gengur');
  perform pg_temp.buast(s is null and t = v_slod_b, '10.17 lykill vélarinnar: afhending_slod_heimild skrá profun, ekki Tveir');
  perform pg_temp.buast(j9 ->> 'villa' = 'lokud' and j10 ->> 'villa' = 'engin_stofa', '10.18 postur_inn til Tveir (lokud) og tveir@verk.tveir.is (engin_stofa)');
  perform pg_temp.buast(j11 ->> 'tegund' = 'verk' and (j11 ->> 'fjoldi')::int = 1
                        and (select count(*) from taskar where stofa_id = v_profun and postur_thradur = 'prof-thr-4' and fyrirtaeki_id = v_f_b) = 1
                        and not exists (select 1 from taskar where postur_thradur = 'prof-thr-4' and stofa_id <> v_profun),
                        '10.19 postur_inn frá viðskiptavini B: verk í profun');
  perform pg_temp.buast(j12 ->> 'villa' = 'oaudkenndur', '10.20 postur_inn óauðkenndur: ekkert verk');
  perform pg_temp.buast(j13 ->> 'villa' = 'othekktur'
                        and exists (select 1 from postholf_thraedir where id = 'v:profun:prof-thr-6' and stofa_id = v_profun)
                        and not exists (select 1 from postholf_thraedir where id like '%prof-thr-6%' and stofa_id <> v_profun),
                        '10.21 postur_inn frá stjórnanda Tveir til profun: Verkpóstur í profun, ekkert hjá Tveir');

  -- 16. Rangur lykill og enginn lykill: hvert lyklafall skilar tómu
  perform pg_temp.sem(null, 'anon');
  foreach s in array array[v_rk, null] loop
    perform pg_temp.buast(lokid_otilkynnt(s) = '[]'::jsonb and merkja_tilkynnt(s, array[v_task_b_lokid]) = 0
                          and undirverk_otilkynnt(s) = '[]'::jsonb and merkja_undirverk_sent(s, array[v_undirverk_b]) = 0
                          and midlar_til_soefnunar(s) = '[]'::jsonb
                          and skra_maelingar(s, jsonb_build_array(jsonb_build_object('midill_id', v_midill_b, 'dags', current_date, 'fylgjendur', 1))) = 0
                          and skra_faerslur(s, jsonb_build_array(jsonb_build_object('midill_id', v_midill_b, 'ytra_id', 'x'))) = 0
                          and manadar_tolur(s, current_date) = '[]'::jsonb
                          and vista_skyrslu(s, v_f_b, current_date, '{}'::jsonb, 'x') is null
                          and skyrslur_til_sendingar(s) = '[]'::jsonb and merkja_skyrslu_senda(s, array[v_skyrsla_b_samth]) = 0
                          and tolfraedi_sendingar_til(s) = '[]'::jsonb and not merkja_tolfraedi_sendingu(s, v_sending_b, null)
                          and postholf_skra(s, '[]'::jsonb) = -1 and postholf_svor_til(s) = '[]'::jsonb
                          and not merkja_postholf_svar(s, v_svar_b, null)
                          and dagatal_skra(s, '[]'::jsonb, now() - interval '1 day', now()) = -1
                          and taskur_ur_posti(s, 'klient-b@profun.example', 'x', 'y') ->> 'villa' = 'lykill'
                          and postur_inn(s, 'profun@verk.tveir.is', 'klient-b@profun.example', 'B', 'x', 'y', 'z', true, null) ->> 'villa' = 'lykill'
                          and afhending_slod_heimild(s, v_undirverk_b) is null,
                          '10.22 ' || case when s is null then 'enginn lykill' else 'rangur lykill' end || ': hvert lyklafall skilar tómu');
  end loop;
  perform pg_temp.haetta();

  -- ======================================================================
  -- 11. anon (vefform)
  -- ======================================================================
  perform pg_temp.sem(null, 'anon');
  insert into fyrirspurnir (stofa_id, nafn, netfang, skilabod) values (v_profun, 'prof-anon-' || v_merki, 'a@b.example', 'x');
  j := skra_fyrirspurn(v_form_b, jsonb_build_object('nafn', 'prof-form-' || v_merki, 'netfang', 'f@b.example'));
  j2 := skra_fyrirspurn(v_rk, jsonb_build_object('nafn', 'prof-rangt-' || v_merki));
  j3 := pg_temp.talning(v_hlutir, null, null);
  select string_agg(x || ' ' || (j3 ->> x), ', ') into t from unnest(v_hlutir) x where (j3 ->> x)::bigint > 0;
  perform pg_temp.buast(t is null, '11.1 anon les ekkert (allar töflur, skoðanir og geymslan)' || coalesce(' (' || t || ')', ''));
  perform pg_temp.hafnad('select min_stofa()', '11.2 anon: min_stofa');
  perform pg_temp.hafnad('select er_admin()', '11.3 anon: er_admin');
  perform pg_temp.hafnad('select * from min_stada()', '11.4 anon: min_stada');
  perform pg_temp.hafnad('select * from tengingar_stada()', '11.5 anon: tengingar_stada');
  perform pg_temp.hafnad(format('select tenging_lykill(%L, %L)', v_tveir, 'claude'), '11.6 anon: tenging_lykill');
  perform pg_temp.hafnad(format('select verk_ur_thraedi(%L, %L)', v_thradur_b, v_f_b), '11.7 anon: verk_ur_thraedi');
  perform pg_temp.hafnad($$select stofna_stofu('x', 'xyz', 'x@y.example', null, '{}'::jsonb, 'virk', null)$$, '11.8 anon: stofna_stofu');
  perform pg_temp.haetta();
  perform pg_temp.buast((select stofa_id from fyrirspurnir where nafn = 'prof-anon-' || v_merki) = v_tveir,
                        '11.9 anon beint í fyrirspurnir (fyrirspurnir_vefur): alltaf Tveir, stofa_id hunsuð');
  perform pg_temp.buast((j ->> 'ok')::boolean and (select stofa_id from fyrirspurnir where nafn = 'prof-form-' || v_merki) = v_profun,
                        '11.10 skra_fyrirspurn með vefform_lykill profun: lendir í profun');
  perform pg_temp.buast(j2 ->> 'villa' = 'lykill' and not exists (select 1 from fyrirspurnir where nafn = 'prof-rangt-' || v_merki),
                        '11.11 skra_fyrirspurn með röngum lykli: ekkert');
  delete from fyrirspurnir where nafn = 'prof-anon-' || v_merki;

  -- ======================================================================
  -- 12. Lokuð stofa: enginn í profun sér neitt, póstvélin hættir
  -- ======================================================================
  update stofur set stada = 'lokud' where id = v_profun;
  foreach u in array array[v_admin_b, v_klient_b] loop
    perform pg_temp.sem(u);
    j := pg_temp.talning(v_hlutir, null, null);
    select string_agg(x || ' ' || (j ->> x), ', ') into t from unnest(v_hlutir) x
     where (j ->> x)::bigint > case when x = 'public.notendur' then 1 else 0 end;
    perform pg_temp.buast(t is null and not er_admin() and min_stofa() is null and mitt_fyrirtaeki() is null
                          and (select x.stada = 'lokud' and not x.er_admin from min_stada() x),
                          '12.1 lokuð stofa: ' || case when u = v_admin_b then 'stjórnandi B' else 'viðskiptavinur B' end
                          || ' sér bara eigin notendalínu' || coalesce(' (' || t || ')', ''));
  end loop;
  perform pg_temp.sem(null, 'anon');
  j := lokid_otilkynnt(v_vk);
  j2 := postur_inn(v_vk, 'profun@verk.tveir.is', 'klient-b@profun.example', 'B', 'x', 'y', 'prof-thr-7', true, null);
  j3 := undirverk_otilkynnt(v_vk);
  perform pg_temp.haetta();
  perform pg_temp.buast(not exists (select 1 from jsonb_array_elements(j) x join taskar k on k.id = (x ->> 'id')::uuid where k.stofa_id = v_profun)
                        and not exists (select 1 from jsonb_array_elements(j3) x join undirverk k on k.id = (x ->> 'id')::uuid where k.stofa_id = v_profun)
                        and j2 ->> 'villa' = 'lokud',
                        '12.2 lokuð stofa: póstvélin sér ekkert og tekur ekki við pósti');
  update stofur set stada = 'virk' where id = v_profun;

  -- ======================================================================
  -- 13. Eyðing profun: ekkert eftir, gögn Tveir nákvæmlega eins og í upphafi
  -- ======================================================================
  perform pg_temp.sem(null, 'service_role');
  j := eyda_stofu_gogn(v_profun);
  perform pg_temp.haetta();
  select string_agg(x, ', ') into t from unnest(v_toflur || array['bod', 'reikningsdrog', 'verk_netfong', 'notkun', 'postur_inn_log', 'oauth_stada']) x
   where pg_temp.tala(format('select count(*) from public.%I where stofa_id = %L', x, v_profun)) <> 0;
  perform pg_temp.buast(t is null and not exists (select 1 from stofur where id = v_profun)
                        and not exists (select 1 from vault.secrets where name like 'glerhus_tenging_' || v_profun || '%'),
                        '13.1 eyda_stofu_gogn: ekkert eftir af profun' || coalesce(' (' || t || ')', ''));
  j := pg_temp.fingur(v_toflur, v_tveir);
  perform pg_temp.buast(pg_temp.munur(v_fingur, j) is null,
                        '13.2 gögn Tveir í 30 töflunum nákvæmlega eins og í upphafi prófsins' || coalesce(' (breytt: ' || pg_temp.munur(v_fingur, j) || ')', ''));

  -- ======================================================================
  -- 14. Afturköllun R5 og samanburður við afritið (bara meðan R5 gildir)
  -- ======================================================================
  -- R5 neitar meðan önnur stofa er virk eða á gögn, svo hún er bara prófuð þegar engin önnur er til
  if to_regnamespace('afrit_20261123') is not null
     and not exists (select 1 from stofur where slug <> 'tveir') then
    if to_regclass('afrit_20261123.skref5_reglur') is not null then
      execute $q$select md5(coalesce(string_agg(concat_ws('|', permissive, roles::text, cmd, qual, with_check), ';'), ''))
                   from afrit_20261123.skref5_reglur where schemaname = 'storage' and policyname = 'merki_les'$q$ into v_r5_merki;
      execute $q$select md5(coalesce(string_agg(concat_ws('|', id, public, file_size_limit, allowed_mime_types::text), ';' order by id), ''))
                   from afrit_20261123.skref5_fotur$q$ into v_r5_fotur;
    end if;
    execute v_r5;
    perform pg_temp.buast(not exists (select 1 from pg_policies where policyname in ('stofa_vegg', 'stofa_skrar'))
                          and exists (select 1 from stillingar_innri where lykill = 'stofa_vara' and gildi = v_tveir::text)
                          and to_regclass('afrit_20261123.skref5_reglur') is null,
                          '14.1 R5: veggirnir af, stofa_vara aftur, skyndimyndin felld');
    if v_r5_merki is not null then
      perform pg_temp.buast((select md5(coalesce(string_agg(concat_ws('|', permissive, roles::text, cmd, qual, with_check), ';'), ''))
                               from pg_policies where schemaname = 'storage' and policyname = 'merki_les') = v_r5_merki
                            and (select md5(coalesce(string_agg(concat_ws('|', id, public, file_size_limit, allowed_mime_types::text), ';' order by id), ''))
                                   from storage.buckets where id in ('merki', 'vidhengi')) = v_r5_fotur,
                            '14.2 R5: merki_les og takmörk fatnanna eins og fyrir skref 5');
    end if;
    -- Spec skref 4: reglurnar í public (töflur skrefs 0) og storage eins og í afrit_20261123.reglur
    execute $q$select count(*) from (
                 select policyname, schemaname, tablename, permissive, roles::text, cmd, qual, with_check from pg_policies
                  where schemaname = 'storage' or (schemaname = 'public' and tablename in (select tafla from afrit_20261123.fjoldi))
                 except
                 select policyname, schemaname, tablename, permissive, roles::text, cmd, qual, with_check from afrit_20261123.reglur) x$q$ into n;
    execute $q$select count(*) from (
                 select policyname, schemaname, tablename, permissive, roles::text, cmd, qual, with_check from afrit_20261123.reglur
                 except
                 select policyname, schemaname, tablename, permissive, roles::text, cmd, qual, with_check from pg_policies
                  where schemaname = 'storage' or (schemaname = 'public' and tablename in (select tafla from afrit_20261123.fjoldi))) x$q$ into n2;
    perform pg_temp.buast(n = 0 and n2 = 0, format('14.3 eftir R5 eru reglurnar eins og í afrit_20261123.reglur (%s og %s raðir mismunandi)', n, n2));
    execute v_vordur;
    perform pg_temp.buast(true, '14.4 vörðurinn stenst eftir R5 (fyrir skref 5)');
  else
    raise notice 'R5 ekki prófuð: afritið er horfið (skref 7) eða önnur stofa er til (eftir skref 6).';
  end if;

  raise exception 'PROF-STOFUR STÓÐST: % fullyrðingar, %. Ekkert vistað.',
    current_setting('prof_stofur.fjoldi'),
    case when v_veggur_var then 'veggirnir á live prófaðir' else 'veggir skrefs 5 settir á innan prófsins og R5 prófuð' end;
end $prof$;
