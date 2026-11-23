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
