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

-- Öryggi: nýr notandi ræður ekki sjálfur hlutverki sínu eða fyrirtæki
-- Áður las nyr_notandi() hlutverk og fyrirtaeki_id úr user metadata, sem
-- notandinn sjálfur getur sett við nýskráningu. Þá gat hver sem er gert sig
-- að admin. Nú fær hver nýr notandi hlutverkið vidskiptavinur og ekkert
-- fyrirtæki. Admin tengir hann við fyrirtæki á stjórnborðinu, og admin
-- hlutverk er aðeins sett í SQL Editor.

create or replace function nyr_notandi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notendur (id, netfang, nafn, fyrirtaeki_id, hlutverk)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(left(new.raw_user_meta_data ->> 'nafn', 120), ''), split_part(coalesce(new.email, ''), '@', 1)),
    null,
    'vidskiptavinur'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
