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
