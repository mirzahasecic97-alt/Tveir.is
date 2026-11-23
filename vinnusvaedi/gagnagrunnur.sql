-- ##########################################################################
-- ##  ALDREI KEYRA ÞESSA SKRÁ AFTUR EFTIR STOFUR SKREF 3                  ##
-- ##  (migrations/2026-11-23-stofur-3-foll.sql).                          ##
-- ##########################################################################
-- Hún er frá því fyrir stofurnar og setur gömlu, stofulausu útgáfur fallanna
-- aftur: lyklaföll Apps Script (lykill Tveir sæi þá allar stofur), nyr_notandi
-- (nýr notandi án boðs), er_admin, mitt_fyrirtaeki, vista_tengingu og
-- eyda_tengingu (eyða Vault leyndarmáli eftir nafni) og fleiri. Eftir skref 3 er
-- hver breyting gerð með nýjum flutningi sem er stofu-meðvitaður.
-- Kubburinn hér fyrir neðan stöðvar skrána (og ekkert breytist) ef skref 3 er á.
do $aldrei_aftur$
begin
  if to_regprocedure('public.stofa_blokk(uuid)') is not null then
    raise exception 'Stofur skref 3 er á: þessa skrá má ekki keyra aftur (hún setur gömlu föllin til baka). Ekkert breytt.';
  end if;
end $aldrei_aftur$;
-- ##########################################################################

-- ==========================================================================
-- Tveir vinnusvæði: gagnagrunnur
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
--    Þú býður notanda í Supabase (Authentication -> Users -> Invite) og
--    tengir hann við fyrirtæki á stjórnborðinu. Hlutverk og fyrirtæki eru
--    aldrei lesin úr user metadata, því notandinn getur sjálfur sett hana.
-- --------------------------------------------------------------------------

create or replace function nyr_notandi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notendur (id, netfang, nafn, fyrirtaeki_id, hlutverk)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(left(new.raw_user_meta_data ->> 'nafn', 120), ''), split_part(coalesce(new.email, ''), '@', 1)),
    null,              -- admin tengir við fyrirtæki á stjórnborðinu
    'vidskiptavinur'   -- aldrei úr metadata: admin er aðeins sett í SQL Editor
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
alter table taskar add column if not exists postur_thradur text;
alter table taskar add column if not exists tilkynnt_lokid timestamptz;

create table if not exists stillingar_innri (
  lykill  text primary key,
  gildi   text not null
);
alter table stillingar_innri enable row level security;
revoke all on stillingar_innri from anon, authenticated;
insert into stillingar_innri (lykill, gildi)
values ('postur_lykill', encode(gen_random_bytes(24), 'hex'))
on conflict (lykill) do nothing;

drop function if exists taskur_ur_posti(text, text, text, text);
create or replace function taskur_ur_posti(p_lykill text, p_fra text, p_efni text, p_texti text, p_thradur text default null)
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
  linur   text[];
  stuttar boolean;
  fyrri   text;
  fj      int;
  undirskrift boolean;
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
     taskur á hvern lið. */
  foreach lina in array regexp_split_to_array(coalesce(texti, ''), '\r?\n') loop
    if lina ~ '^\s*([-*•–]|\d{1,2}[.)])\s+\S' then
      lidir := lidir || left(trim(regexp_replace(lina, '^\s*([-*•–]|\d{1,2}[.)])\s+', '')), 200);
    end if;
  end loop;

  /* Enginn listi með merkjum? Þá telst hver lína eitt verk, ef pósturinn er
     bara stuttar línur (til dæmis "hanna logo / laga vefsíðu / finna bolta").
     Kveðja efst, inngangslína sem endar á tvípunkti og undirskrift neðst
     sleppa. Venjulegur póstur með heilum setningum verður áfram eitt verk. */
  if coalesce(array_length(lidir, 1), 0) < 2 then
    linur := '{}';
    stuttar := true;
    undirskrift := false;
    fyrri := '';
    foreach lina in array regexp_split_to_array(coalesce(texti, ''), '\r?\n') loop
      lina := trim(regexp_replace(lina, '[\s\u00a0\u2007\u202f\u200b\ufeff]+', ' ', 'g'));
      continue when lina !~ '[[:alnum:]]';   -- auðar línur og skil eins og ____ eða ---
      fj := coalesce(array_length(linur, 1), 0);

      -- Kveðja eða þakkir: þar byrjar undirskriftin. Efst í póstinum er þeim sleppt.
      if lina ~* '^(kveðja|kveðjur|kv\.?|kær kveðja|kær kv\.?|kærar kveðjur|bestu kveðjur|bestu kv\.?|með kveðju|með bestu kveðju|með bestu kveðjum|mbk\.?|bkv\.?|regards|best regards|kind regards|cheers)([\s,]+[^\s,]+){0,3}[\s,!.]*$'
         or lina ~* '^(takk|takk takk|takk fyrir|takk fyrir mig|takk kærlega|takk kærlega fyrir|kærar þakkir|fyrirfram þakkir|þakka þér fyrir|þakka ykkur fyrir|thanks|thank you)[\s,!.]*$' then
        exit when fj >= 1;
        continue;
      end if;
      exit when lina ~* '^(sent (from|úr|frá) |sendur (úr|frá) |get outlook|sækja outlook)';

      -- Kveðja efst: "Hæ", "Hæ Jón,", "Sæl Anna", "Góðan daginn"
      continue when fj = 0 and (
            lina ~* '^(hæ|hæhæ|hæ hæ|halló|hallo|hi|hello|hey|sæl|sæll|sælir|sælar|sæl öll|sæl og blessuð|sæll og blessaður|góðan dag|góðan daginn|gott kvöld|dear|kæri|kæra|kæru)[\s,!.]*$'
         or lina ~* '^(hæ|hæhæ|halló|hallo|hi|hello|hey|sæl|sæll|sælir|sælar|sæl og blessuð|sæll og blessaður|góðan dag|góðan daginn|dear|kæri|kæra|kæru)(\s+[^\s,!.]+){1,3}\s*[,!]$'
         or lina ~ '^([Hh]æ|[Hh]alló|[Hh]i|[Hh]ello|[Hh]ey|[Ss]æl|[Ss]æll|[Ss]ælir|[Ss]ælar|[Kk]æri|[Kk]æra|[Kk]æru|[Dd]ear)\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s,!.]*(\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s,!.]*)?[.]?$');

      -- Inngangur eins og "Hér eru verkin:"
      continue when lina ~ ':$';

      -- Undirskrift án kveðju: sími, netfang, vefur eða fyrirtæki ein á línu
      if fj >= 1 and (
            lina ~* '^(s\.|sími|gsm|tel\.?|farsími|mobile|m\.)\s*:?\s*\+?[0-9 ()-]{7,}$'
         or lina ~ '^\+?[0-9 ()-]{7,}$'
         or lina ~ '^\S+@\S+$'
         or lina ~* '^(www\.|https?://)\S+$'
         or lina ~ '^\[image'
         or lina ~* '\s(ehf|hf|slf|sf)\.?$') then
        undirskrift := true;
        exit;
      end if;

      -- Setningar, spurningar eða framhald línu: þetta er venjulegur póstur, ekki listi
      if length(lina) > 150
         or lina ~ '[[:alpha:]]{3,}[.]\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])'
         or lina ~ '[!?]\s+[[:alpha:]]'
         or lina ~ '[?]$'
         or lina ~* '^(ég|mér|mig|okkur|við (erum|vorum|viljum|þurfum|ætlum|værum)|það|þetta|hér er|svo|en|og|því|af því|ef|getið|gætuð|gætir|geturðu|getur þú|væri|viljið|vonandi)(\s|,|$)'
         or (lina ~ '^[[:lower:]]' and length(fyrri) >= 60) then
        stuttar := false;
        exit;
      end if;

      linur := linur || left(lina, 200);
      fyrri := lina;
    end loop;

    -- Nafn neðst án kveðju: "Jón Jónsson", eða "Anna" á eftir einni beiðni
    fj := coalesce(array_length(linur, 1), 0);
    -- Fyrir ofan síma eða netfang standa nafn og starfsheiti: þeim er sleppt líka
    if undirskrift then
      while fj >= 1 and linur[fj] ~ '^([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*(\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*){0,2}$' loop
        linur := linur[1:fj - 1];
        fj := fj - 1;
      end loop;
    end if;
    if fj >= 2
       and linur[fj] ~ '^([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*(\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*){0,2}$'
       and (fj = 2 or linur[fj] ~ '\s') then
      linur := linur[1:fj - 1];
      fj := fj - 1;
    end if;

    -- Bara 2 til 15 stuttar línur teljast listi, annað verður eitt verk
    if stuttar and fj between 2 and 15 then
      lidir := linur;
    end if;
  end if;

  if array_length(lidir, 1) >= 2 then
    foreach lidur in array lidir[1:30] loop
      insert into taskar (fyrirtaeki_id, titill, lysing, hofundur, stada, postur_thradur)
      values (n.fyrirtaeki_id, lidur, 'Úr tölvupósti: ' || efni || coalesce(E'\n\n' || texti, ''), n.id, 'nytt', p_thradur);
      fjoldi := fjoldi + 1;
    end loop;
  else
    insert into taskar (fyrirtaeki_id, titill, lysing, hofundur, stada, postur_thradur)
    values (n.fyrirtaeki_id, efni, texti, n.id, 'nytt', p_thradur);
    fjoldi := 1;
  end if;

  return jsonb_build_object('ok', true, 'fjoldi', fjoldi, 'nafn', n.nafn,
    'titlar', case when fjoldi > 1 then to_jsonb(lidir[1:30]) else to_jsonb(array[efni]) end,
    'fyrirtaeki', (select nafn from fyrirtaeki where id = n.fyrirtaeki_id));
end;
$$;
revoke all on function taskur_ur_posti(text, text, text, text, text) from public;
grant execute on function taskur_ur_posti(text, text, text, text, text) to anon;


-- --------------------------------------------------------------------------
-- 17. Lokið: sá sem bað um taskinn fær að vita það
-- Þegar task frá viðskiptavini er hakaður í lokið sækir sama Google skrifta
-- hann hér, svarar sendandanum (í sama pósti ef taskurinn kom með pósti) og
-- merkir hann tilkynntan. Opnist taskur aftur og lokist á ný fer ný tilkynning.
-- --------------------------------------------------------------------------
create or replace function lokid_otilkynnt(p_lykill text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'titill', t.titill, 'netfang', n.netfang,
                                        'nafn', n.nafn, 'thradur', t.postur_thradur))
      from taskar t
      join notendur n on n.id = t.hofundur
     where t.stada = 'lokid'
       and t.lokid_dags is not null
       and n.hlutverk = 'vidskiptavinur'
       and coalesce(n.netfang, '') <> ''
       and (t.tilkynnt_lokid is null or t.tilkynnt_lokid < t.lokid_dags)
  ), '[]'::jsonb);
end;
$$;
revoke all on function lokid_otilkynnt(text) from public;
grant execute on function lokid_otilkynnt(text) to anon;

create or replace function merkja_tilkynnt(p_lykill text, p_ids uuid[])
returns int
language plpgsql security definer set search_path = public as $$
declare fjoldi int;
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return 0;
  end if;
  update taskar set tilkynnt_lokid = now() where id = any(p_ids) and stada = 'lokid';
  get diagnostics fjoldi = row_count;
  return fjoldi;
end;
$$;
revoke all on function merkja_tilkynnt(text, uuid[]) from public;
grant execute on function merkja_tilkynnt(text, uuid[]) to anon;

-- Það sem var lokið áður en þetta kom inn telst tilkynnt, svo enginn fái gamlan póst
update taskar set tilkynnt_lokid = now() where stada = 'lokid' and tilkynnt_lokid is null;


-- ==========================================================================
-- 18. Undirverk: mörg skil innan eins tasks
--     Dæmi: fjögur myndbönd fyrir sama viðskiptavin. Hvert myndband er
--     undirverk. Þegar við hökum í eitt og setjum skrá eða hlekk með sendir
--     skriftan verk-postur.gs viðskiptavininum póst innan 5 mínútna.
--
--     Stendur líka sér í migrations/2026-11-16-undirverk.sql, til að keyra
--     eitt og sér á gagnagrunn sem er þegar til.
--
--     Skrár fara í lokuðu geymsluna vidhengi undir
--     <fyrirtaeki_id>/undirverk/<task_id>/<undirverk_id>/<nafn>, svo sömu
--     stefnur og fyrir viðhengi gilda: fyrirtækið les bara sína möppu,
--     bara admin eyðir.
-- ==========================================================================

create table if not exists undirverk (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references taskar on delete cascade,
  -- Sett af trigger úr taskinum, aldrei úr vafranum
  fyrirtaeki_id uuid not null references fyrirtaeki on delete cascade,
  rod           int  not null default 0,
  titill        text not null check (length(titill) between 1 and 200),
  lokid         boolean not null default false,
  lokid_dags    timestamptz,
  -- Skrá í geymslunni vidhengi, eða hlekkur annars staðar (WeTransfer, Drive)
  skra_slod     text check (length(skra_slod) <= 600),
  skra_nafn     text check (length(skra_nafn) <= 300),
  skra_staerd   bigint,
  tengill       text check (tengill ~ '^https://\S+$' and length(tengill) <= 2000),
  -- false: hakað í lokið án þess að senda viðskiptavininum póst
  senda         boolean not null default true,
  sent_dags     timestamptz,
  stofnad       timestamptz not null default now(),
  uppfaert      timestamptz not null default now()
);

create index if not exists undirverk_task_idx       on undirverk (task_id, rod);
create index if not exists undirverk_fyrirtaeki_idx on undirverk (fyrirtaeki_id);
create index if not exists undirverk_osent_idx      on undirverk (lokid_dags)
  where lokid and senda;

-- fyrirtaeki_id kemur alltaf úr taskinum, lokid_dags úr hakinu.
-- Skráin verður að liggja í möppu þessa undirverks, svo póstur eða
-- afhendingarnotandinn geti aldrei opnað skrá annars fyrirtækis.
create or replace function stilla_undirverk() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mappa text;
  nafn  text;
begin
  if tg_op = 'UPDATE' and new.task_id is distinct from old.task_id then
    raise exception 'Undirverk færist ekki á milli taska';
  end if;
  new.fyrirtaeki_id := (select fyrirtaeki_id from taskar where id = new.task_id);
  if new.fyrirtaeki_id is null then
    raise exception 'Taskurinn fannst ekki';
  end if;

  if new.skra_slod is not null
     and (tg_op = 'INSERT' or new.skra_slod is distinct from old.skra_slod) then
    mappa := new.fyrirtaeki_id::text || '/undirverk/' || new.task_id::text || '/' || new.id::text || '/';
    nafn  := substr(new.skra_slod, length(mappa) + 1);
    if left(new.skra_slod, length(mappa)) <> mappa
       or nafn in ('', '.', '..') or position('/' in nafn) > 0 then
      raise exception 'Skráin þarf að liggja í möppu undirverksins';
    end if;
  end if;

  if new.lokid and (tg_op = 'INSERT' or not old.lokid) then
    new.lokid_dags := now();
  elsif new.lokid then
    new.lokid_dags := old.lokid_dags;   -- nafnabreyting má ekki færa dagsetninguna
  else
    new.lokid_dags := null;
  end if;
  if tg_op = 'INSERT' then
    new.sent_dags := null;
  end if;
  new.uppfaert := now();
  return new;
end;
$$;

drop trigger if exists stilla_undirverk_trigger on undirverk;
create trigger stilla_undirverk_trigger
  before insert or update on undirverk
  for each row execute function stilla_undirverk();

-- Færist taskur á annað fyrirtæki fylgja undirverkin með
create or replace function faera_undirverk() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update undirverk set fyrirtaeki_id = new.fyrirtaeki_id where task_id = new.id;
  return new;
end;
$$;

drop trigger if exists faera_undirverk_trigger on taskar;
create trigger faera_undirverk_trigger
  after update of fyrirtaeki_id on taskar
  for each row when (old.fyrirtaeki_id is distinct from new.fyrirtaeki_id)
  execute function faera_undirverk();

alter table undirverk enable row level security;

-- Viðskiptavinur les undirverk síns fyrirtækis. Hann getur hvorki bætt við,
-- breytt né eytt. Það gerum við.
drop policy if exists undirverk_les on undirverk;
create policy undirverk_les on undirverk for select to authenticated
  using (er_admin() or fyrirtaeki_id = mitt_fyrirtaeki());

drop policy if exists undirverk_admin on undirverk;
create policy undirverk_admin on undirverk for all to authenticated
  using (er_admin()) with check (er_admin());

-- --------------------------------------------------------------------------
-- Póstur þegar undirverk er klárt
-- Sama Google skrifta og sama lykill og lokid_otilkynnt. Viðtakandi:
-- sá sem bað um taskinn ef það var viðskiptavinur, annars allir notendur
-- viðskiptavinarins í því fyrirtæki.
-- --------------------------------------------------------------------------
create or replace function undirverk_otilkynnt(p_lykill text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(x order by x->>'task_id', (x->>'nr')::int)
      from (
        select jsonb_build_object(
                 'id', u.id,
                 'titill', u.titill,
                 'task_id', t.id,
                 'task_titill', t.titill,
                 'fyrirtaeki', f.nafn,
                 'tengill', u.tengill,
                 'skra_slod', u.skra_slod,
                 'skra_nafn', u.skra_nafn,
                 'nr', (select count(*) from undirverk s
                         where s.task_id = u.task_id
                           and (s.rod, s.stofnad) <= (u.rod, u.stofnad)),
                 'lokin', (select count(*) from undirverk s where s.task_id = u.task_id and s.lokid),
                 'fjoldi', (select count(*) from undirverk s where s.task_id = u.task_id),
                 'thradur', case when hof.id is not null then t.postur_thradur end,
                 'nafn', case when hof.id is not null then hof.nafn end,
                 'netfong', coalesce(
                   case when hof.id is not null then jsonb_build_array(hof.netfang) end,
                   (select jsonb_agg(n.netfang order by n.stofnad)
                      from notendur n
                     where n.fyrirtaeki_id = t.fyrirtaeki_id
                       and n.hlutverk = 'vidskiptavinur'
                       and coalesce(n.netfang, '') <> ''))
               ) as x
          from undirverk u
          join taskar t     on t.id = u.task_id
          join fyrirtaeki f on f.id = t.fyrirtaeki_id
          left join notendur hof
                 on hof.id = t.hofundur
                and hof.hlutverk = 'vidskiptavinur'
                and hof.fyrirtaeki_id = t.fyrirtaeki_id
                and coalesce(hof.netfang, '') <> ''
         where u.lokid
           and u.senda
           and u.lokid_dags is not null
           and (u.sent_dags is null or u.sent_dags < u.lokid_dags)
      ) q
     where x->'netfong' is not null and jsonb_array_length(x->'netfong') > 0
  ), '[]'::jsonb);
end;
$$;
revoke all on function undirverk_otilkynnt(text) from public;
grant execute on function undirverk_otilkynnt(text) to anon;

create or replace function merkja_undirverk_sent(p_lykill text, p_ids uuid[])
returns int
language plpgsql security definer set search_path = public as $$
declare fjoldi int;
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return 0;
  end if;
  update undirverk set sent_dags = now() where id = any(p_ids) and lokid;
  get diagnostics fjoldi = row_count;
  return fjoldi;
end;
$$;
revoke all on function merkja_undirverk_sent(text, uuid[]) from public;
grant execute on function merkja_undirverk_sent(text, uuid[]) to anon;

-- --------------------------------------------------------------------------
-- Valkvætt: hlekkur beint á skrána í póstinum (gildir í 7 daga)
-- Supabase býr til undirritaða slóð bara fyrir innskráðan notanda sem má
-- lesa skrána. Skriftan skráir sig því inn sem sérstakur notandi,
-- afhending@tveir.is, sem má lesa skrár undirverka sem er lokið og ekkert
-- annað. Hver hann er stendur í stillingar_innri, ekki í user metadata.
-- Sé hann ekki settur upp fær viðskiptavinurinn hlekk á vinnusvæðið í
-- staðinn og sækir skrána þar. Sjá LESTU-MIG.md, kaflann Undirverk.
-- --------------------------------------------------------------------------
create or replace function afhending_ma_lesa(p_slod text)
returns boolean
language sql security definer stable set search_path = public as $$
  select auth.uid() is not null
     and auth.uid()::text = (select gildi from stillingar_innri where lykill = 'afhending_notandi')
     and exists (select 1 from undirverk u where u.skra_slod = p_slod and u.lokid)
$$;
-- Supabase gefur anon aðgang að nýjum föllum sjálfgefið, svo það er tekið af
revoke all on function afhending_ma_lesa(text) from public, anon;
grant execute on function afhending_ma_lesa(text) to authenticated;

drop policy if exists vidhengi_afhending on storage.objects;
create policy vidhengi_afhending on storage.objects for select to authenticated
  using (bucket_id = 'vidhengi' and afhending_ma_lesa(name));

-- --------------------------------------------------------------------------
-- Viðskiptavinur sækir skrá undirverks bara þegar því er lokið
-- Slóðin <fyrirtaeki_id>/undirverk/... er í möppu fyrirtækisins, svo
-- vidhengi_les hleypti honum annars í skrá sem við erum enn að vinna í.
-- Venjuleg viðhengi (<fyrirtaeki_id>/<task_id>/...) eru óbreytt.
-- --------------------------------------------------------------------------
create or replace function undirverk_skra_opin(p_slod text)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from undirverk u
                  where u.skra_slod = p_slod and u.lokid
                    and u.fyrirtaeki_id = mitt_fyrirtaeki())
$$;
revoke all on function undirverk_skra_opin(text) from public, anon;
grant execute on function undirverk_skra_opin(text) to authenticated;

drop policy if exists vidhengi_les on storage.objects;
create policy vidhengi_les on storage.objects for select to authenticated
  using (bucket_id = 'vidhengi'
         and (er_admin()
              or ((storage.foldername(name))[1] = mitt_fyrirtaeki()::text
                  and ((storage.foldername(name))[2] is distinct from 'undirverk'
                       or undirverk_skra_opin(name)))));

-- --------------------------------------------------------------------------
-- Notandi breytir ekki eigin fyrirtæki, hlutverki eða netfangi
-- Stefnan not_eigid leyfir notanda að uppfæra sína línu. Án þessa gæti
-- viðskiptavinur sett fyrirtaeki_id annars fyrirtækis á sig og lesið gögn
-- þess, eða sett annað netfang og fengið póstinn um undirverk sendan þangað.
-- Admin (og SQL Editor, þar sem enginn er innskráður) má áfram breyta öllu.
-- --------------------------------------------------------------------------
create or replace function vernda_notanda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not er_admin() then
    new.id            := old.id;
    new.fyrirtaeki_id := old.fyrirtaeki_id;
    new.hlutverk      := old.hlutverk;
    new.netfang       := old.netfang;
  end if;
  return new;
end;
$$;

drop trigger if exists vernda_notanda_trigger on notendur;
create trigger vernda_notanda_trigger
  before update on notendur
  for each row execute function vernda_notanda();

-- ==========================================================================
-- 19. Póstur strax þegar hakað er í lokið
--     Áður beið pósturinn eftir 5 mínútna vakt Google skriftunnar. Nú kallar
--     gagnagrunnurinn á skriftuna (vefapp) um leið og taskur eða undirverk
--     er hakað í lokið, og pósturinn fer innan nokkurra sekúndna.
--     5 mínútna vaktin er áfram til vara: takist kallið ekki fer pósturinn
--     í næstu umferð hennar.
--
--     pg_net sendir kallið eftir að færslan hefur verið vistuð, svo skriftan
--     sér alltaf nýju stöðuna og skrána eða hlekkinn sem fylgdi.
--
--     Slóð vefappsins er sett einu sinni (sjá LESTU-MIG.md):
--       insert into stillingar_innri (lykill, gildi)
--       values ('postur_vefkrokur', 'https://script.google.com/macros/s/.../exec')
--       on conflict (lykill) do update set gildi = excluded.gildi;
--     Án hennar gerist ekkert nýtt og allt virkar eins og áður.
-- ==========================================================================

create extension if not exists pg_net with schema extensions;

create or replace function vekja_postinn() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  slod   text := (select gildi from stillingar_innri where lykill = 'postur_vefkrokur');
  lykill text := (select gildi from stillingar_innri where lykill = 'postur_lykill');
begin
  /* Bara Google vefapp, svo lykillinn fari aldrei annað */
  if slod is null or lykill is null
     or slod !~ '^https://script\.google\.com/(a/macros/[a-z0-9.-]+|macros)/s/[A-Za-z0-9_-]+/exec$' then
    return null;
  end if;
  begin
    perform net.http_post(
      url := slod,
      body := jsonb_build_object('lykill', lykill),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 30000
    );
  exception when others then
    null;  /* hakið má aldrei mistakast út af póstinum, vaktin nær honum */
  end;
  return null;
end;
$$;
revoke all on function vekja_postinn() from public, anon, authenticated;

drop trigger if exists vekja_postinn_taskar on taskar;
create trigger vekja_postinn_taskar
  after update of stada on taskar
  for each row when (new.stada = 'lokid' and old.stada is distinct from 'lokid')
  execute function vekja_postinn();

drop trigger if exists vekja_postinn_undirverk_nytt on undirverk;
create trigger vekja_postinn_undirverk_nytt
  after insert on undirverk
  for each row when (new.lokid and new.senda)
  execute function vekja_postinn();

drop trigger if exists vekja_postinn_undirverk on undirverk;
create trigger vekja_postinn_undirverk
  after update of lokid on undirverk
  for each row when (new.lokid and not old.lokid and new.senda)
  execute function vekja_postinn();

-- ==========================================================================
-- 21. Tölfræði: fylgjendur, áhorf og mánaðarskýrslur
--     Hver viðskiptavinur á sína miðla (Instagram, Facebook, TikTok). Á
--     hverjum degi sækir Google skriftan (tolfraedi.gs) tölurnar frá Meta og
--     skrifar eina línu á miðil á dag í maelingar, og færslurnar í
--     midla_faerslur. TikTok og annað er skráð í höndunum eða flutt inn úr CSV.
--
--     1. hvers mánaðar býr skriftan til drög að skýrslu fyrir hvert fyrirtæki.
--     Mirza les þau á Tölfræði síðunni og ýtir á Samþykkja og senda. Þá
--     kallar gagnagrunnurinn strax á skriftuna (sama leið og í kafla 19) og
--     viðskiptavinurinn fær skýrsluna í pósti.
--
--     Viðskiptavinur les bara tölur síns fyrirtækis og bara skýrslur sem
--     hafa verið sendar. Hann skrifar aldrei neitt hér. Skriftan kemst bara
--     inn með lyklinum úr stillingar_innri, eins og í köflum 16 til 18.
--
--     Stendur líka sér í migrations/2026-11-18-tolfraedi.sql. Má keyra aftur.
-- ==========================================================================

create table if not exists midlar (
  id            uuid primary key default gen_random_uuid(),
  fyrirtaeki_id uuid not null references fyrirtaeki on delete cascade,
  midill        text not null check (midill in ('instagram', 'facebook', 'tiktok')),
  -- Notandanafn eða nafn síðunnar
  nafn          text not null check (length(nafn) between 1 and 120),
  -- Auðkenni hjá Meta (Page ID eða Instagram account ID). Autt: bara handvirkt
  ytra_id       text check (length(ytra_id) between 1 and 100),
  slod          text check (slod ~ '^https://\S+$' and length(slod) <= 500),
  virkt         boolean not null default true,
  stofnad       timestamptz not null default now(),
  unique (fyrirtaeki_id, midill, nafn)
);

-- Ein lína á miðil á dag. Autt gildi þýðir að talan er ekki til, ekki núll.
create table if not exists maelingar (
  midill_id     uuid not null references midlar on delete cascade,
  -- Sett af trigger úr miðlinum, aldrei úr vafranum
  fyrirtaeki_id uuid not null references fyrirtaeki on delete cascade,
  dags          date not null,
  fylgjendur    int    check (fylgjendur >= 0),
  ahorf         bigint check (ahorf >= 0),
  nadir         bigint check (nadir >= 0),
  -- like, athugasemdir, deilingar og vistanir saman
  samskipti     bigint check (samskipti >= 0),
  heimsoknir    bigint check (heimsoknir >= 0),
  -- Færslur birtar þann dag
  faerslur      int    check (faerslur >= 0),
  uppruni       text not null default 'handvirkt'
                check (uppruni in ('sjalfvirkt', 'handvirkt', 'innflutt')),
  uppfaert      timestamptz not null default now(),
  primary key (midill_id, dags)
);

create table if not exists midla_faerslur (
  id            uuid primary key default gen_random_uuid(),
  midill_id     uuid not null references midlar on delete cascade,
  fyrirtaeki_id uuid not null references fyrirtaeki on delete cascade,
  ytra_id       text not null check (length(ytra_id) between 1 and 100),
  birt          timestamptz,
  tegund        text check (tegund in ('mynd', 'myndband', 'reel', 'karusell', 'saga', 'annad')),
  texti         text check (length(texti) <= 500),
  -- Myndaslóðir frá Meta eru langar, því 2000 stafir
  slod          text check (slod ~ '^https://\S+$' and length(slod) <= 2000),
  mynd_slod     text check (mynd_slod ~ '^https://\S+$' and length(mynd_slod) <= 2000),
  ahorf         bigint check (ahorf >= 0),
  nadir         bigint check (nadir >= 0),
  likes         bigint check (likes >= 0),
  athugasemdir  bigint check (athugasemdir >= 0),
  deilingar     bigint check (deilingar >= 0),
  vistanir      bigint check (vistanir >= 0),
  uppfaert      timestamptz not null default now(),
  unique (midill_id, ytra_id)
);

create table if not exists skyrslur (
  id             uuid primary key default gen_random_uuid(),
  fyrirtaeki_id  uuid not null references fyrirtaeki on delete cascade,
  -- Alltaf fyrsti dagur mánaðarins
  manudur        date not null check (manudur = date_trunc('month', manudur)::date),
  tolur          jsonb not null default '{}' check (length(tolur::text) <= 200000),
  samantekt      text check (length(samantekt) <= 4000),
  stada          text not null default 'drog' check (stada in ('drog', 'samthykkt', 'send')),
  samthykkt_dags timestamptz,
  sent_dags      timestamptz,
  stofnad        timestamptz not null default now(),
  unique (fyrirtaeki_id, manudur)
);

-- Fyrir lykla sem hver miðill gæti þurft seinna (til dæmis TikTok).
-- Engar stefnur: enginn innskráður notandi kemst hér inn, bara SQL Editor.
create table if not exists midlar_innri (
  midill_id uuid primary key references midlar on delete cascade,
  gogn      jsonb not null
);

create index if not exists midlar_fyrirtaeki_idx         on midlar (fyrirtaeki_id);
create index if not exists maelingar_fyrirtaeki_idx      on maelingar (fyrirtaeki_id, dags);
create index if not exists midla_faerslur_fyrirtaeki_idx on midla_faerslur (fyrirtaeki_id, birt);
create index if not exists midla_faerslur_midill_idx     on midla_faerslur (midill_id, birt);
create index if not exists skyrslur_osent_idx            on skyrslur (stofnad)
  where stada = 'samthykkt' and sent_dags is null;

-- fyrirtaeki_id kemur alltaf úr miðlinum, svo enginn geti skráð tölur á
-- annað fyrirtæki með því að senda rangt auðkenni.
create or replace function stilla_maelingu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.fyrirtaeki_id := (select fyrirtaeki_id from midlar where id = new.midill_id);
  if new.fyrirtaeki_id is null then
    raise exception 'Miðillinn fannst ekki';
  end if;
  new.uppfaert := now();
  return new;
end;
$$;
revoke all on function stilla_maelingu() from public, anon, authenticated;

drop trigger if exists stilla_maelingar_trigger on maelingar;
create trigger stilla_maelingar_trigger
  before insert or update on maelingar
  for each row execute function stilla_maelingu();

drop trigger if exists stilla_midla_faerslur_trigger on midla_faerslur;
create trigger stilla_midla_faerslur_trigger
  before insert or update on midla_faerslur
  for each row execute function stilla_maelingu();

-- Færist miðill á annað fyrirtæki fylgja tölurnar og færslurnar með
create or replace function faera_maelingar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update maelingar      set fyrirtaeki_id = new.fyrirtaeki_id where midill_id = new.id;
  update midla_faerslur set fyrirtaeki_id = new.fyrirtaeki_id where midill_id = new.id;
  return new;
end;
$$;
revoke all on function faera_maelingar() from public, anon, authenticated;

drop trigger if exists faera_maelingar_trigger on midlar;
create trigger faera_maelingar_trigger
  after update of fyrirtaeki_id on midlar
  for each row when (old.fyrirtaeki_id is distinct from new.fyrirtaeki_id)
  execute function faera_maelingar();

-- Staða skýrslu: drog -> samthykkt -> send. Send skýrsla fer ekki til baka,
-- því viðskiptavinurinn er þá þegar kominn með hana. sent_dags er bara til
-- á sendri skýrslu, svo samþykkt skýrsla bíður alltaf eftir póstinum.
create or replace function stilla_skyrslu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.stada = 'send' and new.stada <> 'send' then
    raise exception 'Skýrslan hefur verið send og fer ekki aftur í drög';
  end if;
  new.manudur := date_trunc('month', new.manudur)::date;
  if new.stada = 'drog' then
    new.samthykkt_dags := null;
    new.sent_dags := null;
  elsif new.stada = 'samthykkt' then
    if tg_op = 'INSERT' or old.stada is distinct from 'samthykkt' then
      new.samthykkt_dags := now();
    else
      new.samthykkt_dags := old.samthykkt_dags;
    end if;
    new.sent_dags := null;
  else
    new.samthykkt_dags := coalesce(new.samthykkt_dags, now());
    new.sent_dags := coalesce(new.sent_dags, now());
  end if;
  return new;
end;
$$;
revoke all on function stilla_skyrslu() from public, anon, authenticated;

drop trigger if exists stilla_skyrslu_trigger on skyrslur;
create trigger stilla_skyrslu_trigger
  before insert or update on skyrslur
  for each row execute function stilla_skyrslu();

-- Samþykkt skýrsla fer strax, sama leið og lokið í kafla 19
drop trigger if exists vekja_postinn_skyrslur on skyrslur;
create trigger vekja_postinn_skyrslur
  after update of stada on skyrslur
  for each row when (new.stada = 'samthykkt' and old.stada is distinct from 'samthykkt')
  execute function vekja_postinn();

drop trigger if exists vekja_postinn_skyrslur_ny on skyrslur;
create trigger vekja_postinn_skyrslur_ny
  after insert on skyrslur
  for each row when (new.stada = 'samthykkt')
  execute function vekja_postinn();

alter table midlar         enable row level security;
alter table maelingar      enable row level security;
alter table midla_faerslur enable row level security;
alter table skyrslur       enable row level security;
alter table midlar_innri   enable row level security;
revoke all on midlar_innri from anon, authenticated;

-- Viðskiptavinur les sín gögn, admin gerir allt. Enginn viðskiptavinur skrifar.
drop policy if exists midlar_les on midlar;
create policy midlar_les on midlar for select to authenticated
  using (er_admin() or fyrirtaeki_id = mitt_fyrirtaeki());

drop policy if exists midlar_admin on midlar;
create policy midlar_admin on midlar for all to authenticated
  using (er_admin()) with check (er_admin());

drop policy if exists maelingar_les on maelingar;
create policy maelingar_les on maelingar for select to authenticated
  using (er_admin() or fyrirtaeki_id = mitt_fyrirtaeki());

drop policy if exists maelingar_admin on maelingar;
create policy maelingar_admin on maelingar for all to authenticated
  using (er_admin()) with check (er_admin());

drop policy if exists midla_faerslur_les on midla_faerslur;
create policy midla_faerslur_les on midla_faerslur for select to authenticated
  using (er_admin() or fyrirtaeki_id = mitt_fyrirtaeki());

drop policy if exists midla_faerslur_admin on midla_faerslur;
create policy midla_faerslur_admin on midla_faerslur for all to authenticated
  using (er_admin()) with check (er_admin());

-- Drög og samþykktar skýrslur sjást ekki fyrr en þær hafa verið sendar
drop policy if exists skyrslur_les on skyrslur;
create policy skyrslur_les on skyrslur for select to authenticated
  using (er_admin() or (fyrirtaeki_id = mitt_fyrirtaeki() and stada = 'send'));

drop policy if exists skyrslur_admin on skyrslur;
create policy skyrslur_admin on skyrslur for all to authenticated
  using (er_admin()) with check (er_admin());

-- Tala úr gögnum að utan: heil tala 0 eða stærri, annars autt.
-- Rusl eða mínustala frá API stöðvar því aldrei alla sendinguna.
create or replace function tolu_gildi(p_gildi text) returns bigint
language sql immutable set search_path = public as $$
  select case when trim(p_gildi) ~ '^[0-9]{1,18}$' then trim(p_gildi)::bigint end
$$;
revoke all on function tolu_gildi(text) from public, anon, authenticated;

-- --------------------------------------------------------------------------
-- Föll fyrir Google skriftuna. Sama lykill og í köflum 16 til 18.
-- --------------------------------------------------------------------------

-- Miðlar sem skriftan sækir tölur fyrir: virkir og með auðkenni hjá Meta
create or replace function midlar_til_soefnunar(p_lykill text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'fyrirtaeki_id', m.fyrirtaeki_id,
                                        'fyrirtaeki', f.nafn, 'midill', m.midill,
                                        'nafn', m.nafn, 'ytra_id', m.ytra_id)
                     order by f.nafn, m.midill, m.nafn)
      from midlar m
      join fyrirtaeki f on f.id = m.fyrirtaeki_id
     where m.virkt and m.ytra_id is not null
  ), '[]'::jsonb);
end;
$$;
revoke all on function midlar_til_soefnunar(text) from public;
grant execute on function midlar_til_soefnunar(text) to anon;

-- Tölur dagsins. Autt gildi skrifar ekki yfir það sem er komið, og það sem
-- var skráð í höndunum gildir alltaf framar sjálfvirku tölunum.
create or replace function skra_maelingar(p_lykill text, p_gogn jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  e       jsonb;
  v_dags  date;
  fjoldi  int := 0;
  n       int;
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return 0;
  end if;
  if p_gogn is null or jsonb_typeof(p_gogn) <> 'array' then
    return 0;
  end if;

  for e in select * from jsonb_array_elements(p_gogn) loop
    begin
      continue when jsonb_typeof(e) <> 'object';
      v_dags := (e ->> 'dags')::date;
      continue when v_dags is null or v_dags < date '2000-01-01' or v_dags > current_date + 1;
      -- Engin tala í línunni: ekkert að skrifa
      continue when coalesce(tolu_gildi(e ->> 'fylgjendur'), tolu_gildi(e ->> 'ahorf'),
                             tolu_gildi(e ->> 'nadir'), tolu_gildi(e ->> 'samskipti'),
                             tolu_gildi(e ->> 'heimsoknir'), tolu_gildi(e ->> 'faerslur')) is null;

      insert into maelingar as g (midill_id, fyrirtaeki_id, dags, fylgjendur, ahorf, nadir,
                                  samskipti, heimsoknir, faerslur, uppruni)
      select m.id, m.fyrirtaeki_id, v_dags,
             tolu_gildi(e ->> 'fylgjendur'), tolu_gildi(e ->> 'ahorf'), tolu_gildi(e ->> 'nadir'),
             tolu_gildi(e ->> 'samskipti'), tolu_gildi(e ->> 'heimsoknir'), tolu_gildi(e ->> 'faerslur'),
             'sjalfvirkt'
        from midlar m
       where m.id = (e ->> 'midill_id')::uuid
      on conflict (midill_id, dags) do update set
        fylgjendur = coalesce(excluded.fylgjendur, g.fylgjendur),
        ahorf      = coalesce(excluded.ahorf,      g.ahorf),
        nadir      = coalesce(excluded.nadir,      g.nadir),
        samskipti  = coalesce(excluded.samskipti,  g.samskipti),
        heimsoknir = coalesce(excluded.heimsoknir, g.heimsoknir),
        faerslur   = coalesce(excluded.faerslur,   g.faerslur),
        uppruni    = 'sjalfvirkt'
      where g.uppruni <> 'handvirkt';
      get diagnostics n = row_count;
      fjoldi := fjoldi + n;
    exception when others then
      null;  -- ein gölluð lína má ekki stöðva hinar
    end;
  end loop;
  return fjoldi;
end;
$$;
revoke all on function skra_maelingar(text, jsonb) from public;
grant execute on function skra_maelingar(text, jsonb) to anon;

-- Færslur og tölurnar þeirra. Hlekkir sem eru ekki https detta út.
create or replace function skra_faerslur(p_lykill text, p_gogn jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  e       jsonb;
  v_ytra  text;
  v_slod  text;
  v_mynd  text;
  v_teg   text;
  fjoldi  int := 0;
  n       int;
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return 0;
  end if;
  if p_gogn is null or jsonb_typeof(p_gogn) <> 'array' then
    return 0;
  end if;

  for e in select * from jsonb_array_elements(p_gogn) loop
    begin
      continue when jsonb_typeof(e) <> 'object';
      v_ytra := nullif(trim(e ->> 'ytra_id'), '');
      continue when v_ytra is null or length(v_ytra) > 100;
      v_slod := trim(e ->> 'slod');
      v_slod := case when v_slod ~ '^https://\S+$' and length(v_slod) <= 2000 then v_slod end;
      v_mynd := trim(e ->> 'mynd_slod');
      v_mynd := case when v_mynd ~ '^https://\S+$' and length(v_mynd) <= 2000 then v_mynd end;
      v_teg  := nullif(trim(e ->> 'tegund'), '');
      if v_teg is not null and v_teg not in ('mynd', 'myndband', 'reel', 'karusell', 'saga', 'annad') then
        v_teg := 'annad';
      end if;

      insert into midla_faerslur as p (midill_id, fyrirtaeki_id, ytra_id, birt, tegund, texti, slod,
                                       mynd_slod, ahorf, nadir, likes, athugasemdir, deilingar, vistanir)
      select m.id, m.fyrirtaeki_id, v_ytra, (e ->> 'birt')::timestamptz, v_teg,
             nullif(left(trim(e ->> 'texti'), 500), ''), v_slod, v_mynd,
             tolu_gildi(e ->> 'ahorf'), tolu_gildi(e ->> 'nadir'), tolu_gildi(e ->> 'likes'),
             tolu_gildi(e ->> 'athugasemdir'), tolu_gildi(e ->> 'deilingar'), tolu_gildi(e ->> 'vistanir')
        from midlar m
       where m.id = (e ->> 'midill_id')::uuid
      on conflict (midill_id, ytra_id) do update set
        birt         = coalesce(excluded.birt,         p.birt),
        tegund       = coalesce(excluded.tegund,       p.tegund),
        texti        = coalesce(excluded.texti,        p.texti),
        slod         = coalesce(excluded.slod,         p.slod),
        mynd_slod    = coalesce(excluded.mynd_slod,    p.mynd_slod),
        ahorf        = coalesce(excluded.ahorf,        p.ahorf),
        nadir        = coalesce(excluded.nadir,        p.nadir),
        likes        = coalesce(excluded.likes,        p.likes),
        athugasemdir = coalesce(excluded.athugasemdir, p.athugasemdir),
        deilingar    = coalesce(excluded.deilingar,    p.deilingar),
        vistanir     = coalesce(excluded.vistanir,     p.vistanir);
      get diagnostics n = row_count;
      fjoldi := fjoldi + n;
    exception when others then
      null;  -- ein gölluð færsla má ekki stöðva hinar
    end;
  end loop;
  return fjoldi;
end;
$$;
revoke all on function skra_faerslur(text, jsonb) from public;
grant execute on function skra_faerslur(text, jsonb) to anon;

-- Tölur mánaðarins fyrir skýrslurnar, eitt stak á fyrirtæki með virkan miðil.
-- "fyrri" er mánuðurinn á undan. Summur sleppa auðum gildum og eru auðar
-- (ekki 0) ef engin tala er til. Færslur: summa úr maelingar, annars fjöldi
-- færslna í midla_faerslur sem birtust í mánuðinum.
create or replace function manadar_tolur(p_lykill text, p_manudur date)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare
  m_upphaf date := date_trunc('month', p_manudur)::date;
  m_naesti date := (date_trunc('month', p_manudur) + interval '1 month')::date;
  f_upphaf date := (date_trunc('month', p_manudur) - interval '1 month')::date;
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return '[]'::jsonb;
  end if;
  if p_manudur is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    with t as (
      select mi.id, mi.fyrirtaeki_id, mi.midill, mi.nafn,
             coalesce(
               (select g.fylgjendur from maelingar g
                 where g.midill_id = mi.id and g.dags < m_upphaf and g.fylgjendur is not null
                 order by g.dags desc limit 1),
               (select g.fylgjendur from maelingar g
                 where g.midill_id = mi.id and g.dags >= m_upphaf and g.dags < m_naesti
                   and g.fylgjendur is not null
                 order by g.dags limit 1)) as fylgjendur_upphaf,
             (select g.fylgjendur from maelingar g
               where g.midill_id = mi.id and g.dags >= m_upphaf and g.dags < m_naesti
                 and g.fylgjendur is not null
               order by g.dags desc limit 1) as fylgjendur_lok,
             s.ahorf, s.nadir, s.samskipti, s.faerslur, s.dagar,
             fy.ahorf as ahorf_fyrri, fy.nadir as nadir_fyrri, fy.samskipti as samskipti_fyrri,
             (select nullif(count(*), 0) from midla_faerslur p
               where p.midill_id = mi.id
                 and (p.birt at time zone 'Atlantic/Reykjavik')::date >= m_upphaf
                 and (p.birt at time zone 'Atlantic/Reykjavik')::date < m_naesti) as birtar,
             (select coalesce(jsonb_agg(jsonb_build_object(
                       'texti', b.texti, 'slod', b.slod, 'mynd_slod', b.mynd_slod,
                       'tegund', b.tegund, 'birt', b.birt, 'ahorf', b.ahorf, 'nadir', b.nadir,
                       'likes', b.likes, 'athugasemdir', b.athugasemdir) order by b.rod), '[]'::jsonb)
                from (select p.*, row_number() over (order by p.ahorf desc nulls last, p.birt desc) as rod
                        from midla_faerslur p
                       where p.midill_id = mi.id
                         and (p.birt at time zone 'Atlantic/Reykjavik')::date >= m_upphaf
                         and (p.birt at time zone 'Atlantic/Reykjavik')::date < m_naesti
                       order by p.ahorf desc nulls last, p.birt desc
                       limit 3) b) as bestu
        from midlar mi
        left join lateral (
          select sum(g.ahorf) as ahorf, sum(g.nadir) as nadir, sum(g.samskipti) as samskipti,
                 sum(g.faerslur) as faerslur,
                 count(*) filter (where coalesce(g.fylgjendur, g.ahorf, g.nadir, g.samskipti,
                                                 g.heimsoknir, g.faerslur) is not null) as dagar
            from maelingar g
           where g.midill_id = mi.id and g.dags >= m_upphaf and g.dags < m_naesti) s on true
        left join lateral (
          select sum(g.ahorf) as ahorf, sum(g.nadir) as nadir, sum(g.samskipti) as samskipti
            from maelingar g
           where g.midill_id = mi.id and g.dags >= f_upphaf and g.dags < m_upphaf) fy on true
       where mi.virkt
    ),
    u as (
      select t.*, t.fylgjendur_lok - t.fylgjendur_upphaf as fylgjendur_breyting,
             coalesce(t.faerslur, t.birtar) as faerslur_alls
        from t
    )
    select jsonb_agg(jsonb_build_object(
             'fyrirtaeki_id', f.id, 'fyrirtaeki', f.nafn, 'manudur', m_upphaf,
             'midlar', x.midlar, 'samtals', x.samtals) order by f.nafn, f.id)
      from fyrirtaeki f
      join lateral (
        select jsonb_agg(jsonb_build_object(
                 'midill_id', u.id, 'midill', u.midill, 'nafn', u.nafn,
                 'fylgjendur_upphaf', u.fylgjendur_upphaf, 'fylgjendur_lok', u.fylgjendur_lok,
                 'fylgjendur_breyting', u.fylgjendur_breyting,
                 'ahorf', u.ahorf, 'ahorf_fyrri', u.ahorf_fyrri,
                 'nadir', u.nadir, 'nadir_fyrri', u.nadir_fyrri,
                 'samskipti', u.samskipti, 'samskipti_fyrri', u.samskipti_fyrri,
                 'faerslur', u.faerslur_alls, 'dagar_med_gognum', u.dagar,
                 'bestu_faerslur', u.bestu) order by u.midill, u.nafn) as midlar,
               jsonb_build_object(
                 'fylgjendur_lok', sum(u.fylgjendur_lok),
                 'fylgjendur_breyting', sum(u.fylgjendur_breyting),
                 'ahorf', sum(u.ahorf), 'ahorf_fyrri', sum(u.ahorf_fyrri),
                 'nadir', sum(u.nadir), 'nadir_fyrri', sum(u.nadir_fyrri),
                 'samskipti', sum(u.samskipti), 'samskipti_fyrri', sum(u.samskipti_fyrri),
                 'faerslur', sum(u.faerslur_alls)) as samtals
          from u
         where u.fyrirtaeki_id = f.id
      ) x on x.midlar is not null
  ), '[]'::jsonb);
end;
$$;
revoke all on function manadar_tolur(text, date) from public;
grant execute on function manadar_tolur(text, date) to anon;

-- Drög að skýrslu. Samþykkt eða send skýrsla breytist ekki.
create or replace function vista_skyrslu(p_lykill text, p_fyrirtaeki_id uuid, p_manudur date,
                                         p_tolur jsonb, p_samantekt text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_manudur date := date_trunc('month', p_manudur)::date;
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return null;
  end if;
  if v_manudur is null or not exists (select 1 from fyrirtaeki where id = p_fyrirtaeki_id) then
    return null;
  end if;

  insert into skyrslur as s (fyrirtaeki_id, manudur, tolur, samantekt)
  values (p_fyrirtaeki_id, v_manudur, coalesce(p_tolur, '{}'::jsonb),
          nullif(left(trim(coalesce(p_samantekt, '')), 4000), ''))
  on conflict (fyrirtaeki_id, manudur) do update set
    tolur = excluded.tolur,
    samantekt = excluded.samantekt
  where s.stada = 'drog'
  returning s.id into v_id;

  if v_id is null then
    select id into v_id from skyrslur where fyrirtaeki_id = p_fyrirtaeki_id and manudur = v_manudur;
  end if;
  return v_id;
end;
$$;
revoke all on function vista_skyrslu(text, uuid, date, jsonb, text) from public;
grant execute on function vista_skyrslu(text, uuid, date, jsonb, text) to anon;

-- Samþykktar skýrslur sem bíða eftir pósti, með netföngum viðskiptavinanna
create or replace function skyrslur_til_sendingar(p_lykill text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'fyrirtaeki_id', s.fyrirtaeki_id, 'fyrirtaeki', f.nafn,
             'manudur', s.manudur, 'tolur', s.tolur, 'samantekt', s.samantekt,
             'netfong', v.netfong, 'nofn', v.nofn) order by s.samthykkt_dags, s.id)
      from skyrslur s
      join fyrirtaeki f on f.id = s.fyrirtaeki_id
      join lateral (
        select jsonb_agg(n.netfang order by n.stofnad, n.id) as netfong,
               jsonb_agg(split_part(trim(n.nafn), ' ', 1) order by n.stofnad, n.id) as nofn
          from notendur n
         where n.fyrirtaeki_id = s.fyrirtaeki_id
           and n.hlutverk = 'vidskiptavinur'
           and coalesce(n.netfang, '') <> ''
      ) v on v.netfong is not null
     where s.stada = 'samthykkt' and s.sent_dags is null
  ), '[]'::jsonb);
end;
$$;
revoke all on function skyrslur_til_sendingar(text) from public;
grant execute on function skyrslur_til_sendingar(text) to anon;

create or replace function merkja_skyrslu_senda(p_lykill text, p_ids uuid[])
returns int
language plpgsql security definer set search_path = public as $$
declare fjoldi int;
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return 0;
  end if;
  update skyrslur set stada = 'send', sent_dags = now()
   where id = any(p_ids) and stada = 'samthykkt';
  get diagnostics fjoldi = row_count;
  return fjoldi;
end;
$$;
revoke all on function merkja_skyrslu_senda(text, uuid[]) from public;
grant execute on function merkja_skyrslu_senda(text, uuid[]) to anon;


-- ==========================================================================
-- Úr migrations/2026-11-19-tolfraedi-senda.sql
-- ==========================================================================
-- ==========================================================================
-- Tölfræði send á viðskiptavin beint úr kerfinu (19. nóv 2026)
--
-- Stjórnandi velur viðtakendur í Tölfræði og ýtir á Senda. Pósturinn er
-- smíðaður í vafranum (sama útlit og forsýnin) og bíður hér. Apps Script
-- (tolfraedi.gs, sendaTolfraediSendingar_) sækir hann og sendir frá
-- tveir@tveir.is, strax ef vefkrókurinn er tengdur, annars innan 5 mínútna.
--
-- Viðtakendur verða að vera viðskiptavinir sama fyrirtækis eða stjórnendur,
-- svo kerfið verði aldrei notað til að senda póst á ókunnuga.
-- ==========================================================================

create table if not exists tolfraedi_sendingar (
  id             uuid primary key default gen_random_uuid(),
  fyrirtaeki_id  uuid not null references fyrirtaeki on delete cascade,
  netfong        text[] not null,
  efni           text not null check (length(efni) between 1 and 200),
  html           text not null check (length(html) <= 300000),
  texti          text not null check (length(texti) <= 20000),
  stada          text not null default 'bidur' check (stada in ('bidur', 'send', 'villa')),
  villa          text check (length(villa) <= 500),
  sendandi       uuid,
  stofnad        timestamptz not null default now(),
  sent_dags      timestamptz
);
create index if not exists tolfraedi_sendingar_bidur_idx on tolfraedi_sendingar (stofnad) where stada = 'bidur';
create index if not exists tolfraedi_sendingar_fyrirtaeki_idx on tolfraedi_sendingar (fyrirtaeki_id, stofnad desc);

create or replace function stilla_tolfraedi_sendingu() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  if not er_admin() then
    raise exception 'Bara stjórnendur senda tölfræði';
  end if;
  new.sendandi  := auth.uid();
  new.stada     := 'bidur';
  new.villa     := null;
  new.sent_dags := null;
  new.stofnad   := now();
  if new.netfong is null or coalesce(array_length(new.netfong, 1), 0) = 0 or array_length(new.netfong, 1) > 10 then
    raise exception 'Veldu 1 til 10 viðtakendur';
  end if;
  foreach n in array new.netfong loop
    if not exists (
      select 1 from notendur u
       where lower(u.netfang) = lower(trim(n))
         and ((u.fyrirtaeki_id = new.fyrirtaeki_id and u.hlutverk = 'vidskiptavinur') or u.hlutverk = 'admin')
    ) then
      raise exception 'Netfangið % er ekki tengt þessu fyrirtæki', n;
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function stilla_tolfraedi_sendingu() from public, anon, authenticated;

drop trigger if exists stilla_tolfraedi_sendingu_trigger on tolfraedi_sendingar;
create trigger stilla_tolfraedi_sendingu_trigger
  before insert on tolfraedi_sendingar
  for each row execute function stilla_tolfraedi_sendingu();

-- Pósturinn fer strax, sama leið og lokið-pósturinn (vekja_postinn í 2026-11-17-strax-postur.sql)
drop trigger if exists vekja_postinn_tolfraedi on tolfraedi_sendingar;
create trigger vekja_postinn_tolfraedi
  after insert on tolfraedi_sendingar
  for each row execute function vekja_postinn();

alter table tolfraedi_sendingar enable row level security;
drop policy if exists tolfraedi_sendingar_les on tolfraedi_sendingar;
create policy tolfraedi_sendingar_les on tolfraedi_sendingar for select to authenticated using (er_admin());
drop policy if exists tolfraedi_sendingar_ny on tolfraedi_sendingar;
create policy tolfraedi_sendingar_ny on tolfraedi_sendingar for insert to authenticated with check (er_admin());
drop policy if exists tolfraedi_sendingar_eyda on tolfraedi_sendingar;
create policy tolfraedi_sendingar_eyda on tolfraedi_sendingar for delete to authenticated using (er_admin());

-- Fyrir Apps Script: póstar sem bíða
create or replace function tolfraedi_sendingar_til(p_lykill text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'netfong', to_jsonb(s.netfong), 'efni', s.efni,
                                        'html', s.html, 'texti', s.texti) order by s.stofnad)
      from (select * from tolfraedi_sendingar where stada = 'bidur' order by stofnad limit 20) s
  ), '[]'::jsonb);
end;
$$;
revoke all on function tolfraedi_sendingar_til(text) from public;
grant execute on function tolfraedi_sendingar_til(text) to anon;

create or replace function merkja_tolfraedi_sendingu(p_lykill text, p_id uuid, p_villa text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return false;
  end if;
  update tolfraedi_sendingar
     set stada = case when p_villa is null then 'send' else 'villa' end,
         villa = left(p_villa, 500),
         sent_dags = case when p_villa is null then now() else null end
   where id = p_id and stada = 'bidur';
  return found;
end;
$$;
revoke all on function merkja_tolfraedi_sendingu(text, uuid, text) from public;
grant execute on function merkja_tolfraedi_sendingu(text, uuid, text) to anon;

-- ==========================================================================
-- 23. Myndböndin: áhorf á mánuði fyrir hvert myndband sem við gerðum
--
-- Til dæmis fjögur myndbönd fyrir Snerpu. Hvert myndband fær eina línu á
-- mánuði í myndband_tolur: áhorf, líkar, athugasemdir, deilingar, vistanir.
--
-- Tvær leiðir:
--   handvirkt   Mirza slær tölurnar inn á Tölfræði síðunni.
--   sjalfvirkt  Myndbandið er tengt færslu í midla_faerslur (sem Meta fyllir
--               á hverjum morgni). Þá reiknar gagnagrunnurinn áhorf mánaðarins
--               sjálfur: heildartalan núna mínus heildartalan í lok síðasta
--               mánaðar. Handvirk lína er aldrei yfirskrifuð.
--
-- Viðskiptavinur les myndbönd síns fyrirtækis. Bara admin skrifar.
-- Má keyra aftur.
-- ==========================================================================

create table if not exists myndbond (
  id            uuid primary key default gen_random_uuid(),
  fyrirtaeki_id uuid not null references fyrirtaeki on delete cascade,
  titill        text not null check (length(titill) between 1 and 120),
  midill        text not null default 'instagram'
                check (midill in ('instagram', 'facebook', 'tiktok', 'youtube', 'annad')),
  slod          text check (slod ~ '^https://\S+$' and length(slod) <= 2000),
  birt          date,
  -- Færsla frá Meta sem tölurnar koma úr sjálfkrafa. Autt: bara handvirkt.
  faersla_id    uuid references midla_faerslur on delete set null,
  stofnad       timestamptz not null default now()
);
create index if not exists myndbond_fyrirtaeki_idx on myndbond (fyrirtaeki_id, birt desc);
create index if not exists myndbond_faersla_idx on myndbond (faersla_id) where faersla_id is not null;

create table if not exists myndband_tolur (
  myndband_id   uuid not null references myndbond on delete cascade,
  -- Sett af trigger úr myndbandinu, aldrei úr vafranum
  fyrirtaeki_id uuid not null references fyrirtaeki on delete cascade,
  -- Alltaf fyrsti dagur mánaðarins
  manudur       date not null check (manudur = date_trunc('month', manudur)::date),
  ahorf         bigint check (ahorf >= 0),
  likes         bigint check (likes >= 0),
  athugasemdir  bigint check (athugasemdir >= 0),
  deilingar     bigint check (deilingar >= 0),
  vistanir      bigint check (vistanir >= 0),
  -- Heildartölur færslunnar við síðustu sjálfvirku uppfærslu (til að reikna næsta mánuð)
  heild         jsonb check (heild is null or length(heild::text) <= 1000),
  uppruni       text not null default 'handvirkt' check (uppruni in ('handvirkt', 'sjalfvirkt')),
  uppfaert      timestamptz not null default now(),
  primary key (myndband_id, manudur)
);
create index if not exists myndband_tolur_fyrirtaeki_idx on myndband_tolur (fyrirtaeki_id, manudur);

-- Færslan sem myndbandið er tengt verður að vera frá sama fyrirtæki
create or replace function stilla_myndband() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.faersla_id is not null and not exists (
    select 1 from midla_faerslur f where f.id = new.faersla_id and f.fyrirtaeki_id = new.fyrirtaeki_id
  ) then
    raise exception 'Færslan er ekki frá þessu fyrirtæki';
  end if;
  return new;
end;
$$;
revoke all on function stilla_myndband() from public, anon, authenticated;
drop trigger if exists stilla_myndband_trigger on myndbond;
create trigger stilla_myndband_trigger before insert or update on myndbond
  for each row execute function stilla_myndband();

-- fyrirtaeki_id kemur alltaf úr myndbandinu
create or replace function stilla_myndbandstolu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select m.fyrirtaeki_id into new.fyrirtaeki_id from myndbond m where m.id = new.myndband_id;
  if new.fyrirtaeki_id is null then
    raise exception 'Myndbandið fannst ekki';
  end if;
  new.uppfaert := now();
  return new;
end;
$$;
revoke all on function stilla_myndbandstolu() from public, anon, authenticated;
drop trigger if exists stilla_myndbandstolu_trigger on myndband_tolur;
create trigger stilla_myndbandstolu_trigger before insert or update on myndband_tolur
  for each row execute function stilla_myndbandstolu();

-- Sjálfvirka leiðin: tölur mánaðarins úr heildartölum færslunnar.
-- Mánuðurinn er íslenskur (Atlantic/Reykjavik). Handvirk lína stendur.
create or replace function myndband_ur_faerslu(p_myndband uuid, p_faersla uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  f      midla_faerslur%rowtype;
  man    date := date_trunc('month', (now() at time zone 'Atlantic/Reykjavik'))::date;
  fyrri  jsonb;
  mismunur bigint;
begin
  select * into f from midla_faerslur where id = p_faersla;
  if not found then return; end if;
  select t.heild into fyrri from myndband_tolur t
   where t.myndband_id = p_myndband and t.manudur < man and t.heild is not null
   order by t.manudur desc limit 1;
  insert into myndband_tolur (myndband_id, fyrirtaeki_id, manudur, ahorf, likes, athugasemdir, deilingar, vistanir, heild, uppruni)
  values (
    p_myndband, f.fyrirtaeki_id, man,
    case when f.ahorf        is null then null else greatest(0, f.ahorf        - coalesce((fyrri->>'ahorf')::bigint, 0)) end,
    case when f.likes        is null then null else greatest(0, f.likes        - coalesce((fyrri->>'likes')::bigint, 0)) end,
    case when f.athugasemdir is null then null else greatest(0, f.athugasemdir - coalesce((fyrri->>'athugasemdir')::bigint, 0)) end,
    case when f.deilingar    is null then null else greatest(0, f.deilingar    - coalesce((fyrri->>'deilingar')::bigint, 0)) end,
    case when f.vistanir     is null then null else greatest(0, f.vistanir     - coalesce((fyrri->>'vistanir')::bigint, 0)) end,
    jsonb_strip_nulls(jsonb_build_object('ahorf', f.ahorf, 'likes', f.likes, 'athugasemdir', f.athugasemdir,
                                         'deilingar', f.deilingar, 'vistanir', f.vistanir)),
    'sjalfvirkt')
  on conflict (myndband_id, manudur) do update
     set ahorf = excluded.ahorf, likes = excluded.likes, athugasemdir = excluded.athugasemdir,
         deilingar = excluded.deilingar, vistanir = excluded.vistanir, heild = excluded.heild
   where myndband_tolur.uppruni = 'sjalfvirkt';
end;
$$;
revoke all on function myndband_ur_faerslu(uuid, uuid) from public, anon, authenticated;

-- Þegar Meta uppfærir færslu fá tengd myndbönd nýjar tölur
create or replace function faera_i_myndbond() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  for v in select id from myndbond where faersla_id = new.id loop
    perform myndband_ur_faerslu(v, new.id);
  end loop;
  return new;
end;
$$;
revoke all on function faera_i_myndbond() from public, anon, authenticated;
drop trigger if exists faera_i_myndbond_trigger on midla_faerslur;
create trigger faera_i_myndbond_trigger after insert or update on midla_faerslur
  for each row execute function faera_i_myndbond();

-- Og strax þegar myndband er tengt færslu
create or replace function tengja_myndband() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.faersla_id is not null and (tg_op = 'INSERT' or new.faersla_id is distinct from old.faersla_id) then
    perform myndband_ur_faerslu(new.id, new.faersla_id);
  end if;
  return new;
end;
$$;
revoke all on function tengja_myndband() from public, anon, authenticated;
drop trigger if exists tengja_myndband_trigger on myndbond;
create trigger tengja_myndband_trigger after insert or update on myndbond
  for each row execute function tengja_myndband();

alter table myndbond       enable row level security;
alter table myndband_tolur enable row level security;

drop policy if exists myndbond_les on myndbond;
create policy myndbond_les on myndbond for select to authenticated
  using (er_admin() or fyrirtaeki_id = mitt_fyrirtaeki());
drop policy if exists myndbond_admin on myndbond;
create policy myndbond_admin on myndbond for all to authenticated
  using (er_admin()) with check (er_admin());

drop policy if exists myndband_tolur_les on myndband_tolur;
create policy myndband_tolur_les on myndband_tolur for select to authenticated
  using (er_admin() or fyrirtaeki_id = mitt_fyrirtaeki());
drop policy if exists myndband_tolur_admin on myndband_tolur;
create policy myndband_tolur_admin on myndband_tolur for all to authenticated
  using (er_admin()) with check (er_admin());

-- ==========================================================================
-- 24. Samskipti: Gmail pósthólfið á vinnusvæðinu
--
-- Apps Script (postholf.gs í verkefninu á tveir@tveir.is) afritar á 5
-- mínútna fresti pósthólfið síðustu 14 daga hingað (aðalflipinn, ekki
-- auglýsingar né samfélagsmiðlar): þræði og skilaboð sem venjulegan texta.
-- Svar sem er skrifað á vinnusvæðinu bíður í postholf_svor og skriftan
-- sendir það frá tveir@tveir.is í sama póstþræði.
--
-- Bara stjórnendur sjá þetta. Viðskiptavinir sjá aldrei pósthólfið.
-- Skriftan kemst bara inn með lyklinum úr stillingar_innri (eins og 16 til 18).
-- Má keyra aftur.
-- ==========================================================================

create table if not exists postholf_thraedir (
  id            text primary key check (length(id) between 1 and 100),   -- þráðarauðkenni Gmail
  efni          text not null default '' check (length(efni) <= 300),
  fra_nafn      text check (length(fra_nafn) <= 200),
  fra_netfang   text check (length(fra_netfang) <= 320),
  snid          text check (length(snid) <= 500),
  sidast        timestamptz not null,
  fjoldi        int not null default 1 check (fjoldi >= 0),
  -- Ólesið í Gmail þegar síðast var samstillt
  olesid_gmail  boolean not null default false,
  -- Opnað á vinnusvæðinu eftir síðasta nýja skilaboð
  lesid_kerfi   timestamptz,
  tengill       text check (tengill ~ '^https://mail\.google\.com/\S+$' and length(tengill) <= 500),
  -- Sett í gagnagrunninum: sendandinn er notandi hjá viðskiptavini
  fyrirtaeki_id uuid references fyrirtaeki on delete set null,
  uppfaert      timestamptz not null default now()
);
create index if not exists postholf_thraedir_sidast_idx on postholf_thraedir (sidast desc);

create table if not exists postholf_skilabod (
  id          text primary key check (length(id) between 1 and 100),     -- skilaboðaauðkenni Gmail
  thradur_id  text not null references postholf_thraedir on delete cascade,
  fra_nafn    text check (length(fra_nafn) <= 200),
  fra_netfang text check (length(fra_netfang) <= 320),
  til         text check (length(til) <= 2000),
  dags        timestamptz not null,
  texti       text not null default '' check (length(texti) <= 20000),
  fra_okkur   boolean not null default false,
  vidhengi    int not null default 0 check (vidhengi >= 0)
);
create index if not exists postholf_skilabod_thradur_idx on postholf_skilabod (thradur_id, dags);

create table if not exists postholf_svor (
  id          uuid primary key default gen_random_uuid(),
  thradur_id  text not null references postholf_thraedir on delete cascade,
  texti       text not null check (length(btrim(texti)) between 1 and 10000),
  stada       text not null default 'bidur' check (stada in ('bidur', 'send', 'villa')),
  villa       text check (length(villa) <= 500),
  sendandi    uuid,
  stofnad     timestamptz not null default now(),
  sent_dags   timestamptz
);
create index if not exists postholf_svor_bidur_idx on postholf_svor (stofnad) where stada = 'bidur';

create or replace function stilla_postholf_svari() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not er_admin() then
    raise exception 'Bara stjórnendur svara pósti';
  end if;
  new.sendandi  := auth.uid();
  new.stada     := 'bidur';
  new.villa     := null;
  new.sent_dags := null;
  new.stofnad   := now();
  return new;
end;
$$;
revoke all on function stilla_postholf_svari() from public, anon, authenticated;
drop trigger if exists stilla_postholf_svari_trigger on postholf_svor;
create trigger stilla_postholf_svari_trigger before insert on postholf_svor
  for each row execute function stilla_postholf_svari();

-- Svarið fer strax ef vefkrókurinn er tengdur (sama leið og lokið-pósturinn)
drop trigger if exists vekja_postinn_svor on postholf_svor;
create trigger vekja_postinn_svor after insert on postholf_svor
  for each row execute function vekja_postinn();

alter table postholf_thraedir enable row level security;
alter table postholf_skilabod enable row level security;
alter table postholf_svor     enable row level security;

drop policy if exists postholf_thraedir_les on postholf_thraedir;
create policy postholf_thraedir_les on postholf_thraedir for select to authenticated using (er_admin());
drop policy if exists postholf_thraedir_lesid on postholf_thraedir;
create policy postholf_thraedir_lesid on postholf_thraedir for update to authenticated using (er_admin()) with check (er_admin());
drop policy if exists postholf_skilabod_les on postholf_skilabod;
create policy postholf_skilabod_les on postholf_skilabod for select to authenticated using (er_admin());
drop policy if exists postholf_svor_les on postholf_svor;
create policy postholf_svor_les on postholf_svor for select to authenticated using (er_admin());
drop policy if exists postholf_svor_ny on postholf_svor;
create policy postholf_svor_ny on postholf_svor for insert to authenticated with check (er_admin());

-- Stjórnandi má bara merkja þráð lesinn, ekki breyta pósti
create or replace function vernda_postholf_thrad() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('vinnusvaedi.postholf_skrift', true) = '1' then return new; end if;
  if (new.id, new.efni, new.fra_nafn, new.fra_netfang, new.snid, new.sidast, new.fjoldi, new.olesid_gmail, new.tengill, new.fyrirtaeki_id)
     is distinct from (old.id, old.efni, old.fra_nafn, old.fra_netfang, old.snid, old.sidast, old.fjoldi, old.olesid_gmail, old.tengill, old.fyrirtaeki_id) then
    raise exception 'Bara má merkja þráðinn lesinn';
  end if;
  return new;
end;
$$;
revoke all on function vernda_postholf_thrad() from public, anon, authenticated;
drop trigger if exists vernda_postholf_thrad_trigger on postholf_thraedir;
create trigger vernda_postholf_thrad_trigger before update on postholf_thraedir
  for each row execute function vernda_postholf_thrad();

create or replace function postholf_lykill_ok(p_lykill text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_lykill is not null
     and p_lykill = (select gildi from stillingar_innri where lykill = 'postur_lykill');
$$;
revoke all on function postholf_lykill_ok(text) from public, anon, authenticated;

-- Fyrir Apps Script: skráir þræði og skilaboð. p_gogn er listi af
-- { id, efni, fra_nafn, fra_netfang, snid, sidast, fjoldi, olesid, tengill,
--   skilabod: [{ id, fra_nafn, fra_netfang, til, dags, texti, fra_okkur, vidhengi }] }
-- Þræðir sem eru farnir úr pósthólfinu (eldri en p_eyda_fyrir) hverfa.
create or replace function postholf_skra(p_lykill text, p_gogn jsonb, p_eyda_fyrir timestamptz default null)
returns int language plpgsql security definer set search_path = public as $$
declare t jsonb; s jsonb; n int := 0; fyr uuid; nyjast timestamptz;
begin
  if not postholf_lykill_ok(p_lykill) then return -1; end if;
  if jsonb_typeof(p_gogn) <> 'array' or jsonb_array_length(p_gogn) > 100 then return -2; end if;
  perform set_config('vinnusvaedi.postholf_skrift', '1', true);
  for t in select * from jsonb_array_elements(p_gogn) loop
    continue when coalesce(t->>'id', '') = '' or (t->>'sidast') is null;
    select u.fyrirtaeki_id into fyr from notendur u
     where lower(u.netfang) = lower(t->>'fra_netfang') and u.hlutverk = 'vidskiptavinur' and u.fyrirtaeki_id is not null
     limit 1;
    insert into postholf_thraedir (id, efni, fra_nafn, fra_netfang, snid, sidast, fjoldi, olesid_gmail, tengill, fyrirtaeki_id, uppfaert)
    values (left(t->>'id', 100), left(coalesce(t->>'efni', ''), 300), left(t->>'fra_nafn', 200), left(lower(t->>'fra_netfang'), 320),
            left(t->>'snid', 500), (t->>'sidast')::timestamptz, greatest(0, coalesce((t->>'fjoldi')::int, 1)),
            coalesce((t->>'olesid')::boolean, false),
            case when (t->>'tengill') ~ '^https://mail\.google\.com/\S+$' then left(t->>'tengill', 500) end, fyr, now())
    on conflict (id) do update set efni = excluded.efni, fra_nafn = excluded.fra_nafn, fra_netfang = excluded.fra_netfang,
      snid = excluded.snid, sidast = excluded.sidast, fjoldi = excluded.fjoldi, olesid_gmail = excluded.olesid_gmail,
      tengill = excluded.tengill, fyrirtaeki_id = excluded.fyrirtaeki_id, uppfaert = now();
    for s in select * from jsonb_array_elements(coalesce(t->'skilabod', '[]'::jsonb)) loop
      continue when coalesce(s->>'id', '') = '' or (s->>'dags') is null;
      insert into postholf_skilabod (id, thradur_id, fra_nafn, fra_netfang, til, dags, texti, fra_okkur, vidhengi)
      values (left(s->>'id', 100), left(t->>'id', 100), left(s->>'fra_nafn', 200), left(lower(s->>'fra_netfang'), 320),
              left(s->>'til', 2000), (s->>'dags')::timestamptz, left(coalesce(s->>'texti', ''), 20000),
              coalesce((s->>'fra_okkur')::boolean, false), greatest(0, coalesce((s->>'vidhengi')::int, 0)))
      on conflict (id) do nothing;
    end loop;
    n := n + 1;
  end loop;
  if p_eyda_fyrir is not null then
    delete from postholf_thraedir where sidast < p_eyda_fyrir;
  end if;
  return n;
end;
$$;
revoke all on function postholf_skra(text, jsonb, timestamptz) from public;
grant execute on function postholf_skra(text, jsonb, timestamptz) to anon;

-- Fyrir Apps Script: svör sem bíða
create or replace function postholf_svor_til(p_lykill text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not postholf_lykill_ok(p_lykill) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'thradur_id', s.thradur_id, 'texti', s.texti) order by s.stofnad)
    from (select * from postholf_svor where stada = 'bidur' order by stofnad limit 20) s), '[]'::jsonb);
end;
$$;
revoke all on function postholf_svor_til(text) from public;
grant execute on function postholf_svor_til(text) to anon;

create or replace function merkja_postholf_svar(p_lykill text, p_id uuid, p_villa text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not postholf_lykill_ok(p_lykill) then return false; end if;
  update postholf_svor set stada = case when p_villa is null then 'send' else 'villa' end,
         villa = left(p_villa, 500), sent_dags = case when p_villa is null then now() end
   where id = p_id and stada = 'bidur';
  return found;
end;
$$;
revoke all on function merkja_postholf_svar(text, uuid, text) from public;
grant execute on function merkja_postholf_svar(text, uuid, text) to anon;

-- ==========================================================================
-- 25. Undirskrift í pósti og svör með útliti
--
-- Hver stjórnandi á sína undirskrift (nafn, starfsheiti, sími, vefur, merki).
-- Hún er vistuð hér svo hún fylgi á milli tækja. Svar úr pósthólfinu fer
-- með HTML útgáfu (texti + undirskrift með merki) og venjulegum texta.
-- Má keyra aftur.
-- ==========================================================================

alter table postholf_svor add column if not exists html text check (html is null or length(html) <= 60000);

create table if not exists undirskriftir (
  notandi_id uuid primary key default auth.uid(),
  gogn       jsonb not null default '{}' check (length(gogn::text) <= 4000),
  uppfaert   timestamptz not null default now()
);
alter table undirskriftir enable row level security;

drop policy if exists undirskriftir_min on undirskriftir;
create policy undirskriftir_min on undirskriftir for all to authenticated
  using (notandi_id = auth.uid() and er_admin())
  with check (notandi_id = auth.uid() and er_admin());

create or replace function postholf_svor_til(p_lykill text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not postholf_lykill_ok(p_lykill) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'thradur_id', s.thradur_id, 'texti', s.texti, 'html', s.html) order by s.stofnad)
    from (select * from postholf_svor where stada = 'bidur' order by stofnad limit 20) s), '[]'::jsonb);
end;
$$;
revoke all on function postholf_svor_til(text) from public;
grant execute on function postholf_svor_til(text) to anon;

-- ==========================================================================
-- 26. Nýr póstur úr pósthólfinu
--
-- Sama biðröð og svörin (postholf_svor): lína án þráðar er nýr póstur með
-- viðtakendum og efni. Apps Script sendir hann frá tveir@tveir.is.
-- Mest 10 viðtakendur, hvert netfang athugað. Bara stjórnendur.
-- Má keyra aftur.
-- ==========================================================================

alter table postholf_svor alter column thradur_id drop not null;
alter table postholf_svor add column if not exists til text check (til is null or length(til) <= 2000);
alter table postholf_svor add column if not exists efni text check (efni is null or length(efni) between 1 and 200);
alter table postholf_svor drop constraint if exists postholf_svor_tegund;
alter table postholf_svor add constraint postholf_svor_tegund
  check (thradur_id is not null or (til is not null and efni is not null));

create or replace function stilla_postholf_svari() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text; fjoldi int := 0;
begin
  if not er_admin() then
    raise exception 'Bara stjórnendur senda póst';
  end if;
  new.sendandi  := auth.uid();
  new.stada     := 'bidur';
  new.villa     := null;
  new.sent_dags := null;
  new.stofnad   := now();
  if new.thradur_id is null then
    new.efni := btrim(regexp_replace(coalesce(new.efni, ''), '[\r\n]+', ' ', 'g'));
    if new.efni = '' then raise exception 'Efnið vantar'; end if;
    new.til := lower(regexp_replace(coalesce(new.til, ''), '\s+', '', 'g'));
    foreach n in array string_to_array(new.til, ',') loop
      continue when n = '';
      if n !~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$' then
        raise exception 'Netfangið % er ekki rétt', n;
      end if;
      fjoldi := fjoldi + 1;
    end loop;
    if fjoldi = 0 or fjoldi > 10 then raise exception 'Settu inn 1 til 10 viðtakendur'; end if;
  end if;
  return new;
end;
$$;
revoke all on function stilla_postholf_svari() from public, anon, authenticated;

create or replace function postholf_svor_til(p_lykill text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not postholf_lykill_ok(p_lykill) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'thradur_id', s.thradur_id, 'texti', s.texti, 'html', s.html,
                                                       'til', s.til, 'efni', s.efni) order by s.stofnad)
    from (select * from postholf_svor where stada = 'bidur' order by stofnad limit 20) s), '[]'::jsonb);
end;
$$;
revoke all on function postholf_svor_til(text) from public;
grant execute on function postholf_svor_til(text) to anon;

-- ==========================================================================
-- 27. Dagatal: Google Calendar á vinnusvæðinu
--
-- Apps Script (dagatal.gs í verkefninu á tveir@tveir.is) afritar á 5
-- mínútna fresti fundina í aðaldagatalinu, frá 14 dögum aftur til 90 daga
-- fram. Dagatal síðan sýnir þá við hlið skiladaga verkefna og taska.
-- Bara stjórnendur sjá fundina. Má keyra aftur.
-- ==========================================================================

create table if not exists dagatal_atburdir (
  id            text primary key check (length(id) between 1 and 300),
  titill        text not null default '' check (length(titill) <= 300),
  lysing        text check (length(lysing) <= 2000),
  stadur        text check (length(stadur) <= 300),
  byrjar        timestamptz not null,
  endar         timestamptz not null,
  allan_daginn  boolean not null default false,
  tengill       text check (tengill ~ '^https://\S+$' and length(tengill) <= 1000),
  fundarhlekkur text check (fundarhlekkur ~ '^https://\S+$' and length(fundarhlekkur) <= 1000),
  gestir        int not null default 0 check (gestir >= 0),
  uppfaert      timestamptz not null default now()
);
create index if not exists dagatal_atburdir_byrjar_idx on dagatal_atburdir (byrjar);

alter table dagatal_atburdir enable row level security;
drop policy if exists dagatal_atburdir_les on dagatal_atburdir;
create policy dagatal_atburdir_les on dagatal_atburdir for select to authenticated using (er_admin());

-- Fyrir Apps Script: skiptir út öllum fundum á bilinu [p_fra, p_til] fyrir
-- þá sem koma inn. Fundur sem var eytt í Google hverfur því líka hér.
create or replace function dagatal_skra(p_lykill text, p_gogn jsonb, p_fra timestamptz, p_til timestamptz)
returns int language plpgsql security definer set search_path = public as $$
declare a jsonb; n int := 0;
begin
  if not postholf_lykill_ok(p_lykill) then return -1; end if;
  if jsonb_typeof(p_gogn) <> 'array' or jsonb_array_length(p_gogn) > 1000 then return -2; end if;
  if p_fra is null or p_til is null or p_til <= p_fra or p_til - p_fra > interval '200 days' then return -3; end if;
  delete from dagatal_atburdir where byrjar >= p_fra and byrjar < p_til;
  delete from dagatal_atburdir where byrjar < p_fra - interval '60 days';
  for a in select * from jsonb_array_elements(p_gogn) loop
    continue when coalesce(a->>'id', '') = '' or (a->>'byrjar') is null or (a->>'endar') is null;
    insert into dagatal_atburdir (id, titill, lysing, stadur, byrjar, endar, allan_daginn, tengill, fundarhlekkur, gestir, uppfaert)
    values (left(a->>'id', 300), left(coalesce(a->>'titill', ''), 300), left(a->>'lysing', 2000), left(a->>'stadur', 300),
            (a->>'byrjar')::timestamptz, (a->>'endar')::timestamptz, coalesce((a->>'allan_daginn')::boolean, false),
            case when (a->>'tengill') ~ '^https://\S+$' then left(a->>'tengill', 1000) end,
            case when (a->>'fundarhlekkur') ~ '^https://\S+$' then left(a->>'fundarhlekkur', 1000) end,
            greatest(0, coalesce((a->>'gestir')::int, 0)), now())
    on conflict (id) do update set titill = excluded.titill, lysing = excluded.lysing, stadur = excluded.stadur,
      byrjar = excluded.byrjar, endar = excluded.endar, allan_daginn = excluded.allan_daginn, tengill = excluded.tengill,
      fundarhlekkur = excluded.fundarhlekkur, gestir = excluded.gestir, uppfaert = now();
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function dagatal_skra(text, jsonb, timestamptz, timestamptz) from public;
grant execute on function dagatal_skra(text, jsonb, timestamptz, timestamptz) to anon;

-- ==========================================================================
-- 28. Tengingar: API lyklar fyrir Payday, DK, Shopify, Gorilla, Claude og ChatGPT
--
-- Stjórnandi límir lykilinn inn á Stillingar síðunni. Lykillinn fer
-- dulkóðaður í Supabase Vault og kemur aldrei aftur út á síðuna, ekki
-- einu sinni til stjórnandans. Síðan sér bara hvort tengt sé og síðustu
-- fjóra stafina. Bara bakendinn (service_role, t.d. Edge Function) getur
-- lesið lykilinn með tenging_lykill(). Má keyra aftur.
-- ==========================================================================

create table if not exists tengingar (
  veita       text primary key check (veita in ('payday', 'dk', 'shopify', 'gorilla', 'claude', 'chatgpt')),
  stillingar  jsonb not null default '{}'::jsonb check (jsonb_typeof(stillingar) = 'object' and length(stillingar::text) <= 2000),
  lykill_id   uuid,
  sidustu4    text check (length(sidustu4) <= 8),
  tengt_af    uuid,
  uppfaert    timestamptz not null default now(),
  prufad      timestamptz,
  prufa_svar  text check (length(prufa_svar) <= 300)
);

-- Engar reglur: enginn les eða skrifar töfluna beint, bara föllin hér fyrir neðan.
alter table tengingar enable row level security;

-- Staðan fyrir Stillingar síðuna (bara stjórnendur). Enginn lykill hér.
create or replace function tengingar_stada()
returns table (veita text, stillingar jsonb, sidustu4 text, uppfaert timestamptz, prufad timestamptz, prufa_svar text)
language sql security definer stable set search_path = public as $$
  select t.veita, t.stillingar, t.sidustu4, t.uppfaert, t.prufad, t.prufa_svar
  from tengingar t where er_admin()
$$;
revoke all on function tengingar_stada() from public, anon;
grant execute on function tengingar_stada() to authenticated;

-- Vista tengingu. p_leyndo eru leyndu gildin ({"lykill": "..."} o.s.frv.);
-- null eða {} heldur gamla lyklinum og uppfærir bara stillingarnar.
create or replace function vista_tengingu(p_veita text, p_stillingar jsonb, p_leyndo jsonb)
returns boolean language plpgsql security definer set search_path = public, vault as $$
declare
  fyrri tengingar%rowtype; k text; v jsonb; adal text; nytt uuid;
begin
  if not er_admin() then raise exception 'Bara stjórnendur geta tengt' using errcode = '42501'; end if;
  if p_veita not in ('payday', 'dk', 'shopify', 'gorilla', 'claude', 'chatgpt') then raise exception 'Óþekkt tenging'; end if;
  p_stillingar := coalesce(p_stillingar, '{}'::jsonb);
  if jsonb_typeof(p_stillingar) <> 'object' or length(p_stillingar::text) > 2000 then raise exception 'Of miklar stillingar'; end if;
  if p_veita = 'shopify' and coalesce(p_stillingar->>'verslun', '') !~ '^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$' then
    raise exception 'Verslunin á að vera á forminu nafn.myshopify.com';
  end if;

  select * into fyrri from tengingar where veita = p_veita;

  if p_leyndo is not null and p_leyndo <> '{}'::jsonb then
    if jsonb_typeof(p_leyndo) <> 'object' or length(p_leyndo::text) > 8000 then raise exception 'Lykillinn er ekki á réttu formi'; end if;
    for k, v in select * from jsonb_each(p_leyndo) loop
      if jsonb_typeof(v) <> 'string' or length(v #>> '{}') not between 4 and 4000 or (v #>> '{}') ~ '\s' then
        raise exception 'Reiturinn % er ekki gildur lykill', k;
      end if;
    end loop;
    adal := coalesce(p_leyndo->>'lykill', p_leyndo->>'clientSecret', p_leyndo->>'token', (select x.value #>> '{}' from jsonb_each(p_leyndo) x limit 1));
    if fyrri.lykill_id is not null then
      perform vault.update_secret(fyrri.lykill_id, p_leyndo::text);
      nytt := fyrri.lykill_id;
    else
      delete from vault.secrets where name = 'glerhus_tenging_' || p_veita;
      nytt := vault.create_secret(p_leyndo::text, 'glerhus_tenging_' || p_veita, 'Tenging á Stillingar síðunni');
    end if;
    insert into tengingar (veita, stillingar, lykill_id, sidustu4, tengt_af, uppfaert, prufad, prufa_svar)
    values (p_veita, p_stillingar, nytt, right(adal, 4), auth.uid(), now(), null, null)
    on conflict (veita) do update set stillingar = excluded.stillingar, lykill_id = excluded.lykill_id, sidustu4 = excluded.sidustu4,
      tengt_af = excluded.tengt_af, uppfaert = now(), prufad = null, prufa_svar = null;
  else
    if fyrri.veita is null and p_veita <> 'gorilla' then raise exception 'Það vantar lykilinn'; end if;
    insert into tengingar (veita, stillingar, tengt_af, uppfaert) values (p_veita, p_stillingar, auth.uid(), now())
    on conflict (veita) do update set stillingar = excluded.stillingar, uppfaert = now();
  end if;
  return true;
end;
$$;
revoke all on function vista_tengingu(text, jsonb, jsonb) from public, anon;
grant execute on function vista_tengingu(text, jsonb, jsonb) to authenticated;

-- Aftengja: lykillinn er líka þurrkaður úr Vault
create or replace function eyda_tengingu(p_veita text)
returns boolean language plpgsql security definer set search_path = public, vault as $$
declare fyrri uuid;
begin
  if not er_admin() then raise exception 'Bara stjórnendur geta aftengt' using errcode = '42501'; end if;
  select lykill_id into fyrri from tengingar where veita = p_veita;
  if fyrri is not null then delete from vault.secrets where id = fyrri; end if;
  delete from tengingar where veita = p_veita;
  return true;
end;
$$;
revoke all on function eyda_tengingu(text) from public, anon;
grant execute on function eyda_tengingu(text) to authenticated;

-- Bara fyrir bakendann (service_role): lykillinn í clear text
create or replace function tenging_lykill(p_veita text)
returns jsonb language sql security definer stable set search_path = public, vault as $$
  select d.decrypted_secret::jsonb from tengingar t join vault.decrypted_secrets d on d.id = t.lykill_id where t.veita = p_veita
$$;
revoke all on function tenging_lykill(text) from public, anon, authenticated;
grant execute on function tenging_lykill(text) to service_role;

-- Bakendinn skráir hvort prufan tókst
create or replace function skra_tengingarprufu(p_veita text, p_svar text)
returns void language sql security definer set search_path = public as $$
  update tengingar set prufad = now(), prufa_svar = left(p_svar, 300) where veita = p_veita
$$;
revoke all on function skra_tengingarprufu(text, text) from public, anon, authenticated;
grant execute on function skra_tengingarprufu(text, text) to service_role;
-- ==========================================================================
-- 29. Tengingar: Gorilla tekin út. Lykillinn er prófaður strax eftir vistun
--     (Edge Function profa-tengingu, skrá í vinnusvaedi/edge/). Má keyra aftur.
-- ==========================================================================

delete from vault.secrets where id in (select lykill_id from tengingar where veita = 'gorilla' and lykill_id is not null);
delete from tengingar where veita = 'gorilla';
alter table tengingar drop constraint if exists tengingar_veita_check;
alter table tengingar add constraint tengingar_veita_check check (veita in ('payday', 'dk', 'shopify', 'claude', 'chatgpt'));

-- Vista tengingu. p_leyndo eru leyndu gildin ({"lykill": "..."} o.s.frv.);
-- null eða {} heldur gamla lyklinum og uppfærir bara stillingarnar.
create or replace function vista_tengingu(p_veita text, p_stillingar jsonb, p_leyndo jsonb)
returns boolean language plpgsql security definer set search_path = public, vault as $$
declare
  fyrri tengingar%rowtype; k text; v jsonb; adal text; nytt uuid;
begin
  if not er_admin() then raise exception 'Bara stjórnendur geta tengt' using errcode = '42501'; end if;
  if p_veita not in ('payday', 'dk', 'shopify', 'claude', 'chatgpt') then raise exception 'Óþekkt tenging'; end if;
  p_stillingar := coalesce(p_stillingar, '{}'::jsonb);
  if jsonb_typeof(p_stillingar) <> 'object' or length(p_stillingar::text) > 2000 then raise exception 'Of miklar stillingar'; end if;
  if p_veita = 'shopify' and coalesce(p_stillingar->>'verslun', '') !~ '^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$' then
    raise exception 'Verslunin á að vera á forminu nafn.myshopify.com';
  end if;

  select * into fyrri from tengingar where veita = p_veita;

  if p_leyndo is not null and p_leyndo <> '{}'::jsonb then
    if jsonb_typeof(p_leyndo) <> 'object' or length(p_leyndo::text) > 8000 then raise exception 'Lykillinn er ekki á réttu formi'; end if;
    for k, v in select * from jsonb_each(p_leyndo) loop
      if jsonb_typeof(v) <> 'string' or length(v #>> '{}') not between 4 and 4000 or (v #>> '{}') ~ '\s' then
        raise exception 'Reiturinn % er ekki gildur lykill', k;
      end if;
    end loop;
    adal := coalesce(p_leyndo->>'lykill', p_leyndo->>'clientSecret', p_leyndo->>'token', (select x.value #>> '{}' from jsonb_each(p_leyndo) x limit 1));
    if fyrri.lykill_id is not null then
      perform vault.update_secret(fyrri.lykill_id, p_leyndo::text);
      nytt := fyrri.lykill_id;
    else
      delete from vault.secrets where name = 'glerhus_tenging_' || p_veita;
      nytt := vault.create_secret(p_leyndo::text, 'glerhus_tenging_' || p_veita, 'Tenging á Stillingar síðunni');
    end if;
    insert into tengingar (veita, stillingar, lykill_id, sidustu4, tengt_af, uppfaert, prufad, prufa_svar)
    values (p_veita, p_stillingar, nytt, right(adal, 4), auth.uid(), now(), null, null)
    on conflict (veita) do update set stillingar = excluded.stillingar, lykill_id = excluded.lykill_id, sidustu4 = excluded.sidustu4,
      tengt_af = excluded.tengt_af, uppfaert = now(), prufad = null, prufa_svar = null;
  else
    if fyrri.veita is null then raise exception 'Það vantar lykilinn'; end if;
    insert into tengingar (veita, stillingar, tengt_af, uppfaert) values (p_veita, p_stillingar, auth.uid(), now())
    on conflict (veita) do update set stillingar = excluded.stillingar, uppfaert = now();
  end if;
  return true;
end;
$$;
revoke all on function vista_tengingu(text, jsonb, jsonb) from public, anon;
grant execute on function vista_tengingu(text, jsonb, jsonb) to authenticated;
-- ==========================================================================
-- 30. Dagatal: undirverk fá dag (til dæmis Myndband 1 til 4, eitt í viku).
--     Dagatalið sýnir þau og það má draga þau á milli daga. Autt: enginn
--     dagur, eins og áður. Má keyra aftur.
-- ==========================================================================

alter table undirverk add column if not exists dags date;
create index if not exists undirverk_dags_idx on undirverk (dags) where dags is not null;
-- ==========================================================================
-- 31. Pósthólfið: skilaboð sem eru ekki lengur í Gmail hverfa líka hér.
--     Gmail vistar drög meðan skrifað er. Eldri samstilling tók þau með, og
--     þá sáust tvö "send" svör þótt bara annað hefði farið. postholf.gs
--     sleppir nú drögum, og hér eyðast skilaboð þráðar sem Gmail sendi ekki
--     lengur, innan þess tímabils sem kom inn (eldri skilaboð haldast).
--     Má keyra aftur.
-- ==========================================================================

create or replace function postholf_skra(p_lykill text, p_gogn jsonb, p_eyda_fyrir timestamptz default null)
returns int language plpgsql security definer set search_path = public as $$
declare t jsonb; s jsonb; n int := 0; fyr uuid; nyjast timestamptz; elst timestamptz; idir text[];
begin
  if not postholf_lykill_ok(p_lykill) then return -1; end if;
  if jsonb_typeof(p_gogn) <> 'array' or jsonb_array_length(p_gogn) > 100 then return -2; end if;
  perform set_config('vinnusvaedi.postholf_skrift', '1', true);
  for t in select * from jsonb_array_elements(p_gogn) loop
    continue when coalesce(t->>'id', '') = '' or (t->>'sidast') is null;
    select u.fyrirtaeki_id into fyr from notendur u
     where lower(u.netfang) = lower(t->>'fra_netfang') and u.hlutverk = 'vidskiptavinur' and u.fyrirtaeki_id is not null
     limit 1;
    insert into postholf_thraedir (id, efni, fra_nafn, fra_netfang, snid, sidast, fjoldi, olesid_gmail, tengill, fyrirtaeki_id, uppfaert)
    values (left(t->>'id', 100), left(coalesce(t->>'efni', ''), 300), left(t->>'fra_nafn', 200), left(lower(t->>'fra_netfang'), 320),
            left(t->>'snid', 500), (t->>'sidast')::timestamptz, greatest(0, coalesce((t->>'fjoldi')::int, 1)),
            coalesce((t->>'olesid')::boolean, false),
            case when (t->>'tengill') ~ '^https://mail\.google\.com/\S+$' then left(t->>'tengill', 500) end, fyr, now())
    on conflict (id) do update set efni = excluded.efni, fra_nafn = excluded.fra_nafn, fra_netfang = excluded.fra_netfang,
      snid = excluded.snid, sidast = excluded.sidast, fjoldi = excluded.fjoldi, olesid_gmail = excluded.olesid_gmail,
      tengill = excluded.tengill, fyrirtaeki_id = excluded.fyrirtaeki_id, uppfaert = now();
    idir := array[]::text[]; elst := null;
    for s in select * from jsonb_array_elements(coalesce(t->'skilabod', '[]'::jsonb)) loop
      continue when coalesce(s->>'id', '') = '' or (s->>'dags') is null;
      idir := idir || left(s->>'id', 100);
      elst := least(coalesce(elst, (s->>'dags')::timestamptz), (s->>'dags')::timestamptz);
      insert into postholf_skilabod (id, thradur_id, fra_nafn, fra_netfang, til, dags, texti, fra_okkur, vidhengi)
      values (left(s->>'id', 100), left(t->>'id', 100), left(s->>'fra_nafn', 200), left(lower(s->>'fra_netfang'), 320),
              left(s->>'til', 2000), (s->>'dags')::timestamptz, left(coalesce(s->>'texti', ''), 20000),
              coalesce((s->>'fra_okkur')::boolean, false), greatest(0, coalesce((s->>'vidhengi')::int, 0)))
      on conflict (id) do nothing;
    end loop;
    /* Skilaboð í þræðinum sem Gmail sendi ekki núna (t.d. drög sem urðu að
       sendum pósti eða var hent), innan tímabilsins sem kom inn */
    if elst is not null then
      delete from postholf_skilabod
       where thradur_id = left(t->>'id', 100) and dags >= elst and not (id = any(idir));
    end if;
    n := n + 1;
  end loop;
  if p_eyda_fyrir is not null then
    delete from postholf_thraedir where sidast < p_eyda_fyrir;
  end if;
  return n;
end;
$$;
revoke all on function postholf_skra(text, jsonb, timestamptz) from public;
grant execute on function postholf_skra(text, jsonb, timestamptz) to anon;
-- ==========================================================================
-- 32. Fundir á Dagatalinu: tími frá og til (eða allan daginn), staðsetning,
--     lýsing og viðskiptavinur ef við á. Bara stjórnendur. google_id er
--     fyrir seinna, þegar fundirnir fara líka í Google Calendar. Má keyra aftur.
-- ==========================================================================

create table if not exists fundir (
  id            uuid primary key default gen_random_uuid(),
  titill        text not null check (length(titill) between 1 and 200),
  byrjar        timestamptz not null,
  endar         timestamptz not null,
  allan_daginn  boolean not null default false,
  stadur        text check (length(stadur) <= 300),
  lysing        text check (length(lysing) <= 4000),
  fyrirtaeki_id uuid references fyrirtaeki on delete set null,
  google_id     text,
  hofundur      uuid references notendur on delete set null,
  stofnad       timestamptz not null default now(),
  uppfaert      timestamptz not null default now(),
  check (endar >= byrjar)
);
create index if not exists fundir_byrjar_idx on fundir (byrjar);

alter table fundir enable row level security;
drop policy if exists fundir_admin on fundir;
create policy fundir_admin on fundir for all to authenticated
  using (er_admin()) with check (er_admin());

drop trigger if exists stimpla_fundir on fundir;
create trigger stimpla_fundir before update on fundir
  for each row execute function stimpla();
-- ==========================================================================
-- 31. Pósthólfið: drög merkt sem drög (dálkurinn drog).
alter table postholf_skilabod add column if not exists drog boolean not null default false;
--     Og: skilaboð sem eru ekki lengur í Gmail hverfa líka hér.
--     Gmail vistar drög meðan skrifað er. Eldri samstilling tók þau með, og
--     þá sáust tvö "send" svör þótt bara annað hefði farið. postholf.gs merkir
--     nú drögin, og hér eyðast skilaboð þráðar sem Gmail sendi ekki
--     lengur, innan þess tímabils sem kom inn (eldri skilaboð haldast).
--     Má keyra aftur.
-- ==========================================================================

create or replace function postholf_skra(p_lykill text, p_gogn jsonb, p_eyda_fyrir timestamptz default null)
returns int language plpgsql security definer set search_path = public as $$
declare t jsonb; s jsonb; n int := 0; fyr uuid; nyjast timestamptz; elst timestamptz; idir text[];
begin
  if not postholf_lykill_ok(p_lykill) then return -1; end if;
  if jsonb_typeof(p_gogn) <> 'array' or jsonb_array_length(p_gogn) > 100 then return -2; end if;
  perform set_config('vinnusvaedi.postholf_skrift', '1', true);
  for t in select * from jsonb_array_elements(p_gogn) loop
    continue when coalesce(t->>'id', '') = '' or (t->>'sidast') is null;
    select u.fyrirtaeki_id into fyr from notendur u
     where lower(u.netfang) = lower(t->>'fra_netfang') and u.hlutverk = 'vidskiptavinur' and u.fyrirtaeki_id is not null
     limit 1;
    insert into postholf_thraedir (id, efni, fra_nafn, fra_netfang, snid, sidast, fjoldi, olesid_gmail, tengill, fyrirtaeki_id, uppfaert)
    values (left(t->>'id', 100), left(coalesce(t->>'efni', ''), 300), left(t->>'fra_nafn', 200), left(lower(t->>'fra_netfang'), 320),
            left(t->>'snid', 500), (t->>'sidast')::timestamptz, greatest(0, coalesce((t->>'fjoldi')::int, 1)),
            coalesce((t->>'olesid')::boolean, false),
            case when (t->>'tengill') ~ '^https://mail\.google\.com/\S+$' then left(t->>'tengill', 500) end, fyr, now())
    on conflict (id) do update set efni = excluded.efni, fra_nafn = excluded.fra_nafn, fra_netfang = excluded.fra_netfang,
      snid = excluded.snid, sidast = excluded.sidast, fjoldi = excluded.fjoldi, olesid_gmail = excluded.olesid_gmail,
      tengill = excluded.tengill, fyrirtaeki_id = excluded.fyrirtaeki_id, uppfaert = now();
    idir := array[]::text[]; elst := null;
    for s in select * from jsonb_array_elements(coalesce(t->'skilabod', '[]'::jsonb)) loop
      continue when coalesce(s->>'id', '') = '' or (s->>'dags') is null;
      idir := idir || left(s->>'id', 100);
      elst := least(coalesce(elst, (s->>'dags')::timestamptz), (s->>'dags')::timestamptz);
      insert into postholf_skilabod (id, thradur_id, fra_nafn, fra_netfang, til, dags, texti, fra_okkur, vidhengi, drog)
      values (left(s->>'id', 100), left(t->>'id', 100), left(s->>'fra_nafn', 200), left(lower(s->>'fra_netfang'), 320),
              left(s->>'til', 2000), (s->>'dags')::timestamptz, left(coalesce(s->>'texti', ''), 20000),
              coalesce((s->>'fra_okkur')::boolean, false), greatest(0, coalesce((s->>'vidhengi')::int, 0)),
              coalesce((s->>'drog')::boolean, false))
      on conflict (id) do update set drog = excluded.drog, texti = excluded.texti, dags = excluded.dags;
    end loop;
    /* Skilaboð í þræðinum sem Gmail sendi ekki núna (t.d. drög sem urðu að
       sendum pósti eða var hent), innan tímabilsins sem kom inn */
    if elst is not null then
      delete from postholf_skilabod
       where thradur_id = left(t->>'id', 100) and dags >= elst and not (id = any(idir));
    end if;
    n := n + 1;
  end loop;
  if p_eyda_fyrir is not null then
    delete from postholf_thraedir where sidast < p_eyda_fyrir;
  end if;
  return n;
end;
$$;
revoke all on function postholf_skra(text, jsonb, timestamptz) from public;
grant execute on function postholf_skra(text, jsonb, timestamptz) to anon;
-- ==========================================================================
-- 33. Persónulegt á Dagatalinu: fundir eða viðburðir sem eru bara fyrir þann
--     sem bjó þá til (t.d. tannlæknir eða ferð). Aðrir stjórnendur sjá þá ekki.
--     Má keyra aftur.
-- ==========================================================================

alter table fundir add column if not exists tegund text not null default 'fundur';
alter table fundir drop constraint if exists fundir_tegund_check;
alter table fundir add constraint fundir_tegund_check check (tegund in ('fundur', 'personulegt'));

drop policy if exists fundir_admin on fundir;
create policy fundir_admin on fundir for all to authenticated
  using (er_admin() and (tegund <> 'personulegt' or hofundur = auth.uid()))
  with check (er_admin() and (tegund <> 'personulegt' or hofundur = auth.uid()));
-- ==========================================================================
-- 34. Kerfisstillingar: gjaldmiðill kerfisins (ISK, EUR eða USD). Allir
--     innskráðir lesa (viðskiptavinir sjá upphæðir í sama gjaldmiðli),
--     bara stjórnendur breyta. Tungumálið er stillt á hvern notanda í vafranum.
--     Má keyra aftur.
-- ==========================================================================

create table if not exists kerfisstillingar (
  lykill   text primary key check (lykill in ('gjaldmidill')),
  gildi    text not null check (length(gildi) <= 20),
  uppfaert timestamptz not null default now(),
  check (lykill <> 'gjaldmidill' or gildi in ('ISK', 'EUR', 'USD'))
);
alter table kerfisstillingar enable row level security;
drop policy if exists kerfisstillingar_les on kerfisstillingar;
create policy kerfisstillingar_les on kerfisstillingar for select to authenticated using (true);
drop policy if exists kerfisstillingar_admin on kerfisstillingar;
create policy kerfisstillingar_admin on kerfisstillingar for all to authenticated
  using (er_admin()) with check (er_admin());
