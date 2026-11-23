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
