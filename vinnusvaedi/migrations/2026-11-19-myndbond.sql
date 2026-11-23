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
