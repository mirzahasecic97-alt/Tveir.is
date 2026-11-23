-- ==========================================================================
-- Stofur, skref 0: afrit áður en nokkru er breytt.
--
-- Afritar allar töflur í public yfir í schema afrit_20261123, ásamt
-- skilgreiningum sem afturköllunarskrárnar eru búnar til úr (reglur, föll,
-- gikkir, lyklar, vísar, skoðanir, réttindi), auðkennum Vault leyndarmála
-- (bara id og nafn, aldrei leyndarmálið sjálft), lista yfir skrár í geymslu
-- og nákvæmum fjölda lína í hverri töflu.
--
-- Breytir engu í public. Má keyra aftur: ef afritið er þegar til gerist ekkert
-- (fyrsta afritið er það sem gildir). Neitar að keyra ef skref 1 hefur þegar
-- verið keyrt án afrits, því þá væri afritið ekki lengur af upphafsstöðunni.
--
-- Á eftir: athugið að afrit_20261123 sé EKKI í Settings > API > Exposed schemas.
-- Síðasta setningin skilar þeim töflum þar sem fjöldinn stemmir ekki: 0 raðir.
-- ==========================================================================

do $$
declare t text; n bigint;
begin
  if to_regclass('afrit_20261123.fjoldi') is not null then
    raise notice 'Afritið afrit_20261123 er þegar til. Engu breytt.';
    return;
  end if;
  if to_regclass('public.stofur') is not null then
    raise exception 'Taflan stofur er þegar til: skref 0 á að keyra á undan skrefi 1. Afritið væri ekki af upphafsstöðunni.';
  end if;

  create schema if not exists afrit_20261123;

  -- Gögnin: ein afritstafla fyrir hverja töflu í public
  for t in select tablename from pg_tables where schemaname = 'public' order by 1 loop
    execute format('create table if not exists afrit_20261123.%I as table public.%I', t, t);
  end loop;

  -- Reglur (RLS) í public og storage
  create table afrit_20261123.reglur as
    select * from pg_policies where schemaname in ('public', 'storage');

  -- Föll í public: skilgreining, réttindi (aclitem[], sjálfgefin ef null) og security definer
  create table afrit_20261123.foll as
    select p.oid::regprocedure::text heiti,
           pg_get_functiondef(p.oid) skilgreining,
           coalesce(p.proacl, acldefault('f', p.proowner)) rettindi,
           p.prosecdef secdef
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f';

  -- Gikkir utan storage og auth
  create table afrit_20261123.gikkir as
    select tgrelid::regclass::text tafla, tgname, pg_get_triggerdef(oid) skilgreining, tgenabled::text virkur
      from pg_trigger
     where not tgisinternal and tgrelid::regclass::text !~ '^(storage|auth)\.';

  -- Lyklar og skorður í public
  create table afrit_20261123.lyklar as
    select conrelid::regclass::text tafla, conname, pg_get_constraintdef(oid) skilgreining, contype::text tegund
      from pg_constraint
     where connamespace = 'public'::regnamespace and contype in ('p', 'u', 'f', 'c');

  -- Vísar í public
  create table afrit_20261123.visar as
    select tablename tafla, indexname, indexdef skilgreining
      from pg_indexes where schemaname = 'public';

  -- Skoðanir í public, með valkostum (security_invoker) og réttindum
  create table afrit_20261123.skoda as
    select v.viewname, v.definition, c.reloptions valkostir,
           coalesce(c.relacl, acldefault('r', c.relowner)) rettindi
      from pg_views v
      join pg_class c on c.relname = v.viewname and c.relnamespace = 'public'::regnamespace
     where v.schemaname = 'public';

  -- Réttindi og RLS á töflum í public
  create table afrit_20261123.toflur as
    select c.relname tafla, coalesce(c.relacl, acldefault('r', c.relowner)) rettindi,
           c.relrowsecurity rls, c.relforcerowsecurity rls_thvingad
      from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p');

  -- Vault: bara auðkenni og nöfn
  create table afrit_20261123.vault_ids as select id, name from vault.secrets;

  -- Skrár í geymslu (bara slóðir, skrárnar sjálfar eru í Storage)
  create table afrit_20261123.skrar as select bucket_id, name from storage.objects;

  -- Nákvæmur fjöldi lína í hverri töflu
  create table afrit_20261123.fjoldi (tafla text primary key, fjoldi bigint not null);
  for t in select tablename from pg_tables where schemaname = 'public' order by 1 loop
    execute format('select count(*) from public.%I', t) into n;
    insert into afrit_20261123.fjoldi values (t, n);
  end loop;
end $$;

-- Enginn aðgangur í gegnum API að afritinu
revoke all on schema afrit_20261123 from public, anon, authenticated;
revoke all on all tables in schema afrit_20261123 from public, anon, authenticated;

-- Staðfesting: töflur þar sem fjöldinn í afritinu eða núna í public er annar
-- en skráður fjöldi. Á að skila 0 röðum strax eftir fyrstu keyrslu.
select f.tafla, f.fjoldi skrad, x.afrit, x.nuna
  from afrit_20261123.fjoldi f
  cross join lateral (
    select (xpath('/row/n/text()', query_to_xml(format('select count(*) n from afrit_20261123.%I', f.tafla), false, true, '')))[1]::text::bigint afrit,
           (xpath('/row/n/text()', query_to_xml(format('select count(*) n from public.%I', f.tafla), false, true, '')))[1]::text::bigint nuna
  ) x
 where x.afrit <> f.fjoldi or x.nuna <> f.fjoldi;
