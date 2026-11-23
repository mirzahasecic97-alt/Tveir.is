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
