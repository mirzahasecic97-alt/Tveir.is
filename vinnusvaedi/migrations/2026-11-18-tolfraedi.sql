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
