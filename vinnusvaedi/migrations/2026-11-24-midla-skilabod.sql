-- ==========================================================================
-- Messenger og Instagram skilaboð í Glerhúsið (í gegnum Zernio)
--
-- Zernio á samþykkt Meta app. Hver stofa tengir sína Facebook síðu og sitt
-- Instagram þar (einn Zernio prófíll á stofu). Zernio sendir hvert nýtt
-- skilaboð á Edge fallið midlar-inn, sem skrifar þau hingað með service_role.
--
--   midla_profilar   Zernio prófíll -> stofa. Skráð héðan (SQL Editor) eða af
--                    fallinu sem tengir nýja stofu seinna.
--   midla_samtol     eitt samtal (Zernio conversationId) við eina manneskju
--   midla_skilabod   hvert skilaboð, inn og út (svör sem eru send á Facebook
--                    eða Instagram sjálfu koma líka, sem message.sent)
--
-- Bara stjórnendur stofunnar lesa. Enginn skrifar nema þjónustan, nema
-- lesid_kerfi á samtali (merkt lesið á vinnusvæðinu).
-- Veggurinn stofa_vegg er sá sami og á hinum 30 töflunum.
-- Má keyra aftur.
-- ==========================================================================

create table if not exists midla_profilar (
  zernio_profill text primary key check (length(zernio_profill) between 1 and 100),
  stofa_id       uuid not null references stofur on delete cascade,
  -- Merki á samtölunum, t.d. Breiðablik: Tveir sér um síður viðskiptavina
  heiti          text check (length(heiti) <= 100),
  stofnad        timestamptz not null default now()
);

create table if not exists midla_samtol (
  id            text primary key check (length(id) between 1 and 100),   -- Zernio conversationId
  stofa_id      uuid not null references stofur on delete cascade,
  ras           text not null check (ras in ('facebook', 'instagram')),
  zernio_profill text references midla_profilar on delete set null,
  reikningur    text check (length(reikningur) <= 100),                  -- Zernio accountId
  sida_id       text check (length(sida_id) <= 100),                     -- Facebook pageId
  vidmaelandi   text check (length(vidmaelandi) <= 100),                 -- platform id manneskjunnar
  nafn          text check (length(nafn) <= 200),
  notandanafn   text check (length(notandanafn) <= 200),
  sidast        timestamptz not null default now(),
  sidasti_texti text check (length(sidasti_texti) <= 300),
  fra_theim     boolean not null default true,   -- síðasta skilaboðið kom frá manneskjunni
  lesid_kerfi   timestamptz,
  stofnad       timestamptz not null default now()
);
create index if not exists midla_samtol_sidast_idx on midla_samtol (stofa_id, sidast desc);

create table if not exists midla_skilabod (
  id         text primary key check (length(id) between 1 and 200),      -- Zernio message id
  samtal_id  text not null references midla_samtol on delete cascade,
  stofa_id   uuid not null references stofur on delete cascade,
  fra_okkur  boolean not null default false,
  nafn       text check (length(nafn) <= 200),
  texti      text not null default '' check (length(texti) <= 20000),
  vidhengi   jsonb not null default '[]'::jsonb,
  dags       timestamptz not null,
  stofnad    timestamptz not null default now()
);
create index if not exists midla_skilabod_samtal_idx on midla_skilabod (samtal_id, dags);

alter table midla_profilar enable row level security;
alter table midla_samtol   enable row level security;
alter table midla_skilabod enable row level security;

revoke all on midla_profilar, midla_samtol, midla_skilabod from anon;
revoke all on midla_profilar, midla_samtol, midla_skilabod from authenticated;
grant select on midla_profilar, midla_samtol, midla_skilabod to authenticated;
grant update (lesid_kerfi) on midla_samtol to authenticated;
grant all on midla_profilar, midla_samtol, midla_skilabod to service_role;

drop policy if exists midla_profilar_les on midla_profilar;
create policy midla_profilar_les on midla_profilar for select to authenticated using (er_admin());
drop policy if exists midla_samtol_les on midla_samtol;
create policy midla_samtol_les on midla_samtol for select to authenticated using (er_admin());
drop policy if exists midla_samtol_lesid on midla_samtol;
create policy midla_samtol_lesid on midla_samtol for update to authenticated using (er_admin()) with check (er_admin());
drop policy if exists midla_skilabod_les on midla_skilabod;
create policy midla_skilabod_les on midla_skilabod for select to authenticated using (er_admin());

-- Veggurinn: sami og í 2026-11-23-stofur-5-veggir.sql
do $$
declare t text;
begin
  foreach t in array array['midla_profilar', 'midla_samtol', 'midla_skilabod'] loop
    execute format('drop policy if exists stofa_vegg on public.%I', t);
    execute format('create policy stofa_vegg on public.%I as restrictive for all to authenticated
                      using (stofa_id = (select min_stofa()))
                      with check (stofa_id = (select min_stofa()))', t);
  end loop;
end $$;

-- Skilaboð bara frá Tveir (sjálfgefni prófíllinn). Breiðablik og Snerpa eru
-- tengd í Zernio fyrir tölfræðina eina, og skilaboð þeirra eru hunsuð hér.
insert into midla_profilar (zernio_profill, stofa_id, heiti)
select '6b05a6535fff524d98dd5849', tveir_stofa(), 'Tveir'
 where tveir_stofa() is not null
on conflict (zernio_profill) do update set stofa_id = excluded.stofa_id, heiti = excluded.heiti;

-- Staðan
select '#midla_toflur' as k, count(*)::text as v from pg_class
 where relnamespace = 'public'::regnamespace and relname in ('midla_profilar', 'midla_samtol', 'midla_skilabod')
union all
select '#veggir', count(*)::text from pg_policies
 where schemaname = 'public' and policyname = 'stofa_vegg' and tablename like 'midla\_%' escape '\'
   and tablename in ('midla_profilar', 'midla_samtol', 'midla_skilabod')
union all
select '#profilar ' || coalesce(m.heiti, '') || ' -> ' || coalesce(s.nafn, '?'), s.stada from midla_profilar m join stofur s on s.id = m.stofa_id;
