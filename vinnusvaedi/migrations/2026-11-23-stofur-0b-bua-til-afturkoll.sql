-- ==========================================================================
-- Stofur, skref 0b: býr til afturköllunarskrárnar úr afritinu afrit_20261123.
--
-- Keyrt strax á eftir 2026-11-23-stofur-0-afrit.sql. Les bara (breytir engu).
-- Skilar fjórum röðum: skra (skráarnafn) og innihald (öll skráin). Afritið
-- innihald hverrar raðar í skrá með því nafni og vistið í repo, við hlið
-- flutninganna en EKKI í migrations/ (keyra.mjs og venjan hér er að allt í
-- migrations/ sé keyrt fram á við):
--   afturkalla-reglur.sql     reglur í public og storage eins og í skrefi 0
--   afturkalla-foll.sql       föll í public eins og í skrefi 0, með réttindum
--   afturkalla-lyklar.sql     lyklar og skorður kerfisstillingar, tengingar og
--                             dagatal_atburdir eins og í skrefi 0
--   afturkalla-skodanir.sql   skoðanirnar fjórar eins og í skrefi 0
-- Hver skrá er sjálfstæð (les ekki afritið þegar hún er keyrð) og má keyra aftur.
--
-- Ný föll og reglur úr skrefi 1 (á nýju töflunum) eru látin í friði: þau fara
-- með 2026-11-23-stofur-1-afturkalla.sql.
--
-- Samanburður eftir afturköllun (á að skila 0 röðum hvor um sig):
--   select policyname, tablename, qual, with_check from pg_policies where schemaname in ('public','storage')
--     and (schemaname = 'storage' or tablename in (select tafla from afrit_20261123.fjoldi))
--   except select policyname, tablename, qual, with_check from afrit_20261123.reglur;
--   (og öfugt)
--   select heiti, skilgreining from afrit_20261123.foll
--   except select p.oid::regprocedure::text, pg_get_functiondef(p.oid) from pg_proc p
--    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f';
--   select tafla, conname, skilgreining from afrit_20261123.lyklar
--   except select conrelid::regclass::text, conname, pg_get_constraintdef(oid) from pg_constraint
--    where connamespace = 'public'::regnamespace and contype in ('p','u','f','c');
-- ==========================================================================

with
-- föllin sem skref 1 býr til; afturkalla-foll.sql lætur þau vera
skref1 (heiti) as (values
  ('er_fratekid_slug(text)'), ('min_stofa()'), ('tveir_stofa()'), ('min_stada()'),
  ('er_rekstraradili()'), ('fyrirtaeki_i_stofu(text)'), ('stofa_heimild(text,text)'),
  ('i_heimild(uuid,boolean,uuid)'), ('ny_vel_lykill(text,uuid,boolean,text[])'),
  ('erfa_stofu()'), ('stofa_notanda()'), ('verja_stofu()'), ('nytt_verk_netfang()')
),
-- réttindi sem grant setningar (eigandinn sleppt, hann á allt)
rettindi_falla as (
  select f.heiti,
         string_agg(format('grant execute on function public.%s to %s;', f.heiti,
                           case when a.grantee = 0 then 'public' else quote_ident(r.rolname) end),
                    e'\n' order by coalesce(r.rolname, '')) grants
    from afrit_20261123.foll f
    cross join lateral aclexplode(f.rettindi) a
    left join pg_roles r on r.oid = a.grantee
   where a.privilege_type = 'EXECUTE'
     and a.grantee <> (select p.proowner from pg_proc p where p.oid = f.heiti::regprocedure)
   group by f.heiti
),
reglur as (
  select string_agg(format('create policy %I on %I.%I as %s for %s to %s%s%s;',
            r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd,
            (select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') from unnest(r.roles) x),
            case when r.qual is not null then e'\n  using (' || r.qual || ')' else '' end,
            case when r.with_check is not null then e'\n  with check (' || r.with_check || ')' else '' end),
          e'\n' order by r.schemaname, r.tablename, r.policyname) sql
    from afrit_20261123.reglur r
),
-- Fall er bara búið til aftur ef skilgreiningin er önnur en í skrefi 0. Þá
-- snertir skráin ekki óbreytt föll (til dæmis föll í eigu annars hlutverks, sem
-- postgres má ekki skipta út), og ef skilagerð eða heiti raka breyttust er fallið fellt fyrst.
foll as (
  select string_agg(format(
            e'do $afturk$ begin\n'
            '  if not exists (select 1 from pg_proc p where p.oid = to_regprocedure(%L)\n'
            '                   and pg_get_functiondef(p.oid) = %L) then\n'
            '    begin\n'
            '      execute %L;\n'
            '    exception when invalid_function_definition then\n'
            '      execute %L;\n'
            '      execute %L;\n'
            '    end;\n'
            '  end if;\n'
            'end $afturk$;\n',
            'public.' || f.heiti, f.skilgreining, f.skilgreining,
            format('drop function public.%s', f.heiti), f.skilgreining)
            || format('revoke all on function public.%s from public, anon, authenticated, service_role;', f.heiti)
            || coalesce(e'\n' || g.grants, ''),
          e'\n\n' order by f.heiti) sql
    from afrit_20261123.foll f left join rettindi_falla g using (heiti)
),
lyklar as (
  select string_agg(format(
           e'do $l$ begin\n'
           '  if not exists (select 1 from pg_constraint where conrelid = %L::regclass and conname = %L) then\n'
           '    execute %L;\n'
           '  end if;\n'
           'end $l$;',
           'public.' || l.tafla, l.conname,
           format('alter table public.%I add constraint %I %s', l.tafla, l.conname, l.skilgreining)),
         e'\n' order by l.tafla, case l.tegund when 'p' then 0 else 1 end, l.conname) sql,
         string_agg(format('(%L, %L, %L)', l.tafla, l.conname, l.skilgreining), e',\n    '
                    order by l.tafla, l.conname) gildi,
         string_agg(format('(%L, %L)', l.tafla, l.conname), e',\n    '
                    order by l.tafla, l.conname) nofn
    from afrit_20261123.lyklar l
   where l.tafla in ('kerfisstillingar', 'tengingar', 'dagatal_atburdir') and l.tegund in ('p', 'u', 'c')
),
skodanir as (
  select string_agg(
           format('drop view if exists public.%I;', s.viewname) || e'\n'
           || format('create view public.%I%s as', s.viewname,
                     case when s.valkostir is not null then ' with (' || array_to_string(s.valkostir, ', ') || ')' else '' end)
           || e'\n' || rtrim(s.definition, e'; \n') || e';\n'
           || format('revoke all on public.%I from public, anon, authenticated, service_role;', s.viewname)
           || coalesce(e'\n' || (
                select string_agg(format('grant %s on public.%I to %s;', a.privilege_type, s.viewname,
                                         case when a.grantee = 0 then 'public' else quote_ident(r.rolname) end),
                                  e'\n' order by coalesce(r.rolname, ''), a.privilege_type)
                  from aclexplode(s.rettindi) a left join pg_roles r on r.oid = a.grantee
                 where a.grantee <> (select c.relowner from pg_class c
                                      where c.relname = s.viewname and c.relnamespace = 'public'::regnamespace)), ''),
           e'\n\n' order by s.viewname) sql
    from afrit_20261123.skoda s
)
select 'afturkalla-reglur.sql' skra,
       e'-- Búið til af 2026-11-23-stofur-0b-bua-til-afturkoll.sql úr afrit_20261123.reglur.\n'
       '-- Fellir allar reglur í storage og á þeim töflum í public sem voru til í skrefi 0,\n'
       '-- og býr svo til reglurnar eins og þær voru í skrefi 0. Reglur á nýju töflunum\n'
       '-- (stofur, bod, ...) eru látnar vera. Má keyra aftur.\n\n'
       || format(e'do $d$ declare r record; begin\n'
                 '  for r in select schemaname, tablename, policyname from pg_policies\n'
                 '            where schemaname = %L or (schemaname = %L and tablename = any (%L::text[])) loop\n'
                 '    execute format(%L, r.policyname, r.schemaname, r.tablename);\n'
                 '  end loop;\n'
                 'end $d$;\n\n',
                 'storage', 'public',
                 (select array_agg(tafla order by tafla) from afrit_20261123.fjoldi)::text,
                 'drop policy %I on %I.%I')
       || coalesce((select sql from reglur), '') || e'\n' innihald
union all
select 'afturkalla-foll.sql',
       e'-- Búið til af 2026-11-23-stofur-0b-bua-til-afturkoll.sql úr afrit_20261123.foll.\n'
       '-- Fellir föll í public sem urðu til eftir skref 0 (nema föll skrefs 1, sem\n'
       '-- 2026-11-23-stofur-1-afturkalla.sql fellir), og gikkina sem keyra þau, setur\n'
       '-- svo gömlu skilgreiningarnar og réttindin aftur. Má keyra aftur. Ef fall er\n'
       '-- enn notað af reglu stöðvast skráin með villu og ekkert breytist: fellið þá\n'
       '-- fyrst það sem notar það.\n\n'
       || format(e'do $d$ declare r record; begin\n'
                 '  for r in select tg.tgname, tg.tgrelid::regclass::text tafla from pg_trigger tg\n'
                 '            join pg_proc p on p.oid = tg.tgfoid\n'
                 '            where not tg.tgisinternal and p.pronamespace = %L::regnamespace and p.prokind = %L\n'
                 '              and not exists (select 1 from pg_depend d where d.classid = ''pg_proc''::regclass\n'
                 '                                and d.objid = p.oid and d.deptype = ''e'')\n'
                 '              and not (p.oid::regprocedure::text = any (%L::text[])) loop\n'
                 '    execute format(%L, r.tgname, r.tafla);\n'
                 '  end loop;\n',
                 'public', 'f',
                 (select array_agg(heiti order by heiti) from (select heiti from afrit_20261123.foll
                                                               union select heiti from skref1) x)::text,
                 'drop trigger %I on %s')
       || format(e'  for r in select p.oid::regprocedure::text heiti from pg_proc p\n'
                 '            where p.pronamespace = %L::regnamespace and p.prokind = %L\n'
                 '              and not exists (select 1 from pg_depend d where d.classid = ''pg_proc''::regclass\n'
                 '                                and d.objid = p.oid and d.deptype = ''e'')\n'
                 '              and not (p.oid::regprocedure::text = any (%L::text[])) loop\n'
                 '    execute format(%L, r.heiti);\n'
                 '  end loop;\n'
                 'end $d$;\n\n',
                 'public', 'f',
                 (select array_agg(heiti order by heiti) from (select heiti from afrit_20261123.foll
                                                               union select heiti from skref1) x)::text,
                 'drop function public.%s')
       || coalesce((select sql from foll), '') || e'\n'
union all
select 'afturkalla-lyklar.sql',
       e'-- Búið til af 2026-11-23-stofur-0b-bua-til-afturkoll.sql úr afrit_20261123.lyklar.\n'
       '-- Setur lykla og skorður kerfisstillingar, tengingar og dagatal_atburdir aftur\n'
       '-- eins og í skrefi 0 (frumlyklar án stofa_id, gömlu check skorðurnar).\n'
       '-- Fellir frumlykil sem er annar en í skrefi 0 og skorður með sama nafni og í\n'
       '-- skrefi 0 en aðra skilgreiningu. Skorður með nýjum nöfnum (til dæmis úr\n'
       '-- skrefi 1) eru látnar vera: breytið skorðu undir sama nafni.\n'
       '-- Gildir bara meðan ein stofa á línur í þessum töflum. Má keyra aftur.\n\n'
       || e'do $d$ declare t text; n int; begin\n'
          '  foreach t in array array[''kerfisstillingar'', ''tengingar'', ''dagatal_atburdir''] loop\n'
          '    if exists (select 1 from information_schema.columns where table_schema = ''public'' and table_name = t and column_name = ''stofa_id'') then\n'
          '      execute format(''select count(distinct stofa_id) from public.%I'', t) into n;\n'
          '      if n > 1 then raise exception ''Fleiri en ein stofa á línur í %: lyklarnir verða ekki settir aftur'', t; end if;\n'
          '    end if;\n'
          '  end loop;\n'
          'end $d$;\n\n'
       || format(e'do $d$ declare r record; begin\n'
                 '  for r in select c.conrelid::regclass::text tafla, c.conname, c.contype from pg_constraint c\n'
                 '            where c.connamespace = ''public''::regnamespace and c.contype in (''p'', ''u'', ''c'')\n'
                 '              and c.conrelid::regclass::text in (''kerfisstillingar'', ''tengingar'', ''dagatal_atburdir'')\n'
                 '              and (c.conrelid::regclass::text, c.conname, pg_get_constraintdef(c.oid)) not in (values\n'
                 '    %s)\n'
                 '              and (c.contype = ''p'' or (c.conrelid::regclass::text, c.conname) in (values\n'
                 '    %s))\n'
                 '            order by c.contype <> ''p'' loop\n'
                 '    execute format(''alter table public.%%I drop constraint %%I'', r.tafla, r.conname);\n'
                 '  end loop;\n'
                 'end $d$;\n\n',
                 (select gildi from lyklar), (select nofn from lyklar))
       || coalesce((select sql from lyklar), '') || e'\n'
union all
select 'afturkalla-skodanir.sql',
       e'-- Búið til af 2026-11-23-stofur-0b-bua-til-afturkoll.sql úr afrit_20261123.skoda.\n'
       '-- Skoðanirnar eins og í skrefi 0, með valkostum og réttindum. Má keyra aftur.\n\n'
       || coalesce((select sql from skodanir), '') || e'\n';
