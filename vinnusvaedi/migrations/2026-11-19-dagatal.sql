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
-- 27. Dagatal: Google Calendar á vinnusvæðinu
--
-- Apps Script (dagatal.gs í verkefninu á tveir@tveir.is) afritar á 5
-- mínútna fresti fundina í aðaldagatalinu, frá 14 dögum aftur til 90 daga
-- fram. Dagatal síðan sýnir þá við hlið skiladaga verkefna og taska.
-- Bara stjórnendur sjá fundina. Má keyra aftur.
-- ==========================================================================

create table if not exists dagatal_atburdir (
  id            text primary key check (length(id) between 1 and 300),
  titill        text not null default '' check (length(titill) <= 300),
  lysing        text check (length(lysing) <= 2000),
  stadur        text check (length(stadur) <= 300),
  byrjar        timestamptz not null,
  endar         timestamptz not null,
  allan_daginn  boolean not null default false,
  tengill       text check (tengill ~ '^https://\S+$' and length(tengill) <= 1000),
  fundarhlekkur text check (fundarhlekkur ~ '^https://\S+$' and length(fundarhlekkur) <= 1000),
  gestir        int not null default 0 check (gestir >= 0),
  uppfaert      timestamptz not null default now()
);
create index if not exists dagatal_atburdir_byrjar_idx on dagatal_atburdir (byrjar);

alter table dagatal_atburdir enable row level security;
drop policy if exists dagatal_atburdir_les on dagatal_atburdir;
create policy dagatal_atburdir_les on dagatal_atburdir for select to authenticated using (er_admin());

-- Fyrir Apps Script: skiptir út öllum fundum á bilinu [p_fra, p_til] fyrir
-- þá sem koma inn. Fundur sem var eytt í Google hverfur því líka hér.
create or replace function dagatal_skra(p_lykill text, p_gogn jsonb, p_fra timestamptz, p_til timestamptz)
returns int language plpgsql security definer set search_path = public as $$
declare a jsonb; n int := 0;
begin
  if not postholf_lykill_ok(p_lykill) then return -1; end if;
  if jsonb_typeof(p_gogn) <> 'array' or jsonb_array_length(p_gogn) > 1000 then return -2; end if;
  if p_fra is null or p_til is null or p_til <= p_fra or p_til - p_fra > interval '200 days' then return -3; end if;
  delete from dagatal_atburdir where byrjar >= p_fra and byrjar < p_til;
  delete from dagatal_atburdir where byrjar < p_fra - interval '60 days';
  for a in select * from jsonb_array_elements(p_gogn) loop
    continue when coalesce(a->>'id', '') = '' or (a->>'byrjar') is null or (a->>'endar') is null;
    insert into dagatal_atburdir (id, titill, lysing, stadur, byrjar, endar, allan_daginn, tengill, fundarhlekkur, gestir, uppfaert)
    values (left(a->>'id', 300), left(coalesce(a->>'titill', ''), 300), left(a->>'lysing', 2000), left(a->>'stadur', 300),
            (a->>'byrjar')::timestamptz, (a->>'endar')::timestamptz, coalesce((a->>'allan_daginn')::boolean, false),
            case when (a->>'tengill') ~ '^https://\S+$' then left(a->>'tengill', 1000) end,
            case when (a->>'fundarhlekkur') ~ '^https://\S+$' then left(a->>'fundarhlekkur', 1000) end,
            greatest(0, coalesce((a->>'gestir')::int, 0)), now())
    on conflict (id) do update set titill = excluded.titill, lysing = excluded.lysing, stadur = excluded.stadur,
      byrjar = excluded.byrjar, endar = excluded.endar, allan_daginn = excluded.allan_daginn, tengill = excluded.tengill,
      fundarhlekkur = excluded.fundarhlekkur, gestir = excluded.gestir, uppfaert = now();
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function dagatal_skra(text, jsonb, timestamptz, timestamptz) from public;
grant execute on function dagatal_skra(text, jsonb, timestamptz, timestamptz) to anon;
