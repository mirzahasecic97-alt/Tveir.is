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
