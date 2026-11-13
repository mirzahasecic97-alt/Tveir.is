-- ==========================================================================
-- Tveir vinnusvæði — gagnagrunnur
-- Keyrist einu sinni í Supabase: SQL Editor -> New query -> paste -> Run.
-- ==========================================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- 1. Töflur
-- --------------------------------------------------------------------------

create table if not exists fyrirtaeki (
  id            uuid primary key default gen_random_uuid(),
  nafn          text not null,
  merki_url     text,
  askrift       text,
  er_askrift    boolean not null default false,
  askrift_verd  bigint,
  stofnad       timestamptz not null default now()
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
  budget         bigint,
  innan_samnings boolean not null default false,
  verd_okkar     bigint,
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

-- Ef töflurnar voru búnar til áður en budget kom inn
alter table fyrirtaeki add column if not exists er_askrift   boolean not null default false;
alter table fyrirtaeki add column if not exists askrift_verd bigint;
alter table verkefni   add column if not exists budget         bigint;
alter table verkefni   add column if not exists innan_samnings boolean not null default false;
alter table verkefni   add column if not exists verd_okkar     bigint;

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

-- Viðskiptavinur má stinga upp á verkefni, aldrei samþykkja það sjálfur.
-- Budget er skylda nema verkefnið rúmist innan áskriftar, og enginn getur
-- merkt verkefni innan áskriftar nema vera raunverulega í áskrift.
-- Þetta er í gagnagrunninum sjálfum, ekki bara í forminu.
drop policy if exists verk_tillaga on verkefni;
create policy verk_tillaga on verkefni for insert to authenticated
  with check (
    fyrirtaeki_id = mitt_fyrirtaeki()
    and stada = 'tillaga'
    and verd_okkar is null
    and (innan_samnings or budget is not null)
    and (not innan_samnings or exists (
      select 1 from fyrirtaeki f where f.id = fyrirtaeki_id and f.er_askrift))
  );

drop policy if exists verk_breyta_tillogu on verkefni;
create policy verk_breyta_tillogu on verkefni for update to authenticated
  using (fyrirtaeki_id = mitt_fyrirtaeki() and stada = 'tillaga')
  with check (
    fyrirtaeki_id = mitt_fyrirtaeki()
    and stada = 'tillaga'
    and (innan_samnings or budget is not null)
    and (not innan_samnings or exists (
      select 1 from fyrirtaeki f where f.id = fyrirtaeki_id and f.er_askrift))
  );

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
--    Geymslan verður til hér, lokuð. Hún má aldrei vera opin, því þá
--    liggja skjöl viðskiptavina á netinu fyrir hvern sem giskar á slóðina.
--    Slóðin er alltaf <fyrirtaeki_id>/<task_id>/<nafn>.
-- --------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
select 'vidhengi', 'vidhengi', false
where not exists (select 1 from storage.buckets where id = 'vidhengi');

-- Hafi hún verið stofnuð í höndunum og merkt opin, lokum við henni.
update storage.buckets set public = false where id = 'vidhengi' and public;

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

-- ==========================================================================
-- 7. Innri gögn: tímar og reikningsstaða
--    Þetta er í sérstakri töflu en ekki dálkum á verkefni, því Row Level
--    Security virkar á línur en ekki dálka. Ef tímarnir sætu á verkefni gæti
--    viðskiptavinur lesið þá út úr API og reiknað framlegðina okkar.
-- ==========================================================================

create table if not exists verkefni_innri (
  verkefni_id     uuid primary key references verkefni on delete cascade,
  klst            numeric(7,1) not null default 0,
  reikningur      text not null default 'ekki_rukkad'
                  check (reikningur in ('ekki_rukkad', 'rukkad', 'greitt')),
  reikningur_dags date,
  uppfaert        timestamptz not null default now()
);

create table if not exists timar (
  id          uuid primary key default gen_random_uuid(),
  verkefni_id uuid not null references verkefni on delete cascade,
  notandi     uuid references notendur on delete set null,
  klst        numeric(5,1) not null,
  nota        text,
  stofnad     timestamptz not null default now()
);

create index if not exists timar_verkefni_idx on timar (verkefni_id, stofnad);

-- Hvert verkefni fær innri línu um leið og það verður til
create or replace function nytt_verkefni_innri() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into verkefni_innri (verkefni_id) values (new.id)
  on conflict (verkefni_id) do nothing;
  return new;
end;
$$;

drop trigger if exists nytt_verkefni_innri_trigger on verkefni;
create trigger nytt_verkefni_innri_trigger
  after insert on verkefni
  for each row execute function nytt_verkefni_innri();

insert into verkefni_innri (verkefni_id)
  select id from verkefni on conflict (verkefni_id) do nothing;

-- Heildartíminn reiknast upp á nýtt í hvert sinn sem skráning breytist
create or replace function stilla_klst() returns trigger
language plpgsql security definer set search_path = public as $$
declare vid uuid;
begin
  vid := coalesce(new.verkefni_id, old.verkefni_id);
  insert into verkefni_innri (verkefni_id) values (vid)
  on conflict (verkefni_id) do nothing;
  update verkefni_innri
     set klst = coalesce((select sum(klst) from timar where verkefni_id = vid), 0),
         uppfaert = now()
   where verkefni_id = vid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists stilla_klst_trigger on timar;
create trigger stilla_klst_trigger
  after insert or update or delete on timar
  for each row execute function stilla_klst();

alter table verkefni_innri enable row level security;
alter table timar          enable row level security;

-- Bara við. Viðskiptavinur sér hvorki tímana né reikningsstöðuna.
drop policy if exists innri_admin on verkefni_innri;
create policy innri_admin on verkefni_innri for all to authenticated
  using (er_admin()) with check (er_admin());

drop policy if exists timar_admin on timar;
create policy timar_admin on timar for all to authenticated
  using (er_admin()) with check (er_admin());

-- ==========================================================================
-- 8. Verkefnasnið
--    Ný vefsíða er alltaf sömu taskarnir. Þetta sparar að skrifa þá aftur.
-- ==========================================================================

create table if not exists snid (
  id      uuid primary key default gen_random_uuid(),
  nafn    text not null,
  lysing  text,
  stofnad timestamptz not null default now()
);

create table if not exists snid_taskar (
  id       uuid primary key default gen_random_uuid(),
  snid_id  uuid not null references snid on delete cascade,
  titill   text not null,
  lysing   text,
  rod      int not null default 0,
  a_hverjum text not null default 'tveir'
           check (a_hverjum in ('tveir', 'vidskiptavinur')),
  forgangur text not null default 'venjulegt'
           check (forgangur in ('lagt', 'venjulegt', 'hatt'))
);

create index if not exists snid_taskar_idx on snid_taskar (snid_id, rod);

alter table snid        enable row level security;
alter table snid_taskar enable row level security;

drop policy if exists snid_admin on snid;
create policy snid_admin on snid for all to authenticated
  using (er_admin()) with check (er_admin());

drop policy if exists snid_taskar_admin on snid_taskar;
create policy snid_taskar_admin on snid_taskar for all to authenticated
  using (er_admin()) with check (er_admin());

-- ==========================================================================
-- 9. Yfirlit fyrir Make
--    Make notar service_role lykilinn og fer því framhjá RLS. security_invoker
--    er samt sett svo venjulegur innskráður notandi geti ekki lesið þetta
--    framhjá sínum eigin réttindum.
-- ==========================================================================

create or replace view bidur_vidskiptavina
with (security_invoker = true) as
  select t.id, t.titill, t.skiladagur, t.uppfaert,
         f.id as fyrirtaeki_id, f.nafn as fyrirtaeki,
         n.netfang, n.nafn as notandi
    from taskar t
    join fyrirtaeki f on f.id = t.fyrirtaeki_id
    join notendur n   on n.fyrirtaeki_id = t.fyrirtaeki_id
   where t.stada = 'bid_vidskiptavinar';

create or replace view olokid_rukkun
with (security_invoker = true) as
  select v.id, v.titill, v.verd_okkar, v.uppfaert,
         f.nafn as fyrirtaeki, i.klst, i.reikningur
    from verkefni v
    join fyrirtaeki f      on f.id = v.fyrirtaeki_id
    join verkefni_innri i  on i.verkefni_id = v.id
   where v.stada = 'lokid'
     and v.innan_samnings = false
     and i.reikningur = 'ekki_rukkad';

-- ==========================================================================
-- 10. Þrjú snið til að byrja með. Breyttu þeim eins og ykkur hentar.
-- ==========================================================================

insert into snid (nafn, lysing)
select 'Ný vefsíða', 'Fimm undirsíður, form og tenging við lén'
where not exists (select 1 from snid where nafn = 'Ný vefsíða');

insert into snid_taskar (snid_id, titill, lysing, rod, a_hverjum, forgangur)
select s.id, x.titill, x.lysing, x.rod, x.a_hverjum, x.forgangur
  from snid s,
       (values
         ('Senda logo í vektor', 'Við þurfum .ai eða .svg skrá, png dugar ekki í prentun.', 1, 'vidskiptavinur', 'hatt'),
         ('Senda myndir af vörum eða starfsemi', null, 2, 'vidskiptavinur', 'venjulegt'),
         ('Skrifa texta á Um okkur', 'Fjórar til fimm línur. Við getum skrifað hann ef þú vilt.', 3, 'vidskiptavinur', 'venjulegt'),
         ('Setja upp grunn og útlit', null, 4, 'tveir', 'venjulegt'),
         ('Undirsíður og efni', null, 5, 'tveir', 'venjulegt'),
         ('Form og tenging við póst', null, 6, 'tveir', 'venjulegt'),
         ('Leitarvélar, sitemap og lýsingar', null, 7, 'tveir', 'venjulegt'),
         ('Yfirferð með viðskiptavin', null, 8, 'vidskiptavinur', 'hatt'),
         ('Tengja lén og setja í loftið', null, 9, 'tveir', 'hatt')
       ) as x(titill, lysing, rod, a_hverjum, forgangur)
 where s.nafn = 'Ný vefsíða'
   and not exists (select 1 from snid_taskar t where t.snid_id = s.id);

insert into snid (nafn, lysing)
select 'Efnispakki mánaðar', 'Tökudagur, klipping og færslur'
where not exists (select 1 from snid where nafn = 'Efnispakki mánaðar');

insert into snid_taskar (snid_id, titill, lysing, rod, a_hverjum, forgangur)
select s.id, x.titill, x.lysing, x.rod, x.a_hverjum, x.forgangur
  from snid s,
       (values
         ('Velja tökudag', null, 1, 'vidskiptavinur', 'hatt'),
         ('Senda okkur áherslur mánaðarins', 'Tilboð, nýjar vörur eða viðburðir sem við eigum að ýta á.', 2, 'vidskiptavinur', 'venjulegt'),
         ('Tökur', null, 3, 'tveir', 'venjulegt'),
         ('Klipping', null, 4, 'tveir', 'venjulegt'),
         ('Yfirferð á efni', null, 5, 'vidskiptavinur', 'venjulegt'),
         ('Birting', null, 6, 'tveir', 'venjulegt')
       ) as x(titill, lysing, rod, a_hverjum, forgangur)
 where s.nafn = 'Efnispakki mánaðar'
   and not exists (select 1 from snid_taskar t where t.snid_id = s.id);

insert into snid (nafn, lysing)
select 'Vörumerki', 'Merki, litir, letur og leiðbeiningar'
where not exists (select 1 from snid where nafn = 'Vörumerki');

insert into snid_taskar (snid_id, titill, lysing, rod, a_hverjum, forgangur)
select s.id, x.titill, x.lysing, x.rod, x.a_hverjum, x.forgangur
  from snid s,
       (values
         ('Samtal um hvað vörumerkið á að segja', null, 1, 'vidskiptavinur', 'hatt'),
         ('Senda okkur það sem er til nú þegar', 'Gamalt merki, litir, myndir, hvað sem er.', 2, 'vidskiptavinur', 'venjulegt'),
         ('Fyrstu tillögur', null, 3, 'tveir', 'venjulegt'),
         ('Val á leið', null, 4, 'vidskiptavinur', 'hatt'),
         ('Fullvinnsla og skilaskrár', null, 5, 'tveir', 'venjulegt'),
         ('Leiðbeiningar til að fara eftir', null, 6, 'tveir', 'venjulegt')
       ) as x(titill, lysing, rod, a_hverjum, forgangur)
 where s.nafn = 'Vörumerki'
   and not exists (select 1 from snid_taskar t where t.snid_id = s.id);

-- ==========================================================================
-- 11. Taskar og verkefni tala saman
--     Framvinda verkefnis er ekki stillt í höndunum heldur reiknuð úr
--     töskunum. Þegar einn er hakaður af hækkar prósentan sjálf.
-- ==========================================================================

alter table taskar add column if not exists rod int not null default 0;

create index if not exists taskar_rod_idx on taskar (verkefni_id, rod);

-- Gefa eldri töskum röð eftir því hvenær þeir urðu til
with radad as (
  select id, row_number() over (partition by verkefni_id order by stofnad) as nr
    from taskar where verkefni_id is not null
)
update taskar t set rod = r.nr from radad r where r.id = t.id and t.rod = 0;

create or replace function reikna_framvindu(vid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare alls int; lokin int; nytt int;
begin
  if vid is null then return; end if;

  select count(*), count(*) filter (where stada = 'lokid')
    into alls, lokin
    from taskar where verkefni_id = vid;

  nytt := case when alls = 0 then 0
               else round(lokin::numeric * 100 / alls) end;

  update verkefni
     set framvinda = nytt,
         -- Fyrsti haki á samþykktu verkefni setur það í vinnslu
         stada = case when nytt > 0 and stada = 'samthykkt' then 'i_vinnslu'
                      else stada end
   where id = vid
     and (framvinda is distinct from nytt or (nytt > 0 and stada = 'samthykkt'));
end;
$$;

create or replace function stilla_framvindu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform reikna_framvindu(old.verkefni_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform reikna_framvindu(new.verkefni_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists stilla_framvindu_trigger on taskar;
create trigger stilla_framvindu_trigger
  after insert or update or delete on taskar
  for each row execute function stilla_framvindu();

-- Reikna allt upp á nýtt einu sinni
do $$
declare v record;
begin
  for v in select id from verkefni loop
    perform reikna_framvindu(v.id);
  end loop;
end;
$$;

-- ==========================================================================
-- 12. Merki viðskiptavinarins
--     Opin geymsla, því merki fyrirtækis er hvort eð er á vef þess.
--     Þá þarf ekki undirritaða slóð í hvert sinn sem hausinn teiknast.
-- ==========================================================================

insert into storage.buckets (id, name, public)
select 'merki', 'merki', true
where not exists (select 1 from storage.buckets where id = 'merki');

drop policy if exists merki_les on storage.objects;
create policy merki_les on storage.objects for select to public
  using (bucket_id = 'merki');

drop policy if exists merki_sett on storage.objects;
create policy merki_sett on storage.objects for insert to authenticated
  with check (bucket_id = 'merki'
              and (er_admin() or (storage.foldername(name))[1] = mitt_fyrirtaeki()::text));

drop policy if exists merki_skipt on storage.objects;
create policy merki_skipt on storage.objects for update to authenticated
  using (bucket_id = 'merki'
         and (er_admin() or (storage.foldername(name))[1] = mitt_fyrirtaeki()::text));

drop policy if exists merki_hent on storage.objects;
create policy merki_hent on storage.objects for delete to authenticated
  using (bucket_id = 'merki'
         and (er_admin() or (storage.foldername(name))[1] = mitt_fyrirtaeki()::text));

-- Viðskiptavinur má uppfæra sína eigin línu í fyrirtaeki
drop policy if exists fyr_eigid_merki on fyrirtaeki;
create policy fyr_eigid_merki on fyrirtaeki for update to authenticated
  using (id = mitt_fyrirtaeki())
  with check (id = mitt_fyrirtaeki());

-- En bara merkið. Nafn, áskrift og áskriftarverð standa óhreyfð,
-- því er_askrift ræður því hvort budget sé skylda á verkefnatillögum.
create or replace function verja_fyrirtaeki() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if er_admin() then return new; end if;
  new.nafn         := old.nafn;
  new.askrift      := old.askrift;
  new.er_askrift   := old.er_askrift;
  new.askrift_verd := old.askrift_verd;
  new.stofnad      := old.stofnad;
  return new;
end;
$$;

drop trigger if exists verja_fyrirtaeki_trigger on fyrirtaeki;
create trigger verja_fyrirtaeki_trigger
  before update on fyrirtaeki
  for each row execute function verja_fyrirtaeki();

-- ==========================================================================
-- 13. Okkar eigin listi
--     Taskar milli okkar tveggja. Þeir fara ekki í taskar-töfluna, því
--     hana les viðskiptavinurinn í sínu fyrirtæki og þar á ekkert af
--     þessu að sjást. Hér er ein stefna og hún hleypir engum inn nema
--     okkur. Tenging á fyrirtæki er valkvæð og bara til að vita hverjum
--     taskurinn tilheyrir.
-- ==========================================================================

create table if not exists innri_taskar (
  id            uuid primary key default gen_random_uuid(),
  titill        text not null,
  lysing        text,
  stada         text not null default 'nytt'
                check (stada in ('nytt', 'i_vinnslu', 'bid', 'lokid')),
  forgangur     text not null default 'venjulegt'
                check (forgangur in ('lagt', 'venjulegt', 'hatt')),
  abyrgd        uuid references notendur on delete set null,
  hofundur      uuid references notendur on delete set null,
  fyrirtaeki_id uuid references fyrirtaeki on delete set null,
  skiladagur    date,
  lokid_dags    timestamptz,
  stofnad       timestamptz not null default now(),
  uppfaert      timestamptz not null default now()
);

create index if not exists innri_taskar_abyrgd_idx on innri_taskar (abyrgd, stada);
create index if not exists innri_taskar_stada_idx  on innri_taskar (stada, skiladagur);

drop trigger if exists stimpla_innri_taskar on innri_taskar;
create trigger stimpla_innri_taskar before update on innri_taskar
  for each row execute function stimpla();

alter table innri_taskar enable row level security;

drop policy if exists innri_taskar_admin on innri_taskar;
create policy innri_taskar_admin on innri_taskar for all to authenticated
  using (er_admin()) with check (er_admin());

-- Yfirlit fyrir Make: það sem liggur á okkur og er komið fram úr skiladegi
create or replace view okkar_a_eftir
with (security_invoker = true) as
  select t.id, t.titill, t.skiladagur, t.forgangur, t.uppfaert,
         n.nafn as abyrgd_nafn, n.netfang as abyrgd_netfang,
         f.nafn as fyrirtaeki
    from innri_taskar t
    left join notendur n   on n.id = t.abyrgd
    left join fyrirtaeki f on f.id = t.fyrirtaeki_id
   where t.stada <> 'lokid'
     and t.skiladagur is not null
     and t.skiladagur < current_date;


-- ==========================================================================
-- 14. Fyrirspurnir: formin á tveir.is og hvaðan fólkið kom
--     Vefurinn skrifar hingað með anon lyklinum um leið og formið fer á
--     Formspree. Stefnan leyfir honum bara að bæta við nýrri línu. Hann
--     getur hvorki lesið, breytt né eytt, og getur ekki sett stöðu, verð
--     eða ábyrgð. Það gerum við á vinnusvæðinu.
-- ==========================================================================

create table if not exists fyrirspurnir (
  id               uuid primary key default gen_random_uuid(),
  nafn             text check (length(nafn) <= 200),
  netfang          text check (length(netfang) <= 200),
  simi             text check (length(simi) <= 60),
  fyrirtaeki_nafn  text check (length(fyrirtaeki_nafn) <= 200),
  skilabod         text check (length(skilabod) <= 5000),
  thjonusta        text check (length(thjonusta) <= 500),
  form             text check (length(form) <= 200),
  gogn             jsonb,
  -- Rakningin. Fyrsta heimsókn ræður uppruna, sú síðasta er geymd með.
  uppruni          text check (length(uppruni) <= 60),
  sidasti_uppruni  text check (length(sidasti_uppruni) <= 60),
  utm_source       text check (length(utm_source) <= 200),
  utm_medium       text check (length(utm_medium) <= 200),
  utm_campaign     text check (length(utm_campaign) <= 200),
  tilvisun         text check (length(tilvisun) <= 500),
  lendingarsida    text check (length(lendingarsida) <= 500),
  fyrsta_heimsokn  timestamptz,
  -- Það sem við stýrum
  stada            text not null default 'ny'
                   check (stada in ('ny', 'haft_samband', 'fundur', 'tilbod', 'unnid', 'tapad')),
  abyrgd           uuid references notendur on delete set null,
  verdmaeti        bigint check (verdmaeti >= 0),
  nota             text,
  stofnad          timestamptz not null default now(),
  uppfaert         timestamptz not null default now()
);

create index if not exists fyrirspurnir_stada_idx on fyrirspurnir (stada, stofnad desc);

drop trigger if exists stimpla_fyrirspurnir on fyrirspurnir;
create trigger stimpla_fyrirspurnir before update on fyrirspurnir
  for each row execute function stimpla();

alter table fyrirspurnir enable row level security;

drop policy if exists fyrirspurnir_admin on fyrirspurnir;
create policy fyrirspurnir_admin on fyrirspurnir for all to authenticated
  using (er_admin()) with check (er_admin());

drop policy if exists fyrirspurnir_vefur on fyrirspurnir;
create policy fyrirspurnir_vefur on fyrirspurnir for insert to anon
  with check (stada = 'ny' and abyrgd is null and verdmaeti is null and nota is null);

grant insert on fyrirspurnir to anon;

-- Yfirlit fyrir Make: nýjar fyrirspurnir sem enginn hefur svarað í sólarhring
create or replace view fyrirspurnir_osvaradar
with (security_invoker = true) as
  select id, nafn, netfang, simi, fyrirtaeki_nafn, form, uppruni, stofnad
    from fyrirspurnir
   where stada = 'ny' and stofnad < now() - interval '1 day';


-- ==========================================================================
-- 15. Bókhald: samningar, aukaverkefni og taxtar
--     Sama og gamla Yfirlit síðan. Upphæð er án VSK nema vsklaust sé
--     merkt, þá er hún endanleg. Vinna í mánuði greiðist 1. dag næsta
--     mánaðar. Bara admin.
-- ==========================================================================

create table if not exists samningar (
  id              uuid primary key default gen_random_uuid(),
  vidskiptavinur  text not null,
  thjonusta       text,
  upphaed         bigint not null check (upphaed >= 0),
  vsklaust        boolean not null default false,
  hefst           text not null check (hefst ~ '^\d{4}-\d{2}$'),
  lykur           text check (lykur ~ '^\d{4}-\d{2}$'),
  stofnad         timestamptz not null default now()
);

create table if not exists aukaverkefni (
  id              uuid primary key default gen_random_uuid(),
  heiti           text not null,
  vidskiptavinur  text,
  upphaed         bigint not null check (upphaed >= 0),
  vsklaust        boolean not null default false,
  dags            date not null default current_date,
  stada           text not null default 'stadfest' check (stada in ('stadfest', 'kannski')),
  greitt          boolean not null default false,
  stofnad         timestamptz not null default now()
);

create table if not exists taxtar (
  id              uuid primary key default gen_random_uuid(),
  vidskiptavinur  text,
  heiti           text not null,
  eining          text,
  upphaed         bigint not null check (upphaed >= 0),
  vsklaust        boolean not null default false,
  stofnad         timestamptz not null default now()
);

alter table samningar    enable row level security;
alter table aukaverkefni enable row level security;
alter table taxtar       enable row level security;

drop policy if exists samningar_admin on samningar;
create policy samningar_admin on samningar for all to authenticated
  using (er_admin()) with check (er_admin());

drop policy if exists aukaverkefni_admin on aukaverkefni;
create policy aukaverkefni_admin on aukaverkefni for all to authenticated
  using (er_admin()) with check (er_admin());

drop policy if exists taxtar_admin on taxtar;
create policy taxtar_admin on taxtar for all to authenticated
  using (er_admin()) with check (er_admin());

-- --------------------------------------------------------------------------
-- 16. Verk úr tölvupósti: verk@tveir.is
-- Lítil skrifta í Google reikningnum okkar les póst sem berst á verk@tveir.is
-- og kallar á fallið hér. Það býr bara til nýjan task, og bara ef sendandinn
-- er þekktur notandi hjá viðskiptavini. Annað getur það ekki gert.
-- Skriftan sannar sig með lykli sem liggur í töflunni stillingar_innri. Enginn
-- kemst í þá töflu nema þetta fall, ekki einu sinni innskráðir notendur.
-- --------------------------------------------------------------------------
create table if not exists stillingar_innri (
  lykill  text primary key,
  gildi   text not null
);
alter table stillingar_innri enable row level security;
revoke all on stillingar_innri from anon, authenticated;
insert into stillingar_innri (lykill, gildi)
values ('postur_lykill', encode(gen_random_bytes(24), 'hex'))
on conflict (lykill) do nothing;

create or replace function taskur_ur_posti(p_lykill text, p_fra text, p_efni text, p_texti text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  n       record;
  lina    text;
  lidir   text[] := '{}';
  efni    text := left(coalesce(nullif(trim(p_efni), ''), 'Verk úr tölvupósti'), 200);
  texti   text := nullif(left(trim(coalesce(p_texti, '')), 5000), '');
  fjoldi  int := 0;
  lidur   text;
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return jsonb_build_object('ok', false, 'villa', 'lykill');
  end if;

  select id, fyrirtaeki_id, nafn into n
    from notendur
   where lower(netfang) = lower(trim(p_fra))
     and hlutverk = 'vidskiptavinur'
     and fyrirtaeki_id is not null
   limit 1;
  if n.id is null then
    return jsonb_build_object('ok', false, 'villa', 'othekktur');
  end if;

  /* Listi í póstinum (línur sem byrja á -, *, • eða 1. / 1)) verður einn
     taskur á hvern lið. Annars verður allur pósturinn einn taskur. */
  foreach lina in array regexp_split_to_array(coalesce(texti, ''), '\r?\n') loop
    if lina ~ '^\s*([-*•–]|\d{1,2}[.)])\s+\S' then
      lidir := lidir || left(trim(regexp_replace(lina, '^\s*([-*•–]|\d{1,2}[.)])\s+', '')), 200);
    end if;
  end loop;

  if array_length(lidir, 1) >= 2 then
    foreach lidur in array lidir[1:30] loop
      insert into taskar (fyrirtaeki_id, titill, lysing, hofundur, stada)
      values (n.fyrirtaeki_id, lidur, 'Úr tölvupósti: ' || efni, n.id, 'nytt');
      fjoldi := fjoldi + 1;
    end loop;
  else
    insert into taskar (fyrirtaeki_id, titill, lysing, hofundur, stada)
    values (n.fyrirtaeki_id, efni, texti, n.id, 'nytt');
    fjoldi := 1;
  end if;

  return jsonb_build_object('ok', true, 'fjoldi', fjoldi, 'nafn', n.nafn,
    'titlar', case when fjoldi > 1 then to_jsonb(lidir[1:30]) else to_jsonb(array[efni]) end,
    'fyrirtaeki', (select nafn from fyrirtaeki where id = n.fyrirtaeki_id));
end;
$$;
revoke all on function taskur_ur_posti(text, text, text, text) from public;
grant execute on function taskur_ur_posti(text, text, text, text) to anon;
