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
-- 31. Pósthólfið: drög merkt sem drög (dálkurinn drog).
alter table postholf_skilabod add column if not exists drog boolean not null default false;
--     Og: skilaboð sem eru ekki lengur í Gmail hverfa líka hér.
--     Gmail vistar drög meðan skrifað er. Eldri samstilling tók þau með, og
--     þá sáust tvö "send" svör þótt bara annað hefði farið. postholf.gs merkir
--     nú drögin, og hér eyðast skilaboð þráðar sem Gmail sendi ekki
--     lengur, innan þess tímabils sem kom inn (eldri skilaboð haldast).
--     Má keyra aftur.
-- ==========================================================================

create or replace function postholf_skra(p_lykill text, p_gogn jsonb, p_eyda_fyrir timestamptz default null)
returns int language plpgsql security definer set search_path = public as $$
declare t jsonb; s jsonb; n int := 0; fyr uuid; nyjast timestamptz; elst timestamptz; idir text[];
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
    idir := array[]::text[]; elst := null;
    for s in select * from jsonb_array_elements(coalesce(t->'skilabod', '[]'::jsonb)) loop
      continue when coalesce(s->>'id', '') = '' or (s->>'dags') is null;
      idir := idir || left(s->>'id', 100);
      elst := least(coalesce(elst, (s->>'dags')::timestamptz), (s->>'dags')::timestamptz);
      insert into postholf_skilabod (id, thradur_id, fra_nafn, fra_netfang, til, dags, texti, fra_okkur, vidhengi, drog)
      values (left(s->>'id', 100), left(t->>'id', 100), left(s->>'fra_nafn', 200), left(lower(s->>'fra_netfang'), 320),
              left(s->>'til', 2000), (s->>'dags')::timestamptz, left(coalesce(s->>'texti', ''), 20000),
              coalesce((s->>'fra_okkur')::boolean, false), greatest(0, coalesce((s->>'vidhengi')::int, 0)),
              coalesce((s->>'drog')::boolean, false))
      on conflict (id) do update set drog = excluded.drog, texti = excluded.texti, dags = excluded.dags;
    end loop;
    /* Skilaboð í þræðinum sem Gmail sendi ekki núna (t.d. drög sem urðu að
       sendum pósti eða var hent), innan tímabilsins sem kom inn */
    if elst is not null then
      delete from postholf_skilabod
       where thradur_id = left(t->>'id', 100) and dags >= elst and not (id = any(idir));
    end if;
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
