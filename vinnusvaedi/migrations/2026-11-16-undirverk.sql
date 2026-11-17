-- ==========================================================================
-- 18. Undirverk: mörg skil innan eins tasks
--     Dæmi: fjögur myndbönd fyrir sama viðskiptavin. Hvert myndband er
--     undirverk. Þegar við hökum í eitt og setjum skrá eða hlekk með sendir
--     skriftan verk-postur.gs viðskiptavininum póst innan 5 mínútna.
--
--     Keyrist einu sinni í SQL Editor. Má keyra aftur, allt er "if not
--     exists" eða "or replace". Sama efni stendur aftast í gagnagrunnur.sql.
--
--     Skrár fara í lokuðu geymsluna vidhengi undir
--     <fyrirtaeki_id>/undirverk/<task_id>/<undirverk_id>/<nafn>, svo sömu
--     stefnur og fyrir viðhengi gilda: fyrirtækið les bara sína möppu,
--     bara admin eyðir.
-- ==========================================================================

create table if not exists undirverk (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references taskar on delete cascade,
  -- Sett af trigger úr taskinum, aldrei úr vafranum
  fyrirtaeki_id uuid not null references fyrirtaeki on delete cascade,
  rod           int  not null default 0,
  titill        text not null check (length(titill) between 1 and 200),
  lokid         boolean not null default false,
  lokid_dags    timestamptz,
  -- Skrá í geymslunni vidhengi, eða hlekkur annars staðar (WeTransfer, Drive)
  skra_slod     text check (length(skra_slod) <= 600),
  skra_nafn     text check (length(skra_nafn) <= 300),
  skra_staerd   bigint,
  tengill       text check (tengill ~ '^https://\S+$' and length(tengill) <= 2000),
  -- false: hakað í lokið án þess að senda viðskiptavininum póst
  senda         boolean not null default true,
  sent_dags     timestamptz,
  stofnad       timestamptz not null default now(),
  uppfaert      timestamptz not null default now()
);

create index if not exists undirverk_task_idx       on undirverk (task_id, rod);
create index if not exists undirverk_fyrirtaeki_idx on undirverk (fyrirtaeki_id);
create index if not exists undirverk_osent_idx      on undirverk (lokid_dags)
  where lokid and senda;

-- fyrirtaeki_id kemur alltaf úr taskinum, lokid_dags úr hakinu.
-- Skráin verður að liggja í möppu þessa undirverks, svo póstur eða
-- afhendingarnotandinn geti aldrei opnað skrá annars fyrirtækis.
create or replace function stilla_undirverk() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mappa text;
  nafn  text;
begin
  if tg_op = 'UPDATE' and new.task_id is distinct from old.task_id then
    raise exception 'Undirverk færist ekki á milli taska';
  end if;
  new.fyrirtaeki_id := (select fyrirtaeki_id from taskar where id = new.task_id);
  if new.fyrirtaeki_id is null then
    raise exception 'Taskurinn fannst ekki';
  end if;

  if new.skra_slod is not null
     and (tg_op = 'INSERT' or new.skra_slod is distinct from old.skra_slod) then
    mappa := new.fyrirtaeki_id::text || '/undirverk/' || new.task_id::text || '/' || new.id::text || '/';
    nafn  := substr(new.skra_slod, length(mappa) + 1);
    if left(new.skra_slod, length(mappa)) <> mappa
       or nafn in ('', '.', '..') or position('/' in nafn) > 0 then
      raise exception 'Skráin þarf að liggja í möppu undirverksins';
    end if;
  end if;

  if new.lokid and (tg_op = 'INSERT' or not old.lokid) then
    new.lokid_dags := now();
  elsif new.lokid then
    new.lokid_dags := old.lokid_dags;   -- nafnabreyting má ekki færa dagsetninguna
  else
    new.lokid_dags := null;
  end if;
  if tg_op = 'INSERT' then
    new.sent_dags := null;
  end if;
  new.uppfaert := now();
  return new;
end;
$$;

drop trigger if exists stilla_undirverk_trigger on undirverk;
create trigger stilla_undirverk_trigger
  before insert or update on undirverk
  for each row execute function stilla_undirverk();

-- Færist taskur á annað fyrirtæki fylgja undirverkin með
create or replace function faera_undirverk() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update undirverk set fyrirtaeki_id = new.fyrirtaeki_id where task_id = new.id;
  return new;
end;
$$;

drop trigger if exists faera_undirverk_trigger on taskar;
create trigger faera_undirverk_trigger
  after update of fyrirtaeki_id on taskar
  for each row when (old.fyrirtaeki_id is distinct from new.fyrirtaeki_id)
  execute function faera_undirverk();

alter table undirverk enable row level security;

-- Viðskiptavinur les undirverk síns fyrirtækis. Hann getur hvorki bætt við,
-- breytt né eytt. Það gerum við.
drop policy if exists undirverk_les on undirverk;
create policy undirverk_les on undirverk for select to authenticated
  using (er_admin() or fyrirtaeki_id = mitt_fyrirtaeki());

drop policy if exists undirverk_admin on undirverk;
create policy undirverk_admin on undirverk for all to authenticated
  using (er_admin()) with check (er_admin());

-- --------------------------------------------------------------------------
-- Póstur þegar undirverk er klárt
-- Sama Google skrifta og sama lykill og lokid_otilkynnt. Viðtakandi:
-- sá sem bað um taskinn ef það var viðskiptavinur, annars allir notendur
-- viðskiptavinarins í því fyrirtæki.
-- --------------------------------------------------------------------------
create or replace function undirverk_otilkynnt(p_lykill text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(x order by x->>'task_id', (x->>'nr')::int)
      from (
        select jsonb_build_object(
                 'id', u.id,
                 'titill', u.titill,
                 'task_id', t.id,
                 'task_titill', t.titill,
                 'fyrirtaeki', f.nafn,
                 'tengill', u.tengill,
                 'skra_slod', u.skra_slod,
                 'skra_nafn', u.skra_nafn,
                 'nr', (select count(*) from undirverk s
                         where s.task_id = u.task_id
                           and (s.rod, s.stofnad) <= (u.rod, u.stofnad)),
                 'lokin', (select count(*) from undirverk s where s.task_id = u.task_id and s.lokid),
                 'fjoldi', (select count(*) from undirverk s where s.task_id = u.task_id),
                 'thradur', case when hof.id is not null then t.postur_thradur end,
                 'nafn', case when hof.id is not null then hof.nafn end,
                 'netfong', coalesce(
                   case when hof.id is not null then jsonb_build_array(hof.netfang) end,
                   (select jsonb_agg(n.netfang order by n.stofnad)
                      from notendur n
                     where n.fyrirtaeki_id = t.fyrirtaeki_id
                       and n.hlutverk = 'vidskiptavinur'
                       and coalesce(n.netfang, '') <> ''))
               ) as x
          from undirverk u
          join taskar t     on t.id = u.task_id
          join fyrirtaeki f on f.id = t.fyrirtaeki_id
          left join notendur hof
                 on hof.id = t.hofundur
                and hof.hlutverk = 'vidskiptavinur'
                and hof.fyrirtaeki_id = t.fyrirtaeki_id
                and coalesce(hof.netfang, '') <> ''
         where u.lokid
           and u.senda
           and u.lokid_dags is not null
           and (u.sent_dags is null or u.sent_dags < u.lokid_dags)
      ) q
     where x->'netfong' is not null and jsonb_array_length(x->'netfong') > 0
  ), '[]'::jsonb);
end;
$$;
revoke all on function undirverk_otilkynnt(text) from public;
grant execute on function undirverk_otilkynnt(text) to anon;

create or replace function merkja_undirverk_sent(p_lykill text, p_ids uuid[])
returns int
language plpgsql security definer set search_path = public as $$
declare fjoldi int;
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return 0;
  end if;
  update undirverk set sent_dags = now() where id = any(p_ids) and lokid;
  get diagnostics fjoldi = row_count;
  return fjoldi;
end;
$$;
revoke all on function merkja_undirverk_sent(text, uuid[]) from public;
grant execute on function merkja_undirverk_sent(text, uuid[]) to anon;

-- --------------------------------------------------------------------------
-- Valkvætt: hlekkur beint á skrána í póstinum (gildir í 7 daga)
-- Supabase býr til undirritaða slóð bara fyrir innskráðan notanda sem má
-- lesa skrána. Skriftan skráir sig því inn sem sérstakur notandi,
-- afhending@tveir.is, sem má lesa skrár undirverka sem er lokið og ekkert
-- annað. Hver hann er stendur í stillingar_innri, ekki í user metadata.
-- Sé hann ekki settur upp fær viðskiptavinurinn hlekk á vinnusvæðið í
-- staðinn og sækir skrána þar. Sjá LESTU-MIG.md, kaflann Undirverk.
-- --------------------------------------------------------------------------
create or replace function afhending_ma_lesa(p_slod text)
returns boolean
language sql security definer stable set search_path = public as $$
  select auth.uid() is not null
     and auth.uid()::text = (select gildi from stillingar_innri where lykill = 'afhending_notandi')
     and exists (select 1 from undirverk u where u.skra_slod = p_slod and u.lokid)
$$;
-- Supabase gefur anon aðgang að nýjum föllum sjálfgefið, svo það er tekið af
revoke all on function afhending_ma_lesa(text) from public, anon;
grant execute on function afhending_ma_lesa(text) to authenticated;

drop policy if exists vidhengi_afhending on storage.objects;
create policy vidhengi_afhending on storage.objects for select to authenticated
  using (bucket_id = 'vidhengi' and afhending_ma_lesa(name));

-- --------------------------------------------------------------------------
-- Viðskiptavinur sækir skrá undirverks bara þegar því er lokið
-- Slóðin <fyrirtaeki_id>/undirverk/... er í möppu fyrirtækisins, svo
-- vidhengi_les hleypti honum annars í skrá sem við erum enn að vinna í.
-- Venjuleg viðhengi (<fyrirtaeki_id>/<task_id>/...) eru óbreytt.
-- --------------------------------------------------------------------------
create or replace function undirverk_skra_opin(p_slod text)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from undirverk u
                  where u.skra_slod = p_slod and u.lokid
                    and u.fyrirtaeki_id = mitt_fyrirtaeki())
$$;
revoke all on function undirverk_skra_opin(text) from public, anon;
grant execute on function undirverk_skra_opin(text) to authenticated;

drop policy if exists vidhengi_les on storage.objects;
create policy vidhengi_les on storage.objects for select to authenticated
  using (bucket_id = 'vidhengi'
         and (er_admin()
              or ((storage.foldername(name))[1] = mitt_fyrirtaeki()::text
                  and ((storage.foldername(name))[2] is distinct from 'undirverk'
                       or undirverk_skra_opin(name)))));

-- --------------------------------------------------------------------------
-- Notandi breytir ekki eigin fyrirtæki, hlutverki eða netfangi
-- Stefnan not_eigid leyfir notanda að uppfæra sína línu. Án þessa gæti
-- viðskiptavinur sett fyrirtaeki_id annars fyrirtækis á sig og lesið gögn
-- þess, eða sett annað netfang og fengið póstinn um undirverk sendan þangað.
-- Admin (og SQL Editor, þar sem enginn er innskráður) má áfram breyta öllu.
-- --------------------------------------------------------------------------
create or replace function vernda_notanda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not er_admin() then
    new.id            := old.id;
    new.fyrirtaeki_id := old.fyrirtaeki_id;
    new.hlutverk      := old.hlutverk;
    new.netfang       := old.netfang;
  end if;
  return new;
end;
$$;

drop trigger if exists vernda_notanda_trigger on notendur;
create trigger vernda_notanda_trigger
  before update on notendur
  for each row execute function vernda_notanda();
