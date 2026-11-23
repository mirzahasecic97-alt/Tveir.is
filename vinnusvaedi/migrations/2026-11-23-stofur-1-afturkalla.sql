-- ==========================================================================
-- Stofur, afturköllun R1: tekur skref 1 til baka.
--
-- Gildir bara meðan Tveir er eina stofan. Skráin stöðvast strax ef fleiri
-- stofur eru til, ef skref 3 er enn á (skoðanir sem nota stofa_id, frumlyklar
-- með stofa_id) eða ef reikningsdrög hafa verið merkt á verkefni.
-- Stöðvast líka ef skref 2 (samsettu lyklarnir) er enn á: keyrið
-- 2026-11-23-stofur-2-afturkalla.sql á undan, hún setur gömlu lyklana aftur.
--
-- Röð afturkallana: R5, R3, R2, R1. Keyrt sem ein færsla. Má keyra aftur.
-- Á eftir er skemað eins og eftir skref 0 (sannað með samanburði í T0).
-- Gögn í nýju töflunum (stofur, bod, notkun, ...) hverfa með þeim.
-- ==========================================================================

do $$
declare n int;
begin
  if to_regclass('public.stofur') is not null then
    select count(*) into n from public.stofur;
    if n > 1 then
      raise exception 'Fleiri en ein stofa er til (%): R1 gildir bara meðan Tveir er ein. Lokið hinum með stada = lokud í staðinn.', n;
    end if;
  end if;
  -- Skref 3: skoðanir sem vísa í stofa_id
  if exists (select 1 from pg_depend d
               join pg_rewrite w on w.oid = d.objid
               join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
              where d.classid = 'pg_rewrite'::regclass and a.attname = 'stofa_id'
                and w.ev_class <> d.refobjid
                and d.refobjid::regclass::text not like 'afrit_20261123.%') then
    raise exception 'Skoðun notar enn stofa_id: keyrið afturköllun skrefs 3 (R3) fyrst.';
  end if;
  -- Skref 3: frumlyklar með stofa_id
  if exists (select 1 from pg_constraint c
              where c.connamespace = 'public'::regnamespace and c.contype = 'p'
                and c.conrelid::regclass::text in ('kerfisstillingar', 'tengingar', 'dagatal_atburdir')
                and pg_get_constraintdef(c.oid) like '%stofa_id%') then
    raise exception 'Frumlyklar skrefs 3 eru enn á: keyrið afturköllun skrefs 3 (R3) fyrst.';
  end if;
  if exists (select 1 from public.verkefni_innri where reikningur = 'drog') then
    raise exception 'Verkefni eru merkt með reikningsdrögum (reikningur = drog): lagið þau fyrst.';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
               and table_name = 'midlar' and column_name = 'stofa_id')
     and exists (select 1 from public.midlar where midill = 'vefur') then
    raise exception 'Miðlar af gerðinni vefur eru til: eyðið þeim fyrst.';
  end if;
end $$;

-- Skref 2 verður að vera tekið til baka fyrst. Samsettu lyklarnir KOMU Í STAÐ
-- gömlu eins dálks lyklanna; að fella þá hér myndi skilja töflurnar eftir án
-- lykla. 2026-11-23-stofur-2-afturkalla.sql setur gömlu lyklana aftur orðrétt.
do $$
begin
  if exists (select 1 from pg_constraint c
              where c.connamespace = 'public'::regnamespace
                and ((c.contype = 'f' and c.conname like '%\_stofa\_fk')
                     or (c.contype = 'u' and c.conname like '%\_stofa\_id\_uq'))) then
    raise exception 'Skref 2 er enn á: keyrið 2026-11-23-stofur-2-afturkalla.sql fyrst.';
  end if;
end $$;

-- Gikkir og gikkjaföll
do $$
declare t text;
begin
  foreach t in array array['athugasemdir', 'aukaverkefni', 'dagatal_atburdir', 'fundir', 'fyrirspurnir',
    'fyrirtaeki', 'innri_taskar', 'kerfisstillingar', 'maelingar', 'midla_faerslur', 'midlar', 'myndband_tolur',
    'myndbond', 'notendur', 'postholf_skilabod', 'postholf_svor', 'postholf_thraedir', 'samningar', 'skyrslur',
    'snid', 'snid_taskar', 'taskar', 'taxtar', 'tengingar', 'timar', 'tolfraedi_sendingar', 'undirverk',
    'verkefni', 'verkefni_innri', 'vidhengi']
  loop
    execute format('drop trigger if exists %I on public.%I', 'zstofa_' || t, t);
  end loop;
  if to_regclass('public.reikningsdrog') is not null then
    drop trigger if exists zstofa_reikningsdrog on public.reikningsdrog;
  end if;
end $$;
drop function if exists erfa_stofu();
drop function if exists stofa_notanda();
drop function if exists verja_stofu() cascade;        -- gikkurinn á stofur fer með
drop function if exists nytt_verk_netfang() cascade;  -- sama

-- Aðrir dálkar og skorður skrefs 1 (kafli 1.5)
alter table notendur drop constraint if exists notendur_stofa_check;
alter table notendur drop column if exists er_eigandi;
alter table fyrirtaeki drop column if exists kennitala;
alter table fyrirtaeki drop column if exists reikningsnetfang;
alter table fyrirtaeki drop column if exists ytri_numer;
alter table samningar drop column if exists fyrirtaeki_id;
alter table aukaverkefni drop column if exists fyrirtaeki_id;
alter table dagatal_atburdir drop column if exists uppruni;
alter table dagatal_atburdir drop column if exists dagatal_id;
alter table postholf_thraedir drop column if exists uppruni;

-- Gömlu check skorðurnar, úr afritinu ef það er til, annars eins og í gagnagrunnur.sql
do $$
declare r record; d text;
begin
  for r in select * from (values
    ('verkefni_innri', 'verkefni_innri_reikningur_check', $c$CHECK ((reikningur = ANY (ARRAY['ekki_rukkad'::text, 'rukkad'::text, 'greitt'::text])))$c$),
    ('midlar',         'midlar_midill_check',             $c$CHECK ((midill = ANY (ARRAY['instagram'::text, 'facebook'::text, 'tiktok'::text])))$c$)
  ) x (tafla, nafn, sjalfgefid)
  loop
    d := r.sjalfgefid;
    if to_regclass('afrit_20261123.lyklar') is not null then
      select coalesce(max(skilgreining), r.sjalfgefid) into d
        from afrit_20261123.lyklar where tafla = r.tafla and conname = r.nafn;
    end if;
    execute format('alter table public.%I drop constraint if exists %I', r.tafla, r.nafn);
    execute format('alter table public.%I add constraint %I %s', r.tafla, r.nafn, d);
  end loop;
end $$;

-- stofa_id á 30 töflum (vísarnir og lykillinn í stofur fara með dálkinum)
do $$
declare t text;
begin
  foreach t in array array['athugasemdir', 'aukaverkefni', 'dagatal_atburdir', 'fundir', 'fyrirspurnir',
    'fyrirtaeki', 'innri_taskar', 'kerfisstillingar', 'maelingar', 'midla_faerslur', 'midlar', 'myndband_tolur',
    'myndbond', 'notendur', 'postholf_skilabod', 'postholf_svor', 'postholf_thraedir', 'samningar', 'skyrslur',
    'snid', 'snid_taskar', 'taskar', 'taxtar', 'tengingar', 'timar', 'tolfraedi_sendingar', 'undirverk',
    'verkefni', 'verkefni_innri', 'vidhengi']
  loop
    execute format('alter table public.%I drop column if exists stofa_id', t);
  end loop;
end $$;

-- Nýju töflurnar tíu
drop table if exists rekstur_log;
drop table if exists oauth_stada;
drop table if exists skraningar;
drop table if exists notkun;
drop table if exists postur_inn_log;
drop table if exists reikningsdrog;
drop table if exists bod;
drop table if exists vel_lyklar;
drop table if exists verk_netfong;
drop table if exists stofur;

-- Hjálparföllin
drop function if exists min_stofa();
drop function if exists tveir_stofa();
drop function if exists min_stada();
drop function if exists er_rekstraradili();
drop function if exists fyrirtaeki_i_stofu(text);
drop function if exists stofa_heimild(text, text);
drop function if exists i_heimild(uuid, boolean, uuid);
drop function if exists ny_vel_lykill(text, uuid, boolean, text[]);
drop function if exists er_fratekid_slug(text);

-- Nýju lyklarnir í stillingar_innri (þeir sem voru ekki til í skrefi 0)
do $$
declare lyklar text[] := array['tveir_stofa', 'stofa_vara', 'skraning_opin', 'rekstraradilar',
                               'google_tilbuid', 'meta_tilbuid', 'tiktok_tilbuid', 'skilmalar_utgafa'];
begin
  if to_regclass('afrit_20261123.stillingar_innri') is not null then
    execute 'delete from public.stillingar_innri where lykill = any ($1)
               and lykill not in (select a.lykill from afrit_20261123.stillingar_innri a)' using lyklar;
  else
    delete from public.stillingar_innri where lykill = any (lyklar);
  end if;
end $$;

select 'Skref 1 tekið til baka' stada;
