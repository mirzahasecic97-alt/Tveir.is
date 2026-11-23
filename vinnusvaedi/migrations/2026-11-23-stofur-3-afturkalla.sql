-- ==========================================================================
-- Stofur, afturköllun R3: tekur skref 3 (og 3b) til baka.
--
-- Setur aftur nákvæmlega stöðuna rétt fyrir skref 3, eins og skref 3 skráði
-- hana í afrit_20261123.skref3_* í fyrstu keyrslu:
--   * öll föll í public: ný föll skrefs 3 felld, skilgreiningar og réttindi
--     hinna eins og þau voru (líka tenging_lykill(text) og
--     skra_tengingarprufu(text,text) ef 3b felldi þau, og föll skrefs 1 sem
--     skref 3 breytti, til dæmis verja_stofu og réttindi min_stofa),
--   * frumlyklar og skorður kerfisstillingar, tengingar og dagatal_atburdir,
--   * skoðanirnar fjórar (með valkostum og réttindum),
--   * sjálfgefin réttindi á föllum í public,
--   * gikkir sem keyra ný föll skrefs 3 (verja_task_vidskiptavinar) felldir.
-- Sama niðurstaða og myndaðar afturkalla-foll.sql, afturkalla-lyklar.sql og
-- afturkalla-skodanir.sql úr skrefi 0b, en þarf ekki þær skrár og nær líka
-- breytingum skrefs 3 á föllum skrefs 1.
--
-- Gildir bara fram að skrefi 6. Stöðvast og breytir engu ef:
--   * veggirnir (skref 5) eru á: keyrið R5 fyrst,
--   * önnur stofa en Tveir er virk, eða fleiri en ein stofa á línur í
--     kerfisstillingar, tengingar eða dagatal_atburdir,
--   * lína brýtur gömlu skorðurnar (til dæmis vsk_hlutfall í kerfisstillingar
--     eða google tenging): þeim er ekki eytt sjálfkrafa, listinn er sýndur.
--
-- Röð afturkallana: R5, R3, R2, R1. Ein færsla. Má keyra aftur (ef skref 3 er
-- ekki á gerist ekkert). Í lokin er staðan borin saman við skyndimyndina og
-- skráin stöðvast ef eitthvað stemmir ekki.
-- ==========================================================================

do $r3$
declare
  r record;
  n bigint;
  t text;
  villur text[] := '{}';
  toflur text[] := array['kerfisstillingar', 'tengingar', 'dagatal_atburdir'];
begin
  if to_regclass('afrit_20261123.skref3_foll') is null then
    raise notice 'Skref 3 er ekki á (engin skyndimynd í afrit_20261123.skref3_foll). Engu breytt.';
    return;
  end if;

  -- ---------------------------------------------------------------- forsendur
  if exists (select 1 from pg_policies where schemaname in ('public', 'storage')
              and policyname in ('stofa_vegg', 'stofa_skrar')) then
    raise exception 'Veggirnir (skref 5) eru á: keyrið 2026-11-23-stofur-5-afturkalla.sql fyrst.';
  end if;
  select string_agg(s.slug, ', ') into t from public.stofur s where s.slug <> 'tveir' and s.stada = 'virk';
  if t is not null then
    raise exception 'Aðrar stofur en Tveir eru virkar (%): R3 gildir ekki lengur. Lokið þeim (stada = lokud) í staðinn.', t;
  end if;
  foreach t in array toflur loop
    execute format('select count(distinct stofa_id) from public.%I', t) into n;
    if n > 1 then
      villur := villur || format('%s: línur í %s stofum', t, n);
    end if;
  end loop;
  -- Línur sem gömlu skorðurnar (sama nafn, önnur skilgreining) myndu hafna
  for r in
    select l.tafla, l.conname, l.skilgreining from afrit_20261123.skref3_lyklar l
     where l.tegund = 'c'
       and not exists (select 1 from pg_constraint c where c.conrelid = ('public.' || quote_ident(l.tafla))::regclass
                         and c.conname = l.conname and pg_get_constraintdef(c.oid) = l.skilgreining)
  loop
    execute format('select count(*) from public.%I where not coalesce((%s), true)',
                   r.tafla, regexp_replace(r.skilgreining, '^CHECK\s*', '')) into n;
    if n > 0 then
      villur := villur || format('%s: %s línur brjóta %s (%s)', r.tafla, n, r.conname, r.skilgreining);
    end if;
  end loop;
  if coalesce(array_length(villur, 1), 0) > 0 then
    raise exception 'R3 stöðvast, ekkert breytt:%', e'\n' || array_to_string(villur, e'\n');
  end if;

  -- ---------------------------------------------------------------- skoðanir
  -- Felldar fyrst (þær nota föll og nýja dálka) og búnar til aftur eins og þær voru
  for r in select * from afrit_20261123.skref3_skodanir order by viewname loop
    execute format('drop view if exists public.%I', r.viewname);
    execute format('create view public.%I%s as %s', r.viewname,
                   case when r.valkostir is not null then ' with (' || array_to_string(r.valkostir, ', ') || ')' else '' end,
                   rtrim(r.definition, e'; \n'));
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', r.viewname);
    for t in
      select format('grant %s on public.%I to %s', a.privilege_type, r.viewname,
                    case when a.grantee = 0 then 'public' else quote_ident(g.rolname) end)
        from aclexplode(r.rettindi) a left join pg_roles g on g.oid = a.grantee
       where a.grantee <> (select c.relowner from pg_class c where c.relname = r.viewname
                             and c.relnamespace = 'public'::regnamespace)
    loop
      execute t;
    end loop;
  end loop;

  -- ---------------------------------------------------------------- föll
  -- Gikkir sem keyra ný föll skrefs 3 (verja_task_vidskiptavinar á taskar) fyrst út
  for r in
    select tg.tgname, tg.tgrelid::regclass::text tafla from pg_trigger tg join pg_proc p on p.oid = tg.tgfoid
     where not tg.tgisinternal and p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
       and not exists (select 1 from afrit_20261123.skref3_foll f where f.heiti = p.oid::regprocedure::text)
  loop
    execute format('drop trigger %I on %s', r.tgname, r.tafla);
  end loop;
  -- Ný föll (ekki í skyndimyndinni) felld
  for r in
    select p.oid::regprocedure::text heiti from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
       and not exists (select 1 from afrit_20261123.skref3_foll f where f.heiti = p.oid::regprocedure::text)
  loop
    execute format('drop function public.%s', r.heiti);
  end loop;
  -- Skilgreiningar sem breyttust settar aftur (og föll sem 3b felldi búin til aftur)
  for r in select * from afrit_20261123.skref3_foll order by heiti loop
    if not exists (select 1 from pg_proc p where p.oid = to_regprocedure('public.' || r.heiti)
                     and pg_get_functiondef(p.oid) = r.skilgreining) then
      begin
        execute r.skilgreining;
      exception when invalid_function_definition then
        execute format('drop function public.%s', r.heiti);
        execute r.skilgreining;
      end;
    end if;
  end loop;
  -- Réttindi þar sem þau eru önnur en í skyndimyndinni
  for r in
    select f.heiti, f.rettindi from afrit_20261123.skref3_foll f
      join pg_proc p on p.oid = to_regprocedure('public.' || f.heiti)
     where array(select x::text from unnest(coalesce(p.proacl, acldefault('f', p.proowner))) x order by 1)
           is distinct from array(select x::text from unnest(f.rettindi) x order by 1)
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', r.heiti);
    for t in
      select format('grant execute on function public.%s to %s', r.heiti,
                    case when a.grantee = 0 then 'public' else quote_ident(g.rolname) end)
        from aclexplode(r.rettindi) a left join pg_roles g on g.oid = a.grantee
       where a.privilege_type = 'EXECUTE'
         and a.grantee <> (select p.proowner from pg_proc p where p.oid = to_regprocedure('public.' || r.heiti))
    loop
      execute t;
    end loop;
  end loop;

  -- ---------------------------------------------------------------- lyklar
  -- Frumlyklar og skorður sem eru ekki eins og í skyndimyndinni út, svo þær gömlu inn
  for r in
    select c.conrelid::regclass::text tafla, c.conname from pg_constraint c
     where c.conrelid in ('public.kerfisstillingar'::regclass, 'public.tengingar'::regclass, 'public.dagatal_atburdir'::regclass)
       and c.contype in ('p', 'u', 'c')
       and not exists (select 1 from afrit_20261123.skref3_lyklar l
                        where ('public.' || quote_ident(l.tafla))::regclass = c.conrelid and l.conname = c.conname
                          and l.skilgreining = pg_get_constraintdef(c.oid))
     order by c.contype <> 'p'
  loop
    execute format('alter table %s drop constraint %I', r.tafla, r.conname);
  end loop;
  for r in
    select l.* from afrit_20261123.skref3_lyklar l
     where not exists (select 1 from pg_constraint c where c.conrelid = ('public.' || quote_ident(l.tafla))::regclass
                         and c.conname = l.conname)
     order by l.tegund <> 'p', l.tafla, l.conname
  loop
    execute format('alter table public.%I add constraint %I %s', r.tafla, r.conname, r.skilgreining);
  end loop;

  -- ---------------------------------------------------------------- sjálfgefin réttindi
  for r in
    select s.hlutverk, a.grantee, a.privilege_type
      from afrit_20261123.skref3_sjalfgefid s cross join lateral aclexplode(s.rettindi) a
     where s.tegund = 'f'
       and not exists (select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) b
                        where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'f'
                          and d.defaclrole = s.hlutverk::regrole and b.grantee = a.grantee
                          and b.privilege_type = a.privilege_type)
  loop
    execute format('alter default privileges for role %s in schema public grant %s on functions to %s',
                   quote_ident(r.hlutverk), r.privilege_type,
                   case when r.grantee = 0 then 'public' else quote_ident((select rolname from pg_roles where oid = r.grantee)) end);
  end loop;
  for r in
    select d.defaclrole::regrole::text hlutverk, b.grantee, b.privilege_type
      from pg_default_acl d cross join lateral aclexplode(d.defaclacl) b
     where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'f'
       and not exists (select 1 from afrit_20261123.skref3_sjalfgefid s cross join lateral aclexplode(s.rettindi) a
                        where s.tegund = 'f' and s.hlutverk::regrole = d.defaclrole
                          and a.grantee = b.grantee and a.privilege_type = b.privilege_type)
  loop
    execute format('alter default privileges for role %s in schema public revoke %s on functions from %s',
                   quote_ident(r.hlutverk), r.privilege_type,
                   case when r.grantee = 0 then 'public' else quote_ident((select rolname from pg_roles where oid = r.grantee)) end);
  end loop;

  -- ---------------------------------------------------------------- staðfesting
  villur := '{}';
  for r in
    (select heiti, skilgreining from afrit_20261123.skref3_foll
     except
     select p.oid::regprocedure::text, pg_get_functiondef(p.oid) from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.prokind = 'f')
    union all
    (select p.oid::regprocedure::text, 'nýtt' from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
        and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
        and not exists (select 1 from afrit_20261123.skref3_foll f where f.heiti = p.oid::regprocedure::text))
  loop
    villur := villur || ('fall ' || r.heiti);
  end loop;
  for r in
    select f.heiti from afrit_20261123.skref3_foll f join pg_proc p on p.oid = to_regprocedure('public.' || f.heiti)
     where array(select x::text from unnest(coalesce(p.proacl, acldefault('f', p.proowner))) x order by 1)
           is distinct from array(select x::text from unnest(f.rettindi) x order by 1)
  loop
    villur := villur || ('réttindi ' || r.heiti);
  end loop;
  for r in
    (select tafla, conname, skilgreining from afrit_20261123.skref3_lyklar
     except
     select conrelid::regclass::text, conname, pg_get_constraintdef(oid) from pg_constraint
      where conrelid in ('public.kerfisstillingar'::regclass, 'public.tengingar'::regclass, 'public.dagatal_atburdir'::regclass)
        and contype in ('p', 'u', 'c'))
    union all
    (select conrelid::regclass::text, conname, pg_get_constraintdef(oid) from pg_constraint
      where conrelid in ('public.kerfisstillingar'::regclass, 'public.tengingar'::regclass, 'public.dagatal_atburdir'::regclass)
        and contype in ('p', 'u', 'c')
     except
     select tafla, conname, skilgreining from afrit_20261123.skref3_lyklar)
  loop
    villur := villur || ('lykill ' || r.tafla || '.' || r.conname);
  end loop;
  for r in
    select s.viewname from afrit_20261123.skref3_skodanir s
     where not exists (select 1 from pg_views v where v.schemaname = 'public' and v.viewname = s.viewname
                         and v.definition = s.definition)
  loop
    villur := villur || ('skoðun ' || r.viewname);
  end loop;
  if coalesce(array_length(villur, 1), 0) > 0 then
    raise exception 'R3 skilaði ekki stöðunni fyrir skref 3:%', e'\n' || array_to_string(villur, e'\n');
  end if;

  -- Skyndimyndin hefur skilað sínu; næsta keyrsla skrefs 3 tekur nýja
  drop table afrit_20261123.skref3_foll, afrit_20261123.skref3_lyklar, afrit_20261123.skref3_skodanir,
             afrit_20261123.skref3_sjalfgefid;
  raise notice 'Skref 3 tekið til baka.';
end $r3$;

notify pgrst, 'reload schema';

select conrelid::regclass::text tafla, pg_get_constraintdef(oid) frumlykill
  from pg_constraint
 where conrelid in ('public.kerfisstillingar'::regclass, 'public.dagatal_atburdir'::regclass, 'public.tengingar'::regclass)
   and contype = 'p'
 order by 1;
