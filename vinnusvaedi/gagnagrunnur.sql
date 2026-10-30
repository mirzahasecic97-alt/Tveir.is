-- ==========================================================================
-- Tveir vinnusvæði — gagnagrunnur
-- Keyrist einu sinni í Supabase: SQL Editor -> New query -> paste -> Run.
-- ==========================================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- 1. Töflur
-- --------------------------------------------------------------------------

create table if not exists fyrirtaeki (
  id          uuid primary key default gen_random_uuid(),
  nafn        text not null,
  merki_url   text,
  askrift     text,
  stofnad     timestamptz not null default now()
);

create table if not exists notendur (
  id            uuid primary key references auth.users on delete cascade,
  fyrirtaeki_id uuid references fyrirtaeki on delete set null,
  nafn          text not null default '',
  netfang       text not null default '',
  hlutverk      text not null default 'vidskiptavinur'
                check (hlutverk in ('vidskiptavinur', 'admin')),
  stofnad       timestamptz not null default now()
);

-- Admin notendur (Mirza og Óskar) hafa fyrirtaeki_id = null og sjá allt.

create table if not exists verkefni (
  id            uuid primary key default gen_random_uuid(),
  fyrirtaeki_id uuid not null references fyrirtaeki on delete cascade,
  titill        text not null,
  lysing        text,
  stada         text not null default 'tillaga'
                check (stada in ('tillaga', 'samthykkt', 'i_vinnslu', 'bid_svar', 'lokid', 'hafnad')),
  framvinda     int  not null default 0 check (framvinda between 0 and 100),
  skiladagur    date,
  hofundur      uuid references notendur on delete set null,
  svar_admin    text,
  stofnad       timestamptz not null default now(),
  uppfaert      timestamptz not null default now()
);

create table if not exists taskar (
  id            uuid primary key default gen_random_uuid(),
  fyrirtaeki_id uuid not null references fyrirtaeki on delete cascade,
  verkefni_id   uuid references verkefni on delete set null,
  titill        text not null,
  lysing        text,
  stada         text not null default 'nytt'
                check (stada in ('nytt', 'i_vinnslu', 'bid_vidskiptavinar', 'lokid')),
  forgangur     text not null default 'venjulegt'
                check (forgangur in ('lagt', 'venjulegt', 'hatt')),
  abyrgd        uuid references notendur on delete set null,
  hofundur      uuid references notendur on delete set null,
  skiladagur    date,
  lokid_dags    timestamptz,
  stofnad       timestamptz not null default now(),
  uppfaert      timestamptz not null default now()
);

create table if not exists athugasemdir (
  id        uuid primary key default gen_random_uuid(),
  task_id   uuid not null references taskar on delete cascade,
  hofundur  uuid references notendur on delete set null,
  texti     text not null,
  stofnad   timestamptz not null default now()
);

create table if not exists vidhengi (
  id        uuid primary key default gen_random_uuid(),
  task_id   uuid not null references taskar on delete cascade,
  slod      text not null,
  nafn      text not null,
  staerd    bigint,
  hofundur  uuid references notendur on delete set null,
  stofnad   timestamptz not null default now()
);

create index if not exists taskar_fyrirtaeki_idx   on taskar (fyrirtaeki_id, stada);
create index if not exists taskar_verkefni_idx     on taskar (verkefni_id);
create index if not exists verkefni_fyrirtaeki_idx on verkefni (fyrirtaeki_id, stada);
create index if not exists athugasemdir_task_idx   on athugasemdir (task_id, stofnad);

-- --------------------------------------------------------------------------
-- 2. Hjálparfunksjónir
--    security definer svo stefnurnar lesi notendur-töfluna án endalausrar
--    endurtekningar (policy sem spyr töfluna sem policyið er á).
-- --------------------------------------------------------------------------

create or replace function mitt_fyrirtaeki() returns uuid
language sql security definer stable set search_path = public as $$
  select fyrirtaeki_id from notendur where id = auth.uid()
$$;

create or replace function er_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select hlutverk = 'admin' from notendur where id = auth.uid()), false)
$$;

-- --------------------------------------------------------------------------
-- 3. Nýr notandi -> lína í notendur
--    Þú býður notanda í Supabase (Authentication -> Users -> Invite) og setur
--    nafn og fyrirtaeki_id í user metadata. Admin getur líka tengt eftir á
--    á stjórnborðinu.
-- --------------------------------------------------------------------------

create or replace function nyr_notandi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notendur (id, netfang, nafn, fyrirtaeki_id, hlutverk)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nafn', split_part(coalesce(new.email, ''), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'fyrirtaeki_id', '')::uuid,
    coalesce(nullif(new.raw_user_meta_data ->> 'hlutverk', ''), 'vidskiptavinur')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists nyr_notandi_trigger on auth.users;
create trigger nyr_notandi_trigger
  after insert on auth.users
  for each row execute function nyr_notandi();

-- --------------------------------------------------------------------------
-- 4. uppfaert og lokid_dags uppfærast sjálf
-- --------------------------------------------------------------------------

create or replace function stimpla() returns trigger
language plpgsql as $$
begin
  new.uppfaert := now();
  if to_jsonb(new) ? 'lokid_dags' then
    if new.stada = 'lokid' and old.stada is distinct from 'lokid' then
      new.lokid_dags := now();
    elsif new.stada <> 'lokid' then
      new.lokid_dags := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stimpla_taskar on taskar;
create trigger stimpla_taskar before update on taskar
  for each row execute function stimpla();

drop trigger if exists stimpla_verkefni on verkefni;
create trigger stimpla_verkefni before update on verkefni
  for each row execute function stimpla();

-- --------------------------------------------------------------------------
-- 5. Row Level Security
--    Gagnagrunnurinn sjálfur hleypir hverju fyrirtæki bara í sínar línur.
--    Þetta er ekki JavaScript í vafra sem hægt er að fara framhjá.
-- --------------------------------------------------------------------------

alter table fyrirtaeki   enable row level security;
alter table notendur     enable row level security;
alter table verkefni     enable row level security;
alter table taskar       enable row level security;
alter table athugasemdir enable row level security;
alter table vidhengi     enable row level security;

-- fyrirtaeki
drop policy if exists fyr_les on fyrirtaeki;
create policy fyr_les on fyrirtaeki for select to authenticated
  using (er_admin() or id = mitt_fyrirtaeki());

drop policy if exists fyr_admin on fyrirtaeki;
create policy fyr_admin on fyrirtaeki for all to authenticated
  using (er_admin()) with check (er_admin());

-- notendur
drop policy if exists not_les on notendur;
create policy not_les on notendur for select to authenticated
  using (er_admin() or id = auth.uid() or fyrirtaeki_id = mitt_fyrirtaeki());

-- Allir innskradir sja nofn Mirza og Oskars, annars gaeti vidskiptavinur
-- ekki valid hvorn okkar task fer a.
drop policy if exists not_les_tveir on notendur;
create policy not_les_tveir on notendur for select to authenticated
  using (hlutverk = 'admin');

drop policy if exists not_eigid on notendur;
create policy not_eigid on notendur for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and hlutverk = (select hlutverk from notendur where id = auth.uid()));

drop policy if exists not_admin on notendur;
create policy not_admin on notendur for all to authenticated
  using (er_admin()) with check (er_admin());

-- verkefni
drop policy if exists verk_les on verkefni;
create policy verk_les on verkefni for select to authenticated
  using (er_admin() or fyrirtaeki_id = mitt_fyrirtaeki());

-- viðskiptavinur má stinga upp á verkefni, aldrei samþykkja það sjálfur
drop policy if exists verk_tillaga on verkefni;
create policy verk_tillaga on verkefni for insert to authenticated
  with check (fyrirtaeki_id = mitt_fyrirtaeki() and stada = 'tillaga');

drop policy if exists verk_breyta_tillogu on verkefni;
create policy verk_breyta_tillogu on verkefni for update to authenticated
  using (fyrirtaeki_id = mitt_fyrirtaeki() and stada = 'tillaga')
  with check (fyrirtaeki_id = mitt_fyrirtaeki() and stada = 'tillaga');

drop policy if exists verk_admin on verkefni;
create policy verk_admin on verkefni for all to authenticated
  using (er_admin()) with check (er_admin());

-- taskar
drop policy if exists task_les on taskar;
create policy task_les on taskar for select to authenticated
  using (er_admin() or fyrirtaeki_id = mitt_fyrirtaeki());

drop policy if exists task_nyr on taskar;
create policy task_nyr on taskar for insert to authenticated
  with check (fyrirtaeki_id = mitt_fyrirtaeki());

-- viðskiptavinur má breyta sínum töskum en ekki haka í lokið,
-- það gerum við. Hann má hins vegar svara og setja i_vinnslu/nytt.
drop policy if exists task_breyta on taskar;
create policy task_breyta on taskar for update to authenticated
  using (fyrirtaeki_id = mitt_fyrirtaeki())
  with check (fyrirtaeki_id = mitt_fyrirtaeki() and stada <> 'lokid');

drop policy if exists task_admin on taskar;
create policy task_admin on taskar for all to authenticated
  using (er_admin()) with check (er_admin());

-- athugasemdir
drop policy if exists ath_les on athugasemdir;
create policy ath_les on athugasemdir for select to authenticated
  using (er_admin() or exists (
    select 1 from taskar t where t.id = task_id and t.fyrirtaeki_id = mitt_fyrirtaeki()));

drop policy if exists ath_ny on athugasemdir;
create policy ath_ny on athugasemdir for insert to authenticated
  with check (hofundur = auth.uid() and (er_admin() or exists (
    select 1 from taskar t where t.id = task_id and t.fyrirtaeki_id = mitt_fyrirtaeki())));

drop policy if exists ath_admin on athugasemdir;
create policy ath_admin on athugasemdir for all to authenticated
  using (er_admin()) with check (er_admin());

-- vidhengi
drop policy if exists vid_les on vidhengi;
create policy vid_les on vidhengi for select to authenticated
  using (er_admin() or exists (
    select 1 from taskar t where t.id = task_id and t.fyrirtaeki_id = mitt_fyrirtaeki()));

drop policy if exists vid_nytt on vidhengi;
create policy vid_nytt on vidhengi for insert to authenticated
  with check (hofundur = auth.uid() and (er_admin() or exists (
    select 1 from taskar t where t.id = task_id and t.fyrirtaeki_id = mitt_fyrirtaeki())));

drop policy if exists vid_admin on vidhengi;
create policy vid_admin on vidhengi for all to authenticated
  using (er_admin()) with check (er_admin());

-- --------------------------------------------------------------------------
-- 6. Viðhengi í Storage
--    Búðu til private bucket sem heitir vidhengi í Supabase Storage,
--    svo keyrðu þetta. Slóðin er alltaf <fyrirtaeki_id>/<task_id>/<nafn>.
-- --------------------------------------------------------------------------

drop policy if exists vidhengi_les on storage.objects;
create policy vidhengi_les on storage.objects for select to authenticated
  using (bucket_id = 'vidhengi'
         and (er_admin() or (storage.foldername(name))[1] = mitt_fyrirtaeki()::text));

drop policy if exists vidhengi_sett on storage.objects;
create policy vidhengi_sett on storage.objects for insert to authenticated
  with check (bucket_id = 'vidhengi'
              and (er_admin() or (storage.foldername(name))[1] = mitt_fyrirtaeki()::text));

drop policy if exists vidhengi_eytt on storage.objects;
create policy vidhengi_eytt on storage.objects for delete to authenticated
  using (bucket_id = 'vidhengi' and er_admin());
