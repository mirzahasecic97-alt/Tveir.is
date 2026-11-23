-- ==========================================================================
-- Stofur, skref 2: samsettir lyklar (spec kafli 2, skref 2)
--
-- Gerir tilvísun milli stofa ómögulega, líka í security definer kóða sem fer
-- framhjá RLS. Engin breyting á hegðun hjá Tveir.
--
-- Yfirtöflur fá unique (stofa_id, id). Í hverri undirtöflu KEMUR samsetti
-- lykillinn (stofa_id, <dálkur>) Í STAÐ gamla eins dálks lykilsins, í sömu færslu,
-- með sömu hegðun við eyðingu: cascade verður cascade, set null verður
-- "on delete set null (<dálkur>)" (stofa_id stendur, PostgreSQL 15+).
-- Ástæða: tveir lyklar milli sömu taflna gera PostgREST embed tvíræð (PGRST201),
-- sem brýtur Make og hvert embed án vísbendingar. Eftir skrefið er nákvæmlega
-- einn lykill milli hvers pars (athugað í lokin).
--
-- Gömlu lyklarnir eru skráðir orðrétt í afrit_20261123.lyklar_skref2 áður en þeir
-- eru felldir, og 2026-11-23-stofur-2-afturkalla.sql setur þá aftur nákvæmlega eins.
-- Samsettu lyklarnir eru settir "not valid" og svo "validate".
--
-- Keyrt sem postgres í SQL Editor, ein færsla. Má keyra aftur. Krefst skrefs 1.
-- ==========================================================================

do $$
begin
  if to_regclass('public.stofur') is null then
    raise exception 'Keyrið 2026-11-23-stofur-1-grunnur.sql fyrst.';
  end if;
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'on delete set null (dálkur) þarf PostgreSQL 15 eða nýrra (hér %).', current_setting('server_version');
  end if;
end $$;

create table if not exists afrit_20261123.lyklar_skref2 (
  tafla        text not null,
  conname      text not null,
  skilgreining text not null,
  skrad        timestamptz not null default now(),
  primary key (tafla, conname)
);
revoke all on afrit_20261123.lyklar_skref2 from public, anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- 1. Yfirtöflur: unique (stofa_id, id)
-- --------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['fyrirtaeki','taskar','verkefni','midlar','myndbond','snid','postholf_thraedir'] loop
    if not exists (select 1 from pg_constraint where conrelid = ('public.' || t)::regclass
                    and conname = t || '_stofa_id_uq') then
      execute format('alter table public.%I add constraint %I unique (stofa_id, id)', t, t || '_stofa_id_uq');
    end if;
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 2. Undirtöflur: gamli lykillinn út, samsetti inn
-- --------------------------------------------------------------------------
do $$
declare
  r record;
  c record;
  nafn text;
  gamalt text;
  eyding text;
begin
  for r in select * from (values
    ('notendur','fyrirtaeki_id','fyrirtaeki'), ('verkefni','fyrirtaeki_id','fyrirtaeki'),
    ('taskar','fyrirtaeki_id','fyrirtaeki'), ('undirverk','fyrirtaeki_id','fyrirtaeki'),
    ('midlar','fyrirtaeki_id','fyrirtaeki'), ('maelingar','fyrirtaeki_id','fyrirtaeki'),
    ('midla_faerslur','fyrirtaeki_id','fyrirtaeki'), ('skyrslur','fyrirtaeki_id','fyrirtaeki'),
    ('myndbond','fyrirtaeki_id','fyrirtaeki'), ('myndband_tolur','fyrirtaeki_id','fyrirtaeki'),
    ('tolfraedi_sendingar','fyrirtaeki_id','fyrirtaeki'), ('innri_taskar','fyrirtaeki_id','fyrirtaeki'),
    ('fundir','fyrirtaeki_id','fyrirtaeki'), ('postholf_thraedir','fyrirtaeki_id','fyrirtaeki'),
    ('samningar','fyrirtaeki_id','fyrirtaeki'), ('aukaverkefni','fyrirtaeki_id','fyrirtaeki'),
    ('reikningsdrog','fyrirtaeki_id','fyrirtaeki'), ('bod','fyrirtaeki_id','fyrirtaeki'),
    ('athugasemdir','task_id','taskar'), ('vidhengi','task_id','taskar'), ('undirverk','task_id','taskar'),
    ('taskar','verkefni_id','verkefni'), ('verkefni_innri','verkefni_id','verkefni'), ('timar','verkefni_id','verkefni'),
    ('maelingar','midill_id','midlar'), ('midla_faerslur','midill_id','midlar'),
    ('myndband_tolur','myndband_id','myndbond'),
    ('snid_taskar','snid_id','snid'),
    ('postholf_skilabod','thradur_id','postholf_thraedir'), ('postholf_svor','thradur_id','postholf_thraedir')
  ) x (tafla, dalkur, foreldri) loop
    nafn := r.tafla || '_' || r.dalkur || '_stofa_fk';

    -- Gamli lykillinn: eins dálks lykill úr <dálkur> í <foreldri>. Skráður orðrétt, svo felldur.
    for c in
      select con.conname, pg_get_constraintdef(con.oid) d
        from pg_constraint con
       where con.conrelid = ('public.' || r.tafla)::regclass
         and con.confrelid = ('public.' || r.foreldri)::regclass
         and con.contype = 'f'
         and con.conkey = array[(select a.attnum from pg_attribute a
                                  where a.attrelid = con.conrelid and a.attname = r.dalkur)]::int2[]
    loop
      insert into afrit_20261123.lyklar_skref2 (tafla, conname, skilgreining)
      values (r.tafla, c.conname, c.d)
      on conflict (tafla, conname) do nothing;
      execute format('alter table public.%I drop constraint %I', r.tafla, c.conname);
    end loop;

    if not exists (select 1 from pg_constraint where conrelid = ('public.' || r.tafla)::regclass and conname = nafn) then
      select l.skilgreining into gamalt
        from afrit_20261123.lyklar_skref2 l
       where l.tafla = r.tafla
         and l.skilgreining ~ format('^FOREIGN KEY \(%s\) REFERENCES (public\.)?%s\(id\)', r.dalkur, r.foreldri)
       order by l.skrad desc limit 1;
      if gamalt is null then
        raise notice 'Enginn eldri lykill fannst á %.%: samsetti lykillinn fær sjálfgefna hegðun (no action).', r.tafla, r.dalkur;
      end if;
      eyding := case
        when gamalt ~ 'ON DELETE CASCADE'  then 'on delete cascade'
        when gamalt ~ 'ON DELETE SET NULL' then format('on delete set null (%I)', r.dalkur)
        when gamalt ~ 'ON DELETE RESTRICT' then 'on delete restrict'
        else '' end;
      execute format('alter table public.%I add constraint %I foreign key (stofa_id, %I)
                        references public.%I (stofa_id, id) %s not valid',
                     r.tafla, nafn, r.dalkur, r.foreldri, eyding);
    end if;
    execute format('alter table public.%I validate constraint %I', r.tafla, nafn);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 3. Staðfesting: nákvæmlega einn lykill milli hvers pars, og hann samsettur og staðfestur
-- --------------------------------------------------------------------------
do $$
declare r record; vantar text := '';
begin
  for r in
    select x.tafla, x.foreldri,
           count(con.oid) fjoldi,
           count(con.oid) filter (where con.conname = x.tafla || '_' || x.dalkur || '_stofa_fk' and con.convalidated) samsettir
      from (values
        ('notendur','fyrirtaeki_id','fyrirtaeki'), ('verkefni','fyrirtaeki_id','fyrirtaeki'),
        ('taskar','fyrirtaeki_id','fyrirtaeki'), ('undirverk','fyrirtaeki_id','fyrirtaeki'),
        ('midlar','fyrirtaeki_id','fyrirtaeki'), ('maelingar','fyrirtaeki_id','fyrirtaeki'),
        ('midla_faerslur','fyrirtaeki_id','fyrirtaeki'), ('skyrslur','fyrirtaeki_id','fyrirtaeki'),
        ('myndbond','fyrirtaeki_id','fyrirtaeki'), ('myndband_tolur','fyrirtaeki_id','fyrirtaeki'),
        ('tolfraedi_sendingar','fyrirtaeki_id','fyrirtaeki'), ('innri_taskar','fyrirtaeki_id','fyrirtaeki'),
        ('fundir','fyrirtaeki_id','fyrirtaeki'), ('postholf_thraedir','fyrirtaeki_id','fyrirtaeki'),
        ('samningar','fyrirtaeki_id','fyrirtaeki'), ('aukaverkefni','fyrirtaeki_id','fyrirtaeki'),
        ('reikningsdrog','fyrirtaeki_id','fyrirtaeki'), ('bod','fyrirtaeki_id','fyrirtaeki'),
        ('athugasemdir','task_id','taskar'), ('vidhengi','task_id','taskar'), ('undirverk','task_id','taskar'),
        ('taskar','verkefni_id','verkefni'), ('verkefni_innri','verkefni_id','verkefni'), ('timar','verkefni_id','verkefni'),
        ('maelingar','midill_id','midlar'), ('midla_faerslur','midill_id','midlar'),
        ('myndband_tolur','myndband_id','myndbond'),
        ('snid_taskar','snid_id','snid'),
        ('postholf_skilabod','thradur_id','postholf_thraedir'), ('postholf_svor','thradur_id','postholf_thraedir')
      ) x (tafla, dalkur, foreldri)
      left join pg_constraint con on con.contype = 'f'
           and con.conrelid = ('public.' || x.tafla)::regclass
           and con.confrelid = ('public.' || x.foreldri)::regclass
     group by x.tafla, x.foreldri
  loop
    if r.fjoldi <> 1 or r.samsettir <> 1 then
      vantar := vantar || format(' %s->%s (%s lyklar, %s samsettir)', r.tafla, r.foreldri, r.fjoldi, r.samsettir);
    end if;
  end loop;
  if vantar <> '' then raise exception 'Skref 2 stenst ekki:%', vantar; end if;
end $$;

notify pgrst, 'reload schema';

-- Yfirlit: einn samsettur lykill milli hvers pars (30 raðir)
select con.conrelid::regclass::text tafla, con.confrelid::regclass::text foreldri, con.conname,
       pg_get_constraintdef(con.oid) skilgreining
  from pg_constraint con
 where con.connamespace = 'public'::regnamespace and con.contype = 'f' and con.conname like '%\_stofa\_fk' escape '\'
 order by 1, 2;
