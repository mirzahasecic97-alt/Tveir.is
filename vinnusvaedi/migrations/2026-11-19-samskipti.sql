-- ==========================================================================
-- 24. Samskipti: Gmail pósthólfið á vinnusvæðinu
--
-- Apps Script (postholf.gs í verkefninu á tveir@tveir.is) afritar á 5
-- mínútna fresti pósthólfið síðustu 14 daga hingað (aðalflipinn, ekki
-- auglýsingar né samfélagsmiðlar): þræði og skilaboð sem venjulegan texta.
-- Svar sem er skrifað á vinnusvæðinu bíður í postholf_svor og skriftan
-- sendir það frá tveir@tveir.is í sama póstþræði.
--
-- Bara stjórnendur sjá þetta. Viðskiptavinir sjá aldrei pósthólfið.
-- Skriftan kemst bara inn með lyklinum úr stillingar_innri (eins og 16 til 18).
-- Má keyra aftur.
-- ==========================================================================

create table if not exists postholf_thraedir (
  id            text primary key check (length(id) between 1 and 100),   -- þráðarauðkenni Gmail
  efni          text not null default '' check (length(efni) <= 300),
  fra_nafn      text check (length(fra_nafn) <= 200),
  fra_netfang   text check (length(fra_netfang) <= 320),
  snid          text check (length(snid) <= 500),
  sidast        timestamptz not null,
  fjoldi        int not null default 1 check (fjoldi >= 0),
  -- Ólesið í Gmail þegar síðast var samstillt
  olesid_gmail  boolean not null default false,
  -- Opnað á vinnusvæðinu eftir síðasta nýja skilaboð
  lesid_kerfi   timestamptz,
  tengill       text check (tengill ~ '^https://mail\.google\.com/\S+$' and length(tengill) <= 500),
  -- Sett í gagnagrunninum: sendandinn er notandi hjá viðskiptavini
  fyrirtaeki_id uuid references fyrirtaeki on delete set null,
  uppfaert      timestamptz not null default now()
);
create index if not exists postholf_thraedir_sidast_idx on postholf_thraedir (sidast desc);

create table if not exists postholf_skilabod (
  id          text primary key check (length(id) between 1 and 100),     -- skilaboðaauðkenni Gmail
  thradur_id  text not null references postholf_thraedir on delete cascade,
  fra_nafn    text check (length(fra_nafn) <= 200),
  fra_netfang text check (length(fra_netfang) <= 320),
  til         text check (length(til) <= 2000),
  dags        timestamptz not null,
  texti       text not null default '' check (length(texti) <= 20000),
  fra_okkur   boolean not null default false,
  vidhengi    int not null default 0 check (vidhengi >= 0)
);
create index if not exists postholf_skilabod_thradur_idx on postholf_skilabod (thradur_id, dags);

create table if not exists postholf_svor (
  id          uuid primary key default gen_random_uuid(),
  thradur_id  text not null references postholf_thraedir on delete cascade,
  texti       text not null check (length(btrim(texti)) between 1 and 10000),
  stada       text not null default 'bidur' check (stada in ('bidur', 'send', 'villa')),
  villa       text check (length(villa) <= 500),
  sendandi    uuid,
  stofnad     timestamptz not null default now(),
  sent_dags   timestamptz
);
create index if not exists postholf_svor_bidur_idx on postholf_svor (stofnad) where stada = 'bidur';

create or replace function stilla_postholf_svari() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not er_admin() then
    raise exception 'Bara stjórnendur svara pósti';
  end if;
  new.sendandi  := auth.uid();
  new.stada     := 'bidur';
  new.villa     := null;
  new.sent_dags := null;
  new.stofnad   := now();
  return new;
end;
$$;
revoke all on function stilla_postholf_svari() from public, anon, authenticated;
drop trigger if exists stilla_postholf_svari_trigger on postholf_svor;
create trigger stilla_postholf_svari_trigger before insert on postholf_svor
  for each row execute function stilla_postholf_svari();

-- Svarið fer strax ef vefkrókurinn er tengdur (sama leið og lokið-pósturinn)
drop trigger if exists vekja_postinn_svor on postholf_svor;
create trigger vekja_postinn_svor after insert on postholf_svor
  for each row execute function vekja_postinn();

alter table postholf_thraedir enable row level security;
alter table postholf_skilabod enable row level security;
alter table postholf_svor     enable row level security;

drop policy if exists postholf_thraedir_les on postholf_thraedir;
create policy postholf_thraedir_les on postholf_thraedir for select to authenticated using (er_admin());
drop policy if exists postholf_thraedir_lesid on postholf_thraedir;
create policy postholf_thraedir_lesid on postholf_thraedir for update to authenticated using (er_admin()) with check (er_admin());
drop policy if exists postholf_skilabod_les on postholf_skilabod;
create policy postholf_skilabod_les on postholf_skilabod for select to authenticated using (er_admin());
drop policy if exists postholf_svor_les on postholf_svor;
create policy postholf_svor_les on postholf_svor for select to authenticated using (er_admin());
drop policy if exists postholf_svor_ny on postholf_svor;
create policy postholf_svor_ny on postholf_svor for insert to authenticated with check (er_admin());

-- Stjórnandi má bara merkja þráð lesinn, ekki breyta pósti
create or replace function vernda_postholf_thrad() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('vinnusvaedi.postholf_skrift', true) = '1' then return new; end if;
  if (new.id, new.efni, new.fra_nafn, new.fra_netfang, new.snid, new.sidast, new.fjoldi, new.olesid_gmail, new.tengill, new.fyrirtaeki_id)
     is distinct from (old.id, old.efni, old.fra_nafn, old.fra_netfang, old.snid, old.sidast, old.fjoldi, old.olesid_gmail, old.tengill, old.fyrirtaeki_id) then
    raise exception 'Bara má merkja þráðinn lesinn';
  end if;
  return new;
end;
$$;
revoke all on function vernda_postholf_thrad() from public, anon, authenticated;
drop trigger if exists vernda_postholf_thrad_trigger on postholf_thraedir;
create trigger vernda_postholf_thrad_trigger before update on postholf_thraedir
  for each row execute function vernda_postholf_thrad();

create or replace function postholf_lykill_ok(p_lykill text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_lykill is not null
     and p_lykill = (select gildi from stillingar_innri where lykill = 'postur_lykill');
$$;
revoke all on function postholf_lykill_ok(text) from public, anon, authenticated;

-- Fyrir Apps Script: skráir þræði og skilaboð. p_gogn er listi af
-- { id, efni, fra_nafn, fra_netfang, snid, sidast, fjoldi, olesid, tengill,
--   skilabod: [{ id, fra_nafn, fra_netfang, til, dags, texti, fra_okkur, vidhengi }] }
-- Þræðir sem eru farnir úr pósthólfinu (eldri en p_eyda_fyrir) hverfa.
create or replace function postholf_skra(p_lykill text, p_gogn jsonb, p_eyda_fyrir timestamptz default null)
returns int language plpgsql security definer set search_path = public as $$
declare t jsonb; s jsonb; n int := 0; fyr uuid; nyjast timestamptz;
begin
  if not postholf_lykill_ok(p_lykill) then return -1; end if;
  if jsonb_typeof(p_gogn) <> 'array' or jsonb_array_length(p_gogn) > 100 then return -2; end if;
  perform set_config('vinnusvaedi.postholf_skrift', '1', true);
  for t in select * from jsonb_array_elements(p_gogn) loop
    continue when coalesce(t->>'id', '') = '' or (t->>'sidast') is null;
    select u.fyrirtaeki_id into fyr from notendur u
     where lower(u.netfang) = lower(t->>'fra_netfang') and u.hlutverk = 'vidskiptavinur' and u.fyrirtaeki_id is not null
     limit 1;
    insert into postholf_thraedir (id, efni, fra_nafn, fra_netfang, snid, sidast, fjoldi, olesid_gmail, tengill, fyrirtaeki_id, uppfaert)
    values (left(t->>'id', 100), left(coalesce(t->>'efni', ''), 300), left(t->>'fra_nafn', 200), left(lower(t->>'fra_netfang'), 320),
            left(t->>'snid', 500), (t->>'sidast')::timestamptz, greatest(0, coalesce((t->>'fjoldi')::int, 1)),
            coalesce((t->>'olesid')::boolean, false),
            case when (t->>'tengill') ~ '^https://mail\.google\.com/\S+$' then left(t->>'tengill', 500) end, fyr, now())
    on conflict (id) do update set efni = excluded.efni, fra_nafn = excluded.fra_nafn, fra_netfang = excluded.fra_netfang,
      snid = excluded.snid, sidast = excluded.sidast, fjoldi = excluded.fjoldi, olesid_gmail = excluded.olesid_gmail,
      tengill = excluded.tengill, fyrirtaeki_id = excluded.fyrirtaeki_id, uppfaert = now();
    for s in select * from jsonb_array_elements(coalesce(t->'skilabod', '[]'::jsonb)) loop
      continue when coalesce(s->>'id', '') = '' or (s->>'dags') is null;
      insert into postholf_skilabod (id, thradur_id, fra_nafn, fra_netfang, til, dags, texti, fra_okkur, vidhengi)
      values (left(s->>'id', 100), left(t->>'id', 100), left(s->>'fra_nafn', 200), left(lower(s->>'fra_netfang'), 320),
              left(s->>'til', 2000), (s->>'dags')::timestamptz, left(coalesce(s->>'texti', ''), 20000),
              coalesce((s->>'fra_okkur')::boolean, false), greatest(0, coalesce((s->>'vidhengi')::int, 0)))
      on conflict (id) do nothing;
    end loop;
    n := n + 1;
  end loop;
  if p_eyda_fyrir is not null then
    delete from postholf_thraedir where sidast < p_eyda_fyrir;
  end if;
  return n;
end;
$$;
revoke all on function postholf_skra(text, jsonb, timestamptz) from public;
grant execute on function postholf_skra(text, jsonb, timestamptz) to anon;

-- Fyrir Apps Script: svör sem bíða
create or replace function postholf_svor_til(p_lykill text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not postholf_lykill_ok(p_lykill) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'thradur_id', s.thradur_id, 'texti', s.texti) order by s.stofnad)
    from (select * from postholf_svor where stada = 'bidur' order by stofnad limit 20) s), '[]'::jsonb);
end;
$$;
revoke all on function postholf_svor_til(text) from public;
grant execute on function postholf_svor_til(text) to anon;

create or replace function merkja_postholf_svar(p_lykill text, p_id uuid, p_villa text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not postholf_lykill_ok(p_lykill) then return false; end if;
  update postholf_svor set stada = case when p_villa is null then 'send' else 'villa' end,
         villa = left(p_villa, 500), sent_dags = case when p_villa is null then now() end
   where id = p_id and stada = 'bidur';
  return found;
end;
$$;
revoke all on function merkja_postholf_svar(text, uuid, text) from public;
grant execute on function merkja_postholf_svar(text, uuid, text) to anon;
