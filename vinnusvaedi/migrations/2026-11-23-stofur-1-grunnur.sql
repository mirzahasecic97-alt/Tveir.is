-- ==========================================================================
-- Stofur, skref 1: grunnurinn. Bætir við, breytir engri hegðun.
--
-- Taflan stofur og Tveir sem fyrsta stofan, nýju töflurnar tíu (verk_netfong,
-- vel_lyklar, bod, reikningsdrog, postur_inn_log, notkun, skraningar,
-- oauth_stada, rekstur_log og stofur sjálf), dálkurinn stofa_id á 30 töflum
-- (allar núverandi línur fá Tveir), hjálparföllin og gikkirnir sem gefa
-- hverri nýrri línu stofu. Tveir sér engan mun.
--
-- Keyrt sem ein færsla (Supabase SQL Editor > New query > líma > Run).
-- 2026-11-23-stofur-0-afrit.sql verður að hafa verið keyrt á undan.
-- Má keyra aftur. Afturköllun: 2026-11-23-stofur-1-afturkalla.sql.
--
-- Röðin hér: töflur, svo dálkar, svo föll, svo gikkir (föllin vísa í nýju
-- dálkana og eru staðfest þegar þau eru búin til).
-- ==========================================================================

do $$ begin
  if to_regclass('afrit_20261123.fjoldi') is null then
    raise exception 'Afritið vantar: keyrið 2026-11-23-stofur-0-afrit.sql fyrst.';
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 1. stofur og Tveir
-- --------------------------------------------------------------------------

-- Frátekin heiti sem engin ný stofa fær (Tveir sjálf er undantekningin í töflunni)
create or replace function er_fratekid_slug(p text) returns boolean
language sql immutable security definer set search_path = public, extensions, pg_temp as $$
  select lower(coalesce(p, '')) = any (array[
    'tveir', 'verk', 'postur', 'admin', 'postmaster', 'abuse', 'noreply', 'no-reply',
    'hjalp', 'support', 'info', 'glerhusid', 'glerhus', 'kerfi', 'api', 'www', 'mail',
    'test', 'prufa', 'rekstur'])
$$;

create table if not exists stofur (
  id                    uuid primary key default gen_random_uuid(),
  nafn                  text not null check (length(nafn) between 1 and 120),
  slug                  text not null unique
                        check (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' and (slug = 'tveir' or not er_fratekid_slug(slug))),
  stada                 text not null default 'virk' check (stada in ('bidur', 'virk', 'lokud')),
  sendir_fra            text not null default 'verk' check (sendir_fra in ('tveir', 'verk')),
  postholf              boolean not null default false,   -- allt pósthólfið samstillt, bara Tveir
  postur_ut_virkt       boolean not null default true,    -- rekstraraðili getur stöðvað útsendan póst
  krefjast_audkenningar boolean not null default true,    -- DMARC, SPF eða DKIM krafist á innsendum pósti
  netfang               text check (netfang ~* '^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$'),   -- Reply-To
  merki_url             text check (merki_url ~ '^https://(wusqvolbwjysnjrfahjy\.supabase\.co/storage/v1/object/public/merki/|tveir\.is/assets/img/)\S+$'),
  litur                 text check (litur ~ '^#[0-9a-fA-F]{6}$'),
  vefur                 text check (vefur ~ '^https://\S+$' and length(vefur) <= 200),
  einingar              jsonb not null default '[]' check (jsonb_typeof(einingar) = 'array'),
  stillingar            jsonb not null default '{}'
                        check (jsonb_typeof(stillingar) = 'object' and length(stillingar::text) <= 4000),
                        -- lyklar: grein, tengingar (úr skráningu), letur
  uppsetning            jsonb not null default '{}',      -- framvinda uppsetningar {stofan,verk,vidskiptavinur,starfsfolk,tengingar,lokid}
  vefform_lykill        text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  skilmalar_utgafa      text check (length(skilmalar_utgafa) <= 40),
  skilmalar_samthykkt   timestamptz,
  stofnandi             uuid,
  stofnad               timestamptz not null default now()
);
alter table stofur enable row level security;

-- Nafn stofunnar fer í boðspóstinn ({{ .Data.stofa_nafn }}) og stjórnandi stofu má
-- breyta því (regla stofur_admin): engar vefslóðir, lén, HTML eða stýristafir.
-- Sama regla og oruggtNafn í edge/stofna-stofu.ts og edge/bjoda-notanda.ts, nema
-- lénið þarf ekki að byrja á orðaskilum (strangara: "Hönnun.is" er líka hafnað).
alter table stofur drop constraint if exists stofur_nafn_oruggt;
alter table stofur add constraint stofur_nafn_oruggt check (
  nafn ~ '\S' and nafn !~ '[[:cntrl:]]'
  and nafn !~* '[<>{}]|://|www\.|[a-z0-9-]+\.(is|com|net|org|io|co|info|xyz|ru|top)\M');

insert into stofur (nafn, slug, stada, sendir_fra, postholf, netfang, merki_url, vefur, skilmalar_utgafa)
values ('Tveir', 'tveir', 'virk', 'tveir', true, 'tveir@tveir.is',
        'https://tveir.is/assets/img/tveir-merki-gegnsaett.png', 'https://tveir.is', 'innra')
on conflict (slug) do nothing;

-- Stillingar kerfisins. tveir_stofa og stofa_vara eru auðkenni Tveir;
-- stofa_vara er varaleið gikkjanna og hverfur í skrefi 5.
insert into stillingar_innri (lykill, gildi)
select x.lykill, x.gildi
  from (values
    ('tveir_stofa',      (select id::text from stofur where slug = 'tveir')),
    ('stofa_vara',       (select id::text from stofur where slug = 'tveir')),
    ('skraning_opin',    'nei'),
    ('rekstraradilar',   (select coalesce(jsonb_agg(n.id order by n.stofnad), '[]'::jsonb)::text
                            from notendur n where lower(n.netfang) = 'tveir@tveir.is')),
    ('google_tilbuid',   'nei'),
    ('meta_tilbuid',     'nei'),
    ('tiktok_tilbuid',   'nei'),
    ('skilmalar_utgafa', '2026-11-24')
  ) x (lykill, gildi)
on conflict (lykill) do nothing;

-- --------------------------------------------------------------------------
-- 2. Nýju töflurnar, allar með RLS. Bara reglur kafla 3.2 í spec.
-- --------------------------------------------------------------------------

-- Netfang til stofu. Nýjar stofur fá <slug>@verk.tveir.is með gikk (neðar).
create table if not exists verk_netfong (
  netfang  text primary key check (netfang = lower(netfang) and netfang ~ '^[a-z0-9.-]+@[a-z0-9.-]+$'),
  stofa_id uuid not null references stofur on delete cascade,
  stofnad  timestamptz not null default now()
);
alter table verk_netfong enable row level security;
insert into verk_netfong (netfang, stofa_id)
select 'verk@tveir.is', id from stofur where slug = 'tveir'
on conflict (netfang) do nothing;

-- Lyklar Apps Script (sha256 af lyklinum, aldrei lykillinn sjálfur)
create table if not exists vel_lyklar (
  id           uuid primary key default gen_random_uuid(),
  heiti        text not null,
  lykill_hash  bytea not null unique,           -- extensions.digest(lykill, 'sha256')
  stofa_id     uuid references stofur,
  allar        boolean not null default false,  -- true = allar stofur með sendir_fra = 'verk', aldrei Tveir
  umfang       text[] not null check (umfang <@ array['postur_inn', 'postur_ut', 'postholf', 'dagatal', 'tolfraedi', 'skyrslur']),
  virkur       boolean not null default true,
  stofnad      timestamptz not null default now(),
  sidast_notad timestamptz,
  check ((allar and stofa_id is null) or (not allar and stofa_id is not null))
);
alter table vel_lyklar enable row level security;
-- Núverandi lykill Tveir skriftarinnar: bara Tveir, öll sex umfangin
insert into vel_lyklar (heiti, lykill_hash, stofa_id, allar, umfang)
select 'Tveir skrift', extensions.digest(i.gildi, 'sha256'), s.id, false,
       array['postur_inn', 'postur_ut', 'postholf', 'dagatal', 'tolfraedi', 'skyrslur']
  from stillingar_innri i, stofur s
 where i.lykill = 'postur_lykill' and s.slug = 'tveir'
   and not exists (select 1 from vel_lyklar where heiti = 'Tveir skrift')
on conflict (lykill_hash) do nothing;

-- Boð
create table if not exists bod (
  id            uuid primary key default gen_random_uuid(),
  stofa_id      uuid not null references stofur on delete cascade,
  netfang       text not null check (netfang = lower(netfang)),
  nafn          text check (length(nafn) <= 120),
  hlutverk      text not null check (hlutverk in ('admin', 'vidskiptavinur')),
  fyrirtaeki_id uuid references fyrirtaeki on delete cascade,
  er_eigandi    boolean not null default false,
  bodid_af      uuid,
  stofnad       timestamptz not null default now(),
  utrunnid      timestamptz not null default now() + interval '14 days',
  notad         timestamptz,
  check (hlutverk = 'admin' or fyrirtaeki_id is not null)
);
alter table bod enable row level security;
create unique index if not exists bod_virkt on bod (netfang) where notad is null;
-- Nafnið í boðinu fer líka í boðspóstinn og verður nafn notandans (sama regla og stofur.nafn)
alter table bod drop constraint if exists bod_nafn_oruggt;
alter table bod add constraint bod_nafn_oruggt check (
  nafn !~ '[[:cntrl:]]'
  and nafn !~* '[<>{}]|://|www\.|[a-z0-9-]+\.(is|com|net|org|io|co|info|xyz|ru|top)\M');

-- Reikningsdrög (Payday og DK)
create table if not exists reikningsdrog (
  id            uuid primary key default gen_random_uuid(),
  stofa_id      uuid not null references stofur,
  veita         text not null check (veita in ('payday', 'dk')),
  uppruni       text not null check (uppruni in ('verkefni', 'samningur', 'aukaverkefni')),
  uppruni_id    uuid not null,
  manudur       date check (manudur = date_trunc('month', manudur)::date),   -- bara samningar
  fyrirtaeki_id uuid references fyrirtaeki on delete set null,
  linur         jsonb not null,
  upphaed       bigint not null,                  -- krónur án vsk
  stada         text not null default 'i_vinnslu' check (stada in ('i_vinnslu', 'drog', 'villa')),
  ytra_id       text,
  ytra_numer    text,
  ytri_slod     text check (ytri_slod ~ '^https://\S+$'),
  villa         text check (length(villa) <= 500),
  stofnandi     uuid,
  stofnad       timestamptz not null default now(),
  uppfaert      timestamptz not null default now()
);
alter table reikningsdrog enable row level security;
create unique index if not exists reikningsdrog_eitt on reikningsdrog
  (stofa_id, veita, uppruni, uppruni_id, coalesce(manudur, date '1900-01-01')) where stada <> 'villa';

-- Hver ákvörðun verk vélarinnar um innsendan póst
create table if not exists postur_inn_log (
  id               bigserial primary key,
  stofa_id         uuid references stofur on delete cascade,   -- null ef stofan fannst ekki
  dags             timestamptz not null default now(),
  fra_hash         text,                                        -- sha256 af lower(sendanda), aldrei netfangið
  nidurstada       text not null check (nidurstada in ('taskur', 'athugasemd', 'othekktur', 'oaudkenndur',
                                                       'stadfesting', 'hamark', 'lokud', 'engin_stofa')),
  fjoldi           int not null default 0,
  stadfesting_slod text check (stadfesting_slod ~ '^https://mail(-settings)?\.google\.com/\S+$')
);
alter table postur_inn_log enable row level security;
create index if not exists postur_inn_log_stofa_dags_idx on postur_inn_log (stofa_id, dags desc);

-- Notkun og þök á stofu á dag
create table if not exists notkun (
  stofa_id uuid not null references stofur on delete cascade,
  dags     date not null default current_date,
  tegund   text not null check (tegund in ('taskar_ur_posti', 'othekktur_postur', 'gervigreind', 'bod', 'skraning')),
  fjoldi   int not null default 0,
  tokn_inn bigint not null default 0,
  tokn_ut  bigint not null default 0,
  primary key (stofa_id, dags, tegund)
);
alter table notkun enable row level security;

-- Hraðatakmörk skráningar (stofna-stofu): bara tætigildi, aldrei IP tala eða netfang
create table if not exists skraningar (
  id           bigserial primary key,
  ip_hash      text not null,
  netfang_hash text,
  dags         timestamptz not null default now()
);
alter table skraningar enable row level security;
create index if not exists skraningar_dags_idx on skraningar (dags);

-- OAuth staða (10 mínútur, eitt skipti)
create table if not exists oauth_stada (
  state_hash text primary key,
  stofa_id   uuid not null references stofur on delete cascade,
  veita      text not null,
  notandi    uuid,
  pkce       text,
  rennur_ut  timestamptz not null,
  notad      boolean not null default false
);
alter table oauth_stada enable row level security;

-- Aðgerðir rekstraraðila
create table if not exists rekstur_log (
  id       bigserial primary key,
  notandi  uuid,
  adgerd   text not null,
  stofa_id uuid references stofur on delete set null,
  gogn     jsonb not null default '{}',
  dags     timestamptz not null default now()
);
alter table rekstur_log enable row level security;

-- Réttindi: ekkert fyrir anon; innskráðir bara það sem reglurnar leyfa;
-- vel_lyklar, skraningar, oauth_stada og rekstur_log bara þjónustan og föllin.
revoke all on stofur, verk_netfong, vel_lyklar, bod, reikningsdrog, postur_inn_log,
              notkun, skraningar, oauth_stada, rekstur_log from anon;
revoke all on vel_lyklar, skraningar, oauth_stada, rekstur_log from authenticated;
revoke all on stofur, verk_netfong, bod, reikningsdrog, postur_inn_log, notkun from authenticated;
grant select, update on stofur to authenticated;
grant select on verk_netfong, bod, reikningsdrog, postur_inn_log, notkun to authenticated;
grant delete on bod to authenticated;
revoke all on sequence postur_inn_log_id_seq, skraningar_id_seq, rekstur_log_id_seq from anon, authenticated;

-- --------------------------------------------------------------------------
-- 3. Dálkurinn stofa_id á 30 töflum. Núverandi línur fá Tveir.
--    Dálkurinn er settur með Tveir sem sjálfgefnu gildi og sjálfgefna gildið
--    svo tekið af: Postgres fyllir línurnar án UPDATE, svo enginn gikkur
--    keyrir (uppfaert helst óbreytt, enginn póstur fer). Bara þegar dálkurinn
--    er nýr; endurkeyrsla snertir engar línur.
-- --------------------------------------------------------------------------
do $$
declare
  t text;
  v uuid := (select id from stofur where slug = 'tveir');
begin
  if v is null then raise exception 'Stofan tveir fannst ekki'; end if;
  foreach t in array array['athugasemdir', 'aukaverkefni', 'dagatal_atburdir', 'fundir', 'fyrirspurnir',
    'fyrirtaeki', 'innri_taskar', 'kerfisstillingar', 'maelingar', 'midla_faerslur', 'midlar', 'myndband_tolur',
    'myndbond', 'notendur', 'postholf_skilabod', 'postholf_svor', 'postholf_thraedir', 'samningar', 'skyrslur',
    'snid', 'snid_taskar', 'taskar', 'taxtar', 'tengingar', 'timar', 'tolfraedi_sendingar', 'undirverk',
    'verkefni', 'verkefni_innri', 'vidhengi']
  loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = t and column_name = 'stofa_id') then
      execute format('alter table public.%I add column stofa_id uuid default %L references public.stofur on delete restrict', t, v);
      execute format('alter table public.%I alter column stofa_id drop default', t);
    end if;
    if t <> 'notendur' then
      execute format('alter table public.%I alter column stofa_id set not null', t);
    end if;
    execute format('create index if not exists %I on public.%I (stofa_id)', t || '_stofa_idx', t);
  end loop;
end $$;

-- Samsettir vísar (kafli 1.4)
create index if not exists taskar_stofa_stada_idx            on taskar (stofa_id, stada);
create index if not exists verkefni_stofa_stada_idx          on verkefni (stofa_id, stada);
create index if not exists fyrirspurnir_stofa_stada_idx      on fyrirspurnir (stofa_id, stada, stofnad desc);
create index if not exists postholf_thraedir_stofa_sidast_idx on postholf_thraedir (stofa_id, sidast desc);
create index if not exists dagatal_atburdir_stofa_byrjar_idx on dagatal_atburdir (stofa_id, byrjar);
create index if not exists fundir_stofa_byrjar_idx           on fundir (stofa_id, byrjar);

-- --------------------------------------------------------------------------
-- 4. Aðrir nýir dálkar og skorður (kafli 1.5, ekki breytingar á frumlyklum)
-- --------------------------------------------------------------------------

-- notendur: eigandi stofunnar; notandi með fyrirtæki verður að vera í stofu
alter table notendur add column if not exists er_eigandi boolean not null default false;
alter table notendur drop constraint if exists notendur_stofa_check;
alter table notendur add constraint notendur_stofa_check check (fyrirtaeki_id is null or stofa_id is not null);

-- fyrirtaeki: kennitala, netfang fyrir reikninga, auðkenni í Payday og DK
alter table fyrirtaeki add column if not exists kennitala text check (kennitala ~ '^[0-9]{10}$');
alter table fyrirtaeki add column if not exists reikningsnetfang text;
alter table fyrirtaeki add column if not exists ytri_numer jsonb not null default '{}';

-- samningar og aukaverkefni: tenging við fyrirtæki. Fyllt eftir nafni (sama
-- stofa, bara þegar nákvæmlega eitt fyrirtæki ber nafnið) þegar dálkurinn er nýr.
-- Textadálkurinn vidskiptavinur er áfram.
do $$
declare t text;
begin
  foreach t in array array['samningar', 'aukaverkefni'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = t and column_name = 'fyrirtaeki_id') then
      execute format('alter table public.%I add column fyrirtaeki_id uuid references public.fyrirtaeki on delete set null', t);
      execute format($u$
        update public.%I x set fyrirtaeki_id = f.id
          from public.fyrirtaeki f
         where x.fyrirtaeki_id is null and f.stofa_id = x.stofa_id
           and lower(f.nafn) = lower(x.vidskiptavinur)
           and (select count(*) from public.fyrirtaeki g
                 where g.stofa_id = x.stofa_id and lower(g.nafn) = lower(x.vidskiptavinur)) = 1 $u$, t);
    end if;
  end loop;
end $$;

-- verkefni_innri: staðan 'drog' (reikningsdrög búin til)
alter table verkefni_innri drop constraint if exists verkefni_innri_reikningur_check;
alter table verkefni_innri add constraint verkefni_innri_reikningur_check
  check (reikningur in ('ekki_rukkad', 'drog', 'rukkad', 'greitt'));

-- dagatal_atburdir: hvaðan atburðurinn kom (Apps Script í dag, Google seinna)
alter table dagatal_atburdir add column if not exists uppruni text not null default 'apps_script'
  check (uppruni in ('apps_script', 'google'));
alter table dagatal_atburdir add column if not exists dagatal_id text;

-- postholf_thraedir: Gmail þráður Tveir eða Verkpóstur annarrar stofu
alter table postholf_thraedir add column if not exists uppruni text not null default 'gmail'
  check (uppruni in ('gmail', 'verk'));

-- midlar: 'vefur' (Google Analytics eign, ytra_id = GA4 auðkenni)
alter table midlar drop constraint if exists midlar_midill_check;
alter table midlar add constraint midlar_midill_check
  check (midill in ('instagram', 'facebook', 'tiktok', 'vefur'));

-- --------------------------------------------------------------------------
-- 5. Hjálparföll (kafli 1.6). er_admin og mitt_fyrirtaeki breytast EKKI hér.
-- --------------------------------------------------------------------------

-- Virk stofa þess sem kallar, eða null (ótengdur notandi, lokuð eða bíðandi stofa)
create or replace function min_stofa() returns uuid
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select n.stofa_id from notendur n join stofur s on s.id = n.stofa_id and s.stada = 'virk'
   where n.id = auth.uid()
$$;

-- Stofa Tveir (bara fyrir definer föll)
create or replace function tveir_stofa() returns uuid
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select gildi::uuid from stillingar_innri where lykill = 'tveir_stofa'
$$;

-- Er sá sem kallar rekstraraðili (stillingar_innri.rekstraradilar)?
create or replace function er_rekstraradili() returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(auth.uid()::text in (select jsonb_array_elements_text(gildi::jsonb)
                                         from stillingar_innri where lykill = 'rekstraradilar'), false)
$$;

-- Hver er ég: fyrir Edge Functions og vefinn. Virkar líka fyrir lokaða og
-- bíðandi stofu (til að sýna skilaboð); er_admin er bara satt í virkri stofu.
-- Skilar alltaf einni línu.
create or replace function min_stada()
returns table (stofa_id uuid, stada text, er_admin boolean, er_eigandi boolean, slug text, nafn text,
               postholf boolean, google_tilbuid boolean, meta_tilbuid boolean, tiktok_tilbuid boolean,
               er_rekstraradili boolean)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select s.id, s.stada,
         coalesce(n.hlutverk = 'admin' and s.stada = 'virk', false),
         coalesce(n.er_eigandi and s.id is not null, false),
         s.slug, s.nafn, coalesce(s.postholf, false),
         exists (select 1 from stillingar_innri i where i.lykill = 'google_tilbuid' and i.gildi = 'ja'),
         exists (select 1 from stillingar_innri i where i.lykill = 'meta_tilbuid' and i.gildi = 'ja'),
         exists (select 1 from stillingar_innri i where i.lykill = 'tiktok_tilbuid' and i.gildi = 'ja'),
         er_rekstraradili()
    from (select auth.uid() uid) a
    left join notendur n on n.id = a.uid
    left join stofur s on s.id = n.stofa_id
$$;

-- Er fyrirtækið (texti úr slóð í geymslu) í minni stofu?
create or replace function fyrirtaeki_i_stofu(p text) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select case when p ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then exists (select 1 from fyrirtaeki where id = p::uuid and stofa_id = min_stofa())
              else false end
$$;

-- Lykill Apps Script: fyrir hvaða stofu talar hann, í þessu umfangi?
-- PostgREST keyrir STABLE föll í færslu sem má bara lesa (líka með POST), og
-- postholf_lykill_ok og manadar_tolur eru STABLE á live. Þá er bara lesið og
-- sidast_notad ekki uppfært (UPDATE myndi stöðva kallið með villu 25006).
-- Slík köll eru því ekki talin: hvorki sidast_notad né notkun má treysta á þau.
-- Allar skriftir Tveir nota sömu línuna (Tveir skrift) og vélin sína: sidast_notad
-- er bara uppfært ef það er eldra en mínúta, og þá framhjá línu sem önnur færsla
-- heldur (skip locked), svo samhliða köll bíði aldrei hvert eftir öðru. sidast_notad
-- segir því "notaður síðustu mínútuna", ekki nákvæman tíma síðasta kalls.
create or replace function stofa_heimild(p_lykill text, p_umfang text)
returns table (stofa_id uuid, allar boolean)
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v_hash bytea := extensions.digest(coalesce(p_lykill, ''), 'sha256');
begin
  if current_setting('transaction_read_only') <> 'on' then
    update vel_lyklar v set sidast_notad = now()
     where v.id in (select x.id from vel_lyklar x
                     where x.lykill_hash = v_hash and x.virkur and p_umfang = any (x.umfang)
                       and (x.sidast_notad is null or x.sidast_notad < now() - interval '1 minute')
                       for update skip locked);
  end if;
  return query
  select v.stofa_id, v.allar from vel_lyklar v
   where v.lykill_hash = v_hash and v.virkur and p_umfang = any (v.umfang);
end $$;

-- Má niðurstaða lykils (h_stofa, h_allar) snerta línur stofunnar p_stofa?
create or replace function i_heimild(h_stofa uuid, h_allar boolean, p_stofa uuid) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select exists (select 1 from stofur s where s.id = p_stofa and s.stada = 'virk'
                 and ((h_allar and s.sendir_fra = 'verk') or (not h_allar and s.id = h_stofa)))
$$;

-- Nýr lykill fyrir Apps Script. Skilar lyklinum einu sinni, geymir bara tætigildið.
-- Bara í SQL Editor (ekkert API hlutverk má kalla það).
create or replace function ny_vel_lykill(p_heiti text, p_stofa uuid, p_allar boolean, p_umfang text[])
returns text
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare k text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into vel_lyklar (heiti, lykill_hash, stofa_id, allar, umfang)
  values (p_heiti, extensions.digest(k, 'sha256'), p_stofa, coalesce(p_allar, false), p_umfang);
  return k;
end $$;

-- --------------------------------------------------------------------------
-- 6. Hvernig lína fær stofu (kafli 1.7)
-- --------------------------------------------------------------------------

-- tg_argv[0] foreldratafla eða '', tg_argv[1] dálkurinn sem vísar í hana,
-- tg_argv[2] '' eða 'tveir_ef_anon', tg_argv[3..] notendadálkar sem verða að
-- vera í sömu stofu. Gildi frá vafranum er alltaf hunsað.
create or replace function erfa_stofu() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  foreldri text := tg_argv[0];
  fk text;
  s uuid;
  i int;
  u uuid;
  hlutverk text := coalesce(auth.role(), '');
begin
  -- UPDATE sem breytir ekki vísuninni í foreldrið: stofan helst (gildi frá
  -- vafranum hunsað). Ekki leitað að foreldrinu, svo uppfærsla sem gikkur gerir
  -- á meðan foreldrinu er eytt (til dæmis stilla_klst á verkefni_innri þegar
  -- verkefni er eytt) gengur eins og áður. Þjónustan og SQL Editor mega færa línu.
  if tg_op = 'UPDATE' and (foreldri = '' or (to_jsonb(new) ->> tg_argv[1]) is not distinct from (to_jsonb(old) ->> tg_argv[1])) then
    if hlutverk not in ('', 'service_role') then
      new.stofa_id := old.stofa_id;
    end if;
    s := new.stofa_id;
  -- a) frá foreldrinu, þegar vísunin er sett
  elsif foreldri <> '' then
    fk := to_jsonb(new) ->> tg_argv[1];
    if fk is not null then
      execute format('select stofa_id from public.%I where id = $1::%s', foreldri,
                     case foreldri when 'postholf_thraedir' then 'text' else 'uuid' end)
         into s using fk;
      if s is null then raise exception 'Tengd lína fannst ekki' using errcode = '23503'; end if;
      new.stofa_id := s;
    elsif tg_op = 'UPDATE' then
      -- vísunin tekin af (til dæmis on delete set null): línan helst í sinni stofu
      if hlutverk not in ('', 'service_role') then
        new.stofa_id := old.stofa_id;
      end if;
      s := new.stofa_id;
    end if;
  end if;
  if s is null then
    if auth.uid() is not null then
      new.stofa_id := min_stofa();                              -- b) stofa innskráðs notanda
    elsif tg_argv[2] = 'tveir_ef_anon' and hlutverk = 'anon' then
      -- Beint frá vafranum (fyrirspurnir_vefur): alltaf Tveir. Definer fall sem
      -- skráir fyrir aðra stofu (skra_fyrirspurn, skref 3) setur fyrst
      -- set_config('glerhus.stofa_rpc', <stofa>, true); anon getur ekki sett þá stillingu.
      if new.stofa_id is null
         or new.stofa_id::text is distinct from nullif(current_setting('glerhus.stofa_rpc', true), '') then
        new.stofa_id := tveir_stofa();                          -- vefform tveir.is (rakning.js)
      end if;
    elsif new.stofa_id is null and hlutverk = 'service_role' and tg_table_name = any (array['fyrirspurnir']) then
      -- d) Þjónustan (Make, Edge Functions) án stofa_id: Tveir, en BARA í töflum sem
      --    slík leið skrifar í í dag: fyrirspurnir (stofna-stofu skráir skráningu sem
      --    fyrirspurn Tveir; Make getur skráð fyrirspurnir Tveir). Allar aðrar töflur
      --    hafna línu án stofu eftir skref 5. Ný leið sem þarf þetta: bætið töflunni
      --    í listann hér (og í prof-stofur.sql 8.21), annars á hún að senda stofa_id.
      new.stofa_id := tveir_stofa();
    elsif new.stofa_id is null then                            -- c) definer fall setti hana, annars varaleið
      new.stofa_id := (select gildi::uuid from stillingar_innri where lykill = 'stofa_vara');   -- fram að skrefi 5
    end if;
  end if;
  if new.stofa_id is null then raise exception 'Línuna vantar stofu' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and old.stofa_id is distinct from new.stofa_id and hlutverk not in ('', 'service_role') then
    raise exception 'Lína færist ekki á milli stofa' using errcode = '42501';
  end if;
  -- f) notendur sem línan vísar í eru í sömu stofu. Við UPDATE bara dálkar sem
  --    breytast (eða ef stofan breytist): þegar notanda er eytt setur hvert
  --    "on delete set null" einn dálk í einu og hinn vísar þá enn í horfinn notanda.
  for i in 3 .. tg_nargs - 1 loop
    continue when tg_op = 'UPDATE' and old.stofa_id is not distinct from new.stofa_id
              and (to_jsonb(new) ->> tg_argv[i]) is not distinct from (to_jsonb(old) ->> tg_argv[i]);
    u := nullif(to_jsonb(new) ->> tg_argv[i], '')::uuid;
    if u is not null and not exists (select 1 from notendur where id = u and stofa_id = new.stofa_id) then
      raise exception 'Notandinn er ekki í þessari stofu' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- notendur: stofu og eiganda breytir enginn í gegnum API nema þjónustan.
-- Innskráður sem býr til notanda (not_admin) gerir það bara í eigin stofu.
-- Nýr notandi án stofu fær stofa_vara (Tveir) fram að skrefi 5, eins og í dag,
-- NEMA hann komi úr nyr_notandi skrefs 3 (glerhus.nyr_notandi = '1'): þá fær hann
-- stofu bara úr boði, strax frá skrefi 3, og annars enga (eins og eftir skref 5).
-- Annars yrði hver sem verður til milli skrefa 3 og 5 án boðs viðskiptavinur Tveir
-- fyrir fullt og allt.
create or replace function stofa_notanda() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare hlutverk text := coalesce(auth.role(), '');
begin
  if tg_op = 'UPDATE' then
    if hlutverk not in ('', 'service_role') then
      new.stofa_id   := old.stofa_id;
      new.er_eigandi := old.er_eigandi;
    end if;
  else
    if hlutverk = 'authenticated' then
      new.stofa_id   := min_stofa();
      new.er_eigandi := false;
    end if;
    if new.stofa_id is null and coalesce(current_setting('glerhus.nyr_notandi', true), '') <> '1' then
      new.stofa_id := (select gildi::uuid from stillingar_innri where lykill = 'stofa_vara');   -- fram að skrefi 5
    end if;
  end if;
  if new.fyrirtaeki_id is not null and not exists (
       select 1 from fyrirtaeki f where f.id = new.fyrirtaeki_id and f.stofa_id = new.stofa_id) then
    raise exception 'Fyrirtækið er ekki í stofu notandans' using errcode = '42501';
  end if;
  return new;
end $$;

-- stofur: stjórnandi stofu má bara breyta nafni, netfangi, merki, lit, vef,
-- einingum, stillingum og uppsetningu. Annað er fest.
create or replace function verja_stofu() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if coalesce(auth.role(), '') not in ('', 'service_role') then
    new.id                    := old.id;
    new.slug                  := old.slug;
    new.stada                 := old.stada;
    new.sendir_fra            := old.sendir_fra;
    new.postholf              := old.postholf;
    new.postur_ut_virkt       := old.postur_ut_virkt;
    new.krefjast_audkenningar := old.krefjast_audkenningar;
    new.vefform_lykill        := old.vefform_lykill;
    new.skilmalar_utgafa      := old.skilmalar_utgafa;
    new.skilmalar_samthykkt   := old.skilmalar_samthykkt;
    new.stofnandi             := old.stofnandi;
    new.stofnad               := old.stofnad;
  end if;
  return new;
end $$;

-- Ný stofa (eða nýtt slug) fær netfangið <slug>@verk.tveir.is. Eldri netföng
-- haldast. Tveir notar verk@tveir.is.
create or replace function nytt_verk_netfang() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if new.slug <> 'tveir' then
    insert into verk_netfong (netfang, stofa_id) values (new.slug || '@verk.tveir.is', new.id)
    on conflict (netfang) do nothing;
  end if;
  return null;
end $$;

drop trigger if exists verja_stofu_trigger on stofur;
create trigger verja_stofu_trigger before update on stofur
  for each row execute function verja_stofu();
drop trigger if exists nytt_verk_netfang_trigger on stofur;
create trigger nytt_verk_netfang_trigger after insert or update of slug on stofur
  for each row execute function nytt_verk_netfang();

drop trigger if exists zstofa_notendur on notendur;
create trigger zstofa_notendur before insert or update on notendur
  for each row execute function stofa_notanda();

-- zstofa_<tafla> keyrir á eftir stilla_*, stimpla_*, verja_* og vernda_* (stafrófsröð)
do $$
declare b record;
begin
  for b in select * from (values
    ('taskar',              $a$'fyrirtaeki', 'fyrirtaeki_id', '', 'abyrgd', 'hofundur'$a$),
    ('verkefni',            $a$'fyrirtaeki', 'fyrirtaeki_id', '', 'hofundur'$a$),
    ('athugasemdir',        $a$'taskar', 'task_id', '', 'hofundur'$a$),
    ('vidhengi',            $a$'taskar', 'task_id', '', 'hofundur'$a$),
    ('undirverk',           $a$'taskar', 'task_id'$a$),
    ('timar',               $a$'verkefni', 'verkefni_id', '', 'notandi'$a$),
    ('verkefni_innri',      $a$'verkefni', 'verkefni_id'$a$),
    ('snid_taskar',         $a$'snid', 'snid_id'$a$),
    ('midlar',              $a$'fyrirtaeki', 'fyrirtaeki_id'$a$),
    ('myndbond',            $a$'fyrirtaeki', 'fyrirtaeki_id'$a$),
    ('skyrslur',            $a$'fyrirtaeki', 'fyrirtaeki_id'$a$),
    ('tolfraedi_sendingar', $a$'fyrirtaeki', 'fyrirtaeki_id'$a$),
    ('samningar',           $a$'fyrirtaeki', 'fyrirtaeki_id'$a$),
    ('aukaverkefni',        $a$'fyrirtaeki', 'fyrirtaeki_id'$a$),
    ('reikningsdrog',       $a$'fyrirtaeki', 'fyrirtaeki_id'$a$),
    ('fundir',              $a$'fyrirtaeki', 'fyrirtaeki_id', '', 'hofundur'$a$),
    ('innri_taskar',        $a$'fyrirtaeki', 'fyrirtaeki_id', '', 'abyrgd', 'hofundur'$a$),
    ('maelingar',           $a$'midlar', 'midill_id'$a$),
    ('midla_faerslur',      $a$'midlar', 'midill_id'$a$),
    ('myndband_tolur',      $a$'myndbond', 'myndband_id'$a$),
    ('postholf_skilabod',   $a$'postholf_thraedir', 'thradur_id'$a$),
    ('postholf_svor',       $a$'postholf_thraedir', 'thradur_id'$a$),
    ('fyrirspurnir',        $a$'', '', 'tveir_ef_anon', 'abyrgd'$a$),
    ('fyrirtaeki',          $a$'', ''$a$),
    ('snid',                $a$'', ''$a$),
    ('kerfisstillingar',    $a$'', ''$a$),
    ('tengingar',           $a$'', ''$a$),
    ('taxtar',              $a$'', ''$a$),
    ('dagatal_atburdir',    $a$'', ''$a$),
    ('postholf_thraedir',   $a$'', ''$a$)
  ) x (tafla, rok)
  loop
    execute format('drop trigger if exists %I on public.%I', 'zstofa_' || b.tafla, b.tafla);
    execute format('create trigger %I before insert or update on public.%I for each row execute function erfa_stofu(%s)',
                   'zstofa_' || b.tafla, b.tafla, b.rok);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 7. Réttindi falla. Supabase gefur anon og authenticated rétt á hverju nýju
--    falli í public; hér er það tekið af og bara það veitt sem spec segir.
-- --------------------------------------------------------------------------
revoke all on function min_stofa(), er_rekstraradili(), min_stada(), fyrirtaeki_i_stofu(text)
  from public, anon, authenticated, service_role;
grant execute on function min_stofa(), er_rekstraradili(), min_stada(), fyrirtaeki_i_stofu(text) to authenticated;

revoke all on function tveir_stofa(), stofa_heimild(text, text), i_heimild(uuid, boolean, uuid),
  ny_vel_lykill(text, uuid, boolean, text[]), erfa_stofu(), stofa_notanda(), verja_stofu(), nytt_verk_netfang()
  from public, anon, authenticated, service_role;

-- er_fratekid_slug er í check skorðu stofur: hver sem uppfærir stofur (stjórnandi
-- í gegnum stofur_admin, þjónustan) verður að mega keyra það. Hreint fall, les ekkert.
revoke all on function er_fratekid_slug(text) from public, anon, authenticated, service_role;
grant execute on function er_fratekid_slug(text) to authenticated, service_role;

-- --------------------------------------------------------------------------
-- 8. Reglur á nýju töflunum (kafli 3.2)
-- --------------------------------------------------------------------------
drop policy if exists stofur_les on stofur;
create policy stofur_les on stofur for select to authenticated
  using (id = (select min_stofa()));
drop policy if exists stofur_admin on stofur;
create policy stofur_admin on stofur for update to authenticated
  using (id = (select min_stofa()) and (select er_admin()))
  with check (id = (select min_stofa()) and (select er_admin()));

drop policy if exists verk_netfong_les on verk_netfong;
create policy verk_netfong_les on verk_netfong for select to authenticated
  using (stofa_id = (select min_stofa()));

drop policy if exists bod_les on bod;
create policy bod_les on bod for select to authenticated
  using (stofa_id = (select min_stofa()) and (select er_admin()));
drop policy if exists bod_eyda on bod;
create policy bod_eyda on bod for delete to authenticated
  using (stofa_id = (select min_stofa()) and (select er_admin()));

drop policy if exists reikningsdrog_les on reikningsdrog;
create policy reikningsdrog_les on reikningsdrog for select to authenticated
  using (stofa_id = (select min_stofa()) and (select er_admin()));

drop policy if exists postur_inn_log_les on postur_inn_log;
create policy postur_inn_log_les on postur_inn_log for select to authenticated
  using (stofa_id = (select min_stofa()) and (select er_admin()));

drop policy if exists notkun_les on notkun;
create policy notkun_les on notkun for select to authenticated
  using (stofa_id = (select min_stofa()) and (select er_admin()));

-- --------------------------------------------------------------------------
-- Staðfesting: stöðvar skrána (og ekkert situr eftir) ef lína er án stofu.
-- Síðasta setningin skilar fjölda notenda án stofu: 0 í dag.
-- --------------------------------------------------------------------------
do $$
declare t text; n bigint; villur text := '';
begin
  foreach t in array array['athugasemdir', 'aukaverkefni', 'dagatal_atburdir', 'fundir', 'fyrirspurnir',
    'fyrirtaeki', 'innri_taskar', 'kerfisstillingar', 'maelingar', 'midla_faerslur', 'midlar', 'myndband_tolur',
    'myndbond', 'postholf_skilabod', 'postholf_svor', 'postholf_thraedir', 'samningar', 'skyrslur',
    'snid', 'snid_taskar', 'taskar', 'taxtar', 'tengingar', 'timar', 'tolfraedi_sendingar', 'undirverk',
    'verkefni', 'verkefni_innri', 'vidhengi']
  loop
    execute format('select count(*) from public.%I where stofa_id is null', t) into n;
    if n > 0 then villur := villur || format('%s: %s; ', t, n); end if;
  end loop;
  if villur <> '' then raise exception 'Línur án stofu: %', villur; end if;
  if (select count(*) from stofur where slug = 'tveir') <> 1 then raise exception 'Stofan tveir er ekki til'; end if;
  if not exists (select 1 from stillingar_innri where lykill = 'tveir_stofa'
                   and gildi = (select id::text from stofur where slug = 'tveir')) then
    raise exception 'tveir_stofa í stillingar_innri passar ekki við stofuna tveir';
  end if;
  -- Án þessarar línu hafnar skref 3 öllum köllum Tveir skriftarinnar
  if exists (select 1 from stillingar_innri where lykill = 'postur_lykill')
     and not exists (select 1 from vel_lyklar v, stillingar_innri i
                      where i.lykill = 'postur_lykill' and v.heiti = 'Tveir skrift' and v.virkur
                        and v.stofa_id = (select id from stofur where slug = 'tveir')
                        and v.lykill_hash = extensions.digest(i.gildi, 'sha256')) then
    raise exception 'vel_lyklar vantar línuna Tveir skrift með tætigildi postur_lykill';
  end if;
end $$;

select (select count(*) from notendur where stofa_id is null) notendur_an_stofu,
       (select count(*) from vel_lyklar) vel_lyklar,
       (select gildi from stillingar_innri where lykill = 'rekstraradilar') rekstraradilar;
