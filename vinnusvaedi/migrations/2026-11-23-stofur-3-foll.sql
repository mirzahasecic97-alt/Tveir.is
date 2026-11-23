-- ==========================================================================
-- Stofur, skref 3: föllin, lyklarnir og skoðanirnar verða stofu-meðvituð
-- (spec kafli 2 skref 3, kafli 3.3 til 3.5, kafli 5.2 og 5.3).
--
-- Undirskriftir sem Apps Script, Edge Functions og vefurinn kalla eru óbreyttar
-- (heiti, rök, sjálfgefin gildi og skilagerð). Tveir skriftin þarf enga breytingu:
-- lykill hennar (vel_lyklar "Tveir skrift") sér bara Tveir, og ný svæði í svörum
-- (stofa, stofa_netfong) eru hunsuð af henni.
--
-- Röðin hér:
--   0. Forsendur og skyndimynd fyrir afturköllun R3
--   1. Frumlyklar kerfisstillingar, dagatal_atburdir og tengingar, og skorður
--   2. Föll sem breytast (öll föll kafla 3.3 eru talin upp neðst í hausnum)
--   3. Ný föll
--   4. tenging_lykill(text) og skra_tengingarprufu(text,text) verða Tveir umbúðir
--   5. Skoðanirnar fjórar sía á stofu
--   6. Sjálfgefin réttindi: nýtt fall er aldrei kallanlegt óvart
--   7. Vörðurinn (kafli 3.5), sami kubbur og í kanna-stofur.sql
--
-- Keyrt sem postgres í SQL Editor, ein færsla. Má keyra aftur. Krefst skrefa 0, 1
-- og 2. Afturköllun: 2026-11-23-stofur-3-afturkalla.sql (gildir fram að skrefi 6).
--
-- Öll föll kafla 3.3 og hvað verður um þau:
--   Breytt hér: afhending_ma_lesa, dagatal_skra, er_admin, eyda_tengingu,
--     lokid_otilkynnt, manadar_tolur, merkja_postholf_svar, merkja_skyrslu_senda,
--     merkja_tilkynnt, merkja_tolfraedi_sendingu, merkja_undirverk_sent,
--     midlar_til_soefnunar, mitt_fyrirtaeki, nyr_notandi, postholf_lykill_ok,
--     postholf_skra, postholf_svor_til, skra_faerslur, skra_maelingar,
--     skra_tengingarprufu(text,text) (umbúðir), skyrslur_til_sendingar,
--     stilla_postholf_svari, stilla_tolfraedi_sendingu, taskur_ur_posti,
--     tenging_lykill(text) (umbúðir), tengingar_stada, tolfraedi_sendingar_til,
--     undirverk_otilkynnt, vekja_postinn, verja_fyrirtaeki, vernda_postholf_thrad,
--     vista_skyrslu, vista_tengingu.
--     stilla_klst: eyðing verkefnis með tímum féll á live (gikkurinn bjó
--     verkefni_innri til aftur fyrir verkefni sem var að hverfa); lagað hér.
--     Úr skrefi 1: verja_stofu (rekstraraðili má breyta stöðu í gegnum föllin sín),
--     réttindi min_stofa og tveir_stofa (skoðanirnar kalla þau sem sá sem les og
--     Make les þær sem service_role: atriði 14 í samtengingarlistanum).
--   Bara réttindi: reikna_framvindu (anon og authenticated tekin af),
--     myndband_ur_faerslu (service_role líka tekið af: bara gikkirnir kalla það).
--   Óbreytt (skoðuð, eiga ekki við eða eru þegar bundin einu fyrirtæki):
--     faera_i_myndbond, faera_maelingar, faera_undirverk,
--     nytt_verkefni_innri, rls_auto_enable, stilla_framvindu, stilla_maelingu,
--     stilla_myndband, stilla_myndbandstolu, stilla_skyrslu, stilla_undirverk,
--     stimpla, tengja_myndband, tolu_gildi, undirverk_skra_opin, vernda_notanda.
--     Föll skrefs 1 (min_stofa, tveir_stofa, min_stada, er_rekstraradili,
--     fyrirtaeki_i_stofu, stofa_heimild, i_heimild, ny_vel_lykill,
--     er_fratekid_slug, erfa_stofu, stofa_notanda, nytt_verk_netfang) eru óbreytt.
--   Ný: stofa_blokk, _bua_til_verk, postur_inn, verk_ur_thraedi, skra_fyrirspurn,
--     stofna_stofu, skra_bod, notandi_til, tengja_notanda_stofu,
--     vista_oauth_tengingu, tenging_lykill(uuid,text),
--     skra_tengingarprufu(uuid,text,text), afhending_slod_heimild, skra_notkun,
--     skra_tokn, stofur_yfirlit, samthykkja_stofu, loka_stofu, opna_stofu,
--     stilla_skraningu, postur_ut, utflutningur_stofu, eyda_stofu_gogn, og
--     gikkurinn verja_task_vidskiptavinar á taskar (R3 fellir hann).
--
-- ALDREI keyra gagnagrunnur.sql eða eldri flutning (fyrir 2026-11-23) aftur eftir
-- þetta skref: þau setja gömlu útgáfur lyklafallanna og nyr_notandi til baka.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 0. Forsendur og skyndimynd
-- --------------------------------------------------------------------------
do $$
begin
  if to_regclass('afrit_20261123.fjoldi') is null then
    raise exception 'Afritið vantar: keyrið 2026-11-23-stofur-0-afrit.sql fyrst.';
  end if;
  if to_regclass('public.stofur') is null or to_regprocedure('public.stofa_heimild(text,text)') is null then
    raise exception 'Keyrið 2026-11-23-stofur-1-grunnur.sql fyrst.';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.taskar'::regclass
                   and conname = 'taskar_fyrirtaeki_id_stofa_fk' and convalidated) then
    raise exception 'Keyrið 2026-11-23-stofur-2-lyklar.sql fyrst.';
  end if;
end $$;

-- Staðan rétt fyrir skref 3, svo R3 skili henni nákvæmlega (líka föllum skrefs 1
-- sem breytast hér). Bara tekin í fyrstu keyrslu; endurkeyrsla breytir henni ekki.
do $$
begin
  if to_regclass('afrit_20261123.skref3_foll') is not null then return; end if;
  create table afrit_20261123.skref3_foll as
    select p.oid::regprocedure::text heiti, pg_get_functiondef(p.oid) skilgreining,
           coalesce(p.proacl, acldefault('f', p.proowner)) rettindi
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
                         and d.objid = p.oid and d.deptype = 'e');
  create table afrit_20261123.skref3_lyklar as
    select conrelid::regclass::text tafla, conname, pg_get_constraintdef(oid) skilgreining, contype::text tegund
      from pg_constraint
     where conrelid in ('public.kerfisstillingar'::regclass, 'public.tengingar'::regclass, 'public.dagatal_atburdir'::regclass)
       and contype in ('p', 'u', 'c');
  create table afrit_20261123.skref3_skodanir as
    select v.viewname, v.definition, c.reloptions valkostir, coalesce(c.relacl, acldefault('r', c.relowner)) rettindi
      from pg_views v
      join pg_class c on c.relname = v.viewname and c.relnamespace = 'public'::regnamespace
     where v.schemaname = 'public';
  create table afrit_20261123.skref3_sjalfgefid as
    select d.defaclrole::regrole::text hlutverk, d.defaclobjtype::text tegund, d.defaclacl rettindi
      from pg_default_acl d
     where d.defaclnamespace = 'public'::regnamespace;
end $$;
revoke all on afrit_20261123.skref3_foll, afrit_20261123.skref3_lyklar, afrit_20261123.skref3_skodanir,
              afrit_20261123.skref3_sjalfgefid from public, anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- 1. Frumlyklar og skorður
-- --------------------------------------------------------------------------
do $$
declare
  t text;
  d record;
  v_nafn text;
begin
  -- Hver frumlykill fær stofa_id fremst (nafnið verður <tafla>_pkey; gamli lykillinn
  -- felldur undir sínu nafni, hvað sem það er á live)
  for d in select * from (values
    ('kerfisstillingar', 'stofa_id, lykill'),
    ('dagatal_atburdir', 'stofa_id, id'),
    ('tengingar',        'stofa_id, veita')
  ) x (tafla, dalkar) loop
    select c.conname into v_nafn from pg_constraint c where c.conrelid = ('public.' || d.tafla)::regclass and c.contype = 'p'
       and pg_get_constraintdef(c.oid) <> format('PRIMARY KEY (%s)', d.dalkar);
    if v_nafn is not null then
      execute format('alter table public.%I drop constraint %I', d.tafla, v_nafn);
    end if;
    if not exists (select 1 from pg_constraint c where c.conrelid = ('public.' || d.tafla)::regclass and c.contype = 'p') then
      execute format('alter table public.%I add constraint %I primary key (%s)', d.tafla, d.tafla || '_pkey', d.dalkar);
    end if;
  end loop;

  select string_agg(distinct veita, ', ') into t from public.tengingar
   where veita not in ('payday', 'dk', 'shopify', 'claude', 'chatgpt', 'google', 'meta', 'tiktok');
  if t is not null then
    raise exception 'Tengingar sem nýja skorðan leyfir ekki: %. Eyðið þeim fyrst.', t;
  end if;
end $$;

alter table tengingar drop constraint if exists tengingar_veita_check;
alter table tengingar add constraint tengingar_veita_check
  check (veita in ('payday', 'dk', 'shopify', 'claude', 'chatgpt', 'google', 'meta', 'tiktok'));

-- Kerfisstillingar (kafli 1.5): sömu nöfn á skorðunum og í skrefi 0
alter table kerfisstillingar drop constraint if exists kerfisstillingar_lykill_check;
alter table kerfisstillingar add constraint kerfisstillingar_lykill_check
  check (lykill in ('gjaldmidill', 'vsk_hlutfall', 'gjalddagi_dagar', 'gervigreind_veita', 'gervigreind_hamark', 'lager_vidvorun'));
alter table kerfisstillingar drop constraint if exists kerfisstillingar_check;
alter table kerfisstillingar add constraint kerfisstillingar_check check (
      (lykill <> 'gjaldmidill' or gildi in ('ISK', 'EUR', 'USD'))
  and (lykill <> 'vsk_hlutfall' or gildi in ('0', '11', '24'))
  and (lykill <> 'gervigreind_veita' or gildi in ('claude', 'chatgpt'))
  and (lykill not in ('gjalddagi_dagar', 'gervigreind_hamark', 'lager_vidvorun') or gildi ~ '^[0-9]{1,4}$'));

-- Ef gömlu skorðurnar heita annað á live sitja þær eftir og hafna nýju gildunum
-- (vsk_hlutfall í stofna_stofu, google í vista_oauth_tengingu). Þá stöðvast skráin hér.
do $$
declare t text;
begin
  select string_agg(c.conrelid::regclass::text || '.' || c.conname, ', ') into t
    from pg_constraint c
   where c.contype = 'c'
     and ((c.conrelid = 'public.kerfisstillingar'::regclass and c.conname not in ('kerfisstillingar_lykill_check', 'kerfisstillingar_check')
           and pg_get_constraintdef(c.oid) ~ 'gjaldmidill')
       or (c.conrelid = 'public.tengingar'::regclass and c.conname <> 'tengingar_veita_check'
           and pg_get_constraintdef(c.oid) ~ 'payday'));
  if t is not null then
    raise exception 'Eldri skorður með öðru nafni eru enn á: %. Fellið þær í þessari skrá áður en hún er keyrð.', t;
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 2. Föll sem breytast
-- --------------------------------------------------------------------------

-- 2a. Hver er ég (kafli 1.6): stjórnandi og fyrirtæki bara í virkri stofu
create or replace function er_admin() returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce((select n.hlutverk = 'admin' from notendur n
                     join stofur s on s.id = n.stofa_id and s.stada = 'virk'
                    where n.id = auth.uid()), false)
$$;

create or replace function mitt_fyrirtaeki() returns uuid
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select n.fyrirtaeki_id from notendur n
   where n.id = auth.uid() and n.stofa_id = min_stofa()
$$;

-- Ekkert fall sem er ekki lyklafall má anon kalla (vörður atriði 4).
-- authenticated og service_role halda því sem þau höfðu í gegnum public.
revoke all on function er_admin(), mitt_fyrirtaeki() from public, anon;
grant execute on function er_admin(), mitt_fyrirtaeki() to authenticated, service_role;
-- reikna_framvindu er definer fall án stofu sem uppfærir verkefni eftir auðkenni:
-- innskráður í annarri stofu gæti breytt framvindu og stöðu verkefnis Tveir. Bara
-- gikkurinn stilla_framvindu kallar það (sem eigandinn), vefurinn aldrei.
revoke all on function reikna_framvindu(uuid) from public, anon, authenticated;
grant execute on function reikna_framvindu(uuid) to service_role;
-- myndband_ur_faerslu athugar ekki sjálft að myndband og færsla séu í sömu stofu
-- (samsetti lykillinn myndband_tolur -> fyrirtaeki stöðvar blöndun). Bara gikkirnir
-- faera_i_myndbond og tengja_myndband kalla það, sem eigandinn: enginn í API.
revoke all on function myndband_ur_faerslu(uuid, uuid) from public, anon, authenticated, service_role;

-- Skoðanirnar (kafli 5 hér neðar) kalla min_stofa og tveir_stofa sem sá sem les,
-- og Make les þær sem service_role.
grant execute on function min_stofa(), tveir_stofa() to authenticated, service_role;

-- Stofublokkin sem fylgir hverju atriði til Apps Script (kafli 5.2)
create or replace function stofa_blokk(p_stofa uuid) returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select jsonb_build_object('nafn', s.nafn, 'slug', s.slug, 'netfang', s.netfang, 'merki_url', s.merki_url,
                            'litur', s.litur, 'vefur', s.vefur, 'kerfi', 'https://tveir.is/glerhus/kerfi/')
    from stofur s where s.id = p_stofa
$$;
revoke all on function stofa_blokk(uuid) from public, anon, authenticated, service_role;

-- 2b. Nýr notandi fær stofu og hlutverk bara úr boði (kafli 3.4)
create or replace function nyr_notandi() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b bod%rowtype;
begin
  select * into b from bod
   where netfang = lower(coalesce(new.email, '')) and notad is null and utrunnid > now()
   order by stofnad desc limit 1;
  -- Án boðs: engin stofa (stofa_notanda notar þá ekki varaleiðina stofa_vara)
  perform set_config('glerhus.nyr_notandi', '1', true);
  insert into notendur (id, netfang, nafn, fyrirtaeki_id, hlutverk, stofa_id, er_eigandi)
  values (new.id, coalesce(new.email, ''),
          coalesce(nullif(left(b.nafn, 120), ''), nullif(left(new.raw_user_meta_data ->> 'nafn', 120), ''),
                   split_part(coalesce(new.email, ''), '@', 1)),
          b.fyrirtaeki_id,
          coalesce(b.hlutverk, 'vidskiptavinur'),   -- aldrei úr metadata
          b.stofa_id,
          coalesce(b.er_eigandi, false))
  on conflict (id) do nothing;
  perform set_config('glerhus.nyr_notandi', '', true);
  if b.id is not null then update bod set notad = now() where id = b.id; end if;
  return new;
end $$;

-- 2c. Gikkir sem verja línur
create or replace function verja_fyrirtaeki() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if er_admin() then return new; end if;
  new.nafn             := old.nafn;
  new.askrift          := old.askrift;
  new.er_askrift       := old.er_askrift;
  new.askrift_verd     := old.askrift_verd;
  new.stofnad          := old.stofnad;
  new.kennitala        := old.kennitala;
  new.reikningsnetfang := old.reikningsnetfang;
  new.ytri_numer       := old.ytri_numer;
  return new;
end $$;

create or replace function vernda_postholf_thrad() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if current_setting('vinnusvaedi.postholf_skrift', true) = '1' then return new; end if;
  if (new.id, new.efni, new.fra_nafn, new.fra_netfang, new.snid, new.sidast, new.fjoldi, new.olesid_gmail, new.tengill,
      new.fyrirtaeki_id, new.stofa_id, new.uppruni)
     is distinct from (old.id, old.efni, old.fra_nafn, old.fra_netfang, old.snid, old.sidast, old.fjoldi, old.olesid_gmail,
      old.tengill, old.fyrirtaeki_id, old.stofa_id, old.uppruni) then
    raise exception 'Bara má merkja þráðinn lesinn';
  end if;
  return new;
end $$;

-- Rekstraraðili breytir stöðu stofu bara í gegnum föllin sín (glerhus.rekstur er
-- sett þar og tekið af strax; enginn API notandi getur sett þá stillingu sjálfur)
create or replace function verja_stofu() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if coalesce(auth.role(), '') not in ('', 'service_role')
     and coalesce(current_setting('glerhus.rekstur', true), '') <> '1' then
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

-- Pósthólfið (svör úr Glerhúsinu fara frá tveir@tveir.is) er bara hjá stofu með postholf
create or replace function stilla_postholf_svari() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare n text; fjoldi int := 0; v_min uuid; v_stofa uuid;
begin
  if not er_admin() then
    raise exception 'Bara stjórnendur senda póst';
  end if;
  v_min := min_stofa();
  -- Þráður sem finnst ekki: lykillinn í þráðinn stöðvar línuna á eftir
  v_stofa := coalesce((select t.stofa_id from postholf_thraedir t where t.id = new.thradur_id), v_min);
  if v_stofa is distinct from v_min
     or not exists (select 1 from stofur s where s.id = v_stofa and s.postholf) then
    raise exception 'Pósthólfið er bara hjá Tveir' using errcode = '42501';
  end if;
  new.sendandi  := auth.uid();
  new.stada     := 'bidur';
  new.villa     := null;
  new.sent_dags := null;
  new.stofnad   := now();
  if new.thradur_id is null then
    new.efni := btrim(regexp_replace(coalesce(new.efni, ''), '[\r\n]+', ' ', 'g'));
    if new.efni = '' then raise exception 'Efnið vantar'; end if;
    new.til := lower(regexp_replace(coalesce(new.til, ''), '\s+', '', 'g'));
    foreach n in array string_to_array(new.til, ',') loop
      continue when n = '';
      if n !~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$' then
        raise exception 'Netfangið % er ekki rétt', n;
      end if;
      fjoldi := fjoldi + 1;
    end loop;
    if fjoldi = 0 or fjoldi > 10 then raise exception 'Settu inn 1 til 10 viðtakendur'; end if;
  end if;
  return new;
end $$;

-- Þessi gikkur keyrir á undan zstofa_, svo stofan er reiknuð hér úr fyrirtækinu
create or replace function stilla_tolfraedi_sendingu() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare n text; v_stofa uuid;
begin
  if not er_admin() then
    raise exception 'Bara stjórnendur senda tölfræði';
  end if;
  v_stofa := (select f.stofa_id from fyrirtaeki f where f.id = new.fyrirtaeki_id);
  if v_stofa is null or v_stofa is distinct from min_stofa() then
    raise exception 'Fyrirtækið er ekki í þinni stofu' using errcode = '42501';
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
         and ((u.fyrirtaeki_id = new.fyrirtaeki_id and u.hlutverk = 'vidskiptavinur')
              or (u.hlutverk = 'admin' and u.stofa_id = v_stofa))
    ) then
      raise exception 'Netfangið % er ekki tengt þessu fyrirtæki', n;
    end if;
  end loop;
  return new;
end $$;

-- Verk viðskiptavinar: hann ræður ekki póstþræðinum, höfundinum né tilkynningunni.
-- Án þessa gæti viðskiptavinur sett postur_thradur og hofundur (annar notandi í
-- stofunni) á eigið verk, og þá færi "lokið" pósturinn úr lokid_otilkynnt til hins
-- og svör í þræðinum yrðu athugasemdir á verkinu. Nafnið raðast á undan zstofa_taskar.
-- Definer leiðir anon (taskur_ur_posti, postur_inn í gegnum _bua_til_verk),
-- service_role, SQL Editor og stjórnendur (verk_ur_thraedi) eru óbreyttar.
create or replace function verja_task_vidskiptavinar() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' or er_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.postur_thradur := null;
    new.tilkynnt_lokid := null;
    new.hofundur       := auth.uid();
  else
    new.postur_thradur := old.postur_thradur;
    new.hofundur       := old.hofundur;
    new.tilkynnt_lokid := old.tilkynnt_lokid;
  end if;
  return new;
end $$;
revoke all on function verja_task_vidskiptavinar() from public, anon, authenticated, service_role;
drop trigger if exists verja_task_vidskiptavinar on taskar;
create trigger verja_task_vidskiptavinar before insert or update on taskar
  for each row execute function verja_task_vidskiptavinar();

-- Tímar: þegar verkefni er eytt eyðast tímarnir með því (on delete cascade) og
-- þessi gikkur bjó þá verkefni_innri til aftur fyrir verkefni sem var að hverfa,
-- svo eyðingin féll (lykilvilla, eða "Tengd lína fannst ekki" úr erfa_stofu). Nú
-- er ekkert gert fyrir verkefni sem er ekki lengur til. Tími sem færist á annað
-- verkefni lagar líka klukkustundir gamla verkefnisins.
create or replace function stilla_klst() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare vid uuid;
begin
  for vid in select distinct x from unnest(array[new.verkefni_id, old.verkefni_id]) x where x is not null loop
    continue when not exists (select 1 from verkefni v where v.id = vid);
    insert into verkefni_innri (verkefni_id) values (vid)
    on conflict (verkefni_id) do nothing;
    update verkefni_innri
       set klst = coalesce((select sum(t.klst) from timar t where t.verkefni_id = vid), 0),
           uppfaert = now()
     where verkefni_id = vid;
  end loop;
  return coalesce(new, old);
end $$;

-- afhending@tveir.is les bara skrár Tveir; aðrar stofur fá hlekki frá afhending-slod
create or replace function afhending_ma_lesa(p_slod text) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select auth.uid() is not null
     and auth.uid()::text = (select gildi from stillingar_innri where lykill = 'afhending_notandi')
     and exists (select 1 from undirverk u join stofur s on s.id = u.stofa_id
                  where u.skra_slod = p_slod and u.lokid and s.sendir_fra = 'tveir')
$$;

-- Vekur rétta póstvél: Tveir skriftina eða Glerhúsið verk
create or replace function vekja_postinn() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_sendir text;
  v_slod   text;
  v_lykill text;
begin
  select s.sendir_fra into v_sendir from stofur s where s.id = new.stofa_id;
  if v_sendir = 'tveir' then
    v_slod   := (select gildi from stillingar_innri where lykill = 'postur_vefkrokur');
    v_lykill := (select gildi from stillingar_innri where lykill = 'postur_lykill');
  elsif v_sendir = 'verk' then
    v_slod   := (select gildi from stillingar_innri where lykill = 'verk_vefkrokur');
    v_lykill := (select gildi from stillingar_innri where lykill = 'verk_vefkrokur_lykill');
  else
    return null;
  end if;
  /* Bara Google vefapp, svo lykillinn fari aldrei annað */
  if v_slod is null or v_lykill is null
     or v_slod !~ '^https://script\.google\.com/(a/macros/[a-z0-9.-]+|macros)/s/[A-Za-z0-9_-]+/exec$' then
    return null;
  end if;
  begin
    perform net.http_post(
      url := v_slod,
      body := jsonb_build_object('lykill', v_lykill),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 30000
    );
  exception when others then
    null;  /* hakið má aldrei mistakast út af póstinum, vaktin nær honum */
  end;
  return null;
end $$;

-- 2d. Tengingar (Vault): ein röð og eitt leyndarmál á stofu og veitu
create or replace function tengingar_stada()
returns table (veita text, stillingar jsonb, sidustu4 text, uppfaert timestamptz, prufad timestamptz, prufa_svar text)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select t.veita, t.stillingar, t.sidustu4, t.uppfaert, t.prufad, t.prufa_svar
    from tengingar t where t.stofa_id = min_stofa() and er_admin()
$$;

create or replace function eyda_tengingu(p_veita text) returns boolean
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_stofa uuid := min_stofa(); v_fyrri uuid;
begin
  if v_stofa is null or not er_admin() then raise exception 'Bara stjórnendur geta aftengt' using errcode = '42501'; end if;
  select t.lykill_id into v_fyrri from tengingar t where t.stofa_id = v_stofa and t.veita = p_veita;
  -- Bara eftir auðkenni, aldrei eftir nafni
  if v_fyrri is not null then delete from vault.secrets where id = v_fyrri; end if;
  delete from tengingar t where t.stofa_id = v_stofa and t.veita = p_veita;
  return true;
end $$;

create or replace function vista_tengingu(p_veita text, p_stillingar jsonb, p_leyndo jsonb) returns boolean
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_stofa uuid := min_stofa(); v_fyrri tengingar%rowtype; k text; v jsonb; v_adal text; v_nytt uuid;
begin
  if v_stofa is null or not er_admin() then raise exception 'Bara stjórnendur geta tengt' using errcode = '42501'; end if;
  -- google, meta og tiktok koma bara í gegnum oauth (vista_oauth_tengingu)
  if p_veita is null or p_veita not in ('payday', 'dk', 'shopify', 'claude', 'chatgpt') then raise exception 'Óþekkt tenging'; end if;
  p_stillingar := coalesce(p_stillingar, '{}'::jsonb);
  if jsonb_typeof(p_stillingar) <> 'object' or length(p_stillingar::text) > 2000 then raise exception 'Of miklar stillingar'; end if;
  if p_veita = 'shopify' and coalesce(p_stillingar->>'verslun', '') !~ '^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$' then
    raise exception 'Verslunin á að vera á forminu nafn.myshopify.com';
  end if;
  if p_veita = 'dk' and ((p_stillingar ? 'vorunumer' and coalesce(p_stillingar->>'vorunumer', '') !~ '^[A-Za-z0-9._-]{1,30}$')
                      or (p_stillingar ? 'solumadur' and coalesce(p_stillingar->>'solumadur', '') !~ '^[A-Za-z0-9._-]{1,30}$')) then
    raise exception 'Vörunúmer og sölumaður mega bara innihalda bókstafi, tölur, punkt og undirstrik (mest 30 stafir)';
  end if;
  if p_veita in ('claude', 'chatgpt') and p_stillingar ? 'likan'
     and coalesce(p_stillingar->>'likan', '') !~ '^[a-z0-9.-]{3,60}$' then
    raise exception 'Líkanið er ekki á réttu formi';
  end if;

  select * into v_fyrri from tengingar t where t.stofa_id = v_stofa and t.veita = p_veita;

  if p_leyndo is not null and p_leyndo <> '{}'::jsonb then
    if jsonb_typeof(p_leyndo) <> 'object' or length(p_leyndo::text) > 8000 then raise exception 'Lykillinn er ekki á réttu formi'; end if;
    for k, v in select * from jsonb_each(p_leyndo) loop
      if jsonb_typeof(v) <> 'string' or length(v #>> '{}') not between 4 and 4000 or (v #>> '{}') ~ '\s' then
        raise exception 'Reiturinn % er ekki gildur lykill', k;
      end if;
    end loop;
    v_adal := coalesce(p_leyndo->>'lykill', p_leyndo->>'clientSecret', p_leyndo->>'token',
                       (select x.value #>> '{}' from jsonb_each(p_leyndo) x limit 1));
    if v_fyrri.lykill_id is not null then
      perform vault.update_secret(v_fyrri.lykill_id, p_leyndo::text);
      v_nytt := v_fyrri.lykill_id;
    else
      -- Nafnið er einkvæmt á stofu; engu leyndarmáli er eytt eftir nafni
      v_nytt := vault.create_secret(p_leyndo::text, 'glerhus_tenging_' || v_stofa || '_' || p_veita, 'Tenging á Stillingar síðunni');
    end if;
    insert into tengingar (stofa_id, veita, stillingar, lykill_id, sidustu4, tengt_af, uppfaert, prufad, prufa_svar)
    values (v_stofa, p_veita, p_stillingar, v_nytt, right(v_adal, 4), auth.uid(), now(), null, null)
    on conflict (stofa_id, veita) do update set stillingar = excluded.stillingar, lykill_id = excluded.lykill_id,
      sidustu4 = excluded.sidustu4, tengt_af = excluded.tengt_af, uppfaert = now(), prufad = null, prufa_svar = null;
  else
    if v_fyrri.veita is null then raise exception 'Það vantar lykilinn'; end if;
    insert into tengingar (stofa_id, veita, stillingar, tengt_af, uppfaert) values (v_stofa, p_veita, p_stillingar, auth.uid(), now())
    on conflict (stofa_id, veita) do update set stillingar = excluded.stillingar, uppfaert = now();
  end if;
  return true;
end $$;

-- 2e. Lyklaföll Apps Script (kafli 5.2). Hvert byrjar á stofa_heimild og hver
--     lestur og skrif er síaður með i_heimild. Tveir lykillinn sér bara Tveir.

-- Tveir lykillinn með umfangið postholf (pósthólfið og svör úr því)
create or replace function postholf_lykill_ok(p_lykill text) returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select exists (select 1 from stofa_heimild(p_lykill, 'postholf') h
                  where not h.allar and h.stofa_id = tveir_stofa() and i_heimild(h.stofa_id, h.allar, h.stofa_id))
$$;

create or replace function dagatal_skra(p_lykill text, p_gogn jsonb, p_fra timestamptz, p_til timestamptz)
returns int language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare a jsonb; n int := 0; v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'dagatal');
  if not found or v_h.allar or not i_heimild(v_h.stofa_id, v_h.allar, v_h.stofa_id) then return -1; end if;
  if jsonb_typeof(p_gogn) <> 'array' or jsonb_array_length(p_gogn) > 1000 then return -2; end if;
  if p_fra is null or p_til is null or p_til <= p_fra or p_til - p_fra > interval '200 days' then return -3; end if;
  -- Bara atburðir þessarar stofu sem komu frá Apps Script
  delete from dagatal_atburdir where stofa_id = v_h.stofa_id and uppruni = 'apps_script' and byrjar >= p_fra and byrjar < p_til;
  delete from dagatal_atburdir where stofa_id = v_h.stofa_id and uppruni = 'apps_script' and byrjar < p_fra - interval '60 days';
  for a in select * from jsonb_array_elements(p_gogn) loop
    continue when coalesce(a->>'id', '') = '' or (a->>'byrjar') is null or (a->>'endar') is null;
    insert into dagatal_atburdir (stofa_id, id, titill, lysing, stadur, byrjar, endar, allan_daginn, tengill, fundarhlekkur, gestir, uppfaert, uppruni)
    values (v_h.stofa_id, left(a->>'id', 300), left(coalesce(a->>'titill', ''), 300), left(a->>'lysing', 2000), left(a->>'stadur', 300),
            (a->>'byrjar')::timestamptz, (a->>'endar')::timestamptz, coalesce((a->>'allan_daginn')::boolean, false),
            case when (a->>'tengill') ~ '^https://\S+$' then left(a->>'tengill', 1000) end,
            case when (a->>'fundarhlekkur') ~ '^https://\S+$' then left(a->>'fundarhlekkur', 1000) end,
            greatest(0, coalesce((a->>'gestir')::int, 0)), now(), 'apps_script')
    on conflict (stofa_id, id) do update set titill = excluded.titill, lysing = excluded.lysing, stadur = excluded.stadur,
      byrjar = excluded.byrjar, endar = excluded.endar, allan_daginn = excluded.allan_daginn, tengill = excluded.tengill,
      fundarhlekkur = excluded.fundarhlekkur, gestir = excluded.gestir, uppfaert = now()
     where dagatal_atburdir.uppruni = 'apps_script';
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function postholf_skra(p_lykill text, p_gogn jsonb, p_eyda_fyrir timestamptz default null)
returns int language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  t jsonb; s jsonb; n int := 0; fyr uuid; elst timestamptz; idir text[]; v_tveir uuid; v_tid text;
begin
  if not postholf_lykill_ok(p_lykill) then return -1; end if;
  if jsonb_typeof(p_gogn) <> 'array' or jsonb_array_length(p_gogn) > 100 then return -2; end if;
  v_tveir := tveir_stofa();
  perform set_config('vinnusvaedi.postholf_skrift', '1', true);
  for t in select * from jsonb_array_elements(p_gogn) loop
    continue when coalesce(t->>'id', '') = '' or (t->>'sidast') is null;
    v_tid := left(t->>'id', 100);
    select u.fyrirtaeki_id into fyr from notendur u
     where lower(u.netfang) = lower(t->>'fra_netfang') and u.hlutverk = 'vidskiptavinur' and u.fyrirtaeki_id is not null
       and u.stofa_id = v_tveir
     limit 1;
    insert into postholf_thraedir (stofa_id, uppruni, id, efni, fra_nafn, fra_netfang, snid, sidast, fjoldi, olesid_gmail, tengill, fyrirtaeki_id, uppfaert)
    values (v_tveir, 'gmail', v_tid, left(coalesce(t->>'efni', ''), 300), left(t->>'fra_nafn', 200), left(lower(t->>'fra_netfang'), 320),
            left(t->>'snid', 500), (t->>'sidast')::timestamptz, greatest(0, coalesce((t->>'fjoldi')::int, 1)),
            coalesce((t->>'olesid')::boolean, false),
            case when (t->>'tengill') ~ '^https://mail\.google\.com/\S+$' then left(t->>'tengill', 500) end, fyr, now())
    on conflict (id) do update set efni = excluded.efni, fra_nafn = excluded.fra_nafn, fra_netfang = excluded.fra_netfang,
      snid = excluded.snid, sidast = excluded.sidast, fjoldi = excluded.fjoldi, olesid_gmail = excluded.olesid_gmail,
      tengill = excluded.tengill, fyrirtaeki_id = excluded.fyrirtaeki_id, uppfaert = now()
     where postholf_thraedir.stofa_id = v_tveir;
    -- Þráður sem er ekki Tveir þráður (getur ekki gerst, auðkenni verk þráða byrja á v:) er látinn vera
    continue when not exists (select 1 from postholf_thraedir x where x.id = v_tid and x.stofa_id = v_tveir);
    idir := array[]::text[]; elst := null;
    for s in select * from jsonb_array_elements(coalesce(t->'skilabod', '[]'::jsonb)) loop
      continue when coalesce(s->>'id', '') = '' or (s->>'dags') is null;
      idir := idir || left(s->>'id', 100);
      elst := least(coalesce(elst, (s->>'dags')::timestamptz), (s->>'dags')::timestamptz);
      insert into postholf_skilabod (stofa_id, id, thradur_id, fra_nafn, fra_netfang, til, dags, texti, fra_okkur, vidhengi, drog)
      values (v_tveir, left(s->>'id', 100), v_tid, left(s->>'fra_nafn', 200), left(lower(s->>'fra_netfang'), 320),
              left(s->>'til', 2000), (s->>'dags')::timestamptz, left(coalesce(s->>'texti', ''), 20000),
              coalesce((s->>'fra_okkur')::boolean, false), greatest(0, coalesce((s->>'vidhengi')::int, 0)),
              coalesce((s->>'drog')::boolean, false))
      on conflict (id) do update set drog = excluded.drog, texti = excluded.texti, dags = excluded.dags
       where postholf_skilabod.stofa_id = v_tveir;
    end loop;
    /* Skilaboð í þræðinum sem Gmail sendi ekki núna (t.d. drög sem urðu að
       sendum pósti eða var hent), innan tímabilsins sem kom inn */
    if elst is not null then
      delete from postholf_skilabod
       where thradur_id = v_tid and stofa_id = v_tveir and dags >= elst and not (id = any(idir));
    end if;
    n := n + 1;
  end loop;
  if p_eyda_fyrir is not null then
    delete from postholf_thraedir where sidast < p_eyda_fyrir and stofa_id = v_tveir and uppruni = 'gmail';
  end if;
  return n;
end $$;

create or replace function postholf_svor_til(p_lykill text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not postholf_lykill_ok(p_lykill) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'thradur_id', s.thradur_id, 'texti', s.texti, 'html', s.html,
                                                       'til', s.til, 'efni', s.efni) order by s.stofnad)
    from (select * from postholf_svor where stada = 'bidur' and stofa_id = tveir_stofa() order by stofnad limit 20) s), '[]'::jsonb);
end $$;

create or replace function merkja_postholf_svar(p_lykill text, p_id uuid, p_villa text default null) returns boolean
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not postholf_lykill_ok(p_lykill) then return false; end if;
  update postholf_svor set stada = case when p_villa is null then 'send' else 'villa' end,
         villa = left(p_villa, 500), sent_dags = case when p_villa is null then now() end
   where id = p_id and stada = 'bidur' and stofa_id = tveir_stofa();
  return found;
end $$;

create or replace function lokid_otilkynnt(p_lykill text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'postur_ut');
  if not found then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'titill', t.titill, 'netfang', n.netfang,
                                        'nafn', n.nafn, 'thradur', t.postur_thradur, 'stofa', stofa_blokk(t.stofa_id)))
      from taskar t
      join notendur n on n.id = t.hofundur and n.stofa_id = t.stofa_id
      join stofur s on s.id = t.stofa_id
     where t.stada = 'lokid'
       and t.lokid_dags is not null
       and n.hlutverk = 'vidskiptavinur'
       and coalesce(n.netfang, '') <> ''
       and (t.tilkynnt_lokid is null or t.tilkynnt_lokid < t.lokid_dags)
       and s.postur_ut_virkt
       and i_heimild(v_h.stofa_id, v_h.allar, t.stofa_id)
  ), '[]'::jsonb);
end $$;

create or replace function merkja_tilkynnt(p_lykill text, p_ids uuid[]) returns int
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare fjoldi int; v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'postur_ut');
  if not found then return 0; end if;
  update taskar t set tilkynnt_lokid = now()
   where t.id = any(p_ids) and t.stada = 'lokid' and i_heimild(v_h.stofa_id, v_h.allar, t.stofa_id);
  get diagnostics fjoldi = row_count;
  return fjoldi;
end $$;

create or replace function undirverk_otilkynnt(p_lykill text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'postur_ut');
  if not found then return '[]'::jsonb; end if;
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
                       and n.stofa_id = t.stofa_id
                       and n.hlutverk = 'vidskiptavinur'
                       and coalesce(n.netfang, '') <> '')),
                 'stofa', stofa_blokk(t.stofa_id)
               ) as x
          from undirverk u
          join taskar t     on t.id = u.task_id
          join fyrirtaeki f on f.id = t.fyrirtaeki_id
          join stofur st    on st.id = t.stofa_id
          left join notendur hof
                 on hof.id = t.hofundur
                and hof.hlutverk = 'vidskiptavinur'
                and hof.fyrirtaeki_id = t.fyrirtaeki_id
                and hof.stofa_id = t.stofa_id
                and coalesce(hof.netfang, '') <> ''
         where u.lokid
           and u.senda
           and u.lokid_dags is not null
           and (u.sent_dags is null or u.sent_dags < u.lokid_dags)
           and st.postur_ut_virkt
           and i_heimild(v_h.stofa_id, v_h.allar, t.stofa_id)
      ) q
     where x->'netfong' is not null and jsonb_array_length(x->'netfong') > 0
  ), '[]'::jsonb);
end $$;

create or replace function merkja_undirverk_sent(p_lykill text, p_ids uuid[]) returns int
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare fjoldi int; v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'postur_ut');
  if not found then return 0; end if;
  update undirverk u set sent_dags = now()
   where u.id = any(p_ids) and u.lokid and i_heimild(v_h.stofa_id, v_h.allar, u.stofa_id);
  get diagnostics fjoldi = row_count;
  return fjoldi;
end $$;

-- Tölfræðisöfnunin (Meta): bara Tveir lykillinn er með umfangið tolfraedi
create or replace function midlar_til_soefnunar(p_lykill text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'tolfraedi');
  if not found or v_h.allar then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'fyrirtaeki_id', m.fyrirtaeki_id,
                                        'fyrirtaeki', f.nafn, 'midill', m.midill,
                                        'nafn', m.nafn, 'ytra_id', m.ytra_id)
                     order by f.nafn, m.midill, m.nafn)
      from midlar m
      join fyrirtaeki f on f.id = m.fyrirtaeki_id
     where m.virkt and m.ytra_id is not null
       and m.stofa_id = v_h.stofa_id and i_heimild(v_h.stofa_id, v_h.allar, m.stofa_id)
  ), '[]'::jsonb);
end $$;

create or replace function skra_maelingar(p_lykill text, p_gogn jsonb) returns int
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  e       jsonb;
  v_dags  date;
  fjoldi  int := 0;
  n       int;
  v_h     record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'tolfraedi');
  if not found then return 0; end if;
  if p_gogn is null or jsonb_typeof(p_gogn) <> 'array' then
    return 0;
  end if;

  for e in select * from jsonb_array_elements(p_gogn) loop
    begin
      continue when jsonb_typeof(e) <> 'object';
      v_dags := (e ->> 'dags')::date;
      continue when v_dags is null or v_dags < date '2000-01-01' or v_dags > current_date + 1;
      -- Engin tala í línunni: ekkert að skrifa
      continue when coalesce(tolu_gildi(e ->> 'fylgjendur'), tolu_gildi(e ->> 'ahorf'),
                             tolu_gildi(e ->> 'nadir'), tolu_gildi(e ->> 'samskipti'),
                             tolu_gildi(e ->> 'heimsoknir'), tolu_gildi(e ->> 'faerslur')) is null;

      insert into maelingar as g (midill_id, fyrirtaeki_id, dags, fylgjendur, ahorf, nadir,
                                  samskipti, heimsoknir, faerslur, uppruni)
      select m.id, m.fyrirtaeki_id, v_dags,
             tolu_gildi(e ->> 'fylgjendur'), tolu_gildi(e ->> 'ahorf'), tolu_gildi(e ->> 'nadir'),
             tolu_gildi(e ->> 'samskipti'), tolu_gildi(e ->> 'heimsoknir'), tolu_gildi(e ->> 'faerslur'),
             'sjalfvirkt'
        from midlar m
       where m.id = (e ->> 'midill_id')::uuid
         and i_heimild(v_h.stofa_id, v_h.allar, m.stofa_id)
      on conflict (midill_id, dags) do update set
        fylgjendur = coalesce(excluded.fylgjendur, g.fylgjendur),
        ahorf      = coalesce(excluded.ahorf,      g.ahorf),
        nadir      = coalesce(excluded.nadir,      g.nadir),
        samskipti  = coalesce(excluded.samskipti,  g.samskipti),
        heimsoknir = coalesce(excluded.heimsoknir, g.heimsoknir),
        faerslur   = coalesce(excluded.faerslur,   g.faerslur),
        uppruni    = 'sjalfvirkt'
      where g.uppruni <> 'handvirkt';
      get diagnostics n = row_count;
      fjoldi := fjoldi + n;
    exception when others then
      null;  -- ein gölluð lína má ekki stöðva hinar
    end;
  end loop;
  return fjoldi;
end $$;

create or replace function skra_faerslur(p_lykill text, p_gogn jsonb) returns int
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  e       jsonb;
  v_ytra  text;
  v_slod  text;
  v_mynd  text;
  v_teg   text;
  fjoldi  int := 0;
  n       int;
  v_h     record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'tolfraedi');
  if not found then return 0; end if;
  if p_gogn is null or jsonb_typeof(p_gogn) <> 'array' then
    return 0;
  end if;

  for e in select * from jsonb_array_elements(p_gogn) loop
    begin
      continue when jsonb_typeof(e) <> 'object';
      v_ytra := nullif(trim(e ->> 'ytra_id'), '');
      continue when v_ytra is null or length(v_ytra) > 100;
      v_slod := trim(e ->> 'slod');
      v_slod := case when v_slod ~ '^https://\S+$' and length(v_slod) <= 2000 then v_slod end;
      v_mynd := trim(e ->> 'mynd_slod');
      v_mynd := case when v_mynd ~ '^https://\S+$' and length(v_mynd) <= 2000 then v_mynd end;
      v_teg  := nullif(trim(e ->> 'tegund'), '');
      if v_teg is not null and v_teg not in ('mynd', 'myndband', 'reel', 'karusell', 'saga', 'annad') then
        v_teg := 'annad';
      end if;

      insert into midla_faerslur as p (midill_id, fyrirtaeki_id, ytra_id, birt, tegund, texti, slod,
                                       mynd_slod, ahorf, nadir, likes, athugasemdir, deilingar, vistanir)
      select m.id, m.fyrirtaeki_id, v_ytra, (e ->> 'birt')::timestamptz, v_teg,
             nullif(left(trim(e ->> 'texti'), 500), ''), v_slod, v_mynd,
             tolu_gildi(e ->> 'ahorf'), tolu_gildi(e ->> 'nadir'), tolu_gildi(e ->> 'likes'),
             tolu_gildi(e ->> 'athugasemdir'), tolu_gildi(e ->> 'deilingar'), tolu_gildi(e ->> 'vistanir')
        from midlar m
       where m.id = (e ->> 'midill_id')::uuid
         and i_heimild(v_h.stofa_id, v_h.allar, m.stofa_id)
      on conflict (midill_id, ytra_id) do update set
        birt         = coalesce(excluded.birt,         p.birt),
        tegund       = coalesce(excluded.tegund,       p.tegund),
        texti        = coalesce(excluded.texti,        p.texti),
        slod         = coalesce(excluded.slod,         p.slod),
        mynd_slod    = coalesce(excluded.mynd_slod,    p.mynd_slod),
        ahorf        = coalesce(excluded.ahorf,        p.ahorf),
        nadir        = coalesce(excluded.nadir,        p.nadir),
        likes        = coalesce(excluded.likes,        p.likes),
        athugasemdir = coalesce(excluded.athugasemdir, p.athugasemdir),
        deilingar    = coalesce(excluded.deilingar,    p.deilingar),
        vistanir     = coalesce(excluded.vistanir,     p.vistanir);
      get diagnostics n = row_count;
      fjoldi := fjoldi + n;
    exception when others then
      null;  -- ein gölluð færsla má ekki stöðva hinar
    end;
  end loop;
  return fjoldi;
end $$;

-- Mánaðarskýrslur: hvert atriði fær stofuna og netföng stjórnenda hennar.
-- STABLE eins og á live: PostgREST keyrir það í read only færslu, svo stofa_heimild
-- skráir hvorki sidast_notad né notkun fyrir það (engin hraðatakmörk héðan; fallið
-- les bara tölur stofu lykilsins). Atriði 22 í samtengingarlistanum.
create or replace function manadar_tolur(p_lykill text, p_manudur date) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare
  m_upphaf date := date_trunc('month', p_manudur)::date;
  m_naesti date := (date_trunc('month', p_manudur) + interval '1 month')::date;
  f_upphaf date := (date_trunc('month', p_manudur) - interval '1 month')::date;
  v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'skyrslur');
  if not found then return '[]'::jsonb; end if;
  if p_manudur is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    with t as (
      select mi.id, mi.fyrirtaeki_id, mi.midill, mi.nafn,
             coalesce(
               (select g.fylgjendur from maelingar g
                 where g.midill_id = mi.id and g.dags < m_upphaf and g.fylgjendur is not null
                 order by g.dags desc limit 1),
               (select g.fylgjendur from maelingar g
                 where g.midill_id = mi.id and g.dags >= m_upphaf and g.dags < m_naesti
                   and g.fylgjendur is not null
                 order by g.dags limit 1)) as fylgjendur_upphaf,
             (select g.fylgjendur from maelingar g
               where g.midill_id = mi.id and g.dags >= m_upphaf and g.dags < m_naesti
                 and g.fylgjendur is not null
               order by g.dags desc limit 1) as fylgjendur_lok,
             s.ahorf, s.nadir, s.samskipti, s.faerslur, s.dagar,
             fy.ahorf as ahorf_fyrri, fy.nadir as nadir_fyrri, fy.samskipti as samskipti_fyrri,
             (select nullif(count(*), 0) from midla_faerslur p
               where p.midill_id = mi.id
                 and (p.birt at time zone 'Atlantic/Reykjavik')::date >= m_upphaf
                 and (p.birt at time zone 'Atlantic/Reykjavik')::date < m_naesti) as birtar,
             (select coalesce(jsonb_agg(jsonb_build_object(
                       'texti', b.texti, 'slod', b.slod, 'mynd_slod', b.mynd_slod,
                       'tegund', b.tegund, 'birt', b.birt, 'ahorf', b.ahorf, 'nadir', b.nadir,
                       'likes', b.likes, 'athugasemdir', b.athugasemdir) order by b.rod), '[]'::jsonb)
                from (select p.*, row_number() over (order by p.ahorf desc nulls last, p.birt desc) as rod
                        from midla_faerslur p
                       where p.midill_id = mi.id
                         and (p.birt at time zone 'Atlantic/Reykjavik')::date >= m_upphaf
                         and (p.birt at time zone 'Atlantic/Reykjavik')::date < m_naesti
                       order by p.ahorf desc nulls last, p.birt desc
                       limit 3) b) as bestu
        from midlar mi
        left join lateral (
          select sum(g.ahorf) as ahorf, sum(g.nadir) as nadir, sum(g.samskipti) as samskipti,
                 sum(g.faerslur) as faerslur,
                 count(*) filter (where coalesce(g.fylgjendur, g.ahorf, g.nadir, g.samskipti,
                                                 g.heimsoknir, g.faerslur) is not null) as dagar
            from maelingar g
           where g.midill_id = mi.id and g.dags >= m_upphaf and g.dags < m_naesti) s on true
        left join lateral (
          select sum(g.ahorf) as ahorf, sum(g.nadir) as nadir, sum(g.samskipti) as samskipti
            from maelingar g
           where g.midill_id = mi.id and g.dags >= f_upphaf and g.dags < m_upphaf) fy on true
       where mi.virkt
         and i_heimild(v_h.stofa_id, v_h.allar, mi.stofa_id)
    ),
    u as (
      select t.*, t.fylgjendur_lok - t.fylgjendur_upphaf as fylgjendur_breyting,
             coalesce(t.faerslur, t.birtar) as faerslur_alls
        from t
    )
    select jsonb_agg(jsonb_build_object(
             'fyrirtaeki_id', f.id, 'fyrirtaeki', f.nafn, 'manudur', m_upphaf,
             'midlar', x.midlar, 'samtals', x.samtals,
             'stofa', stofa_blokk(f.stofa_id),
             'stofa_netfong', coalesce((select jsonb_agg(a.netfang order by a.stofnad, a.id)
                                          from notendur a
                                         where a.stofa_id = f.stofa_id and a.hlutverk = 'admin'
                                           and coalesce(a.netfang, '') <> ''), '[]'::jsonb)) order by f.nafn, f.id)
      from fyrirtaeki f
      join lateral (
        select jsonb_agg(jsonb_build_object(
                 'midill_id', u.id, 'midill', u.midill, 'nafn', u.nafn,
                 'fylgjendur_upphaf', u.fylgjendur_upphaf, 'fylgjendur_lok', u.fylgjendur_lok,
                 'fylgjendur_breyting', u.fylgjendur_breyting,
                 'ahorf', u.ahorf, 'ahorf_fyrri', u.ahorf_fyrri,
                 'nadir', u.nadir, 'nadir_fyrri', u.nadir_fyrri,
                 'samskipti', u.samskipti, 'samskipti_fyrri', u.samskipti_fyrri,
                 'faerslur', u.faerslur_alls, 'dagar_med_gognum', u.dagar,
                 'bestu_faerslur', u.bestu) order by u.midill, u.nafn) as midlar,
               jsonb_build_object(
                 'fylgjendur_lok', sum(u.fylgjendur_lok),
                 'fylgjendur_breyting', sum(u.fylgjendur_breyting),
                 'ahorf', sum(u.ahorf), 'ahorf_fyrri', sum(u.ahorf_fyrri),
                 'nadir', sum(u.nadir), 'nadir_fyrri', sum(u.nadir_fyrri),
                 'samskipti', sum(u.samskipti), 'samskipti_fyrri', sum(u.samskipti_fyrri),
                 'faerslur', sum(u.faerslur_alls)) as samtals
          from u
         where u.fyrirtaeki_id = f.id
      ) x on x.midlar is not null
     where i_heimild(v_h.stofa_id, v_h.allar, f.stofa_id)
  ), '[]'::jsonb);
end $$;

create or replace function vista_skyrslu(p_lykill text, p_fyrirtaeki_id uuid, p_manudur date, p_tolur jsonb, p_samantekt text)
returns uuid language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_id uuid;
  v_manudur date := date_trunc('month', p_manudur)::date;
  v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'skyrslur');
  if not found then return null; end if;
  if v_manudur is null or not exists (select 1 from fyrirtaeki f where f.id = p_fyrirtaeki_id
                                          and i_heimild(v_h.stofa_id, v_h.allar, f.stofa_id)) then
    return null;
  end if;

  insert into skyrslur as s (fyrirtaeki_id, manudur, tolur, samantekt)
  values (p_fyrirtaeki_id, v_manudur, coalesce(p_tolur, '{}'::jsonb),
          nullif(left(trim(coalesce(p_samantekt, '')), 4000), ''))
  on conflict (fyrirtaeki_id, manudur) do update set
    tolur = excluded.tolur,
    samantekt = excluded.samantekt
  where s.stada = 'drog'
  returning s.id into v_id;

  if v_id is null then
    select id into v_id from skyrslur where fyrirtaeki_id = p_fyrirtaeki_id and manudur = v_manudur;
  end if;
  return v_id;
end $$;

create or replace function skyrslur_til_sendingar(p_lykill text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'skyrslur');
  if not found then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'fyrirtaeki_id', s.fyrirtaeki_id, 'fyrirtaeki', f.nafn,
             'manudur', s.manudur, 'tolur', s.tolur, 'samantekt', s.samantekt,
             'netfong', v.netfong, 'nofn', v.nofn, 'stofa', stofa_blokk(s.stofa_id)) order by s.samthykkt_dags, s.id)
      from skyrslur s
      join fyrirtaeki f on f.id = s.fyrirtaeki_id
      join stofur st on st.id = s.stofa_id
      join lateral (
        select jsonb_agg(n.netfang order by n.stofnad, n.id) as netfong,
               jsonb_agg(split_part(trim(n.nafn), ' ', 1) order by n.stofnad, n.id) as nofn
          from notendur n
         where n.fyrirtaeki_id = s.fyrirtaeki_id
           and n.stofa_id = s.stofa_id
           and n.hlutverk = 'vidskiptavinur'
           and coalesce(n.netfang, '') <> ''
      ) v on v.netfong is not null
     where s.stada = 'samthykkt' and s.sent_dags is null
       and st.postur_ut_virkt
       and i_heimild(v_h.stofa_id, v_h.allar, s.stofa_id)
  ), '[]'::jsonb);
end $$;

create or replace function merkja_skyrslu_senda(p_lykill text, p_ids uuid[]) returns int
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare fjoldi int; v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'skyrslur');
  if not found then return 0; end if;
  update skyrslur s set stada = 'send', sent_dags = now()
   where s.id = any(p_ids) and s.stada = 'samthykkt' and i_heimild(v_h.stofa_id, v_h.allar, s.stofa_id);
  get diagnostics fjoldi = row_count;
  return fjoldi;
end $$;

create or replace function tolfraedi_sendingar_til(p_lykill text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'skyrslur');
  if not found then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'netfong', to_jsonb(s.netfong), 'efni', s.efni,
                                        'html', s.html, 'texti', s.texti, 'stofa', stofa_blokk(s.stofa_id)) order by s.stofnad)
      from (select ts.* from tolfraedi_sendingar ts
              join stofur st on st.id = ts.stofa_id
             where ts.stada = 'bidur' and st.postur_ut_virkt
               and i_heimild(v_h.stofa_id, v_h.allar, ts.stofa_id)
             order by ts.stofnad limit 20) s
  ), '[]'::jsonb);
end $$;

create or replace function merkja_tolfraedi_sendingu(p_lykill text, p_id uuid, p_villa text default null) returns boolean
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_h record;
begin
  select * into v_h from stofa_heimild(p_lykill, 'skyrslur');
  if not found then return false; end if;
  update tolfraedi_sendingar s
     set stada = case when p_villa is null then 'send' else 'villa' end,
         villa = left(p_villa, 500),
         sent_dags = case when p_villa is null then now() else null end
   where s.id = p_id and s.stada = 'bidur' and i_heimild(v_h.stofa_id, v_h.allar, s.stofa_id);
  return found;
end $$;

-- --------------------------------------------------------------------------
-- 3. Ný föll
-- --------------------------------------------------------------------------

-- 3a. Listinn í póstinum verður að verkum. Óbreytt meginmál taskur_ur_posti frá
--     live (2026-11-17-listi-lina.sql): sama greining, sama hámark (30), sömu titlar.
create or replace function _bua_til_verk(p_stofa uuid, p_notandi uuid, p_fyrirtaeki uuid,
                                         p_efni text, p_texti text, p_thradur text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  lina    text;
  lidir   text[] := '{}';
  efni    text := left(coalesce(nullif(trim(p_efni), ''), 'Verk úr tölvupósti'), 200);
  texti   text := nullif(left(trim(coalesce(p_texti, '')), 5000), '');
  fjoldi  int := 0;
  lidur   text;
  linur   text[];
  stuttar boolean;
  fyrri   text;
  fj      int;
  undirskrift boolean;
begin
  if p_stofa is null
     or not exists (select 1 from fyrirtaeki f where f.id = p_fyrirtaeki and f.stofa_id = p_stofa)
     or not exists (select 1 from notendur u where u.id = p_notandi and u.stofa_id = p_stofa) then
    raise exception 'Fyrirtækið eða sendandinn er ekki í stofunni' using errcode = '42501';
  end if;

  /* Listi í póstinum (línur sem byrja á -, *, • eða 1. / 1)) verður einn
     taskur á hvern lið. */
  foreach lina in array regexp_split_to_array(coalesce(texti, ''), '\r?\n') loop
    if lina ~ '^\s*([-*•–]|\d{1,2}[.)])\s+\S' then
      lidir := lidir || left(trim(regexp_replace(lina, '^\s*([-*•–]|\d{1,2}[.)])\s+', '')), 200);
    end if;
  end loop;

  /* Enginn listi með merkjum? Þá telst hver lína eitt verk, ef pósturinn er
     bara stuttar línur (til dæmis "hanna logo / laga vefsíðu / finna bolta").
     Kveðja efst, inngangslína sem endar á tvípunkti og undirskrift neðst
     sleppa. Venjulegur póstur með heilum setningum verður áfram eitt verk. */
  if coalesce(array_length(lidir, 1), 0) < 2 then
    linur := '{}';
    stuttar := true;
    undirskrift := false;
    fyrri := '';
    foreach lina in array regexp_split_to_array(coalesce(texti, ''), '\r?\n') loop
      lina := trim(regexp_replace(lina, '[\s\u00a0\u2007\u202f\u200b\ufeff]+', ' ', 'g'));
      continue when lina !~ '[[:alnum:]]';   -- auðar línur og skil eins og ____ eða ---
      fj := coalesce(array_length(linur, 1), 0);

      -- Kveðja eða þakkir: þar byrjar undirskriftin. Efst í póstinum er þeim sleppt.
      if lina ~* '^(kveðja|kveðjur|kv\.?|kær kveðja|kær kv\.?|kærar kveðjur|bestu kveðjur|bestu kv\.?|með kveðju|með bestu kveðju|með bestu kveðjum|mbk\.?|bkv\.?|regards|best regards|kind regards|cheers)([\s,]+[^\s,]+){0,3}[\s,!.]*$'
         or lina ~* '^(takk|takk takk|takk fyrir|takk fyrir mig|takk kærlega|takk kærlega fyrir|kærar þakkir|fyrirfram þakkir|þakka þér fyrir|þakka ykkur fyrir|thanks|thank you)[\s,!.]*$' then
        exit when fj >= 1;
        continue;
      end if;
      exit when lina ~* '^(sent (from|úr|frá) |sendur (úr|frá) |get outlook|sækja outlook)';

      -- Kveðja efst: "Hæ", "Hæ Jón,", "Sæl Anna", "Góðan daginn"
      continue when fj = 0 and (
            lina ~* '^(hæ|hæhæ|hæ hæ|halló|hallo|hi|hello|hey|sæl|sæll|sælir|sælar|sæl öll|sæl og blessuð|sæll og blessaður|góðan dag|góðan daginn|gott kvöld|dear|kæri|kæra|kæru)[\s,!.]*$'
         or lina ~* '^(hæ|hæhæ|halló|hallo|hi|hello|hey|sæl|sæll|sælir|sælar|sæl og blessuð|sæll og blessaður|góðan dag|góðan daginn|dear|kæri|kæra|kæru)(\s+[^\s,!.]+){1,3}\s*[,!]$'
         or lina ~ '^([Hh]æ|[Hh]alló|[Hh]i|[Hh]ello|[Hh]ey|[Ss]æl|[Ss]æll|[Ss]ælir|[Ss]ælar|[Kk]æri|[Kk]æra|[Kk]æru|[Dd]ear)\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s,!.]*(\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s,!.]*)?[.]?$');

      -- Inngangur eins og "Hér eru verkin:"
      continue when lina ~ ':$';

      -- Undirskrift án kveðju: sími, netfang, vefur eða fyrirtæki ein á línu
      if fj >= 1 and (
            lina ~* '^(s\.|sími|gsm|tel\.?|farsími|mobile|m\.)\s*:?\s*\+?[0-9 ()-]{7,}$'
         or lina ~ '^\+?[0-9 ()-]{7,}$'
         or lina ~ '^\S+@\S+$'
         or lina ~* '^(www\.|https?://)\S+$'
         or lina ~ '^\[image'
         or lina ~* '\s(ehf|hf|slf|sf)\.?$') then
        undirskrift := true;
        exit;
      end if;

      -- Setningar, spurningar eða framhald línu: þetta er venjulegur póstur, ekki listi
      if length(lina) > 150
         or lina ~ '[[:alpha:]]{3,}[.]\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])'
         or lina ~ '[!?]\s+[[:alpha:]]'
         or lina ~ '[?]$'
         or lina ~* '^(ég|mér|mig|okkur|við (erum|vorum|viljum|þurfum|ætlum|værum)|það|þetta|hér er|svo|en|og|því|af því|ef|getið|gætuð|gætir|geturðu|getur þú|væri|viljið|vonandi)(\s|,|$)'
         or (lina ~ '^[[:lower:]]' and length(fyrri) >= 60) then
        stuttar := false;
        exit;
      end if;

      linur := linur || left(lina, 200);
      fyrri := lina;
    end loop;

    -- Nafn neðst án kveðju: "Jón Jónsson", eða "Anna" á eftir einni beiðni
    fj := coalesce(array_length(linur, 1), 0);
    -- Fyrir ofan síma eða netfang standa nafn og starfsheiti: þeim er sleppt líka
    if undirskrift then
      while fj >= 1 and linur[fj] ~ '^([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*(\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*){0,2}$' loop
        linur := linur[1:fj - 1];
        fj := fj - 1;
      end loop;
    end if;
    if fj >= 2
       and linur[fj] ~ '^([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*(\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*){0,2}$'
       and (fj = 2 or linur[fj] ~ '\s') then
      linur := linur[1:fj - 1];
      fj := fj - 1;
    end if;

    -- Bara 2 til 15 stuttar línur teljast listi, annað verður eitt verk
    if stuttar and fj between 2 and 15 then
      lidir := linur;
    end if;
  end if;

  if array_length(lidir, 1) >= 2 then
    foreach lidur in array lidir[1:30] loop
      insert into taskar (stofa_id, fyrirtaeki_id, titill, lysing, hofundur, stada, postur_thradur)
      values (p_stofa, p_fyrirtaeki, lidur, 'Úr tölvupósti: ' || efni || coalesce(E'\n\n' || texti, ''), p_notandi, 'nytt', p_thradur);
      fjoldi := fjoldi + 1;
    end loop;
  else
    insert into taskar (stofa_id, fyrirtaeki_id, titill, lysing, hofundur, stada, postur_thradur)
    values (p_stofa, p_fyrirtaeki, efni, texti, p_notandi, 'nytt', p_thradur);
    fjoldi := 1;
  end if;

  return jsonb_build_object('fjoldi', fjoldi,
    'titlar', case when fjoldi > 1 then to_jsonb(lidir[1:30]) else to_jsonb(array[efni]) end);
end $$;
revoke all on function _bua_til_verk(uuid, uuid, uuid, text, text, text) from public, anon, authenticated, service_role;

-- 3b. Tveir skriftin (verk@tveir.is): sama undirskrift og skilagerð og áður, auk 'stofa'
create or replace function taskur_ur_posti(p_lykill text, p_fra text, p_efni text, p_texti text, p_thradur text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_h record;
  v_notandi uuid; v_fyrirtaeki uuid; v_nafn text;
  v_r jsonb;
begin
  select * into v_h from stofa_heimild(p_lykill, 'postur_inn');
  -- Lykill vélarinnar (allar) notar postur_inn, aldrei þetta fall
  if not found or v_h.allar or not i_heimild(v_h.stofa_id, v_h.allar, v_h.stofa_id) then
    return jsonb_build_object('ok', false, 'villa', 'lykill');
  end if;

  select u.id, u.fyrirtaeki_id, u.nafn into v_notandi, v_fyrirtaeki, v_nafn
    from notendur u
   where lower(u.netfang) = lower(trim(p_fra))
     and u.hlutverk = 'vidskiptavinur'
     and u.fyrirtaeki_id is not null
     and u.stofa_id = v_h.stofa_id
   limit 1;
  if v_notandi is null then
    return jsonb_build_object('ok', false, 'villa', 'othekktur');
  end if;

  v_r := _bua_til_verk(v_h.stofa_id, v_notandi, v_fyrirtaeki, p_efni, p_texti, p_thradur);
  return jsonb_build_object('ok', true, 'fjoldi', v_r->'fjoldi', 'nafn', v_nafn, 'titlar', v_r->'titlar',
    'fyrirtaeki', (select nafn from fyrirtaeki where id = v_fyrirtaeki),
    'stofa', stofa_blokk(v_h.stofa_id));
end $$;

-- 3c. Notkun og þök: eykur um einn, skilar false ef þakinu var náð (þá ekki aukið)
create or replace function skra_notkun(p_stofa uuid, p_tegund text, p_hamark int,
                                       p_inn bigint default 0, p_ut bigint default 0)
returns boolean language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v_ok boolean;
begin
  if p_stofa is null or (p_hamark is not null and p_hamark <= 0) then return false; end if;
  insert into notkun as k (stofa_id, dags, tegund, fjoldi, tokn_inn, tokn_ut)
  values (p_stofa, current_date, p_tegund, 1, greatest(coalesce(p_inn, 0), 0), greatest(coalesce(p_ut, 0), 0))
  on conflict (stofa_id, dags, tegund) do update
     set fjoldi = k.fjoldi + 1, tokn_inn = k.tokn_inn + excluded.tokn_inn, tokn_ut = k.tokn_ut + excluded.tokn_ut
   where p_hamark is null or k.fjoldi < p_hamark
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;
revoke all on function skra_notkun(uuid, text, int, bigint, bigint) from public, anon, authenticated, service_role;
grant execute on function skra_notkun(uuid, text, int, bigint, bigint) to service_role;

-- Tákn gervigreindar (edge/gervigreind.ts) lögð við í einni setningu, svo tvö
-- samtímis köll týni ekki tölu hvort annars. Telur ekki kall (fjoldi): það gerir
-- skra_notkun á undan. Stofa sem er ekki til: ekkert gert.
create or replace function skra_tokn(p_stofa uuid, p_tegund text, p_inn bigint, p_ut bigint)
returns void language sql volatile security definer set search_path = public, extensions, pg_temp as $$
  insert into notkun as k (stofa_id, dags, tegund, fjoldi, tokn_inn, tokn_ut)
  select p_stofa, current_date, p_tegund, 0, greatest(coalesce(p_inn, 0), 0), greatest(coalesce(p_ut, 0), 0)
   where p_stofa is not null and exists (select 1 from stofur s where s.id = p_stofa)
  on conflict (stofa_id, dags, tegund) do update
     set tokn_inn = k.tokn_inn + excluded.tokn_inn, tokn_ut = k.tokn_ut + excluded.tokn_ut
$$;
revoke all on function skra_tokn(uuid, text, bigint, bigint) from public, anon, authenticated, service_role;
grant execute on function skra_tokn(uuid, text, bigint, bigint) to service_role;

-- 3d. Póstvélin Glerhúsið verk (kafli 5.3). Lykill vélarinnar (allar) einn.
create or replace function postur_inn(p_lykill text, p_til text, p_fra text, p_fra_nafn text, p_efni text, p_texti text,
                                      p_thradur text, p_audkennt boolean, p_stadfesting text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare
  v_h        record;
  v_stofa    uuid;
  v_slug     text;
  v_krafa    boolean;
  v_fra      text := lower(trim(coalesce(p_fra, '')));
  v_thradur  text := nullif(trim(coalesce(p_thradur, '')), '');
  v_hash     text;
  v_notandi  uuid;
  v_hlutverk text;
  v_fyrirtaeki uuid;
  v_nafn     text;
  v_task     uuid;
  v_klst     bigint;
  v_r        jsonb;
  v_tid      text;
begin
  -- 1. Lykill vélarinnar
  select * into v_h from stofa_heimild(p_lykill, 'postur_inn');
  if not found or not v_h.allar then
    return jsonb_build_object('ok', false, 'villa', 'lykill');
  end if;
  v_hash := case when v_fra <> '' then encode(extensions.digest(v_fra, 'sha256'), 'hex') end;

  -- 2. Stofan eftir netfanginu
  select vn.stofa_id into v_stofa from verk_netfong vn where vn.netfang = lower(trim(coalesce(p_til, '')));
  if v_stofa is null then
    insert into postur_inn_log (stofa_id, fra_hash, nidurstada) values (null, v_hash, 'engin_stofa');
    return jsonb_build_object('ok', false, 'villa', 'engin_stofa');
  end if;
  if not i_heimild(v_h.stofa_id, v_h.allar, v_stofa) then   -- Tveir, lokuð eða bíðandi stofa
    insert into postur_inn_log (stofa_id, fra_hash, nidurstada) values (v_stofa, v_hash, 'lokud');
    return jsonb_build_object('ok', false, 'villa', 'lokud');
  end if;
  select s.slug, s.krefjast_audkenningar into v_slug, v_krafa from stofur s where s.id = v_stofa;

  -- Verkpóstur eldri en 30 daga hverfur
  delete from postholf_thraedir where stofa_id = v_stofa and uppruni = 'verk' and sidast < now() - interval '30 days';

  -- 3. Staðfesting á áframsendingu frá Gmail
  if v_fra = 'forwarding-noreply@google.com' then
    insert into postur_inn_log (stofa_id, fra_hash, nidurstada, stadfesting_slod)
    values (v_stofa, v_hash, 'stadfesting',
            case when p_stadfesting ~ '^https://mail(-settings)?\.google\.com/\S+$' and length(p_stadfesting) <= 2000
                 then p_stadfesting end);
    return jsonb_build_object('ok', true, 'tegund', 'stadfesting');
  end if;

  -- 4. Óauðkenndur póstur: bara tætigildi í loggnum, ekkert efni geymt
  if not coalesce(p_audkennt, false) and v_krafa then
    insert into postur_inn_log (stofa_id, fra_hash, nidurstada) values (v_stofa, v_hash, 'oaudkenndur');
    return jsonb_build_object('ok', false, 'villa', 'oaudkenndur');
  end if;

  -- 5. Svar í þræði sem varð að verki: athugasemd á nýjasta verkinu, ekkert svar sent
  if v_thradur is not null and v_fra <> '' then
    select u.id, u.hlutverk, u.fyrirtaeki_id into v_notandi, v_hlutverk, v_fyrirtaeki
      from notendur u
     where lower(u.netfang) = v_fra and u.stofa_id = v_stofa
     order by (u.hlutverk = 'vidskiptavinur') desc, u.stofnad
     limit 1;
    if v_notandi is not null then
      select t.id into v_task from taskar t
       where t.postur_thradur = v_thradur and t.stofa_id = v_stofa
         and (v_hlutverk = 'admin' or t.fyrirtaeki_id = v_fyrirtaeki)
       order by t.stofnad desc limit 1;
      if v_task is not null then
        insert into athugasemdir (task_id, hofundur, texti)
        values (v_task, v_notandi, left(coalesce(nullif(trim(p_texti), ''), nullif(trim(p_efni), ''), '(Tómur póstur)'), 5000));
        insert into postur_inn_log (stofa_id, fra_hash, nidurstada, fjoldi) values (v_stofa, v_hash, 'athugasemd', 1);
        return jsonb_build_object('ok', true, 'tegund', 'athugasemd');
      end if;
    end if;
  end if;

  -- 6. Skráður viðskiptavinur stofunnar: verk
  v_notandi := null; v_fyrirtaeki := null;
  select u.id, u.fyrirtaeki_id, u.nafn into v_notandi, v_fyrirtaeki, v_nafn
    from notendur u
   where lower(u.netfang) = v_fra and v_fra <> '' and u.stofa_id = v_stofa
     and u.hlutverk = 'vidskiptavinur' and u.fyrirtaeki_id is not null
   order by u.stofnad limit 1;
  if v_notandi is not null then
    -- Mest 100 verk á klukkustund á stofu (talið úr loggnum), og póstarnir taldir í notkun
    select coalesce(sum(l.fjoldi), 0) into v_klst from postur_inn_log l
     where l.stofa_id = v_stofa and l.nidurstada = 'taskur' and l.dags > now() - interval '1 hour';
    if v_klst >= 100 then
      insert into postur_inn_log (stofa_id, fra_hash, nidurstada) values (v_stofa, v_hash, 'hamark');
      return jsonb_build_object('ok', false, 'villa', 'hamark');
    end if;
    if not skra_notkun(v_stofa, 'taskar_ur_posti', 2400) then
      insert into postur_inn_log (stofa_id, fra_hash, nidurstada) values (v_stofa, v_hash, 'hamark');
      return jsonb_build_object('ok', false, 'villa', 'hamark');
    end if;
    v_r := _bua_til_verk(v_stofa, v_notandi, v_fyrirtaeki, p_efni, p_texti, v_thradur);
    insert into postur_inn_log (stofa_id, fra_hash, nidurstada, fjoldi)
    values (v_stofa, v_hash, 'taskur', (v_r->>'fjoldi')::int);
    return jsonb_build_object('ok', true, 'tegund', 'verk', 'fjoldi', v_r->'fjoldi', 'titlar', v_r->'titlar',
      'nafn', v_nafn, 'fyrirtaeki', (select nafn from fyrirtaeki where id = v_fyrirtaeki),
      'stofa', stofa_blokk(v_stofa));
  end if;

  -- 7. Óþekktur en auðkenndur sendandi: Verkpóstur í Samskiptum stofunnar, ekkert svar sent
  if not skra_notkun(v_stofa, 'othekktur_postur', 50) then
    insert into postur_inn_log (stofa_id, fra_hash, nidurstada) values (v_stofa, v_hash, 'hamark');
    return jsonb_build_object('ok', false, 'villa', 'hamark');
  end if;
  v_tid := left('v:' || v_slug || ':' || coalesce(v_thradur, md5(v_fra || '|' || coalesce(p_efni, ''))), 100);
  perform set_config('vinnusvaedi.postholf_skrift', '1', true);
  insert into postholf_thraedir (id, stofa_id, uppruni, efni, fra_nafn, fra_netfang, snid, sidast, fjoldi, olesid_gmail, fyrirtaeki_id, uppfaert)
  values (v_tid, v_stofa, 'verk', left(coalesce(nullif(trim(regexp_replace(coalesce(p_efni, ''), '[\r\n]+', ' ', 'g')), ''), '(Ekkert efni)'), 300),
          left(nullif(trim(p_fra_nafn), ''), 200), left(v_fra, 320),
          left(trim(regexp_replace(coalesce(p_texti, ''), '\s+', ' ', 'g')), 300), now(), 1, false, null, now())
  on conflict (id) do update set efni = excluded.efni, fra_nafn = excluded.fra_nafn, fra_netfang = excluded.fra_netfang,
    snid = excluded.snid, sidast = now(), fjoldi = postholf_thraedir.fjoldi + 1, lesid_kerfi = null, uppfaert = now()
   where postholf_thraedir.stofa_id = v_stofa and postholf_thraedir.uppruni = 'verk';
  if found then
    insert into postholf_skilabod (id, thradur_id, fra_nafn, fra_netfang, dags, texti, fra_okkur)
    values (left('v:' || v_slug || ':' || md5(v_tid || '|' || v_fra || '|' || coalesce(p_efni, '') || '|' || coalesce(p_texti, '')), 100),
            v_tid, left(nullif(trim(p_fra_nafn), ''), 200), left(v_fra, 320), now(), left(coalesce(p_texti, ''), 2000), false)
    on conflict (id) do nothing;
  end if;
  perform set_config('vinnusvaedi.postholf_skrift', '', true);
  insert into postur_inn_log (stofa_id, fra_hash, nidurstada) values (v_stofa, v_hash, 'othekktur');
  return jsonb_build_object('ok', false, 'villa', 'othekktur', 'stofa', stofa_blokk(v_stofa));
end $$;

-- 3e. Verkpóstur verður að verkum (hnappurinn "Búa til verk" í Samskiptum)
create or replace function verk_ur_thraedi(p_thradur_id text, p_fyrirtaeki_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare
  v_stofa uuid := min_stofa();
  v_efni text; v_fra text; v_texti text; v_notandi uuid; v_r jsonb;
begin
  if v_stofa is null or not er_admin() then
    raise exception 'Bara stjórnendur búa til verk úr pósti' using errcode = '42501';
  end if;
  select t.efni, t.fra_netfang into v_efni, v_fra from postholf_thraedir t
   where t.id = p_thradur_id and t.stofa_id = v_stofa and t.uppruni = 'verk';
  if not found then raise exception 'Þráðurinn fannst ekki' using errcode = 'P0002'; end if;
  if not exists (select 1 from fyrirtaeki f where f.id = p_fyrirtaeki_id and f.stofa_id = v_stofa) then
    raise exception 'Fyrirtækið fannst ekki' using errcode = 'P0002';
  end if;
  select s.texti into v_texti from postholf_skilabod s
   where s.thradur_id = p_thradur_id and s.stofa_id = v_stofa order by s.dags desc limit 1;
  -- Höfundur: notandi fyrirtækisins með netfang sendandans, annars stjórnandinn sjálfur
  select u.id into v_notandi from notendur u
   where lower(u.netfang) = lower(v_fra) and u.stofa_id = v_stofa and u.fyrirtaeki_id = p_fyrirtaeki_id
   order by u.stofnad limit 1;
  v_r := _bua_til_verk(v_stofa, coalesce(v_notandi, auth.uid()), p_fyrirtaeki_id, v_efni, v_texti,
                       regexp_replace(p_thradur_id, '^v:[^:]+:', ''));   -- svör í þræðinum verða athugasemdir
  perform set_config('vinnusvaedi.postholf_skrift', '1', true);
  update postholf_thraedir set fyrirtaeki_id = p_fyrirtaeki_id, lesid_kerfi = now()
   where id = p_thradur_id and stofa_id = v_stofa;
  perform set_config('vinnusvaedi.postholf_skrift', '', true);
  return jsonb_build_object('ok', true) || v_r;
end $$;

-- 3f. Vefform annarra stofa (lykillinn vefform_lykill er í forminu á vef stofunnar)
create or replace function skra_fyrirspurn(p_form_lykill text, p_gogn jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare
  g jsonb := coalesce(p_gogn, '{}'::jsonb);
  v_stofa uuid; v_fjoldi bigint; v_fyrsta timestamptz;
begin
  if jsonb_typeof(g) <> 'object' or length(g::text) > 20000 then
    return jsonb_build_object('ok', false, 'villa', 'gogn');
  end if;
  select s.id into v_stofa from stofur s
   where p_form_lykill is not null and s.vefform_lykill = p_form_lykill and s.stada = 'virk';
  if v_stofa is null then return jsonb_build_object('ok', false, 'villa', 'lykill'); end if;
  if coalesce(nullif(trim(g->>'nafn'), ''), nullif(trim(g->>'netfang'), ''), nullif(trim(g->>'simi'), ''),
              nullif(trim(g->>'skilabod'), '')) is null then
    return jsonb_build_object('ok', false, 'villa', 'tomt');
  end if;
  -- Mest 200 á sólarhring á stofu
  select count(*) into v_fjoldi from fyrirspurnir f where f.stofa_id = v_stofa and f.stofnad > now() - interval '1 day';
  if v_fjoldi >= 200 then return jsonb_build_object('ok', false, 'villa', 'hamark'); end if;
  begin
    v_fyrsta := nullif(g->>'fyrsta_heimsokn', '')::timestamptz;
  exception when others then
    v_fyrsta := null;
  end;
  -- erfa_stofu tekur bara við stofunni frá anon ef þessi stilling er sett (bara hér)
  perform set_config('glerhus.stofa_rpc', v_stofa::text, true);
  insert into fyrirspurnir (stofa_id, nafn, netfang, simi, fyrirtaeki_nafn, skilabod, thjonusta, form, gogn,
                            uppruni, sidasti_uppruni, utm_source, utm_medium, utm_campaign, tilvisun, lendingarsida, fyrsta_heimsokn)
  values (v_stofa, left(nullif(trim(g->>'nafn'), ''), 200), left(lower(nullif(trim(g->>'netfang'), '')), 200),
          left(nullif(trim(g->>'simi'), ''), 60), left(nullif(trim(g->>'fyrirtaeki_nafn'), ''), 200),
          left(nullif(trim(g->>'skilabod'), ''), 5000), left(nullif(trim(g->>'thjonusta'), ''), 500),
          left(nullif(trim(g->>'form'), ''), 200),
          case when jsonb_typeof(g->'gogn') = 'object' and length((g->'gogn')::text) <= 10000 then g->'gogn' end,
          left(nullif(trim(g->>'uppruni'), ''), 60), left(nullif(trim(g->>'sidasti_uppruni'), ''), 60),
          left(nullif(trim(g->>'utm_source'), ''), 200), left(nullif(trim(g->>'utm_medium'), ''), 200),
          left(nullif(trim(g->>'utm_campaign'), ''), 200), left(nullif(trim(g->>'tilvisun'), ''), 500),
          left(nullif(trim(g->>'lendingarsida'), ''), 500), v_fyrsta);
  perform set_config('glerhus.stofa_rpc', '', true);
  return jsonb_build_object('ok', true);
end $$;

-- 3g. Skráning og boð (Edge Functions stofna-stofu, bjoda-notanda, rekstur)
create or replace function stofna_stofu(p_nafn text, p_slug text, p_netfang text, p_nafn_eiganda text,
                                        p_stillingar jsonb, p_stada text, p_skilmalar text)
returns uuid language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v uuid; v_netfang text := lower(trim(coalesce(p_netfang, '')));
begin
  if p_stada is null or p_stada not in ('bidur', 'virk') then raise exception 'Staðan á að vera bidur eða virk'; end if;
  if v_netfang !~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$' then raise exception 'Netfangið er ekki rétt'; end if;
  insert into stofur (nafn, slug, stada, sendir_fra, netfang, stillingar, skilmalar_utgafa, skilmalar_samthykkt)
  values (left(trim(coalesce(p_nafn, '')), 120), lower(trim(coalesce(p_slug, ''))), p_stada, 'verk', v_netfang,
          coalesce(p_stillingar, '{}'::jsonb), left(p_skilmalar, 40), case when p_skilmalar is not null then now() end)
  returning id into v;

  insert into kerfisstillingar (stofa_id, lykill, gildi) values (v, 'gjaldmidill', 'ISK'), (v, 'vsk_hlutfall', '24');

  -- Sniðin þrjú úr gagnagrunnur.sql (kafli 10 þar), afrituð
  insert into snid (stofa_id, nafn, lysing) values
    (v, 'Ný vefsíða', 'Fimm undirsíður, form og tenging við lén'),
    (v, 'Efnispakki mánaðar', 'Tökudagur, klipping og færslur'),
    (v, 'Vörumerki', 'Merki, litir, letur og leiðbeiningar');
  insert into snid_taskar (snid_id, titill, lysing, rod, a_hverjum, forgangur)
  select s.id, x.titill, x.lysing, x.rod, x.a_hverjum, x.forgangur
    from snid s
    join (values
      ('Ný vefsíða', 'Senda logo í vektor', 'Við þurfum .ai eða .svg skrá, png dugar ekki í prentun.', 1, 'vidskiptavinur', 'hatt'),
      ('Ný vefsíða', 'Senda myndir af vörum eða starfsemi', null, 2, 'vidskiptavinur', 'venjulegt'),
      ('Ný vefsíða', 'Skrifa texta á Um okkur', 'Fjórar til fimm línur. Við getum skrifað hann ef þú vilt.', 3, 'vidskiptavinur', 'venjulegt'),
      ('Ný vefsíða', 'Setja upp grunn og útlit', null, 4, 'tveir', 'venjulegt'),
      ('Ný vefsíða', 'Undirsíður og efni', null, 5, 'tveir', 'venjulegt'),
      ('Ný vefsíða', 'Form og tenging við póst', null, 6, 'tveir', 'venjulegt'),
      ('Ný vefsíða', 'Leitarvélar, sitemap og lýsingar', null, 7, 'tveir', 'venjulegt'),
      ('Ný vefsíða', 'Yfirferð með viðskiptavin', null, 8, 'vidskiptavinur', 'hatt'),
      ('Ný vefsíða', 'Tengja lén og setja í loftið', null, 9, 'tveir', 'hatt'),
      ('Efnispakki mánaðar', 'Velja tökudag', null, 1, 'vidskiptavinur', 'hatt'),
      ('Efnispakki mánaðar', 'Senda okkur áherslur mánaðarins', 'Tilboð, nýjar vörur eða viðburðir sem við eigum að ýta á.', 2, 'vidskiptavinur', 'venjulegt'),
      ('Efnispakki mánaðar', 'Tökur', null, 3, 'tveir', 'venjulegt'),
      ('Efnispakki mánaðar', 'Klipping', null, 4, 'tveir', 'venjulegt'),
      ('Efnispakki mánaðar', 'Yfirferð á efni', null, 5, 'vidskiptavinur', 'venjulegt'),
      ('Efnispakki mánaðar', 'Birting', null, 6, 'tveir', 'venjulegt'),
      ('Vörumerki', 'Samtal um hvað vörumerkið á að segja', null, 1, 'vidskiptavinur', 'hatt'),
      ('Vörumerki', 'Senda okkur það sem er til nú þegar', 'Gamalt merki, litir, myndir, hvað sem er.', 2, 'vidskiptavinur', 'venjulegt'),
      ('Vörumerki', 'Fyrstu tillögur', null, 3, 'tveir', 'venjulegt'),
      ('Vörumerki', 'Val á leið', null, 4, 'vidskiptavinur', 'hatt'),
      ('Vörumerki', 'Fullvinnsla og skilaskrár', null, 5, 'tveir', 'venjulegt'),
      ('Vörumerki', 'Leiðbeiningar til að fara eftir', null, 6, 'tveir', 'venjulegt')
    ) as x (snid, titill, lysing, rod, a_hverjum, forgangur) on x.snid = s.nafn
   where s.stofa_id = v;

  -- Boð eigandans (stjórnandi og eigandi). Rekstur sendir það þegar stofan er samþykkt.
  insert into bod (stofa_id, netfang, nafn, hlutverk, er_eigandi)
  values (v, v_netfang, left(nullif(trim(p_nafn_eiganda), ''), 120), 'admin', true);
  return v;
end $$;

create or replace function skra_bod(p_stofa uuid, p_netfang text, p_nafn text, p_hlutverk text,
                                    p_fyrirtaeki uuid, p_bodid_af uuid, p_eigandi boolean default false)
returns uuid language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v uuid; v_netfang text := lower(trim(coalesce(p_netfang, ''))); v_fjoldi bigint;
begin
  if not exists (select 1 from stofur s where s.id = p_stofa) then raise exception 'Stofan fannst ekki' using errcode = 'P0002'; end if;
  if v_netfang !~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$' then raise exception 'Netfangið er ekki rétt'; end if;
  if p_hlutverk is null or p_hlutverk not in ('admin', 'vidskiptavinur') then raise exception 'Óþekkt hlutverk'; end if;
  if p_hlutverk = 'vidskiptavinur' and (p_fyrirtaeki is null or not exists (
       select 1 from fyrirtaeki f where f.id = p_fyrirtaeki and f.stofa_id = p_stofa)) then
    raise exception 'Fyrirtækið er ekki í stofunni' using errcode = '42501';
  end if;
  select count(*) into v_fjoldi from bod b where b.stofa_id = p_stofa and b.stofnad > now() - interval '1 day';
  if v_fjoldi >= 50 then raise exception 'Hámarkinu er náð: 50 boð á dag' using errcode = '54000'; end if;
  insert into bod (stofa_id, netfang, nafn, hlutverk, fyrirtaeki_id, er_eigandi, bodid_af)
  values (p_stofa, v_netfang, left(nullif(trim(p_nafn), ''), 120), p_hlutverk,
          case when p_hlutverk = 'vidskiptavinur' then p_fyrirtaeki end,
          coalesce(p_eigandi, false) and p_hlutverk = 'admin', p_bodid_af)
  returning id into v;
  return v;
end $$;

create or replace function notandi_til(p_netfang text) returns table (id uuid, stofa_id uuid)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select u.id, n.stofa_id
    from auth.users u left join notendur n on n.id = u.id
   where lower(u.email) = lower(trim(coalesce(p_netfang, '')))
   order by u.created_at limit 1
$$;

create or replace function tengja_notanda_stofu(p_notandi uuid, p_stofa uuid, p_hlutverk text, p_fyrirtaeki uuid)
returns boolean language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
begin
  if not exists (select 1 from stofur s where s.id = p_stofa) then raise exception 'Stofan fannst ekki' using errcode = 'P0002'; end if;
  if p_hlutverk is null or p_hlutverk not in ('admin', 'vidskiptavinur') then raise exception 'Óþekkt hlutverk'; end if;
  if p_hlutverk = 'vidskiptavinur' and (p_fyrirtaeki is null or not exists (
       select 1 from fyrirtaeki f where f.id = p_fyrirtaeki and f.stofa_id = p_stofa)) then
    raise exception 'Fyrirtækið er ekki í stofunni' using errcode = '42501';
  end if;
  update notendur set stofa_id = p_stofa, hlutverk = p_hlutverk,
                      fyrirtaeki_id = case when p_hlutverk = 'vidskiptavinur' then p_fyrirtaeki end
   where id = p_notandi and stofa_id is null;
  if not found then raise exception 'Notandinn fannst ekki eða er þegar í stofu' using errcode = 'P0002'; end if;
  return true;
end $$;

-- 3h. Tengingar fyrir Edge Functions (service_role)
create or replace function tenging_lykill(p_stofa uuid, p_veita text) returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select d.decrypted_secret::jsonb
    from tengingar t join vault.decrypted_secrets d on d.id = t.lykill_id
   where t.stofa_id = p_stofa and t.veita = p_veita
$$;

create or replace function skra_tengingarprufu(p_stofa uuid, p_veita text, p_svar text) returns void
language sql volatile security definer set search_path = public, extensions, pg_temp as $$
  update tengingar set prufad = now(), prufa_svar = left(p_svar, 300) where stofa_id = p_stofa and veita = p_veita
$$;

create or replace function vista_oauth_tengingu(p_stofa uuid, p_veita text, p_stillingar jsonb, p_leyndo jsonb)
returns boolean language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v_fyrri tengingar%rowtype; k text; v jsonb; v_adal text; v_nytt uuid;
begin
  if p_veita is null or p_veita not in ('google', 'meta', 'tiktok', 'shopify') then raise exception 'Óþekkt tenging'; end if;
  if not exists (select 1 from stofur s where s.id = p_stofa) then raise exception 'Stofan fannst ekki' using errcode = 'P0002'; end if;
  p_stillingar := coalesce(p_stillingar, '{}'::jsonb);
  if jsonb_typeof(p_stillingar) <> 'object' or length(p_stillingar::text) > 2000 then raise exception 'Of miklar stillingar'; end if;
  if p_veita = 'shopify' and coalesce(p_stillingar->>'verslun', '') !~ '^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$' then
    raise exception 'Verslunin á að vera á forminu nafn.myshopify.com';
  end if;
  if p_leyndo is null or jsonb_typeof(p_leyndo) <> 'object' or p_leyndo = '{}'::jsonb or length(p_leyndo::text) > 8000 then
    raise exception 'Lykillinn er ekki á réttu formi';
  end if;
  for k, v in select * from jsonb_each(p_leyndo) loop
    if jsonb_typeof(v) <> 'string' or length(v #>> '{}') not between 4 and 4000 or (v #>> '{}') ~ '\s' then
      raise exception 'Reiturinn % er ekki gildur lykill', k;
    end if;
  end loop;
  v_adal := coalesce(p_leyndo->>'access_token', p_leyndo->>'refresh_token',
                     (select x.value #>> '{}' from jsonb_each(p_leyndo) x limit 1));
  select * into v_fyrri from tengingar t where t.stofa_id = p_stofa and t.veita = p_veita;
  if v_fyrri.lykill_id is not null then
    perform vault.update_secret(v_fyrri.lykill_id, p_leyndo::text);
    v_nytt := v_fyrri.lykill_id;
  else
    v_nytt := vault.create_secret(p_leyndo::text, 'glerhus_tenging_' || p_stofa || '_' || p_veita, 'Tenging (OAuth)');
  end if;
  insert into tengingar (stofa_id, veita, stillingar, lykill_id, sidustu4, tengt_af, uppfaert, prufad, prufa_svar)
  values (p_stofa, p_veita, p_stillingar, v_nytt, right(v_adal, 4), null, now(), null, null)
  on conflict (stofa_id, veita) do update set stillingar = excluded.stillingar, lykill_id = excluded.lykill_id,
    sidustu4 = excluded.sidustu4, uppfaert = now(), prufad = null, prufa_svar = null;
  return true;
end $$;

-- 3i. Skrá til afhendingar (Edge Function afhending-slod kallar sem anon með lykli vélarinnar)
create or replace function afhending_slod_heimild(p_lykill text, p_undirverk uuid) returns text
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v_h record; v_slod text;
begin
  select * into v_h from stofa_heimild(p_lykill, 'postur_ut');
  if not found then return null; end if;
  select u.skra_slod into v_slod
    from undirverk u join stofur s on s.id = u.stofa_id
   where u.id = p_undirverk and u.lokid and u.senda and u.skra_slod is not null
     and s.postur_ut_virkt and i_heimild(v_h.stofa_id, v_h.allar, u.stofa_id);
  return v_slod;
end $$;

-- 3j. Rekstraraðili (kafli 1.2 D15): bara lýsigögn og fjöldi, hver aðgerð skráð í rekstur_log
create or replace function stofur_yfirlit()
returns table (id uuid, slug text, nafn text, stada text, sendir_fra text, postur_ut_virkt boolean, netfang text,
               stofnad timestamptz, notendur bigint, fyrirtaeki bigint, taskar bigint, geymsla_baeti bigint)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
begin
  if not er_rekstraradili() then raise exception 'Bara rekstraraðili Glerhússins' using errcode = '42501'; end if;
  return query
  select s.id, s.slug, s.nafn, s.stada, s.sendir_fra, s.postur_ut_virkt, s.netfang, s.stofnad,
         (select count(*) from public.notendur n where n.stofa_id = s.id),
         (select count(*) from public.fyrirtaeki f where f.stofa_id = s.id),
         (select count(*) from public.taskar t where t.stofa_id = s.id),
         (select coalesce(sum(case when (o.metadata->>'size') ~ '^[0-9]{1,18}$' then (o.metadata->>'size')::bigint else 0 end), 0)::bigint
            from storage.objects o
           where o.bucket_id in ('vidhengi', 'merki')
             and ((storage.foldername(o.name))[1] = 'stofa-' || s.id::text
                  or (storage.foldername(o.name))[1] in (select f.id::text from public.fyrirtaeki f where f.stofa_id = s.id)))
    from stofur s
   order by s.stofnad;
end $$;

create or replace function samthykkja_stofu(p_slug text) returns boolean
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v uuid;
begin
  if not er_rekstraradili() then raise exception 'Bara rekstraraðili Glerhússins' using errcode = '42501'; end if;
  perform set_config('glerhus.rekstur', '1', true);
  update stofur set stada = 'virk' where slug = p_slug and stada = 'bidur' returning id into v;
  perform set_config('glerhus.rekstur', '', true);
  if v is null then raise exception 'Stofan fannst ekki eða bíður ekki samþykkis' using errcode = 'P0002'; end if;
  insert into rekstur_log (notandi, adgerd, stofa_id, gogn) values (auth.uid(), 'samthykkja_stofu', v, jsonb_build_object('slug', p_slug));
  return true;
end $$;

create or replace function loka_stofu(p_slug text, p_astaeda text) returns boolean
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v uuid;
begin
  if not er_rekstraradili() then raise exception 'Bara rekstraraðili Glerhússins' using errcode = '42501'; end if;
  if p_slug = 'tveir' then raise exception 'Stofu Tveir er ekki lokað hér' using errcode = '42501'; end if;
  perform set_config('glerhus.rekstur', '1', true);
  update stofur set stada = 'lokud' where slug = p_slug and stada <> 'lokud' returning id into v;
  perform set_config('glerhus.rekstur', '', true);
  if v is null then raise exception 'Stofan fannst ekki eða er þegar lokuð' using errcode = 'P0002'; end if;
  insert into rekstur_log (notandi, adgerd, stofa_id, gogn)
  values (auth.uid(), 'loka_stofu', v, jsonb_build_object('slug', p_slug, 'astaeda', left(p_astaeda, 500)));
  return true;
end $$;

create or replace function opna_stofu(p_slug text) returns boolean
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v uuid;
begin
  if not er_rekstraradili() then raise exception 'Bara rekstraraðili Glerhússins' using errcode = '42501'; end if;
  perform set_config('glerhus.rekstur', '1', true);
  update stofur set stada = 'virk' where slug = p_slug and stada = 'lokud' returning id into v;
  perform set_config('glerhus.rekstur', '', true);
  if v is null then raise exception 'Stofan fannst ekki eða er ekki lokuð' using errcode = 'P0002'; end if;
  insert into rekstur_log (notandi, adgerd, stofa_id, gogn) values (auth.uid(), 'opna_stofu', v, jsonb_build_object('slug', p_slug));
  return true;
end $$;

create or replace function stilla_skraningu(p_opin boolean) returns boolean
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
begin
  if not er_rekstraradili() then raise exception 'Bara rekstraraðili Glerhússins' using errcode = '42501'; end if;
  if p_opin is null then raise exception 'Segðu til um opin eða lokuð'; end if;
  insert into stillingar_innri (lykill, gildi) values ('skraning_opin', case when p_opin then 'ja' else 'nei' end)
  on conflict (lykill) do update set gildi = excluded.gildi;
  insert into rekstur_log (notandi, adgerd, stofa_id, gogn) values (auth.uid(), 'stilla_skraningu', null, jsonb_build_object('opin', p_opin));
  return true;
end $$;

create or replace function postur_ut(p_slug text, p_virkt boolean) returns boolean
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v uuid;
begin
  if not er_rekstraradili() then raise exception 'Bara rekstraraðili Glerhússins' using errcode = '42501'; end if;
  if p_virkt is null then raise exception 'Segðu til um virkt eða stöðvað'; end if;
  perform set_config('glerhus.rekstur', '1', true);
  update stofur set postur_ut_virkt = p_virkt where slug = p_slug returning id into v;
  perform set_config('glerhus.rekstur', '', true);
  if v is null then raise exception 'Stofan fannst ekki' using errcode = 'P0002'; end if;
  insert into rekstur_log (notandi, adgerd, stofa_id, gogn) values (auth.uid(), 'postur_ut', v, jsonb_build_object('slug', p_slug, 'virkt', p_virkt));
  return true;
end $$;

-- 3k. Útflutningur og eyðing gagna einnar stofu (rekstur, service_role)
create or replace function utflutningur_stofu(p_stofa uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare t text; v jsonb; r jsonb;
begin
  if not exists (select 1 from stofur s where s.id = p_stofa) then raise exception 'Stofan fannst ekki' using errcode = 'P0002'; end if;
  v := jsonb_build_object('stofur', (select jsonb_agg(to_jsonb(s) - 'vefform_lykill') from stofur s where s.id = p_stofa));
  foreach t in array array['fyrirtaeki', 'notendur', 'verkefni', 'verkefni_innri', 'taskar', 'undirverk', 'athugasemdir', 'vidhengi',
    'timar', 'snid', 'snid_taskar', 'samningar', 'aukaverkefni', 'taxtar', 'innri_taskar', 'fundir', 'dagatal_atburdir',
    'fyrirspurnir', 'kerfisstillingar', 'midlar', 'maelingar', 'midla_faerslur', 'myndbond', 'myndband_tolur', 'skyrslur',
    'tolfraedi_sendingar', 'postholf_thraedir', 'postholf_skilabod', 'postholf_svor', 'tengingar',
    'bod', 'reikningsdrog', 'verk_netfong', 'notkun', 'postur_inn_log'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) - %L), ''[]''::jsonb) from public.%I x where x.stofa_id = $1',
                   case when t = 'tengingar' then 'lykill_id' else '' end, t)
       into r using p_stofa;
    v := v || jsonb_build_object(t, r);
  end loop;
  -- Undirskriftir eru á notanda (engin stofa_id): notendur stofunnar
  v := v || jsonb_build_object('undirskriftir', (select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) from public.undirskriftir u
                                                  where u.notandi_id in (select n.id from public.notendur n where n.stofa_id = p_stofa)));
  return v;
end $$;

create or replace function eyda_stofu_gogn(p_stofa uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare t text; n bigint; v jsonb := '{}'::jsonb;
begin
  if p_stofa is null or p_stofa = tveir_stofa() or exists (select 1 from stofur s where s.id = p_stofa and s.slug = 'tveir') then
    raise exception 'Stofu Tveir er aldrei eytt' using errcode = '42501';
  end if;
  if not exists (select 1 from stofur s where s.id = p_stofa) then raise exception 'Stofan fannst ekki' using errcode = 'P0002'; end if;
  -- Vault leyndarmálin eftir auðkenni
  delete from vault.secrets where id in (select g.lykill_id from tengingar g where g.stofa_id = p_stofa and g.lykill_id is not null);
  -- Undirskriftir notenda stofunnar (á notanda, engin stofa_id), áður en notendunum er eytt
  delete from public.undirskriftir where notandi_id in (select n.id from public.notendur n where n.stofa_id = p_stofa);
  get diagnostics n = row_count;
  v := v || jsonb_build_object('undirskriftir', n);
  -- Börn á undan foreldrum (timar á undan verkefni_innri: stilla_klst býr hana annars til aftur)
  foreach t in array array['athugasemdir', 'vidhengi', 'undirverk', 'timar', 'verkefni_innri', 'taskar', 'verkefni',
    'myndband_tolur', 'myndbond', 'midla_faerslur', 'maelingar', 'midlar', 'skyrslur', 'tolfraedi_sendingar',
    'postholf_svor', 'postholf_skilabod', 'postholf_thraedir', 'snid_taskar', 'snid', 'reikningsdrog', 'samningar',
    'aukaverkefni', 'innri_taskar', 'fundir', 'dagatal_atburdir', 'kerfisstillingar', 'tengingar', 'taxtar',
    'fyrirspurnir', 'bod', 'notendur', 'fyrirtaeki', 'vel_lyklar', 'verk_netfong', 'notkun', 'postur_inn_log', 'oauth_stada'] loop
    execute format('delete from public.%I where stofa_id = $1', t) using p_stofa;
    get diagnostics n = row_count;
    v := v || jsonb_build_object(t, n);
  end loop;
  delete from stofur where id = p_stofa;
  return v;
end $$;

-- --------------------------------------------------------------------------
-- 4. Gömlu tengingafallin verða Tveir umbúðir (live profa-tengingu kallar þau
--    þar til nýja útgáfan er komin; 2026-11-23-stofur-3b-hreinsa.sql fellir þau)
-- --------------------------------------------------------------------------
create or replace function tenging_lykill(p_veita text) returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select tenging_lykill(tveir_stofa(), p_veita)
$$;

create or replace function skra_tengingarprufu(p_veita text, p_svar text) returns void
language sql volatile security definer set search_path = public, extensions, pg_temp as $$
  select skra_tengingarprufu(tveir_stofa(), p_veita, p_svar)
$$;

-- --------------------------------------------------------------------------
-- Réttindi falla. Sömu línur og í eldri flutningunum fyrir lyklaföllin
-- (create or replace heldur réttindunum, þetta staðfestir þau). Ný föll fá
-- bara það sem kafli 3.3 segir.
-- --------------------------------------------------------------------------
do $$
declare f text;
begin
  -- Lyklaföll Apps Script (kafli 5.2): anon
  foreach f in array array['taskur_ur_posti(text,text,text,text,text)', 'lokid_otilkynnt(text)', 'merkja_tilkynnt(text,uuid[])',
    'undirverk_otilkynnt(text)', 'merkja_undirverk_sent(text,uuid[])', 'midlar_til_soefnunar(text)', 'skra_maelingar(text,jsonb)',
    'skra_faerslur(text,jsonb)', 'manadar_tolur(text,date)', 'vista_skyrslu(text,uuid,date,jsonb,text)', 'skyrslur_til_sendingar(text)',
    'merkja_skyrslu_senda(text,uuid[])', 'tolfraedi_sendingar_til(text)', 'merkja_tolfraedi_sendingu(text,uuid,text)',
    'postholf_skra(text,jsonb,timestamptz)', 'postholf_svor_til(text)', 'merkja_postholf_svar(text,uuid,text)',
    'dagatal_skra(text,jsonb,timestamptz,timestamptz)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon', f);
  end loop;

  -- Ný föll sem anon kallar (lykill eða formlykill athugaður í fallinu)
  foreach f in array array['postur_inn(text,text,text,text,text,text,text,boolean,text)', 'skra_fyrirspurn(text,jsonb)',
    'afhending_slod_heimild(text,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function public.%s to anon', f);
  end loop;

  -- Innskráðir (fallið athugar stjórnanda eða rekstraraðila sjálft)
  foreach f in array array['verk_ur_thraedi(text,uuid)', 'stofur_yfirlit()', 'samthykkja_stofu(text)', 'loka_stofu(text,text)',
    'opna_stofu(text)', 'stilla_skraningu(boolean)', 'postur_ut(text,boolean)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;

  -- Bara þjónustan (Edge Functions)
  foreach f in array array['stofna_stofu(text,text,text,text,jsonb,text,text)', 'skra_bod(uuid,text,text,text,uuid,uuid,boolean)',
    'notandi_til(text)', 'tengja_notanda_stofu(uuid,uuid,text,uuid)', 'tenging_lykill(uuid,text)',
    'skra_tengingarprufu(uuid,text,text)', 'vista_oauth_tengingu(uuid,text,jsonb,jsonb)', 'utflutningur_stofu(uuid)',
    'eyda_stofu_gogn(uuid)', 'tenging_lykill(text)', 'skra_tengingarprufu(text,text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 5. Skoðanirnar fyrir Make: bara stofa þess sem les, Tveir fyrir service_role
-- --------------------------------------------------------------------------
create or replace view bidur_vidskiptavina
with (security_invoker = true) as
  select t.id, t.titill, t.skiladagur, t.uppfaert,
         f.id as fyrirtaeki_id, f.nafn as fyrirtaeki,
         n.netfang, n.nafn as notandi, t.stofa_id
    from taskar t
    join fyrirtaeki f on f.id = t.fyrirtaeki_id
    join notendur n   on n.fyrirtaeki_id = t.fyrirtaeki_id
   where t.stada = 'bid_vidskiptavinar'
     and t.stofa_id = coalesce((select min_stofa()), (select tveir_stofa()));

create or replace view olokid_rukkun
with (security_invoker = true) as
  select v.id, v.titill, v.verd_okkar, v.uppfaert,
         f.nafn as fyrirtaeki, i.klst, i.reikningur, v.stofa_id
    from verkefni v
    join fyrirtaeki f      on f.id = v.fyrirtaeki_id
    join verkefni_innri i  on i.verkefni_id = v.id
   where v.stada = 'lokid'
     and v.innan_samnings = false
     and i.reikningur = 'ekki_rukkad'
     and v.stofa_id = coalesce((select min_stofa()), (select tveir_stofa()));

create or replace view okkar_a_eftir
with (security_invoker = true) as
  select t.id, t.titill, t.skiladagur, t.forgangur, t.uppfaert,
         n.nafn as abyrgd_nafn, n.netfang as abyrgd_netfang, f.nafn as fyrirtaeki, t.stofa_id
    from innri_taskar t
    left join notendur n   on n.id = t.abyrgd
    left join fyrirtaeki f on f.id = t.fyrirtaeki_id
   where t.stada <> 'lokid' and t.skiladagur is not null and t.skiladagur < current_date
     and t.stofa_id = coalesce((select min_stofa()), (select tveir_stofa()));

create or replace view fyrirspurnir_osvaradar
with (security_invoker = true) as
  select id, nafn, netfang, simi, fyrirtaeki_nafn, form, uppruni, stofnad, stofa_id
    from fyrirspurnir
   where stada = 'ny' and stofnad < now() - interval '1 day'
     and stofa_id = coalesce((select min_stofa()), (select tveir_stofa()));

-- --------------------------------------------------------------------------
-- 6. Nýtt fall í public fær ekki sjálfkrafa rétt fyrir anon eða authenticated.
--    (Sjálfgefinn réttur public á föllum er alls staðar, ekki bara í schema;
--    vörðurinn, atriði 4, grípur nýtt fall sem anon gæti kallað.)
-- --------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

notify pgrst, 'reload schema';

-- --------------------------------------------------------------------------
-- 7. Vörðurinn (kafli 3.5). Sami kubbur og í kanna-stofur.sql.
-- --------------------------------------------------------------------------
-- VORDUR BYRJAR
do $kanna$
declare
  villur text[] := '{}';
  r record;
  t text;
  eftir5 boolean;
  -- Töflurnar 30 með stofa_id (kafli 1.4)
  stofutoflur text[] := array['athugasemdir', 'aukaverkefni', 'dagatal_atburdir', 'fundir', 'fyrirspurnir',
    'fyrirtaeki', 'innri_taskar', 'kerfisstillingar', 'maelingar', 'midla_faerslur', 'midlar', 'myndband_tolur',
    'myndbond', 'notendur', 'postholf_skilabod', 'postholf_svor', 'postholf_thraedir', 'samningar', 'skyrslur',
    'snid', 'snid_taskar', 'taskar', 'taxtar', 'tengingar', 'timar', 'tolfraedi_sendingar', 'undirverk',
    'verkefni', 'verkefni_innri', 'vidhengi'];
  -- Töflur án stofa_id (atriði 1)
  utan text[] := array['stofur', 'vel_lyklar', 'stillingar_innri', 'midlar_innri', 'undirskriftir', 'verk_netfong',
    'skraningar', 'oauth_stada', 'rekstur_log', 'notkun', 'postur_inn_log', 'bod', 'reikningsdrog'];
  -- Föll sem anon má kalla (atriði 4): lyklaföllin í kafla 5.2 og þrjú ný
  anon_leyft text[] := array['taskur_ur_posti', 'lokid_otilkynnt', 'merkja_tilkynnt', 'undirverk_otilkynnt',
    'merkja_undirverk_sent', 'midlar_til_soefnunar', 'skra_maelingar', 'skra_faerslur', 'manadar_tolur',
    'vista_skyrslu', 'skyrslur_til_sendingar', 'merkja_skyrslu_senda', 'tolfraedi_sendingar_til',
    'merkja_tolfraedi_sendingu', 'postholf_skra', 'postholf_svor_til', 'merkja_postholf_svar', 'dagatal_skra',
    'postur_inn', 'skra_fyrirspurn', 'afhending_slod_heimild'];
  -- Orð sem sýna að definer fall er bundið stofu (atriði 5); föllin sjálf teljast líka bundin
  ordfaeri text[] := array['min_stofa', 'tveir_stofa', 'stofa_heimild', 'er_admin', 'mitt_fyrirtaeki',
    'er_rekstraradili', 'p_stofa'];
  -- Yfirfarin definer föll sem nota ekkert orðanna (atriði 5)
  yfirfarin text[] := array['reikna_framvindu', 'myndband_ur_faerslu', 'tolu_gildi', 'rls_auto_enable',
    'er_fratekid_slug', 'afhending_ma_lesa', 'undirverk_skra_opin', 'notandi_til', 'utflutningur_stofu',
    'eyda_stofu_gogn', 'ny_vel_lykill', 'skra_notkun',
    'stofna_stofu',      -- service_role: býr stofuna til, á enga stofu fyrir
    'skra_fyrirspurn'];  -- anon: stofan kemur úr vefform_lykill, ekki frá þeim sem kallar
begin
  -- Skref 5 (veggirnir) er á ef einhver stofa_vegg regla er til eða varaleiðin stofa_vara er horfin
  eftir5 := exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'stofa_vegg')
            or not exists (select 1 from stillingar_innri where lykill = 'stofa_vara');

  -- 1. Grunntafla án NOT NULL stofa_id (notendur má vera null)
  for r in
    select c.relname from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
       and not (c.relname = any (utan))
       and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'stofa_id'
                        and not a.attisdropped and (a.attnotnull or c.relname = 'notendur'))
     order by 1
  loop
    villur := villur || format('1. %s: vantar stofa_id (not null)', r.relname);
  end loop;

  -- 2. (eftir skref 5) stofa_vegg sem RESTRICTIVE á öllum 30 töflunum
  if eftir5 then
    foreach t in array stofutoflur loop
      if not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t
                       and p.policyname = 'stofa_vegg' and p.permissive = 'RESTRICTIVE') then
        villur := villur || format('2. %s: vantar RESTRICTIVE regluna stofa_vegg', t);
      end if;
    end loop;
  end if;

  -- 3. Tafla án RLS
  for r in
    select c.relname from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
     order by 1
  loop
    villur := villur || format('3. %s: RLS er ekki á', r.relname);
  end loop;

  -- 4. Fall sem anon má kalla en er ekki á listanum. Gikkjaföll eru ekki talin:
  --    þau verða ekki kölluð beint og réttur til að keyra þau er ekki athugaður í gikk.
  for r in
    select p.oid::regprocedure::text heiti from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
       and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
       and has_function_privilege('anon', p.oid, 'execute')
       and not (p.proname = any (anon_leyft))
     order by 1
  loop
    villur := villur || format('4. %s: anon má kalla það', r.heiti);
  end loop;

  -- 5. Definer fall (ekki gikkur) sem nefnir ekkert orðanna og er ekki yfirfarið
  for r in
    select p.oid::regprocedure::text heiti from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prosecdef
       and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
       and not (p.proname = any (yfirfarin)) and not (p.proname = any (ordfaeri))
       and not exists (select 1 from unnest(ordfaeri) o where p.prosrc ~ ('\m' || o || '\M'))
     order by 1
  loop
    villur := villur || format('5. %s: security definer án stofu', r.heiti);
  end loop;

  -- 6. Engin tafla í Realtime án yfirferðar
  if (select count(*) from pg_publication_tables where pubname = 'supabase_realtime') > 0 then
    villur := villur || format('6. supabase_realtime: %s', (select string_agg(schemaname || '.' || tablename, ', ')
                                                           from pg_publication_tables where pubname = 'supabase_realtime'));
  end if;

  -- 7. (eftir skref 5) varaleiðin stofa_vara á að vera horfin
  if eftir5 and exists (select 1 from stillingar_innri where lykill = 'stofa_vara') then
    villur := villur || '7. stillingar_innri: stofa_vara er enn til'::text;
  end if;

  if coalesce(array_length(villur, 1), 0) > 0 then
    raise exception 'Vörðurinn stenst ekki (% atriði):%', array_length(villur, 1), e'\n' || array_to_string(villur, e'\n');
  end if;
  raise notice 'Vörðurinn stenst (%).', case when eftir5 then 'eftir skref 5' else 'fyrir skref 5' end;
end $kanna$;
-- VORDUR ENDAR

-- Yfirlit: frumlyklarnir þrír
select conrelid::regclass::text tafla, pg_get_constraintdef(oid) frumlykill
  from pg_constraint
 where conrelid in ('public.kerfisstillingar'::regclass, 'public.dagatal_atburdir'::regclass, 'public.tengingar'::regclass)
   and contype = 'p'
 order by 1;
