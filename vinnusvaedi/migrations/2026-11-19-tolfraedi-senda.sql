-- ==========================================================================
-- Tölfræði send á viðskiptavin beint úr kerfinu (19. nóv 2026)
--
-- Stjórnandi velur viðtakendur í Tölfræði og ýtir á Senda. Pósturinn er
-- smíðaður í vafranum (sama útlit og forsýnin) og bíður hér. Apps Script
-- (tolfraedi.gs, sendaTolfraediSendingar_) sækir hann og sendir frá
-- tveir@tveir.is, strax ef vefkrókurinn er tengdur, annars innan 5 mínútna.
--
-- Viðtakendur verða að vera viðskiptavinir sama fyrirtækis eða stjórnendur,
-- svo kerfið verði aldrei notað til að senda póst á ókunnuga.
-- ==========================================================================

create table if not exists tolfraedi_sendingar (
  id             uuid primary key default gen_random_uuid(),
  fyrirtaeki_id  uuid not null references fyrirtaeki on delete cascade,
  netfong        text[] not null,
  efni           text not null check (length(efni) between 1 and 200),
  html           text not null check (length(html) <= 300000),
  texti          text not null check (length(texti) <= 20000),
  stada          text not null default 'bidur' check (stada in ('bidur', 'send', 'villa')),
  villa          text check (length(villa) <= 500),
  sendandi       uuid,
  stofnad        timestamptz not null default now(),
  sent_dags      timestamptz
);
create index if not exists tolfraedi_sendingar_bidur_idx on tolfraedi_sendingar (stofnad) where stada = 'bidur';
create index if not exists tolfraedi_sendingar_fyrirtaeki_idx on tolfraedi_sendingar (fyrirtaeki_id, stofnad desc);

create or replace function stilla_tolfraedi_sendingu() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  if not er_admin() then
    raise exception 'Bara stjórnendur senda tölfræði';
  end if;
  new.sendandi  := auth.uid();
  new.stada     := 'bidur';
  new.villa     := null;
  new.sent_dags := null;
  new.stofnad   := now();
  if new.netfong is null or coalesce(array_length(new.netfong, 1), 0) = 0 or array_length(new.netfong, 1) > 10 then
    raise exception 'Veldu 1 til 10 viðtakendur';
  end if;
  foreach n in array new.netfong loop
    if not exists (
      select 1 from notendur u
       where lower(u.netfang) = lower(trim(n))
         and ((u.fyrirtaeki_id = new.fyrirtaeki_id and u.hlutverk = 'vidskiptavinur') or u.hlutverk = 'admin')
    ) then
      raise exception 'Netfangið % er ekki tengt þessu fyrirtæki', n;
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function stilla_tolfraedi_sendingu() from public, anon, authenticated;

drop trigger if exists stilla_tolfraedi_sendingu_trigger on tolfraedi_sendingar;
create trigger stilla_tolfraedi_sendingu_trigger
  before insert on tolfraedi_sendingar
  for each row execute function stilla_tolfraedi_sendingu();

-- Pósturinn fer strax, sama leið og lokið-pósturinn (vekja_postinn í 2026-11-17-strax-postur.sql)
drop trigger if exists vekja_postinn_tolfraedi on tolfraedi_sendingar;
create trigger vekja_postinn_tolfraedi
  after insert on tolfraedi_sendingar
  for each row execute function vekja_postinn();

alter table tolfraedi_sendingar enable row level security;
drop policy if exists tolfraedi_sendingar_les on tolfraedi_sendingar;
create policy tolfraedi_sendingar_les on tolfraedi_sendingar for select to authenticated using (er_admin());
drop policy if exists tolfraedi_sendingar_ny on tolfraedi_sendingar;
create policy tolfraedi_sendingar_ny on tolfraedi_sendingar for insert to authenticated with check (er_admin());
drop policy if exists tolfraedi_sendingar_eyda on tolfraedi_sendingar;
create policy tolfraedi_sendingar_eyda on tolfraedi_sendingar for delete to authenticated using (er_admin());

-- Fyrir Apps Script: póstar sem bíða
create or replace function tolfraedi_sendingar_til(p_lykill text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'netfong', to_jsonb(s.netfong), 'efni', s.efni,
                                        'html', s.html, 'texti', s.texti) order by s.stofnad)
      from (select * from tolfraedi_sendingar where stada = 'bidur' order by stofnad limit 20) s
  ), '[]'::jsonb);
end;
$$;
revoke all on function tolfraedi_sendingar_til(text) from public;
grant execute on function tolfraedi_sendingar_til(text) to anon;

create or replace function merkja_tolfraedi_sendingu(p_lykill text, p_id uuid, p_villa text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return false;
  end if;
  update tolfraedi_sendingar
     set stada = case when p_villa is null then 'send' else 'villa' end,
         villa = left(p_villa, 500),
         sent_dags = case when p_villa is null then now() else null end
   where id = p_id and stada = 'bidur';
  return found;
end;
$$;
revoke all on function merkja_tolfraedi_sendingu(text, uuid, text) from public;
grant execute on function merkja_tolfraedi_sendingu(text, uuid, text) to anon;
