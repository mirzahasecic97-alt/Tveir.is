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
