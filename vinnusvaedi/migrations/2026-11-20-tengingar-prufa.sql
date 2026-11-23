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
