-- ==========================================================================
-- Stofur, afturköllun R2: tekur skref 2 til baka
--
-- Fellir samsettu lyklana (<tafla>_<dálkur>_stofa_fk) og setur gömlu eins dálks
-- lyklana aftur, með sama nafni og orðrétt sömu skilgreiningu og skráð var í
-- afrit_20261123.lyklar_skref2 þegar skref 2 felldi þá. Fellir svo
-- unique (stofa_id, id) á yfirtöflunum. Ein færsla, má keyra aftur.
-- Í lokin: nákvæmlega einn lykill milli hvers pars, sá gamli.
-- ==========================================================================

-- Sama tafla og skref 2 býr til (tóm ef skref 2 hefur aldrei verið keyrt)
create table if not exists afrit_20261123.lyklar_skref2 (
  tafla        text not null,
  conname      text not null,
  skilgreining text not null,
  skrad        timestamptz not null default now(),
  primary key (tafla, conname)
);
revoke all on afrit_20261123.lyklar_skref2 from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_constraint where connamespace = 'public'::regnamespace
              and conname like '%\_stofa\_fk' escape '\')
     and not exists (select 1 from afrit_20261123.lyklar_skref2) then
    raise exception 'afrit_20261123.lyklar_skref2 er tóm: gömlu lyklarnir finnast ekki. Ekkert gert.';
  end if;
end $$;

do $$
declare r record;
begin
  -- 1. Samsettu lyklarnir út
  for r in select con.conrelid::regclass::text tafla, con.conname
             from pg_constraint con
            where con.connamespace = 'public'::regnamespace and con.contype = 'f'
              and con.conname like '%\_stofa\_fk' escape '\' loop
    execute format('alter table %s drop constraint %I', r.tafla, r.conname);
  end loop;

  -- 2. Gömlu lyklarnir inn, orðrétt (töflur sem eru horfnar eru hunsaðar)
  for r in select l.tafla, l.conname, l.skilgreining
             from afrit_20261123.lyklar_skref2 l
            where to_regclass('public.' || quote_ident(l.tafla)) is not null
            order by l.tafla, l.conname loop
    if not exists (select 1 from pg_constraint where conrelid = ('public.' || quote_ident(r.tafla))::regclass
                    and conname = r.conname) then
      execute format('alter table public.%I add constraint %I %s', r.tafla, r.conname, r.skilgreining);
    end if;
  end loop;

  -- 3. unique (stofa_id, id) á yfirtöflunum
  for r in select con.conrelid::regclass::text tafla, con.conname
             from pg_constraint con
            where con.connamespace = 'public'::regnamespace and con.contype = 'u'
              and con.conname like '%\_stofa\_id\_uq' escape '\' loop
    execute format('alter table %s drop constraint %I', r.tafla, r.conname);
  end loop;
end $$;

-- 4. Staðfesting: einn lykill milli hvers pars, enginn samsettur eftir
do $$
declare r record; vantar text := '';
begin
  if exists (select 1 from pg_constraint where connamespace = 'public'::regnamespace
              and (conname like '%\_stofa\_fk' escape '\' or conname like '%\_stofa\_id\_uq' escape '\')) then
    vantar := ' samsettir lyklar eða unique (stofa_id, id) eftir';
  end if;
  for r in
    select l.tafla, con.confrelid::regclass::text foreldri, count(*) fjoldi
      from afrit_20261123.lyklar_skref2 l
      join pg_constraint c0 on c0.conrelid = to_regclass('public.' || quote_ident(l.tafla)) and c0.conname = l.conname
      join pg_constraint con on con.contype = 'f' and con.conrelid = c0.conrelid and con.confrelid = c0.confrelid
     group by 1, 2
  loop
    if r.fjoldi <> 1 then vantar := vantar || format(' %s->%s (%s lyklar)', r.tafla, r.foreldri, r.fjoldi); end if;
  end loop;
  if exists (select 1 from afrit_20261123.lyklar_skref2 l
              where to_regclass('public.' || quote_ident(l.tafla)) is not null
                and not exists (select 1 from pg_constraint c
                                 where c.conrelid = ('public.' || quote_ident(l.tafla))::regclass
                                   and c.conname = l.conname and pg_get_constraintdef(c.oid) = l.skilgreining)) then
    vantar := vantar || ' (gamall lykill ekki eins og skráð var)';
  end if;
  if vantar <> '' then raise exception 'Afturköllun R2 stenst ekki:%', vantar; end if;
end $$;

notify pgrst, 'reload schema';

-- Yfirlit: gömlu lyklarnir eins og þeir standa núna
select l.tafla, l.conname, pg_get_constraintdef(c.oid) nuna, pg_get_constraintdef(c.oid) = l.skilgreining eins
  from afrit_20261123.lyklar_skref2 l
  left join pg_constraint c on c.conrelid = to_regclass('public.' || quote_ident(l.tafla)) and c.conname = l.conname
 order by 1, 2;
